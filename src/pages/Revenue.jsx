import React, { useState, useEffect, useMemo } from 'react'
import { uid, now, today, localDateStr, calcSessionDates, sortClasses } from '../lib/utils.js'
import { Classes, Students, RevenueFees, RevenuePayments, onDbChange } from '../lib/db.js'
import { Modal, useConfirm } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b', blue: '#3b82f6',
}

function fmt(n) { return Number(n || 0).toLocaleString('ko-KR') }
function fmtShort(n) {
  n = Number(n || 0)
  if (n >= 10000) return Math.round(n / 1000) + 'k'
  return n.toLocaleString('ko-KR')
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getMonthDates(ym) {
  const [y, m] = ym.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) =>
    `${ym}-${String(i + 1).padStart(2, '0')}`)
}
function toYM(d) { return d.slice(0, 7) }

// 입금이 특정 텀에 속하는지 판단 — classId + termNo 둘 다 일치해야 함
// 분기별 학생 포함 여부 (Attendance.jsx의 isInCurrentTerm과 동일 로직)
function isInTerm(s, term) {
  // student_careers는 학기/분기 단위(periodNo)로 기록됨 — termNo(전역 텀 순번)가 아님
  const careers = s.student_careers || []
  if (careers.length === 0) return true // 수강이력 없으면 해당 텀으로 간주
  const periodNo = term.periodNo ?? term.termNo
  return careers.some(c => String(c.term) === String(periodNo))
}

// ★ 전학/취소된 학생의 실제 퇴원(이탈) 날짜 — statusHistory/cancel_info에서 추출
function getDepartureDate(s) {
  if (s.status === 'transfer_out') {
    const h = (s.statusHistory || []).slice().reverse().find(h => h.status === 'transfer_out' && h.memo?.startsWith('[전학]'))
    const m = h?.memo?.match(/\d{4}-\d{2}-\d{2}/)
    return m?.[0] || null
  }
  if (s.status === 'cancelled' || s.status === 'cancel_after' || s.status === 'cancel_before') {
    const ci = typeof s.cancel_info === 'string'
      ? (() => { try { return JSON.parse(s.cancel_info) } catch { return null } })()
      : s.cancel_info
    return ci?.date || null
  }
  return null
}

// ★ 특정 텀의 출석부 기준 인원 — 그 학기/분기에 속하고, 이 텀 시작일 이후까지 재원했던 학생
//   (전학/취소 날짜가 이 텀 시작일 이후면 이 텀까지는 포함하고, 다음 텀부터 제외)
function termRosterCount(students, classId, sec, term) {
  if (!term) return 0
  return students.filter(s => {
    if (!s.classIds?.includes(classId)) return false
    if (sec && (s.section || '') !== sec) return false
    // 출석부와 동일: student_careers에 해당 분기가 있으면 포함
    // careers 없으면 1분기(periodNo===1)로 간주
    const periodNo = term.periodNo ?? term.termNo
    const careers = s.student_careers || []
    if (careers.length > 0) {
      const hasTerm = careers.some(c => String(c.term) === String(periodNo))
      if (!hasTerm) return false
    } else {
      if (periodNo !== 1) return false
    }
    if (s.status === 'confirmed') return true
    const dep = getDepartureDate(s)
    if (!dep) return false
    return dep > term.startDate
  }).length
}

// ★ 직전 텀 종료일 ~ 이번 텀 종료일 사이에 발생한 전학/취소 인원
function termDepartures(students, classId, sec, term, prevTerm) {
  const result = { cancel: 0, transfer: 0 }
  if (!term || !prevTerm) return result
  const from = prevTerm.endDate
  const to = term.endDate
  students.forEach(s => {
    if (!s.classIds?.includes(classId)) return
    if (sec && (s.section || '') !== sec) return
    if (!isInTerm(s, term)) return
    const d = getDepartureDate(s)
    if (!d || !(d > from && d <= to)) return
    if (s.status === 'transfer_out') result.transfer++
    else result.cancel++
  })
  return result
}

function payMatchesTerm(p, term, classId) {
  if (p.classId !== classId) return false
  return Number(p.termNo) === term.termNo
}

// cls.termSizes로 텀별 날짜 슬라이스
function getTerms(cls) {
  const sessions = calcSessionDates(cls)
  const periods = (cls.periods || []).filter(p => p.startDate && p.endDate)

  // periods 있으면 분기별 라벨 계산 (termNo는 전역 순번 유지)
  if (periods.length > 0) {
    const terms = []
    let termNo = 1
    periods.forEach((p, pIdx) => {
      const periodLabel = p.label || (cls.termType === 'semester' ? `${pIdx+1}학기` : `${pIdx+1}분기`)
      const pSessions = calcSessionDates({ ...cls, periods: [p] })
      const termSizes = (p.termSizes?.length > 0)
        ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
        : null
      if (!termSizes) {
        if (pSessions.length > 0) terms.push({ termNo: termNo++, label: `${periodLabel} 1텀`, sessions: pSessions, startDate: pSessions[0], endDate: pSessions[pSessions.length-1], periodNo: pIdx+1, termType: cls.termType })
      } else {
        let idx = 0
        termSizes.forEach((size, i) => {
          const slice = pSessions.slice(idx, idx + size)
          if (slice.length > 0) terms.push({ termNo: termNo++, label: `${periodLabel} ${i+1}텀`, sessions: slice, startDate: slice[0], endDate: slice[slice.length-1], periodNo: pIdx+1, termType: cls.termType })
          idx += size
        })
        if (idx < pSessions.length && terms.length > 0) {
          const extra = pSessions.slice(idx)
          terms[terms.length-1].sessions.push(...extra)
          terms[terms.length-1].endDate = extra[extra.length-1]
        }
      }
    })
    return terms
  }

  // periods 없으면 기존 방식
  const termSizes = (cls.termSizes?.length > 0)
    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
    : null
  if (!termSizes) return [{ termNo: 1, label: '전체', sessions, startDate: sessions[0] || '', endDate: sessions[sessions.length - 1] || '', periodNo: 1, termType: cls.termType }]
  const terms = []
  let idx = 0
  const startMonth = cls.startDate ? parseInt(cls.startDate.slice(5, 7)) : 3
  const semesterNum = (startMonth >= 3 && startMonth <= 8) ? 1 : 2
  termSizes.forEach((size, i) => {
    const slice = sessions.slice(idx, idx + size)
    if (slice.length > 0) terms.push({ termNo: i + 1, label: cls?.termType==='semester'?`${semesterNum}학기 ${i+1}텀`:`${semesterNum}분기 ${i+1}텀`, sessions: slice, startDate: slice[0], endDate: slice[slice.length - 1], periodNo: semesterNum, termType: cls.termType })
    idx += size
  })
  if (idx < sessions.length && terms.length > 0) {
    const extra = sessions.slice(idx)
    terms[terms.length - 1].sessions.push(...extra)
    terms[terms.length - 1].endDate = extra[extra.length - 1]
  }
  return terms
}

function isTermCurrent(term) { const t = today(); return term.startDate <= t && t <= term.endDate }

// ★ 핵심: 텀별 1회차당 금액 계산
// per_session → fee.amount 그대로
// per_term    → fee.amount / 해당 텀 회차 수  (전체 회차로 나누는 것이 아님!)
function perSessionFee(fee, term, cls) {
  if (!fee) return 0
  if (fee.feeType === 'per_session') return Number(fee.amount)
  // per_term: 1텀(baseCount) 기준으로 비례 계산 → 회차당 금액
  const baseCount = Number(cls?.termSizes?.[0]) || term.sessions.length || 1
  return baseCount > 0 ? Math.round(Number(fee.amount) / baseCount) : 0
}

const iStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid #e5e7eb', fontSize: '14px',
  fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box',
}

