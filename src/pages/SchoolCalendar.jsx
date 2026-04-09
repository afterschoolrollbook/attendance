/**
 * SchoolCalendar.jsx
 * 학교 연간 수업 달력
 * 구조: 연간 → 분기/학기 → 텀 → 회차
 */
import React, { useState, useEffect, useRef } from 'react'

const DAY_LABELS = ['일','월','화','수','목','금','토']
const dayNameToNum = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6}

// 분기 색상 (테두리만 — 셀 외곽)
const QUARTER_COLORS = [
  {border:'#f97316',text:'#ea580c',bg:'#fff7ed'},
  {border:'#16a34a',text:'#15803d',bg:'#f0fdf4'},
  {border:'#3b82f6',text:'#1d4ed8',bg:'#eff6ff'},
  {border:'#a855f7',text:'#7e22ce',bg:'#fdf4ff'},
]
const getQuarterColor = (n) => QUARTER_COLORS[(n-1)%QUARTER_COLORS.length]||QUARTER_COLORS[0]

// 요일별 완전한 색상 테마 — 배경/텍스트/뱃지 모두 명확하게 구분
const DAY_THEME = {
  0: { bg:'#f3f4f6', text:'#6b7280', badge1:'#9ca3af', badge2:'#6b7280' }, // 일 — 회색
  1: { bg:'#fff7ed', text:'#c2410c', badge1:'#f97316', badge2:'#c2410c' }, // 월 — 주황
  2: { bg:'#fefce8', text:'#a16207', badge1:'#eab308', badge2:'#a16207' }, // 화 — 노랑
  3: { bg:'#f0fdf4', text:'#15803d', badge1:'#22c55e', badge2:'#15803d' }, // 수 — 초록
  4: { bg:'#eff6ff', text:'#1d4ed8', badge1:'#3b82f6', badge2:'#1d4ed8' }, // 목 — 파랑
  5: { bg:'#fdf4ff', text:'#7e22ce', badge1:'#a855f7', badge2:'#7e22ce' }, // 금 — 보라
  6: { bg:'#fff1f2', text:'#be123c', badge1:'#f43f5e', badge2:'#be123c' }, // 토 — 분홍
}
const getDayTheme = (dow) => DAY_THEME[dow] || DAY_THEME[1]

