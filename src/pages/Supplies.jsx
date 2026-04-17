import React, { useState, useEffect, useRef, useMemo } from 'react'
import { uid, now, sortClasses } from '../lib/utils.js'
import {
  Classes, Students,
  SupplySubjects, SupplyVendors, SupplyItems, SupplyPlans,
  SupplyProducts, SupplyProductPlans, SupplyStudentProgress, SupplySessionChecks,
} from '../lib/db.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  blue: '#3b82f6', purple: '#8b5cf6', warning: '#f59e0b',
}

const DEFAULT_SUBJECTS = ['일반', '로봇', '항공', '보드게임']
const STAGES = Array.from({ length: 10 }, (_, i) => i + 1)

async function uploadToStorage(userId, folder, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const filePath = `supplies/${userId}/${folder}/${Date.now()}_${file.name}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/teacher-files/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.message || res.statusText) }
  return `${SUPABASE_URL}/storage/v1/object/public/teacher-files/${filePath}`
}

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }


// ── 파일 행
function FileRow({ item, onDelete, onEdit }) {
  const icon = item.fileType === 'promo' ? '🖼' : '📄'
  const typeLabel = { annual:'연간지도안', session:'차시별지도안', promo:'홍보물' }[item.fileType] || ''
  const noFile = !item.fileUrl
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:C.card, borderRadius:'9px', border:`1.5px solid ${noFile ? '#fca5a5' : C.border}` }}>
      <span style={{ fontSize:'20px', flexShrink:0 }}>{noFile ? '⚠️' : icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
        <div style={{ fontSize:'11px', marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ background:'#f3f4f6', borderRadius:'4px', padding:'0 5px', color:C.muted }}>{typeLabel}</span>
          {item.stage && <span style={{ background:'#eff6ff', color:'#3b82f6', borderRadius:'4px', padding:'0 5px' }}>{item.stage}단계</span>}
          {item.school && <span style={{ color:C.muted }}>🏫 {item.school}</span>}
          {noFile
            ? <span style={{ color:'#ef4444', fontWeight:600 }}>파일 업로드가 필요합니다</span>
            : <span style={{ color:C.muted }}>{item.fileName}</span>
          }
        </div>
      </div>
      <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
        {item.fileUrl && (
          <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer"
            style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'11px', fontWeight:600, textDecoration:'none' }}>
            ⬇ 다운
          </a>
        )}
        {onEdit && (
          <button onClick={() => onEdit(item)}
            style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${'#f97316'}`, background:'#fff7ed', color:'#f97316', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            수정
          </button>
        )}
        <button onClick={() => onDelete(item.id)}
          style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
      </div>
    </div>
  )
}

// ── 진도 뱃지
function ProgressBadge({ checkedCount, totalCount, alertSession, sessionsPerStage }) {
  if (!totalCount) return null
  const rate = Math.round(checkedCount / totalCount * 100)
  const isAlert = checkedCount >= alertSession
  const isDone  = checkedCount >= sessionsPerStage
  const color   = isDone ? C.success : isAlert ? C.warning : C.blue
  const bg      = isDone ? '#f0fdf4' : isAlert ? '#fffbeb' : '#eff6ff'
  const border  = isDone ? '#86efac' : isAlert ? '#fde68a' : '#bfdbfe'
  const label   = isDone ? '단계완료' : isAlert ? '준비필요' : `${checkedCount}/${totalCount}`
  return (
    <span style={{ fontSize:'11px', fontWeight:700, color, background:bg, border:`1px solid ${border}`, borderRadius:'5px', padding:'1px 7px', flexShrink:0 }}>
      {isDone ? '✅' : isAlert ? '⚠️' : '📖'} {label}
    </span>
  )
}

