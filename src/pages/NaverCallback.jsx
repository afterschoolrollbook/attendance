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

      console.log('[NAVER CALLBACK DEBUG] URL:', window.location.href)
      console.log('[NAVER CALLBACK DEBUG] params:', { code: code ? code.slice(0,10)+'...' : null, state, error })

      // window.opener는 cross-origin 리디렉트 후 null이 될 수 있으므로
      // window.name으로 팝업 여부를 판단 (loginWithNaver에서 'naverLogin'으로 지정)
      const isPopup = window.name === 'naverLogin'
      console.log('[NAVER CALLBACK DEBUG] window.name:', window.name, '→ isPopup:', isPopup)
      console.log('[NAVER CALLBACK DEBUG] window.opener:', window.opener ? '있음' : 'null')
      console.log('[NAVER CALLBACK DEBUG] window.location.origin:', window.location.origin)

      try {
        if (error || !code || !state) {
          console.error('[NAVER CALLBACK DEBUG] 파라미터 오류:', { error, hasCode: !!code, hasState: !!state })
          const msg = { type: 'naver_login_fail', error: error || 'missing_params' }
          if (isPopup && window.opener) {
            console.log('[NAVER CALLBACK DEBUG] 팝업 방식 → 실패 postMessage 전송 후 닫기')
            window.opener.postMessage(msg, window.location.origin)
            window.close()
          } else {
            console.log('[NAVER CALLBACK DEBUG] 리디렉트 방식 → sessionStorage 저장 후 이동')
            sessionStorage.setItem('naver_login_result', JSON.stringify(msg))
            window.location.href = '/?naver_redirect=1'
          }
          return
        }

        console.log('[NAVER CALLBACK DEBUG] naverOAuth Edge Function 호출 시작...')
        const data = await naverOAuth(code, state)
        console.log('[NAVER CALLBACK DEBUG] naverOAuth 성공:', {
          email: data.email, name: data.name,
          hasSession: !!data.session, providerId: data.providerId
        })

        const msg = {
          type: 'naver_login_success',
          email: data.email || '', name: data.name || '',
          avatar: data.avatar || '', id: data.providerId,
          session: data.session || null,
        }
        if (isPopup && window.opener) {
          console.log('[NAVER CALLBACK DEBUG] 팝업 방식 → 성공 postMessage 전송 후 닫기')
          console.log('[NAVER CALLBACK DEBUG] postMessage target origin:', window.location.origin)
          window.opener.postMessage(msg, window.location.origin)
          window.close()
        } else {
          console.log('[NAVER CALLBACK DEBUG] 리디렉트 방식 → sessionStorage 저장 후 이동')
          sessionStorage.setItem('naver_login_result', JSON.stringify(msg))
          window.location.href = '/?naver_redirect=1'
        }

      } catch (e) {
        console.error('[NAVER CALLBACK DEBUG] 예외 발생:', e.message, e)
        const msg = { type: 'naver_login_fail', error: e.message }
        if (isPopup && window.opener) {
          console.log('[NAVER CALLBACK DEBUG] 팝업 방식 → 예외 postMessage 전송 후 닫기')
          window.opener.postMessage(msg, window.location.origin)
          window.close()
        } else {
          sessionStorage.setItem('naver_login_result', JSON.stringify(msg))
          window.location.href = '/?naver_redirect=1'
        }
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
