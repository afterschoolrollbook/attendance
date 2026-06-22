// app/api/mcp/route.js
//
// 방과후 출석부 블로그 자동화용 MCP(Model Context Protocol) 서버.
// Vercel 공식 mcp-handler 패키지로 Streamable HTTP 프로토콜을 구현합니다.
// Claude(연결된 커넥터)가 이 툴들을 직접 호출해서 "오늘 블로그 글" 글감을
// 사람 개입 없이 스스로 판단할 수 있게 하는 것이 목적입니다.
//
// 노출 툴 14개:
//   - get_publish_log      : 발행 기록 조회 (중복 방지 + 키워드 추적, STEP 1에서 가장 먼저 호출)
//   - get_keyword_data     : 과목/역량 그룹별 찜한 키워드 + TOP 키워드 조회
//   - search_keyword_data  : keyword_stats 전체를 그룹 구분 없이 검색 (황금키워드 탐색)
//   - naver_keyword_volume : 특정 키워드의 실시간 네이버 검색량 조회
//   - save_keyword_data    : naver_keyword_volume 조회 결과를 TOP 키워드 캐시에 저장
//   - pick_keyword         : 나중에 쓸 키워드를 찜(bookmark)해두기
//   - search_keyword_picks : 찜해둔 키워드 검색/열람, 기본은 미사용만
//   - mark_keyword_used    : 찜 키워드를 글에 실제로 썼을 때 사용 처리
//   - suggest_feature      : 새 각도/주제 제안을 검토 메모와 함께 기록
//   - get_feature_ideas    : suggest_feature로 기록해둔 제안 목록 조회
//   - add_publish_log      : 글 작성 후 발행 기록에 자동으로 남기기
//   - create_blog_post     : 블로그 글 본문을 실제로 사이트에 발행
//   - get_series_info      : 시리즈/카테고리 정보 조회
//   - update_series_info   : 시리즈/카테고리 정보 갱신
//
// 필요한 Supabase 테이블 (최초 1회 실행):
//
// create table if not exists blog_content_log (
//   id text primary key,
//   series text not null,
//   category text not null,
//   angle text not null,
//   title text not null,
//   slug text not null,
//   memo text,
//   target_keyword text,
//   search_pc integer, search_mobile integer, search_total integer, competition text,
//   published_at timestamptz,
//   created_at timestamptz not null default now()
// );
//
// create table if not exists blog_keyword_stats (
//   id bigserial primary key,
//   hint text not null, keyword text not null,
//   pc integer not null default 0, mobile integer not null default 0,
//   total integer not null default 0, competition text,
//   updated_at timestamptz not null default now(),
//   unique(hint, keyword)
// );
//
// create table if not exists blog_keyword_picks (
//   id bigserial primary key,
//   tool_id text not null, hint text not null, keyword text not null,
//   pc integer not null default 0, mobile integer not null default 0,
//   total integer not null default 0, competition text, memo text,
//   used_at timestamptz, used_in_title text, used_in_slug text,
//   unique(tool_id, keyword)
// );
//
// create table if not exists blog_feature_ideas (
//   id text primary key,
//   series text not null, category text not null, feature_name text not null,
//   keyword text, pc integer, mobile integer, total integer, competition text,
//   notes text not null,
//   status text not null default 'proposed',
//   created_at timestamptz not null default now()
// );
//
// create table if not exists blog_series_info (
//   series_id text primary key,
//   name text, description text not null,
//   updated_at timestamptz not null default now()
// );
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID
//   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (선택)
//   MCP_SHARED_SECRET
//
// claude.ai 커넥터 등록 주소:
//   https://attendance-blog-mcp.vercel.app/api/mcp?key=여기에_MCP_SHARED_SECRET_값

import { createMcpHandler } from 'mcp-handler'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SERIES = {
  'series-a': '시리즈A — 초등 역량 (창의력, 집중력, 그릿, 메타인지 등)',
  'series-b': '시리즈B — 세계 교육법 (핀란드, 몬테소리, PBL 등)',
  'series-c': '시리즈C — 고민 해결 (수업 방해, 무기력, ADHD 의심 등)',
  'series-d': '시리즈D — 역량·활동 연결 (바둑, 악기, 레고, 코딩 등)',
}
const SERIES_CODES = Object.keys(SERIES)

