/**
 * VendorManage.jsx
 * 본사 업체 관리 — Lv.5 관리자 전용
 * ※ 외부 컴포넌트 의존성 없음 (Atoms 미사용)
 */
import React, { useState, useEffect, useCallback } from 'react'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'

// ─── 색상
const C = {
  primary:'#f97316', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', success:'#16a34a', danger:'#ef4444',
  card:'#fff', blue:'#3b82f6', purple:'#8b5cf6', warning:'#f59e0b', bg:'#f9fafb',
}

// ─── localStorage
const LS_VENDORS  = 'asa_hq_vendors'
const LS_SUBJECTS = 'asa_hq_vendor_subjects'
const LS_PRODUCTS = 'asa_hq_vendor_products'

function lsGet(key)      { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function lsSet(key, arr) { localStorage.setItem(key, JSON.stringify(arr)) }

const HQVendors = {
  all:    ()    => lsGet(LS_VENDORS),
  save:   (v)   => { const a=lsGet(LS_VENDORS); const i=a.findIndex(x=>x.id===v.id); i>=0?a.splice(i,1,v):a.push(v); lsSet(LS_VENDORS,a) },
  delete: (id)  => lsSet(LS_VENDORS, lsGet(LS_VENDORS).filter(v=>v.id!==id)),
}
const HQSubjects = {
  all:      ()    => lsGet(LS_SUBJECTS),
  byVendor: (vid) => lsGet(LS_SUBJECTS).filter(s=>s.vendorId===vid),
  save:     (s)   => { const a=lsGet(LS_SUBJECTS); const i=a.findIndex(x=>x.id===s.id); i>=0?a.splice(i,1,s):a.push(s); lsSet(LS_SUBJECTS,a) },
  delete:   (id)  => lsSet(LS_SUBJECTS, lsGet(LS_SUBJECTS).filter(s=>s.id!==id)),
}
const HQProducts = {
  all:       ()    => lsGet(LS_PRODUCTS),
  byVendor:  (vid) => lsGet(LS_PRODUCTS).filter(p=>p.vendorId===vid),
  bySubject: (sid) => lsGet(LS_PRODUCTS).filter(p=>p.subjectId===sid),
  save:      (p)   => { const a=lsGet(LS_PRODUCTS); const i=a.findIndex(x=>x.id===p.id); i>=0?a.splice(i,1,p):a.push(p); lsSet(LS_PRODUCTS,a) },
  delete:    (id)  => lsSet(LS_PRODUCTS, lsGet(LS_PRODUCTS).filter(p=>p.id!==id)),
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
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose() }}
    >
      <div style={{
        background:'#fff', borderRadius:'16px', width:`${width}px`, maxWidth:'95vw',
        maxHeight:'90vh', overflowY:'auto', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
      }}>
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
// 초대 모달
// ─────────────────────────────────
function InviteModal({ vendor, onClose, onSent }) {
  const [via, setVia] = useState('sms')
  const link = `${window.location.origin}?vendor=1`
  const msgs = {
    sms:   `[방과후 출석부] ${vendor.name} 담당자님, 업체 파트너 초대드립니다!\n아래 링크에서 계정을 만들어 주세요 👇\n${link}`,
    kakao: `안녕하세요 😊 ${vendor.name} 담당자님!\n방과후 출석부 업체 파트너로 초대드립니다.\n\n${link}`,
    email: `안녕하세요, ${vendor.name} 담당자님.\n업체 파트너 초대 안내입니다.\n\n${link}\n\n감사합니다.`,
  }
  const msg   = msgs[via]
  const phone = vendor.phone?.replace(/[^0-9]/g,'') || ''

  const handleSend = () => {
    if (via==='sms')   window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`)
    if (via==='kakao') { navigator.clipboard.writeText(msg).then(()=>alert('복사되었습니다. 카카오톡에 붙여넣기 해주세요.')) }
    if (via==='email') window.open(`mailto:${vendor.email||''}?subject=${encodeURIComponent('[방과후 출석부] 업체 파트너 초대')}&body=${encodeURIComponent(msg)}`)
    onSent(); onClose()
  }

  return (
    <Modal title={`📨 초대 발송 — ${vendor.name}`} onClose={onClose} width={460}>
      <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
        {[['sms','📱 문자'],['kakao','💛 카카오'],['email','📧 이메일']].map(([v,l])=>(
          <button key={v} onClick={()=>setVia(v)} style={{
            flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${via===v?C.primary:C.border}`,
            background:via===v?'#fff7ed':C.card, color:via===v?C.primary:C.muted,
            fontWeight:600, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{l}</button>
        ))}
      </div>
      <textarea value={msg} readOnly rows={6} style={{ ...iSt, resize:'none', background:'#f9fafb' }} />
      {via==='sms'   && !phone       && <p style={{ color:C.danger, fontSize:'12px', margin:'6px 0 0' }}>⚠️ 연락처가 없습니다.</p>}
      {via==='email' && !vendor.email && <p style={{ color:C.danger, fontSize:'12px', margin:'6px 0 0' }}>⚠️ 이메일이 없습니다.</p>}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px' }}>
        <Btn onClick={onClose} secondary>취소</Btn>
        <Btn onClick={handleSend}>발송</Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────