export function Revenue({ user }) {
  const [tab, setTab]           = useState('calendar')
  const [curDate, setCurDate]   = useState(today())
  const [fees, setFees]         = useState([])
  const [payments, setPayments] = useState([])
  const [classes, setClasses]   = useState([])
  const [students, setStudents] = useState([])
  const [unpaidDetail, setUnpaidDetail] = useState(null) // 미수금 상세 팝업
  const [payDetailModal, setPayDetailModal] = useState(null) // 입금내역 상세 팝업 { date, pays }

  const [feeModal, setFeeModal]   = useState(false)
  const [feeTarget, setFeeTarget] = useState(null)
  const [feeForm, setFeeForm]     = useState({ feeType: 'per_session', amount: '' })

  const [payWizard, setPayWizard] = useState(false)
  const [payStep, setPayStep]     = useState(1) // 1=날짜, 2=학교, 3=텀, 4=금액, 5=메모
  const [payDate, setPayDate]     = useState(today())
  const [payForm, setPayForm]     = useState({ classId: '', classIds: [], termNo: '', amount: '', memo: '' })
  const [isSaving, setIsSaving]   = useState(false)
  const savingRef = React.useRef(false)

  const [expandedClass, setExpandedClass] = useState(null)
  const [expandedTerms, setExpandedTerms] = useState({})   // 텀 크로스체크 텀별 접기/펼치기
  const [expandedFees, setExpandedFees] = useState({})     // 수강료 등록 카드 접기/펼치기
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()

  const reload = () => {
    setFees(RevenueFees.byTeacher(user.id) || [])
    setPayments(RevenuePayments.byTeacher(user.id) || [])
    setClasses(Classes.byTeacher(user.id) || [])
    setStudents(Students.byTeacher(user.id) || [])
  }
  useEffect(() => { reload() }, [])
  // ★ 다른 페이지(수업등록/학생관리 등)에서 데이터가 바뀌면 실시간으로 반영
  useEffect(() => {
    const unsubs = [
      onDbChange('classes', reload),
      onDbChange('students', reload),
      onDbChange('revenueFees', reload),
      onDbChange('revenuePayments', reload),
    ]
    return () => unsubs.forEach(u => u())
  }, [])



  const sorted = useMemo(() => {
    const DAY_ORDER = ['월','화','수','목','금','토','일']
    // 출석부와 동일하게: 학교+수업명+요일이 같은 중복 카드는 통합카드(sections 많은 쪽)를 우선 사용
    const deduped = []
    const seenKey = {}
    classes.forEach(cls => {
      const normName = (cls.className||'').replace(/\s*[A-Za-z가-힣]반\s*$/, '').trim()
      const key = (cls.organization||'') + '__' + normName + '__' + (cls.days?.join(',') || '')
      if (seenKey[key] !== undefined) {
        const prevIdx = seenKey[key]
        const prev = deduped[prevIdx]
        const prevSecs = prev.sections?.filter(s => s.section)?.length || 0
        const curSecs  = cls.sections?.filter(s => s.section)?.length || 0
        if (curSecs > prevSecs) deduped[prevIdx] = cls
      } else {
        seenKey[key] = deduped.length
        deduped.push(cls)
      }
    })
    // 통합카드(sections 2개 이상)는 반별로 분리
    const expanded = deduped.flatMap(cls => {
      const secs = cls.sections?.filter(s => s.section) || []
      if (secs.length > 1) {
        return secs.map(sec => ({
          ...cls,
          _selSection: sec.section,
          _secTime: sec.time,
          _secTimeEnd: sec.timeEnd,
        }))
      }
      return [{ ...cls, _selSection: cls.section || '', _secTime: cls.time, _secTimeEnd: cls.timeEnd }]
    })
    return expanded.sort((a, b) => {
      const aDay = DAY_ORDER.indexOf(a.days?.[0] ?? '')
      const bDay = DAY_ORDER.indexOf(b.days?.[0] ?? '')
      const dayCmp = (aDay===-1?99:aDay) - (bDay===-1?99:bDay)
      if (dayCmp !== 0) return dayCmp
      const timeCmp = (a._secTime||a.time||'').localeCompare(b._secTime||b.time||'')
      if (timeCmp !== 0) return timeCmp
      const schoolCmp = (a.organization||'').localeCompare(b.organization||'', 'ko')
      if (schoolCmp !== 0) return schoolCmp
      return (a._selSection||'').localeCompare(b._selSection||'')
    })
  }, [classes])

  const confirmedCount = useMemo(() => {
    const m = {}
    sorted.forEach(cls => {
      const key = cls.id + (cls._selSection ? '::' + cls._selSection : '')
      const sec = cls._selSection
      m[key] = students.filter(s => {
        if (!s.classIds?.includes(cls.id)) return false
        if (s.status !== 'confirmed') return false
        if (sec) return (s.section || '') === sec
        return true
      }).length
    })
    return m
  }, [sorted, students])

  // 입금등록 위저드용: cls.id 기준으로 A반/B반을 한 카드로 합친 목록
  const groupedForPay = useMemo(() => {
    const groups = []
    const seen = {}
    sorted.forEach(cls => {
      if (seen[cls.id] !== undefined) {
        groups[seen[cls.id]]._secEntries.push(cls)
      } else {
        seen[cls.id] = groups.length
        groups.push({ ...cls, _secEntries: [cls] })
      }
    })
    return groups.map(g => {
      const combinedCount = g._secEntries.reduce((s, c) => {
        const key = c.id + (c._selSection ? '::' + c._selSection : '')
        return s + (confirmedCount[key] || 0)
      }, 0)
      const secLabels = g._secEntries
        .filter(c => c._selSection)
        .map(c => `${c._selSection}반 ${confirmedCount[c.id + '::' + c._selSection] || 0}명`)
      const secLines = g._secEntries
        .filter(c => c._selSection)
        .map(c => {
          const cnt = confirmedCount[c.id + '::' + c._selSection] || 0
          const time = c._secTime ? `${c._secTime}${c._secTimeEnd ? ' ~ ' + c._secTimeEnd : ''}` : ''
          return `${c._selSection}반 ${cnt}명${time ? ' ' + time : ''}`
        })
      return { ...g, combinedCount, secLabels, secLines }
    })
  }, [sorted, confirmedCount])

  // 취소 인원 (cancelled)
  const cancelledCount = useMemo(() => {
    const m = {}
    sorted.forEach(cls => {
      const key = cls.id + (cls._selSection ? '::' + cls._selSection : '')
      const sec = cls._selSection
      m[key] = students.filter(s => {
        if (!s.classIds?.includes(cls.id)) return false
        if (s.status !== 'cancelled') return false
        if (sec) return (s.section || '') === sec
        return true
      }).length
    })
    return m
  }, [sorted, students])

  // 신청 인원 (applied + selected + confirmed + cancelled = 처음 신청한 전체)
  const appliedCount = useMemo(() => {
    const m = {}
    sorted.forEach(cls => {
      const key = cls.id + (cls._selSection ? '::' + cls._selSection : '')
      const sec = cls._selSection
      m[key] = students.filter(s => {
        if (!s.classIds?.includes(cls.id)) return false
        if (sec) return (s.section || '') === sec
        return true
      }).length
    })
    return m
  }, [sorted, students])

  const feeMap = useMemo(() => {
    const m = {}; fees.forEach(f => { m[f.classId] = f }); return m
  }, [fees])

  const payByDate = useMemo(() => {
    const m = {}
    payments.forEach(p => { if (!m[p.date]) m[p.date] = []; m[p.date].push(p) })
    return m
  }, [payments])

  const payByClass = useMemo(() => {
    const m = {}
    payments.forEach(p => { if (!m[p.classId]) m[p.classId] = []; m[p.classId].push(p) })
    return m
  }, [payments])

  // ★ 날짜별 예상수익 — per_term은 텀별 회차로 나눔
  const allDailyRevenue = useMemo(() => {
    const result = {}
    sorted.forEach(cls => {
      const fee = feeMap[cls.id]
      const cnt = confirmedCount[cls.id+(cls._selSection?'::'+cls._selSection:'')] || 0
      if (!fee || !cnt) return
      const terms = getTerms(cls)
      const addedDates = new Set()
      terms.forEach(term => {
        const ps = perSessionFee(fee, term, cls)
        term.sessions.forEach(d => {
          if (addedDates.has(d)) return  // 중복 날짜 방지
          addedDates.add(d)
          result[d] = (result[d] || 0) + ps * cnt
        })
      })
    })
    return result
  }, [sorted, feeMap, confirmedCount])

  const curYM = toYM(curDate)
  const monthDates = getMonthDates(curYM)

  // 이번달 예상수익 (이번달 날짜에 있는 수업 합계)
  const monthTotal = monthDates.reduce((s, d) => s + (allDailyRevenue[d] || 0), 0)

  // 요일별 예상수익 (월~일, 이번달 기준) — 달력 하단에 표시
  const weekDayRevenue = useMemo(() => {
    const wdr = Array(7).fill(0)
    monthDates.forEach(d => {
      const dow = new Date(d + 'T00:00:00').getDay()
      const idx = dow === 0 ? 6 : dow - 1
      wdr[idx] += allDailyRevenue[d] || 0
    })
    return wdr
  }, [allDailyRevenue, curYM])

  // 날짜별 수업 정보 (태그용)
  const dailyClasses = useMemo(() => {
    const map = {}
    sorted.forEach(cls => {
      const fee = feeMap[cls.id]
      const clsPays = payByClass[cls.id] || []
      const terms = getTerms(cls)
      const sec = cls._selSection
      const clsStudents = students.filter(s => {
        if (!s.classIds?.includes(cls.id)) return false
        if (s.status !== 'confirmed') return false
        if (sec) return (s.section || '') === sec
        return true
      })

      terms.forEach(term => {
        const cnt = clsStudents.filter(s => isInTerm(s, term)).length
        const ps = perSessionFee(fee, term, cls)
        const termExpected = ps * cnt * term.sessions.length
        const tagged = clsPays.filter(p =>
          payMatchesTerm(p, term, cls.id)
        )
        const termPaid = tagged.reduce((s, p) => s + p.amount, 0)
        const termUnpaid = fee && cnt ? termPaid < termExpected : false

        term.sessions.forEach((date, i) => {
          if (!map[date]) map[date] = []
          // 같은 날짜에 같은 수업 중복 방지 (getTerms의 extra 중복 버그 대응)
          if (map[date].some(x => x.cls.id === cls.id && (x.cls._selSection||'') === (cls._selSection||''))) return
          map[date].push({
            cls, fee,
            termLabel: term.label,
            termNo: term.termNo,
            termSessionNo: i + 1,
            sessionRev: ps * cnt,   // 이 날 이 수업 예상수익
            unpaid: termUnpaid,
            noFee: !fee,
          })
        })
      })
    })
    return map
  }, [sorted, feeMap, confirmedCount, payByClass])

  // ★ 전체 미수금 목록 (과거 텀 포함) — 달력에서 상시 표시
  const allUnpaidList = useMemo(() => {
    // classId + termNo 단위로 먼저 집계 (A/B반 합산) — paid는 classId+term당 1번만 계산
    const groups = {}
    const order = []
    sorted.forEach(cls => {
      const fee = feeMap[cls.id]
      const allCnt = confirmedCount[cls.id+(cls._selSection?'::'+cls._selSection:'')] || 0
      if (!fee || !allCnt) return
      const terms = getTerms(cls)
      const clsPays = payByClass[cls.id] || []
      const sec = cls._selSection
      const clsStudents = students.filter(s => {
        if (!s.classIds?.includes(cls.id)) return false
        if (s.status !== 'confirmed') return false
        if (sec) return (s.section || '') === sec
        return true
      })
      terms.forEach(term => {
        // 해당 텀에 속하는 학생만 카운트
        const cnt = clsStudents.filter(s => isInTerm(s, term)).length
        if (!cnt) return
        const ps = perSessionFee(fee, term, cls)
        const expected = ps * cnt * term.sessions.length
        const key = cls.id + '_' + term.termNo
        if (!groups[key]) {
          const tagged = clsPays.filter(p => payMatchesTerm(p, term, cls.id))
          const paid = tagged.reduce((s, p) => s + p.amount, 0)
          groups[key] = {
            cls, term, fee, paid,
            cnt: 0, expected: 0, confirmed: 0, startApplied: 0, cancelled: 0,
            _sections: [], _sectionCnts: [],
          }
          order.push(key)
        }
        const g = groups[key]
        g.cnt += cnt
        g.expected += expected
        g.confirmed += cnt
        g.startApplied += appliedCount[cls.id+(sec?'::'+sec:'')] || cnt
        g.cancelled += cancelledCount[cls.id+(sec?'::'+sec:'')] || 0
        g._sections.push(sec)
        g._sectionCnts.push(cnt)
      })
    })

    const td = today()
    const list = []
    order.forEach(key => {
      const g = groups[key]
      const { term, cls } = g
      const unpaid = g.expected - g.paid
      const termEnded = term.endDate && term.endDate < td
      const termCurrent = term.startDate <= td && term.endDate >= td
      const termUpcoming = term.startDate > td
      // 이 수업에서 끝난 마지막 텀 번호 → 끝난 텀 바로 다음 텀
      const allTerms = getTerms(cls)
      const lastEndedTermNo = allTerms.filter(t => t.endDate && t.endDate < td).reduce((max, t) => Math.max(max, t.termNo), 0)
      const isNextTerm = term.termNo === lastEndedTermNo + 1
      if (unpaid > 0 && (termEnded || termCurrent || isNextTerm)) {
        const status = termEnded ? 'unpaid' : termUpcoming ? 'upcoming' : 'current'
        list.push({ ...g, unpaid, termStatus: status })
      }
    })

    // sorted 순서(학교→요일→시간→반) 유지, 같은 수업 내에서 텀 오름차순
    list.sort((a, b) => {
      const ai = sorted.findIndex(c => c.id === a.cls.id)
      const bi = sorted.findIndex(c => c.id === b.cls.id)
      if (ai !== bi) return ai - bi
      return (a.term.startDate||'').localeCompare(b.term.startDate||'')
    })
    return list
  }, [sorted, feeMap, confirmedCount, cancelledCount, appliedCount, payByClass])

  // 이번달 요약
  const monthSummary = useMemo(() => {
    let expected = 0, paid = 0
    sorted.forEach(cls => {
      const fee = feeMap[cls.id]
      if (!fee) return
      const terms = getTerms(cls)
      const clsPays = payByClass[cls.id] || []
      const sec = cls._selSection
      const clsStudents = students.filter(s => {
        if (!s.classIds?.includes(cls.id)) return false
        if (s.status !== 'confirmed') return false
        if (sec) return (s.section || '') === sec
        return true
      })
      terms.forEach(term => {
        const cnt = clsStudents.filter(s => isInTerm(s, term)).length
        if (!cnt) return
        if (!term.sessions.some(d => d.slice(0, 7) === curYM)) return
        const ps = perSessionFee(fee, term, cls)
        expected += ps * cnt * term.sessions.length
        const tagged = clsPays.filter(p =>
          payMatchesTerm(p, term, cls.id)
        )
        paid += tagged.reduce((s, p) => s + p.amount, 0)
      })
    })
    return { expected, paid, unpaid: expected - paid }
  }, [sorted, feeMap, confirmedCount, payByClass, curYM])

  const saveFeeForm = async () => {
    if (!feeForm.amount) { toastError('금액을 입력하세요'); return }
    try {
      await RevenueFees.upsert({
        teacherId: user.id, classId: feeTarget.classId,
        feeType: feeForm.feeType, amount: Number(feeForm.amount), updatedAt: now(),
      })
      reload(); setFeeModal(false); success('수정이 완료되었습니다.')
    } catch {
      toastError('저장 중 오류가 발생했습니다.')
    }
  }

  const savePayForm = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    const ids = payForm.classIds && payForm.classIds.length > 0 ? payForm.classIds : (payForm.classId ? [payForm.classId] : [])
    if (ids.length === 0) { toastError('수업을 선택하세요'); setIsSaving(false); return }
    const hasAmt = ids.some(cid => Number(payForm[`amount_${cid}`]||payForm.amount) > 0)
    if (!hasAmt) { toastError('금액을 입력하세요'); setIsSaving(false); return }
    const selectedTermNo = payForm.termNo ? Number(payForm.termNo) : null
    try {
      for (const cid of ids) {
        const amt = Number(payForm[`amount_${cid}`] || payForm.amount || 0)
        if (!amt) continue
        let termNo = selectedTermNo
        if (!termNo) {
          const cls = sorted.find(c => c.id === cid)
          const terms = cls ? getTerms(cls) : []
          const curTerm = terms.find(isTermCurrent) || terms[0]
          termNo = curTerm ? Number(curTerm.termNo) : null
        }
        await RevenuePayments.insert({
          id: uid(), teacherId: user.id,
          classId: cid,
          termNo,
          date: payDate,
          amount: amt,
          memo: payForm.memo,
          createdAt: now(),
        })
      }
      reload(); setPayWizard(false); success(`${ids.length}건 등록이 완료되었습니다.`)
    } catch {
      toastError('저장 중 오류가 발생했습니다.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const openPayModal = (date, classId = '', termNo = '', startFromDate = false) => {
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
    setPayForm({ classId: classId || '', classIds: classId ? [classId] : [], termNo: String(autoTermNo), amount: '', memo: '' })
    // 진입 시작 스텝 결정
    if (startFromDate) setPayStep(1)
    else if (classId && autoTermNo) setPayStep(4)
    else if (classId) setPayStep(3)
    else setPayStep(2)
    setPayWizard(true)
  }

  const deletePayment = async (id) => { try { await RevenuePayments.delete(id); reload(); success('삭제가 완료되었습니다.') } catch { toastError('삭제 중 오류가 발생했습니다.') } }

  // 월 달력 렌더
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '2px' }}>
          {DAY_LABELS.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '4px 0', color: i === 5 ? C.blue : i === 6 ? C.danger : C.muted }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} style={{ minHeight: '108px' }} />
            const dayItems = dailyClasses[date] || []
            const pays     = payByDate[date] || []
            const isToday  = date === today()
            const isSel    = date === curDate
            const dow      = new Date(date + 'T00:00:00').getDay()
            const dayRev   = allDailyRevenue[date] || 0
            const paidAmt  = pays.reduce((s, p) => s + p.amount, 0)
            return (
              <div key={date} onClick={() => { setCurDate(date); openPayModal(date) }}
                title="날짜 선택"
                style={{ borderRadius: '8px', padding: '5px 4px', cursor: 'pointer', minHeight: '108px', transition: 'all .1s', background: isSel ? C.primary : isToday ? '#fff7ed' : '#fff', border: `1px solid ${isSel ? C.primary : isToday ? '#fed7aa' : C.border}` }}>
                {/* 날짜 숫자 */}
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '1px', color: isSel ? '#fff' : dow === 6 ? C.blue : dow === 0 ? C.danger : C.text }}>
                  {Number(date.slice(-2))}
                </div>
                {/* 예상수익 */}
                {dayRev > 0 && (
                  <div style={{ fontSize: '9px', fontWeight: 700, color: isSel ? '#ffffffcc' : C.success, marginBottom: '2px' }}>
                    {fmt(dayRev)}
                  </div>
                )}
                {/* 수업 태그 */}
                {(() => {
                  // cls.id 기준으로 A반/B반 합쳐서 하나의 태그로
                  const dayGrouped = []
                  const daySeen = {}
                  dayItems.forEach(item => {
                    if (daySeen[item.cls.id] !== undefined) {
                      dayGrouped[daySeen[item.cls.id]]._secs.push(item.cls._selSection)
                      if (item.unpaid) dayGrouped[daySeen[item.cls.id]].unpaid = true
                    } else {
                      daySeen[item.cls.id] = dayGrouped.length
                      dayGrouped.push({ ...item, _secs: [item.cls._selSection] })
                    }
                  })
                  return dayGrouped.map((item, idx) => {
                    const org  = item.cls.organization?.slice(0, 3) || ''
                    const name = item.cls.className?.slice(0, 4) || ''
                    const label = `${org}/${name}`
                    const secs = [...new Set(item._secs.filter(Boolean))]
                    let countLabel = ''
                    if (secs.length > 1) {
                      const cnts = secs.map(sec => confirmedCount[item.cls.id + '::' + sec] || 0)
                      const total = cnts.reduce((s, c) => s + c, 0)
                      countLabel = secs.map((sec, i) => `${sec}반 ${cnts[i]}명`).join(' / ') + ` / 합계 ${total}명`
                    } else if (secs.length === 1) {
                      const cnt = confirmedCount[item.cls.id + '::' + secs[0]] || 0
                      countLabel = `${secs[0]}반 ${cnt}명`
                    } else {
                      const cnt = confirmedCount[item.cls.id] || 0
                      countLabel = `합계 ${cnt}명`
                    }
                    const bgColor = item.noFee
                      ? (isSel ? 'rgba(255,255,255,0.15)' : '#f3f4f6')
                      : item.unpaid
                        ? (isSel ? 'rgba(239,68,68,0.3)' : '#fef2f2')
                        : (isSel ? 'rgba(255,255,255,0.2)' : '#f0fdf4')
                    const txtColor = item.noFee
                      ? (isSel ? '#ffffffaa' : C.muted)
                      : item.unpaid
                        ? (isSel ? '#fca5a5' : C.danger)
                        : (isSel ? '#fff' : C.success)
                    return (
                      <div key={idx} style={{ marginBottom: '1px' }}>
                        {idx === 0 && (
                          <div style={{ fontSize: '9px', fontWeight: 700, color: isSel ? '#ffffffcc' : C.blue, lineHeight: 1.3 }}>
                            {item.termLabel}{item.termSessionNo}회
                          </div>
                        )}
                        <div title={`${item.cls.organization || ''}/${item.cls.className || ''}`} style={{ fontSize: '9px', fontWeight: 600, padding: '1px 3px 0', borderRadius: '3px 3px 0 0', background: bgColor, color: txtColor, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </div>
                        <div title={countLabel} style={{ fontSize: '8px', fontWeight: 500, padding: '0 3px 1px', borderRadius: '0 0 3px 3px', background: bgColor, color: txtColor, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {countLabel}
                        </div>
                      </div>
                    )
                  })
                })()}
                {/* 입금 표시 — 클릭하면 상세 모달 */}
                {paidAmt > 0 && (
                  <div
                    onClick={e => { e.stopPropagation(); setPayDetailModal({ date, pays }) }}
                    style={{ fontSize: '9px', fontWeight: 700, color: isSel ? '#ffffffcc' : C.blue, marginTop: '1px', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                    title="입금 내역 보기"
                  >
                    입{fmt(paidAmt)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* 요일별 예상수익 합계 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginTop: '4px', borderTop: `1px solid ${C.border}`, paddingTop: '4px' }}>
          {weekDayRevenue.map((rev, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '10px', fontWeight: rev > 0 ? 700 : 400, color: rev > 0 ? C.primary : '#d1d5db', padding: '2px 0' }}>
              {rev > 0 ? fmt(rev) : '–'}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '6px', fontSize: '11px', color: C.muted }}>
          날짜 클릭 → 입금 등록 &nbsp;·&nbsp;
          <span style={{ color: C.success }}>■</span> 입금완료 &nbsp;
          <span style={{ color: C.danger }}>■</span> 미수금 &nbsp;
          <span style={{ color: C.muted }}>■</span> 수강료 미설정
        </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 달력 — 전체폭 */}
          <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => { const d=new Date(curDate+'T00:00:00'); d.setMonth(d.getMonth()-1); setCurDate(localDateStr(d)) }}
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'14px' }}>‹</button>
                <span style={{ fontSize:'15px', fontWeight:700, color:C.text, minWidth:'90px', textAlign:'center' }}>
                  {`${curYM.replace('-','년 ')}월`}
                </span>
                <button onClick={() => { const d=new Date(curDate+'T00:00:00'); d.setMonth(d.getMonth()+1); setCurDate(localDateStr(d)) }}
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontSize:'14px' }}>›</button>
              </div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.success }}>{curYM.slice(5)}월 예상 {fmt(monthTotal)}원</div>
            </div>
            {renderMonthCalendar()}
          </div>

          {/* 하단 4개 패널 — 가로 배치 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'16px', alignItems:'start' }}>
            {/* ★ 미수금 알림 패널 — 과거 텀 포함 전체 미수금 */}
            {(() => {
              const unpaidItems   = allUnpaidList.filter(r=>r.termStatus==='unpaid')
              const upcomingItems = allUnpaidList.filter(r=>r.termStatus==='upcoming')
              const currentItems  = allUnpaidList.filter(r=>r.termStatus==='current')
              const renderItem = (item, idx) => (
                    <div key={idx}
                      onClick={() => setUnpaidDetail(item)}
                      style={{ padding:'10px 12px', borderRadius:'10px', background:'#fff', border:`1px solid ${item.termStatus==='current'?'#86efac':'#fca5a5'}`, cursor:'pointer' }}>
                      <div>
                          <div style={{ fontSize:'13px', fontWeight:700, color:C.text, display:'flex', alignItems:'center', flexWrap:'nowrap', gap:'4px' }}>
                            <span style={{ whiteSpace:'nowrap' }}>{item.cls.organization} · {item.cls.className}</span>
                            <span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'4px', padding:'1px 6px', whiteSpace:'nowrap', flexShrink:0 }}>{item.term.label} {item.term.sessions.length}회</span>
                            {item.termStatus==='current'
                              ? <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'4px', padding:'1px 6px', whiteSpace:'nowrap', flexShrink:0 }}>진행중</span>
                              : item.termStatus==='upcoming'
                              ? <span style={{ fontSize:'11px', background:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 6px', whiteSpace:'nowrap', flexShrink:0 }}>예정</span>
                              : <span style={{ fontSize:'11px', background:'#fef2f2', color:C.danger, border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 6px', whiteSpace:'nowrap', flexShrink:0 }}>미수금</span>
                            }
                          </div>
                          <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                            {item.term.startDate?.slice(5)} ~ {item.term.endDate?.slice(5)} · {item._sections?.filter(Boolean).length > 1 ? item._sections.filter(Boolean).map((s,i)=>`${s}반 ${item._sectionCnts[i]}명`).join('  ')+'  총 '+item.confirmed+'명' : item.confirmed+'명'}
                          </div>
                          <div style={{ marginTop:'6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ fontSize:'11px', color:C.muted }}>{fmt(item.paid)} / {fmt(item.expected)}</div>
                            <div style={{ fontSize:'14px', fontWeight:700, color:C.danger }}>{fmt(item.unpaid)}원</div>
                          </div>
                      </div>
                    </div>
              )
              return (
                <>
                  {/* 미수금 + 예정 — 같은 칸에 세로로 */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    <div style={{ background:'#fef2f2', borderRadius:'14px', border:'1.5px solid #fca5a5', padding:'14px 16px' }}>
                      <div style={{ fontSize:'14px', fontWeight:700, color:C.danger, marginBottom:'10px' }}>
                        ⚠️ 미수금 {unpaidItems.length}건 · {fmt(unpaidItems.reduce((s,r)=>s+r.unpaid,0))}원
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                        {unpaidItems.length === 0
                          ? <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'10px' }}>없음</div>
                          : unpaidItems.map((item,idx) => renderItem(item,idx))
                        }
                      </div>
                    </div>
                    {upcomingItems.length > 0 && (
                      <div style={{ background:'#eff6ff', borderRadius:'14px', border:'1.5px solid #bfdbfe', padding:'14px 16px' }}>
                        <div style={{ fontSize:'14px', fontWeight:700, color:C.blue, marginBottom:'10px' }}>
                          📅 예정 {upcomingItems.length}건 · {fmt(upcomingItems.reduce((s,r)=>s+r.unpaid,0))}원
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {upcomingItems.map((item,idx) => renderItem(item,idx))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 진행중 컬럼 */}
                  <div style={{ background:'#f0fdf4', borderRadius:'14px', border:'1.5px solid #86efac', padding:'14px 16px' }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:C.success, marginBottom:'10px' }}>
                      📍 진행중 {currentItems.length}건 · {fmt(currentItems.reduce((s,r)=>s+r.unpaid,0))}원
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {currentItems.length === 0
                        ? <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'10px' }}>없음</div>
                        : currentItems.map((item,idx) => renderItem(item,idx))
                      }
                    </div>
                  </div>
                </>
              )
            })()}

            {/* 이달 수업 예상 현황 */}
            <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'10px' }}>📅 {curYM.slice(5)}월 수업 현황</div>
              {(() => {
                // 이번달에 수업이 있는 항목만
                const monthItems = []
                sorted.forEach(cls => {
                  const fee = feeMap[cls.id]
                  const terms = getTerms(cls)
                  const sec = cls._selSection
                  const clsStudents = students.filter(s => {
                    if (!s.classIds?.includes(cls.id)) return false
                    if (s.status !== 'confirmed') return false
                    if (sec) return (s.section || '') === sec
                    return true
                  })
                  terms.forEach(term => {
                    const cnt = clsStudents.filter(s => isInTerm(s, term)).length
                    const monthSessions = term.sessions.filter(d => d.slice(0,7) === curYM)
                    if (monthSessions.length === 0) return
                    const ps = perSessionFee(fee, term, cls)
                    monthItems.push({ cls, term, fee, cnt, monthSessions, monthRev: ps * cnt * monthSessions.length })
                  })
                })
                // 텀 번호 우선 → 같은 텀 내에서 학교/요일/시간 순
                monthItems.sort((a,b)=>{
                  if(a.term.termNo !== b.term.termNo) return a.term.termNo-b.term.termNo
                  const ai=sorted.findIndex(c=>c.id===a.cls.id)
                  const bi=sorted.findIndex(c=>c.id===b.cls.id)
                  return ai-bi
                })
                // classId + termNo 기준으로 A반/B반 합치기
                const monthGrouped = []
                const monthSeen = {}
                monthItems.forEach(item => {
                  const key = item.cls.id + '_' + item.term.termNo
                  if (monthSeen[key] !== undefined) {
                    const g = monthGrouped[monthSeen[key]]
                    g.cnt += item.cnt
                    g.monthRev += item.monthRev
                    g._sections = g._sections || [g.cls._selSection]
                    g._sections.push(item.cls._selSection)
                    g._sectionCnts = g._sectionCnts || [g._origCnt]
                    g._sectionCnts.push(item.cnt)
                  } else {
                    monthSeen[key] = monthGrouped.length
                    monthGrouped.push({ ...item, _origCnt: item.cnt, _sections: [item.cls._selSection], _sectionCnts: [item.cnt] })
                  }
                })
                if (monthItems.length === 0) return (
                  <div style={{ textAlign:'center', padding:'14px', color:C.muted, fontSize:'13px' }}>이번달 수업 없음</div>
                )
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {monthGrouped.map((item, i) => (
                      <div key={i} style={{ padding:'8px 10px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>
                            {item.cls.organization} · {item.cls.className}
                          </div>
                          <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                            {item.term.label} · {item.monthSessions.length}회 · {item._sections?.filter(Boolean).length > 1 ? item._sections.filter(Boolean).map((s,i)=>`${s}반 ${item._sectionCnts[i]}명`).join('  ')+'  총 '+item.cnt+'명' : item.cnt+'명'}
                            <span style={{ marginLeft:'4px', color:C.muted }}>({item.monthSessions[0]?.slice(5)}~{item.monthSessions[item.monthSessions.length-1]?.slice(5)})</span>
                          </div>
                        </div>
                        <div style={{ fontSize:'13px', fontWeight:700, color: item.fee ? C.success : C.muted, flexShrink:0 }}>
                          {item.fee ? fmt(item.monthRev)+'원' : '수강료미설정'}
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:'8px', marginTop:'2px', display:'flex', justifyContent:'space-between', fontSize:'13px', fontWeight:700 }}>
                      <span style={{ color:C.muted }}>{curYM.slice(5)}월 예상 합계</span>
                      <span style={{ color:C.success }}>{fmt(monthTotal)}원</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* 입금 내역 */}
            <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>
                  💵 입금 내역
                  <span style={{ fontSize:'12px', fontWeight:500, color:C.muted, marginLeft:'6px' }}>({curDate.slice(5).replace('-','.')})</span>
                </div>
                <button onClick={() => openPayModal(curDate)}
                  style={{ padding:'5px 12px', borderRadius:'8px', border:'none', background:C.success, color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  + 입금 등록
                </button>
              </div>
              {(() => {
                const todayPays = payByDate[curDate] || []
                const allTotal = payments.reduce((s,p)=>s+p.amount,0)
                if (payments.length === 0) return (
                  <div style={{ textAlign:'center', padding:'10px', color:C.muted, fontSize:'13px' }}>입금 내역 없음</div>
                )
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {/* 전체 요약 */}
                    <div style={{ padding:'10px 12px', borderRadius:'10px', background:'#f0fdf4', border:'1px solid #86efac', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:'12px', color:C.muted }}>전체 누적 입금</div>
                      <div style={{ fontSize:'14px', fontWeight:700, color:C.success }}>+{fmt(allTotal)}원</div>
                    </div>
                    {/* 선택 날짜 입금 */}
                    {todayPays.length > 0 ? (
                      <div
                        onClick={() => setPayDetailModal({ date: curDate, pays: todayPays })}
                        style={{ padding:'10px 12px', borderRadius:'10px', background:'#eff6ff', border:'1px solid #bfdbfe', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                      >
                        <div>
                          <div style={{ fontSize:'12px', fontWeight:700, color:C.blue }}>{curDate.slice(5).replace('-','.')} 입금</div>
                          <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{todayPays.length}건 · 상세보기 →</div>
                        </div>
                        <div style={{ fontSize:'14px', fontWeight:700, color:C.blue }}>+{fmt(todayPays.reduce((s,p)=>s+p.amount,0))}원</div>
                      </div>
                    ) : (
                      <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'6px' }}>
                        {curDate.slice(5).replace('-','.')} 입금 내역 없음
                      </div>
                    )}
                    {/* 전체 내역 보기 버튼 */}
                    <button
                      onClick={() => setPayDetailModal({ date: null, pays: [...payments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')) })}
                      style={{ padding:'8px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fafafa', color:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}
                    >
                      전체 입금 내역 보기 ({payments.length}건) →
                    </button>
                  </div>
                )
              })()}
          </div>
          </div>
        </div>
      )}

      {/* ── 텀 크로스체크 탭 */}
      {tab === 'terms' && (() => {
        // 전체 텀 번호 목록 수집 (1텀, 2텀, ... 순서대로)
        const allTermNos = []
        sorted.forEach(cls => {
          getTerms(cls).forEach(t => {
            if (!allTermNos.includes(t.termNo)) allTermNos.push(t.termNo)
          })
        })
        allTermNos.sort((a,b) => a-b)

        // 전체 합계
        let totalAllExpected=0, totalAllPaid=0
        sorted.forEach(cls => {
          const fee=feeMap[cls.id], cnt=confirmedCount[cls.id+(cls._selSection?'::'+cls._selSection:'')]||0
          if(!fee||!cnt) return
          getTerms(cls).forEach(term => {
            const ps=perSessionFee(fee,term,cls)
            const exp=ps*cnt*term.sessions.length
            const paid=(payByClass[cls.id]||[]).filter(p=>payMatchesTerm(p,term,cls.id)).reduce((s,p)=>s+p.amount,0)
            totalAllExpected+=exp; totalAllPaid+=paid
          })
        })
        const totalAllUnpaid=totalAllExpected-totalAllPaid

        return (
        <div>


          {allTermNos.length===0
            ? <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>📊</div>
                <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 수업이 없습니다</div>
              </div>
            : allTermNos.map(termNo => {
                // 이 텀 번호를 가진 모든 수업+텀 row 수집
                const rows = []
                sorted.forEach(cls => {
                  const fee=feeMap[cls.id]
                  const terms=getTerms(cls)
                  const term=terms.find(t=>t.termNo===termNo)
                  if(!term) return
                  const sec=cls._selSection
                  const cnt=termRosterCount(students,cls.id,sec,term)
                  const clsPays=payByClass[cls.id]||[]
                  const tagged=clsPays.filter(p=>payMatchesTerm(p,term,cls.id))
                  const ps=perSessionFee(fee,term,cls)
                  const expected=fee&&cnt ? ps*cnt*term.sessions.length : 0
                  const paid=tagged.reduce((s,p)=>s+p.amount,0)
                  rows.push({ cls, fee, cnt, term, expected, paid, unpaid:expected-paid, payments:tagged })
                })
                if(rows.length===0) return null

                // 이 텀의 날짜 범위 + 라벨 (수업마다 다를 수 있으니 대표값)
                const termDates = rows.map(r=>r.term)
                const termStart = termDates.map(t=>t.startDate).sort()[0]
                const termEnd   = termDates.map(t=>t.endDate).sort().reverse()[0]
                const uniqueLabels = [...new Set(rows.map(r=>r.term?.label).filter(Boolean))]
                const termLabel = uniqueLabels.join(' / ')

                // 텀 상태: today 기준
                // 텀 상태: 텀 순서 기준 (allTermNos 전체 기준으로 계산)
                // 모든 수업의 텀별 endDate를 모아서, 해당 텀번호의 수업들이 전부 종료됐으면 done
                // done 다음 첫번째 텀이 active, 나머지 upcoming
                const t0 = today()
                const lastDoneTermNo = allTermNos.filter(n => {
                  const endsForN = sorted.flatMap(cls => {
                    const t = getTerms(cls).find(t=>t.termNo===n)
                    return t ? [t.endDate] : []
                  })
                  return endsForN.length > 0 && endsForN.every(e => e < t0)
                }).reduce((max,n)=>Math.max(max,n), 0)
                const activeTermNo = lastDoneTermNo + 1
                const termSt = termNo < activeTermNo ? 'done' : termNo === activeTermNo ? 'active' : 'upcoming'

                const termExpTotal = rows.reduce((s,r)=>s+r.expected,0)
                // ★ 같은 classId(A·B반)는 payments가 동일 레코드를 중복 보유 → id 기준 중복 제거 후 합산
                const termAllPays = [...new Map(rows.flatMap(r=>r.payments).map(p=>[p.id,p])).values()]
                const termPaidTotal = termAllPays.reduce((s,p)=>s+p.amount,0)
                const termUnpaidTotal = termExpTotal-termPaidTotal

                const hdrBg    = termSt==='active'?'#f0fdf4': termSt==='upcoming'?'#eff6ff':'#f9fafb'
                const hdrBorder= termSt==='active'?'#86efac': termSt==='upcoming'?'#bfdbfe': termUnpaidTotal>0?'#fca5a5':C.border

                const isExpanded = expandedClass === ('term_'+termNo)
                // 진행중 + 직전텀은 기본 펼침, 나머지는 접힘
                const termKey = 'term_'+termNo
                const isTermOpen = termKey in expandedTerms
                  ? expandedTerms[termKey]
                  : (termSt === 'active' || termNo === activeTermNo - 1)
                const toggleTerm = () => setExpandedTerms(prev => ({ ...prev, [termKey]: !isTermOpen }))

                return (
                  <div key={termNo} style={{ marginBottom:'14px', borderRadius:'14px', border:`1.5px solid ${hdrBorder}`, overflow:'hidden', background:C.card }}>
                    {/* 텀 헤더 — 클릭으로 접기/펼치기 */}
                    <div onClick={toggleTerm} style={{ padding:'12px 20px', background:hdrBg, borderBottom: isTermOpen ? `1px solid ${hdrBorder}` : 'none', cursor:'pointer' }}>
                      {/* 텀 번호 + 상태 + 합계 */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'16px', fontWeight:800, color:termSt==='active'?C.success:termSt==='upcoming'?C.muted:C.text }}>{termLabel}</span>
                          <span style={{ fontSize:'12px', color:C.muted }}>{termStart?.slice(5)} ~ {termEnd?.slice(5)}</span>
                          {termSt==='active'  &&<span style={{ fontSize:'11px', background:'#dcfce7', color:C.success, border:'1px solid #86efac', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>진행중</span>}
                          {termSt==='done'    &&<span style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, border:`1px solid ${C.border}`, borderRadius:'5px', padding:'1px 7px' }}>수업완료</span>}
                          {termSt==='upcoming'&&<span style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, border:`1px solid ${C.border}`, borderRadius:'5px', padding:'1px 7px' }}>예정</span>}
                          {termUnpaidTotal>0&&termSt!=='upcoming'&&<span style={{ fontSize:'11px', background:'#fef2f2', color:C.danger, border:'1px solid #fca5a5', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>미수금</span>}
                        </div>
                        <div style={{ display:'flex', gap:'14px', alignItems:'center' }}>
                          {termExpTotal>0&&<>
                            <span style={{ fontSize:'12px', color:C.muted }}>예상 <strong style={{color:C.text}}>{fmt(termExpTotal)}원</strong></span>
                            <span style={{ fontSize:'12px', color:C.muted }}>입금 <strong style={{color:C.success}}>{fmt(termPaidTotal)}원</strong></span>
                            {termUnpaidTotal>0&&termSt!=='upcoming'&&<span style={{ fontSize:'12px', color:C.muted }}>미수 <strong style={{color:C.danger}}>{fmt(termUnpaidTotal)}원</strong></span>}
                          </>}
                          <span style={{ fontSize:'13px', color:C.muted }}>{isTermOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 텀 내 수업 목록 — 접기/펼치기 */}
                    {isTermOpen && <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
                      {(() => {
                        // cls.id 기준으로 그룹핑 (A반/B반은 같은 id)
                        const groupMap = {}
                        const groupOrder = []
                        rows.forEach(row => {
                          const key = row.cls.id
                          if (!groupMap[key]) { groupMap[key] = { baseRow: row, sections: [] }; groupOrder.push(key) }
                          groupMap[key].sections.push(row)
                        })
                        return groupOrder.map(k => groupMap[k]).map(({ baseRow, sections }) => {
                          const { cls, term } = baseRow
                          const totalCnt = sections.reduce((s,r) => s+r.cnt, 0)
                          const totalExpected = sections.reduce((s,r) => s+r.expected, 0)
                          // ★ A·B반은 같은 payments를 공유하므로 id 기준 중복 제거 후 합산
                          const allPays = [...new Map(sections.flatMap(r => r.payments).map(p => [p.id, p])).values()]
                          const totalPaid = allPays.reduce((s,p)=>s+p.amount, 0)
                          const totalUnpaid = Math.max(0, totalExpected - totalPaid)
                          const hasUnpaidRow = totalUnpaid>0&&termSt!=='upcoming'
                          const days = cls.days?.join('·') || ''
                          const termType = cls.termType==='semester'?'학기제':'분기제'
                          const isRowExpanded = expandedClass === (cls.id+'_'+termNo)
                          const hasSecs = sections.length > 1 && sections.some(r => r.cls._selSection)
                          // 직전 텀 대비 전학/취소 인원
                          const clsTerms = getTerms(cls)
                          const prevTerm = clsTerms.find(t=>t.periodNo===term.periodNo && t.termNo===term.termNo-1)
                          const secDeps = sections.map(r => termDepartures(students, r.cls.id, r.cls._selSection, term, prevTerm))
                          const totalDep = secDeps.reduce((acc,d)=>({ cancel:acc.cancel+d.cancel, transfer:acc.transfer+d.transfer }), { cancel:0, transfer:0 })
                          const depBadge = (dep) => (dep.cancel>0||dep.transfer>0)
                            ? ` (${[dep.transfer>0?`전학 -${dep.transfer}명`:null, dep.cancel>0?`취소 -${dep.cancel}명`:null].filter(Boolean).join(', ')})`
                            : ''
                          return (
                            <div key={cls.id} style={{ borderRadius:'10px', border:`1px solid ${hasUnpaidRow?'#fca5a5':C.border}`, overflow:'hidden' }}>
                              <div onClick={()=>setExpandedClass(isRowExpanded?null:cls.id+'_'+termNo)}
                                style={{ padding:'10px 14px', background:hasUnpaidRow?'#fef2f2':'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px', cursor:'pointer' }}>
                                <div>
                                  <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                                    🏫 {cls.organization} · {cls.className}
                                    <span style={{ marginLeft:'8px', fontSize:'13px', fontWeight:800, color:C.primary, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'6px', padding:'2px 9px' }}>
                                      {term.sessions.length}회
                                    </span>
                                  </div>
                                  <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                                    {hasSecs ? (
                                      <>
                                        {sections.map((r,ri) => (
                                          <span key={ri}>
                                            {ri>0?'  ':''}{r.cls._selSection}반 {r.cnt}명
                                            {(secDeps[ri].cancel>0||secDeps[ri].transfer>0) &&
                                              <span style={{ color:C.danger, fontWeight:700 }}>{depBadge(secDeps[ri])}</span>}
                                          </span>
                                        ))}
                                        {`  총 ${totalCnt}명`}
                                        {(totalDep.cancel>0||totalDep.transfer>0) &&
                                          <span style={{ color:C.danger, fontWeight:700 }}>{depBadge(totalDep)}</span>}
                                      </>
                                    ) : (
                                      <>
                                        {`현재 ${totalCnt}명`}
                                        {(totalDep.cancel>0||totalDep.transfer>0) &&
                                          <span style={{ color:C.danger, fontWeight:700 }}>{depBadge(totalDep)}</span>}
                                      </>
                                    )}
                                    {' '}· {term.label} {term.sessions.length}회 · {days}요일
                                    {term.startDate&&<> · {term.startDate.slice(5)}~{term.endDate.slice(5)}</>}
                                  </div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                  {baseRow.fee&&totalCnt>0&&<>
                                    <span style={{ fontSize:'12px', color:C.muted }}>예상 {fmt(totalExpected)}원</span>
                                    <span style={{ fontSize:'12px', fontWeight:700, color:C.success }}>입금 {fmt(totalPaid)}원</span>
                                    {totalUnpaid>0&&termSt!=='upcoming'&&<span style={{ fontSize:'12px', fontWeight:700, color:C.danger }}>미수 {fmt(totalUnpaid)}원</span>}
                                  </>}
                                  {!baseRow.fee&&<span style={{ fontSize:'11px', color:C.muted }}>수강료 미설정</span>}
                                  {termSt!=='upcoming'&&(()=>{
                                    const isComplete = baseRow.fee&&totalPaid>0
                                    return isComplete ? (
                                      <>
                                        <span style={{ padding:'4px 10px', borderRadius:'7px', background:'#dcfce7', color:C.success, fontSize:'11px', fontWeight:700 }}>
                                          ✅ 완료
                                        </span>
                                        <button onClick={e=>{e.stopPropagation();openPayModal(today(),cls.id,term.termNo,true)}}
                                          style={{ padding:'4px 10px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#fff', color:C.text, fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                          수정
                                        </button>
                                      </>
                                    ) : (
                                      <button onClick={e=>{e.stopPropagation();openPayModal(today(),cls.id,term.termNo,true)}}
                                        style={{ padding:'4px 10px', borderRadius:'7px', border:'none', background:C.primary, color:'#fff', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                        + 입금
                                      </button>
                                    )
                                  })()}
                                </div>
                              </div>
                              {isRowExpanded&&(
                                <div style={{ padding:'4px 14px 8px' }}>
                                  {allPays.length===0
                                    ? <div style={{ padding:'8px 0', fontSize:'12px', color:C.muted }}>입금 내역 없음</div>
                                    : [...allPays].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(p=>(
                                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid #f3f4f6` }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                          <span style={{ fontSize:'13px', color:C.text, fontWeight:600 }}>{p.date?.replace(/-/g,'.').slice(2)}</span>
                                          {p.memo&&<span style={{ fontSize:'12px', color:C.muted }}>{p.memo}</span>}
                                        </div>
                                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                          <span style={{ fontSize:'13px', fontWeight:700, color:C.success }}>+{fmt(p.amount)}원</span>
                                          <button onClick={()=>confirm('삭제할까요?', () => deletePayment(p.id))} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                                        </div>
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>}
                  </div>
                )
              })
          }
        </div>
        )
      })()}

      {/* ── 수강료 등록 탭 */}
      {tab === 'fees' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {sorted.length === 0
            ? <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>📚</div>
                <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 수업이 없습니다</div>
              </div>
            : (() => {
                // cls.id 기준 중복 제거 (A반/B반 같은 id → 한 카드로)
                const seen = {}
                const dedupedSorted = []
                sorted.forEach(cls => {
                  if (!seen[cls.id]) { seen[cls.id] = true; dedupedSorted.push(cls) }
                })
                return dedupedSorted.map(cls => {
                const fee=feeMap[cls.id]
                const cnt = (cls.sections?.filter(s=>s.section)||[]).reduce((sum,s)=>{
                  return sum + (confirmedCount[cls.id+'::'+s.section]||0)
                }, 0) || confirmedCount[cls.id+(cls._selSection?'::'+cls._selSection:'')]||0
                const sessions=calcSessionDates(cls)
                const terms=getTerms(cls)
                const clsPays=(payByClass[cls.id]||[]).sort((a,b)=>(a.date||'').localeCompare(b.date||''))
                const paid=clsPays.reduce((s,p)=>s+p.amount,0)
                const totalExpected=terms.reduce((s,term)=>{
                  const ps=perSessionFee(fee,term,cls)
                  return s+ps*cnt*term.sessions.length
                },0)
                const feeKey = 'fee_'+cls.id
                const isFeeOpen = feeKey in expandedFees ? expandedFees[feeKey] : true
                const toggleFee = () => setExpandedFees(prev => ({ ...prev, [feeKey]: !isFeeOpen }))
                return (
                  <div key={cls.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                    <div onClick={toggleFee} style={{ padding:'14px 20px', background:'#fafafa', borderBottom: isFeeOpen ? `1px solid ${C.border}` : 'none', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px', cursor:'pointer' }}>
                      <div>
                        <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>
                          🏫 {cls.organization} · {cls.className}
                        </div>
                        <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px' }}>
                          총 {cnt}명 · {cls.termType==='semester'?'학기제':'분기제'} · {terms.length}텀 총 {sessions.length}회
                        </div>
                        {(cls.sections?.filter(s=>s.section)||[]).length > 1 && (
                          <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px', display:'flex', flexDirection:'column', gap:'2px' }}>
                            {cls.sections.filter(s=>s.section).map(s => {
                              const sCnt = confirmedCount[cls.id+'::'+s.section]||0
                              return (
                                <div key={s.section}>
                                  <span style={{ fontWeight:700, color:C.primary }}>{s.section}반</span>
                                  {s.time&&<span> {s.time}{s.timeEnd?' ~ '+s.timeEnd:''}</span>}
                                  <span> / {sCnt}명</span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <button onClick={e=>{e.stopPropagation(); setFeeTarget({classId:cls.id,org:cls.organization,className:cls.className}); setFeeForm({feeType:fee?.feeType||'per_session',amount:String(fee?.amount||'')}); setFeeModal(true) }}
                          style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:fee?'#fff7ed':'#f9fafb', color:fee?C.primary:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                          {fee?`⚙️ ${fmt(fee.amount)}원/${fee.feeType==='per_session'?'회':'텀'}`:'⚙️ 수강료 설정'}
                        </button>
                        <span style={{ fontSize:'13px', color:C.muted }}>{isFeeOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isFeeOpen && clsPays.length>0&&(
                      <div style={{ padding:'4px 20px 8px' }}>
{clsPays.map(p=>{
                          const payTerm = p.termNo ? terms.find(t=>t.termNo===Number(p.termNo)) : null
                          const baseCount = Number(cls.termSizes?.[0]) || terms[0]?.sessions.length || 1
                          const secs = cls.sections?.filter(s=>s.section)||[]
                          const termAmt = payTerm && fee ? (fee.feeType==='per_term'
                            ? Math.round(Number(fee.amount) / baseCount * payTerm.sessions.length)
                            : Number(fee.amount) * payTerm.sessions.length) : 0
                          const secCnts = payTerm ? secs.map(s=>({
                            section: s.section,
                            cnt: termRosterCount(students, cls.id, s.section, payTerm)
                          })) : []
                          const totalTermCnt = secCnts.reduce((sum,s)=>sum+s.cnt, 0)
                          return (
                          <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 0', borderBottom:`1px solid #f3f4f6` }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'13px', color:C.text, fontWeight:600 }}>{p.date?.replace(/-/g,'.').slice(2)}</span>
                                {payTerm&&<span style={{ fontSize:'11px', background:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px' }}>{payTerm.label}</span>}
                                {payTerm&&fee&&secCnts.length>1&&secCnts.map(s=>(
                                  <span key={s.section} style={{ fontSize:'12px', color:C.muted }}>{s.section}반 {s.cnt}명</span>
                                ))}
                                {payTerm&&fee&&totalTermCnt>0&&<span style={{ fontSize:'12px', color:C.muted }}>총 {totalTermCnt}명</span>}
                                {payTerm&&fee&&termAmt>0&&<span style={{ fontSize:'12px', color:C.muted }}>× {fmt(termAmt)}원</span>}
                                {p.memo&&<span style={{ fontSize:'12px', color:C.muted }}>{p.memo}</span>}
                              </div>
                              {p.reason&&<div style={{ fontSize:'11px', color:C.warning, marginTop:'2px' }}>📝 {p.reason}</div>}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                              <span style={{ fontSize:'14px', fontWeight:700, color:C.success }}>+{fmt(p.amount)}원</span>
                              <button onClick={()=>confirm('입금 내역을 삭제할까요?', () => deletePayment(p.id))} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )
              })
                })()
          }
        </div>
      )}

      {/* ── 수강료 설정 모달 */}
      {feeModal&&feeTarget&&(()=>{
        const targetCls = sorted.find(c=>c.id===feeTarget.classId)
        const terms = targetCls ? getTerms(targetCls) : []
        // 텀별 회차 수 (텀마다 다를 수 있으니 평균 or 현재텀 기준 — 첫 텀 기준)
        const termSessionCount = terms[0]?.sessions.length || 4
        const amt = Number(feeForm.amount) || 0
        const perSession = feeForm.feeType === 'per_session' ? amt : (termSessionCount > 0 ? Math.round(amt / termSessionCount) : 0)
        const perTerm    = feeForm.feeType === 'per_term'    ? amt : amt * termSessionCount
        const confirmedCnt = confirmedCount[feeTarget.classId] || 0

        return (
        <Modal open={feeModal} onClose={()=>setFeeModal(false)} title="수강료 설정" width={440}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ padding:'11px 16px', background:'#f9fafb', borderRadius:'10px', fontSize:'14px', fontWeight:600, color:C.text }}>
                📚 {feeTarget.org} · {feeTarget.className}
                {terms.length > 0 && <span style={{ fontSize:'12px', color:C.muted, fontWeight:400, marginLeft:'8px' }}>{terms.length}텀 · 텀당 {termSessionCount}회차</span>}
              </div>

              {/* 방식 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'8px' }}>입력 방식</label>
                <div style={{ display:'flex', gap:'8px' }}>
                  {[['per_session','회차당 입력'],['per_term','텀당 입력']].map(([v,l])=>(
                    <button key={v} onClick={()=>setFeeForm(f=>({...f,feeType:v}))}
                      style={{ flex:1, padding:'10px', borderRadius:'9px', border:`2px solid ${feeForm.feeType===v?C.primary:C.border}`, background:feeForm.feeType===v?'#fff7ed':'#fff', color:feeForm.feeType===v?C.primary:C.muted, fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 금액 입력 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>
                  {feeForm.feeType==='per_session' ? '1회차당 수강료' : '1텀 전체 수강료'} (원)
                </label>
                <input type="number" value={feeForm.amount} onChange={e=>setFeeForm(f=>({...f,amount:e.target.value}))}
                  placeholder={feeForm.feeType==='per_session' ? '예: 7500' : '예: 30000'} style={{...iStyle,fontSize:'16px'}} />
              </div>

              {/* 자동 환산 표시 */}
              {amt > 0 && (
                <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'10px', padding:'12px 14px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px' }}>
                    <span style={{ color:C.muted }}>회차당</span>
                    <span style={{ fontWeight:700, color:C.text }}>{fmt(perSession)}원</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px' }}>
                    <span style={{ color:C.muted }}>텀당 ({termSessionCount}회 기준)</span>
                    <span style={{ fontWeight:700, color:C.text }}>{fmt(perTerm)}원</span>
                  </div>
                  {confirmedCnt > 0 && <>
                    <div style={{ height:'1px', background:'#86efac', margin:'2px 0' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px' }}>
                      <span style={{ color:C.muted }}>회차 전체 수익 ({confirmedCnt}명)</span>
                      <span style={{ fontWeight:700, color:C.success }}>{fmt(perSession * confirmedCnt)}원</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px' }}>
                      <span style={{ color:C.muted }}>텀 전체 수익 ({confirmedCnt}명)</span>
                      <span style={{ fontWeight:700, color:C.success }}>{fmt(perTerm * confirmedCnt)}원</span>
                    </div>
                  </>}
                </div>
              )}

              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveFeeForm} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={()=>setFeeModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
          </div>
        </Modal>
        )
      })()}

      {/* ── 입금 등록 모달 */}
      {/* ── 입금 등록 Wizard */}
      {payWizard&&(()=>{
        const selCls = sorted.find(c=>c.id===payForm.classId)
        const terms  = selCls ? getTerms(selCls) : []
        const selTerm= terms.find(t=>String(t.termNo)===String(payForm.termNo))
        const fee    = selCls ? feeMap[selCls.id] : null
        const cnt    = selCls ? (confirmedCount[selCls.id]||0) : 0
        const expectedAmt = (fee && selTerm) ? perSessionFee(fee,selTerm,selCls)*cnt*selTerm.sessions.length : 0

        const hasTerm = terms.length > 1
        const STEPS = hasTerm ? ['날짜','학교','텀','금액','메모'] : ['날짜','학교','금액','메모']
        const totalSteps = STEPS.length
        const displayStep = (!hasTerm && payStep >= 3) ? payStep - 1 : payStep

        const goNext = () => {
          if (payStep === 2 && !payForm.classId) { toastError('수업을 선택해주세요'); return }
          if (hasTerm && payStep === 3 && !payForm.termNo) {
            if (terms.length===1) { setPayForm(f=>({...f,termNo:String(terms[0].termNo)})) }
            else { toastError('텀을 선택해주세요'); return }
          }
          // step1(날짜) 완료 후: classId+termNo 이미 세팅 시 금액(4)으로 점프
          if (payStep === 1 && payForm.classIds?.length > 0 && payForm.termNo) { setPayStep(4); return }
          if (payStep === 1 && payForm.classIds?.length > 0 && !hasTerm) { setPayStep(4); return }
          const nextStep = (!hasTerm && payStep === 2) ? 4 : payStep + 1
          if (nextStep > totalSteps) { savePayForm(); return }
          setPayStep(nextStep)
        }
        const goBack = () => {
          // step4에서 뒤로: classId+termNo 이미 세팅 시 날짜(1)로 점프
          if (payStep === 4 && payForm.classIds?.length > 0 && payForm.termNo) { setPayStep(1); return }
          if (payStep === 4 && payForm.classIds?.length > 0 && !hasTerm) { setPayStep(1); return }
          const prevStep = (!hasTerm && payStep === 4) ? 2 : payStep - 1
          setPayStep(Math.max(1, prevStep))
        }
        const canNext = payStep===1 ? !!payDate
          : payStep===2 ? (payForm.classIds && payForm.classIds.length > 0)
          : (hasTerm && payStep===3) ? !!payForm.termNo
          : payStep===4 ? (payForm.classIds||[payForm.classId]).filter(Boolean).some(cid=>Number(payForm[`amount_${cid}`]||payForm.amount)>0)
          : true

        return (
          <Modal open={payWizard} onClose={()=>setPayWizard(false)} title="💵 입금 등록" width={400}>
            {/* 진행 단계 */}
            <div style={{ marginBottom:'20px' }}>
              <div style={{ display:'flex', gap:'4px' }}>
                {STEPS.map((s,i)=>(
                  <div key={s} style={{ flex:1, height:'4px', borderRadius:'2px', background: displayStep > i ? C.primary : '#e5e7eb', opacity: displayStep === i+1 ? 1 : displayStep > i ? 0.7 : 0.25, transition:'all .3s' }} />
                ))}
              </div>
              <div style={{ marginTop:'6px', fontSize:'11px', color:C.muted }}>
                {displayStep} / {totalSteps} &nbsp;—&nbsp; <strong style={{color:C.text}}>{STEPS[displayStep-1]}</strong>
              </div>
            </div>
            <div style={{ minHeight:'160px' }}>
                {payStep===1&&(
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>📅 언제 입금됐나요?</div>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>입금 받은 날짜를 선택하세요</div>
                    <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={{...iStyle,fontSize:'16px',fontWeight:600}} />
                  </div>
                )}
                {payStep===2&&(
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>🏫 어느 수업인가요? <span style={{fontSize:'13px',color:C.primary,fontWeight:400}}>(복수 선택 가능)</span></div>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>{payDate.replace(/-/g,'.')} 입금</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'220px', overflowY:'auto' }}>
                      {groupedForPay.length===0
                        ? <div style={{ textAlign:'center', padding:'20px', color:C.muted, fontSize:'13px' }}>등록된 수업이 없습니다</div>
                        : groupedForPay.map(cls=>{
                          const isSel = (payForm.classIds||[]).includes(cls.id)
                          const f = feeMap[cls.id]
                          const clsTerms = getTerms(cls)
                          const lastEndedNo = clsTerms.filter(t=>t.endDate&&t.endDate<payDate).reduce((mx,t)=>Math.max(mx,t.termNo),0)
                          const curTerm = clsTerms.find(t=>t.termNo===lastEndedNo+1)||clsTerms.find(t=>t.startDate<=payDate&&t.endDate>=payDate)||clsTerms[0]
                          // 같은 학기/분기 내 직전 텀 (학기/분기가 바뀌면 새로 시작이므로 비교 안 함)
                          const prevTerm = curTerm ? clsTerms.find(t=>t.periodNo===curTerm.periodNo && t.termNo===curTerm.termNo-1) : null
                          // ★ 해당 텀의 출석부 기준 인원 (현재 확정 인원) + 직전 텀 대비 전학/취소 인원
                          const termSecLines = cls._secEntries.filter(c2=>c2._selSection).map(c2=>{
                            const cnt = curTerm ? termRosterCount(students, c2.id, c2._selSection, curTerm) : (confirmedCount[c2.id+'::'+c2._selSection]||0)
                            const dep = curTerm ? termDepartures(students, c2.id, c2._selSection, curTerm, prevTerm) : { cancel:0, transfer:0 }
                            const time = c2._secTime ? `${c2._secTime}${c2._secTimeEnd?' ~ '+c2._secTimeEnd:''}` : ''
                            return { text: `${c2._selSection}반 ${cnt}명${time?' '+time:''}`, dep }
                          })
                          const c = cls._secEntries.reduce((s,c2)=>{
                            const sec2 = c2._selSection
                            const cnt = curTerm ? termRosterCount(students, c2.id, sec2, curTerm) : (confirmedCount[c2.id+(sec2?'::'+sec2:'')]||0)
                            return s+cnt
                          }, 0)
                          const totalDep = cls._secEntries.reduce((acc,c2)=>{
                            const sec2 = c2._selSection
                            const dep = curTerm ? termDepartures(students, c2.id, sec2, curTerm, prevTerm) : { cancel:0, transfer:0 }
                            return { cancel: acc.cancel+dep.cancel, transfer: acc.transfer+dep.transfer }
                          }, { cancel:0, transfer:0 })
                          const curTermPaid = curTerm?(payByClass[cls.id]||[]).filter(p=>payMatchesTerm(p,curTerm,cls.id)).reduce((s,p)=>s+p.amount,0):0
                          const curTermExp = curTerm&&f&&c?perSessionFee(f,curTerm,cls)*c*curTerm.sessions.length:0
                          const isPaid = curTermExp>0&&curTermPaid>=curTermExp
                          if(isPaid) return null
                          return (
                            <div key={cls.id} onClick={()=>{
                              const cur = (payForm.classIds||[]).includes(cls.id)
                                ? payForm.classIds.filter(id=>id!==cls.id)
                                : [...(payForm.classIds||[]), cls.id]
                              setPayForm(pf=>({...pf,classIds:cur,classId:cur[0]||''}))
                            }}
                              style={{ padding:'12px 14px', borderRadius:'12px', border:`2px solid ${isSel?C.primary:C.border}`, background:isSel?'#fff7ed':'#fafafa', cursor:'pointer', transition:'all .15s', display:'flex', alignItems:'center', gap:'10px' }}>
                              <div style={{ width:'18px', height:'18px', borderRadius:'4px', border:`2px solid ${isSel?C.primary:C.border}`, background:isSel?C.primary:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                {isSel&&<span style={{color:'#fff',fontSize:'12px',fontWeight:700}}>✓</span>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:'14px', fontWeight:700, color:isSel?C.primary:C.text }}>
                                  {cls.organization} · {cls.className}
                                  {curTerm && (
                                    <span style={{ fontSize:'11px', fontWeight:700, color:C.blue, background:'#eff6ff', borderRadius:'4px', padding:'1px 6px', marginLeft:'6px' }}>
                                      {curTerm.label}
                                    </span>
                                  )}
                                </div>
                                {termSecLines.length > 0 ? (
                                  <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px', display:'flex', flexDirection:'column', gap:'1px' }}>
                                    {termSecLines.map((line,li) => (
                                      <div key={li}>
                                        {line.text}
                                        {(line.dep.cancel>0||line.dep.transfer>0) && (
                                          <span style={{ marginLeft:'5px', fontWeight:700, color:C.danger }}>
                                            ({[line.dep.transfer>0?`전학 -${line.dep.transfer}명`:null, line.dep.cancel>0?`취소 -${line.dep.cancel}명`:null].filter(Boolean).join(', ')})
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    <div style={{ fontWeight:700, color:C.text }}>
                                      총 {c}명{f?` / ${fmt(f.amount)}원/${f.feeType==='per_session'?'회':'텀'}`:''}
                                      {(totalDep.cancel>0||totalDep.transfer>0) && (
                                        <span style={{ marginLeft:'5px', fontWeight:700, color:C.danger }}>
                                          ({[totalDep.transfer>0?`전학 -${totalDep.transfer}명`:null, totalDep.cancel>0?`취소 -${totalDep.cancel}명`:null].filter(Boolean).join(', ')})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                                    {`현재 ${c}명`}
                                    {(cls.sections?.length>0?cls.sections[0].time:cls.time)?` · ${cls.sections?.length>0 ? cls.sections.map(s=>(s.section?s.section+'반 ':'')+s.time+(s.timeEnd?' ~ '+s.timeEnd:'')).join(' / ') : cls.time+(cls.timeEnd?' ~ '+cls.timeEnd:'')}`:''}{f?` · ${fmt(f.amount)}원/${f.feeType==='per_session'?'회':'텀'}`:''}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      }
                    </div>
                  </div>
                )}
                {payStep===3&&(
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>📚 몇 텀 수강료인가요?</div>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>텀을 선택하면 선택한 모든 수업에 동일하게 적용됩니다</div>
                    {/* 선택된 수업 목록 표시 */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'12px' }}>
                      {(payForm.classIds&&payForm.classIds.length>0?payForm.classIds:[payForm.classId]).filter(Boolean).map(cid=>{
                        const cls2=groupedForPay.find(c=>c.id===cid)
                        return <span key={cid} style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'20px', background:'#fff7ed', border:`1px solid ${C.primary}`, color:C.primary, fontWeight:600 }}>
                          {cls2?.organization} · {cls2?.className}
                        </span>
                      })}
                    </div>
                    {/* 첫 번째 수업 기준으로 텀 목록 표시 */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      {terms.map(t=>{
                        const isSel=String(payForm.termNo)===String(t.termNo)
                        const isCur=isTermCurrent(t)
                        const td=today()
                        const isPast=t.endDate < td
                        const isFuture=t.startDate > td
                        const isDisabled=isFuture
                        return (
                          <div key={t.termNo}
                            onClick={()=>{ if(!isDisabled) setPayForm(pf=>({...pf,termNo:String(t.termNo)})) }}
                            style={{ padding:'12px 14px', borderRadius:'12px',
                              border:`2px solid ${isSel?C.primary:isCur?'#86efac':isFuture?'#e5e7eb':C.border}`,
                              background:isSel?'#fff7ed':isCur?'#f0fdf4':isFuture?'#f9fafb':'#fafafa',
                              cursor:isDisabled?'not-allowed':'pointer',
                              opacity:isDisabled?0.5:1,
                              transition:'all .15s', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                              <div style={{ fontSize:'14px', fontWeight:700, color:isSel?C.primary:isCur?C.success:isFuture?C.muted:C.text }}>
                                {t.label}
                                {isCur&&<span style={{ fontSize:'11px', background:'#dcfce7', color:C.success, borderRadius:'4px', padding:'1px 5px', marginLeft:'6px' }}>진행중</span>}
                                {isFuture&&<span style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, borderRadius:'4px', padding:'1px 5px', marginLeft:'6px' }}>예정</span>}
                                {isPast&&<span style={{ fontSize:'11px', background:'#eff6ff', color:C.blue, borderRadius:'4px', padding:'1px 5px', marginLeft:'6px' }}>수업종료</span>}
                              </div>
                              <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                                {t.startDate?.slice(5)} ~ {t.endDate?.slice(5)} · {t.sessions.length}회
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {payStep===4&&(
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>💰 수업별 입금 금액</div>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>각 수업의 입금 금액을 입력하세요</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxHeight:'260px', overflowY:'auto' }}>
                      {(payForm.classIds&&payForm.classIds.length>0 ? payForm.classIds : [payForm.classId]).filter(Boolean).map((cid,idx)=>{
                        const cls = groupedForPay.find(c=>c.id===cid)
                        const f = feeMap[cid]
                        const terms2 = cls ? getTerms(cls) : []
                        const curTerm = (payForm.termNo ? terms2.find(t=>String(t.termNo)===String(payForm.termNo)) : null) || terms2.find(isTermCurrent)||terms2[0]
                        const termSecLines2 = cls ? cls._secEntries.filter(c2=>c2._selSection).map(c2=>{
                          const cnt = curTerm ? termRosterCount(students, c2.id, c2._selSection, curTerm) : (confirmedCount[c2.id+'::'+c2._selSection]||0)
                          const time = c2._secTime ? `${c2._secTime}${c2._secTimeEnd?' ~ '+c2._secTimeEnd:''}` : ''
                          return `${c2._selSection}반 ${cnt}명${time?' '+time:''}`
                        }) : []
                        const cnt2 = cls ? cls._secEntries.reduce((s,c2)=>{
                          const sec2 = c2._selSection
                          const cnt = curTerm ? termRosterCount(students, c2.id, sec2, curTerm) : (confirmedCount[c2.id+(sec2?'::'+sec2:'')]||0)
                          return s+cnt
                        }, 0) : 0
                        const exp2 = (f&&curTerm) ? perSessionFee(f,curTerm,cls)*cnt2*curTerm.sessions.length : 0
                        const amtKey = `amount_${cid}`
                        const curAmt = payForm[amtKey]||''
                        return (
                          <div key={cid} style={{ padding:'12px 14px', borderRadius:'12px', border:`1px solid ${C.border}`, background:'#fafafa' }}>
                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'6px' }}>
                              {cls?.organization} · {cls?.className}
                              {curTerm && (
                                <span style={{ fontSize:'11px', fontWeight:700, color:C.blue, background:'#eff6ff', borderRadius:'4px', padding:'1px 6px', marginLeft:'6px' }}>
                                  {curTerm.label}
                                </span>
                              )}
                            </div>
                            {termSecLines2.length > 0 && (
                              <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', display:'flex', flexDirection:'column', gap:'1px' }}>
                                {termSecLines2.map((line,li) => <div key={li}>{line}</div>)}
                                <div>총 {cnt2}명</div>
                              </div>
                            )}
                            {exp2>0&&(
                              <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>
                                예상: <strong style={{color:C.primary}}>{fmt(exp2)}원</strong>
                                <span onClick={()=>setPayForm(pf=>({...pf,[amtKey]:String(exp2)}))}
                                  style={{ marginLeft:'8px', fontSize:'11px', color:C.primary, cursor:'pointer', textDecoration:'underline' }}>그대로 입력</span>
                              </div>
                            )}
                            <input type="number" value={curAmt}
                              onChange={e=>setPayForm(pf=>({...pf,[amtKey]:e.target.value}))}
                              placeholder="금액 입력" style={{...iStyle,fontSize:'15px',fontWeight:700}} autoFocus={idx===0} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {payStep===5&&(
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>📝 특이사항 메모 (선택)</div>
                    <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>건너뛰어도 됩니다</div>
                    <input value={payForm.memo} onChange={e=>setPayForm(pf=>({...pf,memo:e.target.value}))}
                      placeholder="예: 1분기 수강료 전액, 분할납부 1회차 등" style={iStyle} autoFocus />
                    <div style={{ marginTop:'16px', padding:'12px 14px', background:'#f9fafb', borderRadius:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
                      <div style={{ fontSize:'12px', color:C.muted, display:'flex', justifyContent:'space-between' }}>
                        <span>날짜</span><span style={{color:C.text,fontWeight:600}}>{payDate.replace(/-/g,'.')}</span>
                      </div>
                      {(payForm.classIds&&payForm.classIds.length>0?payForm.classIds:[payForm.classId]).filter(Boolean).map(cid=>{
                        const cls2=groupedForPay.find(c=>c.id===cid)
                        const amt2=Number(payForm[`amount_${cid}`]||payForm.amount||0)
                        return amt2>0&&(
                          <div key={cid} style={{ fontSize:'12px', color:C.muted, display:'flex', justifyContent:'space-between' }}>
                            <span style={{maxWidth:'160px'}}>{cls2?.organization} · {cls2?.className}</span>
                            <span style={{color:C.success,fontWeight:700}}>{fmt(amt2)}원</span>
                          </div>
                        )
                      })}
                      <div style={{ fontSize:'13px', color:C.muted, display:'flex', justifyContent:'space-between', borderTop:`1px solid ${C.border}`, paddingTop:'6px', marginTop:'2px' }}>
                        <span style={{fontWeight:600}}>합계</span>
                        <span style={{color:C.success,fontWeight:700,fontSize:'15px'}}>
                          {fmt((payForm.classIds&&payForm.classIds.length>0?payForm.classIds:[payForm.classId]).filter(Boolean).reduce((s,cid)=>s+Number(payForm[`amount_${cid}`]||payForm.amount||0),0))}원
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div style={{ marginTop:'20px', display:'flex', gap:'8px' }}>
              {payStep > 1 && (
                <button onClick={goBack}
                  style={{ padding:'12px 16px', borderRadius:'12px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                  ← 이전
                </button>
              )}
              <button onClick={goNext} disabled={!canNext}
                style={{ flex:1, padding:'12px', borderRadius:'12px', border:'none', background: canNext ? (payStep===totalSteps ? C.success : C.primary) : '#e5e7eb', color: canNext ? '#fff' : C.muted, fontSize:'15px', fontWeight:700, cursor: canNext ? 'pointer' : 'not-allowed', fontFamily:'Noto Sans KR, sans-serif', transition:'all .2s' }}>
                {payStep===totalSteps ? '✅ 입금 등록 완료' : '다음 →'}
              </button>
            </div>
          </Modal>
        )
      })()}

      {/* ── 입금 내역 상세 팝업 */}
      {payDetailModal&&(
        <Modal open={!!payDetailModal} onClose={()=>setPayDetailModal(null)} title={payDetailModal.date ? `💵 입금 내역 — ${payDetailModal.date.replace(/-/g,'.')}` : `💵 전체 입금 내역 (${payDetailModal.pays.length}건)`} width={420}>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {payDetailModal.pays.length === 0
              ? <div style={{ textAlign:'center', padding:'20px', color:C.muted, fontSize:'13px' }}>입금 내역 없음</div>
              : payDetailModal.pays.map(p => {
                  const cls = classes.find(c=>c.id===p.classId)
                  return (
                    <div key={p.id} style={{ padding:'12px 14px', borderRadius:'10px', background:'#f0fdf4', border:'1px solid #86efac' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                            🏫 {cls?`${cls.organization} · ${cls.className}${((cls._selSection ? cls._selSection+'반' : (cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : ''))))?' '+((cls._selSection ? cls._selSection+'반' : (cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')))):''}`:' 수업 미상'}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                            {p.termNo&&<span style={{ fontSize:'11px', background:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px' }}>{p.termNo}텀</span>}
                            <span style={{ fontSize:'11px', color:C.muted }}>{p.date?.replace(/-/g,'.')}</span>
                            {p.memo&&<span style={{ fontSize:'11px', color:C.muted }}>· {p.memo}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0, marginLeft:'8px' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:C.success }}>+{fmt(p.amount)}원</span>
                          <button onClick={()=>confirm('삭제할까요?', ()=>{ deletePayment(p.id); setPayDetailModal(null) })}
                            style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                        </div>
                      </div>
                    </div>
                  )
                })
            }
            {payDetailModal.pays.length > 0 && (
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'13px', color:C.muted, fontWeight:600 }}>합계</span>
                <span style={{ fontSize:'16px', fontWeight:700, color:C.success }}>
                  +{fmt(payDetailModal.pays.reduce((s,p)=>s+p.amount,0))}원
                </span>
              </div>
            )}
            <button onClick={()=>{ openPayModal(payDetailModal.date); setPayDetailModal(null) }}
              style={{ padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', marginTop:'4px' }}>
              + 추가 입금 등록
            </button>
          </div>
        </Modal>
      )}

            {/* ── 미수금 상세 팝업 */}
      {unpaidDetail&&(
        <Modal open={!!unpaidDetail} onClose={()=>setUnpaidDetail(null)} title="⚠️ 미수금 상세" width={440}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ padding:'12px 16px', background:'#f9fafb', borderRadius:'10px' }}>
                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>
                  🏫 {unpaidDetail.cls.organization} · {unpaidDetail.cls.className}{unpaidDetail.cls.section?' '+unpaidDetail.cls.section:''}
                  <span style={{ marginLeft:'8px', fontSize:'12px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px' }}>{unpaidDetail.term.label}</span>
                </div>
                <div style={{ fontSize:'12px', color:C.muted }}>
                  {unpaidDetail.term.startDate?.slice(5)} ~ {unpaidDetail.term.endDate?.slice(5)} · {unpaidDetail.term.sessions.length}회
                </div>
              </div>
              {/* 인원 현황 */}
              <div style={{ display:'flex', gap:'10px' }}>
                {[
                  { label:'시작 신청', value:`${unpaidDetail.startApplied}명`, color:C.blue, bg:'#eff6ff', border:'#bfdbfe' },
                  { label:'취소', value:`${unpaidDetail.cancelled}명`, color:C.danger, bg:'#fef2f2', border:'#fca5a5' },
                  { label:'최종 확정', value:`${unpaidDetail.confirmed}명`, color:C.success, bg:'#f0fdf4', border:'#86efac' },
                ].map(s=>(
                  <div key={s.label} style={{ flex:1, padding:'10px', borderRadius:'9px', background:s.bg, border:`1px solid ${s.border}`, textAlign:'center' }}>
                    <div style={{ fontSize:'18px', fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* 수강료 현황 */}
              <div style={{ display:'flex', gap:'10px' }}>
                {[
                  { label:'예상 수강료', value:fmt(unpaidDetail.expected)+'원', color:C.text, bg:'#f9fafb', border:C.border },
                  { label:'입금', value:fmt(unpaidDetail.paid)+'원', color:C.success, bg:'#f0fdf4', border:'#86efac' },
                  { label:'미수금', value:fmt(unpaidDetail.unpaid)+'원', color:C.danger, bg:'#fef2f2', border:'#fca5a5' },
                ].map(s=>(
                  <div key={s.label} style={{ flex:1, padding:'10px', borderRadius:'9px', background:s.bg, border:`1px solid ${s.border}`, textAlign:'center' }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={()=>{ openPayModal(today(), unpaidDetail.cls.id, unpaidDetail.term.termNo, true); setUnpaidDetail(null) }}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  입금 등록
                </button>
                <button onClick={()=>setUnpaidDetail(null)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>닫기</button>
              </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
