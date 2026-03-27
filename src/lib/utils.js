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

// 수업일 목록 계산 (startDate ~ endDate, days 배열, cancelledDates 배열)
export function calcSessionDates(cls) {
  const { startDate, endDate, days = [], cancelledDates = [], repeatType = 'every' } = cls
  if (!startDate || !endDate || !days.length) return []

  const cancelled = new Set(cancelledDates.map(c => c.date))
  const result = []
  const cur = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const targetDays = days.map(d => DAY_MAP[d])

  // 반복 유형별 처리: every=매주, biweekly=격주, monthly_first~fourth=매월 N번째
  // 기준일: startDate 기준으로 주차 계산
  const startTime = new Date(startDate + 'T00:00:00').getTime()

  while (cur <= end) {
    const dow = cur.getDay()
    // ★ 핵심 수정: toISOString() 대신 로컬 날짜 사용 (UTC 변환 버그 방지)
    const dateStr = localDateStr(cur)

    if (targetDays.includes(dow)) {
      let include = false

      if (repeatType === 'every') {
        include = true
      } else if (repeatType === 'biweekly') {
        // 격주: startDate 기준으로 몇 번째 주인지 계산
        const weekDiff = Math.floor((cur.getTime() - startTime) / (7 * 24 * 60 * 60 * 1000))
        include = weekDiff % 2 === 0
      } else if (repeatType === 'monthly_first') {
        include = getNthWeekday(cur) === 1
      } else if (repeatType === 'monthly_second') {
        include = getNthWeekday(cur) === 2
      } else if (repeatType === 'monthly_third') {
        include = getNthWeekday(cur) === 3
      } else if (repeatType === 'monthly_fourth') {
        include = getNthWeekday(cur) === 4
      }

      if (include && !cancelled.has(dateStr)) {
        result.push(dateStr)
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// 해당 날짜가 그 달의 몇 번째 같은 요일인지 반환
function getNthWeekday(date) {
  return Math.ceil(date.getDate() / 7)
}

// 특정 날짜의 차시 번호
export function getSession(cls, date) {
  const dates = calcSessionDates(cls)
  const idx = dates.indexOf(date)
  return idx === -1 ? null : idx + 1
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
