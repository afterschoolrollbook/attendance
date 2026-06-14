import { Settings } from '../lib/db.js'

// 사이드바 메뉴 키 목록 (feature 기반 → menuKey 기반으로 통합)
export const FEATURES = {
  MANAGE_CLASS:      'manage_class',
  ADD_STUDENT:       'add_student',
  EXCEL_UPLOAD:      'excel_upload',
  ATTENDANCE:        'attendance',
  VIEW_REPORT:       'view_report',
  PRINT_ATTENDANCE:  'print_attendance',
  MANAGE_TEMPLATE:   'manage_template',
  SHOP_DISCOUNT:     'shop_discount',
  SHOP_EXTRA:        'shop_extra',
  VIEW_ALL_DATA:     'view_all_data',
  APPROVE_TEACHER:   'approve_teacher',
  MANAGE_AD:         'manage_ad',
  MANAGE_LEVEL:      'manage_level',
}

// 기능별 한글명 (관리자 UI용)
export const FEATURE_LABELS = {
  [FEATURES.ATTENDANCE]:       { label: '출석부', icon: '✅' },
  [FEATURES.MANAGE_CLASS]:     { label: '수업 등록 및 관리', icon: '📚' },
  [FEATURES.ADD_STUDENT]:      { label: '학생 등록 및 관리', icon: '👥' },
  [FEATURES.EXCEL_UPLOAD]:     { label: '엑셀 업로드 (학생)', icon: '📊' },
  [FEATURES.VIEW_REPORT]:      { label: '출석 리포트', icon: '📊' },
  [FEATURES.PRINT_ATTENDANCE]: { label: '출석부 출력', icon: '🖨️' },
  [FEATURES.MANAGE_TEMPLATE]:  { label: '방과후 서류', icon: '🗂️' },
  [FEATURES.SHOP_DISCOUNT]:    { label: '쇼핑몰 할인 혜택', icon: '🛒' },
  [FEATURES.SHOP_EXTRA]:       { label: '쇼핑몰 추가 혜택', icon: '🎁' },
}

// 사이드바 메뉴 전체 목록 (menuKey → 표시용 정보)
export const MENU_ITEMS = [
  { menuKey: 'dashboard',      label: '대시보드',        icon: '🏠' },
  { menuKey: 'attendance',     label: '출석부',           icon: '✅' },
  { menuKey: 'classes',        label: '수업등록 및 관리', icon: '📚' },
  { menuKey: 'students',       label: '학생등록 및 관리', icon: '👥' },
  { menuKey: 'confirm',        label: '인원확정 및 추첨', icon: '🎲' },
  { menuKey: 'reports',        label: '출석 리포트',      icon: '📊' },
  { menuKey: 'templates',      label: '방과후 서류',      icon: '🗂️' },
  { menuKey: 'printsetup',     label: '출석부 출력',      icon: '🖨️' },
  { menuKey: 'parent-service', label: '출결 서비스 관리', icon: '📲' },
  { menuKey: 'supplies',       label: '교구준비 및 관리', icon: '🎒' },
  { menuKey: 'messageguide',   label: '안내 문구 관리',   icon: '💬' },
  { menuKey: 'profile',        label: '내 정보',          icon: '👤' },
  { menuKey: 'revenue',        label: '수익관리',          icon: '💰' },
  { menuKey: 'training',       label: '연수관리',          icon: '🎓' },
  { menuKey: 'certificates',   label: '자격증관리',        icon: '🏆' },
  { menuKey: 'career',         label: '학력 및 이력관리',  icon: '📋' },
  { menuKey: 'awards',         label: '수상경력',          icon: '🏅' },
  { menuKey: 'proposals',      label: '제안서·자기소개서', icon: '📝' },
  { menuKey: 'jobs',           label: '공고관리',          icon: '📢' },
]

