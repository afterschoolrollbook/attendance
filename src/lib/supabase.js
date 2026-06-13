// Supabase 클라이언트
// DB 접근: Supabase JS 클라이언트 직접 사용 (Edge Function 없음)
// Edge Function: 이메일/SMS/푸시/OAuth 전용

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL     || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON
export const FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''

// ─── Supabase JS 클라이언트 (DB 직접 접근)
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true } })
  : null

// ─── 실제 DB 테이블 이름 매핑
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

function toSnake(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
    result[snake] = v !== null && typeof v === 'object' && !Array.isArray(v) ? toSnake(v) : v
  }
  return result
}

export function toCamel(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = v !== null && typeof v === 'object' && !Array.isArray(v) ? toCamel(v) : v
  }
  return result
}

function getConverters(table) {
  const tbl = TABLE_MAP[table] || table
  return {
    tbl,
    toDb:   toSnake,
    fromDb: toCamel,
  }
}

// ─── 테이블별 타입 불일치 방어: '' / null / undefined → boolean은 false, timestamp는 null
// (예전 db-api의 sanitize()를 dbCall로 이전 — db-api 제거로 빠졌던 처리)
const BOOLEAN_COLS = {
  students: ['parent_joined', 'moved_to_manage'],
}
const NULLABLE_COLS = {
  students: ['parent_invite_sent_at', 'student_start_date', 'student_end_date', 'updated_at', 'created_at'],
}
function sanitize(obj, table) {
  const boolCols = BOOLEAN_COLS[table] || []
  const nullCols = NULLABLE_COLS[table] || []
  if (boolCols.length === 0 && nullCols.length === 0) return obj
  const result = { ...obj }
  for (const col of boolCols) {
    if (col in result) result[col] = !!result[col]
  }
  for (const col of nullCols) {
    if (col in result && !result[col] && result[col] !== 0) result[col] = null
  }
  return result
}

// ─── 학부모 전용: 학생/수업/선생님/출석 데이터 일괄 조회
//     (security definer RPC get_parent_dashboard — RLS 우회, 본인 전화번호 데이터만)
// p_pin: PIN 검증이 이미 완료된 경우 해당 PIN 문자열을 함께 전달 (RPC 내부에서 2중 검증)
//        초대 직후 PIN 미설정 상태에서 최초 대시보드 로드 시에는 null 전달
export async function loadParentDashboard(normalizedPhone, pin = null) {
  if (!supabase) return null
  try {
    const params = { p_phone: normalizedPhone }
    if (pin !== null) params.p_pin = pin
    const { data, error } = await supabase.rpc('get_parent_dashboard', params)
    if (error) throw error
    return {
      students:   (data?.students   || []).map(toCamel),
      classes:    (data?.classes    || []).map(toCamel),
      teachers:   (data?.teachers   || []).map(toCamel),
      attendance: (data?.attendance || []).map(toCamel),
    }
  } catch (e) {
    console.warn('[loadParentDashboard] 조회 실패:', e.message)
    return null
  }
}

