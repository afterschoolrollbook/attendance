/**
 * VendorManage.jsx
 * 본사 업체 관리 — Lv.5 관리자 전용
 * ※ 외부 컴포넌트 의존성 없음 (Atoms 미사용)
 */
import React, { useState, useEffect, useCallback } from 'react'
import { uid, now } from '../lib/utils.js'
import { dbCall, isConfigured, FUNCTIONS_BASE } from '../lib/supabase.js'

// 초대 이메일 직접 발송 (subject + html 커스텀)
async function sendInviteEmail(to, vendorName, link) {
  const res = await fetch(`${FUNCTIONS_BASE}/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      to,
      subject: '[방과후 출석부] 업체 파트너 초대 안내',
      html: `
        <div style="font-family:'Noto Sans KR',sans-serif;max-width:500px;margin:0 auto;padding:40px 20px;">
          <h1 style="color:#f97316;font-size:24px;margin-bottom:8px">방과후 출석부</h1>
          <p style="color:#374151;font-size:16px;margin-bottom:8px">안녕하세요, <strong>${vendorName}</strong> 담당자님.</p>
          <p style="color:#374151;font-size:15px;margin-bottom:32px">업체 파트너로 초대드립니다. 아래 버튼을 클릭하여 계정을 만들어주세요.</p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${link}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
              🎒 업체 계정 만들기
            </a>
          </div>
          <div style="background:#f9fafb;border-radius:10px;padding:16px;font-size:13px;color:#6b7280;line-height:1.7;">
            <div>• 가입 시 본사에 등록된 휴대폰 번호 또는 이메일로 본인 확인이 필요합니다.</div>
            <div>• 본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.</div>
          </div>
        </div>
      `,
    }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || '이메일 발송 실패')
  return data
}
import { useToast } from '../hooks/useToast.js'

// ─── 색상
const C = {
  primary:'#f97316', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', success:'#16a34a', danger:'#ef4444',
  card:'#fff', blue:'#3b82f6', purple:'#8b5cf6', warning:'#f59e0b', bg:'#f9fafb',
}

// ─── localStorage
// ✅ 모두 Supabase 직접 조회/저장
const HQVendors = {
  all:    async ()    => (await dbCall('getAll', 'hqVendors')) || [],
  save:   async (v)   => dbCall('upsert', 'hqVendors', { data: v }),
  delete: async (id)  => dbCall('delete', 'hqVendors', { id }),
}
const HQSubjects = {
  all:      async ()    => (await dbCall('getAll', 'hqVendorSubjects')) || [],
  byVendor: async (vid) => ((await dbCall('getAll', 'hqVendorSubjects')) || []).filter(s=>s.vendorId===vid),
  save:     async (s)   => dbCall('upsert', 'hqVendorSubjects', { data: s }),
  delete:   async (id)  => dbCall('delete', 'hqVendorSubjects', { id }),
}
const HQProducts = {
  all:       async ()    => (await dbCall('getAll', 'hqVendorProducts')) || [],
  byVendor:  async (vid) => ((await dbCall('getAll', 'hqVendorProducts')) || []).filter(p=>p.vendorId===vid),
  bySubject: async (sid) => ((await dbCall('getAll', 'hqVendorProducts')) || []).filter(p=>p.subjectId===sid),
  save:      async (p)   => dbCall('upsert', 'hqVendorProducts', { data: p }),
  delete:    async (id)  => dbCall('delete', 'hqVendorProducts', { id }),
}

// ─── 공통 스타일
const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb',
  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

// ─── 버튼
function Btn({ children, onClick, disabled, secondary, danger, style={} }) {
  const bg     = disabled ? '#d1d5db' : danger ? '#ef4444' : secondary ? '#fff' : '#f97316'
  const color  = disabled ? '#9ca3af' : secondary ? '#374151' : '#fff'
  const border = secondary ? '1.5px solid #e5e7eb' : 'none'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        padding:'8px 16px', borderRadius:'9px', border, background:bg, color,
        fontWeight:600, fontSize:'13px', cursor:disabled?'not-allowed':'pointer',
        fontFamily:'Noto Sans KR, sans-serif', ...style,
      }}
    >{children}</button>
  )
}

// ─── 빈 상태
function Empty({ icon, msg }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 20px', color:C.muted }}>
      <div style={{ fontSize:'40px', marginBottom:'10px' }}>{icon}</div>
      <div style={{ fontSize:'14px' }}>{msg}</div>
    </div>
  )
}

// ─── 모달 (심플 — 드래그 없음, 입력 100% 정상)
function Modal({ title, onClose, width=480, children }) {
  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:2000,
        background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center',
      }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          background:'#fff', borderRadius:'16px', width:`${width}px`, maxWidth:'95vw',
          maxHeight:'90vh', overflowY:'auto', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted, lineHeight:1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── 상태 뱃지
const STATUS = {
  pending:  { label:'초대 전',   bg:'#f3f4f6', color:'#6b7280' },
  invited:  { label:'초대 발송', bg:'#eff6ff', color:'#3b82f6' },
  joined:   { label:'가입 완료', bg:'#f0fdf4', color:'#16a34a' },
  inactive: { label:'비활성',    bg:'#fef2f2', color:'#ef4444' },
}
function Badge({ status }) {
  const s = STATUS[status] || STATUS.pending
  return <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'999px', background:s.bg, color:s.color }}>{s.label}</span>
}

// ─────────────────────────────────
// 초대 모달 — 이메일 발송 전용
// ─────────────────────────────────
function InviteModal({ vendor, onClose, onSent }) {
  const link    = `${window.location.origin}?vendor=1`
  const [email, setEmail]     = useState(vendor.email || '')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [err, setErr]         = useState('')
  const { success, error: toastError } = useToast()

  const handleSend = async () => {
    if (!email.trim()) { setErr('이메일을 입력해주세요.'); return }
    if (!email.includes('@')) { setErr('올바른 이메일 주소를 입력해주세요.'); return }
    setErr('')
    setSending(true)

    const subject = '[방과후 출석부] 업체 파트너 초대 안내'
    const body    = `안녕하세요, ${vendor.name} 담당자님.\n\n방과후 출석부 플랫폼 업체 파트너로 초대드립니다.\n\n아래 링크에서 업체 계정을 만드신 후 과목 및 교구를 등록해 주시기 바랍니다.\n\n👉 ${link}\n\n가입 시 본사에 등록된 휴대폰 번호 또는 이메일로 본인 확인 후 가입하실 수 있습니다.\n\n감사합니다.\n방과후 출석부 운영팀`

    try {
      if (isConfigured) {
        await sendInviteEmail(email.trim(), vendor.name, link)
      } else {
        console.log('[개발모드] 초대 이메일:', { to: email, link })
        await new Promise(r => setTimeout(r, 800))
      }
      setSent(true)
      onSent()
      success(`${email} 로 초대 이메일을 발송했습니다.`)
    } catch (e) {
      toastError('이메일 발송에 실패했습니다.')
      setErr('이메일 발송 실패. Resend API 키를 확인해주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={`📧 초대 이메일 발송 — ${vendor.name}`} onClose={onClose} width={440}>
      {sent ? (
        // 발송 완료 화면
        <div style={{ textAlign:'center', padding:'20px 0' }}>
          <div style={{ fontSize:'48px', marginBottom:'12px' }}>✅</div>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.success, marginBottom:'6px' }}>초대 이메일 발송 완료!</div>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px' }}>{email}</div>
          <Btn onClick={onClose}>확인</Btn>
        </div>
      ) : (
        <>
          {/* 업체 정보 */}
          <div style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, marginBottom:'16px' }}>
            <div style={{ fontSize:'12px', color:C.muted, marginBottom:'4px' }}>초대할 업체</div>
            <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>🏢 {vendor.name}</div>
            {vendor.managerName && <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>담당자: {vendor.managerName}</div>}
          </div>

          {/* 이메일 입력 */}
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>받는 이메일 주소</label>
            <input
              style={iSt}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErr('') }}
              placeholder="vendor@example.com"
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            {err && <p style={{ color:C.danger, fontSize:'12px', margin:'4px 0 0' }}>⚠️ {err}</p>}
          </div>

          {/* 발송 내용 미리보기 */}
          <div style={{ padding:'12px 14px', background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe', marginBottom:'16px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:C.blue, marginBottom:'6px' }}>📧 발송 내용 미리보기</div>
            <div style={{ fontSize:'12px', color:C.text, lineHeight:'1.6' }}>
              안녕하세요, {vendor.name} 담당자님.<br />
              방과후 출석부 플랫폼 업체 파트너로 초대드립니다.<br /><br />
              👉 <span style={{ color:C.blue, wordBreak:'break-all' }}>{link}</span><br /><br />
              가입 시 본사에 등록된 휴대폰 번호 또는 이메일로<br />
              본인 확인 후 가입하실 수 있습니다.
            </div>
          </div>

          {!isConfigured && (
            <div style={{ padding:'8px 12px', background:'#fef9c3', borderRadius:'8px', border:'1px solid #fde047', marginBottom:'12px', fontSize:'12px', color:'#854d0e' }}>
              ⚠️ 개발 모드 — 실제 이메일은 발송되지 않습니다. (콘솔 출력)
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
            <Btn onClick={onClose} secondary>취소</Btn>
            <Btn onClick={handleSend} disabled={sending || !email}>
              {sending ? '발송 중...' : '📧 초대 이메일 발송'}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  )
}

// ─────────────────────────────────
// 업체 등록/수정 모달
// ─────────────────────────────────
function VendorFormModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState({ name:'', managerName:'', phone:'', email:'', kakaoId:'', memo:'', ...(vendor||{}) })
  const set = (k) => (e) => setForm(f=>({...f,[k]:e.target.value}))

  const handleSave = () => {
    if (!form.name.trim()) { alert('업체명을 입력해주세요.'); return }
    onSave(form)
    onClose()
  }

  // ✅ Row를 함수 내부에 정의하지 않고 input을 직접 나열 — 리렌더 시 포커스 날아가는 문제 방지
  return (
    <Modal title={vendor ? '✏️ 업체 수정' : '🏢 업체 등록'} onClose={onClose} width={460}>
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>업체명 *</label>
          <input style={iSt} value={form.name||''} onChange={set('name')} placeholder="예: 로봇사이언스 주식회사" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>담당자명</label>
          <input style={iSt} value={form.managerName||''} onChange={set('managerName')} placeholder="예: 홍길동" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>📱 휴대폰</label>
          <input style={iSt} value={form.phone||''} onChange={set('phone')} placeholder="010-0000-0000" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>📧 이메일</label>
          <input style={iSt} type="email" value={form.email||''} onChange={set('email')} placeholder="vendor@example.com" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>💛 카카오ID</label>
          <input style={iSt} value={form.kakaoId||''} onChange={set('kakaoId')} placeholder="카카오톡 아이디" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>메모</label>
          <textarea style={{ ...iSt, resize:'vertical' }} rows={2} value={form.memo||''} onChange={set('memo')} placeholder="내부 메모" />
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px' }}>
        <Btn onClick={onClose} secondary>취소</Btn>
        <Btn onClick={handleSave}>저장</Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────
// 업체 상세 드로어 (과목·교구)
// ─────────────────────────────────
function VendorDetailDrawer({ vendor, onClose }) {
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const [tab, setTab]           = useState('subject')
  const [subjName, setSubjName] = useState('')
  const [prodForm, setProdForm] = useState({ name:'', subjectId:'', type:'annual', price:'', description:'' })
  const { success } = useToast()

  const reload = useCallback(async () => {
    setSubjects(await HQSubjects.byVendor(vendor.id))
    setProducts(await HQProducts.byVendor(vendor.id))
  }, [vendor.id])
  useEffect(() => { reload() }, [reload])

  const saveSubject = async () => {
    if (!subjName.trim()) return
    await HQSubjects.save({ id:uid(), vendorId:vendor.id, name:subjName.trim(), createdAt:now() })
    setSubjName('')
    reload()
    success('과목이 추가되었습니다.')
  }

  const saveProduct = async () => {
    if (!prodForm.name.trim()) { alert('교구명을 입력해주세요.'); return }
    await HQProducts.save({ id:uid(), vendorId:vendor.id, ...prodForm, price:Number(prodForm.price)||0, createdAt:now() })
    setProdForm({ name:'', subjectId:'', type:'annual', price:'', description:'' })
    reload()
    success('교구가 추가되었습니다.')
  }

  const TYPE_LABEL = { annual:'연간', session:'차시별', item:'교구' }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:1800 }} />
      <div style={{
        position:'fixed', top:0, right:0, width:'460px', maxWidth:'100vw', height:'100vh',
        background:'#fff', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)', zIndex:1900,
        display:'flex', flexDirection:'column', fontFamily:'Noto Sans KR, sans-serif',
      }}>
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{vendor.name}</div>
            <div style={{ fontSize:'12px', color:C.muted }}>{vendor.managerName} {vendor.phone}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
        </div>

        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}` }}>
          {[['subject','📚 과목'],['product','🎒 교구']].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1, padding:'12px', background:'none', border:'none',
              borderBottom:tab===t?`2px solid ${C.primary}`:'2px solid transparent',
              color:tab===t?C.primary:C.muted, fontWeight:600, fontSize:'13px',
              cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

          {/* 과목 탭 */}
          {tab==='subject' && (
            <>
              <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                <input style={{ ...iSt, flex:1 }} placeholder="과목명 입력 후 Enter"
                  value={subjName} onChange={e=>setSubjName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&saveSubject()} />
                <Btn onClick={saveSubject}>+ 추가</Btn>
              </div>
              {subjects.length===0
                ? <Empty icon="📚" msg="등록된 과목이 없습니다." />
                : subjects.map(s=>(
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:C.bg, borderRadius:'9px', border:`1px solid ${C.border}`, marginBottom:'8px' }}>
                    <span style={{ flex:1, fontSize:'14px', fontWeight:500 }}>📚 {s.name}</span>
                    <span style={{ fontSize:'11px', color:C.muted }}>{HQProducts.bySubject(s.id).length}개 교구</span>
                    <button onClick={()=>{ if(window.confirm('삭제하시겠습니까?')){ HQSubjects.delete(s.id).then(()=>{ reload(); success('삭제되었습니다.') }) } }}
                      style={{ padding:'3px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  </div>
                ))
              }
            </>
          )}

          {/* 교구 탭 */}
          {tab==='product' && (
            <>
              <div style={{ background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'14px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>교구명 *</label>
                    <input style={iSt} value={prodForm.name} onChange={e=>setProdForm(f=>({...f,name:e.target.value}))} placeholder="교구명" />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>과목</label>
                    <select style={iSt} value={prodForm.subjectId} onChange={e=>setProdForm(f=>({...f,subjectId:e.target.value}))}>
                      <option value="">과목 선택</option>
                      {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>유형</label>
                    <select style={iSt} value={prodForm.type} onChange={e=>setProdForm(f=>({...f,type:e.target.value}))}>
                      <option value="annual">연간 등록</option>
                      <option value="session">차시별 등록</option>
                      <option value="item">교구 등록</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>가격(원)</label>
                    <input style={iSt} type="number" value={prodForm.price} onChange={e=>setProdForm(f=>({...f,price:e.target.value}))} placeholder="0" />
                  </div>
                </div>
                <input style={{ ...iSt, marginBottom:'8px' }} value={prodForm.description} onChange={e=>setProdForm(f=>({...f,description:e.target.value}))} placeholder="설명 (선택)" />
                <div style={{ textAlign:'right' }}>
                  <Btn onClick={saveProduct}>+ 교구 추가</Btn>
                </div>
              </div>
              {products.length===0
                ? <Empty icon="🎒" msg="등록된 교구가 없습니다." />
                : products.map(p=>{
                  const subj = subjects.find(s=>s.id===p.subjectId)
                  return (
                    <div key={p.id} style={{ padding:'10px 12px', background:C.card, borderRadius:'9px', border:`1px solid ${C.border}`, marginBottom:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:'13px', fontWeight:600 }}>🎒 {p.name}</span>
                        <button onClick={()=>{ if(window.confirm('삭제하시겠습니까?')){ HQProducts.delete(p.id).then(()=>{ reload(); success('삭제되었습니다.') }) } }}
                          style={{ padding:'3px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </div>
                      <div style={{ display:'flex', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:'#eff6ff', color:C.blue }}>{TYPE_LABEL[p.type]}</span>
                        {subj && <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:'#f3f4f6', color:C.muted }}>{subj.name}</span>}
                        {p.price>0 && <span style={{ fontSize:'11px', color:C.muted }}>{Number(p.price).toLocaleString()}원</span>}
                      </div>
                    </div>
                  )
                })
              }
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────
export function VendorManage({ user }) {
  const [tab, setTab]           = useState('vendors')
  const [vendors, setVendors]   = useState([])
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [vendorModal, setVendorModal]   = useState(false)
  const [editVendor, setEditVendor]     = useState(null)
  const [inviteVendor, setInviteVendor] = useState(null)
  const [detailVendor, setDetailVendor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { success } = useToast()

  const reload = useCallback(async () => {
    setVendors(await HQVendors.all())
    setSubjects(await HQSubjects.all())
    setProducts(await HQProducts.all())
  }, [])
  useEffect(() => { reload() }, [reload])

  const handleSaveVendor = async (form) => {
    await HQVendors.save({ ...form, id:form.id||uid(), status:form.status||'pending', createdAt:form.createdAt||now() })
    reload()
    success(form.id ? '업체가 수정되었습니다.' : '업체가 등록되었습니다.')
  }

  const handleDelete = async (id) => {
    await HQVendors.delete(id)
    const subs = await HQSubjects.all()
    const prods = await HQProducts.all()
    await Promise.all(subs.filter(s=>s.vendorId===id).map(s=>HQSubjects.delete(s.id)))
    await Promise.all(prods.filter(p=>p.vendorId===id).map(p=>HQProducts.delete(p.id)))
    setDeleteTarget(null)
    reload()
    success('업체가 삭제되었습니다.')
  }

  const handleInviteSent = async (vendor) => {
    await HQVendors.save({ ...vendor, status:'invited', invitedAt:now() })
    reload()
    success('초대가 발송되었습니다.')
  }

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    const matchQ = !q || v.name?.toLowerCase().includes(q) || v.managerName?.toLowerCase().includes(q) || v.phone?.includes(q)
    const matchS = filterStatus==='all' || v.status===filterStatus
    return matchQ && matchS
  })

  const stats = [
    ['🏢','전체 업체',  vendors.length,                               C.text],
    ['📨','초대 발송',  vendors.filter(v=>v.status==='invited').length, C.blue],
    ['✅','가입 완료',  vendors.filter(v=>v.status==='joined').length,  C.success],
    ['📚','등록 과목',  subjects.length,                               C.purple],
    ['🎒','등록 교구',  products.length,                               C.warning],
  ]

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'1200px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🏢 본사 업체 관리</h2>
          <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>업체 등록·초대·과목·교구를 통합 관리합니다</p>
        </div>
        <button
          onClick={() => { setEditVendor(null); setVendorModal(true) }}
          style={{
            padding:'10px 20px', borderRadius:'10px', border:'none',
            background:C.primary, color:'#fff', fontWeight:700, fontSize:'14px',
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}
        >+ 업체 등록</button>
      </div>

      {/* 통계 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'24px' }}>
        {stats.map(([icon,label,val,color])=>(
          <div key={label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px', textAlign:'center' }}>
            <div style={{ fontSize:'22px', marginBottom:'4px' }}>{icon}</div>
            <div style={{ fontSize:'22px', fontWeight:700, color }}>{val}</div>
            <div style={{ fontSize:'12px', color:C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:'20px' }}>
        {[['vendors','🏢 업체 목록'],['subjects','📚 과목 현황'],['products','🎒 교구 현황']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'10px 18px', background:'none', border:'none',
            borderBottom:tab===t?`2px solid ${C.primary}`:'2px solid transparent',
            color:tab===t?C.primary:C.muted, fontWeight:600, fontSize:'14px',
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{l}</button>
        ))}
      </div>

      {/* ── 업체 목록 */}
      {tab==='vendors' && (
        <>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input style={{ ...iSt, flex:1, maxWidth:'300px' }} placeholder="업체명·담당자·연락처 검색"
              value={search} onChange={e=>setSearch(e.target.value)} />
            <select style={{ ...iSt, width:'140px' }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="all">전체 상태</option>
              <option value="pending">초대 전</option>
              <option value="invited">초대 발송</option>
              <option value="joined">가입 완료</option>
              <option value="inactive">비활성</option>
            </select>
          </div>

          {filtered.length===0
            ? <Empty icon="🏢" msg="등록된 업체가 없습니다." />
            : filtered.map(v=>{
              const vS = subjects.filter(s=>s.vendorId===v.id)
              const vP = products.filter(p=>p.vendorId===v.id)
              return (
                <div key={v.id} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', marginBottom:'10px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{v.name}</span>
                      <Badge status={v.status} />
                    </div>
                    <div style={{ fontSize:'12px', color:C.muted, display:'flex', gap:'12px', flexWrap:'wrap' }}>
                      {v.managerName && <span>👤 {v.managerName}</span>}
                      {v.phone       && <span>📱 {v.phone}</span>}
                      {v.email       && <span>📧 {v.email}</span>}
                      <span>📚 {vS.length}개 과목</span>
                      <span>🎒 {vP.length}개 교구</span>
                    </div>
                    {v.memo && <div style={{ fontSize:'12px', color:C.muted, marginTop:'4px' }}>📝 {v.memo}</div>}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    {[
                      { label:'📂 상세',  onClick:()=>setDetailVendor(v),                      border:C.border,     bg:C.bg,      color:C.text    },
                      { label:'📨 초대',  onClick:()=>setInviteVendor(v),                      border:'#bfdbfe',    bg:'#eff6ff', color:C.blue    },
                      { label:'수정',     onClick:()=>{ setEditVendor(v); setVendorModal(true) }, border:`${C.primary}66`, bg:'#fff7ed', color:C.primary },
                      { label:'삭제',     onClick:()=>setDeleteTarget(v),                       border:'#fca5a5',    bg:'#fef2f2', color:C.danger  },
                    ].map(({label,onClick,border,bg,color})=>(
                      <button key={label} onClick={onClick} style={{
                        padding:'6px 12px', borderRadius:'8px', border:`1px solid ${border}`,
                        background:bg, color, fontSize:'12px', cursor:'pointer',
                        fontFamily:'Noto Sans KR, sans-serif', fontWeight:500,
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              )
            })
          }
        </>
      )}

      {/* ── 과목 현황 */}
      {tab==='subjects' && (
        <div>
          {vendors.map(v=>{
            const vS = subjects.filter(s=>s.vendorId===v.id)
            if (!vS.length) return null
            return (
              <div key={v.id} style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
                  🏢 {v.name} <Badge status={v.status} />
                </div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {vS.map(s=>(
                    <span key={s.id} style={{ padding:'6px 14px', borderRadius:'999px', background:'#eff6ff', color:C.blue, fontSize:'13px', fontWeight:500, border:'1px solid #bfdbfe' }}>
                      📚 {s.name} ({HQProducts.bySubject(s.id).length}교구)
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          {subjects.length===0 && <Empty icon="📚" msg="등록된 과목이 없습니다." />}
        </div>
      )}

      {/* ── 교구 현황 */}
      {tab==='products' && (
        <div>
          {vendors.map(v=>{
            const vP = products.filter(p=>p.vendorId===v.id)
            if (!vP.length) return null
            const vS = subjects.filter(s=>s.vendorId===v.id)
            const TYPE_COLOR = { annual:{bg:'#eff6ff',color:C.blue}, session:{bg:'#f5f3ff',color:C.purple}, item:{bg:'#f0fdf4',color:C.success} }
            const TYPE_LABEL = { annual:'연간', session:'차시별', item:'교구' }
            return (
              <div key={v.id} style={{ marginBottom:'24px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
                  🏢 {v.name} <Badge status={v.status} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'10px' }}>
                  {vP.map(p=>{
                    const subj = vS.find(s=>s.id===p.subjectId)
                    const tc   = TYPE_COLOR[p.type] || TYPE_COLOR.item
                    return (
                      <div key={p.id} style={{ padding:'12px 14px', background:C.card, borderRadius:'10px', border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'6px' }}>🎒 {p.name}</div>
                        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:tc.bg, color:tc.color }}>{TYPE_LABEL[p.type]}</span>
                          {subj && <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:'#f3f4f6', color:C.muted }}>{subj.name}</span>}
                          {p.price>0 && <span style={{ fontSize:'11px', color:C.muted }}>{Number(p.price).toLocaleString()}원</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {products.length===0 && <Empty icon="🎒" msg="등록된 교구가 없습니다." />}
        </div>
      )}

      {/* ── 모달들 */}
      {vendorModal && (
        <VendorFormModal
          vendor={editVendor}
          onClose={()=>{ setVendorModal(false); setEditVendor(null) }}
          onSave={handleSaveVendor}
        />
      )}
      {inviteVendor && (
        <InviteModal
          vendor={inviteVendor}
          onClose={()=>setInviteVendor(null)}
          onSent={()=>handleInviteSent(inviteVendor)}
        />
      )}
      {detailVendor && (
        <VendorDetailDrawer vendor={detailVendor} onClose={()=>setDetailVendor(null)} />
      )}
      {deleteTarget && (
        <Modal title="업체 삭제 확인" onClose={()=>setDeleteTarget(null)} width={360}>
          <p style={{ fontSize:'14px', color:C.text, lineHeight:'1.6' }}>
            <strong>{deleteTarget.name}</strong> 업체와 관련 과목·교구를 모두 삭제하시겠습니까?<br />
            <span style={{ color:C.danger, fontSize:'12px' }}>이 작업은 되돌릴 수 없습니다.</span>
          </p>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'20px' }}>
            <Btn onClick={()=>setDeleteTarget(null)} secondary>취소</Btn>
            <Btn onClick={()=>handleDelete(deleteTarget.id)} danger>삭제</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
