/**
 * ParentLogin.jsx
 * 학부모 로그인 화면 — /parent-login
 *
 * [보안 강화 — 2단계 인증]
 * 1단계: 전화번호 입력 → parent_members 존재 확인
 * 2단계: PIN 4자리 입력 → verify_parent_pin RPC 검증
 *
 * PIN 미설정자(기존 가입자)는 최초 1회 PIN 설정 화면으로 안내합니다.
 *
 * PIN 해시는 Supabase RPC(set_parent_pin / verify_parent_pin)에서
 * pgcrypto crypt() 로 처리하므로 프론트엔드에 평문이 남지 않습니다.
 */
import React, { useState } from 'react'
import { ParentMembers } from '../lib/db.js'
import { supabase }      from '../lib/supabase.js'
import { ParentHome }    from './ParentInvite.jsx'

// ── 전화번호 포맷
function fmtPhone(p) {
  if (!p) return ''
  const n = p.replace(/[^0-9]/g, '')
  if (n.length === 11) return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`
  if (n.length === 10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`
  return p
}

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', card: '#fff', error: '#dc2626',
  errorBg: '#fef2f2',
}

// ── PIN 입력 점(dot) UI
function PinDots({ length = 4, filled = 0 }) {
  return (
    <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', margin: '20px 0' }}>
      {Array.from({ length }).map((_, i) => (
        <div key={i} style={{
          width: '18px', height: '18px', borderRadius: '50%',
          background: i < filled ? C.primary : 'transparent',
          border: `2px solid ${i < filled ? C.primary : C.border}`,
          transition: 'all .15s',
        }} />
      ))}
    </div>
  )
}

