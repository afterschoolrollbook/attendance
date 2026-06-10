/**
 * DB 레이어 — IndexedDB 캐시 + 증분 동기화 + Supabase JS 클라이언트
 *
 * 핵심 원칙:
 *  - Edge Function 없음 → 콜드스타트 문제 없음
 *  - Supabase JS 클라이언트로 DB 직접 접근
 *  - 모든 레코드에 updatedAt 자동 기록
 *  - 삭제는 _deleted: true 소프트딜리트
 *  - IndexedDB 캐시 → 재접속 시 즉시 화면 표시
 *  - 증분 동기화 → 변경된 것만 Supabase 로드 (빠름)
 *  - 멀티기기(PC/스마트폰) 항상 최신 데이터
 */

import { supabase, isConfigured } from './supabase.js' // 로컬 전용 모드 제거됨 — 항상 Supabase 직접 연결 (isConfigured 분기 없음)
import { uid, now } from './utils.js'

// ─── 실제 DB 테이블 이름 매핑 (논리명 → 실제 테이블명, 전부 snake_case)
const TABLE_MAP = {
  users:                'users',
  classes:              'classes',
  students:             'students',
  attendance:           'attendance',
  notes:                'notes',
  adSlots:              'ad_slots',
  attendanceTemplates:  'attendance_templates',
  settings:             'settings',
  revenueFees:          'revenue_fees',
  revenuePayments:      'revenue_payments',
  trainings:            'trainings',
  careers:              'careers',
  educations:           'educations',
  certificates:         'certificates',
  awards:               'awards',
  jobSubs:              'job_subs',
  branches:             'branches',
  points:               'points',
  parentMembers:        'parent_members',
  teacherParentLinks:   'teacher_parent_links',
  teacherServiceConfigs:'teacher_service_configs',
  supplySubjects:       'supply_subjects',
  supplyVendors:        'supply_vendors',
  supplyItems:          'supply_items',
  supplyPlans:          'supply_plans',
  supplyPromos:         'supply_promos',
  supplyProducts:       'supply_products',
  supplyProductPlans:   'supply_product_plans',
  supplyStudentProgress:'supply_student_progress',
  supplyProgressLogs:   'supply_progress_logs',
  supplySessionChecks:  'supply_session_checks',
  messageGuides:        'message_guides',
  messageCategories:    'message_categories',
  teacherProfiles:      'teacher_profiles',
  documents:            'documents',
  customCategories:     'custom_categories',
  lessonMemos:          'lesson_memos',
  schoolAdmins:         'school_admins',
  schoolAdminAccounts:  'school_admin_accounts',
  schoolAdminTeachers:  'school_admin_teachers',
  schoolSubjects:       'school_subjects',
  schoolTeacherInvites: 'school_teacher_invites',
  schoolNotices:        'school_notices',
  schoolNoticeSubmits:  'school_notice_submits',
  schoolCalendar:       'school_calendar',
  schoolInfo:           'school_info',
  blogPosts:            'blog_posts',
  supplyGiven:          'supply_given',
  supplyParts:          'supply_parts',
  supplySchoolPrices:   'supply_school_prices',
  hqVendors:            'hq_vendors',
  hqVendorSubjects:     'hq_vendor_subjects',
  hqVendorProducts:     'hq_vendor_products',
  hqVendorStages:       'hq_vendor_stages',
  hqVendorContents:     'hq_vendor_contents',
  hqVendorQuarters:     'hq_vendor_quarters',
  hqVendorSessions:     'hq_vendor_sessions',
  hqVendorFiles:        'hq_vendor_files',
  hqVendorPrices:       'hq_vendor_prices',
  hqVendorUsers:        'hq_vendor_users',
  vendorAccounts:       'vendor_accounts',
}

// ─── camelCase → snake_case 변환
function toSnake(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
    result[snake] = Array.isArray(v)
      ? v.map(item => item !== null && typeof item === 'object' ? toSnake(item) : item)
      : v !== null && typeof v === 'object'
        ? toSnake(v) : v
  }
  return result
}

// ─── snake_case → camelCase 변환
const KEEP_SNAKE_FIELDS = new Set(['student_careers'])
function toCamel(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    // _deleted, _deleted_at 등 언더스코어로 시작하는 특수 필드 및 student_careers는 변환하지 않음
    const camel = k.startsWith('_') || KEEP_SNAKE_FIELDS.has(k) ? k : k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = Array.isArray(v)
      ? v.map(item => item !== null && typeof item === 'object' ? toCamel(item) : item)
      : v !== null && typeof v === 'object'
        ? toCamel(v) : v
  }
  return result
}

// ─── students 테이블: Supabase pull 후 string 필드 null-safe 정규화
// homeReturn 등 나중에 추가된 필드가 null로 들어와도 string method가 터지지 않도록 보장
const STRING_FIELDS_STUDENT = [
  'homeReturn','section','parentPhone','name','school',
  'memo','applyOrder','remark','grade','classNum','number',
  'status','parentInviteSentAt','studentStartDate','studentEndDate',
]
function normalizeStudent(raw) {
  const s = toCamel(raw)
  STRING_FIELDS_STUDENT.forEach(f => { if (s[f] == null || typeof s[f] !== 'string') s[f] = '' })
  if (!Array.isArray(s.classIds))            s.classIds        = s.classIds ? [s.classIds] : []
  if (!Array.isArray(s.relations))           s.relations       = []
  if (!Array.isArray(s.student_careers))     s.student_careers = []
  if (!Array.isArray(s.statusHistory))       s.statusHistory   = []
  return s
}

