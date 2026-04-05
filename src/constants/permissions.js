import { Settings } from '../lib/db.js'

// 기능 키 목록
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
  [FEATURES.MANAGE_TEMPLATE]:  { label: '출석부 양식', icon: '📄' },
  [FEATURES.SHOP_DISCOUNT]:    { label: '쇼핑몰 할인 혜택', icon: '🛒' },
  [FEATURES.SHOP_EXTRA]:       { label: '쇼핑몰 추가 혜택', icon: '🎁' },
}

// 레벨 이름
export const LEVEL_NAMES = {
  1: '미인증 선생님',
  2: '인증 선생님',
  3: '우수 선생님',
  4: '파트너 선생님',
  5: '관리자',
}

// 하위 호환용 — Admin.jsx에서 사용 중
export const LEVEL_PERMISSIONS = {
  1: { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:false, approve_teacher:false, manage_ad:false, manage_level:false },
  2: { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:false, approve_teacher:false, manage_ad:false, manage_level:false },
  3: { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:false, approve_teacher:false, manage_ad:false, manage_level:false },
  5: { manage_class:true, add_student:true, excel_upload:true, attendance:true, view_report:true, print_attendance:true, manage_template:true, shop_discount:true, shop_extra:true, view_all_data:true, approve_teacher:true, manage_ad:true, manage_level:true },
}


const DEFAULT_MIN_LEVELS = {
  [FEATURES.ATTENDANCE]:       1,
  [FEATURES.MANAGE_CLASS]:     1,
  [FEATURES.ADD_STUDENT]:      1,
  [FEATURES.EXCEL_UPLOAD]:     1,
  [FEATURES.VIEW_REPORT]:      1,
  [FEATURES.PRINT_ATTENDANCE]: 1,
  [FEATURES.MANAGE_TEMPLATE]:  1,
  [FEATURES.SHOP_DISCOUNT]:    1,
  [FEATURES.SHOP_EXTRA]:       1,
  [FEATURES.VIEW_ALL_DATA]:    5,
  [FEATURES.APPROVE_TEACHER]:  5,
  [FEATURES.MANAGE_AD]:        5,
  [FEATURES.MANAGE_LEVEL]:     5,
}

// 권한 체크 함수
export function can(user, feature) {
  if (!user) return false

  // 관리자(role=admin)는 무조건 허용
  if (user.role === 'admin') return true

  const level = user.level || 1

  // 개별 오버라이드 (기존 호환)
  const overrides = user.permissionOverrides || {}
  if (feature in overrides) return overrides[feature]

  // Settings에서 최소 레벨 읽기
  const stored = Settings.get('featureMinLevels') || {}
  const minLevel = stored[feature] ?? DEFAULT_MIN_LEVELS[feature] ?? 1

  return level >= minLevel
}
