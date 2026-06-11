import React, { useState, useRef, useEffect } from 'react'
import { Users } from '../lib/db.js'
import { now, uid } from '../lib/utils.js'
import { sendEmail, isConfigured, dbCall, authSignIn, authUpdatePassword } from '../lib/supabase.js'
import { Btn, Input, Card, PageHeader } from '../components/Atoms.jsx'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a', danger:'#ef4444' }

// ─── 블로그 관련 유틸
const BLOG_CATEGORIES = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function sanitizeHtml(html) {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li','blockquote','code','pre','hr','a','img'],
      ALLOWED_ATTR: ['href','src','alt','target','rel'],
    })
  }
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
}

function parseMarkdown(md) {
  if (!md) return ''
  const html = md
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^---$/gm, '<hr>').replace(/^\- (.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .split('\n\n').map(p => p.trim()).filter(Boolean)
    .map(p => /^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return sanitizeHtml(html)
}

const mdPreviewStyles = `
  .md-preview h1 { font-size:20px;font-weight:800;margin:16px 0 8px;color:#111827; }
  .md-preview h2 { font-size:17px;font-weight:700;margin:14px 0 6px;color:#1f2937;border-bottom:2px solid #f3f4f6;padding-bottom:4px; }
  .md-preview h3 { font-size:15px;font-weight:700;margin:12px 0 4px;color:#374151; }
  .md-preview p  { margin:8px 0;line-height:1.8;color:#374151; }
  .md-preview ul,ol { padding-left:20px;margin:8px 0; }
  .md-preview li { margin:4px 0;line-height:1.7; }
  .md-preview strong { font-weight:700;color:#111827; }
  .md-preview em { font-style:italic; }
  .md-preview code { background:#f3f4f6;padding:2px 5px;border-radius:4px;font-size:12px;color:#e11d48; }
  .md-preview pre { background:#1f2937;color:#f9fafb;padding:12px 16px;border-radius:8px;overflow-x:auto;margin:12px 0; }
  .md-preview blockquote { border-left:4px solid #f97316;padding:6px 12px;background:#fff7ed;margin:12px 0;border-radius:0 6px 6px 0;color:#92400e;font-style:italic; }
  .md-preview a { color:#f97316;text-decoration:underline; }
  .md-preview hr { border:none;border-top:2px solid #f3f4f6;margin:16px 0; }
  .md-preview img { max-width:100%;border-radius:8px;margin:4px 0; }
`

const emptyBlogForm = (authorName) => ({
  title: '', slug: '', summary: '', content: '', category: '', tags: '',
  coverImage: '', author: authorName || '', status: 'draft',
  publishedAt: new Date().toISOString().slice(0, 10),
})

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)) }

function Msg({ data }) {
  if (!data) return null
  const ok = typeof data === 'object' ? data.ok !== false : true
  const msg = typeof data === 'object' ? data.msg : data
  return <div style={{ fontSize:'13px', padding:'8px 12px', borderRadius:'7px', background:ok?'#f0fdf4':'#fef2f2', color:ok?C.success:C.danger, border:`1px solid ${ok?'#86efac':'#fca5a5'}` }}>{ok?'✅':'⚠️'} {msg}</div>
}

const providerLabel = { google:'Google', kakao:'카카오', naver:'네이버' }

