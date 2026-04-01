/**
 * DB 레이어 — localStorage 캐시 + Supabase 동기화
 *
 * 핵심 원칙:
 *  - 모든 레코드에 updatedAt 자동 기록
 *  - 로컬 vs Supabase merge 시 updatedAt 최신 레코드가 이김
 *  - 삭제는 _deleted: true 소프트딜리트 → 실수로 살아나는 현상 방지
 *  - Supabase sync 실패 시 pending 대기열(localStorage) 저장 → 재연결 시 자동 재전송
 *  - Supabase 미설정 시 localStorage 단독으로 완전 동작
 */

import { dbCall, isConfigured } from './supabase.js'
import { uid, now } from './utils.js'

const PREFIX = 'asa_'
const PENDING_KEY = 'asa__pending_sync'
const key = (t) => PREFIX + t

// ─── localStorage 캐시
const cache = {
  get(t)    { try { return JSON.parse(localStorage.getItem(key(t)) || '[]') } catch { return [] } },
  set(t, d) { localStorage.setItem(key(t), JSON.stringify(d)) },
}

// ─── 미sync 대기열
const pendingQ = {
  get()      { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch { return [] } },
  push(item) { const q = this.get(); q.push(item); localStorage.setItem(PENDING_KEY, JSON.stringify(q)) },
  clear()    { localStorage.removeItem(PENDING_KEY) },
}

// ─── Supabase 전송 (실패 시 대기열 저장)
function sync(action, table, payload) {
  if (!isConfigured) return
  dbCall(action, table, payload).catch(e => {
    console.warn(`[Supabase sync 실패] ${action}/${table}:`, e.message)
    pendingQ.push({ action, table, payload, ts: Date.now() })
  })
}

// ─── 대기열 재전송
async function flushPending() {
  if (!isConfigured) return
  const q = pendingQ.get()
  if (!q.length) return
  pendingQ.clear()
  const results = await Promise.allSettled(
    q.map(({ action, table, payload }) =>
      dbCall(action, table, payload).catch(e => {
        console.warn(`[Supabase flush 실패] ${action}/${table}:`, e.message)
        pendingQ.push({ action, table, payload, ts: Date.now() })
        throw e
      })
    )
  )
  const ok = results.filter(r => r.status === 'fulfilled').length
  console.log(`[Supabase] 대기열 재전송: ${ok}/${q.length}건 성공`)
}

// ─── updatedAt 기준 merge: 더 최신 레코드가 이김, _deleted 반영
function mergeRecords(local, remote) {
  const map = new Map()

  local.forEach(r => map.set(r.id, r))

  remote.forEach(r => {
    const loc = map.get(r.id)
    if (!loc) {
      map.set(r.id, r)
    } else {
      const localTime  = new Date(loc.updatedAt  || loc.createdAt || 0).getTime()
      const remoteTime = new Date(r.updatedAt    || r.createdAt   || 0).getTime()
      if (remoteTime >= localTime) map.set(r.id, r)
    }
  })

  // _deleted 소프트딜리트 레코드 제거 후 반환
  return [...map.values()].filter(r => !r._deleted)
}

// ─── 동기화 대상 테이블 목록
// 기존 핵심 테이블 + 내 관리 / 수익 관련 테이블 추가
const SYNC_TABLES = [
  // 기존
  'users', 'classes', 'students', 'attendance', 'notes',
  'adSlots', 'attendanceTemplates',
  // 신규 — 내 관리 / 수익
  'revenueFees', 'revenuePayments',
  'trainings', 'careers', 'certificates', 'jobSubs',
]

// ─── 초기화: Supabase 데이터와 로컬 merge
export async function initFromSupabase() {
  if (!isConfigured) return false
  try {
    // 1) 대기열 먼저 재전송 — 로컬에만 있는 최신 변경사항 올리기
    await flushPending()

    // 2) Supabase 데이터 가져와서 merge
    await Promise.all(SYNC_TABLES.map(async (t) => {
      try {
        const remote = await dbCall('getAll', t)
        if (!Array.isArray(remote)) return
        const local  = cache.get(t)
        const merged = mergeRecords(local, remote)
        cache.set(t, merged)

        // 로컬에만 있는 레코드(Supabase sync 실패분) → Supabase 재전송
        const remoteIds = new Set(remote.map(r => r.id))
        local.filter(r => !remoteIds.has(r.id) && !r._deleted).forEach(r => {
          console.log(`[Supabase] 미sync 재전송: ${t}/${r.id}`)
          sync('insert', t, { data: r })
        })
      } catch (e) {
        console.warn(`[Supabase] ${t} 동기화 실패 — 로컬 데이터 유지:`, e.message)
      }
    }))

    // 3) settings merge
    try {
      const settings = await dbCall('getAll', 'settings')
      if (Array.isArray(settings)) {
        settings.forEach(row => {
          if (!row.key || !row.value) return
          const lk        = 'asa_settings_' + row.key
          const localRaw  = localStorage.getItem(lk)
          const localTime = localRaw ? (JSON.parse(localRaw)?._updatedAt || 0) : 0
          const remoteTime = row.updatedAt ? new Date(row.updatedAt).getTime() : 0
          if (!localRaw || remoteTime > localTime) {
            localStorage.setItem(lk, JSON.stringify(row.value))
          }
        })
        console.log('[Supabase] settings 동기화 완료')
      }
    } catch (e) {
      console.warn('[Supabase] settings 동기화 실패:', e.message)
    }

    console.log('[Supabase] 데이터 동기화 완료')
    return true
  } catch (e) {
    console.warn('[Supabase] 전체 실패 — 로컬 데이터로 동작:', e.message)
    return false
  }
}

