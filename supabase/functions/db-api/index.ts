// supabase/functions/db-api/index.ts
// 모든 DB 작업을 처리하는 통합 엔드포인트
// 배포: supabase functions deploy db-api

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  'hqVendorContents', 'hqVendorQuarters', 'hqVendorSessions', 'hqVendorFiles',
  'hqVendors', 'hqVendorUsers', 'vendorAccounts',
  'schoolAdmins', 'schoolAdminAccounts', 'schoolAdminTeachers',
  'schoolSubjects', 'schoolTeacherInvites',  // ← 신규
  'schoolNotices', 'schoolNoticeSubmits',
  'schoolCalendar',                          // ← 추가
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url  = new URL(req.url)
    const body = req.method !== 'GET' ? await req.json() : {}

    const svcKey = Deno.env.get('SVC_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      svcKey,
    )

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
        const { data: rows, error } = await supabase.from(tbl).select('*')
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
        const { data: row, error } = await supabase.from(tbl).insert(dbData).select().single()
        if (error) throw error
        result = row ? fromDb(row) : null
        break
      }
      case 'upsert': {
        const dbData = toDb(data)
        const { data: row, error } = await supabase.from(tbl).upsert(dbData).select().single()
        if (error) throw error
        result = row ? fromDb(row) : null
        break
      }
      case 'update': {
        const dbPatch = toDb(patch)
        const { data: row, error } = await supabase.from(tbl).update(dbPatch).eq('id', id).select().single()
        if (error) throw error
        result = row ? fromDb(row) : null
        break
      }
      case 'delete': {
        const { error } = await supabase.from(tbl).delete().eq('id', id)
        if (error) throw error
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
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
