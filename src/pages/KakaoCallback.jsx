import React, { useEffect } from 'react'

// 카카오 로그인 콜백 페이지 (팝업으로 열림)
export function KakaoCallback() {
  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code   = params.get('code')
        const error  = params.get('error')

        if (error) {
          window.opener?.postMessage({ type:'kakao_login_fail', error }, window.location.origin)
          window.close(); return
        }
        if (!code) {
          window.opener?.postMessage({ type:'kakao_login_fail', error:'no_code' }, window.location.origin)
          window.close(); return
        }

        // 팝업 열기 전에 임시 저장한 clientId 읽기
        const clientId = localStorage.getItem('asa_kakao_client_id') || ''
        localStorage.removeItem('asa_kakao_client_id')

        if (!clientId) {
          window.opener?.postMessage({ type:'kakao_login_fail', error:'카카오 REST API 키가 없습니다. 관리자 설정을 확인하세요.' }, window.location.origin)
          window.close(); return
        }

        const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
        const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        const redirectUri   = window.location.origin + '/kakao-callback'

        const res = await fetch(`${SUPABASE_URL}/functions/v1/kakao-oauth`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON}`,
          },
          body: JSON.stringify({ code, clientId, redirectUri }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || '카카오 로그인 실패')

        window.opener?.postMessage({
          type:   'kakao_login_success',
          email:  data.data.email  || '',
          name:   data.data.name   || '',
          avatar: data.data.profile_image || '',
          id:     data.data.id,
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
