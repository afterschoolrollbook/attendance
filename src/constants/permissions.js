// 기능 키 목록
export const FEATURES = {
  MANAGE_CLASS: 'manage_class',
  ADD_STUDENT: 'add_student',
  EXCEL_UPLOAD: 'excel_upload',
  ATTENDANCE: 'attendance',
  VIEW_REPORT: 'view_report',
  PRINT_ATTENDANCE: 'print_attendance',
  MANAGE_TEMPLATE: 'manage_template',
  SHOP_DISCOUNT: 'shop_discount',
  SHOP_EXTRA: 'shop_extra',
  VIEW_ALL_DATA: 'view_all_data',
  APPROVE_TEACHER: 'approve_teacher',
  MANAGE_AD: 'manage_ad',
  MANAGE_LEVEL: 'manage_level',
}

// 등급별 기본 권한 (true = 허용, false = 차단)
export const LEVEL_PERMISSIONS = {
  1: {
    [FEATURES.MANAGE_CLASS]: true,
    [FEATURES.ADD_STUDENT]: true,
    [FEATURES.EXCEL_UPLOAD]: true,
    [FEATURES.ATTENDANCE]: true,
    [FEATURES.VIEW_REPORT]: true,
    [FEATURES.PRINT_ATTENDANCE]: false,
    [FEATURES.MANAGE_TEMPLATE]: false,
    [FEATURES.SHOP_DISCOUNT]: false,
    [FEATURES.SHOP_EXTRA]: false,
    [FEATURES.VIEW_ALL_DATA]: false,
    [FEATURES.APPROVE_TEACHER]: false,
    [FEATURES.MANAGE_AD]: false,
    [FEATURES.MANAGE_LEVEL]: false,
  },
  2: {
    [FEATURES.MANAGE_CLASS]: true,
    [FEATURES.ADD_STUDENT]: true,
    [FEATURES.EXCEL_UPLOAD]: true,
    [FEATURES.ATTENDANCE]: true,
    [FEATURES.VIEW_REPORT]: true,
    [FEATURES.PRINT_ATTENDANCE]: true,
    [FEATURES.MANAGE_TEMPLATE]: true,
    [FEATURES.SHOP_DISCOUNT]: true,
    [FEATURES.SHOP_EXTRA]: false,
    [FEATURES.VIEW_ALL_DATA]: false,
    [FEATURES.APPROVE_TEACHER]: false,
    [FEATURES.MANAGE_AD]: false,
    [FEATURES.MANAGE_LEVEL]: false,
  },
  3: {
    [FEATURES.MANAGE_CLASS]: true,
    [FEATURES.ADD_STUDENT]: true,
    [FEATURES.EXCEL_UPLOAD]: true,
    [FEATURES.ATTENDANCE]: true,
    [FEATURES.VIEW_REPORT]: true,
    [FEATURES.PRINT_ATTENDANCE]: true,
    [FEATURES.MANAGE_TEMPLATE]: true,
    [FEATURES.SHOP_DISCOUNT]: true,
    [FEATURES.SHOP_EXTRA]: true,
    [FEATURES.VIEW_ALL_DATA]: false,
    [FEATURES.APPROVE_TEACHER]: false,
    [FEATURES.MANAGE_AD]: false,
    [FEATURES.MANAGE_LEVEL]: false,
  },
  5: {
    [FEATURES.MANAGE_CLASS]: true,
    [FEATURES.ADD_STUDENT]: true,
    [FEATURES.EXCEL_UPLOAD]: true,
    [FEATURES.ATTENDANCE]: true,
    [FEATURES.VIEW_REPORT]: true,
    [FEATURES.PRINT_ATTENDANCE]: true,
    [FEATURES.MANAGE_TEMPLATE]: true,
    [FEATURES.SHOP_DISCOUNT]: true,
    [FEATURES.SHOP_EXTRA]: true,
    [FEATURES.VIEW_ALL_DATA]: true,
    [FEATURES.APPROVE_TEACHER]: true,
    [FEATURES.MANAGE_AD]: true,
    [FEATURES.MANAGE_LEVEL]: true,
  },
}

export const LEVEL_NAMES = {
  1: '미인증 선생님',
  2: '인증 선생님',
  3: '우수 선생님',
  4: '파트너 선생님',
  5: '관리자',
}

// 권한 체크 함수
export function can(user, feature) {
  if (!user) return false
  const level = user.level || 1
  const base = LEVEL_PERMISSIONS[level] || LEVEL_PERMISSIONS[1]
  const overrides = user.permissionOverrides || {}
  if (feature in overrides) return overrides[feature]
  return base[feature] ?? false
}
