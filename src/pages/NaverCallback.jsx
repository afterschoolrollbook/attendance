import React, { useEffect } from 'react'
import { naverOAuth } from '../lib/supabase.js'

// 네이버 로그인 콜백 페이지
// 리디렉트 방식: 처리 후 sessionStorage에 결과 저장 → 메인 페이지로 이동
export function NaverCallback() {
  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code  = params.get('code')
        const state = params.get('state')
        const error = params.get('error')

        if (error || !code || !state) {
          sessionStorage.setItem('naver_login_result', JSON.stringify({
            type: 'naver_login_fail', error: error || 'missing_params'
          }))
        } else {
          // Edge Function으로 토큰 교환 + 사용자 정보 조회
          const data = await naverOAuth(code, state)
          sessionStorage.setItem('naver_login_result', JSON.stringify({
            type:    'naver_login_success',
            email:   data.email   || '',
            name:    data.name    || '',
            avatar:  data.avatar  || '',
            id:      data.providerId,
            session: data.session || null,
          }))
        }
      } catch (e) {
        sessionStorage.setItem('naver_login_result', JSON.stringify({
          type: 'naver_login_fail', error: e.message
        }))
      } finally {
        window.location.href = '/'
      }
    }
    run()
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', background:'#fff' }}>
      <div style={{ fontSize:'32px' }}>🟢</div>
      <div style={{ fontSize:'14px', color:'#6b7280' }}>네이버 로그인 처리 중...</div>
    </div>
  )
}
