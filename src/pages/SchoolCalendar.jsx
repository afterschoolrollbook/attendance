/**
 * SchoolCalendar.jsx
 * 학교 연간 수업 달력
 * 구조: 연간 → 분기/학기 → 텀 → 회차
 */
import React, { useState, useEffect, useRef } from 'react'

const DAY_LABELS = ['일','월','화','수','목','금','토']
const dayNameToNum = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6}

// 분기 색상 (테두리)
const QUARTER_COLORS = [
  {border:'#f97316',text:'#ea580c',bg:'#fff7ed'},
  {border:'#16a34a',text:'#15803d',bg:'#f0fdf4'},
  {border:'#3b82f6',text:'#1d4ed8',bg:'#eff6ff'},
  {border:'#a855f7',text:'#7e22ce',bg:'#fdf4ff'},
]
const getQuarterColor = (n) => QUARTER_COLORS[(n-1)%QUARTER_COLORS.length]||QUARTER_COLORS[0]

// 텀 뱃지: 앞 텀과만 다르면 됨 → 2색 교대
const TERM_BADGES = ['#f97316','#0ea5e9']
const getTermBadge = (termIdx) => TERM_BADGES[termIdx%2]

// 요일 배경색
const DAY_BG = {0:'#f9fafb',1:'#fff7ed',2:'#fef9c3',3:'#f0fdf4',4:'#eff6ff',5:'#fdf4ff',6:'#fff1f2'}
const getDayBg = (dow) => DAY_BG[dow]||'#fff7ed'

// 공휴일
const HOLIDAYS = {
  2025:[
    {date:'2025-01-01',name:'신정'},{date:'2025-01-28',name:'설날'},{date:'2025-01-29',name:'설날'},{date:'2025-01-30',name:'설날'},
    {date:'2025-03-01',name:'삼일절'},{date:'2025-05-05',name:'어린이날'},{date:'2025-05-06',name:'어린이날 대체'},
    {date:'2025-05-13',name:'부처님오신날'},{date:'2025-06-06',name:'현충일'},{date:'2025-08-15',name:'광복절'},
    {date:'2025-10-03',name:'개천절'},{date:'2025-10-05',name:'추석'},{date:'2025-10-06',name:'추석'},{date:'2025-10-07',name:'추석'},
    {date:'2025-10-08',name:'추석 대체'},{date:'2025-10-09',name:'한글날'},{date:'2025-12-25',name:'성탄절'},
  ],
  2026:[
    {date:'2026-01-01',name:'신정'},{date:'2026-01-28',name:'설날'},{date:'2026-01-29',name:'설날'},{date:'2026-01-30',name:'설날'},
    {date:'2026-03-01',name:'삼일절'},{date:'2026-05-05',name:'어린이날'},{date:'2026-05-24',name:'부처님오신날'},
    {date:'2026-06-03',name:'지방선거일'},{date:'2026-06-06',name:'현충일'},{date:'2026-08-15',name:'광복절'},
    {date:'2026-09-24',name:'추석'},{date:'2026-09-25',name:'추석'},{date:'2026-09-26',name:'추석'},
    {date:'2026-10-03',name:'개천절'},{date:'2026-10-09',name:'한글날'},{date:'2026-12-25',name:'성탄절'},
  ],
  2027:[
    {date:'2027-01-01',name:'신정'},{date:'2027-02-16',name:'설날'},{date:'2027-02-17',name:'설날'},{date:'2027-02-18',name:'설날'},
    {date:'2027-03-01',name:'삼일절'},{date:'2027-05-05',name:'어린이날'},{date:'2027-05-13',name:'부처님오신날'},
    {date:'2027-06-06',name:'현충일'},{date:'2027-08-15',name:'광복절'},
    {date:'2027-09-14',name:'추석'},{date:'2027-09-15',name:'추석'},{date:'2027-09-16',name:'추석'},
    {date:'2027-10-03',name:'개천절'},{date:'2027-10-09',name:'한글날'},{date:'2027-12-25',name:'성탄절'},
  ],
}

