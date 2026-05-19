// supabase/functions/db-api/index.ts
// 모든 DB 작업을 처리하는 통합 엔드포인트
// 배포: supabase functions deploy db-api

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS: 환경변수 ALLOWED_ORIGIN 으로 배포 도메인을 제한하세요.
// 예) supabase secrets set ALLOWED_ORIGIN=https://your-domain.vercel.app
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || ''

// 요청 Origin을 ALLOWED_ORIGIN과 대조하여 CORS 헤더 반환
// ALLOWED_ORIGIN 미설정 시 개발 편의를 위해 요청 Origin 반영 (배포 전 반드시 설정)
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGIN
    ? (origin === ALLOWED_ORIGIN ? origin : '')
    : (origin || '*')
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const TABLE_MAP: Record<string, string> = {
  users:                'users',
  classes:              'classes',
  students:             'students',
  attendance:           'attendance',
  notes:                'notes',
  adSlots:              'ad_slots',
  attendanceTemplates:  'attendance_templates',
  settings:             'settings',
  // 수익 관리
  revenueFees:          'revenueFees',
  revenuePayments:      'revenuePayments',
  // 내 관리 (강사 관련)
  trainings:            'trainings',
  careers:              'careers',
  educations:           'educations',
  certificates:         'certificates',
  awards:               'awards',
  jobSubs:              'jobSubs',
  // 기타
  branches:             'branches',
  points:               'points',
  parentMembers:        'parent_members',
  teacherParentLinks:   'teacher_parent_links',
  teacherServiceConfigs: 'teacher_service_configs',   // ← 추가
  // 교구 관리
  supplySubjects:         'supplySubjects',
  supplyVendors:          'supplyVendors',
  supplyItems:            'supplyItems',
  supplyPlans:            'supplyPlans',
  supplyPromos:           'supplyPromos',
  supplyProducts:         'supplyProducts',
  supplyProductPlans:     'supplyProductPlans',
  supplyStudentProgress:  'supplyStudentProgress',
  supplyProgressLogs:     'supplyProgressLogs',
  supplySessionChecks:    'supplySessionChecks',
  // 안내 문구
  messageGuides:          'messageGuides',
  messageCategories:      'messageCategories',
  teacherProfiles:        'teacherProfiles',
  // 교구업체 관리 (VendorApp)
  hqVendorSubjects:       'hqVendorSubjects',
  hqVendorProducts:       'hqVendorProducts',
  hqVendorStages:         'hqVendorStages',
  hqVendorContents:       'hqVendorContents',
  hqVendorQuarters:       'hqVendorQuarters',
  hqVendorSessions:       'hqVendorSessions',
  hqVendorFiles:          'hqVendorFiles',
  hqVendorPrices:         'hqVendorPrices',
  // 업체 계정 관리
  hqVendors:              'hqVendors',
  hqVendorUsers:          'hqVendorUsers',
  vendorAccounts:         'vendorAccounts',
  // 학교 담당자
  schoolAdmins:           'schoolAdmins',
  schoolAdminAccounts:    'schoolAdminAccounts',
  schoolAdminTeachers:    'schoolAdminTeachers',
  schoolSubjects:         'schoolSubjects',        // ← 신규
  schoolTeacherInvites:   'schoolTeacherInvites',  // ← 신규
  schoolNotices:          'schoolNotices',
  schoolNoticeSubmits:    'schoolNoticeSubmits',
  schoolCalendar:         'schoolCalendar',         // ← 추가
  schoolInfo:             'schoolInfo',             // ← 추가
  documents:              'documents',              // ← 방과후 서류
  customCategories:       'custom_categories',       // ← 커스텀 카테고리
  lessonMemos:            'lesson_memos',            // ← 수업 메모장
  blogPosts:              'blog_posts',              // ← SEO 블로그
  supplyGiven:            'supplyGiven',             // ← 교구 지급 기록
  supplySchoolPrices:     'supplySchoolPrices',      // ← 학교별 교구 공급가
  supplyParts:            'supplyParts',             // ← 교구 부품
}

