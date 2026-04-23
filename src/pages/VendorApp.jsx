/**
 * VendorApp.jsx
 * 업체 전용 앱 — Supplies.jsx 방식 기반 (한 페이지에서 과목+교구 관리)
 */
import React, { useState, useEffect, useCallback } from 'react'
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

// ── DB 헬퍼
const DB = {
  subjects:  async (vid) => ((await dbCall('getAll','hqVendorSubjects'))||[]).filter(s=>s.vendorId===vid && !s._deleted),
  saveSubject: async (s) => dbCall('upsert','hqVendorSubjects',{data:s}),
  delSubject:  async (id) => dbCall('delete','hqVendorSubjects',{id}),

  products:  async (vid) => ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.vendorId===vid && !p._deleted),
  saveProduct: async (p) => dbCall('upsert','hqVendorProducts',{data:p}),
  delProduct:  async (id) => dbCall('delete','hqVendorProducts',{id}),

  contents:  async (vid) => {
    const prods = ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.vendorId===vid && !p._deleted)
    const pids  = new Set(prods.map(p=>p.id))
    return ((await dbCall('getAll','hqVendorContents'))||[]).filter(c=>pids.has(c.productId) && !c._deleted)
  },
  saveContent: async (c)  => dbCall('upsert','hqVendorContents',{data:c}),
  delContent:  async (id) => dbCall('delete','hqVendorContents',{id}),
}

// ── 엑셀 샘플
function downloadSample() {
  const rows = [
    ['업체명','담당자','연락처','과목','교구명','단계','차시번호','차시제목','메모'],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','큐보',1,1,'큐보 1단계 1차시','배터리'],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','큐보',1,2,'큐보 1단계 2차시','배터리'],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','큐보',2,1,'큐보 2단계 1차시',''],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','드론',1,1,'드론 1단계 1차시',''],
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{wch:16},{wch:10},{wch:14},{wch:10},{wch:20},{wch:8},{wch:10},{wch:30},{wch:20}]
  XLSX.utils.book_append_sheet(wb, ws, '교구목록샘플')
  XLSX.writeFile(wb, '교구목록_샘플양식.xlsx')
}

// ── 교구목록 다운로드
function downloadProducts(vendorName, products, contents) {
  const rows = [['업체명','담당자','연락처','과목','교구명','단계','차시번호','차시제목','메모']]
  products.forEach(p => {
    const plans = contents.filter(c=>c.productId===p.id).sort((a,b)=>a.stage-b.stage||a.sessionNo-b.sessionNo)
    if (!plans.length) rows.push([vendorName,'','','',p.name,'','','',''])
    else plans.forEach(pl => rows.push([vendorName,'','','',p.name,pl.stage||'',pl.sessionNo||'',pl.title||'',pl.supplies||'']))
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{wch:16},{wch:10},{wch:14},{wch:10},{wch:20},{wch:8},{wch:10},{wch:30},{wch:20}]
  XLSX.utils.book_append_sheet(wb, ws, '교구목록')
  XLSX.writeFile(wb, `교구목록_${vendorName}_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')} .xlsx`)
}

const iSt = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }
const iSt2 = { ...iSt, padding:'7px 10px', fontSize:'12px' }

function Btn({ children, onClick, disabled, secondary, danger, small, style={} }) {
  const bg    = disabled?'#d1d5db':danger?C.danger:secondary?'#fff':C.primary
  const color = disabled?'#9ca3af':secondary?'#374151':'#fff'
  const bdr   = secondary?`1.5px solid ${C.border}`:'none'
  return (
    <button type="button" onClick={disabled?undefined:onClick} disabled={!!disabled} style={{
      padding:small?'5px 12px':'8px 16px', borderRadius:'9px', border:bdr, background:bg, color,
      fontWeight:600, fontSize:small?'12px':'13px', cursor:disabled?'not-allowed':'pointer',
      fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', ...style,
    }}>{children}</button>
  )
}

function Empty({ icon, msg }) {
  return (
    <div style={{ textAlign:'center', padding:'32px 20px', color:C.muted }}>
      <div style={{ fontSize:'32px', marginBottom:'8px' }}>{icon}</div>
      <div style={{ fontSize:'13px' }}>{msg}</div>
    </div>
  )
}