// 레벨 1~10 기본 이름 (관리자가 Settings에서 변경 가능)
export const DEFAULT_LEVEL_NAMES = {
  1:  '미인증 선생님',
  2:  '인증 선생님',
  3:  '레벨3',
  4:  '레벨4',
  5:  '레벨5',
  6:  '레벨6',
  7:  '레벨7',
  8:  '레벨8',
  9:  '레벨9',
  10: '관리자',
}

// 레벨 색상 (1~10)
export const LEVEL_COLORS = {
  1:  '#9ca3af',
  2:  '#f97316',
  3:  '#eab308',
  4:  '#16a34a',
  5:  '#06b6d4',
  6:  '#3b82f6',
  7:  '#8b5cf6',
  8:  '#ec4899',
  9:  '#ef4444',
  10: '#dc2626',
}

// 하위 호환용 (Admin.jsx에서 사용 중)
export const LEVEL_NAMES = DEFAULT_LEVEL_NAMES

export const LEVEL_PERMISSIONS = {
  1:  { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:false, approve_teacher:false, manage_ad:false, manage_level:false },
  2:  { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:false, approve_teacher:false, manage_ad:false, manage_level:false },
  10: { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:true,  approve_teacher:true,  manage_ad:true,  manage_level:true  },
}

// 메뉴별 기본 최소레벨 (관리자가 Settings에서 변경 가능)
export const DEFAULT_MENU_MIN_LEVELS = {
  dashboard:       1,
  attendance:      1,
  classes:         1,
  students:        1,
  confirm:         1,
  reports:         1,
  templates:       1,
  printsetup:      1,
  'parent-service':1,
  supplies:        1,
  messageguide:    1,
  profile:         1,
  revenue:         1,
  training:        1,
  certificates:    1,
  career:          1,
  awards:          1,
  proposals:       1,
  jobs:            1,
}

// 레벨 이름 가져오기 (Settings 우선, 없으면 기본값)
export function getLevelNames() {
  const stored = Settings.get('levelNames') || {}
  const result = {}
  for (let i = 1; i <= 10; i++) {
    result[i] = stored[i] || DEFAULT_LEVEL_NAMES[i]
  }
  return result
}

// 메뉴 최소레벨 가져오기 (Settings 우선, 없으면 기본값)
export function getMenuMinLevels() {
  const stored = Settings.get('menuMinLevels') || {}
  const result = {}
  for (const key of Object.keys(DEFAULT_MENU_MIN_LEVELS)) {
    result[key] = stored[key] ?? DEFAULT_MENU_MIN_LEVELS[key]
  }
  return result
}

// 메뉴 접근 가능 여부
export function canAccessMenu(user, menuKey) {
  if (!user) return false
  if (user.role === 'admin' || user.level >= 10) return true
  const minLevels = getMenuMinLevels()
  const minLevel = minLevels[menuKey] ?? 1
  return (user.level || 1) >= minLevel
}

// feature 기반 권한 체크 — 관리자 전용 기능(approve_teacher, manage_ad, manage_level)에만 사용
export function can(user, feature) {
  if (!user) return false
  if (user.role === 'admin' || user.level >= 10) return true
  const level = user.level || 1
  const overrides = user.permissionOverrides || {}
  if (feature in overrides) return overrides[feature]
  const DEFAULT_MIN = {
    view_all_data:10, approve_teacher:10, manage_ad:10, manage_level:10,
  }
  const minLevel = DEFAULT_MIN[feature] ?? 10
  return level >= minLevel
}

// 메뉴 표시 여부 (기본 true, 가리기 설정 시 false)
export function isMenuVisible(user, menuKey) {
  if (!user) return false
  if (user.role === 'admin' || (user.level || 1) >= 10) return true
  const stored = Settings.get('menuVisible') || {}
  return stored[menuKey] ?? true
}

// 메뉴 최소레벨 단독 조회
export function getMenuMinLevel(menuKey) {
  const stored = Settings.get('menuMinLevels') || {}
  return stored[menuKey] ?? DEFAULT_MENU_MIN_LEVELS[menuKey] ?? 1
}
