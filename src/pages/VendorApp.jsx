/**
 * VendorApp.jsx
 * 업체 전용 앱 — 로그인한 업체가 보는 화면
 *
 * 사이드바 + 페이지 라우팅
 * 페이지:
 *   dashboard  — 현황 요약
 *   subjects   — 과목 관리
 *   products   — 교구 관리 (연간/차시별/교구)
 *
 * App.jsx에서:
 *   const vendorSession = localStorage.getItem('asa_vendor_session')
 *   if (vendorSession && currentPath === 'vendor') return <VendorApp />
 */
import React, { useState, useEffect, useCallback } from 'react'
import { uid, now } from '../lib/utils.js'
import { Modal, EmptyState } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', success: '#16a34a', danger: '#ef4444',
  card: '#fff', bg: '#f9fafb', sidebar: '#1c1917',
  blue: '#3b82f6', purple: '#8b5cf6', warning: '#f59e0b',
}

const LS_ACCOUNTS = 'asa_vendor_accounts'
const LS_SUBJECTS = 'asa_hq_vendor_subjects'
const LS_PRODUCTS = 'asa_hq_vendor_products'
const LS_SESSION  = 'asa_vendor_session'

function lsGet(key)       { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function lsSet(key, arr)  { localStorage.setItem(key, JSON.stringify(arr)) }

const HQSubjects = {
  byVendor: (vid) => lsGet(LS_SUBJECTS).filter(s=>s.vendorId===vid),
  save:     (s)   => { const arr=lsGet(LS_SUBJECTS); const idx=arr.findIndex(x=>x.id===s.id); idx>=0?arr.splice(idx,1,s):arr.push(s); lsSet(LS_SUBJECTS,arr) },
  delete:   (id)  => lsSet(LS_SUBJECTS, lsGet(LS_SUBJECTS).filter(s=>s.id!==id)),
}
const HQProducts = {
  byVendor:  (vid) => lsGet(LS_PRODUCTS).filter(p=>p.vendorId===vid),
  bySubject: (sid) => lsGet(LS_PRODUCTS).filter(p=>p.subjectId===sid),
  save:      (p)   => { const arr=lsGet(LS_PRODUCTS); const idx=arr.findIndex(x=>x.id===p.id); idx>=0?arr.splice(idx,1,p):arr.push(p); lsSet(LS_PRODUCTS,arr) },
  delete:    (id)  => lsSet(LS_PRODUCTS, lsGet(LS_PRODUCTS).filter(p=>p.id!==id)),
}

const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb',
  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

// ─── 업체 사이드바 네비
const VENDOR_NAV = [
  { path:'dashboard', label:'대시보드',   icon:'🏠' },
  { path:'subjects',  label:'과목 관리',  icon:'📚' },
  { path:'products',  label:'교구 관리',  icon:'🎒' },
]

function VendorSidebar({ vendorSession, currentPage, onNav, onLogout }) {
  return (
    <aside style={{
      width:'210px', minWidth:'210px', background: C.sidebar,
      display:'flex', flexDirection:'column', height:'100vh',
      position:'sticky', top:0, overflow:'hidden',
      fontFamily:'Noto Sans KR, sans-serif',
    }}>
      {/* 로고 */}
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'22px' }}>🎒</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>업체 파트너</div>
            <div style={{ fontSize:'11px', color:'#71717a', marginTop:'2px' }}>방과후 출석부</div>
          </div>
        </div>
      </div>

      {/* 업체 정보 */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:'#fff', marginBottom:'2px' }}>
          🏢 {vendorSession?.vendor?.name || '업체명'}
        </div>
        <div style={{ fontSize:'11px', color:'#71717a' }}>
          {vendorSession?.name || vendorSession?.email}
        </div>
        <div style={{ marginTop:'6px', display:'inline-block', fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:'#f97316', color:'#fff' }}>
          파트너
        </div>
      </div>

      {/* 네비 */}
      <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
        {VENDOR_NAV.map(item=>(
          <button key={item.path} onClick={()=>onNav(item.path)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px',
            padding:'10px 20px', background: currentPage===item.path ? '#f9731618' : 'none',
            border:'none', borderLeft: currentPage===item.path ? '3px solid #f97316' : '3px solid transparent',
            color: currentPage===item.path ? '#f97316' : '#a1a1aa',
            fontSize:'14px', fontWeight: currentPage===item.path ? 600 : 400,
            cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif',
          }}>
            <span style={{ fontSize:'16px', width:'20px', textAlign:'center' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* 로그아웃 */}
      <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
        <button onClick={onLogout} style={{
          background:'none', border:'none', cursor:'pointer', color:'#71717a',
          fontSize:'14px', display:'flex', alignItems:'center', gap:'8px',
          fontFamily:'Noto Sans KR, sans-serif',
        }}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────
// 대시보드 페이지
// ─────────────────────────────────────────────────────
function VendorDashboard({ vendorSession, subjects, products }) {
  const vendor = vendorSession?.vendor || {}
  const typeCount = (t) => products.filter(p=>p.type===t).length

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom:'24px' }}>
        <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>
          👋 안녕하세요, {vendor.name}!
        </h2>
        <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>
          업체 대시보드입니다. 과목과 교구를 등록하고 관리하세요.
        </p>
      </div>

      {/* 통계 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'28px' }}>
        {[
          ['📚', '등록 과목',   subjects.length, C.blue],
          ['🎒', '전체 교구',   products.length, C.primary],
          ['📅', '연간 등록',   typeCount('annual'), C.success],
          ['📖', '차시별 등록', typeCount('session'), C.purple],
        ].map(([icon,label,val,color])=>(
          <div key={label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px', textAlign:'center' }}>
            <div style={{ fontSize:'24px', marginBottom:'6px' }}>{icon}</div>
            <div style={{ fontSize:'24px', fontWeight:700, color }}>{val}</div>
            <div style={{ fontSize:'12px', color:C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 업체 정보 */}
      <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'20px', marginBottom:'20px' }}>
        <h3 style={{ fontSize:'15px', fontWeight:700, color:C.text, margin:'0 0 14px' }}>🏢 업체 정보</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px', fontSize:'13px' }}>
          {[
            ['업체명', vendor.name],
            ['담당자', vendor.managerName],
            ['연락처', vendor.phone],
            ['이메일', vendor.email],
            ['상태', vendor.status==='joined'?'✅ 가입완료':vendor.status],
          ].filter(([,v])=>v).map(([k,v])=>(
            <div key={k}>
              <span style={{ color:C.muted }}>{k}: </span>
              <span style={{ color:C.text, fontWeight:500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 가이드 */}
      <div style={{ background:'#fff7ed', borderRadius:'12px', border:`1px solid #fed7aa`, padding:'18px' }}>
        <h3 style={{ fontSize:'14px', fontWeight:700, color:C.primary, margin:'0 0 10px' }}>📋 등록 가이드</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', fontSize:'13px', color:C.text }}>
          {[
            ['1️⃣', '과목 관리', '판매하는 수업 과목을 먼저 등록하세요 (예: 로봇, 항공, 미술)'],
            ['2️⃣', '교구 관리', '과목별 교구를 등록하세요 — 연간·차시별·교구 유형 선택'],
            ['3️⃣', '선생님 연동', '(추후) 선생님이 업체 교구를 연동하고 주문할 수 있습니다'],
          ].map(([n,title,desc])=>(
            <div key={n} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
              <span>{n}</span>
              <div><strong>{title}</strong> — {desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 과목 관리 페이지
// ─────────────────────────────────────────────────────
function VendorSubjectsPage({ vendorId, subjects, onReload }) {
  const [form, setForm]     = useState({ name:'' })
  const [editing, setEditing] = useState(null)
  const { success }         = useToast()

  const handleSave = () => {
    if (!form.name.trim()) return
    const item = editing
      ? { ...editing, name: form.name }
      : { id:uid(), vendorId, name:form.name, createdAt:now() }
    HQSubjects.save(item)
    setForm({ name:'' })
    setEditing(null)
    onReload()
    success(editing ? '과목이 수정되었습니다.' : '과목이 추가되었습니다.')
  }

  const handleEdit = (s) => { setEditing(s); setForm({ name:s.name }) }
  const handleDelete = (id) => {
    if (!window.confirm('과목을 삭제하시겠습니까?\n연결된 교구도 함께 삭제됩니다.')) return
    HQSubjects.delete(id)
    HQProducts.bySubject(id).forEach(p=>HQProducts.delete(p.id))
    onReload()
    success('삭제되었습니다.')
  }

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'800px' }}>
      <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>📚 과목 관리</h2>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>판매하는 수업 과목을 등록하세요.</p>

      {/* 입력 */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px', padding:'16px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}` }}>
        <input style={{ ...iSt, flex:1 }} placeholder="과목명 (예: 로봇사이언스, 항공과학, 미술)"
          value={form.name} onChange={e=>setForm({name:e.target.value})}
          onKeyDown={e=>e.key==='Enter'&&handleSave()} />
        <button onClick={handleSave} style={{
          flexShrink:0, padding:'9px 20px', borderRadius:'9px', border:'none',
          background:C.primary, color:'#fff', fontWeight:700, fontSize:'14px',
          cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
        }}>
          {editing ? '수정 저장' : '+ 추가'}
        </button>
        {editing && (
          <button onClick={()=>{ setEditing(null); setForm({name:''}) }} style={{
            flexShrink:0, padding:'9px 14px', borderRadius:'9px', border:`1px solid ${C.border}`,
            background:C.card, color:C.muted, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>취소</button>
        )}
      </div>

      {/* 목록 */}
      {subjects.length === 0
        ? <EmptyState icon="📚" message="등록된 과목이 없습니다. 첫 과목을 추가해보세요!" />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {subjects.map(s => {
              const pCount = HQProducts.bySubject(s.id).length
              return (
                <div key={s.id} style={{
                  display:'flex', alignItems:'center', gap:'12px',
                  padding:'14px 18px', background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize:'20px' }}>📚</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'15px', fontWeight:600, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>교구 {pCount}개 등록됨</div>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={()=>handleEdit(s)} style={{
                      padding:'5px 12px', borderRadius:'7px', border:`1px solid ${C.border}`,
                      background:C.bg, fontSize:'12px', cursor:'pointer', color:C.muted, fontFamily:'Noto Sans KR, sans-serif',
                    }}>수정</button>
                    <button onClick={()=>handleDelete(s.id)} style={{
                      padding:'5px 12px', borderRadius:'7px', border:'1px solid #fca5a5',
                      background:'#fef2f2', fontSize:'12px', cursor:'pointer', color:C.danger, fontFamily:'Noto Sans KR, sans-serif',
                    }}>삭제</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 교구 관리 페이지
// ─────────────────────────────────────────────────────
function VendorProductsPage({ vendorId, subjects, products, onReload }) {
  const [selSubject, setSelSubject] = useState('')
  const [form, setForm]   = useState({ name:'', subjectId:'', type:'annual', price:'', description:'' })
  const [editing, setEditing] = useState(null)
  const { success }       = useToast()

  const set = (k, v) => setForm(f=>({...f,[k]:v}))

  const handleSave = () => {
    if (!form.name.trim()) return alert('교구명을 입력해주세요.')
    const item = editing
      ? { ...editing, ...form, price: Number(form.price)||0 }
      : { id:uid(), vendorId, ...form, price: Number(form.price)||0, createdAt:now() }
    HQProducts.save(item)
    setForm({ name:'', subjectId:'', type:'annual', price:'', description:'' })
    setEditing(null)
    onReload()
    success(editing ? '교구가 수정되었습니다.' : '교구가 추가되었습니다.')
  }

  const handleEdit = (p) => {
    setEditing(p)
    setForm({ name:p.name, subjectId:p.subjectId||'', type:p.type, price:p.price||'', description:p.description||'' })
  }

  const handleDelete = (id) => {
    if (!window.confirm('교구를 삭제하시겠습니까?')) return
    HQProducts.delete(id)
    onReload()
    success('삭제되었습니다.')
  }

  const TYPE_LABEL = { annual:'📅 연간 등록', session:'📖 차시별 등록', item:'📦 교구 등록' }
  const TYPE_COLOR = { annual:{ bg:'#eff6ff', color:C.blue, border:'#bfdbfe' }, session:{ bg:'#f5f3ff', color:C.purple, border:'#ddd6fe' }, item:{ bg:'#f0fdf4', color:C.success, border:'#86efac' } }

  const filteredProducts = selSubject ? products.filter(p=>p.subjectId===selSubject) : products

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'900px' }}>
      <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>🎒 교구 관리</h2>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>
        연간·차시별·교구 유형으로 등록하세요. 선생님이 연동하여 주문할 수 있습니다.
      </p>

      {/* 등록 폼 */}
      <div style={{ padding:'18px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, marginBottom:'24px' }}>
        <div style={{ fontSize:'14px', fontWeight:600, color:C.text, marginBottom:'12px' }}>
          {editing ? '교구 수정' : '+ 새 교구 추가'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>교구명 *</label>
            <input style={iSt} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="예: 1단계 로봇킷" />
          </div>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>과목</label>
            <select style={iSt} value={form.subjectId} onChange={e=>set('subjectId',e.target.value)}>
              <option value="">과목 선택 (선택)</option>
              {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>등록 유형 *</label>
            <select style={iSt} value={form.type} onChange={e=>set('type',e.target.value)}>
              <option value="annual">📅 연간 등록</option>
              <option value="session">📖 차시별 등록</option>
              <option value="item">📦 교구 등록</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>가격 (원)</label>
            <input style={iSt} type="number" value={form.price} onChange={e=>set('price',e.target.value)} placeholder="예: 15000" />
          </div>
        </div>
        <div style={{ marginBottom:'10px' }}>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>설명 (선택)</label>
          <input style={iSt} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="교구 설명, 구성품, 학년 대상 등" />
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          {editing && (
            <button onClick={()=>{ setEditing(null); setForm({ name:'',subjectId:'',type:'annual',price:'',description:'' }) }} style={{
              padding:'8px 16px', borderRadius:'8px', border:`1px solid ${C.border}`,
              background:C.card, color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
            }}>취소</button>
          )}
          <button onClick={handleSave} style={{
            padding:'8px 20px', borderRadius:'8px', border:'none',
            background:C.primary, color:'#fff', fontWeight:700, fontSize:'14px',
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{editing ? '수정 저장' : '+ 교구 추가'}</button>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
        <button onClick={()=>setSelSubject('')} style={{
          padding:'6px 14px', borderRadius:'999px', border:`1.5px solid ${!selSubject?C.primary:C.border}`,
          background: !selSubject?'#fff7ed':C.card, color:!selSubject?C.primary:C.muted,
          fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
        }}>전체 ({products.length})</button>
        {subjects.map(s=>(
          <button key={s.id} onClick={()=>setSelSubject(s.id)} style={{
            padding:'6px 14px', borderRadius:'999px', border:`1.5px solid ${selSubject===s.id?C.primary:C.border}`,
            background: selSubject===s.id?'#fff7ed':C.card, color:selSubject===s.id?C.primary:C.muted,
            fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>{s.name} ({HQProducts.bySubject(s.id).length})</button>
        ))}
      </div>

      {/* 목록 */}
      {filteredProducts.length === 0
        ? <EmptyState icon="🎒" message="등록된 교구가 없습니다." />
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'12px' }}>
            {filteredProducts.map(p => {
              const subj = subjects.find(s=>s.id===p.subjectId)
              const tc = TYPE_COLOR[p.type] || TYPE_COLOR.item
              return (
                <div key={p.id} style={{
                  background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`,
                  padding:'16px', display:'flex', flexDirection:'column', gap:'8px',
                }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:C.text, lineHeight:1.4 }}>🎒 {p.name}</div>
                    <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                      <button onClick={()=>handleEdit(p)} style={{ padding:'3px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:C.bg, fontSize:'11px', cursor:'pointer', color:C.muted, fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                      <button onClick={()=>handleDelete(p.id)} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', color:C.danger, fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'999px', background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`, fontWeight:600 }}>
                      {TYPE_LABEL[p.type]}
                    </span>
                    {subj && <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'999px', background:'#f3f4f6', color:C.muted, border:`1px solid ${C.border}` }}>{subj.name}</span>}
                  </div>
                  {(p.price > 0 || p.description) && (
                    <div style={{ fontSize:'12px', color:C.muted, lineHeight:1.5 }}>
                      {p.price > 0 && <div>💰 {Number(p.price).toLocaleString()}원</div>}
                      {p.description && <div>📝 {p.description}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 메인 VendorApp 컴포넌트
// ─────────────────────────────────────────────────────
export function VendorApp({ vendorSession, onLogout }) {
  const [page, setPage]         = useState('dashboard')
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])

  const vendorId = vendorSession?.vendorId

  const reload = useCallback(() => {
    if (!vendorId) return
    setSubjects(HQSubjects.byVendor(vendorId))
    setProducts(HQProducts.byVendor(vendorId))
  }, [vendorId])

  useEffect(() => { reload() }, [reload])

  const handleLogout = () => {
    localStorage.removeItem(LS_SESSION)
    onLogout()
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Noto Sans KR, sans-serif' }}>
      <VendorSidebar
        vendorSession={vendorSession}
        currentPage={page}
        onNav={setPage}
        onLogout={handleLogout}
      />
      <main style={{ flex:1, background:'#f9fafb', overflowY:'auto' }}>
        {page === 'dashboard' && <VendorDashboard vendorSession={vendorSession} subjects={subjects} products={products} />}
        {page === 'subjects'  && <VendorSubjectsPage vendorId={vendorId} subjects={subjects} onReload={reload} />}
        {page === 'products'  && <VendorProductsPage vendorId={vendorId} subjects={subjects} products={products} onReload={reload} />}
      </main>
    </div>
  )
}