// ─── classes 테이블: section 필드가 배열로 잘못 저장된 경우 방어
function normalizeClass(raw) {
  const c = toCamel(raw)
  if (c.section == null || typeof c.section !== 'string') c.section = ''
  if (c.time    == null || typeof c.time    !== 'string') c.time    = ''
  if (c.timeEnd == null || typeof c.timeEnd !== 'string') c.timeEnd = ''
  if (!Array.isArray(c.sections))  c.sections  = []
  if (!Array.isArray(c.days))      c.days       = []
  return c
}

// ─── 테이블별 변환 함수 반환
function getConverters(table) {
  const fromDb = table === 'students' ? normalizeStudent
               : table === 'classes'  ? normalizeClass
               : toCamel
  return {
    tbl:  TABLE_MAP[table] || table,
    toDb: toSnake,
    fromDb,
  }
}

// ─── 전역 DB 변경 이벤트 시스템
const _listeners = new Map()
export function onDbChange(table, fn) {
  if (!_listeners.has(table)) _listeners.set(table, new Set())
  _listeners.get(table).add(fn)
  return () => _listeners.get(table)?.delete(fn)
}
function _emit(table) {
  _listeners.get(table)?.forEach(fn => fn())
  _listeners.get('*')?.forEach(fn => fn(table))
}

// ─── 인메모리 캐시 (빠른 읽기용)
const _cache = {}
const cache = {
  get(t)    { return _cache[t] || [] },
  set(t, d) { _cache[t] = d },
}

// ─── IndexedDB 캐시 (재접속 시 즉시 로드용)
const IDB_NAME    = 'asa_cache'
const IDB_VERSION = 1
const IDB_STORE   = 'tables'

let _idb = null

async function openIDB() {
  if (_idb) return _idb
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = (e) => { _idb = e.target.result; resolve(_idb) }
    req.onerror   = (e) => { console.warn('[IDB] 열기 실패:', e.target.error); resolve(null) }
  })
}

async function idbGet(table) {
  try {
    const db = await openIDB()
    if (!db) return null
    return new Promise((resolve) => {
      const tx  = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(table)
      req.onsuccess = (e) => resolve(e.target.result || null)
      req.onerror   = ()  => resolve(null)
    })
  } catch { return null }
}

async function idbSet(table, data) {
  try {
    const db = await openIDB()
    if (!db) return
    return new Promise((resolve) => {
      const tx  = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(data, table)
      tx.oncomplete = resolve
      tx.onerror    = resolve
    })
  } catch {}
}

async function idbSetAll(dataMap) {
  try {
    const db = await openIDB()
    if (!db) return
    return new Promise((resolve) => {
      const tx    = db.transaction(IDB_STORE, 'readwrite')
      const store = tx.objectStore(IDB_STORE)
      for (const [key, val] of Object.entries(dataMap)) store.put(val, key)
      tx.oncomplete = resolve
      tx.onerror    = resolve
    })
  } catch {}
}

// IndexedDB 전체 캐시 로드 → 인메모리 캐시에 반영
export async function loadCacheFromIDB() {
  const tables = Object.keys(TABLE_MAP)
  let totalRows = 0
  await Promise.all(tables.map(async (t) => {
    const rows = await idbGet(t)
    if (Array.isArray(rows) && rows.length > 0) {
      cache.set(t, rows.filter(r => r._deleted !== true))
      totalRows += rows.length
      _emit(t)
    }
  }))
  if (totalRows === 0) {
    try { localStorage.removeItem('asa_last_sync_at') } catch {}
    console.log('[IDB] 캐시 비어있음 → 전체 로드로 전환')
  }
  console.log('[IDB] 캐시 로드 완료')
}

// 인메모리 캐시 → IndexedDB에 저장
async function saveCacheToIDB() {
  const dataMap = {}
  for (const t of Object.keys(TABLE_MAP)) {
    const rows = cache.get(t).filter(r => r._deleted !== true)
    if (rows.length > 0) dataMap[t] = rows
  }
  await idbSetAll(dataMap)
  console.log('[IDB] 캐시 저장 완료')
}

