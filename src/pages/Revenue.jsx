import React, { useState, useEffect, useMemo } from 'react'
import { uid, now, today, localDateStr, calcSessionDates, sortClasses } from '../lib/utils.js'
import { Classes, Students, RevenueFees, RevenuePayments } from '../lib/db.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b', blue: '#3b82f6',
}

function fmt(n) { return Number(n || 0).toLocaleString('ko-KR') }

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getWeekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon); dd.setDate(mon.getDate() + i); return localDateStr(dd)
  })
}
function getMonthDates(ym) {
  const [y, m] = ym.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) =>
    `${ym}-${String(i + 1).padStart(2, '0')}`)
}
function toYM(d) { return d.slice(0, 7) }

// 기존 termSizes 그대로 사용해서 텀별 날짜 배열 생성
// utils.js의 calcSessionDates + cls.termSizes 활용
function getTerms(cls) {
  const sessions = calcSessionDates(cls)
  const termSizes = (cls.termSizes?.length > 0)
    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
    : null

  if (!termSizes) {
    return [{ termNo: 1, label: '전체', sessions }]
  }

  const terms = []
  let idx = 0
  termSizes.forEach((size, i) => {
    const slice = sessions.slice(idx, idx + size)
    if (slice.length > 0) {
      terms.push({
        termNo: i + 1,
        label: `${i + 1}텀`,
        sessions: slice,
        startDate: slice[0],
        endDate: slice[slice.length - 1],
      })
    }
    idx += size
  })
  // 남은 회차(termSizes 합보다 실제 수업일이 더 많은 경우) → 마지막 텀에 합산
  if (idx < sessions.length && terms.length > 0) {
    const extra = sessions.slice(idx)
    terms[terms.length - 1].sessions.push(...extra)
    terms[terms.length - 1].endDate = extra[extra.length - 1]
  }
  return terms
}

function isTermCurrent(term) {
  const t = today()
  return term.startDate <= t && t <= term.endDate
}

const iStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid #e5e7eb', fontSize: '14px',
  fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box',
}

