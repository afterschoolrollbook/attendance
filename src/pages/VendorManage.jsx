/**
 * VendorManage.jsx
 * 본사 업체 관리 페이지 — Lv.5 관리자 전용
 *
 * 탭 1: 업체 목록   — 업체 등록 / 수정 / 삭제 / 초대 발송
 * 탭 2: 과목 현황   — 업체별 등록 과목 조회
 * 탭 3: 교구 현황   — 업체별 등록 교구 조회
 *
 * Supabase 테이블:
 *   hq_vendors         { id, name, manager_name, phone, email, kakao_id, status, invited_at, joined_at, memo, created_at }
 *   hq_vendor_subjects { id, vendor_id, name, created_at }
 *   hq_vendor_products { id, vendor_id, subject_id, name, type:'annual'|'session'|'item', price, description, created_at }
 *
 * SQL: migration_hq_vendors.sql 실행 필요
 */
import React, { useState, useEffect, useCallback } from 'react'
import { uid, now } from '../lib/utils.js'
import { dbCall, isConfigured } from '../lib/supabase.js'
import { Modal, EmptyState } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

// ─── 버튼 헬퍼
function Btn({ children, onClick, disabled, secondary, danger, style }) {
  const bg = danger ? '#ef4444' : secondary ? '#fff' : '#f97316'
  const color = (secondary && !danger) ? '#374151' : '#fff'
  const border = secondary ? '1.5px solid #e5e7eb' : 'none'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'8px 16px', borderRadius:'9px', border,
      background: disabled ? '#d1d5db' : bg, color: disabled ? '#9ca3af' : color,
      fontWeight:600, fontSize:'13px', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily:'Noto Sans KR, sans-serif', transition:'opacity .15s',
      ...style,
    }}>{children}</button>
  )
}


// ─── 색상 상수
const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', success: '#16a34a', danger: '#ef4444',
  card: '#fff', blue: '#3b82f6', purple: '#8b5cf6', warning: '#f59e0b',
  bg: '#f9fafb',
}

// ─── localStorage 키
const LS_VENDORS  = 'asa_hq_vendors'
const LS_SUBJECTS = 'asa_hq_vendor_subjects'
const LS_PRODUCTS = 'asa_hq_vendor_products'