// 날짜 유틸
const fmt     = (y,m,d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
const addDays = (str,n)  => { const d=new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return fmt(d.getFullYear(),d.getMonth()+1,d.getDate()) }
const getDow  = (str)    => new Date(str+'T00:00:00').getDay()
const getDayLabel = (str) => ['일','월','화','수','목','금','토'][getDow(str)]

function getDatesInRange(startStr, endStr, dayNums) {
  const result=[]
  if(!startStr||!endStr||!dayNums.length) return result
  const cur=new Date(startStr+'T00:00:00'), end=new Date(endStr+'T00:00:00')
  while(cur<=end){
    if(dayNums.includes(cur.getDay())) result.push(fmt(cur.getFullYear(),cur.getMonth()+1,cur.getDate()))
    cur.setDate(cur.getDate()+1)
  }
  return result
}

// ══ 차시 계산
// 구조: 분기/학기 → 텀 → 회차 (요일별 독립)
// quarterTermCounts: 각 분기별 텀 수 배열 [3,3,3,3]
// termSessionCounts: 각 텀별 회차 수 (전체 텀 인덱스 기준) [4,4,4, 4,4,4, ...]
//   또는 단일 숫자로 모든 텀에 동일 적용
function buildSessionMap({ allSessionDates, termBoundaries, quarterTermCounts, sessionsPerTerm }) {
  const sessionMap = {}
  const termMap    = {}

  // 전체 텀 인덱스 누적 (분기 경계 넘어도 연속)
  let globalTermIdx = 0

  termBoundaries.forEach((boundary, qIdx) => {
    const quarterNum  = qIdx + 1
    const numTerms    = quarterTermCounts[qIdx] || 1
    const termDates   = allSessionDates.filter(d => d >= boundary.start && d <= boundary.end)

    // 이 분기의 날짜들을 numTerms개의 텀으로 균등 분배
    // 요일별 독립 카운터
    const dayCounters = {} // dow -> { total, termIdx(분기내), inTermSess }

    termDates.forEach(d => {
      const dow = getDow(d)
      if (!dayCounters[dow]) dayCounters[dow] = { total:0, localTermIdx:0, inTermSess:0, globalTermIdx: globalTermIdx }

      const dc  = dayCounters[dow]
      const spt = sessionsPerTerm // 텀당 회차 수

      dc.total++
      dc.inTermSess++

      sessionMap[d] = {
        quarterNum,
        dayTotal:      dc.total,          // 분기 내 해당 요일 누적 차시
        localTermIdx:  dc.localTermIdx,   // 분기 내 텀 번호 (0-based)
        globalTermIdx: dc.globalTermIdx,  // 전체 텀 번호 (색상용)
        inTermSess:    dc.inTermSess,     // 텀 내 회차
        sessionsPerTerm: spt,
      }
      termMap[d] = quarterNum

      // 텀 회차 가득 찼으면 다음 텀으로
      if (dc.inTermSess >= spt) {
        dc.inTermSess = 0
        if (dc.localTermIdx < numTerms - 1) {
          dc.localTermIdx++
          dc.globalTermIdx++
        }
      }
    })

    globalTermIdx += numTerms
  })

  return { sessionMap, termMap }
}

// ══ 월 달력
function MonthCalendar({ year, month, sessionMap, cancelledDates, makeupDates, termMap, onDateClick, vacationSet }) {
  const cancelledSet = new Set(cancelledDates.map(c=>c.date))
  const makeupSet    = new Set(makeupDates.map(m=>m.date))
  const firstDay = new Date(year,month,1).getDay()
  const lastDate = new Date(year,month+1,0).getDate()
  const cells=[]
  for(let i=0;i<firstDay;i++) cells.push(null)
  for(let d=1;d<=lastDate;d++) cells.push(d)

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'4px'}}>
        {DAY_LABELS.map((d,i)=>(
          <div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:700,padding:'4px 0',
            color:i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af'}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px'}}>
        {cells.map((day,idx)=>{
          if(!day) return <div key={'e'+idx}/>
          const dateStr    = fmt(year,month+1,day)
          const sessInfo   = sessionMap[dateStr]
          const isCancelled= cancelledSet.has(dateStr)
          const isMakeup   = makeupSet.has(dateStr)
          const isVacation = vacationSet.has(dateStr)
          const cancelInfo = cancelledDates.find(c=>c.date===dateStr)
          const dow = (firstDay+day-1)%7
          const isSun=dow===0, isSat=dow===6
          const termNum = termMap[dateStr]
          const qc = termNum ? getQuarterColor(termNum) : null

          if(isMakeup) return (
            <button key={day} onClick={()=>onDateClick(dateStr,'makeup')}
              style={{padding:'3px 2px',borderRadius:'7px',border:'none',cursor:'pointer',
                background:'#eff6ff',outline:'1.5px solid #3b82f6',outlineOffset:'-1px',
                textAlign:'center',fontFamily:'Noto Sans KR, sans-serif'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:'#1d4ed8'}}>{day}</div>
              <div style={{fontSize:'9px',color:'#3b82f6',fontWeight:700}}>보강</div>
            </button>
          )

          if(isCancelled) return (
            <button key={day} onClick={()=>onDateClick(dateStr,'cancelled')}
              style={{padding:'3px 2px',borderRadius:'7px',border:'none',cursor:'pointer',
                background:isVacation?'#f0f9ff':'#fef2f2',
                outline:`1.5px solid ${isVacation?'#7dd3fc':'#fca5a5'}`,outlineOffset:'-1px',
                textAlign:'center',fontFamily:'Noto Sans KR, sans-serif'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:'#d1d5db'}}>{day}</div>
              <div style={{fontSize:'9px',color:isVacation?'#0284c7':'#ef4444',lineHeight:1.2}}>
                {cancelInfo?.memo?cancelInfo.memo.slice(0,4):(isVacation?'방학':'휴일')}
              </div>
            </button>
          )

          if(sessInfo) {
            const localTermNum = sessInfo.localTermIdx + 1  // 분기 내 1-based 텀 번호
            const badgeColor   = getTermBadge(sessInfo.globalTermIdx)
            return (
              <button key={day} onClick={()=>onDateClick(dateStr,'session')}
                style={{padding:'3px 2px',borderRadius:'7px',border:'none',cursor:'pointer',
                  background:getDayBg(dow),
                  outline:`1.5px solid ${qc?.border||'#f97316'}`,
                  outlineOffset:'-1px',textAlign:'center',fontFamily:'Noto Sans KR, sans-serif'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:isSun?'#ef4444':isSat?'#3b82f6':'#111827'}}>{day}</div>
                {/* 분기N / 분기내 M차시 */}
                <div style={{fontSize:'10px',color:qc?.text||'#ea580c',fontWeight:700,lineHeight:1.3}}>
                  {sessInfo.quarterNum}분기 {sessInfo.dayTotal}차
                </div>
                {/* P텀 Q회차 */}
                <div style={{fontSize:'9px',color:'#fff',background:badgeColor,
                  borderRadius:'3px',padding:'0 2px',marginTop:'1px',lineHeight:'14px',whiteSpace:'nowrap'}}>
                  {localTermNum}텀{sessInfo.inTermSess}차
                </div>
              </button>
            )
          }

          return (
            <button key={day} onClick={()=>onDateClick(dateStr,'normal')}
              style={{padding:'5px 2px',borderRadius:'7px',border:'none',cursor:'pointer',
                background:'transparent',textAlign:'center',fontFamily:'Noto Sans KR, sans-serif'}}
              onMouseEnter={e=>e.currentTarget.style.background='#f3f4f6'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{fontSize:'12px',color:isSun?'#ef4444':isSat?'#3b82f6':'#374151'}}>{day}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const CANCEL_OPTIONS = [
  {value:'public_holiday',label:'공휴일'},{value:'election_day',label:'선거일'},
  {value:'school_holiday',label:'학교재량휴일'},{value:'teacher_absent',label:'강사사정'},
  {value:'vacation',label:'방학'},{value:'etc',label:'기타'},
]

// ══ 메인 컴포넌트
export function SchoolCalendar({ cls, onUpdate }) {
  const currentYear = new Date().getFullYear()

  const [year,     setYear]     = useState(cls?.year||currentYear)
  const [termType, setTermType] = useState(cls?.termType||'quarter')
  const [days,     setDays]     = useState(cls?.days||[])
  const [title,    setTitle]    = useState(cls?.title||'')

  // 분기제
  const [quarters, setQuarters] = useState(cls?.quarters||4)
  const [qEnds,    setQEnds]    = useState(cls?.qEnds||['','','',''])

  // 학기제
  const [sem1End,  setSem1End]  = useState(cls?.sem1End||'')
  const [sumStart, setSumStart] = useState(cls?.sumStart||'')
  const [sumEnd,   setSumEnd]   = useState(cls?.sumEnd||'')
  const [sem2End,  setSem2End]  = useState(cls?.sem2End||'')
  const [winStart, setWinStart] = useState(cls?.winStart||'')
  const [winEnd,   setWinEnd]   = useState(cls?.winEnd||'')

  // 텀 설정: 각 분기/학기별 텀 수 [3,3,3,3]
  // 최대 분기4 × 텀12 = 48텀
  const [quarterTermCounts, setQuarterTermCounts] = useState(cls?.quarterTermCounts||[3,3,3,3])
  // 텀당 회차 수 (전체 공통)
  const [sessionsPerTerm,   setSessionsPerTerm]   = useState(cls?.sessionsPerTerm||4)

  // 신청기간
  const [regStart, setRegStart] = useState(cls?.regStart||'')
  const [regEnd,   setRegEnd]   = useState(cls?.regEnd||'')

  // 휴일/보강
  const [cancelledDates, setCancelledDates] = useState(cls?.cancelledDates||[])
  const [makeupDates,    setMakeupDates]    = useState(cls?.makeupDates||[])

  // UI
  const [settingOpen, setSettingOpen] = useState(true)
  const [termOpen,    setTermOpen]    = useState(true)
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [selectedDate,   setSelectedDate]   = useState(null)
  const [clickType,      setClickType]      = useState(null)
  const [showAction,     setShowAction]     = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [showMakeupForm, setShowMakeupForm] = useState(false)
  const [cancelReason,   setCancelReason]   = useState('public_holiday')
  const [cancelMemo,     setCancelMemo]     = useState('')
  const [makeupMemo,     setMakeupMemo]     = useState('')

  const holidayInitialized = useRef(false)

  useEffect(() => {
    if(!cls) return
    setYear(cls.year||currentYear); setTermType(cls.termType||'quarter')
    setDays(cls.days||[]); setTitle(cls.title||'')
    setQuarters(cls.quarters||4); setQEnds(cls.qEnds||['','','',''])
    setSem1End(cls.sem1End||''); setSumStart(cls.sumStart||''); setSumEnd(cls.sumEnd||'')
    setSem2End(cls.sem2End||''); setWinStart(cls.winStart||''); setWinEnd(cls.winEnd||'')
    setQuarterTermCounts(cls.quarterTermCounts||[3,3,3,3])
    setSessionsPerTerm(cls.sessionsPerTerm||4)
    setRegStart(cls.regStart||''); setRegEnd(cls.regEnd||'')
    setCancelledDates(cls.cancelledDates||[]); setMakeupDates(cls.makeupDates||[])
    holidayInitialized.current = false
  }, [cls?.id])

  useEffect(() => {
    if(holidayInitialized.current) return
    holidayInitialized.current = true
    const hols = HOLIDAYS[year]||HOLIDAYS[2026]||[]
    setCancelledDates(prev => {
      const existing = new Set(prev.map(c=>c.date))
      const toAdd = hols.filter(h=>!existing.has(h.date)).map(h=>({date:h.date,reason:'public_holiday',memo:h.name}))
      return toAdd.length===0 ? prev : [...prev,...toAdd]
    })
  }, [year])

  const autoSetHolidays = () => {
    const hols = HOLIDAYS[year]||HOLIDAYS[2026]||[]
    const existing = new Set(cancelledDates.map(c=>c.date))
    const toAdd = hols.filter(h=>!existing.has(h.date)).map(h=>({date:h.date,reason:'public_holiday',memo:h.name}))
    const updated = [...cancelledDates,...toAdd]
    setCancelledDates(updated); saveAll({cancelledDates:updated})
  }

  // 분기 수 변경 시 quarterTermCounts 조정
  const handleQuartersChange = (n) => {
    setQuarters(n)
    setQuarterTermCounts(prev => Array.from({length:n},(_,i)=>prev[i]||3))
    setQEnds(prev => Array.from({length:n},(_,i)=>prev[i]||''))
  }

  // 분기별 텀 수 변경 (1~12)
  const handleQTermCount = (qIdx, val) => {
    setQuarterTermCounts(prev => { const n=[...prev]; n[qIdx]=Math.max(1,Math.min(12,parseInt(val)||1)); return n })
  }

  // 날짜 계산
  const dayNums    = days.map(d=>dayNameToNum[d]).filter(n=>n!==undefined)
  const marchStart = fmt(year,3,1)
  const yearEnd    = fmt(year,12,31)

  const vacationDates = new Set()
  if(sumStart&&sumEnd){let d=new Date(sumStart+'T00:00:00'),e=new Date(sumEnd+'T00:00:00');while(d<=e){vacationDates.add(fmt(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}
  if(winStart&&winEnd){let d=new Date(winStart+'T00:00:00'),e=new Date(winEnd+'T00:00:00');while(d<=e){vacationDates.add(fmt(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}

  const cancelledSet    = new Set(cancelledDates.map(c=>c.date))
  const allSessionDates = dayNums.length>0
    ? getDatesInRange(marchStart,yearEnd,dayNums).filter(d=>!cancelledSet.has(d)&&!vacationDates.has(d))
    : []

  // 텀 경계 (분기/학기)
  let termBoundaries = []
  const numPeriods = termType==='semester' ? 2 : quarters
  if(termType==='semester'){
    const sem2Start = sumEnd?addDays(sumEnd,1):fmt(year,9,1)
    termBoundaries = [
      {start:marchStart, end:sem1End||fmt(year,7,15), label:'1학기'},
      {start:sem2Start,  end:sem2End||fmt(year,12,20), label:'2학기'},
    ]
  } else {
    let prevEnd = fmt(year,2,28)
    for(let i=0;i<quarters;i++){
      const qEnd = qEnds[i]||fmt(year,3+Math.floor(12/quarters*(i+1))-1,28)
      termBoundaries.push({start:addDays(prevEnd,1),end:qEnd,label:`${i+1}분기`})
      prevEnd = qEnd
    }
  }

  // quarterTermCounts를 학기/분기 수에 맞게 슬라이스
  const activeTermCounts = Array.from({length:numPeriods},(_,i)=>quarterTermCounts[i]||3)
  const totalTerms = activeTermCounts.reduce((a,b)=>a+b,0)
  const totalSessions = totalTerms * sessionsPerTerm

  const {sessionMap, termMap} = buildSessionMap({
    allSessionDates, termBoundaries,
    quarterTermCounts: activeTermCounts,
    sessionsPerTerm,
  })

  const months      = Array.from({length:12},(_,i)=>({year,month:i}))
  const makeupCount = makeupDates.length

  const saveAll = (patch={}) => {
    if(!onUpdate) return
    onUpdate({
      title,year,termType,days,
      sem1End,sumStart,sumEnd,sem2End,winStart,winEnd,
      quarters,qEnds,
      quarterTermCounts:activeTermCounts,
      sessionsPerTerm,
      regStart,regEnd,
      cancelledDates,makeupDates,
      startDate:marchStart,endDate:yearEnd,
      ...patch,
    })
  }

  const handleDateClick = (date,type) => {
    setSelectedDate(date);setClickType(type)
    setShowAction(true);setShowCancelForm(false);setShowMakeupForm(false)
  }
  const handleCancelSave = () => {
    const updated=[...cancelledDates.filter(c=>c.date!==selectedDate),{date:selectedDate,reason:cancelReason,memo:cancelMemo}]
    setCancelledDates(updated);setShowAction(false);setShowCancelForm(false);saveAll({cancelledDates:updated})
  }
  const handleMakeupSave = () => {
    const updated=[...makeupDates.filter(m=>m.date!==selectedDate),{date:selectedDate,memo:makeupMemo}]
    setMakeupDates(updated);setShowAction(false);setShowMakeupForm(false);saveAll({makeupDates:updated})
  }
  const handleRestore = () => {
    const updC=cancelledDates.filter(c=>c.date!==selectedDate)
    const updM=makeupDates.filter(m=>m.date!==selectedDate)
    setCancelledDates(updC);setMakeupDates(updM);setShowAction(false)
    saveAll({cancelledDates:updC,makeupDates:updM})
  }

  const sectionStyle = {background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:'14px',marginBottom:'14px',overflow:'hidden'}
  const sectionHeader = (open) => ({
    display:'flex',alignItems:'center',justifyContent:'space-between',
    padding:'14px 18px',cursor:'pointer',userSelect:'none',
    background:open?'#f8fafc':'#fff',
    borderBottom:open?'1.5px solid #e2e8f0':'none',
  })
  const iSt = {width:'100%',padding:'7px 10px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',fontFamily:'Noto Sans KR, sans-serif',outline:'none',boxSizing:'border-box'}

  return (
    <div style={{fontFamily:'Noto Sans KR, sans-serif'}}>

      {/* ════ 기본 설정 ════ */}
      <div style={sectionStyle}>
        <div style={sectionHeader(settingOpen)} onClick={()=>setSettingOpen(v=>!v)}>
          <div style={{fontSize:'14px',fontWeight:800,color:'#1e3a5f',display:'flex',alignItems:'center',gap:'6px'}}>
            📋 기본 설정
            {!settingOpen&&title&&<span style={{fontSize:'12px',fontWeight:400,color:'#6b7280',marginLeft:'4px'}}>— {title}</span>}
          </div>
          <span style={{fontSize:'18px',color:'#9ca3af'}}>{settingOpen?'▲':'▼'}</span>
        </div>
        {settingOpen&&(
          <div style={{padding:'18px'}}>
            {/* 연도 + 일정명 */}
            <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:'12px',marginBottom:'14px'}}>
              <div>
                <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'4px'}}>연도</label>
                <select value={year} onChange={e=>{setYear(parseInt(e.target.value));holidayInitialized.current=false}}
                  style={{...iSt,background:'#fff'}}>
                  {[2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'4px'}}>일정명</label>
                <input value={title} onChange={e=>setTitle(e.target.value)} onBlur={()=>saveAll()}
                  placeholder={`예: ${year}년 대한초 방과후 연간계획`} style={iSt}/>
              </div>
            </div>

            {/* 운영방식 + 분기 수 */}
            <div style={{marginBottom:'14px'}}>
              <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'6px'}}>운영 방식</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {[{v:'semester',l:'학기제'},{v:'quarter',l:'분기제'}].map(({v,l})=>(
                  <button key={v} onClick={()=>setTermType(v)}
                    style={{padding:'8px 16px',borderRadius:'9px',border:`1.5px solid ${termType===v?'#1e3a5f':'#e5e7eb'}`,
                      background:termType===v?'#1e3a5f':'#fff',color:termType===v?'#fff':'#374151',
                      fontSize:'13px',fontWeight:termType===v?700:400,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{l}</button>
                ))}
                {termType==='quarter'&&[2,3,4].map(n=>(
                  <button key={n} onClick={()=>handleQuartersChange(n)}
                    style={{padding:'8px 14px',borderRadius:'9px',border:`1.5px solid ${quarters===n?'#f97316':'#e5e7eb'}`,
                      background:quarters===n?'#f97316':'#fff',color:quarters===n?'#fff':'#374151',
                      fontSize:'13px',fontWeight:quarters===n?700:400,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{n}분기</button>
                ))}
              </div>
            </div>

            {/* 수업 요일 */}
            <div style={{marginBottom:'14px'}}>
              <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'6px'}}>수업 요일 (방과후 수업이 있는 요일)</label>
              <div style={{display:'flex',gap:'6px'}}>
                {['월','화','수','목','금','토','일'].map(d=>{
                  const sel=days.includes(d)
                  return (
                    <button key={d} onClick={()=>setDays(sel?days.filter(x=>x!==d):[...days,d])}
                      style={{width:'38px',height:'38px',borderRadius:'9px',border:'none',cursor:'pointer',
                        fontSize:'14px',fontWeight:700,background:sel?'#1e3a5f':'#f3f4f6',
                        color:sel?'#fff':'#374151',fontFamily:'Noto Sans KR, sans-serif'}}>{d}</button>
                  )
                })}
              </div>
            </div>

            {/* 분기 종료일 */}
            {termType==='quarter'&&(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'10px',marginBottom:'14px'}}>
                {Array.from({length:quarters},(_,i)=>(
                  <div key={i} style={{background:getQuarterColor(i+1).bg,border:`1.5px solid ${getQuarterColor(i+1).border}`,borderRadius:'10px',padding:'12px'}}>
                    <div style={{fontSize:'12px',fontWeight:700,color:getQuarterColor(i+1).text,marginBottom:'6px'}}>{i+1}분기</div>
                    <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'4px'}}>
                      시작: {i===0?`${year}-03-01`:(qEnds[i-1]?addDays(qEnds[i-1],1):'이전 분기 다음날')}
                    </div>
                    <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>종료일</label>
                    <input type="date" value={qEnds[i]||''}
                      onChange={e=>{const n=[...qEnds];n[i]=e.target.value;setQEnds(n)}}
                      onBlur={()=>saveAll()}
                      style={{width:'100%',padding:'5px 8px',borderRadius:'7px',border:`1.5px solid ${getQuarterColor(i+1).border}`,fontSize:'12px',outline:'none',boxSizing:'border-box'}}/>
                  </div>
                ))}
              </div>
            )}

            {/* 학기제 */}
            {termType==='semester'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
                <div style={{background:'#eff6ff',borderRadius:'10px',padding:'12px'}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'#1d4ed8',marginBottom:'6px'}}>🏫 1학기</div>
                  <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'4px'}}>시작: {year}-03-01 (자동)</div>
                  <input type="date" value={sem1End} onChange={e=>setSem1End(e.target.value)} onBlur={()=>saveAll()}
                    style={{width:'100%',padding:'6px 8px',borderRadius:'7px',border:'1.5px solid #bfdbfe',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div style={{background:'#f0fdf4',borderRadius:'10px',padding:'12px'}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'#15803d',marginBottom:'6px'}}>🏫 2학기</div>
                  <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'4px'}}>시작: 여름방학 다음날</div>
                  <input type="date" value={sem2End} onChange={e=>setSem2End(e.target.value)} onBlur={()=>saveAll()}
                    style={{width:'100%',padding:'6px 8px',borderRadius:'7px',border:'1.5px solid #86efac',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div style={{background:'#fff7ed',borderRadius:'10px',padding:'12px'}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'#ea580c',marginBottom:'6px'}}>☀️ 여름방학</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                    <div><label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>시작</label>
                      <input type="date" value={sumStart} onChange={e=>setSumStart(e.target.value)} onBlur={()=>saveAll()}
                        style={{width:'100%',padding:'6px 6px',borderRadius:'7px',border:'1.5px solid #fed7aa',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/></div>
                    <div><label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>종료</label>
                      <input type="date" value={sumEnd} onChange={e=>setSumEnd(e.target.value)} onBlur={()=>saveAll()}
                        style={{width:'100%',padding:'6px 6px',borderRadius:'7px',border:'1.5px solid #fed7aa',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/></div>
                  </div>
                </div>
                <div style={{background:'#f0f9ff',borderRadius:'10px',padding:'12px'}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'#0369a1',marginBottom:'6px'}}>❄️ 겨울방학</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                    <div><label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>시작</label>
                      <input type="date" value={winStart} onChange={e=>setWinStart(e.target.value)} onBlur={()=>saveAll()}
                        style={{width:'100%',padding:'6px 6px',borderRadius:'7px',border:'1.5px solid #bae6fd',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/></div>
                    <div><label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>종료</label>
                      <input type="date" value={winEnd} onChange={e=>setWinEnd(e.target.value)} onBlur={()=>saveAll()}
                        style={{width:'100%',padding:'6px 6px',borderRadius:'7px',border:'1.5px solid #bae6fd',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/></div>
                  </div>
                </div>
              </div>
            )}

            {/* 신청기간 */}
            <div style={{marginBottom:'14px',background:'#f0f9ff',borderRadius:'10px',padding:'14px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#0369a1',marginBottom:'10px'}}>📅 신청기간 설정</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div>
                  <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'4px'}}>신청 시작일</label>
                  <input type="date" value={regStart} onChange={e=>setRegStart(e.target.value)} onBlur={()=>saveAll()}
                    style={{...iSt,border:'1.5px solid #bae6fd'}}/>
                </div>
                <div>
                  <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'4px'}}>신청 종료일</label>
                  <input type="date" value={regEnd} onChange={e=>setRegEnd(e.target.value)} onBlur={()=>saveAll()}
                    style={{...iSt,border:'1.5px solid #bae6fd'}}/>
                </div>
              </div>
            </div>

            <button onClick={()=>{saveAll();setSettingOpen(false)}}
              style={{padding:'8px 20px',borderRadius:'9px',border:'none',background:'#1e3a5f',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>
              💾 저장 후 접기
            </button>
          </div>
        )}
      </div>

      {/* ════ 텀 구성 설정 ════ */}
      <div style={sectionStyle}>
        <div style={sectionHeader(termOpen)} onClick={()=>setTermOpen(v=>!v)}>
          <div style={{fontSize:'14px',fontWeight:800,color:'#1e3a5f'}}>
            🗂️ 텀 구성 설정
            {!termOpen&&<span style={{fontSize:'12px',fontWeight:400,color:'#6b7280',marginLeft:'8px'}}>
              총 {totalTerms}텀 · 텀당 {sessionsPerTerm}회차 · 총 {totalSessions}회
            </span>}
          </div>
          <span style={{fontSize:'18px',color:'#9ca3af'}}>{termOpen?'▲':'▼'}</span>
        </div>
        {termOpen&&(
          <div style={{padding:'18px'}}>

            {/* 텀당 회차 수 */}
            <div style={{marginBottom:'18px'}}>
              <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'8px'}}>
                텀당 회차 수 (모든 텀 공통)
              </label>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                {[2,3,4,5,6,8,10,12].map(n=>(
                  <button key={n} onClick={()=>{setSessionsPerTerm(n);saveAll({sessionsPerTerm:n})}}
                    style={{padding:'6px 14px',borderRadius:'8px',
                      border:`1.5px solid ${sessionsPerTerm===n?'#1e3a5f':'#e5e7eb'}`,
                      background:sessionsPerTerm===n?'#1e3a5f':'#fff',
                      color:sessionsPerTerm===n?'#fff':'#374151',
                      fontSize:'13px',fontWeight:sessionsPerTerm===n?700:400,
                      cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{n}회</button>
                ))}
                <input type="number" min={1} max={50} value={sessionsPerTerm}
                  onChange={e=>setSessionsPerTerm(parseInt(e.target.value)||1)}
                  onBlur={()=>saveAll()}
                  style={{width:'65px',padding:'6px 8px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'14px',fontWeight:700,outline:'none',textAlign:'center'}}/>
                <span style={{fontSize:'13px',color:'#6b7280'}}>회차</span>
              </div>
            </div>

            {/* 분기/학기별 텀 수 설정 */}
            <div style={{marginBottom:'16px'}}>
              <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'8px'}}>
                {termType==='semester'?'학기':'분기'}별 텀 수 설정
                <span style={{fontSize:'11px',color:'#9ca3af',marginLeft:'8px'}}>(각 {termType==='semester'?'학기':'분기'} 안에 몇 텀? 최대 12텀)</span>
              </label>
              <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                {termBoundaries.map((b,i)=>{
                  const qc = getQuarterColor(i+1)
                  const tCount = activeTermCounts[i]||3
                  return (
                    <div key={i} style={{background:qc.bg,border:`1.5px solid ${qc.border}`,borderRadius:'12px',padding:'14px',minWidth:'140px'}}>
                      <div style={{fontSize:'13px',fontWeight:700,color:qc.text,marginBottom:'10px'}}>{b.label}</div>
                      {/* 텀 수 선택 1~12 */}
                      <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'8px'}}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>(
                          <button key={n} onClick={()=>handleQTermCount(i,n)}
                            style={{width:'28px',height:'28px',borderRadius:'6px',
                              border:`1.5px solid ${tCount===n?qc.border:'#e5e7eb'}`,
                              background:tCount===n?qc.border:'#fff',
                              color:tCount===n?'#fff':'#374151',
                              fontSize:'12px',fontWeight:tCount===n?700:400,
                              cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{n}</button>
                        ))}
                      </div>
                      <div style={{fontSize:'11px',color:qc.text,fontWeight:600}}>
                        {tCount}텀 × {sessionsPerTerm}회 = {tCount*sessionsPerTerm}회
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 전체 요약 */}
            <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'14px'}}>
              <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'10px',fontWeight:600}}>전체 구성 요약</div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'10px'}}>
                {termBoundaries.map((b,qIdx)=>{
                  const tCount = activeTermCounts[qIdx]||3
                  const qc = getQuarterColor(qIdx+1)
                  // 이 분기의 전체 텀 인덱스 시작
                  const prevTerms = activeTermCounts.slice(0,qIdx).reduce((a,b)=>a+b,0)
                  return Array.from({length:tCount},(_,tIdx)=>{
                    const globalTIdx = prevTerms+tIdx
                    const badge = getTermBadge(globalTIdx)
                    const sessStart = globalTIdx*sessionsPerTerm+1
                    const sessEnd   = sessStart+sessionsPerTerm-1
                    return (
                      <div key={`${qIdx}-${tIdx}`} style={{display:'flex',alignItems:'center',gap:'3px',
                        padding:'3px 8px',background:'#fff',
                        border:`1.5px solid ${badge}`,borderRadius:'16px'}}>
                        <span style={{fontSize:'10px',fontWeight:700,color:qc.text}}>{b.label}</span>
                        <span style={{fontSize:'10px',fontWeight:700,color:badge}}>{tIdx+1}텀</span>
                        <span style={{fontSize:'9px',color:'#9ca3af'}}>{sessStart}~{sessEnd}차</span>
                      </div>
                    )
                  })
                })}
              </div>
              <div style={{fontSize:'13px',color:'#374151',fontWeight:700}}>
                총 <span style={{color:'#f97316'}}>{totalTerms}텀</span>
                {' · '}텀당 <span style={{color:'#1e3a5f'}}>{sessionsPerTerm}회차</span>
                {' · '}총 <span style={{color:'#16a34a'}}>{totalSessions}회</span>
                {regStart&&regEnd&&(
                  <span style={{fontSize:'12px',color:'#3b82f6',marginLeft:'12px',fontWeight:400}}>
                    📅 신청기간 {regStart.slice(5)} ~ {regEnd.slice(5)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════ 휴일 추가 ════ */}
      <div style={sectionStyle}>
        <div style={sectionHeader(holidayOpen)} onClick={()=>setHolidayOpen(v=>!v)}>
          <div style={{fontSize:'13px',fontWeight:700,color:'#374151'}}>
            📌 휴일 직접 추가
            {!holidayOpen&&cancelledDates.length>0&&
              <span style={{fontSize:'11px',fontWeight:400,color:'#6b7280',marginLeft:'8px'}}>{cancelledDates.length}일 등록됨</span>}
          </div>
          <span style={{fontSize:'18px',color:'#9ca3af'}}>{holidayOpen?'▲':'▼'}</span>
        </div>
        {holidayOpen&&(
          <div style={{padding:'14px 16px'}}>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'10px'}}>
              <input type="date" style={{padding:'7px 10px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',outline:'none'}}
                onChange={e=>{
                  const date=e.target.value; if(!date) return
                  if(cancelledDates.some(c=>c.date===date)) return
                  const updated=[...cancelledDates,{date,reason:'school_holiday',memo:''}]
                  setCancelledDates(updated);saveAll({cancelledDates:updated});e.target.value=''
                }}/>
              <select style={{padding:'7px 10px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',background:'#fff',outline:'none'}}
                onChange={e=>{
                  const date=e.target.value; if(!date) return
                  const hol=(HOLIDAYS[year]||HOLIDAYS[2026]||[]).find(h=>h.date===date)
                  if(!cancelledDates.some(c=>c.date===date)){
                    const updated=[...cancelledDates,{date,reason:'public_holiday',memo:hol?.name||'공휴일'}]
                    setCancelledDates(updated);saveAll({cancelledDates:updated})
                  }
                  e.target.value=''
                }} defaultValue="">
                <option value="">공휴일 빠른 추가</option>
                {(HOLIDAYS[year]||HOLIDAYS[2026]||[]).map(h=>(
                  <option key={h.date} value={h.date}>{h.date.slice(5)} {h.name}</option>
                ))}
              </select>
              <button onClick={autoSetHolidays}
                style={{padding:'7px 14px',borderRadius:'8px',border:'1.5px solid #f97316',background:'#fff7ed',color:'#ea580c',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>
                🗓️ {year}년 공휴일 전체 추가
              </button>
            </div>
            {cancelledDates.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:'3px',maxHeight:'160px',overflowY:'auto'}}>
                {[...cancelledDates].sort((a,b)=>a.date.localeCompare(b.date)).map((c,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 10px',background:'#fff',borderRadius:'7px',border:'1px solid #f3f4f6'}}>
                    <span style={{fontSize:'12px',fontWeight:600,color:'#374151',minWidth:'75px'}}>{c.date.slice(5)}</span>
                    <span style={{fontSize:'11px',color:'#6b7280',flex:1}}>{c.memo||c.reason}</span>
                    <button onClick={()=>{const updated=cancelledDates.filter((_,j)=>j!==i);setCancelledDates(updated);saveAll({cancelledDates:updated})}}
                      style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:'16px',padding:'0 2px',lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════ 달력 ════ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px'}}>
        {months.map(({year:y,month:m})=>(
          <div key={y+'-'+m} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'12px'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#374151',marginBottom:'10px',textAlign:'center'}}>{y}년 {m+1}월</div>
            <MonthCalendar year={y} month={m}
              sessionMap={sessionMap} cancelledDates={cancelledDates}
              makeupDates={makeupDates} termMap={termMap}
              onDateClick={handleDateClick} vacationSet={vacationDates}/>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div style={{display:'flex',gap:'10px',marginTop:'12px',fontSize:'11px',color:'#9ca3af',flexWrap:'wrap'}}>
        {termBoundaries.map((b,i)=>(
          <span key={i} style={{display:'flex',alignItems:'center',gap:'4px'}}>
            <span style={{width:'14px',height:'14px',borderRadius:'4px',background:getQuarterColor(i+1).bg,border:`1.5px solid ${getQuarterColor(i+1).border}`,display:'inline-block'}}/>
            {b.label}
          </span>
        ))}
        <span style={{display:'flex',alignItems:'center',gap:'4px'}}>
          <span style={{width:'14px',height:'14px',borderRadius:'4px',background:'#fef2f2',border:'1.5px solid #fca5a5',display:'inline-block'}}/>휴일
        </span>
        <span style={{display:'flex',alignItems:'center',gap:'4px'}}>
          <span style={{width:'14px',height:'14px',borderRadius:'4px',background:'#eff6ff',border:'1.5px solid #3b82f6',display:'inline-block'}}/>보강
        </span>
      </div>

      {/* 날짜 클릭 모달 */}
      {showAction&&selectedDate&&(
        <div style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget){setShowAction(false);setShowCancelForm(false);setShowMakeupForm(false)}}}>
          <div style={{background:'#fff',borderRadius:'16px',width:'360px',maxWidth:'95vw',padding:'24px',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
              <div style={{fontSize:'15px',fontWeight:700,color:'#374151'}}>
                📅 {selectedDate} ({getDayLabel(selectedDate)}요일)
                <span style={{fontSize:'12px',fontWeight:400,color:'#9ca3af',marginLeft:'8px'}}>
                  {clickType==='session'?'수업일':clickType==='cancelled'?'휴일':clickType==='makeup'?'보강':'날짜 설정'}
                </span>
              </div>
              <button onClick={()=>{setShowAction(false);setShowCancelForm(false);setShowMakeupForm(false)}}
                style={{background:'none',border:'none',fontSize:'20px',color:'#9ca3af',cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            {!showCancelForm&&!showMakeupForm&&(
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {(clickType==='session'||clickType==='cancelled'||clickType==='makeup')&&(
                  <button onClick={handleRestore}
                    style={{padding:'12px 14px',borderRadius:'10px',border:'1.5px solid #86efac',background:'#f0fdf4',cursor:'pointer',textAlign:'left',fontFamily:'Noto Sans KR, sans-serif'}}>
                    <div style={{fontSize:'13px',fontWeight:700,color:'#16a34a'}}>✅ 원래 상태로 복원</div>
                  </button>
                )}
                <button onClick={()=>setShowCancelForm(true)}
                  style={{padding:'12px 14px',borderRadius:'10px',border:'1.5px solid #fca5a5',background:'#fef2f2',cursor:'pointer',textAlign:'left',fontFamily:'Noto Sans KR, sans-serif'}}>
                  <div style={{fontSize:'13px',fontWeight:700,color:'#ef4444'}}>🚫 휴일 처리</div>
                  <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'2px'}}>공휴일, 선거일, 재량휴일, 강사사정 등</div>
                </button>
                <button onClick={()=>setShowMakeupForm(true)}
                  style={{padding:'12px 14px',borderRadius:'10px',border:'1.5px solid #93c5fd',background:'#eff6ff',cursor:'pointer',textAlign:'left',fontFamily:'Noto Sans KR, sans-serif'}}>
                  <div style={{fontSize:'13px',fontWeight:700,color:'#3b82f6'}}>🔄 보강일 추가</div>
                </button>
              </div>
            )}

            {showCancelForm&&(
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <label style={{fontSize:'12px',color:'#6b7280'}}>사유</label>
                <select value={cancelReason} onChange={e=>setCancelReason(e.target.value)}
                  style={{width:'100%',padding:'8px 12px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',fontFamily:'Noto Sans KR, sans-serif',outline:'none',background:'#fff'}}>
                  {CANCEL_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {cancelReason==='etc'&&(
                  <input value={cancelMemo} onChange={e=>setCancelMemo(e.target.value)} placeholder="사유 직접 입력"
                    style={{padding:'8px 12px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',fontFamily:'Noto Sans KR, sans-serif',outline:'none'}}/>
                )}
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowCancelForm(false)} style={{padding:'7px 16px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',fontSize:'13px',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>취소</button>
                  <button onClick={handleCancelSave} style={{padding:'7px 16px',borderRadius:'8px',border:'none',background:'#ef4444',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>휴일 처리</button>
                </div>
              </div>
            )}

            {showMakeupForm&&(
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <label style={{fontSize:'12px',color:'#6b7280'}}>메모</label>
                <input value={makeupMemo} onChange={e=>setMakeupMemo(e.target.value)} placeholder="예: 5월 5일 어린이날 보강"
                  style={{padding:'8px 12px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',fontFamily:'Noto Sans KR, sans-serif',outline:'none'}}/>
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowMakeupForm(false)} style={{padding:'7px 16px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',fontSize:'13px',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>취소</button>
                  <button onClick={handleMakeupSave} style={{padding:'7px 16px',borderRadius:'8px',border:'none',background:'#3b82f6',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>보강 추가</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
