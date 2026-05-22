import React, { useEffect } from 'react'
import { naverOAuth } from '../lib/supabase.js'

// 네이버 로그인 콜백 페이지
// 팝업 방식: postMessage 후 닫힘
// 리디렉트 방식: sessionStorage 저장 후 /?naver_redirect=1 로 이동
export function NaverCallback() {
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const code  = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const isPopup = !!window.opener

      try {
        if (error || !code || !state) {
          const msg = { type: 'naver_login_fail', error: error || 'missing_params' }
          if (isPopup) { window.opener.postMessage(msg, window.location.origin); window.close() }
          else { sessionStorage.setItem('naver_login_result', JSON.stringify(msg)); window.location.href = '/?naver_redirect=1' }
          return
        }

        const data = await naverOAuth(code, state)
        const msg = {
          type: 'naver_login_success',
          email: data.email || '', name: data.name || '',
          avatar: data.avatar || '', id: data.providerId,
          session: data.session || null,
        }
        if (isPopup) { window.opener.postMessage(msg, window.location.origin); window.close() }
        else { sessionStorage.setItem('naver_login_result', JSON.stringify(msg)); window.location.href = '/?naver_redirect=1' }

      } catch (e) {
        const msg = { type: 'naver_login_fail', error: e.message }
        if (isPopup) { window.opener?.postMessage(msg, window.location.origin); window.close() }
        else { sessionStorage.setItem('naver_login_result', JSON.stringify(msg)); window.location.href = '/?naver_redirect=1' }
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
