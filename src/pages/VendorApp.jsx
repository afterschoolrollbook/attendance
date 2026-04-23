/**
 * VendorApp.jsx
 * 업체 전용 앱
 * 구조: 과목 탭 선택 → 업체(자기자신) 카드 펼치면 교구 목록
 * Supplies.jsx 교구업체 탭과 동일한 방식
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

  files:       async (vid) => ((await dbCall('getAll','hqVendorFiles'))||[]).filter(f=>f.vendorId===vid&&!f._deleted),
  saveFile:    async (f)   => dbCall('upsert','hqVendorFiles',{data:f}),
  delFile:     async (id)  => dbCall('delete','hqVendorFiles',{id}),
}

// ── 엑셀 샘플/다운로드
function downloadSampleExcel() {
  const rows = [
    ['업체명','담당자','연락처','과목','교구명','단계','차시번호','차시제목','메모'],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','큐보',1,1,'큐보 1단계 1차시','배터리'],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','큐보',1,2,'큐보 1단계 2차시','배터리'],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','큐보',2,1,'큐보 2단계 1차시',''],
    ['집현전에듀','민찬홍','010-2704-0307','로봇','드론',1,1,'드론 1단계 1차시',''],
  ]
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows)
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
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{wch:16},{wch:10},{wch:14},{wch:10},{wch:20},{wch:8},{wch:10},{wch:30},{wch:20}]
  XLSX.utils.book_append_sheet(wb, ws, '교구목록')
  XLSX.writeFile(wb, `교구목록_${vendorName}_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')} .xlsx`)
}

// ── 파일 스토리지 업로드
async function uploadToStorage(vendorId, folder, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const filePath = `vendors/${vendorId}/${folder}/${Date.now()}_${file.name}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/teacher-files/${filePath}`, {
    method:'POST',
    headers:{ 'apikey':SUPABASE_ANON, 'Authorization':`Bearer ${SUPABASE_ANON}`, 'Content-Type':file.type||'application/octet-stream', 'x-upsert':'true' },
    body:file,
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.message||res.statusText) }
  return `${SUPABASE_URL}/storage/v1/object/public/teacher-files/${filePath}`
}

// ── FileRow
function FileRow({ item, onDelete, onEdit }) {
  const icon      = item.fileType==='promo'?'🖼':'📄'
  const typeLabel = {annual:'연간지도안',session:'차시별지도안',promo:'홍보물'}[item.fileType]||''
  const noFile    = !item.fileUrl
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:C.card, borderRadius:'9px', border:`1.5px solid ${noFile?'#fca5a5':C.border}` }}>
      <span style={{ fontSize:'20px', flexShrink:0 }}>{noFile?'⚠️':icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
        <div style={{ fontSize:'11px', marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ background:'#f3f4f6', borderRadius:'4px', padding:'0 5px', color:C.muted }}>{typeLabel}</span>
          {item.stage && <span style={{ background:'#eff6ff', color:C.blue, borderRadius:'4px', padding:'0 5px' }}>{item.stage}단계</span>}
          {noFile ? <span style={{ color:C.danger, fontWeight:600 }}>파일 업로드가 필요합니다</span> : <span style={{ color:C.muted }}>{item.fileName}</span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
        {item.fileUrl && <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer" style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'11px', fontWeight:600, textDecoration:'none' }}>⬇ 다운</a>}
        {onEdit && <button type="button" onClick={()=>onEdit(item)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>}
        <button type="button" onClick={()=>onDelete(item.id)} style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
      </div>
    </div>
  )
}

// ── 메인
export function VendorApp({ vendorSession: initSession, onLogout }) {
  const [vendorSession, setVendorSession] = useState(initSession)
  const [subjects,   setSubjects]   = useState([])
  const [products,   setProducts]   = useState([])
  const [contents,   setContents]   = useState([])
  const [files,      setFiles]      = useState([])

  // 과목 탭 — Supplies.jsx selSubject 방식 그대로
  const [selSubject,   setSelSubject]   = useState(null)
  const [expandedVendor, setExpandedVendor] = useState('me') // 업체 카드는 항상 하나('me')
  const [expandedStage,  setExpandedStage]  = useState(null)

  // 과목 추가 모달
  const [subjectModal, setSubjectModal] = useState(false)
  const [newSubject,   setNewSubject]   = useState('')

  // 업체 수정 모달
  const [vendorModal, setVendorModal] = useState(false)
  const [vendorForm,  setVendorForm]  = useState({ name:'', managerName:'', contact:'', phone:'', email:'', kakaoChannel:'', memo:'' })

  // 교구 모달
  const [productModal,       setProductModal]       = useState(false)
  const [editingProduct,     setEditingProduct]     = useState(null)
  const [productForm,        setProductForm]        = useState({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3 })
  const [productStageTab,    setProductStageTab]    = useState(1)
  const [stageSessionTitles, setStageSessionTitles] = useState({})

  // 차시 편집 모달
  const [sessionPlanModal,  setSessionPlanModal]  = useState(false)
  const [sessionPlanTarget, setSessionPlanTarget] = useState({ productId:'', stage:1 })
  const [sessionPlanEdits,  setSessionPlanEdits]  = useState([])

  // 파일 모달
  const [fileModal,     setFileModal]     = useState(false)
  const [fileMode,      setFileMode]      = useState('annual')
  const [fileProductId, setFileProductId] = useState('')
  const [fileStage,     setFileStage]     = useState('')
  const [fileEditItem,  setFileEditItem]  = useState(null)
  const [modalFile,     setModalFile]     = useState(null)
  const [uploading,     setUploading]     = useState(false)
  const fileRef = useRef()

  const [innerTab, setInnerTab] = useState('supply')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const { success, error: toastError } = useToast()

  const vendorId = vendorSession?.vendorId
  const vendor   = vendorSession?.vendor || {}

  const reload = useCallback(async () => {
    if (!vendorId) return
    const [s, p, c, f] = await Promise.all([
      DB.subjects(vendorId), DB.products(vendorId),
      DB.allContents(vendorId), DB.files(vendorId),
    ])
    setSubjects(s); setProducts(p); setContents(c); setFiles(f)
  }, [vendorId])

  useEffect(() => { reload() }, [reload])

  // 첫 과목 자동 선택 — Supplies.jsx selSubject 방식
  useEffect(() => {
    if (subjects.length > 0 && !selSubject) setSelSubject(subjects[0].name)
  }, [subjects])

  // ── 과목 추가
  const addSubject = async () => {
    const s = newSubject.trim()
    if (!s) return
    if (subjects.find(x=>x.name===s)) { toastError('이미 있는 과목입니다'); return }
    await DB.saveSubject({ id:uid(), vendorId, name:s, createdAt:now() })
    setNewSubject(''); setSubjectModal(false)
    reload(); success('과목이 추가되었습니다.')
  }

  // ── 과목 삭제
  const deleteSubject = (s) => {
    setDeleteConfirm({ msg:`"${s.name}" 과목을 삭제하시겠습니까?\n연결된 교구도 함께 삭제됩니다.`, onOk: async () => {
      const prods = products.filter(p=>p.subjectId===s.id)
      for (const p of prods) await DB.delProduct(p.id)
      await DB.delSubject(s.id)
      if (selSubject === s.name) setSelSubject(subjects.filter(x=>x.id!==s.id)[0]?.name || null)
      reload(); success('삭제가 완료되었습니다.')
    }})
  }

  // ── 업체 수정
  const openVendorModal = () => {
    setVendorForm({ name:vendor.name||'', managerName:vendor.managerName||'', contact:vendor.contact||'', phone:vendor.phone||'', email:vendor.email||'', kakaoChannel:vendor.kakaoChannel||'', memo:vendor.memo||'' })
    setVendorModal(true)
  }
  const saveVendor = async () => {
    if (!vendorForm.name) { toastError('업체명을 입력하세요'); return }
    await dbCall('upsert', 'hqVendors', { data: { ...vendor, ...vendorForm } })
    const updated = { ...vendorSession, vendor: { ...vendor, ...vendorForm } }
    localStorage.setItem(LS_SESSION, JSON.stringify(updated))
    setVendorSession(updated)
    setVendorModal(false); success('수정이 완료되었습니다.')
  }

  // ── 일괄 등록
  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
      const dataRows = rows.slice(1).filter(r=>r[0])
      if (!dataRows.length) { toastError('등록할 데이터가 없습니다.'); return }

      const subjectMap = {}
      dataRows.forEach(r => {
        const subjectName=String(r[3]||'').trim(); const productName=String(r[4]||'').trim()
        const stage=Number(r[5])||1; const sessionNo=Number(r[6])||1
        const title=String(r[7]||'').trim(); const supplies=String(r[8]||'').trim()
        if (!subjectName||!productName) return
        if (!subjectMap[subjectName]) subjectMap[subjectName] = { products:{} }
        if (!subjectMap[subjectName].products[productName]) subjectMap[subjectName].products[productName] = []
        subjectMap[subjectName].products[productName].push({ stage, sessionNo, title, supplies })
      })

      let sc=0, pc=0, cc=0
      const curS=(await dbCall('getAll','hqVendorSubjects'))||[]
      const curP=(await dbCall('getAll','hqVendorProducts'))||[]
      const curC=(await dbCall('getAll','hqVendorContents'))||[]
      const myS=curS.filter(s=>s.vendorId===vendorId&&!s._deleted)
      const myP=curP.filter(p=>p.vendorId===vendorId&&!p._deleted)
      const myC=curC.filter(c=>!c._deleted)

      for (const [sName, sData] of Object.entries(subjectMap)) {
        let subject = myS.find(s=>s.name===sName)
        if (!subject) { const n={id:uid(),vendorId,name:sName,createdAt:now()}; await DB.saveSubject(n); subject=n; myS.push(n); sc++ }
        for (const [pName, plans] of Object.entries(sData.products)) {
          let product = myP.find(p=>p.subjectId===subject.id&&p.name===pName)
          if (!product) { const n={id:uid(),vendorId,subjectId:subject.id,name:pName,maxStage:Math.max(...plans.map(p=>p.stage)),sessionsPerStage:12,alertSession:3,createdAt:now()}; await DB.saveProduct(n); product=n; myP.push(n); pc++ }
          for (const pl of plans) {
            if (!myC.find(x=>x.productId===product.id&&x.stage===pl.stage&&x.sessionNo===pl.sessionNo)) {
              const n={id:uid(),stageId:`${product.id}_${pl.stage}`,productId:product.id,stage:pl.stage,sessionNo:pl.sessionNo,title:pl.title,supplies:pl.supplies,createdAt:now()}
              await DB.saveContent(n); myC.push(n); cc++
            }
          }
        }
      }
      reload()
      if (!selSubject && sc > 0) setSelSubject(Object.keys(subjectMap)[0])
      success(`과목 ${sc}개, 교구 ${pc}개, 차시 ${cc}개 등록 완료!`)
    } catch(err) { toastError('파일 읽기 실패: ' + err.message) }
  }

  // ── 교구 모달
  const openProductModal = (subjectId, existing=null) => {
    if (existing) {
      const maxS=existing.maxStage||10; const perS=existing.sessionsPerStage||12
      const titles={}
      for (let s=1;s<=maxS;s++) {
        const plans=contents.filter(c=>c.productId===existing.id&&c.stage===s).sort((a,b)=>a.sessionNo-b.sessionNo)
        titles[s]=Array.from({length:perS},(_,i)=>({title:plans[i]?.title||'',memo:plans[i]?.supplies||''}))
      }
      setProductForm({id:existing.id,name:existing.name,subjectId:existing.subjectId,maxStage:maxS,sessionsPerStage:perS,alertSession:existing.alertSession||3})
      setStageSessionTitles(titles); setEditingProduct(existing)
    } else {
      const titles={}; for(let s=1;s<=10;s++) titles[s]=Array.from({length:12},()=>({title:'',memo:''}))
      setProductForm({id:null,name:'',subjectId,maxStage:10,sessionsPerStage:12,alertSession:3})
      setStageSessionTitles(titles); setEditingProduct(null)
    }
    setProductStageTab(1); setProductModal(true)
  }
  const saveProduct = async () => {
    if (!productForm.name.trim()) { toastError('교구명을 입력하세요'); return }
    const isEdit=!!productForm.id; const productId=isEdit?productForm.id:uid()
    await DB.saveProduct({id:productId,vendorId,subjectId:productForm.subjectId,name:productForm.name,maxStage:productForm.maxStage,sessionsPerStage:productForm.sessionsPerStage,alertSession:productForm.alertSession,createdAt:isEdit?(editingProduct?.createdAt||now()):now()})
    for (let stage=1;stage<=productForm.maxStage;stage++) {
      const items=stageSessionTitles[stage]||[]
      for (let idx=0;idx<items.length;idx++) {
        const t=items[idx]?.title||''; const m=items[idx]?.memo||''
        if (!t.trim()) continue
        const sessionNo=idx+1
        const ex=contents.find(c=>c.productId===productId&&c.stage===stage&&c.sessionNo===sessionNo)
        if (ex) await DB.saveContent({...ex,title:t,supplies:m})
        else await DB.saveContent({id:uid(),stageId:`${productId}_${stage}`,productId,stage,sessionNo,title:t,supplies:m,createdAt:now()})
      }
    }
    reload(); setProductModal(false); success(isEdit?'수정되었습니다.':'교구가 등록되었습니다.')
  }
  const deleteProduct = (p) => {
    setDeleteConfirm({ msg:`"${p.name}" 교구를 삭제하시겠습니까?`, onOk:async()=>{ await DB.delProduct(p.id); reload(); success('삭제가 완료되었습니다.') }})
  }

  // ── 차시 편집
  const openSessionPlan = (productId, stage) => {
    const list=contents.filter(c=>c.productId===productId&&c.stage===stage).sort((a,b)=>a.sessionNo-b.sessionNo)
    setSessionPlanTarget({productId,stage})
    setSessionPlanEdits(list.map(c=>({id:c.id,sessionNo:c.sessionNo,title:c.title||'',memo:c.supplies||'',_isNew:false})))
    setSessionPlanModal(true)
  }
  const saveSessionPlan = async () => {
    const {productId,stage}=sessionPlanTarget
    const originals=contents.filter(c=>c.productId===productId&&c.stage===stage)
    const editIds=sessionPlanEdits.filter(e=>!e._isNew).map(e=>e.id)
    for (const o of originals) if (!editIds.includes(o.id)) await DB.delContent(o.id)
    for (const e of sessionPlanEdits) {
      if (e._isNew) await DB.saveContent({id:e.id,stageId:`${productId}_${stage}`,productId,stage,sessionNo:e.sessionNo,title:e.title,supplies:e.memo,createdAt:now()})
      else { const orig=originals.find(o=>o.id===e.id); if(orig) await DB.saveContent({...orig,sessionNo:e.sessionNo,title:e.title,supplies:e.memo}) }
    }
    reload(); setSessionPlanModal(false); success('수정이 완료되었습니다.')
  }

  // ── 파일 모달
  const openFileModal = (mode, productId='', stage='', editItem=null) => {
    setFileMode(mode); setFileProductId(productId); setFileStage(stage); setFileEditItem(editItem); setModalFile(null); setFileModal(true)
  }
  const saveFileFn = async () => {
    if (!fileProductId) { toastError('교구를 선택하세요'); return }
    if (fileMode==='session' && !fileStage) { toastError('단계를 선택하세요'); return }
    const product=products.find(p=>p.id===fileProductId)
    const autoTitle=product?(fileMode==='promo'?`${product.name} 홍보물`:fileMode==='session'?`${product.name} ${fileStage}단계 차시별 지도안`:`${product.name} 연간지도안`):(fileMode==='promo'?'홍보물':fileMode==='session'?'차시별지도안':'연간지도안')
    setUploading(true)
    try {
      let fileUrl=null, fileName=null
      if (modalFile) { fileUrl=await uploadToStorage(vendorId,fileMode,modalFile); fileName=modalFile.name }
      if (fileEditItem) await DB.saveFile({...fileEditItem,fileType:fileMode,title:autoTitle,stage:fileStage||null,productId:fileProductId,fileUrl:fileUrl||fileEditItem.fileUrl,fileName:fileName||fileEditItem.fileName})
      else await DB.saveFile({id:uid(),vendorId,productId:fileProductId,fileType:fileMode,title:autoTitle,stage:fileStage||null,fileUrl,fileName,createdAt:now()})
      reload(); setFileModal(false); setModalFile(null); setFileEditItem(null); success(fileEditItem?'수정이 완료되었습니다.':'등록이 완료되었습니다.')
    } catch(e) { toastError('업로드 실패: '+e.message) }
    finally { setUploading(false) }
  }
  const deleteFile = (id) => {
    setDeleteConfirm({ msg:'이 파일을 삭제하시겠습니까?', onOk:async()=>{ await DB.delFile(id); reload(); success('삭제가 완료되었습니다.') }})
  }

  // 현재 선택된 과목의 교구 목록
  const selSubjectObj  = subjects.find(s=>s.name===selSubject)
  const selProducts    = selSubjectObj ? products.filter(p=>p.subjectId===selSubjectObj.id) : []

  const handleLogout = () => { localStorage.removeItem(LS_SESSION); onLogout() }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Noto Sans KR, sans-serif' }}>

      {/* 사이드바 */}
      <aside style={{ width:'210px', minWidth:'210px', background:C.sidebar, display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0 }}>
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
          <div style={{ fontSize:'13px', fontWeight:600, color:'#fff', marginBottom:'2px' }}>🏢 {vendor.name||'업체명'}</div>
          {vendor.managerName && <div style={{ fontSize:'11px', color:'#a1a1aa', marginTop:'2px' }}>👤 {vendor.managerName}</div>}
          {vendor.contact     && <div style={{ fontSize:'11px', color:'#a1a1aa', marginTop:'2px' }}>📞 {vendor.contact}</div>}
          {vendor.memo        && <div style={{ fontSize:'11px', color:'#a1a1aa', marginTop:'2px' }}>📌 {vendor.memo}</div>}
          <div style={{ marginTop:'8px', display:'flex', gap:'6px' }}>
            <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:C.primary, color:'#fff' }}>파트너</span>
            <button type="button" onClick={openVendorModal} style={{ fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:'#3f3f46', color:'#a1a1aa', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
          </div>
        </div>
        <nav style={{ flex:1, padding:'10px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px', background:'#f9731618', borderLeft:`3px solid ${C.primary}`, color:C.primary, fontSize:'14px', fontWeight:600 }}>
            <span>🎒</span> 교구 관리
          </div>
        </nav>
        <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
          <button type="button" onClick={handleLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px', fontFamily:'Noto Sans KR, sans-serif' }}>
            <span>🚪</span> 로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 */}
      <main style={{ flex:1, background:C.bg, overflowY:'auto' }}>
        <div style={{ padding:'24px', maxWidth:'1100px' }}>

          {/* 헤더 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🎒 교구 및 지도안 관리</h1>
              <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>과목별 교구 · 지도안 · 홍보물 관리</p>
            </div>
          </div>

          {/* 과목 탭 — Supplies.jsx 방식 그대로 */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
            {subjects.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center' }}>
                <button type="button" onClick={()=>{ setSelSubject(s.name); setInnerTab('supply') }}
                  style={{ padding:'8px 16px', borderRadius: selSubject===s.name ? '8px 0 0 8px' : '8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'14px', background: selSubject===s.name ? C.primary : '#f3f4f6', color: selSubject===s.name ? '#fff' : C.muted }}>
                  {s.name}
                </button>
                {selSubject===s.name && (
                  <button type="button" onClick={()=>deleteSubject(s)}
                    style={{ padding:'8px 7px', borderRadius:'0 8px 8px 0', border:'none', cursor:'pointer', background:'#dc262620', color:C.danger, fontSize:'13px', lineHeight:1 }}>✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={()=>{ setNewSubject(''); setSubjectModal(true) }}
              style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              + 과목 추가
            </button>
          </div>

          {/* 선택된 과목이 있을 때 */}
          {selSubject && (() => {
            const INNER_TABS = [
              { key:'supply', label:`🎒 교구(${selSubject||''})` },
              { key:'plan',   label:`📋 지도안(${selSubject||''})` },
              { key:'promo',  label:`🖼 홍보물(${selSubject||''})` },
            ]
            return (
              <>
                {/* 내부 탭 */}
                <div style={{ display:'flex', marginBottom:'20px', borderBottom:`1px solid ${C.border}`, overflowX:'auto' }}>
                  {INNER_TABS.map(t => (
                    <button key={t.key} type="button" onClick={() => setInnerTab(t.key)}
                      style={{ padding:'10px 18px', border:'none', cursor:'pointer', background:'none', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight: innerTab===t.key ? 700 : 400, color: innerTab===t.key ? C.primary : C.muted, borderBottom: innerTab===t.key ? `2px solid ${C.primary}` : '2px solid transparent', marginBottom:'-1px', whiteSpace:'nowrap' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ── 교구 탭 */}
                {innerTab === 'supply' && (
            <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>

              {/* 업체 헤더 */}
              <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', background: expandedVendor==='me' ? C.bg : C.card }}
                onClick={()=>setExpandedVendor(v=>v==='me'?null:'me')}>
                <span style={{ fontSize:'20px' }}>🏢</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{vendor.name}</div>
                  <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, marginTop:'2px', flexWrap:'wrap' }}>
                    {vendor.managerName && <span>👤 {vendor.managerName}</span>}
                    {vendor.contact     && <span>📞 {vendor.contact}</span>}
                    {vendor.memo        && <span>📌 {vendor.memo}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {selProducts.length>0 && <span style={{ fontSize:'12px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>교구 {selProducts.length}종</span>}
                  <span style={{ fontSize:'14px', color:C.muted }}>{expandedVendor==='me'?'▲':'▼'}</span>
                </div>
              </div>

              {/* 교구 목록 */}
              {expandedVendor==='me' && (
                <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                    <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>🤖 교구 목록</span>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {selProducts.length>0 && <button type="button" onClick={()=>downloadProductsExcel(vendor.name||'', selProducts, contents)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.success}`, background:'#f0fdf4', color:C.success, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>⬇ 다운로드</button>}
                      <button type="button" onClick={downloadSampleExcel} style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.blue}`, background:'#eff6ff', color:C.blue, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📋 샘플</button>
                      <label style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.purple}`, background:'#f5f3ff', color:C.purple, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        📤 일괄등록
                        <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleBulkUpload} />
                      </label>
                      <button type="button" onClick={()=>openProductModal(selSubjectObj?.id)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 교구 등록</button>
                    </div>
                  </div>

                  {selProducts.length===0
                    ? <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'20px 0' }}>등록된 교구가 없습니다</div>
                    : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                        {selProducts.map(p => {
                          const pContents   = contents.filter(c=>c.productId===p.id)
                          const stages      = [...new Set(pContents.map(c=>c.stage))].sort((a,b)=>a-b)
                          const pFiles      = files.filter(f=>f.productId===p.id)
                          const annualFiles  = pFiles.filter(f=>f.fileType==='annual')
                          const sessionFiles = pFiles.filter(f=>f.fileType==='session')
                          const promoFiles   = pFiles.filter(f=>f.fileType==='promo')
                          return (
                            <div key={p.id} style={{ background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                              {/* 교구 헤더 */}
                              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px' }}>
                                <span style={{ fontSize:'18px' }}>🤖</span>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name}</div>
                                  <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                    {stages.length===0 ? <span style={{ color:C.danger }}>차시 미등록</span>
                                      : stages.map(st=>{ const cnt=pContents.filter(c=>c.stage===st).length; return <span key={st} style={{ background:'#f5f3ff', color:'#7c3aed', borderRadius:'4px', padding:'1px 6px' }}>{st}단계({cnt}차시)</span> })}
                                    {annualFiles.length>0  && <span style={{ background:'#eff6ff', color:C.blue, borderRadius:'4px', padding:'1px 6px' }}>연간지도안 {annualFiles.length}개</span>}
                                    {promoFiles.length>0   && <span style={{ background:'#f0fdf4', color:C.success, borderRadius:'4px', padding:'1px 6px' }}>홍보물 {promoFiles.length}개</span>}
                                  </div>
                                </div>
                                <button type="button" onClick={()=>openProductModal(selSubjectObj?.id,p)} style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                                <button type="button" onClick={()=>deleteProduct(p)} style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                              </div>
                              {/* 단계별 진도체크 */}
                              <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📊 단계별 진도체크</span>
                                  {(()=>{ const next=stages.length>0?Math.max(...stages)+1:1; return next<=(p.maxStage||10)?(<button type="button" onClick={()=>openSessionPlan(p.id,next)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>):null })()}
                                </div>
                                {stages.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시가 없습니다</div> : (
                                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                    {stages.map(stage => {
                                      const plans=pContents.filter(c=>c.stage===stage).sort((a,b)=>a.sessionNo-b.sessionNo)
                                      const expandKey=`${p.id}_${stage}`; const isOpen=expandedStage===expandKey
                                      return (
                                        <div key={stage} style={{ background:C.card, borderRadius:'9px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                                          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', cursor:'pointer' }} onClick={()=>setExpandedStage(isOpen?null:expandKey)}>
                                            <span style={{ fontSize:'16px' }}>📝</span>
                                            <div style={{ flex:1 }}>
                                              <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name} {stage}단계 목차리스트</span>
                                              <span style={{ fontSize:'11px', color:C.success, marginLeft:'8px' }}>{plans.length}차시</span>
                                            </div>
                                            <button type="button" onClick={e=>{ e.stopPropagation(); openSessionPlan(p.id,stage) }} style={{ padding:'3px 10px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                                            <button type="button" onClick={e=>{ e.stopPropagation(); setDeleteConfirm({ msg:`${stage}단계 차시를 삭제하시겠습니까?`, onOk:async()=>{ for(const c of plans) await DB.delContent(c.id); reload(); success('삭제가 완료되었습니다.') }}) }} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
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
                                )}
                              </div>
                              {/* 연간지도안 */}
                              <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📅 연간지도안</span>
                                  <button type="button" onClick={()=>openFileModal('annual',p.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
                                </div>
                                {annualFiles.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 연간지도안이 없습니다</div>
                                  : <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{annualFiles.map(f=><FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('annual',item.productId,'',item)} />)}</div>}
                              </div>
                              {/* 차시별지도안 */}
                              <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📝 차시별지도안 파일</span>
                                  <button type="button" onClick={()=>openFileModal('session',p.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
                                </div>
                                {sessionFiles.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시별지도안 파일이 없습니다</div>
                                  : <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{sessionFiles.sort((a,b)=>Number(a.stage||0)-Number(b.stage||0)).map(f=><FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('session',item.productId,item.stage||'',item)} />)}</div>}
                              </div>
                              {/* 홍보물 */}
                              <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>🖼 홍보물</span>
                                  <button type="button" onClick={()=>openFileModal('promo',p.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
                                </div>
                                {promoFiles.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 홍보물이 없습니다</div>
                                  : <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{promoFiles.map(f=><FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('promo',item.productId,'',item)} />)}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                </div>
              )}
            </div>
                )} {/* end innerTab === 'supply' */}

                {/* ── 지도안 탭 */}
                {innerTab === 'plan' && (
                  <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px 18px' }}>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'16px' }}>교구별 연간/차시별 지도안 파일을 관리합니다.</div>
                    {selProducts.length===0 ? (
                      <div style={{ textAlign:'center', padding:'40px', color:C.muted }}><div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div><div>교구를 먼저 등록해주세요</div></div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                        {selProducts.map(p => {
                          const pFiles = files.filter(f=>f.productId===p.id)
                          const annualFiles  = pFiles.filter(f=>f.fileType==='annual')
                          const sessionFiles = pFiles.filter(f=>f.fileType==='session')
                          return (
                            <div key={p.id} style={{ background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                              <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px', borderBottom:`1px solid ${C.border}` }}>
                                <span style={{ fontSize:'16px' }}>🤖</span>
                                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{p.name}</span>
                              </div>
                              <div style={{ padding:'8px 14px 10px', borderBottom:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📅 연간지도안</span>
                                  <button type="button" onClick={()=>openFileModal('annual',p.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
                                </div>
                                {annualFiles.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 연간지도안이 없습니다</div>
                                  : <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{annualFiles.map(f=><FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('annual',item.productId,'',item)} />)}</div>}
                              </div>
                              <div style={{ padding:'8px 14px 10px' }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                                  <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📝 차시별지도안 파일</span>
                                  <button type="button" onClick={()=>openFileModal('session',p.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
                                </div>
                                {sessionFiles.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시별지도안 파일이 없습니다</div>
                                  : <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{sessionFiles.sort((a,b)=>Number(a.stage||0)-Number(b.stage||0)).map(f=><FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('session',item.productId,item.stage||'',item)} />)}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 홍보물 탭 */}
                {innerTab === 'promo' && (
                  <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px 18px' }}>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'16px' }}>교구별 홍보물 파일을 관리합니다.</div>
                    {selProducts.length===0 ? (
                      <div style={{ textAlign:'center', padding:'40px', color:C.muted }}><div style={{ fontSize:'32px', marginBottom:'8px' }}>🖼</div><div>교구를 먼저 등록해주세요</div></div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                        {selProducts.map(p => {
                          const promoFiles = files.filter(f=>f.productId===p.id&&f.fileType==='promo')
                          return (
                            <div key={p.id} style={{ background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                              <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px', borderBottom:`1px solid ${C.border}` }}>
                                <span style={{ fontSize:'16px' }}>🤖</span>
                                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{p.name}</span>
                                <div style={{ flex:1 }} />
                                <button type="button" onClick={()=>openFileModal('promo',p.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
                              </div>
                              <div style={{ padding:'8px 14px 10px' }}>
                                {promoFiles.length===0 ? <div style={{ fontSize:'12px', color:C.muted }}>등록된 홍보물이 없습니다</div>
                                  : <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{promoFiles.map(f=><FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('promo',item.productId,'',item)} />)}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

              </>
            )
          })()}
        </div>
      </main>

      {/* ── 과목 추가 모달 */}
      {subjectModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'380px', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'16px' }}>📚 과목 추가</div>
            <input style={{ ...iSt, marginBottom:'16px' }} placeholder="예: 로봇, 드론, 보드게임"
              value={newSubject} onChange={e=>setNewSubject(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSubject()} autoFocus />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button type="button" onClick={()=>setSubjectModal(false)} style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              <button type="button" onClick={addSubject} style={{ padding:'8px 20px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 업체 정보 수정 모달 */}
      {vendorModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e=>{ if(e.target===e.currentTarget) setVendorModal(false) }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'460px', maxWidth:'95vw', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'20px' }}>🏢 업체 정보 수정</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'업체명 *',      key:'name',         placeholder:'예: (주)집현전에듀' },
                { label:'담당자 이름',   key:'managerName',  placeholder:'예: 홍길동' },
                { label:'담당자 연락처', key:'contact',      placeholder:'예: 010-1234-5678' },
                { label:'전화번호',      key:'phone',        placeholder:'예: 02-1234-5678' },
                { label:'이메일',        key:'email',        placeholder:'예: admin@example.com' },
                { label:'카카오 채널',   key:'kakaoChannel', placeholder:'예: @업체채널명' },
                { label:'메모',          key:'memo',         placeholder:'비고' },
              ].map(f=>(
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input value={vendorForm[f.key]} onChange={e=>setVendorForm(v=>({...v,[f.key]:e.target.value}))} placeholder={f.placeholder} style={iSt} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'20px' }}>
              <button type="button" onClick={saveVendor} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정 완료</button>
              <button type="button" onClick={()=>setVendorModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
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
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={productForm.name} onChange={e=>setProductForm(v=>({...v,name:e.target.value}))} placeholder="예: 큐보 1단계" style={iSt} autoFocus />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                {[{key:'maxStage',label:'최대 단계',min:1,max:20},{key:'sessionsPerStage',label:'단계당 차시 수',min:1,max:50},{key:'alertSession',label:'준비 알림 (차시 전)',min:1,max:50}].map(({key,label,min,max})=>(
                  <div key={key}>
                    <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{label}</label>
                    <input type="number" min={min} max={max} value={productForm[key]} onChange={e=>{ const val=Number(e.target.value); setProductForm(v=>({...v,[key]:val})); if(key==='maxStage'){ setStageSessionTitles(prev=>{ const n={...prev}; for(let s=1;s<=val;s++) if(!n[s]) n[s]=Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})); return n }); if(productStageTab>val) setProductStageTab(val) } if(key==='sessionsPerStage'){ setStageSessionTitles(prev=>{ const n={}; for(let s=1;s<=productForm.maxStage;s++){ const c=prev[s]||[]; n[s]=Array.from({length:val},(_,i)=>c[i]||{title:'',memo:''}) } return n }) } }} style={{ ...iSt, textAlign:'center' }} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계 선택</label>
                <select value={productStageTab} onChange={e=>{ const st=Number(e.target.value); setProductStageTab(st); setStageSessionTitles(prev=>({...prev,[st]:prev[st]||Array.from({length:productForm.sessionsPerStage},()=>({title:'',memo:''})) })) }} style={{ ...iSt, background:'#fff' }}>
                  {Array.from({length:productForm.maxStage},(_,i)=>i+1).map(s=>{ const filled=(stageSessionTitles[s]||[]).filter(t=>(t?.title||'').trim()).length; return <option key={s} value={s}>{s}단계{filled>0?` (${filled}개 입력됨)`:''}</option> })}
                </select>
              </div>
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
                  <button type="button" onClick={()=>setStageSessionTitles(prev=>{ const c=[...(prev[productStageTab]||[])]; c.push({title:'',memo:''}); return {...prev,[productStageTab]:c} })} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>+ 차시 추가</button>
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
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>📝 {sessionPlanTarget.stage}단계 목차리스트</div>
              <button type="button" onClick={()=>setSessionPlanModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
            </div>
            <div style={{ padding:'20px', overflowY:'auto', flex:1 }}>
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  {['차시','제목','준비물',''].map((h,i)=><span key={i} style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>{h}</span>)}
                </div>
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'300px', overflowY:'auto' }}>
                  {sessionPlanEdits.length===0 && <div style={{ textAlign:'center', padding:'20px', fontSize:'13px', color:C.muted }}>아래 버튼으로 차시를 추가하세요</div>}
                  {sessionPlanEdits.map((item,idx)=>(
                    <div key={item.id} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{item.sessionNo}차시</span>
                      <input value={item.title} onChange={e=>setSessionPlanEdits(p=>p.map((x,i)=>i===idx?{...x,title:e.target.value}:x))} placeholder="제목 (선택)" style={{ ...iSt, padding:'5px 8px', fontSize:'12px' }} />
                      <input value={item.memo} onChange={e=>setSessionPlanEdits(p=>p.map((x,i)=>i===idx?{...x,memo:e.target.value}:x))} placeholder="준비물 (선택)" style={{ ...iSt, padding:'5px 8px', fontSize:'12px' }} />
                      <button type="button" onClick={()=>setSessionPlanEdits(p=>p.filter((_,i)=>i!==idx))} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                    </div>
                  ))}
                </div>
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button type="button" onClick={()=>setSessionPlanEdits(p=>[...p,{id:uid(),sessionNo:p.length+1,title:'',memo:'',_isNew:true}])} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>+ 차시 추가</button>
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button type="button" onClick={saveSessionPlan} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
              <button type="button" onClick={()=>setSessionPlanModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 파일 등록 모달 */}
      {fileModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e=>{ if(e.target===e.currentTarget){ setFileModal(false); setModalFile(null) } }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'500px', maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{fileMode==='annual'?'📅 연간지도안':fileMode==='session'?'📝 차시별지도안':'🖼 홍보물'} {fileEditItem?'수정':'등록'}</div>
              <button type="button" onClick={()=>{ setFileModal(false); setModalFile(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
            </div>
            <div style={{ padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>교구 선택 *</label>
                <select value={fileProductId} onChange={e=>setFileProductId(e.target.value)} style={{ ...iSt, background:'#fff' }}>
                  <option value=''>-- 교구를 선택하세요 --</option>
                  {selProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {fileMode==='session' && (
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>단계 선택 *</label>
                  <select value={fileStage} onChange={e=>setFileStage(e.target.value)} style={{ ...iSt, background:'#fff' }}>
                    <option value=''>-- 단계를 선택하세요 --</option>
                    {Array.from({length:(selProducts.find(p=>p.id===fileProductId)?.maxStage||10)},(_,i)=>i+1).map(s=><option key={s} value={s}>{s}단계</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>파일 첨부</label>
                {modalFile
                  ? <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #86efac' }}>
                      <span style={{ fontSize:'20px' }}>📄</span>
                      <span style={{ fontSize:'13px', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{modalFile.name}</span>
                      <button type="button" onClick={()=>setModalFile(null)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'18px' }}>×</button>
                    </div>
                  : <button type="button" onClick={()=>fileRef.current?.click()} style={{ width:'100%', padding:'20px', borderRadius:'9px', border:`2px dashed ${C.border}`, background:C.bg, cursor:'pointer', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                      <div style={{ fontSize:'24px', marginBottom:'4px' }}>📎</div>
                      <div style={{ fontSize:'13px' }}>클릭하여 파일 선택</div>
                      <div style={{ fontSize:'11px', marginTop:'2px' }}>.hwp · .hwpx · .pdf · .xlsx · .jpg · .png</div>
                    </button>
                }
                <input ref={fileRef} type="file" accept=".hwp,.hwpx,.pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={e=>e.target.files[0]&&setModalFile(e.target.files[0])} />
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button type="button" onClick={saveFileFn} disabled={uploading} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:uploading?'#e5e7eb':C.primary, color:uploading?C.muted:'#fff', fontSize:'14px', fontWeight:700, cursor:uploading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>{uploading?'업로드 중...':'저장'}</button>
              <button type="button" onClick={()=>{ setFileModal(false); setModalFile(null) }} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'320px', width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontSize:'14px', fontWeight:600, color:C.text, marginBottom:'20px', whiteSpace:'pre-line' }}>{deleteConfirm.msg}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button type="button" onClick={()=>setDeleteConfirm(null)} style={{ padding:'9px 20px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              <button type="button" onClick={()=>{ deleteConfirm.onOk(); setDeleteConfirm(null) }} style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:C.danger, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}
    </div>
  )
}