// 컬럼이 camelCase로 저장된 테이블 — snake 변환 없이 그대로 사용
const CAMEL_TABLES = new Set([
  'revenueFees', 'revenuePayments',
  'trainings', 'careers', 'educations', 'certificates', 'awards', 'jobSubs',
  'supplySubjects', 'supplyVendors', 'supplyItems', 'supplyPlans', 'supplyPromos',
  'supplyProducts', 'supplyProductPlans', 'supplyStudentProgress',
  'supplyProgressLogs', 'supplySessionChecks',
  'messageGuides', 'messageCategories', 'teacherProfiles',
  'hqVendorSubjects', 'hqVendorProducts', 'hqVendorStages',
  'hqVendorContents', 'hqVendorQuarters', 'hqVendorSessions', 'hqVendorFiles', 'hqVendorPrices',
  'hqVendors', 'hqVendorUsers', 'vendorAccounts',
  'schoolAdmins', 'schoolAdminAccounts', 'schoolAdminTeachers',
  'schoolSubjects', 'schoolTeacherInvites',  // ← 신규
  'schoolNotices', 'schoolNoticeSubmits',
  'schoolCalendar',                          // ← 추가
  'schoolInfo',                              // ← 추가
  'documents',                               // ← 방과후 서류
  'customCategories',                        // ← 커스텀 카테고리
  'lessonMemos',                             // ← 수업 메모장
  'blogPosts',                               // ← SEO 블로그
  'supplyGiven',                             // ← 교구 지급 기록
  'supplySchoolPrices',                      // ← 학교별 교구 공급가
  'supplyParts',                             // ← 교구 부품
])

// camelCase → snake_case 변환
function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
    result[snake] = v !== null && typeof v === 'object' && !Array.isArray(v)
      ? toSnake(v as Record<string, unknown>)
      : v
  }
  return result
}