export function Revenue({ user }) {
  const [tab, setTab]           = useState('calendar')
  const [calView, setCalView]   = useState('month')
  const [curDate, setCurDate]   = useState(today())
  const [fees, setFees]         = useState([])
  const [payments, setPayments] = useState([])
  const [classes, setClasses]   = useState([])
  const [students, setStudents] = useState([])

  const [feeModal, setFeeModal]   = useState(false)
  const [feeTarget, setFeeTarget] = useState(null)
  const [feeForm, setFeeForm]     = useState({ feeType: 'per_session', amount: '' })

  const [payModal, setPayModal] = useState(false)
  const [payDate, setPayDate]   = useState(today())
  const [payForm, setPayForm]   = useState({ classId: '', termNo: '', amount: '', memo: '', reason: '' })

  const [expandedClass, setExpandedClass] = useState(null)

  const reload = () => {
    setFees(RevenueFees.byTeacher(user.id))
    setPayments(RevenuePayments.byTeacher(user.id))
    setClasses(Classes.byTeacher(user.id))
    setStudents(Students.byTeacher(user.id))
  }
  useEffect(() => { reload() }, [])

  // utils.js의 sortClasses 그대로 사용
  const sorted = useMemo(() => sortClasses(classes), [classes])

  const confirmedCount = useMemo(() => {
    const m = {}
    classes.forEach(c => {
      m[c.id] = students.filter(s => s.classIds?.includes(c.id) && s.status === 'confirmed').length
    })
    return m
  }, [classes, students])

  const feeMap = useMemo(() => {
    const m = {}; fees.forEach(f => { m[f.classId] = f }); return m
  }, [fees])

  // 일별 예상수익
  const allDailyRevenue = useMemo(() => {
    const result = {}
    classes.forEach(cls => {
      const fee = feeMap[cls.id]
      const cnt = confirmedCount[cls.id] || 0
      if (!fee || !cnt) return
      const sessions = calcSessionDates(cls)
      if (!sessions.length) return
      const perSession = fee.feeType === 'per_session'
        ? Number(fee.amount)
        : Math.round(Number(fee.amount) / sessions.length)
      sessions.forEach(d => { result[d] = (result[d] || 0) + perSession * cnt })
    })
    return result
  }, [classes, feeMap, confirmedCount])

  // 날짜별 입금 맵
  const payByDate = useMemo(() => {
    const m = {}
    payments.forEach(p => { if (!m[p.date]) m[p.date] = []; m[p.date].push(p) })
    return m
  }, [payments])

  // 수업별 입금 맵
  const payByClass = useMemo(() => {
    const m = {}
    payments.forEach(p => { if (!m[p.classId]) m[p.classId] = []; m[p.classId].push(p) })
    return m
  }, [payments])

  const curYM = toYM(curDate)
  const monthDates = getMonthDates(curYM)
  const monthTotal = monthDates.reduce((s, d) => s + (allDailyRevenue[d] || 0), 0)

  const weekDayRevenue = useMemo(() => {
    const wdr = Array(7).fill(0)
    monthDates.forEach(d => {
      const dow = new Date(d + 'T00:00:00').getDay()
      const idx = dow === 0 ? 6 : dow - 1
      wdr[idx] += allDailyRevenue[d] || 0
    })
    return wdr
  }, [allDailyRevenue, curYM])

  // 이번달 텀 요약
  const monthSummary = useMemo(() => {
    let expected = 0, paid = 0
    sorted.forEach(cls => {
      const fee = feeMap[cls.id]
      const cnt = confirmedCount[cls.id] || 0
      if (!fee || !cnt) return
      const terms = getTerms(cls)
      const sessions = calcSessionDates(cls)
      const perSession = fee.feeType === 'per_session'
        ? Number(fee.amount)
        : Math.round(Number(fee.amount) / sessions.length)
      terms.forEach(term => {
        const hasThisMonth = term.sessions.some(d => d.slice(0, 7) === curYM)
        if (!hasThisMonth) return
        expected += perSession * cnt * term.sessions.length
        const clsPays = payByClass[cls.id] || []
        const termPays = clsPays.filter(p =>
          p.termNo === term.termNo ||
          (!p.termNo && p.date >= term.startDate && p.date <= term.endDate)
        )
        paid += termPays.reduce((s, p) => s + p.amount, 0)
      })
    })
    return { expected, paid, unpaid: expected - paid }
  }, [sorted, feeMap, confirmedCount, payByClass, curYM])

  const saveFeeForm = () => {
    if (!feeForm.amount) { alert('금액을 입력하세요'); return }
    RevenueFees.upsert({
      teacherId: user.id, classId: feeTarget.classId,
      feeType: feeForm.feeType, amount: Number(feeForm.amount), updatedAt: now(),
    })
    reload(); setFeeModal(false)
  }

  const savePayForm = () => {
    if (!payForm.classId) { alert('수업을 선택하세요'); return }
    if (!payForm.amount)  { alert('금액을 입력하세요'); return }
    RevenuePayments.insert({
      id: uid(), teacherId: user.id,
      classId: payForm.classId,
      termNo: payForm.termNo ? Number(payForm.termNo) : null,
      date: payDate,
      amount: Number(payForm.amount),
      memo: payForm.memo,
      reason: payForm.reason,
      createdAt: now(),
    })
    reload(); setPayModal(false)
  }

  const deletePayment = (id) => { RevenuePayments.delete(id); reload() }

  const openPayModal = (date, classId = '', termNo = '') => {
    // 수업이 지정된 경우 현재 진행중 텀 자동 선택
    let autoTermNo = termNo
    if (classId && !termNo) {
      const cls = sorted.find(c => c.id === classId)
      if (cls) {
        const terms = getTerms(cls)
        const cur = terms.find(isTermCurrent) || terms[0]
        autoTermNo = String(cur?.termNo || '')
      }
    }
    setPayDate(date)
    setPayForm({ classId: classId || (sorted[0]?.id || ''), termNo: String(autoTermNo), amount: '', memo: '', reason: '' })
    setPayModal(true)
  }

  // 달력 렌더 (월요일 시작)
  const renderMonthCalendar = () => {
    const [y, m] = curYM.split('-').map(Number)
    const firstDow = new Date(y, m - 1, 1).getDay()
    const offset = firstDow === 0 ? 6 : firstDow - 1
    const totalDays = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < offset; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(`${curYM}-${String(d).padStart(2, '0')}`)

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
          {DAY_LABELS.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '4px 0', color: i === 5 ? C.blue : i === 6 ? C.danger : C.muted }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} />
            const rev  = allDailyRevenue[date] || 0
            const pays = payByDate[date] || []
            const isToday = date === today()
            const isSel   = date === curDate
            const dow = new Date(date + 'T00:00:00').getDay()
            return (
              <div key={date} onClick={() => { setCurDate(date); openPayModal(date) }}
                title="클릭 → 입금 등록"
                style={{ borderRadius: '8px', padding: '5px 4px', cursor: 'pointer', minHeight: '52px', transition: 'all .1s', background: isSel ? C.primary : isToday ? '#fff7ed' : '#fff', border: `1px solid ${isSel ? C.primary : isToday ? '#fed7aa' : C.border}` }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px', color: isSel ? '#fff' : dow === 6 ? C.blue : dow === 0 ? C.danger : C.text }}>
                  {Number(date.slice(-2))}
                </div>
                {rev > 0 && <div style={{ fontSize: '9px', fontWeight: 700, color: isSel ? '#fff' : C.success, lineHeight: 1.3 }}>예{fmt(rev)}</div>}
                {pays.length > 0 && <div style={{ fontSize: '9px', fontWeight: 700, color: isSel ? '#ffffffcc' : C.blue, lineHeight: 1.3 }}>입{fmt(pays.reduce((s, p) => s + p.amount, 0))}</div>}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: C.muted, textAlign: 'center' }}>날짜 클릭 → 입금 등록 · 예=예상 · 입=입금</div>
      </div>
    )
  }

  const renderWeekCalendar = () => {
    const weekDates = getWeekDates(curDate)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
        {weekDates.map((date, i) => {
          const rev  = allDailyRevenue[date] || 0
          const pays = payByDate[date] || []
          const isSel = date === curDate, isToday = date === today()
          return (
            <div key={date} onClick={() => { setCurDate(date); openPayModal(date) }}
              style={{ borderRadius: '10px', padding: '10px 6px', cursor: 'pointer', textAlign: 'center', background: isSel ? C.primary : isToday ? '#fff7ed' : '#fff', border: `1.5px solid ${isSel ? C.primary : isToday ? '#fed7aa' : C.border}` }}>
              <div style={{ fontSize: '11px', color: isSel ? '#fff' : i === 5 ? C.blue : i === 6 ? C.danger : C.muted, marginBottom: '4px' }}>{DAY_LABELS[i]}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: isSel ? '#fff' : C.text }}>{Number(date.slice(-2))}</div>
              {rev > 0 && <div style={{ fontSize: '9px', color: isSel ? '#fff' : C.success, marginTop: '3px', fontWeight: 700 }}>예{fmt(rev)}</div>}
              {pays.length > 0 && <div style={{ fontSize: '9px', color: isSel ? '#ffffffcc' : C.blue, fontWeight: 700 }}>입{fmt(pays.reduce((s, p) => s + p.amount, 0))}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  const dayClasses  = sorted.filter(cls => calcSessionDates(cls).includes(curDate))
  const dayPayments = payByDate[curDate] || []

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, margin: 0 }}>💰 수익관리</h1>
          <p style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>수업별·텀별 수강료 및 입금 현황</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[['calendar','📅 달력'],['terms','📊 텀 크로스체크'],['fees','💳 수강료 등록']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600, fontSize: '13px', background: tab === t ? C.primary : '#f3f4f6', color: tab === t ? '#fff' : C.muted }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 달력 탭 */}
      {tab === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
          <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[['month','월'],['week','주']].map(([v,l]) => (
                  <button key={v} onClick={() => setCalView(v)}
                    style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '13px', fontWeight: 600, background: calView===v?C.primary:'#f3f4f6', color: calView===v?'#fff':C.muted }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => { const d=new Date(curDate+'T00:00:00'); calView==='month'?d.setMonth(d.getMonth()-1):d.setDate(d.getDate()-7); setCurDate(localDateStr(d)) }}
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'14px' }}>‹</button>
                <span style={{ fontSize:'15px', fontWeight:700, color:C.text, minWidth:'90px', textAlign:'center' }}>
                  {calView==='month'?`${curYM.replace('-','년 ')}월`:`${curDate.slice(5).replace('-','/')} 주`}
                </span>
                <button onClick={() => { const d=new Date(curDate+'T00:00:00'); calView==='month'?d.setMonth(d.getMonth()+1):d.setDate(d.getDate()+7); setCurDate(localDateStr(d)) }}
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'14px' }}>›</button>
              </div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.success }}>{curYM.slice(5)}월 예상 {fmt(monthTotal)}원</div>
            </div>
            {calView === 'month' ? renderMonthCalendar() : renderWeekCalendar()}
          </div>

          {/* 우측 패널 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'10px' }}>📅 {curDate.replace(/-/g,'.').slice(2)} 수업</div>
              {dayClasses.length === 0
                ? <div style={{ textAlign:'center', padding:'16px', color:C.muted, fontSize:'13px' }}>수업 없음</div>
                : <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {dayClasses.map(cls => {
                      const fee=feeMap[cls.id], cnt=confirmedCount[cls.id]||0
                      const sessions=calcSessionDates(cls)
                      const perSession = fee?(fee.feeType==='per_session'?fee.amount:Math.round(fee.amount/sessions.length)):0
                      const dayRev = perSession*cnt
                      return (
                        <div key={cls.id} style={{ padding:'10px 12px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fafafa' }}>
                          <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>
                            🏫 {cls.organization} · {cls.className}{cls.section?' '+cls.section:''}
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:'12px', color:C.muted }}>{cnt}명{cls.time?` · ${cls.time}`:''}</span>
                            {dayRev > 0
                              ? <span style={{ fontSize:'13px', fontWeight:700, color:C.success }}>+{fmt(dayRev)}원</span>
                              : <button onClick={() => { setFeeTarget({classId:cls.id,org:cls.organization,className:cls.className}); setFeeForm({feeType:'per_session',amount:''}); setFeeModal(true) }}
                                  style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                                  수강료 설정
                                </button>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>

            <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>💵 입금 내역</div>
                <button onClick={() => openPayModal(curDate)}
                  style={{ padding:'5px 12px', borderRadius:'8px', border:'none', background:C.success, color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  + 입금 등록
                </button>
              </div>
              {dayPayments.length === 0
                ? <div style={{ textAlign:'center', padding:'12px', color:C.muted, fontSize:'13px' }}>입금 내역 없음</div>
                : <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {dayPayments.map(p => {
                      const cls = classes.find(c=>c.id===p.classId)
                      return (
                        <div key={p.id} style={{ padding:'8px 10px', borderRadius:'8px', background:'#f0fdf4', border:'1px solid #86efac' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'12px', fontWeight:600, color:C.text }}>
                                {cls?`${cls.organization} · ${cls.className}${cls.section?' '+cls.section:''}`:' 수업 미상'}
                                {p.termNo&&<span style={{ marginLeft:'6px', fontSize:'11px', background:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px' }}>{p.termNo}텀</span>}
                              </div>
                              {p.memo&&<div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{p.memo}</div>}
                              {p.reason&&<div style={{ fontSize:'11px', color:C.warning, marginTop:'2px' }}>📝 {p.reason}</div>}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                              <span style={{ fontSize:'13px', fontWeight:700, color:C.success }}>+{fmt(p.amount)}원</span>
                              <button onClick={()=>deletePayment(p.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:0 }}>×</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>

            <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'8px' }}>{curYM.slice(5)}월 요일별 예상수익</div>
              {DAY_LABELS.map((label, i) => weekDayRevenue[i] > 0 && (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px' }}>
                  <span style={{ width:'20px', fontSize:'12px', textAlign:'center', color:i===5?C.blue:i===6?C.danger:C.muted }}>{label}</span>
                  <div style={{ flex:1, height:'6px', borderRadius:'3px', background:'#f3f4f6', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round(weekDayRevenue[i]/Math.max(...weekDayRevenue)*100)}%`, background:C.primary, borderRadius:'3px' }} />
                  </div>
                  <span style={{ fontSize:'11px', color:C.text, fontWeight:600, minWidth:'64px', textAlign:'right' }}>{fmt(weekDayRevenue[i])}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 텀 크로스체크 탭 */}
      {tab === 'terms' && (
        <div>
          {/* 이번달 요약 + 월 이동 */}
          <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
            {[
              { label:`${curYM.slice(5)}월 포함 텀 예상`, value:fmt(monthSummary.expected)+'원', color:C.primary, bg:'#fff7ed', border:'#fed7aa' },
              { label:'입금', value:fmt(monthSummary.paid)+'원', color:C.success, bg:'#f0fdf4', border:'#86efac' },
              { label:'미수금', value:fmt(monthSummary.unpaid)+'원', color:monthSummary.unpaid>0?C.danger:C.muted, bg:monthSummary.unpaid>0?'#fef2f2':'#f9fafb', border:monthSummary.unpaid>0?'#fca5a5':C.border },
            ].map(s => (
              <div key={s.label} style={{ padding:'12px 20px', borderRadius:'12px', background:s.bg, border:`1px solid ${s.border}` }}>
                <div style={{ fontSize:'20px', fontWeight:700, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px' }}>
              <button onClick={() => { const d=new Date(curYM+'-01'); d.setMonth(d.getMonth()-1); setCurDate(localDateStr(d)) }}
                style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 12px', cursor:'pointer', fontSize:'14px' }}>‹</button>
              <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{curYM.replace('-','년 ')}월 기준</span>
              <button onClick={() => { const d=new Date(curYM+'-01'); d.setMonth(d.getMonth()+1); setCurDate(localDateStr(d)) }}
                style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 12px', cursor:'pointer', fontSize:'14px' }}>›</button>
            </div>
          </div>

          {sorted.length === 0
            ? <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>📊</div>
                <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 수업이 없습니다</div>
              </div>
            : sorted.map(cls => {
                const fee = feeMap[cls.id]
                const cnt = confirmedCount[cls.id] || 0
                const terms = getTerms(cls)
                const sessions = calcSessionDates(cls)
                const perSession = fee?(fee.feeType==='per_session'?Number(fee.amount):Math.round(Number(fee.amount)/sessions.length)):0
                const clsPays = payByClass[cls.id] || []
                const isExpanded = expandedClass === cls.id

                const termRows = terms.map(term => {
                  const tagged = clsPays.filter(p =>
                    p.termNo === term.termNo ||
                    (!p.termNo && p.date >= term.startDate && p.date <= term.endDate)
                  )
                  const expected = perSession * cnt * term.sessions.length
                  const paid = tagged.reduce((s,p)=>s+p.amount,0)
                  return { term, expected, paid, unpaid: expected-paid, payments: tagged }
                })

                const totalExpected = termRows.reduce((s,r)=>s+r.expected,0)
                const totalPaid     = termRows.reduce((s,r)=>s+r.paid,0)
                const totalUnpaid   = totalExpected - totalPaid
                const hasThisMonth  = terms.some(t=>t.sessions.some(d=>d.slice(0,7)===curYM))

                return (
                  <div key={cls.id} style={{ marginBottom:'12px', background:C.card, borderRadius:'14px', border:`1.5px solid ${hasThisMonth?'#fed7aa':C.border}`, overflow:'hidden' }}>
                    {/* 수업 헤더 */}
                    <div onClick={() => setExpandedClass(isExpanded?null:cls.id)}
                      style={{ padding:'14px 20px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px', background:hasThisMonth?'#fffbf5':'#fafafa', borderBottom:isExpanded?`1px solid ${C.border}`:'none' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>
                            🏫 {cls.organization} · {cls.className}{cls.section?' '+cls.section:''}
                          </span>
                          {hasThisMonth&&<span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>이번달 진행중</span>}
                          {!fee&&<span style={{ fontSize:'11px', background:'#fef2f2', color:C.danger, border:'1px solid #fca5a5', borderRadius:'5px', padding:'1px 7px' }}>수강료 미설정</span>}
                        </div>
                        <div style={{ fontSize:'12px', color:C.muted, marginTop:'4px' }}>
                          {cnt}명 · {terms.length}텀{cls.time?` · ${cls.time}`:''}
                          {fee&&<> · <span style={{ color:C.primary, fontWeight:600 }}>{fmt(fee.amount)}원/{fee.feeType==='per_session'?'회차':'텀'}</span></>}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                        {fee&&<>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:'11px', color:C.muted }}>전체 예상</div>
                            <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{fmt(totalExpected)}원</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:'11px', color:C.muted }}>입금</div>
                            <div style={{ fontSize:'14px', fontWeight:700, color:C.success }}>{fmt(totalPaid)}원</div>
                          </div>
                          {totalUnpaid>0&&<div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:'11px', color:C.muted }}>미수금</div>
                            <div style={{ fontSize:'14px', fontWeight:700, color:C.danger }}>{fmt(totalUnpaid)}원</div>
                          </div>}
                        </>}
                        <span style={{ fontSize:'20px', color:C.muted, transition:'transform .2s', display:'inline-block', transform:isExpanded?'rotate(90deg)':'none' }}>›</span>
                      </div>
                    </div>

                    {/* 텀 상세 */}
                    {isExpanded&&(
                      <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:'10px' }}>
                        <div style={{ display:'flex', justifyContent:'flex-end' }}>
                          <button onClick={()=>{ setFeeTarget({classId:cls.id,org:cls.organization,className:cls.className}); setFeeForm({feeType:fee?.feeType||'per_session',amount:String(fee?.amount||'')}); setFeeModal(true) }}
                            style={{ padding:'6px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#f9fafb', color:fee?C.primary:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            {fee?`⚙️ ${fmt(fee.amount)}원/${fee.feeType==='per_session'?'회차':'텀'}`:'⚙️ 수강료 설정'}
                          </button>
                        </div>

                        {termRows.map(({ term, expected, paid, unpaid, payments: tPays }) => {
                          const isCur = isTermCurrent(term)
                          const isThisMo = term.sessions.some(d=>d.slice(0,7)===curYM)
                          return (
                            <div key={term.termNo} style={{ borderRadius:'10px', border:`1.5px solid ${isCur?'#86efac':isThisMo?'#bfdbfe':C.border}`, overflow:'hidden' }}>
                              <div style={{ padding:'10px 14px', background:isCur?'#f0fdf4':isThisMo?'#eff6ff':'#f9fafb', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                  <span style={{ fontSize:'14px', fontWeight:700, color:isCur?C.success:isThisMo?C.blue:C.text }}>{term.label}</span>
                                  <span style={{ fontSize:'11px', color:C.muted }}>{term.startDate?.slice(5)} ~ {term.endDate?.slice(5)} · {term.sessions.length}회차</span>
                                  {isCur&&<span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'4px', padding:'1px 6px', fontWeight:700 }}>진행중</span>}
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                                  {fee&&<>
                                    <span style={{ fontSize:'12px', color:C.muted }}>예상 {fmt(expected)}원</span>
                                    <span style={{ fontSize:'12px', fontWeight:700, color:C.success }}>입금 {fmt(paid)}원</span>
                                    {unpaid>0&&<span style={{ fontSize:'12px', fontWeight:700, color:C.danger }}>미수 {fmt(unpaid)}원</span>}
                                  </>}
                                  <button onClick={()=>openPayModal(today(),cls.id,term.termNo)}
                                    style={{ padding:'4px 10px', borderRadius:'7px', border:'none', background:C.primary, color:'#fff', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                    + 입금
                                  </button>
                                </div>
                              </div>
                              {tPays.length>0
                                ? <div style={{ padding:'4px 14px 8px' }}>
                                    {[...tPays].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(p=>(
                                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'7px 0', borderBottom:`1px solid #f3f4f6` }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                            <span style={{ fontSize:'13px', color:C.text, fontWeight:600 }}>{p.date?.replace(/-/g,'.').slice(2)}</span>
                                            {p.memo&&<span style={{ fontSize:'12px', color:C.muted }}>{p.memo}</span>}
                                          </div>
                                          {p.reason&&<div style={{ fontSize:'11px', color:C.warning, marginTop:'3px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'5px', padding:'2px 8px', display:'inline-block' }}>📝 {p.reason}</div>}
                                        </div>
                                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                                          <span style={{ fontSize:'14px', fontWeight:700, color:C.success }}>+{fmt(p.amount)}원</span>
                                          <button onClick={()=>deletePayment(p.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:0 }}>×</button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                : <div style={{ padding:'8px 14px', fontSize:'12px', color:C.muted }}>입금 내역 없음</div>
                              }
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
          }
        </div>
      )}

      {/* ── 수강료 등록 탭 */}
      {tab === 'fees' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {sorted.length === 0
            ? <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>📚</div>
                <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 수업이 없습니다</div>
              </div>
            : sorted.map(cls => {
                const fee = feeMap[cls.id]
                const cnt = confirmedCount[cls.id] || 0
                const sessions = calcSessionDates(cls)
                const clsPays = (payByClass[cls.id]||[]).sort((a,b)=>(a.date||'').localeCompare(b.date||''))
                const paid = clsPays.reduce((s,p)=>s+p.amount,0)
                const terms = getTerms(cls)
                return (
                  <div key={cls.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                    <div style={{ padding:'14px 20px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px' }}>
                      <div>
                        <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>
                          🏫 {cls.organization} · {cls.className}{cls.section?' '+cls.section:''}
                          {cls.time&&<span style={{ fontSize:'12px', color:C.muted, fontWeight:400, marginLeft:'8px' }}>{cls.time}</span>}
                        </div>
                        <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px' }}>
                          확정 {cnt}명 · {sessions.length}회차 · {terms.length}텀
                          {fee&&<> · 기대수익 <strong style={{ color:C.primary }}>{fmt(fee.feeType==='per_term'?fee.amount*cnt:fee.amount*cnt*sessions.length)}원</strong></>}
                        </div>
                      </div>
                      <button onClick={()=>{ setFeeTarget({classId:cls.id,org:cls.organization,className:cls.className}); setFeeForm({feeType:fee?.feeType||'per_session',amount:String(fee?.amount||'')}); setFeeModal(true) }}
                        style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:fee?'#fff7ed':'#f9fafb', color:fee?C.primary:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        {fee?`⚙️ ${fmt(fee.amount)}원/${fee.feeType==='per_session'?'회차':'텀'}`:'⚙️ 수강료 설정'}
                      </button>
                    </div>
                    {clsPays.length>0&&(
                      <div style={{ padding:'4px 20px 8px' }}>
                        {clsPays.map(p=>(
                          <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 0', borderBottom:`1px solid #f3f4f6` }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'13px', color:C.text, fontWeight:600 }}>{p.date?.replace(/-/g,'.').slice(2)}</span>
                                {p.termNo&&<span style={{ fontSize:'11px', background:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px' }}>{p.termNo}텀</span>}
                                {p.memo&&<span style={{ fontSize:'12px', color:C.muted }}>{p.memo}</span>}
                              </div>
                              {p.reason&&<div style={{ fontSize:'11px', color:C.warning, marginTop:'2px' }}>📝 {p.reason}</div>}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                              <span style={{ fontSize:'14px', fontWeight:700, color:C.success }}>+{fmt(p.amount)}원</span>
                              <button onClick={()=>deletePayment(p.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:0 }}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
          }
        </div>
      )}

      {/* ── 수강료 설정 모달 */}
      {feeModal&&feeTarget&&(
        <div onClick={e=>{ if(e.target===e.currentTarget) setFeeModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'440px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>수강료 설정</span>
              <button onClick={()=>setFeeModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ padding:'11px 16px', background:'#f9fafb', borderRadius:'10px', fontSize:'14px', fontWeight:600, color:C.text }}>
                📚 {feeTarget.org} · {feeTarget.className}
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'8px' }}>수강료 방식</label>
                <div style={{ display:'flex', gap:'8px' }}>
                  {[['per_session','회차별 단가'],['per_term','텀 전체 금액']].map(([v,l])=>(
                    <button key={v} onClick={()=>setFeeForm(f=>({...f,feeType:v}))}
                      style={{ flex:1, padding:'10px', borderRadius:'9px', border:`2px solid ${feeForm.feeType===v?C.primary:C.border}`, background:feeForm.feeType===v?'#fff7ed':'#fff', color:feeForm.feeType===v?C.primary:C.muted, fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>
                  {feeForm.feeType==='per_session'?'회차당 수강료':'텀 전체 수강료'} (원)
                </label>
                <input type="number" value={feeForm.amount} onChange={e=>setFeeForm(f=>({...f,amount:e.target.value}))}
                  placeholder="예: 50000" style={{...iStyle,fontSize:'16px'}} />
                {feeForm.amount>0&&<div style={{ fontSize:'13px', color:C.success, marginTop:'6px', fontWeight:600 }}>= {fmt(feeForm.amount)}원/{feeForm.feeType==='per_session'?'회차':'텀'}</div>}
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveFeeForm} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={()=>setFeeModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 입금 등록 모달 */}
      {payModal&&(
        <div onClick={e=>{ if(e.target===e.currentTarget) setPayModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>💵 입금 등록</span>
              <button onClick={()=>setPayModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'13px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>입금일</label>
                <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={iStyle} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>수업 *</label>
                <select value={payForm.classId} onChange={e=>{
                  const cls=sorted.find(c=>c.id===e.target.value)
                  const terms=cls?getTerms(cls):[]
                  const cur=terms.find(isTermCurrent)||terms[0]
                  setPayForm(f=>({...f,classId:e.target.value,termNo:String(cur?.termNo||'')}))
                }} style={iStyle}>
                  <option value="">수업을 선택하세요</option>
                  {sorted.map(cls=>(
                    <option key={cls.id} value={cls.id}>
                      {cls.organization} · {cls.className}{cls.section?' '+cls.section:''}{cls.time?` (${cls.time})`:''}
                    </option>
                  ))}
                </select>
              </div>
              {/* 텀 선택 — 텀이 2개 이상일 때만 표시 */}
              {payForm.classId&&(()=>{
                const cls=sorted.find(c=>c.id===payForm.classId)
                const terms=cls?getTerms(cls):[]
                if(terms.length<=1) return null
                return (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>몇 텀 수강료?</label>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {terms.map(t=>{
                        const isCur=isTermCurrent(t)
                        const isSel=String(payForm.termNo)===String(t.termNo)
                        return (
                          <button key={t.termNo} onClick={()=>setPayForm(f=>({...f,termNo:String(t.termNo)}))}
                            style={{ padding:'6px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'12px', fontWeight:600, border:`1.5px solid ${isSel?C.primary:isCur?'#86efac':C.border}`, background:isSel?'#fff7ed':isCur?'#f0fdf4':'#f9fafb', color:isSel?C.primary:isCur?C.success:C.muted }}>
                            {t.label}{isCur?' 🟢':''}
                            <span style={{ fontSize:'10px', display:'block', fontWeight:400, color:C.muted }}>{t.startDate?.slice(5)}~{t.endDate?.slice(5)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>입금 금액 (원) *</label>
                <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}
                  placeholder="예: 750000" style={iStyle} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모 (선택)</label>
                <input value={payForm.memo} onChange={e=>setPayForm(f=>({...f,memo:e.target.value}))}
                  placeholder="예: 1분기 수강료 전액" style={iStyle} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.warning, display:'block', marginBottom:'5px' }}>📝 지연/변동 사유 (선택)</label>
                <input value={payForm.reason} onChange={e=>setPayForm(f=>({...f,reason:e.target.value}))}
                  placeholder="예: 학교 행정 지연, 분할 입금, 금액 조정 등"
                  style={{...iStyle, borderColor:payForm.reason?'#fde68a':C.border}} />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={savePayForm} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.success, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>입금 등록</button>
                <button onClick={()=>setPayModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