// ─── localStorage CRUD 헬퍼
function lsGet(key)       { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function lsSet(key, arr)  { localStorage.setItem(key, JSON.stringify(arr)) }

// ─── 업체 DB
const HQVendors = {
  all:    ()      => lsGet(LS_VENDORS),
  save:   (v)     => { const arr = lsGet(LS_VENDORS); const idx = arr.findIndex(x=>x.id===v.id); idx>=0 ? arr.splice(idx,1,v) : arr.push(v); lsSet(LS_VENDORS, arr) },
  delete: (id)    => lsSet(LS_VENDORS, lsGet(LS_VENDORS).filter(v=>v.id!==id)),
}
const HQSubjects = {
  all:        ()  => lsGet(LS_SUBJECTS),
  byVendor:   (vid) => lsGet(LS_SUBJECTS).filter(s=>s.vendorId===vid),
  save:       (s) => { const arr=lsGet(LS_SUBJECTS); const idx=arr.findIndex(x=>x.id===s.id); idx>=0?arr.splice(idx,1,s):arr.push(s); lsSet(LS_SUBJECTS,arr) },
  delete:     (id)=> lsSet(LS_SUBJECTS, lsGet(LS_SUBJECTS).filter(s=>s.id!==id)),
}
const HQProducts = {
  all:       ()   => lsGet(LS_PRODUCTS),
  byVendor:  (vid)=> lsGet(LS_PRODUCTS).filter(p=>p.vendorId===vid),
  bySubject: (sid)=> lsGet(LS_PRODUCTS).filter(p=>p.subjectId===sid),
  save:      (p)  => { const arr=lsGet(LS_PRODUCTS); const idx=arr.findIndex(x=>x.id===p.id); idx>=0?arr.splice(idx,1,p):arr.push(p); lsSet(LS_PRODUCTS,arr) },
  delete:    (id) => lsSet(LS_PRODUCTS, lsGet(LS_PRODUCTS).filter(p=>p.id!==id)),
}

// ─── 상태 뱃지
const STATUS_MAP = {
  pending:  { label:'초대 전',  bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db' },
  invited:  { label:'초대 발송', bg:'#eff6ff', color:'#3b82f6', border:'#bfdbfe' },
  joined:   { label:'가입 완료', bg:'#f0fdf4', color:'#16a34a', border:'#86efac' },
  inactive: { label:'비활성',   bg:'#fef2f2', color:'#ef4444', border:'#fca5a5' },
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending
  return (
    <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'999px',
      background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

// ─── 입력 공통 스타일
const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb',
  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

// ─── 초대 메시지 생성
function buildInviteMsg(vendor, via) {
  const link = `${window.location.origin}/vendor-login`
  const name = vendor.name || '업체명'
  if (via === 'kakao') {
    return `안녕하세요 😊 ${name} 담당자님!\n방과후 출석부 플랫폼 업체 파트너로 초대드립니다.\n\n아래 링크를 통해 업체 계정을 만들고\n과목·교구를 등록해 주세요 🎒\n\n${link}\n\n문의: 방과후 출석부 운영팀`
  }
  if (via === 'email') {
    return `안녕하세요, ${name} 담당자님.\n방과후 출석부 플랫폼 업체 파트너 초대 안내입니다.\n\n아래 링크에서 업체 계정을 만드신 후\n과목 및 교구를 등록해 주시기 바랍니다.\n\n${link}\n\n감사합니다.\n방과후 출석부 운영팀`
  }
  // sms
  return `[방과후 출석부] ${name} 담당자님, 업체 파트너 초대드립니다!\n아래 링크에서 계정을 만들어 주세요 👇\n${link}`
}

// ─────────────────────────────────────────────────────
// 초대 모달
// ─────────────────────────────────────────────────────
function InviteModal({ vendor, onClose, onSent }) {
  const [via, setVia] = useState('sms')
  const msg = buildInviteMsg(vendor, via)
  const phone = vendor.phone?.replace(/[^0-9]/g, '') || ''

  const handleSend = () => {
    if (via === 'sms') {
      window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`)
    } else if (via === 'kakao') {
      navigator.clipboard.writeText(msg).then(() => alert('카카오 문구가 복사되었습니다.\n카카오톡에 붙여넣기 해주세요.'))
    } else {
      window.open(`mailto:${vendor.email || ''}?subject=${encodeURIComponent('[방과후 출석부] 업체 파트너 초대')}&body=${encodeURIComponent(msg)}`)
    }
    onSent()
    onClose()
  }

  return (
    <Modal title={`📨 초대 발송 — ${vendor.name}`} onClose={onClose} width={480}>
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {[['sms','📱 문자'],['kakao','💛 카카오'],['email','📧 이메일']].map(([v,l])=>(
          <button key={v} onClick={()=>setVia(v)} style={{
            flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${via===v?C.primary:C.border}`,
            background: via===v ? '#fff7ed' : C.card, color: via===v ? C.primary : C.muted,
            fontWeight:600, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{l}</button>
        ))}
      </div>
      <textarea value={msg} readOnly rows={7} style={{ ...iSt, resize:'none', background:'#f9fafb', color:C.text }} />
      {via === 'sms' && !phone && (
        <p style={{ color:C.danger, fontSize:'12px', marginTop:'6px' }}>⚠️ 연락처가 등록되지 않았습니다.</p>
      )}
      {via === 'email' && !vendor.email && (
        <p style={{ color:C.danger, fontSize:'12px', marginTop:'6px' }}>⚠️ 이메일이 등록되지 않았습니다.</p>
      )}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px' }}>
        <Btn onClick={onClose} secondary>취소</Btn>
        <Btn onClick={handleSend} disabled={via==='sms'&&!phone||via==='email'&&!vendor.email}>
          {via==='sms'?'📱 문자 발송':via==='kakao'?'💛 카카오 복사':'📧 이메일 열기'}
        </Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────
// 업체 등록/수정 모달
// ─────────────────────────────────────────────────────
function VendorFormModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState({
    name:'', managerName:'', phone:'', email:'', kakaoId:'', memo:'',
    ...(vendor || {}),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSave = () => {
    if (!form.name.trim()) return alert('업체명을 입력해주세요.')
    onSave(form)
    onClose()
  }
  return (
    <Modal title={vendor ? '업체 수정' : '업체 등록'} onClose={onClose} width={480}>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>업체명 *</label>
          <input style={iSt} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="예: 로봇사이언스 주식회사" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>담당자명</label>
          <input style={iSt} value={form.managerName} onChange={e=>set('managerName',e.target.value)} placeholder="예: 홍길동" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>📱 휴대폰</label>
          <input style={iSt} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="010-0000-0000" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>📧 이메일</label>
          <input style={iSt} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="vendor@example.com" type="email" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>💛 카카오 ID</label>
          <input style={iSt} value={form.kakaoId} onChange={e=>set('kakaoId',e.target.value)} placeholder="카카오톡 아이디" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>메모</label>
          <textarea style={{ ...iSt, resize:'vertical' }} rows={2} value={form.memo} onChange={e=>set('memo',e.target.value)} placeholder="내부 메모" />
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'20px' }}>
        <Btn onClick={onClose} secondary>취소</Btn>
        <Btn onClick={handleSave}>저장</Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────
// 업체 상세 드로어 (과목·교구 관리 포함)
// ─────────────────────────────────────────────────────
function VendorDetailDrawer({ vendor, onClose, onUpdate }) {
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const [tab, setTab]           = useState('subject') // 'subject' | 'product'
  const [subjForm, setSubjForm] = useState({ name:'' })
  const [prodForm, setProdForm] = useState({ name:'', subjectId:'', type:'annual', price:'', description:'' })
  const [editing, setEditing]   = useState(null)
  const { success, error }      = useToast()

  const reload = useCallback(() => {
    setSubjects(HQSubjects.byVendor(vendor.id))
    setProducts(HQProducts.byVendor(vendor.id))
  }, [vendor.id])

  useEffect(() => { reload() }, [reload])

  const saveSubject = () => {
    if (!subjForm.name.trim()) return
    const item = editing?.type==='subject'
      ? { ...editing, name: subjForm.name }
      : { id:uid(), vendorId:vendor.id, name:subjForm.name, createdAt:now() }
    HQSubjects.save(item)
    setSubjForm({ name:'' })
    setEditing(null)
    reload()
    success('과목이 저장되었습니다.')
  }

  const saveProduct = () => {
    if (!prodForm.name.trim()) return alert('교구명을 입력해주세요.')
    const item = editing?.type==='product'
      ? { ...editing, ...prodForm }
      : { id:uid(), vendorId:vendor.id, ...prodForm, price: Number(prodForm.price)||0, createdAt:now() }
    HQProducts.save(item)
    setProdForm({ name:'', subjectId:'', type:'annual', price:'', description:'' })
    setEditing(null)
    reload()
    success('교구가 저장되었습니다.')
  }

  const TYPE_LABEL = { annual:'연간 등록', session:'차시별 등록', item:'교구 등록' }

  return (
    <div style={{
      position:'fixed', top:0, right:0, width:'480px', maxWidth:'100vw', height:'100vh',
      background:C.card, boxShadow:'-4px 0 24px rgba(0,0,0,0.12)', zIndex:900,
      display:'flex', flexDirection:'column', fontFamily:'Noto Sans KR, sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{vendor.name}</div>
          <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
            {vendor.managerName && `담당: ${vendor.managerName}`}
            {vendor.phone && ` · ${vendor.phone}`}
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.border}` }}>
        {[['subject','📚 과목 관리'],['product','🎒 교구 관리']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            flex:1, padding:'12px', background:'none', border:'none',
            borderBottom: tab===t ? `2px solid ${C.primary}` : '2px solid transparent',
            color: tab===t ? C.primary : C.muted, fontWeight:600, fontSize:'13px',
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{l}</button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

        {/* ── 과목 관리 탭 */}
        {tab==='subject' && (
          <>
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              <input style={{ ...iSt, flex:1 }} placeholder="과목명 (예: 로봇, 항공, 미술)"
                value={editing?.type==='subject' ? subjForm.name : subjForm.name}
                onChange={e=>setSubjForm({name:e.target.value})}
                onKeyDown={e=>e.key==='Enter'&&saveSubject()}
              />
              <Btn onClick={saveSubject} style={{ flexShrink:0 }}>
                {editing?.type==='subject' ? '수정' : '+ 추가'}
              </Btn>
            </div>
            {subjects.length === 0
              ? <EmptyState icon="📚" message="등록된 과목이 없습니다." />
              : subjects.map(s=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:C.bg, borderRadius:'9px', border:`1px solid ${C.border}`, marginBottom:'8px' }}>
                  <span style={{ flex:1, fontSize:'14px', fontWeight:500, color:C.text }}>📚 {s.name}</span>
                  <span style={{ fontSize:'11px', color:C.muted }}>{HQProducts.bySubject(s.id).length}개 교구</span>
                  <button onClick={()=>{ setEditing({...s,type:'subject'}); setSubjForm({name:s.name}); setTab('subject') }}
                    style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'3px 8px', fontSize:'11px', cursor:'pointer', color:C.muted }}>수정</button>
                  <button onClick={()=>{ if(window.confirm('과목을 삭제하시겠습니까?')){ HQSubjects.delete(s.id); reload(); success('삭제되었습니다.') } }}
                    style={{ background:'none', border:`1px solid #fca5a5`, borderRadius:'6px', padding:'3px 8px', fontSize:'11px', cursor:'pointer', color:C.danger }}>삭제</button>
                </div>
              ))
            }
          </>
        )}

        {/* ── 교구 관리 탭 */}
        {tab==='product' && (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px', padding:'14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
              <div style={{ display:'flex', gap:'8px' }}>
                <input style={{ ...iSt, flex:1 }} placeholder="교구명 *"
                  value={prodForm.name} onChange={e=>setProdForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <select style={{ ...iSt, flex:1 }} value={prodForm.subjectId} onChange={e=>setProdForm(f=>({...f,subjectId:e.target.value}))}>
                  <option value="">과목 선택</option>
                  {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select style={{ ...iSt, flex:1 }} value={prodForm.type} onChange={e=>setProdForm(f=>({...f,type:e.target.value}))}>
                  <option value="annual">연간 등록</option>
                  <option value="session">차시별 등록</option>
                  <option value="item">교구 등록</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <input style={{ ...iSt, flex:1 }} type="number" placeholder="가격 (원)"
                  value={prodForm.price} onChange={e=>setProdForm(f=>({...f,price:e.target.value}))} />
                <input style={{ ...iSt, flex:2 }} placeholder="설명 (선택)"
                  value={prodForm.description} onChange={e=>setProdForm(f=>({...f,description:e.target.value}))} />
              </div>
              <Btn onClick={saveProduct} style={{ alignSelf:'flex-end' }}>
                {editing?.type==='product' ? '교구 수정' : '+ 교구 추가'}
              </Btn>
            </div>

            {products.length === 0
              ? <EmptyState icon="🎒" message="등록된 교구가 없습니다." />
              : products.map(p=>{
                const subj = subjects.find(s=>s.id===p.subjectId)
                return (
                  <div key={p.id} style={{ padding:'12px 14px', background:C.card, borderRadius:'9px', border:`1px solid ${C.border}`, marginBottom:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'14px', fontWeight:600, color:C.text }}>🎒 {p.name}</span>
                      <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:'#eff6ff', color:C.blue }}>{TYPE_LABEL[p.type]}</span>
                      {subj && <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:'#f3f4f6', color:C.muted }}>{subj.name}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'space-between' }}>
                      <div style={{ fontSize:'12px', color:C.muted }}>
                        {p.price ? `${Number(p.price).toLocaleString()}원` : '가격 미설정'}
                        {p.description && ` · ${p.description}`}
                      </div>
                      <div style={{ display:'flex', gap:'5px' }}>
                        <button onClick={()=>{ setEditing({...p,type:'product'}); setProdForm({name:p.name,subjectId:p.subjectId||'',type:p.type,price:p.price||'',description:p.description||''}) }}
                          style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'3px 8px', fontSize:'11px', cursor:'pointer', color:C.muted }}>수정</button>
                        <button onClick={()=>{ if(window.confirm('교구를 삭제하시겠습니까?')){ HQProducts.delete(p.id); reload(); success('삭제되었습니다.') } }}
                          style={{ background:'none', border:`1px solid #fca5a5`, borderRadius:'6px', padding:'3px 8px', fontSize:'11px', cursor:'pointer', color:C.danger }}>삭제</button>
                      </div>
                    </div>
                  </div>
                )
              })
            }
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────
export function VendorManage({ user }) {
  const [tab, setTab]           = useState('vendors')
  const [vendors, setVendors]   = useState([])
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // 모달 상태
  const [vendorModal, setVendorModal]   = useState(false)
  const [editVendor, setEditVendor]     = useState(null)
  const [inviteVendor, setInviteVendor] = useState(null)
  const [detailVendor, setDetailVendor] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const { success, error } = useToast()

  const reload = useCallback(() => {
    setVendors(HQVendors.all())
    setSubjects(HQSubjects.all())
    setProducts(HQProducts.all())
  }, [])

  useEffect(() => { reload() }, [reload])

  // 업체 저장
  const handleSaveVendor = (form) => {
    const v = {
      ...form,
      id:        form.id || uid(),
      status:    form.status || 'pending',
      createdAt: form.createdAt || now(),
    }
    HQVendors.save(v)
    reload()
    success(form.id ? '업체가 수정되었습니다.' : '업체가 등록되었습니다.')
  }

  // 업체 삭제
  const handleDelete = (id) => {
    HQVendors.delete(id)
    // 연관 과목·교구도 삭제
    HQSubjects.all().filter(s=>s.vendorId===id).forEach(s=>HQSubjects.delete(s.id))
    HQProducts.all().filter(p=>p.vendorId===id).forEach(p=>HQProducts.delete(p.id))
    setDeleteConfirm(null)
    reload()
    success('업체가 삭제되었습니다.')
  }

  // 초대 발송 후 상태 업데이트
  const handleInviteSent = (vendor) => {
    HQVendors.save({ ...vendor, status:'invited', invitedAt: now() })
    reload()
    success('초대가 발송되었습니다.')
  }

  // 필터
  const filteredVendors = vendors.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q || v.name?.toLowerCase().includes(q) || v.managerName?.toLowerCase().includes(q) || v.phone?.includes(q)
    const matchStatus = filterStatus === 'all' || v.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total:   vendors.length,
    invited: vendors.filter(v=>v.status==='invited').length,
    joined:  vendors.filter(v=>v.status==='joined').length,
    subjects: subjects.length,
    products: products.length,
  }

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'1200px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🏢 본사 업체 관리</h2>
          <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>업체 등록·초대·과목·교구를 통합 관리합니다</p>
        </div>
        <Btn onClick={()=>{ setEditVendor(null); setVendorModal(true) }}>+ 업체 등록</Btn>
      </div>

      {/* 통계 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'24px' }}>
        {[
          ['🏢', '전체 업체', stats.total, C.text],
          ['📨', '초대 발송', stats.invited, C.blue],
          ['✅', '가입 완료', stats.joined, C.success],
          ['📚', '등록 과목', stats.subjects, C.purple],
          ['🎒', '등록 교구', stats.products, C.warning],
        ].map(([icon,label,val,color])=>(
          <div key={label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px', textAlign:'center' }}>
            <div style={{ fontSize:'22px', marginBottom:'4px' }}>{icon}</div>
            <div style={{ fontSize:'22px', fontWeight:700, color }}>{val}</div>
            <div style={{ fontSize:'12px', color:C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:`1px solid ${C.border}` }}>
        {[['vendors','🏢 업체 목록'],['subjects','📚 과목 현황'],['products','🎒 교구 현황']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'10px 18px', background:'none', border:'none',
            borderBottom: tab===t ? `2px solid ${C.primary}` : '2px solid transparent',
            color: tab===t ? C.primary : C.muted, fontWeight:600, fontSize:'14px',
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{l}</button>
        ))}
      </div>

      {/* ── 업체 목록 탭 */}
      {tab === 'vendors' && (
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

          {filteredVendors.length === 0
            ? <EmptyState icon="🏢" message="등록된 업체가 없습니다." />
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {filteredVendors.map(v => {
                  const vSubjects = subjects.filter(s=>s.vendorId===v.id)
                  const vProducts = products.filter(p=>p.vendorId===v.id)
                  return (
                    <div key={v.id} style={{
                      background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`,
                      padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px',
                    }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{v.name}</span>
                          <StatusBadge status={v.status} />
                        </div>
                        <div style={{ fontSize:'12px', color:C.muted, display:'flex', gap:'12px', flexWrap:'wrap' }}>
                          {v.managerName && <span>👤 {v.managerName}</span>}
                          {v.phone && <span>📱 {v.phone}</span>}
                          {v.email && <span>📧 {v.email}</span>}
                          <span>📚 과목 {vSubjects.length}개</span>
                          <span>🎒 교구 {vProducts.length}개</span>
                          {v.invitedAt && <span>초대일: {v.invitedAt?.slice(0,10)}</span>}
                        </div>
                        {v.memo && <div style={{ fontSize:'12px', color:C.muted, marginTop:'4px' }}>📝 {v.memo}</div>}
                      </div>
                      <div style={{ display:'flex', gap:'6px', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                        <button onClick={()=>setDetailVendor(v)} style={{ padding:'6px 12px', borderRadius:'8px', border:`1px solid ${C.border}`, background:C.bg, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.text }}>
                          📂 상세
                        </button>
                        <button onClick={()=>setInviteVendor(v)} style={{ padding:'6px 12px', borderRadius:'8px', border:`1px solid #bfdbfe`, background:'#eff6ff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.blue }}>
                          📨 초대
                        </button>
                        <button onClick={()=>{ setEditVendor(v); setVendorModal(true) }} style={{ padding:'6px 12px', borderRadius:'8px', border:`1px solid ${C.primary}44`, background:'#fff7ed', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.primary }}>
                          수정
                        </button>
                        <button onClick={()=>setDeleteConfirm(v)} style={{ padding:'6px 12px', borderRadius:'8px', border:`1px solid #fca5a5`, background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </>
      )}

      {/* ── 과목 현황 탭 */}
      {tab === 'subjects' && (
        <div>
          {vendors.map(v => {
            const vSubjects = subjects.filter(s=>s.vendorId===v.id)
            if (vSubjects.length === 0) return null
            return (
              <div key={v.id} style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
                  🏢 {v.name} <StatusBadge status={v.status} />
                </div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {vSubjects.map(s => (
                    <span key={s.id} style={{ padding:'6px 14px', borderRadius:'999px', background:'#eff6ff', color:C.blue, fontSize:'13px', fontWeight:500, border:`1px solid #bfdbfe` }}>
                      📚 {s.name} ({products.filter(p=>p.subjectId===s.id).length}교구)
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          {subjects.length === 0 && <EmptyState icon="📚" message="등록된 과목이 없습니다." />}
        </div>
      )}

      {/* ── 교구 현황 탭 */}
      {tab === 'products' && (
        <div>
          {vendors.map(v => {
            const vProducts = products.filter(p=>p.vendorId===v.id)
            if (vProducts.length === 0) return null
            const vSubjects = subjects.filter(s=>s.vendorId===v.id)
            return (
              <div key={v.id} style={{ marginBottom:'24px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
                  🏢 {v.name} <StatusBadge status={v.status} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'10px' }}>
                  {vProducts.map(p => {
                    const subj = vSubjects.find(s=>s.id===p.subjectId)
                    const TYPE_COLOR = { annual:'#eff6ff', session:'#f5f3ff', item:'#f0fdf4' }
                    const TYPE_LABEL = { annual:'연간', session:'차시별', item:'교구' }
                    return (
                      <div key={p.id} style={{ padding:'12px 14px', background:C.card, borderRadius:'10px', border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:'13px', fontWeight:600, color:C.text, marginBottom:'4px' }}>🎒 {p.name}</div>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background: TYPE_COLOR[p.type]||'#f3f4f6', color:C.text }}>
                            {TYPE_LABEL[p.type]||p.type}
                          </span>
                          {subj && <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:'#f3f4f6', color:C.muted }}>{subj.name}</span>}
                          {p.price ? <span style={{ fontSize:'11px', color:C.muted }}>{Number(p.price).toLocaleString()}원</span> : null}
                        </div>
                        {p.description && <div style={{ fontSize:'11px', color:C.muted, marginTop:'4px' }}>{p.description}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {products.length === 0 && <EmptyState icon="🎒" message="등록된 교구가 없습니다." />}
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
        <>
          <div onClick={()=>setDetailVendor(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:850 }} />
          <VendorDetailDrawer
            vendor={detailVendor}
            onClose={()=>setDetailVendor(null)}
            onUpdate={reload}
          />
        </>
      )}
      {deleteConfirm && (
        <Modal title="업체 삭제 확인" onClose={()=>setDeleteConfirm(null)} width={380}>
          <p style={{ fontSize:'14px', color:C.text }}>
            <strong>{deleteConfirm.name}</strong> 업체와 관련 과목·교구를 모두 삭제하시겠습니까?<br />
            <span style={{ color:C.danger, fontSize:'12px' }}>이 작업은 되돌릴 수 없습니다.</span>
          </p>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'20px' }}>
            <Btn onClick={()=>setDeleteConfirm(null)} secondary>취소</Btn>
            <Btn onClick={()=>handleDelete(deleteConfirm.id)} danger>삭제</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Supabase 마이그레이션 SQL (주석 참고용)
// ─────────────────────────────────────────────────────
/*
-- migration_hq_vendors.sql

create table if not exists hq_vendors (
  id            text primary key,
  name          text not null,
  manager_name  text,
  phone         text,
  email         text,
  kakao_id      text,
  status        text default 'pending',
  invited_at    timestamptz,
  joined_at     timestamptz,
  memo          text,
  created_at    timestamptz default now()
);

create table if not exists hq_vendor_subjects (
  id          text primary key,
  vendor_id   text references hq_vendors(id) on delete cascade,
  name        text not null,
  created_at  timestamptz default now()
);

create table if not exists hq_vendor_products (
  id          text primary key,
  vendor_id   text references hq_vendors(id) on delete cascade,
  subject_id  text references hq_vendor_subjects(id) on delete set null,
  name        text not null,
  type        text default 'item',  -- 'annual' | 'session' | 'item'
  price       numeric default 0,
  description text,
  created_at  timestamptz default now()
);

-- vendor 계정 (별도 인증)
create table if not exists vendor_accounts (
  id          text primary key,
  vendor_id   text references hq_vendors(id) on delete cascade,
  email       text unique not null,
  pw_hash     text,
  name        text,
  created_at  timestamptz default now()
);
*/
