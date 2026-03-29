import React, { useEffect, useState } from 'react'

export function KakaoCallback() {
  const [status, setStatus] = useState('카카오 로그인 처리 중...')
  const [log, setLog] = useState([])

  const addLog = (msg) => {
    console.log('[KakaoCallback]', msg)
    setLog(prev => [...prev, msg])
  }

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code  = params.get('code')
        const state = params.get('state')
        const error = params.get('error')

        addLog(`code: ${code ? code.substring(0,10)+'...' : 'null'}`)
        addLog(`state: ${state ? state.substring(0,20)+'...' : 'null'}`)
        addLog(`error: ${error}`)
        addLog(`opener: ${window.opener ? 'exists' : 'null'}`)

        if (error || !code) {
          addLog('에러 또는 코드 없음')
          window.opener?.postMessage({ type: 'kakao_login_fail', error: error || 'no_code' }, '*')
          return
        }

        let clientId = ''
        try {
          const stateObj = JSON.parse(decodeURIComponent(state || '{}'))
          clientId = stateObj.clientId || ''
          addLog(`clientId from state: ${clientId ? clientId.substring(0,8)+'...' : 'empty'}`)
        } catch(e) {
          addLog(`state parse error: ${e.message}`)
        }

        if (!clientId) {
          clientId = localStorage.getItem('asa_kakao_client_id') || ''
          addLog(`clientId from localStorage: ${clientId ? clientId.substring(0,8)+'...' : 'empty'}`)
        }

        if (!clientId) {
          addLog('clientId 없음!')
          window.opener?.postMessage({ type: 'kakao_login_fail', error: '카카오 REST API 키가 없습니다.' }, '*')
          return
        }

        const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
        const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        addLog(`supabase url: ${SUPABASE_URL ? SUPABASE_URL.substring(0,20)+'...' : 'empty'}`)

        setStatus('카카오 인증 처리 중...')
        const redirectUri = window.location.origin + '/kakao-callback'

        const res = await fetch(`${SUPABASE_URL}/functions/v1/kakao-oauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
          body: JSON.stringify({ code, clientId, redirectUri }),
        })
        const data = await res.json()
        addLog(`response: ${JSON.stringify(data).substring(0,50)}`)

        if (!data.success) throw new Error(data.error || '카카오 로그인 실패')

        window.opener?.postMessage({
          type: 'kakao_login_success',
          email: data.data.email || '',
          name: data.data.name || '',
          avatar: data.data.profile_image || '',
          id: data.data.id,
        }, '*')

        addLog('성공! 창 닫는 중...')
        setTimeout(() => window.close(), 1000)

      } catch (e) {
        addLog(`에러: ${e.message}`)
        window.opener?.postMessage({ type: 'kakao_login_fail', error: e.message }, '*')
        setStatus('실패: ' + e.message)
      }
    }
    run()
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'8px', background:'#fff', padding:'20px' }}>
      <div style={{ fontSize:'32px' }}>💛</div>
      <div style={{ fontSize:'14px', color:'#6b7280' }}>{status}</div>
      <div style={{ marginTop:'16px', width:'100%', maxWidth:'400px', background:'#f9fafb', padding:'12px', borderRadius:'8px', fontSize:'11px', fontFamily:'monospace' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}