// ─── 본인 인증 모달
function VerifyModal({ user, onVerified, onClose }) {
  const isSocial = user.provider && user.provider !== 'email'

  const [pwInput,    setPwInput]    = useState('')
  const [code,       setCode]       = useState('')
  const [sentCode,   setSentCode]   = useState('')
  const [codeSent,   setCodeSent]   = useState(false)
  const [sending,    setSending]    = useState(false)
  const [devCode,    setDevCode]    = useState('')
  const [error,      setError]      = useState('')

  // 발송 대상 이메일: 소셜 로그인은 모두 저장된 이메일로 발송
  const targetEmail = user.email

  const sendCode = async () => {
    setError('')
    const c = genCode()
    setSentCode(c); setCodeSent(false); setCode(''); setSending(true); setDevCode('')
    try {
      if (isConfigured) {
        await sendEmail(targetEmail, c)
      } else {
        setDevCode(c)
      }
      setCodeSent(true)
    } catch (e) {
      setError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSending(false)
    }
  }

  const verify = async () => {
    setError('')
    if (!isSocial) {
      try {
        await authSignIn(user.email, pwInput)
        onVerified()
      } catch {
        setError('비밀번호가 올바르지 않습니다.')
      }
    } else {
      if (code.trim() !== sentCode) { setError('인증번호가 올바르지 않습니다.'); return }
      onVerified()
    }
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>

        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>🔒 본인 인증</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:C.muted, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ fontSize:'13px', color:C.muted }}>내 정보를 수정하려면 본인 확인이 필요합니다.</div>

          {/* 이메일 로그인 → 비밀번호 */}
          {!isSocial && (
            <Input
              label="현재 비밀번호"
              value={pwInput}
              onChange={setPwInput}
              type="password"
              placeholder="비밀번호 입력"
            />
          )}

          {/* 소셜 로그인 → 이메일 인증 */}
          {isSocial && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>

              {/* 카카오/구글/네이버: 저장된 이메일로 발송 */}
              <div style={{ fontSize:'13px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                📧 {providerLabel[user.provider] || '소셜'} 계정 이메일<br/>
                <strong style={{ color:C.text }}>{user.email}</strong> 으로 인증번호를 발송합니다.
              </div>

              <Btn onClick={sendCode} disabled={sending}>
                {sending ? '발송 중...' : codeSent ? '인증번호 재발송' : '인증번호 발송'}
              </Btn>

              {codeSent && (
                <>
                  {!isConfigured && devCode && (
                    <div style={{ padding:'10px 12px', background:'#fffbeb', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px' }}>
                      <div style={{ fontWeight:700, color:'#92400e', marginBottom:'4px' }}>🔧 개발 모드</div>
                      <div style={{ color:'#b45309' }}>인증번호: <strong style={{ fontSize:'20px', letterSpacing:'4px', color:C.primary }}>{devCode}</strong></div>
                    </div>
                  )}
                  {isConfigured && (
                    <div style={{ padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1.5px solid #86efac', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
                      ✅ {targetEmail} 으로 인증번호를 발송했습니다.
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'8px' }}>
                    <input
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="6자리 입력"
                      maxLength={6}
                      onKeyDown={e => e.key === 'Enter' && verify()}
                      style={{ flex:1, padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'16px', letterSpacing:'4px', textAlign:'center', outline:'none', fontFamily:'monospace' }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <div style={{ fontSize:'13px', color:C.danger, background:'#fef2f2', padding:'8px 12px', borderRadius:'7px' }}>⚠️ {error}</div>
          )}

          <div style={{ display:'flex', gap:'8px', paddingTop:'4px' }}>
            <Btn variant="ghost" onClick={onClose} style={{ flex:1 }}>취소</Btn>
            <Btn onClick={verify} style={{ flex:2 }} disabled={isSocial && !codeSent}>확인</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Profile({ user, onUserUpdate, onNav }) {
  const [verified,      setVerified]      = useState(false)
  const [showVerify,    setShowVerify]    = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const [info, setInfo] = useState({ name: user.name, email: user.email, phone: user.phone || '', nickname: user.nickname || '', displayNameMode: user.displayNameMode || 'name' })
  const [pw,   setPw]   = useState({ next: '', next2: '' })
  const [imgPreview, setImgPreview] = useState(user.verifyImg || null)
  const [imgFile,    setImgFile]    = useState(null)

  const [infoMsg,   setInfoMsg]   = useState(null)
  const [pwMsg,     setPwMsg]     = useState(null)
  const [verifyMsg, setVerifyMsg] = useState(null)

  // ── 블로그
  const [blogView,    setBlogView]    = useState('list') // 'list' | 'edit'
  const [blogPosts,   setBlogPosts]   = useState([])
  const [blogForm,    setBlogForm]    = useState(emptyBlogForm(user.name))
  const [blogEditId,  setBlogEditId]  = useState(null)
  const [blogPreview, setBlogPreview] = useState(false)
  const [blogLoading, setBlogLoading] = useState(false)
  const [blogMsg,     setBlogMsg]     = useState(null)

  const imgRef = useRef()

  // 페이지 진입 시 즉시 본인 인증 요구
  useEffect(() => { setShowVerify(true) }, [])
  useEffect(() => { if (verified) loadMyPosts() }, [verified])

  const loadMyPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const mine = (rows || []).filter(p => p.authorId === user.id || p.author === user.name)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setBlogPosts(mine)
    } catch { /* 조용히 실패 */ }
  }

  const handleBlogNew = () => {
    setBlogForm(emptyBlogForm(user.name))
    setBlogEditId(null); setBlogPreview(false); setBlogView('edit')
  }

  const handleBlogEdit = (post) => {
    setBlogForm({
      title: post.title||'', slug: post.slug||'', summary: post.summary||'',
      content: post.content||'', category: post.category||'',
      tags: (post.tags||[]).join(', '), coverImage: post.coverImage||'',
      author: post.author||user.name, status: post.status||'draft',
      publishedAt: post.publishedAt ? post.publishedAt.slice(0,10) : new Date().toISOString().slice(0,10),
    })
    setBlogEditId(post.id); setBlogPreview(false); setBlogView('edit')
  }

  const handleBlogDelete = async (post) => {
    if (!window.confirm(`"${post.title}" 을(를) 삭제하시겠습니까?`)) return
    try {
      await dbCall('delete', 'blogPosts', { id: post.id })
      loadMyPosts()
    } catch { flash(setBlogMsg, false, '삭제 실패') }
  }

  const handleBlogSave = async (status) => {
    if (!blogForm.title.trim()) { flash(setBlogMsg, false, '제목을 입력해주세요'); return }
    if (!blogForm.content.trim()) { flash(setBlogMsg, false, '내용을 입력해주세요'); return }
    setBlogLoading(true)
    try {
      const slug = blogForm.slug.trim() || slugify(blogForm.title)
      const tags = blogForm.tags ? blogForm.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      const finalStatus = status || blogForm.status
      const payload = {
        id: blogEditId || uid(),
        type: 'blog',
        title: blogForm.title.trim(), slug, summary: blogForm.summary.trim(),
        content: blogForm.content, category: blogForm.category, tags,
        coverImage: blogForm.coverImage.trim(), author: blogForm.author.trim(),
        authorId: user.id,
        status: finalStatus,
        publishedAt: finalStatus === 'published' ? (blogForm.publishedAt ? new Date(blogForm.publishedAt).toISOString() : now()) : null,
        updatedAt: now(),
        createdAt: blogEditId ? undefined : now(),
      }
      if (blogEditId) await dbCall('update', 'blogPosts', { id: blogEditId, patch: payload })
      else await dbCall('insert', 'blogPosts', payload)
      flash(setBlogMsg, true, finalStatus === 'published' ? '발행되었습니다! 🎉' : '임시저장되었습니다.')
      loadMyPosts(); setBlogView('list')
    } catch (e) { flash(setBlogMsg, false, '저장 실패: ' + e.message) }
    setBlogLoading(false)
  }

  const flash = (setter, ok, msg) => {
    setter({ ok, msg })
    setTimeout(() => setter(null), 4000)
  }

  const handleClose = () => {
    if (!verified) onNav('dashboard')
    else setShowVerify(false)
  }

  const handleVerified = () => {
    setVerified(true)
    setShowVerify(false)
    if (pendingAction) { pendingAction(); setPendingAction(null) }
  }

  const requireVerify = (action) => {
    if (verified) { action() }
    else { setPendingAction(() => action); setShowVerify(true) }
  }

  const saveInfo = () => {
    requireVerify(() => {
      if (!info.name.trim() || !info.email.trim()) { flash(setInfoMsg, false, '이름과 이메일은 필수입니다.'); return }
      const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailReg.test(info.email.trim())) { flash(setInfoMsg, false, '올바른 이메일 형식이 아닙니다.'); return }
      const dup = Users.findByEmail(info.email.trim().toLowerCase())
      if (dup && dup.id !== user.id) { flash(setInfoMsg, false, '이미 사용 중인 이메일입니다.'); return }
      const updated = Users.update(user.id, {
        name: info.name.trim(),
        email: info.email.trim().toLowerCase(),
        phone: info.phone.trim(),
        nickname: info.nickname.trim(),
        displayNameMode: info.nickname.trim() ? info.displayNameMode : 'name',
      })
      onUserUpdate(updated)
      flash(setInfoMsg, true, '정보가 저장되었습니다.')
    })
  }

  const savePw = () => {
    requireVerify(async () => {
      if (pw.next.length < 8) { flash(setPwMsg, false, '새 비밀번호는 8자 이상이어야 합니다.'); return }
      if (!/[a-zA-Z]/.test(pw.next) || !/[0-9]/.test(pw.next)) { flash(setPwMsg, false, '비밀번호는 영문과 숫자를 모두 포함해야 합니다.'); return }
      if (pw.next !== pw.next2) { flash(setPwMsg, false, '새 비밀번호가 일치하지 않습니다.'); return }
      await authUpdatePassword(pw.next)
      const updated = await Users.update(user.id, { pw: '' })
      onUserUpdate(updated)
      setPw({ next:'', next2:'' })
      flash(setPwMsg, true, '비밀번호가 변경되었습니다.')
    })
  }

  const handleImg = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setImgPreview(ev.target.result); setImgFile(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const submitVerify = () => {
    if (!imgFile && !imgPreview) { flash(setVerifyMsg, false, '수업안내장 이미지를 먼저 업로드해주세요.'); return }
    if (user.level >= 2) { flash(setVerifyMsg, true, '이미 인증 완료된 계정입니다.'); return }
    const updated = Users.update(user.id, { verifyImg: imgFile || imgPreview })
    onUserUpdate(updated)
    flash(setVerifyMsg, true, '인증 신청이 완료되었습니다. 관리자 승인 후 활성화됩니다.')
  }

  const levelColors = { 1:'#9ca3af', 2:C.primary, 3:C.success, 4:'#8b5cf6', 5:C.danger }
  const levelNames  = { 1:'Lv.1 미인증', 2:'Lv.2 인증완료', 3:'Lv.3 우수', 4:'Lv.4 파트너', 5:'Lv.5 관리자' }

  return (
    <div style={{ padding:'28px', maxWidth:'680px' }}>
      <PageHeader title="내 정보" sub="계정 정보를 확인하고 수정합니다." />

      {/* 등급 */}
      <div style={{ display:'inline-flex', alignItems:'center', gap:'10px', padding:'10px 18px', background:`${levelColors[user.level]}18`, borderRadius:'10px', border:`1.5px solid ${levelColors[user.level]}44`, marginBottom:'24px' }}>
        <span style={{ fontSize:'20px' }}>👩‍🏫</span>
        <div>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>
            {user.displayNameMode === 'nickname' && user.nickname ? user.nickname : user.name}
          </div>
          <div style={{ fontSize:'12px', fontWeight:700, color:levelColors[user.level] }}>{levelNames[user.level]}</div>
        </div>
        {verified && <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', padding:'2px 8px', borderRadius:'6px', fontWeight:600 }}>🔓 본인확인 완료</span>}
      </div>

      {/* 기본 정보 */}
      <Card style={{ marginBottom:'16px' }}>
        <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'16px' }}>📝 기본 정보</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <Input label="이름" value={info.name} onChange={v => setInfo(p=>({...p,name:v}))} placeholder="홍길동" required />

          {/* 닉네임 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'13px', fontWeight:500, color:C.text }}>
              닉네임 <span style={{ fontSize:'12px', color:C.muted, fontWeight:400 }}>(선택)</span>
            </label>
            <input
              value={info.nickname}
              onChange={e => setInfo(p=>({...p, nickname:e.target.value}))}
              placeholder="예: 푸우쌤, 수학왕쌤"
              style={{ padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}
            />
          </div>

          {/* 앱 표시이름 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <label style={{ fontSize:'13px', fontWeight:500, color:C.text }}>앱 표시 이름</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', padding:'12px 14px', background:'#f9fafb', borderRadius:'9px', border:`1.5px solid ${C.border}` }}>
              {[
                { value:'name',     label:`실명으로 표시`,                               desc: info.name || '홍길동' },
                { value:'nickname', label:`닉네임으로 표시`,                             desc: info.nickname || '닉네임을 먼저 입력해주세요', disabled: !info.nickname.trim() },
              ].map(opt => (
                <label key={opt.value} style={{ display:'flex', alignItems:'center', gap:'10px', cursor: opt.disabled ? 'not-allowed' : 'pointer', opacity: opt.disabled ? 0.45 : 1 }}>
                  <input
                    type="radio"
                    name="displayNameMode"
                    value={opt.value}
                    checked={info.displayNameMode === opt.value}
                    disabled={opt.disabled}
                    onChange={() => setInfo(p=>({...p, displayNameMode: opt.value}))}
                    style={{ accentColor: C.primary, width:'16px', height:'16px' }}
                  />
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:500, color:C.text }}>{opt.label}</div>
                    <div style={{ fontSize:'12px', color:C.muted }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ fontSize:'12px', color:C.muted }}>대시보드, 알림 등 앱 전체에서 선택한 이름으로 표시됩니다.</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'13px', fontWeight:500, color:C.text }}>이메일 (아이디)</label>
            <input type="email" value={info.email} onChange={e => setInfo(p=>({...p,email:e.target.value}))}
              style={{ padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          </div>
          <Input label="연락처" value={info.phone} onChange={v => setInfo(p=>({...p,phone:v}))} placeholder="010-0000-0000" />
          <Msg data={infoMsg} />
          <Btn onClick={saveInfo} style={{ alignSelf:'flex-end' }}>저장</Btn>
        </div>
      </Card>

      {/* 비밀번호 변경 — 소셜 로그인 사용자는 안내 표시 */}
      {user.provider && user.provider !== 'email' && (
        <Card style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'10px' }}>🔒 비밀번호</div>
          <div style={{ fontSize:'13px', color:C.muted, background:'#f9fafb', padding:'12px 14px', borderRadius:'9px', border:`1px solid ${C.border}`, lineHeight:1.8 }}>
            <strong style={{ color:C.text }}>
              { user.provider === 'google' ? 'Google' : user.provider === 'kakao' ? '카카오' : '네이버' }
            </strong> 계정으로 로그인하셨습니다.<br/>
            소셜 로그인 계정은 별도의 비밀번호를 관리하지 않습니다.<br/>
            비밀번호 변경은 해당 소셜 서비스에서 진행해주세요.
          </div>
        </Card>
      )}

      {(!user.provider || user.provider === 'email') && (
        <Card style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'16px' }}>🔒 비밀번호 변경</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <Input label="새 비밀번호 (8자 이상, 영문+숫자)" value={pw.next}  onChange={v => setPw(p=>({...p,next:v}))}  type="password" placeholder="새 비밀번호" />
            <Input label="새 비밀번호 확인"        value={pw.next2} onChange={v => setPw(p=>({...p,next2:v}))} type="password" placeholder="재입력" />
            <Msg data={pwMsg} />
            <Btn onClick={savePw} style={{ alignSelf:'flex-end' }}>변경</Btn>
          </div>
        </Card>
      )}

      {/* 선생님 인증 */}
      {user.role === 'teacher' && (
        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>🏫 선생님 인증</div>
            {user.level >= 2
              ? <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'6px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac' }}>인증완료</span>
              : user.verifyImg
                ? <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'6px', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a' }}>승인 대기중</span>
                : <span style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'6px', background:'#f9fafb', color:'#9ca3af' }}>미인증</span>
            }
          </div>
          <div style={{ fontSize:'13px', color:C.muted, lineHeight:1.7, marginBottom:'16px' }}>
            방과후 수업안내장 이미지를 업로드하면 관리자 승인 후 <strong>Lv.2 인증</strong>이 완료됩니다.
          </div>
          <div style={{ display:'flex', gap:'16px', alignItems:'flex-start', flexWrap:'wrap' }}>
            <button onClick={() => imgRef.current?.click()} disabled={user.level >= 2}
              style={{ width:'120px', height:'160px', borderRadius:'10px', border:'2px dashed #e5e7eb', background:'#f9fafb', cursor:user.level>=2?'default':'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', color:'#9ca3af', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', overflow:'hidden', padding:0 }}>
              {imgPreview
                ? <img src={imgPreview} alt="수업안내장" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <><span style={{ fontSize:'28px' }}>+</span><span>수업안내장<br/>업로드</span></>}
            </button>
            <input ref={imgRef} type="file" accept="image/*" onChange={handleImg} style={{ display:'none' }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'12px', color:'#9ca3af', lineHeight:1.8, marginBottom:'12px' }}>
                • JPG, PNG 형식<br />• 해당 학교 방과후 수업안내장<br />• 선생님 이름이 명시된 서류
              </div>
              <Msg data={verifyMsg} />
              {user.level < 2 && <Btn onClick={submitVerify} size="sm" style={{ marginTop:'8px' }}>{user.verifyImg ? '재신청' : '인증 신청'}</Btn>}
            </div>
          </div>
        </Card>
      )}

      {/* ── 블로그 글 작성 */}
      {verified && (
        <div style={{ marginTop:'24px' }}>
          <style>{mdPreviewStyles}</style>

          {blogView === 'list' ? (
            <Card>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
                <div>
                  <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>✍️ 내 블로그 글</div>
                  <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px' }}>직접 작성한 블로그 글을 관리하세요.</div>
                </div>
                <Btn onClick={handleBlogNew} size="sm">+ 새 글 작성</Btn>
              </div>

              {blogMsg && <Msg data={blogMsg} />}

              {blogPosts.length === 0 ? (
                <div style={{ textAlign:'center', padding:'36px 20px', background:'#f9fafb', borderRadius:'12px', border:`1px dashed ${C.border}`, color:C.muted }}>
                  <div style={{ fontSize:'32px', marginBottom:'8px' }}>✍️</div>
                  <div style={{ fontSize:'14px', fontWeight:600 }}>아직 작성된 글이 없어요</div>
                  <div style={{ fontSize:'12px', marginTop:'4px' }}>첫 번째 블로그 글을 써보세요!</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {blogPosts.map(post => (
                    <div key={post.id} style={{ background:'#f9fafb', borderRadius:'10px', border:`1.5px solid ${C.border}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'2px 9px', background:post.status==='published'?'#f0fdf4':'#f9fafb', color:post.status==='published'?'#16a34a':'#9ca3af', border:`1px solid ${post.status==='published'?'#86efac':'#e5e7eb'}` }}>
                            {post.status==='published' ? '✅ 발행' : '📝 임시'}
                          </span>
                          {post.category && <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', borderRadius:'4px', padding:'2px 7px' }}>{post.category}</span>}
                        </div>
                        <div style={{ fontSize:'14px', fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.title}</div>
                        <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '날짜 없음'}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                        {post.status==='published' && (
                          <a href={`/blog/${post.slug||post.id}`} target="_blank"
                            style={{ padding:'5px 11px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>보기</a>
                        )}
                        <button onClick={() => handleBlogEdit(post)}
                          style={{ padding:'5px 13px', borderRadius:'7px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                        <button onClick={() => handleBlogDelete(post)}
                          style={{ padding:'5px 11px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              {/* 에디터 헤더 */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
                <button onClick={() => setBlogView('list')}
                  style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록</button>
                <div style={{ fontSize:'17px', fontWeight:700, color:C.text, flex:1 }}>
                  {blogEditId ? '글 수정' : '📝 새 블로그 글 작성'}
                </div>
                <button onClick={() => setBlogPreview(v => !v)}
                  style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:blogPreview?'#f3f4f6':'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {blogPreview ? '✏️ 편집' : '👁 미리보기'}
                </button>
                <button onClick={() => handleBlogSave('draft')} disabled={blogLoading}
                  style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  임시저장
                </button>
                <button onClick={() => handleBlogSave('published')} disabled={blogLoading}
                  style={{ padding:'6px 18px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {blogLoading ? '저장 중...' : '🚀 발행'}
                </button>
              </div>

              {blogMsg && <div style={{ marginBottom:'12px' }}><Msg data={blogMsg} /></div>}

              <div style={{ display:'grid', gridTemplateColumns:blogPreview?'1fr 1fr':'1fr', gap:'20px' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {/* 제목 */}
                  <input value={blogForm.title}
                    onChange={e => setBlogForm(v => ({ ...v, title:e.target.value, slug:v.slug||slugify(e.target.value) }))}
                    placeholder="제목을 입력하세요"
                    style={{ width:'100%', padding:'11px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'17px', fontWeight:700, fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />

                  {/* slug / 카테고리 / 발행일 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                    <div>
                      <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>URL 슬러그</label>
                      <input value={blogForm.slug} onChange={e => setBlogForm(v => ({ ...v, slug:e.target.value }))} placeholder="url-slug"
                        style={{ width:'100%', padding:'8px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>카테고리</label>
                      <select value={blogForm.category} onChange={e => setBlogForm(v => ({ ...v, category:e.target.value }))}
                        style={{ width:'100%', padding:'8px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                        <option value="">카테고리 선택</option>
                        {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>발행일</label>
                      <input type="date" value={blogForm.publishedAt} onChange={e => setBlogForm(v => ({ ...v, publishedAt:e.target.value }))}
                        style={{ width:'100%', padding:'8px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  </div>

                  {/* 요약 */}
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>요약 (선택)</label>
                    <textarea value={blogForm.summary} onChange={e => setBlogForm(v => ({ ...v, summary:e.target.value }))} rows={2}
                      placeholder="검색엔진에 표시될 요약 문구 (200자 이내)"
                      style={{ width:'100%', padding:'8px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', resize:'vertical', boxSizing:'border-box' }} maxLength={200} />
                  </div>

                  {/* 커버 이미지 */}
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>커버 이미지 URL (선택)</label>
                    <input value={blogForm.coverImage} onChange={e => setBlogForm(v => ({ ...v, coverImage:e.target.value }))} placeholder="https://..."
                      style={{ width:'100%', padding:'8px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                  </div>

                  {/* 태그 */}
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>태그 (쉼표로 구분)</label>
                    <input value={blogForm.tags} onChange={e => setBlogForm(v => ({ ...v, tags:e.target.value }))} placeholder="출석관리, 방과후, 팁"
                      style={{ width:'100%', padding:'8px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                  </div>

                  {/* 본문 */}
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>본문 (마크다운)</label>
                    <textarea value={blogForm.content} onChange={e => setBlogForm(v => ({ ...v, content:e.target.value }))} rows={20}
                      placeholder={`# 제목\n\n본문을 마크다운으로 작성하세요.\n\n## 소제목\n\n- 항목 1\n- 항목 2\n\n**굵게** *기울임* \`코드\``}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'monospace', lineHeight:1.7, outline:'none', resize:'vertical', boxSizing:'border-box' }} />
                  </div>
                </div>

                {/* 미리보기 */}
                {blogPreview && (
                  <div style={{ borderLeft:`2px solid ${C.border}`, paddingLeft:'20px' }}>
                    <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'12px' }}>👁 미리보기</div>
                    {blogForm.coverImage && (
                      <img src={blogForm.coverImage} alt="커버" style={{ width:'100%', borderRadius:'10px', marginBottom:'12px', objectFit:'cover', maxHeight:'200px' }} />
                    )}
                    <h1 style={{ fontSize:'20px', fontWeight:800, color:C.text, marginBottom:'8px' }}>{blogForm.title || '(제목 없음)'}</h1>
                    {blogForm.summary && <p style={{ fontSize:'13px', color:C.muted, marginBottom:'12px', fontStyle:'italic' }}>{blogForm.summary}</p>}
                    <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMarkdown(blogForm.content) }} />
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {showVerify && <VerifyModal user={user} onVerified={handleVerified} onClose={handleClose} />}
    </div>
  )
}