// snake_case → camelCase 변환
function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = v !== null && typeof v === 'object' && !Array.isArray(v)
      ? toCamel(v as Record<string, unknown>)
      : v
  }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    // ── JWT 인증 검증
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: '유효하지 않은 인증입니다.' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const url  = new URL(req.url)
    const body = req.method !== 'GET' ? await req.json() : {}

    const svcKey = Deno.env.get('SVC_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      svcKey,
    )

    // ── caller의 custom users 테이블 정보 조회 (level, id)
    const { data: callerUser } = await supabase
      .from('users')
      .select('id, level, role, email')
      .eq('auth_id', caller.id)
      .single()
    const callerId    = callerUser?.id    ?? null
    const callerLevel = callerUser?.level ?? 0
    const isAdmin     = callerLevel >= 10

    const { action, table, data, id, where, patch } = body

    const tbl = TABLE_MAP[table]
    if (!tbl) throw new Error(`Unknown table: ${table}`)

    // camelCase 테이블 여부 확인 (원래 테이블 키로 판단)
    const isCamelTable = CAMEL_TABLES.has(table)

    // 데이터 변환 함수: camelCase 테이블은 변환 없이 그대로
    const toDb  = (obj: Record<string, unknown>) => isCamelTable ? obj : toSnake(obj)
    const fromDb = (obj: Record<string, unknown>) => isCamelTable ? obj : toCamel(obj)

    let result: unknown

    switch (action) {
      case 'getAll': {
        // 관리자(level>=10)가 아닌 경우 본인 데이터만 조회 가능한 테이블 목록
        // key: table명, value: DB상 본인 ID 필터 컬럼명
        const TEACHER_OWNED: Record<string, string> = {
          classes:              'teacher_id',
          students:             'teacher_id',
          attendance:           'teacher_id',
          notes:                'teacher_id',
          attendanceTemplates:  'teacher_id',
          revenueFees:          'teacherId',
          revenuePayments:      'teacherId',
          trainings:            'teacherId',
          careers:              'teacherId',
          educations:           'teacherId',
          certificates:         'teacherId',
          awards:               'teacherId',
          jobSubs:              'teacherId',
          teacherProfiles:      'teacherId',
          documents:            'teacherId',
          lessonMemos:          'teacherId',
          messageGuides:        'teacherId',
          messageCategories:    'teacherId',
          supplySubjects:       'teacherId',
          supplyVendors:        'teacherId',
          supplyItems:          'teacherId',
          supplyPlans:          'teacherId',
          supplyPromos:         'teacherId',
          supplyProducts:       'teacherId',
          supplyProductPlans:   'teacherId',
          supplyStudentProgress:'teacherId',
          supplyProgressLogs:   'teacherId',
          supplySessionChecks:  'teacherId',
          supplyGiven:          'teacherId',
          customCategories:     'teacherId',
          teacherServiceConfigs:'teacher_id',
          parentMembers:        'teacher_id',
          teacherParentLinks:   'teacher_id',
          points:               'teacher_id',
        }
        // hqVendor 테이블은 vendorId로 필터 (벤더 전용)
        const VENDOR_OWNED: Record<string, string> = {
          hqVendorSubjects:  'vendorId',
          hqVendorProducts:  'vendorId',
          hqVendorContents:  'vendorId',
          hqVendorFiles:     'vendorId',
          hqVendorPrices:    'vendorId',
          hqVendorStages:    'vendorId',
          hqVendorQuarters:  'vendorId',
          hqVendorSessions:  'vendorId',
        }

        // _deleted 컬럼이 없는 테이블은 필터 없이 전체 조회
        const NO_DELETED_TABLES = new Set(['hqVendorPrices', 'supplyGiven', 'supplySchoolPrices', 'supplyParts'])
        let q = supabase.from(tbl).select('*')
        if (!NO_DELETED_TABLES.has(table)) {
          q = q.or('_deleted.is.null,_deleted.eq.false')
        }
        // attendance는 최근 90일치만 로드
        if (table === 'attendance') {
          const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          q = q.gte('date', since)
        }
        // 서버측 본인 데이터 필터링 (관리자 제외)
        if (!isAdmin && callerId) {
          if (TEACHER_OWNED[table]) {
            q = q.eq(TEACHER_OWNED[table], callerId)
          } else if (VENDOR_OWNED[table]) {
            // 벤더의 경우 vendorId를 body.vendorId로 받아서 검증
            const reqVendorId = body.vendorId
            if (reqVendorId) q = q.eq(VENDOR_OWNED[table], reqVendorId)
          }
        }

        const { data: rows, error } = await q
        if (error) throw error
        result = rows.map(fromDb)
        break
      }
      case 'getOne': {
        const { data: row, error } = await supabase.from(tbl).select('*').eq('id', id).single()
        if (error) throw error
        result = row ? fromDb(row) : null
        break
      }
      case 'where': {
        let q = supabase.from(tbl).select('*')
        for (const [col, val] of Object.entries(where || {})) {
          const dbCol = isCamelTable ? col : col.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
          q = q.eq(dbCol, val)
        }
        const { data: rows, error } = await q
        if (error) throw error
        result = rows.map(fromDb)
        break
      }
      case 'insert': {
        const dbData = toDb(data)
        const { data: rows, error } = await supabase.from(tbl).insert(dbData).select()
        if (error) throw error
        result = rows && rows.length > 0 ? fromDb(rows[0]) : null
        break
      }
      case 'upsert': {
        const dbData = toDb(data)
        const { data: rows, error } = await supabase.from(tbl).upsert(dbData).select()
        if (error) throw error
        result = rows && rows.length > 0 ? fromDb(rows[0]) : null
        break
      }
      case 'update': {
        const dbPatch = toDb(patch)
        const { data: rows, error } = await supabase.from(tbl).update(dbPatch).eq('id', id).select()
        if (error) throw error
        result = rows && rows.length > 0 ? fromDb(rows[0]) : null
        break
      }
      case 'delete': {
        const NO_SOFT_DELETE = new Set(['supplyParts'])
        if (NO_SOFT_DELETE.has(table)) {
          const { error } = await supabase.from(tbl).delete().eq('id', id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from(tbl)
            .update({ _deleted: true, updatedAt: new Date().toISOString() })
            .eq('id', id)
          if (error) throw error
        }
        result = { deleted: true }
        break
      }
      case 'settingGet': {
        const { data: row } = await supabase.from('settings').select('value').eq('key', id).single()
        result = row?.value ?? null
        break
      }
      case 'settingSet': {
        await supabase.from('settings').upsert({ key: id, value: data, updated_at: new Date().toISOString() })
        result = { ok: true }
        break
      }
      case 'findByEmail': {
        const { data: rows } = await supabase.from('users').select('*').eq('email', data.email).limit(1)
        result = rows?.[0] ? toCamel(rows[0]) : null
        break
      }
      case 'storageUpload': {
        const { bucket, path: filePath, base64, contentType } = body

        // #18 MIME 화이트리스트 검증
        const ALLOWED_MIME = new Set([
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/haansofthwp', 'application/x-hwp',
          'application/octet-stream',
        ])
        if (!ALLOWED_MIME.has(contentType)) {
          throw new Error(`허용되지 않은 파일 형식입니다: ${contentType}`)
        }
        const binaryStr = atob(base64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(filePath, bytes, { contentType, upsert: true })
        if (upErr) throw upErr

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
        result = { url: urlData.publicUrl }
        break
      }
      case 'attendanceUpsert': {
        const snakeData = toSnake(data)
        const { data: row, error } = await supabase
          .from('attendance')
          .upsert(snakeData, { onConflict: 'class_id,student_id,date' })
          .select().single()
        if (error) throw error
        result = row ? toCamel(row) : null
        break
      }
      case 'addColumn': {
        // addColumn은 보안상 제거됨 — 스키마 변경은 마이그레이션으로만 처리
        throw new Error('addColumn 액션은 지원하지 않습니다. 스키마 변경은 마이그레이션 파일로 처리하세요.')
      }
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