// ─── 핵심 DB 메서드
export const db = {
  get:    (t)     => cache.get(t).filter(r => !r._deleted),
  set:    (t, d)  => cache.set(t, d),
  getOne: (t, id) => cache.get(t).find(r => r.id === id && !r._deleted) || null,

  insert(t, record) {
    const r = { ...record, updatedAt: now() }
    const rows = cache.get(t)
    rows.push(r)
    cache.set(t, rows)
    sync('insert', t, { data: r })
    return r
  },

  update(t, id, patch) {
    const updated = { ...patch, updatedAt: now() }
    const rows = cache.get(t).map(r => r.id === id ? { ...r, ...updated } : r)
    cache.set(t, rows)
    sync('update', t, { id, patch: updated })
    return rows.find(r => r.id === id)
  },

  // 소프트딜리트: _deleted 플래그 기록 → merge 시 양쪽에서 안전하게 제거
  delete(t, id) {
    const rows = cache.get(t).map(r =>
      r.id === id ? { ...r, _deleted: true, updatedAt: now() } : r
    )
    cache.set(t, rows)
    sync('delete', t, { id })
  },

  where:    (t, fn) => cache.get(t).filter(r => !r._deleted && fn(r)),
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  },
}

// ─── 기존 테이블 ───────────────────────────────────────────────

export const Users = {
  all:         ()      => db.get('users'),
  find:        (id)    => db.getOne('users', id),
  findByEmail: (email) => db.get('users').find(u => u.email === email?.toLowerCase()),
  insert:      (u)     => db.insert('users', u),
  update:      (id, p) => db.update('users', id, p),
  delete:      (id)    => db.delete('users', id),
  teachers:    ()      => db.get('users').filter(u => u.role === 'teacher'),
  pending:     ()      => db.get('users').filter(u => u.role === 'teacher' && u.level === 1 && u.verifyImg),
}

export const Classes = {
  all:       ()      => db.get('classes'),
  find:      (id)    => db.getOne('classes', id),
  byTeacher: (tid)   => db.where('classes', c => c.teacherId === tid),
  insert:    (c)     => db.insert('classes', c),
  update:    (id, p) => db.update('classes', id, p),
  delete:    (id)    => db.delete('classes', id),
}

export const Students = {
  all:       ()      => db.get('students'),
  find:      (id)    => db.getOne('students', id),
  byTeacher: (tid)   => db.where('students', s => s.teacherId === tid),
  byClass:   (cid)   => db.where('students', s => s.classIds?.includes(cid)),
  confirmed: (cid)   => db.where('students', s => s.classIds?.includes(cid) && s.status === 'confirmed'),
  insert:    (s)     => db.insert('students', s),
  update:    (id, p) => db.update('students', id, p),
  delete:    (id)    => db.delete('students', id),
}

export const Attendance = {
  all:            ()               => db.get('attendance'),
  byClass:        (cid)            => db.where('attendance', a => a.classId === cid),
  byClassDate:    (cid, date)      => db.where('attendance', a => a.classId === cid && a.date === date),
  byStudentClass: (sid, cid)       => db.where('attendance', a => a.studentId === sid && a.classId === cid),
  find:           (cid, sid, date) => db.get('attendance').find(a => a.classId === cid && a.studentId === sid && a.date === date),
  upsert(record) {
    const ex = this.find(record.classId, record.studentId, record.date)
    if (ex) {
      const updated = { ...ex, ...record, updatedAt: now() }
      cache.set('attendance', cache.get('attendance').map(r => r.id === ex.id ? updated : r))
      sync('attendanceUpsert', 'attendance', { data: updated })
      return updated
    }
    return db.insert('attendance', record)
  },
  delete: (id) => db.delete('attendance', id),
}