export function Supplies({ user }) {
  // ── 기본 상태
  const [subjects, setSubjects]       = useState([])
  const [selSubject, setSelSubject]   = useState(null)
  const [vendorList, setVendorList]   = useState([])
  const [productList, setProductList] = useState([])
  const [productPlanList, setProductPlanList] = useState([])
  const [itemList, setItemList]       = useState([])
  const [planList, setPlanList]       = useState([])
  const [progressList, setProgressList] = useState([])
  const [checkList, setCheckList]     = useState([])
  const [classes, setClasses]         = useState([])
  const [students, setStudents]       = useState([])

  // 탭
  const [innerTab, setInnerTab]       = useState('supply')
  // 교구(로봇) 탭 내부 뷰: 'assign'=교구배정, 'progress'=진도체크
  const [robotView, setRobotView]     = useState('assign')
  const [selClassId, setSelClassId]   = useState('')
  const [checkedStudents, setCheckedStudents] = useState([])

  // 교구 설정 모달
  const [supplyModal, setSupplyModal] = useState(false)
  const [supplyForm, setSupplyForm]   = useState({ name:'', productId:'', stage:1 })

  // 진도 체크 모달 (학생별)
  const [progressModal, setProgressModal] = useState(false)
  const [progressStudent, setProgressStudent] = useState(null)
  const [progressProductId, setProgressProductId] = useState('')

  // 파일 모달
  const [fileModal, setFileModal]     = useState(false)
  const [fileModalMode, setFileModalMode] = useState('plan')
  const [fileForm, setFileForm]       = useState({ fileType:'annual', schools:[], vendorId:'', productId:'', stage:'' })
  const [fileTarget, setFileTarget]   = useState(null)   // vendorId
  const [fileProductTarget, setFileProductTarget] = useState(null) // productId
  const [modalFile, setModalFile]     = useState(null)
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef()

  // 교구업체 모달
  const [vendorModal, setVendorModal] = useState(false)
  const [vendorForm, setVendorForm]   = useState({ name:'', managerName:'', contact:'', memo:'' })
  const [expandedVendor, setExpandedVendor] = useState(null)
  const [expandedStage, setExpandedStage]   = useState(null)  // 진도체크 단계 펼침

  // 교구 등록/수정 모달
  const [productModal, setProductModal] = useState(false)
  const [productVendorId, setProductVendorId] = useState(null)
  const [productForm, setProductForm] = useState({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:10 })
  const [productStageTab, setProductStageTab] = useState(1)
  const [stageSessionTitles, setStageSessionTitles] = useState({})

  // 차시 지도안 모달 (교구+단계별)
  const [sessionPlanModal, setSessionPlanModal] = useState(false)
  const [sessionPlanTarget, setSessionPlanTarget] = useState({ productId:'', stage:1 })
  const [sessionPlanList, setSessionPlanList]   = useState([]) // 해당 단계 차시 목록
  const [sessionPlanEdits, setSessionPlanEdits] = useState([]) // 로컬 편집 상태

  // 과목 추가
  const [subjectModal, setSubjectModal] = useState(false)
  const [newSubject, setNewSubject]     = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const { error: toastError, success } = useToast()

  const schoolList = [...new Set(classes.map(c => c.organization).filter(Boolean))]

  const reload = () => {
    const dbSubjects = SupplySubjects.byTeacher(user.id)
    if (dbSubjects.length === 0) {
      DEFAULT_SUBJECTS.forEach((name, i) => {
        const already = SupplySubjects.byTeacher(user.id).find(s => s.name === name)
        if (!already) SupplySubjects.insert({ id: uid(), teacherId: user.id, name, sortOrder: i, createdAt: now() })
      })
      setSubjects(DEFAULT_SUBJECTS)
    } else {
      const unique = dbSubjects
        .sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0))
        .filter((s, idx, arr) => arr.findIndex(x => x.name === s.name) === idx)
      setSubjects(unique.map(s => s.name))
    }
    const vendors = SupplyVendors.byTeacher(user.id)
    setVendorList(vendors)
    // 첫 업체 자동 펼침 (아직 펼쳐진 것 없을 때만)
    setExpandedVendor(prev => prev || (vendors.length > 0 ? vendors[0].id : null))
    setProductList(SupplyProducts.byTeacher(user.id))
    setProductPlanList(SupplyProductPlans.byTeacher(user.id))
    setItemList(SupplyItems.byTeacher(user.id))
    setPlanList(SupplyPlans.byTeacher(user.id))
    setProgressList(SupplyStudentProgress.byTeacher(user.id))
    setCheckList(SupplySessionChecks.byTeacher(user.id))
    setClasses(sortClasses(Classes.byTeacher(user.id)))
    setStudents(Students.byTeacher(user.id))
  }

  useEffect(() => { reload() }, [])
  useEffect(() => { if (subjects.length > 0 && !selSubject) setSelSubject(subjects[0]) }, [subjects])
  useEffect(() => { setCheckedStudents([]) }, [selClassId, selSubject])

  const isRobot = selSubject === '로봇'

  // ── 교구 배정
  const confirmedStudents = students
    .filter(s => s.classIds?.includes(selClassId) && s.status === 'confirmed')
    .sort((a, b) => {
      const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
      if (gradeCmp !== 0) return gradeCmp
      const classCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
      if (classCmp !== 0) return classCmp
      const numCmp = parseInt(a.number||'0') - parseInt(b.number||'0')
      if (numCmp !== 0) return numCmp
      return (a.name||'').localeCompare(b.name||'', 'ko')
    })
  const allChecked = confirmedStudents.length > 0 && checkedStudents.length === confirmedStudents.length
  const toggleAll  = () => setCheckedStudents(allChecked ? [] : confirmedStudents.map(s=>s.id))
  const toggleOne  = (id) => setCheckedStudents(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])
  const getStudentSupply = (sid) => itemList.find(i => i.classId===selClassId && i.studentId===sid) || { name:'', stage:'' }

  // 로봇 교구 목록 (과목 필터)
  const robotProducts = productList.filter(p => {
    const vendor = vendorList.find(v => v.id === p.vendorId)
    return vendor?.subject === '로봇'
  })

  // 파일 등록 모달 — 현재 과목 교구 목록 (IIFE 제거로 상단 이동)
  const modalProducts = productList.filter(p => {
    const vendor = vendorList.find(v => v.id === p.vendorId)
    return vendor?.subject === selSubject
  })
  const selectedProduct = modalProducts.find(p => p.id === fileForm.productId)
  const toggleSchool = (s) => setFileForm(f => ({
    ...f,
    schools: f.schools.includes(s) ? f.schools.filter(x => x !== s) : [...f.schools, s]
  }))

  const saveSupply = () => {
    if (!supplyForm.name && !supplyForm.productId) { toastError('교구명을 입력하거나 교구를 선택하세요'); return }
    const product = productList.find(p => p.id === supplyForm.productId)
    const finalName = supplyForm.productId ? (product?.name || supplyForm.name) : supplyForm.name
    checkedStudents.forEach(sid => {
      SupplyItems.upsert({
        id: uid(), teacherId: user.id, classId: selClassId, studentId: sid,
        subject: selSubject,
        name: finalName,
        productId: supplyForm.productId || null,
        stage: supplyForm.stage || '',
        createdAt: now(),
      })
      // productId 있으면 진도도 초기화
      if (supplyForm.productId) {
        SupplyStudentProgress.upsert({
          id: uid(), teacherId: user.id, studentId: sid, classId: selClassId,
          productId: supplyForm.productId, curStage: supplyForm.stage || 1, curSession: 1,
          updatedAt: now(), createdAt: now(),
        })
      }
    })
    reload(); setSupplyModal(false); setSupplyForm({ name:'', productId:'', stage:1 }); success('수정이 완료되었습니다.')
  }

  // ── 진도 체크 헬퍼
  const getStudentChecks = (studentId, productId) =>
    checkList.filter(c => c.studentId===studentId && c.classId===selClassId && c.productId===productId)

  const getProgress = (studentId, productId) =>
    progressList.find(p => p.studentId===studentId && p.classId===selClassId && p.productId===productId)

  // 평균 진도 계산
  const avgProgress = useMemo(() => {
    if (!selClassId) return {}
    const result = {}
    robotProducts.forEach(product => {
      const progresses = confirmedStudents.map(s => {
        const checks = checkList.filter(c => c.studentId===s.id && c.classId===selClassId && c.productId===product.id)
        const prog = progressList.find(p => p.studentId===s.id && p.classId===selClassId && p.productId===product.id)
        if (!prog) return 0
        const stageChecks = checks.filter(c => c.stage === prog.curStage).length
        return (prog.curStage - 1) * (product.sessionsPerStage || 12) + stageChecks
      })
      const total = progresses.reduce((a,b)=>a+b, 0)
      result[product.id] = progresses.length > 0 ? total / progresses.length : 0
    })
    return result
  }, [checkList, progressList, confirmedStudents, selClassId, robotProducts])

  // 진도 체크 토글
  const toggleCheck = (studentId, productId, stage, sessionNo) => {
    const existing = checkList.find(c =>
      c.studentId===studentId && c.classId===selClassId && c.productId===productId &&
      c.stage===stage && c.sessionNo===sessionNo
    )
    if (existing) {
      SupplySessionChecks.delete(existing.id)
    } else {
      SupplySessionChecks.upsert({
        id: uid(), teacherId: user.id, studentId, classId: selClassId,
        productId, stage, sessionNo, checkedAt: now(), createdAt: now(),
      })
    }
    // 진도 업데이트: 현재 단계에서 체크된 최대 차시 기준
    const allChecks = SupplySessionChecks.byProductStudent(productId, studentId, selClassId)
    const stageChecks = allChecks.filter(c => c.stage === stage)
    const maxSession = stageChecks.length > 0 ? Math.max(...stageChecks.map(c=>c.sessionNo)) : 1
    SupplyStudentProgress.upsert({
      id: uid(), teacherId: user.id, studentId, classId: selClassId,
      productId, curStage: stage, curSession: maxSession, updatedAt: now(), createdAt: now(),
    })
    reload()
  }

  // ── 업체/교구 관련
  const subjectVendors = vendorList.filter(v => v.subject === selSubject)
  const subjectPlans   = planList.filter(p => p.subject === selSubject && !p.vendorId)
  const vendorFiles    = (vendorId) => planList.filter(p => p.vendorId === vendorId)

  const saveVendor = () => {
    if (!vendorForm.name) { toastError('업체명을 입력하세요'); return }
    SupplyVendors.insert({ id: uid(), teacherId: user.id, subject: selSubject, ...vendorForm, createdAt: now() })
    reload(); setVendorModal(false); setVendorForm({ name:'', managerName:'', contact:'', memo:'' }); success('등록이 완료되었습니다.')
  }
  const deleteVendor = (id) => {
    setDeleteConfirm({ msg:'이 업체를 삭제하시겠습니까?\n업체 파일도 함께 삭제됩니다.', onOk: () => {
      SupplyVendors.delete(id)
      planList.filter(p=>p.vendorId===id).forEach(p=>SupplyPlans.delete(p.id))
      productList.filter(p=>p.vendorId===id).forEach(p=>SupplyProducts.delete(p.id))
      reload(); success('삭제가 완료되었습니다.')
    }})
  }

  // 교구 등록
  const openProductModal = (vendorId, existingProduct=null) => {
    try {
      setProductVendorId(vendorId || null)
      if (existingProduct) {
        const maxS = existingProduct.maxStage || 10
        const perS = existingProduct.sessionsPerStage || 12
        const titles = {}
        for (let s = 1; s <= maxS; s++) {
          const plans = (productPlanList || [])
            .filter(p => p.productId === existingProduct.id && p.stage === s)
            .sort((a,b) => a.sessionNo - b.sessionNo)
          titles[s] = Array.from({ length: perS }, (_, i) => ({
            title: plans[i]?.title || '',
            memo:  plans[i]?.memo  || '',
          }))
        }
        setProductForm({ id: existingProduct.id, name: existingProduct.name, maxStage: maxS, sessionsPerStage: perS, alertSession: existingProduct.alertSession||10 })
        setStageSessionTitles(titles)
      } else {
        const cnt = 12
        const titles = {}
        for (let s = 1; s <= 10; s++) {
          titles[s] = Array.from({length: cnt}, () => ({ title:'', memo:'' }))
        }
        setProductForm({ id:null, name:'', maxStage:10, sessionsPerStage:cnt, alertSession:10 })
        setStageSessionTitles(titles)
      }
      setProductStageTab(1)
      setProductModal(true)
    } catch(e) {
      console.error('openProductModal error:', e)
      toastError('오류가 발생했습니다: ' + e.message)
    }
  }

  const saveProduct = () => {
    if (!productForm.name) { toastError('교구명을 입력하세요'); return }
    const isEdit = !!productForm.id
    const productId = isEdit ? productForm.id : uid()
    if (isEdit) {
      SupplyProducts.update(productId, {
        name: productForm.name, maxStage: productForm.maxStage,
        sessionsPerStage: productForm.sessionsPerStage, alertSession: productForm.alertSession,
      })
    } else {
      SupplyProducts.insert({
        id: productId, teacherId: user.id, vendorId: productVendorId, subject: selSubject,
        name: productForm.name, maxStage: productForm.maxStage,
        sessionsPerStage: productForm.sessionsPerStage, alertSession: productForm.alertSession,
        createdAt: now(),
      })
    }
    // 단계별 차시 제목+준비물 저장/수정
    for (let stage = 1; stage <= productForm.maxStage; stage++) {
      const items = stageSessionTitles[stage] || []
      let savedAny = false
      items.forEach((item, idx) => {
        const t = typeof item === 'string' ? item : (item?.title || '')
        const m = typeof item === 'string' ? '' : (item?.memo || '')
        if (!t.trim()) return
        savedAny = true
        const sessionNo = idx + 1
        const existing = productPlanList.find(p =>
          p.productId === productId && p.stage === stage && p.sessionNo === sessionNo
        )
        if (existing) {
          SupplyProductPlans.update(existing.id, { title: t.trim(), memo: m.trim() })
        } else {
          SupplyProductPlans.insert({
            id: uid(), teacherId: user.id, productId,
            stage, sessionNo, title: t.trim(),
            memo: m.trim(), fileUrl: null, fileName: null, createdAt: now(),
          })
        }
      })
      // 차시 제목이 하나도 없어도 단계 자체는 등록되도록 플레이스홀더 1건 저장
      if (!savedAny) {
        const existing = productPlanList.find(p =>
          p.productId === productId && p.stage === stage && p.sessionNo === 1
        )
        if (!existing) {
          SupplyProductPlans.insert({
            id: uid(), teacherId: user.id, productId,
            stage, sessionNo: 1, title: `${stage}단계 1차시`,
            memo: '', fileUrl: null, fileName: null, createdAt: now(),
          })
        }
      }
    }
    reload()
    setProductModal(false)
    setStageSessionTitles({})
    success(isEdit ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
  }
  const deleteProduct = (id) => {
    setDeleteConfirm({ msg:'이 교구를 삭제하시겠습니까?', onOk: () => { SupplyProducts.delete(id); reload(); success('삭제가 완료되었습니다.') } })
  }

  // 차시 지도안 열기
  const openSessionPlan = (productId, stage) => {
    const list = productPlanList.filter(p=>p.productId===productId && p.stage===stage).sort((a,b)=>a.sessionNo-b.sessionNo)
    setSessionPlanTarget({ productId, stage })
    setSessionPlanList(list)
    setSessionPlanEdits(list.map(p => ({ id:p.id, sessionNo:p.sessionNo, title:p.title||'', memo:p.memo||'', _isNew:false })))
    setSessionPlanModal(true)
  }
  const saveSessionPlan = async () => {
    setUploading(true)
    try {
      // 삭제: 원본에 있었는데 edits에 없는 것
      const editIds = sessionPlanEdits.filter(e=>!e._isNew).map(e=>e.id)
      sessionPlanList.forEach(o => { if (!editIds.includes(o.id)) SupplyProductPlans.delete(o.id) })
      // 추가/수정
      sessionPlanEdits.forEach(e => {
        if (e._isNew) {
          SupplyProductPlans.insert({
            id: e.id, teacherId: user.id,
            productId: sessionPlanTarget.productId,
            stage: sessionPlanTarget.stage,
            sessionNo: e.sessionNo, title: e.title, memo: e.memo||'', createdAt: now(),
          })
        } else {
          SupplyProductPlans.update(e.id, { sessionNo:e.sessionNo, title:e.title, memo:e.memo||'' })
        }
      })
      // 저장 후에도 해당 단계 레코드가 없으면 플레이스홀더 1건 삽입 (단계가 목록에 표시되도록)
      if (sessionPlanEdits.length === 0) {
        const alreadyExists = sessionPlanList.length > 0
        if (!alreadyExists) {
          SupplyProductPlans.insert({
            id: uid(), teacherId: user.id,
            productId: sessionPlanTarget.productId,
            stage: sessionPlanTarget.stage,
            sessionNo: 1, title: `${sessionPlanTarget.stage}단계 1차시`,
            memo: '', fileUrl: null, fileName: null, createdAt: now(),
          })
        }
      }
      reload()
      success('수정이 완료되었습니다.')
      setSessionPlanModal(false)
    } catch(e) { toastError('저장 실패: '+e.message) }
    finally { setUploading(false) }
  }

  // 파일 등록
  const [fileEditId, setFileEditId] = useState(null)  // 수정 중인 파일 id

  const openFileModal = (mode, vendorId=null, productId=null, editItem=null) => {
    try {
      setFileModalMode(mode)
      setFileTarget(vendorId || null)
      setFileProductTarget(productId || null)
      setFileEditId(editItem?.id || null)
      if (editItem) {
        // 수정 모드 — 기존 값 로드
        setFileForm({
          fileType: editItem.fileType || editItem.type || 'annual',
          schools: editItem.school ? [editItem.school] : [],
          stage: editItem.stage || '',
          vendorId: editItem.vendorId || '',
          productId: editItem.productId || '',
        })
      } else {
        const fileType = (mode==='promo' || mode==='product_promo') ? 'promo'
          : mode==='product_annual' ? 'annual'
          : mode==='product_session' ? 'session'
          : 'annual'
        setFileForm({
          fileType,
          schools:[], stage:'',
          vendorId: vendorId||'',
          productId: productId||'',
        })
      }
      setModalFile(null); setFileModal(true)
    } catch(e) {
      console.error('openFileModal error:', e)
    }
  }
  const saveFile = async () => {
    // 교구 선택 필수 (plan/session 모드)
    const needsProduct = ['plan','session','promo'].includes(fileModalMode)
    if (needsProduct && !fileForm.productId) { toastError('교구를 선택하세요'); return }
    // 차시별 지도안이면 단계도 필수
    const isSession = fileModalMode === 'session' || (fileModalMode === 'plan' && fileForm.fileType === 'session')
    if (isSession && !fileForm.stage) { toastError('단계를 선택하세요'); return }
    // 제목 자동 생성
    const autoProduct = productList.find(p => p.id === (fileProductTarget || fileForm.productId))
    const autoTitle = autoProduct
      ? (fileModalMode === 'promo' || fileForm.fileType === 'promo'
          ? `${autoProduct.name} 홍보물`
          : (isSession || fileModalMode === 'product_session')
            ? `${autoProduct.name} ${fileForm.stage}단계 차시별 지도안`
            : `${autoProduct.name} 연간지도안`)
      : (fileForm.fileType === 'promo' ? '홍보물' : fileForm.fileType === 'session' ? '차시별지도안' : '지도안')
    setUploading(true)
    try {
      let fileUrl=null, fileName=null
      if (modalFile) {
        fileUrl = await uploadToStorage(user.id, `${selSubject}/${fileForm.fileType}`, modalFile)
        fileName = modalFile.name
      }
      if (fileEditId) {
        // 수정 모드 — 파일만 교체하거나 내용 업데이트
        SupplyPlans.update(fileEditId, {
          title: autoTitle,
          fileType: fileForm.fileType,
          type: fileForm.fileType,
          school: fileForm.schools[0] || null,
          productId: fileProductTarget || fileForm.productId || null,
          stage: fileForm.stage || null,
          ...(fileUrl ? { fileUrl, fileName } : {}),
        })
        setFileEditId(null)
      } else {
        // 학교 다중 저장: schools 배열 각각 insert (빈 배열이면 schools=null로 1건)
        const schoolsToSave = fileForm.schools.length > 0 ? fileForm.schools : [null]
        schoolsToSave.forEach(school => {
          SupplyPlans.insert({
            id: uid(), teacherId: user.id, subject: selSubject,
            type: fileForm.fileType, fileType: fileForm.fileType,
            title: autoTitle,
            school: school || null,
            vendorId: fileTarget||null,
            productId: fileProductTarget || fileForm.productId || null,
            stage: fileForm.stage || null,
            fileUrl, fileName, createdAt: now(),
          })
        })
      }
      reload(); setFileModal(false); setModalFile(null); setFileEditId(null); success(fileEditId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
    } catch(e) { toastError('업로드 실패: '+e.message) }
    finally { setUploading(false) }
  }
  const deleteFile = (id) => {
    setDeleteConfirm({ msg:'이 파일을 삭제하시겠습니까?', onOk: () => { SupplyPlans.delete(id); reload(); success('삭제가 완료되었습니다.') } })
  }

  // 과목 관리
  const addSubject = () => {
    const s = newSubject.trim()
    if (!s) return
    if (subjects.includes(s)) { toastError('이미 있는 과목이에요'); return }
    SupplySubjects.insert({ id: uid(), teacherId: user.id, name:s, sortOrder:subjects.length, createdAt:now() })
    reload(); setNewSubject(''); setSubjectModal(false); setSelSubject(s)
  }
  const deleteSubject = (s) => {
    setDeleteConfirm({ msg:`"${s}" 과목을 삭제하시겠습니까?`, onOk: () => {
      const rec = SupplySubjects.byTeacher(user.id).find(r=>r.name===s)
      if (rec) SupplySubjects.delete(rec.id)
      reload()
      if (selSubject===s) setSelSubject(subjects.filter(x=>x!==s)[0]||null)
      success('삭제가 완료되었습니다.')
    }})
  }


  // 지도안/홍보물 정렬: 연간지도안 → 차시별지도안(단계 오름차순) → 나머지
  const sortPlanItems = (items) => {
    const typeOrder = { annual: 0, session: 1, promo: 2 }
    return [...items].sort((a, b) => {
      const ta = typeOrder[a.fileType || a.type] ?? 9
      const tb = typeOrder[b.fileType || b.type] ?? 9
      if (ta !== tb) return ta - tb
      // 같은 타입이면 단계 오름차순
      const sa = Number(a.stage) || 0
      const sb = Number(b.stage) || 0
      return sa - sb
    })
  }

  const INNER_TABS = [
    { key:'supply', label:`🎒 교구(${selSubject||''})` },
    { key:'plan',   label:`📋 지도안(${selSubject||''})` },
    { key:'promo',  label:`🖼 홍보물(${selSubject||''})` },
    { key:'vendor', label:`🏢 교구업체(${selSubject||''})` },
  ]

  const FILE_TYPE_OPTIONS =
    fileModalMode === 'vendor'
      ? [{ v:'annual', l:'📅 연간지도안' }, { v:'session', l:'📝 차시별지도안' }, { v:'promo', l:'🖼 홍보물' }]
    : fileModalMode === 'product_annual'
      ? [{ v:'annual', l:'📅 연간지도안' }]
    : fileModalMode === 'product_session'
      ? [{ v:'session', l:'📝 차시별지도안' }]
    : fileModalMode === 'product_promo'
      ? [{ v:'promo', l:'🖼 홍보물' }]
    : innerTab === 'promo'
      ? [{ v:'promo', l:'🖼 홍보물' }]
      : [{ v:'annual', l:'📅 연간지도안' }, { v:'session', l:'📝 차시별지도안' }]

  // 파일 모달 타이틀
  const fileModalTitle =
    fileModalMode === 'product_annual' ? '📅 연간지도안 등록'
    : fileModalMode === 'product_session' ? '📝 차시별지도안 등록'
    : fileModalMode === 'product_promo' ? '🖼 홍보물 등록'
    : fileModalMode === 'vendor'        ? '🏢 업체 파일 추가'
    : innerTab === 'promo'              ? '🖼 홍보물 등록'
    : '📋 지도안 등록'

  // 연결 대상 교구명 (product_* 모드일 때)
  const fileProductName = fileProductTarget
    ? (productList.find(p => p.id === fileProductTarget)?.name || '')
    : ''

  return (
    <div style={{ padding:'24px', maxWidth:'1200px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🎒 교구 및 지도안 관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>과목별 교구 · 지도안 · 홍보물 · 교구업체 관리</p>
        </div>
      </div>

      {/* 과목 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        {subjects.map(s => (
          <div key={s} style={{ display:'flex', alignItems:'center' }}>
            <button onClick={() => { setSelSubject(s); setSelClassId(''); setInnerTab('supply') }}
              style={{ padding:'8px 16px', borderRadius: selSubject===s ? '8px 0 0 8px' : '8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'14px', background: selSubject===s ? C.primary : '#f3f4f6', color: selSubject===s ? '#fff' : C.muted, transition:'all .15s' }}>
              {s}
            </button>
            {selSubject===s && (
              <button onClick={() => deleteSubject(s)}
                style={{ padding:'8px 7px', borderRadius:'0 8px 8px 0', border:'none', cursor:'pointer', background:'#dc262620', color:C.danger, fontSize:'13px', lineHeight:1 }}>✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setSubjectModal(true)}
          style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 과목 추가
        </button>
      </div>

      {selSubject && (
        <>
          {/* 내부 탭 */}
          <div style={{ display:'flex', marginBottom:'20px', borderBottom:`1px solid ${C.border}`, overflowX:'auto' }}>
            {INNER_TABS.map(t => (
              <button key={t.key} onClick={() => setInnerTab(t.key)}
                style={{ padding:'10px 18px', border:'none', cursor:'pointer', background:'none', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight: innerTab===t.key ? 700 : 400, color: innerTab===t.key ? C.primary : C.muted, borderBottom: innerTab===t.key ? `2px solid ${C.primary}` : '2px solid transparent', marginBottom:'-1px', whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── 교구 탭 */}
          {innerTab === 'supply' && (
            <div>
              {/* 수업 선택 */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>수업 선택</label>
                <select value={selClassId} onChange={e => setSelClassId(e.target.value)}
                  style={{ ...iStyle, width:'auto', minWidth:'300px' }}>
                  <option value=''>-- 수업을 선택하세요 --</option>
                  {[...classes].sort((a, b) => {
                    const DAY = ['월','화','수','목','금','토','일']
                    const aDay = DAY.indexOf(a.days?.[0] ?? ''); const bDay = DAY.indexOf(b.days?.[0] ?? '')
                    const dayCmp = (aDay===-1?99:aDay) - (bDay===-1?99:bDay)
                    if (dayCmp !== 0) return dayCmp
                    const schoolCmp = (a.organization||'').localeCompare(b.organization||'','ko')
                    if (schoolCmp !== 0) return schoolCmp
                    const classCmp = (a.className||'').localeCompare(b.className||'','ko')
                    if (classCmp !== 0) return classCmp
                    return (a.section||'').localeCompare(b.section||'','ko')
                  }).map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.organization} · {cls.className}{cls.section ? ' '+cls.section : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selClassId && isRobot && (
                /* 로봇 전용: 교구배정 / 진도체크 뷰 전환 */
                <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
                  {[{ v:'assign', l:'🎒 교구 배정' }, { v:'progress', l:'📊 진도 체크' }].map(o => (
                    <button key={o.v} onClick={() => setRobotView(o.v)}
                      style={{ padding:'7px 18px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, background: robotView===o.v ? C.primary : '#f3f4f6', color: robotView===o.v ? '#fff' : C.muted, transition:'all .15s' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              )}

              {selClassId ? (
                <>
                  {/* ── 교구 배정 뷰 */}
                  {(!isRobot || robotView==='assign') && (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', padding:'10px 14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                        <label style={{ display:'flex', alignItems:'center', gap:'7px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:C.text }}>
                          <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width:'16px', height:'16px', cursor:'pointer' }} />
                          전체 선택 ({checkedStudents.length}/{confirmedStudents.length}명)
                        </label>
                        <div style={{ flex:1 }} />
                        {checkedStudents.length > 0 && (
                          <button onClick={() => {
                            // 다중 선택 시 빈 폼으로 열기 (일괄 설정)
                            setSupplyForm({ name:'', productId:'', stage:1 })
                            setSupplyModal(true)
                          }}
                            style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            🎒 교구 설정 ({checkedStudents.length}명)
                          </button>
                        )}
                      </div>
                      {confirmedStudents.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>확정된 학생이 없습니다</div>
                      ) : (() => {
                        const selClass   = classes.find(c => c.id === selClassId)
                        const school     = selClass?.organization || '-'
                        const classLabel = `${selClass?.className || ''}${selClass?.section ? ' '+selClass.section : ''}`
                        const cols = '32px 100px 90px 56px 44px 40px 1fr 1fr 62px 110px 52px'
                        return (
                          <div style={{ display:'flex', flexDirection:'column', gap:'4px', overflowX:'auto' }}>
                            {/* 헤더 */}
                            <div style={{ display:'grid', gridTemplateColumns:cols, gap:'8px', padding:'7px 12px', background:'#f3f4f6', borderRadius:'8px', fontSize:'11px', fontWeight:700, color:C.muted, minWidth:'900px' }}>
                              <span></span>
                              <span>학교명</span>
                              <span>수업반</span>
                              <span>학년</span>
                              <span>반</span>
                              <span>번호</span>
                              <span>이름</span>
                              <span>교구명</span>
                              <span>단계</span>
                              <span>진도</span>
                              <span></span>
                            </div>
                            {confirmedStudents.map(s => {
                              const supply    = getStudentSupply(s.id)
                              const isChecked = checkedStudents.includes(s.id)
                              const product   = productList.find(p => p.id === supply.productId)
                              const sps       = product?.sessionsPerStage || 12
                              const prog      = progressList.find(p => p.studentId===s.id && p.classId===selClassId && p.productId===supply.productId)
                              const curStage  = prog?.curStage || (supply.stage ? Number(supply.stage) : null)
                              const stageChecks = curStage
                                ? checkList.filter(c => c.studentId===s.id && c.classId===selClassId && c.productId===supply.productId && c.stage===curStage).length
                                : 0
                              const hasSupply = !!supply.name
                              return (
                                <div key={s.id}
                                  style={{ display:'grid', gridTemplateColumns:cols, gap:'8px', alignItems:'center', padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${isChecked ? C.primary : C.border}`, background: isChecked ? '#fff7ed' : C.card, minWidth:'900px' }}>
                                  <input type="checkbox" checked={isChecked} onChange={() => toggleOne(s.id)}
                                    style={{ width:'16px', height:'16px', cursor:'pointer' }} />
                                  <span style={{ fontSize:'12px', color:C.text }}>{school}</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{classLabel}</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{s.grade}학년</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{s.classNum}반</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{s.number||'-'}</span>
                                  <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{s.name}</span>
                                  <span style={{ fontSize:'12px', fontWeight:600, color: hasSupply ? '#7c3aed' : C.danger }}>
                                    {hasSupply ? supply.name : '없음'}
                                  </span>
                                  <span style={{ fontSize:'12px', color: hasSupply && curStage ? C.text : C.danger }}>
                                    {hasSupply && curStage ? `${curStage}단계` : <span style={{ color:C.danger }}>없음</span>}
                                  </span>
                                  <span style={{ fontSize:'12px', color: hasSupply && curStage ? C.text : C.danger }}>
                                    {hasSupply && curStage
                                      ? `${sps}차시 중 ${stageChecks}`
                                      : <span style={{ color:C.danger }}>없음</span>}
                                  </span>
                                  {hasSupply ? (
                                    <button onClick={e => {
                                      e.stopPropagation()
                                      // 기존 설정값 로드해서 모달 열기
                                      setCheckedStudents([s.id])
                                      // productId가 현재 productList에 없으면 무효 처리 (유령 차시 표시 방지)
                                      const validPid = productList.find(p => p.id === supply.productId) ? supply.productId : ''
                                      setSupplyForm({
                                        name: validPid ? (supply.name || '') : '',
                                        productId: validPid,
                                        stage: supply.stage ? Number(supply.stage) : 1,
                                      })
                                      setSupplyModal(true)
                                    }}
                                      style={{ padding:'4px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                                      수정
                                    </button>
                                  ) : (
                                    <span style={{ fontSize:'11px', color:C.muted }}>—</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </>
                  )}

                  {/* ── 진도 체크 뷰 (로봇 전용) */}
                  {isRobot && robotView==='progress' && (
                    <div>
                      {robotProducts.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>
                          <div style={{ fontSize:'36px', marginBottom:'10px' }}>🤖</div>
                          <div style={{ marginBottom:'14px' }}>등록된 교구가 없습니다.</div>
                          <button
                            onClick={() => { setRobotView('assign'); setInnerTab('vendor') }}
                            style={{ fontSize:'13px', color:C.primary, background:'#fff7ed', border:`1.5px solid ${C.primary}`, borderRadius:'8px', padding:'8px 18px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:700 }}>
                            🏢 교구업체 · 교구 등록하러 가기 →
                          </button>
                        </div>
                      ) : (() => {
                        // 이 수업에서 실제 배정된 교구 목록만 (학생별 supply 기준)
                        const assignedProductIds = [...new Set(
                          confirmedStudents
                            .map(s => getStudentSupply(s.id).productId)
                            .filter(Boolean)
                        )]
                        const assignedProducts = robotProducts.filter(p => assignedProductIds.includes(p.id))

                        if (assignedProducts.length === 0) return (
                          <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>
                            <div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>
                            <div>교구가 배정된 학생이 없습니다.</div>
                            <div style={{ fontSize:'12px', marginTop:'4px' }}>교구 배정 탭에서 먼저 교구를 설정하세요.</div>
                          </div>
                        )

                        return assignedProducts.map(product => {
                          const sessionsPerStage = product.sessionsPerStage || 12
                          const alertSession     = product.alertSession || 10
                          const avg = avgProgress[product.id] || 0
                          // 이 교구가 배정된 학생만
                          const productStudents = confirmedStudents.filter(s => getStudentSupply(s.id).productId === product.id)

                          return (
                            <div key={product.id} style={{ marginBottom:'24px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                              {/* 교구 헤더 */}
                              <div style={{ padding:'14px 18px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                                <div>
                                  <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>🤖 {product.name}</span>
                                  <span style={{ fontSize:'12px', color:C.muted, marginLeft:'10px' }}>단계당 {sessionsPerStage}차시 기준 · {alertSession}차시 도달 시 준비 알림</span>
                                </div>
                                <span style={{ fontSize:'12px', color:C.blue, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'6px', padding:'2px 8px', fontWeight:600 }}>
                                  평균 진도 {Math.round(avg * 10) / 10}차시 · {productStudents.length}명
                                </span>
                              </div>

                              {/* 학생별 진도 */}
                              <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:'8px' }}>
                                {productStudents.map(s => {
                                  const supply = getStudentSupply(s.id)
                                  const assignedStage = Number(supply.stage) || 1
                                  const prog = getProgress(s.id, product.id)
                                  const curStage = prog?.curStage || assignedStage
                                  const studentChecks = getStudentChecks(s.id, product.id)
                                  const curStageChecks = studentChecks.filter(c=>c.stage===curStage).length
                                  const totalSessions = (curStage-1)*sessionsPerStage + curStageChecks
                                  const isAhead  = totalSessions > avg + 2
                                  const isBehind = avg > 0 && totalSessions < avg - 2

                                  return (
                                    <div key={s.id} style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:'#f9fafb', cursor:'pointer' }}
                                        onClick={() => { setProgressStudent(s); setProgressProductId(product.id); setProgressModal(true) }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:'14px', fontWeight:600, color:C.text, display:'flex', alignItems:'center', gap:'8px' }}>
                                            {s.name}
                                            <span style={{ fontSize:'12px', color:C.muted, fontWeight:400 }}>{s.grade} {s.classNum}반</span>
                                            {isAhead  && <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'4px', padding:'0 5px' }}>🚀 빠름</span>}
                                            {isBehind && <span style={{ fontSize:'11px', background:'#fef2f2', color:C.danger,  border:'1px solid #fca5a5', borderRadius:'4px', padding:'0 5px' }}>🐌 느림</span>}
                                          </div>
                                          <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                                            {curStage}단계 · {curStageChecks}/{sessionsPerStage}차시 완료
                                          </div>
                                        </div>
                                        <ProgressBadge checkedCount={curStageChecks} totalCount={sessionsPerStage} alertSession={alertSession} sessionsPerStage={sessionsPerStage} />
                                        <span style={{ fontSize:'12px', color:C.primary }}>체크 →</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>🎒</div>
                  <div style={{ fontSize:'14px' }}>수업을 선택하면 학생 목록이 표시됩니다</div>
                </div>
              )}
            </div>
          )}

          {/* ── 지도안 탭 */}
          {innerTab === 'plan' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>연간/차시별 지도안을 등록합니다. 학교를 지정하면 해당 학교 제출용으로 분류됩니다.</div>
                <button onClick={() => openFileModal('plan')}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 지도안 등록
                </button>
              </div>
              {(() => {
                const planItems = subjectPlans.filter(p => p.fileType!=='promo' && p.type!=='promo')
                if (!planItems.length) return <div style={{ textAlign:'center', padding:'60px', color:C.muted }}><div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div><div style={{ fontSize:'14px' }}>등록된 지도안이 없습니다</div></div>
                const noSchool = planItems.filter(p=>!p.school)
                const schools  = [...new Set(planItems.filter(p=>p.school).map(p=>p.school))]
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {noSchool.length > 0 && <div><div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>📁 공통 자료</div><div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>{sortPlanItems(noSchool).map(p=><FileRow key={p.id} item={p} onDelete={deleteFile} onEdit={item=>openFileModal('plan', null, item.productId, item)}/>)}</div></div>}
                    {schools.map(school => <div key={school}><div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>🏫 {school}</div><div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>{sortPlanItems(planItems.filter(p=>p.school===school)).map(p=><FileRow key={p.id} item={p} onDelete={deleteFile} onEdit={item=>openFileModal('plan', null, item.productId, item)}/>)}</div></div>)}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 홍보물 탭 */}
          {innerTab === 'promo' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>과목별 홍보물을 보관합니다. 학교를 지정하면 해당 학교 제출용으로 분류됩니다.</div>
                <button onClick={() => openFileModal('promo')}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 홍보물 등록
                </button>
              </div>
              {(() => {
                const promoItems = subjectPlans.filter(p=>p.fileType==='promo'||p.type==='promo')
                if (!promoItems.length) return <div style={{ textAlign:'center', padding:'60px', color:C.muted }}><div style={{ fontSize:'36px', marginBottom:'10px' }}>🖼</div><div style={{ fontSize:'14px' }}>등록된 홍보물이 없습니다</div></div>
                const noSchool = promoItems.filter(p=>!p.school)
                const schools  = [...new Set(promoItems.filter(p=>p.school).map(p=>p.school))]
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {noSchool.length > 0 && <div><div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>📁 공통 홍보물</div><div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>{sortPlanItems(noSchool).map(p=><FileRow key={p.id} item={p} onDelete={deleteFile} onEdit={item=>openFileModal('promo', null, item.productId, item)}/>)}</div></div>}
                    {schools.map(school => <div key={school}><div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>🏫 {school}</div><div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>{sortPlanItems(promoItems.filter(p=>p.school===school)).map(p=><FileRow key={p.id} item={p} onDelete={deleteFile} onEdit={item=>openFileModal('promo', null, item.productId, item)}/>)}</div></div>)}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 교구업체 탭 */}
          {innerTab === 'vendor' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>교구업체별 담당자 · 교구 목록 · 업체 제공 자료를 관리합니다.</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => openProductModal(null)}
                    style={{ padding:'8px 18px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 교구 등록
                  </button>
                  <button onClick={() => setVendorModal(true)}
                    style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 업체 등록
                  </button>
                </div>
              </div>

              {subjectVendors.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏢</div>
                  <div style={{ fontSize:'14px' }}>등록된 교구업체가 없습니다</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {subjectVendors.map(v => {
                    const vFiles    = vendorFiles(v.id)
                    const vProducts = productList.filter(p=>p.vendorId===v.id)
                    const isExpanded = expandedVendor === v.id
                    return (
                      <div key={v.id} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                        {/* 업체 헤더 */}
                        <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', background: isExpanded ? '#f9fafb' : C.card }}
                          onClick={() => setExpandedVendor(isExpanded ? null : v.id)}>
                          <span style={{ fontSize:'20px' }}>🏢</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{v.name}</div>
                            <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, marginTop:'2px', flexWrap:'wrap' }}>
                              {v.managerName && <span>👤 {v.managerName}</span>}
                              {v.contact     && <span>📞 {v.contact}</span>}
                              {v.memo        && <span>📌 {v.memo}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            {vProducts.length > 0 && <span style={{ fontSize:'12px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>교구 {vProducts.length}종</span>}
                            {vFiles.length > 0    && <span style={{ fontSize:'12px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>파일 {vFiles.length}개</span>}
                            <button onClick={e=>{ e.stopPropagation(); deleteVendor(v.id) }}
                              style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                            <span style={{ fontSize:'14px', color:C.muted }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop:`1px solid ${C.border}` }}>
                            {/* 교구 목록 */}
                            <div style={{ padding:'14px 18px', borderBottom:`1px solid #f3f4f6` }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>🤖 교구 목록</span>
                                {isRobot && (
                                  <button onClick={() => openProductModal(v.id)}
                                    style={{ padding:'4px 12px', borderRadius:'6px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                    + 교구 등록
                                  </button>
                                )}
                              </div>
                              {vProducts.length === 0 ? (
                                <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'12px 0' }}>등록된 교구가 없습니다</div>
                              ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                                  {vProducts.map(p => {
                                    const planCount   = productPlanList.filter(pl=>pl.productId===p.id).length
                                    const annualPlans = planList.filter(pl=>pl.productId===p.id && (pl.fileType==='annual'||pl.type==='annual'))
                                    const promos      = planList.filter(pl=>pl.productId===p.id && (pl.fileType==='promo'||pl.type==='promo'))
                                    return (
                                      <div key={p.id} style={{ background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                                        {/* 교구 헤더 */}
                                        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px' }}>
                                          <span style={{ fontSize:'18px' }}>🤖</span>
                                          <div style={{ flex:1 }}>
                                            <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name}</div>
                                            <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px', display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
                                              {/* 등록된 단계별 차시 수 */}
                                              {(() => {
                                                const stagesFromPlans = planList.filter(pl=>pl.productId===p.id&&(pl.fileType==='session'||pl.type==='session')&&pl.stage).map(pl=>Number(pl.stage))
                                                const stagesFromProductPlans = productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage)
                                                const registeredStages = [...new Set([...stagesFromProductPlans, ...stagesFromPlans])].sort((a,b)=>a-b)
                                                if (registeredStages.length === 0) return <span style={{ color:C.danger }}>차시지도안 미등록</span>
                                                return registeredStages.map(st => {
                                                  const cnt = productPlanList.filter(pl=>pl.productId===p.id&&pl.stage===st).length
                                                  return <span key={st} style={{ background:'#f5f3ff', color:'#7c3aed', borderRadius:'4px', padding:'1px 6px' }}>{st}단계{cnt>0?`(${cnt}차시)`:''}</span>
                                                })
                                              })()}
                                              {annualPlans.length > 0 && <span style={{ background:'#eff6ff', color:C.blue, borderRadius:'4px', padding:'1px 6px' }}>연간지도안 {annualPlans.length}개</span>}
                                              {promos.length > 0      && <span style={{ background:'#f0fdf4', color:C.success, borderRadius:'4px', padding:'1px 6px' }}>홍보물 {promos.length}개</span>}
                                            </div>
                                          </div>
                                          <button onClick={() => openProductModal(v.id, p)}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', flexShrink:0 }}>수정</button>
                                          <button onClick={() => deleteProduct(p.id)}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', flexShrink:0 }}>삭제</button>
                                        </div>
                                        {/* 단계별 차시지도안 */}
                                        <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                            <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📊 단계별 진도체크</span>
                                            {(() => {
                                              const stagesFromPlans2 = planList.filter(pl=>pl.productId===p.id&&(pl.fileType==='session'||pl.type==='session')&&pl.stage).map(pl=>Number(pl.stage))
                                              const stagesFromProductPlans2 = productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage)
                                              const registeredStages = [...new Set([...stagesFromProductPlans2, ...stagesFromPlans2])].sort((a,b)=>a-b)
                                              const nextStage = registeredStages.length > 0 ? Math.max(...registeredStages) + 1 : 1
                                              return nextStage <= (p.maxStage||10) ? (
                                                <button onClick={() => openSessionPlan(p.id, nextStage)}
                                                  style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                  + 추가
                                                </button>
                                              ) : null
                                            })()}
                                          </div>
                                          {(() => {
                                            const stagesFromPlans3 = planList.filter(pl=>pl.productId===p.id&&(pl.fileType==='session'||pl.type==='session')&&pl.stage).map(pl=>Number(pl.stage))
                                            const stagesFromProductPlans3 = productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage)
                                            const registeredStages = [...new Set([...stagesFromProductPlans3, ...stagesFromPlans3])].sort((a,b)=>a-b)
                                            if (registeredStages.length === 0) return (
                                              <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시지도안이 없습니다</div>
                                            )
                                            return (
                                              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                                {registeredStages.map(stage => {
                                                  const plans = productPlanList
                                                    .filter(pl=>pl.productId===p.id&&pl.stage===stage)
                                                    .sort((a,b)=>a.sessionNo-b.sessionNo)
                                                  const expandKey = `${p.id}_${stage}`
                                                  return (
                                                    <div key={stage} style={{ background:C.card, borderRadius:'9px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                                                      {/* 단계 헤더 — 클릭하면 목차 토글 */}
                                                      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', cursor:'pointer' }}
                                                        onClick={() => setExpandedStage(prev => prev === expandKey ? null : expandKey)}>
                                                        <span style={{ fontSize:'16px', flexShrink:0 }}>📝</span>
                                                        <div style={{ flex:1 }}>
                                                          <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name} {stage}단계 목차리스트</span>
                                                          <span style={{ fontSize:'11px', color:C.success, marginLeft:'8px' }}>{plans.length}차시</span>
                                                        </div>
                                                        <button onClick={e=>{ e.stopPropagation(); openSessionPlan(p.id, stage) }}
                                                          style={{ padding:'3px 10px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', flexShrink:0 }}>
                                                          수정
                                                        </button>
                                                        <button onClick={e=>{ e.stopPropagation(); setDeleteConfirm({ msg:`${stage}단계 차시 진도체크 데이터를 삭제하시겠습니까?`, onOk: () => { productPlanList.filter(pl=>pl.productId===p.id&&pl.stage===stage).forEach(pl=>SupplyProductPlans.delete(pl.id)); reload(); success('삭제가 완료되었습니다.') } }) }}
                                                          style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', flexShrink:0 }}>
                                                          삭제
                                                        </button>
                                                        <span style={{ fontSize:'12px', color:C.muted, cursor:'pointer' }}>{expandedStage===expandKey ? '▲' : '▼'}</span>
                                                      </div>
                                                      {/* 차시 목차 — 펼쳤을 때만 */}
                                                      {expandedStage === expandKey && (
                                                        <div style={{ padding:'6px 12px 10px', borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:'3px' }}>
                                                          {plans.map(pl => (
                                                            <div key={pl.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr 1fr', gap:'6px', fontSize:'12px', padding:'4px 0', borderBottom:`1px solid #f9fafb` }}>
                                                              <span style={{ color:C.primary, fontWeight:700 }}>{pl.sessionNo}차시</span>
                                                              <span style={{ color:C.text }}>{pl.title}</span>
                                                              <span style={{ color:C.muted }}>{pl.memo ? `📌 ${pl.memo}` : ''}</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )
                                          })()}
                                        </div>
                                        {/* 연간지도안 */}
                                        <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                            <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📅 연간지도안</span>
                                            <button onClick={() => openFileModal('product_annual', v.id, p.id)}
                                              style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                              + 추가
                                            </button>
                                          </div>
                                          {annualPlans.length === 0 ? (
                                            <div style={{ fontSize:'12px', color:C.muted }}>등록된 연간지도안이 없습니다</div>
                                          ) : (
                                            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                              {annualPlans.map(f => <FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('product_annual', null, item.productId, item)}/>)}
                                            </div>
                                          )}
                                        </div>

                                        {/* 차시별지도안 파일 */}
                                        {(() => {
                                          const sessionPlans = planList.filter(pl => pl.productId===p.id && (pl.fileType==='session'||pl.type==='session'))
                                          return (
                                            <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                                <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📝 차시별지도안 파일</span>
                                                <button onClick={() => openFileModal('product_session', v.id, p.id)}
                                                  style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                  + 추가
                                                </button>
                                              </div>
                                              {sessionPlans.length === 0 ? (
                                                <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시별지도안 파일이 없습니다</div>
                                              ) : (
                                                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                                  {sessionPlans.map(f => <FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('product_session', null, item.productId, item)}/>)}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })()}
                                        {/* 홍보물 */}
                                        <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                            <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>🖼 홍보물</span>
                                            <button onClick={() => openFileModal('product_promo', v.id, p.id)}
                                              style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                              + 추가
                                            </button>
                                          </div>
                                          {promos.length === 0 ? (
                                            <div style={{ fontSize:'12px', color:C.muted }}>등록된 홍보물이 없습니다</div>
                                          ) : (
                                            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                              {promos.map(f => <FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('product_promo', null, item.productId, item)}/>)}
                                            </div>
                                          )}
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
              )}
            </div>
          )}
        </>
      )}

      {/* ── 교구 설정 모달 */}
      <Modal open={supplyModal} onClose={() => setSupplyModal(false)} title={`🎒 교구 설정 (${checkedStudents.length}명)`} width={420}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* ① 교구 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구 선택 *</label>
                <select
                  value={supplyForm.productId}
                  onChange={e => {
                    const pid = e.target.value
                    const p = productList.find(x => x.id === pid)
                    setSupplyForm(v => ({ ...v, productId: pid, name: p ? p.name : '' }))
                  }}
                  style={{ ...iStyle, background:'#fff' }}
                >
                  <option value=''>-- 교구를 선택하세요 --</option>
                  {robotProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {/* 교구 없으면 등록 링크 */}
                {robotProducts.length === 0 && (
                  <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'12px', color:C.warning }}>⚠️ 등록된 교구가 없습니다.</span>
                    <button
                      onClick={() => { setSupplyModal(false); setInnerTab('vendor') }}
                      style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                      🏢 교구업체·교구 등록하러 가기 →
                    </button>
                  </div>
                )}
                {/* 교구 있는데 직접 입력하고 싶을 때 */}
                {robotProducts.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <input
                      value={supplyForm.productId ? '' : supplyForm.name}
                      onChange={e => setSupplyForm(v => ({ ...v, name: e.target.value, productId: '' }))}
                      placeholder="또는 교구명 직접 입력"
                      style={{ ...iStyle, fontSize:'12px', padding:'6px 10px', color: supplyForm.productId ? C.muted : C.text }}
                      disabled={!!supplyForm.productId}
                    />
                  </div>
                )}
              </div>

              {/* ② 단계 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계</label>
                <select
                  value={supplyForm.stage}
                  onChange={e => setSupplyForm(v => ({ ...v, stage: Number(e.target.value) }))}
                  style={{ ...iStyle, background:'#fff' }}
                >
                  <option value=''>단계 없음</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}단계</option>)}
                </select>
              </div>

              {/* ③ 선택된 교구+단계의 차시 제목 미리보기 */}
              {supplyForm.productId && supplyForm.stage && (() => {
                const plans = productPlanList
                  .filter(p => p.productId === supplyForm.productId && p.stage === supplyForm.stage)
                  .sort((a,b) => a.sessionNo - b.sessionNo)
                const product = productList.find(p => p.id === supplyForm.productId)
                const sessionsPerStage = product?.sessionsPerStage || 12

                if (plans.length === 0) {
                  return (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'12px', color:C.warning }}>⚠️ {supplyForm.stage}단계 차시 제목이 등록되지 않았습니다.</span>
                      <button
                        onClick={() => { setSupplyModal(false); setInnerTab('vendor'); openSessionPlan(supplyForm.productId, supplyForm.stage) }}
                        style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, whiteSpace:'nowrap' }}>
                        📝 차시 제목 등록하러 가기 →
                      </button>
                    </div>
                  )
                }
                return (
                  <div style={{ border:`1px solid ${C.border}`, borderRadius:'8px', overflow:'hidden' }}>
                    <div style={{ padding:'8px 12px', background:'#f0fdf4', borderBottom:`1px solid #86efac`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'12px', fontWeight:600, color:C.success }}>✅ {supplyForm.stage}단계 차시 제목 {plans.length}/{sessionsPerStage}개 등록됨</span>
                      <button
                        onClick={() => { setSupplyModal(false); setInnerTab('vendor'); openSessionPlan(supplyForm.productId, supplyForm.stage) }}
                        style={{ fontSize:'11px', color:C.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline' }}>
                        수정하러 가기
                      </button>
                    </div>
                    <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:'3px', maxHeight:'120px', overflowY:'auto' }}>
                      {plans.map(p => (
                        <div key={p.id} style={{ display:'flex', gap:'8px', fontSize:'12px' }}>
                          <span style={{ color:C.primary, fontWeight:600, minWidth:'40px' }}>{p.sessionNo}차시</span>
                          <span style={{ color:C.text }}>{p.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* 안내 */}
              <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                선택된 <strong>{checkedStudents.length}명</strong>에게 동일하게 적용됩니다.
              </div>

            </div>

            {/* footer 고정 버튼 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px', flexShrink:0 }}>
              <button onClick={saveSupply}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                저장
              </button>
              <button onClick={() => setSupplyModal(false)}
                style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                취소
              </button>
        </div>
      </Modal>

      {/* ── 진도 체크 모달 */}
      <Modal open={!!(progressModal && progressStudent)} onClose={() => setProgressModal(false)} title={progressStudent ? `📊 ${progressStudent.name} 진도 체크` : ''} width={600}>

            {/* 내용 */}
            <div style={{ padding:'20px', overflowY:'auto' }}>
              {(() => {
                const product = productList.find(p=>p.id===progressProductId)
                if (!product) return <div style={{ color:C.muted }}>교구를 찾을 수 없습니다</div>
                const sessionsPerStage = product.sessionsPerStage || 12
                const alertSession     = product.alertSession || 10
                const studentChecks    = getStudentChecks(progressStudent.id, product.id)
                const prog             = getProgress(progressStudent.id, product.id)
                const curStage         = prog?.curStage || 1

                // 이 학생에게 배정된 단계만
                const supply = itemList.find(i => i.classId===selClassId && i.studentId===progressStudent.id)
                const assignedStage = supply?.stage ? Number(supply.stage) : (prog?.curStage || 1)
                // 배정 단계 기준으로 현재 단계만 표시 (완료된 이전 단계 포함)
                const maxShowStage = Math.max(assignedStage, prog?.curStage || 1)
                const showStages = STAGES.slice(0, maxShowStage)

                const allSessions = productPlanList.filter(p=>p.productId===product.id).sort((a,b)=>a.stage!==b.stage?a.stage-b.stage:a.sessionNo-b.sessionNo)
                const stageGroups = {}
                showStages.forEach(stage => {
                  const stagePlans = allSessions.filter(p=>p.stage===stage)
                  stageGroups[stage] = stagePlans.length > 0
                    ? stagePlans
                    : Array.from({length: sessionsPerStage}, (_, i) => ({ id:`dummy_${stage}_${i+1}`, stage, sessionNo:i+1, title:`${stage}단계 ${i+1}차시`, dummy:true }))
                })

                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    <div
                      onClick={() => { setProgressModal(false); openProductModal(product.vendorId, product) }}
                      title="교구 등록에서 차시·알림 기준을 수정할 수 있습니다"
                      style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:'10px', fontSize:'13px', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f0f4ff'}
                      onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                      <span>🤖 {product.name} · {assignedStage}단계 배정 · 단계당 {sessionsPerStage}차시 기준 · {alertSession}차시 도달 시 준비 알림</span>
                      <span style={{ fontSize:'11px', color:C.primary, fontWeight:600, marginLeft:'10px', whiteSpace:'nowrap' }}>✏️ 교구 등록에서 수정</span>
                    </div>
                    {showStages.map(stage => {
                      const sessions = stageGroups[stage]
                      const stageChecks = studentChecks.filter(c=>c.stage===stage)
                      const checkedNos  = new Set(stageChecks.map(c=>c.sessionNo))
                      const checkedCnt  = stageChecks.length
                      const isAlert     = checkedCnt >= alertSession && checkedCnt < sessionsPerStage
                      const isDone      = checkedCnt >= sessionsPerStage

                      return (
                        <div key={stage} style={{ border:`1px solid ${isDone?'#86efac':isAlert?'#fde68a':C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                          <div style={{ padding:'10px 14px', background: isDone?'#f0fdf4':isAlert?'#fffbeb':'#f9fafb', display:'flex', alignItems:'center', gap:'8px' }}>
                            <span style={{ fontSize:'13px', fontWeight:700, color: isDone?C.success:isAlert?C.warning:C.text }}>{stage}단계</span>
                            <span style={{ fontSize:'12px', color:C.muted }}>{checkedCnt}/{sessionsPerStage}차시</span>
                            {isDone  && <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료</span>}
                            {isAlert && <span style={{ fontSize:'11px', background:'#fffbeb', color:C.warning, border:'1px solid #fde68a', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>⚠️ 다음 단계 준비</span>}
                          </div>
                          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'5px' }}>
                            {sessions.map(sess => {
                              const isChecked = checkedNos.has(sess.sessionNo)
                              return (
                                <div key={sess.id} onClick={() => toggleCheck(progressStudent.id, product.id, stage, sess.sessionNo)}
                                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px', borderRadius:'7px', background: isChecked ? '#f0fdf4' : '#fff', border:`1px solid ${isChecked?'#86efac':C.border}`, cursor:'pointer', transition:'all .12s' }}>
                                  <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${isChecked?C.success:C.border}`, background: isChecked?C.success:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
                                    {isChecked && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <span style={{ fontSize:'13px', fontWeight: isChecked?600:400, color: isChecked?C.success:C.text }}>
                                      {sess.sessionNo}차시
                                    </span>
                                    {!sess.dummy && (
                                      <span style={{ fontSize:'12px', color:C.muted, marginLeft:'8px' }}>{sess.title}</span>
                                    )}
                                  </div>
                                  {sess.fileUrl && (
                                    <a href={sess.fileUrl} download target="_blank" rel="noopener noreferrer"
                                      onClick={e=>e.stopPropagation()}
                                      style={{ fontSize:'11px', color:C.blue, textDecoration:'none' }}>📄</a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* footer 고정 버튼 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, flexShrink:0, display:'flex', gap:'10px' }}>
              <button onClick={() => setProgressModal(false)}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted, fontWeight:600 }}>
                닫기
              </button>
              <button onClick={() => { success('수정이 완료되었습니다.'); setProgressModal(false) }}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#fff', fontWeight:600 }}>
                저장
              </button>
            </div>
      </Modal>

      {/* ── 교구 등록/수정 모달 */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title={productForm.id ? '🤖 교구 수정' : '🤖 교구 등록'} width={560}>

            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' }}>

              {/* 업체 선택 */}
              {(
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>업체 선택</label>
                  {subjectVendors.length === 0 ? (
                    <div style={{ fontSize:'12px', color:C.warning, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                      <span>⚠️ 등록된 업체가 없습니다.</span>
                      <button onClick={() => { setProductModal(false); setVendorModal(true) }}
                        style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                        + 업체 먼저 등록하기
                      </button>
                    </div>
                  ) : (
                    <select value={productVendorId||''} onChange={e => setProductVendorId(e.target.value||null)}
                      style={{ ...iStyle, background:'#fff' }}>
                      <option value=''>-- 업체 선택 (선택 안 해도 됨) --</option>
                      {subjectVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* 교구명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={productForm.name} onChange={e=>setProductForm(v=>({...v, name:e.target.value}))}
                  placeholder="예: 큐보 1단계, 로봇 키트 A형" style={iStyle} autoFocus />
              </div>

              {/* 기본 설정: 최대단계 / 단계당 차시수 / 준비알림 차시 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>최대 단계</label>
                  <input type="number" min={1} max={20} value={productForm.maxStage}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setProductForm(v => ({...v, maxStage: val}))
                      setStageSessionTitles(prev => {
                        const next = {...prev}
                        for (let s = 1; s <= val; s++) {
                          if (!next[s]) next[s] = Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))
                        }
                        return next
                      })
                      if (productStageTab > val) setProductStageTab(val)
                    }}
                    style={{ ...iStyle, textAlign:'center' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계당 차시 수</label>
                  <input type="number" min={1} max={50} value={productForm.sessionsPerStage}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setProductForm(v => ({...v, sessionsPerStage: val}))
                      setStageSessionTitles(prev => {
                        const newTitles = {}
                        for (let s = 1; s <= productForm.maxStage; s++) {
                          const cur = prev[s] || []
                          newTitles[s] = Array.from({length: val}, (_, i) => cur[i] || { title:'', memo:'' })
                        }
                        return newTitles
                      })
                    }}
                    style={{ ...iStyle, textAlign:'center' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>준비 알림 차시</label>
                  <input type="number" min={1} max={50} value={productForm.alertSession}
                    onChange={e => setProductForm(v=>({...v, alertSession: Number(e.target.value)}))}
                    style={{ ...iStyle, textAlign:'center' }} />
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
                  style={{ ...iStyle, background:'#fff' }}>
                  {Array.from({length: productForm.maxStage}, (_, i) => i+1).map(s => {
                    const filled = (stageSessionTitles[s] || []).filter(t => (typeof t === 'string' ? t : t?.title || '').trim()).length
                    return <option key={s} value={s}>{s}단계 {filled > 0 ? `(${filled}개 입력됨)` : ''}</option>
                  })}
                </select>
              </div>

              {/* 차시 제목 + 준비물 입력 */}
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                {/* 헤더 */}
                <div style={{ padding:'10px 14px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                    📝 {productStageTab}단계 차시별 제목
                  </span>
                  <span style={{ fontSize:'11px', color:C.muted }}>
                    {(stageSessionTitles[productStageTab]||[]).filter(i => (typeof i === 'string' ? i : i?.title || '').trim()).length} / {(stageSessionTitles[productStageTab]||[]).length}개 입력
                  </span>
                </div>

                {/* 컬럼 헤더 */}
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>차시</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>제목</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>준비물</span>
                  <span></span>
                </div>

                {/* 차시 목록 */}
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'220px', overflowY:'auto' }}>
                  {(stageSessionTitles[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))).map((item, idx) => {
                    const t = typeof item === 'string' ? item : (item?.title || '')
                    const m = typeof item === 'string' ? '' : (item?.memo || '')
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
                        <input value={t} onChange={e => updateItem('title', e.target.value)}
                          placeholder="제목 (선택)"
                          style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                        <input value={m} onChange={e => updateItem('memo', e.target.value)}
                          placeholder="준비물 (선택)"
                          style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                        <button onClick={() => setStageSessionTitles(prev => {
                          const cur = [...(prev[productStageTab]||[])]
                          cur.splice(idx, 1)
                          return {...prev, [productStageTab]: cur}
                        })} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </div>
                    )
                  })}
                </div>

                {/* 차시 추가 버튼 */}
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button onClick={() => setStageSessionTitles(prev => {
                    const cur = [...(prev[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''})))]
                    cur.push({ title:'', memo:'' })
                    return {...prev, [productStageTab]: cur}
                  })} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                    + 차시 추가
                  </button>
                </div>
              </div>

            </div>

            {/* 저장/취소 버튼 — footer 고정 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px', flexShrink:0 }}>
              <button onClick={saveProduct}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                저장
              </button>
              <button onClick={() => setProductModal(false)}
                style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                취소
              </button>
            </div>
      </Modal>

      {/* ── 차시 목차리스트 모달 */}
      <Modal open={sessionPlanModal} onClose={() => setSessionPlanModal(false)} title={`📝 ${productList.find(p=>p.id===sessionPlanTarget.productId)?.name} — ${sessionPlanTarget.stage}단계 목차리스트`} width={560}>

            {/* 내용 스크롤 영역 */}
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' }}>

              {/* 차시 인라인 편집 박스 */}
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                {/* 헤더 */}
                <div style={{ padding:'10px 14px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                    📝 {sessionPlanTarget.stage}단계 차시별 제목
                  </span>
                  <span style={{ fontSize:'11px', color:C.muted }}>
                    {sessionPlanEdits.filter(e=>e.title.trim()).length} / {sessionPlanEdits.length}개 입력
                  </span>
                </div>
                {/* 컬럼 헤더 */}
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>차시</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>제목</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>준비물</span>
                  <span></span>
                </div>
                {/* 차시 목록 */}
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'300px', overflowY:'auto' }}>
                  {sessionPlanEdits.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px', fontSize:'13px', color:C.muted }}>
                      아래 버튼으로 차시를 추가하세요
                    </div>
                  )}
                  {sessionPlanEdits.map((item, idx) => (
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{item.sessionNo}차시</span>
                      <input value={item.title}
                        onChange={e => setSessionPlanEdits(prev => prev.map((x,i) => i===idx ? {...x, title:e.target.value} : x))}
                        placeholder="제목 (선택)"
                        style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                      <input value={item.memo}
                        onChange={e => setSessionPlanEdits(prev => prev.map((x,i) => i===idx ? {...x, memo:e.target.value} : x))}
                        placeholder="준비물 (선택)"
                        style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                      <button onClick={() => setSessionPlanEdits(prev => prev.filter((_,i) => i!==idx))}
                        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                    </div>
                  ))}
                </div>
                {/* 차시 추가 버튼 */}
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button onClick={() => setSessionPlanEdits(prev => [
                    ...prev,
                    { id:uid(), sessionNo:prev.length+1, title:'', memo:'', _isNew:true }
                  ])} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                    + 차시 추가
                  </button>
                </div>
              </div>

            </div>

            {/* footer 고정 버튼 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px', flexShrink:0 }}>
              <button onClick={saveSessionPlan} disabled={uploading}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:uploading?'#e5e7eb':C.primary, color:uploading?C.muted:'#fff', fontSize:'14px', fontWeight:700, cursor:uploading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                {uploading ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setSessionPlanModal(false)}
                style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                취소
              </button>
            </div>
      </Modal>

      {/* ── 파일 등록 모달 */}
      <Modal open={fileModal} onClose={() => { setFileModal(false); setModalFile(null) }} title={`${fileEditId ? '✏️ ' : ''}${fileModalTitle}${fileEditId ? ' 수정' : ''} — ${selSubject}`} width={500}>
              <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'16px', overflowY:'auto' }}>

                {/* 종류 선택 (연간 / 차시별) — plan 탭에서만 */}
                {FILE_TYPE_OPTIONS.length > 1 && (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>종류</label>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {FILE_TYPE_OPTIONS.map(o => (
                        <button key={o.v} onClick={()=>setFileForm(f=>({...f, fileType:o.v, stage:''}))}
                          style={{ padding:'8px 18px', borderRadius:'8px', border:`1.5px solid ${fileForm.fileType===o.v?C.primary:C.border}`, background: fileForm.fileType===o.v?'#fff7ed':'#fff', color: fileForm.fileType===o.v?C.primary:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 교구 선택 — plan/session 모드 */}
                {['plan','session','promo'].includes(fileModalMode) && (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>교구 선택 *</label>
                    {modalProducts.length === 0 ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'12px', color:C.warning }}>⚠️ 등록된 교구가 없습니다.</span>
                        <button onClick={() => { setFileModal(false); setInnerTab('vendor') }}
                          style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                          🏢 교구 등록하러 가기 →
                        </button>
                      </div>
                    ) : (
                      <select value={fileForm.productId}
                        onChange={e => setFileForm(f=>({...f, productId:e.target.value, stage:''}))}
                        style={{ ...iStyle, background:'#fff' }}>
                        <option value=''>-- 교구를 선택하세요 --</option>
                        {modalProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                )}

                {/* 단계 선택 — 차시별 지도안일 때 */}
                {(fileModalMode === 'session' || (fileModalMode === 'plan' && fileForm.fileType === 'session')) && fileForm.productId && (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>단계 선택 *</label>
                    <select value={fileForm.stage}
                      onChange={e => setFileForm(f=>({...f, stage:Number(e.target.value)}))}
                      style={{ ...iStyle, background:'#fff' }}>
                      <option value=''>-- 단계를 선택하세요 --</option>
                      {STAGES.slice(0, selectedProduct?.maxStage||10).map(s => <option key={s} value={s}>{s}단계</option>)}
                    </select>
                  </div>
                )}

                {/* 학교 다중 선택 — 동적 버튼 */}
                {!['vendor'].includes(fileModalMode) && (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>
                      학교 지정 <span style={{ fontWeight:400, color:C.muted }}>(복수 선택 가능)</span>
                    </label>
                    {schoolList.length === 0 ? (
                      <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'8px 12px', borderRadius:'7px' }}>
                        수업에 등록된 학교가 없습니다
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                        {schoolList.map(s => {
                          const selected = fileForm.schools.includes(s)
                          return (
                            <button key={s} onClick={() => toggleSchool(s)}
                              style={{ padding:'6px 14px', borderRadius:'20px', border:`1.5px solid ${selected ? C.primary : C.border}`, background: selected ? '#fff7ed' : '#fff', color: selected ? C.primary : C.muted, fontSize:'13px', fontWeight: selected ? 700 : 400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                              {selected ? '✓ ' : ''}{s}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {fileForm.schools.length > 0 && (
                      <div style={{ fontSize:'11px', color:C.primary, marginTop:'5px' }}>
                        선택됨: {fileForm.schools.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 파일 첨부 */}
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>파일 첨부</label>
                  {modalFile ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #86efac' }}>
                      <span style={{ fontSize:'20px' }}>📄</span>
                      <span style={{ fontSize:'13px', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{modalFile.name}</span>
                      <button onClick={()=>setModalFile(null)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'18px' }}>×</button>
                    </div>
                  ) : (
                    <button onClick={()=>fileRef.current?.click()}
                      style={{ width:'100%', padding:'20px', borderRadius:'9px', border:`2px dashed ${C.border}`, background:'#f9fafb', cursor:'pointer', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                      <div style={{ fontSize:'24px', marginBottom:'4px' }}>📎</div>
                      <div style={{ fontSize:'13px' }}>클릭하여 파일 선택</div>
                      <div style={{ fontSize:'11px', marginTop:'2px' }}>.hwp · .hwpx · .pdf · .xlsx · .jpg · .png</div>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept=".hwp,.hwpx,.pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display:'none' }}
                    onChange={e=>e.target.files[0]&&setModalFile(e.target.files[0])} />
                </div>

              </div>

              {/* footer 고정 버튼 */}
              <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px', flexShrink:0 }}>
                <button onClick={saveFile} disabled={uploading}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background: uploading?'#e5e7eb':C.primary, color: uploading?C.muted:'#fff', fontSize:'14px', fontWeight:700, cursor: uploading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {uploading ? '업로드 중...' : fileForm.schools.length > 1 ? `저장 (${fileForm.schools.length}개 학교)` : '저장'}
                </button>
                <button onClick={()=>{ setFileModal(false); setModalFile(null) }}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
      </Modal>

      {/* ── 교구업체 등록 모달 */}
      <Modal open={vendorModal} onClose={() => setVendorModal(false)} title={`🏢 교구업체 등록 — ${selSubject}`} width={420}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'업체명 *',      key:'name',        placeholder:'예: (주)로봇나라' },
                { label:'담당자 이름',   key:'managerName', placeholder:'예: 홍길동' },
                { label:'담당자 연락처', key:'contact',     placeholder:'예: 010-1234-5678' },
                { label:'메모',          key:'memo',        placeholder:'비고' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input value={vendorForm[f.key]} onChange={e=>setVendorForm(v=>({...v, [f.key]:e.target.value}))}
                    placeholder={f.placeholder} style={iStyle} />
                </div>
              ))}
              <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                💡 업체 등록 후 업체 카드를 펼쳐서 교구·홍보물·지도안을 추가할 수 있습니다.
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveVendor}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={()=>setVendorModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
        </div>
      </Modal>

      {/* ── 과목 추가 모달 */}
      <Modal open={subjectModal} onClose={() => setSubjectModal(false)} title="+ 과목 추가" width={360}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <input value={newSubject} onChange={e=>setNewSubject(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addSubject()}
                placeholder="예: 드론, 코딩, 미술 ..." style={iStyle} autoFocus />
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={addSubject}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>추가</button>
                <button onClick={()=>setSubjectModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
        </div>
      </Modal>

      {/* ── 삭제 확인 모달 */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'320px', width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontSize:'14px', fontWeight:600, color:'#111827', marginBottom:'20px', whiteSpace:'pre-line' }}>{deleteConfirm.msg}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={()=>setDeleteConfirm(null)}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
              <button onClick={()=>{ deleteConfirm.onOk(); setDeleteConfirm(null) }}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#ef4444', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          </div>
        </div>
      )}



      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}
    </div>
  )
}
