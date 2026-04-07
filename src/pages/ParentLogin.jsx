/**
 * ParentLogin.jsx
 * 학부모 로그인 화면 — /parent-login
 * 전화번호 입력 → localStorage에서 ParentMember 조회 → ParentHome 진입
 */
import React, { useState } from 'react'
import { ParentMembers } from '../lib/db.js'
import { ParentHome } from './ParentInvite.jsx'

function fmtPhone(p) {
  if (!p) return ''
  const n = p.replace(/[^0-9]/g, '')
  if (n.length === 11) return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`
  if (n.length === 10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`
  return p
}

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', card: '#fff',
}

export function ParentLogin() {
  const [phone, setPhone]   = useState('')
  const [error, setError]   = useState('')
  const [member, setMember] = useState(null)

  // 이미 로그인된 상태면 홈으로 바로
  if (member) {
    return (
      <ParentHome
        phone={member.phone}
        teacherId={member.teacherId}
        memberRecord={member}
      />
    )
  }

  const handleLogin = () => {
    setError('')
    const normalized = phone.replace(/[^0-9]/g, '')
    if (normalized.length < 10) {
      setError('전화번호를 정확히 입력해주세요.')
      return
    }

    const found = (ParentMembers.all() || []).find(m =>
      m.phone?.replace(/[^0-9]/g, '') === normalized && m.appJoined && !m.withdrawnAt
    )

    if (!found) {
      setError('가입 정보를 찾을 수 없습니다.\n선생님께 초대 링크를 다시 요청해주세요.')
      return
    }

    setMember(found)
  }

  const handleInput = (e) => {
    // 숫자·하이픈만 허용, 자동 하이픈 포맷
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setPhone(fmtPhone(raw))
    setError('')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fff7ed', fontFamily: 'Noto Sans KR, sans-serif',
      padding: '24px 20px',
    }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '6px' }}>
          방과후 출석부
        </div>
        <div style={{ fontSize: '14px', color: C.muted }}>학부모 로그인</div>
      </div>

      {/* 로그인 카드 */}
      <div style={{
        width: '100%', maxWidth: '380px',
        background: C.card, borderRadius: '20px',
        border: `1px solid ${C.border}`,
        padding: '28px 24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
            📱 가입하신 전화번호를 입력해주세요
          </div>
          <input
            type="tel"
            value={phone}
            onChange={handleInput}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="010-0000-0000"
            style={{
              width: '100%', padding: '14px 16px',
              borderRadius: '12px', border: `1.5px solid ${error ? '#ef4444' : C.border}`,
              fontSize: '18px', fontWeight: 600, color: C.text,
              fontFamily: 'Noto Sans KR, sans-serif',
              outline: 'none', boxSizing: 'border-box',
              textAlign: 'center', letterSpacing: '1px',
              transition: 'border-color .15s',
            }}
          />
          {error && (
            <div style={{
              marginTop: '8px', padding: '10px 14px',
              background: '#fef2f2', borderRadius: '10px',
              fontSize: '13px', color: '#dc2626', lineHeight: 1.7,
              whiteSpace: 'pre-line',
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        <button
          onClick={handleLogin}
          style={{
            padding: '15px', borderRadius: '12px', border: 'none',
            background: C.primary, color: '#fff',
            fontSize: '16px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
            transition: 'opacity .15s',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          출결 확인하기
        </button>

        <div style={{
          fontSize: '12px', color: C.muted, textAlign: 'center', lineHeight: 1.8,
        }}>
          가입하지 않으셨나요?<br />
          선생님께 초대 링크를 요청해주세요.
        </div>
      </div>
    </div>
  )
}
