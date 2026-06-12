/**
 * SchoolNoticePopup.jsx
 * 선생님 대시보드에서 미제출 학교 공지를 팝업으로 표시
 * - 미제출 공지가 있으면 자동으로 팝업
 * - 파일 업로드 후 제출 완료 처리
 * - 전원 제출 시 담당자에게 자동 알림 (문구 생성)
 */
import React, { useState, useEffect, useCallback } from 'react'
import { dbCall, isConfigured } from '../lib/supabase.js'
import { now } from '../lib/utils.js'

const C = {
  primary:'#3b82f6', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', success:'#16a34a', danger:'#ef4444',
}

export function SchoolNoticePopup({ user, forceOpen = false }) {
  const [pendingNotices, setPendingNotices] = useState([])
  const [current, setCurrent]   = useState(null) // 현재 표시 중인 공지
  const [file, setFile]         = useState(null)
  const [fileData, setFileData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)
  const fileRef = React.useRef()

  const load = useCallback(async () => {
    if (!isConfigured || !user?.id) return
    try {
      // 이 선생님이 대상인 미제출 공지 조회
      const submits = await dbCall('getAll', 'schoolNoticeSubmits').catch(()=>[])
      const myPending = (submits||[]).filter(s =>
        s.teacherId === user.id && s.status === 'pending'
      )
      if (!myPending.length) return

      // 공지 상세 조회
      const notices = await Promise.all(
        myPending.map(s => dbCall('getOne', 'schoolNotices', { id: s.noticeId }).catch(()=>null))
      )
      const valid = notices.filter(n => n && n.status === 'active')
      setPendingNotices(valid)
      if (valid.length > 0) setCurrent(valid[0])
    } catch (e) { console.warn('[SchoolNoticePopup] 오류:', e) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // 배너 클릭 등 외부에서 강제로 팝업 열기
  useEffect(() => {
    if (forceOpen && pendingNotices.length > 0 && !current) {
      setCurrent(pendingNotices[0])
    }
  }, [forceOpen, pendingNotices, current])

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => setFileData(ev.target.result)
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!file || !fileData) { alert('제출할 파일을 선택해주세요.'); return }
    setSubmitting(true)
    try {
      // submit 레코드 업데이트
      const submits = await dbCall('getAll', 'schoolNoticeSubmits').catch(()=>[])
      const mySubmit = submits?.find(s => s.noticeId === current.id && s.teacherId === user.id)
      if (mySubmit) {
        await dbCall('update', 'schoolNoticeSubmits', {
          id: mySubmit.id,
          patch: { status:'submitted', fileUrl: fileData, fileName: file.name, submittedAt: now() }
        })
      }

      // 전원 제출 여부 체크
      const allSubmits = await dbCall('getAll', 'schoolNoticeSubmits').catch(()=>[])
      const noticeSubmits = (allSubmits||[]).filter(s => s.noticeId === current.id)
      const allDone = noticeSubmits.length > 0 && noticeSubmits.every(s =>
        s.teacherId === user.id ? true : s.status === 'submitted'
      )
      if (allDone) {
        // 담당자에게 알림 (문구만 — 실제 문자 발송은 추후 Solapi 연동)
      }

      setDone(true)
      setTimeout(() => {
        setDone(false)
        setFile(null); setFileData(null)
        const remaining = pendingNotices.filter(n => n.id !== current.id)
        setPendingNotices(remaining)
        setCurrent(remaining[0] || null)
      }, 1500)
    } catch { alert('제출 중 오류가 발생했습니다.') }
    finally { setSubmitting(false) }
  }

  const handleClose = () => setCurrent(null)

  if (!current) return null

  return (
    <>
      {/* 배경 */}
      <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.55)' }} />

      {/* 팝업 */}
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:8001, width:'90%', maxWidth:'460px',
        background:'#fff', borderRadius:'20px',
        boxShadow:'0 24px 64px rgba(0,0,0,0.25)',
        fontFamily:'Noto Sans KR, sans-serif',
        overflow:'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ background:'#1e3a5f', padding:'18px 20px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'22px' }}>🏫</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'13px', color:'#93c5fd' }}>학교 담당자 공지</div>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#fff', marginTop:'2px' }}>{current.schoolName}</div>
          </div>
          {pendingNotices.length > 1 && (
            <span style={{ fontSize:'11px', background:'#ef4444', color:'#fff', borderRadius:'999px', padding:'2px 8px', fontWeight:700 }}>
              {pendingNotices.length}건 미제출
            </span>
          )}
        </div>

        <div style={{ padding:'20px' }}>
          {done ? (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <div style={{ fontSize:'56px', marginBottom:'10px' }}>✅</div>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.success }}>제출 완료!</div>
            </div>
          ) : (
            <>
              {/* 공지 내용 */}
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'6px' }}>{current.title}</div>
                {current.dueDate && (
                  <div style={{ fontSize:'12px', color:C.danger, fontWeight:600, marginBottom:'6px' }}>⏰ 마감일: {current.dueDate}</div>
                )}
                {current.content && (
                  <div style={{ fontSize:'13px', color:C.muted, lineHeight:1.7, background:'#f8fafc', borderRadius:'10px', padding:'12px', whiteSpace:'pre-wrap' }}>
                    {current.content}
                  </div>
                )}
              </div>

              {/* 양식 다운로드 */}
              {current.attachUrl && (
                <a href={current.attachUrl} download={current.attachName}
                  style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', borderRadius:'10px', background:'#eff6ff', border:'1px solid #bfdbfe', textDecoration:'none', marginBottom:'14px' }}>
                  <span style={{ fontSize:'18px' }}>📎</span>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:600, color:C.primary }}>양식 다운로드</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>{current.attachName}</div>
                  </div>
                  <span style={{ marginLeft:'auto', fontSize:'12px', color:C.primary }}>⬇</span>
                </a>
              )}

              {/* 파일 업로드 */}
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFile} />
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>제출 파일 *</div>
                <button type="button" onClick={()=>fileRef.current?.click()}
                  style={{ width:'100%', padding:'12px', borderRadius:'10px', border:`2px dashed ${file?C.primary:C.border}`, background: file?'#eff6ff':'#f8fafc', color: file?C.primary:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight: file?600:400 }}>
                  {file ? `📄 ${file.name}` : '📎 파일을 선택해주세요'}
                </button>
              </div>

              {/* 버튼 */}
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={handleClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'14px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  나중에
                </button>
                <button onClick={handleSubmit} disabled={!file||submitting}
                  style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background: (!file||submitting)?'#e5e7eb':C.primary, color: (!file||submitting)?C.muted:'#fff', fontSize:'14px', fontWeight:700, cursor: (!file||submitting)?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {submitting ? '제출 중...' : '✅ 제출하기'}
                </button>
              </div>
              <div style={{ fontSize:'11px', color:'#9ca3af', textAlign:'center', marginTop:'8px' }}>
                '나중에'를 누르면 대시보드에 계속 표시됩니다.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── 대시보드 상단 배너 (미제출 공지 있을 때 표시)
export function SchoolNoticeBanner({ user, onOpen }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isConfigured || !user?.id) return
    dbCall('getAll', 'schoolNoticeSubmits').then(submits => {
      const cnt = (submits||[]).filter(s => s.teacherId === user.id && s.status === 'pending').length
      setCount(cnt)
    }).catch(()=>{})
  }, [user?.id])

  if (!count) return null

  return (
    <div onClick={onOpen} style={{
      background:'linear-gradient(135deg,#1e3a5f,#2563eb)',
      borderRadius:'12px', padding:'12px 16px', marginBottom:'16px',
      display:'flex', alignItems:'center', gap:'12px', cursor:'pointer',
      boxShadow:'0 4px 12px rgba(37,99,235,0.3)',
    }}>
      <span style={{ fontSize:'24px' }}>🏫</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>학교 담당자 공지 {count}건 미제출</div>
        <div style={{ fontSize:'12px', color:'#93c5fd', marginTop:'2px' }}>클릭하여 확인 및 제출하세요</div>
      </div>
      <span style={{ fontSize:'20px', color:'#93c5fd' }}>›</span>
    </div>
  )
}
