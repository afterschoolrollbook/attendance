/**
 * ParentLogin.jsx
 * 학부모 출결서비스 로그인 페이지 (/parent-login)
 *
 * 흐름:
 *  1. 전화번호 입력 (자동로그인 체크 시 localStorage 저장)
 *  2. ParentMembers.allByPhone → 가입된 선생님 반 목록 표시
 *  3. 선택 → ParentHome 진입 (ParentInvite.jsx 의 ParentHome 재사용)
 *
 * 자동로그인:
 *  - localStorage 'asa_parent_autologin' = { phone, lastTeacherId }
 *  - 접속 시 저장된 phone이 있으면 목록 바로 표시
 *  - 상단 '로그아웃' 클릭 시 저장 해제
 */
import React, { useState, useEffect } from 'react'
import { ParentMembers } from '../lib/db.js'
// ParentHome은 ParentInvite에서 내보내는 컴포넌트를 재사용
import { ParentHome } from './ParentInvite.jsx'

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', card: '#fff',
}

const LS_KEY = 'asa_parent_autologin'

function fmtPhone(p) {
  if (!p) return ''
  const n = p.replace(/[^0-9]/g, '')
  if (n.length === 11) return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`
  if (n.length === 10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`
  return p
}

function loadAuto() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}

// ── 선생님 반 카드
function TeacherCard({ member, active, onClick }) {
  const isEnded = !!member.withdrawnAt && !member.appJoined
  return (
    <button onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '16px',
        borderRadius: '14px', cursor: isEnded ? 'default' : 'pointer',
        border: `2px solid ${active ? C.primary : C.border}`,
        background: active ? '#fff7ed' : isEnded ? '#f9fafb' : C.card,
        opacity: isEnded ? 0.6 : 1,
        fontFamily: 'Noto Sans KR, sans-serif',
        transition: 'all .15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: isEnded ? C.muted : C.text }}>
          {member.teacherName || '선생님'} 선생님
        </div>
        {isEnded
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: '#f3f4f6', color: C.muted, fontWeight: 600 }}>종료됨</span>
          : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>이용중</span>
        }
      </div>
      <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.8 }}>
        {member.subjectName && <div>📚 {member.subjectName}</div>}
        {member.schoolName  && <div>🏫 {member.schoolName}</div>}
        {member.studentName && <div>👦 {member.studentName}{member.grade ? ` · ${member.grade}` : ''}</div>}
      </div>
    </button>
  )
}

// ── 전화번호 입력 화면
function PhoneInputScreen({ onSubmit }) {
  const [phone, setPhone]       = useState('')
  const [autoLogin, setAutoLogin] = useState(true)
  const [error, setError]       = useState('')

  const handleChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setPhone(v)
    setError('')
  }

  const handleSubmit = () => {
    if (phone.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return }
    onSubmit(phone, autoLogin)
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>출결서비스</div>
      <div style={{ fontSize: '14px', color: C.muted, marginBottom: '32px' }}>학부모 로그인</div>

      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '6px' }}>
            학부모 전화번호
          </label>
          <input
            type="tel"
            value={fmtPhone(phone)}
            onChange={handleChange}
            placeholder="010-0000-0000"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: '12px',
              border: `1.5px solid ${error ? '#ef4444' : C.border}`,
              fontSize: '18px', fontWeight: 700, color: C.text,
              fontFamily: 'Noto Sans KR, sans-serif', outline: 'none',
              letterSpacing: '0.05em', boxSizing: 'border-box',
            }}
          />
          {error && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{error}</div>}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoLogin} onChange={e => setAutoLogin(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: C.primary }} />
          <span style={{ fontSize: '13px', color: C.text }}>자동 로그인</span>
          <span style={{ fontSize: '11px', color: C.muted }}>(이 기기에서 자동 접속)</span>
        </label>

        <button onClick={handleSubmit}
          style={{
            padding: '15px', borderRadius: '12px', border: 'none',
            background: phone.length >= 10 ? C.primary : '#e5e7eb',
            color: phone.length >= 10 ? '#fff' : '#9ca3af',
            fontSize: '16px', fontWeight: 700,
            cursor: phone.length >= 10 ? 'pointer' : 'not-allowed',
            fontFamily: 'Noto Sans KR, sans-serif',
          }}>
          확인
        </button>

        <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center', lineHeight: 1.8, marginTop: '4px' }}>
          선생님께 초대 링크를 받으신 후<br />
          전화번호를 등록하시면 이용 가능합니다.
        </div>
      </div>
    </div>
  )
}