// ── 숫자 키패드
function Keypad({ onPress, onDelete, disabled }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px', maxWidth: '280px', margin: '0 auto',
    }}>
      {keys.map((k, i) => {
        if (k === '') return <div key={i} />
        const isDel = k === '⌫'
        return (
          <button
            key={k}
            disabled={disabled}
            onClick={() => isDel ? onDelete() : onPress(k)}
            style={{
              padding: '16px', borderRadius: '14px',
              border: `1.5px solid ${C.border}`,
              background: isDel ? '#f3f4f6' : C.card,
              fontSize: isDel ? '20px' : '22px',
              fontWeight: 700, color: C.text,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              fontFamily: 'Noto Sans KR, sans-serif',
              transition: 'background .1s',
            }}
            onMouseDown={e => { if (!disabled) e.currentTarget.style.background = '#f3f4f6' }}
            onMouseUp={e => { if (!disabled) e.currentTarget.style.background = isDel ? '#f3f4f6' : C.card }}
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

// ── 메인 컴포넌트
export function ParentLogin() {
  // step: 'phone' | 'pin' | 'set_pin' | 'confirm_pin' | 'done'
  const [step,        setStep]       = useState('phone')
  const [phone,       setPhone]      = useState('')
  const [candidate,   setCandidate]  = useState(null)   // 1단계 통과한 member 레코드
  const [pin,         setPin]        = useState('')
  const [pinConfirm,  setPinConfirm] = useState('')      // PIN 재입력 (set_pin 단계)
  const [error,       setError]      = useState('')
  const [loading,     setLoading]    = useState(false)
  const [member,      setMember]     = useState(null)    // 최종 인증된 member

  // ── 최종 인증 완료 → ParentHome
  if (member) {
    return (
      <ParentHome
        phone={member.phone}
        teacherId={member.teacherId}
        memberRecord={member}
      />
    )
  }

  // ── 1단계: 전화번호 확인
  const handlePhoneSubmit = () => {
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

    setCandidate(found)

    // PIN 미설정 기존 회원 → PIN 설정 안내
    if (!found.pinHash) {
      setStep('set_pin')
    } else {
      setStep('pin')
    }
  }

  // ── 2단계: PIN 검증 (Supabase RPC)
  const handlePinVerify = async (currentPin) => {
    if (currentPin.length < 4) return
    setLoading(true)
    setError('')
    try {
      const normalized = candidate.phone.replace(/[^0-9]/g, '')

      if (supabase) {
        // Supabase RPC — pgcrypto crypt() 서버 검증
        const { data, error: rpcErr } = await supabase
          .rpc('verify_parent_pin', { p_phone: normalized, p_pin: currentPin })
        if (rpcErr) throw new Error(rpcErr.message)
        if (!data || data.length === 0) {
          setError('PIN이 올바르지 않습니다.')
          setPin('')
          return
        }
        setMember({ ...candidate, ...(data[0] || {}) })
      } else {
        // Supabase 미설정(로컬 개발) — 로컬 캐시 단순 비교 (개발 전용)
        if (candidate.pinHash !== currentPin) {
          setError('PIN이 올바르지 않습니다.')
          setPin('')
          return
        }
        setMember(candidate)
      }
    } catch (e) {
      setError('인증 중 오류가 발생했습니다. 다시 시도해주세요.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // ── PIN 설정 1/2: 신규 PIN 입력
  const handlePinSet = (currentPin) => {
    if (currentPin.length < 4) return
    setPinConfirm('')
    setError('')
    setStep('confirm_pin')
  }

  // ── PIN 설정 2/2: PIN 재확인 → 저장
  const handlePinConfirm = async (confirmPin) => {
    if (confirmPin.length < 4) return
    if (confirmPin !== pin) {
      setError('PIN이 일치하지 않습니다. 다시 입력해주세요.')
      setPinConfirm('')
      setPin('')
      setStep('set_pin')
      return
    }

    setLoading(true)
    setError('')
    try {
      const normalized = candidate.phone.replace(/[^0-9]/g, '')

      if (supabase) {
        const { data, error: rpcErr } = await supabase
          .rpc('set_parent_pin', { p_phone: normalized, p_pin_hash: pin })
        if (rpcErr) throw new Error(rpcErr.message)
        if (!data) throw new Error('PIN 저장 실패')
      }
      // 로컬 캐시에도 기록 (재로그인 시 필드 인식용)
      ParentMembers.update(candidate.id, { pinHash: 'set' })
      setMember({ ...candidate, pinHash: 'set' })
    } catch (e) {
      setError('PIN 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      setPinConfirm('')
      setPin('')
      setStep('set_pin')
    } finally {
      setLoading(false)
    }
  }

  // ── 키패드 공통 핸들러
  const handleKeyPress = (digit, current, setCurrent, onComplete) => {
    if (current.length >= 4 || loading) return
    const next = current + digit
    setCurrent(next)
    if (next.length === 4) onComplete(next)
  }

  const handleKeyDelete = (current, setCurrent) => {
    if (loading) return
    setCurrent(current.slice(0, -1))
    setError('')
  }

  // ── 공통 레이아웃
  const Layout = ({ children }) => (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fff7ed', fontFamily: 'Noto Sans KR, sans-serif',
      padding: '24px 20px',
    }}>
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{ fontSize: '44px', marginBottom: '8px' }}>📋</div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>
          방과후 출석부
        </div>
        <div style={{ fontSize: '14px', color: C.muted }}>학부모 로그인</div>
      </div>

      <div style={{
        width: '100%', maxWidth: '380px',
        background: C.card, borderRadius: '20px',
        border: `1px solid ${C.border}`,
        padding: '28px 24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      }}>
        {children}
      </div>
    </div>
  )

  const ErrorBox = ({ msg }) => msg ? (
    <div style={{
      marginTop: '12px', padding: '10px 14px',
      background: C.errorBg, borderRadius: '10px',
      fontSize: '13px', color: C.error, lineHeight: 1.7,
      whiteSpace: 'pre-line', textAlign: 'center',
    }}>⚠️ {msg}</div>
  ) : null

  // ════════════════════════════════
  // STEP: phone — 전화번호 입력
  // ════════════════════════════════
  if (step === 'phone') {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
              📱 가입하신 전화번호를 입력해주세요
            </div>
            <input
              type="tel"
              value={phone}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
                setPhone(fmtPhone(raw))
                setError('')
              }}
              onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
              placeholder="010-0000-0000"
              style={{
                width: '100%', padding: '14px 16px',
                borderRadius: '12px', border: `1.5px solid ${error ? '#ef4444' : C.border}`,
                fontSize: '18px', fontWeight: 600, color: C.text,
                fontFamily: 'Noto Sans KR, sans-serif',
                outline: 'none', boxSizing: 'border-box',
                textAlign: 'center', letterSpacing: '1px',
              }}
            />
            <ErrorBox msg={error} />
          </div>

          <button
            onClick={handlePhoneSubmit}
            style={{
              padding: '15px', borderRadius: '12px', border: 'none',
              background: C.primary, color: '#fff',
              fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
            }}
          >
            다음
          </button>

          <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', lineHeight: 1.8 }}>
            가입하지 않으셨나요?<br />
            선생님께 초대 링크를 요청해주세요.
          </div>
        </div>
      </Layout>
    )
  }

  // ════════════════════════════════
  // STEP: pin — PIN 입력 (기존 회원)
  // ════════════════════════════════
  if (step === 'pin') {
    return (
      <Layout>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
            🔒 PIN을 입력해주세요
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>
            {fmtPhone(candidate?.phone)}
          </div>
        </div>

        <PinDots length={4} filled={pin.length} />
        <ErrorBox msg={error} />

        <div style={{ height: '16px' }} />

        <Keypad
          disabled={loading}
          onPress={d => handleKeyPress(d, pin, setPin, handlePinVerify)}
          onDelete={() => handleKeyDelete(pin, setPin)}
        />

        {loading && (
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: C.muted }}>
            확인 중…
          </div>
        )}

        <button
          onClick={() => { setStep('phone'); setPin(''); setError(''); setCandidate(null) }}
          style={{
            marginTop: '20px', width: '100%', padding: '10px',
            border: 'none', background: 'transparent',
            fontSize: '13px', color: C.muted, cursor: 'pointer',
          }}
        >
          ← 전화번호 다시 입력
        </button>
      </Layout>
    )
  }

  // ════════════════════════════════
  // STEP: set_pin — 신규 PIN 등록 (기존 미설정 회원)
  // ════════════════════════════════
  if (step === 'set_pin') {
    return (
      <Layout>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
            🔐 새 PIN 4자리를 설정해주세요
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px', lineHeight: 1.6 }}>
            앞으로 로그인할 때 사용할 PIN입니다.<br />
            생년월일·연속 숫자는 피해주세요.
          </div>
        </div>

        <PinDots length={4} filled={pin.length} />
        <ErrorBox msg={error} />

        <div style={{ height: '16px' }} />

        <Keypad
          disabled={loading}
          onPress={d => handleKeyPress(d, pin, setPin, handlePinSet)}
          onDelete={() => handleKeyDelete(pin, setPin)}
        />

        <button
          onClick={() => { setStep('phone'); setPin(''); setError(''); setCandidate(null) }}
          style={{
            marginTop: '20px', width: '100%', padding: '10px',
            border: 'none', background: 'transparent',
            fontSize: '13px', color: C.muted, cursor: 'pointer',
          }}
        >
          ← 뒤로
        </button>
      </Layout>
    )
  }

  // ════════════════════════════════
  // STEP: confirm_pin — PIN 재확인
  // ════════════════════════════════
  if (step === 'confirm_pin') {
    return (
      <Layout>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
            🔐 PIN을 한 번 더 입력해주세요
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>
            확인을 위해 다시 입력해주세요.
          </div>
        </div>

        <PinDots length={4} filled={pinConfirm.length} />
        <ErrorBox msg={error} />

        <div style={{ height: '16px' }} />

        <Keypad
          disabled={loading}
          onPress={d => handleKeyPress(d, pinConfirm, setPinConfirm, handlePinConfirm)}
          onDelete={() => handleKeyDelete(pinConfirm, setPinConfirm)}
        />

        {loading && (
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: C.muted }}>
            저장 중…
          </div>
        )}

        <button
          onClick={() => { setStep('set_pin'); setPin(''); setPinConfirm(''); setError('') }}
          style={{
            marginTop: '20px', width: '100%', padding: '10px',
            border: 'none', background: 'transparent',
            fontSize: '13px', color: C.muted, cursor: 'pointer',
          }}
        >
          ← PIN 다시 설정
        </button>
      </Layout>
    )
  }

  return null
}