export const AdSlots = {
  all:    ()      => db.get('adSlots'),
  find:   (id)    => db.getOne('adSlots', id),
  update: (id, p) => db.update('adSlots', id, p),
  insert: (s)     => db.insert('adSlots', s),
}

export const Templates = {
  all:      ()       => db.get('attendanceTemplates'),
  find:     (id)     => db.getOne('attendanceTemplates', id),
  bySchool: (school) => db.where('attendanceTemplates', t => t.school === school && t.active),
  insert:   (t)      => db.insert('attendanceTemplates', t),
  update:   (id, p)  => db.update('attendanceTemplates', id, p),
  delete:   (id)     => db.delete('attendanceTemplates', id),
}

export const Notes = {
  all:           ()          => db.get('notes'),
  byTeacherDate: (tid, date) => db.where('notes', n => n.teacherId === tid && n.date === date),
  insert:        (n)         => db.insert('notes', n),
  update:        (id, p)     => db.update('notes', id, p),
  delete:        (id)        => db.delete('notes', id),
}

export const Settings = {
  get(k)    { try { return JSON.parse(localStorage.getItem('asa_settings_' + k)) } catch { return null } },
  set(k, v) {
    const val = typeof v === 'object' && v !== null ? { ...v, _updatedAt: Date.now() } : v
    localStorage.setItem('asa_settings_' + k, JSON.stringify(val))
    if (isConfigured) {
      dbCall('settingSet', 'settings', { id: k, data: v })
        .then(() => console.log(`[Settings] "${k}" Supabase 저장 완료`))
        .catch(e => {
          console.warn(`[Settings] "${k}" Supabase 저장 실패:`, e.message)
          pendingQ.push({ action: 'settingSet', table: 'settings', payload: { id: k, data: v }, ts: Date.now() })
        })
    }
  },
  getAll() {
    const r = {}
    Object.keys(localStorage).filter(k => k.startsWith('asa_settings_')).forEach(k => {
      try { r[k.replace('asa_settings_', '')] = JSON.parse(localStorage.getItem(k)) } catch {}
    })
    return r
  },
}

// ─── 본사 학부모 회원
export const ParentMembers = {
  all:         ()      => db.get('parentMembers'),
  find:        (id)    => db.getOne('parentMembers', id),
  findByPhone: (phone) => db.get('parentMembers').find(p => p.phone === phone?.replace(/[^0-9]/g, '')),

  upsert(phone, name = '') {
    const clean = phone?.replace(/[^0-9]/g, '')
    if (!clean || clean.length < 9) return null
    const existing = this.findByPhone(clean)
    if (existing) return existing
    const record = { id: uid(), phone: clean, name, appJoined: false, memo: '', createdAt: now() }
    db.insert('parentMembers', record)
    return record
  },
}

// ─── 선생님-학부모 연결
export const TeacherParentLinks = {
  all:         ()    => db.get('teacherParentLinks'),
  byTeacher:   (tid) => db.where('teacherParentLinks', l => l.teacherId === tid),
  active:      (tid) => db.where('teacherParentLinks', l => l.teacherId === tid && l.status === 'active'),
  activeCount: (tid) => db.where('teacherParentLinks', l => l.teacherId === tid && l.status === 'active').length,

  link(teacherId, student, classId) {
    if (!student.parentPhone) return
    const parent = ParentMembers.upsert(student.parentPhone)
    if (!parent) return
    const existing = db.get('teacherParentLinks').find(l =>
      l.teacherId === teacherId && l.parentMemberId === parent.id && l.studentId === student.id
    )
    if (existing?.status === 'active') return
    db.insert('teacherParentLinks', {
      id: uid(), teacherId,
      parentMemberId: parent.id,
      studentId: student.id, classId,
      status: 'active', startedAt: now(),
      endedAt: null, endReason: null, createdAt: now(),
    })
  },

  unlink(teacherId, studentId, reason = 'student_left') {
    db.where('teacherParentLinks', l =>
      l.teacherId === teacherId && l.studentId === studentId && l.status === 'active'
    ).forEach(l => db.update('teacherParentLinks', l.id, {
      status: 'ended', endedAt: now(), endReason: reason,
    }))
  },

  unlinkByClass(teacherId, classId) {
    db.where('teacherParentLinks', l =>
      l.teacherId === teacherId && l.classId === classId && l.status === 'active'
    ).forEach(l => db.update('teacherParentLinks', l.id, {
      status: 'ended', endedAt: now(), endReason: 'class_ended',
    }))
  },
}

