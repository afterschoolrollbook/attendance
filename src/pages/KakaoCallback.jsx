import React, { useEffect } from 'react'

// 카카오 로그인 콜백 페이지 (팝업으로 열림)
// code만 부모창으로 전달하고 닫힘 — 토큰 교환은 부모창(Auth.jsx)에서 처리
export function KakaoCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error || !code) {
      window.opener?.postMessage(
        { type: 'kakao_login_fail', error: error || 'no_code' },
        window.location.origin
      )
    } else {
      window.opener?.postMessage(
        { type: 'kakao_callback', code, state },
        window.location.origin
      )
    }
    window.close()
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', background:'#fff' }}>
      <div style={{ fontSize:'32px' }}>💛</div>
      <div style={{ fontSize:'14px', color:'#6b7280' }}>카카오 로그인 처리 중...</div>
    </div>
  )
}
