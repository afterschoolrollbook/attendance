import { parseMarkdown, markdownPreviewStyles } from '../lib/parseMarkdown.js'
import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'
import { getBoardPermLevel } from '../constants/permissions.js'

function getBlogWriteMinLevel()     { return getBoardPermLevel('blog', 'write') }
function getBlogNoticeMinLevel()    { return getBoardPermLevel('notice', 'write') }
function getDocsWriteMinLevel()     { return getBoardPermLevel('docs', 'write') }
function getTemplateWriteMinLevel() { return getBoardPermLevel('template', 'write') }

const DEFAULT_BLOG_CATS = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']
const DOCS_CATEGORIES = ['시작하기', '출석부', '교구 관리', '학생 관리', '수업 관리', '리포트', '설정', '기타']
const TEMPLATE_CATEGORIES = ['출석부 양식', '가정통신문', '수업 계획서', '교구 관리표', '학생 평가표', '수업료 안내', '기타 서식']

const previewStyles = markdownPreviewStyles + `
  .md-preview h1 { font-size:22px;font-weight:800;margin:20px 0 10px;color:#111827; }
  .md-preview h2 { font-size:18px;font-weight:700;margin:16px 0 8px;color:#1f2937;border-bottom:2px solid #f3f4f6;padding-bottom:6px; }
  .md-preview h3 { font-size:16px;font-weight:700;margin:14px 0 6px;color:#374151; }
  .md-preview p  { margin:10px 0;line-height:1.8;color:#374151; }
  .md-preview ul,ol { padding-left:22px;margin:10px 0; }
  .md-preview li { margin:5px 0;line-height:1.7; }
  .md-preview strong { font-weight:700;color:#111827; }
  .md-preview code { background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace;color:#e11d48; }
  .md-preview pre { background:#1f2937;color:#f9fafb;padding:14px 18px;border-radius:8px;overflow-x:auto;margin:14px 0; }
  .md-preview pre code { background:none;color:inherit;padding:0; }
  .md-preview blockquote { border-left:4px solid #f97316;padding:8px 14px;background:#fff7ed;margin:14px 0;border-radius:0 6px 6px 0;color:#92400e;font-style:italic; }
  .md-preview a { color:#f97316;text-decoration:underline; }
  .md-preview hr { border:none;border-top:2px solid #f3f4f6;margin:20px 0; }
  .md-preview img { max-width:100%;border-radius:8px;margin:6px 0; }
`

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', background:'#fff' }

