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
}

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { action, table, data, id, where, patch } = body

    const tbl = TABLE_MAP[table]
    if (!tbl) throw new Error(`Unknown table: ${table}`)

    let result: unknown

    switch (action) {
      case 'getAll': {
        const { data: rows, error } = await supabase.from(tbl).select('*')
        if (error) throw error
        result = rows.map(toCamel)
        break
      }
      case 'getOne': {
        const { data: row, error } = await supabase.from(tbl).select('*').eq('id', id).single()
        if (error) throw error
        result = row ? toCamel(row) : null
        break
      }
      case 'where': {
        let q = supabase.from(tbl).select('*')
        for (const [col, val] of Object.entries(where || {})) {
          q = q.eq(col.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), val)
        }
        const { data: rows, error } = await q
        if (error) throw error
        result = rows.map(toCamel)
        break
      }
      case 'insert': {
        const snakeData = toSnake(data)
        const { data: row, error } = await supabase.from(tbl).insert(snakeData).select().single()
        if (error) throw error
        result = row ? toCamel(row) : null
        break
      }
      case 'upsert': {
        const snakeData = toSnake(data)
        const { data: row, error } = await supabase.from(tbl).upsert(snakeData).select().single()
        if (error) throw error
        result = row ? toCamel(row) : null
        break
      }
      case 'update': {
        const snakePatch = toSnake(patch)
        const { data: row, error } = await supabase.from(tbl).update(snakePatch).eq('id', id).select().single()
        if (error) throw error
        result = row ? toCamel(row) : null
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
