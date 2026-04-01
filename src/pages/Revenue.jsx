import React, { useState, useEffect, useMemo } from 'react'
import { uid, now, today, localDateStr, calcSessionDates } from '../lib/utils.js'
import { Classes, Students, RevenueFees, RevenuePayments } from '../lib/db.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b', blue: '#3b82f6',
}

// ── 유틸
function fmt(n) { return Number(n || 0).toLocaleString('ko-KR') }
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function getWeekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return localDateStr(dd) })
}
function getMonthDates(ym) {
  const [y, m] = ym.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}
function toYM(d) { return d.slice(0, 7) }

// ── 일별 수익 맵 생성
function calcDailyRevenue(cls, fee, studentCount) {
  if (!fee || !studentCount) return {}
  const sessions = calcSessionDates(cls)
  if (!sessions.length) return {}
  const perSession = fee.feeType === 'per_session'
    ? Number(fee.amount)
    : Math.round(Number(fee.amount) / sessions.length)
  const result = {}
  sessions.forEach(d => { result[d] = (result[d] || 0) + perSession * studentCount })
  return result
}

const iStyle = { width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box' }

export function Revenue({ user }) {
  const [tab, setTab]         = useState('calendar')
  const [calView, setCalView] = useState('month')
  const [curDate, setCurDate] = useState(today())
  const [fees, setFees]       = useState([])
  const [payments, setPayments] = useState([])
  const [classes, setClasses]   = useState([])
  const [students, setStudents] = useState([])

  const [feeModal, setFeeModal]   = useState(false)
  const [feeTarget, setFeeTarget] = useState(null)
  const [feeForm, setFeeForm]     = useState({ feeType: 'per_session', amount: '' })

  const [payModal, setPayModal]   = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [payForm, setPayForm]     = useState({ date: today(), amount: '', termLabel: '', memo: '' })

  const reload = () => {
    setFees(RevenueFees.byTeacher(user.id))
    setPayments(RevenuePayments.byTeacher(user.id))
    setClasses(Classes.byTeacher(user.id))
    setStudents(Students.byTeacher(user.id))
  }
  useEffect(() => { reload() }, [])

  // 수업별 확정 학생 수
  const confirmedCount = useMemo(() => {
    const m = {}
    classes.forEach(c => { m[c.id] = students.filter(s => s.classIds?.includes(c.id) && s.status === 'confirmed').length })
    return m
  }, [classes, students])

  // 수업별 fee 맵
  const feeMap = useMemo(() => { const m = {}; fees.forEach(f => { m[f.classId] = f }); return m }, [fees])

  // 전체 일별 수익 합산
  const allDailyRevenue = useMemo(() => {
    const result = {}
    classes.forEach(cls => {
      const fee = feeMap[cls.id]; const cnt = confirmedCount[cls.id] || 0
      if (!fee || !cnt) return
      Object.entries(calcDailyRevenue(cls, fee, cnt)).forEach(([d, v]) => { result[d] = (result[d] || 0) + v })
    })
    return result
  }, [classes, feeMap, confirmedCount])

  // 입금 맵
  const paymentMap = useMemo(() => {
    const m = {}
    payments.forEach(p => { if (!m[p.classId]) m[p.classId] = []; m[p.classId].push(p) })
    return m
  }, [payments])

  const curYM = toYM(curDate)
  const monthDates = getMonthDates(curYM)
  const monthTotal = monthDates.reduce((s, d) => s + (allDailyRevenue[d] || 0), 0)

  // 이번 달 요일별 수익
  const weekDayRevenue = useMemo(() => {
    const wdr = [0, 0, 0, 0, 0, 0, 0]
    monthDates.forEach(d => { wdr[new Date(d + 'T00:00:00').getDay()] += allDailyRevenue[d] || 0 })
    return wdr
  }, [allDailyRevenue, curYM])

  // 미입금 목록
  const unpaidList = useMemo(() => classes
    .filter(c => feeMap[c.id])
    .map(cls => {
      const fee = feeMap[cls.id]; const cnt = confirmedCount[cls.id] || 0
      const sessions = calcSessionDates(cls)
      const expected = fee.feeType === 'per_term' ? fee.amount * cnt : fee.amount * cnt * sessions.length
      const paid = (paymentMap[cls.id] || []).reduce((s, p) => s + p.amount, 0)
      return { cls, fee, cnt, expected, paid, unpaid: expected - paid }
    })
    .filter(r => r.unpaid > 0)
  , [classes, feeMap, confirmedCount, paymentMap])

  // 수강료 저장
  const saveFeeForm = () => {
    if (!feeForm.amount) { alert('금액을 입력하세요'); return }
    RevenueFees.upsert({
      teacherId: user.id,
      classId: feeTarget.classId,
      feeType: feeForm.feeType,
      amount: Number(feeForm.amount),
      updatedAt: now(),
    })
    reload(); setFeeModal(false)
  }

  // 입금 저장
  const savePayForm = () => {
    if (!payForm.amount) { alert('금액을 입력하세요'); return }
    RevenuePayments.insert({
      id: uid(),
      teacherId: user.id,
      classId: payTarget,
      date: payForm.date,
      amount: Number(payForm.amount),
      termLabel: payForm.termLabel,
      memo: payForm.memo,
      createdAt: now(),
    })
    reload(); setPayModal(false)
  }

  // 입금 삭제
  const deletePayment = (id) => {
    RevenuePayments.delete(id)
    reload()
  }

  // 달력 렌더
  const renderMonthCalendar = () => {
    const [y, m] = curYM.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const totalDays = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(`${curYM}-${String(d).padStart(2, '0')}`)

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
          {DAY_LABELS.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : C.muted, padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} />
            const rev = allDailyRevenue[date] || 0
            const isToday = date === today()
            const isSel = date === curDate
            const dow = new Date(date + 'T00:00:00').getDay()
            return (
              <div key={date} onClick={() => setCurDate(date)}
                style={{ borderRadius: '8px', padding: '6px 4px', cursor: 'pointer', background: isSel ? C.primary : isToday ? '#fff7ed' : '#fff', border: `1px solid ${isSel ? C.primary : isToday ? '#fed7aa' : C.border}`, minHeight: '52px', transition: 'all .1s' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: isSel ? '#fff' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : C.text, marginBottom: '2px' }}>
                  {Number(date.slice(-2))}
                </div>
                {rev > 0 && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: isSel ? '#fff' : C.success, lineHeight: 1.2 }}>
                    +{fmt(rev)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekCalendar = () => {
    const weekDates = getWeekDates(curDate)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
        {weekDates.map((date, i) => {
          const rev = allDailyRevenue[date] || 0
          const isToday = date === today()
          const isSel = date === curDate
          return (
            <div key={date} onClick={() => setCurDate(date)}
              style={{ borderRadius: '10px', padding: '10px 6px', cursor: 'pointer', background: isSel ? C.primary : isToday ? '#fff7ed' : '#fff', border: `1.5px solid ${isSel ? C.primary : isToday ? '#fed7aa' : C.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: isSel ? '#fff' : C.muted, marginBottom: '4px' }}>{DAY_LABELS[i === 6 ? 0 : i + 1]}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: isSel ? '#fff' : C.text }}>{Number(date.slice(-2))}</div>
              {rev > 0 && <div style={{ fontSize: '10px', color: isSel ? '#fff' : C.success, marginTop: '3px', fontWeight: 700 }}>+{fmt(rev)}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  // 선택 날짜의 수업 목록
  const dayClasses = classes.filter(cls => {
    const sessions = calcSessionDates(cls)
    return sessions.includes(curDate)
  })

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, margin: 0 }}>💰 수익관리</h1>
          <p style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>수업별 수강료 설정 및 입금 현황 관리</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[['calendar', '📅 달력'], ['list', '📋 수업별'], ['unpaid', '⚠️ 미입금']].map(([t, label]) => (
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
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[['month', '월'], ['week', '주']].map(([v, l]) => (
                  <button key={v} onClick={() => setCalView(v)}
                    style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '13px', fontWeight: 600, background: calView === v ? C.primary : '#f3f4f6', color: calView === v ? '#fff' : C.muted }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => {
                  const d = new Date(curDate + 'T00:00:00')
                  if (calView === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - 7)
                  setCurDate(localDateStr(d))
                }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}>‹</button>
                <span style={{ fontSize: '15px', fontWeight: 700, color: C.text, minWidth: '90px', textAlign: 'center' }}>
                  {calView === 'month' ? `${curYM.replace('-', '년 ')}월` : `${curDate.slice(5).replace('-', '/')} 주`}
                </span>
                <button onClick={() => {
                  const d = new Date(curDate + 'T00:00:00')
                  if (calView === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 7)
                  setCurDate(localDateStr(d))
                }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}>›</button>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.success }}>
                {calView === 'month' ? `${curYM.slice(5)}월 예상 ` : ''}{fmt(calView === 'month' ? monthTotal : getWeekDates(curDate).reduce((s, d) => s + (allDailyRevenue[d] || 0), 0))}원
              </div>
            </div>
            {calView === 'month' ? renderMonthCalendar() : renderWeekCalendar()}
          </div>

          {/* 선택 날짜 수업 */}
          <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>
              📅 {curDate.replace(/-/g, '.').slice(2)} 수업
            </div>
            {dayClasses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: C.muted, fontSize: '13px' }}>수업 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dayClasses.map(cls => {
                  const fee = feeMap[cls.id]
                  const cnt = confirmedCount[cls.id] || 0
                  const dayRev = fee && cnt ? (fee.feeType === 'per_session' ? fee.amount * cnt : Math.round(fee.amount / calcSessionDates(cls).length) * cnt) : 0
                  return (
                    <div key={cls.id} style={{ padding: '12px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#fafafa' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
                        🏫 {cls.organization} · {cls.className}{cls.section ? ' ' + cls.section : ''}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: C.muted }}>{cnt}명</span>
                        {dayRev > 0
                          ? <span style={{ fontSize: '13px', fontWeight: 700, color: C.success }}>+{fmt(dayRev)}원</span>
                          : <button onClick={() => { setFeeTarget({ classId: cls.id, org: cls.organization, className: cls.className }); setFeeForm({ feeType: 'per_session', amount: '' }); setFeeModal(true) }}
                              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#f9fafb', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>
                              수강료 설정
                            </button>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 요일별 통계 */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>{curYM.slice(5)}월 요일별 수익</div>
              {weekDayRevenue.map((v, i) => v > 0 && (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ width: '20px', fontSize: '12px', color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : C.muted, textAlign: 'center' }}>{DAY_LABELS[i]}</span>
                  <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(v / Math.max(...weekDayRevenue) * 100)}%`, background: C.primary, borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: C.text, fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>{fmt(v)}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 수업별 탭 */}
      {tab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📚</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>등록된 수업이 없습니다</div>
            </div>
          ) : classes.map(cls => {
            const fee = feeMap[cls.id]
            const cnt = confirmedCount[cls.id] || 0
            const sessions = calcSessionDates(cls)
            const expected = fee ? (fee.feeType === 'per_term' ? fee.amount * cnt : fee.amount * cnt * sessions.length) : 0
            const clsPays = paymentMap[cls.id] || []
            const paid = clsPays.reduce((s, p) => s + p.amount, 0)
            return (
              <div key={cls.id} style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
                      🏫 {cls.organization} · {cls.className}{cls.section ? ' ' + cls.section : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>
                      확정 {cnt}명 · 총 {sessions.length}차시
                      {fee && <> · 기대수익 <strong style={{ color: C.primary }}>{fmt(expected)}원</strong></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => { setFeeTarget({ classId: cls.id, org: cls.organization, className: cls.className }); setFeeForm({ feeType: fee?.feeType || 'per_session', amount: String(fee?.amount || '') }); setFeeModal(true) }}
                      style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${C.border}`, background: '#f9fafb', color: C.muted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      ⚙️ 수강료
                    </button>
                    {paid > 0 && <span style={{ fontSize: '14px', fontWeight: 700, color: C.success }}>입금 {fmt(paid)}원</span>}
                    <button
                      onClick={() => { setPayTarget(cls.id); setPayForm({ date: today(), amount: fee ? String(fee.amount * cnt) : '', termLabel: '', memo: '' }); setPayModal(true) }}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      + 입금 등록
                    </button>
                  </div>
                </div>
                {clsPays.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>입금 내역 없음</div>
                ) : (
                  <div style={{ padding: '4px 20px 8px' }}>
                    {clsPays.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid #f3f4f6` }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>{p.date.replace(/-/g, '.').slice(2)}</span>
                            {p.termLabel && <span style={{ fontSize: '11px', background: '#eff6ff', color: C.blue, border: '1px solid #bfdbfe', borderRadius: '5px', padding: '1px 7px' }}>{p.termLabel}</span>}
                          </div>
                          {p.memo && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{p.memo}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: C.success }}>+{fmt(p.amount)}원</span>
                          <button onClick={() => { deletePayment(p.id) }} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0 }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 미입금 탭 */}
      {tab === 'unpaid' && (
        <div>
          {unpaidList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>미입금 수업이 없습니다</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unpaidList.map(({ cls, fee, cnt, expected, paid, unpaid }) => (
                <div key={cls.id} style={{ background: C.card, borderRadius: '12px', border: '1.5px solid #fca5a5', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>🏫 {cls.organization} · {cls.className}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>
                        기대 {fmt(expected)}원 · 입금 {fmt(paid)}원
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: C.danger }}>미입금 {fmt(unpaid)}원</span>
                      <button
                        onClick={() => { setPayTarget(cls.id); setPayForm({ date: today(), amount: String(unpaid), termLabel: '', memo: '' }); setPayModal(true) }}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        입금 등록
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 수강료 설정 모달 */}
      {feeModal && feeTarget && (
        <div onClick={e => { if (e.target === e.currentTarget) setFeeModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>수강료 설정</span>
              <button onClick={() => setFeeModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '11px 16px', background: '#f9fafb', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: C.text }}>
                📚 {feeTarget.org} · {feeTarget.className}
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '8px' }}>수강료 방식</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['per_session', '회차별 단가'], ['per_term', '텀 전체 금액']].map(([v, l]) => (
                    <button key={v} onClick={() => setFeeForm(f => ({ ...f, feeType: v }))}
                      style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `2px solid ${feeForm.feeType === v ? C.primary : C.border}`, background: feeForm.feeType === v ? '#fff7ed' : '#fff', color: feeForm.feeType === v ? C.primary : C.muted, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {feeForm.feeType === 'per_term' && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#92400e', padding: '8px 12px', background: '#fff7ed', borderRadius: '8px' }}>
                    💡 텀 전체 금액을 입력하면 총 회차 수로 나눠서 일별 수익이 계산됩니다
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  {feeForm.feeType === 'per_session' ? '회차당 수강료' : '텀 전체 수강료'} (원)
                </label>
                <input type="number" value={feeForm.amount} onChange={e => setFeeForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="예: 50000"
                  style={{ ...iStyle, fontSize: '16px' }} />
                {feeForm.amount > 0 && (
                  <div style={{ fontSize: '13px', color: C.success, marginTop: '6px', fontWeight: 600 }}>
                    = {fmt(feeForm.amount)}원 / {feeForm.feeType === 'per_session' ? '회차' : '텀'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveFeeForm} style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setFeeModal(false)} style={{ padding: '11px 18px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 입금 등록 모달 */}
      {payModal && payTarget && (() => {
        const cls = classes.find(c => c.id === payTarget)
        return (
          <div onClick={e => { if (e.target === e.currentTarget) setPayModal(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>입금 등록</span>
                <button onClick={() => setPayModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
                {cls && (
                  <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: C.text }}>
                    🏫 {cls.organization} · {cls.className}{cls.section ? ' ' + cls.section : ''}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>입금일</label>
                  <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={iStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>입금 금액 (원)</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="예: 750000" style={iStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>텀/학기 구분 (선택)</label>
                  <input value={payForm.termLabel} onChange={e => setPayForm(f => ({ ...f, termLabel: e.target.value }))} placeholder="예: 2026년 1분기" style={iStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>메모 (선택)</label>
                  <input value={payForm.memo} onChange={e => setPayForm(f => ({ ...f, memo: e.target.value }))} placeholder="비고" style={iStyle} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={savePayForm} style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', background: C.success, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>입금 등록</button>
                  <button onClick={() => setPayModal(false)} style={{ padding: '11px 18px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
