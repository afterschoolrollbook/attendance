import React, { useState, useRef } from 'react'
import { Users } from '../lib/db.js'
import { now } from '../lib/utils.js'
import { Btn, Input, Card, PageHeader, Divider } from '../components/Atoms.jsx'

export function Profile({ user, onUserUpdate }) {
  const [info, setInfo] = useState({ name: user.name, email: user.email, phone: user.phone || '' })
  const [pw, setPw] = useState({ cur: '', next: '', next2: '' })
  const [imgFile, setImgFile] = useState(null)
  const [imgPreview, setImgPreview] = useState(user.verifyImg || null)
  const [saveMsg, setSaveMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [verifyMsg, setVerifyMsg] = useState('')
  const imgRef = useRef()

  const flash = (setter, msg, ok = true) => {
    setter({ msg, ok })
    setTimeout(() => setter(''), 3000)
  }

  const saveInfo = () => {
    if (!info.name.trim() || !info.email.trim()) { flash(setSaveMsg, '이름과 이메일은 필수입니다.', false); return }
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailReg.test(info.email.trim())) { flash(setSaveMsg, '올바른 이메일 형식이 아닙니다.', false); return }
    // 다른 사용자가 같은 이메일 사용 중인지 확인
    const dup = Users.findByEmail(info.email.trim().toLowerCase())
    if (dup && dup.id !== user.id) { flash(setSaveMsg, '이미 사용 중인 이메일입니다.', false); return }
    const updated = Users.update(user.id, { name: info.name.trim(), email: info.email.trim().toLowerCase(), phone: info.phone.trim() })
    onUserUpdate(updated)
    flash(setSaveMsg, '정보가 저장되었습니다.')
  }

  const savePw = () => {
    if (pw.cur !== user.pw) { flash(setPwMsg, '현재 비밀번호가 올바르지 않습니다.', false); return }
    if (pw.next.length < 4) { flash(setPwMsg, '새 비밀번호는 4자 이상이어야 합니다.', false); return }
    if (pw.next !== pw.next2) { flash(setPwMsg, '새 비밀번호가 일치하지 않습니다.', false); return }
    const updated = Users.update(user.id, { pw: pw.next })
    onUserUpdate(updated)
    setPw({ cur: '', next: '', next2: '' })
    flash(setPwMsg, '비밀번호가 변경되었습니다.')
  }

  const handleImg = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setImgPreview(ev.target.result); setImgFile(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const submitVerify = () => {
    if (!imgFile && !imgPreview) { flash(setVerifyMsg, '수업안내장 이미지를 먼저 업로드해주세요.', false); return }
    if (user.level >= 2) { flash(setVerifyMsg, '이미 인증 완료된 계정입니다.'); return }
    const updated = Users.update(user.id, { verifyImg: imgFile || imgPreview })
    onUserUpdate(updated)
    flash(setVerifyMsg, '인증 신청이 완료되었습니다. 관리자 승인 후 활성화됩니다.')
  }

  const levelColors = { 1: '#9ca3af', 2: '#f97316', 3: '#16a34a', 4: '#8b5cf6', 5: '#ef4444' }
  const levelNames  = { 1: 'Lv.1 미인증', 2: 'Lv.2 인증완료', 3: 'Lv.3 우수', 4: 'Lv.4 파트너', 5: 'Lv.5 관리자' }

  return (
    <div style={{ padding: '28px', maxWidth: '680px' }}>
      <PageHeader title="내 정보" sub="계정 정보를 확인하고 수정합니다." />

      {/* 등급 뱃지 */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 18px', background: `${levelColors[user.level]}18`, borderRadius: '10px', border: `1.5px solid ${levelColors[user.level]}44`, marginBottom: '24px' }}>
        <span style={{ fontSize: '20px' }}>👩‍🏫</span>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{user.name}</div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: levelColors[user.level] }}>{levelNames[user.level]}</div>
        </div>
      </div>

      {/* ── 기본 정보 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>📝 기본 정보</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="이름" value={info.name} onChange={v => setInfo(p=>({...p,name:v}))} placeholder="홍길동" required />
          <Input label="이메일 (아이디)" value={info.email} onChange={v => setInfo(p=>({...p,email:v}))} placeholder="example@email.com" type="email" required />
          <Input label="연락처" value={info.phone} onChange={v => setInfo(p=>({...p,phone:v}))} placeholder="010-0000-0000" />
          <Msg data={saveMsg} />
          <Btn onClick={saveInfo} style={{ alignSelf: 'flex-end' }}>저장</Btn>
        </div>
      </Card>

      {/* ── 비밀번호 변경 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>🔒 비밀번호 변경</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="현재 비밀번호" value={pw.cur} onChange={v => setPw(p=>({...p,cur:v}))} type="password" placeholder="현재 비밀번호" />
          <Input label="새 비밀번호 (4자 이상)" value={pw.next} onChange={v => setPw(p=>({...p,next:v}))} type="password" placeholder="새 비밀번호" />
          <Input label="새 비밀번호 확인" value={pw.next2} onChange={v => setPw(p=>({...p,next2:v}))} type="password" placeholder="새 비밀번호 재입력" />
          <Msg data={pwMsg} />
          <Btn onClick={savePw} style={{ alignSelf: 'flex-end' }}>변경</Btn>
        </div>
      </Card>

      {/* ── 선생님 인증 */}
      {user.role === 'teacher' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>🏫 선생님 인증</div>
            {user.level >= 2
              ? <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>인증완료</span>
              : user.verifyImg
                ? <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: '#fffbeb', color: '#f59e0b', border: '1px solid #fde68a' }}>승인 대기중</span>
                : <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', background: '#f9fafb', color: '#9ca3af' }}>미인증</span>
            }
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, marginBottom: '16px' }}>
            방과후 수업안내장 이미지를 업로드하면 관리자 승인 후 <strong>Lv.2 인증</strong>이 완료됩니다.<br />
            인증 시 출석부 출력, 쇼핑몰 할인 등 추가 기능을 사용할 수 있습니다.
          </div>

          {/* 이미지 업로드 */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button onClick={() => imgRef.current?.click()} disabled={user.level >= 2}
              style={{ width: '120px', height: '160px', borderRadius: '10px', border: '2px dashed #e5e7eb', background: '#f9fafb', cursor: user.level >= 2 ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', overflow: 'hidden', padding: 0, position: 'relative' }}>
              {imgPreview
                ? <img src={imgPreview} alt="수업안내장" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><span style={{ fontSize: '28px' }}>+</span><span>수업안내장<br />업로드</span></>
              }
            </button>
            <input ref={imgRef} type="file" accept="image/*" onChange={handleImg} style={{ display: 'none' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.8, marginBottom: '12px' }}>
                • JPG, PNG 형식<br />
                • 해당 학교 방과후 수업안내장<br />
                • 선생님 이름이 명시된 서류
              </div>
              <Msg data={verifyMsg} />
              {user.level < 2 && (
                <Btn onClick={submitVerify} variant={user.verifyImg ? 'ghost' : 'primary'} size="sm">
                  {user.verifyImg ? '재신청' : '인증 신청'}
                </Btn>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function Msg({ data }) {
  if (!data) return null
  const ok = typeof data === 'object' ? data.ok !== false : true
  const msg = typeof data === 'object' ? data.msg : data
  return (
    <div style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '7px', background: ok ? '#f0fdf4' : '#fef2f2', color: ok ? '#16a34a' : '#ef4444', border: `1px solid ${ok ? '#86efac' : '#fca5a5'}` }}>
      {ok ? '✅' : '⚠️'} {msg}
    </div>
  )
}