// 업체 등록/수정 모달
// ─────────────────────────────────
function VendorFormModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState({ name:'', managerName:'', phone:'', email:'', kakaoId:'', memo:'', ...(vendor||{}) })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = () => {
    if (!form.name.trim()) { alert('업체명을 입력해주세요.'); return }
    onSave(form)
    onClose()
  }

  const Row = ({ label, k, type='text', placeholder='' }) => (
    <div style={{ marginBottom:'10px' }}>
      <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>{label}</label>
      <input style={iSt} type={type} value={form[k]||''} onChange={e=>set(k,e.target.value)} placeholder={placeholder} />
    </div>
  )

  return (
    <Modal title={vendor ? '✏️ 업체 수정' : '🏢 업체 등록'} onClose={onClose} width={460}>
      <Row label="업체명 *"   k="name"        placeholder="예: 로봇사이언스 주식회사" />
      <Row label="담당자명"   k="managerName" placeholder="예: 홍길동" />
      <Row label="📱 휴대폰"  k="phone"       placeholder="010-0000-0000" />
      <Row label="📧 이메일"  k="email"       type="email" placeholder="vendor@example.com" />
      <Row label="💛 카카오ID" k="kakaoId"    placeholder="카카오톡 아이디" />
      <div style={{ marginBottom:'10px' }}>
        <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'3px' }}>메모</label>
        <textarea style={{ ...iSt, resize:'vertical' }} rows={2} value={form.memo||''} onChange={e=>set('memo',e.target.value)} placeholder="내부 메모" />
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'8px' }}>
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

  const reload = useCallback(() => {
    setSubjects(HQSubjects.byVendor(vendor.id))
    setProducts(HQProducts.byVendor(vendor.id))
  }, [vendor.id])
  useEffect(() => { reload() }, [reload])

  const saveSubject = () => {
    if (!subjName.trim()) return
    HQSubjects.save({ id:uid(), vendorId:vendor.id, name:subjName.trim(), createdAt:now() })
    setSubjName('')
    reload()
    success('과목이 추가되었습니다.')
  }

  const saveProduct = () => {
    if (!prodForm.name.trim()) { alert('교구명을 입력해주세요.'); return }
    HQProducts.save({ id:uid(), vendorId:vendor.id, ...prodForm, price:Number(prodForm.price)||0, createdAt:now() })
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
                    <button onClick={()=>{ if(window.confirm('삭제하시겠습니까?')){ HQSubjects.delete(s.id); reload(); success('삭제되었습니다.') } }}
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
                        <button onClick={()=>{ if(window.confirm('삭제하시겠습니까?')){ HQProducts.delete(p.id); reload(); success('삭제되었습니다.') } }}
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

  const reload = useCallback(() => {
    setVendors(HQVendors.all())
    setSubjects(HQSubjects.all())
    setProducts(HQProducts.all())
  }, [])
  useEffect(() => { reload() }, [reload])

  const handleSaveVendor = (form) => {
    HQVendors.save({ ...form, id:form.id||uid(), status:form.status||'pending', createdAt:form.createdAt||now() })
    reload()
    success(form.id ? '업체가 수정되었습니다.' : '업체가 등록되었습니다.')
  }

  const handleDelete = (id) => {
    HQVendors.delete(id)
    HQSubjects.all().filter(s=>s.vendorId===id).forEach(s=>HQSubjects.delete(s.id))
    HQProducts.all().filter(p=>p.vendorId===id).forEach(p=>HQProducts.delete(p.id))
    setDeleteTarget(null)
    reload()
    success('업체가 삭제되었습니다.')
  }

  const handleInviteSent = (vendor) => {
    HQVendors.save({ ...vendor, status:'invited', invitedAt:now() })
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