function fmt(n) { return (n || 0).toLocaleString('ko-KR') }

// ── 네이버 검색광고 API ───────────────────────────────────────────────
const NAVER_BASE_URL = 'https://api.naver.com'
const NAVER_URI = '/keywordstool'

function buildNaverHeaders() {
  const apiKey = process.env.NAVER_AD_API_KEY
  const secretKey = process.env.NAVER_AD_SECRET_KEY
  const customerId = process.env.NAVER_AD_CUSTOMER_ID
  if (!apiKey || !secretKey || !customerId) throw new Error('네이버 검색광고 API 환경변수가 설정되지 않았습니다')
  const timestamp = Date.now().toString()
  const message = `${timestamp}.GET.${NAVER_URI}`
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64')
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': apiKey,
    'X-Customer': String(customerId),
    'X-Signature': signature,
  }
}

function normalizeKeywords(raw) {
  return String(raw || '').split(',').map(k => k.trim().replace(/\s+/g, '')).filter(Boolean).slice(0, 5)
}

async function fetchNaverKeywordData(keywords) {
  const headers = buildNaverHeaders()
  const url = `${NAVER_BASE_URL}${NAVER_URI}?hintKeywords=${encodeURIComponent(keywords.join(','))}&showDetail=1`
  const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) })
  if (!response.ok) { const text = await response.text().catch(() => ''); throw new Error(`네이버 API 오류 (${response.status}): ${text}`) }
  const data = await response.json()
  const list = Array.isArray(data?.keywordList) ? data.keywordList : []
  const parsed = list.map(item => {
    const pc = item.monthlyPcQcCnt === '< 10' ? 5 : Number(item.monthlyPcQcCnt) || 0
    const mobile = item.monthlyMobileQcCnt === '< 10' ? 5 : Number(item.monthlyMobileQcCnt) || 0
    return { keyword: item.relKeyword, monthlySearchPc: pc, monthlySearchMobile: mobile, monthlySearchTotal: pc + mobile, competition: item.compIdx }
  }).sort((a, b) => b.monthlySearchTotal - a.monthlySearchTotal)

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (clientId && clientSecret) {
    const docCounts = await Promise.all(parsed.map(async (item) => {
      try {
        const res = await fetch(`https://openapi.naver.com/v1/search/blog?query=${encodeURIComponent(item.keyword)}&display=1`, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(5000) })
        if (!res.ok) return null
        const d = await res.json()
        return d.total ?? null
      } catch { return null }
    }))
    return parsed.map((item, i) => ({ ...item, docCount: docCounts[i] }))
  }
  return parsed
}

