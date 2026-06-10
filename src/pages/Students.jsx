import React, { useState, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, RevenuePayments, TeacherParentLinks } from '../lib/db.js'
import { SupplyItems, SupplyProducts, SupplyStudentProgress, SupplyProgressLogs, SupplySessionChecks, SupplyProductPlans } from '../lib/db.js'
import { uid, now, fmtPhone, sortClasses, calcSessionDates } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Tag, EmptyState, PageHeader, Checkbox, Textarea } from '../components/Atoms.jsx'
import { STUDENT_STATUS, GRADES, DAYS } from '../constants/config.js'
import { useToast } from '../hooks/useToast.js'

// ── 취소 날짜 기준 텀번호 계산 (ClassCalendar와 동일 로직)
function computeTermNum(cls, cancelDate) {
  if (!cls || !cancelDate) return null
  try {
    const allSessions = calcSessionDates(cls)
    const sessions = cls.totalSessions ? allSessions.slice(0, cls.totalSessions) : allSessions
    const cancelledSet = new Set((cls.cancelledDates || []).map(c => c.date))
    const termSizes = cls.periods?.length > 0
      ? cls.periods.flatMap(p =>
          (p.termSizes?.length > 0)
            ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
            : Array(Number(p.termCount) || 1).fill(4)
        )
      : (cls.termSizes?.length > 0)
        ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
        : [cls.termSize ? Number(cls.termSize) : 4]
    const termMap = {}
    let cursor = 0
    termSizes.forEach((size, ti) => {
      sessions.slice(cursor, cursor + size).forEach(d => { termMap[d] = ti + 1 })
      cursor += size
    })
    if (!cls.totalSessions && cursor < sessions.length) {
      sessions.slice(cursor).forEach(d => { termMap[d] = termSizes.length })
    }
    const before = sessions.filter(d => d <= cancelDate && !cancelledSet.has(d))
    const lastSess = before[before.length - 1]
    return lastSess ? (termMap[lastSess] ?? null) : null
  } catch { return null }
}

// ── 학생의 classIds에서 텀번호 계산 (첫 번째 매칭 클래스 기준)
function computeTermNumForStudent(classes, classIds, cancelDate) {
  for (const cid of (classIds || [])) {
    const cls = classes.find(c => c.id === cid)
    const tn = computeTermNum(cls, cancelDate)
    if (tn != null) return tn
  }
  return null
}


function formatPhoneInput(v) {
  const d = v.replace(/[^0-9]/g, '')
  if (d.length < 4) return d
  if (d.startsWith('02')) {
    if (d.length < 7) return d.slice(0,2) + '-' + d.slice(2)
    if (d.length < 10) return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6)
    return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6,10)
  }
  if (d.length < 8) return d.slice(0,3) + '-' + d.slice(3)
  if (d.length < 11) return d.slice(0,3) + '-' + d.slice(3,6) + '-' + d.slice(6)
  return d.slice(0,3) + '-' + d.slice(3,7) + '-' + d.slice(7,11)
}

