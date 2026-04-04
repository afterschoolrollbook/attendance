import React, { useState, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB } from '../lib/db.js'
import { SupplyItems, SupplyProducts, SupplyStudentProgress, SupplySessionChecks, SupplyProductPlans } from '../lib/db.js'
import { uid, now, fmtPhone, sortClasses } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Tag, EmptyState, PageHeader, Checkbox, Textarea } from '../components/Atoms.jsx'
import { STUDENT_STATUS, GRADES, DAYS } from '../constants/config.js'
import { useToast } from '../hooks/useToast.js'

function emptyStudent() {
  return {
    school: '', grade: '', classNum: '', number: '', name: '',
    parentPhone: '', studentPhone: '', classIds: [], status: 'applied', memo: '',
    applyOrder: '', remark: '', relations: [], student_careers: [],
    // 수업 직접 입력용
    _newOrganization: '', _newClassName: '', _newSection: '',
    _newTimeStart: '', _newTimeEnd: '',
    _newTermType: 'semester', _newDays: [], _newRepeatType: 'every',
    _newStartDate: '', _newEndDate: '',
  }
}

// 관계 추가 입력 컴포넌트
// 학생 경력 컴포넌트
function CareerAdder({ careers, onChange, isEdit }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2021 }, (_, i) => String(2022 + i)).reverse()
  const [termType, setTermType] = React.useState('semester')
  const [year, setYear] = React.useState(String(currentYear))
  const [term, setTerm] = React.useState('1')

  const semOpts = [{ value:'1', label:'1학기' }, { value:'2', label:'2학기' }]
  const qtrOpts = [{ value:'1', label:'1분기' }, { value:'2', label:'2분기' }, { value:'3', label:'3분기' }, { value:'4', label:'4분기' }]
  const termOpts = termType === 'semester' ? semOpts : qtrOpts

  // 신규 vs 기존: 등록 시 1개(현재텀) → 신규, 2개 이상 → 기존
  const isNew = careers.length <= 1
  const sorted = [...careers].sort((a,b) => a.year !== b.year ? a.year-b.year : Number(a.term)-Number(b.term))

  const add = () => {
    const dup = careers.find(c => c.year === year && c.termType === termType && c.term === term)
    if (dup) return
    const tLabel = termType === 'semester' ? `${term}학기` : `${term}분기`
    const typeLabel = termType === 'semester' ? '학기제' : '분기제'
    onChange([...careers, { year, termType, term, label: `${year.slice(2)}년도 / ${typeLabel} / ${tLabel}` }])
  }

  const sst = { padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
      {/* 신규/기존 뱃지 */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'20px',
          background: isNew ? '#eff6ff' : '#f0fdf4',
          border: `1px solid ${isNew ? '#bfdbfe' : '#86efac'}`,
          color: isNew ? '#1d4ed8' : '#15803d' }}>
          {isNew ? '🆕 신규' : '🔄 기존'}
        </span>
        <span style={{ fontSize:'11px', color:'#9ca3af' }}>
          {isNew ? '처음 등록하는 학생입니다' : `${careers.length}개 수강 이력 있음`}
        </span>
      </div>

      {/* 수강 이력 목록 */}
      {sorted.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
          {sorted.map((c, i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:600,
              background: i === sorted.length-1 ? '#fff7ed' : '#f9fafb',
              border: `1px solid ${i === sorted.length-1 ? '#fed7aa' : '#e5e7eb'}`,
              color: i === sorted.length-1 ? '#c2410c' : '#374151' }}>
              {c.label}
              {i === sorted.length-1 && <span style={{ fontSize:'10px', color:'#f97316' }}>현재</span>}
              <button onClick={() => onChange(careers.filter((_,j) => careers.indexOf(c) !== j))}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', lineHeight:1, padding:0, color:'inherit', opacity:0.5 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* 이전 수강 이력 추가 */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'11px', color:'#9ca3af', whiteSpace:'nowrap' }}>이력 추가:</span>
        <select style={sst} value={year} onChange={e => setYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div style={{ display:'flex', gap:'3px' }}>
          {[{v:'semester',l:'학기제'},{v:'quarter',l:'분기제'}].map(t => (
            <button key={t.v} type="button" onClick={() => { setTermType(t.v); setTerm('1') }}
              style={{ padding:'5px 9px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                border:`1.5px solid ${termType===t.v?'#f97316':'#e5e7eb'}`, background:termType===t.v?'#fff7ed':'#fff',
                color:termType===t.v?'#ea580c':'#374151', fontWeight:termType===t.v?700:400 }}>
              {t.l}
            </button>
          ))}
        </div>
        <select style={sst} value={term} onChange={e => setTerm(e.target.value)}>
          {termOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" onClick={add}
          style={{ padding:'6px 12px', borderRadius:'7px', border:'none', background:'#f97316', color:'#fff', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 추가
        </button>
      </div>
    </div>
  )
}

function RelationAdder({ relations, onChange }) {
  const [type, setType] = React.useState('쌍둥이')
  const [withName, setWithName] = React.useState('')
  const needsWith = true  // 모든 관계 유형에 대상 이름 입력

  const add = () => {
    if (!withName.trim()) return
    onChange([...relations, { type, with: withName.trim() }])
    setWithName('')
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={type} onChange={e => setType(e.target.value)}
        style={{ padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
        <option value="쌍둥이">쌍둥이</option>
        <option value="형제">형제</option>
        <option value="남매">남매</option>
        <option value="친척">친척</option>
      </select>
      <input
        value={withName}
        onChange={e => setWithName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && add()}
        placeholder="상대방 이름 입력"
        style={{ flex: 1, minWidth: '120px', padding: '7px 11px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}
      />
      <button type="button" onClick={add}
        style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#f97316', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
        + 추가
      </button>
    </div>
  )
}

// ✅ 대기자 자동 승격: 취소 발생 시 대기자 중 가장 먼저 신청한 학생을 applied로 자동 승격
function promoteNextWaiting(classId) {
  const waiting = StudentsDB.byClass(classId)
    .filter(s => s.status === 'waiting')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))  // 신청 순서대로 정렬

  if (waiting.length === 0) return null

  const next = waiting[0]
  StudentsDB.update(next.id, {
    status: 'applied',
    statusHistory: [...(next.statusHistory || []), {
      status: 'applied',
      changedAt: now(),
      memo: '대기자 자동 승격 (취소 발생)',
    }],
  })
  return next
}

export function Students({ user, onNav }) {
  const classes = ClassesDB.byTeacher(user.id)

  // 기존 '1학년' 형태 grade 데이터 → 숫자로 마이그레이션
  React.useEffect(() => {
    const all = StudentsDB.byTeacher(user.id)
    all.forEach(s => {
      if (s.grade && s.grade.includes('학년')) {
        StudentsDB.update(s.id, { grade: s.grade.replace('학년', '').trim() })
      }
    })
  }, [])

  const [ctxYear,    setCtxYear]    = useState('')
  const [ctxSchool,  setCtxSchool]  = useState('')
  const [ctxClass,   setCtxClass]   = useState('')
  const [ctxSection, setCtxSection] = useState('')

  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder,    setSortOrder]    = useState('name')

  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(emptyStudent())

  const [showExcel,    setShowExcel]    = useState(false)
  const [excelPreview, setExcelPreview] = useState([])
  const [excelStep,    setExcelStep]    = useState(0)
  const [excelClassId, setExcelClassId] = useState('')
  const fileRef = useRef()

  // ✅ 대기자 승격 알림 상태
  const [promotedName, setPromotedName] = useState(null)
  // ✅ 실시간 반영용 강제 리렌더 트리거
  const [tick, setTick] = useState(0)
  const [supplyItems,    setSupplyItems]    = useState([])
  const [supplyProducts, setSupplyProducts] = useState([])
  const [supplyProgress, setSupplyProgress] = useState([])
  const [supplyChecks,   setSupplyChecks]   = useState([])
  const [supplyPlans,    setSupplyPlans]    = useState([])
  // 진도 체크 모달
  const [progressModal,     setProgressModal]     = useState(false)
  const [progressStudent,   setProgressStudent]   = useState(null)
  const [progressProductId, setProgressProductId] = useState('')
  // 취소 모달
  const [cancelModal,  setCancelModal]  = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null) // { id, name, pendingStatus }
  const [cancelForm,   setCancelForm]   = useState({ type: 'before', date: '', memo: '' })
  const refresh = () => setTick(t => t + 1)

  // 현재 학기 자동 계산
  const getCurrentTerm = () => {
    const now2 = new Date()
    const y = String(now2.getFullYear())
    const m = now2.getMonth() + 1
    const term = m >= 3 && m <= 8 ? '1' : '2'
    return { year: y, termType: 'semester', term, label: `${y.slice(2)}년도 / 학기제 / ${term}학기` }
  }

  React.useEffect(() => {
    setSupplyItems(SupplyItems.byTeacher(user.id))
    setSupplyProducts(SupplyProducts.byTeacher(user.id))
    setSupplyProgress(SupplyStudentProgress.byTeacher(user.id))
    setSupplyChecks(SupplySessionChecks.byTeacher(user.id))
    setSupplyPlans(SupplyProductPlans.byTeacher(user.id))
  }, [tick])
  const { success: showToast, error: toastError } = useToast()
  // ✅ 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pendingStatuses, setPendingStatuses] = useState({})
  const [lastAddedId, setLastAddedId] = useState(null)
  const [addView, setAddView] = useState(false)
  const [pinned, setPinned] = useState({ classId: false, classNum: false, organization: false, className: false, section: false })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const years = [...new Set(classes.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const yearClasses = ctxYear ? classes.filter(c => c.startDate?.startsWith(ctxYear) || c.endDate?.startsWith(ctxYear)) : classes
  const schools = [...new Set(yearClasses.map(c => c.organization).filter(Boolean))]
  const filteredClasses = sortClasses(ctxSchool ? yearClasses.filter(c => c.organization === ctxSchool) : yearClasses)
  const sections = ctxClass
    ? [...new Set(classes.filter(c => c.id === ctxClass).map(c => c.section).filter(Boolean))]
    : []

  const allStudents = StudentsDB.byTeacher(user.id)
  const filtered = allStudents.filter(s => {
    if (ctxYear) {
      const inYear = yearClasses.some(c => s.classIds?.includes(c.id))
      if (!inYear) return false
    }
    if (ctxClass && !s.classIds?.includes(ctxClass)) return false
    if (ctxSchool && s.school !== ctxSchool) return false
    if (ctxSection && s.classNum !== ctxSection) return false
    if (statusFilter !== 'all' && s.status !== statusFilter && !(statusFilter === 'cancelled' && (s.status === 'cancel_before' || s.status === 'cancel_after'))) return false
    return true
  }).sort((a, b) => {
    // 정렬: 학교 → 수업/반 → 학년 → 반 → 번호 → 이름
    if (sortOrder === 'name') {
      const DAY_ORDER = ['월','화','수','목','금','토','일']
      // 학교
      const schoolCmp = (a.school || '').localeCompare(b.school || '', 'ko')
      if (schoolCmp !== 0) return schoolCmp
      // 요일
      const aClass = classes.find(c => c.id === a.classIds?.[0])
      const bClass = classes.find(c => c.id === b.classIds?.[0])
      const aDay = DAY_ORDER.indexOf(aClass?.days?.[0] ?? '')
      const bDay = DAY_ORDER.indexOf(bClass?.days?.[0] ?? '')
      const dayCmp = (aDay === -1 ? 99 : aDay) - (bDay === -1 ? 99 : bDay)
      if (dayCmp !== 0) return dayCmp
      // 수업 (첫 번째 classId 기준 className)
      const classCmp = (aClass?.className || '').localeCompare(bClass?.className || '', 'ko')
      if (classCmp !== 0) return classCmp
      // 반 (수업반)
      const sectionCmp = (aClass?.section || '').localeCompare(bClass?.section || '', 'ko')
      if (sectionCmp !== 0) return sectionCmp
      // 학년
      const gradeCmp = parseInt(a.grade || '0') - parseInt(b.grade || '0')
      if (gradeCmp !== 0) return gradeCmp
      // 학급 반
      const classNumCmp = parseInt(a.classNum || '0') - parseInt(b.classNum || '0')
      if (classNumCmp !== 0) return classNumCmp
      // 번호
      const numCmp = parseInt(a.number || '0') - parseInt(b.number || '0')
      if (numCmp !== 0) return numCmp
      // 이름
      return (a.name || '').localeCompare(b.name || '', 'ko')
    }
    // 요일순
    if (sortOrder === 'day') {
      const DAY_ORDER = ['월','화','수','목','금','토','일']
      const aClass = classes.find(c => c.id === a.classIds?.[0])
      const bClass = classes.find(c => c.id === b.classIds?.[0])
      const aDay = DAY_ORDER.indexOf(aClass?.days?.[0] ?? '')
      const bDay = DAY_ORDER.indexOf(bClass?.days?.[0] ?? '')
      const dayCmp = (aDay === -1 ? 99 : aDay) - (bDay === -1 ? 99 : bDay)
      if (dayCmp !== 0) return dayCmp
      // 같은 요일이면 학교 → 수업명 순
      const schoolCmp = (a.school || '').localeCompare(b.school || '', 'ko')
      if (schoolCmp !== 0) return schoolCmp
      return (aClass?.className || '').localeCompare(bClass?.className || '', 'ko')
    }
    // 신청순/최신순
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return sortOrder === 'asc' ? ta - tb : tb - ta
  })

  const ctxBase = allStudents.filter(s => {
    if (ctxYear) {
      const inYear = yearClasses.some(c => s.classIds?.includes(c.id))
      if (!inYear) return false
    }
    if (ctxClass && !s.classIds?.includes(ctxClass)) return false
    if (ctxSchool && s.school !== ctxSchool) return false
    if (ctxSection && s.classNum !== ctxSection) return false
    return true
  })
  const statusCounts = {
    all:       ctxBase.length,
    applied:   ctxBase.filter(s => s.status === 'applied').length,
    selected:  ctxBase.filter(s => s.status === 'selected').length,
    confirmed: ctxBase.filter(s => s.status === 'confirmed').length,
    waiting:   ctxBase.filter(s => s.status === 'waiting').length,   // ✅ 대기자 카운트 추가
    cancelled: ctxBase.filter(s => s.status === 'cancelled' || s.status === 'cancel_before' || s.status === 'cancel_after').length,
  }

  const openAdd = () => {
    const cls = classes.find(c => c.id === ctxClass)
    const curTerm = getCurrentTerm()
    setForm({
      ...emptyStudent(),
      student_careers: [curTerm],
      school: ctxSchool || cls?.organization || '',
      classIds: ctxClass ? [ctxClass] : (pinned.classId ? form.classIds : []),
      classNum: pinned.classNum ? form.classNum : (ctxSection || ''),
      _newOrganization: pinned.organization ? form._newOrganization : '',
      _newClassName:    pinned.className    ? form._newClassName    : '',
      _newSection:      pinned.section      ? form._newSection      : '',
    })
    setEditId(null)
    setShowModal(true)
  }

  const openEdit = (s) => {
    const cls = s.classIds?.length > 0 ? ClassesDB.byTeacher(user.id).find(c => c.id === s.classIds[0]) : null
    const existingCareers = s.student_careers || []
    const curT = getCurrentTerm()
    const alreadyHasCurrent = existingCareers.some(c => c.year === curT.year && c.termType === curT.termType && c.term === curT.term)
    const careersWithCurrent = alreadyHasCurrent ? existingCareers : [...existingCareers, curT]
    setForm({
      ...s, memo: s.memo || '', applyOrder: s.applyOrder || '', relations: s.relations || [], student_careers: careersWithCurrent,
      _newOrganization: cls?.organization || '',
      _newClassName:    cls?.className    || '',
      _newSection:      cls?.section      || '',
      _newTimeStart:    cls?.time         || '',
      _newTimeEnd:      cls?.timeEnd      || '',
      _newTermType:     cls?.termType     || 'semester',
      _newDays:         cls?.days         || [],
      _newRepeatType:   cls?.repeatType   || 'every',
      _newStartDate:    cls?.startDate    || '',
      _newEndDate:      cls?.endDate      || '',
    })
    setEditId(s.id)
    setShowModal(true)
  }

  // 진도 체크 헬퍼
  const getStudentChecks = (studentId, productId) =>
    supplyChecks.filter(c => c.studentId === studentId && c.productId === productId)
  const getProgress = (studentId, productId) =>
    supplyProgress.find(p => p.studentId === studentId && p.productId === productId)
  const toggleCheck = (studentId, productId, stage, sessionNo) => {
    const classId = supplyItems.find(i => i.studentId === studentId)?.classId || ''
    const existing = supplyChecks.find(c => c.studentId===studentId && c.productId===productId && c.stage===stage && c.sessionNo===sessionNo)
    if (existing) SupplySessionChecks.delete(existing.id)
    else SupplySessionChecks.upsert({ id: uid(), teacherId: user.id, studentId, classId, productId, stage, sessionNo, checkedAt: now(), createdAt: now() })
    const allStageChecks = SupplySessionChecks.byProductStudent(productId, studentId, classId).filter(c => c.stage === stage)
    const maxSession = allStageChecks.length > 0 ? Math.max(...allStageChecks.map(c => c.sessionNo)) : 1
    SupplyStudentProgress.upsert({ id: uid(), teacherId: user.id, studentId, classId, productId, curStage: stage, curSession: maxSession, updatedAt: now(), createdAt: now() })
    setSupplyChecks(SupplySessionChecks.byTeacher(user.id))
    setSupplyProgress(SupplyStudentProgress.byTeacher(user.id))
  }

  const save = () => {
    if (!form.name.trim() || !form.grade) { toastError('이름과 학년은 필수입니다.'); return }

    let classIds = [...(form.classIds || [])]

    // 수업 미선택 + 수업명 직접 입력 없음 → 경고
    if (classIds.length === 0 && !form._newClassName?.trim()) {
      toastError('수업을 선택하거나 수업명을 입력해주세요.\n수업이 없으면 출석부에서 학생을 찾을 수 없습니다.')
      return
    }

    // 수업 미선택 + 수업명 직접 입력 → 수업 자동 생성
    if (classIds.length === 0 && form._newClassName?.trim()) {
      const org = form._newOrganization?.trim() || ''
      const existing = ClassesDB.byTeacher(user.id).find(c =>
        c.organization === org &&
        c.className === form._newClassName.trim() &&
        (!form._newSection || c.section === form._newSection.trim())
      )
      if (existing) {
        classIds = [existing.id]
      } else {
        const timeStr = form._newTimeStart
          ? (form._newTimeEnd ? `${form._newTimeStart}~${form._newTimeEnd}` : form._newTimeStart)
          : ''
        const newCls = {
          id: uid(), teacherId: user.id,
          organization: org,
          className: form._newClassName.trim(),
          section: form._newSection?.trim() || '',
          termType: form._newTermType || 'semester',
          days: form._newDays || [],
          repeatType: form._newRepeatType || 'every',
          time: form._newTimeStart || '',
          timeEnd: form._newTimeEnd || '',
          startDate: form._newStartDate || new Date().toISOString().slice(0, 10),
          endDate: form._newEndDate || new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
          cancelledDates: [], description: '', promotionImgs: [], templateFile: null,
          createdAt: now(),
        }
        ClassesDB.insert(newCls)
        classIds = [newCls.id]
      }
      if (!form.school && org) form.school = org
    }

    // 수업 선택된 경우 학교명 자동 동기화
    if (classIds.length > 0 && !form.school) {
      const cls = ClassesDB.byTeacher(user.id).find(c => c.id === classIds[0])
      if (cls?.organization) form.school = cls.organization
    }

    const saveData = { ...form, classIds }
    delete saveData._newOrganization; delete saveData._newClassName; delete saveData._newSection
    delete saveData._newTimeStart; delete saveData._newTimeEnd
    delete saveData._newTermType; delete saveData._newDays; delete saveData._newRepeatType
    delete saveData._newStartDate; delete saveData._newEndDate

    if (editId) {
      if (saveData.status === 'cancelled' && !saveData.cancel_info) {
        // 취소 모달 먼저
        StudentsDB.update(editId, saveData)
        setShowModal(false)
        setCancelTarget({ id: editId, name: saveData.name })
        setCancelForm({ type: 'before', date: new Date().toISOString().slice(0,10), memo: '' })
        setCancelModal(true)
        refresh()
      } else {
        StudentsDB.update(editId, saveData)
        setShowModal(false)
        refresh()
        showToast('수정이 완료되었습니다.')
      }
    } else {
      const newId = uid()
      StudentsDB.insert({
        id: newId, teacherId: user.id, ...saveData,
        statusHistory: [{ status: saveData.status, changedAt: now(), memo: '' }],
        createdAt: now(),
      })
      setLastAddedId(newId)
      setTimeout(() => setLastAddedId(null), 3000)
      // 고정값 유지하면서 폼 초기화
      const nextClassIds      = pinned.classId      ? saveData.classIds                              : []
      const nextSchool        = pinned.classId      ? saveData.school                                : ''
      const nextClassNum      = pinned.classNum     ? saveData.classNum                              : ''
      const nextOrganization  = pinned.organization ? saveData._newOrganization || form._newOrganization : ''
      const nextClassName     = pinned.className    ? saveData._newClassName    || form._newClassName    : ''
      const nextSection       = pinned.section      ? saveData._newSection      || form._newSection      : ''
      setForm({
        ...emptyStudent(),
        classIds: nextClassIds, school: nextSchool, classNum: nextClassNum,
        _newOrganization: nextOrganization,
        _newClassName: nextClassName,
        _newSection: nextSection,
      })
      refresh()
      showToast(`${saveData.name} 등록 완료!`)
    }
  }

  // ✅ 상태 변경 시 대기자 자동 승격 처리
  const changeStatus = (id, status) => {
    const s = StudentsDB.find(id)
    const prevStatus = s.status
    StudentsDB.update(id, {
      status,
      statusHistory: [...(s.statusHistory || []), { status, changedAt: now(), memo: '' }],
    })

    // 취소/대기자로 변경 시 → 대기자 자동 승격
    if ((prevStatus === 'applied' || prevStatus === 'selected' || prevStatus === 'confirmed') &&
        (status === 'cancelled' || status === 'cancel_before' || status === 'cancel_after')) {
      const classIds = s.classIds || []
      classIds.forEach(cid => {
        const promoted = promoteNextWaiting(cid)
        if (promoted) {
          setPromotedName(promoted.name)
          setTimeout(() => setPromotedName(null), 4000)
        }
      })
    }
    refresh() // ✅ 즉시 리렌더
    showToast('수정이 완료되었습니다.')
  }

  const deleteStudent = () => {
    if (!deleteTarget) return
    StudentsDB.delete(deleteTarget.id)
    setDeleteTarget(null)
    refresh()
    showToast('삭제가 완료되었습니다.')
  }

  // ─── 엑셀 파싱 (단일 방식: 6컬럼)
  // 학년 | 학급반 | 번호 | 이름 | 학부모전화 | 학생전화
  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      // 헤더 행 찾기: '학년' 또는 '이름'이 포함된 행을 헤더로 판단, 그 다음부터 데이터
      let startRow = 0
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const cell0 = String(rows[i]?.[0] || '').trim()
        const cell3 = String(rows[i]?.[3] || '').trim()
        if (cell0.includes('학년') || cell3.includes('이름')) {
          startRow = i + 1
          break
        }
      }
      const dataRows = rows.slice(startRow)

      // 안내 문구 행 및 빈 행 필터링
      // 이름(r[3])이 있고, '★', '←', '※', '필수', '입력' 등 안내 텍스트가 아닌 행만 통과
      const skipPatterns = ['★', '←', '※', '필수', '입력', '삭제', '안내', '학부모']
      const parsed = dataRows
        .filter(r => {
          const name = String(r[3] || '').trim()
          if (!name) return false
          if (skipPatterns.some(p => name.includes(p))) return false
          return true
        })
        .map(r => ({
          grade:        String(r[0] || '').trim(),
          classNum:     String(r[1] || '').trim(),
          number:       String(r[2] || '').trim(),
          name:         String(r[3] || '').trim(),
          parentPhone:  String(r[4] || '').trim(),
          studentPhone: String(r[5] || '').trim(),
        }))

      if (parsed.length === 0) { toastError('등록할 학생 데이터가 없습니다.\n샘플 파일을 확인해주세요.'); return }

      // 중복 체크: 같은 수업 내 이름+학년+반 동일한 기존 학생
      // grade, classNum 정규화: '1학년'→'1', '1반'→'1' 로 통일 후 비교
      const normalize = v => String(v || '').trim().replace(/학년|반/g, '')
      const selCls = classes.find(c => c.id === excelClassId)
      const existingStudents = StudentsDB.byTeacher(user.id).filter(s =>
        s.classIds?.includes(excelClassId)
      )

      const withDupFlag = parsed.map(r => {
        const isDup = existingStudents.some(s =>
          s.name === r.name &&
          normalize(s.grade) === normalize(r.grade) &&
          normalize(s.classNum) === normalize(r.classNum)
        )
        return { ...r, _dup: isDup, _checked: !isDup }
      })

      setExcelPreview(withDupFlag); setExcelStep(2)
    } catch { toastError('파일을 읽을 수 없습니다.') }
  }

  const downloadSample = () => {
    const selCls = classes.find(c => c.id === excelClassId)
    if (!selCls) { toastError('먼저 수업을 선택해주세요.'); return }

    import('xlsx').then(XLSX => {
      const schoolName  = selCls.organization || ''
      const subjectName = selCls.className + (selCls.section ? ' ' + selCls.section + '반' : '')
      const timeStr     = selCls.time ? selCls.time : ''
      const daysStr     = (selCls.days || []).join(', ')

      const rows = [
        // 수업 정보 안내 (읽기 전용 참고용)
        [`학교: ${schoolName}`, `과목: ${subjectName}`, `요일: ${daysStr}`, `시간: ${timeStr}`, '', ''],
        ['※ 위 정보는 자동 적용됩니다. 아래 학생 정보만 입력하세요.', '', '', '', '', ''],
        [''],
        ['학년(숫자만)', '학급반(예:2)', '번호', '이름 ★필수', '학부모전화번호', '학생전화번호'],
        ['← 이 행을 삭제하고 학생 정보를 입력하세요', '', '', '', '', ''],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{wch:8},{wch:8},{wch:6},{wch:14},{wch:16},{wch:16}]
      // 안내행 색상 (회색 배경)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '학생목록')
      XLSX.writeFile(wb, `${schoolName}_${subjectName}_학생등록샘플.xlsx`)
    })
  }

  const importExcel = () => {
    const selCls = classes.find(c => c.id === excelClassId)
    const toInsert = excelPreview.filter(r => r._checked !== false)

    toInsert.forEach(row => {
      StudentsDB.insert({
        id: uid(), teacherId: user.id,
        school:       selCls?.organization || '',
        grade:        row.grade,
        classNum:     row.classNum,
        number:       row.number,
        name:         row.name,
        parentPhone:  row.parentPhone,
        studentPhone: row.studentPhone,
        classIds:     excelClassId ? [excelClassId] : [],
        status: 'applied', memo: '',
        statusHistory: [{ status: 'applied', changedAt: now(), memo: '엑셀 일괄 등록' }],
        createdAt: now(),
      })
    })

    const skipped = excelPreview.length - toInsert.length
    const msg = skipped > 0
      ? `${toInsert.length}명 등록 완료! (${skipped}명 제외)`
      : `${toInsert.length}명 등록 완료!`
    showToast(msg)
    setShowExcel(false); setExcelPreview([]); setExcelStep(0); setExcelClassId('')
    refresh()
  }

  const selectedCls = classes.find(c => c.id === ctxClass)

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader
        title="학생 관리"
        sub="학교 · 과목 · 반을 먼저 선택하고 학생을 관리하세요."
        right={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn variant="ghost" onClick={() => { setExcelStep(0); setExcelClassId(''); setShowExcel(true) }}>📊 엑셀 업로드</Btn>
            <Btn variant="ghost" onClick={() => onNav('confirm')}>✅ 최종 확정</Btn>
            <Btn onClick={openAdd}>+ 학생 등록</Btn>
          </div>
        }
      />

      {/* ✅ 대기자 자동 승격 알림 토스트 */}
      {promotedName && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: '#16a34a', color: '#fff', padding: '14px 20px',
          borderRadius: '12px', fontSize: '14px', fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn 0.2s ease',
        }}>
          🎉 대기자 <strong>{promotedName}</strong>님이 자동으로 신청 대기열로 승격되었습니다!
        </div>
      )}

      {/* 컨텍스트 선택 바 */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginBottom: '10px', letterSpacing: '0.05em' }}>📍 학생 보기 범위 선택</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>년도</label>
            <select value={ctxYear} onChange={e => { setCtxYear(e.target.value); setCtxSchool(''); setCtxClass(''); setCtxSection('') }} style={selSt}>
              <option value="">전체 년도</option>
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>학교</label>
            <select value={ctxSchool} onChange={e => { setCtxSchool(e.target.value); setCtxClass(''); setCtxSection('') }} style={selSt}>
              <option value="">전체 학교</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>과목</label>
            <select value={ctxClass} onChange={e => { setCtxClass(e.target.value); setCtxSection('') }} style={selSt}>
              <option value="">전체 과목</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>{c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
              ))}
            </select>
          </div>
          {sections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>반</label>
              <select value={ctxSection} onChange={e => setCtxSection(e.target.value)} style={selSt}>
                <option value="">전체 반</option>
                {sections.map(s => <option key={s} value={s}>{s}반</option>)}
              </select>
            </div>
          )}
          {(ctxYear || ctxSchool || ctxClass) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1px' }}>
              {ctxYear && <Tag color="#059669" bg="#ecfdf5" size="md">📅 {ctxYear}년</Tag>}
              {ctxSchool && <Tag color="#3b82f6" bg="#eff6ff" size="md">🏫 {ctxSchool}</Tag>}
              {ctxClass && selectedCls && <Tag color="#f97316" bg="#fff7ed" size="md">📚 {selectedCls.className}</Tag>}
              {ctxSection && <Tag color="#8b5cf6" bg="#f5f3ff" size="md">📋 {ctxSection}반</Tag>}
              <button onClick={() => { setCtxYear(''); setCtxSchool(''); setCtxClass(''); setCtxSection('') }}
                style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>초기화</button>
            </div>
          )}
        </div>
      </div>

      {/* 상태 필터 + 정렬 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: `전체 ${statusCounts.all}` },
            { key: 'applied',   label: `신청 ${statusCounts.applied}` },
            { key: 'waiting',   label: `대기 ${statusCounts.waiting}` },    // ✅ 대기 필터 추가
            { key: 'selected',  label: `추첨완료 ${statusCounts.selected}` },
            { key: 'confirmed', label: `확정 ${statusCounts.confirmed}` },
            { key: 'cancelled', label: `취소 ${statusCounts.cancelled}` },  // cancelled + cancel_before + cancel_after
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: statusFilter === f.key ? '#f97316' : '#f3f4f6',
              color: statusFilter === f.key ? '#fff' : '#374151',
              fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
              fontWeight: statusFilter === f.key ? 600 : 400, transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setSortOrder('name')} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: sortOrder === 'name' ? 700 : 400, background: sortOrder === 'name' ? '#18181b' : '#f3f4f6', color: sortOrder === 'name' ? '#fff' : '#374151', transition: 'all .15s' }}>학교·수업순</button>
          <button onClick={() => setSortOrder('day')} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: sortOrder === 'day' ? 700 : 400, background: sortOrder === 'day' ? '#18181b' : '#f3f4f6', color: sortOrder === 'day' ? '#fff' : '#374151', transition: 'all .15s' }}>요일순</button>
          <button onClick={() => setSortOrder('asc')} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: sortOrder === 'asc' ? 700 : 400, background: sortOrder === 'asc' ? '#18181b' : '#f3f4f6', color: sortOrder === 'asc' ? '#fff' : '#374151', transition: 'all .15s' }}>신청순 ↑</button>
          <button onClick={() => setSortOrder('desc')} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: sortOrder === 'desc' ? 700 : 400, background: sortOrder === 'desc' ? '#18181b' : '#f3f4f6', color: sortOrder === 'desc' ? '#fff' : '#374151', transition: 'all .15s' }}>최신순 ↓</button>
        </div>
      </div>

      {/* 학생 테이블 */}
      {filtered.length === 0 ? (
        <EmptyState icon="👥" title="학생이 없습니다" desc="학생을 등록하거나 필터를 변경하세요." />
      ) : (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['순번', '학교', '수업 · 반', '학년 / 반 / 번호', '이름', '학부모 전화', '상태', '진도', '메모', '작업'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const displayStatus = pendingStatuses[s.id] ?? s.status
                const cancelCfg = { color:'#dc2626', bg:'#fef2f2', label: displayStatus==='cancel_after'?'개강후 취소':'개강전 취소' }
                const cfg = (displayStatus==='cancel_before'||displayStatus==='cancel_after') ? cancelCfg : (STUDENT_STATUS[displayStatus] || {})
                const sClasses = (s.classIds || []).map(cid => {
                  const cls = classes.find(c => c.id === cid)
                  if (!cls) return null
                  return cls.className + (cls.section ? ' ' + cls.section + '반' : '')
                }).filter(Boolean)

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: s.id === lastAddedId ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#fafafa', outline: s.id === lastAddedId ? '2px solid #f97316' : 'none', transition: 'background 1s, outline 1s' }}>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#9ca3af', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {s.applyOrder
                        ? <span style={{ fontWeight: 700, color: '#f97316', background: '#fff7ed', padding: '2px 7px', borderRadius: '5px', border: '1px solid #fed7aa' }}>{s.applyOrder}</span>
                        : <span style={{ color: '#d1d5db' }}>-</span>
                      }
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{s.school}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {sClasses.map(c => <Tag key={c} color="#6b7280" bg="#f3f4f6">{c}</Tag>)}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      <span>{s.grade ? s.grade+'학년' : '-'}</span>
                      {s.classNum && <span style={{ marginLeft: '4px', padding: '1px 7px', borderRadius: '5px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '12px' }}>{s.classNum}반</span>}
                      {s.number && <span style={{ marginLeft: '4px', color: '#9ca3af', fontSize: '12px' }}>{s.number}번</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                      <div>{s.name}</div>
                      {(s.remark || (s.student_careers?.length > 0) || s.status === 'cancel_before' || s.status === 'cancel_after' || (s.relations||[]).length > 0) && (
                        <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginTop:'4px' }}>
                          {s.remark && (
                            <span style={{ fontSize:'11px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{s.remark}</span>
                          )}
                          {(s.student_careers?.length > 0) && (
                            <span style={{ fontSize:'11px', fontWeight:700, padding:'1px 7px', borderRadius:'5px',
                              background: s.student_careers.length <= 1 ? '#eff6ff' : '#f0fdf4',
                              border: `1px solid ${s.student_careers.length <= 1 ? '#bfdbfe' : '#86efac'}`,
                              color: s.student_careers.length <= 1 ? '#1d4ed8' : '#15803d' }}>
                              {s.student_careers.length <= 1 ? '신규' : '기존'}
                            </span>
                          )}
                          {(s.status === 'cancel_before' || s.status === 'cancel_after') && (
                            <span style={{ fontSize:'11px', fontWeight:700, padding:'1px 8px', borderRadius:'5px',
                              background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>
                              {s.status === 'cancel_after' ? '개강후 취소' : '개강전 취소'}
                            </span>
                          )}
                          {(s.relations||[]).map((r, i) => (
                            <span key={i} style={{ fontSize:'11px', fontWeight:600, padding:'1px 7px', borderRadius:'5px',
                              background: r.type === '쌍둥이' ? '#fdf4ff' : r.type === '형제' ? '#eff6ff' : r.type === '남매' ? '#f0fdf4' : '#fff7ed',
                              border: `1px solid ${r.type === '쌍둥이' ? '#e9d5ff' : r.type === '형제' ? '#bfdbfe' : r.type === '남매' ? '#86efac' : '#fed7aa'}`,
                              color: r.type === '쌍둥이' ? '#7e22ce' : r.type === '형제' ? '#1d4ed8' : r.type === '남매' ? '#15803d' : '#c2410c',
                            }}>
                              {r.type}{r.with ? ` · ${r.with}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtPhone(s.parentPhone) || '-'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', flexDirection:'column', gap: '6px' }}>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <select value={displayStatus} onChange={e => {
                            const v = e.target.value
                            setPendingStatuses(p => ({...p, [s.id]: v}))
                            if (v === 'cancel_before' || v === 'cancel_after') {
                              setCancelTarget({ id: s.id, name: s.name, status: v })
                              setCancelForm({ type: v === 'cancel_after' ? 'after' : 'before', date: new Date().toISOString().slice(0,10), memo: '' })
                            }
                          }}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${cfg.color}50`, background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer', outline: 'none' }}>
                            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            <option value='cancel_before'>개강전 취소</option>
                            <option value='cancel_after'>개강후 취소</option>
                          </select>
                          {pendingStatuses[s.id] !== undefined && pendingStatuses[s.id] !== s.status &&
                           pendingStatuses[s.id] !== 'cancel_before' && pendingStatuses[s.id] !== 'cancel_after' && (
                            <Btn size="sm" onClick={() => {
                              changeStatus(s.id, pendingStatuses[s.id])
                              setPendingStatuses(p => { const n={...p}; delete n[s.id]; return n })
                            }}>저장</Btn>
                          )}
                        </div>
                        {/* 취소 선택 시 인라인 날짜+메모 입력 */}
                        {cancelTarget?.id === s.id && (pendingStatuses[s.id] === 'cancel_before' || pendingStatuses[s.id] === 'cancel_after') && (
                          <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'8px 10px', background:'#fef2f2', borderRadius:'8px', border:'1px solid #fca5a5' }}>
                            <input type="date" value={cancelForm.date} onChange={e => setCancelForm(f=>({...f, date:e.target.value}))}
                              style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid #fca5a5', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }} />
                            <textarea value={cancelForm.memo} onChange={e => setCancelForm(f=>({...f, memo:e.target.value}))}
                              placeholder="취소 사유 (선택)"
                              rows={2}
                              style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid #fca5a5', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', resize:'none', background:'#fff' }} />
                            <div style={{ display:'flex', gap:'5px' }}>
                              <button onClick={() => {
                                const st = StudentsDB.find(s.id)
                                StudentsDB.update(s.id, {
                                  status: pendingStatuses[s.id],
                                  cancel_info: { type: cancelForm.type, date: cancelForm.date, memo: cancelForm.memo },
                                  statusHistory: [...(st?.statusHistory||[]), { status: pendingStatuses[s.id], changedAt: now(), memo: `[${cancelForm.type==='after'?'개강후':'개강전'} 취소] ${cancelForm.date}${cancelForm.memo?' - '+cancelForm.memo:''}` }],
                                })
                                const cids = st?.classIds||[]
                                cids.forEach(cid => { const p=promoteNextWaiting(cid); if(p){setPromotedName(p.name);setTimeout(()=>setPromotedName(null),4000)} })
                                setPendingStatuses(p=>{const n={...p};delete n[s.id];return n})
                                setCancelTarget(null)
                                refresh()
                                showToast('취소 처리가 완료되었습니다.')
                              }} style={{ flex:1, padding:'5px', borderRadius:'6px', border:'none', background:'#dc2626', color:'#fff', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>확인</button>
                              <button onClick={() => { setPendingStatuses(p=>{const n={...p};delete n[s.id];return n}); setCancelTarget(null) }}
                                style={{ padding:'5px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const item = supplyItems.find(i => i.studentId === s.id && i.classId === (s.classIds?.[0] || ''))
                        if (!item?.productId) return <span style={{ fontSize:'12px', color:'#d1d5db' }}>-</span>
                        const prod = supplyProducts.find(p => p.id === item.productId)
                        const prog = supplyProgress.find(p => p.studentId === s.id && p.productId === item.productId)
                        const curStage = prog?.curStage || item.stage || 1
                        const spp = prod?.sessionsPerStage || 12
                        const checked = supplyChecks.filter(c => c.studentId === s.id && c.productId === item.productId && c.stage === curStage).length
                        const pct = Math.min(Math.round(checked / spp * 100), 100)
                        return (
                          <div onClick={() => { setProgressStudent(s); setProgressProductId(item.productId); setProgressModal(true) }}
                            style={{ fontSize:'12px', minWidth:'80px', cursor:'pointer', padding:'4px 6px', borderRadius:'6px', transition:'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                            <div style={{ fontWeight:600, color:'#374151' }}>{prod?.name || item.name}</div>
                            <div style={{ color:'#6b7280', marginTop:'1px' }}>{curStage}단계 {checked}/{spp}차시</div>
                            <div style={{ height:'4px', background:'#e5e7eb', borderRadius:'2px', marginTop:'3px', width:'80px' }}>
                              <div style={{ height:'100%', borderRadius:'2px', width:`${pct}%`, transition:'width .3s',
                                background: pct >= 100 ? '#16a34a' : pct >= 80 ? '#f59e0b' : '#f97316' }} />
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '11px 14px', maxWidth: '160px' }}>
                      {s.memo
                        ? <span style={{ fontSize: '12px', color: '#374151', background: '#fffbeb', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📌 {s.memo}</span>
                        : <span style={{ fontSize: '12px', color: '#d1d5db' }}>-</span>
                      }
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>편집</Btn>
                        <Btn size="sm" variant="outlineDanger" onClick={() => setDeleteTarget({ id: s.id, name: s.name })}>삭제</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 학생 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '학생 정보 편집' : '학생 등록'} width={580}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* ══ 위쪽: 수업 정보 ══ */}
          <div style={{ background: '#fffbf5', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '16px 18px', marginBottom: '2px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', marginBottom: '12px', letterSpacing: '0.05em' }}>📚 수업 정보</div>

            {/* 등록된 수업 선택 버튼 */}
            {classes.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#ea580c', fontWeight: 600 }}>📚 수강할 수업 선택 <span style={{ color: '#ef4444' }}>*필수</span> (복수 선택 가능)</div>
                  {!editId && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: pinned.classId ? '#f97316' : '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={pinned.classId} onChange={e => setPinned(p => ({ ...p, classId: e.target.checked }))}
                        style={{ accentColor: '#f97316', width: '14px', height: '14px', cursor: 'pointer' }} />
                      🔒 고정
                    </label>
                  )}
                </div>
                <select
                  value={form.classIds?.[0] || ''}
                  onChange={e => {
                    const cid = e.target.value
                    const cls = ClassesDB.byTeacher(user.id).find(c => c.id === cid)
                    set('classIds', cid ? [cid] : [])
                    if (cls?.organization) set('school', cls.organization)
                  }}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', color:'#111827', outline:'none', cursor:'pointer' }}>
                  <option value=''>{editId ? '-- 수업 변경 또는 선택 해제 후 직접 입력 --' : '-- 수업 선택 --'}</option>
                  {[...classes].sort((a,b) => {
                    const DAY=['월','화','수','목','금','토','일']
                    const aDay=DAY.indexOf(a.days?.[0]??''); const bDay=DAY.indexOf(b.days?.[0]??'')
                    const d=(aDay===-1?99:aDay)-(bDay===-1?99:bDay)
                    if(d!==0) return d
                    return (a.organization||'').localeCompare(b.organization||'','ko')
                  }).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.organization} · {c.className}{c.section ? ' '+c.section+'반' : ''} {c.days?.length ? '('+c.days.join('')+' '+c.time+')' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 수업 직접 입력 — 등록/편집 모두 표시 */}
            {(
              <div style={{ borderTop: classes.length > 0 ? '1px dashed #fcd34d' : 'none', paddingTop: classes.length > 0 ? '12px' : '0' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
                  {classes.length > 0
                    ? '— 또는 새 수업 정보 직접 입력 (저장 시 수업 자동 등록) —'
                    : '수업 정보를 입력하면 저장 시 수업이 자동으로 등록됩니다.'}
                </div>
                {/* 학교명 / 수업명 / 반 — 기존 데이터 드롭다운 + 직접입력 병행 */}
                {(() => {
                  const allClasses = ClassesDB.byTeacher(user.id)
                  const DAY=['월','화','수','목','금','토','일']
                  const orgMinDay = (org) => { const d=allClasses.filter(c=>c.organization===org).map(c=>DAY.indexOf(c.days?.[0]??'')).filter(i=>i!==-1); return d.length?Math.min(...d):99 }
                  const orgs = [...new Set(allClasses.map(c => c.organization).filter(Boolean))].sort((a,b)=>orgMinDay(a)-orgMinDay(b)||a.localeCompare(b,'ko'))
                  const classNames = [...new Set(allClasses.filter(c => !form._newOrganization || c.organization === form._newOrganization).map(c => c.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))
                  const sections  = [...new Set(allClasses.filter(c => (!form._newOrganization || c.organization === form._newOrganization) && (!form._newClassName || c.className === form._newClassName)).map(c => c.section).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))

                  const autoMatch = (org, cls, sec) => {
                    const matched = allClasses.find(c => c.organization === org && c.className === cls && (c.section||'') === (sec||''))
                    if (matched) { set('classIds', [matched.id]); set('school', matched.organization) }
                    else set('classIds', [])
                  }
                  const selSt = { width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }
                  return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                      <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>단체명(학교명)</label>
                      {!editId && <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color: pinned.organization?'#f97316':'#9ca3af', cursor:'pointer' }}>
                        <input type="checkbox" checked={pinned.organization} onChange={e => setPinned(p=>({...p, organization:e.target.checked}))} style={{ accentColor:'#f97316', width:'12px', height:'12px', cursor:'pointer' }} />🔒
                      </label>}
                    </div>
                    <select style={selSt} value={form._newOrganization} onChange={e => { set('_newOrganization', e.target.value); set('_newClassName',''); set('_newSection',''); set('classIds',[]); }}>
                      <option value=''>-- 선택 --</option>
                      {orgs.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={form._newOrganization} onChange={e => { set('_newOrganization', e.target.value); autoMatch(e.target.value, form._newClassName, form._newSection) }} placeholder="또는 직접 입력"
                      style={{ ...selSt, marginTop:'4px', fontSize:'12px', padding:'6px 10px', color:'#6b7280' }} />
                  </div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                      <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>수업명(과목)</label>
                      {!editId && <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color: pinned.className?'#f97316':'#9ca3af', cursor:'pointer' }}>
                        <input type="checkbox" checked={pinned.className} onChange={e => setPinned(p=>({...p, className:e.target.checked}))} style={{ accentColor:'#f97316', width:'12px', height:'12px', cursor:'pointer' }} />🔒
                      </label>}
                    </div>
                    <select style={selSt} value={form._newClassName} onChange={e => { set('_newClassName', e.target.value); set('_newSection',''); autoMatch(form._newOrganization, e.target.value, '') }}>
                      <option value=''>-- 선택 --</option>
                      {classNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input value={form._newClassName} onChange={e => { set('_newClassName', e.target.value); autoMatch(form._newOrganization, e.target.value, form._newSection) }} placeholder="또는 직접 입력"
                      style={{ ...selSt, marginTop:'4px', fontSize:'12px', padding:'6px 10px', color:'#6b7280' }} />
                  </div>
                </div>
                  )
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  {(() => {
                    const allClasses = ClassesDB.byTeacher(user.id)
                    const sections = [...new Set(allClasses.filter(c => (!form._newOrganization || c.organization === form._newOrganization) && (!form._newClassName || c.className === form._newClassName)).map(c => c.section).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))
                    const autoMatch = (sec) => {
                      const matched = allClasses.find(c => c.organization === form._newOrganization && c.className === form._newClassName && (c.section||'') === (sec||''))
                      if (matched) { set('classIds', [matched.id]); set('school', matched.organization) }
                      else set('classIds', [])
                    }
                    const selSt = { width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }
                    return (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                      <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>반 (선택)</label>
                      {!editId && <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color: pinned.section?'#f97316':'#9ca3af', cursor:'pointer' }}>
                        <input type="checkbox" checked={pinned.section} onChange={e => setPinned(p=>({...p, section:e.target.checked}))} style={{ accentColor:'#f97316', width:'12px', height:'12px', cursor:'pointer' }} />🔒
                      </label>}
                    </div>
                    {sections.length > 0 && (
                      <select style={selSt} value={form._newSection} onChange={e => { set('_newSection', e.target.value); autoMatch(e.target.value) }}>
                        <option value=''>-- 선택 --</option>
                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    <input value={form._newSection} onChange={e => { set('_newSection', e.target.value); autoMatch(e.target.value) }} placeholder={sections.length > 0 ? "또는 직접 입력" : "직접 입력"}
                      style={{ ...selSt, marginTop: sections.length > 0 ? '4px' : '0', fontSize:'12px', padding:'6px 10px', color:'#6b7280' }} />
                  </div>
                    )
                  })()}
                  <Input label="수업 시작시간 (선택)" value={form._newTimeStart} onChange={v => set('_newTimeStart', v)} placeholder="14:00" />
                  <Input label="종료시간 (선택)" value={form._newTimeEnd} onChange={v => set('_newTimeEnd', v)} placeholder="15:00" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>수업 운영방식</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{value:'semester',label:'학기제'},{value:'quarter',label:'분기제'}].map(t => (
                        <button key={t.value} type="button" onClick={() => set('_newTermType', t.value)}
                          style={{ flex:1, padding:'7px', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', border:`1.5px solid ${form._newTermType===t.value?'#f97316':'#e5e7eb'}`, background:form._newTermType===t.value?'#fff7ed':'#fff', color:form._newTermType===t.value?'#ea580c':'#374151', fontWeight:form._newTermType===t.value?700:400 }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>반복 패턴</div>
                    <select value={form._newRepeatType} onChange={e => set('_newRepeatType', e.target.value)}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
                      {[{value:'every',label:'매주'},{value:'biweekly',label:'격주'},{value:'monthly_first',label:'매월 첫째주'},{value:'monthly_second',label:'매월 둘째주'},{value:'monthly_third',label:'매월 셋째주'},{value:'monthly_fourth',label:'매월 넷째주'}].map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>수업 요일</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {DAYS.map(d => {
                      const sel = (form._newDays || []).includes(d)
                      return (
                        <button key={d} type="button"
                          onClick={() => set('_newDays', sel ? (form._newDays||[]).filter(x=>x!==d) : [...(form._newDays||[]),d])}
                          style={{ width:'32px', height:'32px', borderRadius:'6px', border:`1.5px solid ${sel?'#f97316':'#e5e7eb'}`, background:sel?'#f97316':'#fff', color:sel?'#fff':'#374151', fontSize:'12px', fontWeight:sel?700:400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Input label="수업 시작일" value={form._newStartDate} onChange={v => set('_newStartDate', v)} type="date" />
                  <Input label="수업 종료일" value={form._newEndDate} onChange={v => set('_newEndDate', v)} type="date" />
                </div>
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>학생 정보</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          </div>

          {/* ══ 아래쪽: 학생 정보만 ══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
              <Select label="학년" value={form.grade} onChange={v => set('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} required />
              <Input label="학급 반" value={form.classNum} onChange={v => set('classNum', v)} />
              <Input label="번호" value={form.number} onChange={v => set('number', v)} />
              <Input label="이름" value={form.name} onChange={v => set('name', v)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <Input label="신청 순번" value={form.applyOrder} onChange={v => set('applyOrder', v)} />
              <Input label="학부모 전화번호" value={form.parentPhone} onChange={v => set('parentPhone', v)} />
              <Input label="학생 전화번호" value={form.studentPhone} onChange={v => set('studentPhone', v)} />
            </div>
            <Textarea label="📌 특이사항 메모" value={form.memo} onChange={v => set('memo', v)} rows={2} />

            {/* 비고 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>📋 비고</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={form.remark === '' || ['늘봄', '돌봄', '기타'].includes(form.remark) ? form.remark : '직접입력'}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '직접입력') set('remark', '')
                    else set('remark', v)
                  }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                  <option value="">없음</option>
                  <option value="늘봄">늘봄</option>
                  <option value="돌봄">돌봄</option>
                  <option value="기타">기타</option>
                  <option value="직접입력">직접입력</option>
                </select>
                {(form.remark !== '' && !['늘봄', '돌봄', '기타'].includes(form.remark)) && (
                  <input
                    value={form.remark}
                    onChange={e => set('remark', e.target.value)}
                    placeholder="직접 입력"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}
                  />
                )}
                {form.remark && (
                  <span style={{ fontSize: '12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 10px', fontWeight: 600 }}>
                    {form.remark}
                  </span>
                )}
              </div>
            </div>

            {/* 경력 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '8px' }}>📅 학생 경력</label>
              <CareerAdder careers={form.student_careers || []} onChange={v => set('student_careers', v)} isEdit={!!editId} />
            </div>

            {/* 가족/관계 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '8px' }}>👨‍👩‍👧‍👦 가족 관계</label>

              {/* 등록된 관계 태그 목록 */}
              {(form.relations || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {(form.relations || []).map((r, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: r.type === '쌍둥이' ? '#fdf4ff' : r.type === '형제' ? '#eff6ff' : r.type === '남매' ? '#f0fdf4' : '#fff7ed',
                      border: `1px solid ${r.type === '쌍둥이' ? '#e9d5ff' : r.type === '형제' ? '#bfdbfe' : r.type === '남매' ? '#86efac' : '#fed7aa'}`,
                      color: r.type === '쌍둥이' ? '#7e22ce' : r.type === '형제' ? '#1d4ed8' : r.type === '남매' ? '#15803d' : '#c2410c',
                    }}>
                      {r.type}{r.with ? ` · ${r.with}` : ''}
                      <button onClick={() => set('relations', (form.relations || []).filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: 0, color: 'inherit', opacity: 0.6 }}>×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* 관계 추가 입력 */}
              <RelationAdder relations={form.relations || []} onChange={v => set('relations', v)} />
            </div>

            {/* 상태 + 취소 메모 인라인 */}
            <div>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151', display:'block', marginBottom:'6px' }}>상태</label>
              <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  style={{ flex:'0 0 auto', width:'50%', padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }}>
                  {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  <option value='cancel_before'>개강전 취소</option>
                  <option value='cancel_after'>개강후 취소</option>
                </select>
                {(form.status === 'cancel_before' || form.status === 'cancel_after') && (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'5px' }}>
                    <input type="date" value={form.cancel_info?.date || new Date().toISOString().slice(0,10)}
                      onChange={e => set('cancel_info', { ...form.cancel_info, type: form.status==='cancel_after'?'after':'before', date: e.target.value, memo: form.cancel_info?.memo||'' })}
                      style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                    <textarea value={form.cancel_info?.memo || ''} placeholder="취소 사유"
                      onChange={e => set('cancel_info', { ...form.cancel_info, type: form.status==='cancel_after'?'after':'before', date: form.cancel_info?.date||new Date().toISOString().slice(0,10), memo: e.target.value })}
                      rows={2} style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', resize:'none' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px', marginTop: '4px', borderTop: '1px solid #e5e7eb' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn onClick={save}>{editId ? '저장' : '등록'}</Btn>
          </div>
        </div>
      </Modal>

      {/* 진도 체크 모달 */}
      <Modal open={!!(progressModal && progressStudent)} onClose={() => setProgressModal(false)}
        title={progressStudent ? `📊 ${progressStudent.name} 진도 체크` : ''} width={600}>
        {progressStudent && (() => {
          const item = supplyItems.find(i => i.studentId === progressStudent.id && i.productId === progressProductId)
          const product = supplyProducts.find(p => p.id === progressProductId)
          if (!product) return <div style={{ padding:'24px', color:'#6b7280' }}>교구를 찾을 수 없습니다</div>
          const spp = product.sessionsPerStage || 12
          const alertSess = product.alertSession || 10
          const prog = getProgress(progressStudent.id, product.id)
          const curStage = prog?.curStage || item?.stage || 1
          const assignedStage = item?.stage ? Number(item.stage) : curStage
          const maxShowStage = Math.max(assignedStage, curStage)
          const STAGES = Array.from({ length: maxShowStage }, (_, i) => i + 1)
          return (
            <div>
              <div style={{ padding:'16px 24px', overflowY:'auto', maxHeight:'65vh' }}>
                {/* 교구 정보 헤더 */}
                <div style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:'10px', fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>
                  🤖 {product.name} · {assignedStage}단계 배정 · 단계당 {spp}차시 기준 · {alertSess}차시 알림
                </div>
                {/* 단계별 차시 체크 */}
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {STAGES.map(stage => {
                    const stagePlans = supplyPlans.filter(p => p.productId === product.id && p.stage === stage).sort((a,b) => a.sessionNo - b.sessionNo)
                    const sessions = stagePlans.length > 0 ? stagePlans
                      : Array.from({ length: spp }, (_, i) => ({ id:`d_${stage}_${i+1}`, stage, sessionNo:i+1, title:`${stage}단계 ${i+1}차시`, dummy:true }))
                    const stageChecks = getStudentChecks(progressStudent.id, product.id).filter(c => c.stage === stage)
                    const checkedNos = new Set(stageChecks.map(c => c.sessionNo))
                    const cnt = stageChecks.length
                    const isDone = cnt >= spp
                    const isAlert = cnt >= alertSess && !isDone
                    return (
                      <div key={stage} style={{ border:`1px solid ${isDone?'#86efac':isAlert?'#fde68a':'#e5e7eb'}`, borderRadius:'10px', overflow:'hidden' }}>
                        <div style={{ padding:'10px 14px', background:isDone?'#f0fdf4':isAlert?'#fffbeb':'#f9fafb', display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'13px', fontWeight:700, color:isDone?'#16a34a':isAlert?'#f59e0b':'#111827' }}>{stage}단계</span>
                          <span style={{ fontSize:'12px', color:'#6b7280' }}>{cnt}/{spp}차시</span>
                          {isDone  && <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료</span>}
                          {isAlert && <span style={{ fontSize:'11px', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>⚠️ 다음 단계 준비</span>}
                        </div>
                        <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'4px' }}>
                          {sessions.map(sess => {
                            const isChk = checkedNos.has(sess.sessionNo)
                            return (
                              <div key={sess.id} onClick={() => toggleCheck(progressStudent.id, product.id, stage, sess.sessionNo)}
                                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px', borderRadius:'7px', background:isChk?'#f0fdf4':'#fff', border:`1px solid ${isChk?'#86efac':'#e5e7eb'}`, cursor:'pointer', transition:'all .12s' }}>
                                <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${isChk?'#16a34a':'#e5e7eb'}`, background:isChk?'#16a34a':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  {isChk && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                                </div>
                                <span style={{ fontSize:'13px', fontWeight:isChk?600:400, color:isChk?'#16a34a':'#111827' }}>
                                  {sess.sessionNo}차시{!sess.dummy && sess.title ? ` · ${sess.title}` : ''}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', display:'flex', gap:'8px' }}>
                <button onClick={() => setProgressModal(false)}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
                  닫기
                </button>
                <button onClick={() => { refresh(); setProgressModal(false) }}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#f97316', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#fff', fontWeight:600 }}>
                  저장
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* 취소 처리 모달 */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)}
        title={cancelForm.type === 'after' ? '🔴 개강후 취소' : '🔴 개강전 취소'} width={420}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* 안내 */}
          <div style={{ padding:'12px 14px', background:'#fef2f2', borderRadius:'10px', fontSize:'13px', color:'#991b1b', lineHeight:1.6 }}>
            <strong>{cancelTarget?.name}</strong> 학생 —
            {cancelForm.type === 'after'
              ? ' 현재 학기/분기까지 출석부 유지, 다음 텀부터 수강료 제외됩니다.'
              : ' 개강 전 취소로 즉시 처리됩니다.'}
          </div>

          {/* 취소 요청일 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', display:'block', marginBottom:'6px' }}>취소 요청일</label>
            <input type="date" value={cancelForm.date} onChange={e => setCancelForm(f => ({ ...f, date: e.target.value }))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          </div>

          {/* 메모 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', display:'block', marginBottom:'6px' }}>메모</label>
            <textarea value={cancelForm.memo} onChange={e => setCancelForm(f => ({ ...f, memo: e.target.value }))}
              placeholder="취소 사유를 입력하세요"
              rows={3}
              style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', resize:'vertical' }} />
          </div>

          <div style={{ display:'flex', gap:'8px', paddingTop:'4px' }}>
            <Btn variant="ghost" onClick={() => setCancelModal(false)}>취소</Btn>
            <Btn variant="danger" full onClick={() => {
              const s = StudentsDB.find(cancelTarget.id)
              StudentsDB.update(cancelTarget.id, {
                status: cancelTarget?.status || 'cancelled',
                cancel_info: { type: cancelForm.type, date: cancelForm.date, memo: cancelForm.memo },
                statusHistory: [...(s?.statusHistory || []), {
                  status: cancelTarget?.status || 'cancelled',
                  changedAt: now(),
                  memo: `[${cancelForm.type === 'after' ? '개강후' : '개강전'} 취소] ${cancelForm.date}${cancelForm.memo ? ' - ' + cancelForm.memo : ''}`,
                }],
              })
              // 대기자 자동 승격
              const classIds = s?.classIds || []
              classIds.forEach(cid => {
                const promoted = promoteNextWaiting(cid)
                if (promoted) { setPromotedName(promoted.name); setTimeout(() => setPromotedName(null), 4000) }
              })
              setCancelModal(false)
              refresh()
              showToast('취소 처리가 완료되었습니다.')
            }}>확인</Btn>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="학생 삭제" width={380}>
        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
          <strong>{deleteTarget?.name}</strong> 학생을 삭제하시겠습니까?
        </p>
        <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '20px' }}>삭제 후 복구할 수 없습니다.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>취소</Btn>
          <Btn variant="danger" onClick={deleteStudent}>삭제</Btn>
        </div>
      </Modal>

      {/* 엑셀 업로드 모달 */}
      <Modal open={showExcel} onClose={() => { setShowExcel(false); setExcelPreview([]); setExcelStep(0); setExcelClassId('') }} title="엑셀 일괄 업로드" width={640}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
          {[{n:0,label:'수업 선택'},{n:1,label:'파일 업로드'},{n:2,label:'확인 후 등록'}].map((s,i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,background:excelStep>=s.n?'#f97316':'#f3f4f6',color:excelStep>=s.n?'#fff':'#9ca3af' }}>{s.n+1}</div>
                <span style={{ fontSize:'13px',color:excelStep===s.n?'#111827':'#9ca3af',fontWeight:excelStep===s.n?700:400 }}>{s.label}</span>
              </div>
              {i<2 && <div style={{ flex:1,height:1,background:excelStep>s.n?'#f97316':'#e5e7eb',maxWidth:40 }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: 수업 선택 */}
        {excelStep === 0 && (() => {
          const hasClasses = classes.length > 0
          const selCls = classes.find(c => c.id === excelClassId)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 안내 문구 */}
              <div style={{ padding: '14px 16px', background: '#fffbeb', borderRadius: '12px', border: '1.5px solid #fde68a', fontSize: '13px', color: '#92400e', lineHeight: 1.7 }}>
                📋 등록하려는 <strong>수업을 먼저 선택</strong>하면, 해당 수업 정보(학교·과목·반·요일·시간)가 자동으로 입력된 샘플 파일을 받을 수 있어요.<br />
                샘플을 받아서 학생 이름·학년 등을 채운 뒤 업로드하면 됩니다.<br />
                {!hasClasses && <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ 등록된 수업이 없습니다. 먼저 <button onClick={() => { setShowExcel(false); onNav('classes') }} style={{ background:'none',border:'none',color:'#2563eb',cursor:'pointer',fontWeight:700,fontSize:'13px',textDecoration:'underline',fontFamily:'Noto Sans KR, sans-serif',padding:0 }}>수업 등록</button>을 해주세요.</span>}
              </div>

              {/* 수업 드롭다운 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>수업 선택</label>
                <select
                  value={excelClassId}
                  onChange={e => setExcelClassId(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', color: '#111827', outline: 'none', cursor: 'pointer' }}
                  disabled={!hasClasses}
                >
                  <option value="">{hasClasses ? '-- 수업을 선택하세요 --' : '등록된 수업이 없습니다'}</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.organization ? `${c.organization} · ` : ''}{c.className}{c.section ? ` ${c.section}반` : ''}{c.days?.length ? ` (${c.days.join('')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 선택된 수업 정보 카드 */}
              {selCls && (
                <div style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1.5px solid #86efac', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#15803d' }}>
                  <span>🏫 <strong>{selCls.organization}</strong></span>
                  <span>📚 <strong>{selCls.className}{selCls.section ? ` ${selCls.section}반` : ''}</strong></span>
                  {selCls.days?.length > 0 && <span>📅 {selCls.days.join(', ')}요일</span>}
                  {selCls.time && <span>⏰ {selCls.time}</span>}
                </div>
              )}

              {/* 샘플 다운로드 버튼 */}
              <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>📥 샘플 파일 다운로드</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.6 }}>
                  수업을 선택하면 학교·과목 정보가 자동 입력된 샘플을 받을 수 있어요.<br />
                  샘플에서 <strong>학년 / 학급반 / 번호 / 이름 / 학부모전화번호</strong>만 채워서 업로드하세요.
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {['학년(숫자만)', '학급반(예:2)', '번호', '이름 ★', '학부모전화번호', '학생전화번호'].map((c, i) => (
                    <span key={c} style={{ padding:'3px 9px',borderRadius:'5px',fontSize:'12px',fontWeight:600,background:i===3?'#fff7ed':'#f3f4f6',border:i===3?'1.5px solid #fed7aa':'1px solid #e5e7eb',color:i===3?'#c2410c':'#374151' }}>{c}</span>
                  ))}
                </div>
                <button
                  onClick={downloadSample}
                  disabled={!excelClassId}
                  style={{ padding:'8px 16px',borderRadius:'8px',border:'1.5px solid #16a34a',background: excelClassId?'#fff':'#f3f4f6',color:excelClassId?'#16a34a':'#9ca3af',fontSize:'13px',fontWeight:700,cursor:excelClassId?'pointer':'not-allowed',fontFamily:'Noto Sans KR, sans-serif' }}
                >
                  📥 샘플 다운로드{selCls ? ` (${selCls.organization} ${selCls.className}${selCls.section?' '+selCls.section+'반':''})` : ''}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Btn disabled={!excelClassId} onClick={() => excelClassId && setExcelStep(1)}>다음 →</Btn>
              </div>
            </div>
          )
        })()}

        {/* Step 1: 파일 업로드 */}
        {excelStep === 1 && (() => {
          const selCls = classes.find(c => c.id === excelClassId)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {selCls && (
                <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1.5px solid #86efac', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#15803d' }}>
                  <span>🏫 <strong>{selCls.organization}</strong></span>
                  <span>📚 <strong>{selCls.className}{selCls.section ? ` ${selCls.section}반` : ''}</strong></span>
                  {selCls.days?.length > 0 && <span>📅 {selCls.days.join(', ')}요일</span>}
                  {selCls.time && <span>⏰ {selCls.time}</span>}
                </div>
              )}
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.background = '#fff7ed' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb' }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#d1d5db'
                  e.currentTarget.style.background = '#f9fafb'
                  const file = e.dataTransfer.files[0]
                  if (file) handleFile({ target: { files: [file], value: '' } })
                }}
                onClick={() => fileRef.current?.click()}
                style={{ padding: '36px 20px', background: '#f9fafb', borderRadius: '12px', border: '2px dashed #d1d5db', textAlign: 'center', cursor: 'pointer', transition: 'all .15s' }}
              >
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>파일을 여기에 끌어다 놓거나 클릭하세요</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>지원 형식: .xlsx, .xls, .csv</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <Btn variant="ghost" onClick={() => setExcelStep(0)}>← 이전</Btn>
              </div>
            </div>
          )
        })()}

        {/* Step 2: 미리보기 */}
        {excelStep === 2 && (() => {
          const selCls = classes.find(c => c.id === excelClassId)
          const checkedCount = excelPreview.filter(r => r._checked !== false).length
          const dupCount = excelPreview.filter(r => r._dup).length
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1.5px solid #86efac', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px', color: '#15803d' }}>
                <span style={{ fontWeight:700 }}>✅ 등록 예정 {checkedCount}명</span>
                {dupCount > 0 && (
                  <span style={{ color: '#b45309', fontWeight: 600 }}>⚠️ 중복 의심 {dupCount}명 — 직접 확인 후 체크하세요</span>
                )}
                {selCls && <span>🏫 {selCls.organization} · {selCls.className}{selCls.section ? ` ${selCls.section}반` : ''}</span>}
              </div>
              {dupCount > 0 && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e', lineHeight: 1.6 }}>
                  🔶 <strong>중복 의심 학생</strong>은 이미 같은 수업에 등록된 학생과 이름·학년·반이 동일합니다.<br />
                  실제 중복이면 체크 해제, 새로 등록할 학생이면 체크 유지 후 확정하세요.
                </div>
              )}
              <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding:'8px 10px', borderBottom:'1px solid #e5e7eb', width: '32px' }}>
                        <input type="checkbox"
                          checked={excelPreview.every(r => r._checked !== false)}
                          onChange={e => setExcelPreview(prev => prev.map(r => ({ ...r, _checked: e.target.checked })))}
                        />
                      </th>
                      {['#', '이름', '학년', '학급반', '번호', '학부모전화', '학생전화'].map(h => (
                        <th key={h} style={{ padding:'8px 10px',textAlign:'left',fontWeight:600,color:'#6b7280',whiteSpace:'nowrap',borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r, i) => {
                      const checked = r._checked !== false
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background: r._dup ? '#fffbeb' : i%2===0?'#fff':'#fafafa', opacity: checked ? 1 : 0.4 }}>
                          <td style={{ padding:'7px 10px', textAlign:'center' }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => setExcelPreview(prev => prev.map((row, idx) => idx === i ? { ...row, _checked: e.target.checked } : row))}
                            />
                          </td>
                          <td style={{ padding:'7px 10px',color:'#9ca3af' }}>{i+1}</td>
                          <td style={{ padding:'7px 10px',fontWeight:700, color: r._dup ? '#b45309' : '#111827' }}>
                            {r.name}
                            {r._dup && <span style={{ marginLeft:'5px', fontSize:'10px', fontWeight:700, color:'#fff', background:'#f59e0b', padding:'1px 5px', borderRadius:'4px' }}>중복의심</span>}
                          </td>
                          <td style={{ padding:'7px 10px' }}>{r.grade ? r.grade+'학년' : '-'}</td>
                          <td style={{ padding:'7px 10px' }}>{r.classNum ? r.classNum+'반' : '-'}</td>
                          <td style={{ padding:'7px 10px' }}>{r.number||'-'}</td>
                          <td style={{ padding:'7px 10px' }}>{r.parentPhone||'-'}</td>
                          <td style={{ padding:'7px 10px' }}>{r.studentPhone||'-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <Btn variant="ghost" onClick={() => { setExcelStep(1); setExcelPreview([]) }}>← 다시 선택</Btn>
                <Btn disabled={checkedCount === 0} onClick={importExcel}>✅ {checkedCount}명 등록 확정</Btn>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

const selSt = {
  padding: '8px 12px', borderRadius: '9px', border: '1.5px solid #e5e7eb',
  fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif',
  background: '#fff', color: '#111827', cursor: 'pointer', outline: 'none',
  minWidth: '160px',
}
