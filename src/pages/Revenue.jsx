import React, { useState, useEffect, useMemo } from 'react'
import { uid, now, today, localDateStr, calcSessionDates } from '../lib/utils.js'
import { Classes, Students } from '../lib/db.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b', blue: '#3b82f6',
}

const FEE_KEY = 'asa_revenue_fees'
const PAY_KEY = 'asa_revenue_payments'

// ── 스토리지 헬퍼
function loadFees(tid)     { try { return JSON.parse(localStorage.getItem(FEE_KEY) || '[]').filter(r => r.teacherId === tid) } catch { return [] } }
function loadPayments(tid) { try { return JSON.parse(localStorage.getItem(PAY_KEY) || '[]').filter(r => r.teacherId === tid) } catch { return [] } }
function saveFeeDB(item)   { const a = JSON.parse(localStorage.getItem(FEE_KEY) || '[]'); const i = a.findIndex(r => r.id === item.id); if (i >= 0) a[i] = item; else a.push(item); localStorage.setItem(FEE_KEY, JSON.stringify(a)) }
function savePayDB(item)   { const a = JSON.parse(localStorage.getItem(PAY_KEY) || '[]'); const i = a.findIndex(r => r.id === item.id); if (i >= 0) a[i] = item; else a.push(item); localStorage.setItem(PAY_KEY, JSON.stringify(a)) }
function deletePayDB(id)   { localStorage.setItem(PAY_KEY, JSON.stringify(JSON.parse(localStorage.getItem(PAY_KEY) || '[]').filter(r => r.id !== id))) }

