/**
 * VendorApp.jsx
 * 업체 전용 앱 — Supplies.jsx 교구업체 탭 구조 그대로
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

const iSt = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }

// ── DB 헬퍼
const DB = {
  subjects:    async (vid) => ((await dbCall('getAll','hqVendorSubjects'))||[]).filter(s=>s.vendorId===vid&&!s._deleted),
  saveSubject: async (s)   => dbCall('upsert','hqVendorSubjects',{data:s}),
  delSubject:  async (id)  => dbCall('delete','hqVendorSubjects',{id}),

  products:    async (vid) => ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.vendorId===vid&&!p._deleted),
  saveProduct: async (p)   => dbCall('upsert','hqVendorProducts',{data:p}),
  delProduct:  async (id)  => dbCall('delete','hqVendorProducts',{id}),

  allContents: async (vid) => {
    const prods = ((await dbCall('getAll','hqVendorProducts'))||[]).filter(p=>p.vendorId===vid&&!p._deleted)
    const pids  = new Set(prods.map(p=>p.id))
    return ((await dbCall('getAll','hqVendorContents'))||[]).filter(c=>pids.has(c.productId)&&!c._deleted)
  },
  saveContent: async (c)   => dbCall('upsert','hqVendorContents',{data:c}),
  delContent:  async (id)  => dbCall('delete','hqVendorContents',{id}),
}

// ── 엑셀 샘플 다운로드
function downloadSampleExcel() {
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

function downloadProductsExcel(vendorName, products, contents) {
  const rows = [['업체명','담당자','연락처','과목','교구명','단계','차시번호','차시제목','메모']]
  products.forEach(p => {
    const plans = contents.filter(c=>c.productId===p.id).sort((a,b)=>a.stage-b.stage||a.sessionNo-b.sessionNo)
    if (!plans.length) rows.push([vendorName,'','','',p.name,'','','',''])
    else plans.forEach(pl=>rows.push([vendorName,'','','',p.name,pl.stage||'',pl.sessionNo||'',pl.title||'',pl.supplies||'']))
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{wch:16},{wch:10},{wch:14},{wch:10},{wch:20},{wch:8},{wch:10},{wch:30},{wch:20}]
  XLSX.utils.book_append_sheet(wb, ws, '교구목록')
  XLSX.writeFile(wb, `교구목록_${vendorName}_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')} .xlsx`)
}

// ── 사이드바
function Sidebar({ vendorSession, onLogout }) {
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
      <nav style={{ flex:1, padding:'10px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px', background:'#f9731618', borderLeft:`3px solid ${C.primary}`, color:C.primary, fontSize:'14px', fontWeight:600 }}>
          <span>🎒</span> 교구 관리
        </div>
      </nav>
      <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
        <button type="button" onClick={onLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px', fontFamily:'Noto Sans KR, sans-serif' }}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  )
}

// ── 메인 교구관리 페이지
function ProductsPage({ vendorId, vendorSession, subjects, products, contents, onReload }) {
  const [expandedVendor, setExpandedVendor] = useState(null)
  const [expandedStage, setExpandedStage]   = useState(null)

  // 과목 폼
  const [subjectModal, setSubjectModal] = useState(false)
  const [newSubject, setNewSubject]     = useState('')

  // 교구 모달
  const [productModal, setProductModal]       = useState(false)
  const [productSubjectId, setProductSubjectId] = useState(null)
  const [editingProduct, setEditingProduct]   = useState(null)
  const [productForm, setProductForm]         = useState({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3 })
  const [productStageTab, setProductStageTab] = useState(1)
  const [stageSessionTitles, setStageSessionTitles] = useState({})

  // 차시 편집 모달 (sessionPlan)
  const [sessionPlanModal, setSessionPlanModal] = useState(false)
  const [sessionPlanTarget, setSessionPlanTarget] = useState({ productId:'', stage:1 })
  const [sessionPlanEdits, setSessionPlanEdits] = useState([])

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const { success, error: toastError } = useToast()

  // 첫 과목 자동 펼침
  useEffect(() => {
    setExpandedVendor(prev => prev || (subjects.length > 0 ? subjects[0].id : null))
  }, [subjects])

  // ── 과목 추가
  const addSubject = async () => {
    const s = newSubject.trim()
    if (!s) return
    if (subjects.find(x=>x.name===s)) { toastError('이미 있는 과목입니다'); return }
    await DB.saveSubject({ id:uid(), vendorId, name:s, createdAt:now() })
    setNewSubject(''); setSubjectModal(false)
    onReload(); success('과목이 추가되었습니다.')
  }

  // ── 과목 삭제
  const deleteSubject = (s) => {
    setDeleteConfirm({ msg:`"${s.name}" 과목을 삭제하시겠습니까?\n연결된 교구도 함께 삭제됩니다.`, onOk: async () => {
      const prods = products.filter(p=>p.subjectId===s.id)
      for (const p of prods) await DB.delProduct(p.id)
      await DB.delSubject(s.id)
      onReload(); success('삭제가 완료되었습니다.')
    }})
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
      const dataRows = rows.slice(1).filter(r=>r[0])
      if (!dataRows.length) { toastError('등록할 데이터가 없습니다.'); return }

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
      const mySubjects  = curSubjects.filter(s=>s.vendorId===vendorId&&!s._deleted)
      const myProducts  = curProducts.filter(p=>p.vendorId===vendorId&&!p._deleted)
      const myContents  = curContents.filter(c=>!c._deleted)

      for (const [subjectName, subjectData] of Object.entries(subjectMap)) {
        let subject = mySubjects.find(s=>s.name===subjectName)
        if (!subject) {
          const newS = { id:uid(), vendorId, name:subjectName, createdAt:now() }
          await DB.saveSubject(newS)
          subject = newS; mySubjects.push(newS); subjectCount++
        }
        for (const [productName, plans] of Object.entries(subjectData.products)) {
          let product = myProducts.find(p=>p.subjectId===subject.id&&p.name===productName)
          if (!product) {
            const maxStage = Math.max(...plans.map(p=>p.stage))
            const newP = { id:uid(), vendorId, subjectId:subject.id, name:productName, maxStage, sessionsPerStage:12, alertSession:3, createdAt:now() }
            await DB.saveProduct(newP)
            product = newP; myProducts.push(newP); productCount++
          }
          for (const pl of plans) {
            const exists = myContents.find(x=>x.productId===product.id&&x.stage===pl.stage&&x.sessionNo===pl.sessionNo)
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
      toastError('파일 읽기 실패: ' + err.message)
    }
  }

  // ── 교구 모달 열기
  const openProductModal = (subjectId, existing=null) => {
    setProductSubjectId(subjectId)
    if (existing) {
      const maxS = existing.maxStage||10
      const perS = existing.sessionsPerStage||12
      const titles = {}
      for (let s=1; s<=maxS; s++) {
        const plans = contents.filter(c=>c.productId===existing.id&&c.stage===s).sort((a,b)=>a.sessionNo-b.sessionNo)
        titles[s] = Array.from({length:perS}, (_,i) => ({ title:plans[i]?.title||'', memo:plans[i]?.supplies||'' }))
      }
      setProductForm({ id:existing.id, name:existing.name, maxStage:maxS, sessionsPerStage:perS, alertSession:existing.alertSession||3 })
      setStageSessionTitles(titles); setEditingProduct(existing)
    } else {
      const titles = {}
      for (let s=1; s<=10; s++) titles[s] = Array.from({length:12}, ()=>({title:'',memo:''}))
      setProductForm({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3 })
      setStageSessionTitles(titles); setEditingProduct(null)
    }
    setProductStageTab(1); setProductModal(true)
  }

  // ── 교구 저장
  const saveProduct = async () => {
    if (!productForm.name.trim()) { toastError('교구명을 입력하세요'); return }
    const isEdit    = !!productForm.id
    const productId = isEdit ? productForm.id : uid()
    await DB.saveProduct({
      id:productId, vendorId, subjectId:productSubjectId,
      name:productForm.name, maxStage:productForm.maxStage,
      sessionsPerStage:productForm.sessionsPerStage, alertSession:productForm.alertSession,
      createdAt:isEdit?(editingProduct?.createdAt||now()):now(),
    })
    for (let stage=1; stage<=productForm.maxStage; stage++) {
      const items = stageSessionTitles[stage]||[]
      for (let idx=0; idx<items.length; idx++) {
        const t = items[idx]?.title||''; const m = items[idx]?.memo||''
        if (!t.trim()) continue
        const sessionNo = idx+1
        const existing = contents.find(c=>c.productId===productId&&c.stage===stage&&c.sessionNo===sessionNo)
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
  const deleteProduct = (p) => {
    setDeleteConfirm({ msg:`"${p.name}" 교구를 삭제하시겠습니까?`, onOk: async () => {
      await DB.delProduct(p.id); onReload(); success('삭제가 완료되었습니다.')
    }})
  }

  // ── 차시 편집 모달
  const openSessionPlan = (productId, stage) => {
    const list = contents.filter(c=>c.productId===productId&&c.stage===stage).sort((a,b)=>a.sessionNo-b.sessionNo)
    setSessionPlanTarget({ productId, stage })
    setSessionPlanEdits(list.map(c=>({ id:c.id, sessionNo:c.sessionNo, title:c.title||'', memo:c.supplies||'', _isNew:false })))
    setSessionPlanModal(true)
  }

  const saveSessionPlan = async () => {
    const { productId, stage } = sessionPlanTarget
    const originals = contents.filter(c=>c.productId===productId&&c.stage===stage)
    const editIds   = sessionPlanEdits.filter(e=>!e._isNew).map(e=>e.id)
    for (const o of originals) if (!editIds.includes(o.id)) await DB.delContent(o.id)
    for (const e of sessionPlanEdits) {
      if (e._isNew) {
        await DB.saveContent({ id:e.id, stageId:`${productId}_${stage}`, productId, stage, sessionNo:e.sessionNo, title:e.title, supplies:e.memo, createdAt:now() })
      } else {
        const orig = originals.find(o=>o.id===e.id)
        if (orig) await DB.saveContent({ ...orig, sessionNo:e.sessionNo, title:e.title, supplies:e.memo })
      }
    }
    onReload(); setSessionPlanModal(false); success('수정이 완료되었습니다.')
  }

  const vendor = vendorSession?.vendor || {}

  return (
    <div style={{ padding:'24px', maxWidth:'1100px', fontFamily:'Noto Sans KR, sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🎒 교구 관리</h1>
          <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>과목별 담당자 · 교구 목록 · 차시 진도체크 관리</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button type="button" onClick={()=>{ setNewSubject(''); setSubjectModal(true) }}
            style={{ padding:'8px 18px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 과목 추가
          </button>
        </div>
      </div>

      {/* 툴바: 샘플/일괄등록 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontSize:'13px', color:C.muted }}>업체별 담당자 · 교구 목록 · 차시를 관리합니다.</div>
        <div style={{ display:'flex', gap:'6px' }}>
          <button type="button" onClick={downloadSampleExcel}
            style={{ padding:'6px 12px', borderRadius:'7px', border:`1.5px solid ${C.blue}`, background:'#eff6ff', color:C.blue, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📋 샘플 다운로드
          </button>
          <label style={{ padding:'6px 12px', borderRadius:'7px', border:`1.5px solid ${C.purple}`, background:'#f5f3ff', color:C.purple, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📤 일괄 등록
            <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleBulkUpload} />
          </label>
        </div>
      </div>

      {/* 과목 없을 때 */}
      {subjects.length===0 && (
        <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📚</div>
          <div style={{ fontSize:'14px' }}>등록된 과목이 없습니다</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>위의 <strong>일괄 등록</strong>으로 한번에 등록하거나, <strong>+ 과목 추가</strong>를 눌러 시작하세요.</div>
        </div>
      )}

      {/* 과목별 업체 카드 (Supplies.jsx 교구업체 탭과 동일) */}
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {subjects.map(s => {
          const sProducts  = products.filter(p=>p.subjectId===s.id)
          const isExpanded = expandedVendor === s.id
          return (
            <div key={s.id} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
              {/* 업체(과목) 헤더 */}
              <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', background:isExpanded?C.bg:C.card }}
                onClick={()=>setExpandedVendor(isExpanded?null:s.id)}>
                <span style={{ fontSize:'20px' }}>🏢</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{vendor.name}</div>
                  <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, marginTop:'2px', flexWrap:'wrap' }}>
                    {vendor.managerName && <span>👤 {vendor.managerName}</span>}
                    {vendor.phone       && <span>📞 {vendor.phone}</span>}
                    <span style={{ background:'#eff6ff', color:C.blue, borderRadius:'4px', padding:'1px 6px', fontWeight:600 }}>📚 {s.name}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {sProducts.length>0 && <span style={{ fontSize:'12px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>교구 {sProducts.length}종</span>}
                  <button type="button" onClick={e=>{ e.stopPropagation(); setDeleteConfirm({ msg:`"${s.name}" 과목을 삭제하시겠습니까?`, onOk:async()=>{ for(const p of sProducts) await DB.delProduct(p.id); await DB.delSubject(s.id); onReload(); success('삭제가 완료되었습니다.') } }) }}
                    style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  <span style={{ fontSize:'14px', color:C.muted }}>{isExpanded?'▲':'▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop:`1px solid ${C.border}` }}>
                  {/* 교구 목록 섹션 */}
                  <div style={{ padding:'14px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                      <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>🤖 교구 목록</span>
                      <div style={{ display:'flex', gap:'6px' }}>
                        {sProducts.length>0 && (
                          <button type="button" onClick={()=>downloadProductsExcel(vendor.name||'', sProducts, contents)}
                            style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.success}`, background:'#f0fdf4', color:C.success, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            ⬇ 다운로드
                          </button>
                        )}
                        <button type="button" onClick={()=>openProductModal(s.id)}
                          style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                          + 교구 등록
                        </button>
                      </div>
                    </div>

                    {sProducts.length===0 ? (
                      <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'12px 0' }}>등록된 교구가 없습니다</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                        {sProducts.map(p => {
                          const pContents = contents.filter(c=>c.productId===p.id)
                          const stages    = [...new Set(pContents.map(c=>c.stage))].sort((a,b)=>a-b)
                          return (
                            <div key={p.id} style={{ background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                              {/* 교구 헤더 */}
                              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px' }}>
                                <span style={{ fontSize:'18px' }}>🤖</span>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name}</div>
                                  <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                    {stages.length===0
                                      ? <span style={{ color:C.danger }}>차시 미등록</span>
                                      : stages.map(st=>{
                                          const cnt = pContents.filter(c=>c.stage===st).length
                                          return <span key={st} style={{ background:'#f5f3ff', color:'#7c3aed', borderRadius:'4px', padding:'1px 6px' }}>{st}단계({cnt}차시)</span>
                                        })
                                    }
                                  </div>
                                </div>
                                <button type="button" onClick={()=>openProductModal(s.id, p)}
                                  style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                                <button type="button" onClick={()=>deleteProduct(p)}
                                  style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                              </div>

                              {/* 단계별 진도체크 */}
                              <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📊 단계별 진도체크</span>
                                  {(() => {
                                    const nextStage = stages.length>0 ? Math.max(...stages)+1 : 1
                                    return nextStage<=(p.maxStage||10) ? (
                                      <button type="button" onClick={()=>openSessionPlan(p.id, nextStage)}
                                        style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                        + 추가
                                      </button>
                                    ) : null
                                  })()}
                                </div>
                                {stages.length===0
                                  ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시가 없습니다</div>
                                  : (
                                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                      {stages.map(stage => {
                                        const plans    = pContents.filter(c=>c.stage===stage).sort((a,b)=>a.sessionNo-b.sessionNo)
                                        const expandKey= `${p.id}_${stage}`
                                        const isOpen   = expandedStage===expandKey
                                        return (
                                          <div key={stage} style={{ background:C.card, borderRadius:'9px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', cursor:'pointer' }}
                                              onClick={()=>setExpandedStage(isOpen?null:expandKey)}>
                                              <span style={{ fontSize:'16px' }}>📝</span>
                                              <div style={{ flex:1 }}>
                                                <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name} {stage}단계 목차리스트</span>
                                                <span style={{ fontSize:'11px', color:C.success, marginLeft:'8px' }}>{plans.length}차시</span>
                                              </div>
                                              <button type="button" onClick={e=>{ e.stopPropagation(); openSessionPlan(p.id, stage) }}
                                                style={{ padding:'3px 10px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                                              <button type="button" onClick={e=>{ e.stopPropagation(); setDeleteConfirm({ msg:`${stage}단계 차시를 삭제하시겠습니까?`, onOk:async()=>{ for(const c of plans) await DB.delContent(c.id); onReload(); success('삭제가 완료되었습니다.') } }) }}
                                                style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                                              <span style={{ fontSize:'12px', color:C.muted }}>{isOpen?'▲':'▼'}</span>
                                            </div>
                                            {isOpen && (
                                              <div style={{ padding:'6px 12px 10px', borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:'3px' }}>
                                                {plans.map(pl=>(
                                                  <div key={pl.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr 1fr', gap:'6px', fontSize:'12px', padding:'4px 0', borderBottom:'1px solid #f9fafb' }}>
                                                    <span style={{ color:C.primary, fontWeight:700 }}>{pl.sessionNo}차시</span>
                                                    <span style={{ color:C.text }}>{pl.title}</span>
                                                    <span style={{ color:C.muted }}>{pl.supplies?`📌 ${pl.supplies}`:''}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                }
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 과목 추가 모달 */}
      {subjectModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'380px', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'16px' }}>📚 과목 추가</div>
            <input style={{ ...iSt, marginBottom:'16px' }} placeholder="과목명 입력 (예: 로봇, 드론, 보드게임)"
              value={newSubject} onChange={e=>setNewSubject(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSubject()} autoFocus />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button type="button" onClick={()=>setSubjectModal(false)} style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              <button type="button" onClick={addSubject} style={{ padding:'8px 20px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 교구 등록/수정 모달 */}
      {productModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e=>{ if(e.target===e.currentTarget) setProductModal(false) }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'560px', maxWidth:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{productForm.id?'🤖 교구 수정':'🤖 교구 등록'}</div>
              <button type="button" onClick={()=>setProductModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
            </div>
            <div style={{ padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* 교구명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={productForm.name} onChange={e=>setProductForm(v=>({...v,name:e.target.value}))} placeholder="예: 큐보 1단계, 로봇 키트 A형" style={iSt} autoFocus />
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
                        const val=Number(e.target.value)
                        setProductForm(v=>({...v,[key]:val}))
                        if (key==='maxStage') {
                          setStageSessionTitles(prev=>{ const n={...prev}; for(let s=1;s<=val;s++) if(!n[s]) n[s]=Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})); return n })
                          if (productStageTab>val) setProductStageTab(val)
                        }
                        if (key==='sessionsPerStage') {
                          setStageSessionTitles(prev=>{ const n={}; for(let s=1;s<=productForm.maxStage;s++){ const c=prev[s]||[]; n[s]=Array.from({length:val},(_,i)=>c[i]||{title:'',memo:''}) } return n })
                        }
                      }}
                      style={{ ...iSt, textAlign:'center' }} />
                  </div>
                ))}
              </div>
              {/* 단계 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계 선택</label>
                <select value={productStageTab} onChange={e=>{ const st=Number(e.target.value); setProductStageTab(st); setStageSessionTitles(prev=>({...prev,[st]:prev[st]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})) })) }} style={{ ...iSt, background:'#fff' }}>
                  {Array.from({length:productForm.maxStage},(_,i)=>i+1).map(s=>{
                    const filled=(stageSessionTitles[s]||[]).filter(t=>(t?.title||'').trim()).length
                    return <option key={s} value={s}>{s}단계{filled>0?` (${filled}개 입력됨)`:''}</option>
                  })}
                </select>
              </div>
              {/* 차시 목록 */}
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', background:C.bg, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>📝 {productStageTab}단계 차시별 제목</span>
                  <span style={{ fontSize:'11px', color:C.muted }}>{(stageSessionTitles[productStageTab]||[]).filter(i=>(i?.title||'').trim()).length} / {(stageSessionTitles[productStageTab]||[]).length}개 입력</span>
                </div>
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  {['차시','제목','준비물',''].map((h,i)=><span key={i} style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>{h}</span>)}
                </div>
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'220px', overflowY:'auto' }}>
                  {(stageSessionTitles[productStageTab]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''}))).map((item,idx)=>{
                    const t=item?.title||''; const m=item?.memo||''
                    const upd=(field,val)=>setStageSessionTitles(prev=>{ const c=[...(prev[productStageTab]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})))]; c[idx]={...c[idx],title:field==='title'?val:t,memo:field==='memo'?val:m}; return {...prev,[productStageTab]:c} })
                    return (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                        <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{idx+1}차시</span>
                        <input value={t} onChange={e=>upd('title',e.target.value)} placeholder="제목 (선택)" style={{ ...iSt, padding:'5px 8px', fontSize:'12px' }} />
                        <input value={m} onChange={e=>upd('memo',e.target.value)} placeholder="준비물 (선택)" style={{ ...iSt, padding:'5px 8px', fontSize:'12px' }} />
                        <button type="button" onClick={()=>setStageSessionTitles(prev=>{ const c=[...(prev[productStageTab]||[])]; c.splice(idx,1); return {...prev,[productStageTab]:c} })} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button type="button" onClick={()=>setStageSessionTitles(prev=>{ const c=[...(prev[productStageTab]||[])]; c.push({title:'',memo:''}); return {...prev,[productStageTab]:c} })} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
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

      {/* ── 차시 편집 모달 */}
      {sessionPlanModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e=>{ if(e.target===e.currentTarget) setSessionPlanModal(false) }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'520px', maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>📝 {sessionPlanTarget.stage}단계 차시 편집</div>
              <button type="button" onClick={()=>setSessionPlanModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
            </div>
            <div style={{ padding:'20px', overflowY:'auto', flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 1fr 28px', gap:'6px', marginBottom:'8px' }}>
                {['차시','제목','준비물',''].map((h,i)=><span key={i} style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>{h}</span>)}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                {sessionPlanEdits.map((e,idx)=>(
                  <div key={e.id} style={{ display:'grid', gridTemplateColumns:'50px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                    <input type="number" value={e.sessionNo} onChange={ev=>setSessionPlanEdits(p=>p.map((x,i)=>i===idx?{...x,sessionNo:Number(ev.target.value)}:x))} style={{ ...iSt, padding:'5px 8px', fontSize:'12px', textAlign:'center' }} />
                    <input value={e.title} onChange={ev=>setSessionPlanEdits(p=>p.map((x,i)=>i===idx?{...x,title:ev.target.value}:x))} placeholder="제목" style={{ ...iSt, padding:'5px 8px', fontSize:'12px' }} />
                    <input value={e.memo} onChange={ev=>setSessionPlanEdits(p=>p.map((x,i)=>i===idx?{...x,memo:ev.target.value}:x))} placeholder="준비물" style={{ ...iSt, padding:'5px 8px', fontSize:'12px' }} />
                    <button type="button" onClick={()=>setSessionPlanEdits(p=>p.filter((_,i)=>i!==idx))} style={{ padding:'3px 6px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={()=>setSessionPlanEdits(p=>[...p,{id:uid(),sessionNo:p.length+1,title:'',memo:'',_isNew:true}])}
                style={{ width:'100%', marginTop:'10px', padding:'8px', borderRadius:'8px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                + 차시 추가
              </button>
            </div>
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button type="button" onClick={saveSessionPlan} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
              <button type="button" onClick={()=>setSessionPlanModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'360px', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize:'15px', color:C.text, marginBottom:'20px', lineHeight:'1.6', whiteSpace:'pre-line' }}>{deleteConfirm.msg}</div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button type="button" onClick={()=>setDeleteConfirm(null)} style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              <button type="button" onClick={()=>{ deleteConfirm.onOk(); setDeleteConfirm(null) }} style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.danger, color:'#fff', fontWeight:600, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 메인
export function VendorApp({ vendorSession, onLogout }) {
  const [subjects, setSubjects] = useState([])
  const [products, setProducts] = useState([])
  const [contents, setContents] = useState([])
  const vendorId = vendorSession?.vendorId

  const reload = useCallback(async () => {
    if (!vendorId) return
    const [s, p, c] = await Promise.all([
      DB.subjects(vendorId),
      DB.products(vendorId),
      DB.allContents(vendorId),
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
      <Sidebar vendorSession={vendorSession} onLogout={handleLogout} />
      <main style={{ flex:1, background:C.bg, overflowY:'auto' }}>
        <ProductsPage
          vendorId={vendorId}
          vendorSession={vendorSession}
          subjects={subjects}
          products={products}
          contents={contents}
          onReload={reload}
        />
      </main>
    </div>
  )
}
