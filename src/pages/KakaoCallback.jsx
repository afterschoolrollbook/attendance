import React, { useEffect } from 'react'
import { Settings } from '../lib/db.js'

// 카카오 로그인 콜백 페이지 (팝업으로 열림)
// implicit flow: URL 해시에서 access_token 바로 추출
export function KakaoCallback() {
  useEffect(() => {
    const run = async () => {
      try {
        // response_type=token 방식: 해시에서 access_token 추출
        const hash   = new URLSearchParams(window.location.hash.slice(1))
        const params = new URLSearchParams(window.location.search)
        const token  = hash.get('access_token')
        const error  = params.get('error') || hash.get('error')

        if (error) {
          window.opener?.postMessage({ type:'kakao_login_fail', error }, window.location.origin)
          window.close(); return
        }
        if (!token) {
          window.opener?.postMessage({ type:'kakao_login_fail', error:'no_token' }, window.location.origin)
          window.close(); return
        }

        // access_token으로 사용자 정보 조회
        const res = await fetch('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()

        if (data.code < 0 || !data.id) throw new Error('Kakao user info failed')

        const acc = data.kakao_account
        window.opener?.postMessage({
          type:     'kakao_login_success',
          email:    acc?.email       || '',
          name:     acc?.profile?.nickname || '',
          avatar:   acc?.profile?.thumbnail_image_url || '',
          id:       String(data.id),
        }, window.location.origin)
      } catch (e) {
        window.opener?.postMessage({ type:'kakao_login_fail', error: e.message }, window.location.origin)
      } finally {
        window.close()
      }
    }
    run()
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', background:'#fff' }}>
      <div style={{ fontSize:'32px' }}>💛</div>
      <div style={{ fontSize:'14px', color:'#6b7280' }}>카카오 로그인 처리 중...</div>
    </div>
  )
}