// ─── dbCall: 기존 API 호환 유지 + Supabase JS 클라이언트로 직접 처리
export async function dbCall(action, table, payload = {}) {
  if (!supabase) throw new Error('Supabase 미설정')

  const { tbl, toDb, fromDb } = getConverters(table)
  const { data: d, id, where, patch } = payload

  switch (action) {
    case 'getAll': {
      const NO_DELETED = new Set(['points', 'settings', 'revenueFees', 'revenuePayments', 'supplySubjects', 'supplyVendors', 'supplyPlans', 'supplyProducts', 'supplyProductPlans', 'schoolCalendar', 'schoolInfo', 'hqVendors', 'hqVendorSubjects', 'hqVendorProducts', 'hqVendorStages', 'hqVendorContents', 'hqVendorQuarters', 'hqVendorSessions', 'hqVendorFiles', 'hqVendorPrices', 'hqVendorUsers', 'vendorAccounts'])
      let q = supabase.from(tbl).select('*')
      if (!NO_DELETED.has(table)) {
        q = q.or('_deleted.is.null,_deleted.eq.false')
      }
      if (table === 'attendance') {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        q = q.gte('date', since)
      }
      const { data: rows, error } = await q
      if (error) throw new Error(error.message)
      return (rows || []).map(fromDb)
    }

    case 'getOne': {
      const { data: row, error } = await supabase.from(tbl).select('*').eq('id', id).single()
      if (error) throw new Error(error.message)
      return row ? fromDb(row) : null
    }

    case 'where': {
      let q = supabase.from(tbl).select('*')
      for (const [col, val] of Object.entries(where || {})) {
        const dbCol = col.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
        q = q.eq(dbCol, val)
      }
      const { data: rows, error } = await q
      if (error) throw new Error(error.message)
      return (rows || []).map(fromDb)
    }

    case 'insert': {
      const { data: rows, error } = await supabase.from(tbl).insert(sanitize(toDb(d), table)).select()
      if (error) throw new Error(error.message)
      return rows && rows.length > 0 ? fromDb(rows[0]) : null
    }

    case 'upsert': {
      const { data: rows, error } = await supabase.from(tbl).upsert(sanitize(toDb(d), table)).select()
      if (error) throw new Error(error.message)
      return rows && rows.length > 0 ? fromDb(rows[0]) : null
    }

    case 'update': {
      const { data: rows, error } = await supabase.from(tbl).update(sanitize(toDb(patch), table)).eq('id', id).select()
      if (error) throw new Error(error.message)
      return rows && rows.length > 0 ? fromDb(rows[0]) : null
    }

    case 'delete': {
      const { error } = await supabase
        .from(tbl)
        .update({ _deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
      return { deleted: true }
    }

    case 'settingGet': {
      const { data: row } = await supabase.from('settings').select('value').eq('key', id).single()
      return row?.value ?? null
    }

    case 'settingSet': {
      await supabase.from('settings').upsert({ key: id, value: d, updated_at: new Date().toISOString() })
      return { ok: true }
    }

    case 'findByEmail': {
      const { data: rows } = await supabase.from('users').select('*').eq('email', d.email).limit(1)
      return rows?.[0] ? toCamel(rows[0]) : null
    }

    case 'attendanceUpsert': {
      const { data: row, error } = await supabase
        .from('attendance')
        .upsert(toSnake(d), { onConflict: 'class_id,student_id,date' })
        .select().single()
      if (error) throw new Error(error.message)
      return row ? toCamel(row) : null
    }

    case 'storageUpload': {
      const { bucket, path: filePath, base64, contentType } = payload
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const { error } = await supabase.storage.from(bucket).upload(filePath, bytes, { contentType, upsert: true })
      if (error) throw new Error(error.message)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
      return { url: urlData.publicUrl }
    }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

// ─── Edge Function 호출 (이메일/SMS/푸시/OAuth 전용)
async function callFunction(name, body) {
  if (!FUNCTIONS_BASE) throw new Error('Supabase URL이 설정되지 않았습니다.')
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `${name} 호출 실패`)
  return data.data
}

export async function sendEmail(to, code) {
  return callFunction('send-email', { to, code })
}

export async function sendSMS(to, text, type = 'SMS') {
  return callFunction('send-sms', { to, text, type })
}

// 비밀번호 초기화: 앱이 보낸 인증번호(verify_codes, purpose='reset') 검증 후
// 로그인 없이 새 비밀번호로 즉시 변경 (reset-password-self Edge Function)
export async function resetPasswordWithCode(email, code, newPassword) {
  return callFunction('reset-password-self', { email, code, newPassword })
}

export async function naverOAuth(code, state) {
  if (!FUNCTIONS_BASE) throw new Error('Supabase URL이 설정되지 않았습니다.')
  const res = await fetch(`${FUNCTIONS_BASE}/naver-oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ code, state }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'naver-oauth 호출 실패')
  // data.data (사용자 정보) + data.session (Auth 세션) 함께 반환
  return { ...data.data, session: data.session || null }
}

export async function sendPush(subscription, { title, body, url = '/parent-invite', tag = 'attendance' }) {
  if (!subscription) return
  try {
    await callFunction('send-push', { subscription, title, body, url, tag })
  } catch (e) {
    console.warn('[Push] 발송 실패:', e.message)
  }
}

// ─── Supabase Auth 함수
// 이메일/비밀번호 로그인
export async function authSignIn(email, password) {
  if (!supabase) throw new Error('Supabase 미설정')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

// 이메일/비밀번호 회원가입
export async function authSignUp(email, password) {
  if (!supabase) throw new Error('Supabase 미설정')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data
}

// 로그아웃
export async function authSignOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// 현재 세션 조회
export async function authGetSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// 현재 로그인 유저 조회
export async function authGetUser() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// 비밀번호 초기화 이메일 발송
export async function authResetPassword(email) {
  if (!supabase) throw new Error('Supabase 미설정')
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw new Error(error.message)
}

// 비밀번호 변경 (로그인 상태에서)
export async function authUpdatePassword(newPassword) {
  if (!supabase) throw new Error('Supabase 미설정')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

// 인증 상태 변경 구독 (App.jsx에서 사용)
export function authOnStateChange(callback) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}

// ─── 업체 포털 RPC 헬퍼 (SECURITY DEFINER RPC 경유 — RLS 우회)
// supabase/migrations/20240001_vendor_rpc.sql 의 함수들과 1:1 대응
export const vendorRpc = {
  // ── 조회
  getVendorById:          (id)  => supabase.rpc('get_vendor_by_id',                { p_id: id }).then(r => r.data?.[0] ?? null),
  getVendorByEmail:       (e)   => supabase.rpc('get_vendor_by_email',             { p_email: e }).then(r => r.data?.[0] ?? null),
  getVendorByPhone:       (p)   => supabase.rpc('get_vendor_by_phone',             { p_phone: p }).then(r => r.data?.[0] ?? null),
  getAccountByEmail:      (e)         => supabase.rpc('get_vendor_account_by_email',     { p_email: e }).then(r => r.data?.[0] ?? null),
  getAccountByVendorId:   (vid)       => supabase.rpc('get_vendor_account_by_vendor_id', { p_vendor_id: vid }).then(r => r.data?.[0] ?? null),
  // 로그인 전용: 서버에서 해시 비교 후 pw 제외한 계정 반환 (불일치·없음 → null)
  verifyLogin:            (e, pwHash) => supabase.rpc('verify_vendor_login', { p_email: e, p_pw_hash: pwHash }).then(r => r.data?.[0] ?? null),
  adminGetVendors:        ()    => supabase.rpc('admin_get_hq_vendors').then(r => r.data ?? []),
  adminGetSubjects:       ()    => supabase.rpc('admin_get_hq_vendor_subjects').then(r => r.data ?? []),
  adminGetProducts:       ()    => supabase.rpc('admin_get_hq_vendor_products').then(r => r.data ?? []),
  getSubjectsByVendor:    (vid) => supabase.rpc('get_vendor_subjects',  { p_vendor_id: vid }).then(r => r.data ?? []),
  getProductsByVendor:    (vid) => supabase.rpc('get_vendor_products',  { p_vendor_id: vid }).then(r => r.data ?? []),
  getContentsByVendor:    (vid) => supabase.rpc('get_vendor_contents',  { p_vendor_id: vid }).then(r => r.data ?? []),
  getFilesByVendor:       (vid) => supabase.rpc('get_vendor_files',     { p_vendor_id: vid }).then(r => r.data ?? []),
  getPricesByVendor:      (vid) => supabase.rpc('get_vendor_prices',    { p_vendor_id: vid }).then(r => r.data ?? []),
  // ── upsert
  upsertVendor:           (d)   => supabase.rpc('upsert_hq_vendor',      { p_data: d }).then(r => r.data?.[0] ?? null),
  upsertAccount:          (d)   => supabase.rpc('upsert_vendor_account', { p_data: d }).then(r => r.data?.[0] ?? null),
  upsertSubject:          (d)   => supabase.rpc('upsert_vendor_subject', { p_data: d }).then(r => r.data?.[0] ?? null),
  upsertProduct:          (d)   => supabase.rpc('upsert_vendor_product', { p_data: d }).then(r => r.data?.[0] ?? null),
  upsertContent:          (d)   => supabase.rpc('upsert_vendor_content', { p_data: d }).then(r => r.data?.[0] ?? null),
  upsertFile:             (d)   => supabase.rpc('upsert_vendor_file',    { p_data: d }).then(r => r.data?.[0] ?? null),
  upsertPrice:            (d)   => supabase.rpc('upsert_vendor_price',   { p_data: d }).then(r => r.data?.[0] ?? null),
  // ── delete
  adminDeleteVendor:      (id)  => supabase.rpc('admin_delete_hq_vendor', { p_id: id }).then(r => r.error ? false : true),
  adminDeleteSubject:     (id)  => supabase.rpc('delete_vendor_subject',  { p_id: id }).then(r => r.error ? false : true),
  adminDeleteProduct:     (id)  => supabase.rpc('delete_vendor_product',  { p_id: id }).then(r => r.error ? false : true),
  deleteSubject:          (id)  => supabase.rpc('delete_vendor_subject',  { p_id: id }).then(r => r.error ? false : true),
  deleteProduct:          (id)  => supabase.rpc('delete_vendor_product',  { p_id: id }).then(r => r.error ? false : true),
  deleteContent:          (id)  => supabase.rpc('delete_vendor_content',  { p_id: id }).then(r => r.error ? false : true),
  deleteFile:             (id)  => supabase.rpc('delete_vendor_file',     { p_id: id }).then(r => r.error ? false : true),
}
