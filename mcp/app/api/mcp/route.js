// app/api/mcp/route.js
//
// 방과후 출석부 블로그 자동화용 MCP(Model Context Protocol) 서버.
// Vercel 공식 mcp-handler 패키지로 Streamable HTTP 프로토콜을 구현합니다.
// Claude(연결된 커넥터)가 이 툴들을 직접 호출해서 "오늘 블로그 글" 글감을
// 사람 개입 없이 스스로 판단할 수 있게 하는 것이 목적입니다.
//
// 노출 툴 28개 (2026-07-18: upload_image 신설 — 로컬 이미지 파일(base64)을 blog-images 버킷에
// 관리자 토큰 없이 업로드(capture_screenshot과 동일 버킷·서비스롤 재사용).
// 2026-07-17: append_system_prompt 신설 — fresh-season MCP 서버에서 1:1 이식.
// 2026-07-16: naver_news_search 신설 — fresh-season MCP 서버에서 1:1 이식.
// capture_screenshot 신설 — fresh-season MCP 서버에서 1:1 이식.
// 2026-07-15: update_blog_post 신설 + create_blog_post에 제목/SEO 점수
// 디테일·네이버요약·인스타카드뉴스 필드 추가 — fresh-season 최신 파이프라인 이식):
//   - get_publish_log      : 발행 기록 조회 (중복 방지 + 키워드 추적, STEP 1에서 가장 먼저 호출)
//   - get_keyword_data     : 과목/역량 그룹별 찜한 키워드 + TOP 키워드 조회
//   - search_keyword_data  : keyword_stats 전체를 그룹 구분 없이 검색 (황금키워드 탐색)
//   - naver_keyword_volume : 특정 키워드의 실시간 네이버 검색량 조회. hint(카테고리명)를 함께 주면
//                             조회 즉시 blog_keyword_stats에 자동 저장됨(fresh-season 방식과 1:1 통일,
//                             2026-07-21 — 예전엔 조회만 하고 save_keyword_data를 따로 안 불러서
//                             blog_keyword_stats가 항상 비어있던 문제 수정)
//   - naver_news_search    : 네이버 뉴스 검색 오픈API로 기사 제목/링크/발행일/요약 조회 (web_search 대체, 토큰 절약)
//   - save_keyword_data    : naver_keyword_volume 조회 결과를 TOP 키워드 캐시에 저장 (hint 없이 조회했거나
//                             결과를 나중에 골라서 저장하고 싶을 때 쓰는 수동 백업 경로 — 평소엔 위 자동저장으로 충분)
//   - pick_keyword         : 나중에 쓸 키워드를 찜(bookmark)해두기
//   - search_keyword_picks : 찜해둔 키워드 검색/열람, 기본은 미사용만
//   - mark_keyword_used    : 찜 키워드를 글에 실제로 썼을 때 사용 처리
//   - suggest_feature      : 새 각도/주제 제안을 검토 메모와 함께 기록
//   - get_feature_ideas    : suggest_feature로 기록해둔 제안 목록 조회
//   - add_publish_log      : 글 작성 후 발행 기록에 자동으로 남기기
//   - create_blog_post     : 블로그 글 본문을 실제로 사이트에 발행. 제목/SEO 점수 디테일,
//                             네이버 요약, 인스타 카드뉴스도 함께 저장 가능(전부 관리자 전용).
//                             published 상태면 Google Indexing API + IndexNow 색인 요청도 시도.
//   - capture_screenshot   : 뉴스·공식 홈페이지의 그래프·차트를 헤드리스 브라우저로 실제로 캡처해서
//                             Supabase Storage(blog-images 버킷)에 저장하고 공개 URL을 반환.
//   - update_blog_post     : 발행된 글의 특정 필드만 수정(slug 기준). 재작성·점수 재채점 시 사용.
//   - get_series_info      : 시리즈/카테고리 정보 조회
//   - update_series_info   : 시리즈/카테고리 정보 갱신
//   - get_system_prompt    : 관리자 화면("클로드 지침")의 시스템 프롬프트 조회
//                             (claude/main/main2/quotes/tags/edu_methods/worry_topics/activities)
//   - update_system_prompt : 관리자 화면("클로드 지침")의 시스템 프롬프트 갱신
//   - list_github_files    : GitHub 저장소(afterschoolrollbook/attendance) 특정 경로 파일 목록 조회
//   - get_github_file      : GitHub 저장소 특정 파일 내용 조회
//   - list_tables          : Supabase DB 테이블 목록 조회
//   - get_rows              : 임의 테이블 행 조회 (필터·검색·정렬·페이징)
//   - upsert_row            : 임의 테이블 행 추가·수정
//   - delete_row            : 임의 테이블 행 삭제 (되돌릴 수 없음)
//   - run_sql               : SQL 직접 실행 (위험 DDL 자동 차단, run_sql_query RPC 필요)
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
// create table if not exists system_prompts (
//   id text primary key,          -- 'claude' | 'main' | 'main2' | 'quotes' | 'tags' | 'edu_methods' | 'worry_topics' | 'activities'
//   content text,
//   updated_at timestamptz not null default now()
// );
//
// 2026-07-15 추가 — blog_posts에 제목/SEO 점수 디테일 + 백링크 콘텐츠 컬럼(fresh-season 이식):
// alter table blog_posts add column if not exists title_score integer;
// alter table blog_posts add column if not exists seo_score integer;
// alter table blog_posts add column if not exists title_score_detail jsonb;
// alter table blog_posts add column if not exists seo_score_detail jsonb;
// alter table blog_posts add column if not exists naver_summary text;
// alter table blog_posts add column if not exists instagram_cards text;
//
// 2026-07-16 추가 — capture_screenshot용 공개 스토리지 버킷(supabase/013_blog_images_bucket.sql
// 을 먼저 Supabase SQL Editor에서 실행할 것). capture_screenshot 자체는 SERVICE_ROLE 키로
// 동작하므로 RLS 정책 없이도 버킷만 있으면 캡처 업로드는 되지만, 관리자 화면(BlogWrite.jsx)의
// 수동 이미지 업로드 기능은 로그인 사용자의 anon 키로 동작하므로 그 SQL의 RLS 정책이 필요하다.
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID
//   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (선택)
//   MCP_SHARED_SECRET
//   GITHUB_TOKEN (선택)                        - list_github_files/get_github_file 툴의 GitHub API
//                                                 호출 제한(시간당 60회)을 늘려줌, 없어도 동작함
//   GOOGLE_SERVICE_ACCOUNT_JSON (선택)         - create_blog_post의 Google Indexing API 색인 요청.
//                                                 없으면 색인 요청은 조용히 실패하고 발행 자체는 정상 진행됨.
//   INDEXNOW_KEY (선택)                        - create_blog_post의 IndexNow(Bing·Naver·Yandex) 색인 요청.
//                                                 없으면 "skipped"로 표시되고 발행 자체는 정상 진행됨.
//   (capture_screenshot은 추가 환경변수 불필요 — @sparticuz/chromium-min이 실행 시점에
//    자체적으로 크로미움 바이너리를 내려받는다. package.json의 @sparticuz/chromium-min
//    버전(현재 ^131.0.1)과 아래 코드의 하드코딩된 pack.tar 버전(v131.0.1)은 반드시 일치해야
//    하며, 버전을 올릴 땐 둘 다 같이 바꿔야 한다.)
//
// list_tables/run_sql 완전 동작을 위한 Postgres RPC (선택, 없으면 일부 기능만 제한):
// ⚠️ 임의 SQL을 실행할 수 있는 함수라 위험도가 높다 — 필요할 때만 생성할 것.
//
// create or replace function run_sql_query(sql text)
// returns jsonb
// language plpgsql
// security definer
// as $$
// declare
//   result jsonb;
// begin
//   execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', sql) into result;
//   return result;
// end;
// $$;
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
// GITHUB_REPO는 여기 파일 최상단(모듈 스코프)에서 선언한다 — 아래 콜백 내부의
// server.registerTool 도구 설명과, 콜백 바깥 두 번째 인자인 instructions 객체
// 양쪽 모두에서 참조하기 때문에, 콜백 안에 선언하면 instructions 쪽에서
// ReferenceError가 난다.
const GITHUB_REPO = 'afterschoolrollbook/attendance'
const SITE_ORIGIN = 'https://afterschoolrollbook.kr'

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
      description: '네이버 검색광고 키워드도구로 키워드별 월간 검색량(PC/모바일)과 경쟁도를 실시간 조회한다. hint(카테고리명)를 함께 주면 조회 결과가 blog_keyword_stats에 자동 저장된다(save_keyword_data를 별도로 부르지 않아도 됨 — fresh-season의 "조회=저장" 방식과 동일).',
      inputSchema: {
        hintKeywords: z.string().describe('쉼표로 구분된 키워드, 최대 5개. 예: "초등집중력,방과후바둑,바둑수업효과"'),
        hint: z.string().describe('과목/역량 카테고리명 (예: 바둑, 창의력, 집중력) — get_keyword_data로 나중에 다시 불러올 때 쓰는 그룹 키'),
      },
    }, async ({ hintKeywords, hint }) => {
      const keywords = normalizeKeywords(hintKeywords)
      if (!keywords.length) return { content: [{ type: 'text', text: '키워드를 입력해주세요.' }], isError: true }
      try {
        const results = await fetchNaverKeywordData(keywords)
        let saveNote = '\n\n(저장 결과 없음 — 조회된 키워드가 없어 저장 생략)'
        if (results.length) {
          const rows = results.map(r => ({
            hint,
            keyword: r.keyword,
            pc: r.monthlySearchPc || 0,
            mobile: r.monthlySearchMobile || 0,
            total: r.monthlySearchTotal ?? ((r.monthlySearchPc || 0) + (r.monthlySearchMobile || 0)),
            competition: r.competition || '-',
            updated_at: new Date().toISOString(),
          }))
          const { error: saveErr } = await supabase.from('blog_keyword_stats').upsert(rows, { onConflict: 'hint,keyword' })
          saveNote = saveErr
            ? `\n\n⚠️ blog_keyword_stats 자동 저장 실패: ${saveErr.message}`
            : `\n\n✅ [${hint}] 키워드 ${rows.length}개 blog_keyword_stats에 자동 저장됨.`
        }
        return { content: [{ type: 'text', text: JSON.stringify({ query: keywords, results }, null, 2) + saveNote }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `오류: ${err.message}` }], isError: true }
      }
    })

    server.registerTool('naver_news_search', {
      title: '네이버 뉴스 검색',
      description: '네이버 뉴스 검색 오픈API로 기사 제목·링크·발행일·요약을 가져온다. 블로그 글의 통계·근거 인용이나 최신 이슈 벤치마킹 단계에서 web_search 대신 우선 사용한다(더 빠르고 토큰도 절약됨). naver_keyword_volume과 같은 NAVER_CLIENT_ID/SECRET을 쓴다.',
      inputSchema: {
        query: z.string().describe('검색어. 예: "초등 방과후 수업 트렌드"'),
        display: z.number().int().min(1).max(100).optional().describe('가져올 기사 개수 (기본 10, 최대 100)'),
        sort: z.enum(['sim', 'date']).optional().describe('정렬 방식: sim=정확도순(기본), date=최신순'),
      },
    }, async ({ query, display, sort }) => {
      const clientId = process.env.NAVER_CLIENT_ID
      const clientSecret = process.env.NAVER_CLIENT_SECRET
      if (!clientId || !clientSecret) {
        return { content: [{ type: 'text', text: 'NAVER_CLIENT_ID/SECRET 환경변수가 설정되어 있지 않습니다.' }], isError: true }
      }
      try {
        const params = new URLSearchParams({ query, display: String(display || 10), sort: sort || 'sim' })
        const res = await fetch(`https://openapi.naver.com/v1/search/news.json?${params.toString()}`, {
          headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { content: [{ type: 'text', text: `네이버 뉴스 API 오류 (${res.status}): ${text}` }], isError: true }
        }
        const data = await res.json()
        const items = (data.items || []).map(it => ({
          title: it.title.replace(/<\/?b>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
          link: it.originallink || it.link,
          pubDate: it.pubDate,
          description: it.description.replace(/<\/?b>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
        }))
        if (!items.length) return { content: [{ type: 'text', text: `"${query}" 검색 결과 없음` }] }
        return { content: [{ type: 'text', text: JSON.stringify({ query, total: data.total, items }, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `오류: ${err.message || '뉴스 검색 중 오류가 발생했습니다.'}` }], isError: true }
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
      description: '작성한 글 본문을 blog_posts 테이블에 발행한다. 기본 status는 published(즉시 공개). ' +
        '제목/SEO 점수 디테일, 네이버 요약, 인스타 카드뉴스도 함께 저장 가능(전부 관리자 전용, 방문자 비노출). ' +
        'published 상태면 Google Indexing API + IndexNow 색인 요청도 함께 시도한다(실패해도 발행 자체는 진행).',
      inputSchema: {
        title: z.string(), slug: z.string(), summary: z.string().optional(), content: z.string(),
        category: z.string(), tags: z.array(z.string()).optional(), cover_image: z.string().optional(),
        status: z.enum(['published', 'draft', 'scheduled']).optional(), scheduled_at: z.string().optional(),
        title_score: z.number().optional().describe('제목 점수표(10점 만점) 채점 결과. 관리자만 조회 가능.'),
        seo_score: z.number().optional().describe('SEO 체크리스트(100점 만점) 채점 결과. 관리자만 조회 가능.'),
        title_score_detail: z.array(z.object({
          label: z.string().describe('채점 항목명 (예: 키워드 포함·위치)'),
          points: z.number().describe('이 항목에서 받은 점수'),
          max: z.number().describe('이 항목의 배점'),
          reason: z.string().describe('이 점수를 준 구체적 이유'),
        })).optional().describe('제목 점수표(10점)의 항목별 배점·이유 breakdown. title_score를 줄 때 항상 함께 채운다.'),
        seo_score_detail: z.array(z.object({
          label: z.string().describe('체크리스트 항목명 (예: 키워드 밀도)'),
          points: z.number().describe('이 항목에서 받은 점수'),
          max: z.number().describe('이 항목의 배점'),
          pass: z.boolean().describe('이 항목 통과 여부'),
          desc: z.string().describe('이 점수를 준 구체적 이유'),
        })).optional().describe('SEO 체크리스트(100점)의 항목별 배점·통과여부·이유 breakdown. seo_score를 줄 때 항상 함께 채운다.'),
        naver_summary: z.string().optional().describe('네이버 블로그에 붙여넣을 요약글(300~500자 + 원문 링크). 관리자만 조회 가능.'),
        instagram_cards: z.string().optional().describe('인스타그램 카드뉴스(슬라이드 텍스트 스크립트 + 캡처용 HTML 카드 전체). 관리자만 조회 가능.'),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    }, async ({ title, slug, summary, content, category, tags, cover_image, status, scheduled_at, title_score, seo_score, title_score_detail, seo_score_detail, naver_summary, instagram_cards }) => {
      const finalStatus = status || 'published'
      const nowIso = new Date().toISOString()
      const row = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        type: 'blog', title, slug,
        summary: summary || null, content, category, tags: Array.isArray(tags) ? tags : [],
        cover_image: cover_image || null, author: null, status: finalStatus,
        scheduled_at: finalStatus === 'scheduled' ? (scheduled_at || null) : null,
        published_at: finalStatus === 'published' ? nowIso : null,
        created_at: nowIso, updated_at: nowIso,
        // 제목 점수·SEO 점수·네이버 요약글·인스타 카드뉴스 — 관리자 내부 참고용 (공개 API에서는 노출되지 않음)
        title_score: title_score ?? null,
        seo_score: seo_score ?? null,
        title_score_detail: title_score_detail ?? null,
        seo_score_detail: seo_score_detail ?? null,
        naver_summary: naver_summary ?? null,
        instagram_cards: instagram_cards ?? null,
      }
      const { error } = await supabase.from('blog_posts').insert([row])
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }

      // ── 색인 요청 (published 상태일 때만, 실패해도 발행 자체는 막지 않음) ──────────
      const indexingResult = { googleIndexing: null, indexNow: null }
      if (finalStatus === 'published') {
        const pageUrl = `${SITE_ORIGIN}/blog/${slug}`

        // 1) Google Indexing API
        try {
          const { GoogleAuth } = await import('google-auth-library')
          const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
            scopes: ['https://www.googleapis.com/auth/indexing'],
          })
          const client = await auth.getClient()
          await client.request({
            url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
            method: 'POST',
            data: { url: pageUrl, type: 'URL_UPDATED' },
          })
          indexingResult.googleIndexing = 'success'
        } catch (e) {
          indexingResult.googleIndexing = 'error: ' + e.message
        }

        // 2) IndexNow — Bing·Naver·Yandex 색인 요청
        try {
          const INDEXNOW_KEY = process.env.INDEXNOW_KEY
          if (INDEXNOW_KEY) {
            const inRes = await fetch('https://api.indexnow.org/indexnow', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                host: 'afterschoolrollbook.kr',
                key: INDEXNOW_KEY,
                keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
                urlList: [pageUrl],
              }),
            })
            indexingResult.indexNow = 'success:' + inRes.status
          } else {
            indexingResult.indexNow = 'skipped: INDEXNOW_KEY 미설정'
          }
        } catch (e) {
          indexingResult.indexNow = 'error: ' + e.message
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      const liveNote = finalStatus === 'published'
        ? `✅ 발행 완료 — ${SITE_ORIGIN}/blog/${slug}`
        : `✅ ${finalStatus === 'draft' ? '임시저장' : '예약'} 완료`

      const indexNote = finalStatus === 'published'
        ? `\n🔍 Google 색인: ${indexingResult.googleIndexing || '미실행'}\n⚡ IndexNow: ${indexingResult.indexNow || '미실행'}`
        : ''

      return { content: [{ type: 'text', text: liveNote + indexNote }] }
    })

    // ── 그래프·차트 스크린샷 캡처 (뉴스·공식 홈페이지의 통계 자료를 실제로 캡처해서 저장) ──
    // 2026-07-16: fresh-season MCP 서버(minsiljang0/Fresh_Season)에서 1:1 이식.
    // blog-images 버킷이 없으면 이 함수가 SERVICE_ROLE 권한으로 자동 생성한다(RLS 정책 불필요).
    // 단, 관리자 화면(BlogWrite.jsx)의 수동 업로드 기능은 anon 키로 동작하므로 RLS 정책이 별도로
    // 필요하다 — supabase/013_blog_images_bucket.sql 을 먼저 실행해둘 것.
    async function ensureScreenshotBucket() {
      const { data: buckets } = await supabase.storage.listBuckets()
      if (buckets?.some(b => b.name === 'blog-images')) return
      await supabase.storage.createBucket('blog-images', { public: true, fileSizeLimit: '5MB' })
    }

    server.registerTool(
      'capture_screenshot',
      {
        title: '웹페이지 그래프·차트 스크린샷 캡처 및 저장',
        description:
          '뉴스·공식 홈페이지(교육부, 한국교육개발원(KEDI), 통계청, 여성가족부 등)에 있는 그래프·차트를 헤드리스 브라우저로 실제로 캡처해서 ' +
          'Supabase Storage(blog-images 버킷)에 저장하고 공개 URL을 반환한다. selector를 주면 그 요소만 잘라서 캡처하고, ' +
          '안 주면 뷰포트 전체를 캡처한다. **이 툴은 출처 페이지에 실제 이미지 파일(<img>)이 없고 자바스크립트/캔버스로 그려지는 ' +
          '차트일 때만 쓴다 — 이미지 파일이 이미 있으면 그냥 그 URL을 직접 쓰는 게 먼저다.** 반환된 URL을 블로그 본문 <img> 태그에 ' +
          '쓰고, 바로 아래에 반드시 출처(사이트명 + 원본 링크)를 캡션으로 명시할 것 — 저작권 있는 자료를 그대로 재게시하는 것이므로 ' +
          '출처 표기 없이 쓰지 않는다.',
        inputSchema: {
          url: z.string().describe('캡처할 페이지 URL'),
          selector: z.string().optional().describe('캡처할 특정 요소의 CSS selector (예: "#chart-container", ".graph-wrap"). 안 주면 뷰포트 전체를 캡처'),
          waitMs: z.number().int().min(0).max(8000).optional().describe('페이지 로드 후 추가로 기다릴 시간(ms). 자바스크립트로 그려지는 차트가 렌더링될 시간을 줄 때 사용. 기본 1500'),
          width: z.number().int().min(320).max(1920).optional().describe('뷰포트 너비. 기본 1200'),
        },
        annotations: { destructiveHint: false },
      },
      async ({ url, selector, waitMs = 1500, width = 1200 }) => {
        let browser
        try {
          const { default: chromium } = await import('@sparticuz/chromium-min')
          const puppeteer = await import('puppeteer-core')
          // ⚠️ 이 URL의 버전(v131.0.1)은 package.json의 @sparticuz/chromium-min 버전과 반드시 일치해야 한다.
          // npm install 이후 버전이 다르면 https://github.com/Sparticuz/chromium/releases 에서 맞는 pack.tar로 교체할 것.
          const executablePath = await chromium.executablePath(
            'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
          )
          browser = await puppeteer.default.launch({
            args: chromium.args,
            executablePath,
            headless: true,
            defaultViewport: { width, height: 900 },
          })
          const page = await browser.newPage()
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
          if (waitMs) await new Promise(r => setTimeout(r, waitMs))

          let buffer
          if (selector) {
            const el = await page.$(selector)
            if (!el) throw new Error(`selector "${selector}"에 해당하는 요소를 찾을 수 없음`)
            buffer = await el.screenshot({ type: 'png' })
          } else {
            buffer = await page.screenshot({ type: 'png' })
          }
          await browser.close()
          browser = null

          await ensureScreenshotBucket()
          const path = `captures/${Date.now().toString(36)}${Math.random().toString(36).slice(2)}.png`
          const { error: upErr } = await supabase.storage.from('blog-images').upload(path, buffer, { contentType: 'image/png', upsert: false })
          if (upErr) return { content: [{ type: 'text', text: `❌ 업로드 실패: ${upErr.message}` }], isError: true }
          const { data: pub } = supabase.storage.from('blog-images').getPublicUrl(path)

          return { content: [{ type: 'text', text: `✅ 캡처 완료\nURL: ${pub.publicUrl}\n원본 페이지: ${url}\n⚠️ 본문에 쓸 때 반드시 출처(사이트명+원본 링크)를 캡션으로 함께 표기할 것.` }] }
        } catch (e) {
          if (browser) { try { await browser.close() } catch {} }
          return { content: [{ type: 'text', text: `❌ 캡처 실패: ${e.message}` }], isError: true }
        }
      }
    )

    server.registerTool(
      'upload_image',
      {
        title: '로컬 이미지 파일 업로드 (Supabase Storage)',
        description:
          '로컬 이미지 파일 내용(base64)을 Supabase Storage(blog-images 버킷, capture_screenshot과 ' +
          '동일 버킷)에 업로드하고 공개 URL을 반환한다. 사용자가 로컬 파일(실제 스크린샷, ' +
          '자료 사진 등)을 블로그 본문·커버 이미지로 쓰고 싶을 때, admin 화면을 거치지 않고 ' +
          '이 툴로 바로 업로드해서 URL을 얻는다. 별도 관리자 토큰이 필요 없다 — 이 서버가 이미 ' +
          '갖고 있는 Supabase 서비스롤 키로 처리한다. jpg/png/gif/webp만 허용, 10MB 이하.',
        inputSchema: {
          base64: z.string().describe('이미지 파일의 base64 인코딩 내용 (data URI 접두사 "data:image/...;base64," 없이 순수 base64만)'),
          contentType: z.string().describe('MIME 타입. 예: image/jpeg, image/png, image/webp, image/gif'),
          filename: z.string().optional().describe('원본 파일명 (응답 메시지 표시용, 저장 경로에는 안 쓰임)'),
        },
        annotations: { destructiveHint: false, idempotentHint: false },
      },
      async ({ base64, contentType, filename }) => {
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!ALLOWED_TYPES.includes(contentType)) {
          return { content: [{ type: 'text', text: '❌ 이미지 파일(jpg/png/gif/webp)만 업로드할 수 있습니다.' }], isError: true }
        }
        const buffer = Buffer.from(base64, 'base64')
        const MAX_MB = 10
        if (buffer.length > MAX_MB * 1024 * 1024) {
          return { content: [{ type: 'text', text: `❌ ${MAX_MB}MB 이하 파일만 업로드할 수 있습니다.` }], isError: true }
        }
        try {
          await ensureScreenshotBucket()
          const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg'
          const path = `uploads/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`
          const { error: upErr } = await supabase.storage.from('blog-images').upload(path, buffer, { contentType, upsert: false })
          if (upErr) return { content: [{ type: 'text', text: `❌ 업로드 실패: ${upErr.message}` }], isError: true }
          const { data: pub } = supabase.storage.from('blog-images').getPublicUrl(path)
          return { content: [{ type: 'text', text: `✅ 업로드 완료${filename ? ` (${filename})` : ''}
URL: ${pub.publicUrl}` }] }
        } catch (e) {
          return { content: [{ type: 'text', text: `❌ 업로드 실패: ${e.message}` }], isError: true }
        }
      }
    )

    server.registerTool('update_blog_post', {
      title: '발행된 글 수정',
      description: '발행된 블로그 글의 특정 필드를 수정한다. slug로 대상 글을 찾고, 전달된 필드만 업데이트한다 — ' +
        '넘기지 않은 필드는 기존 값 그대로 유지된다. 커버 이미지 교체, 본문·제목·태그·요약 수정, 상태 변경, ' +
        '제목/SEO 점수 재채점 등 모든 글 수정 작업에 사용한다.',
      inputSchema: {
        slug: z.string().describe('수정할 글의 URL 슬러그 (필수, 대상 글 식별자)'),
        title: z.string().optional().describe('새 제목'),
        summary: z.string().optional().describe('새 SEO 요약'),
        content: z.string().optional().describe('새 본문 마크다운 전체'),
        cover_image: z.string().optional().describe('새 커버 이미지 URL'),
        tags: z.array(z.string()).optional().describe('새 태그 배열'),
        status: z.enum(['published', 'draft']).optional().describe('글 상태 변경'),
        title_score: z.number().optional().describe('제목 점수표(10점 만점) 재채점 결과. 관리자만 조회 가능.'),
        seo_score: z.number().optional().describe('SEO 체크리스트(100점 만점) 재채점 결과. 관리자만 조회 가능.'),
        title_score_detail: z.array(z.object({
          label: z.string().describe('채점 항목명'),
          points: z.number().describe('이 항목에서 받은 점수'),
          max: z.number().describe('이 항목의 배점'),
          reason: z.string().describe('이 점수를 준 구체적 이유'),
        })).optional().describe('제목 점수표 항목별 breakdown. title_score를 줄 때 항상 함께 채운다.'),
        seo_score_detail: z.array(z.object({
          label: z.string().describe('체크리스트 항목명'),
          points: z.number().describe('이 항목에서 받은 점수'),
          max: z.number().describe('이 항목의 배점'),
          pass: z.boolean().describe('이 항목 통과 여부'),
          desc: z.string().describe('이 점수를 준 구체적 이유'),
        })).optional().describe('SEO 체크리스트 항목별 breakdown. seo_score를 줄 때 항상 함께 채운다.'),
        naver_summary: z.string().optional().describe('네이버 블로그에 붙여넣을 요약글(300~500자 + 원문 링크). 관리자만 조회 가능.'),
        instagram_cards: z.string().optional().describe('인스타그램 카드뉴스(슬라이드 텍스트 스크립트 + 캡처용 HTML 카드 전체). 관리자만 조회 가능.'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    }, async ({ slug, title, summary, content, cover_image, tags, status, title_score, seo_score, title_score_detail, seo_score_detail, naver_summary, instagram_cards }) => {
      const patch = {}
      if (title !== undefined) patch.title = title
      if (summary !== undefined) patch.summary = summary
      if (content !== undefined) patch.content = content
      if (cover_image !== undefined) patch.cover_image = cover_image
      if (tags !== undefined) patch.tags = tags
      if (status !== undefined) patch.status = status
      if (title_score !== undefined) patch.title_score = title_score
      if (seo_score !== undefined) patch.seo_score = seo_score
      if (title_score_detail !== undefined) patch.title_score_detail = title_score_detail
      if (seo_score_detail !== undefined) patch.seo_score_detail = seo_score_detail
      if (naver_summary !== undefined) patch.naver_summary = naver_summary
      if (instagram_cards !== undefined) patch.instagram_cards = instagram_cards

      if (Object.keys(patch).length === 0) {
        return { content: [{ type: 'text', text: '오류: 수정할 필드가 없습니다. title/summary/content/cover_image/tags/status/title_score/seo_score/title_score_detail/seo_score_detail/naver_summary/instagram_cards 중 하나 이상을 전달해주세요.' }], isError: true }
      }
      patch.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('blog_posts')
        .update(patch)
        .eq('slug', slug)
        .select('slug, title, status')
        .single()
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      if (!data) return { content: [{ type: 'text', text: `슬러그 '${slug}'에 해당하는 글을 찾을 수 없습니다.` }], isError: true }

      const changedFields = Object.keys(patch).filter(k => k !== 'updated_at').join(', ')
      return {
        content: [{
          type: 'text',
          text: `✅ 수정 완료\n제목: ${data.title}\nslug: ${data.slug}\n변경 필드: ${changedFields}\n라이브 URL: ${SITE_ORIGIN}/blog/${data.slug}`,
        }],
      }
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

    server.registerTool('get_system_prompt', {
      title: '클로드 시스템 프롬프트 조회',
      description: '관리자 화면("클로드 지침")에서 관리하는 시스템 프롬프트를 조회한다. 대화 시작 시 claude 탭을 가장 먼저 불러온다. claude/main/main2는 매 대화 로드, quotes/tags/edu_methods/worry_topics/activities는 글 작성 중 해당 소재가 필요할 때만 조건부로 불러온다.',
      inputSchema: { id: z.enum(['claude', 'main', 'main2', 'quotes', 'tags', 'edu_methods', 'worry_topics', 'activities', 'reference', 'rss_sources', 'todo']) },
    }, async ({ id }) => {
      const { data, error } = await supabase.from('system_prompts').select('*').eq('id', id).maybeSingle()
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      if (!data) return { content: [{ type: 'text', text: `[${id}] 아직 등록된 내용이 없습니다.` }] }
      return { content: [{ type: 'text', text: data.content || '' }] }
    })

    server.registerTool('update_system_prompt', {
      title: '클로드 시스템 프롬프트 갱신',
      description: '관리자 화면("클로드 지침")의 시스템 프롬프트 내용을 갱신한다. 사용자가 직접 요청한 경우에만 반영한다.',
      inputSchema: { id: z.enum(['claude', 'main', 'main2', 'quotes', 'tags', 'edu_methods', 'worry_topics', 'activities', 'reference', 'rss_sources', 'todo']), content: z.string() },
      annotations: { destructiveHint: false, idempotentHint: true },
    }, async ({ id, content }) => {
      const { error } = await supabase.from('system_prompts').upsert({ id, content, updated_at: new Date().toISOString() })
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `✅ [${id}] 시스템 프롬프트 갱신됨` }] }
    })

    server.registerTool('append_system_prompt', {
      title: '클로드 시스템 프롬프트 맨 아래에 추가',
      description: '관리자 화면("클로드 지침")의 시스템 프롬프트 특정 탭 맨 아래에 새 내용을 이어붙인다. update_system_prompt처럼 전체를 다시 불러와서 통째로 다시 보낼 필요 없이, 추가할 내용만 전달하면 서버가 기존 내용 뒤에 이어붙여 저장한다. main2(작업 메모장)에 새 기록 한 건을 추가할 때 update_system_prompt 대신 우선 사용한다. 문서 중간 섹션에 끼워 넣거나 기존 내용을 수정·삭제해야 할 때는 get_system_prompt로 전체를 불러온 뒤 update_system_prompt를 쓴다.',
      inputSchema: { id: z.enum(['claude', 'main', 'main2', 'quotes', 'tags', 'edu_methods', 'worry_topics', 'activities', 'reference', 'rss_sources', 'todo']), content: z.string().describe('맨 아래에 추가할 내용 (마크다운)') },
      annotations: { destructiveHint: false, idempotentHint: false },
    }, async ({ id, content }) => {
      const { data: existing, error: readErr } = await supabase.from('system_prompts').select('content').eq('id', id).maybeSingle()
      if (readErr) return { content: [{ type: 'text', text: `오류: ${readErr.message}` }], isError: true }
      const base = existing?.content || ''
      const newContent = base.replace(/\n+$/, '') + (base ? '\n\n' : '') + content.trim() + '\n'
      const { error } = await supabase.from('system_prompts').upsert({ id, content: newContent, updated_at: new Date().toISOString() })
      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }], isError: true }
      return { content: [{ type: 'text', text: `✅ [${id}] 맨 아래에 추가 완료 (추가된 글자수: ${content.trim().length.toLocaleString()}자 / 총 글자수: ${newContent.length.toLocaleString()}자)` }] }
    })

    // ── GitHub 저장소 확인 툴 (Fresh_Season MCP와 동일 구조, 저장소만 attendance로 교체) ──
    // 공개 저장소라 토큰 없이도 동작하지만(시간당 60회 제한),
    // GITHUB_TOKEN 환경변수를 등록해두면 그 제한이 훨씬 늘어난다.
    // 저장소: afterschoolrollbook/attendance (사용자 확인됨)
    // GITHUB_REPO는 파일 최상단(모듈 스코프)에서 선언돼 있음 — 아래는 그 값을 그대로 참조

    server.registerTool(
      'list_github_files',
      {
        title: 'GitHub 저장소 파일 목록 조회',
        description: `${GITHUB_REPO} 저장소의 특정 경로에 어떤 파일·폴더가 있는지 조회한다. path를 비우면 저장소 루트를 본다. GitHub에 실제로 무엇이 올라가 있는지 확인할 때 사용.`,
        inputSchema: {
          path: z.string().optional().describe('조회할 경로. 예: "src/pages" 또는 "mcp/app/api/mcp". 비우면 루트'),
          ref: z.string().optional().describe('브랜치/커밋. 기본: main'),
        },
      },
      async ({ path = '', ref = 'main' }) => {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`
        const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'attendance-mcp' }
        if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
        const res = await fetch(url, { headers })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { content: [{ type: 'text', text: `❌ GitHub API 오류 (${res.status}): ${text}` }], isError: true }
        }
        const data = await res.json()
        const list = Array.isArray(data) ? data : [data]
        const lines = list.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}${f.type === 'file' ? ` (${f.size} bytes)` : ''}`)
        return { content: [{ type: 'text', text: lines.join('\n') }] }
      }
    )

    server.registerTool(
      'get_github_file',
      {
        title: 'GitHub 저장소 파일 내용 조회',
        description: `${GITHUB_REPO} 저장소의 특정 파일 내용을 텍스트로 가져온다. list_github_files로 경로 확인 후 사용. 100KB 넘는 파일은 GitHub API 제약으로 못 가져올 수 있다.`,
        inputSchema: {
          path: z.string().describe('파일 경로. 예: "src/App.jsx"'),
          ref: z.string().optional().describe('브랜치/커밋. 기본: main'),
        },
      },
      async ({ path, ref = 'main' }) => {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`
        const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'attendance-mcp' }
        if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
        const res = await fetch(url, { headers })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { content: [{ type: 'text', text: `❌ GitHub API 오류 (${res.status}): ${text}` }], isError: true }
        }
        const data = await res.json()
        if (data.type !== 'file') return { content: [{ type: 'text', text: `❌ "${path}"는 파일이 아니라 ${data.type}입니다` }], isError: true }
        const content = Buffer.from(data.content, data.encoding || 'base64').toString('utf-8')
        return { content: [{ type: 'text', text: `[${path}] (${data.size} bytes)\n\n${content}` }] }
      }
    )

    // ── Supabase 직접 조회·수정 툴 (Fresh_Season MCP와 동일) ──────────────
    // list_tables/run_sql은 run_sql_query라는 Postgres RPC 함수가 있어야 완전히 동작한다.
    // ⚠️ 이 RPC는 임의 SQL을 실행할 수 있어 위험도가 높다 — 생성 여부는 사용자가 판단해서 결정할 것.
    //   (get_rows/upsert_row/delete_row는 이 RPC 없이도 바로 동작한다.)

    server.registerTool(
      'list_tables',
      {
        title: 'DB 테이블 목록 조회',
        description: 'list_tables — DB 테이블 목록 조회. Supabase DB에 있는 테이블 목록을 반환한다. 어떤 테이블이 있는지 모를 때 가장 먼저 호출한다.',
        inputSchema: {
          schema: z.string().optional().describe('스키마 이름. 기본값: public'),
        },
      },
      async ({ schema = 'public' }) => {
        const { data: d2, error: e2 } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', schema)
          .eq('table_type', 'BASE TABLE')
          .order('table_name')
        if (e2) {
          const { data: d3, error: e3 } = await supabase.rpc('run_sql_query', {
            sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`
          })
          if (e3) return { content: [{ type: 'text', text: `❌ ${e3.message}` }], isError: true }
          return { content: [{ type: 'text', text: JSON.stringify(d3, null, 2) }] }
        }
        const names = (d2 || []).map(r => r.table_name).join('\n')
        return { content: [{ type: 'text', text: `테이블 목록 (${schema} 스키마):\n${names}` }] }
      }
    )

    server.registerTool(
      'get_rows',
      {
        title: 'DB 테이블 데이터 조회',
        description: 'get_rows — DB 테이블 데이터 조회. 특정 테이블의 행을 조회한다. 필터·텍스트검색·정렬·페이징 지원, 최대 500행. 데이터 확인이나 수정 전 ID 조회에 사용.',
        inputSchema: {
          table:   z.string().describe('테이블 이름. 예: blog_posts, blog_keyword_stats, popups'),
          select:  z.string().optional().describe('가져올 컬럼 (쉼표 구분). 비우면 전체(*). 예: id,title,created_at'),
          filter:  z.record(z.string()).optional().describe('eq 필터. 예: {"status":"published","category":"공지사항"}'),
          search_column: z.string().optional().describe('텍스트 검색할 컬럼. search_value와 함께 사용'),
          search_value:  z.string().optional().describe('텍스트 검색어 (ilike, 부분일치)'),
          order_by: z.string().optional().describe('정렬 기준 컬럼. 기본: created_at'),
          ascending: z.boolean().optional().describe('오름차순 여부. 기본: false (최신순)'),
          limit:   z.number().int().min(1).max(500).optional().describe('가져올 행 수. 기본: 50, 최대: 500'),
          offset:  z.number().int().min(0).optional().describe('건너뛸 행 수 (페이징). 기본: 0'),
        },
      },
      async ({ table, select = '*', filter, search_column, search_value, order_by = 'created_at', ascending = false, limit = 50, offset = 0 }) => {
        let q = supabase.from(table).select(select)
        if (filter) {
          for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
        }
        if (search_column && search_value) q = q.ilike(search_column, `%${search_value}%`)
        q = q.order(order_by, { ascending }).range(offset, offset + limit - 1)
        const { data, error } = await q
        if (error) return { content: [{ type: 'text', text: `❌ ${error.message}` }], isError: true }
        if (!data?.length) return { content: [{ type: 'text', text: `(결과 없음) 테이블: ${table}` }] }
        return { content: [{ type: 'text', text: `[${table}] ${data.length}행 반환 (offset:${offset})\n${JSON.stringify(data, null, 2)}` }] }
      }
    )

    server.registerTool(
      'upsert_row',
      {
        title: 'DB 행 추가·수정',
        description: 'upsert_row — DB 행 추가·수정. 테이블에 행을 추가하거나 수정한다. id를 포함하면 수정(upsert), 없으면 새 행 추가. 수정 전 get_rows로 기존 데이터를 먼저 확인할 것.',
        inputSchema: {
          table: z.string().describe('테이블 이름. 예: blog_posts, popups'),
          row:   z.record(z.any()).describe('추가·수정할 데이터 객체. 예: {"id":"abc","title":"...","status":"draft"}'),
        },
        annotations: { destructiveHint: true },
      },
      async ({ table, row }) => {
        const { data, error } = await supabase
          .from(table)
          .upsert([row], { onConflict: 'id' })
          .select()
          .single()
        if (error) return { content: [{ type: 'text', text: `❌ ${error.message}` }], isError: true }
        return { content: [{ type: 'text', text: `✅ [${table}] upsert 완료\n${JSON.stringify(data, null, 2)}` }] }
      }
    )

    server.registerTool(
      'delete_row',
      {
        title: 'DB 행 삭제',
        description: 'delete_row — DB 행 삭제. 테이블에서 특정 id의 행을 삭제한다. 삭제 전 존재 자동 확인, 되돌릴 수 없음. 삭제 전 반드시 get_rows로 대상을 먼저 확인할 것.',
        inputSchema: {
          table: z.string().describe('테이블 이름'),
          id:    z.string().describe('삭제할 행의 id'),
        },
        annotations: { destructiveHint: true },
      },
      async ({ table, id }) => {
        const { data: existing } = await supabase.from(table).select('id').eq('id', id).maybeSingle()
        if (!existing) return { content: [{ type: 'text', text: `❌ [${table}] id="${id}" 행을 찾을 수 없음` }], isError: true }
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) return { content: [{ type: 'text', text: `❌ ${error.message}` }], isError: true }
        return { content: [{ type: 'text', text: `✅ [${table}] id="${id}" 삭제 완료` }] }
      }
    )

    server.registerTool(
      'run_sql',
      {
        title: 'SQL 직접 실행',
        description: 'run_sql — SQL 직접 실행. 복잡한 조회나 수정이 필요할 때 SQL 쿼리를 직접 실행한다. SELECT/UPDATE/DELETE 모두 가능. DROP·TRUNCATE·ALTER 등 위험 DDL은 자동 차단. run_sql_query RPC 함수가 DB에 있어야 동작한다.',
        inputSchema: {
          sql: z.string().describe('실행할 SQL 쿼리. 예: SELECT id, title FROM blog_posts WHERE status = \'draft\' ORDER BY created_at DESC LIMIT 20'),
        },
        annotations: { destructiveHint: true },
      },
      async ({ sql }) => {
        const upper = sql.trim().toUpperCase()
        const dangerous = ['DROP ', 'TRUNCATE ', 'ALTER TABLE', 'CREATE TABLE', 'GRANT ', 'REVOKE ']
        if (dangerous.some(kw => upper.startsWith(kw) || upper.includes('\n' + kw))) {
          return { content: [{ type: 'text', text: `⛔ 위험한 DDL/권한 쿼리는 차단됩니다: ${sql.slice(0, 80)}` }], isError: true }
        }
        const { data, error } = await supabase.rpc('run_sql_query', { sql })
        if (error) return { content: [{ type: 'text', text: `❌ ${error.message}\n\nSQL: ${sql}` }], isError: true }
        return { content: [{ type: 'text', text: `✅ SQL 실행 완료\n${JSON.stringify(data, null, 2)}` }] }
      }
    )

  },
  {
    instructions:
      '방과후 출석부 블로그 자동화 서버. ' +
      '블로그 글 발행/수정/발행기록/키워드 검색량/글감 아이디어/시리즈 정보/클로드 시스템 프롬프트를 관리하는 도구, ' +
      '뉴스·공식 홈페이지의 그래프·차트를 실제로 캡처해서 저장하는 도구(capture_screenshot), ' +
      'GitHub 저장소(' + GITHUB_REPO + ') 파일 확인 도구(list_github_files/get_github_file), ' +
      'Supabase DB 직접 조회·수정 도구(list_tables/get_rows/upsert_row/delete_row/run_sql)를 제공한다. ' +
      'create_blog_post/update_blog_post는 제목·SEO 점수 디테일, 네이버 요약, 인스타 카드뉴스까지 함께 저장한다. ' +
      '오늘의 블로그 글을 쓰거나 발행하거나, DB 테이블을 조회/수정할 때 이 서버의 도구를 사용한다.',
  },
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
