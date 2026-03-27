import React, { useState } from 'react'
import { Users } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, Input } from '../components/Atoms.jsx'

export function Auth({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', pw: '', pw2: '', phone: '' })
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleLogin = () => {
    setError('')
    const user = Users.findByEmail(form.email.trim())
    if (!user || user.pw !== form.pw) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    onLogin(user)
  }

  const handleRegister = () => {
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.pw || !form.phone.trim()) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }
    if (form.pw.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.')
      return
    }
    if (form.pw !== form.pw2) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (Users.findByEmail(form.email.trim())) {
      setError('이미 사용 중인 이메일입니다.')
      return
    }
    const user = {
      id: uid(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      pw: form.pw,
      phone: form.phone.trim(),
      role: 'teacher',
      level: 1,
      verified: false,
      verifyImg: null,
      permissionOverrides: {},
      createdAt: now(),
    }
    Users.insert(user)
    onLogin(user)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fff7ed 0%, #fff 60%, #f0fdf4 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827' }}>방과후 출석부</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>방과후 강사를 위한 스마트 출석 관리</p>
        </div>

        {/* 카드 */}
        <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{
                flex: 1, padding: '16px', border: 'none', cursor: 'pointer',
                background: mode === m ? '#fff' : '#fafafa',
                fontWeight: mode === m ? 700 : 400,
                color: mode === m ? '#f97316' : '#6b7280',
                fontSize: '14px',
                fontFamily: 'Noto Sans KR, sans-serif',
                borderBottom: mode === m ? '2px solid #f97316' : '2px solid transparent',
                transition: 'all .15s',
              }}>
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <div style={{ padding: '28px 24px' }}>
            {mode === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Input label="이메일" value={form.email} onChange={v => set('email', v)} placeholder="admin@test.com" type="email" required />
                <Input label="비밀번호" value={form.pw} onChange={v => set('pw', v)} placeholder="비밀번호 입력" type="password" required />
                {error && <div style={{ fontSize: '13px', color: '#ef4444', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}
                <Btn full onClick={handleLogin}>로그인</Btn>
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
                  테스트: admin@test.com / admin1234 &nbsp;|&nbsp; teacher@test.com / 1234
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Input label="이름" value={form.name} onChange={v => set('name', v)} placeholder="홍길동" required />
                <Input label="이메일" value={form.email} onChange={v => set('email', v)} placeholder="example@email.com" type="email" required />
                <Input label="연락처" value={form.phone} onChange={v => set('phone', v)} placeholder="010-0000-0000" required />
                <Input label="비밀번호 (4자 이상)" value={form.pw} onChange={v => set('pw', v)} placeholder="비밀번호" type="password" required />
                <Input label="비밀번호 확인" value={form.pw2} onChange={v => set('pw2', v)} placeholder="비밀번호 재입력" type="password" required />
                {error && <div style={{ fontSize: '13px', color: '#ef4444', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}
                <Btn full onClick={handleRegister}>가입하기</Btn>
                <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
                  가입 후 기본 기능은 즉시 사용 가능합니다.<br />
                  인증 완료 시 추가 기능이 열립니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
