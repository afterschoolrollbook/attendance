export const DAYS = ['월', '화', '수', '목', '금', '토', '일']
export const DAY_MAP = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 }

export const GRADES = ['1학년', '2학년', '3학년', '4학년', '5학년', '6학년']

export const TERM_TYPES = [
  { value: 'quarter', label: '분기제' },
  { value: 'semester', label: '학기제' },
]

export const REPEAT_TYPES = [
  { value: 'every',          label: '매주' },
  { value: 'biweekly',       label: '격주' },
  { value: 'monthly_first',  label: '매월 첫째 주' },
  { value: 'monthly_second', label: '매월 둘째 주' },
  { value: 'monthly_third',  label: '매월 셋째 주' },
  { value: 'monthly_fourth', label: '매월 넷째 주' },
]

export const STUDENT_STATUS = {
  applied:   { label: '신청',    color: '#6366f1', bg: '#eef2ff' },
  waiting:   { label: '대기',    color: '#8b5cf6', bg: '#f5f3ff' },  // ✅ 추가
  selected:  { label: '추첨완료', color: '#f97316', bg: '#fff7ed' },
  confirmed: { label: '최종확정', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: '취소',    color: '#ef4444', bg: '#fef2f2' },
}

export const ATTENDANCE_STATUS = {
  pending:  { label: '미처리', color: '#9ca3af', bg: '#f9fafb', emoji: '—' },
  present:  { label: '출석',   color: '#16a34a', bg: '#f0fdf4', emoji: '✅' },
  absent:   { label: '결석',   color: '#ef4444', bg: '#fef2f2', emoji: '❌' },
  late:     { label: '지각',   color: '#f59e0b', bg: '#fffbeb', emoji: '🕐' },
  early:    { label: '조퇴',   color: '#8b5cf6', bg: '#f5f3ff', emoji: '🔜' },
}

export const CANCEL_REASONS = [
  { value: 'public_holiday', label: '공휴일' },
  { value: 'school_holiday', label: '학교재량휴일' },
  { value: 'teacher_absent', label: '강사 사정' },
  { value: 'etc', label: '기타' },
]

export const COLORS = {
  primary: '#f97316',
  primaryHover: '#ea6c0a',
  success: '#16a34a',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  sidebar: '#18181b',
  sidebarText: '#a1a1aa',
  sidebarActive: '#f97316',
  bg: '#f4f5f7',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
}

export const AD_SLOTS = [
  { id: 'dashboard_top',  name: '대시보드 상단',  position: 'dashboard_top',  w: '100%', h: 90 },
  { id: 'student_mid',    name: '학생관리 상단',   position: 'student_mid',    w: '100%', h: 90 },
  { id: 'sidebar_bottom', name: '사이드바 하단',   position: 'sidebar_bottom', w: 224,    h: 120 },
  { id: 'report_bottom',  name: '리포트 하단',     position: 'report_bottom',  w: '100%', h: 90 },
]

export const ABSENT_REASONS = [
  { value: '',           label: '사유 없음' },
  { value: 'sick',       label: '병가' },
  { value: 'field_trip', label: '체험학습' },
  { value: 'event',      label: '학교행사' },
  { value: 'family',     label: '가족사정' },
  { value: 'etc',        label: '기타' },
]

export const HOME_RETURN_TYPES = [
  { value: '',          label: '미지정' },
  { value: 'alone',     label: '혼자 귀가' },
  { value: 'parent',    label: '보호자 동행' },
  { value: 'bus',       label: '학교버스' },
  { value: 'aftercare', label: '방과후돌봄' },
  { value: 'etc',       label: '기타' },
]