// ── MCP 서버 ─────────────────────────────────────────────────────────
const baseHandler = createMcpHandler(
  (server) => {

    server.registerTool('get_publish_log', {
      title: '블로그 발행 기록 조회',
      description: '발행한 블로그 글 기록(시리즈/카테고리/각도/제목/슬러그/발행일/메모)을 가져온다. 오늘 글감 정하기 전 STEP 1에서 가장 먼저 호출해서 중복을 피한다.',
      inputSchema: {
        series: z.enum(SERIES_CODES).optional().describe('특정 시리즈로만 필터링'),
        category: z.string().optional().describe('과목/역량 카테고리로 필터링 (예: 바둑, 창의력)'),
        limit: z.number().int().min(1).max(500).optional().describe('최대 개수 (기본 200)'),
      },
    }, async ({ series, category, limit }) => {
      let q = supabase.from('blog_content_log').select('*').order('created_at', { ascending: false })
      if (series) q = q.eq('series', series)
      if (category) q = q.ilike('category', `%${category}%`)
      q = q.limit(limit || 200)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      if (!data || !data.length) return { content: [{ type: 'text', text: '발행 기록 없음 (처음 시작)' }] }
      const lines = [`발행 기록 (${data.length}건, 최신순):`]
      data.forEach(l => {
        const dateStr = l.published_at || (l.created_at ? l.created_at.slice(0, 10) : '')
        lines.push(`- [${l.series}/${l.category}] 각도: ${l.angle} / 제목: ${l.title} / 슬러그: ${l.slug}${dateStr ? ' / 날짜: ' + dateStr : ''}${l.memo ? ' / 메모: ' + l.memo : ''}`)
      })
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })

    server.registerTool('get_keyword_data', {
      title: '카테고리별 키워드 검색량 조회 (캐시)',
      description: '특정 과목/역량 카테고리(hint)의 찜한 키워드와 TOP 검색량 키워드를 가져온다.',
      inputSchema: {
        hint: z.string().describe('과목/역량 카테고리명 (예: 바둑, 창의력, 집중력, 악기)'),
        limit: z.number().int().min(1).max(100).optional().describe('TOP 키워드 최대 개수 (기본 30)'),
      },
    }, async ({ hint, limit }) => {
      const max = limit || 30
      const { data: topRows, error: topErr } = await supabase.from('blog_keyword_stats').select('keyword, pc, mobile, total, competition').eq('hint', hint).order('total', { ascending: false }).limit(max)
      if (topErr) return { content: [{ type: 'text', text: `오류: ${topErr.message}` }], isError: true }
      const { data: pickRows, error: pickErr } = await supabase.from('blog_keyword_picks').select('keyword, pc, mobile, total, competition, memo').eq('tool_id', hint).is('used_at', null).order('total', { ascending: false })
      if (pickErr) return { content: [{ type: 'text', text: `오류: ${pickErr.message}` }], isError: true }
      const lines = [`[카테고리] ${hint}`, '']
      lines.push(`⭐ 찜한 키워드 (미사용 ${pickRows.length}개):`)
      if (!pickRows.length) lines.push('- 없음')
      else pickRows.forEach(p => lines.push(`- ${p.keyword} · 합계 ${fmt(p.total)} (PC ${fmt(p.pc)} / 모바일 ${fmt(p.mobile)})${p.competition ? ' · 경쟁도 ' + p.competition : ''}${p.memo ? ' · ' + p.memo : ''}`))
      lines.push('')
      lines.push(`📊 TOP 키워드 (${topRows.length}개):`)
      if (!topRows.length) lines.push('- 데이터 없음 (naver_keyword_volume으로 먼저 수집 필요)')
      else topRows.forEach((k, i) => lines.push(`${i + 1}. ${k.keyword} · 합계 ${fmt(k.total)} (PC ${fmt(k.pc)} / 모바일 ${fmt(k.mobile)})${k.competition ? ' · 경쟁도 ' + k.competition : ''}`))
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })

    server.registerTool('search_keyword_data', {
      title: '전체 키워드 데이터 검색 (카테고리 구분 없음)',
      description: 'blog_keyword_stats 전체를 카테고리 구분 없이 검색한다. competition: "낮음"으로 호출하면 황금키워드 후보를 찾을 수 있다.',
      inputSchema: {
        query: z.string().optional().describe('키워드에 포함될 문자열. 비우면 전체'),
        competition: z.string().optional().describe('경쟁도 필터 (예: "낮음")'),
        limit: z.number().int().min(1).max(300).optional().describe('최대 개수 (기본 100)'),
      },
    }, async ({ query, competition, limit }) => {
      let q = supabase.from('blog_keyword_stats').select('hint, keyword, pc, mobile, total, competition').order('total', { ascending: false }).limit(limit || 100)
      if (query) q = q.ilike('keyword', `%${query}%`)
      if (competition) q = q.eq('competition', competition)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      if (!data || !data.length) return { content: [{ type: 'text', text: '검색 결과 없음' }] }
      const lines = [`검색 결과 (${data.length}건, 검색량 순):`]
      data.forEach(k => lines.push(`- [${k.hint}] ${k.keyword} · 합계 ${fmt(k.total)} (PC ${fmt(k.pc)} / 모바일 ${fmt(k.mobile)})${k.competition ? ' · 경쟁도 ' + k.competition : ''}`))
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })

    server.registerTool('naver_keyword_volume', {
      title: '네이버 키워드 실시간 검색량 조회',
      description: '네이버 검색광고 키워드도구로 키워드별 월간 검색량(PC/모바일)과 경쟁도를 실시간 조회한다.',
      inputSchema: {
        hintKeywords: z.string().describe('쉼표로 구분된 키워드, 최대 5개. 예: "초등집중력,방과후바둑,바둑수업효과"'),
      },
    }, async ({ hintKeywords }) => {
      const keywords = normalizeKeywords(hintKeywords)
      if (!keywords.length) return { content: [{ type: 'text', text: '키워드를 입력해주세요.' }], isError: true }
      try {
        const results = await fetchNaverKeywordData(keywords)
        return { content: [{ type: 'text', text: JSON.stringify({ query: keywords, results }, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `오류: ${err.message}` }], isError: true }
      }
    })

    server.registerTool('save_keyword_data', {
      title: '키워드 검색량 데이터 저장',
      description: 'naver_keyword_volume 조회 결과를 blog_keyword_stats에 저장한다.',
      inputSchema: {
        hint: z.string().describe('카테고리명 (예: 바둑, 창의력, 집중력)'),
        keywords: z.array(z.object({ keyword: z.string(), monthlySearchPc: z.number().optional(), monthlySearchMobile: z.number().optional(), monthlySearchTotal: z.number().optional(), competition: z.string().optional() })).min(1),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    }, async ({ hint, keywords }) => {
      const rows = keywords.map(k => { const pc = k.monthlySearchPc || 0; const mobile = k.monthlySearchMobile || 0; return { hint, keyword: k.keyword, pc, mobile, total: k.monthlySearchTotal ?? pc + mobile, competition: k.competition || '-', updated_at: new Date().toISOString() } })
      const { error } = await supabase.from('blog_keyword_stats').upsert(rows, { onConflict: 'hint,keyword' })
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `✅ [${hint}] 키워드 ${rows.length}개 저장됨.` }] }
    })

    server.registerTool('pick_keyword', {
      title: '키워드 찜하기 (글감 bookmark)',
      description: '나중에 글로 쓰고 싶은 키워드를 찜해둔다.',
      inputSchema: {
        group: z.string().describe('카테고리명 (예: 바둑, 창의력, 집중력)'),
        keyword: z.string(),
        pc: z.number().optional(), mobile: z.number().optional(), total: z.number().optional(), competition: z.string().optional(),
        memo: z.string().optional().describe('글 계획 메모'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    }, async ({ group, keyword, pc, mobile, total, competition, memo }) => {
      const row = { tool_id: group, hint: group, keyword, pc: pc || 0, mobile: mobile || 0, total: total ?? (pc || 0) + (mobile || 0), competition: competition || null, memo: memo || null }
      const { error } = await supabase.from('blog_keyword_picks').upsert(row, { onConflict: 'tool_id,keyword' })
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `⭐ 찜 완료: [${group}] ${keyword}${memo ? ' — ' + memo : ''}` }] }
    })

    server.registerTool('search_keyword_picks', {
      title: '찜한 키워드 전체 검색/열람',
      description: '찜해둔 키워드를 카테고리 구분 없이 전체 열람한다. 기본은 미사용만 보여준다.',
      inputSchema: {
        query: z.string().optional(),
        include_used: z.boolean().optional().describe('true면 사용 처리된 것도 포함 (기본 false)'),
      },
    }, async ({ query, include_used }) => {
      let q = supabase.from('blog_keyword_picks').select('tool_id, keyword, pc, mobile, total, competition, memo, used_at, used_in_title, used_in_slug').order('total', { ascending: false })
      if (!include_used) q = q.is('used_at', null)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      let rows = data || []
      if (query) { const needle = query.toLowerCase(); rows = rows.filter(r => (r.keyword || '').toLowerCase().includes(needle) || (r.memo || '').toLowerCase().includes(needle)) }
      if (!rows.length) return { content: [{ type: 'text', text: include_used ? '찜한 키워드 없음' : '미사용 찜 키워드 없음' }] }
      const lines = [`${include_used ? '찜한 키워드 전체' : '⭐ 미사용 찜 키워드'} (${rows.length}개):`]
      rows.forEach(p => { const usedNote = p.used_at ? ` · ✅ 사용됨(${p.used_at.slice(0, 10)}, ${p.used_in_title || ''})` : ''; lines.push(`- [${p.tool_id}] ${p.keyword} · 합계 ${fmt(p.total)}${p.competition ? ' · 경쟁도 ' + p.competition : ''}${p.memo ? ' · ' + p.memo : ''}${usedNote}`) })
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })

    server.registerTool('mark_keyword_used', {
      title: '찜 키워드 사용 처리',
      description: '찜해둔 키워드를 실제 글에 썼을 때 호출해서 사용됨으로 표시한다.',
      inputSchema: {
        group: z.string(), keyword: z.string(),
        used_in_title: z.string(), used_in_slug: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    }, async ({ group, keyword, used_in_title, used_in_slug }) => {
      const nowIso = new Date().toISOString()
      const { error } = await supabase.from('blog_keyword_picks').upsert({ tool_id: group, hint: group, keyword, used_at: nowIso, used_in_title: used_in_title || null, used_in_slug: used_in_slug || null }, { onConflict: 'tool_id,keyword' })
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `✅ 사용 처리: [${group}] ${keyword} → "${used_in_title}" (${nowIso.slice(0, 10)})` }] }
    })

    server.registerTool('suggest_feature', {
      title: '새 각도/주제 제안 기록',
      description: '특정 시리즈+카테고리에서 새로운 글 각도나 주제를 제안하고 싶을 때 기록한다.',
      inputSchema: {
        series: z.enum(SERIES_CODES), category: z.string(), feature_name: z.string(),
        keyword: z.string().optional(), pc: z.number().optional(), mobile: z.number().optional(), total: z.number().optional(), competition: z.string().optional(),
        notes: z.string(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    }, async ({ series, category, feature_name, keyword, pc, mobile, total, competition, notes }) => {
      const row = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), series, category, feature_name, keyword: keyword || null, pc: pc || null, mobile: mobile || null, total: total || null, competition: competition || null, notes, status: 'proposed', created_at: new Date().toISOString() }
      const { error } = await supabase.from('blog_feature_ideas').insert([row])
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `💡 제안 기록됨: [${series}/${category}] ${feature_name}` }] }
    })

    server.registerTool('get_feature_ideas', {
      title: '각도/주제 제안 목록 조회',
      description: 'suggest_feature로 기록해둔 제안들을 조회한다.',
      inputSchema: { series: z.enum(SERIES_CODES).optional(), category: z.string().optional(), status: z.enum(['proposed', 'building', 'done', 'rejected']).optional() },
    }, async ({ series, category, status }) => {
      let q = supabase.from('blog_feature_ideas').select('*').order('created_at', { ascending: false })
      if (series) q = q.eq('series', series)
      if (category) q = q.ilike('category', `%${category}%`)
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      if (!data || !data.length) return { content: [{ type: 'text', text: '기록된 제안 없음' }] }
      const lines = [`💡 제안 목록 (${data.length}건):`]
      data.forEach(f => lines.push(`- [${f.series}/${f.category}/${f.status}] ${f.feature_name}${f.keyword ? ' (키워드: ' + f.keyword + ')' : ''}\n  └ ${f.notes}`))
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })

    server.registerTool('add_publish_log', {
      title: '블로그 발행 기록 추가',
      description: '새로 작성한 글을 발행 기록에 남긴다. create_blog_post 직후 호출한다.',
      inputSchema: {
        series: z.enum(SERIES_CODES), category: z.string(), angle: z.string(), title: z.string(), slug: z.string(),
        memo: z.string().optional(), target_keyword: z.string().optional(),
        search_pc: z.number().optional(), search_mobile: z.number().optional(), search_total: z.number().optional(), competition: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    }, async ({ series, category, angle, title, slug, memo, target_keyword, search_pc, search_mobile, search_total, competition }) => {
      const row = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), series, category, angle, title, slug, memo: memo || null, target_keyword: target_keyword || null, search_pc: search_pc ?? null, search_mobile: search_mobile ?? null, search_total: search_total ?? null, competition: competition || null, published_at: null, created_at: new Date().toISOString() }
      const { error } = await supabase.from('blog_content_log').insert([row])
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `✅ 발행 기록 추가됨: [${series}/${category}] ${title}` }] }
    })

    server.registerTool('create_blog_post', {
      title: '블로그 글 실제 발행',
      description: '작성한 글 본문을 blog_posts 테이블에 발행한다. 기본 status는 published(즉시 공개).',
      inputSchema: {
        title: z.string(), slug: z.string(), summary: z.string().optional(), content: z.string(),
        category: z.string(), tags: z.array(z.string()).optional(), cover_image: z.string().optional(),
        status: z.enum(['published', 'draft', 'scheduled']).optional(), scheduled_at: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    }, async ({ title, slug, summary, content, category, tags, cover_image, status, scheduled_at }) => {
      const finalStatus = status || 'published'
      const nowIso = new Date().toISOString()
      const row = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), type: 'blog', title, slug, summary: summary || null, content, category, tags: Array.isArray(tags) ? tags : [], cover_image: cover_image || null, author: null, status: finalStatus, scheduled_at: finalStatus === 'scheduled' ? (scheduled_at || null) : null, published_at: finalStatus === 'published' ? nowIso : null, created_at: nowIso, updated_at: nowIso }
      const { error } = await supabase.from('blog_posts').insert([row])
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: finalStatus === 'published' ? `✅ 발행 완료 — https://afterschoolrollbook.kr/blog/${slug}` : `✅ ${finalStatus === 'draft' ? '임시저장' : '예약'} 완료` }] }
    })

    server.registerTool('get_series_info', {
      title: '시리즈/카테고리 정보 조회',
      description: '등록된 시리즈 및 카테고리의 최신 설명을 조회한다. STEP 1에서 get_publish_log와 함께 호출한다.',
      inputSchema: { series_id: z.string().optional() },
    }, async ({ series_id }) => {
      const defaults = Object.entries(SERIES).map(([id, desc]) => `- [${id}] ${desc}`)
      let q = supabase.from('blog_series_info').select('*').order('series_id')
      if (series_id) q = q.eq('series_id', series_id)
      const { data, error } = await q
      if (error || !data || !data.length) return { content: [{ type: 'text', text: `기본 시리즈 구조:\n${defaults.join('\n')}` }] }
      const lines = data.map(t => `- [${t.series_id}] ${t.name || ''}: ${t.description} · 갱신일 ${t.updated_at}`)
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    })

    server.registerTool('update_series_info', {
      title: '시리즈/카테고리 정보 갱신',
      description: '시리즈 또는 카테고리 설명을 갱신한다. 사용자가 직접 정정해준 내용만 반영한다.',
      inputSchema: { series_id: z.string(), description: z.string(), name: z.string().optional() },
      annotations: { destructiveHint: false, idempotentHint: true },
    }, async ({ series_id, description, name }) => {
      const row = { series_id, description, updated_at: new Date().toISOString() }
      if (name) row.name = name
      const { error } = await supabase.from('blog_series_info').upsert(row, { onConflict: 'series_id' })
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `✅ [${series_id}] 정보 갱신됨` }] }
    })

  },
  {},
  { basePath: '/api', maxDuration: 30, verboseLogs: true }
)

// ── 공유 비밀키 보호 (카드뉴스와 동일한 방식) ─────────────────────────
async function authedHandler(request) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (!process.env.MCP_SHARED_SECRET || key !== process.env.MCP_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: '인증 필요 (key 파라미터 확인)' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return baseHandler(request)
}

export { authedHandler as GET, authedHandler as POST }
