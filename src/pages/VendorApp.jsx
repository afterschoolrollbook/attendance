/**
 * VendorApp.jsx
 * 업체 전용 앱 — 전체 Supabase 저장
 * ✅ 교구/단계/목차/분기/차시/파일 모두 Supabase
 * ✅ 연도별 관리
 * ✅ 금액: 시중소비자가/학교공급가/지사공급가/선생님공급가
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { uid, now } from '../lib/utils.js'
import { dbCall } from '../lib/supabase.js'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary:'#f97316', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', success:'#16a34a', danger:'#ef4444',
  card:'#fff', bg:'#f9fafb', sidebar:'#1c1917',
  blue:'#3b82f6', purple:'#8b5cf6', warning:'#f59e0b',
}
const LS_SESSION = 'asa_vendor_session'

// ✅ Supabase DB 헬퍼
const DB = {
  // 과목
  subjectsByVendor: async (vid) => ((await dbCall('getAll','hqVendorSubjects'))||[]).filter(s=>s.vendorId===vid),
  saveSubject:      async (s)   => dbCall('upsert','hqVendorSubjects',{data:s}),
  deleteSubject:    async (id)  => dbCall('delete','hqVendorSubjects',{id}),
  // 교구
  productsByVendor: async (vid) => ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.vendorId===vid),
  saveProduct:      async (p)   => dbCall('upsert','hqVendorProducts',{data:p}),
  deleteProduct:    async (id)  => dbCall('delete','hqVendorProducts',{id}),
  // A형 단계
  stagesByProduct:  async (pid) => ((await dbCall('getAll','hqVendorStages'))||[]).filter(s=>s.productId===pid).sort((a,b)=>a.order-b.order),
  saveStage:        async (s)   => dbCall('upsert','hqVendorStages',{data:s}),
  deleteStage:      async (id)  => dbCall('delete','hqVendorStages',{id}),
  // A형 목차
  contentsByStage:  async (sid) => ((await dbCall('getAll','hqVendorContents'))||[]).filter(c=>c.stageId===sid).sort((a,b)=>a.session-b.session),
  saveContent:      async (c)   => dbCall('upsert','hqVendorContents',{data:c}),
  deleteContent:    async (id)  => dbCall('delete','hqVendorContents',{id}),
  // B형 분기
  quartersByProduct:async (pid) => ((await dbCall('getAll','hqVendorQuarters'))||[]).filter(q=>q.productId===pid).sort((a,b)=>a.order-b.order),
  saveQuarter:      async (q)   => dbCall('upsert','hqVendorQuarters',{data:q}),
  deleteQuarter:    async (id)  => dbCall('delete','hqVendorQuarters',{id}),
  // B형 차시
  sessionsByQuarter:async (qid) => ((await dbCall('getAll','hqVendorSessions'))||[]).filter(s=>s.quarterId===qid).sort((a,b)=>a.session-b.session),
  saveSession:      async (s)   => dbCall('upsert','hqVendorSessions',{data:s}),
  deleteSession:    async (id)  => dbCall('delete','hqVendorSessions',{id}),
  // 파일
  filesByProduct:   async (pid) => ((await dbCall('getAll','hqVendorFiles'))||[]).filter(f=>f.productId===pid),
  saveFile:         async (f)   => dbCall('upsert','hqVendorFiles',{data:f}),
  deleteFile:       async (id)  => dbCall('delete','hqVendorFiles',{id}),
}

const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb',
  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

const SUBJECT_TYPES = [
  { value:'A', label:'A형', desc:'로봇',                         color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe' },
  { value:'B', label:'B형', desc:'생명과학 / 과학실험 / 보드게임', color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
  { value:'C', label:'C형', desc:'미술 / 체육 / 기타',            color:'#f97316', bg:'#fff7ed', border:'#fed7aa' },
]

const THIS_YEAR = new Date().getFullYear()
const YEARS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1]

function Btn({ children, onClick, disabled, secondary, danger, style={} }) {
  const bg    = disabled?'#d1d5db':danger?'#ef4444':secondary?'#fff':'#f97316'
  const color = disabled?'#9ca3af':secondary?'#374151':'#fff'
  const bdr   = secondary?'1.5px solid #e5e7eb':'none'
  return (
    <button type="button" onClick={disabled?undefined:onClick} disabled={!!disabled} style={{
      padding:'8px 16px', borderRadius:'9px', border:bdr, background:bg, color,
      fontWeight:600, fontSize:'13px', cursor:disabled?'not-allowed':'pointer',
      fontFamily:'Noto Sans KR, sans-serif', ...style,
    }}>{children}</button>
  )
}

function Empty({ icon, msg }) {
  return (
    <div style={{ textAlign:'center', padding:'40px 20px', color:C.muted }}>
      <div style={{ fontSize:'36px', marginBottom:'8px' }}>{icon}</div>
      <div style={{ fontSize:'14px' }}>{msg}</div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'360px', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize:'15px', color:C.text, marginBottom:'20px', lineHeight:'1.6', whiteSpace:'pre-line' }}>{message}</div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
          <Btn onClick={onClose} secondary>취소</Btn>
          <Btn onClick={()=>{ onConfirm(); onClose() }} danger>확인</Btn>
        </div>
      </div>
    </div>
  )
}

function useConfirmModal() {
  const [state, setState] = React.useState(null)
  const confirm = (message) => new Promise(resolve => setState({ message, resolve }))
  const modal = state ? (
    <ConfirmModal
      message={state.message}
      onConfirm={()=>state.resolve(true)}
      onClose={()=>{ state.resolve(false); setState(null) }}
    />
  ) : null
  return { confirm, modal }
}

// 금액 입력 그룹
function PriceFields({ form, onChange }) {
  const fields = [
    { key:'priceRetail',  label:'💰 시중소비자가' },
    { key:'priceSchool',  label:'🏫 학교공급가' },
    { key:'priceBranch',  label:'🏢 지사공급가' },
    { key:'priceTeacher', label:'👨‍🏫 선생님공급가' },
  ]
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
      {fields.map(({key,label})=>(
        <div key={key}>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>{label}</label>
          <input style={iSt} type="number" value={form[key]||''} onChange={e=>onChange(key,e.target.value)} placeholder="0" />
        </div>
      ))}
    </div>
  )
}

// 금액 표시
function PriceTags({ p }) {
  const items = [
    { label:'소비자가', val:p.priceRetail,  color:C.muted },
    { label:'학교',     val:p.priceSchool,  color:C.blue },
    { label:'지사',     val:p.priceBranch,  color:C.purple },
    { label:'선생님',   val:p.priceTeacher, color:C.success },
  ].filter(x=>x.val>0)
  if (!items.length) return null
  return (
    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'4px' }}>
      {items.map(({label,val,color})=>(
        <span key={label} style={{ fontSize:'11px', color }}>{label} {Number(val).toLocaleString()}원</span>
      ))}
    </div>
  )
}

// ─── 사이드바
const VENDOR_NAV = [
  { path:'dashboard', label:'대시보드',  icon:'🏠' },
  { path:'subjects',  label:'과목 관리', icon:'📚' },
  { path:'products',  label:'교구 관리', icon:'🎒' },
]

function VendorSidebar({ vendorSession, currentPage, onNav, onLogout }) {
  return (
    <aside style={{ width:'210px', minWidth:'210px', background:C.sidebar, display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0, overflow:'hidden', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'22px' }}>🎒</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>업체 파트너</div>
            <div style={{ fontSize:'11px', color:'#71717a', marginTop:'2px' }}>방과후 출석부</div>
          </div>
        </div>
      </div>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:'#fff', marginBottom:'2px' }}>🏢 {vendorSession?.vendor?.name||'업체명'}</div>
        <div style={{ fontSize:'11px', color:'#71717a' }}>{vendorSession?.name||vendorSession?.email}</div>
        <div style={{ marginTop:'6px', display:'inline-block', fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:'#f97316', color:'#fff' }}>파트너</div>
      </div>
      <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
        {VENDOR_NAV.map(item=>(
          <button key={item.path} type="button" onClick={()=>onNav(item.path)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px',
            background:currentPage===item.path?'#f9731618':'none', border:'none',
            borderLeft:currentPage===item.path?'3px solid #f97316':'3px solid transparent',
            color:currentPage===item.path?'#f97316':'#a1a1aa',
            fontSize:'14px', fontWeight:currentPage===item.path?600:400,
            cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif',
          }}>
            <span style={{ fontSize:'16px', width:'20px', textAlign:'center' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
        <button type="button" onClick={onLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px', fontFamily:'Noto Sans KR, sans-serif' }}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  )
}

// ─── 대시보드
function VendorDashboard({ vendorSession, subjects, products }) {
  const vendor = vendorSession?.vendor || {}
  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom:'24px' }}>
        <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>👋 안녕하세요, {vendor.name}!</h2>
        <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>과목과 교구를 등록하고 관리하세요.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'28px' }}>
        {[
          ['📚','전체 과목', subjects.length, C.blue],
          ['🅰️','A형 과목', subjects.filter(s=>s.subjectType==='A').length, '#3b82f6'],
          ['🅱️','B/C형 과목', subjects.filter(s=>s.subjectType!=='A').length, C.success],
          ['🎒','전체 교구', products.length, C.primary],
        ].map(([icon,label,val,color])=>(
          <div key={label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px', textAlign:'center' }}>
            <div style={{ fontSize:'24px', marginBottom:'6px' }}>{icon}</div>
            <div style={{ fontSize:'24px', fontWeight:700, color }}>{val}</div>
            <div style={{ fontSize:'12px', color:C.muted }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff7ed', borderRadius:'12px', border:'1px solid #fed7aa', padding:'18px' }}>
        <h3 style={{ fontSize:'14px', fontWeight:700, color:C.primary, margin:'0 0 10px' }}>📋 등록 가이드</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', fontSize:'13px', color:C.text }}>
          {[
            ['1️⃣','과목 관리','A형(로봇 등) / B형 / C형 선택 후 과목 등록'],
            ['2️⃣','교구 관리','연도별로 교구 등록. A형은 단계·목차, B형은 분기·차시 관리'],
            ['3️⃣','선생님 연동','(추후) 선생님이 연동하여 주문할 수 있습니다'],
          ].map(([n,t,d])=>(
            <div key={n} style={{ display:'flex', gap:'10px' }}>
              <span>{n}</span><div><strong>{t}</strong> — {d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 과목 관리
function VendorSubjectsPage({ vendorId, subjects, onReload }) {
  const [form, setForm]       = useState({ name:'', subjectType:'A' })
  const [editing, setEditing] = useState(null)
  const { success, error }    = useToast()
  const { confirm, modal }    = useConfirmModal()

  const handleSave = async () => {
    if (!form.name.trim()) { error('과목명을 입력해주세요.'); return }
    const item = editing
      ? { ...editing, name:form.name, subjectType:form.subjectType }
      : { id:uid(), vendorId, name:form.name, subjectType:form.subjectType, createdAt:now() }
    await DB.saveSubject(item)
    setForm({ name:'', subjectType:'A' })
    setEditing(null)
    onReload()
    success(editing?'수정되었습니다.':'과목이 추가되었습니다.')
  }

  const handleDelete = async (id) => {
    const ok = await confirm('과목을 삭제하시겠습니까?\n연결된 교구도 함께 삭제됩니다.')
    if (!ok) return
    await DB.deleteSubject(id)
    onReload()
    success('삭제되었습니다.')
  }

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'800px' }}>
      {modal}
      <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>📚 과목 관리</h2>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>과목 유형을 선택하고 과목명을 입력하세요.</p>

      <div style={{ padding:'18px', background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, marginBottom:'24px' }}>
        <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'8px', fontWeight:600 }}>과목 유형 *</label>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
          {SUBJECT_TYPES.map(t=>(
            <button key={t.value} type="button" onClick={()=>setForm(f=>({...f,subjectType:t.value}))} style={{
              padding:'10px 18px', borderRadius:'10px',
              border:`2px solid ${form.subjectType===t.value?t.color:C.border}`,
              background:form.subjectType===t.value?t.bg:C.card,
              cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textAlign:'left',
            }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:form.subjectType===t.value?t.color:C.text }}>{t.label}</div>
              <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <input style={{ ...iSt, flex:1 }} placeholder="과목명 입력"
            value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&handleSave()} />
          <button type="button" onClick={handleSave} style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            {editing?'수정 저장':'+ 추가'}
          </button>
          {editing && <Btn onClick={()=>{ setEditing(null); setForm({name:'',subjectType:'A'}) }} secondary>취소</Btn>}
        </div>
      </div>

      {subjects.length===0 ? <Empty icon="📚" msg="등록된 과목이 없습니다." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {subjects.map(s=>{
            const t = SUBJECT_TYPES.find(x=>x.value===s.subjectType)||SUBJECT_TYPES[0]
            return (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 18px', background:C.card, borderRadius:'12px', border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', background:t.bg, color:t.color, border:`1px solid ${t.border}`, flexShrink:0 }}>{t.label}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'15px', fontWeight:600, color:C.text }}>{s.name}</div>
                  <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{t.desc}</div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <Btn onClick={()=>{ setEditing(s); setForm({name:s.name,subjectType:s.subjectType||'A'}) }} secondary style={{ padding:'5px 12px', fontSize:'12px' }}>수정</Btn>
                  <Btn onClick={()=>handleDelete(s.id)} danger style={{ padding:'5px 12px', fontSize:'12px' }}>삭제</Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 공통 교구 등록 폼
const EMPTY_PROD = { name:'', year:THIS_YEAR, priceRetail:'', priceSchool:'', priceBranch:'', priceTeacher:'' }

function ProdForm({ form, setForm, onSave, onCancel, editing }) {
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <div style={{ padding:'16px', background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, marginBottom:'16px' }}>
      <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px' }}>교구 등록</div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'8px', marginBottom:'10px' }}>
        <div>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>교구명 *</label>
          <input style={iSt} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="교구명" />
        </div>
        <div>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>연도</label>
          <select style={iSt} value={form.year} onChange={e=>set('year',Number(e.target.value))}>
            {YEARS.map(y=><option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
      </div>
      <PriceFields form={form} onChange={set} />
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'10px' }}>
        {editing && <Btn onClick={onCancel} secondary>취소</Btn>}
        <button type="button" onClick={onSave} style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {editing?'수정 저장':'+ 교구 추가'}
        </button>
      </div>
    </div>
  )
}

// ─── 공통 교구 관리 (Supplies.jsx 방식과 동일)
function TypeProducts({ vendorId, subjectId, products, onReload }) {
  const { success, error } = useToast()
  const { confirm, modal } = useConfirmModal()

  const [productModal, setProductModal]   = useState(false)
  const [productForm, setProductForm]     = useState({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3 })
  const [productStageTab, setProductStageTab] = useState(1)
  const [stageSessionTitles, setStageSessionTitles] = useState({})
  const [productPlanList, setProductPlanList] = useState([])
  const [editingProduct, setEditingProduct] = useState(null)

  const subjectProds = products.filter(p => p.subjectId === subjectId)

  const loadPlans = async () => {
    const all = (await dbCall('getAll', 'hqVendorStages')) || []
    // hqVendorContents를 차시로 사용
    const contents = (await dbCall('getAll', 'hqVendorContents')) || []
    setProductPlanList(contents)
  }

  useEffect(() => { loadPlans() }, [])

  // 샘플 다운로드
  const downloadSample = async () => {
    const rows = [
      ['교구명', '단계', '차시번호', '차시제목', '준비물'],
      ['큐보', 1, 1, '큐보 1단계 1차시', '큐보 로봇'],
      ['큐보', 1, 2, '큐보 1단계 2차시', '큐보 로봇'],
      ['큐보', 2, 1, '큐보 2단계 1차시', '큐보 로봇'],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{wch:20},{wch:8},{wch:10},{wch:30},{wch:20}]
    XLSX.utils.book_append_sheet(wb, ws, '교구목록샘플')
    XLSX.writeFile(wb, '교구목록_샘플양식.xlsx')
  }

  // 현재 교구 다운로드
  const downloadProducts = async () => {
    const rows = [['교구명', '단계', '차시번호', '차시제목', '준비물']]
    subjectProds.forEach(p => {
      const plans = productPlanList.filter(x => x.productId === p.id).sort((a,b) => a.stage - b.stage || a.sessionNo - b.sessionNo)
      if (plans.length === 0) {
        rows.push([p.name, '', '', '', ''])
      } else {
        plans.forEach(pl => rows.push([p.name, pl.stage||'', pl.sessionNo||'', pl.title||'', pl.supplies||'']))
      }
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{wch:20},{wch:8},{wch:10},{wch:30},{wch:20}]
    XLSX.utils.book_append_sheet(wb, ws, '교구목록')
    XLSX.writeFile(wb, `교구목록_${new Date().toLocaleDateString('ko-KR')}.xlsx`)
  }

  // 일괄 등록
  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
      const dataRows = rows.slice(1).filter(r => r[0])
      if (!dataRows.length) { error('등록할 데이터가 없습니다.'); return }

      // 교구명별 그룹핑
      const productMap = {}
      dataRows.forEach(r => {
        const name      = String(r[0]||'').trim()
        const stage     = Number(r[1])||1
        const sessionNo = Number(r[2])||1
        const title     = String(r[3]||'').trim()
        const supplies  = String(r[4]||'').trim()
        if (!name) return
        if (!productMap[name]) productMap[name] = []
        productMap[name].push({ stage, sessionNo, title, supplies })
      })

      let productCount = 0, planCount = 0
      for (const [name, plans] of Object.entries(productMap)) {
        let product = subjectProds.find(p => p.name === name)
        if (!product) {
          const maxStage = Math.max(...plans.map(p => p.stage))
          const newId = uid()
          await DB.saveProduct({ id:newId, vendorId, subjectId, name, maxStage, sessionsPerStage:12, alertSession:3, createdAt:now() })
          product = { id:newId }
          productCount++
        }
        for (const pl of plans) {
          const exists = productPlanList.find(x => x.productId === product.id && x.stage === pl.stage && x.sessionNo === pl.sessionNo)
          if (!exists) {
            await DB.saveContent({ id:uid(), stageId:`${product.id}_${pl.stage}`, productId:product.id, stage:pl.stage, sessionNo:pl.sessionNo, title:pl.title, supplies:pl.supplies, createdAt:now() })
            planCount++
          }
        }
      }
      await loadPlans()
      onReload()
      success(`교구 ${productCount}개, 차시 ${planCount}개 등록 완료!`)
    } catch(err) {
      error('파일 읽기 실패: ' + err.message)
    }
  }

  const openProductModal = (existingProduct = null) => {
    if (existingProduct) {
      const maxS = existingProduct.maxStage || 10
      const perS = existingProduct.sessionsPerStage || 12
      const titles = {}
      for (let s = 1; s <= maxS; s++) {
        const plans = productPlanList
          .filter(p => p.productId === existingProduct.id && p.stage === s)
          .sort((a, b) => a.sessionNo - b.sessionNo)
        titles[s] = Array.from({ length: perS }, (_, i) => ({
          title: plans[i]?.title || '',
          memo: plans[i]?.supplies || '',
        }))
      }
      setProductForm({ id: existingProduct.id, name: existingProduct.name, maxStage: maxS, sessionsPerStage: perS, alertSession: existingProduct.alertSession || 3 })
      setStageSessionTitles(titles)
      setEditingProduct(existingProduct)
    } else {
      const titles = {}
      for (let s = 1; s <= 10; s++) {
        titles[s] = Array.from({ length: 12 }, () => ({ title: '', memo: '' }))
      }
      setProductForm({ id: null, name: '', maxStage: 10, sessionsPerStage: 12, alertSession: 3 })
      setStageSessionTitles(titles)
      setEditingProduct(null)
    }
    setProductStageTab(1)
    setProductModal(true)
  }

  const saveProduct = async () => {
    if (!productForm.name.trim()) { error('교구명을 입력하세요'); return }
    const isEdit = !!productForm.id
    const productId = isEdit ? productForm.id : uid()

    if (isEdit) {
      await DB.saveProduct({ ...editingProduct, name: productForm.name, maxStage: productForm.maxStage, sessionsPerStage: productForm.sessionsPerStage, alertSession: productForm.alertSession })
    } else {
      await DB.saveProduct({ id: productId, vendorId, subjectId, name: productForm.name, maxStage: productForm.maxStage, sessionsPerStage: productForm.sessionsPerStage, alertSession: productForm.alertSession, createdAt: now() })
    }

    // 단계별 차시 저장
    for (let stage = 1; stage <= productForm.maxStage; stage++) {
      const items = stageSessionTitles[stage] || []
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        const t = item?.title || ''
        const m = item?.memo || ''
        if (!t.trim()) continue
        const sessionNo = idx + 1
        const existing = productPlanList.find(p => p.productId === productId && p.stage === stage && p.sessionNo === sessionNo)
        if (existing) {
          await DB.saveContent({ ...existing, title: t, supplies: m })
        } else {
          await DB.saveContent({ id: uid(), stageId: `${productId}_${stage}`, productId, stage, sessionNo, title: t, supplies: m, createdAt: now() })
        }
      }
    }

    await loadPlans()
    onReload()
    setProductModal(false)
    success(isEdit ? '수정되었습니다.' : '교구가 등록되었습니다.')
  }

  const deleteProduct = async (id) => {
    const ok = await confirm('교구를 삭제하시겠습니까?')
    if (!ok) return
    await DB.deleteProduct(id)
    onReload()
    success('삭제되었습니다.')
  }

  const iSt2 = { width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }

  return (
    <div>
      {modal}

      {/* 교구 목록 */}
      {subjectProds.length === 0
        ? <Empty icon="📦" msg="등록된 교구가 없습니다." />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
            {subjectProds.map(p => {
              const plans = productPlanList.filter(x => x.productId === p.id)
              const stages = [...new Set(plans.map(x => x.stage))].sort((a,b)=>a-b)
              return (
                <div key={p.id} style={{ padding:'12px 16px', borderRadius:'12px', border:`1.5px solid ${C.border}`, background:C.card, display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>📦 {p.name}</div>
                    <div style={{ fontSize:'11px', color:C.muted, marginTop:'3px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {stages.map(st => {
                        const cnt = plans.filter(x => x.stage === st).length
                        return <span key={st} style={{ background:'#f5f3ff', color:'#7c3aed', borderRadius:'4px', padding:'1px 6px' }}>{st}단계({cnt}차시)</span>
                      })}
                      {stages.length === 0 && <span style={{ color:C.muted }}>차시 미등록</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button type="button" onClick={() => openProductModal(p)} style={{ padding:'4px 12px', borderRadius:'7px', border:'1px solid #bfdbfe', background:'#eff6ff', color:C.blue, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                    <button type="button" onClick={() => deleteProduct(p.id)} style={{ padding:'4px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* 버튼 그룹 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
        <button type="button" onClick={downloadSample} style={{ padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #3b82f6', background:'#eff6ff', color:'#3b82f6', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📋 샘플 다운로드</button>
        <label style={{ padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #8b5cf6', background:'#f5f3ff', color:'#8b5cf6', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          📤 일괄 등록
          <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleBulkUpload} />
        </label>
        {subjectProds.length > 0 && (
          <button type="button" onClick={downloadProducts} style={{ padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #16a34a', background:'#f0fdf4', color:'#16a34a', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>⬇ 다운로드</button>
        )}
      </div>

      {/* 교구 등록 버튼 */}
      <button type="button" onClick={() => openProductModal()} style={{ width:'100%', padding:'10px', borderRadius:'10px', border:`2px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
        + 교구 등록
      </button>

      {/* 교구 등록/수정 모달 */}
      {productModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if (e.target === e.currentTarget) setProductModal(false) }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'560px', maxWidth:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{productForm.id ? '🤖 교구 수정' : '🤖 교구 등록'}</div>
              <button type="button" onClick={() => setProductModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
            </div>

            <div style={{ padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* 교구명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={productForm.name} onChange={e => setProductForm(v => ({...v, name:e.target.value}))}
                  placeholder="예: 큐보 1단계" style={iSt2} autoFocus />
              </div>

              {/* 기본 설정 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>최대 단계</label>
                  <input type="number" min={1} max={20} value={productForm.maxStage}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setProductForm(v => ({...v, maxStage:val}))
                      setStageSessionTitles(prev => {
                        const next = {...prev}
                        for (let s = 1; s <= val; s++) {
                          if (!next[s]) next[s] = Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))
                        }
                        return next
                      })
                      if (productStageTab > val) setProductStageTab(val)
                    }}
                    style={{ ...iSt2, textAlign:'center' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계당 차시 수</label>
                  <input type="number" min={1} max={50} value={productForm.sessionsPerStage}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setProductForm(v => ({...v, sessionsPerStage:val}))
                      setStageSessionTitles(prev => {
                        const newTitles = {}
                        for (let s = 1; s <= productForm.maxStage; s++) {
                          const cur = prev[s] || []
                          newTitles[s] = Array.from({length: val}, (_, i) => cur[i] || {title:'', memo:''})
                        }
                        return newTitles
                      })
                    }}
                    style={{ ...iSt2, textAlign:'center' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>준비 알림 (차시 전)</label>
                  <input type="number" min={1} max={50} value={productForm.alertSession}
                    onChange={e => setProductForm(v => ({...v, alertSession:Number(e.target.value)}))}
                    style={{ ...iSt2, textAlign:'center' }} />
                </div>
              </div>

              {/* 단계 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계 선택</label>
                <select value={productStageTab}
                  onChange={e => {
                    const st = Number(e.target.value)
                    setProductStageTab(st)
                    setStageSessionTitles(prev => ({
                      ...prev,
                      [st]: prev[st] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))
                    }))
                  }}
                  style={{ ...iSt2, background:'#fff' }}>
                  {Array.from({length: productForm.maxStage}, (_, i) => i+1).map(s => {
                    const filled = (stageSessionTitles[s] || []).filter(t => (t?.title || '').trim()).length
                    return <option key={s} value={s}>{s}단계 {filled > 0 ? `(${filled}개 입력됨)` : ''}</option>
                  })}
                </select>
              </div>

              {/* 차시 목록 */}
              <div style={{ border:'1px solid #e5e7eb', borderRadius:'10px', overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>📝 {productStageTab}단계 차시별 제목</span>
                  <span style={{ fontSize:'11px', color:C.muted }}>
                    {(stageSessionTitles[productStageTab]||[]).filter(i => (i?.title||'').trim()).length} / {(stageSessionTitles[productStageTab]||[]).length}개 입력
                  </span>
                </div>
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:'1px solid #e5e7eb', display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>차시</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>제목</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>준비물</span>
                  <span></span>
                </div>
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'220px', overflowY:'auto' }}>
                  {(stageSessionTitles[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))).map((item, idx) => {
                    const t = item?.title || ''
                    const m = item?.memo || ''
                    const updateItem = (field, val) => {
                      setStageSessionTitles(prev => {
                        const cur = [...(prev[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''})))]
                        cur[idx] = { ...cur[idx], title: field==='title' ? val : t, memo: field==='memo' ? val : m }
                        return {...prev, [productStageTab]: cur}
                      })
                    }
                    return (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                        <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{idx+1}차시</span>
                        <input value={t} onChange={e => updateItem('title', e.target.value)} placeholder="제목 (선택)" style={{ ...iSt2, padding:'5px 8px', fontSize:'12px' }} />
                        <input value={m} onChange={e => updateItem('memo', e.target.value)} placeholder="준비물 (선택)" style={{ ...iSt2, padding:'5px 8px', fontSize:'12px' }} />
                        <button type="button" onClick={() => setStageSessionTitles(prev => {
                          const cur = [...(prev[productStageTab]||[])]
                          cur.splice(idx, 1)
                          return {...prev, [productStageTab]: cur}
                        })} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding:'8px 14px', borderTop:'1px solid #e5e7eb' }}>
                  <button type="button" onClick={() => setStageSessionTitles(prev => {
                    const cur = [...(prev[productStageTab] || [])]
                    cur.push({title:'', memo:''})
                    return {...prev, [productStageTab]: cur}
                  })} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:'1.5px dashed #e5e7eb', background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                    + 차시 추가
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding:'14px 20px', borderTop:'1px solid #e5e7eb', display:'flex', gap:'8px' }}>
              <button type="button" onClick={saveProduct} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
              <button type="button" onClick={() => setProductModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── A형 교구 관리
function TypeAProducts({ vendorId, subjectId, products, onReload }) {
  return <TypeProducts vendorId={vendorId} subjectId={subjectId} products={products} onReload={onReload} />
}

// ─── B형·C형 교구 관리
function TypeBCProducts({ vendorId, subjectId, products, onReload }) {
  return <TypeProducts vendorId={vendorId} subjectId={subjectId} products={products} onReload={onReload} />
}

// ─── 교구 관리 페이지
function VendorProductsPage({ vendorId, subjects, products, onReload }) {
  const [filterSubjectId, setFilterSubjectId] = useState('')
  const filteredSubjects = filterSubjectId ? subjects.filter(s=>s.id===filterSubjectId) : subjects

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'1000px' }}>
      <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>🎒 교구 관리</h2>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'20px' }}>과목을 클릭하면 해당 과목만 보입니다.</p>

      {subjects.length===0 ? (
        <div style={{ padding:'18px', background:'#fff7ed', borderRadius:'12px', border:'1px solid #fed7aa', fontSize:'14px', color:C.primary }}>
          ⚠️ 먼저 <strong>과목 관리</strong>에서 과목을 등록해주세요.
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'24px' }}>
            <button type="button" onClick={()=>setFilterSubjectId('')} style={{ padding:'8px 18px', borderRadius:'999px', border:`2px solid ${filterSubjectId===''?C.primary:C.border}`, background:filterSubjectId===''?'#fff7ed':C.card, color:filterSubjectId===''?C.primary:C.muted, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>전체</button>
            {subjects.map(s=>{
              const t = SUBJECT_TYPES.find(x=>x.value===s.subjectType)||SUBJECT_TYPES[0]
              const isSel = filterSubjectId===s.id
              return (
                <button key={s.id} type="button" onClick={()=>setFilterSubjectId(isSel?'':s.id)} style={{ padding:'8px 18px', borderRadius:'999px', border:`2px solid ${isSel?t.color:C.border}`, background:isSel?t.bg:C.card, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <span style={{ fontSize:'11px', fontWeight:700, color:isSel?t.color:C.muted }}>{t.label} </span>
                  <span style={{ fontSize:'13px', fontWeight:600, color:isSel?t.color:C.text }}>{s.name}</span>
                </button>
              )
            })}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'28px' }}>
            {filteredSubjects.map(s=>{
              const t = SUBJECT_TYPES.find(x=>x.value===s.subjectType)||SUBJECT_TYPES[0]
              return (
                <div key={s.id}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px', paddingBottom:'10px', borderBottom:`2px solid ${C.border}` }}>
                    <span style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{s.name}</span>
                    <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'999px', background:t.bg, color:t.color }}>{t.label} 유형</span>
                  </div>
                  {s.subjectType==='A'
                    ? <TypeAProducts vendorId={vendorId} subjectId={s.id} products={products} onReload={onReload} />
                    : <TypeBCProducts vendorId={vendorId} subjectId={s.id} products={products} onReload={onReload} />
                  }
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── 메인
export function VendorApp({ vendorSession, onLogout }) {
  const [page, setPage]         = useState('dashboard')
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const vendorId = vendorSession?.vendorId

  const reload = useCallback(async () => {
    if (!vendorId) return
    setSubjects(await DB.subjectsByVendor(vendorId))
    setProducts(await DB.productsByVendor(vendorId))
  }, [vendorId])

  useEffect(() => { reload() }, [reload])

  const handleLogout = () => {
    localStorage.removeItem(LS_SESSION)
    onLogout()
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Noto Sans KR, sans-serif' }}>
      <VendorSidebar vendorSession={vendorSession} currentPage={page} onNav={setPage} onLogout={handleLogout} />
      <main style={{ flex:1, background:'#f9fafb', overflowY:'auto' }}>
        {page==='dashboard' && <VendorDashboard vendorSession={vendorSession} subjects={subjects} products={products} />}
        {page==='subjects'  && <VendorSubjectsPage vendorId={vendorId} subjects={subjects} onReload={reload} />}
        {page==='products'  && <VendorProductsPage vendorId={vendorId} subjects={subjects} products={products} onReload={reload} />}
      </main>
    </div>
  )
}