function useConfirm() {
  const [state, setState] = useState(null)
  const confirm = (msg) => new Promise(resolve => setState({ msg, resolve }))
  const modal = state ? (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'360px', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize:'15px', color:C.text, marginBottom:'20px', lineHeight:'1.6', whiteSpace:'pre-line' }}>{state.msg}</div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
          <Btn onClick={()=>{ state.resolve(false); setState(null) }} secondary>취소</Btn>
          <Btn onClick={()=>{ state.resolve(true); setState(null) }} danger>확인</Btn>
        </div>
      </div>
    </div>
  ) : null
  return { confirm, modal }
}

// ── 사이드바
function Sidebar({ vendorSession, page, onNav, onLogout }) {
  const nav = [
    { path:'dashboard', label:'대시보드', icon:'🏠' },
    { path:'products',  label:'교구 관리', icon:'🎒' },
  ]
  return (
    <aside style={{ width:'210px', minWidth:'210px', background:C.sidebar, display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0, fontFamily:'Noto Sans KR, sans-serif' }}>
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
        <div style={{ marginTop:'6px', display:'inline-block', fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:C.primary, color:'#fff' }}>파트너</div>
      </div>
      <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
        {nav.map(item=>(
          <button key={item.path} type="button" onClick={()=>onNav(item.path)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px',
            background:page===item.path?'#f9731618':'none', border:'none',
            borderLeft:page===item.path?`3px solid ${C.primary}`:'3px solid transparent',
            color:page===item.path?C.primary:'#a1a1aa',
            fontSize:'14px', fontWeight:page===item.path?600:400,
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

// ── 대시보드
function Dashboard({ vendorSession, subjects, products, contents }) {
  const vendor = vendorSession?.vendor || {}
  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom:'24px' }}>
        <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>👋 안녕하세요, {vendor.name}!</h2>
        <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>과목과 교구를 등록하고 관리하세요.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'28px' }}>
        {[
          ['📚','전체 과목', subjects.length, C.blue],
          ['🎒','전체 교구', products.length, C.primary],
          ['📝','등록 차시', contents.length, C.purple],
        ].map(([icon,label,val,color])=>(
          <div key={label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'20px', textAlign:'center' }}>
            <div style={{ fontSize:'28px', marginBottom:'6px' }}>{icon}</div>
            <div style={{ fontSize:'28px', fontWeight:700, color }}>{val}</div>
            <div style={{ fontSize:'12px', color:C.muted }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff7ed', borderRadius:'12px', border:'1px solid #fed7aa', padding:'18px' }}>
        <h3 style={{ fontSize:'14px', fontWeight:700, color:C.primary, margin:'0 0 10px' }}>📋 등록 가이드</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', fontSize:'13px', color:C.text }}>
          {[
            ['1️⃣','교구 관리 이동','좌측 메뉴에서 교구 관리를 클릭하세요.'],
            ['2️⃣','과목 추가','+ 과목 추가 버튼으로 과목을 먼저 등록하세요.'],
            ['3️⃣','교구 등록','과목을 펼치면 교구를 등록할 수 있습니다.'],
            ['4️⃣','일괄 등록','엑셀로 과목·교구·차시를 한번에 등록할 수 있습니다.'],
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

// ── 교구 관리 (Supplies.jsx 방식 — 한 페이지에서 과목+교구 관리)
function ProductsPage({ vendorId, vendorSession, subjects, products, contents, onReload }) {
  const [expanded, setExpanded]         = useState(null)  // 펼쳐진 과목 id
  const [subjectForm, setSubjectForm]   = useState('')
  const [editSubject, setEditSubject]   = useState(null)
  const [productModal, setProductModal] = useState(false)
  const [productVendorSubjectId, setProductVendorSubjectId] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm]   = useState({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3, priceRetail:'', priceSchool:'', priceBranch:'', priceTeacher:'' })
  const [stageTab, setStageTab]         = useState(1)
  const [stageTitles, setStageTitles]   = useState({})
  const { success, error } = useToast()
  const { confirm, modal } = useConfirm()

  // 첫 과목 자동 펼침
  useEffect(() => {
    setExpanded(prev => prev || (subjects.length > 0 ? subjects[0].id : null))
  }, [subjects])

  // ── 과목 저장
  const saveSubject = async () => {
    if (!subjectForm.trim()) { error('과목명을 입력하세요'); return }
    if (editSubject) {
      await DB.saveSubject({ ...editSubject, name:subjectForm })
    } else {
      await DB.saveSubject({ id:uid(), vendorId, name:subjectForm, createdAt:now() })
    }
    setSubjectForm(''); setEditSubject(null)
    onReload(); success(editSubject?'수정되었습니다.':'과목이 추가되었습니다.')
  }

  // ── 과목 삭제
  const delSubject = async (s) => {
    const ok = await confirm(`"${s.name}" 과목을 삭제하시겠습니까?\n연결된 교구도 함께 삭제됩니다.`)
    if (!ok) return
    const prods = products.filter(p=>p.subjectId===s.id)
    for (const p of prods) await DB.delProduct(p.id)
    await DB.delSubject(s.id)
    onReload(); success('삭제되었습니다.')
  }

  // ── 일괄 등록
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

      // 컬럼 고정: 업체명(0) 담당자(1) 연락처(2) 과목(3) 교구명(4) 단계(5) 차시번호(6) 차시제목(7) 메모(8)
      const subjectMap = {}
      dataRows.forEach(r => {
        const subjectName = String(r[3]||'').trim()
        const productName = String(r[4]||'').trim()
        const stage       = Number(r[5])||1
        const sessionNo   = Number(r[6])||1
        const title       = String(r[7]||'').trim()
        const supplies    = String(r[8]||'').trim()
        if (!subjectName || !productName) return
        if (!subjectMap[subjectName]) subjectMap[subjectName] = { products:{} }
        if (!subjectMap[subjectName].products[productName]) subjectMap[subjectName].products[productName] = []
        subjectMap[subjectName].products[productName].push({ stage, sessionNo, title, supplies })
      })

      let subjectCount = 0, productCount = 0, planCount = 0
      const curSubjects = (await dbCall('getAll','hqVendorSubjects'))||[]
      const curProducts = (await dbCall('getAll','hqVendorProducts'))||[]
      const curContents = (await dbCall('getAll','hqVendorContents'))||[]
      const mySubjects  = curSubjects.filter(s=>s.vendorId===vendorId && !s._deleted)
      const myProducts  = curProducts.filter(p=>p.vendorId===vendorId && !p._deleted)
      const myContents  = curContents.filter(c=>!c._deleted)

      for (const [subjectName, subjectData] of Object.entries(subjectMap)) {
        let subject = mySubjects.find(s=>s.name===subjectName)
        if (!subject) {
          const newS = { id:uid(), vendorId, name:subjectName, createdAt:now() }
          await DB.saveSubject(newS)
          subject = newS; mySubjects.push(newS); subjectCount++
        }
        for (const [productName, plans] of Object.entries(subjectData.products)) {
          let product = myProducts.find(p=>p.subjectId===subject.id && p.name===productName)
          if (!product) {
            const maxStage = Math.max(...plans.map(p=>p.stage))
            const newP = { id:uid(), vendorId, subjectId:subject.id, name:productName, maxStage, sessionsPerStage:12, alertSession:3, createdAt:now() }
            await DB.saveProduct(newP)
            product = newP; myProducts.push(newP); productCount++
          }
          for (const pl of plans) {
            const exists = myContents.find(x=>x.productId===product.id && x.stage===pl.stage && x.sessionNo===pl.sessionNo)
            if (!exists) {
              const newC = { id:uid(), stageId:`${product.id}_${pl.stage}`, productId:product.id, stage:pl.stage, sessionNo:pl.sessionNo, title:pl.title, supplies:pl.supplies, createdAt:now() }
              await DB.saveContent(newC)
              myContents.push(newC); planCount++
            }
          }
        }
      }
      onReload()
      success(`과목 ${subjectCount}개, 교구 ${productCount}개, 차시 ${planCount}개 등록 완료!`)
    } catch(err) {
      error('파일 읽기 실패: ' + err.message)
    }
  }

  // ── 교구 모달 열기
  const openProductModal = (subjectId, existing=null) => {
    setProductVendorSubjectId(subjectId)
    if (existing) {
      const maxS = existing.maxStage||10
      const perS = existing.sessionsPerStage||12
      const titles = {}
      for (let s=1; s<=maxS; s++) {
        const plans = contents.filter(c=>c.productId===existing.id && c.stage===s).sort((a,b)=>a.sessionNo-b.sessionNo)
        titles[s] = Array.from({length:perS}, (_,i) => ({ title:plans[i]?.title||'', memo:plans[i]?.supplies||'' }))
      }
      setProductForm({ id:existing.id, name:existing.name, maxStage:maxS, sessionsPerStage:perS, alertSession:existing.alertSession||3, priceRetail:existing.priceRetail||'', priceSchool:existing.priceSchool||'', priceBranch:existing.priceBranch||'', priceTeacher:existing.priceTeacher||'' })
      setStageTitles(titles); setEditingProduct(existing)
    } else {
      const titles = {}
      for (let s=1; s<=10; s++) titles[s] = Array.from({length:12}, ()=>({title:'',memo:''}))
      setProductForm({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3, priceRetail:'', priceSchool:'', priceBranch:'', priceTeacher:'' })
      setStageTitles(titles); setEditingProduct(null)
    }
    setStageTab(1); setProductModal(true)
  }

  // ── 교구 저장
  const saveProduct = async () => {
    if (!productForm.name.trim()) { error('교구명을 입력하세요'); return }
    const isEdit    = !!productForm.id
    const productId = isEdit ? productForm.id : uid()
    await DB.saveProduct({
      id:productId, vendorId, subjectId:productVendorSubjectId,
      name:productForm.name, maxStage:productForm.maxStage,
      sessionsPerStage:productForm.sessionsPerStage, alertSession:productForm.alertSession,
      priceRetail:productForm.priceRetail||null, priceSchool:productForm.priceSchool||null,
      priceBranch:productForm.priceBranch||null, priceTeacher:productForm.priceTeacher||null,
      createdAt:isEdit?(editingProduct?.createdAt||now()):now(),
    })
    for (let stage=1; stage<=productForm.maxStage; stage++) {
      const items = stageTitles[stage]||[]
      for (let idx=0; idx<items.length; idx++) {
        const t = items[idx]?.title||''; const m = items[idx]?.memo||''
        if (!t.trim()) continue
        const sessionNo = idx+1
        const existing = contents.find(c=>c.productId===productId && c.stage===stage && c.sessionNo===sessionNo)
        if (existing) {
          await DB.saveContent({ ...existing, title:t, supplies:m })
        } else {
          await DB.saveContent({ id:uid(), stageId:`${productId}_${stage}`, productId, stage, sessionNo, title:t, supplies:m, createdAt:now() })
        }
      }
    }
    onReload(); setProductModal(false)
    success(isEdit?'수정되었습니다.':'교구가 등록되었습니다.')
  }

  // ── 교구 삭제
  const delProduct = async (p) => {
    const ok = await confirm(`"${p.name}" 교구를 삭제하시겠습니까?`)
    if (!ok) return
    await DB.delProduct(p.id)
    onReload(); success('삭제되었습니다.')
  }

  return (
    <div style={{ padding:'28px', fontFamily:'Noto Sans KR, sans-serif', maxWidth:'900px' }}>
      {modal}

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'8px' }}>
        <h2 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🎒 교구 관리</h2>
        <div style={{ display:'flex', gap:'8px' }}>
          <button type="button" onClick={downloadSample} style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${C.blue}`, background:'#eff6ff', color:C.blue, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📋 샘플 다운로드</button>
          <label style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${C.purple}`, background:'#f5f3ff', color:C.purple, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📤 일괄 등록
            <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleBulkUpload} />
          </label>
          {products.length>0 && (
            <button type="button" onClick={()=>downloadProducts(vendorSession?.vendor?.name||'', products, contents)} style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${C.success}`, background:'#f0fdf4', color:C.success, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>⬇ 다운로드</button>
          )}
        </div>
      </div>

      {/* 과목 추가 인풋 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
        <input style={{ ...iSt, flex:1 }} placeholder="과목명 입력 후 추가 (예: 로봇, 드론, 보드게임)"
          value={subjectForm} onChange={e=>setSubjectForm(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&saveSubject()} />
        <Btn onClick={saveSubject}>{editSubject?'수정 저장':'+ 과목 추가'}</Btn>
        {editSubject && <Btn onClick={()=>{ setEditSubject(null); setSubjectForm('') }} secondary>취소</Btn>}
      </div>

      {/* 과목 없을 때 */}
      {subjects.length===0 && (
        <div style={{ padding:'18px', background:'#fff7ed', borderRadius:'12px', border:'1px solid #fed7aa', fontSize:'14px', color:C.primary }}>
          ⚠️ 먼저 과목을 추가하거나, 위의 <strong>일괄 등록</strong>으로 한번에 등록하세요.
        </div>
      )}

      {/* 과목별 아코디언 */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {subjects.map(s => {
          const isOpen   = expanded === s.id
          const subProds = products.filter(p=>p.subjectId===s.id)
          return (
            <div key={s.id} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${isOpen?C.primary:C.border}`, overflow:'hidden' }}>
              {/* 과목 헤더 */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 18px', cursor:'pointer', background:isOpen?'#fff7ed':'#fff' }}
                onClick={()=>setExpanded(isOpen?null:s.id)}>
                <span style={{ fontSize:'16px', transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'rotate(0deg)', color:C.muted }}>▶</span>
                <span style={{ flex:1, fontSize:'15px', fontWeight:700, color:isOpen?C.primary:C.text }}>📚 {s.name}</span>
                <span style={{ fontSize:'12px', color:C.muted, marginRight:'8px' }}>{subProds.length}개 교구</span>
                <div style={{ display:'flex', gap:'6px' }} onClick={e=>e.stopPropagation()}>
                  <Btn onClick={()=>{ setEditSubject(s); setSubjectForm(s.name) }} secondary small>수정</Btn>
                  <Btn onClick={()=>delSubject(s)} danger small>삭제</Btn>
                </div>
              </div>

              {/* 교구 목록 */}
              {isOpen && (
                <div style={{ padding:'12px 18px', borderTop:`1px solid ${C.border}`, background:'#fafafa' }}>
                  {subProds.length===0
                    ? <Empty icon="📦" msg="등록된 교구가 없습니다." />
                    : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
                        {subProds.map(p => {
                          const plans  = contents.filter(c=>c.productId===p.id)
                          const stages = [...new Set(plans.map(c=>c.stage))].sort((a,b)=>a-b)
                          return (
                            <div key={p.id} style={{ padding:'12px 14px', borderRadius:'10px', border:`1px solid ${C.border}`, background:C.card, display:'flex', alignItems:'center', gap:'12px' }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>📦 {p.name}</div>
                                <div style={{ fontSize:'11px', color:C.muted, marginTop:'3px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                  {stages.map(st => {
                                    const cnt = plans.filter(c=>c.stage===st).length
                                    return <span key={st} style={{ background:'#f5f3ff', color:'#7c3aed', borderRadius:'4px', padding:'1px 6px' }}>{st}단계({cnt}차시)</span>
                                  })}
                                  {!stages.length && <span>차시 미등록</span>}
                                </div>
                                <div style={{ fontSize:'11px', marginTop:'3px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                                  {[
                                    {label:'소비자가',val:p.priceRetail, color:C.muted},
                                    {label:'학교',    val:p.priceSchool, color:C.blue},
                                    {label:'지사',    val:p.priceBranch, color:C.purple},
                                    {label:'선생님',  val:p.priceTeacher,color:C.success},
                                  ].filter(x=>x.val>0).map(({label,val,color})=>(
                                    <span key={label} style={{ color }}>{label} {Number(val).toLocaleString()}원</span>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                                <Btn onClick={()=>openProductModal(s.id, p)} secondary small>수정</Btn>
                                <Btn onClick={()=>delProduct(p)} danger small>삭제</Btn>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                  <button type="button" onClick={()=>openProductModal(s.id)} style={{ width:'100%', padding:'9px', borderRadius:'9px', border:`2px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    + 교구 등록
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 교구 등록/수정 모달 */}
      {productModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e=>{ if(e.target===e.currentTarget) setProductModal(false) }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'560px', maxWidth:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{productForm.id?'📦 교구 수정':'📦 교구 등록'}</div>
              <button type="button" onClick={()=>setProductModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
            </div>
            <div style={{ padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* 교구명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={productForm.name} onChange={e=>setProductForm(v=>({...v,name:e.target.value}))} placeholder="예: 큐보" style={iSt2} autoFocus />
              </div>

              {/* 기본 설정 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                {[
                  { key:'maxStage',         label:'최대 단계',          min:1, max:20 },
                  { key:'sessionsPerStage', label:'단계당 차시 수',      min:1, max:50 },
                  { key:'alertSession',     label:'준비 알림 (차시 전)', min:1, max:50 },
                ].map(({key,label,min,max})=>(
                  <div key={key}>
                    <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{label}</label>
                    <input type="number" min={min} max={max} value={productForm[key]}
                      onChange={e=>{
                        const val = Number(e.target.value)
                        setProductForm(v=>({...v,[key]:val}))
                        if (key==='maxStage') {
                          setStageTitles(prev=>{ const n={...prev}; for(let s=1;s<=val;s++) if(!n[s]) n[s]=Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})); return n })
                          if (stageTab>val) setStageTab(val)
                        }
                        if (key==='sessionsPerStage') {
                          setStageTitles(prev=>{ const n={}; for(let s=1;s<=productForm.maxStage;s++){ const c=prev[s]||[]; n[s]=Array.from({length:val},(_,i)=>c[i]||{title:'',memo:''}) } return n })
                        }
                      }}
                      style={{ ...iSt2, textAlign:'center' }} />
                  </div>
                ))}
              </div>

              {/* 가격 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>가격 설정</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                  {[
                    {key:'priceRetail', label:'💰 소비자가'},
                    {key:'priceSchool', label:'🏫 학교공급가'},
                    {key:'priceBranch', label:'🏢 지사공급가'},
                    {key:'priceTeacher',label:'👨‍🏫 선생님공급가'},
                  ].map(({key,label})=>(
                    <div key={key}>
                      <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>{label}</label>
                      <input style={iSt2} type="number" value={productForm[key]||''} onChange={e=>setProductForm(v=>({...v,[key]:e.target.value}))} placeholder="0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 단계 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계 선택</label>
                <select value={stageTab} onChange={e=>{ const st=Number(e.target.value); setStageTab(st); setStageTitles(prev=>({...prev,[st]:prev[st]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})) })) }} style={{ ...iSt2, background:'#fff' }}>
                  {Array.from({length:productForm.maxStage},(_,i)=>i+1).map(s=>{
                    const filled=(stageTitles[s]||[]).filter(t=>(t?.title||'').trim()).length
                    return <option key={s} value={s}>{s}단계{filled>0?` (${filled}개 입력됨)`:''}</option>
                  })}
                </select>
              </div>

              {/* 차시 목록 */}
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', background:C.bg, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>📝 {stageTab}단계 차시별 제목</span>
                  <span style={{ fontSize:'11px', color:C.muted }}>{(stageTitles[stageTab]||[]).filter(i=>(i?.title||'').trim()).length} / {(stageTitles[stageTab]||[]).length}개 입력</span>
                </div>
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  {['차시','제목','준비물',''].map((h,i)=><span key={i} style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>{h}</span>)}
                </div>
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'220px', overflowY:'auto' }}>
                  {(stageTitles[stageTab]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''}))).map((item,idx)=>{
                    const t=item?.title||''; const m=item?.memo||''
                    const upd=(field,val)=>setStageTitles(prev=>{ const c=[...(prev[stageTab]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})))]; c[idx]={...c[idx],title:field==='title'?val:t,memo:field==='memo'?val:m}; return {...prev,[stageTab]:c} })
                    return (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                        <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{idx+1}차시</span>
                        <input value={t} onChange={e=>upd('title',e.target.value)} placeholder="제목" style={{ ...iSt2, padding:'5px 8px' }} />
                        <input value={m} onChange={e=>upd('memo',e.target.value)} placeholder="준비물" style={{ ...iSt2, padding:'5px 8px' }} />
                        <button type="button" onClick={()=>setStageTitles(prev=>{ const c=[...(prev[stageTab]||[])]; c.splice(idx,1); return {...prev,[stageTab]:c} })} style={{ padding:'3px 6px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button type="button" onClick={()=>setStageTitles(prev=>{ const c=[...(prev[stageTab]||[])]; c.push({title:'',memo:''}); return {...prev,[stageTab]:c} })} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                    + 차시 추가
                  </button>
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button type="button" onClick={saveProduct} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
              <button type="button" onClick={()=>setProductModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 메인
export function VendorApp({ vendorSession, onLogout }) {
  const [page, setPage]         = useState('products')
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const [contents, setContents] = useState([])
  const vendorId = vendorSession?.vendorId

  const reload = useCallback(async () => {
    if (!vendorId) return
    const [s, p, c] = await Promise.all([
      DB.subjects(vendorId),
      DB.products(vendorId),
      DB.contents(vendorId),
    ])
    setSubjects(s); setProducts(p); setContents(c)
  }, [vendorId])

  useEffect(() => { reload() }, [reload])

  const handleLogout = () => {
    localStorage.removeItem(LS_SESSION)
    onLogout()
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Noto Sans KR, sans-serif' }}>
      <Sidebar vendorSession={vendorSession} page={page} onNav={setPage} onLogout={handleLogout} />
      <main style={{ flex:1, background:C.bg, overflowY:'auto' }}>
        {page==='dashboard' && <Dashboard vendorSession={vendorSession} subjects={subjects} products={products} contents={contents} />}
        {page==='products'  && <ProductsPage vendorId={vendorId} vendorSession={vendorSession} subjects={subjects} products={products} contents={contents} onReload={reload} />}
      </main>
    </div>
  )
}
