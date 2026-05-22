import React, { useEffect } from 'react'

// 카카오 로그인 콜백 페이지
// 리디렉트 방식: code를 sessionStorage에 저장 → 메인 페이지로 이동
// 토큰 교환은 메인 페이지(Auth.jsx)에서 처리
export function KakaoCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error || !code) {
      sessionStorage.setItem('kakao_login_result', JSON.stringify({
        type: 'kakao_login_fail', error: error || 'no_code'
      }))
    } else {
      sessionStorage.setItem('kakao_login_result', JSON.stringify({
        type: 'kakao_callback', code, state
      }))
    }

    window.location.href = '/'
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', background:'#fff' }}>
      <div style={{ fontSize:'32px' }}>💛</div>
      <div style={{ fontSize:'14px', color:'#6b7280' }}>카카오 로그인 처리 중...</div>
    </div>
  )
}