function slugify(text) {
  if (!text) return ''
  let result = text.trim().toLowerCase()
  const hasKorean = /[가-힣]/.test(result)
  if (hasKorean) {
    // 영문 단어가 섞여 있으면 영문 부분만 추출
    const engParts = result.match(/[a-z0-9]+/g)
    if (engParts && engParts.join('').length >= 2) {
      result = engParts.join('-')
    } else {
      // 한글만 있는 경우: 타임스탬프 기반 슬러그
      result = 'post-' + Date.now().toString(36)
    }
  }
  return result.replace(/[^a-z0-9-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
}

const emptyForm = () => ({
  type: 'blog', title:'', slug:'', summary:'', content:'', category:'', tags:'',
  coverImage:'', author:'관리자', status:'draft', publishedAt: new Date().toISOString().slice(0,10),
  scheduledAt: '', templateFile:'', templateDesc:'',
})

const C = { primary:'#f97316', border:'#e5e7eb', muted:'#6b7280', text:'#111827', card:'#fff' }

export function BlogAdmin({ user }) {
  const userLevel = user?.level || 1
  const isAdmin = user?.role === 'admin' || userLevel >= 10
  const blogWriteMinLevel = getBlogWriteMinLevel()
  const blogNoticeMinLevel = getBlogNoticeMinLevel()
  const docsWriteMinLevel = getDocsWriteMinLevel()
  const templateWriteMinLevel = getTemplateWriteMinLevel()
  const canWrite = isAdmin || userLevel >= blogWriteMinLevel
  const canWriteNotice = isAdmin || userLevel >= blogNoticeMinLevel
  const canWriteDocs = isAdmin || userLevel >= docsWriteMinLevel
  const canWriteTemplate = isAdmin || userLevel >= templateWriteMinLevel

  const [posts, setPosts] = useState([])
  const [view, setView] = useState('list')
  const [form, setForm] = useState(emptyForm())
  const [editId, setEditId] = useState(null)
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [myPostsOnly, setMyPostsOnly] = useState(false)
  const [blogCategories, setBlogCategories] = useState(DEFAULT_BLOG_CATS)
  const [activeToolPanel, setActiveToolPanel] = useState(null)
  const [showRoutine, setShowRoutine] = useState(false)
  const [routineChecks, setRoutineChecks] = useState({})
  const [checklistChecks, setChecklistChecks] = useState({})

  const getWeekKey = () => {
    const now = new Date()
    const year = now.getFullYear()
    const start = new Date(year, 0, 1)
    const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)
    return `${year}-W${week}`
  }
  const getMonthKey = () => {
    const now = new Date()
    return `${now.getFullYear()}-M${now.getMonth() + 1}`
  }

  const loadChecklistChecks = async () => {
    try {
      const rows = await dbCall('getAll', 'routineChecks')
      const map = {}
      ;(rows || []).forEach(r => {
        if (r.period_key === 'checklist') {
          map[r.routine_key] = true
        }
      })
      setChecklistChecks(map)
    } catch(e) { console.warn('체크리스트 로딩 실패', e) }
  }

  const toggleChecklistItem = async (panelKey, sectionIdx, itemIdx) => {
    const key = `${panelKey}__${sectionIdx}__${itemIdx}`
    const isChecked = !!checklistChecks[key]
    setChecklistChecks(v => ({ ...v, [key]: !isChecked }))
    try {
      if (isChecked) {
        const rows = await dbCall('getAll', 'routineChecks')
        const found = (rows || []).find(r => r.period_key === 'checklist' && r.routine_key === key)
        if (found) await dbCall('delete', 'routineChecks', { id: found.id })
      } else {
        await dbCall('upsert', 'routineChecks', { data: {
          id: `checklist__${key}`,
          period_key: 'checklist',
          routine_key: key,
          user_id: null,
          checked_at: new Date().toISOString(),
        }})
      }
    } catch(e) { console.warn('체크리스트 저장 실패', e) }
  }

  const loadRoutineChecks = async () => {
    try {
      const rows = await dbCall('getAll', 'routineChecks')
      const weekKey = getWeekKey()
      const monthKey = getMonthKey()
      const map = {}
      ;(rows || []).forEach(r => {
        if (r.period_key === weekKey || r.period_key === monthKey || r.period_key === 'publish') {
          map[`${r.period_key}__${r.routine_key}`] = true
        }
      })
      setRoutineChecks(map)
    } catch(e) { console.warn('루틴 체크 로딩 실패', e) }
  }

  const toggleRoutineCheck = async (periodKey, routineKey) => {
    const mapKey = `${periodKey}__${routineKey}`
    const isChecked = !!routineChecks[mapKey]
    setRoutineChecks(v => ({ ...v, [mapKey]: !isChecked }))
    try {
      if (isChecked) {
        const rows = await dbCall('getAll', 'routineChecks')
        const found = (rows || []).find(r => r.period_key === periodKey && r.routine_key === routineKey)
        if (found) await dbCall('delete', 'routineChecks', { id: found.id })
      } else {
        await dbCall('insert', 'routineChecks', { data: {
          id: `${periodKey}__${routineKey}__${user?.id || 'admin'}`,
          period_key: periodKey,
          routine_key: routineKey,
          user_id: user?.id || null,
          checked_at: new Date().toISOString(),
        }})
      }
    } catch(e) { console.warn('루틴 체크 저장 실패', e) }
  }
  const { success, error } = useToast()

  // state 선언 이후에 blogCategories 참조
  const filteredBlogCategories = blogCategories.filter(c =>
    canWriteNotice ? true : (c !== '공지사항' && c !== '업데이트')
  )

  useEffect(() => { loadPosts(); loadCategories(); loadRoutineChecks(); loadChecklistChecks() }, [])

  const loadCategories = async () => {
    try {
      const rows = await dbCall('getAll', 'customCategories')
      const custom = (rows || []).filter(c => c.type === 'blog').map(c => c.name)
      setBlogCategories([...DEFAULT_BLOG_CATS, ...custom.filter(n => !DEFAULT_BLOG_CATS.includes(n))])
    } catch (e) { console.warn('[BlogAdmin] 카테고리 로딩 실패:', e) }
  }

  const loadPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      setPosts((rows||[]).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch { error('불러오기 실패') }
  }

  const handleNew = (type = 'blog') => {
    setForm({ ...emptyForm(), type })
    setEditId(null); setPreview(false); setView('edit')
  }

  const handleEdit = (post) => {
    setForm({
      type: post.type || 'blog',
      title: post.title||'', slug: post.slug||'', summary: post.summary||'',
      content: post.content||'', category: post.category||'',
      tags: (post.tags||[]).join(', '), coverImage: post.coverImage||'',
      author: post.author||'관리자', status: post.status||'draft',
      publishedAt: post.publishedAt ? post.publishedAt.slice(0,10) : new Date().toISOString().slice(0,10),
      scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0,16) : '',
      templateFile: post.templateFile||'', templateDesc: post.templateDesc||'',
    })
    setEditId(post.id); setPreview(false); setView('edit')
  }

  const handleDelete = async (post) => {
    if (!window.confirm(`"${post.title}" 을(를) 삭제하시겠습니까?`)) return
    try {
      await dbCall('delete', 'blogPosts', { id: post.id })
      success('삭제되었습니다.')
      loadPosts()
    } catch { error('삭제 실패') }
  }

  const pingIndexNow = async (slug, type) => {
    try {
      const key = '9dcc9754863220877605a3ee2763022a'
      const domain = 'www.afterschoolrollbook.kr'
      const urlPath = type === 'docs' ? `docs/${slug}` : `blog/${slug}`
      const pageUrl = `https://${domain}/${urlPath}`
      const res = await fetch(`https://api.indexnow.org/indexnow?url=${encodeURIComponent(pageUrl)}&key=${key}`, { method: 'GET' })
      console.log('[IndexNow] 핑 전송 완료:', pageUrl, res.status)
      return true
    } catch(e) {
      console.warn('[IndexNow] 핑 실패:', e)
      return false
    }
  }

  const handleSave = async (status) => {
    if (!form.title.trim()) { error('제목을 입력해주세요'); return }
    if (!form.content.trim()) { error('내용을 입력해주세요'); return }
    if (status === 'scheduled') {
      if (!form.scheduledAt) { error('예약 날짜/시간을 입력해주세요'); return }
      const scheduledTime = new Date(form.scheduledAt)
      if (scheduledTime <= new Date()) { error('예약 시간은 현재 시간 이후여야 합니다'); return }
    }
    setLoading(true)
    try {
      const slug = form.slug.trim() || slugify(form.title)
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      const finalStatus = status || form.status
      const basePayload = {
        id: editId || uid(),
        type: form.type,
        title: form.title.trim(), slug, summary: form.summary.trim(),
        content: form.content, category: form.category, tags,
        coverImage: form.coverImage.trim(), author: form.author.trim(),
        authorId: user?.id || null,
        status: finalStatus,
        publishedAt: finalStatus==='published' ? (form.publishedAt ? new Date(form.publishedAt).toISOString() : now()) : null,
        scheduledAt: finalStatus==='scheduled' ? new Date(form.scheduledAt).toISOString() : null,
        updatedAt: now(),
        templateFile: form.type==='template' ? form.templateFile.trim() : undefined,
        templateDesc: form.type==='template' ? form.templateDesc.trim() : undefined,
      }
      const payload = editId ? basePayload : { ...basePayload, createdAt: now() }
      if (editId) await dbCall('update', 'blogPosts', { id: editId, patch: payload })
      else await dbCall('insert', 'blogPosts', { data: payload })
      if (finalStatus === 'published') {
        const pinged = await pingIndexNow(slug, form.type)
        success(`발행되었습니다! 🎉 ${pinged ? '· 🔔 IndexNow 핑 전송 완료' : '· ⚠️ IndexNow 핑 실패'}`)
      } else {
        success(finalStatus==='scheduled' ? `⏰ 예약발행이 설정되었습니다!` : '임시저장되었습니다.')
      }
      loadPosts(); setView('list')
    } catch (e) { error('저장 실패: ' + e.message) }
    setLoading(false)
  }

  const filteredPosts = posts.filter(p => {
    const typeMatch = filterType === 'all' || (p.type||'blog') === filterType
    const authorMatch = !myPostsOnly || p.authorId === (user?.id)
    return typeMatch && authorMatch
  })
  const categories = form.type === 'docs' ? DOCS_CATEGORIES : form.type === 'template' ? TEMPLATE_CATEGORIES : filteredBlogCategories

  // ── 목록 뷰
  if (view === 'list') return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      <style>{previewStyles}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text }}>📝 블로그 · 설명서 관리</h1>
          <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>블로그 글과 사용 설명서를 작성하고 관리하세요.</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <a href="/blog" target="_blank" rel="noopener noreferrer" title="발행된 블로그 페이지를 새 탭으로 봅니다"
            onClick={() => {
              // 새 탭에서도 로그인 유지: sessionStorage 토큰을 localStorage로 복사
              try {
                const key = Object.keys(sessionStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                if (key) localStorage.setItem(key, sessionStorage.getItem(key))
              } catch(e) {}
            }}
            style={{ padding:'9px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:C.card, color:C.muted, fontSize:'13px', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
            🌐 블로그 보기
          </a>
          <a href="/docs" target="_blank" rel="noopener noreferrer" title="발행된 설명서 페이지를 새 탭으로 봅니다"
            onClick={() => {
              // 새 탭에서도 로그인 유지: sessionStorage 토큰을 localStorage로 복사
              try {
                const key = Object.keys(sessionStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                if (key) localStorage.setItem(key, sessionStorage.getItem(key))
              } catch(e) {}
            }}
            style={{ padding:'9px 16px', borderRadius:'9px', border:`1.5px solid #bfdbfe`, background:'#eff6ff', color:'#3b82f6', fontSize:'13px', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
            📖 설명서 보기
          </a>
          {canWrite && <>
          <button onClick={() => handleNew('blog')} title="블로그 글을 새로 작성합니다"
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 블로그 글
          </button>
          {canWriteDocs && <button onClick={() => handleNew('docs')} title={`사용 설명서를 새로 작성합니다 (Lv.${docsWriteMinLevel} 이상)`}
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 설명서
          </button>}
          {canWriteTemplate && <button onClick={() => handleNew('template')} title={`템플릿을 새로 등록합니다 (Lv.${templateWriteMinLevel} 이상)`}
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:'#7c3aed', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 템플릿
          </button>}
          </>}
          {!canWrite && (
            <div style={{ fontSize:'13px', color:'#9ca3af', padding:'9px 12px', borderRadius:'9px', background:'#f9fafb', border:'1.5px solid #e5e7eb' }}>
              🔒 Lv.{blogWriteMinLevel} 이상 글 작성 가능 (현재 Lv.{userLevel})
            </div>
          )}
        </div>
      </div>

      {/* 외부 도구 빠른 링크 + 체크리스트 패널 */}
      {isAdmin && (() => {
        const TOOL_PANELS = {
          adsense: {
            label: '💰 애드센스', color: '#d97706', border: '#fbbf24', bg: '#fffbeb', activeBg: '#fef3c7',
            link: 'https://www.google.com/adsense',
            linkLabel: '애드센스 대시보드 열기 →',
            sections: [
              {
                title: '🚀 최초 셋팅 (한 번만)',
                color: '#92400e', bg: '#fef3c7', border: '#fde68a',
                items: [
                  { done: false, text: '사이트 URL 등록 및 소유권 확인', desc: '애드센스 가입 후 내 사이트 주소를 등록하고, <head>에 메타태그 삽입' },
                  { done: false, text: 'ads.txt 파일 루트에 업로드', desc: 'google.com, pub-XXXXXXX, DIRECT, f08c47fec0942fa0 형식으로 /ads.txt 생성' },
                  { done: false, text: '자동 광고 ON 또는 광고 단위 수동 생성', desc: '자동 광고는 구글이 최적 위치 자동 배치 / 수동은 원하는 위치에 직접 코드 삽입' },
                  { done: false, text: '광고 코드를 <head> 또는 본문에 삽입', desc: 'Next.js라면 _document.js 또는 Script 컴포넌트 활용' },
                ]
              },
              {
                title: '📋 주기적으로 확인할 것',
                color: '#78350f', bg: '#fff7ed', border: '#fed7aa',
                items: [
                  { done: false, text: '[주간] 수익 및 RPM(페이지 1000회당 수익) 확인', desc: '대시보드 → 보고서에서 날짜별 수익 추이 체크' },
                  { done: false, text: '[수시] 정책 위반 경고 확인', desc: '알림 탭에 빨간 경고 뜨면 즉시 조치 — 방치 시 광고 중단' },
                  { done: false, text: '[월간] 잘 클릭되는 광고 위치 파악', desc: '본문 상단·목차 아래·본문 중간이 일반적으로 CTR 높음' },
                  { done: false, text: '[월간] 모바일 광고 노출 확인', desc: '반응형 광고 단위 사용 여부 체크 — 모바일 트래픽 비중이 높을수록 중요' },
                ]
              }
            ]
          },
          searchconsole: {
            label: '🔍 서치콘솔', color: '#16a34a', border: '#86efac', bg: '#f0fdf4', activeBg: '#dcfce7',
            link: 'https://search.google.com/search-console',
            linkLabel: 'Search Console 열기 →',
            sections: [
              {
                title: '🚀 최초 셋팅 (한 번만)',
                color: '#14532d', bg: '#dcfce7', border: '#86efac',
                items: [
                  { done: false, text: '속성 추가 및 소유권 인증', desc: 'URL 접두사 방식 권장 — HTML 파일 업로드 또는 <head> 메타태그 삽입' },
                  { done: true, text: 'sitemap.xml 제출 완료', desc: '설정 → Sitemaps → sitemap.xml 제출 완료 ✅' },
                  { done: false, text: 'robots.txt 확인', desc: '크롤링 차단 규칙이 없는지 확인 — Disallow: / 이면 검색 노출 불가' },
                  { done: false, text: 'Google Analytics 연결', desc: '설정 → 연결 → Analytics 연동하면 트래픽 데이터 통합 확인 가능' },
                ]
              },
              {
                title: '📋 주기적으로 확인할 것',
                color: '#166534', bg: '#f0fdf4', border: '#bbf7d0',
                items: [
                  { done: false, text: '[월간] 색인 생성 현황 확인', desc: '색인 생성 → 페이지 → "색인이 생성되지 않은 이유" 파악 및 조치' },
                  { done: false, text: '[월간] 검색 성과 (클릭수·노출수·CTR) 확인', desc: '어떤 키워드로 유입되는지 확인 — CTR 낮은 글은 제목/메타설명 수정 검토' },
                  { done: false, text: '[글 발행 시] 새 글 발행 후 URL 즉시 검사 요청', desc: 'URL 검사 → 색인 생성 요청 — 구글이 빠르게 크롤링하도록 유도' },
                  { done: false, text: '[분기] 모바일 사용성 오류 확인', desc: '경험 → 모바일 사용성 — 터치 요소 간격·뷰포트 설정 등 오류 수정' },
                  { done: false, text: '[분기] Core Web Vitals 점수 확인', desc: 'LCP·INP·CLS 점수 — 낮으면 이미지 최적화·레이아웃 안정성 개선 필요' },
                  { done: true, text: '🤖 [매일 자동] 사이트맵 URL 자동 색인 요청', desc: 'GitHub Actions로 매일 오전 9시(KST) 자동 실행 — Indexing API로 전체 URL 색인 요청 ✅' },
                ]
              }
            ]
          },
          analytics: {
            label: '📊 애널리틱스', color: '#2563eb', border: '#93c5fd', bg: '#eff6ff', activeBg: '#dbeafe',
            link: 'https://analytics.google.com',
            linkLabel: 'Google Analytics 열기 →',
            sections: [
              {
                title: '🚀 최초 셋팅 (한 번만)',
                color: '#1e3a8a', bg: '#dbeafe', border: '#93c5fd',
                items: [
                  { done: true, text: 'GA4 속성 생성 및 데이터 스트림 추가 완료', desc: '관리 → 속성 만들기 → 웹 스트림 추가 → 측정 ID(G-XXXXXXXX) 발급 ✅' },
                  { done: false, text: '측정 ID를 사이트 <head>에 삽입', desc: 'Next.js라면 _app.js 또는 Script 컴포넌트로 gtag.js 로드' },
                  { done: false, text: 'Search Console 연결', desc: 'GA4 관리 → 속성 → Search Console 링크 → 연결하면 키워드 데이터 통합' },
                  { done: false, text: '내부 트래픽(내 IP) 필터 설정', desc: '관리 → 데이터 필터 → 내부 트래픽 정의 — 내가 접속한 기록이 통계에 잡히지 않도록' },
                  { done: false, text: '목표/전환 이벤트 설정', desc: '뉴스레터 구독, 문의하기 클릭 등 중요 액션을 전환으로 표시' },
                  { done: true, text: '주간/월간 리포트 이메일 자동 발송 설정 완료', desc: 'GA4 → 리포트 → 공유 → 이메일 예약 전송 설정 완료 ✅' },
                ]
              },
              {
                title: '📋 주기적으로 확인할 것',
                color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
                items: [
                  { done: false, text: '[수시] 실시간 사용자 수 확인', desc: '새 글 발행 직후 트래픽 반응 체크 — SNS 공유 효과 즉시 확인 가능' },
                  { done: false, text: '[주간] 유입 채널별 트래픽 분석', desc: '획득 → 트래픽 획득 — 검색/직접/SNS/추천 비율 파악' },
                  { done: false, text: '[주간] 인기 페이지 TOP 10 확인', desc: '참여 → 페이지 및 화면 — 어떤 글이 잘 읽히는지 파악해서 유사 글 작성' },
                  { done: false, text: '[월간] 이탈률·평균 참여 시간 확인', desc: '참여 시간이 짧으면 콘텐츠 도입부 개선 필요 / 이탈률 높으면 내부 링크 강화' },
                  { done: false, text: '[월간] 기기별·지역별 접속 현황', desc: '모바일 비율이 높으면 모바일 UX를 우선 최적화' },
                  { done: true, text: '🤖 [자동] 주간/월간 리포트 이메일 수신 중', desc: 'GA4 이메일 예약 전송으로 자동 발송 중 ✅' },
                ]
              }
            ]
          },
          ogtag: {
            label: '🔗 OG태그', color: '#7c3aed', border: '#ddd6fe', bg: '#faf5ff', activeBg: '#ede9fe',
            link: 'https://developers.facebook.com/tools/debug/',
            linkLabel: 'OG 태그 검사기 →',
            sections: [
              {
                title: '🚀 최초 셋팅 (한 번만)',
                color: '#5b21b6', bg: '#ede9fe', border: '#ddd6fe',
                items: [
                  { done: false, text: 'index.html에 og:title 추가', desc: '<meta property="og:title" content="방과후 출석부 — 스마트 출석 관리" />' },
                  { done: false, text: 'og:description 추가 (80~160자)', desc: '<meta property="og:description" content="방과후 강사를 위한 스마트 출석 관리 서비스..." />' },
                  { done: false, text: 'og:image 추가 (1200x630px 권장)', desc: '<meta property="og:image" content="https://내도메인/og-image.png" /> — SNS 공유 시 표시되는 썸네일' },
                  { done: false, text: 'og:url / og:type / og:site_name 추가', desc: 'og:type은 website, og:url은 정확한 페이지 URL, og:site_name은 사이트명' },
                  { done: false, text: 'Twitter Card 태그 추가', desc: '<meta name="twitter:card" content="summary_large_image" /> 등 트위터/X 공유용 태그' },
                  { done: false, text: '블로그 글 페이지에도 동적 OG 태그 적용', desc: '각 블로그 글 제목/요약/커버이미지가 OG 태그로 출력되는지 확인' },
                ]
              },
              {
                title: '📋 주기적으로 확인할 것',
                color: '#4c1d95', bg: '#faf5ff', border: '#e9d5ff',
                items: [
                  { done: false, text: 'Facebook 공유 디버거로 OG 태그 확인', desc: 'developers.facebook.com/tools/debug — 캐시 새로고침도 여기서 가능' },
                  { done: false, text: '카카오톡 공유 미리보기 확인', desc: '카카오톡에서 링크 공유 시 썸네일·제목이 제대로 나오는지 테스트' },
                  { done: false, text: 'og:image 사이즈 및 깨짐 확인', desc: '1200x630px 유지, 용량 8MB 이하, HTTPS URL 사용 필수' },
                ]
              }
            ]
          },
          seo: {
            label: '🚀 SEO', color: '#0891b2', border: '#a5f3fc', bg: '#ecfeff', activeBg: '#cffafe',
            link: 'https://search.google.com/search-console',
            linkLabel: '서치콘솔 열기 →',
            sections: [
              {
                title: '🏗️ 기술적 SEO (사이트 구조)',
                color: '#0e7490', bg: '#cffafe', border: '#a5f3fc',
                items: [
                  { done: false, text: 'sitemap.xml 자동 생성 및 제출', desc: '새 글 발행 시 sitemap이 자동 갱신되는지 확인 — 서치콘솔에 제출 완료' },
                  { done: false, text: 'robots.txt 정상 설정 확인', desc: '/admin, /dashboard 등 앱 내부 페이지는 Disallow, 블로그/docs는 Allow' },
                  { done: false, text: 'canonical URL 태그 삽입', desc: '각 블로그 글 페이지에 <link rel="canonical"> 태그로 중복 페이지 문제 방지' },
                  { done: false, text: 'HTTPS 적용 확인', desc: 'HTTP 접속 시 자동으로 HTTPS 리다이렉트 되는지 확인' },
                  { done: false, text: '모바일 반응형 확인', desc: '구글은 모바일 우선 색인 — 모바일에서 레이아웃 깨짐 없는지 점검' },
                  { done: false, text: 'Core Web Vitals 점수 확인', desc: '서치콘솔 → 경험 → Core Web Vitals — LCP·INP·CLS 점수 확인 및 개선' },
                ]
              },
              {
                title: '✍️ 글 작성 시 매번 체크',
                color: '#155e75', bg: '#ecfeff', border: '#a5f3fc',
                items: [
                  { done: false, text: '핵심 키워드를 제목(H1)에 포함', desc: '검색자가 실제로 치는 단어를 제목 앞쪽에 배치 — 예: "방과후 출석부 관리 방법"' },
                  { done: false, text: '메타 description 작성 (80~160자)', desc: '검색결과에 표시되는 요약문 — 키워드 포함 + 클릭 유도 문구로 CTR 향상' },
                  { done: false, text: 'URL 슬러그를 짧고 명확하게', desc: '한글 금지, 영문 소문자+하이픈 사용 — 예: /blog/attendance-management-tips' },
                  { done: false, text: 'H2·H3 소제목으로 콘텐츠 구조화', desc: '목차 역할 + 구글이 콘텐츠 구조를 파악하는 데 도움 — 키워드 자연스럽게 포함' },
                  { done: false, text: '이미지 alt 텍스트 입력', desc: '모든 이미지에 alt="설명" 추가 — 이미지 검색 유입 + 접근성 향상' },
                  { done: false, text: '내부 링크 2~3개 이상 삽입', desc: '관련 글로 연결 — 체류 시간 증가 + 구글 크롤러가 사이트 구조 파악 가능' },
                  { done: false, text: '발행 후 서치콘솔에서 URL 색인 요청', desc: 'URL 검사 → 색인 생성 요청 — 발행 즉시 구글에 알리기' },
                ]
              }
            ]
          },
          searchreg: {
            label: '🌐 검색엔진 등록', color: '#059669', border: '#6ee7b7', bg: '#ecfdf5', activeBg: '#d1fae5',
            link: 'https://searchadvisor.naver.com',
            linkLabel: '네이버 서치어드바이저 →',
            sections: [
              {
                title: '✅ 이미 완료',
                color: '#065f46', bg: '#d1fae5', border: '#6ee7b7',
                items: [
                  { done: true, text: '구글 서치콘솔 등록 완료', desc: '소유권 인증 ✅ · sitemap 제출 ✅ · GA4 연결 ✅' },
                ]
              },
              {
                title: '✅ 필수 등록 완료',
                color: '#065f46', bg: '#d1fae5', border: '#6ee7b7',
                items: [
                  { done: true, text: '네이버 서치어드바이저 등록 완료', desc: '소유권 인증 ✅ · sitemap 제출 완료 ✅' },
                  { done: true, text: '빙 웹마스터 도구 등록 완료', desc: '구글 서치콘솔에서 수입 · sitemap 자동 연동 완료 ✅' },
                ]
              },
              {
                title: '✅ 선택 등록 완료',
                color: '#065f46', bg: '#d1fae5', border: '#6ee7b7',
                items: [
                  { done: true, text: '다음(카카오) 검색 등록 완료', desc: '사이트 등록 신청 완료 ✅' },
                  { done: true, text: '줌(ZUM) 등록 완료', desc: '구글·다음 등록 시 자동 수집 ✅ (별도 등록 불필요)' },
                  { done: true, text: '얀덱스 웹마스터 등록 완료', desc: '소유권 인증 ✅ · sitemap 제출 완료 ✅' },
                ]
              },
              {
                title: '📋 등록 후 공통 해야 할 것',
                color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
                items: [
                  { done: true, text: '각 검색엔진에 sitemap.xml 제출 완료', desc: '구글·네이버·빙·얀덱스 모두 제출 완료 ✅' },
                  { done: true, text: '소유권 인증 메타태그 index.html에 추가 완료', desc: '구글·네이버·얀덱스 인증 메타태그 삽입 완료 ✅' },
                  { done: false, text: 'IndexNow 키 파일 확인', desc: 'public/9dcc9754863220877605a3ee2763022a.txt 파일 배포됐는지 브라우저에서 직접 확인' },
                ]
              }
            ]
          }
        }

        const panel = activeToolPanel ? TOOL_PANELS[activeToolPanel] : null

        return (
          <div style={{ marginBottom:'16px' }}>
            {/* 탭 버튼 바 */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', padding:'10px 14px', background:'#f9fafb', borderRadius: panel ? '10px 10px 0 0' : '10px', border:'1.5px solid #e5e7eb', borderBottom: panel ? 'none' : '1.5px solid #e5e7eb' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af', marginRight:'4px', whiteSpace:'nowrap' }}>🔧 관리 도구</span>
              {Object.entries(TOOL_PANELS).map(([key, t]) => {
                const isActive = activeToolPanel === key
                return (
                  <button key={key}
                    onClick={() => setActiveToolPanel(isActive ? null : key)}
                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'7px', border:`1.5px solid ${t.border}`, background: isActive ? t.activeBg : t.bg, color: t.color, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', boxShadow: isActive ? `0 0 0 2px ${t.border}` : 'none', transition:'all .15s' }}>
                    {t.label} {isActive ? '▲' : '▼'}
                  </button>
                )
              })}
            </div>

            {/* 체크리스트 패널 */}
            {panel && (
              <div style={{ background:'#fff', border:`1.5px solid #e5e7eb`, borderTop:`3px solid ${panel.border}`, borderRadius:'0 0 12px 12px', padding:'20px 22px' }}>
                {/* 헤더 */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
                  <div>
                    <span style={{ fontSize:'16px', fontWeight:800, color: panel.color }}>{panel.label} 필수 체크리스트</span>
                    <p style={{ fontSize:'12px', color:'#9ca3af', marginTop:'3px' }}>아래 항목을 하나씩 확인하고 셋팅하세요.</p>
                  </div>
                  <a href={panel.link} target="_blank" rel="noopener noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'8px', background: panel.color, color:'#fff', fontSize:'12px', fontWeight:700, textDecoration:'none' }}>
                    {panel.linkLabel}
                  </a>
                </div>

                {/* 섹션별 체크리스트 */}
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  {panel.sections.map((sec, si) => (
                    <div key={si} style={{ background: sec.bg, border:`1.5px solid ${sec.border}`, borderRadius:'10px', padding:'14px 16px' }}>
                      <div style={{ fontSize:'13px', fontWeight:800, color: sec.color, marginBottom:'10px' }}>{sec.title}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                        {sec.items.map((item, ii) => {
                          const ck = `${activeToolPanel}__${si}__${ii}`
                          const isAuto = item.text.startsWith('🤖') // 🤖로 시작하는 항목만 자동완료 (클릭 불가)
                          const isChecked = isAuto || item.done || !!checklistChecks[ck]
                          return (
                            <div key={ii}
                              onClick={() => !isAuto && toggleChecklistItem(activeToolPanel, si, ii)}
                              style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:'rgba(255,255,255,0.7)', borderRadius:'8px', padding:'10px 12px', cursor: isAuto ? 'default' : 'pointer', opacity: isChecked ? 0.75 : 1, transition:'all .15s' }}>
                              <span style={{ fontSize:'18px', flexShrink:0, marginTop:'0px', color: isChecked ? '#16a34a' : '#9ca3af' }}>
                                {isChecked ? '☑' : '☐'}
                              </span>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:'13px', fontWeight:700, color: isChecked ? '#6b7280' : '#111827', marginBottom:'3px', textDecoration: isChecked && !isAuto ? 'line-through' : 'none' }}>{item.text}</div>
                                <div style={{ fontSize:'12px', color:'#6b7280', lineHeight:1.6 }}>{item.desc}</div>
                              </div>
                              {isAuto && <span style={{ fontSize:'11px', color:'#16a34a', fontWeight:700, flexShrink:0, marginTop:'2px' }}>자동완료</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* 루틴 달력 */}
      {isAdmin && (() => {
        const ROUTINES = {
          publish: {
            label: '📝 글 발행할 때마다',
            color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe',
            items: [
              { text: '서치콘솔 URL 색인 요청', link: 'https://search.google.com/search-console', desc: 'URL 검사 → 색인 생성 요청' },
              { text: 'IndexNow 핑 전송 확인', link: null, desc: '글 발행 시 자동 전송됨 — 발행 후 토스트 메시지에서 확인' },
              { text: '실시간 트래픽 확인', link: 'https://analytics.google.com', desc: '발행 후 GA4 실시간 탭 확인' },
              { text: 'OG태그 디버거 확인', link: 'https://developers.facebook.com/tools/debug/', desc: '페이스북 공유 미리보기 테스트' },
            ]
          },
          weekly: {
            label: '📅 매주 토요일 확인',
            color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc',
            items: [
              { text: '애드센스 수익/RPM 확인', link: 'https://www.google.com/adsense', desc: '보고서 → 날짜별 수익 추이' },
              { text: '애드센스 정책 위반 경고 확인', link: 'https://www.google.com/adsense', desc: '알림 탭 빨간 경고 확인' },
              { text: '서치콘솔 검색 성과 확인', link: 'https://search.google.com/search-console', desc: '클릭수·노출수·CTR 키워드 분석' },
              { text: 'GA4 인기 페이지 TOP 10', link: 'https://analytics.google.com', desc: '참여 → 페이지 및 화면' },
              { text: 'GA4 유입 채널별 분석', link: 'https://analytics.google.com', desc: '획득 → 트래픽 획득' },
            ]
          },
          monthly: {
            label: '🗓️ 매월 마지막 토요일 확인',
            color: '#d97706', bg: '#fffbeb', border: '#fde68a',
            items: [
              { text: '애드센스 광고 위치 CTR 분석', link: 'https://www.google.com/adsense', desc: '어떤 위치 광고가 잘 클릭되는지 파악' },
              { text: '애드센스 모바일 광고 노출 확인', link: 'https://www.google.com/adsense', desc: '반응형 광고 단위 정상 작동 여부' },
              { text: '서치콘솔 색인 현황 확인', link: 'https://search.google.com/search-console', desc: '색인 안 된 페이지 원인 파악' },
              { text: '서치콘솔 모바일 사용성 오류', link: 'https://search.google.com/search-console', desc: '경험 → 모바일 사용성' },
              { text: 'Core Web Vitals 점수 확인', link: 'https://search.google.com/search-console', desc: 'LCP·INP·CLS 점수 개선' },
              { text: 'GA4 이탈률·참여 시간 확인', link: 'https://analytics.google.com', desc: '참여 시간 짧은 글 도입부 개선' },
              { text: 'GA4 기기별·지역별 접속 현황', link: 'https://analytics.google.com', desc: '모바일 비율 높으면 UX 우선 최적화' },
              { text: 'CTR 낮은 글 제목/메타설명 개선', link: 'https://search.google.com/search-console', desc: '성과 → CTR 낮은 페이지 찾아 수정' },
              { text: '오래된 글 콘텐츠 업데이트', link: null, desc: '6개월~1년 된 글 최신 정보로 갱신 후 재색인 요청' },
            ]
          }
        }

        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth()
        const today = now.getDate()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const monthName = `${year}년 ${month + 1}월`

        // 매주 토요일 날짜들
        const saturdays = []
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(year, month, d).getDay() === 6) saturdays.push(d)
        }
        // 마지막 토요일
        const lastSaturday = saturdays[saturdays.length - 1]

        return (
          <div style={{ marginBottom:'16px' }}>
            <button onClick={() => setShowRoutine(v => !v)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#f9fafb', borderRadius: showRoutine ? '10px 10px 0 0' : '10px', border:'1.5px solid #e5e7eb', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>📆 루틴 체크리스트 — {monthName}</span>
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>{showRoutine ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>

            {showRoutine && (
              <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderTop:'none', borderRadius:'0 0 12px 12px', padding:'20px' }}>

                {/* 달력 */}
                <div style={{ marginBottom:'20px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', textAlign:'center' }}>
                    {['일','월','화','수','목','금','토'].map(d => (
                      <div key={d} style={{ fontSize:'11px', fontWeight:700, color:'#9ca3af', padding:'4px 0' }}>{d}</div>
                    ))}
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`}/>)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1
                      const isToday = d === today
                      const isSaturday = new Date(year, month, d).getDay() === 6
                      const isLastSaturday = d === lastSaturday
                      const isWeekly = isSaturday && !isLastSaturday
                      const isMonthly = isLastSaturday
                      const hasMark = isWeekly || isMonthly
                      return (
                        <div key={d} style={{ padding:'6px 2px', borderRadius:'6px', background: isToday ? '#f97316' : isMonthly ? '#fffbeb' : isWeekly ? '#ecfeff' : 'transparent', border: hasMark && !isToday ? `1px solid ${isMonthly ? '#fde68a' : '#a5f3fc'}` : 'none', position:'relative' }}>
                          <div style={{ fontSize:'12px', fontWeight: isToday ? 700 : 400, color: isToday ? '#fff' : '#374151' }}>{d}</div>
                          {isMonthly && !isToday && <div style={{ fontSize:'8px', color:'#d97706', lineHeight:1 }}>월간</div>}
                          {isWeekly && !isToday && <div style={{ fontSize:'8px', color:'#0891b2', lineHeight:1 }}>주간</div>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'11px', color:'#0891b2' }}>🔵 주간 체크 (매주 토요일)</span>
                    <span style={{ fontSize:'11px', color:'#d97706' }}>🟡 월간 체크 (마지막 토요일)</span>
                    <span style={{ fontSize:'11px', color:'#f97316' }}>🟠 오늘</span>
                  </div>
                </div>

                {/* 루틴 섹션들 */}
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  {Object.entries(ROUTINES).map(([key, r]) => {
                    const periodKey = key === 'publish' ? 'publish' : key === 'weekly' ? getWeekKey() : getMonthKey()
                    return (
                    <div key={key} style={{ background: r.bg, border:`1.5px solid ${r.border}`, borderRadius:'10px', padding:'14px 16px' }}>
                      <div style={{ fontSize:'13px', fontWeight:800, color: r.color, marginBottom:'10px' }}>{r.label}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                        {r.items.map((item, ii) => {
                          const mapKey = `${periodKey}__${ii}`
                          const checked = !!routineChecks[mapKey]
                          return (
                          <div key={ii} onClick={() => toggleRoutineCheck(periodKey, String(ii))}
                            style={{ display:'flex', gap:'10px', alignItems:'flex-start', background: checked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.7)', borderRadius:'8px', padding:'10px 12px', cursor:'pointer', opacity: checked ? 0.75 : 1, transition:'all .15s' }}>
                            <span style={{ fontSize:'16px', flexShrink:0, marginTop:'1px' }}>{checked ? '☑' : '☐'}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'13px', fontWeight:700, color:'#111827', marginBottom:'3px', textDecoration: checked ? 'line-through' : 'none' }}>{item.text}</div>
                              <div style={{ fontSize:'12px', color:'#6b7280', lineHeight:1.6 }}>{item.desc}</div>
                            </div>
                            {item.link && (
                              <a href={item.link} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize:'11px', fontWeight:700, color: r.color, background:'rgba(255,255,255,0.9)', border:`1px solid ${r.border}`, borderRadius:'6px', padding:'3px 8px', textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
                                바로가기
                              </a>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'20px' }}>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {[['all','전체'],['blog','블로그'],['docs','설명서'],['template','📋 템플릿']].map(([key,label]) => (
            <button key={key} onClick={() => setFilterType(key)}
              style={{ padding:'6px 16px', borderRadius:'8px', border:`1.5px solid ${filterType===key?(key==='template'?'#7c3aed':C.primary):C.border}`, background:filterType===key?(key==='template'?'#f5f3ff':'#fff7ed'):C.card, color:filterType===key?(key==='template'?'#7c3aed':C.primary):C.muted, fontSize:'13px', fontWeight:filterType===key?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              {label} {key==='all'?posts.length:posts.filter(p=>(p.type||'blog')===key).length}
            </button>
          ))}
        </div>
        {user && (
          <button onClick={() => setMyPostsOnly(v => !v)}
            style={{ padding:'6px 16px', borderRadius:'8px', border:`1.5px solid ${myPostsOnly?'#059669':'#e5e7eb'}`, background:myPostsOnly?'#ecfdf5':'#fff', color:myPostsOnly?'#059669':'#6b7280', fontSize:'13px', fontWeight:myPostsOnly?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', gap:'6px' }}>
            {myPostsOnly ? '✅ 내 글만 보는 중' : '👤 내 글만 보기'}
          </button>
        )}
      </div>

      {/* 글 목록 */}
      {filteredPosts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>📝</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>아직 작성된 글이 없습니다</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filteredPosts.map(post => (
            <div key={post.id} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'4px', padding:'2px 8px', background:(post.type||'blog')==='docs'?'#eff6ff':(post.type||'blog')==='template'?'#f5f3ff':'#fff7ed', color:(post.type||'blog')==='docs'?'#3b82f6':(post.type||'blog')==='template'?'#7c3aed':'#f97316', border:`1px solid ${(post.type||'blog')==='docs'?'#bfdbfe':(post.type||'blog')==='template'?'#ddd6fe':'#fed7aa'}` }}>
                    {(post.type||'blog')==='docs'?'📖 설명서':(post.type||'blog')==='template'?'📋 템플릿':'📝 블로그'}
                  </span>
                  <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'2px 10px', background:post.status==='published'?'#f0fdf4':post.status==='scheduled'?'#eff6ff':'#f9fafb', color:post.status==='published'?'#16a34a':post.status==='scheduled'?'#3b82f6':'#9ca3af', border:`1px solid ${post.status==='published'?'#86efac':post.status==='scheduled'?'#bfdbfe':'#e5e7eb'}` }}>
                    {post.status==='published'?'✅ 발행':post.status==='scheduled'?'🕐 예약':'📝 임시'}
                  </span>
                  {post.category && <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', borderRadius:'4px', padding:'2px 8px' }}>{post.category}</span>}
                </div>
                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'3px' }}>{post.title}</div>
                <div style={{ fontSize:'12px', color:C.muted }}>
                  {post.status==='scheduled' && post.scheduledAt
                    ? `⏰ ${new Date(post.scheduledAt).toLocaleString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} 예약`
                    : post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '날짜 없음'}
                  {post.slug && <span style={{ marginLeft:'8px', opacity:.6 }}>/{post.type==='docs'?'docs':'blog'}/{post.slug}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                {post.status==='published' && (
                  <a href={`/${post.type==='docs'?'docs':'blog'}/${post.slug||post.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>보기</a>
                )}
                {(() => {
                  const type = post.type || 'blog'
                  const canEditThis = type === 'docs' ? canWriteDocs : type === 'template' ? canWriteTemplate : canWrite
                  return canEditThis && <>
                    <button onClick={() => handleEdit(post)}
                      style={{ padding:'6px 14px', borderRadius:'7px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                    <button onClick={() => handleDelete(post)}
                      style={{ padding:'6px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  </>
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── 편집 뷰
  const typeColor = form.type === 'docs' ? '#3b82f6' : C.primary
  return (
    <div style={{ padding:'24px', maxWidth:'1600px' }}>
      <style>{previewStyles}</style>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        <button onClick={() => setView('list')}
          style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록</button>
        <h1 style={{ fontSize:'20px', fontWeight:700, color:C.text, flex:1 }}>
          {editId ? '글 수정' : (form.type==='docs'?'📖 설명서 작성':'📝 블로그 글 작성')}
        </h1>
        <button onClick={() => setPreview(v => !v)}
          style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:preview?'#f3f4f6':C.card, color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {preview ? '✏️ 편집' : '👁 미리보기'}
        </button>
        <button onClick={() => handleSave('draft')} disabled={loading}
          style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:C.card, color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          임시저장
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:'8px', padding:'4px 10px' }}>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={e => setForm(v => ({ ...v, scheduledAt: e.target.value }))}
            min={new Date(Date.now() + 60000).toISOString().slice(0,16)}
            style={{ border:'none', background:'transparent', fontSize:'12px', color:'#3b82f6', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}
          />
          <button onClick={() => handleSave('scheduled')} disabled={loading}
            style={{ padding:'5px 12px', borderRadius:'6px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            ⏰ 예약발행
          </button>
        </div>
        <button onClick={() => handleSave('published')} disabled={loading}
          style={{ padding:'7px 20px', borderRadius:'8px', border:'none', background:typeColor, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {loading ? '저장 중...' : '🚀 발행'}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:preview?'1fr 1.2fr':'1fr', gap:'24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* 타입 선택 */}
          {!editId && (
            <div style={{ display:'flex', gap:'8px' }}>
              {[['blog','📝 블로그 글',C.primary,canWrite],['docs','📖 사용 설명서','#3b82f6',canWriteDocs],['template','📋 템플릿','#7c3aed',canWriteTemplate]].filter(([,,,allowed]) => allowed).map(([key,label,color]) => (
                <button key={key} onClick={() => setForm(v => ({ ...v, type:key, category:'' }))}
                  style={{ flex:1, padding:'10px', borderRadius:'9px', border:`2px solid ${form.type===key?color:C.border}`, background:form.type===key?`${color}10`:C.card, color:form.type===key?color:C.muted, fontSize:'14px', fontWeight:form.type===key?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* 제목 */}
          <input value={form.title} onChange={e => setForm(v => ({ ...v, title:e.target.value, slug:v.slug||slugify(e.target.value) }))}
            placeholder="제목을 입력하세요"
            style={{ ...iStyle, fontSize:'18px', fontWeight:700, padding:'12px 14px' }} />

          {/* slug / 카테고리 / 발행일 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>URL 슬러그</label>
              <input value={form.slug} onChange={e => setForm(v => ({ ...v, slug:e.target.value }))} placeholder="url-slug" style={iStyle} />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>카테고리</label>
              <select value={form.category} onChange={e => setForm(v => ({ ...v, category:e.target.value }))} style={{ ...iStyle, background:'#fff' }}>
                <option value="">카테고리 선택</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>발행일</label>
              <input type="date" value={form.publishedAt} onChange={e => setForm(v => ({ ...v, publishedAt:e.target.value }))} style={iStyle} />
            </div>
          </div>

          {/* 요약 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>요약 (SEO description)</label>
            <textarea value={form.summary} onChange={e => setForm(v => ({ ...v, summary:e.target.value }))} rows={2}
              placeholder="검색엔진에 표시될 요약 문구"
              style={{ ...iStyle, resize:'vertical' }} maxLength={200} />
          </div>

          {/* 커버 이미지 — 블로그만 */}
          {form.type === 'blog' && (
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>커버 이미지 URL</label>
              <input value={form.coverImage} onChange={e => setForm(v => ({ ...v, coverImage:e.target.value }))} placeholder="https://..." style={iStyle} />
            </div>
          )}

          {/* 템플릿 전용 필드 */}
          {form.type === 'template' && (
            <>
              <div style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#7c3aed', marginBottom:'12px' }}>📋 템플릿 파일 정보</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>파일 다운로드 URL (구글 드라이브, Dropbox 등)</label>
                    <input value={form.templateFile} onChange={e => setForm(v => ({ ...v, templateFile:e.target.value }))} placeholder="https://drive.google.com/..." style={iStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>파일 설명 (형식, 용도 등)</label>
                    <input value={form.templateDesc} onChange={e => setForm(v => ({ ...v, templateDesc:e.target.value }))} placeholder="예: 엑셀(.xlsx) | A4 출석부 양식 | 수정 가능" style={iStyle} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>미리보기 이미지 URL</label>
                <input value={form.coverImage} onChange={e => setForm(v => ({ ...v, coverImage:e.target.value }))} placeholder="https://... (템플릿 미리보기 이미지)" style={iStyle} />
              </div>
            </>
          )}

          {/* 태그 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>태그 (쉼표로 구분)</label>
            <input value={form.tags} onChange={e => setForm(v => ({ ...v, tags:e.target.value }))} placeholder="출석관리, 방과후, 로봇교육" style={iStyle} />
          </div>

          {/* 본문 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>
              본문 (마크다운)
              {form.type==='docs' && <span style={{ marginLeft:'8px', fontWeight:400, color:'#9ca3af' }}>— ## 소제목으로 목차 구성 권장</span>}
            </label>
            <textarea value={form.content} onChange={e => setForm(v => ({ ...v, content:e.target.value }))} rows={24}
              placeholder={form.type==='docs'
                ? `# 기능 제목\n\n기능에 대한 설명을 입력하세요.\n\n## 사용 방법\n\n1. 첫 번째 단계\n2. 두 번째 단계\n\n## 주의 사항\n\n- 항목 1\n- 항목 2`
                : `# 제목\n\n본문을 마크다운으로 작성하세요.\n\n## 소제목\n\n- 항목 1\n- 항목 2\n\n**굵게** *기울임* \`코드\``
              }
              style={{ ...iStyle, resize:'vertical', fontFamily:'monospace', fontSize:'13px', lineHeight:1.7 }} />
          </div>
        </div>

        {/* 미리보기 */}
        {preview && (
          <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'28px', overflowY:'auto', maxHeight:'90vh', position:'sticky', top:'24px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>미리보기</div>
            {form.coverImage && form.type==='blog' && <img src={form.coverImage} alt="" style={{ width:'100%', height:'160px', objectFit:'cover', borderRadius:'10px', marginBottom:'20px' }} />}
            {form.category && (
              <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'3px 10px', marginBottom:'12px', display:'inline-block', background:form.type==='docs'?'#eff6ff':'#fff7ed', color:form.type==='docs'?'#3b82f6':C.primary, border:`1px solid ${form.type==='docs'?'#bfdbfe':'#fed7aa'}` }}>
                {form.category}
              </span>
            )}
            <h1 style={{ fontSize:'22px', fontWeight:800, color:C.text, marginTop:'10px', marginBottom:'16px', lineHeight:1.4 }}>{form.title || '제목 없음'}</h1>
            {form.summary && (
              <div style={{ background:form.type==='docs'?'#eff6ff':'#fff7ed', border:`1px solid ${form.type==='docs'?'#bfdbfe':'#fed7aa'}`, borderRadius:'8px', padding:'12px 16px', marginBottom:'20px', fontSize:'14px', color:form.type==='docs'?'#1e40af':'#92400e', lineHeight:1.7 }}>
                {form.summary}
              </div>
            )}
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMarkdown(form.content) }} />
          </div>
        )}
      </div>
    </div>
  )
}