// 텀 뱃지: 요일 테마 기반으로 교대 (밝은색/어두운색)
const getTermBadge = (termIdx, dow) => {
  const theme = getDayTheme(dow)
  return termIdx % 2 === 0 ? theme.badge1 : theme.badge2
}

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
// flatTermSessions: 전체 텀 순서대로 각 텀의 회차 수 [4,4,3,4,4,4,...]
function buildSessionMap({ allSessionDates, termBoundaries, quarterTermCounts, flatTermSessions }) {
  const sessionMap = {}
  const termMap    = {}
  let globalTermIdx = 0

  termBoundaries.forEach((boundary, qIdx) => {
    const quarterNum   = qIdx + 1
    const quarterLabel = boundary.label
    const numTerms     = quarterTermCounts[qIdx] || 1
    const termDates    = allSessionDates.filter(d => d >= boundary.start && d <= boundary.end)

    const dayCounters = {}

    termDates.forEach(d => {
      const dow = getDow(d)
      if (!dayCounters[dow]) dayCounters[dow] = {
        total:0, localTermIdx:0, inTermSess:0, globalTermIdx
      }
      const dc = dayCounters[dow]

      // 텀 수 초과면 기록 없이 스킵
      if (dc.localTermIdx >= numTerms) return

      const spt = flatTermSessions[dc.globalTermIdx] || 4

      dc.total++
      dc.inTermSess++

      sessionMap[d] = {
        quarterNum,
        quarterLabel,
        dayTotal:      dc.total,
        localTermIdx:  dc.localTermIdx,
        globalTermIdx: dc.globalTermIdx,
        inTermSess:    dc.inTermSess,
        sessionsPerTerm: spt,
      }
      termMap[d] = quarterNum

      if (dc.inTermSess >= spt) {
        dc.inTermSess = 0
        dc.localTermIdx++
        dc.globalTermIdx++
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

          if(isCancelled) {
            if(cancelInfo?.reason==='manual_exclude') return (
              <button key={day} onClick={()=>onDateClick(dateStr,'cancelled')}
                style={{padding:'5px 2px',borderRadius:'7px',border:'none',cursor:'pointer',
                  background:'transparent',textAlign:'center',fontFamily:'Noto Sans KR, sans-serif'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f3f4f6'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{fontSize:'12px',color:isSun?'#ef4444':isSat?'#3b82f6':'#374151'}}>{day}</div>
              </button>
            )
            return (
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
          }

          if(sessInfo) {
            const localTermNum = sessInfo.localTermIdx + 1
            const theme      = getDayTheme(dow)
            const badgeColor = getTermBadge(sessInfo.globalTermIdx, dow)
            return (
              <button key={day} onClick={()=>onDateClick(dateStr,'session')}
                style={{padding:'3px 2px',borderRadius:'7px',border:'none',cursor:'pointer',
                  background: theme.bg,
                  outline:`1.5px solid ${qc?.border||'#f97316'}`,
                  outlineOffset:'-1px',textAlign:'center',fontFamily:'Noto Sans KR, sans-serif'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:isSun?'#ef4444':isSat?'#3b82f6':'#111827'}}>{day}</div>
                {/* 분기N / 분기내 M차 — 요일별 텍스트 색 */}
                <div style={{fontSize:'10px',color:theme.text,fontWeight:700,lineHeight:1.3}}>
                  {sessInfo.quarterLabel} {sessInfo.dayTotal}차
                </div>
                {/* P텀 Q회차 — 요일별 뱃지 색 (텀 교대: 짝수=진한색배경, 홀수=흰배경+진한글씨) */}
                {sessInfo.globalTermIdx % 2 === 0 ? (
                  <div style={{fontSize:'9px',color:'#fff',background:badgeColor,
                    borderRadius:'3px',padding:'0 2px',marginTop:'1px',lineHeight:'14px',whiteSpace:'nowrap'}}>
                    {localTermNum}텀{sessInfo.inTermSess}차
                  </div>
                ) : (
                  <div style={{fontSize:'9px',color:badgeColor,background:'#fff',
                    border:`1px solid ${badgeColor}`,
                    borderRadius:'3px',padding:'0 2px',marginTop:'1px',lineHeight:'14px',whiteSpace:'nowrap'}}>
                    {localTermNum}텀{sessInfo.inTermSess}차
                  </div>
                )}
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

  // 텀 설정: 각 분기/학기별 텀 수 [3,3] 또는 [3,3,3,3]
  const [quarterTermCounts, setQuarterTermCounts] = useState(cls?.quarterTermCounts||[3,3,3,3])
  // 텀별 회차 수: { "q0t0": 4, "q0t1": 4, "q1t0": 4, ... }
  // 기본값은 공통 sessionsPerTerm 으로 채워짐
  const [termSessionMap, setTermSessionMap] = useState(cls?.termSessionMap||{})
  // 공통 기본 회차 수 (빠른 설정용)
  const [defaultSessions, setDefaultSessions] = useState(cls?.defaultSessions||4)

  // 특정 텀의 회차 수 가져오기 (없으면 defaultSessions)
  const getTermSessions = (qIdx, tIdx) => termSessionMap[`q${qIdx}t${tIdx}`] ?? defaultSessions
  // 특정 텀의 회차 수 설정
  const setTermSessions = (qIdx, tIdx, val) => {
    setTermSessionMap(prev => ({...prev, [`q${qIdx}t${tIdx}`]: Math.max(1, parseInt(val)||1)}))
  }

  // 신청기간 — 분기/학기 수만큼 동적으로
  // regPeriods: [{start:'', end:''}, ...]
  const [regPeriods, setRegPeriods] = useState(
    cls?.regPeriods || Array.from({length: cls?.quarters||4}, ()=>({start:'',end:''}))
  )

  // 휴일/보강
  const [cancelledDates, setCancelledDates] = useState(cls?.cancelledDates||[])
  const [makeupDates,    setMakeupDates]    = useState(cls?.makeupDates||[])

  // UI
  const isNew = !cls?.id
  const [settingOpen, setSettingOpen] = useState(isNew)
  const [termOpen,    setTermOpen]    = useState(isNew)
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
    setTermSessionMap(cls.termSessionMap||{})
    setDefaultSessions(cls.defaultSessions||4)
    setRegPeriods(cls.regPeriods || Array.from({length: cls.quarters||4}, ()=>({start:'',end:''})))
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
    setRegPeriods(prev => Array.from({length:n},(_,i)=>prev[i]||{start:'',end:''}))
  }

  // 분기별 텀 수 변경 (1~12)
  const handleQTermCount = (qIdx, val) => {
    const maxT = termType==='semester' ? 7 : 4
    setQuarterTermCounts(prev => { const n=[...prev]; n[qIdx]=Math.max(1,Math.min(maxT,parseInt(val)||1)); return n })
  }

  // 날짜 계산 — 3월 시작 ~ 다음해 2월 말
  const dayNums    = days.map(d=>dayNameToNum[d]).filter(n=>n!==undefined)
  const marchStart = fmt(year,3,1)
  const nextFebEnd = fmt(year+1,2,28)  // 다음해 2월 말

  const vacationDates = new Set()
  if(sumStart&&sumEnd){let d=new Date(sumStart+'T00:00:00'),e=new Date(sumEnd+'T00:00:00');while(d<=e){vacationDates.add(fmt(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}
  if(winStart&&winEnd){let d=new Date(winStart+'T00:00:00'),e=new Date(winEnd+'T00:00:00');while(d<=e){vacationDates.add(fmt(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}

  const cancelledSet    = new Set(cancelledDates.map(c=>c.date))
  const allSessionDates = dayNums.length>0
    ? getDatesInRange(marchStart,nextFebEnd,dayNums).filter(d=>!cancelledSet.has(d)&&!vacationDates.has(d))
    : []

  // 텀 경계 (분기/학기) — 날짜 미입력 시 기본값 적용
  let termBoundaries = []
  const numPeriods = termType==='semester' ? 2 : quarters
  if(termType==='semester'){
    // 1학기: 3월~8월말 (sem1End 입력 시 우선)
    const sem1EndDefault = fmt(year,8,31)
    const sem1EndFinal   = sem1End || sem1EndDefault
    // 여름방학 있으면 그 다음날, 없으면 9월1일
    const sem2Start = sumEnd ? addDays(sumEnd,1) : fmt(year,9,1)
    // 2학기: sem2Start~다음해2월말 (sem2End 입력 시 우선)
    const sem2EndFinal = sem2End || fmt(year+1,2,28)
    termBoundaries = [
      {start:marchStart,  end:sem1EndFinal,  label:'1학기'},
      {start:sem2Start,   end:sem2EndFinal,  label:'2학기'},
    ]
  } else {
    // 4분기 기본: 3~5월 / 6~8월 / 9~11월 / 12~2월
    const defEnds = [fmt(year,5,31), fmt(year,8,31), fmt(year,11,30), fmt(year+1,2,28)]
    let prevEnd = fmt(year,2,28)
    for(let i=0;i<quarters;i++){
      const qEnd = qEnds[i] || defEnds[i] || fmt(year+1,2,28)
      termBoundaries.push({start:addDays(prevEnd,1), end:qEnd, label:`${i+1}분기`})
      prevEnd = qEnd
    }
  }

  // quarterTermCounts를 학기/분기 수에 맞게 슬라이스
  const activeTermCounts = Array.from({length:numPeriods},(_,i)=>quarterTermCounts[i]||3)
  const totalTerms = activeTermCounts.reduce((a,b)=>a+b,0)

  // 전체 회차 합계
  const totalSessions = activeTermCounts.reduce((sum, tCount, qIdx) => {
    for(let tIdx=0; tIdx<tCount; tIdx++) sum += getTermSessions(qIdx, tIdx)
    return sum
  }, 0)

  // buildSessionMap에 넘길 텀별 회차 수 배열
  const flatTermSessions = []
  activeTermCounts.forEach((tCount, qIdx) => {
    for(let tIdx=0; tIdx<tCount; tIdx++) flatTermSessions.push(getTermSessions(qIdx, tIdx))
  })

  const {sessionMap, termMap} = buildSessionMap({
    allSessionDates, termBoundaries,
    quarterTermCounts: activeTermCounts,
    flatTermSessions,
  })

  // 달력: 3월~다음해 2월 (12개월)
  const months = [
    ...Array.from({length:10},(_,i)=>({year,     month:i+2})),  // 3~12월 (month: 2~11)
    ...Array.from({length:2}, (_,i)=>({year:year+1, month:i})), // 다음해 1~2월 (month: 0~1)
  ]
  const makeupCount = makeupDates.length

  const saveAll = (patch={}) => {
    if(!onUpdate) return
    onUpdate({
      title,year,termType,days,
      sem1End,sumStart,sumEnd,sem2End,winStart,winEnd,
      quarters,qEnds,
      quarterTermCounts:activeTermCounts,
      termSessionMap, defaultSessions,
      regPeriods,
      cancelledDates,makeupDates,
      startDate:marchStart, endDate:nextFebEnd,
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
    if(clickType==='session'){
      const updC2=[...updC,{date:selectedDate,reason:'manual_exclude',memo:'사용자 지정 수업일 제외'}]
      setCancelledDates(updC2);setShowAction(false)
      saveAll({cancelledDates:updC2})
    } else {
      setCancelledDates(updC);setMakeupDates(updM);setShowAction(false)
      saveAll({cancelledDates:updC,makeupDates:updM})
    }
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

      {/* ════ 상단 고정 저장/수정 바 ════ */}
      <div style={{
        position:'sticky', top:0, zIndex:100,
        background:'#1e3a5f', borderRadius:'12px',
        padding:'10px 16px', marginBottom:'14px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        boxShadow:'0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'13px',fontWeight:700,color:'#fff'}}>
            {title || '일정명을 입력하세요'}
          </span>
          {totalSessions>0&&(
            <span style={{fontSize:'12px',color:'#93c5fd'}}>
              총 {totalTerms}텀 · {totalSessions}회차
            </span>
          )}
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>{setSettingOpen(true);setTermOpen(true)}}
            style={{padding:'7px 16px',borderRadius:'8px',border:'1.5px solid #93c5fd',
              background:'transparent',color:'#93c5fd',fontSize:'13px',fontWeight:700,
              cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>
            ✏️ 설정 수정
          </button>
          <button onClick={()=>saveAll()}
            style={{padding:'7px 20px',borderRadius:'8px',border:'none',
              background:'#3b82f6',color:'#fff',fontSize:'13px',fontWeight:700,
              cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>
            💾 저장
          </button>
        </div>
      </div>

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

            {/* 신청기간 — 분기/학기별 동적 생성 */}
            <div style={{marginBottom:'14px',background:'#f0f9ff',borderRadius:'10px',padding:'14px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#0369a1',marginBottom:'12px'}}>📅 신청기간 설정</div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {termBoundaries.map((b,i)=>{
                  const qc = getQuarterColor(i+1)
                  const rp = regPeriods[i]||{start:'',end:''}
                  return (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'80px 1fr 1fr',gap:'8px',alignItems:'center'}}>
                      <div style={{fontSize:'12px',fontWeight:700,color:qc.text,
                        background:qc.bg,border:`1px solid ${qc.border}`,
                        borderRadius:'6px',padding:'4px 8px',textAlign:'center'}}>
                        {b.label}
                      </div>
                      <div>
                        <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>신청 시작일</label>
                        <input type="date" value={rp.start}
                          onChange={e=>{
                            const updated=[...regPeriods]
                            updated[i]={...rp,start:e.target.value}
                            setRegPeriods(updated)
                          }}
                          onBlur={()=>saveAll()}
                          style={{...iSt,border:'1.5px solid #bae6fd',padding:'6px 8px'}}/>
                      </div>
                      <div>
                        <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>신청 종료일</label>
                        <input type="date" value={rp.end}
                          onChange={e=>{
                            const updated=[...regPeriods]
                            updated[i]={...rp,end:e.target.value}
                            setRegPeriods(updated)
                          }}
                          onBlur={()=>saveAll()}
                          style={{...iSt,border:'1.5px solid #bae6fd',padding:'6px 8px'}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button onClick={()=>setSettingOpen(false)}
              style={{padding:'8px 20px',borderRadius:'9px',border:'1.5px solid #e5e7eb',background:'#fff',color:'#374151',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>
              ▲ 접기
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
              총 {totalTerms}텀 · 총 {totalSessions}회차
            </span>}
          </div>
          <span style={{fontSize:'18px',color:'#9ca3af'}}>{termOpen?'▲':'▼'}</span>
        </div>
        {termOpen&&(
          <div style={{padding:'18px'}}>

            {/* STEP1: 기본 회차 수 빠른 설정 */}
            <div style={{marginBottom:'20px'}}>
              <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'8px'}}>
                기본 회차 수 <span style={{color:'#9ca3af'}}>(모든 텀에 일괄 적용)</span>
              </label>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                {(termType==='semester' ? [2,3,4,5,6,8,10,12,16,20,24] : [2,3,4,6,8,10,12]).map(n=>(
                  <button key={n} onClick={()=>{
                    setDefaultSessions(n)
                    // 모든 텀을 이 값으로 초기화
                    const newMap = {}
                    activeTermCounts.forEach((tCount,qIdx)=>{
                      for(let tIdx=0;tIdx<tCount;tIdx++) newMap[`q${qIdx}t${tIdx}`]=n
                    })
                    setTermSessionMap(newMap)
                  }}
                    style={{padding:'6px 14px',borderRadius:'8px',
                      border:`1.5px solid ${defaultSessions===n?'#1e3a5f':'#e5e7eb'}`,
                      background:defaultSessions===n?'#1e3a5f':'#fff',
                      color:defaultSessions===n?'#fff':'#374151',
                      fontSize:'13px',fontWeight:defaultSessions===n?700:400,
                      cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{n}회</button>
                ))}
              </div>
            </div>

            {/* STEP2: 학기/분기별 텀 수 + 텀별 회차 수 개별 설정 */}
            <div style={{marginBottom:'16px'}}>
              <label style={{fontSize:'12px',color:'#6b7280',display:'block',marginBottom:'10px'}}>
                {termType==='semester'?'학기':'분기'}별 텀 수 및 텀별 회차 수 설정
                <span style={{fontSize:'11px',color:'#9ca3af',marginLeft:'8px'}}>
                  ({termType==='semester'?'학기당 최대 7텀 / 텀당 최대 24회':'분기당 최대 4텀 / 텀당 최대 12회'})
                </span>
              </label>
              <div style={{display:'flex',gap:'16px',flexWrap:'wrap'}}>
                {termBoundaries.map((b,qIdx)=>{
                  const qc = getQuarterColor(qIdx+1)
                  const tCount = activeTermCounts[qIdx]||1
                  const maxTerms = termType==='semester' ? 7 : 4
                  const maxSess  = termType==='semester' ? 24 : 12

                  return (
                    <div key={qIdx} style={{background:qc.bg,border:`1.5px solid ${qc.border}`,borderRadius:'14px',padding:'16px',minWidth:'220px',flex:'1'}}>
                      {/* 학기/분기 타이틀 */}
                      <div style={{fontSize:'14px',fontWeight:700,color:qc.text,marginBottom:'12px'}}>{b.label}</div>

                      {/* 텀 수 선택 */}
                      <div style={{marginBottom:'14px'}}>
                        <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'6px'}}>텀 수</div>
                        <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                          {Array.from({length:maxTerms},(_,j)=>j+1).map(n=>(
                            <button key={n} onClick={()=>handleQTermCount(qIdx,n)}
                              style={{width:'30px',height:'30px',borderRadius:'7px',
                                border:`1.5px solid ${tCount===n?qc.border:'#e5e7eb'}`,
                                background:tCount===n?qc.border:'#fff',
                                color:tCount===n?'#fff':'#374151',
                                fontSize:'13px',fontWeight:tCount===n?700:400,
                                cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{n}</button>
                          ))}
                        </div>
                      </div>

                      {/* 텀별 회차 수 개별 설정 */}
                      <div>
                        <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'8px'}}>텀별 회차 수</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                          {Array.from({length:tCount},(_,tIdx)=>{
                            const sess = getTermSessions(qIdx, tIdx)
                            const badge = getTermBadge(activeTermCounts.slice(0,qIdx).reduce((a,b)=>a+b,0)+tIdx)
                            // 누적 차시 계산
                            let cumStart = 1
                            for(let qi=0;qi<qIdx;qi++) for(let ti=0;ti<(activeTermCounts[qi]||1);ti++) cumStart+=getTermSessions(qi,ti)
                            for(let ti=0;ti<tIdx;ti++) cumStart+=getTermSessions(qIdx,ti)
                            const cumEnd = cumStart+sess-1

                            return (
                              <div key={tIdx} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                {/* 텀 뱃지 */}
                                <div style={{fontSize:'11px',fontWeight:700,color:'#fff',background:badge,
                                  borderRadius:'5px',padding:'2px 8px',minWidth:'36px',textAlign:'center',flexShrink:0}}>
                                  {tIdx+1}텀
                                </div>
                                {/* 회차 수 조절 */}
                                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                                  <button onClick={()=>setTermSessions(qIdx,tIdx,Math.max(1,sess-1))}
                                    style={{width:'24px',height:'24px',borderRadius:'5px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'14px',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                                  <input type="number" min={1} max={maxSess} value={sess}
                                    onChange={e=>setTermSessions(qIdx,tIdx,e.target.value)}
                                    onBlur={()=>saveAll()}
                                    style={{width:'44px',padding:'3px 4px',borderRadius:'6px',border:`1.5px solid ${badge}`,fontSize:'14px',fontWeight:700,outline:'none',textAlign:'center'}}/>
                                  <button onClick={()=>setTermSessions(qIdx,tIdx,Math.min(maxSess,sess+1))}
                                    style={{width:'24px',height:'24px',borderRadius:'5px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'14px',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                                </div>
                                {/* 차시 범위 */}
                                <span style={{fontSize:'10px',color:'#9ca3af'}}>{cumStart}~{cumEnd}차</span>
                              </div>
                            )
                          })}
                        </div>
                        {/* 소계 */}
                        <div style={{marginTop:'10px',fontSize:'11px',fontWeight:700,color:qc.text}}>
                          {tCount}텀 · 소계 {Array.from({length:tCount},(_,ti)=>getTermSessions(qIdx,ti)).reduce((a,b)=>a+b,0)}회차
                        </div>
                        {/* 요일별 예상 종료 차시 */}
                        {days.length>0&&(()=>{
                          const boundary = termBoundaries[qIdx]
                          if(!boundary) return null
                          const cancelledSetLocal = new Set(cancelledDates.map(c=>c.date))
                          const vacSetLocal = new Set()
                          if(sumStart&&sumEnd){let d=new Date(sumStart+'T00:00:00'),e=new Date(sumEnd+'T00:00:00');while(d<=e){vacSetLocal.add(fmt(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}
                          if(winStart&&winEnd){let d=new Date(winStart+'T00:00:00'),e=new Date(winEnd+'T00:00:00');while(d<=e){vacSetLocal.add(fmt(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}
                          const periodSessions = allSessionDates.filter(d=>d>=boundary.start&&d<=boundary.end)
                          // 요일별 날짜 분류
                          const byDow = {}
                          days.forEach(day=>{const n=dayNameToNum[day];if(n!==undefined)byDow[n]=[]})
                          periodSessions.forEach(d=>{const dow=getDow(d);if(byDow[dow])byDow[dow].push(d)})
                          const totalPeriodSess = Array.from({length:tCount},(_,ti)=>getTermSessions(qIdx,ti)).reduce((a,b)=>a+b,0)
                          const rows = Object.entries(byDow).map(([dow,dates])=>{
                            const cnt = dates.length
                            // 몇 텀 몇 차에서 끝나는지 계산
                            let rem = cnt, tIdx2=0, inT=0
                            while(rem>0&&tIdx2<tCount){
                              const s=getTermSessions(qIdx,tIdx2)
                              const avail=s-inT
                              if(rem>=avail){rem-=avail;tIdx2++;inT=0}
                              else{inT+=rem;rem=0}
                            }
                            const finalTerm = Math.min(tIdx2+1, tCount)
                            const finalSess = tIdx2>=tCount ? getTermSessions(qIdx,tCount-1) : (inT===0&&tIdx2>0?getTermSessions(qIdx,tIdx2-1):inT)
                            const ok = cnt>=totalPeriodSess
                            return {dow:parseInt(dow),cnt,finalTerm,finalSess,ok}
                          })
                          if(rows.length===0) return null
                          return (
                            <div style={{marginTop:'10px',background:'#f8fafc',borderRadius:'8px',padding:'10px',border:'1px solid #e2e8f0'}}>
                              <div style={{fontSize:'11px',fontWeight:700,color:'#374151',marginBottom:'6px'}}>📊 요일별 예상 종료</div>
                              <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                                {rows.map(({dow,cnt,finalTerm,finalSess,ok})=>{
                                  const theme=getDayTheme(dow)
                                  const label=['일','월','화','수','목','금','토'][dow]
                                  return (
                                    <div key={dow} style={{display:'flex',alignItems:'center',gap:'4px',
                                      padding:'4px 10px',borderRadius:'8px',
                                      background:ok?theme.bg:'#fef2f2',
                                      border:`1.5px solid ${ok?theme.badge1:'#fca5a5'}`}}>
                                      <span style={{fontSize:'12px',fontWeight:700,color:theme.text}}>{label}</span>
                                      <span style={{fontSize:'11px',color:'#374151'}}>{cnt}회</span>
                                      <span style={{fontSize:'11px',fontWeight:700,color:ok?'#16a34a':'#ef4444'}}>
                                        → {finalTerm}텀{finalSess}차
                                      </span>
                                      {!ok&&<span style={{fontSize:'10px',color:'#ef4444'}}>⚠️ 부족</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 전체 요약 */}
            <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'14px'}}>
              <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'10px',fontWeight:600}}>전체 구성 요약</div>
              {termBoundaries.map((b,qIdx)=>{
                const tCount = activeTermCounts[qIdx]||1
                const qc = getQuarterColor(qIdx+1)
                const prevTerms = activeTermCounts.slice(0,qIdx).reduce((a,b)=>a+b,0)
                const periodSessions = Array.from({length:tCount},(_,ti)=>getTermSessions(qIdx,ti)).reduce((a,b)=>a+b,0)
                return (
                  <div key={qIdx} style={{marginBottom:'10px'}}>
                    {/* 학기/분기 헤더 */}
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
                      <div style={{padding:'3px 10px',borderRadius:'20px',background:qc.bg,border:`1.5px solid ${qc.border}`}}>
                        <span style={{fontSize:'12px',fontWeight:800,color:qc.text}}>{b.label}</span>
                      </div>
                      <span style={{fontSize:'11px',color:'#9ca3af'}}>{tCount}텀 · {periodSessions}회차</span>
                    </div>
                    {/* 텀 뱃지 목록 */}
                    <div style={{display:'flex',gap:'5px',flexWrap:'wrap',paddingLeft:'4px'}}>
                      {Array.from({length:tCount},(_,tIdx)=>{
                        const globalTIdx = prevTerms+tIdx
                        const badge = getTermBadge(globalTIdx)
                        const sess = getTermSessions(qIdx,tIdx)
                        let cumStart=1
                        for(let qi=0;qi<qIdx;qi++) for(let ti=0;ti<(activeTermCounts[qi]||1);ti++) cumStart+=getTermSessions(qi,ti)
                        for(let ti=0;ti<tIdx;ti++) cumStart+=getTermSessions(qIdx,ti)
                        const cumEnd=cumStart+sess-1
                        return (
                          <div key={`${qIdx}-${tIdx}`} style={{display:'flex',alignItems:'center',gap:'3px',
                            padding:'3px 8px',background:qc.bg,border:`1.5px solid ${badge}`,borderRadius:'16px'}}>
                            <span style={{fontSize:'10px',fontWeight:700,color:badge}}>{tIdx+1}텀 {sess}회</span>
                            <span style={{fontSize:'9px',color:qc.text}}>{cumStart}~{cumEnd}차</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <div style={{fontSize:'13px',color:'#374151',fontWeight:700,marginTop:'4px',paddingTop:'10px',borderTop:'1px solid #f3f4f6'}}>
                총 <span style={{color:'#f97316'}}>{totalTerms}텀</span>
                {' · '}총 <span style={{color:'#16a34a'}}>{totalSessions}회차</span>
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
      <div style={{display:'flex',gap:'10px',marginTop:'12px',fontSize:'11px',color:'#9ca3af',flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:'11px',fontWeight:600,color:'#374151'}}>요일:</span>
        {[1,2,3,4,5].map(dow=>{
          const theme = getDayTheme(dow)
          const label = ['','월','화','수','목','금'][dow]
          return (
            <span key={dow} style={{display:'flex',alignItems:'center',gap:'3px'}}>
              <span style={{width:'14px',height:'14px',borderRadius:'4px',background:theme.bg,border:`1.5px solid ${theme.badge1}`,display:'inline-block'}}/>
              <span style={{color:theme.text,fontWeight:600}}>{label}</span>
            </span>
          )
        })}
        <span style={{marginLeft:'6px',fontWeight:600,color:'#374151'}}>{termType==='semester'?'학기':'분기'} 테두리:</span>
        {termBoundaries.map((b,i)=>(
          <span key={i} style={{display:'flex',alignItems:'center',gap:'3px'}}>
            <span style={{width:'14px',height:'14px',borderRadius:'4px',background:'#fff',border:`2px solid ${getQuarterColor(i+1).border}`,display:'inline-block'}}/>
            <span style={{color:getQuarterColor(i+1).text,fontWeight:600}}>{b.label}</span>
          </span>
        ))}
        <span style={{display:'flex',alignItems:'center',gap:'3px'}}>
          <span style={{width:'14px',height:'14px',borderRadius:'4px',background:'#fef2f2',border:'1.5px solid #fca5a5',display:'inline-block'}}/>휴일
        </span>
        <span style={{display:'flex',alignItems:'center',gap:'3px'}}>
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
