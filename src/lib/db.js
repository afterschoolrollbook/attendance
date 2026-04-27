/**
 * DB 레이어 — 인메모리 캐시 + Supabase 동기화
 *
 * 핵심 원칙:
 *  - 모든 레코드에 updatedAt 자동 기록
 *  - 삭제는 _deleted: true 소프트딜리트
 *  - Supabase가 진실의 원천 — 페이지 로드 시 항상 Supabase에서 불러옴
 *  - localStorage 캐시 없음 → 5MB 한도 문제 없음
 *  - 멀티기기(PC/스마트폰) 항상 최신 데이터
 */

import { dbCall, isConfigured } from './supabase.js'
import { uid, now } from './utils.js'

// ─── 전역 DB 변경 이벤트 시스템
const _listeners = new Map()
export function onDbChange(table, fn) {
  if (!_listeners.has(table)) _listeners.set(table, new Set())
  _listeners.get(table).add(fn)
  return () => _listeners.get(table)?.delete(fn) // unsubscribe 반환
}
function _emit(table) {
  _listeners.get(table)?.forEach(fn => fn())
  _listeners.get('*')?.forEach(fn => fn(table))
}

// ─── 인메모리 캐시 (localStorage 대신 — 5MB 제한 없음)
const _cache = {}
const cache = {
  get(t)    { return _cache[t] || [] },
  set(t, d) { _cache[t] = d },
}

// ─── Supabase 전송
async function sync(action, table, payload) {
  if (!isConfigured) return
  try {
    await dbCall(action, table, payload)
  } catch (e) {
    console.warn(`[Supabase sync 실패] ${action}/${table}:`, e.message)
    throw e
  }
}

// ─── 동기화 대상 테이블 목록
const SYNC_TABLES = [
  // 기존
  'users', 'classes', 'students', 'attendance', 'notes',
  'adSlots', 'attendanceTemplates',
  // 신규 — 내 관리 / 수익
  'revenueFees', 'revenuePayments',
  'trainings', 'careers', 'educations', 'certificates', 'awards', 'jobSubs',
  // 교구 관리
  'supplySubjects', 'supplyVendors', 'supplyItems', 'supplyPlans', 'supplyPromos',
  // 로봇 교구 진도
  'supplyProducts', 'supplyProductPlans', 'supplyStudentProgress', 'supplyProgressLogs', 'supplySessionChecks',
  'lessonMemos',
  // 지사 / 학부모 회원 / 연결 정보
  'branches', 'parentMembers', 'teacherParentLinks',
  // 출결 서비스 설정
  'teacherServiceConfigs',
  // 안내 문구
  'messageGuides', 'messageCategories',
  // 선생님 프로필
  'teacherProfiles',
  // 방과후 서류
  'documents', 'customCategories',
  // 학교 담당자 포털
  'schoolAdmins', 'schoolAdminAccounts',
  'schoolAdminTeachers',
  'schoolSubjects',
  'schoolTeacherInvites',
  'schoolNotices',
  'schoolNoticeSubmits',
]

// ─── 초기화: Supabase를 진실의 원천으로 — 항상 Supabase 우선
export async function initFromSupabase() {
  if (!isConfigured) return false
  try {
    // Supabase → 인메모리 캐시로 로드
    await Promise.all(SYNC_TABLES.map(async (t) => {
      try {
        const remote = await dbCall('getAll', t)
        if (!Array.isArray(remote)) return
        const normalized = remote
          .map(r => ({ ...r, _deleted: r._deleted === true || r._deleted === 1 ? true : false }))
          .filter(r => r._deleted !== true)
        cache.set(t, normalized)
        console.log(`[Supabase] ${t}: ${normalized.length}건 로드`)
      } catch (e) {
        console.warn(`[Supabase] ${t} 로드 실패:`, e.message)
      }
    }))

    // settings 동기화 (settings는 localStorage 유지 — 용량 작음)
    try {
      const settings = await dbCall('getAll', 'settings')
      if (Array.isArray(settings)) {
        settings.forEach(row => {
          if (!row.key || !row.value) return
          localStorage.setItem('asa_settings_' + row.key, JSON.stringify(row.value))
        })
        console.log('[Supabase] settings 동기화 완료')
      }
    } catch (e) {
      console.warn('[Supabase] settings 동기화 실패:', e.message)
    }

    console.log('[Supabase] 데이터 동기화 완료')
    return true
  } catch (e) {
    console.warn('[Supabase] 전체 실패:', e.message)
    return false
  }
}

