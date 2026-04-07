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

// ─── A형 교구 관리
function TypeAProducts({ vendorId, subjectId, products, onReload }) {
  const { success, error } = useToast()
  const { confirm, modal } = useConfirmModal()
  const fileRef = React.useRef()

  const [form, setForm]         = useState({...EMPTY_PROD})
  const [selProd, setSelProd]   = useState(null)
  const [tab, setTab]           = useState('stages')
  const [stages, setStages]     = useState([])
  const [selStage, setSelStage] = useState(null)
  const [contents, setContents] = useState([])
  const [contMode, setContMode] = useState('one')
  const [bulkCount, setBulkCount] = useState(12)
  const [files, setFiles]       = useState([])
  const [fileForm, setFileForm] = useState({ fileType:'annual', title:'', stageLabel:'' })
  const xlsxRef = useRef()

  const subjectProds = products.filter(p=>p.subjectId===subjectId && p.type==='textbook')

  const loadProd = useCallback(async (p) => {
    if (!p) return
    const s = await DB.stagesByProduct(p.id)
    setStages(s)
    setSelStage(s[0]||null)
    const f = await DB.filesByProduct(p.id)
    setFiles(f)
  }, [])

  useEffect(() => {
    if (subjectProds.length > 0 && !selProd) {
      setSelProd(subjectProds[0])
      loadProd(subjectProds[0])
    }
  }, [subjectProds.length])

  useEffect(() => { if (selProd) loadProd(selProd) }, [selProd])

  useEffect(() => {
    if (!selStage) return
    DB.contentsByStage(selStage.id).then(setContents)
  }, [selStage])

  const saveProd = async () => {
    if (!form.name.trim()) { error('교구명을 입력해주세요.'); return }
    await DB.saveProduct({ id:uid(), vendorId, subjectId, type:'textbook', name:form.name, year:form.year,
      priceRetail:Number(form.priceRetail)||0, priceSchool:Number(form.priceSchool)||0,
      priceBranch:Number(form.priceBranch)||0, priceTeacher:Number(form.priceTeacher)||0, createdAt:now() })
    setForm({...EMPTY_PROD})
    onReload()
    success('교구가 추가되었습니다.')
  }

  const deleteProd = async (id) => {
    const ok = await confirm('교구를 삭제하시겠습니까?')
    if (!ok) return
    await DB.deleteProduct(id)
    if (selProd?.id===id) { setSelProd(null); setStages([]); setContents([]); setFiles([]) }
    onReload()
    success('삭제되었습니다.')
  }

  const addStage = async () => {
    const newStage = { id:uid(), productId:selProd.id, label:`${stages.length+1}단계`, order:stages.length+1, createdAt:now() }
    await DB.saveStage(newStage)
    const s = await DB.stagesByProduct(selProd.id)
    setStages(s)
    setSelStage(newStage)
    success(`${newStage.label} 추가되었습니다.`)
  }

  const deleteStage = async (sid) => {
    const ok = await confirm('단계를 삭제하시겠습니까?\n해당 단계의 목차도 삭제됩니다.')
    if (!ok) return
    await DB.deleteStage(sid)
    const s = await DB.stagesByProduct(selProd.id)
    setStages(s)
    setSelStage(s[0]||null)
  }

  const bulkCreate = async () => {
    const n = Number(bulkCount)||0
    if (n < 1) return
    const existing = await DB.contentsByStage(selStage.id)
    const next = existing.length + 1
    await Promise.all(Array.from({length:n},(_,i)=>
      DB.saveContent({ id:uid(), stageId:selStage.id, productId:selProd.id, session:next+i, title:'', supplies:'', createdAt:now() })
    ))
    const all = await DB.contentsByStage(selStage.id)
    setContents(all)
    success(`${n}개 목차가 생성되었습니다.`)
  }

  // 샘플 엑셀 다운로드
  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['차시', '제목', '준비물'],
      [1, '예시 제목', '예시 준비물'],
      [2, '', ''],
    ])
    ws['!cols'] = [{wch:6},{wch:30},{wch:30}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '목차')
    XLSX.writeFile(wb, `${selStage?.label||'목차'}_샘플.xlsx`)
  }

  // 엑셀 업로드
  const uploadXlsx = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
        // 첫 행 헤더 스킵
        const dataRows = rows.slice(1).filter(r => r[0] || r[1] || r[2])
        if (!dataRows.length) { error('데이터가 없습니다.'); return }
        const existing = await DB.contentsByStage(selStage.id)
        let next = existing.length + 1
        await Promise.all(dataRows.map((r, i) =>
          DB.saveContent({
            id: uid(),
            stageId: selStage.id,
            productId: selProd.id,
            session: Number(r[0]) || next + i,
            title: String(r[1] || ''),
            supplies: String(r[2] || ''),
            createdAt: now(),
          })
        ))
        setContents(await DB.contentsByStage(selStage.id))
        success(`${dataRows.length}개 목차가 업로드되었습니다.`)
      } catch(err) {
        error('엑셀 파일을 읽을 수 없습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const addOneCont = async () => {
    const existing = await DB.contentsByStage(selStage.id)
    await DB.saveContent({ id:uid(), stageId:selStage.id, productId:selProd.id, session:existing.length+1, title:'', supplies:'', createdAt:now() })
    setContents(await DB.contentsByStage(selStage.id))
  }

  const updateCont = async (id, field, val) => {
    const c = contents.find(x=>x.id===id)
    if (!c) return
    await DB.saveContent({ ...c, [field]:val })
    setContents(prev=>prev.map(x=>x.id===id?{...x,[field]:val}:x))
  }

  const deleteCont = async (id) => {
    await DB.deleteContent(id)
    const all = (await DB.contentsByStage(selStage.id)).map((c,i)=>({...c,session:i+1}))
    await Promise.all(all.map(c=>DB.saveContent(c)))
    setContents(all)
  }

  const saveFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!fileForm.title.trim()) { error('파일 제목을 먼저 입력해주세요.'); e.target.value=''; return }
    const reader = new FileReader()
    reader.onload = async ev => {
      await DB.saveFile({ id:uid(), productId:selProd.id, fileType:fileForm.fileType, stageLabel:fileForm.stageLabel, title:fileForm.title, fileName:file.name, fileUrl:ev.target.result, createdAt:now() })
      setFiles(await DB.filesByProduct(selProd.id))
      setFileForm({ fileType:'annual', title:'', stageLabel:'' })
      success('파일이 등록되었습니다.')
    }
    reader.readAsDataURL(file)
    e.target.value=''
  }

  const deleteFile = async (id) => {
    await DB.deleteFile(id)
    setFiles(await DB.filesByProduct(selProd.id))
  }

  const FILE_TYPE = { annual:'📅 연간지도안', session:'📖 차시별지도안', promo:'🖼 홍보물' }

  return (
    <div>
      {modal}
      <ProdForm form={form} setForm={setForm} onSave={saveProd} editing={false} />

      {subjectProds.length===0 ? <Empty icon="📦" msg="등록된 교구가 없습니다." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
          {subjectProds.map(p=>(
            <div key={p.id} onClick={()=>{ setSelProd(p); setTab('stages') }} style={{
              padding:'12px 16px', borderRadius:'12px',
              border:`2px solid ${selProd?.id===p.id?C.primary:C.border}`,
              background:selProd?.id===p.id?'#fff7ed':C.card,
              cursor:'pointer', display:'flex', alignItems:'center', gap:'12px',
            }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>📦 {p.name}</span>
                  <span style={{ fontSize:'11px', padding:'1px 7px', borderRadius:'999px', background:'#eff6ff', color:C.blue, fontWeight:600 }}>{p.year}년</span>
                </div>
                <PriceTags p={p} />
              </div>
              <button type="button" onClick={e=>{ e.stopPropagation(); deleteProd(p.id) }} style={{ padding:'4px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          ))}
        </div>
      )}

      {selProd && (
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ borderBottom:`1px solid ${C.border}` }}>
            <div style={{ padding:'14px 20px 0', background:'#fff7ed' }}>
              <div style={{ fontSize:'15px', fontWeight:700, color:C.primary, marginBottom:'12px' }}>📦 {selProd.name} <span style={{ fontSize:'12px', fontWeight:400, color:C.muted }}>{selProd.year}년</span></div>
              <div style={{ display:'flex', gap:'4px' }}>
                {[['stages','📋 단계 · 목차'],['files','📁 파일 관리']].map(([t,l])=>(
                  <button key={t} type="button" onClick={()=>setTab(t)} style={{
                    padding:'9px 20px', borderRadius:'8px 8px 0 0', border:'none',
                    background:tab===t?C.card:'transparent',
                    color:tab===t?C.primary:C.muted, fontWeight:tab===t?700:400,
                    fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    borderBottom:tab===t?`2px solid ${C.primary}`:'2px solid transparent',
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {tab==='stages' && (
            <div style={{ padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>단계</span>
                {stages.map(st=>(
                  <div key={st.id} style={{ display:'flex', alignItems:'center', gap:'2px' }}>
                    <button type="button" onClick={()=>setSelStage(st)} style={{
                      padding:'6px 16px', borderRadius:'999px',
                      border:`2px solid ${selStage?.id===st.id?C.primary:C.border}`,
                      background:selStage?.id===st.id?C.primary:'#fff',
                      color:selStage?.id===st.id?'#fff':C.muted,
                      fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    }}>{st.label}</button>
                    <button type="button" onClick={()=>deleteStage(st.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'14px', padding:'0 2px' }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={addStage} style={{ padding:'6px 14px', borderRadius:'999px', border:`2px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 단계 추가</button>
              </div>

              {stages.length===0 && <div style={{ padding:'20px', textAlign:'center', fontSize:'13px', color:C.muted, background:C.bg, borderRadius:'10px', border:`1px dashed ${C.border}` }}>단계를 먼저 추가해주세요.</div>}
              {!selStage && stages.length>0 && <div style={{ padding:'20px', textAlign:'center', fontSize:'13px', color:C.muted, background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}` }}>단계를 선택하면 목차를 관리할 수 있습니다.</div>}

              {selStage && (
                <div style={{ background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                      {selStage.label} 목차 <span style={{ fontSize:'12px', color:C.muted, fontWeight:400 }}>{contents.length}개</span>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      {[['one','한 개씩'],['bulk','개수로']].map(([m,l])=>(
                        <button key={m} type="button" onClick={()=>setContMode(m)} style={{ padding:'4px 12px', borderRadius:'7px', fontSize:'12px', cursor:'pointer', border:`1.5px solid ${contMode===m?C.blue:C.border}`, background:contMode===m?'#eff6ff':'#fff', color:contMode===m?C.blue:C.muted, fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>{l}</button>
                      ))}
                      {contMode==='bulk' && (
                        <>
                          <input style={{ ...iSt, width:'60px', padding:'4px 8px' }} type="number" min="1" value={bulkCount} onChange={e=>setBulkCount(e.target.value)} />
                          <span style={{ fontSize:'12px', color:C.muted }}>개</span>
                          <button type="button" onClick={bulkCreate} style={{ padding:'4px 14px', borderRadius:'7px', border:'none', background:C.blue, color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>생성</button>
                        </>
                      )}
                      {contMode==='one' && (
                        <button type="button" onClick={addOneCont} style={{ padding:'4px 14px', borderRadius:'7px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 목차 추가</button>
                      )}
                      <button type="button" onClick={downloadSample} style={{ padding:'4px 12px', borderRadius:'7px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📥 샘플</button>
                      <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={uploadXlsx} />
                      <button type="button" onClick={()=>xlsxRef.current?.click()} style={{ padding:'4px 12px', borderRadius:'7px', border:'none', background:'#16a34a', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📤 엑셀 업로드</button>
                    </div>
                  </div>
                  {contents.length>0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'30px 1fr 1fr 20px', gap:'5px', padding:'4px 8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'11px', color:C.muted, textAlign:'center' }}>차시</span>
                      <span style={{ fontSize:'11px', color:C.muted }}>제목</span>
                      <span style={{ fontSize:'11px', color:C.muted }}>준비물</span>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'360px', overflowY:'auto' }}>
                    {contents.length===0
                      ? <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'16px' }}>목차가 없습니다.</div>
                      : contents.map(c=>(
                        <div key={c.id} style={{ display:'grid', gridTemplateColumns:'30px 1fr 1fr 20px', gap:'5px', alignItems:'center' }}>
                          <span style={{ fontSize:'11px', fontWeight:700, color:C.blue, textAlign:'center' }}>{c.session}</span>
                          <input style={{ ...iSt, padding:'6px 8px', fontSize:'12px', background:'#fff' }} value={c.title} onChange={e=>updateCont(c.id,'title',e.target.value)} placeholder="제목" />
                          <input style={{ ...iSt, padding:'6px 8px', fontSize:'12px', background:'#fff' }} value={c.supplies} onChange={e=>updateCont(c.id,'supplies',e.target.value)} placeholder="준비물" />
                          <button type="button" onClick={()=>deleteCont(c.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'15px', lineHeight:1 }}>✕</button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==='files' && (
            <div style={{ padding:'20px' }}>
              <div style={{ background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'16px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>파일 유형</label>
                    <select style={iSt} value={fileForm.fileType} onChange={e=>setFileForm(f=>({...f,fileType:e.target.value}))}>
                      <option value="annual">📅 연간지도안</option>
                      <option value="session">📖 차시별지도안</option>
                      <option value="promo">🖼 홍보물</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>해당 단계 (선택)</label>
                    <input style={iSt} value={fileForm.stageLabel} onChange={e=>setFileForm(f=>({...f,stageLabel:e.target.value}))} placeholder="예: 1단계" />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>파일 제목 *</label>
                    <input style={iSt} value={fileForm.title} onChange={e=>setFileForm(f=>({...f,title:e.target.value}))} placeholder="예: 1단계 연간지도안" />
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.hwp,.hwpx,.pptx,.jpg,.png" style={{ display:'none' }} onChange={saveFile} />
                <button type="button" onClick={()=>fileRef.current?.click()} style={{ width:'100%', padding:'10px', borderRadius:'9px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📎 파일 선택하여 등록</button>
              </div>
              {files.length===0 ? <Empty icon="📁" msg="등록된 파일이 없습니다." /> :
                files.map(f=>(
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}`, marginBottom:'6px' }}>
                    <span style={{ fontSize:'12px', color:C.blue, fontWeight:600 }}>{FILE_TYPE[f.fileType]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{f.title}</div>
                      <div style={{ fontSize:'11px', color:C.muted }}>{f.fileName}{f.stageLabel?` · ${f.stageLabel}`:''}</div>
                    </div>
                    <a href={f.fileUrl} download={f.fileName} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>⬇ 다운</a>
                    <button type="button" onClick={()=>deleteFile(f.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>✕</button>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── B형·C형 교구 관리
function TypeBCProducts({ vendorId, subjectId, products, onReload }) {
  const { success, error } = useToast()
  const { confirm, modal } = useConfirmModal()
  const fileRef = React.useRef()
  const xlsxRef = useRef()

  const [form, setForm]         = useState({...EMPTY_PROD})
  const [selProd, setSelProd]   = useState(null)
  const [tab, setTab]           = useState('quarters')
  const [quarters, setQuarters] = useState([])
  const [selQuarter, setSelQuarter] = useState(null)
  const [sessions, setSessions] = useState([])
  const [files, setFiles]       = useState([])
  const [fileForm, setFileForm] = useState({ fileType:'annual', title:'' })

  const subjectProds = products.filter(p=>p.subjectId===subjectId && p.type!=='textbook')

  const loadProd = useCallback(async (p) => {
    if (!p) return
    const q = await DB.quartersByProduct(p.id)
    setQuarters(q)
    setSelQuarter(q[0]||null)
    const f = await DB.filesByProduct(p.id)
    setFiles(f)
  }, [])

  useEffect(() => {
    if (subjectProds.length > 0 && !selProd) {
      setSelProd(subjectProds[0])
      loadProd(subjectProds[0])
    }
  }, [subjectProds.length])

  useEffect(() => { if (selProd) loadProd(selProd) }, [selProd])

  useEffect(() => {
    if (!selQuarter) return
    DB.sessionsByQuarter(selQuarter.id).then(setSessions)
  }, [selQuarter])

  const saveProd = async () => {
    if (!form.name.trim()) { error('교구명을 입력해주세요.'); return }
    await DB.saveProduct({ id:uid(), vendorId, subjectId, type:'bc_product', name:form.name, year:form.year,
      priceRetail:Number(form.priceRetail)||0, priceSchool:Number(form.priceSchool)||0,
      priceBranch:Number(form.priceBranch)||0, priceTeacher:Number(form.priceTeacher)||0, createdAt:now() })
    setForm({...EMPTY_PROD})
    onReload()
    success('교구가 추가되었습니다.')
  }

  const deleteProd = async (id) => {
    const ok = await confirm('교구를 삭제하시겠습니까?')
    if (!ok) return
    await DB.deleteProduct(id)
    if (selProd?.id===id) { setSelProd(null); setQuarters([]); setSessions([]); setFiles([]) }
    onReload()
    success('삭제되었습니다.')
  }

  const addQuarter = async () => {
    const q = { id:uid(), productId:selProd.id, label:`${quarters.length+1}분기`, order:quarters.length+1, createdAt:now() }
    await DB.saveQuarter(q)
    const all = await DB.quartersByProduct(selProd.id)
    setQuarters(all)
    setSelQuarter(q)
    success(`${q.label} 추가되었습니다.`)
  }

  const deleteQuarter = async (qid) => {
    const ok = await confirm('분기를 삭제하시겠습니까?\n해당 분기의 차시도 삭제됩니다.')
    if (!ok) return
    await DB.deleteQuarter(qid)
    const all = await DB.quartersByProduct(selProd.id)
    setQuarters(all)
    setSelQuarter(all[0]||null)
  }

  const downloadSampleB = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['차시', '제목', '준비물'],
      [1, '예시 제목', '예시 준비물'],
      [2, '', ''],
    ])
    ws['!cols'] = [{wch:6},{wch:30},{wch:30}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '차시')
    XLSX.writeFile(wb, `${selQuarter?.label||'차시'}_샘플.xlsx`)
  }

  const uploadXlsxB = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
        const dataRows = rows.slice(1).filter(r => r[0] || r[1] || r[2])
        if (!dataRows.length) { error('데이터가 없습니다.'); return }
        const existing = await DB.sessionsByQuarter(selQuarter.id)
        let next = existing.length + 1
        await Promise.all(dataRows.map((r, i) =>
          DB.saveSession({
            id: uid(),
            quarterId: selQuarter.id,
            productId: selProd.id,
            session: Number(r[0]) || next + i,
            title: String(r[1] || ''),
            supplies: String(r[2] || ''),
            createdAt: now(),
          })
        ))
        setSessions(await DB.sessionsByQuarter(selQuarter.id))
        success(`${dataRows.length}개 차시가 업로드되었습니다.`)
      } catch(err) {
        error('엑셀 파일을 읽을 수 없습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const addSession = async () => {
    const existing = await DB.sessionsByQuarter(selQuarter.id)
    await DB.saveSession({ id:uid(), quarterId:selQuarter.id, productId:selProd.id, session:existing.length+1, title:'', supplies:'', createdAt:now() })
    setSessions(await DB.sessionsByQuarter(selQuarter.id))
  }

  const updateSession = async (id, field, val) => {
    const s = sessions.find(x=>x.id===id)
    if (!s) return
    await DB.saveSession({...s,[field]:val})
    setSessions(prev=>prev.map(x=>x.id===id?{...x,[field]:val}:x))
  }

  const deleteSession = async (id) => {
    await DB.deleteSession(id)
    const all = (await DB.sessionsByQuarter(selQuarter.id)).map((s,i)=>({...s,session:i+1}))
    await Promise.all(all.map(s=>DB.saveSession(s)))
    setSessions(all)
  }

  const saveFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!fileForm.title.trim()) { error('파일 제목을 먼저 입력해주세요.'); e.target.value=''; return }
    const reader = new FileReader()
    reader.onload = async ev => {
      await DB.saveFile({ id:uid(), productId:selProd.id, fileType:fileForm.fileType, title:fileForm.title, fileName:file.name, fileUrl:ev.target.result, createdAt:now() })
      setFiles(await DB.filesByProduct(selProd.id))
      setFileForm({ fileType:'annual', title:'' })
      success('파일이 등록되었습니다.')
    }
    reader.readAsDataURL(file)
    e.target.value=''
  }

  const deleteFile = async (id) => {
    await DB.deleteFile(id)
    setFiles(await DB.filesByProduct(selProd.id))
  }

  const FILE_TYPE = { annual:'📅 연간지도안', session:'📖 차시별지도안', promo:'🖼 홍보물' }

  return (
    <div>
      {modal}
      <ProdForm form={form} setForm={setForm} onSave={saveProd} editing={false} />

      {subjectProds.length===0 ? <Empty icon="🎒" msg="등록된 교구가 없습니다." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
          {subjectProds.map(p=>(
            <div key={p.id} onClick={()=>{ setSelProd(p); setTab('quarters') }} style={{
              padding:'12px 16px', borderRadius:'12px',
              border:`2px solid ${selProd?.id===p.id?C.primary:C.border}`,
              background:selProd?.id===p.id?'#fff7ed':C.card,
              cursor:'pointer', display:'flex', alignItems:'center', gap:'12px',
            }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>🎒 {p.name}</span>
                  <span style={{ fontSize:'11px', padding:'1px 7px', borderRadius:'999px', background:'#eff6ff', color:C.blue, fontWeight:600 }}>{p.year}년</span>
                </div>
                <PriceTags p={p} />
              </div>
              <button type="button" onClick={e=>{ e.stopPropagation(); deleteProd(p.id) }} style={{ padding:'4px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          ))}
        </div>
      )}

      {selProd && (
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ borderBottom:`1px solid ${C.border}` }}>
            <div style={{ padding:'14px 20px 0', background:'#fff7ed' }}>
              <div style={{ fontSize:'15px', fontWeight:700, color:C.primary, marginBottom:'12px' }}>🎒 {selProd.name} <span style={{ fontSize:'12px', fontWeight:400, color:C.muted }}>{selProd.year}년</span></div>
              <div style={{ display:'flex', gap:'4px' }}>
                {[['quarters','📋 분기 · 차시'],['files','📁 파일 관리']].map(([t,l])=>(
                  <button key={t} type="button" onClick={()=>setTab(t)} style={{
                    padding:'9px 20px', borderRadius:'8px 8px 0 0', border:'none',
                    background:tab===t?C.card:'transparent',
                    color:tab===t?C.primary:C.muted, fontWeight:tab===t?700:400,
                    fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    borderBottom:tab===t?`2px solid ${C.primary}`:'2px solid transparent',
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {tab==='quarters' && (
            <div style={{ padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>분기</span>
                {quarters.map(q=>(
                  <div key={q.id} style={{ display:'flex', alignItems:'center', gap:'2px' }}>
                    <button type="button" onClick={()=>setSelQuarter(q)} style={{
                      padding:'6px 16px', borderRadius:'999px',
                      border:`2px solid ${selQuarter?.id===q.id?C.primary:C.border}`,
                      background:selQuarter?.id===q.id?C.primary:'#fff',
                      color:selQuarter?.id===q.id?'#fff':C.muted,
                      fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    }}>{q.label}</button>
                    <button type="button" onClick={()=>deleteQuarter(q.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'14px', padding:'0 2px' }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={addQuarter} style={{ padding:'6px 14px', borderRadius:'999px', border:`2px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 분기 추가</button>
              </div>

              {quarters.length===0 && <div style={{ padding:'20px', textAlign:'center', fontSize:'13px', color:C.muted, background:C.bg, borderRadius:'10px', border:`1px dashed ${C.border}` }}>분기를 먼저 추가해주세요.</div>}
              {!selQuarter && quarters.length>0 && <div style={{ padding:'20px', textAlign:'center', fontSize:'13px', color:C.muted, background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}` }}>분기를 선택하면 차시를 관리할 수 있습니다.</div>}

              {selQuarter && (
                <div style={{ background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                      {selQuarter.label} 차시 <span style={{ fontSize:'12px', color:C.muted, fontWeight:400 }}>{sessions.length}개</span>
                    </div>
                    <button type="button" onClick={addSession} style={{ padding:'5px 14px', borderRadius:'7px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 차시 추가</button>
                    <button type="button" onClick={downloadSampleB} style={{ padding:'4px 12px', borderRadius:'7px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📥 샘플</button>
                    <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={uploadXlsxB} />
                    <button type="button" onClick={()=>xlsxRef.current?.click()} style={{ padding:'4px 12px', borderRadius:'7px', border:'none', background:'#16a34a', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📤 엑셀 업로드</button>
                  </div>
                  {sessions.length>0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'30px 1fr 1fr 20px', gap:'5px', padding:'4px 8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'11px', color:C.muted, textAlign:'center' }}>차시</span>
                      <span style={{ fontSize:'11px', color:C.muted }}>제목</span>
                      <span style={{ fontSize:'11px', color:C.muted }}>준비물</span>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'320px', overflowY:'auto' }}>
                    {sessions.length===0
                      ? <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'16px' }}>차시가 없습니다.</div>
                      : sessions.map(s=>(
                        <div key={s.id} style={{ display:'grid', gridTemplateColumns:'30px 1fr 1fr 20px', gap:'5px', alignItems:'center' }}>
                          <span style={{ fontSize:'11px', fontWeight:700, color:C.blue, textAlign:'center' }}>{s.session}</span>
                          <input style={{ ...iSt, padding:'6px 8px', fontSize:'12px', background:'#fff' }} value={s.title} onChange={e=>updateSession(s.id,'title',e.target.value)} placeholder="제목" />
                          <input style={{ ...iSt, padding:'6px 8px', fontSize:'12px', background:'#fff' }} value={s.supplies} onChange={e=>updateSession(s.id,'supplies',e.target.value)} placeholder="준비물" />
                          <button type="button" onClick={()=>deleteSession(s.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'15px', lineHeight:1 }}>✕</button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==='files' && (
            <div style={{ padding:'20px' }}>
              <div style={{ background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'16px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>파일 유형</label>
                    <select style={iSt} value={fileForm.fileType} onChange={e=>setFileForm(f=>({...f,fileType:e.target.value}))}>
                      <option value="annual">📅 연간지도안</option>
                      <option value="session">📖 차시별지도안</option>
                      <option value="promo">🖼 홍보물</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>파일 제목 *</label>
                    <input style={iSt} value={fileForm.title} onChange={e=>setFileForm(f=>({...f,title:e.target.value}))} placeholder="예: 연간지도안" />
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.hwp,.hwpx,.pptx,.jpg,.png" style={{ display:'none' }} onChange={saveFile} />
                <button type="button" onClick={()=>fileRef.current?.click()} style={{ width:'100%', padding:'10px', borderRadius:'9px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📎 파일 선택하여 등록</button>
              </div>
              {files.length===0 ? <Empty icon="📁" msg="등록된 파일이 없습니다." /> :
                files.map(f=>(
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}`, marginBottom:'6px' }}>
                    <span style={{ fontSize:'12px', color:C.blue, fontWeight:600 }}>{FILE_TYPE[f.fileType]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{f.title}</div>
                      <div style={{ fontSize:'11px', color:C.muted }}>{f.fileName}</div>
                    </div>
                    <a href={f.fileUrl} download={f.fileName} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>⬇ 다운</a>
                    <button type="button" onClick={()=>deleteFile(f.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>✕</button>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
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
