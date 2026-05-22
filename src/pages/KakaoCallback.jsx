import React, { useEffect } from 'react'

// 카카오 로그인 콜백 페이지
// 팝업 방식: postMessage 후 닫힘
// 리디렉트 방식: sessionStorage 저장 후 /?kakao_redirect=1 로 이동
export function KakaoCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const isPopup = !!window.opener

    if (error || !code) {
      const msg = { type: 'kakao_login_fail', error: error || 'no_code' }
      if (isPopup) { window.opener.postMessage(msg, window.location.origin); window.close() }
      else { sessionStorage.setItem('kakao_login_result', JSON.stringify(msg)); window.location.href = '/?kakao_redirect=1' }
    } else {
      const msg = { type: 'kakao_callback', code, state }
      if (isPopup) { window.opener.postMessage(msg, window.location.origin); window.close() }
      else { sessionStorage.setItem('kakao_login_result', JSON.stringify(msg)); window.location.href = '/?kakao_redirect=1' }
    }
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', background:'#fff' }}>
      <div style={{ fontSize:'32px' }}>💛</div>
      <div style={{ fontSize:'14px', color:'#6b7280' }}>카카오 로그인 처리 중...</div>
    </div>
  )
}