// ── 반 선택 화면
function TeacherSelectScreen({ phone, members, onSelect, onLogout }) {
  const [selected, setSelected] = useState(null)

  const active   = members.filter(m => m.appJoined && !m.withdrawnAt)
  const ended    = members.filter(m => !m.appJoined || m.withdrawnAt)

  if (selected) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff7ed', fontFamily: 'Noto Sans KR, sans-serif' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: '#fff7ed', borderBottom: `1px solid ${C.border}`,
          padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: C.primary, fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ‹ 목록
          </button>
          <button onClick={onLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: C.muted, fontFamily: 'Noto Sans KR, sans-serif' }}>
            로그아웃
          </button>
        </div>
        <ParentHome
          phone={phone}
          teacherId={selected.teacherId}
          memberRecord={selected}
        />
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: '36px', marginBottom: '8px' }}>👋</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: C.text, marginBottom: '2px' }}>
        안녕하세요!
      </div>
      <div style={{ fontSize: '14px', color: C.muted, marginBottom: '4px' }}>
        📱 {fmtPhone(phone)}
      </div>
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '28px' }}>
        출결서비스를 이용 중인 수업을 선택하세요
      </div>

      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {active.length === 0 && ended.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted, fontSize: '14px', lineHeight: 2 }}>
            😢 가입된 출결서비스가 없습니다.<br />
            선생님께 초대 링크를 요청해주세요.
          </div>
        )}

        {active.map(m => (
          <TeacherCard key={m.id} member={m} onClick={() => setSelected(m)} />
        ))}

        {ended.length > 0 && (
          <>
            <div style={{ fontSize: '11px', color: C.muted, fontWeight: 600, marginTop: '8px', paddingLeft: '4px' }}>
              종료된 서비스
            </div>
            {ended.map(m => (
              <TeacherCard key={m.id} member={m} active={false} onClick={() => {}} />
            ))}
          </>
        )}
      </div>

      <button onClick={onLogout}
        style={{
          marginTop: '32px', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: '13px', color: C.muted,
          fontFamily: 'Noto Sans KR, sans-serif',
        }}>
        🚪 로그아웃
      </button>
    </div>
  )
}

// ── 가입 이력 없음 화면
function NotFoundScreen({ phone, onBack }) {
  return (
    <div style={wrap}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>😢</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
        가입 이력이 없습니다
      </div>
      <div style={{ fontSize: '14px', color: C.muted, lineHeight: 1.9, textAlign: 'center', marginBottom: '28px' }}>
        <strong>{fmtPhone(phone)}</strong> 번호로<br />
        가입된 출결서비스가 없습니다.<br />
        선생님께 초대 링크를 요청해주세요.
      </div>
      <button onClick={onBack}
        style={{
          padding: '12px 32px', borderRadius: '12px', border: `1.5px solid ${C.border}`,
          background: '#fff', color: C.text, fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
        }}>
        다시 입력
      </button>
    </div>
  )
}

// ── 메인 컴포넌트
export function ParentLogin() {
  const [screen, setScreen] = useState('loading') // loading | input | select | notfound
  const [phone,   setPhone]   = useState('')
  const [members, setMembers] = useState([])

  useEffect(() => {
    const saved = loadAuto()
    if (saved?.phone) {
      const rows = ParentMembers.allByPhone(saved.phone)
      if (rows.length > 0) {
        setPhone(saved.phone)
        setMembers(rows)
        setScreen('select')
        return
      }
    }
    setScreen('input')
  }, [])

  const handleSubmit = (phone, autoLogin) => {
    const rows = ParentMembers.allByPhone(phone)
    if (rows.length === 0) {
      setPhone(phone)
      setScreen('notfound')
      return
    }
    if (autoLogin) {
      localStorage.setItem(LS_KEY, JSON.stringify({ phone, lastTeacherId: rows[0]?.teacherId || '' }))
    }
    setPhone(phone)
    setMembers(rows)
    setScreen('select')
  }

  const handleLogout = () => {
    localStorage.removeItem(LS_KEY)
    setPhone('')
    setMembers([])
    setScreen('input')
  }

  if (screen === 'loading') return (
    <div style={{ ...wrap }}>
      <div style={{ fontSize: '48px' }}>📋</div>
    </div>
  )

  if (screen === 'input')    return <PhoneInputScreen onSubmit={handleSubmit} />
  if (screen === 'notfound') return <NotFoundScreen phone={phone} onBack={() => setScreen('input')} />
  if (screen === 'select')   return <TeacherSelectScreen phone={phone} members={members} onSelect={() => {}} onLogout={handleLogout} />

  return null
}

const wrap = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '32px 20px', background: '#fff7ed',
  fontFamily: 'Noto Sans KR, sans-serif',
}