function SyncScrollTable({ children }) {
  const topRef = React.useRef(null)
  const botRef = React.useRef(null)
  const syncFromTop = () => { if(botRef.current) botRef.current.scrollLeft = topRef.current.scrollLeft }
  const syncFromBot = () => { if(topRef.current) topRef.current.scrollLeft = botRef.current.scrollLeft }
  return (
    <>
      <div ref={topRef} onScroll={syncFromTop} style={{ overflowX: 'auto', overflowY: 'hidden', height: '12px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ minWidth: '1300px', height: '1px' }} />
      </div>
      <div ref={botRef} onScroll={syncFromBot} style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </>
  )
}

// ── 귀가방법 인라인 편집 셀 (출석부와 동일한 UX)
function HomeReturnCell({ studentId, homeReturn, onUpdate }) {
  const [hrType, setHrType] = React.useState(() => homeReturn.startsWith('학원') ? '학원' : homeReturn)
  const [hrMemo, setHrMemo] = React.useState(() => homeReturn.startsWith('학원-') ? homeReturn.slice(3) : '')

  const save = (type, memo) => {
    let val = ''
    if (type === '학원') val = memo.trim() ? `학원-${memo.trim()}` : '학원'
    else val = type
    StudentsDB.update(studentId, { homeReturn: val })
    onUpdate && onUpdate()
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
      <span style={{ fontSize:'11px', color:'#1d4ed8', flexShrink:0 }}>🚌</span>
      <select value={hrType} onChange={e => {
        const v = e.target.value
        setHrType(v)
        if (v !== '학원') { setHrMemo(''); save(v, '') }
        else save('학원', hrMemo)
      }} style={{ fontSize:'11px', padding:'2px 6px', borderRadius:'5px', border:'1px solid #e5e7eb', background:'#fff', color: hrType ? '#1d4ed8' : '#9ca3af', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
        <option value="">귀가방법</option>
        <option value="학원">학원</option>
        <option value="돌봄">돌봄</option>
        <option value="늘봄">늘봄</option>
        <option value="픽업">픽업</option>
        <option value="직접귀가">직접귀가</option>
      </select>
      {hrType === '학원' && (
        <input value={hrMemo} onChange={e => setHrMemo(e.target.value)}
          onBlur={e => save('학원', e.target.value)}
          placeholder="학원명"
          style={{ fontSize:'11px', width:'60px', padding:'2px 6px', borderRadius:'5px', border:'1.5px solid #bfdbfe', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
      )}
      {hrType && (
        <button onClick={() => { setHrType(''); setHrMemo(''); save('', '') }}
          style={{ fontSize:'10px', color:'#9ca3af', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>
      )}
    </div>
  )
}

function emptyStudent() {
  return {
    school: '', grade: '', classNum: '', number: '', name: '',
    parentPhone: '', studentPhone: '', classIds: [], status: 'applied', memo: '', contactMethod: '',
    applyOrder: '', remark: '', relations: [], student_careers: [],
    // 수업 직접 입력용
    _newOrganization: '', _newClassName: '', _newSection: '',
    _newTimeStart: '', _newTimeEnd: '',
    _newTermType: 'semester', _newDays: [], _newRepeatType: 'every',
    _newStartDate: '', _newEndDate: '',
    studentStartDate: '', studentEndDate: '',
  }
}

// 관계 추가 입력 컴포넌트
// 학생 경력 컴포넌트
function CareerAdder({ careers, onChange, isEdit }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2021 + 1 }, (_, i) => String(2022 + i)).reverse()
  const lastCareer = [...careers].sort((a,b) => a.year !== b.year ? a.year-b.year : Number(a.term)-Number(b.term)).slice(-1)[0]
  const [termType, setTermType] = React.useState(() => (lastCareer?.termType || lastCareer?.term_type) || 'semester')
  const [year, setYear] = React.useState(String(currentYear))
  const [term, setTerm] = React.useState('1')

  const semOpts = [{ value:'1', label:'1학기' }, { value:'2', label:'2학기' }]
  const qtrOpts = [{ value:'1', label:'1분기' }, { value:'2', label:'2분기' }, { value:'3', label:'3분기' }, { value:'4', label:'4분기' }]
  const termOpts = termType === 'semester' ? semOpts : qtrOpts

  // 신규 vs 기존: 등록 시 1개(현재텀) → 신규, 2개 이상 → 기존
  const isNew = careers.length <= 1
  const sorted = [...careers].sort((a,b) => a.year !== b.year ? a.year-b.year : Number(a.term)-Number(b.term))

  const add = () => {
    const dup = careers.find(c => c.year === year && (c.termType || c.term_type) === termType && c.term === term)
    if (dup) return
    const tLabel = termType === 'semester' ? `${term}학기` : `${term}분기`
    const typeLabel = termType === 'semester' ? '학기제' : '분기제'
    onChange([...careers, { year, termType, term, label: `${year.slice(2)}년도 / ${typeLabel} / ${tLabel}` }]) // label unused, rendered dynamically
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
          {sorted.map((c, i) => {
            const origIdx = careers.findIndex(x => x.year === c.year && (x.termType || x.term_type) === (c.termType || c.term_type) && x.term === c.term)
            return (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:600,
              background: i === sorted.length-1 ? '#fff7ed' : '#f9fafb',
              border: `1px solid ${i === sorted.length-1 ? '#fed7aa' : '#e5e7eb'}`,
              color: i === sorted.length-1 ? '#c2410c' : '#374151' }}>
              {c.label}
              {i === sorted.length-1 && <span style={{ fontSize:'10px', color:'#f97316' }}>현재</span>}
              <button onClick={() => onChange(careers.filter((_, j) => j !== origIdx))}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', lineHeight:1, padding:0, color:'inherit', opacity:0.5 }}>×</button>
            </span>
            )
          })}
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

// 수강이력 표시: 26년도 / 분기제 / 1분기 → 2분기
function formatCareers(careers) {
  if (!careers || careers.length === 0) return null
  const sorted = [...careers].sort((a, b) => a.year !== b.year ? a.year - b.year : Number(a.term) - Number(b.term))
  const groups = {}
  for (const c of sorted) {
    const typeLabel = (c.termType || c.term_type) === 'semester' ? '학기제' : '분기제'
    const termLabel = (c.termType || c.term_type) === 'semester' ? '학기' : '분기'
    const key = `${c.year?.slice(2)}년도 / ${typeLabel}`
    if (!groups[key]) groups[key] = []
    groups[key].push(`${c.term}${termLabel}`)
  }
  return Object.entries(groups).map(([key, terms]) => `${key} / ${terms.join(' / ')}`).join(' | ')
}

function TermSetTab({ classes, toastError, showToast, refresh, tick }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2021 + 1 }, (_, i) => String(2022 + i)).reverse()

  const [tsSchool, setTsSchool] = React.useState('')
  const [tsYear, setTsYear] = React.useState('')
  const [tsClassId, setTsClassId] = React.useState('')
  const [tsTermType, setTsTermType] = React.useState('quarter')
  const [tsTerm, setTsTerm] = React.useState('1')
  const [tsChecked, setTsChecked] = React.useState(new Set())
  const [tsDone, setTsDone] = React.useState(false)

  // 수강이력 기록 카드 전용 state (팀 설정과 독립)
  const [recYear, setRecYear] = React.useState(String(new Date().getFullYear()))
  const [recTermType, setRecTermType] = React.useState('quarter')
  const [recTerm, setRecTerm] = React.useState('1')

  const DAY_ORDER_TS = ['월','화','수','목','금','토','일']
  const tsSchoolDayMap = {}
  classes.forEach(c => {
    if (!tsSchoolDayMap[c.organization]) tsSchoolDayMap[c.organization] = new Set()
    ;(c.days || []).forEach(d => tsSchoolDayMap[c.organization].add(d))
  })
  const tsSchools = [...new Set(classes.map(c => c.organization).filter(Boolean))].sort((a,b) => {
    const ai = DAY_ORDER_TS.findIndex(d => (tsSchoolDayMap[a]||new Set()).has(d))
    const bi = DAY_ORDER_TS.findIndex(d => (tsSchoolDayMap[b]||new Set()).has(d))
    return (ai===-1?99:ai) - (bi===-1?99:bi) || a.localeCompare(b,'ko')
  })
  const getTsSchoolDayLabel = (s) => {
    const days = DAY_ORDER_TS.filter(d => (tsSchoolDayMap[s]||new Set()).has(d))
    return days.length ? `(${days.join('·')}) ` : ''
  }
  const tsYearClasses = tsSchool ? classes.filter(c => c.organization === tsSchool) : classes
  const tsFilteredClasses = tsYear ? tsYearClasses.filter(c => c.startDate?.slice(0,4) === tsYear) : tsYearClasses

  const tsClassIdParsed = tsClassId.includes('::') ? tsClassId.split('::')[0] : tsClassId
  const tsSectionParsed = tsClassId.includes('::') ? tsClassId.split('::')[1] : ''
  const tsCls = classes.find(c => c.id === tsClassIdParsed)
  const tsTermLabel = tsTermType === 'semester' ? '학기' : '분기'

  const tsStudents = tsClassIdParsed
    ? StudentsDB.confirmed(tsClassIdParsed)
        .filter(s => !tsSectionParsed || s.section === tsSectionParsed)
        .filter(s => {
          const careers = s.student_careers || []
          if (careers.length === 0) return tsTerm === '1'
          return careers.some(c => String(c.term) === String(tsTerm) && (c.termType || c.term_type) === tsTermType)
        })
        .sort((a, b) => {
          const SECTION_ORDER = ['A','B','C','D','E','F']
          const aS = SECTION_ORDER.indexOf((a.section||'').toUpperCase())
          const bS = SECTION_ORDER.indexOf((b.section||'').toUpperCase())
          if (aS !== bS) return (aS === -1 ? 99 : aS) - (bS === -1 ? 99 : bS)
          const aG = parseInt(a.grade) || 99, bG = parseInt(b.grade) || 99
          if (aG !== bG) return aG - bG
          const aCN = parseInt(a.classNum) || 99, bCN = parseInt(b.classNum) || 99
          if (aCN !== bCN) return aCN - bCN
          const aN = parseInt(a.number) || 99, bN = parseInt(b.number) || 99
          if (aN !== bN) return aN - bN
          return (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true })
        })
    : []

  const semOpts = [{ value:'1', label:'1학기' }, { value:'2', label:'2학기' }]
  const qtrOpts = [{ value:'1', label:'1분기' }, { value:'2', label:'2분기' }, { value:'3', label:'3분기' }, { value:'4', label:'4분기' }]
  const termOpts = tsTermType === 'semester' ? semOpts : qtrOpts

  const toggleAll = () => {
    if (tsChecked.size === tsStudents.length) setTsChecked(new Set())
    else setTsChecked(new Set(tsStudents.map(s => s.id)))
  }

  const recTermOpts = recTermType === 'semester'
    ? [{ value:'1', label:'1학기' }, { value:'2', label:'2학기' }]
    : [{ value:'1', label:'1분기' }, { value:'2', label:'2분기' }, { value:'3', label:'3분기' }, { value:'4', label:'4분기' }]
  const recTermLabel = recTermType === 'semester' ? '학기' : '분기'

  const doTermSet = async () => {
    if (!recYear) { toastError('년도를 선택하세요.'); return }
    if (!recTerm) { toastError('분기/학기를 선택하세요.'); return }
    if (tsChecked.size === 0) { toastError('학생을 선택하세요.'); return }
    const tLabel = recTermType === 'semester' ? `${recTerm}학기` : `${recTerm}분기`
    const typeLabel = recTermType === 'semester' ? '학기제' : '분기제'
    const newCareer = {
      year: recYear,
      termType: recTermType,
      term: recTerm,
      label: `${recYear.slice(2)}년도 / ${typeLabel} / ${tLabel}`,
    }
    for (const s of tsStudents) {
      if (!tsChecked.has(s.id)) continue
      const existingCareers = s.student_careers || []
      const alreadyHas = existingCareers.some(c => c.year === recYear && c.term === recTerm && (c.termType || c.term_type) === recTermType)
      await StudentsDB.update(s.id, {
        activeTerm: recTerm,
        student_careers: alreadyHas ? existingCareers : [...existingCareers, newCareer],
        statusHistory: [...(s.statusHistory || []), {
          status: 'term_set',
          changedAt: now(),
          memo: `[텀 설정] ${recYear}년도 ${typeLabel} ${tLabel}`,
        }],
      })
    }
    showToast(`✅ ${tsChecked.size}명에게 ${recYear.slice(2)}년 ${tLabel} 수강이력이 등록되었습니다.`)
    setTsChecked(new Set())
    setTsDone(true)
    refresh && refresh()
    setTimeout(() => setTsDone(false), 3000)
  }

  const sst = { padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }

  return (
    <div>
      {/* 설정 패널: 학교 → 년도 → 분기/학기 */}
      <div style={{ background:'#fff', borderRadius:'14px', border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af', marginBottom:'10px', letterSpacing:'0.05em' }}>📍 텀 설정</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>

          {/* 1. 학교 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>학교</label>
            <select value={tsSchool} onChange={e => { setTsSchool(e.target.value); setTsClassId(''); setTsChecked(new Set()) }} style={{ ...sst, minWidth:'160px' }}>
              <option value=''>-- 학교 선택 --</option>
              {tsSchools.map(s => <option key={s} value={s}>{getTsSchoolDayLabel(s)}{s}</option>)}
            </select>
          </div>

          {/* 2. 년도 선택 - 처음부터 표시 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>년도</label>
            <select value={tsYear} onChange={e => { setTsYear(e.target.value); setTsClassId(''); setTsChecked(new Set()) }} style={sst}>
              <option value=''>-- 년도 선택 --</option>
              {years.map(y => <option key={y} value={y}>{y}년도</option>)}
            </select>
          </div>

          {/* 3. 분기/학기 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>구분</label>
            <select value={tsTermType} onChange={e => { setTsTermType(e.target.value); setTsTerm('1'); setTsChecked(new Set()) }} style={sst}>
              <option value='quarter'>분기제</option>
              <option value='semester'>학기제</option>
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>{tsTermLabel}</label>
            <select value={tsTerm} onChange={e => setTsTerm(e.target.value)} style={{ ...sst, border:'1.5px solid #f97316', background:'#fff7ed' }}>
              {termOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* 4. 수업 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>수업</label>
              <select value={tsClassId} onChange={e => { setTsClassId(e.target.value); setTsChecked(new Set()) }} style={{ ...sst, minWidth:'180px' }}>
                <option value=''>-- 수업 선택 --</option>
                {tsFilteredClasses.flatMap(c => {
                  const dayLabel = c.days?.length ? `(${c.days.join('·')}) ` : ''
                  const secs = [...(c.sections?.filter(s => s.section) || [])].sort((a,b) => (a.section||'').localeCompare(b.section||'','ko'))
                  if (secs.length > 1) {
                    return secs.map(s => (
                      <option key={c.id+'::'+s.section} value={c.id+'::'+s.section}>
                        {dayLabel}{c.className} {s.section}반
                      </option>
                    ))
                  }
                  const secLabel = c.section ? ' ' + c.section + '반' : ''
                  return [<option key={c.id} value={c.id}>{dayLabel}{c.className}{secLabel}</option>]
                })}
              </select>
            </div>
        </div>
      </div>

      {/* 저장 카드 - 항상 표시 */}
      <div style={{ background:'#fff', borderRadius:'14px', border:'1.5px solid #f97316', padding:'16px 20px', marginBottom:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:'#f97316', marginBottom:'10px', letterSpacing:'0.05em' }}>📌 수강이력 기록</div>
          <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>년도</label>
              <select value={recYear} onChange={e => setRecYear(e.target.value)} style={sst}>
                <option value=''>-- 선택 --</option>
                {years.map(y => <option key={y} value={y}>{y}년도</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>구분</label>
              <select value={recTermType} onChange={e => { setRecTermType(e.target.value); setRecTerm('1') }} style={sst}>
                <option value='quarter'>분기제</option>
                <option value='semester'>학기제</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>{recTermLabel}</label>
              <select value={recTerm} onChange={e => setRecTerm(e.target.value)}
                style={{ ...sst, border:'1.5px solid #f97316', background:'#fff7ed' }}>
                {recTermOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button onClick={doTermSet}
              disabled={tsChecked.size === 0 || !recYear}
              style={{
                padding:'8px 20px', borderRadius:'9px', border:'none',
                cursor: tsChecked.size > 0 && recYear ? 'pointer' : 'not-allowed',
                background: tsChecked.size > 0 && recYear ? '#f97316' : '#e5e7eb',
                color: tsChecked.size > 0 && recYear ? '#fff' : '#9ca3af',
                fontSize:'13px', fontWeight:700, fontFamily:'Noto Sans KR, sans-serif',
              }}>
              📌 {tsChecked.size > 0 ? `${tsChecked.size}명 기록하기` : '학생을 선택하세요'}
            </button>
          </div>
        </div>

      {/* 학생 목록 */}
      {tsClassIdParsed && (
        <div style={{ background:'#fff', borderRadius:'14px', border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type='checkbox'
                checked={tsStudents.length > 0 && tsChecked.size === tsStudents.length}
                onChange={toggleAll}
                style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer' }} />
              <span style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>
                학생 <span style={{ color:'#f97316' }}>{tsStudents.length}명</span>
              </span>
              {tsChecked.size > 0 && (
                <span style={{ fontSize:'13px', color:'#f97316', fontWeight:600 }}>{tsChecked.size}명 선택됨</span>
              )}
            </div>

          </div>

          {tsStudents.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>
              {tsClassIdParsed ? '수강이력이 없는 학생이 없습니다 🎉' : '수업을 먼저 선택해주세요'}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['', '반', '학년/반/번호', '이름', '현재 텀', '수강 이력'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tsStudents.map((s, i) => {
                  const curTerm = s.activeTerm || '-'
                  return (
                    <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6', background: tsChecked.has(s.id) ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding:'10px 14px' }}>
                        <input type='checkbox'
                          checked={tsChecked.has(s.id)}
                          onChange={() => setTsChecked(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })}
                          style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer' }} />
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'13px', color:'#374151' }}>
                        {s.section ? <span style={{ padding:'2px 8px', borderRadius:'5px', background:'#fff7ed', color:'#f97316', fontWeight:700, fontSize:'12px' }}>{s.section}반</span> : '-'}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'13px', color:'#374151' }}>
                        {s.grade || '-'}학년 {s.classNum || '-'}반 {s.number || '-'}번
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:700, color:'#111827' }}>{s.name}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {curTerm !== '-'
                          ? <span style={{ padding:'3px 10px', borderRadius:'6px', background:'#eff6ff', color:'#2563eb', fontWeight:700, fontSize:'13px' }}>{curTerm}{tsTermLabel}</span>
                          : <span style={{ color:'#d1d5db', fontSize:'13px' }}>-</span>}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#6b7280' }}>
                        {(() => {
                          const c = (s.student_careers || []).slice().sort((a,b) => a.year !== b.year ? a.year-b.year : Number(a.term)-Number(b.term))
                          return c.length > 0 ? formatCareers(c) : <span style={{ color:'#d1d5db' }}>-</span>
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function RolloverTab({ classes, toastError, showToast, refresh, tick }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2021 + 1 }, (_, i) => String(2022 + i)).reverse()

  const [rvSchool, setRvSchool] = React.useState('')
  const [rvYear, setRvYear] = React.useState('')
  const [rvClassId, setRvClassId] = React.useState('')
  const [rvFromTerm, setRvFromTerm] = React.useState('1')
  const [rvTermType, setRvTermType] = React.useState('quarter')
  const [rvToTerm, setRvToTerm] = React.useState('')
  const [rvToYear, setRvToYear] = React.useState('')
  const [rvChecked, setRvChecked] = React.useState(new Set())
  const [rvDone, setRvDone] = React.useState(false)

  const DAY_ORDER_RV = ['월','화','수','목','금','토','일']
  const rvSchoolDayMap = {}
  classes.forEach(c => {
    if (!rvSchoolDayMap[c.organization]) rvSchoolDayMap[c.organization] = new Set()
    ;(c.days || []).forEach(d => rvSchoolDayMap[c.organization].add(d))
  })
  const rvSchools = [...new Set(classes.map(c => c.organization).filter(Boolean))].sort((a,b) => {
    const ai = DAY_ORDER_RV.findIndex(d => (rvSchoolDayMap[a]||new Set()).has(d))
    const bi = DAY_ORDER_RV.findIndex(d => (rvSchoolDayMap[b]||new Set()).has(d))
    return (ai===-1?99:ai) - (bi===-1?99:bi) || a.localeCompare(b,'ko')
  })
  const getRvSchoolDayLabel = (s) => {
    const days = DAY_ORDER_RV.filter(d => (rvSchoolDayMap[s]||new Set()).has(d))
    return days.length ? `(${days.join('·')}) ` : ''
  }
  const rvYearClasses = rvSchool ? classes.filter(c => c.organization === rvSchool) : classes
  const rvFilteredClasses = rvYear ? rvYearClasses.filter(c => c.startDate?.slice(0,4) === rvYear) : rvYearClasses

  const rvClassIdParsed = rvClassId.includes('::') ? rvClassId.split('::')[0] : rvClassId
  const rvSectionParsed = rvClassId.includes('::') ? rvClassId.split('::')[1] : ''
  const rvCls = classes.find(c => c.id === rvClassIdParsed)

  const rvPeriods = rvCls?.periods?.filter(p => p.startDate && p.endDate) || []
  const rvTermLabel = rvTermType === 'semester' ? '학기' : '분기'
  const rvTermOpts = rvTermType === 'semester'
    ? [{value:'1',label:'1학기'},{value:'2',label:'2학기'}]
    : [{value:'1',label:'1분기'},{value:'2',label:'2분기'},{value:'3',label:'3분기'},{value:'4',label:'4분기'}]

  const rvStudents = rvClassIdParsed
    ? StudentsDB.confirmed(rvClassIdParsed)
        .filter(s => !rvSectionParsed || s.section === rvSectionParsed)
        .filter(s => {
          const careers = s.student_careers || []
          if (careers.length === 0) return rvFromTerm === '1'
          return careers.some(c => String(c.term) === String(rvFromTerm) && (c.termType || c.term_type) === rvTermType)
        })
        .sort((a, b) => {
          const SECTION_ORDER = ['A','B','C','D','E','F']
          const aS = SECTION_ORDER.indexOf((a.section||'').toUpperCase())
          const bS = SECTION_ORDER.indexOf((b.section||'').toUpperCase())
          if (aS !== bS) return (aS === -1 ? 99 : aS) - (bS === -1 ? 99 : bS)
          const aG = parseInt(a.grade) || 99, bG = parseInt(b.grade) || 99
          if (aG !== bG) return aG - bG
          const aCN = parseInt(a.classNum) || 99, bCN = parseInt(b.classNum) || 99
          if (aCN !== bCN) return aCN - bCN
          const aN = parseInt(a.number) || 99, bN = parseInt(b.number) || 99
          if (aN !== bN) return aN - bN
          return (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true })
        })
    : []

  const toggleAll = () => {
    if (rvChecked.size === rvStudents.length) setRvChecked(new Set())
    else setRvChecked(new Set(rvStudents.map(s => s.id)))
  }

  const doRollover = async () => {
    if (!rvToYear) { toastError('이월할 년도를 선택하세요.'); return }
    if (!rvToTerm) { toastError('이월할 텀을 선택하세요.'); return }
    if (rvChecked.size === 0) { toastError('이월할 학생을 선택하세요.'); return }
    const toTermNum = rvToTerm
    const fromTermNum = rvFromTerm || '1'
    const termType = rvCls?.termType || 'quarter'
    const typeLabel = termType === 'semester' ? '학기제' : '분기제'
    const termLabel = termType === 'semester' ? '학기' : '분기'
    const toYear = rvToYear || new Date().getFullYear().toString()

    const makeCareer = (termNum) => ({
      year: toYear,
      termType,
      term: termNum,
      label: `${toYear.slice(2)}년도 / ${typeLabel} / ${termNum}${termLabel}`,
    })

    for (const s of rvStudents) {
      if (!rvChecked.has(s.id)) continue
      let careers = [...(s.student_careers || [])]

      // toTerm 기록 없으면 추가
      const hasTo = careers.some(c => c.year === toYear && c.term === toTermNum && (c.termType || c.term_type) === termType)
      if (!hasTo) careers = [...careers, makeCareer(toTermNum)]

      await StudentsDB.update(s.id, {
        activeTerm: toTermNum,
        student_careers: careers,
        statusHistory: [...(s.statusHistory || []), {
          status: 'rollover',
          changedAt: now(),
          memo: `[텀 이월] ${fromTermNum}${termLabel} → ${toTermNum}${termLabel}`,
        }],
      })
    }
    showToast(`✅ ${rvChecked.size}명이 ${toTermNum}${rvTermLabel}로 이월되었습니다.`)
    setRvChecked(new Set())
    setRvDone(true)
    refresh && refresh()
    setTimeout(() => setRvDone(false), 3000)
  }

  return (
    <div>
      {/* 설정 패널: 학교 → 년도 → 수업 */}
      <div style={{ background:'#fff', borderRadius:'14px', border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af', marginBottom:'10px', letterSpacing:'0.05em' }}>📍 이월 설정</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>

          {/* 1. 학교 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>학교</label>
            <select value={rvSchool} onChange={e => { setRvSchool(e.target.value); setRvYear(''); setRvClassId(''); setRvFromTerm('1'); setRvToTerm(''); setRvChecked(new Set()) }} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', minWidth:'160px' }}>
              <option value=''>-- 학교 선택 --</option>
              {rvSchools.map(s => <option key={s} value={s}>{getRvSchoolDayLabel(s)}{s}</option>)}
            </select>
          </div>

          {/* 2. 년도 선택 - 처음부터 표시 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>년도</label>
            <select value={rvYear} onChange={e => { setRvYear(e.target.value); setRvClassId(''); setRvFromTerm('1'); setRvToTerm(''); setRvChecked(new Set()) }} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
              <option value=''>-- 년도 선택 --</option>
              {years.map(y => <option key={y} value={y}>{y}년도</option>)}
            </select>
          </div>

          {/* 3. 구분 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>구분</label>
            <select value={rvTermType} onChange={e => { setRvTermType(e.target.value); setRvFromTerm('1'); setRvChecked(new Set()) }} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
              <option value='quarter'>분기제</option>
              <option value='semester'>학기제</option>
            </select>
          </div>

          {/* 4. 분기 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>{rvTermLabel}</label>
            <select value={rvFromTerm} onChange={e => { setRvFromTerm(e.target.value); setRvChecked(new Set()) }} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #f97316', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff7ed', outline:'none' }}>
              {rvTermOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* 5. 수업 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>수업</label>
              <select value={rvClassId} onChange={e => { setRvClassId(e.target.value); setRvToTerm(''); setRvChecked(new Set()) }} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', minWidth:'180px' }}>
                <option value=''>-- 수업 선택 --</option>
                {rvFilteredClasses.flatMap(c => {
                  const dayLabel = c.days?.length ? `(${c.days.join('·')}) ` : ''
                  const secs = [...(c.sections?.filter(s => s.section) || [])].sort((a,b) => (a.section||'').localeCompare(b.section||'','ko'))
                  if (secs.length > 1) {
                    return secs.map(s => (
                      <option key={c.id+'::'+s.section} value={c.id+'::'+s.section}>
                        {dayLabel}{c.className} {s.section}반
                      </option>
                    ))
                  }
                  const secLabel = c.section ? ' ' + c.section + '반' : ''
                  return [<option key={c.id} value={c.id}>{dayLabel}{c.className}{secLabel}</option>]
                })}
              </select>
            </div>
        </div>
      </div>

      {/* 이월 카드 - 항상 표시 */}
      <div style={{ background:'#fff', borderRadius:'14px', border:'1.5px solid #f97316', padding:'16px 20px', marginBottom:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:'#f97316', marginBottom:'10px', letterSpacing:'0.05em' }}>🔄 이월 설정</div>
          <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>이월할 년도</label>
              <select value={rvToYear} onChange={e => setRvToYear(e.target.value)}
                style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
                <option value=''>-- 선택 --</option>
                {years.map(y => <option key={y} value={y}>{y}년도</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>구분</label>
              <select value={rvTermType} onChange={e => { setRvTermType(e.target.value); setRvToTerm('') }}
                style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
                <option value='quarter'>분기제</option>
                <option value='semester'>학기제</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>이월할 텀</label>
              <select value={rvToTerm} onChange={e => setRvToTerm(e.target.value)}
                style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #f97316', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff7ed', outline:'none' }}>
                <option value=''>-- 선택 --</option>
                {rvTermOpts.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button onClick={doRollover}
              disabled={rvChecked.size === 0 || !rvToTerm || !rvToYear}
              style={{
                padding:'8px 20px', borderRadius:'9px', border:'none',
                cursor: rvChecked.size > 0 && rvToTerm && rvToYear ? 'pointer' : 'not-allowed',
                background: rvChecked.size > 0 && rvToTerm && rvToYear ? '#f97316' : '#e5e7eb',
                color: rvChecked.size > 0 && rvToTerm && rvToYear ? '#fff' : '#9ca3af',
                fontSize:'13px', fontWeight:700, fontFamily:'Noto Sans KR, sans-serif',
              }}>
              🔄 {rvChecked.size > 0 ? `${rvChecked.size}명 이월하기` : '학생을 선택하세요'}
            </button>
          </div>
        </div>

      {/* 학생 목록 */}
      {rvClassIdParsed && (
        <div style={{ background:'#fff', borderRadius:'14px', border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type='checkbox'
                checked={rvStudents.length > 0 && rvChecked.size === rvStudents.length}
                onChange={toggleAll}
                style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer' }} />
              <span style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>
                {rvFromTerm ? `${rvFromTerm}${rvTermLabel} 학생` : '전체 학생'} {rvStudents.length}명
              </span>
              {rvChecked.size > 0 && (
                <span style={{ fontSize:'13px', color:'#f97316', fontWeight:600 }}>{rvChecked.size}명 선택됨</span>
              )}
            </div>

          </div>

          {rvStudents.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>
              해당 조건의 학생이 없습니다
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['', '반', '학년/반/번호', '이름', '현재 텀', '수강 이력'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rvStudents.map((s, i) => {
                  const curTerm = s.activeTerm || '1'
                  const careers = (s.student_careers || []).slice().sort((a,b) => a.year !== b.year ? a.year-b.year : Number(a.term)-Number(b.term))
                  return (
                    <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding:'10px 14px' }}>
                        <input type='checkbox'
                          checked={rvChecked.has(s.id)}
                          onChange={() => setRvChecked(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })}
                          style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer' }} />
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'13px', color:'#374151' }}>
                        {s.section ? <span style={{ padding:'2px 8px', borderRadius:'5px', background:'#fff7ed', color:'#f97316', fontWeight:700, fontSize:'12px' }}>{s.section}반</span> : '-'}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'13px', color:'#374151' }}>
                        {s.grade || '-'}학년 {s.classNum || '-'}반 {s.number || '-'}번
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:700, color:'#111827' }}>{s.name}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:'6px', background:'#eff6ff', color:'#2563eb', fontWeight:700, fontSize:'13px' }}>
                          {curTerm}{rvTermLabel}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'12px', color:'#6b7280' }}>
                        {formatCareers(careers) || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!rvClassIdParsed && (
        <div style={{ padding:'60px', textAlign:'center', color:'#9ca3af' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔄</div>
          <div style={{ fontSize:'16px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>수업을 선택하세요</div>
          <div style={{ fontSize:'13px' }}>이월할 수업을 선택하면 학생 목록이 표시됩니다</div>
        </div>
      )}
    </div>
  )
}

export function Students({ user, onNav, pageParams = {} }) {
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

  // 출석부 등 외부에서 editStudentId 전달 시 자동으로 편집 모달 열기
  React.useEffect(() => {
    if (!pageParams.editStudentId) return
    const s = StudentsDB.find(pageParams.editStudentId)
    if (s) openEdit(s)
  // openEdit은 함수 선언 이후 정의되지만 useEffect는 mount 후 실행되므로 문제없음
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParams.editStudentId])

  const [ctxYear,    setCtxYear]    = useState('')
  const [ctxSchool,  setCtxSchool]  = useState('')
  const [ctxClass,   setCtxClass]   = useState('')
  const [ctxSection, setCtxSection] = useState('')

  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder,    setSortOrder]    = useState('name')

  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(emptyStudent())

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportTargetStudent, setExportTargetStudent] = useState(null) // null=전체, object=단일학생
  const [exportFields,    setExportFields]    = useState({
    name: true, status: false, grade: true, classNum: true, number: true,
    section: true, school: true, applyOrder: false,
    parentPhone: true, studentPhone: false, contactMethod: false,
    homeReturn: false, memo: false, remark: false,
    parentInviteSentAt: false, parentJoined: false,
    activeTerm: true, student_careers: false,
    relations: false, cancel_info: false, statusHistory: false,
    createdAt: true,
    classStartDate: true, classEndDate: true,
    studentStartDate: true, studentEndDate: true,
  })
  const [showExcel,    setShowExcel]    = useState(false)
  const [excelPreview, setExcelPreview] = useState([])
  const [excelStep,    setExcelStep]    = useState(0)
  const [excelClassId, setExcelClassId] = useState('')
  const fileRef = useRef()
  const studentImportRef = useRef()   // 학생 명단 .after 불러오기용
  const editImportRef    = useRef()   // 편집 모달 내 불러오기용

  // ✅ 대기자 승격 알림 상태
  const [promotedName, setPromotedName] = useState(null)
  // ✅ 실시간 반영용 강제 리렌더 트리거
  const [tick, setTick] = useState(0)
  const [allStudents, setAllStudents] = useState(() => StudentsDB.byTeacher(user.id))
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
  const [cancelForm,   setCancelForm]   = useState({ type: 'before', date: '', memo: '', termNum: null })
  const refresh = () => setTick(t => t + 1)

  // ── 학생 명단 내보내기 (.after)
  const handleExportStudents = () => {
    if (!ctxClassId) { toastError('수업을 먼저 선택하세요.'); return }
    const students = StudentsDB.byClass(ctxClassId)
    if (students.length === 0) { toastError('해당 수업에 학생이 없습니다.'); return }
    setExportTargetStudent(null)
    setShowExportModal(true)
  }

  const doExport = (fields) => {
    const isSingle = !!exportTargetStudent
    const cls = isSingle
      ? classes.find(c => c.id === exportTargetStudent.classIds?.[0])
      : classes.find(c => c.id === ctxClassId)
    const students = isSingle ? [exportTargetStudent] : StudentsDB.byClass(ctxClassId)
    try {
      const safeName = (str) => (str || '').replace(/[/\\:*?"<>|]/g, '_').trim()
      const label = isSingle
        ? [cls?.days?.join(''), cls?.organization, cls?.className, cls?.section, exportTargetStudent.name].filter(Boolean).join('_')
        : [cls?.days?.join(''), cls?.organization, cls?.className, cls?.section].filter(Boolean).join('_')
      const payload = {
        __type: 'students',
        __version: 1,
        exportedAt: new Date().toISOString(),
        classMeta: {
          id:           cls?.id,
          organization: cls?.organization || '',
          className:    cls?.className    || '',
          section:      cls?.section      || '',
          days:         cls?.days         || [],
          time:         cls?.time         || '',
          timeEnd:      cls?.timeEnd      || '',
          termType:     cls?.termType     || '',
          repeatType:   cls?.repeatType   || '',
          startDate:    cls?.startDate    || '',
          endDate:      cls?.endDate      || '',
        },
        students: students.map(s => {
          const row = {}
          if (fields.name)             row.name             = s.name
          if (fields.status)           row.status           = s.status
          if (fields.school)           row.school           = s.school || ''
          if (fields.grade)            row.grade            = s.grade || ''
          if (fields.classNum)         row.classNum         = s.classNum || ''
          if (fields.number)           row.number           = s.number || ''
          if (fields.section)          row.section          = s.section || ''
          if (fields.applyOrder)       row.applyOrder       = s.applyOrder || ''
          if (fields.parentPhone)      row.parentPhone      = s.parentPhone || ''
          if (fields.studentPhone)     row.studentPhone     = s.studentPhone || ''
          if (fields.contactMethod)    row.contactMethod    = s.contactMethod || ''
          if (fields.homeReturn)       row.homeReturn       = s.homeReturn || ''
          if (fields.memo)             row.memo             = s.memo || ''
          if (fields.remark)           row.remark           = s.remark || ''
          if (fields.parentInviteSentAt) row.parentInviteSentAt = s.parentInviteSentAt || ''
          if (fields.parentJoined)     row.parentJoined     = s.parentJoined || false
          if (fields.activeTerm)       row.activeTerm       = s.activeTerm || ''
          if (fields.student_careers)  row.student_careers  = s.student_careers || []
          if (fields.relations)        row.relations        = s.relations || []
          if (fields.cancel_info)      row.cancel_info      = s.cancel_info || null
          if (fields.statusHistory)    row.statusHistory    = s.statusHistory || []
          if (fields.createdAt)        row.createdAt        = s.createdAt        || ''
          if (fields.classStartDate) {
            const sCls = classes.find(c => c.id === s.classIds?.[0])
            row.classStartDate = sCls?.startDate || ''
          }
          if (fields.classEndDate) {
            const sCls2 = classes.find(c => c.id === s.classIds?.[0])
            row.classEndDate = sCls2?.endDate || ''
          }
          if (fields.studentStartDate) row.studentStartDate = s.studentStartDate || ''
          if (fields.studentEndDate)   row.studentEndDate   = s.studentEndDate   || ''
          return row
        }),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${safeName(label)}_학생.after`
      a.click()
      URL.revokeObjectURL(url)
      setShowExportModal(false)
      showToast(`📤 ${safeName(label)}_학생.after 저장 완료! (${students.length}명)`)
    } catch (e) {
      toastError('내보내기 실패: ' + e.message)
    }
  }

  // ── 학생 명단 불러오기 (.after)
  const handleImportStudents = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.__type !== 'students') {
        toastError('학생 파일이 아닙니다. (_학생.after 파일을 선택하세요)')
        return
      }
      const meta = data.classMeta || {}
      const s    = data.students?.[0]
      if (!s) { toastError('학생 데이터가 없습니다.'); return }

      // 수업 찾기 (현재 선택된 수업 우선, 없으면 파일 메타로 찾기)
      let targetCls = classes.find(c => c.id === ctxClassId)
      if (!targetCls) {
        targetCls = classes.find(c =>
          c.organization === meta.organization &&
          c.className    === meta.className &&
          (c.section     === meta.section || (!c.section && !meta.section))
        )
      }

      // 폼 채우고 등록 모달 열기
      setForm({
        ...emptyStudent(),
        classIds:      targetCls ? [targetCls.id] : [],
        school:        s.school        || targetCls?.organization || meta.organization || '',
        name:          s.name          || '',
        status:        s.status        || 'applied',
        grade:         s.grade         || '',
        classNum:      s.classNum      || '',
        number:        s.number        || '',
        section:       s.section       || meta.section || '',
        parentPhone:   s.parentPhone   || '',
        studentPhone:  s.studentPhone  || '',
        contactMethod: s.contactMethod || '',
        homeReturn:    s.homeReturn    || '',
        memo:          s.memo          || '',
        remark:        s.remark        || '',
        applyOrder:    s.applyOrder    || '',
        relations:     s.relations     || [],
        student_careers: s.student_careers || [],
        studentStartDate: s.studentStartDate || '',
        studentEndDate:   s.studentEndDate   || '',
        _newOrganization: meta.organization  || '',
        _newClassName:    meta.className     || '',
        _newSection:      meta.section       || '',
        _newTimeStart:    meta.time          || '',
        _newTimeEnd:      meta.timeEnd       || '',
        _newTermType:     meta.termType      || 'semester',
        _newDays:         meta.days          || [],
        _newRepeatType:   meta.repeatType    || 'every',
        _newStartDate:    meta.startDate     || '',
        _newEndDate:      meta.endDate       || '',
      })
      setEditId(null)
      setShowModal(true)
    } catch (e) {
      toastError('파일을 읽을 수 없습니다: ' + e.message)
    }
  }

  // ── 편집 모달 내 불러오기 (.after) — 현재 editId 유지하며 폼만 덮어씀
  const handleEditImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.__type !== 'students') {
        toastError('학생 파일이 아닙니다. (_학생.after 파일을 선택하세요)')
        return
      }
      const s = data.students?.[0]
      if (!s) { toastError('학생 데이터가 없습니다.'); return }
      setForm(prev => ({
        ...prev,
        name:          s.name          || prev.name,
        status:        s.status        || prev.status,
        grade:         s.grade         || prev.grade,
        classNum:      s.classNum      || prev.classNum,
        number:        s.number        || prev.number,
        parentPhone:   s.parentPhone   || prev.parentPhone,
        studentPhone:  s.studentPhone  || prev.studentPhone,
        contactMethod: s.contactMethod || prev.contactMethod,
        homeReturn:    s.homeReturn    || prev.homeReturn,
        memo:          s.memo          || prev.memo,
        remark:        s.remark        || prev.remark,
        applyOrder:    s.applyOrder    || prev.applyOrder,
        relations:     s.relations?.length ? s.relations : prev.relations,
        student_careers: s.student_careers?.length ? s.student_careers : prev.student_careers,
      }))
      showToast('불러오기 완료! 저장 버튼을 눌러 적용하세요.')
    } catch (e) {
      toastError('파일을 읽을 수 없습니다: ' + e.message)
    }
  }

  // 현재 학기 자동 계산
  const getCurrentTerm = () => {
    const now2 = new Date()
    const y = String(now2.getFullYear())
    const m = now2.getMonth() + 1
    const term = m >= 3 && m <= 8 ? '1' : '2'
    return { year: y, termType: 'semester', term, label: `${y.slice(2)}년도 / 학기제 / ${term}학기` }
  }

  React.useEffect(() => {
    setAllStudents(StudentsDB.byTeacher(user.id))
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
  const [mainTab, setMainTab] = useState('manage') // 'manage' | 'register' | 'rollover'
  const [selectedForMove, setSelectedForMove] = useState([]) // 탭2에서 선택된 학생 id 목록
  const [selectedForRegister, setSelectedForRegister] = useState([]) // 탭1에서 탭2로 보낼 학생 id 목록
  const [classFilterForMove, setClassFilterForMove] = useState('') // 탭1 이동용 수업 필터
  const [pinned, setPinned] = useState({ classId: false, classNum: false, organization: false, className: false, section: false })

  // ── 메시지 발송 모달
  const [msgModal,    setMsgModal]    = useState(false)
  const [msgTarget,   setMsgTarget]   = useState(null)  // student object
  const [msgStep,     setMsgStep]     = useState(0)      // 0:연락방법설정 1:카테고리 2:템플릿 3:발송편집
  const [msgCategory, setMsgCategory] = useState('')
  const [msgText,     setMsgText]     = useState('')
  const [msgMethod,   setMsgMethod]   = useState('')    // 설정 step에서 선택 중인 값

  const MSG_TEMPLATES = {
    '📋 출석': [
      '[방과후] {이름} 학생이 출석했습니다 ✅',
      '[방과후] {이름} 학생 출석 확인되었습니다.',
    ],
    '❌ 결석': [
      '[방과후] {이름} 학생이 오늘 결석 처리되었습니다.',
      '[방과후] {이름} 학생이 결석입니다. 확인 부탁드립니다.',
      '[방과후] {이름} 학생 — 사전 연락 없는 결석입니다.',
    ],
    '⏰ 지각': [
      '[방과후] {이름} 학생이 지각했습니다.',
      '[방과후] {이름} 학생 수업 시작 후 도착했습니다.',
    ],
    '🏠 수업종료': [
      '[방과후] {이름} 학생 수업이 종료되었습니다. 안전한 귀가 부탁드립니다 🏠',
      '[방과후] {이름} 학생 오늘 수업을 마쳤습니다!',
    ],
    '✏️ 개별메시지': [],
  }

  const applyTpl = (tpl, name) => tpl.replace(/{이름}/g, name || '')

  const openMsgModal = (s) => {
    setMsgTarget(s)
    setMsgCategory('')
    setMsgText('')
    setMsgMethod(s.contactMethod || '')
    // 연락방법 설정되어 있으면 바로 카테고리 선택
    setMsgStep(s.contactMethod ? 1 : 0)
    setMsgModal(true)
  }

  const saveContactMethod = () => {
    if (!msgMethod) { showToast('연락방법을 선택해주세요.'); return }
    StudentsDB.update(msgTarget.id, { contactMethod: msgMethod })
    setMsgTarget(prev => ({ ...prev, contactMethod: msgMethod }))
    refresh()
    showToast('연락방법이 저장되었습니다.')
    setMsgStep(1)
  }

  const sendMsg = () => {
    if (!msgTarget || !msgText.trim()) return
    const phone = (msgTarget.parentPhone || '').replace(/[^0-9]/g, '')
    const method = msgTarget.contactMethod

    if (method === 'sms' || method === 'both') {
      const a = document.createElement('a')
      a.href = `sms:${phone}?body=${encodeURIComponent(msgText)}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }
    if (method === 'kakao' || method === 'both') {
      const kakao = window.Kakao
      if (kakao?.isInitialized()) {
        kakao.Link.sendDefault({
          objectType: 'text', text: msgText,
          link: { mobileWebUrl: window.location.origin, webUrl: window.location.origin },
        })
      } else {
        showToast('카카오 SDK가 초기화되지 않았습니다.')
        return
      }
    }
    showToast(`${msgTarget.name} 학부모에게 메시지를 전송했습니다.`)
    setMsgModal(false)
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const years = [...new Set(classes.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const yearClasses = ctxYear ? classes.filter(c => c.startDate?.startsWith(ctxYear) || c.endDate?.startsWith(ctxYear)) : classes
  const schools = [...new Set(yearClasses.map(c => c.organization).filter(Boolean))]
  const DAY_ORDER_SCH = ['월','화','수','목','금','토','일']
  const schoolDaysMapSch = {}
  yearClasses.forEach(c => {
    if (!c.organization) return
    if (!schoolDaysMapSch[c.organization]) schoolDaysMapSch[c.organization] = new Set()
    ;(c.days || []).forEach(d => schoolDaysMapSch[c.organization].add(d))
  })
  const getSchoolDayLabelSch = (s) => {
    const days = DAY_ORDER_SCH.filter(d => (schoolDaysMapSch[s] || new Set()).has(d))
    return days.length > 0 ? `(${days.join('·')}) ` : ''
  }
  const schoolsSorted = [...schools].sort((a, b) => {
    const ai = DAY_ORDER_SCH.findIndex(d => (schoolDaysMapSch[a]||new Set()).has(d))
    const bi = DAY_ORDER_SCH.findIndex(d => (schoolDaysMapSch[b]||new Set()).has(d))
    const as_ = ai === -1 ? 99 : ai, bs_ = bi === -1 ? 99 : bi
    return as_ !== bs_ ? as_ - bs_ : a.localeCompare(b, 'ko')
  })
  const filteredClasses = sortClasses(ctxSchool ? yearClasses.filter(c => c.organization === ctxSchool) : yearClasses)

  // 과목 드롭다운: 반이 여러 개면 반별로 펼쳐서 옵션 생성 (value: "classId" or "classId::반이름")
  const classOptions = filteredClasses.flatMap(c => {
    const secs = c.sections?.filter(s => s.section) || []
    if (secs.length > 1) {
      return secs.map(s => ({
        value: c.id + '::' + s.section,
        label: c.className + ' ' + s.section + '반',
        classId: c.id,
        section: s.section,
      }))
    }
    return [{ value: c.id, label: c.className + (c.section ? ' ' + c.section + '반' : ''), classId: c.id, section: '' }]
  })

  // ctxClass 파싱: "classId::반이름" 또는 "classId"
  const ctxClassId  = ctxClass.includes('::') ? ctxClass.split('::')[0] : ctxClass
  const ctxClassSec = ctxClass.includes('::') ? ctxClass.split('::')[1] : ''

  const sections = [] // 별도 반 드롭다운 불필요 (과목 드롭다운에 통합)

  // movedToManage: false → 학생등록탭, true 또는 undefined(구버전) → 학생관리탭
  const managedStudents = allStudents.filter(s => s.movedToManage !== false)
  const registerStudents = allStudents.filter(s => s.movedToManage === false)
  const filtered = managedStudents.filter(s => {
    if (ctxYear) {
      const inYear = yearClasses.some(c => s.classIds?.includes(c.id))
      if (!inYear) return false
    }
    if (ctxClassId && !s.classIds?.includes(ctxClassId)) return false
    if (ctxSchool) {
      const actualSchool = (s.classIds || []).map(cid => classes.find(c => c.id === cid)?.organization).filter(Boolean)[0] || s.school || ''
      if (actualSchool !== ctxSchool) return false
    }
    if (ctxClassSec && s.section !== ctxClassSec) return false
    if (statusFilter !== 'all' && s.status !== statusFilter && !(statusFilter === 'cancelled' && (s.status === 'cancel_before' || s.status === 'cancel_after'))) return false
    return true
  }).sort((a, b) => {
    // 정렬: 학교 → 수업/반 → 학년 → 반 → 번호 → 이름
    if (sortOrder === 'name') {
      const DAY_ORDER = ['월','화','수','목','금','토','일']
      // 학교
      const aOrg = (classes.find(c => c.id === a.classIds?.[0])?.organization) || a.school || ''
      const bOrg = (classes.find(c => c.id === b.classIds?.[0])?.organization) || b.school || ''
      const schoolCmp = aOrg.localeCompare(bOrg, 'ko')
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
      const aOrg2 = classes.find(c => c.id === a.classIds?.[0])?.organization || a.school || ''
      const bOrg2 = classes.find(c => c.id === b.classIds?.[0])?.organization || b.school || ''
      const schoolCmp = aOrg2.localeCompare(bOrg2, 'ko')
      if (schoolCmp !== 0) return schoolCmp
      return (aClass?.className || '').localeCompare(bClass?.className || '', 'ko')
    }
    // 신청순/최신순
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return sortOrder === 'asc' ? ta - tb : tb - ta
  })

  const ctxBase = managedStudents.filter(s => {
    if (ctxYear) {
      const inYear = yearClasses.some(c => s.classIds?.includes(c.id))
      if (!inYear) return false
    }
    if (ctxClassId && !s.classIds?.includes(ctxClassId)) return false
    if (ctxSchool) {
      const actualSchool = (s.classIds || []).map(cid => classes.find(c => c.id === cid)?.organization).filter(Boolean)[0] || s.school || ''
      if (actualSchool !== ctxSchool) return false
    }
    if (ctxClassSec && s.section !== ctxClassSec) return false
    return true
  })
  const statusCounts = {
    all:       ctxBase.length,
    applied:   ctxBase.filter(s => s.status === 'applied').length,
    selected:  ctxBase.filter(s => s.status === 'selected').length,
    confirmed: ctxBase.filter(s => s.status === 'confirmed').length,
    waiting:   ctxBase.filter(s => s.status === 'waiting').length,
    cancelled: ctxBase.filter(s => s.status === 'cancelled' || s.status === 'cancel_before' || s.status === 'cancel_after').length,
  }

  const openAdd = () => {
    const cls = classes.find(c => c.id === ctxClassId)
    const curTerm = getCurrentTerm()
    setForm({
      ...emptyStudent(),
      student_careers: [],
      school: ctxSchool || cls?.organization || '',
      classIds: ctxClassId ? [ctxClassId] : (pinned.classId ? form.classIds : []),
      classNum: pinned.classNum ? form.classNum : '',
      section: ctxClassSec || '',
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
    const careersWithCurrent = existingCareers
    // statusHistory에서 스케줄변경 날짜 복원
    const scHistory = (s.statusHistory||[]).slice().reverse().find(h => h.status === 'schedule_change')
    const scDate = scHistory?.memo?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || ''
    // statusHistory에서 전학/전입 날짜 복원
    const trHistory = (s.statusHistory||[]).slice().reverse().find(h =>
      (h.status === 'transfer_out' || h.status === 'transfer_in') && h.memo?.match(/\d{4}-\d{2}-\d{2}/)
    )
    const trDate = trHistory?.memo?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0,10)
    setForm({
      ...s, memo: s.memo || '', applyOrder: s.applyOrder || '', relations: s.relations || [], student_careers: careersWithCurrent,
      schedule_change_date: s.status === 'schedule_change' ? (scDate || new Date().toISOString().slice(0,10)) : '',
      transfer_info: (s.status === 'transfer_out' || s.status === 'transfer_in') ? { date: trDate } : (s.transfer_info || null),
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
      studentStartDate: s.studentStartDate || '',
      studentEndDate:   s.studentEndDate   || '',
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
    // studentStartDate/studentEndDate는 학생 레코드에 저장
    // transfer_info는 Supabase 컬럼 없음 — statusHistory에 날짜 기록 후 반드시 제거
    if (saveData.transfer_info) {
      const tDate = saveData.transfer_info.date || new Date().toISOString().slice(0,10)
      const tStatus = saveData.status === 'transfer_out' ? '전학' : '전입'
      saveData.statusHistory = [...(saveData.statusHistory||[]), { status: saveData.status, changedAt: new Date().toISOString(), memo: `[${tStatus}] ${tDate}` }]
    }
    delete saveData.transfer_info  // 값 유무 상관없이 항상 제거
    // schedule_change_date도 Supabase 컬럼 없음 — statusHistory에 기록 후 반드시 제거
    if (saveData.schedule_change_date) {
      const prevHistory = (saveData.statusHistory||[]).filter(h => h.status !== 'schedule_change')
      saveData.statusHistory = [...prevHistory, { status: 'schedule_change', changedAt: new Date().toISOString(), memo: `[스케줄변경] ${saveData.schedule_change_date}` }]
    }
    delete saveData.schedule_change_date  // 값 유무 상관없이 항상 제거

    if (editId) {
      if (saveData.status === 'cancelled' && !saveData.cancel_info) {
        // 취소 모달 먼저
        StudentsDB.update(editId, saveData)
        setShowModal(false)
        setCancelTarget({ id: editId, name: saveData.name })
        setCancelForm({ type: 'before', date: new Date().toISOString().slice(0,10), memo: '', termNum: null })
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
        movedToManage: false,
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
    const sid = deleteTarget.id

    // 1. 학부모 연결 끊기
    const links = TeacherParentLinks.byTeacher(user.id).filter(l => l.studentId === sid)
    links.forEach(l => TeacherParentLinks.delete && TeacherParentLinks.delete(l.id))

    // 2. 출결 기록 삭제
    const attList = (AttendanceDB.byTeacher ? AttendanceDB.byTeacher(user.id) : []).filter(a => a.studentId === sid)
    attList.forEach(a => AttendanceDB.delete(a.id))

    // 3. 수납 기록 삭제
    const payments = (RevenuePayments.all ? RevenuePayments.all() : []).filter(p => p.studentId === sid)
    payments.forEach(p => RevenuePayments.delete(p.id))

    // 4. 교구 진도 삭제
    const progress = SupplyStudentProgress.byStudent ? SupplyStudentProgress.byStudent(sid) : []
    progress.forEach(p => SupplyStudentProgress.delete(p.id))

    // 5. 진도 로그 삭제
    const logs = SupplyProgressLogs.byStudent ? SupplyProgressLogs.byStudent(sid) : []
    logs.forEach(l => SupplyProgressLogs.delete(l.id))

    // 6. 세션 체크 삭제
    const checks = SupplySessionChecks.byStudent ? SupplySessionChecks.byStudent(sid) : []
    checks.forEach(c => SupplySessionChecks.delete(c.id))

    // 7. 학생 삭제
    StudentsDB.delete(sid)
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
        movedToManage: false,
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

  const selectedCls = classes.find(c => c.id === ctxClassId)

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      {/* 학생 명단 .after 불러오기용 hidden input */}
      <input ref={studentImportRef} type="file" accept=".after" style={{ display:'none' }} onChange={handleImportStudents} />
      <input ref={editImportRef}    type="file" accept=".after" style={{ display:'none' }} onChange={handleEditImport} />

      <PageHeader
        title="학생 관리"
        sub="학교 · 과목 · 반을 먼저 선택하고 학생을 관리하세요."
        right={
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            {mainTab === 'manage' && (
              <>
                <button
                  onClick={() => studentImportRef.current?.click()}
                  style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  📥 학생 불러오기
                </button>
                {ctxClassId && (
                  <button
                    onClick={handleExportStudents}
                    style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #86efac', background:'#f0fdf4', color:'#16a34a', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    📤 학생 내보내기
                  </button>
                )}
                <Btn variant="ghost" onClick={() => onNav('confirm')}>✅ 최종 확정</Btn>
              </>
            )}
          </div>
        }
      />

      {/* 메인 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' }}>
        {[
          { key: 'manage',   label: '📋 학생 관리' },
          { key: 'register', label: '➕ 학생 등록' },
          { key: 'rollover', label: '🔄 텀 이월관리' },
          { key: 'termset',  label: '📌 텀 설정' },
        ].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)} style={{
            padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: mainTab === t.key ? '#f97316' : 'transparent',
            color: mainTab === t.key ? '#fff' : '#6b7280',
            fontSize: '14px', fontWeight: mainTab === t.key ? 700 : 400,
            fontFamily: 'Noto Sans KR, sans-serif',
            borderBottom: mainTab === t.key ? '2px solid #f97316' : '2px solid transparent',
            marginBottom: '-2px', transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

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

      {/* ── 탭1: 학생 관리 */}
      {mainTab === 'manage' && (<>
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
              {schoolsSorted.map(s => <option key={s} value={s}>{getSchoolDayLabelSch(s)}{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>과목 · 반</label>
            <select value={ctxClass} onChange={e => { setCtxClass(e.target.value); setCtxSection('') }} style={selSt}>
              <option value="">전체 과목</option>
              {classOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {(ctxYear || ctxSchool || ctxClassId) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1px' }}>
              {ctxYear && <Tag color="#059669" bg="#ecfdf5" size="md">📅 {ctxYear}년</Tag>}
              {ctxSchool && <Tag color="#3b82f6" bg="#eff6ff" size="md">🏫 {ctxSchool}</Tag>}
              {ctxClassId && selectedCls && <Tag color="#f97316" bg="#fff7ed" size="md">📚 {selectedCls.className}{ctxClassSec ? ' ' + ctxClassSec + '반' : ''}</Tag>}
              <button onClick={() => { setCtxYear(''); setCtxSchool(''); setCtxClass(''); setCtxSection('') }}
                style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>초기화</button>
            </div>
          )}
        </div>
      </div>

      {/* 탭2로 이동 컨트롤 바 */}
      {(() => {
        const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedForRegister.includes(s.id))
        const moveBackToRegister = (ids) => {
          ids.forEach(id => StudentsDB.update(id, { movedToManage: false }))
          setSelectedForRegister(p => p.filter(id => !ids.includes(id)))
          refresh()
          showToast(`${ids.length}명이 학생 등록 탭으로 이동되었습니다.`)
          setMainTab('register')
        }
        return (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
            <input type="checkbox" checked={allFilteredSelected} onChange={e => {
              if (e.target.checked) setSelectedForRegister(filtered.map(s => s.id))
              else setSelectedForRegister([])
            }} style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer' }} />
            <span style={{ fontSize:'13px', color:'#374151' }}>전체 선택</span>
            <select value={classFilterForMove} onChange={e => {
              const cid = e.target.value
              setClassFilterForMove(cid)
              if (cid) {
                const ids = filtered.filter(s => s.classIds?.includes(cid)).map(s => s.id)
                setSelectedForRegister(ids)
              } else {
                setSelectedForRegister([])
              }
            }} style={{ padding:'6px 12px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }}>
              <option value=''>수업 선택하여 체크</option>
              {filteredClasses.flatMap(c => {
                const secs = c.sections?.filter(s => s.section) || []
                if (secs.length > 1) {
                  return secs.map(s => (
                    <option key={c.id + '::' + s.section} value={c.id + '::' + s.section}>
                      {c.organization} · {c.className} {s.section}반
                    </option>
                  ))
                }
                const secLabel = (c.section ? ' ' + c.section + '반' : '')
                return [<option key={c.id} value={c.id}>{c.organization} · {c.className}{secLabel}</option>]
              })}
            </select>
            {selectedForRegister.length > 0 && (
              <button onClick={() => moveBackToRegister(selectedForRegister)}
                style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:'#6366f1', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                선택 {selectedForRegister.length}명 → 학생 등록으로 이동
              </button>
            )}
          </div>
        )
      })()}

      {/* 통계 한줄 + 상태 필터 + 정렬 */}
      {(() => {
        const newStudentCount = registerStudents.length
        const schoolCount = new Set(ctxBase.map(s => (s.classIds||[]).map(cid => classes.find(c=>c.id===cid)?.organization).filter(Boolean)[0] || s.school).filter(Boolean)).size
        const sectionCount = new Set(ctxBase.map(s => {
          const cls = classes.find(c => c.id === s.classIds?.[0])
          return cls ? (cls.className + ((cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')) ? ' '+(cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')) : '')) : null
        }).filter(Boolean)).size
        const sep = <span style={{ color:'#d1d5db', margin:'0 4px' }}>·</span>
        return (
          <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'8px 14px', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb', marginBottom:'12px', flexWrap:'wrap', fontSize:'13px' }}>
            <span style={{ fontWeight:700, color:'#111827' }}>전체 {allStudents.length}명</span>{sep}
            <span style={{ color:'#374151' }}>학생관리 <strong>{managedStudents.length}</strong>명</span>
            <span style={{ fontSize:'12px', color:'#9ca3af' }}>(대기 {statusCounts.waiting} · 확정 {statusCounts.confirmed} · 취소 {statusCounts.cancelled})</span>{sep}
            <span style={{ color:'#f97316' }}>학생등록 <strong>{newStudentCount}</strong>명</span>{sep}
            <span style={{ color:'#374151' }}><strong>{schoolCount}</strong>개 학교</span>{sep}
            <span style={{ color:'#374151' }}><strong>{sectionCount}</strong>개 반</span>
          </div>
        )
      })()}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: `전체 ${statusCounts.all}` },
            { key: 'applied',   label: `신청 ${statusCounts.applied}` },
            { key: 'waiting',   label: `대기 ${statusCounts.waiting}` },
            { key: 'selected',  label: `추첨완료 ${statusCounts.selected}` },
            { key: 'confirmed', label: `확정 ${statusCounts.confirmed}` },
            { key: 'cancelled', label: `취소 ${statusCounts.cancelled}` },
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
          <SyncScrollTable>
                <table style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['', '순번', '학교', '수업 · 반', '학년 / 반 / 번호', '이름', '학부모 전화', '귀가방법', '상태', '진도', '메모', '작업'].map(h => (
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
                  // 학생 개인 section 우선, 없으면 통합카드 전체 반 표시
                  const secLabel = s.section ? s.section + '반' : (cls.sections?.filter(sc=>sc.section).map(sc=>sc.section+'반').join('·') || (cls.section ? cls.section+'반' : ''))
                  return cls.className + (secLabel ? ' ' + secLabel : '')
                }).filter(Boolean)
                // 학교명은 실제 수업 레코드에서 가져옴 (s.school은 캐시라 변경 반영 안 됨)
                const displaySchool = (s.classIds || []).map(cid => classes.find(c => c.id === cid)?.organization).filter(Boolean)[0] || s.school || ''

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: selectedForRegister.includes(s.id) ? '#f5f3ff' : s.id === lastAddedId ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#fafafa', outline: s.id === lastAddedId ? '2px solid #f97316' : 'none', transition: 'background 1s, outline 1s' }}>
                    <td style={{ padding: '11px 14px', textAlign:'center' }}>
                      <input type="checkbox" checked={selectedForRegister.includes(s.id)} onChange={e => {
                        if (e.target.checked) setSelectedForRegister(p => [...p, s.id])
                        else setSelectedForRegister(p => p.filter(id => id !== s.id))
                      }} style={{ width:'15px', height:'15px', accentColor:'#6366f1', cursor:'pointer' }} />
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#9ca3af', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {s.applyOrder
                        ? <span style={{ fontWeight: 700, color: '#f97316', background: '#fff7ed', padding: '2px 7px', borderRadius: '5px', border: '1px solid #fed7aa' }}>{s.applyOrder}</span>
                        : <span style={{ color: '#d1d5db' }}>-</span>
                      }
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{displaySchool}</td>
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
                        <div style={{ display:'flex', flexDirection:'column', gap:'3px', marginTop:'4px' }}>
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
                              {s.status === 'cancel_after' ? '개강후취소' : '개강전취소'}
                              {s.cancel_info?.date && (() => { const [y,m,day]=s.cancel_info.date.split('-'); return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}` })()}
                            </span>
                          )}
                          {s.status === 'schedule_change' && (
                            <span style={{ fontSize:'11px', fontWeight:700, padding:'1px 8px', borderRadius:'5px',
                              background:'#f5f3ff', border:'1px solid #c4b5fd', color:'#7c3aed' }}>
                              📅 스케줄변경
                              {(() => { const h = (s.statusHistory||[]).slice().reverse().find(h => h.status==='schedule_change'); const m = h?.memo?.match(/\d{4}-\d{2}-\d{2}/); if (!m) return null; const [y,mo,d]=m[0].split('-'); return `-${y.slice(2)}.${parseInt(mo)}.${parseInt(d)}` })()}
                            </span>
                          )}
                          {(s.status === 'transfer_out' || s.status === 'transfer_in') && (
                            <span style={{ fontSize:'11px', fontWeight:700, padding:'1px 8px', borderRadius:'5px',
                              background: s.status==='transfer_out'?'#f0f9ff':'#ecfdf5',
                              border: `1px solid ${s.status==='transfer_out'?'#7dd3fc':'#6ee7b7'}`,
                              color: s.status==='transfer_out'?'#0369a1':'#065f46' }}>
                              {s.status === 'transfer_out' ? '전학' : '전입'}
                              {(() => { const h = (s.statusHistory||[]).slice().reverse().find(h => h.status === s.status && h.memo?.startsWith('[전')); const m = h?.memo?.match(/\d{4}-\d{2}-\d{2}/); if (!m) return null; const [y,mo,d] = m[0].split('-'); return `-${y.slice(2)}.${parseInt(mo)}.${parseInt(d)}` })()}
                            </span>
                          )}
                          {s.status === 'extra_applied' && (
                            <span style={{ fontSize:'11px', fontWeight:700, padding:'1px 8px', borderRadius:'5px',
                              background:'#fffbeb', border:'1px solid #fcd34d', color:'#b45309' }}>
                              추가신청
                              {(() => { const h = (s.statusHistory||[]).slice().reverse().find(h => h.status === 'extra_applied'); const m = h?.memo?.match(/\d{4}-\d{2}-\d{2}/); if (!m) return null; const [y,mo,d] = m[0].split('-'); return `-${y.slice(2)}.${parseInt(mo)}.${parseInt(d)}` })()}
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
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      <div>{fmtPhone(s.parentPhone) || '-'}</div>
                      <div style={{ marginTop: '4px' }}>
                        {(() => {
                          const c = s.contactMethod
                          const cfg = c === 'kakao' ? { label:'💛카톡',      bg:'#FEE500', color:'#3c1e1e', border:'#e6c900' }
                                    : c === 'sms'   ? { label:'💬문자',      bg:'#eff6ff', color:'#3b82f6', border:'#bfdbfe' }
                                    : c === 'both'  ? { label:'💬카톡+문자', bg:'#f3f4f6', color:'#4b5563', border:'#d1d5db' }
                                    :                 { label:'📵 연락방법 설정', bg:'#fff', color:'#f97316', border:'#fed7aa' }
                          return (
                            <button onClick={() => openMsgModal(s)}
                              title={c ? '메시지 보내기' : '연락방법 설정 필요'}
                              style={{
                                fontSize:'10px', fontWeight:700,
                                padding:'3px 8px', borderRadius:'5px',
                                background:cfg.bg, color:cfg.color,
                                border:`1.5px solid ${cfg.border}`,
                                cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                                transition:'opacity .15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity='0.75'}
                              onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                              {cfg.label}
                            </button>
                          )
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <HomeReturnCell key={s.id + (s.homeReturn || '')} studentId={s.id} homeReturn={s.homeReturn || ''} onUpdate={refresh} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', flexDirection:'column', gap: '6px' }}>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <select value={displayStatus} onChange={e => {
                            const v = e.target.value
                            setPendingStatuses(p => ({...p, [s.id]: v}))
                            if (v === 'cancel_before' || v === 'cancel_after') {
                              setCancelTarget({ id: s.id, name: s.name, status: v })
                              setCancelForm({ type: v === 'cancel_after' ? 'after' : 'before', date: new Date().toISOString().slice(0,10), memo: '', termNum: null })
                            }
                          }}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${cfg.color}50`, background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer', outline: 'none' }}>
                            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            <option value='cancel_before'>개강전 취소</option>
                            <option value='cancel_after'>개강후 취소</option>
                            <option value='schedule_change'>스케줄변경</option>
                          </select>
                          {pendingStatuses[s.id] !== undefined && pendingStatuses[s.id] !== s.status &&
                           pendingStatuses[s.id] !== 'cancel_before' && pendingStatuses[s.id] !== 'cancel_after' &&
                           pendingStatuses[s.id] !== 'schedule_change' && (
                            <Btn size="sm" onClick={() => {
                              changeStatus(s.id, pendingStatuses[s.id])
                              setPendingStatuses(p => { const n={...p}; delete n[s.id]; return n })
                            }}>저장</Btn>
                          )}
                        </div>
                        {/* 취소 선택 시 인라인 날짜+메모 입력 */}
                        {pendingStatuses[s.id] === 'schedule_change' && (
                          <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'8px 10px', background:'#f5f3ff', borderRadius:'8px', border:'1px solid #c4b5fd' }}>
                            <label style={{ fontSize:'11px', fontWeight:600, color:'#7c3aed' }}>📅 스케줄변경 날짜</label>
                            <input type="date" defaultValue={new Date().toISOString().slice(0,10)}
                              id={`sc-date-${s.id}`}
                              style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid #c4b5fd', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }} />
                            <div style={{ display:'flex', gap:'5px' }}>
                              <button onClick={() => {
                                const scDate = document.getElementById(`sc-date-${s.id}`)?.value || new Date().toISOString().slice(0,10)
                                const st = StudentsDB.find(s.id)
                                StudentsDB.update(s.id, {
                                  status: 'schedule_change',
                                  statusHistory: [...(st?.statusHistory||[]), { status: 'schedule_change', changedAt: now(), memo: `[스케줄변경] ${scDate}` }],
                                })
                                setPendingStatuses(p=>{const n={...p};delete n[s.id];return n})
                                refresh()
                                showToast('스케줄변경 처리가 완료되었습니다.')
                              }} style={{ flex:1, padding:'5px', borderRadius:'6px', border:'none', background:'#7c3aed', color:'#fff', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>확인</button>
                              <button onClick={() => setPendingStatuses(p=>{const n={...p};delete n[s.id];return n})}
                                style={{ padding:'5px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
                            </div>
                          </div>
                        )}
                        {cancelTarget?.id === s.id && (pendingStatuses[s.id] === 'cancel_before' || pendingStatuses[s.id] === 'cancel_after') && (
                          <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'8px 10px', background:'#fef2f2', borderRadius:'8px', border:'1px solid #fca5a5' }}>
                            {pendingStatuses[s.id] === 'cancel_after' && (() => {
                              const cls = classes.find(c => s.classIds?.includes(c.id))
                              const termSizes = cls?.periods?.length > 0
                                ? cls.periods.flatMap(p => (p.termSizes?.length > 0) ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n)||4) : Array(Number(p.termCount)||1).fill(4))
                                : (cls?.termSizes?.length > 0) ? cls.termSizes.slice(0, cls.termCount||cls.termSizes.length).map(n => Number(n)||4) : [cls?.termSize ? Number(cls.termSize) : 4]
                              const totalTerms = termSizes.length
                              return (
                                <select value={cancelForm.termNum ?? ''} onChange={e => setCancelForm(f=>({...f, termNum: e.target.value ? Number(e.target.value) : null}))}
                                  style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid #fca5a5', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                                  <option value=''>텀 선택</option>
                                  {Array.from({ length: totalTerms }, (_, i) => (
                                    <option key={i+1} value={i+1}>{i+1}텀</option>
                                  ))}
                                </select>
                              )
                            })()}
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
                                  cancel_info: {
                                    type: cancelForm.type,
                                    date: cancelForm.date,
                                    memo: cancelForm.memo,
                                    termNum: cancelForm.termNum ?? null,
                                  },
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
          </SyncScrollTable>
        </div>
      )}

      </>)}


      {/* ── 탭3: 다음 텀 이월 */}
      {mainTab === 'rollover' && (
        <RolloverTab
          classes={classes}
          toastError={toastError}
          showToast={showToast}
          refresh={refresh}
          tick={tick}
        />
      )}

      {/* ── 탭4: 텀 설정 */}
      {mainTab === 'termset' && (
        <TermSetTab
          classes={classes}
          toastError={toastError}
          showToast={showToast}
          refresh={refresh}
          tick={tick}
        />
      )}

      {/* ── 탭2: 학생 등록 */}
      {mainTab === 'register' && (() => {
        const newStudents = [...registerStudents].sort((a,b) => {
          // 수업반 (A반→B반) 오름차순
          const aClass = classes.find(c => c.id === a.classIds?.[0])
          const bClass = classes.find(c => c.id === b.classIds?.[0])
          const sectionCmp = (aClass?.section || '').localeCompare(bClass?.section || '', 'ko')
          if (sectionCmp !== 0) return sectionCmp
          // 학년 오름차순
          const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
          if (gradeCmp !== 0) return gradeCmp
          // 학급반 오름차순
          const classNumCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
          if (classNumCmp !== 0) return classNumCmp
          // 번호 오름차순
          return parseInt(a.number||'0') - parseInt(b.number||'0')
        })
        const allNewSelected = newStudents.length > 0 && newStudents.every(s => selectedForMove.includes(s.id))
        const moveToManage = (ids) => {
          ids.forEach(id => StudentsDB.update(id, { movedToManage: true }))
          setSelectedForMove(p => p.filter(id => !ids.includes(id)))
          refresh()
          showToast(`${ids.length}명이 학생 관리로 이동되었습니다.`)
        }
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {/* 등록 카드 */}
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
              <div onClick={openAdd} style={{ flex:1, minWidth:'200px', padding:'24px', borderRadius:'16px', border:'2px dashed #f97316', background:'#fff7ed', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#ffedd5'; e.currentTarget.style.borderColor='#ea580c'}}
                onMouseLeave={e=>{e.currentTarget.style.background='#fff7ed'; e.currentTarget.style.borderColor='#f97316'}}>
                <span style={{ fontSize:'36px' }}>👤</span>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#ea580c' }}>학생 단건 등록</div>
                  <div style={{ fontSize:'12px', color:'#9a3412', marginTop:'3px' }}>학생 정보를 직접 입력하여 등록합니다</div>
                </div>
              </div>
              <div onClick={() => studentImportRef.current?.click()} style={{ flex:1, minWidth:'200px', padding:'24px', borderRadius:'16px', border:'2px dashed #3b82f6', background:'#eff6ff', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#dbeafe'; e.currentTarget.style.borderColor='#2563eb'}}
                onMouseLeave={e=>{e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.borderColor='#3b82f6'}}>
                <span style={{ fontSize:'36px' }}>📥</span>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#2563eb' }}>학생 불러오기</div>
                  <div style={{ fontSize:'12px', color:'#1e40af', marginTop:'3px' }}>.after 파일로 학생을 불러옵니다</div>
                </div>
              </div>
              <div onClick={() => { setExcelStep(0); setExcelClassId(''); setShowExcel(true) }} style={{ flex:1, minWidth:'200px', padding:'24px', borderRadius:'16px', border:'2px dashed #16a34a', background:'#f0fdf4', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#dcfce7'; e.currentTarget.style.borderColor='#15803d'}}
                onMouseLeave={e=>{e.currentTarget.style.background='#f0fdf4'; e.currentTarget.style.borderColor='#16a34a'}}>
                <span style={{ fontSize:'36px' }}>📊</span>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#15803d' }}>엑셀 대량 업로드</div>
                  <div style={{ fontSize:'12px', color:'#166534', marginTop:'3px' }}>엑셀 파일로 학생을 일괄 등록합니다</div>
                </div>
              </div>
            </div>

            {/* 등록된 학생 확인 리스트 */}
            <div style={{ background:'#fff', borderRadius:'14px', border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid #e5e7eb', background:'#f9fafb' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <input type="checkbox" checked={allNewSelected} onChange={e => {
                    if (e.target.checked) setSelectedForMove(newStudents.map(s => s.id))
                    else setSelectedForMove([])
                  }} style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer' }} />
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>
                    새로 등록된 학생 <span style={{ color:'#f97316' }}>{newStudents.length}명</span>
                  </span>
                  {selectedForMove.length > 0 && (
                    <span style={{ fontSize:'12px', color:'#6b7280' }}>({selectedForMove.length}명 선택됨)</span>
                  )}
                </div>
                {selectedForMove.length > 0 && (
                  <button onClick={() => moveToManage(selectedForMove)}
                    style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    선택 {selectedForMove.length}명 → 학생 관리로 이동
                  </button>
                )}
              </div>
              {newStudents.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>등록된 학생이 없습니다. 위에서 학생을 등록해주세요.</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                      {['', '학교', '수업·반', '학년/반/번호', '이름', '학부모 전화', '작업'].map(h => (
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {newStudents.map((s, i) => {
                      const sClasses = (s.classIds||[]).map(cid => {
                        const cls = classes.find(c => c.id === cid)
                        if (!cls) return null
                        const secLabel = s.section ? s.section + '반' : (cls.sections?.filter(sc=>sc.section).map(sc=>sc.section+'반').join('·') || (cls.section ? cls.section+'반' : ''))
                        return cls.className + (secLabel ? ' ' + secLabel : '')
                      }).filter(Boolean)
                      const displaySchool = (s.classIds||[]).map(cid => classes.find(c=>c.id===cid)?.organization).filter(Boolean)[0] || s.school || ''
                      const isChecked = selectedForMove.includes(s.id)
                      return (
                        <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6', background: isChecked ? '#fff7ed' : i%2===0?'#fff':'#fafafa' }}>
                          <td style={{ padding:'10px 14px' }}>
                            <input type="checkbox" checked={isChecked} onChange={e => {
                              if (e.target.checked) setSelectedForMove(p => [...p, s.id])
                              else setSelectedForMove(p => p.filter(id => id !== s.id))
                            }} style={{ width:'15px', height:'15px', accentColor:'#f97316', cursor:'pointer' }} />
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:'13px', color:'#6b7280', whiteSpace:'nowrap' }}>{displaySchool}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                              {sClasses.map(c => <Tag key={c} color="#6b7280" bg="#f3f4f6">{c}</Tag>)}
                            </div>
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:'13px', color:'#374151', whiteSpace:'nowrap' }}>
                            <span>{s.grade ? s.grade+'학년' : '-'}</span>
                            {s.classNum && <span style={{ marginLeft:'4px', padding:'1px 7px', borderRadius:'5px', background:'#f0fdf4', color:'#16a34a', fontWeight:600, fontSize:'12px' }}>{s.classNum}반</span>}
                            {s.number && <span style={{ marginLeft:'4px', color:'#9ca3af', fontSize:'12px' }}>{s.number}번</span>}
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:700, color:'#111827' }}>{s.name}</td>
                          <td style={{ padding:'10px 14px', fontSize:'13px', color:'#374151' }}>{s.parentPhone || '-'}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <div style={{ display:'flex', gap:'6px' }}>
                              <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>편집</Btn>
                              <button onClick={() => moveToManage([s.id])}
                                style={{ padding:'5px 10px', borderRadius:'6px', border:'none', background:'#f97316', color:'#fff', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                                관리로 이동 →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      })()}

      {/* 학생 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '학생 정보 편집' : '학생 등록'} width={580}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* ══ 위쪽: 수업 정보 ══ */}
          <div style={{ background: '#fffbf5', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '16px 18px', marginBottom: '2px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', marginBottom: '12px', letterSpacing: '0.05em' }}>📚 수업 정보</div>

            {/* 등록된 수업 선택 버튼 — 편집 시에만 표시 */}
            {editId && classes.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#ea580c', fontWeight: 600 }}>📚 수강할 수업 선택 (복수 선택 가능)</div>
                </div>
                <select
                  value={form.classIds?.[0] || ''}
                  onChange={e => {
                    const cid = e.target.value
                    const cls = ClassesDB.byTeacher(user.id).find(c => c.id === cid)
                    set('classIds', cid ? [cid] : [])
                    set('section', '')
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
                      {c.organization} · {c.className} {c.days?.length ? '('+c.days.join('')+' '+c.time+')' : ''}
                    </option>
                  ))}
                </select>
                {/* 선택한 수업에 반이 여러 개면 반 선택 드롭다운 표시 */}
                {(() => {
                  const selCls = classes.find(c => c.id === (form.classIds?.[0] || ''))
                  const secs = selCls?.sections?.filter(s => s.section) || []
                  if (secs.length < 2) return null
                  return (
                    <select
                      value={form.section || ''}
                      onChange={e => set('section', e.target.value)}
                      style={{ width:'100%', marginTop:'8px', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #f97316', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff7ed', color:'#c2410c', outline:'none', cursor:'pointer', fontWeight:600 }}>
                      <option value=''>-- 반 선택 --</option>
                      {secs.map(s => (
                        <option key={s.section} value={s.section}>{s.section}반 ({s.time}{s.timeEnd ? ' ~ ' + s.timeEnd : ''})</option>
                      ))}
                    </select>
                  )
                })()}
              </div>
            )}

            {/* 수업 직접 입력 */}
            {(
              <div style={{ borderTop: editId && classes.length > 0 ? '1px dashed #fcd34d' : 'none', paddingTop: editId && classes.length > 0 ? '12px' : '0' }}>
                {editId && classes.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
                    — 또는 새 수업 정보 직접 입력 (저장 시 수업 자동 등록) —
                  </div>
                )}
                {/* 학교명 / 수업명 / 반 — 기존 데이터 드롭다운 + 직접입력 병행 */}
                {(() => {
                  const allClasses = ClassesDB.byTeacher(user.id)
                  const DAY=['월','화','수','목','금','토','일']
                  const orgMinDay = (org) => { const d=allClasses.filter(c=>c.organization===org).map(c=>DAY.indexOf(c.days?.[0]??'')).filter(i=>i!==-1); return d.length?Math.min(...d):99 }
                  const orgs = [...new Set(allClasses.map(c => c.organization).filter(Boolean))].sort((a,b)=>orgMinDay(a)-orgMinDay(b)||a.localeCompare(b,'ko'))
                  const classNames = [...new Set(allClasses.filter(c => !form._newOrganization || c.organization === form._newOrganization).map(c => c.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))
                  const sections  = [...new Set(allClasses.filter(c => (!form._newOrganization || c.organization === form._newOrganization) && (!form._newClassName || c.className === form._newClassName)).flatMap(c => c.sections?.length>0 ? c.sections.map(s=>s.section).filter(Boolean) : c.section ? [c.section] : []))].sort((a,b)=>a.localeCompare(b,'ko'))

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
                    const sections = [...new Set(allClasses.filter(c => (!form._newOrganization || c.organization === form._newOrganization) && (!form._newClassName || c.className === form._newClassName)).flatMap(c => c.sections?.length>0 ? c.sections.map(s=>s.section).filter(Boolean) : c.section ? [c.section] : []))].sort((a,b)=>a.localeCompare(b,'ko'))
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
                  <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                    <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>수업 시작일</label>
                    <Input value={form._newStartDate} onChange={v => set('_newStartDate', v)} type="date" />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                    <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>수업 종료일</label>
                    <Input value={form._newEndDate} onChange={v => set('_newEndDate', v)} type="date" />
                  </div>
                </div>
                {/* 분기 선택 — 수업이 매칭되고 periods가 있을 때 */}
                {(() => {
                  const matchedCls = form.classIds?.[0]
                    ? classes.find(c => c.id === form.classIds[0])
                    : classes.find(c =>
                        c.organization === form._newOrganization?.trim() &&
                        c.className === form._newClassName?.trim() &&
                        (!form._newSection || c.section === form._newSection?.trim())
                      )
                  const termType = matchedCls?.termType || 'semester'
                  const isSemester = termType === 'semester'
                  const periods = matchedCls?.periods?.filter(p => p.startDate && p.endDate) || []
                  const termLabel = isSemester ? '학기' : '분기'

                  // periods 없는 학기제: 수업 startDate~endDate 기준으로 1학기/2학기 표시
                  const fallbackPeriods = periods.length === 0 && matchedCls ? (() => {
                    if (isSemester) {
                      return [
                        { label: `1학기`, startDate: matchedCls.startDate || '', endDate: '' },
                        { label: `2학기`, startDate: '', endDate: matchedCls.endDate || '' },
                      ].filter(p => p.startDate || p.endDate)
                    }
                    return []
                  })() : []

                  const displayPeriods = periods.length > 0
                    ? periods.map((p, i) => ({ label: `${i+1}${termLabel} (${p.startDate} ~ ${p.endDate})`, startDate: p.startDate, endDate: p.endDate }))
                    : fallbackPeriods

                  if (displayPeriods.length === 0) return null
                  return (
                    <div style={{ marginTop:'10px', padding:'12px 14px', background:'#eff6ff', borderRadius:'10px', border:'1.5px solid #bfdbfe' }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#1d4ed8', marginBottom:'10px' }}>📅 이 학생의 시작 {termLabel} 선택</div>
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {displayPeriods.map((p, i) => {
                          const isSelected = form.studentStartDate === p.startDate
                          return (
                            <button key={i} type="button"
                              onClick={() => { set('studentStartDate', p.startDate); set('studentEndDate', p.endDate) }}
                              style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:isSelected?700:400,
                                border:`1.5px solid ${isSelected?'#2563eb':'#bfdbfe'}`,
                                background:isSelected?'#2563eb':'#fff',
                                color:isSelected?'#fff':'#374151',
                                cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                              {p.label}
                            </button>
                          )
                        })}
                        {form.studentStartDate && (
                          <button type="button" onClick={() => { set('studentStartDate', ''); set('studentEndDate', '') }}
                            style={{ padding:'7px 10px', borderRadius:'8px', fontSize:'12px', border:'1.5px solid #e5e7eb', background:'#fff', color:'#9ca3af', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            선택 해제
                          </button>
                        )}
                      </div>
                      {form.studentStartDate && (
                        <div style={{ marginTop:'8px', fontSize:'12px', color:'#2563eb', fontWeight:600 }}>
                          ✅ {form.studentStartDate} 부터 시작
                        </div>
                      )}
                    </div>
                  )
                })()}
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
              <div style={{ position:'relative' }}>
                <Input label="이름" value={form.name} onChange={v => { set('name', v); }} required />
                {/* 이름+전화 자동완성 힌트 */}
                {!editId && form.name.trim().length >= 1 && (() => {
                  const nameMatches = allStudents.filter(s =>
                    s.name.includes(form.name.trim()) &&
                    (!form.parentPhone || s.parentPhone?.replace(/[^0-9]/g,'').includes(form.parentPhone.replace(/[^0-9]/g,'')))
                  ).slice(0, 5)
                  if (nameMatches.length === 0) return null
                  return (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:200, background:'#fff', border:'1.5px solid #f97316', borderRadius:'10px', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', marginTop:'2px', overflow:'hidden' }}>
                      <div style={{ padding:'6px 10px', fontSize:'11px', color:'#f97316', fontWeight:700, background:'#fff7ed', borderBottom:'1px solid #fed7aa' }}>📋 기존 학생 — 선택하면 자동 입력</div>
                      {nameMatches.map(s => {
                        const cls = classes.find(c => c.id === s.classIds?.[0])
                        const careers = (s.student_careers || []).slice().sort((a,b) => a.year!==b.year?a.year-b.year:Number(a.term)-Number(b.term))
                        return (
                          <div key={s.id} onClick={() => {
                            set('name', s.name)
                            set('parentPhone', s.parentPhone || '')
                            set('studentPhone', s.studentPhone || '')
                            set('grade', s.grade || '')
                            set('classNum', s.classNum || '')
                            set('memo', s.memo || '')
                            set('student_careers', s.student_careers || [])
                          }}
                            style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:'8px' }}
                            onMouseEnter={e => e.currentTarget.style.background='#fff7ed'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                            <div style={{ flex:1 }}>
                              <span style={{ fontWeight:700, fontSize:'14px', color:'#111827' }}>{s.name}</span>
                              <span style={{ marginLeft:'8px', fontSize:'12px', color:'#6b7280' }}>{s.grade ? s.grade+'학년' : ''} {fmtPhone(s.parentPhone)}</span>
                              {cls && <span style={{ marginLeft:'6px', fontSize:'11px', color:'#9ca3af' }}>{cls.organization} {cls.className}</span>}
                            </div>
                            {careers.length > 0 && (
                              <span style={{ fontSize:'11px', color:'#f97316', background:'#fff7ed', padding:'2px 6px', borderRadius:'5px', fontWeight:600, whiteSpace:'nowrap' }}>
                                {careers.length}회 수강
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
              <Input label="신청 순번" value={form.applyOrder} onChange={v => set('applyOrder', v)} />
              <Input label="학부모 전화번호" value={form.parentPhone} onChange={v => set('parentPhone', formatPhoneInput(v))} />
              <Input label="학생 전화번호" value={form.studentPhone} onChange={v => set('studentPhone', formatPhoneInput(v))} />
              <Select label="📱 주연락방법" value={form.contactMethod} onChange={v => set('contactMethod', v)}
                options={[
                  { value: '',      label: '미설정' },
                  { value: 'sms',   label: '💬 문자' },
                  { value: 'kakao', label: '💛 카카오톡' },
                  { value: 'both',  label: '💬💛 둘 다' },
                ]} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Select label="📨 출결초대 발송" value={form.parentInviteSentAt ? 'sent' : 'not_sent'} onChange={v => set('parentInviteSentAt', v === 'sent' ? (form.parentInviteSentAt || new Date().toISOString()) : '')}
                options={[
                  { value: 'not_sent', label: '발송 전' },
                  { value: 'sent',     label: '✅ 발송 완료' },
                ]} />
              <Select label="👨‍👩‍👧 학부모 앱 가입" value={form.parentJoined ? 'on' : 'off'} onChange={v => set('parentJoined', v === 'on')}
                options={[
                  { value: 'off', label: '⭕ 출결 OFF (미가입)' },
                  { value: 'on',  label: '✅ 출결 ON (가입)' },
                ]} />
            </div>
            {/* 귀가방법 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>🚌 귀가방법</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={form.homeReturn?.startsWith('학원') ? '학원' : (form.homeReturn || '')}
                  onChange={e => {
                    const v = e.target.value
                    if (v !== '학원') set('homeReturn', v)
                    else set('homeReturn', '학원')
                  }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                  <option value="">미설정</option>
                  <option value="학원">🏫 학원</option>
                  <option value="돌봄">🏠 돌봄</option>
                  <option value="늘봄">🌅 늘봄</option>
                  <option value="픽업">🚗 픽업</option>
                  <option value="직접귀가">🚶 직접귀가</option>
                </select>
                {(form.homeReturn?.startsWith('학원')) && (
                  <input
                    value={form.homeReturn?.startsWith('학원-') ? form.homeReturn.slice(3) : ''}
                    onChange={e => set('homeReturn', e.target.value.trim() ? `학원-${e.target.value}` : '학원')}
                    placeholder="학원명 입력"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #bfdbfe', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}
                  />
                )}
                {form.homeReturn && (
                  <button onClick={() => set('homeReturn', '')}
                    style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                )}
              </div>
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
                  <option value='schedule_change'>스케줄변경</option>
                </select>
                {(form.status === 'cancel_before' || form.status === 'cancel_after') && (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'5px' }}>
                    {form.status === 'cancel_after' && (() => {
                      const cls = classes.find(c => form.classIds?.includes(c.id))
                      const termSizes = cls?.periods?.length > 0
                        ? cls.periods.flatMap(p => (p.termSizes?.length > 0) ? p.termSizes.slice(0, p.termCount||p.termSizes.length).map(n => Number(n)||4) : Array(Number(p.termCount)||1).fill(4))
                        : (cls?.termSizes?.length > 0) ? cls.termSizes.slice(0, cls.termCount||cls.termSizes.length).map(n => Number(n)||4) : [cls?.termSize ? Number(cls.termSize) : 4]
                      const totalTerms = termSizes.length
                      return (
                        <select value={form.cancel_info?.termNum ?? ''} onChange={e => set('cancel_info', { ...form.cancel_info, termNum: e.target.value ? Number(e.target.value) : null })}
                          style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                          <option value=''>텀 선택</option>
                          {Array.from({ length: totalTerms }, (_, i) => (
                            <option key={i+1} value={i+1}>{i+1}텀</option>
                          ))}
                        </select>
                      )
                    })()}
                    <input type="date" value={form.cancel_info?.date || new Date().toISOString().slice(0,10)}
                      onChange={e => set('cancel_info', { ...form.cancel_info, type: form.status==='cancel_after'?'after':'before', date: e.target.value, memo: form.cancel_info?.memo||'' })}
                      style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                    <textarea value={form.cancel_info?.memo || ''} placeholder="취소 사유"
                      onChange={e => set('cancel_info', { ...form.cancel_info, type: form.status==='cancel_after'?'after':'before', date: form.cancel_info?.date||new Date().toISOString().slice(0,10), memo: e.target.value })}
                      rows={2} style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', resize:'none' }} />
                  </div>
                )}
                {(form.status === 'transfer_out' || form.status === 'transfer_in') && (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'5px' }}>
                    <label style={{ fontSize:'12px', color:'#0369a1', fontWeight:600 }}>
                      {form.status === 'transfer_out' ? '전학 날짜' : '전입 날짜'}
                    </label>
                    <input type="date" value={form.transfer_info?.date || new Date().toISOString().slice(0,10)}
                      onChange={e => set('transfer_info', { ...form.transfer_info, date: e.target.value })}
                      style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #7dd3fc', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                  </div>
                )}
                {form.status === 'schedule_change' && (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'5px' }}>
                    <label style={{ fontSize:'12px', color:'#7c3aed', fontWeight:600 }}>📅 스케줄변경 날짜</label>
                    <input type="date" value={form.schedule_change_date || new Date().toISOString().slice(0,10)}
                      onChange={e => set('schedule_change_date', e.target.value)}
                      style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #c4b5fd', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                  </div>
                )}
                {form.status === 'extra_applied' && (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'5px' }}>
                    <label style={{ fontSize:'12px', color:'#b45309', fontWeight:600 }}>추가신청 날짜</label>
                    <input type="date" value={form.transfer_info?.date || new Date().toISOString().slice(0,10)}
                      onChange={e => set('transfer_info', { ...form.transfer_info, date: e.target.value })}
                      style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #fcd34d', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px', marginTop: '4px', borderTop: '1px solid #e5e7eb' }}>
            {editId && (
              <div style={{ display:'flex', gap:'8px', marginRight:'auto' }}>
                <button onClick={() => {
                  const s = StudentsDB.byTeacher(user.id).find(x => x.id === editId)
                  if (!s) return
                  setExportTargetStudent(s)
                  setShowExportModal(true)
                }} style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #86efac', background:'#f0fdf4', color:'#16a34a', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  📤 내보내기
                </button>
                <button onClick={() => editImportRef.current?.click()}
                  style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #bfdbfe', background:'#eff6ff', color:'#2563eb', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  📥 불러오기
                </button>
              </div>
            )}
            {!editId && (
              <button onClick={() => studentImportRef.current?.click()}
                style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #bfdbfe', background:'#eff6ff', color:'#2563eb', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', marginRight:'auto' }}>
                📥 불러오기
              </button>
            )}
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

          {/* 개강후 취소 시 텀 선택 */}
          {cancelForm.type === 'after' && (() => {
            const s = StudentsDB.find(cancelTarget?.id)
            const cls = classes.find(c => s?.classIds?.includes(c.id))
            const termSizes = cls?.periods?.length > 0
              ? cls.periods.flatMap(p => (p.termSizes?.length > 0) ? p.termSizes.slice(0, p.termCount||p.termSizes.length).map(n => Number(n)||4) : Array(Number(p.termCount)||1).fill(4))
              : (cls?.termSizes?.length > 0) ? cls.termSizes.slice(0, cls.termCount||cls.termSizes.length).map(n => Number(n)||4) : [cls?.termSize ? Number(cls.termSize) : 4]
            const totalTerms = termSizes.length
            return (
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', display:'block', marginBottom:'6px' }}>취소 텀</label>
                <select value={cancelForm.termNum ?? ''} onChange={e => setCancelForm(f => ({ ...f, termNum: e.target.value ? Number(e.target.value) : null }))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                  <option value=''>텀 선택</option>
                  {Array.from({ length: totalTerms }, (_, i) => (
                    <option key={i+1} value={i+1}>{i+1}텀</option>
                  ))}
                </select>
              </div>
            )
          })()}

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
                cancel_info: {
                  type: cancelForm.type,
                  date: cancelForm.date,
                  memo: cancelForm.memo,
                  termNum: cancelForm.termNum ?? null,
                },
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
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>아래 데이터가 함께 삭제됩니다.</p>
        <ul style={{ fontSize: '13px', color: '#374151', marginBottom: '12px', paddingLeft: '18px', lineHeight: '1.8' }}>
          <li>출결 기록</li>
          <li>수납 기록</li>
          <li>교구 진도 기록</li>
          <li>학부모 연결 정보</li>
        </ul>
        <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '20px' }}>삭제 후 복구할 수 없습니다.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>취소</Btn>
          <Btn variant="danger" onClick={deleteStudent}>삭제</Btn>
        </div>
      </Modal>

      {/* 내보내기 필드 선택 모달 */}
      <Modal open={showExportModal} onClose={() => setShowExportModal(false)} title="📤 내보내기 항목 선택" width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ fontSize:'13px', color:'#6b7280', padding:'10px 14px', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb' }}>
            내보낼 항목을 선택하세요. 선택한 항목만 파일에 포함됩니다.
          </div>
          {/* 전체 선택/해제 */}
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setExportFields(f => Object.fromEntries(Object.keys(f).map(k => [k, true])))}
              style={{ padding:'6px 14px', borderRadius:'7px', border:'1.5px solid #f97316', background:'#fff7ed', color:'#f97316', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              전체 선택
            </button>
            <button onClick={() => setExportFields(f => Object.fromEntries(Object.keys(f).map(k => [k, k === 'name' || k === 'grade'])))}
              style={{ padding:'6px 14px', borderRadius:'7px', border:'1.5px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              필수만
            </button>
          </div>
          {/* 항목 체크박스 */}
          {(() => {
            const sections = [
              {
                title: '🏫 학교 정보',
                items: [
                  { key:'school',            label:'학교' },
                  { key:'section',           label:'수업 반 (A반/B반)' },
                ]
              },
              {
                title: '📅 수업 정보',
                items: [
                  { key:'activeTerm',        label:'현재 텀' },
                  { key:'student_careers',   label:'📅 학생 경력' },
                  { key:'status',            label:'수강 상태' },
                  { key:'classStartDate',    label:'수업 시작일' },
                  { key:'classEndDate',      label:'수업 종료일' },
                  { key:'studentStartDate',  label:'이 학생의 시작 분기 선택' },
                  { key:'studentEndDate',    label:'이 학생의 분기 종료일' },
                  { key:'cancel_info',       label:'취소 정보' },
                  { key:'statusHistory',     label:'상태 변경 이력' },
                ]
              },
              {
                title: '👤 학생 정보',
                items: [
                  { key:'name',              label:'이름' },
                  { key:'grade',             label:'학년' },
                  { key:'classNum',          label:'학급 반' },
                  { key:'number',            label:'번호' },
                  { key:'applyOrder',        label:'신청 순번' },
                  { key:'createdAt',         label:'신청일' },
                  { key:'parentPhone',       label:'학부모 전화번호' },
                  { key:'studentPhone',      label:'학생 전화번호' },
                  { key:'contactMethod',     label:'📱 주연락방법' },
                  { key:'homeReturn',        label:'귀가방법' },
                  { key:'memo',              label:'📌 특이사항 메모' },
                  { key:'remark',            label:'비고' },
                  { key:'parentInviteSentAt',label:'📨 출결초대 발송' },
                  { key:'parentJoined',      label:'👨‍👩‍👧 학부모 앱 가입' },
                  { key:'relations',         label:'👨‍👩‍👧‍👦 가족 관계' },
                ]
              },
            ]
            return sections.map(sec => (
              <div key={sec.title} style={{ marginBottom:'12px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#9ca3af', marginBottom:'6px', letterSpacing:'0.05em' }}>{sec.title}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                  {sec.items.map(({ key, label }) => (
                    <label key={key} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', borderRadius:'8px',
                      background: exportFields[key] ? '#fff7ed' : '#f9fafb',
                      border: `1px solid ${exportFields[key] ? '#fed7aa' : '#e5e7eb'}`,
                      cursor:'pointer', userSelect:'none' }}>
                      <input type="checkbox" checked={!!exportFields[key]}
                        onChange={e => setExportFields(f => ({ ...f, [key]: e.target.checked }))}
                        style={{ accentColor:'#f97316', width:'15px', height:'15px', cursor:'pointer' }} />
                      <span style={{ fontSize:'13px', color: exportFields[key] ? '#c2410c' : '#6b7280', fontWeight: exportFields[key] ? 600 : 400 }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          })()}
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', paddingTop:'4px', borderTop:'1px solid #e5e7eb' }}>
            <Btn variant="ghost" onClick={() => setShowExportModal(false)}>취소</Btn>
            <Btn onClick={() => doExport(exportFields)}>📤 내보내기</Btn>
          </div>
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
                      {c.organization ? `${c.organization} · ` : ''}{c.className}{((c.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (c.section ? c.section+'반' : ''))) ? ' '+(c.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (c.section ? c.section+'반' : '')) : ''}{c.days?.length ? ` (${c.days.join('')})` : ''}
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

      {/* ── 메시지 발송 모달 ── */}
      <Modal open={msgModal} onClose={() => setMsgModal(false)}
        title={`📨 ${msgTarget?.name || ''} 학부모 메시지`} width={460}>
        {msgTarget && (() => {

          /* ──────────────────────────────────────
             Step 0 : 연락방법 설정 (미설정 시에만)
          ────────────────────────────────────── */
          if (msgStep === 0) return (
            <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              <div style={{ padding:'12px 14px', background:'#fff7ed', borderRadius:'10px', border:'1px solid #fed7aa', fontSize:'13px', color:'#92400e', lineHeight:1.6 }}>
                ⚠️ <strong>{msgTarget.name}</strong> 학부모의 연락방법이 설정되어 있지 않습니다.<br/>
                메시지 발송 방법을 선택해 저장하면 다음부터 자동 적용됩니다.
              </div>
              <div>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📱 연락방법 선택</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {[
                    { value:'kakao', label:'💛 카카오톡', desc:'카카오 링크로 발송',   bg:'#FEE500', color:'#3c1e1e', border:'#e6c900' },
                    { value:'sms',   label:'💬 문자 (SMS)', desc:'기본 문자 앱으로 발송', bg:'#eff6ff', color:'#3b82f6', border:'#bfdbfe' },
                    { value:'both',  label:'💬 카카오톡 + 문자', desc:'두 가지 모두 발송',  bg:'#f3f4f6', color:'#4b5563', border:'#d1d5db' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setMsgMethod(opt.value)}
                      style={{
                        padding:'12px 14px', borderRadius:'10px', textAlign:'left',
                        border:`2px solid ${msgMethod===opt.value ? opt.border : '#e5e7eb'}`,
                        background: msgMethod===opt.value ? opt.bg : '#fff',
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                        transition:'all .15s',
                        display:'flex', alignItems:'center', gap:'10px',
                      }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color: msgMethod===opt.value ? opt.color : '#374151' }}>{opt.label}</span>
                      <span style={{ fontSize:'12px', color:'#9ca3af', marginLeft:'auto' }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={saveContactMethod}
                disabled={!msgMethod}
                style={{
                  padding:'13px', borderRadius:'10px', border:'none',
                  background: msgMethod ? '#f97316' : '#e5e7eb',
                  color: msgMethod ? '#fff' : '#9ca3af',
                  fontSize:'14px', fontWeight:700,
                  cursor: msgMethod ? 'pointer' : 'not-allowed',
                  fontFamily:'Noto Sans KR, sans-serif',
                }}>
                저장 후 메시지 작성 →
              </button>
            </div>
          )

          /* ──────────────────────────────────────
             Step 1 : 카테고리 선택
          ────────────────────────────────────── */
          if (msgStep === 1) {
            const method = msgTarget.contactMethod
            const mLabel = method==='kakao'?'💛카톡' : method==='sms'?'💬문자' : '💬카톡+문자'
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div style={{ padding:'8px 12px', background:'#f9fafb', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'12px', color:'#6b7280', display:'flex', gap:'10px', alignItems:'center' }}>
                  <span>발송방법: <strong style={{ color:'#374151' }}>{mLabel}</strong></span>
                  <span style={{ marginLeft:'auto' }}>{fmtPhone(msgTarget.parentPhone)}</span>
                </div>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>어떤 유형의 메시지를 보낼까요?</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                    {Object.keys(MSG_TEMPLATES).map(cat => (
                      <button key={cat} type="button" onClick={() => {
                        setMsgCategory(cat)
                        if (cat === '✏️ 개별메시지') { setMsgText(''); setMsgStep(3) }
                        else setMsgStep(2)
                      }} style={{
                        padding:'12px 16px', borderRadius:'10px', textAlign:'left',
                        border:'1.5px solid #e5e7eb', background:'#fff',
                        fontSize:'14px', fontWeight:600, color:'#374151',
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor='#f97316'; e.currentTarget.style.background='#fff7ed' }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          }

          /* ──────────────────────────────────────
             Step 2 : 템플릿 선택
          ────────────────────────────────────── */
          if (msgStep === 2) {
            const templates = (MSG_TEMPLATES[msgCategory] || []).map(t => applyTpl(t, msgTarget.name))
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <button type="button" onClick={() => setMsgStep(1)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', lineHeight:1, padding:0, color:'#9ca3af' }}>←</button>
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>{msgCategory} — 문구 선택</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {templates.map((tpl, i) => (
                    <button key={i} type="button" onClick={() => { setMsgText(tpl); setMsgStep(3) }}
                      style={{
                        padding:'13px 14px', borderRadius:'10px', textAlign:'left',
                        border:'1.5px solid #e5e7eb', background:'#fff',
                        fontSize:'13px', color:'#374151', lineHeight:1.7,
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor='#f97316'; e.currentTarget.style.background='#fff7ed' }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff' }}>
                      {tpl}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setMsgText(''); setMsgStep(3) }}
                    style={{
                      padding:'11px 14px', borderRadius:'10px', textAlign:'left',
                      border:'1.5px dashed #d1d5db', background:'#f9fafb',
                      fontSize:'13px', color:'#9ca3af',
                      cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    }}>
                    ✏️ 직접 입력하기
                  </button>
                </div>
              </div>
            )
          }

          /* ──────────────────────────────────────
             Step 3 : 편집 + 발송
          ────────────────────────────────────── */
          const method = msgTarget.contactMethod
          const sendLabel = method==='kakao' ? '💛 카카오톡으로 발송'
                          : method==='sms'   ? '💬 문자 발송'
                          :                   '💬 카카오톡 + 문자 발송'
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <button type="button" onClick={() => setMsgStep(msgCategory === '✏️ 개별메시지' ? 1 : 2)}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', lineHeight:1, padding:0, color:'#9ca3af' }}>←</button>
                <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>메시지 확인 및 발송</span>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', display:'block', marginBottom:'6px' }}>메시지 내용</label>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={5}
                  placeholder="보낼 메시지를 입력하세요"
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'12px 14px', borderRadius:'10px',
                    border:'1.5px solid #e5e7eb', fontSize:'13px',
                    fontFamily:'Noto Sans KR, sans-serif', lineHeight:1.7,
                    resize:'vertical', outline:'none',
                  }} />
                <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'4px', textAlign:'right' }}>{msgText.length}자</div>
              </div>
              <button type="button" onClick={sendMsg} disabled={!msgText.trim()}
                style={{
                  padding:'13px', borderRadius:'10px', border:'none',
                  background: msgText.trim() ? '#f97316' : '#e5e7eb',
                  color: msgText.trim() ? '#fff' : '#9ca3af',
                  fontSize:'14px', fontWeight:700,
                  cursor: msgText.trim() ? 'pointer' : 'not-allowed',
                  fontFamily:'Noto Sans KR, sans-serif',
                }}>
                {sendLabel}
              </button>
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