// ── 일별 수익 맵 생성
// feeType: 'per_session' = 회차별 단가, 'per_term' = 텀 전체 금액 → 회차 수로 나눔
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
    setFees(loadFees(user.id))
    setPayments(loadPayments(user.id))
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
    saveFeeDB({ id: feeMap[feeTarget.classId]?.id || uid(), teacherId: user.id, classId: feeTarget.classId, feeType: feeForm.feeType, amount: Number(feeForm.amount), updatedAt: now() })
    reload(); setFeeModal(false)
  }

  // 입금 저장
  const savePayForm = () => {
    if (!payForm.amount) { alert('금액을 입력하세요'); return }
    savePayDB({ id: uid(), teacherId: user.id, classId: payTarget, date: payForm.date, amount: Number(payForm.amount), termLabel: payForm.termLabel, memo: payForm.memo, createdAt: now() })
    reload(); setPayModal(false)
    setPayForm({ date: today(), amount: '', termLabel: '', memo: '' })
  }

  // 달력 네비
  const navDate = (dir) => {
    const d = new Date(curDate + 'T00:00:00')
    if (calView === 'day')   d.setDate(d.getDate() + dir)
    if (calView === 'week')  d.setDate(d.getDate() + dir * 7)
    if (calView === 'month') d.setMonth(d.getMonth() + dir)
    setCurDate(localDateStr(d))
  }
  const navLabel = () => {
    if (calView === 'month') return `${curYM.replace('-', '년 ')}월`
    if (calView === 'week')  { const w = getWeekDates(curDate); return `${w[0].slice(5).replace('-', '/')} ~ ${w[6].slice(5).replace('-', '/')}` }
    return curDate.replace(/-/g, '.')
  }

  // ── 월 달력
  const renderMonthView = () => {
    const [y, m] = curYM.split('-').map(Number)
    const firstDow = new Date(y, m - 1, 1).getDay()
    const totalDays = new Date(y, m, 0).getDate()
    const cells = [...Array(firstDow).fill(null), ...Array.from({ length: totalDays }, (_, i) => `${curYM}-${String(i + 1).padStart(2, '0')}`)]

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '4px' }}>
          {DAY_LABELS.map((l, i) => (
            <div key={l} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: i === 0 ? C.danger : i === 6 ? C.blue : C.muted, padding: '6px 0' }}>{l}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const rev = allDailyRevenue[d] || 0
            const isToday = d === today()
            const dow = new Date(d + 'T00:00:00').getDay()
            return (
              <div key={d} onClick={() => { setCurDate(d); setCalView('day') }}
                style={{ padding: '6px 4px', borderRadius: '8px', background: isToday ? '#fff7ed' : C.card, border: `1px solid ${isToday ? C.primary : C.border}`, cursor: 'pointer', minHeight: '52px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: isToday ? 700 : 400, color: dow === 0 ? C.danger : dow === 6 ? C.blue : C.text }}>{d.slice(8)}</div>
                {rev > 0 && <div style={{ fontSize: '10px', fontWeight: 700, color: C.success, marginTop: '2px', lineHeight: 1.3 }}>{fmt(rev)}</div>}
              </div>
            )
          })}
        </div>
        {/* 요일별 수익 */}
        <div style={{ marginTop: '16px', background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '14px 18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>이번 달 요일별 수익</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {DAY_LABELS.map((l, i) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: '10px', background: weekDayRevenue[i] > 0 ? '#fff7ed' : '#f9fafb', border: `1px solid ${weekDayRevenue[i] > 0 ? '#fed7aa' : C.border}` }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: i === 0 ? C.danger : i === 6 ? C.blue : C.muted }}>{l}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.success, marginTop: '4px' }}>{weekDayRevenue[i] > 0 ? fmt(weekDayRevenue[i]) : '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── 주 달력
  const renderWeekView = () => {
    const weekDates = getWeekDates(curDate)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
        {weekDates.map(d => {
          const rev = allDailyRevenue[d] || 0
          const isToday = d === today()
          const dow = new Date(d + 'T00:00:00').getDay()
          const dayCls = classes.filter(c => calcSessionDates(c).includes(d))
          return (
            <div key={d} onClick={() => { setCurDate(d); setCalView('day') }}
              style={{ padding: '10px 6px', borderRadius: '12px', background: isToday ? '#fff7ed' : C.card, border: `1.5px solid ${isToday ? C.primary : C.border}`, cursor: 'pointer', textAlign: 'center', minHeight: '90px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: dow === 0 ? C.danger : dow === 6 ? C.blue : C.muted }}>{DAY_LABELS[dow]}</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, margin: '3px 0' }}>{d.slice(8)}</div>
              {rev > 0
                ? <div style={{ fontSize: '12px', fontWeight: 700, color: C.success }}>{fmt(rev)}</div>
                : <div style={{ fontSize: '11px', color: '#d1d5db' }}>-</div>}
              {dayCls.map(c => (
                <div key={c.id} style={{ fontSize: '10px', color: C.muted, marginTop: '3px', background: '#f3f4f6', borderRadius: '4px', padding: '1px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.className}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // ── 일 보기
  const renderDayView = () => {
    const rev = allDailyRevenue[curDate] || 0
    const dayCls = classes.filter(c => calcSessionDates(c).includes(curDate))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ padding: '16px 20px', borderRadius: '14px', background: rev > 0 ? '#f0fdf4' : '#f9fafb', border: `1.5px solid ${rev > 0 ? '#86efac' : C.border}` }}>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>{curDate.replace(/-/g, '.')} 예상 수익</div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: rev > 0 ? C.success : C.muted }}>{fmt(rev)}원</div>
        </div>
        {dayCls.length === 0
          ? <div style={{ textAlign: 'center', padding: '30px', color: C.muted, fontSize: '14px', background: C.card, borderRadius: '12px', border: `1px solid ${C.border}` }}>수업 없는 날</div>
          : dayCls.map(cls => {
            const fee = feeMap[cls.id]; const cnt = confirmedCount[cls.id] || 0
            const dr = fee && cnt ? calcDailyRevenue(cls, fee, cnt) : {}
            const dayRev = dr[curDate] || 0
            return (
              <div key={cls.id} style={{ padding: '14px 18px', borderRadius: '12px', background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{cls.organization} · {cls.className}{cls.section ? ' ' + cls.section : ''}</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>확정 {cnt}명 {cls.time ? '· ' + cls.time : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: dayRev > 0 ? C.success : C.muted }}>{dayRev > 0 ? fmt(dayRev) + '원' : '수강료 미설정'}</div>
                    {fee && <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{fee.feeType === 'per_session' ? '회차별' : '텀별'} {fmt(fee.amount)}원</div>}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  const iStyle = { width: '100%', padding: '9px 12px', borderRadius: '9px', border: `1.5px solid ${C.border}`, fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, margin: 0 }}>💰 수익관리</h1>
          <p style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>수업별 수강료 및 입금 내역 관리</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[['calendar', '📅 수익 달력'], ['fees', '⚙️ 수강료 설정'], ['payments', '💳 입금 관리']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600, fontSize: '13px', background: tab === t ? C.primary : '#f3f4f6', color: tab === t ? '#fff' : C.muted }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: '이번 달 예상 수익', value: fmt(monthTotal) + '원', color: C.success, bg: '#f0fdf4', border: '#86efac' },
          { label: '수강료 설정 수업', value: fees.length + '개', color: C.primary, bg: '#fff7ed', border: '#fed7aa' },
          { label: '미입금 학교', value: unpaidList.length + '곳', color: unpaidList.length > 0 ? C.danger : C.muted, bg: unpaidList.length > 0 ? '#fef2f2' : '#f9fafb', border: unpaidList.length > 0 ? '#fca5a5' : C.border },
          { label: '미입금 합계', value: fmt(unpaidList.reduce((s, r) => s + r.unpaid, 0)) + '원', color: unpaidList.length > 0 ? C.danger : C.muted, bg: unpaidList.length > 0 ? '#fef2f2' : '#f9fafb', border: unpaidList.length > 0 ? '#fca5a5' : C.border },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 18px', borderRadius: '12px', background: s.bg, border: `1px solid ${s.border}`, flex: 1, minWidth: '130px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── 달력 탭 */}
      {tab === 'calendar' && (
        <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[['month', '월별'], ['week', '주별'], ['day', '일별']].map(([v, l]) => (
                <button key={v} onClick={() => setCalView(v)}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: `1.5px solid ${calView === v ? C.primary : C.border}`, background: calView === v ? '#fff7ed' : '#fff', color: calView === v ? C.primary : C.muted, fontWeight: calView === v ? 700 : 400, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => navDate(-1)} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '16px', cursor: 'pointer' }}>‹</button>
              <span style={{ fontSize: '15px', fontWeight: 700, color: C.text, minWidth: '150px', textAlign: 'center' }}>{navLabel()}</span>
              <button onClick={() => navDate(1)}  style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '16px', cursor: 'pointer' }}>›</button>
              <button onClick={() => setCurDate(today())} style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>오늘</button>
            </div>
          </div>

          {calView === 'month' && monthTotal > 0 && (
            <div style={{ padding: '10px 16px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: C.muted }}>{curYM.replace('-', '년 ')}월 총 예상 수익</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: C.primary }}>{fmt(monthTotal)}원</span>
            </div>
          )}

          {fees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: C.muted, background: '#f9fafb', borderRadius: '12px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚙️</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>수강료를 먼저 설정해주세요</div>
              <button onClick={() => setTab('fees')} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>수강료 설정하러 가기</button>
            </div>
          ) : (
            <>
              {calView === 'month' && renderMonthView()}
              {calView === 'week'  && renderWeekView()}
              {calView === 'day'   && renderDayView()}
            </>
          )}
        </div>
      )}

      {/* ── 수강료 설정 탭 */}
      {tab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>
            수업별 수강료를 설정하면 달력에서 예상 수익을 확인할 수 있습니다.
          </div>
          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📚</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>등록된 수업이 없습니다</div>
            </div>
          ) : classes.map(cls => {
            const fee = feeMap[cls.id]
            const cnt = confirmedCount[cls.id] || 0
            const sessions = calcSessionDates(cls)
            return (
              <div key={cls.id} style={{ padding: '16px 20px', background: fee ? '#fffbf5' : C.card, borderRadius: '12px', border: `1.5px solid ${fee ? '#fed7aa' : C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{cls.organization}</span>
                      <span style={{ fontSize: '13px', color: C.muted }}>· {cls.className}{cls.section ? ' ' + cls.section : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: C.muted, flexWrap: 'wrap' }}>
                      <span>👥 확정 {cnt}명</span>
                      <span>📅 총 {sessions.length}회차</span>
                      {cls.startDate && <span>{cls.startDate} ~ {cls.endDate}</span>}
                    </div>
                    {fee && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', background: '#fff7ed', color: C.primary, border: '1px solid #fed7aa', borderRadius: '6px', padding: '2px 10px', fontWeight: 700 }}>
                          {fee.feeType === 'per_session' ? '회차별' : '텀별'} {fmt(fee.amount)}원
                        </span>
                        {fee.feeType === 'per_term' && sessions.length > 0 && (
                          <span style={{ fontSize: '12px', color: C.muted, background: '#f3f4f6', borderRadius: '6px', padding: '2px 10px' }}>
                            회차당 ≈ {fmt(Math.round(fee.amount / sessions.length))}원
                          </span>
                        )}
                        {cnt > 0 && (
                          <span style={{ fontSize: '12px', color: C.success, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '2px 10px', fontWeight: 700 }}>
                            {fee.feeType === 'per_session' ? `회차 수익 ${fmt(fee.amount * cnt)}원` : `텀 총수익 ${fmt(fee.amount * cnt)}원`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setFeeTarget({ classId: cls.id, org: cls.organization, className: cls.className + (cls.section ? ' ' + cls.section : '') }); setFeeForm({ feeType: fee?.feeType || 'per_session', amount: fee?.amount || '' }); setFeeModal(true) }}
                    style={{ padding: '7px 16px', borderRadius: '9px', border: `1.5px solid ${fee ? C.primary : C.border}`, background: fee ? '#fff7ed' : '#f9fafb', color: fee ? C.primary : C.muted, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {fee ? '수정' : '+ 수강료 설정'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 입금 관리 탭 */}
      {tab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 미입금 알림 */}
          {unpaidList.length > 0 && (
            <div style={{ background: '#fef2f2', borderRadius: '12px', border: '1px solid #fca5a5', padding: '16px 20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.danger, marginBottom: '12px' }}>⚠️ 미입금 학교 {unpaidList.length}곳</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unpaidList.map(({ cls, unpaid, paid, expected }) => (
                  <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', borderRadius: '9px', border: '1px solid #fca5a5', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{cls.organization}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                        {cls.className}{cls.section ? ' ' + cls.section : ''} · 기대 {fmt(expected)}원 / 입금 {fmt(paid)}원
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: C.danger }}>미입금 {fmt(unpaid)}원</span>
                      <button
                        onClick={() => { setPayTarget(cls.id); setPayForm({ date: today(), amount: String(unpaid), termLabel: '', memo: '' }); setPayModal(true) }}
                        style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', background: C.success, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        입금 처리
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 수업별 입금 내역 */}
          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>💳</div>
              <div>등록된 수업이 없습니다</div>
            </div>
          ) : classes.map(cls => {
            const clsPays = [...(paymentMap[cls.id] || [])].sort((a, b) => b.date.localeCompare(a.date))
            const paid = clsPays.reduce((s, p) => s + p.amount, 0)
            const fee = feeMap[cls.id]; const cnt = confirmedCount[cls.id] || 0
            const sessions = calcSessionDates(cls)
            const expected = fee ? (fee.feeType === 'per_term' ? fee.amount * cnt : fee.amount * cnt * sessions.length) : 0
            return (
              <div key={cls.id} style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#f9fafb', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{cls.organization}</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                      {cls.className}{cls.section ? ' ' + cls.section : ''} · 확정 {cnt}명
                      {fee && <> · 기대수익 <strong style={{ color: C.primary }}>{fmt(expected)}원</strong></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                          <button onClick={() => { deletePayDB(p.id); reload() }} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0 }}>×</button>
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
