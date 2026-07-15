// 광고 슬롯 ID → 쿠팡 배너 사이즈 매핑 (components/AdSlot.jsx가 "쿠팡" 소스를 고른 슬롯에
// 어떤 사이즈의 쿠팡 배너를 자동으로 골라 보여줄지 판단하는 데 사용한다)
//
// 방과후 출석부의 슬롯은 표준 광고 배너 규격이 아닌 것도 있어서(224×120 등),
// 매칭되는 표준 사이즈가 없는 슬롯은 매핑하지 않는다 — 그 경우 쿠팡 소스를 고르면
// 항상 "대기" 상태로 표시되며, 나중에(쿠팡관리 단계에서) 실제 배너 등록과 함께 다시 확인한다.
export const SLOT_BANNER_SIZE = {
  dashboard_top: '728x90',
  student_mid: '728x90',
  report_bottom: '728x90',
  footer: '728x90',
  landing_bottom: '728x90',
  blog_middle: '728x90',
  blog_bottom: '728x90',
  blog_left: '160x600',
  blog_right: '160x600',
  landing_left: '160x600',
  landing_right: '160x600',
  landing_middle: '728x90',
}
