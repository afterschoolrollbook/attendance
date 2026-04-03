import React, { useEffect } from 'react'
import { naverOAuth } from '../lib/supabase.js'

// 네이버 로그인 콜백 페이지
// 팝업으로 열리고 처리 후 부모 창에 메시지 전송 후 닫힘
export function NaverCallback() {
  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code  = params.get('code')
        const state = params.get('state')
        const error = params.get('error')

        if (error) {
          window.opener?.postMessage({ type: 'naver_login_fail', error }, window.location.origin)
          window.close()
          return
        }

        if (!code || !state) {
          window.opener?.postMessage({ type: 'naver_login_fail', error: 'missing_params' }, window.location.origin)
          window.close()
          return
        }

        // Edge Function으로 토큰 교환 + 사용자 정보 조회
        const data = await naverOAuth(code, state)

        window.opener?.postMessage({
          type:       'naver_login_success',
          email:      data.email || '',
          name:       data.name  || '',
          avatar:     data.profile_image || '',
          id:         data.id,
        }, window.location.origin)
      } catch (e) {
        window.opener?.postMessage({ type: 'naver_login_fail', error: e.message }, window.location.origin)
      } finally {
        window.close()
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
