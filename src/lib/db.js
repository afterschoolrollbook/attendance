/**
 * DB 레이어 — localStorage 캐시 + Supabase 동기화
 * 읽기: localStorage (즉시) / 쓰기: localStorage → Supabase 백그라운드 동기화
 * Supabase 미설정 시 localStorage 전용으로 동작
 */

import { dbCall, isConfigured } from './supabase.js'
import { uid, now } from './utils.js'

const PREFIX = 'asa_'
const key = (t) => PREFIX + t

const cache = {
  get(t)    { try { return JSON.parse(localStorage.getItem(key(t)) || '[]') } catch { return [] } },
  set(t, d) { localStorage.setItem(key(t), JSON.stringify(d)) },
}

function sync(action, table, payload) {
  if (!isConfigured) return
  dbCall(action, table, payload).catch(e =>
    console.warn(`[Supabase sync] ${action}/${table}:`, e.message)
  )
}

export async function initFromSupabase() {
  if (!isConfigured) return false
  try {
    const tables = ['users','classes','students','attendance','notes','adSlots','attendanceTemplates']
    await Promise.all(tables.map(async (t) => {
      try { const r = await dbCall('getAll', t); if (Array.isArray(r)) cache.set(t, r) } catch {}
    }))

    // ✅ settings 로딩 추가 — 모든 기기에서 관리자 설정(소셜로그인 키 등)을 읽어옴
    try {
      const settings = await dbCall('getAll', 'settings')
      if (Array.isArray(settings)) {
        settings.forEach(row => {
          // DB의 settings 테이블: { id: 'social', data: { googleClientId: ... } }
          if (row.id && row.data) {
            localStorage.setItem('asa_settings_' + row.id, JSON.stringify(row.data))
          }
        })
        console.log('[Supabase] settings 동기화 완료')
      }
    } catch (e) {
      console.warn('[Supabase] settings 동기화 실패:', e.message)
    }

    console.log('[Supabase] 데이터 동기화 완료')
    return true
  } catch { return false }
}

export const db = {
  get:    (t)      => cache.get(t),
  set:    (t, d)   => cache.set(t, d),
  getOne: (t, id)  => cache.get(t).find(r => r.id === id) || null,
  insert(t, record) {
    const rows = cache.get(t); rows.push(record); cache.set(t, rows)
    sync('insert', t, { data: record }); return record
  },
  update(t, id, patch) {
    const rows = cache.get(t).map(r => r.id === id ? { ...r, ...patch } : r)
    cache.set(t, rows); sync('update', t, { id, patch })
    return rows.find(r => r.id === id)
  },
  delete(t, id) {
    cache.set(t, cache.get(t).filter(r => r.id !== id))
    sync('delete', t, { id })
  },
  where: (t, fn) => cache.get(t).filter(fn),
  clearAll() { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)) },
}

export const Users = {
  all:         ()      => db.get('users'),
  find:        (id)    => db.getOne('users', id),
  findByEmail: (email) => db.get('users').find(u => u.email === email?.toLowerCase()),
  insert:      (u)     => db.insert('users', u),
  update:      (id, p) => db.update('users', id, p),
  teachers:    ()      => db.get('users').filter(u => u.role === 'teacher'),
  pending:     ()      => db.get('users').filter(u => u.role === 'teacher' && u.level === 1 && u.verifyImg),
}

export const Classes = {
  all:       ()       => db.get('classes'),
  find:      (id)     => db.getOne('classes', id),
  byTeacher: (tid)    => db.where('classes', c => c.teacherId === tid),
  insert:    (c)      => db.insert('classes', c),
  update:    (id, p)  => db.update('classes', id, p),
  delete:    (id)     => db.delete('classes', id),
}

export const Students = {
  all:       ()       => db.get('students'),
  find:      (id)     => db.getOne('students', id),
  byTeacher: (tid)    => db.where('students', s => s.teacherId === tid),
  byClass:   (cid)    => db.where('students', s => s.classIds?.includes(cid)),
  confirmed: (cid)    => db.where('students', s => s.classIds?.includes(cid) && s.status === 'confirmed'),
  insert:    (s)      => db.insert('students', s),
  update:    (id, p)  => db.update('students', id, p),
  delete:    (id)     => db.delete('students', id),
}

export const Attendance = {
  all:            ()          => db.get('attendance'),
  byClass:        (cid)       => db.where('attendance', a => a.classId === cid),
  byClassDate:    (cid, date) => db.where('attendance', a => a.classId === cid && a.date === date),
  byStudentClass: (sid, cid)  => db.where('attendance', a => a.studentId === sid && a.classId === cid),
  find:           (cid, sid, date) => db.get('attendance').find(a => a.classId === cid && a.studentId === sid && a.date === date),
  upsert(record) {
    const ex = this.find(record.classId, record.studentId, record.date)
    if (ex) {
      const updated = { ...ex, ...record }
      cache.set('attendance', db.get('attendance').map(r => r.id === ex.id ? updated : r))
      sync('attendanceUpsert', 'attendance', { data: updated })
      return updated
    }
    return db.insert('attendance', record)
  },
  delete: (id) => db.delete('attendance', id),
}

export const AdSlots = {
  all:    ()       => db.get('adSlots'),
  find:   (id)     => db.getOne('adSlots', id),
  update: (id, p)  => db.update('adSlots', id, p),
  insert: (s)      => db.insert('adSlots', s),
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
    localStorage.setItem('asa_settings_' + k, JSON.stringify(v))
    // ✅ Supabase에도 저장 (다른 기기에서도 읽을 수 있도록)
    if (isConfigured) dbCall('settingSet', 'settings', { id: k, data: v }).catch(() => {})
  },
  getAll() {
    const r = {}
    Object.keys(localStorage).filter(k => k.startsWith('asa_settings_')).forEach(k => {
      try { r[k.replace('asa_settings_', '')] = JSON.parse(localStorage.getItem(k)) } catch {}
    })
    return r
  },
}

// ─── 본사 학부모 회원 (절대 삭제 안됨)
export const ParentMembers = {
  all:        ()      => db.get('parentMembers'),
  find:       (id)    => db.getOne('parentMembers', id),
  findByPhone:(phone) => db.get('parentMembers').find(p => p.phone === phone?.replace(/[^0-9]/g, '')),

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
  all:       ()    => db.get('teacherParentLinks'),
  byTeacher: (tid) => db.where('teacherParentLinks', l => l.teacherId === tid),
  active:    (tid) => db.where('teacherParentLinks', l => l.teacherId === tid && l.status === 'active'),
  activeCount:(tid)=> db.where('teacherParentLinks', l => l.teacherId === tid && l.status === 'active').length,

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
  all:        ()    => db.get('points'),
  byTeacher:  (tid) => db.where('points', p => p.teacherId === tid),

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
  all:        ()       => db.get('branches'),
  find:       (id)     => db.getOne('branches', id),
  active:     ()       => db.where('branches', b => b.active),
  insert:     (b)      => db.insert('branches', b),
  update:     (id, p)  => db.update('branches', id, p),
  delete:     (id)     => db.delete('branches', id),

  assignTeacher(branchId, teacherId) {
    Users.update(teacherId, { branchId })
  },
  unassignTeacher(teacherId) {
    Users.update(teacherId, { branchId: null })
  },
}