// 호환성 유지용 빈 함수 (기존 코드에서 호출해도 에러 안 남)
export function startSyncRetry() {}
export function stopSyncRetry() {}

// ─── 핵심 DB 메서드
export const db = {
  get:    (t)     => cache.get(t).filter(r => r._deleted !== true),
  set:    (t, d)  => cache.set(t, d),
  getOne: (t, id) => cache.get(t).find(r => r.id === id && !r._deleted) || null,

  async insert(t, record) {
    const r = { _deleted: false, ...record, updatedAt: now() }
    const rows = cache.get(t)
    rows.push(r)
    cache.set(t, rows)
    _emit(t)
    await sync('insert', t, { data: r })
    return r
  },

  async update(t, id, patch) {
    const updated = { ...patch, updatedAt: now() }
    const rows = cache.get(t).map(r => r.id === id ? { ...r, ...updated } : r)
    cache.set(t, rows)
    _emit(t)
    await sync('update', t, { id, patch: updated })
    return rows.find(r => r.id === id)
  },

  async delete(t, id) {
    const rows = cache.get(t).map(r =>
      r.id === id ? { ...r, _deleted: true, updatedAt: now() } : r
    )
    cache.set(t, rows)
    _emit(t)
    await sync('delete', t, { id })
  },

  where:    (t, fn) => cache.get(t).filter(r => r._deleted !== true && fn(r)),
  clearAll() { Object.keys(_cache).forEach(k => delete _cache[k]) },
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
  async upsert(record) {
    const ex = this.find(record.classId, record.studentId, record.date)
    if (ex) {
      const updated = { ...ex, ...record, updatedAt: now() }
      cache.set('attendance', cache.get('attendance').map(r => r.id === ex.id ? updated : r))
      await sync('attendanceUpsert', 'attendance', { data: updated })
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
        .catch(e => console.warn(`[Settings] "${k}" Supabase 저장 실패:`, e.message))
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
  all:    () => db.get('parentMembers'),
  find:   (id) => db.getOne('parentMembers', id),
  allByPhone: (phone) => {
    const clean = phone?.replace(/[^0-9]/g, '')
    return db.get('parentMembers').filter(p => p.phone === clean)
  },
  byTeacher:  (tid) => db.where('parentMembers', p => p.teacherId === tid),
  insert:     (p)   => db.insert('parentMembers', p),
  update:     (id, patch) => db.update('parentMembers', id, patch),
  delete:     (id)  => db.delete('parentMembers', id),
}

export const TeacherParentLinks = {
  all:        ()    => db.get('teacherParentLinks'),
  byTeacher:  (tid) => db.where('teacherParentLinks', l => l.teacherId === tid),
  byParent:   (pid) => db.where('teacherParentLinks', l => l.parentId === pid),
  byStudent:  (sid) => db.where('teacherParentLinks', l => l.studentId === sid),
  insert:     (l)   => db.insert('teacherParentLinks', l),
  delete:     (id)  => db.delete('teacherParentLinks', id),
}

export const TeacherServiceConfigs = {
  byTeacher: (tid) => db.where('teacherServiceConfigs', c => c.teacherId === tid)[0] || null,
  save(tid, patch) {
    const existing = this.byTeacher(tid)
    if (existing) return db.update('teacherServiceConfigs', existing.id, patch)
    return db.insert('teacherServiceConfigs', { id: uid(), teacherId: tid, ...patch, createdAt: now() })
  },
}

// ─── 수익 관리
export const RevenueFees = {
  all:       ()      => db.get('revenueFees'),
  byTeacher: (tid)   => db.where('revenueFees', r => r.teacherId === tid),
  find:      (id)    => db.getOne('revenueFees', id),
  insert:    (r)     => db.insert('revenueFees', r),
  update:    (id, p) => db.update('revenueFees', id, p),
  delete:    (id)    => db.delete('revenueFees', id),
}

export const RevenuePayments = {
  all:       ()      => db.get('revenuePayments'),
  byTeacher: (tid)   => db.where('revenuePayments', r => r.teacherId === tid),
  byFee:     (fid)   => db.where('revenuePayments', r => r.feeId === fid),
  find:      (id)    => db.getOne('revenuePayments', id),
  insert:    (r)     => db.insert('revenuePayments', r),
  update:    (id, p) => db.update('revenuePayments', id, p),
  delete:    (id)    => db.delete('revenuePayments', id),
}

// ─── 내 관리 (강사 관련)
export const Trainings = {
  all:       ()      => db.get('trainings'),
  byTeacher: (tid)   => db.where('trainings', r => r.teacherId === tid),
  insert:    (r)     => db.insert('trainings', r),
  update:    (id, p) => db.update('trainings', id, p),
  delete:    (id)    => db.delete('trainings', id),
}

export const Careers = {
  all:       ()      => db.get('careers'),
  byTeacher: (tid)   => db.where('careers', r => r.teacherId === tid),
  insert:    (r)     => db.insert('careers', r),
  update:    (id, p) => db.update('careers', id, p),
  delete:    (id)    => db.delete('careers', id),
}

export const Educations = {
  all:       ()      => db.get('educations'),
  byTeacher: (tid)   => db.where('educations', r => r.teacherId === tid),
  insert:    (r)     => db.insert('educations', r),
  update:    (id, p) => db.update('educations', id, p),
  delete:    (id)    => db.delete('educations', id),
}

export const Certificates = {
  all:       ()      => db.get('certificates'),
  byTeacher: (tid)   => db.where('certificates', r => r.teacherId === tid),
  insert:    (r)     => db.insert('certificates', r),
  update:    (id, p) => db.update('certificates', id, p),
  delete:    (id)    => db.delete('certificates', id),
}

export const Awards = {
  all:       ()      => db.get('awards'),
  byTeacher: (tid)   => db.where('awards', r => r.teacherId === tid),
  insert:    (r)     => db.insert('awards', r),
  update:    (id, p) => db.update('awards', id, p),
  delete:    (id)    => db.delete('awards', id),
}

export const JobSubs = {
  all:       ()      => db.get('jobSubs'),
  byTeacher: (tid)   => db.where('jobSubs', r => r.teacherId === tid),
  insert:    (r)     => db.insert('jobSubs', r),
  update:    (id, p) => db.update('jobSubs', id, p),
  delete:    (id)    => db.delete('jobSubs', id),
}

// ─── 지사
export const Branches = {
  all:    ()      => db.get('branches'),
  find:   (id)    => db.getOne('branches', id),
  insert: (r)     => db.insert('branches', r),
  update: (id, p) => db.update('branches', id, p),
  delete: (id)    => db.delete('branches', id),
}

// ─── 교구 관리
export const SupplySubjects = {
  all:       ()         => db.get('supplySubjects'),
  byTeacher: (tid)      => db.where('supplySubjects', r => r.teacherId === tid),
  find:      (id)       => db.getOne('supplySubjects', id),
  insert:    (r)        => db.insert('supplySubjects', r),
  update:    (id, p)    => db.update('supplySubjects', id, p),
  delete:    (id)       => db.delete('supplySubjects', id),
}

export const SupplyVendors = {
  all:        ()         => db.get('supplyVendors'),
  byTeacher:  (tid)      => db.where('supplyVendors', r => r.teacherId === tid),
  bySubject:  (tid, sub) => db.where('supplyVendors', r => r.teacherId === tid && r.subject === sub),
  find:       (id)       => db.getOne('supplyVendors', id),
  insert:     (r)        => db.insert('supplyVendors', r),
  update:     (id, p)    => db.update('supplyVendors', id, p),
  delete:     (id)       => db.delete('supplyVendors', id),
}

export const SupplyItems = {
  all:           ()              => db.get('supplyItems'),
  byTeacher:     (tid)           => db.where('supplyItems', r => r.teacherId === tid),
  byClass:       (classId)       => db.where('supplyItems', r => r.classId === classId),
  byClassStudent:(classId, sid)  => db.where('supplyItems', r => r.classId === classId && r.studentId === sid),
  find:          (id)            => db.getOne('supplyItems', id),
  insert:        (r)             => db.insert('supplyItems', r),
  update:        (id, p)         => db.update('supplyItems', id, p),
  delete:        (id)            => db.delete('supplyItems', id),
  async upsert(r) {
    const existing = db.where('supplyItems', x => x.classId === r.classId && x.studentId === r.studentId)[0]
    if (existing) return await db.update('supplyItems', existing.id, r)
    return await db.insert('supplyItems', { ...r, id: r.id || uid() })
  },
}

export const SupplyPlans = {
  all:        ()              => db.get('supplyPlans'),
  byTeacher:  (tid)           => db.where('supplyPlans', r => r.teacherId === tid),
  bySubject:  (tid, sub)      => db.where('supplyPlans', r => r.teacherId === tid && r.subject === sub),
  byProduct:  (productId)     => db.where('supplyPlans', r => r.productId === productId),
  byVendor:   (vendorId)      => db.where('supplyPlans', r => r.vendorId === vendorId),
  find:       (id)            => db.getOne('supplyPlans', id),
  insert:     (r)             => db.insert('supplyPlans', r),
  update:     (id, p)         => db.update('supplyPlans', id, p),
  delete:     (id)            => db.delete('supplyPlans', id),
}

export const SupplyPromos = {
  all:        ()         => db.get('supplyPromos'),
  byTeacher:  (tid)      => db.where('supplyPromos', r => r.teacherId === tid),
  bySubject:  (tid, sub) => db.where('supplyPromos', r => r.teacherId === tid && r.subject === sub),
  find:       (id)       => db.getOne('supplyPromos', id),
  insert:     (r)        => db.insert('supplyPromos', r),
  update:     (id, p)    => db.update('supplyPromos', id, p),
  delete:     (id)       => db.delete('supplyPromos', id),
}

// ─── 로봇 교구 진도 관리
export const SupplyProducts = {
  all:          ()           => db.get('supplyProducts'),
  byTeacher:    (tid)        => db.where('supplyProducts', r => r.teacherId === tid),
  byVendor:     (vendorId)   => db.where('supplyProducts', r => r.vendorId === vendorId),
  find:         (id)         => db.getOne('supplyProducts', id),
  insert:       (r)          => db.insert('supplyProducts', r),
  update:       (id, p)      => db.update('supplyProducts', id, p),
  delete:       (id)         => db.delete('supplyProducts', id),
}

export const SupplyProductPlans = {
  all:          ()            => db.get('supplyProductPlans'),
  byTeacher:    (tid)         => db.where('supplyProductPlans', r => r.teacherId === tid),
  byProduct:    (productId)   => db.where('supplyProductPlans', r => r.productId === productId),
  byProductStage: (productId, stage) => db.where('supplyProductPlans', r => r.productId === productId && r.stage === stage),
  find:         (id)          => db.getOne('supplyProductPlans', id),
  insert:       (r)           => db.insert('supplyProductPlans', r),
  update:       (id, p)       => db.update('supplyProductPlans', id, p),
  delete:       (id)          => db.delete('supplyProductPlans', id),
}

export const SupplyStudentProgress = {
  all:          ()             => db.get('supplyStudentProgress'),
  byTeacher:    (tid)          => db.where('supplyStudentProgress', r => r.teacherId === tid),
  byClass:      (classId)      => db.where('supplyStudentProgress', r => r.classId === classId),
  byStudent:    (studentId, classId) => db.where('supplyStudentProgress', r => r.studentId === studentId && r.classId === classId),
  find:         (id)           => db.getOne('supplyStudentProgress', id),
  insert:       (r)            => db.insert('supplyStudentProgress', r),
  update:       (id, p)        => db.update('supplyStudentProgress', id, p),
  delete:       (id)           => db.delete('supplyStudentProgress', id),
  async upsert(r) {
    const existing = db.where('supplyStudentProgress', x =>
      x.studentId === r.studentId && x.classId === r.classId && x.productId === r.productId
    )[0]
    if (existing) return await db.update('supplyStudentProgress', existing.id, { ...r, updatedAt: r.updatedAt })
    return await db.insert('supplyStudentProgress', { ...r, id: r.id || uid() })
  },
}

export const SupplyProgressLogs = {
  all:          ()             => db.get('supplyProgressLogs'),
  byTeacher:    (tid)          => db.where('supplyProgressLogs', r => r.teacherId === tid),
  byStudent:    (studentId, classId) => db.where('supplyProgressLogs', r => r.studentId === studentId && r.classId === classId),
  byProduct:    (productId)    => db.where('supplyProgressLogs', r => r.productId === productId),
  find:         (id)           => db.getOne('supplyProgressLogs', id),
  insert:       (r)            => db.insert('supplyProgressLogs', r),
  delete:       (id)           => db.delete('supplyProgressLogs', id),
}

export const SupplySessionChecks = {
  all:          ()             => db.get('supplySessionChecks'),
  byTeacher:    (tid)          => db.where('supplySessionChecks', r => r.teacherId === tid),
  byStudent:    (studentId, classId) => db.where('supplySessionChecks', r => r.studentId === studentId && r.classId === classId),
  byProduct:    (productId)    => db.where('supplySessionChecks', r => r.productId === productId),
  byProductStudent: (productId, studentId, classId) =>
    db.where('supplySessionChecks', r => r.productId === productId && r.studentId === studentId && r.classId === classId),
  find:         (id)           => db.getOne('supplySessionChecks', id),
  insert:       (r)            => db.insert('supplySessionChecks', r),
  update:       (id, p)        => db.update('supplySessionChecks', id, p),
  delete:       (id)           => db.delete('supplySessionChecks', id),
  async upsert(r) {
    const existing = db.where('supplySessionChecks', x =>
      x.studentId === r.studentId && x.classId === r.classId &&
      x.productId === r.productId && x.stage === r.stage && x.sessionNo === r.sessionNo
    )[0]
    if (existing) return await db.update('supplySessionChecks', existing.id, { ...r })
    return await db.insert('supplySessionChecks', { ...r, id: r.id || uid() })
  },
}

// ─── 안내 문구
export const MessageGuides = {
  all:       ()      => db.get('messageGuides'),
  byTeacher: (tid)   => db.where('messageGuides', r => r.teacherId === tid),
  find:      (id)    => db.getOne('messageGuides', id),
  insert:    (r)     => db.insert('messageGuides', r),
  update:    (id, p) => db.update('messageGuides', id, p),
  delete:    (id)    => db.delete('messageGuides', id),
}

export const MessageCategories = {
  all:       ()      => db.get('messageCategories'),
  byTeacher: (tid)   => db.where('messageCategories', r => r.teacherId === tid),
  find:      (id)    => db.getOne('messageCategories', id),
  insert:    (r)     => db.insert('messageCategories', r),
  delete:    (id)    => db.delete('messageCategories', id),
}

// ─── 방과후 서류
export const DocumentsDB = {
  all:       ()      => db.get('documents'),
  byTeacher: (tid)   => db.where('documents', r => r.teacherId === tid),
  byCategory:(tid, cat) => db.where('documents', r => r.teacherId === tid && r.category === cat),
  find:      (id)    => db.getOne('documents', id),
  insert:    (r)     => db.insert('documents', r),
  update:    (id, p) => db.update('documents', id, p),
  delete:    (id)    => db.delete('documents', id),
}

export const CustomCategoriesDB = {
  all:       ()      => db.get('customCategories'),
  byTeacher: (tid)   => db.where('customCategories', r => r.teacherId === tid),
  insert:    (r)     => db.insert('customCategories', r),
  update:    (id, p) => db.update('customCategories', id, p),
  delete:    (id)    => db.delete('customCategories', id),
}

// ─── 선생님 프로필
export const TeacherProfiles = {
  byTeacher: (tid)   => db.where('teacherProfiles', r => r.teacherId === tid)[0] || null,
  save(tid, name, nickname) {
    const existing = this.byTeacher(tid)
    if (existing) return db.update('teacherProfiles', existing.id, { name, nickname })
    return db.insert('teacherProfiles', { id: uid(), teacherId: tid, name, nickname, createdAt: now() })
  },
}

// ─── 수업 메모장
export const LessonMemos = {
  all:          ()                    => db.get('lessonMemos'),
  byClassDate:  (classId, date)       => db.where('lessonMemos', r => r.classId === classId && r.date === date),
  byTeacher:    (tid)                 => db.where('lessonMemos', r => r.teacherId === tid),
  insert:       (r)                   => db.insert('lessonMemos', r),
  update:       (id, p)               => db.update('lessonMemos', id, p),
  delete:       (id)                  => db.delete('lessonMemos', id),
}

// ─── 학교 담당자 포털
export const SchoolAdmins = {
  all:    ()      => db.get('schoolAdmins'),
  find:   (id)    => db.getOne('schoolAdmins', id),
  insert: (r)     => db.insert('schoolAdmins', r),
  update: (id, p) => db.update('schoolAdmins', id, p),
  delete: (id)    => db.delete('schoolAdmins', id),
}

export const SchoolAdminAccounts = {
  all:    ()      => db.get('schoolAdminAccounts'),
  find:   (id)    => db.getOne('schoolAdminAccounts', id),
  insert: (r)     => db.insert('schoolAdminAccounts', r),
  update: (id, p) => db.update('schoolAdminAccounts', id, p),
  delete: (id)    => db.delete('schoolAdminAccounts', id),
}

export const SchoolAdminTeachers = {
  all:          ()         => db.get('schoolAdminTeachers'),
  byAdmin:      (aid)      => db.where('schoolAdminTeachers', r => r.adminId === aid),
  byTeacher:    (tid)      => db.where('schoolAdminTeachers', r => r.teacherId === tid),
  find:         (id)       => db.getOne('schoolAdminTeachers', id),
  insert:       (r)        => db.insert('schoolAdminTeachers', r),
  update:       (id, p)    => db.update('schoolAdminTeachers', id, p),
  delete:       (id)       => db.delete('schoolAdminTeachers', id),
}

export const SchoolSubjects = {
  all:       ()      => db.get('schoolSubjects'),
  byAdmin:   (aid)   => db.where('schoolSubjects', r => r.adminId === aid),
  find:      (id)    => db.getOne('schoolSubjects', id),
  insert:    (r)     => db.insert('schoolSubjects', r),
  update:    (id, p) => db.update('schoolSubjects', id, p),
  delete:    (id)    => db.delete('schoolSubjects', id),
}

export const SchoolTeacherInvites = {
  all:       ()      => db.get('schoolTeacherInvites'),
  byAdmin:   (aid)   => db.where('schoolTeacherInvites', r => r.adminId === aid),
  byTeacher: (tid)   => db.where('schoolTeacherInvites', r => r.teacherId === tid),
  find:      (id)    => db.getOne('schoolTeacherInvites', id),
  insert:    (r)     => db.insert('schoolTeacherInvites', r),
  update:    (id, p) => db.update('schoolTeacherInvites', id, p),
  delete:    (id)    => db.delete('schoolTeacherInvites', id),
}

export const SchoolNotices = {
  all:       ()      => db.get('schoolNotices'),
  byAdmin:   (aid)   => db.where('schoolNotices', r => r.adminId === aid),
  find:      (id)    => db.getOne('schoolNotices', id),
  insert:    (r)     => db.insert('schoolNotices', r),
  update:    (id, p) => db.update('schoolNotices', id, p),
  delete:    (id)    => db.delete('schoolNotices', id),
}

export const SchoolNoticeSubmits = {
  all:        ()       => db.get('schoolNoticeSubmits'),
  byNotice:   (nid)    => db.where('schoolNoticeSubmits', r => r.noticeId === nid),
  byTeacher:  (tid)    => db.where('schoolNoticeSubmits', r => r.teacherId === tid),
  find:       (id)     => db.getOne('schoolNoticeSubmits', id),
  insert:     (r)      => db.insert('schoolNoticeSubmits', r),
  update:     (id, p)  => db.update('schoolNoticeSubmits', id, p),
  delete:     (id)     => db.delete('schoolNoticeSubmits', id),
}