// ─── 재시도 헬퍼 (네트워크 일시 오류 대응)
async function withRetry(fn, label, maxRetry = 3) {
  _emitSaveStart()
  for (let i = 0; i < maxRetry; i++) {
    try {
      const result = await fn()
      _emitSaveComplete()
      return result
    } catch (e) {
      const isLast = i === maxRetry - 1
      console.warn(`[DB] ${label} 실패 (${i+1}/${maxRetry}):`, e.message)
      if (isLast) {
        _emitSaveError(label, e.message)
        throw e
      }
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
  }
}

// 저장 상태 이벤트 (SaveStatusBar에서 구독)
const _saveStartListeners    = new Set()
const _saveCompleteListeners = new Set()
const _saveErrorListeners    = new Set()

export function onSaveStart(fn) {
  _saveStartListeners.add(fn)
  return () => _saveStartListeners.delete(fn)
}
export function onSaveComplete(fn) {
  _saveCompleteListeners.add(fn)
  return () => _saveCompleteListeners.delete(fn)
}
export function onSaveError(fn) {
  _saveErrorListeners.add(fn)
  return () => _saveErrorListeners.delete(fn)
}
function _emitSaveStart()        { _saveStartListeners.forEach(fn => fn()) }
function _emitSaveComplete()     { _saveCompleteListeners.forEach(fn => fn()) }
function _emitSaveError(label, msg) { _saveErrorListeners.forEach(fn => fn(label, msg)) }

// ─── Supabase 직접 쓰기 함수들
async function syncInsert(table, data) {
  if (!supabase) return
  const { tbl, toDb } = getConverters(table)
  const cleanData = stripVirtualFields(table, data)
  if (table === 'supplySessionChecks') {
    await withRetry(async () => {
      const { error } = await supabase.from(tbl)
        .upsert(toDb(cleanData), { onConflict: 'student_id,class_id,product_id,stage,session_no' })
      if (error) throw new Error(error.message)
    }, `insert/${table}`)
    return
  }
  await withRetry(async () => {
    const { error } = await supabase.from(tbl).insert(toDb(cleanData))
    if (error) throw new Error(error.message)
  }, `insert/${table}`)
}

async function syncUpsert(table, data) {
  if (!supabase) return
  const { tbl, toDb } = getConverters(table)
  const cleanData = stripVirtualFields(table, data)
  await withRetry(async () => {
    const { error } = await supabase.from(tbl).upsert(toDb(cleanData))
    if (error) throw new Error(error.message)
  }, `upsert/${table}`)
}

// DB 컬럼이 없는 가상 필드 — Supabase 전송 전 제거
const VIRTUAL_FIELDS = {
  students: new Set([
    'scheduleChangeDate', 'schedule_change_date',
    'transferInfo',       'transfer_info',
    'cancelInfo',         'cancel_info',
    '_newOrganization', '_newClassName', '_newSection',
    '_newTimeStart', '_newTimeEnd', '_newTermType',
    '_newDays', '_newRepeatType', '_newStartDate', '_newEndDate',
  ]),
}
function stripVirtualFields(table, obj) {
  const vf = VIRTUAL_FIELDS[table]
  if (!vf) return obj
  const result = { ...obj }
  for (const key of vf) delete result[key]
  return result
}

async function syncUpdate(table, id, patch) {
  if (!supabase) return
  const { tbl, toDb } = getConverters(table)
  const cleanPatch = stripVirtualFields(table, patch)
  await withRetry(async () => {
    const { error } = await supabase.from(tbl).update(toDb(cleanPatch)).eq('id', id)
    if (error) throw new Error(error.message)
  }, `update/${table}`)
}

async function syncDelete(table, id) {
  if (!supabase) return
  const { tbl, toDb } = getConverters(table)
  await withRetry(async () => {
    // _deleted 컬럼 없는 테이블은 하드딜리트
    if (NO_DELETED_TABLES.has(table)) {
      const { error } = await supabase.from(tbl).delete().eq('id', id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from(tbl)
        .update(toDb({ _deleted: true, updatedAt: new Date().toISOString() }))
        .eq('id', id)
      if (error) throw new Error(error.message)
    }
  }, `delete/${table}`)
}

async function syncAttendanceUpsert(data) {
  if (!supabase) return
  await withRetry(async () => {
    const { error } = await supabase
      .from('attendance')
      .upsert(toSnake(data), { onConflict: 'class_id,student_id,date' })
    if (error) throw new Error(error.message)
  }, 'attendance/upsert')
}

// ─── 동기화 대상 테이블 목록
const SYNC_TABLES = [
  'users', 'classes', 'students', 'attendance', 'notes',
  'adSlots', 'attendanceTemplates',
  'revenueFees', 'revenuePayments',
  'trainings', 'careers', 'educations', 'certificates', 'awards', 'jobSubs',
  'supplySubjects', 'supplyVendors', 'supplyItems', 'supplyPlans', 'supplyPromos',
  'supplyProducts', 'supplyProductPlans', 'supplyStudentProgress', 'supplyProgressLogs', 'supplySessionChecks',
  'lessonMemos',
  'branches', 'points', 'parentMembers', 'teacherParentLinks',
  'teacherServiceConfigs',
  'messageGuides', 'messageCategories',
  'teacherProfiles',
  'documents', 'customCategories',
  'schoolAdmins', 'schoolAdminAccounts',
  'schoolAdminTeachers', 'schoolSubjects', 'schoolTeacherInvites',
  'schoolNotices', 'schoolNoticeSubmits',
  'supplyGiven',
  'supplyParts',
  'supplySchoolPrices',
  'hqVendors', 'hqVendorSubjects', 'hqVendorProducts', 'hqVendorStages',
  'hqVendorContents', 'hqVendorQuarters', 'hqVendorSessions', 'hqVendorFiles',
  'hqVendorPrices', 'hqVendorUsers', 'vendorAccounts',
]

// _deleted 컬럼 없는 테이블 (소프트딜리트 미적용)
const NO_DELETED_TABLES = new Set(['points', 'settings', 'attendance', 'notes', 'attendance_templates', 'ad_slots', 'branches', 'verify_codes', 'revenueFees', 'revenuePayments', 'supplySubjects', 'supplyVendors', 'supplyPlans', 'supplyProducts', 'supplyProductPlans', 'schoolCalendar', 'schoolInfo', 'hqVendors', 'hqVendorSubjects', 'hqVendorProducts', 'hqVendorStages', 'hqVendorContents', 'hqVendorQuarters', 'hqVendorSessions', 'hqVendorFiles', 'hqVendorPrices', 'hqVendorUsers', 'vendorAccounts'])

// ─── 마지막 동기화 시각 관리
const LAST_SYNC_KEY = 'asa_last_sync_at'
function getLastSyncAt() {
  try { return localStorage.getItem(LAST_SYNC_KEY) || null } catch { return null }
}
function setLastSyncAt(ts) {
  try { localStorage.setItem(LAST_SYNC_KEY, ts) } catch {}
}

// ─── 초기화: Supabase에서 데이터 로드 (증분 동기화)
export async function initFromSupabase() {
  if (!supabase) return false

  const lastSyncAt = getLastSyncAt()
  const idbEmpty = Object.keys(TABLE_MAP).every(t => cache.get(t).length === 0)
  const isIncremental = !!lastSyncAt && !idbEmpty
  const syncStartedAt = new Date().toISOString()

  console.log(isIncremental
    ? `[Supabase] 증분 동기화 — ${lastSyncAt} 이후 변경분만 로드`
    : '[Supabase] 최초 전체 로드')

  try {
    await Promise.all(SYNC_TABLES.map(async (t) => {
      try {
        const { tbl, fromDb } = getConverters(t)

        // ── 증분 동기화: 마지막 동기화 이후 변경된 것만 로드
        if (isIncremental) {
          const PAGE = 1000
          let allRows = []
          let from = 0
          while (true) {
            let q = supabase.from(tbl).select('*')
              .gt('updated_at', lastSyncAt)
              .range(from, from + PAGE - 1)
            const { data: rows, error } = await q
            if (error || !Array.isArray(rows)) break
            allRows = allRows.concat(rows)
            if (rows.length < PAGE) break
            from += PAGE
          }
          if (allRows.length === 0) return // 변경 없으면 스킵

          // 기존 캐시에 변경분 머지
          const incoming = allRows.map(fromDb)
          const existing = cache.get(t)
          const merged = [...existing]
          for (const row of incoming) {
            const idx = merged.findIndex(r => r.id === row.id)
            if (idx >= 0) merged[idx] = row  // 업데이트
            else merged.push(row)             // 신규
          }
          cache.set(t, merged.filter(r => r._deleted !== true))
          _emit(t)  // UI 리렌더링 트리거 (삭제/변경사항 반영)
          console.log(`[Supabase] ${t}: ${allRows.length}건 변경 반영`)
          return
        }

        // ── 최초 전체 로드 (기존 로직)
        let q = supabase.from(tbl).select('*')
        if (!NO_DELETED_TABLES.has(t)) {
          q = q.or('_deleted.is.null,_deleted.eq.false')
        }

        const PAGINATED_TABLES = {
          attendance: { filter: (q) => {
            const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            return q.gte('date', since).order('date', { ascending: false })
          }},
          supplySessionChecks: { filter: (q) => q },
        }
        if (PAGINATED_TABLES[t]) {
          const PAGE = 1000
          let allRows = []
          let from = 0
          while (true) {
            let q = supabase.from(tbl).select('*')
            if (!NO_DELETED_TABLES.has(t)) q = q.or('_deleted.is.null,_deleted.eq.false')
            q = PAGINATED_TABLES[t].filter(q)
            q = q.range(from, from + PAGE - 1)
            const { data: page, error: pageErr } = await q
            if (pageErr) throw new Error(pageErr.message)
            if (!page || page.length === 0) break
            allRows = allRows.concat(page)
            if (page.length < PAGE) break
            from += PAGE
          }
          cache.set(t, allRows.map(fromDb).filter(r => r._deleted !== true))
          console.log(`[Supabase] ${t}: ${cache.get(t).length}건 로드`)
          return
        }

        const { data: rows, error } = await q
        if (error) throw new Error(error.message)
        if (!Array.isArray(rows)) return

        cache.set(t, rows.map(fromDb).filter(r => r._deleted !== true))
        console.log(`[Supabase] ${t}: ${cache.get(t).length}건 로드`)
      } catch (e) {
        console.warn(`[Supabase] ${t} 로드 실패:`, e.message)
      }
    }))

    // settings 동기화 (localStorage에 저장 — 용량 작음)
    try {
      const { data: settings } = await supabase.from('settings').select('*')
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

    // 동기화 완료 시각 저장 + IndexedDB에 캐시 보존
    setLastSyncAt(syncStartedAt)
    await saveCacheToIDB()
    console.log('[Supabase] 데이터 동기화 완료')
    return true
  } catch (e) {
    console.warn('[Supabase] 전체 실패:', e.message)
    return false
  }
}

// ─── 특정 테이블만 Supabase에서 재로드 (cross-window 캐시 동기화용)
// ProgressWindow처럼 별도 창은 인메모리 캐시가 독립적 → BroadcastChannel 수신 시 호출
export async function refreshTablesFromSupabase(...tables) {
  if (!supabase) return
  await Promise.all(tables.map(async (t) => {
    try {
      const { tbl, fromDb } = getConverters(t)
      const PAGE = 1000
      let allRows = []
      let from = 0
      while (true) {
        let q = supabase.from(tbl).select('*')
        if (!NO_DELETED_TABLES.has(t)) q = q.or('_deleted.is.null,_deleted.eq.false')
        q = q.range(from, from + PAGE - 1)
        const { data: rows, error } = await q
        if (error || !Array.isArray(rows)) break
        allRows = allRows.concat(rows)
        if (rows.length < PAGE) break
        from += PAGE
      }
      cache.set(t, allRows.map(fromDb).filter(r => r._deleted !== true))
    } catch (e) {
      console.warn(`[DB] refreshTables/${t} 실패:`, e.message)
    }
  }))
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
    const r = { _deleted: false, ...record, updated_at: now() }
    const rows = cache.get(t)
    rows.push(r)
    cache.set(t, rows)
    _emit(t)
    idbSet(t, rows.filter(r => r._deleted !== true)) // IndexedDB 즉시 반영 (_deleted 제외)
    try {
      await syncInsert(t, r)
    } catch (e) {
      console.warn(`[DB] insert/${t} 실패:`, e.message)
      throw e
    }
    return r
  },

  async update(t, id, patch) {
    const updated = { ...patch, updated_at: now() }
    const rows = cache.get(t).map(r => r.id === id ? { ...r, ...updated } : r)
    cache.set(t, rows)
    _emit(t)
    idbSet(t, rows.filter(r => r._deleted !== true)) // IndexedDB 즉시 반영 (_deleted 제외)
    try {
      await syncUpdate(t, id, updated)
    } catch (e) {
      console.error(`[DB] update/${t} 실패:`, e.message, e)
      throw e
    }
    return rows.find(r => r.id === id)
  },

  async delete(t, id) {
    const rows = cache.get(t).map(r =>
      r.id === id ? { ...r, _deleted: true, updated_at: now() } : r
    )
    cache.set(t, rows)
    _emit(t)
    idbSet(t, rows.filter(r => r._deleted !== true)) // IndexedDB 즉시 반영 (삭제 항목 제외)
    try {
      await syncDelete(t, id)
    } catch (e) {
      console.warn(`[DB] delete/${t} 실패:`, e.message)
      throw e
    }
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
    const merged = ex
      ? { ...ex, ...record, id: ex.id, updated_at: now() }
      : { _deleted: false, ...record, updated_at: now() }

    // 캐시 업데이트
    const rows = cache.get('attendance')
    if (ex) {
      cache.set('attendance', rows.map(r => r.id === ex.id ? merged : r))
    } else {
      rows.push(merged)
      cache.set('attendance', rows)
    }
    _emit('attendance')

    // withRetry로 Supabase 저장 — onSaveStart/Complete/Error 이벤트 발생
    await withRetry(async () => {
      const { error } = await supabase
        .from('attendance')
        .upsert(toSnake(merged), { onConflict: 'class_id,student_id,date' })
      if (error) throw new Error(error.message)
    }, 'attendance/upsert')

    return merged
  },
  delete: (id) => db.delete('attendance', id),
  update: (id, p) => db.update('attendance', id, p),
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
    if (supabase) {
      supabase.from('settings')
        .upsert({ key: k, value: v, updated_at: now() })
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

  findByPhoneAndTeacher: (phone, teacherId) => {
    const clean = phone?.replace(/[^0-9]/g, '')
    return db.get('parentMembers').find(p => p.phone === clean && p.teacherId === teacherId) || null
  },

  findByPhone: (phone) => {
    const clean = phone?.replace(/[^0-9]/g, '')
    return db.get('parentMembers').find(p => p.phone === clean) || null
  },

  byTeacher:  (tid)        => db.where('parentMembers', p => p.teacherId === tid),
  insert:     (p)          => db.insert('parentMembers', p),
  update:     (id, patch)  => db.update('parentMembers', id, patch),
  delete:     (id)         => db.delete('parentMembers', id),

  join(phone, {
    marketingAgree   = false,
    invitedByTeacher = '',
    studentName  = '',
    grade        = '',
    schoolName   = '',
    subjectName  = '',
    teacherName  = '',
    teacherPhone = '',
  } = {}) {
    const clean = phone?.replace(/[^0-9]/g, '')
    if (!clean) return null
    const fields = {
      appJoined: true, teacherId: invitedByTeacher,
      marketingAgree, invitedByTeacher,
      studentName, grade, schoolName, subjectName, teacherName, teacherPhone,
      joinedAt: now(),
    }
    const existing = this.findByPhoneAndTeacher(clean, invitedByTeacher)
    if (existing) { db.update('parentMembers', existing.id, fields); return existing }
    const record = { id: uid(), phone: clean, name: '', memo: '', createdAt: now(), ...fields }
    db.insert('parentMembers', record)
    return record
  },

  withdrawByTeacher(phone, teacherId, reason = 'teacher_request') {
    const clean = phone?.replace(/[^0-9]/g, '')
    const member = this.findByPhoneAndTeacher(clean, teacherId)
    if (!member) return
    db.update('parentMembers', member.id, { appJoined: false, withdrawnAt: now(), withdrawReason: reason })
  },

  savePushSubscription(phone, teacherId, subscriptionJson) {
    const clean = phone?.replace(/[^0-9]/g, '')
    const member = this.findByPhoneAndTeacher(clean, teacherId)
    if (!member) return
    // db.update가 toSnake 변환 후 Supabase까지 처리
    db.update('parentMembers', member.id, { pushSubscription: subscriptionJson })
  },

  getPushSubscriptions(phone) {
    const clean = phone?.replace(/[^0-9]/g, '')
    return db.get('parentMembers')
      .filter(p => p.phone === clean && p.pushSubscription)
      .map(p => p.pushSubscription)
  },
}

export const TeacherParentLinks = {
  all:         ()    => db.get('teacherParentLinks'),
  byTeacher:   (tid) => db.where('teacherParentLinks', l => l.teacherId === tid),
  active:      (tid) => db.where('teacherParentLinks', l => l.teacherId === tid && l.status === 'active'),
  activeCount: (tid) => db.where('teacherParentLinks', l => l.teacherId === tid && l.status === 'active').length,
  byParent:    (pid) => db.where('teacherParentLinks', l => l.parentId === pid),
  byStudent:   (sid) => db.where('teacherParentLinks', l => l.studentId === sid),
  insert:      (l)   => db.insert('teacherParentLinks', l),
  delete:      (id)  => db.delete('teacherParentLinks', id),

  link(teacherId, student, classId) {
    if (!student.parentPhone) return
    const clean = student.parentPhone.replace(/[^0-9]/g, '')
    let parent = ParentMembers.findByPhoneAndTeacher(clean, teacherId)
    if (!parent) {
      const record = { id: uid(), phone: clean, name: '', memo: '', appJoined: false, teacherId, createdAt: now() }
      db.insert('parentMembers', record)
      parent = record
    }
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
    ).forEach(l => db.update('teacherParentLinks', l.id, { status: 'ended', endedAt: now(), endReason: reason }))
  },

  unlinkByClass(teacherId, classId) {
    db.where('teacherParentLinks', l =>
      l.teacherId === teacherId && l.classId === classId && l.status === 'active'
    ).forEach(l => db.update('teacherParentLinks', l.id, { status: 'ended', endedAt: now(), endReason: 'class_ended' }))
  },

  unlinkByMember(teacherId, parentMemberId, reason = 'service_ended') {
    db.where('teacherParentLinks', l =>
      l.teacherId === teacherId && l.parentMemberId === parentMemberId && l.status === 'active'
    ).forEach(l => db.update('teacherParentLinks', l.id, { status: 'ended', endedAt: now(), endReason: reason }))
  },
}

export const TeacherServiceConfigs = {
  byTeacher: (tid) => db.where('teacherServiceConfigs', c => c.teacherId === tid)[0] || null,
  save(tid, patch) {
    const existing = this.byTeacher(tid)
    if (existing) return db.update('teacherServiceConfigs', existing.id, patch)
    return db.insert('teacherServiceConfigs', { id: uid(), teacherId: tid, ...patch, createdAt: now() })
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
  all:            ()             => db.get('supplyItems'),
  byTeacher:      (tid)          => db.where('supplyItems', r => r.teacherId === tid),
  byClass:        (classId)      => db.where('supplyItems', r => r.classId === classId),
  byClassStudent: (classId, sid) => db.where('supplyItems', r => r.classId === classId && r.studentId === sid),
  find:           (id)           => db.getOne('supplyItems', id),
  insert:         (r)            => db.insert('supplyItems', r),
  update:         (id, p)        => db.update('supplyItems', id, p),
  delete:         (id)           => db.delete('supplyItems', id),
  async upsert(r) {
    const existing = db.where('supplyItems', x => x.classId === r.classId && x.studentId === r.studentId)[0]
    if (existing) return await db.update('supplyItems', existing.id, r)
    return await db.insert('supplyItems', { ...r, id: r.id || uid() })
  },
}

export const SupplyPlans = {
  all:       ()           => db.get('supplyPlans'),
  byTeacher: (tid)        => db.where('supplyPlans', r => r.teacherId === tid),
  bySubject: (tid, sub)   => db.where('supplyPlans', r => r.teacherId === tid && r.subject === sub),
  byProduct: (productId)  => db.where('supplyPlans', r => r.productId === productId),
  byVendor:  (vendorId)   => db.where('supplyPlans', r => r.vendorId === vendorId),
  find:      (id)         => db.getOne('supplyPlans', id),
  insert:    (r)          => db.insert('supplyPlans', r),
  update:    (id, p)      => db.update('supplyPlans', id, p),
  delete:    (id)         => db.delete('supplyPlans', id),
}

export const SupplyPromos = {
  all:       ()         => db.get('supplyPromos'),
  byTeacher: (tid)      => db.where('supplyPromos', r => r.teacherId === tid),
  bySubject: (tid, sub) => db.where('supplyPromos', r => r.teacherId === tid && r.subject === sub),
  find:      (id)       => db.getOne('supplyPromos', id),
  insert:    (r)        => db.insert('supplyPromos', r),
  update:    (id, p)    => db.update('supplyPromos', id, p),
  delete:    (id)       => db.delete('supplyPromos', id),
}

export const SupplyProducts = {
  all:       ()          => db.get('supplyProducts'),
  byTeacher: (tid)       => db.where('supplyProducts', r => r.teacherId === tid),
  byVendor:  (vendorId)  => db.where('supplyProducts', r => r.vendorId === vendorId),
  find:      (id)        => db.getOne('supplyProducts', id),
  insert:    (r)         => db.insert('supplyProducts', r),
  update:    (id, p)     => db.update('supplyProducts', id, p),
  delete:    (id)        => db.delete('supplyProducts', id),
}

export const SupplyProductPlans = {
  all:            ()                 => db.get('supplyProductPlans'),
  byTeacher:      (tid)              => db.where('supplyProductPlans', r => r.teacherId === tid),
  byProduct:      (productId)        => db.where('supplyProductPlans', r => r.productId === productId),
  byProductStage: (productId, stage) => db.where('supplyProductPlans', r => r.productId === productId && r.stage === stage),
  find:           (id)               => db.getOne('supplyProductPlans', id),
  insert:         (r)                => db.insert('supplyProductPlans', r),
  update:         (id, p)            => db.update('supplyProductPlans', id, p),
  delete:         (id)               => db.delete('supplyProductPlans', id),
}

export const SupplyStudentProgress = {
  all:       ()                   => db.get('supplyStudentProgress'),
  byTeacher: (tid)                => db.where('supplyStudentProgress', r => r.teacherId === tid),
  byClass:   (classId)            => db.where('supplyStudentProgress', r => r.classId === classId),
  byStudent: (studentId, classId) => db.where('supplyStudentProgress', r => r.studentId === studentId && r.classId === classId),
  find:      (id)                 => db.getOne('supplyStudentProgress', id),
  insert:    (r)                  => db.insert('supplyStudentProgress', r),
  update:    (id, p)              => db.update('supplyStudentProgress', id, p),
  delete:    (id)                 => db.delete('supplyStudentProgress', id),
  async upsert(r) {
    const existing = db.where('supplyStudentProgress', x =>
      x.studentId === r.studentId && x.classId === r.classId && x.productId === r.productId
    )[0]
    if (existing) return await db.update('supplyStudentProgress', existing.id, { ...r, updatedAt: r.updatedAt })
    return await db.insert('supplyStudentProgress', { ...r, id: r.id || uid() })
  },
}

export const SupplyProgressLogs = {
  all:       ()                   => db.get('supplyProgressLogs'),
  byTeacher: (tid)                => db.where('supplyProgressLogs', r => r.teacherId === tid),
  byStudent: (studentId, classId) => db.where('supplyProgressLogs', r => r.studentId === studentId && r.classId === classId),
  byProduct: (productId)          => db.where('supplyProgressLogs', r => r.productId === productId),
  find:      (id)                 => db.getOne('supplyProgressLogs', id),
  insert:    (r)                  => db.insert('supplyProgressLogs', r),
  delete:    (id)                 => db.delete('supplyProgressLogs', id),
}

export const SupplySessionChecks = {
  all:              ()                              => db.get('supplySessionChecks'),
  byTeacher:        (tid)                           => db.where('supplySessionChecks', r => r.teacherId === tid),
  byStudent:        (studentId, classId)            => db.where('supplySessionChecks', r => r.studentId === studentId && r.classId === classId),
  byProduct:        (productId)                     => db.where('supplySessionChecks', r => r.productId === productId),
  byProductStudent: (productId, studentId, classId) => db.where('supplySessionChecks', r => r.productId === productId && r.studentId === studentId && r.classId === classId),
  find:             (id)                            => db.getOne('supplySessionChecks', id),
  insert:           (r)                             => db.insert('supplySessionChecks', r),
  update:           (id, p)                         => db.update('supplySessionChecks', id, p),
  delete:           (id)                            => db.delete('supplySessionChecks', id),
  async upsert(r) {
    const existing = db.where('supplySessionChecks', x =>
      x.studentId === r.studentId && x.classId === r.classId &&
      x.productId === r.productId && x.stage === r.stage && x.sessionNo === r.sessionNo
    )[0]
    if (existing) return await db.update('supplySessionChecks', existing.id, { ...r })
    return await db.insert('supplySessionChecks', { ...r, id: r.id || uid() })
  },
}

// ─── 교구 지급 기록
export const SupplyGiven = {
  all:          ()              => db.get('supplyGiven'),
  byTeacher:    (tid)           => db.where('supplyGiven', r => r.teacherId === tid),
  byStudent:    (studentId)     => db.where('supplyGiven', r => r.studentId === studentId),
  byClass:      (classId)       => db.where('supplyGiven', r => r.classId === classId),
  bySchool:     (schoolName)    => db.where('supplyGiven', r => r.schoolName === schoolName),
  byStudentClass: (studentId, classId) => db.where('supplyGiven', r => r.studentId === studentId && r.classId === classId),
  find:         (id)            => db.getOne('supplyGiven', id),
  insert:       (r)             => db.insert('supplyGiven', { ...r, id: r.id || uid() }),
  update:       (id, p)         => db.update('supplyGiven', id, p),
  delete:       (id)            => db.delete('supplyGiven', id),
}

export const SupplySchoolPrices = {
  all:          ()              => db.get('supplySchoolPrices'),
  byProduct:    (productId)     => db.where('supplySchoolPrices', r => r.productId === productId),
  byTeacher:    (tid)           => db.where('supplySchoolPrices', r => r.teacherId === tid),
  find:         (id)            => db.getOne('supplySchoolPrices', id),
  insert:       (r)             => db.insert('supplySchoolPrices', { ...r, id: r.id || uid() }),
  update:       (id, p)         => db.update('supplySchoolPrices', id, p),
  delete:       (id)            => db.delete('supplySchoolPrices', id),
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
  all:        ()         => db.get('documents'),
  byTeacher:  (tid)      => db.where('documents', r => r.teacherId === tid),
  byCategory: (tid, cat) => db.where('documents', r => r.teacherId === tid && r.category === cat),
  find:       (id)       => db.getOne('documents', id),
  insert:     (r)        => db.insert('documents', r),
  update:     (id, p)    => db.update('documents', id, p),
  delete:     (id)       => db.delete('documents', id),
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
  byTeacher: (tid) => db.where('teacherProfiles', r => r.teacherId === tid)[0] || null,
  save(tid, name, nickname) {
    const existing = this.byTeacher(tid)
    if (existing) return db.update('teacherProfiles', existing.id, { name, nickname })
    return db.insert('teacherProfiles', { id: uid(), teacherId: tid, name, nickname, createdAt: now() })
  },
}

// ─── 수업 메모장
export const LessonMemos = {
  all:         ()              => db.get('lessonMemos'),
  byClassDate: (classId, date) => db.where('lessonMemos', r => r.classId === classId && r.date === date),
  byTeacher:   (tid)           => db.where('lessonMemos', r => r.teacherId === tid),
  insert:      (r)             => db.insert('lessonMemos', r),
  update:      (id, p)         => db.update('lessonMemos', id, p),
  delete:      (id)            => db.delete('lessonMemos', id),
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
  all:       ()      => db.get('schoolAdminTeachers'),
  byAdmin:   (aid)   => db.where('schoolAdminTeachers', r => r.adminId === aid),
  byTeacher: (tid)   => db.where('schoolAdminTeachers', r => r.teacherId === tid),
  find:      (id)    => db.getOne('schoolAdminTeachers', id),
  insert:    (r)     => db.insert('schoolAdminTeachers', r),
  update:    (id, p) => db.update('schoolAdminTeachers', id, p),
  delete:    (id)    => db.delete('schoolAdminTeachers', id),
}

export const SchoolSubjects = {
  all:      ()      => db.get('schoolSubjects'),
  byAdmin:  (aid)   => db.where('schoolSubjects', r => r.adminId === aid),
  find:     (id)    => db.getOne('schoolSubjects', id),
  insert:   (r)     => db.insert('schoolSubjects', r),
  update:   (id, p) => db.update('schoolSubjects', id, p),
  delete:   (id)    => db.delete('schoolSubjects', id),
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
  all:      ()      => db.get('schoolNotices'),
  byAdmin:  (aid)   => db.where('schoolNotices', r => r.adminId === aid),
  find:     (id)    => db.getOne('schoolNotices', id),
  insert:   (r)     => db.insert('schoolNotices', r),
  update:   (id, p) => db.update('schoolNotices', id, p),
  delete:   (id)    => db.delete('schoolNotices', id),
}

export const SchoolNoticeSubmits = {
  all:       ()      => db.get('schoolNoticeSubmits'),
  byNotice:  (nid)   => db.where('schoolNoticeSubmits', r => r.noticeId === nid),
  byTeacher: (tid)   => db.where('schoolNoticeSubmits', r => r.teacherId === tid),
  find:      (id)    => db.getOne('schoolNoticeSubmits', id),
  insert:    (r)     => db.insert('schoolNoticeSubmits', r),
  update:    (id, p) => db.update('schoolNoticeSubmits', id, p),
  delete:    (id)    => db.delete('schoolNoticeSubmits', id),
}

export const SupplyParts = {
  byProduct: (productId) => db.where('supplyParts', r => r.productId === productId),
  insert: async (r) => {
    const row = { ...r, id: r.id || crypto.randomUUID(), createdAt: now() }
    return await db.insert('supplyParts', row)
  },
  delete: async (id) => {
    await db.delete('supplyParts', id)
  },
}