// ─── 포인트
export const Points = {
  all:       ()    => db.get('points'),
  byTeacher: (tid) => db.where('points', p => p.teacherId === tid),

  balance(tid) {
    const now_ = new Date().toISOString()
    return this.byTeacher(tid).reduce((sum, p) => {
      if (p.type === 'earn') {
        if (p.expiresAt && p.expiresAt < now_) return sum
        return sum + (p.amount || 0)
      }
      return sum - (p.amount || 0)
    }, 0)
  },

  earn(teacherId, amount, { source='shop', parentMemberId='', orderId='', memo='', expireDays=365 } = {}) {
    const expiresAt = new Date(Date.now() + expireDays * 86400000).toISOString()
    return db.insert('points', { id:uid(), teacherId, type:'earn', amount, source, parentMemberId, orderId, memo, expiresAt, createdAt:now() })
  },

  use(teacherId, amount, { memo='', orderId='' } = {}) {
    if (this.balance(teacherId) < amount) throw new Error('포인트가 부족합니다.')
    return db.insert('points', { id:uid(), teacherId, type:'use', amount, source:'use', memo, orderId, createdAt:now() })
  },
}

// ─── 지사
export const Branches = {
  all:    ()      => db.get('branches'),
  find:   (id)    => db.getOne('branches', id),
  active: ()      => db.where('branches', b => b.active),
  insert: (b)     => db.insert('branches', b),
  update: (id, p) => db.update('branches', id, p),
  delete: (id)    => db.delete('branches', id),

  assignTeacher(branchId, teacherId)  { Users.update(teacherId, { branchId }) },
  unassignTeacher(teacherId)          { Users.update(teacherId, { branchId: null }) },
}

// ─── 수익관리 ─────────────────────────────────────────────────

// 수강료 설정 (수업별)
export const RevenueFees = {
  all:       ()    => db.get('revenueFees'),
  byTeacher: (tid) => db.where('revenueFees', r => r.teacherId === tid),
  byClass:   (cid) => db.get('revenueFees').find(r => r.classId === cid && !r._deleted) || null,
  insert:    (r)   => db.insert('revenueFees', r),
  update:    (id, p) => db.update('revenueFees', id, p),
  delete:    (id)  => db.delete('revenueFees', id),

  // 수업별 fee upsert (기존 있으면 update, 없으면 insert)
  upsert(record) {
    const ex = this.byClass(record.classId)
    if (ex) return db.update('revenueFees', ex.id, record)
    return db.insert('revenueFees', { id: uid(), ...record, createdAt: now() })
  },
}

// 입금 내역
export const RevenuePayments = {
  all:       ()    => db.get('revenuePayments'),
  byTeacher: (tid) => db.where('revenuePayments', r => r.teacherId === tid),
  byClass:   (cid) => db.where('revenuePayments', r => r.classId === cid),
  insert:    (r)   => db.insert('revenuePayments', r),
  update:    (id, p) => db.update('revenuePayments', id, p),
  delete:    (id)  => db.delete('revenuePayments', id),
}

// ─── 연수관리 ─────────────────────────────────────────────────
export const Trainings = {
  all:       ()    => db.get('trainings'),
  byTeacher: (tid) => db.where('trainings', r => r.teacherId === tid),
  find:      (id)  => db.getOne('trainings', id),
  insert:    (r)   => db.insert('trainings', r),
  update:    (id, p) => db.update('trainings', id, p),
  delete:    (id)  => db.delete('trainings', id),
}

// ─── 이력관리 ─────────────────────────────────────────────────
export const Careers = {
  all:       ()    => db.get('careers'),
  byTeacher: (tid) => db.where('careers', r => r.teacherId === tid),
  find:      (id)  => db.getOne('careers', id),
  insert:    (r)   => db.insert('careers', r),
  update:    (id, p) => db.update('careers', id, p),
  delete:    (id)  => db.delete('careers', id),
}

// ─── 자격증관리 ───────────────────────────────────────────────
export const Certificates = {
  all:       ()    => db.get('certificates'),
  byTeacher: (tid) => db.where('certificates', r => r.teacherId === tid),
  find:      (id)  => db.getOne('certificates', id),
  insert:    (r)   => db.insert('certificates', r),
  update:    (id, p) => db.update('certificates', id, p),
  delete:    (id)  => db.delete('certificates', id),
}

// ─── 공고 구독 설정 ───────────────────────────────────────────
export const JobSubs = {
  all:       ()    => db.get('jobSubs'),
  byTeacher: (tid) => db.where('jobSubs', r => r.teacherId === tid),
  find:      (id)  => db.getOne('jobSubs', id),
  insert:    (r)   => db.insert('jobSubs', r),
  update:    (id, p) => db.update('jobSubs', id, p),
  delete:    (id)  => db.delete('jobSubs', id),
}
