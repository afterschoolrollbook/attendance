import { DAY_MAP } from '../constants/config.js'

// UID 생성
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// 오늘 날짜 (YYYY-MM-DD) — 로컬 시간 기준
export function today() {
  const d = new Date()
  return localDateStr(d)
}

// 로컬 날짜 문자열 (YYYY-MM-DD) - toISOString은 UTC 변환으로 날짜가 밀리므로 사용 금지
export function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// 현재 시각 ISO
export function now() {
  return new Date().toISOString()
}

// 날짜 포맷 (YYYY-MM-DD → M월 D일)
export function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

// 날짜 포맷 (YYYY-MM-DD → YYYY년 M월 D일)
export function fmtDateFull(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// 요일 반환 (0=일, 1=월, ..., 6=토)
export function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay()
}

export function getDayLabel(dateStr) {
  const labels = ['일', '월', '화', '수', '목', '금', '토']
  return labels[getDayOfWeek(dateStr)]
}

// 단일 기간 수업일 계산 (내부 헬퍼)
function _calcDatesForRange(startDate, endDate, days, cancelledSet, repeatType = 'every') {
  if (!startDate || !endDate || !days.length) return []
  const result = []
  const cur = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const targetDays = days.map(d => DAY_MAP[d])
  const startTime = new Date(startDate + 'T00:00:00').getTime()

  while (cur <= end) {
    const dow = cur.getDay()
    const dateStr = localDateStr(cur)
    if (targetDays.includes(dow)) {
      let include = false
      if (repeatType === 'every') {
        include = true
      } else if (repeatType === 'biweekly') {
        const weekDiff = Math.floor((cur.getTime() - startTime) / (7 * 24 * 60 * 60 * 1000))
        include = weekDiff % 2 === 0
      } else if (repeatType === 'monthly_first')  { include = getNthWeekday(cur) === 1 }
      else if (repeatType === 'monthly_second')   { include = getNthWeekday(cur) === 2 }
      else if (repeatType === 'monthly_third')    { include = getNthWeekday(cur) === 3 }
      else if (repeatType === 'monthly_fourth')   { include = getNthWeekday(cur) === 4 }
      if (include && !cancelledSet.has(dateStr)) result.push(dateStr)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// 수업일 목록 계산
// periods 배열이 있으면 학기/분기별 기간을 합산, 없으면 기존 startDate~endDate 방식
export function calcSessionDates(cls) {
  const { days = [], cancelledDates = [], repeatType = 'every' } = cls
  const cancelled = new Set(cancelledDates.map(c => c.date))
  let result = []

  if (cls.periods?.length > 0) {
    // 신규: periods 배열 방식 (학기/분기별 기간 각각)
    cls.periods.forEach(p => {
      if (!p.startDate || !p.endDate) return
      const dates = _calcDatesForRange(p.startDate, p.endDate, days, cancelled, repeatType)
      dates.forEach(d => { if (!result.includes(d)) result.push(d) })
    })
  } else {
    // 기존: startDate~endDate 단일 기간 (하위 호환)
    const { startDate, endDate } = cls
    if (!startDate || !endDate || !days.length) return []
    result = _calcDatesForRange(startDate, endDate, days, cancelled, repeatType)
  }

  // 보강일 추가
  const makeupSet = (cls.makeupDates || []).map(m => m.date)
  makeupSet.forEach(d => {
    if (d && !cancelled.has(d) && !result.includes(d)) result.push(d)
  })

  return result.sort()
}

// 해당 날짜가 그 달의 몇 번째 같은 요일인지 반환
function getNthWeekday(date) {
  return Math.ceil(date.getDate() / 7)
}

// 특정 날짜의 차시 번호
export function getSession(cls, date) {
  // periods 방식: 해당 날짜가 속한 분기/학기 내에서만 순번 계산
  if (cls.periods?.length > 0) {
    const period = cls.periods.find(p =>
      p.startDate && p.endDate && date >= p.startDate && date <= p.endDate
    )
    if (!period) return null
    const periodDates = calcSessionDates({ ...cls, periods: [period] })
    const cancelled = new Set((cls.cancelledDates || []).map(c => c.date))
    let idx = 0
    for (const d of periodDates) {
      if (cancelled.has(d)) continue
      idx++
      if (d === date) return idx
    }
    return null
  }
  // 기존 방식
  const dates = calcSessionDates(cls)
  const cancelled = new Set((cls.cancelledDates || []).map(c => c.date))
  let idx = 0
  for (const d of dates) {
    if (cancelled.has(d)) continue
    idx++
    if (d === date) return idx
  }
  return null
}

// 특정 날짜의 상세 차시 정보 { total, termNum, termSess }
export function getSessionInfo(cls, date) {
  const sessions = calcSessionDates(cls)
  const cancelled = new Set((cls.cancelledDates || []).map(c => c.date))

  // periods 방식: 날짜가 속한 분기를 먼저 찾고, 그 분기 안에서만 계산
  if (cls.periods?.length > 0) {
    // 날짜가 속한 분기 찾기
    const periodIdx = cls.periods.findIndex(p =>
      p.startDate && p.endDate && date >= p.startDate && date <= p.endDate
    )
    if (periodIdx < 0) return null

    // 해당 분기의 수업 날짜만 계산
    const period = cls.periods[periodIdx]
    const periodSessions = calcSessionDates({ ...cls, periods: [period] })
    const periodTermSizes = (period.termSizes?.length > 0)
      ? period.termSizes.slice(0, period.termCount || period.termSizes.length).map(n => Number(n) || 4)
      : Array(Number(period.termCount) || 1).fill(4)

    // total: 해당 분기 내 차시 순번 (1부터 시작)
    // termNum, termSess: 분기 내 텀 번호와 텀 내 차시
    let totalIdx = 1, cursor = 0
    for (let ti = 0; ti < periodTermSizes.length; ti++) {
      const size = periodTermSizes[ti]
      let termIdx = 1
      const slice = periodSessions.slice(cursor, cursor + size)
      for (const d of slice) {
        if (!cancelled.has(d)) {
          if (d === date) return { total: totalIdx, termNum: ti + 1, termSess: termIdx }
          totalIdx++; termIdx++
        }
      }
      cursor += size
    }
    return null
  }

  // 기존 방식 (periods 없음)
  const termSizes = (cls.termSizes?.length > 0)
    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
    : [cls.termSize ? Number(cls.termSize) : 4]

  let totalIdx = 1, cursor = 0
  for (let ti = 0; ti < termSizes.length; ti++) {
    const size = termSizes[ti]
    let termIdx = 1
    const slice = sessions.slice(cursor, cursor + size)
    for (const d of slice) {
      if (!cancelled.has(d)) {
        if (d === date) return { total: totalIdx, termNum: ti + 1, termSess: termIdx }
        totalIdx++; termIdx++
      }
    }
    cursor += size
  }
  return null
}

// 출석률 계산
export function calcRate(records) {
  if (!records.length) return 0
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length
  return Math.round((present / records.length) * 100)
}

// 폰 번호 포맷 정리
export function fmtPhone(phone) {
  if (!phone) return ''
  return phone.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
}

// 학년 → 나이 추정
export function gradeToAge(grade) {
  const num = parseInt(grade)
  return isNaN(num) ? '?' : 6 + num
}

// 이번 달 첫날/마지막날
export function thisMonthRange() {
  const d = new Date()
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { first, last: last.toISOString().slice(0, 10) }
}

// 날짜 범위 배열
export function dateRange(start, end) {
  const result = []
  const cur = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  while (cur <= endD) {
    result.push(localDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// 상대 날짜 텍스트
export function relativeDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((d - new Date(today() + 'T00:00:00')) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  if (diff > 0) return `${diff}일 후`
  return `${-diff}일 전`
}

// ─── 수업 정렬: 시작시간 빠른 순 → 같으면 반(section) 순 → 수업명 순
export function sortClasses(classes) {
  return [...classes].sort((a, b) => {
    const ta = (a.time || '99:99').split('~')[0].trim()
    const tb = (b.time || '99:99').split('~')[0].trim()
    if (ta !== tb) return ta.localeCompare(tb)
    const sa = (a.section || '').localeCompare(b.section || '')
    if (sa !== 0) return sa
    return (a.className || '').localeCompare(b.className || '', 'ko')
  })
}
