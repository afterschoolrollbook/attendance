/**
 * VendorApp.jsx
 * 업체 전용 앱
 * ✅ Supabase 직접 조회/저장
 * ✅ A형(교재형/로봇) — 교구명·단계·목차·지도안 파일 등록
 * ✅ B형/C형 — 기존 방식 유지
 */
import React, { useState, useEffect, useCallback } from 'react'
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

// ✅ Supabase DB
const HQSubjects = {
  byVendor: async (vid) => ((await dbCall('getAll','hqVendorSubjects'))||[]).filter(s=>s.vendorId===vid),
  save:     async (s)   => dbCall('upsert','hqVendorSubjects',{ data:s }),
  delete:   async (id)  => dbCall('delete','hqVendorSubjects',{ id }),
}
const HQProducts = {
  byVendor:  async (vid) => ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.vendorId===vid),
  bySubject: async (sid) => ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.subjectId===sid),
  save:      async (p)   => dbCall('upsert','hqVendorProducts',{ data:p }),
  delete:    async (id)  => dbCall('delete','hqVendorProducts',{ id }),
}

const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb',
  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

// 과목 유형
const SUBJECT_TYPES = [
  { value:'A', label:'A형', desc:'로봇', color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe' },
  { value:'B', label:'B형', desc:'생명과학 / 과학실험 / 보드게임', color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
  { value:'C', label:'C형', desc:'미술 / 체육 / 기타', color:'#f97316', bg:'#fff7ed', border:'#fed7aa' },
]

function Btn({ children, onClick, disabled, secondary, danger, style={} }) {
  const bg    = disabled?'#d1d5db':danger?'#ef4444':secondary?'#fff':'#f97316'
  const color = disabled?'#9ca3af':secondary?'#374151':'#fff'
  const bdr   = secondary?'1.5px solid #e5e7eb':'none'
  return (
    <button onClick={disabled?undefined:onClick} style={{
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

// ─── 사이드바
const VENDOR_NAV = [
  { path:'dashboard', label:'대시보드',  icon:'🏠' },
  { path:'subjects',  label:'과목 관리', icon:'📚' },
  { path:'products',  label:'교구 관리', icon:'🎒' },
]

function VendorSidebar({ vendorSession, currentPage, onNav, onLogout }) {
  return (
    <aside style={{
      width:'210px', minWidth:'210px', background:C.sidebar,
      display:'flex', flexDirection:'column', height:'100vh',
      position:'sticky', top:0, overflow:'hidden', fontFamily:'Noto Sans KR, sans-serif',
    }}>
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
        <div style={{ fontSize:'13px', fontWeight:600, color:'#fff', marginBottom:'2px' }}>
          🏢 {vendorSession?.vendor?.name || '업체명'}
        </div>
        <div style={{ fontSize:'11px', color:'#71717a' }}>{vendorSession?.name || vendorSession?.email}</div>
        <div style={{ marginTop:'6px', display:'inline-block', fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:'#f97316', color:'#fff' }}>파트너</div>
      </div>
      <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
        {VENDOR_NAV.map(item=>(
          <button key={item.path} onClick={()=>onNav(item.path)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px',
            padding:'10px 20px', background:currentPage===item.path?'#f9731618':'none',
            border:'none', borderLeft:currentPage===item.path?'3px solid #f97316':'3px solid transparent',
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
        <button onClick={onLogout} style={{
          background:'none', border:'none', cursor:'pointer', color:'#71717a',
          fontSize:'14px', display:'flex', alignItems:'center', gap:'8px',
          fontFamily:'Noto Sans KR, sans-serif',
        }}><span>🚪</span> 로그아웃</button>
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
            ['1️⃣','과목 관리','A형(로봇 등 교재형) / B형 / C형 선택 후 과목 등록'],
            ['2️⃣','교구 관리','A형 — 교구명·단계·목차·지도안 파일 등록\nB/C형 — 교구명·유형·가격 등록'],
            ['3️⃣','선생님 연동','(추후) 선생님이 연동하여 주문할 수 있습니다'],
          ].map(([n,t,d])=>(
            <div key={n} style={{ display:'flex', gap:'10px' }}>
              <span>{n}</span>
              <div><strong>{t}</strong> — <span style={{ whiteSpace:'pre-line' }}>{d}</span></div>
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
  const { success } = useToast()

  const handleSave = async () => {
    if (!form.name.trim()) return
    const item = editing
      ? { ...editing, name:form.name, subjectType:form.subjectType }
      : { id:uid(), vendorId, name:form.name, subjectType:form.subjectType, createdAt:now() }
    await HQSubjects.save(item)
    setForm({ name:'', subjectType:'A' })
    setEditing(null)
    onReload()
    success(editing ? '과목이 수정되었습니다.' : '과목이 추가되었습니다.')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('과목을 삭제하시겠습니까?\n연결된 교구도 함께 삭제됩니다.')) return
    await HQSubjects.delete(id)
    const prods = await HQProducts.bySubject(id)
    await Promise.all(prods.map(p=>HQProducts.delete(p.id)))
    onReload()
    success('삭제되었습니다.')
  }

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'800px' }}>
      <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>📚 과목 관리</h2>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>과목 유형을 선택하고 과목명을 입력하세요.</p>

      <div style={{ padding:'18px', background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, marginBottom:'24px' }}>
        {/* 유형 선택 */}
        <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'8px', fontWeight:600 }}>과목 유형 선택 *</label>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
          {SUBJECT_TYPES.map(t=>(
            <button key={t.value} onClick={()=>setForm(f=>({...f,subjectType:t.value}))} style={{
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

        {/* 과목명 */}
        <div style={{ display:'flex', gap:'10px' }}>
          <input style={{ ...iSt, flex:1 }} placeholder="과목명 입력 (예: 로봇, 항공과학, 미술)"
            value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&handleSave()} />
          <Btn onClick={handleSave}>{editing?'수정 저장':'+ 추가'}</Btn>
          {editing && <Btn onClick={()=>{ setEditing(null); setForm({name:'',subjectType:'A'}) }} secondary>취소</Btn>}
        </div>
      </div>

      {subjects.length===0
        ? <Empty icon="📚" msg="등록된 과목이 없습니다." />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {subjects.map(s=>{
              const t = SUBJECT_TYPES.find(x=>x.value===s.subjectType)||SUBJECT_TYPES[0]
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 18px', background:C.card, borderRadius:'12px', border:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', background:t.bg, color:t.color, border:`1px solid ${t.border}`, flexShrink:0 }}>
                    {t.label}
                  </span>
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
        )
      }
    </div>
  )
}

// ─── A형 교구 관리 (교재형 — 단계·목차·지도안)
function TypeAProducts({ vendorId, subjectId, products, onReload }) {
  const { success } = useToast()
  const fileRef = React.useRef()

  const [prodForm, setProdForm] = useState({ name:'', maxStage:1 })
  const [selProd, setSelProd]   = useState(null)
  const [selStage, setSelStage] = useState(1)
  const [contents, setContents] = useState([])
  const [files, setFiles]       = useState([])
  const [contForm, setContForm] = useState({ session:1, title:'' })
  const [fileForm, setFileForm] = useState({ fileType:'annual', title:'', stage:'' })

  const subjectProds = products.filter(p=>p.subjectId===subjectId && p.type==='textbook')

  useEffect(() => {
    if (!selProd) return
    setContents(JSON.parse(localStorage.getItem(`asa_contents_${selProd.id}`)||'[]'))
    setFiles(JSON.parse(localStorage.getItem(`asa_files_${selProd.id}`)||'[]'))
  }, [selProd])

  const saveProd = async () => {
    if (!prodForm.name.trim()) return alert('교구명을 입력해주세요.')
    await HQProducts.save({ id:uid(), vendorId, subjectId, type:'textbook', name:prodForm.name, maxStage:Number(prodForm.maxStage)||1, createdAt:now() })
    setProdForm({ name:'', maxStage:1 })
    onReload()
    success('교구가 등록되었습니다.')
  }

  const deleteProd = async (id) => {
    if (!window.confirm('교구를 삭제하시겠습니까?')) return
    await HQProducts.delete(id)
    if (selProd?.id===id) setSelProd(null)
    onReload()
    success('삭제되었습니다.')
  }

  const saveContent = () => {
    if (!contForm.title.trim()) return alert('목차 제목을 입력해주세요.')
    const key = `asa_contents_${selProd.id}`
    const all = [...JSON.parse(localStorage.getItem(key)||'[]'), { id:uid(), productId:selProd.id, stage:selStage, session:Number(contForm.session), title:contForm.title }]
    all.sort((a,b)=>a.stage-b.stage||a.session-b.session)
    localStorage.setItem(key, JSON.stringify(all))
    setContents(all)
    setContForm(f=>({...f, session:Number(f.session)+1, title:''}))
    success('목차가 추가되었습니다.')
  }

  const deleteContent = (id) => {
    const key = `asa_contents_${selProd.id}`
    const all = JSON.parse(localStorage.getItem(key)||'[]').filter(c=>c.id!==id)
    localStorage.setItem(key, JSON.stringify(all))
    setContents(all)
  }

  const saveFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!fileForm.title.trim()) { alert('파일 제목을 먼저 입력해주세요.'); e.target.value=''; return }
    const reader = new FileReader()
    reader.onload = ev => {
      const key = `asa_files_${selProd.id}`
      const all = [...JSON.parse(localStorage.getItem(key)||'[]'), { id:uid(), productId:selProd.id, fileType:fileForm.fileType, stage:fileForm.stage, title:fileForm.title, fileName:file.name, fileData:ev.target.result }]
      localStorage.setItem(key, JSON.stringify(all))
      setFiles(all)
      setFileForm({ fileType:'annual', title:'', stage:'' })
      success('파일이 등록되었습니다.')
    }
    reader.readAsDataURL(file)
    e.target.value=''
  }

  const deleteFile = (id) => {
    const key = `asa_files_${selProd.id}`
    const all = JSON.parse(localStorage.getItem(key)||'[]').filter(f=>f.id!==id)
    localStorage.setItem(key, JSON.stringify(all))
    setFiles(all)
  }

  const FILE_TYPE = { annual:'📅 연간지도안', session:'📖 차시별지도안', promo:'🖼 홍보물' }

  return (
    <div>
      {/* 교구 등록 */}
      <div style={{ padding:'16px', background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, marginBottom:'16px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px' }}>📦 교구(교재) 등록</div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ flex:2, minWidth:'160px' }}>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>교구명 *</label>
            <input style={iSt} value={prodForm.name} onChange={e=>setProdForm(f=>({...f,name:e.target.value}))} placeholder="예: 큐보, 로이봇" />
          </div>
          <div style={{ flex:1, minWidth:'80px' }}>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>총 단계 수</label>
            <input style={iSt} type="number" min="1" max="20" value={prodForm.maxStage} onChange={e=>setProdForm(f=>({...f,maxStage:e.target.value}))} />
          </div>
          <div style={{ alignSelf:'flex-end' }}>
            <Btn onClick={saveProd}>+ 교구 추가</Btn>
          </div>
        </div>
      </div>

      {/* 교구 목록 */}
      {subjectProds.length===0
        ? <Empty icon="📦" msg="등록된 교구가 없습니다." />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
            {subjectProds.map(p=>(
              <div key={p.id} onClick={()=>{ setSelProd(p); setSelStage(1) }} style={{
                padding:'12px 16px', borderRadius:'12px',
                border:`2px solid ${selProd?.id===p.id?C.primary:C.border}`,
                background:selProd?.id===p.id?'#fff7ed':C.card,
                cursor:'pointer', display:'flex', alignItems:'center', gap:'12px',
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>📦 {p.name}</div>
                  <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>총 {p.maxStage}단계</div>
                </div>
                <Btn onClick={e=>{ e.stopPropagation(); deleteProd(p.id) }} danger style={{ padding:'4px 10px', fontSize:'11px' }}>삭제</Btn>
              </div>
            ))}
          </div>
        )
      }

      {/* 선택된 교구 — 단계·목차·파일 */}
      {selProd && (
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, background:'#fff7ed' }}>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.primary }}>📦 {selProd.name}</span>
            <span style={{ fontSize:'12px', color:C.muted, marginLeft:'10px' }}>단계 · 목차 · 파일 관리</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
            {/* 목차 */}
            <div style={{ padding:'18px', borderRight:`1px solid ${C.border}` }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'12px' }}>📋 단계별 목차</div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
                {Array.from({length:selProd.maxStage},(_,i)=>i+1).map(st=>(
                  <button key={st} onClick={()=>setSelStage(st)} style={{
                    padding:'5px 12px', borderRadius:'999px',
                    border:`1.5px solid ${selStage===st?C.primary:C.border}`,
                    background:selStage===st?'#fff7ed':C.bg, color:selStage===st?C.primary:C.muted,
                    fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                  }}>{st}단계</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                <input style={{ ...iSt, width:'55px' }} type="number" min="1" value={contForm.session}
                  onChange={e=>setContForm(f=>({...f,session:e.target.value}))} placeholder="차시" />
                <input style={{ ...iSt, flex:1 }} value={contForm.title}
                  onChange={e=>setContForm(f=>({...f,title:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&saveContent()}
                  placeholder="목차 제목 입력" />
                <Btn onClick={saveContent} style={{ flexShrink:0, padding:'6px 12px', fontSize:'12px' }}>추가</Btn>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'260px', overflowY:'auto' }}>
                {contents.filter(c=>c.stage===selStage).length===0
                  ? <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'16px' }}>{selStage}단계 목차가 없습니다.</div>
                  : contents.filter(c=>c.stage===selStage).map(c=>(
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:C.bg, borderRadius:'8px', border:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:'11px', fontWeight:700, color:C.blue, width:'26px', flexShrink:0 }}>{c.session}차</span>
                      <span style={{ flex:1, fontSize:'13px', color:C.text }}>{c.title}</span>
                      <button onClick={()=>deleteContent(c.id)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'16px', lineHeight:1 }}>✕</button>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* 파일 */}
            <div style={{ padding:'18px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'12px' }}>📁 지도안 · 홍보물 파일</div>
              <div style={{ background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}`, padding:'12px', marginBottom:'10px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>파일 유형</label>
                    <select style={iSt} value={fileForm.fileType} onChange={e=>setFileForm(f=>({...f,fileType:e.target.value}))}>
                      <option value="annual">📅 연간지도안</option>
                      <option value="session">📖 차시별지도안</option>
                      <option value="promo">🖼 홍보물</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>단계 (선택)</label>
                    <input style={iSt} type="number" min="1" value={fileForm.stage} onChange={e=>setFileForm(f=>({...f,stage:e.target.value}))} placeholder="예: 1" />
                  </div>
                </div>
                <div style={{ marginBottom:'8px' }}>
                  <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>파일 제목 *</label>
                  <input style={iSt} value={fileForm.title} onChange={e=>setFileForm(f=>({...f,title:e.target.value}))} placeholder="예: 1단계 연간지도안" />
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.hwp,.hwpx,.pptx,.jpg,.png" style={{ display:'none' }} onChange={saveFile} />
                <button onClick={()=>fileRef.current?.click()} style={{
                  width:'100%', padding:'8px', borderRadius:'8px', border:`1.5px dashed ${C.border}`,
                  background:C.card, color:C.muted, fontSize:'13px', cursor:'pointer',
                  fontFamily:'Noto Sans KR, sans-serif',
                }}>📎 파일 선택하여 등록</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'260px', overflowY:'auto' }}>
                {files.length===0
                  ? <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'16px' }}>등록된 파일이 없습니다.</div>
                  : files.map(f=>(
                    <div key={f.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:C.bg, borderRadius:'8px', border:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:'11px', color:C.blue, flexShrink:0 }}>{FILE_TYPE[f.fileType]}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'12px', fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</div>
                        <div style={{ fontSize:'10px', color:C.muted }}>{f.fileName}{f.stage?` · ${f.stage}단계`:''}</div>
                      </div>
                      <a href={f.fileData} download={f.fileName} style={{ fontSize:'13px', color:C.success, textDecoration:'none' }}>⬇</a>
                      <button onClick={()=>deleteFile(f.id)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'16px', lineHeight:1 }}>✕</button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── B형·C형 교구 관리
function TypeBCProducts({ vendorId, subjectId, products, onReload }) {
  const { success } = useToast()
  const [form, setForm]       = useState({ name:'', type:'annual', price:'', description:'' })
  const [editing, setEditing] = useState(null)
  const set = (k) => (e) => setForm(f=>({...f,[k]:e.target.value}))
  const subjectProds = products.filter(p=>p.subjectId===subjectId)

  const handleSave = async () => {
    if (!form.name.trim()) return alert('교구명을 입력해주세요.')
    const item = editing
      ? { ...editing, ...form, price:Number(form.price)||0 }
      : { id:uid(), vendorId, subjectId, ...form, price:Number(form.price)||0, createdAt:now() }
    await HQProducts.save(item)
    setForm({ name:'', type:'annual', price:'', description:'' })
    setEditing(null)
    onReload()
    success(editing?'수정되었습니다.':'교구가 추가되었습니다.')
  }

  const TYPE_LABEL = { annual:'📅 연간', session:'📖 차시별', item:'📦 교구' }
  const TYPE_COLOR = { annual:{bg:'#eff6ff',color:C.blue}, session:{bg:'#f5f3ff',color:C.purple}, item:{bg:'#f0fdf4',color:C.success} }

  return (
    <div>
      <div style={{ padding:'16px', background:C.bg, borderRadius:'12px', border:`1px solid ${C.border}`, marginBottom:'20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>교구명 *</label>
            <input style={iSt} value={form.name} onChange={set('name')} placeholder="교구명" />
          </div>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>유형</label>
            <select style={iSt} value={form.type} onChange={set('type')}>
              <option value="annual">📅 연간 등록</option>
              <option value="session">📖 차시별 등록</option>
              <option value="item">📦 교구 등록</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>가격 (원)</label>
            <input style={iSt} type="number" value={form.price} onChange={set('price')} placeholder="0" />
          </div>
          <div>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>설명</label>
            <input style={iSt} value={form.description} onChange={set('description')} placeholder="설명 (선택)" />
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
          {editing && <Btn onClick={()=>{ setEditing(null); setForm({name:'',type:'annual',price:'',description:''}) }} secondary>취소</Btn>}
          <Btn onClick={handleSave}>{editing?'수정 저장':'+ 교구 추가'}</Btn>
        </div>
      </div>
      {subjectProds.length===0
        ? <Empty icon="🎒" msg="등록된 교구가 없습니다." />
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'10px' }}>
            {subjectProds.map(p=>{
              const tc = TYPE_COLOR[p.type]||TYPE_COLOR.item
              return (
                <div key={p.id} style={{ padding:'14px', background:C.card, borderRadius:'12px', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'6px' }}>🎒 {p.name}</div>
                  <div style={{ display:'flex', gap:'5px', marginBottom:'8px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'11px', padding:'1px 6px', borderRadius:'4px', background:tc.bg, color:tc.color }}>{TYPE_LABEL[p.type]}</span>
                    {p.price>0 && <span style={{ fontSize:'11px', color:C.muted }}>{Number(p.price).toLocaleString()}원</span>}
                    {p.description && <span style={{ fontSize:'11px', color:C.muted }}>{p.description}</span>}
                  </div>
                  <div style={{ display:'flex', gap:'5px' }}>
                    <Btn onClick={()=>{ setEditing(p); setForm({name:p.name,type:p.type,price:p.price||'',description:p.description||''}) }} secondary style={{ padding:'4px 10px', fontSize:'11px' }}>수정</Btn>
                    <Btn onClick={async()=>{ if(window.confirm('삭제?')){ await HQProducts.delete(p.id); onReload(); success('삭제되었습니다.') } }} danger style={{ padding:'4px 10px', fontSize:'11px' }}>삭제</Btn>
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

// ─── 교구 관리 페이지
function VendorProductsPage({ vendorId, subjects, products, onReload }) {
  const [selSubjectId, setSelSubjectId] = useState('')
  const selSubject = subjects.find(s=>s.id===selSubjectId)

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'1000px' }}>
      <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>🎒 교구 관리</h2>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'20px' }}>과목을 선택하면 해당 유형에 맞는 교구 등록 화면이 나타납니다.</p>

      {subjects.length===0
        ? <div style={{ padding:'18px', background:'#fff7ed', borderRadius:'12px', border:'1px solid #fed7aa', fontSize:'14px', color:C.primary }}>
            ⚠️ 먼저 <strong>과목 관리</strong>에서 과목을 등록해주세요.
          </div>
        : (
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'24px' }}>
            {subjects.map(s=>{
              const t = SUBJECT_TYPES.find(x=>x.value===s.subjectType)||SUBJECT_TYPES[0]
              const isSelected = selSubjectId===s.id
              return (
                <button key={s.id} onClick={()=>setSelSubjectId(s.id)} style={{
                  padding:'10px 18px', borderRadius:'10px',
                  border:`2px solid ${isSelected?t.color:C.border}`,
                  background:isSelected?t.bg:C.card, cursor:'pointer',
                  fontFamily:'Noto Sans KR, sans-serif',
                }}>
                  <span style={{ fontSize:'11px', fontWeight:700, color:isSelected?t.color:C.muted }}>{t.label}</span>
                  <span style={{ fontSize:'14px', fontWeight:600, color:isSelected?t.color:C.text, marginLeft:'6px' }}>{s.name}</span>
                </button>
              )
            })}
          </div>
        )
      }

      {selSubject && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px', paddingBottom:'14px', borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{selSubject.name}</span>
            <span style={{ fontSize:'12px', padding:'2px 8px', borderRadius:'999px', background:C.bg, border:`1px solid ${C.border}`, color:C.muted }}>
              {SUBJECT_TYPES.find(x=>x.value===selSubject.subjectType)?.label} 유형
            </span>
          </div>
          {selSubject.subjectType==='A'
            ? <TypeAProducts vendorId={vendorId} subjectId={selSubject.id} products={products} onReload={onReload} />
            : <TypeBCProducts vendorId={vendorId} subjectId={selSubject.id} products={products} onReload={onReload} />
          }
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
    setSubjects(await HQSubjects.byVendor(vendorId))
    setProducts(await HQProducts.byVendor(vendorId))
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
