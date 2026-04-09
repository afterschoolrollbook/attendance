/**
 * SchoolAdminApp.jsx
 * 학교 담당자 포털
 * - 공지/업무 요청 생성
 * - 선생님별 제출 현황 실시간 확인
 * - 전원 제출 시 자동 알림
 * - 담당 선생님 학생 현황 조회
 */
import React, { useState, useEffect, useCallback } from 'react'
import { dbCall, FUNCTIONS_BASE } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { calcSessionDates, sortClasses, today as getToday } from '../lib/utils.js'
import { SchoolCalendar } from './SchoolCalendar.jsx'
import { TERM_TYPES, REPEAT_TYPES } from '../constants/config.js'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'
import { ConfirmDialog, Input, Select, Textarea, DayPicker, Tag, EmptyState } from '../components/Atoms.jsx'

const C = {
  primary:'#3b82f6', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', card:'#fff', bg:'#f8fafc',
  success:'#16a34a', danger:'#ef4444', warning:'#d97706',
}
const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px',
  border:'1.5px solid #e5e7eb', fontSize:'13px',
  fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

function Btn({ children, onClick, disabled, color='primary', style={} }) {
  const bg = disabled ? '#e5e7eb' : color==='danger' ? C.danger : color==='success' ? C.success : color==='secondary' ? '#fff' : C.primary
  const cl = disabled ? C.muted : color==='secondary' ? C.text : '#fff'
  return (
    <button onClick={disabled?undefined:onClick} style={{
      padding:'8px 16px', borderRadius:'9px', border: color==='secondary'?`1px solid ${C.border}`:'none',
      background:bg, color:cl, fontWeight:600, fontSize:'13px',
      cursor:disabled?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', ...style,
    }}>{children}</button>
  )
}

function Modal({ title, onClose, width=520, children }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.card, borderRadius:'16px', width:`${width}px`, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── DB 헬퍼
const DB = {
  notices:  async (adminId) => (await dbCall('getAll','schoolNotices')||[]).filter(n=>n.adminId===adminId),
  submits:  async (noticeId) => (await dbCall('getAll','schoolNoticeSubmits')||[]).filter(s=>s.noticeId===noticeId),
  teachers: async (adminId) => (await dbCall('getAll','schoolAdminTeachers')||[]).filter(t=>t.adminId===adminId&&t.active!==false),
  saveNotice:  async (n) => dbCall('upsert','schoolNotices',{data:n}),
  saveSubmit:  async (s) => dbCall('upsert','schoolNoticeSubmits',{data:s}),
  saveTeacher: async (t) => dbCall('upsert','schoolAdminTeachers',{data:t}),
  deleteNotice: (id) => db.delete('schoolNotices', id),
}

// ── 사이드바
function Sidebar({ session, page, onNav, onLogout }) {
  const nav = [
    { id:'dashboard', icon:'🏠', label:'대시보드' },
    { id:'notices',   icon:'📋', label:'공지·업무 관리' },
    { id:'subjects',  icon:'📚', label:'과목 관리' },
    { id:'teachers',  icon:'👩‍🏫', label:'선생님 현황' },
    { id:'connect',   icon:'🔗', label:'선생님 연결 관리' },
    { id:'schoolcal', icon:'📅', label:'연간 수업 달력' },
    { id:'classes',   icon:'📚', label:'수업 관리' },
    { id:'students',  icon:'👥', label:'학생 현황' },
  ]
  return (
    <aside style={{ width:'220px', minWidth:'220px', background:'#1e3a5f', display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0 }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #2d5a8e' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'22px' }}>🏫</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>학교 담당자 포털</div>
            <div style={{ fontSize:'11px', color:'#7ba7d4', marginTop:'2px' }}>방과후 출석부</div>
          </div>
        </div>
      </div>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #2d5a8e' }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:'#fff' }}>{session?.name || session?.admin?.adminName}</div>
        <div style={{ fontSize:'11px', color:'#7ba7d4', marginTop:'2px' }}>🏫 {session?.admin?.schoolName}</div>
      </div>
      <nav style={{ flex:1, padding:'10px 0' }}>
        {nav.map(item => (
          <button key={item.id} onClick={()=>onNav(item.id)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px',
            padding:'10px 20px', background: page===item.id?'rgba(59,130,246,0.2)':'none',
            border:'none', borderLeft: page===item.id?'3px solid #3b82f6':'3px solid transparent',
            color: page===item.id?'#93c5fd':'#94a3b8',
            fontSize:'14px', fontWeight: page===item.id?600:400,
            cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif',
          }}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding:'12px 20px', borderTop:'1px solid #2d5a8e' }}>
        <button onClick={onLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px', fontFamily:'Noto Sans KR, sans-serif' }}>
          🚪 로그아웃
        </button>
      </div>
    </aside>
  )
}

// ── 공지 생성 모달
// ─────────────────────────────────────────────────────────────
//  공지·업무 관련 컴포넌트
//
//  [개별 선생님 상태] — 목록에만 표시, 담당자 알림 없음
//    pending   : 확인 안함
//    replied   : 회신 완료 (수락/확인)
//    submitted : 제출 완료 (파일)
//
//  [업무 전체 상태] — 담당자가 직접 설정
//    active    : 진행중
//    working   : 업무중 (메모 포함)
//    done      : 업무완료
// ─────────────────────────────────────────────────────────────

const SUBMIT_STATUS = {
  pending:   { label:'확인 안함', color:'#9ca3af', bg:'#f3f4f6', icon:'⏳' },
  replied:   { label:'회신 완료', color:'#d97706', bg:'#fffbeb', icon:'✉️' },
  submitted: { label:'제출 완료', color:'#2563eb', bg:'#eff6ff', icon:'📎' },
}

const NOTICE_STATUS = {
  draft:   { label:'초안',     color:'#9ca3af', bg:'#f3f4f6'  },
  active:  { label:'진행중',   color:'#3b82f6', bg:'#eff6ff'  },
  working: { label:'업무중',   color:'#d97706', bg:'#fffbeb'  },
  done:    { label:'업무완료', color:'#16a34a', bg:'#f0fdf4'  },
}

// ── 공지 유형 정보 (모달 밖에 정의 — 리렌더 시 재생성 방지)
const TYPE_INFO = {
  notice:        { icon:'📋', label:'공지 전달',  desc:'선생님이 확인하면 회신완료 처리됩니다.',                       color:'#6b7280', bg:'#f3f4f6' },
  task:          { icon:'📎', label:'업무 요청',  desc:'선생님이 파일을 제출하면 제출완료 처리됩니다.',                color:'#d97706', bg:'#fffbeb' },
  invite_signup: { icon:'📧', label:'서비스 초대', desc:'앱 미가입 선생님에게 가입 안내 이메일을 발송합니다.',         color:'#f97316', bg:'#fff7ed' },
  invite_connect:{ icon:'🔗', label:'연결 초대',  desc:'앱 가입 선생님에게 이메일 + 대시보드 연결 초대를 발송합니다.', color:'#3b82f6', bg:'#eff6ff' },
}

// LBL도 모달 밖에 정의
const LBL = ({ children }) => <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>{children}</label>

// ── 공지 등록/수정 모달 (editNotice가 있으면 수정 모드)
function NoticeCreateModal({ session, teachers, onSave, onClose, editNotice }) {
  const isEdit = !!editNotice
  const { success, error } = useToast()
  const [form, setForm]       = useState({
    title:      editNotice?.title      ?? '',
    content:    editNotice?.content    ?? '',
    type:       editNotice?.type       ?? 'notice',
    completeOn: editNotice?.completeOn ?? 'replied',
    startDate:  editNotice?.startDate  ?? '',
    endDate:    editNotice?.endDate    ?? '',
    dueDate:    editNotice?.dueDate    ?? '',
    attachName: editNotice?.attachName ?? '',
    attachUrl:  editNotice?.attachUrl  ?? '',
  })
  const [targets, setTargets] = useState(editNotice?.targetTeacherIds || [])
  const [saving, setSaving]   = useState(false)
  const [appUsers, setAppUsers] = useState([])
  const fileRef = React.useRef()

  // 앱 가입 선생님 로드 (이메일 매칭용)
  React.useEffect(() => {
    dbCall('getAll', 'users').then(d =>
      setAppUsers((d||[]).filter(u => u.role === 'teacher'))
    ).catch(() => {})
  }, [])

  const appByEmail = Object.fromEntries(appUsers.map(u => [u.email?.toLowerCase(), u]))

  const toggleTeacher = (tid) => setTargets(prev => prev.includes(tid) ? prev.filter(t=>t!==tid) : [...prev, tid])
  const allSelected = targets.length === teachers.length && teachers.length > 0

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, attachUrl: ev.target.result, attachName: file.name }))
    reader.readAsDataURL(file); e.target.value = ''
  }

  const handleSave = async () => {
    if (!form.title.trim()) { error('제목을 입력해주세요.'); return }
    if (targets.length === 0) { error('대상 선생님을 선택해주세요.'); return }
    setSaving(true)
    try {
      const isInvite = form.type === 'invite_signup' || form.type === 'invite_connect'

      // ── 수정 모드
      if (isEdit) {
        await dbCall('update', 'schoolNotices', {
          id: editNotice.id,
          patch: {
            type:       form.type,
            title:      form.title.trim(),
            content:    form.content,
            completeOn: form.completeOn || 'replied',
            startDate:  form.startDate || null,
            endDate:    form.endDate   || null,
            dueDate:    form.dueDate   || null,
            attachName: form.attachName,
            attachUrl:  form.attachUrl,
            targetTeacherIds: targets,
            status: 'draft',
          }
        })
        success('수정되었습니다. 재배포 버튼을 눌러 선생님들에게 전달하세요.')
        onSave(); onClose(); return
      }

      // ── 신규 등록 모드
      const notice = {
        id: uid(), adminId: session.adminId,
        schoolName: session.admin?.schoolName || '',
        type: form.type,
        title: form.title, content: form.content,
        completeOn: form.completeOn || 'replied',
        startDate: form.startDate||null, endDate: form.endDate||null,
        dueDate: form.dueDate||null,
        attachName: form.attachName, attachUrl: form.attachUrl,
        targetTeacherIds: targets,
        status: 'draft', createdAt: now(),
      }
      await DB.saveNotice(notice)

      // schoolNoticeSubmits 생성
      await Promise.all(targets.map(tid => DB.saveSubmit({
        id: uid(), noticeId: notice.id, teacherId: tid,
        adminId: session.adminId, status: 'pending', createdAt: now(),
      })))

      // 초대 유형이면 실제 초대 이메일 + schoolTeacherInvites 발송
      if (isInvite) {
        const existingInvites = await dbCall('getAll','schoolTeacherInvites').then(d=>
          (d||[]).filter(i=>i.adminId===session.adminId)
        )
        const invByEmail = Object.fromEntries(existingInvites.map(i=>[i.teacherEmail?.toLowerCase(), i]))

        // 대상 선생님 중 이메일 있는 선생님만
        const targetTeachers = teachers.filter(t => targets.includes(t.teacherId) && t.email)

        await Promise.all(targetTeachers.map(async t => {
          const email    = t.email.toLowerCase()
          const appUser  = appByEmail[email]
          const existing = invByEmail[email]
          // 유형에 따라 초대 상태 결정
          // invite_connect: 가입된 선생님에게만 pending, 미가입은 emailed
          // invite_signup: 미가입 선생님에게 emailed
          const newStatus = appUser ? 'pending' : 'emailed'

          if (form.type === 'invite_connect' || (form.type === 'invite_signup' && !appUser)) {
            await dbCall('upsert', 'schoolTeacherInvites', {
              data: {
                id:           existing?.id || uid(),
                adminId:      session.adminId,
                schoolName:   session.admin?.schoolName || '',
                adminName:    session.admin?.adminName  || '',
                teacherEmail: email,
                teacherName:  t.teacherName,
                teacherId:    appUser?.id || null,
                noticeId:     notice.id,
                status:       newStatus,
                sentAt:       now(),
                createdAt:    existing?.createdAt || now(),
              }
            })
            // 이메일 발송
            if (form.type === 'invite_connect' && appUser) {
              await sendTeacherInviteEmail({ teacherName:t.teacherName, email, schoolName:session.admin?.schoolName||'', adminName:session.admin?.adminName||'' })
            } else {
              await sendSignupInviteEmail({ teacherName:t.teacherName, email, schoolName:session.admin?.schoolName||'', adminName:session.admin?.adminName||'' })
            }
          }
        }))
      }

      success(`${targets.length}명에게 ${TYPE_INFO[form.type].label}을(를) 등록했습니다!`)
      onSave(); onClose()
    } catch { error('저장 중 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  const ti = TYPE_INFO[form.type]

  return (
    <Modal title={isEdit ? '✏️ 공지·업무 수정' : '📋 공지·업무 등록'} onClose={onClose} width={580}>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* 유형 선택 — 수정 모드에서는 변경 불가 */}
        <div>
          <LBL>유형</LBL>
          {isEdit ? (
            <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 14px', borderRadius:'10px', border:`2px solid ${TYPE_INFO[form.type]?.color||'#e5e7eb'}`, background:TYPE_INFO[form.type]?.bg||'#f3f4f6' }}>
              <span style={{ fontSize:'16px' }}>{TYPE_INFO[form.type]?.icon}</span>
              <span style={{ fontSize:'13px', fontWeight:700, color:TYPE_INFO[form.type]?.color }}>{TYPE_INFO[form.type]?.label}</span>
              <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'4px' }}>(수정 시 유형 변경 불가)</span>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {Object.entries(TYPE_INFO).map(([v, info]) => (
                <button key={v} type="button" onClick={() => setForm(f=>({
                  ...f, type:v,
                  // 초대 유형 선택 시 완료 조건 자동으로 회신완료로 설정
                  completeOn: (v==='invite_connect'||v==='invite_signup') ? 'replied' : f.completeOn,
                }))} style={{
                  padding:'10px 14px', borderRadius:'10px', cursor:'pointer',
                  fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:form.type===v?700:400,
                  border: form.type===v ? `2px solid ${info.color}` : `2px solid #e5e7eb`,
                  background: form.type===v ? info.bg : '#fff',
                  color: form.type===v ? info.color : C.muted,
                  textAlign:'left', transition:'all .15s',
                  display:'flex', alignItems:'center', gap:'8px',
                }}>
                  <span style={{ fontSize:'16px' }}>{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              ))}
            </div>
          )}
          {/* 유형 설명 */}
          <div style={{ fontSize:'11px', color:ti.color, background:ti.bg, padding:'6px 10px', borderRadius:'6px', marginTop:'6px', fontWeight:500 }}>
            {ti.icon} {ti.desc}
          </div>

          {/* 완료 조건 */}
          <div style={{ marginTop:'10px' }}>
            <LBL>완료 조건</LBL>
            {/* 등록 모드 + 초대 유형일 때만 안내 문구 */}
            {!isEdit && (form.type === 'invite_connect' || form.type === 'invite_signup') && (
              <div style={{ fontSize:'11px', color:'#3b82f6', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'7px', padding:'6px 10px', marginBottom:'8px' }}>
                🔗 초대 방식은 선생님이 수락하면 자동으로 <strong>회신완료</strong> 처리됩니다.
              </div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              {[
                { v:'replied',   icon:'✉️', label:'회신 완료로 끝',  desc:'읽고 확인·수락하면 완료' },
                { v:'submitted', icon:'📎', label:'제출 완료로 끝',  desc:'파일·서류 제출해야 완료' },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => setForm(f=>({...f, completeOn:opt.v}))} style={{
                  flex:1, padding:'8px 12px', borderRadius:'9px', cursor:'pointer',
                  fontFamily:'Noto Sans KR, sans-serif', fontSize:'12px', textAlign:'left',
                  border: form.completeOn===opt.v ? `2px solid ${ti.color}` : `2px solid #e5e7eb`,
                  background: form.completeOn===opt.v ? ti.bg : '#fff',
                  color: form.completeOn===opt.v ? ti.color : C.muted,
                }}>
                  <div style={{ fontWeight:700 }}>{opt.icon} {opt.label}</div>
                  <div style={{ fontSize:'10px', marginTop:'2px', opacity:.8 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div><LBL>제목 *</LBL><input style={iSt} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="예: 2026년 1분기 서류 제출" /></div>
        <div><LBL>내용</LBL><textarea style={{...iSt,resize:'vertical'}} rows={3} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="상세 안내..." /></div>

        {/* 기간 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
          <div><LBL>시작일</LBL><input style={iSt} type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></div>
          <div><LBL>종료일</LBL><input style={iSt} type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} /></div>
          <div><LBL>마감일</LBL><input style={iSt} type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} /></div>
        </div>

        {/* 첨부 — 공지/업무만 */}
        {(form.type === 'notice' || form.type === 'task') && (
          <div>
            <LBL>첨부 양식 (선택)</LBL>
            <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFile} />
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <button type="button" onClick={()=>fileRef.current?.click()} style={{ padding:'7px 12px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📎 파일 선택</button>
              {form.attachName && <span style={{ fontSize:'12px', color:C.primary }}>{form.attachName}</span>}
            </div>
          </div>
        )}

        {/* 대상 선생님 */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
            <LBL>대상 선생님 * ({targets.length}명)</LBL>
            <button type="button" onClick={()=>setTargets(allSelected?[]:[...teachers.map(t=>t.teacherId)])} style={{ fontSize:'12px', color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              {allSelected?'전체 해제':'전체 선택'}
            </button>
          </div>
          <div style={{ maxHeight:'220px', overflowY:'auto', border:`1px solid ${C.border}`, borderRadius:'9px', padding:'8px' }}>
            {teachers.length===0
              ? <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'12px' }}>등록된 선생님이 없습니다.</div>
              : teachers.map(t => {
                  const hasEmail   = !!t.email
                  const needEmail  = form.type === 'invite_signup' || form.type === 'invite_connect'
                  const isJoined   = hasEmail && !!appByEmail[t.email?.toLowerCase()]
                  const disabled   = needEmail && !hasEmail
                  return (
                    <label key={t.teacherId} style={{
                      display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px',
                      borderRadius:'8px', cursor:disabled?'not-allowed':'pointer',
                      background:targets.includes(t.teacherId)?'#eff6ff':'transparent',
                      opacity:disabled?0.4:1,
                      borderBottom:`1px solid ${C.border}`,
                    }}>
                      <input type="checkbox" checked={targets.includes(t.teacherId)}
                        onChange={()=>{ if(disabled) return; toggleTeacher(t.teacherId) }}
                        style={{ accentColor:C.primary }} disabled={disabled} />
                      <span style={{ fontSize:'13px', fontWeight:600, color:C.text, flex:1 }}>{t.teacherName}</span>
                      {t.subject && <span style={{ fontSize:'11px', color:C.muted }}>{t.subject}</span>}
                      {/* 가입 상태 뱃지 */}
                      {hasEmail ? (
                        isJoined ? (
                          <span style={{ fontSize:'10px', fontWeight:700, color:'#16a34a', background:'#f0fdf4', padding:'2px 7px', borderRadius:'999px', whiteSpace:'nowrap' }}>🔗 연결 가능</span>
                        ) : (
                          <span style={{ fontSize:'10px', fontWeight:700, color:'#f97316', background:'#fff7ed', padding:'2px 7px', borderRadius:'999px', whiteSpace:'nowrap' }}>📧 서비스 미가입</span>
                        )
                      ) : (
                        <span style={{ fontSize:'10px', color:C.danger }}>(이메일 없음)</span>
                      )}
                    </label>
                  )
                })
            }
          </div>
          {(form.type === 'invite_signup' || form.type === 'invite_connect') && (
            <div style={{ fontSize:'11px', color:C.muted, marginTop:'4px' }}>* 이메일이 등록된 선생님만 초대할 수 있습니다.</div>
          )}
        </div>

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <Btn color="secondary" onClick={onClose}>취소</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : isEdit ? '수정 저장' : '등록'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ── 업무 현황 상세 모달
function NoticeDetailModal({ notice, session, teachers, onClose, onReload }) {
  const [submits,   setSubmits]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [reminding, setReminding] = useState(false)
  const [memo,      setMemo]      = useState(notice.memo||'')
  const [showMemo,  setShowMemo]  = useState(false)
  const { success, error } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const s = await DB.submits(notice.id)
    setSubmits(s)
    setLoading(false)
  }, [notice.id])

  useEffect(() => { load() }, [load])

  // 미완료 선생님에게 이메일 + 대시보드 알림 재발송
  const sendReminder = async () => {
    const pendingSubs = submits.filter(s => s.status === 'pending')
    if (!pendingSubs.length) { success('모든 선생님이 완료했습니다!'); return }
    setReminding(true)
    try {
      // 앱 가입 선생님 조회
      const appUsers = await dbCall('getAll','users').then(d=>(d||[]).filter(u=>u.role==='teacher'))
      const appById  = Object.fromEntries(appUsers.map(u=>[u.id, u]))

      // 초대 레코드 조회
      const allInvites = await dbCall('getAll','schoolTeacherInvites').then(d=>
        (d||[]).filter(i=>i.adminId===session.adminId&&i.noticeId===notice.id)
      )
      const invByTeacherId = Object.fromEntries(allInvites.map(i=>[i.teacherId, i]))

      let sent = 0
      for (const sub of pendingSubs) {
        const teacher  = teachers.find(t=>t.teacherId===sub.teacherId||t.id===sub.teacherId)
        const appUser  = appById[sub.teacherId]
        const inv      = invByTeacherId[sub.teacherId]
        const email    = teacher?.email || appUser?.email || inv?.teacherEmail
        const tName    = teacher?.teacherName || appUser?.name || inv?.teacherName || '선생님'

        if (!email) continue

        if (appUser) {
          // 앱 가입 → 이메일 + 대시보드 팝업 (invite status를 pending으로 재설정)
          await sendTeacherInviteEmail({
            teacherName: tName, email,
            schoolName:  session.admin?.schoolName || '',
            adminName:   session.admin?.adminName  || '',
          })
          // 기존 초대 레코드 sentAt 갱신 (대시보드 팝업 재표시)
          if (inv) {
            await dbCall('update','schoolTeacherInvites',{ id:inv.id, patch:{ sentAt:now(), status:'pending' } })
          }
        } else {
          // 미가입 → 가입 초대 이메일 재발송
          await sendSignupInviteEmail({
            teacherName: tName, email,
            schoolName:  session.admin?.schoolName || '',
            adminName:   session.admin?.adminName  || '',
          })
        }
        sent++
      }
      success(`✅ ${sent}명에게 독촉 알림을 재발송했습니다!`)
    } catch { error('발송 중 오류가 발생했습니다.') }
    setReminding(false)
  }

  const targets = notice.targetTeacherIds || []
  const counts  = Object.fromEntries(
    Object.keys(SUBMIT_STATUS).map(k => [k, submits.filter(s=>s.status===k).length])
  )

  // 선생님 완료 여부 계산
  const completeOn      = notice.completeOn || 'replied'
  const allReplied      = targets.length > 0 && (counts.replied + counts.submitted) >= targets.length
  const allSubmitted    = targets.length > 0 && counts.submitted >= targets.length
  const remainReplied   = targets.length - (counts.replied + counts.submitted)
  const remainSubmitted = targets.length - counts.submitted

  // 업무완료 버튼 활성 조건
  const teacherAllDone = completeOn === 'submitted' ? allSubmitted : allReplied
  const remainCount    = completeOn === 'submitted' ? remainSubmitted : remainReplied

  // 완료 현황 메시지
  const StatusBanner = () => {
    if (completeOn === 'replied') {
      // 회신 업무
      if (allReplied) return (
        <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px 16px', border:'1px solid #86efac' }}>
          <div style={{ fontSize:'13px', color:'#16a34a', fontWeight:700 }}>
            ✅ 모든 선생님이 회신 완료했습니다. 업무완료 버튼을 눌러주세요.
          </div>
        </div>
      )
      return (
        <div style={{ background:'#fffbeb', borderRadius:'10px', padding:'12px 16px', border:'1px solid #fcd34d' }}>
          <div style={{ fontSize:'13px', color:'#92400e', fontWeight:600 }}>
            ⏳ 아직 {remainReplied}명이 회신을 하지 않았습니다.
          </div>
        </div>
      )
    }

    // 제출 업무 — 회신/제출 두 단계 표시
    return (
      <div style={{ background: allSubmitted?'#f0fdf4':'#f8fafc', borderRadius:'10px', padding:'12px 16px', border:`1px solid ${allSubmitted?'#86efac':'#e5e7eb'}` }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {/* 회신 현황 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }}>
            {allReplied
              ? <span style={{ color:'#16a34a', fontWeight:700 }}>✅ 모든 선생님 회신완료.</span>
              : <span style={{ color:'#d97706', fontWeight:600 }}>⏳ 회신 대기 {remainReplied}명.</span>
            }
          </div>
          {/* 제출 현황 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }}>
            {allSubmitted
              ? <span style={{ color:'#16a34a', fontWeight:700 }}>✅ 모든 선생님 제출완료.</span>
              : <span style={{ color:'#2563eb', fontWeight:600 }}>📎 제출 대기 {remainSubmitted}명.</span>
            }
          </div>
          {allReplied && !allSubmitted && (
            <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'2px' }}>
              모든 선생님이 회신했지만 아직 제출이 완료되지 않았습니다.
            </div>
          )}
          {allSubmitted && (
            <div style={{ fontSize:'12px', color:'#16a34a', marginTop:'2px', fontWeight:600 }}>
              확인 후 업무완료 버튼을 눌러주세요! 🎉
            </div>
          )}
        </div>
      </div>
    )
  }

  // 업무 전체 상태 변경
  const setNoticeStatus = async (status) => {
    const patch = { status }
    if (status === 'working') patch.memo = memo
    await dbCall('update', 'schoolNotices', { id: notice.id, patch })
    success(status==='done' ? '✅ 업무완료 처리했습니다!' : '📝 업무중으로 저장했습니다.')
    setShowMemo(false)
    onReload()
    onClose()
  }

  const typeInfo = notice.type==='invite_connect' ? { icon:'🔗', text:'연결 초대'  }
                 : notice.type==='invite_signup'  ? { icon:'📧', text:'서비스 초대' }
                 : notice.type==='invite'         ? { icon:'🔗', text:'연결 초대'  }
                 : notice.type==='task'           ? { icon:'📎', text:'업무 요청'  }
                 :                                  { icon:'📋', text:'공지 전달'  }

  const ns = NOTICE_STATUS[notice.status] || NOTICE_STATUS.active

  return (
    <Modal title={`${typeInfo.icon} ${notice.title}`} onClose={onClose} width={620}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

        {/* 업무 정보 */}
        <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'12px 16px', display:'flex', gap:'16px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color:ns.color, background:ns.bg, padding:'3px 10px', borderRadius:'999px' }}>{ns.label}</span>
          <span style={{ fontSize:'13px', color:C.muted }}>대상 <strong style={{ color:C.text }}>{targets.length}명</strong></span>
          {notice.startDate && <span style={{ fontSize:'12px', color:C.muted }}>📅 {notice.startDate}{notice.endDate?` ~ ${notice.endDate}`:''}</span>}
          {notice.dueDate   && <span style={{ fontSize:'12px', color:C.muted }}>⏰ 마감 {notice.dueDate}</span>}
          <span style={{ fontSize:'12px', fontWeight:600, color:completeOn==='submitted'?'#2563eb':'#d97706', background:completeOn==='submitted'?'#eff6ff':'#fffbeb', padding:'2px 8px', borderRadius:'999px' }}>
            완료조건: {completeOn==='submitted'?'📎 제출 완료':'✉️ 회신 완료'}
          </span>
        </div>

        {/* 선생님 완료 현황 요약 */}
        <StatusBanner />

        {/* 개별 선생님 상태 요약 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
          {Object.entries(SUBMIT_STATUS).map(([k,s]) => (
            <div key={k} style={{ background:s.bg, borderRadius:'10px', padding:'10px 14px', textAlign:'center' }}>
              <div style={{ fontSize:'20px', fontWeight:800, color:s.color }}>{counts[k]||0}</div>
              <div style={{ fontSize:'11px', color:C.muted }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>

        {/* 선생님별 목록 */}
        {loading ? <div style={{ textAlign:'center', padding:'20px', color:C.muted }}>불러오는 중...</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'280px', overflowY:'auto' }}>
            {targets.map(tid => {
              const teacher = teachers.find(t=>t.teacherId===tid)
              const sub     = submits.find(s=>s.teacherId===tid)
              const st      = sub?.status || 'pending'
              const si      = SUBMIT_STATUS[st] || SUBMIT_STATUS.pending
              return (
                <div key={tid} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:'10px', background:si.bg, border:`1px solid ${si.color}33` }}>
                  <div>
                    <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{teacher?.teacherName||'알 수 없음'}</span>
                    {sub?.repliedAt   && <span style={{ fontSize:'11px', color:C.muted, marginLeft:'8px' }}>회신: {sub.repliedAt.slice(0,10)}</span>}
                    {sub?.submittedAt && <span style={{ fontSize:'11px', color:C.muted, marginLeft:'8px' }}>제출: {sub.submittedAt.slice(0,10)}</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    {sub?.fileUrl && <a href={sub.fileUrl} download={sub.fileName} style={{ fontSize:'12px', color:C.primary, textDecoration:'none', fontWeight:600 }}>⬇ 파일</a>}
                    <span style={{ fontSize:'11px', fontWeight:700, color:si.color, padding:'3px 10px', borderRadius:'999px', background:'#fff', border:`1px solid ${si.color}44`, whiteSpace:'nowrap' }}>
                      {si.icon} {si.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 업무중 메모 입력 */}
        {showMemo && (
          <div>
            <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>메모 (업무중 사유/내용)</label>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)}
              style={{ ...iSt, resize:'vertical', width:'100%', boxSizing:'border-box' }} rows={3}
              placeholder="예: 3명 서류 미비, 다음 주 재수령 예정" />
          </div>
        )}
        {notice.memo && !showMemo && (
          <div style={{ background:'#fffbeb', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#92400e' }}>
            📝 메모: {notice.memo}
          </div>
        )}

        {/* 담당자 액션 버튼 */}
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:'14px', display:'flex', gap:'8px', justifyContent:'flex-end', flexWrap:'wrap' }}>
          {/* 독촉 버튼 — 미완료 선생님이 있을 때 */}
          {notice.status !== 'done' && counts.pending > 0 && (
            <button onClick={sendReminder} disabled={reminding} style={{
              padding:'9px 18px', borderRadius:'9px', border:`2px solid #7c3aed`,
              background:'#f5f3ff', color:'#7c3aed', fontWeight:700, fontSize:'13px',
              cursor: reminding ? 'not-allowed' : 'pointer',
              fontFamily:'Noto Sans KR, sans-serif', opacity: reminding ? .6 : 1,
            }}>
              {reminding ? '발송 중...' : `📨 독촉 재발송 (${counts.pending}명)`}
            </button>
          )}
          {notice.status !== 'done' && (
            <>
              {!showMemo ? (
                <button onClick={()=>setShowMemo(true)} style={{
                  padding:'9px 18px', borderRadius:'9px', border:`2px solid #d97706`,
                  background:'#fffbeb', color:'#92400e', fontWeight:700, fontSize:'13px',
                  cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                }}>📝 업무중</button>
              ) : (
                <button onClick={()=>setNoticeStatus('working')} style={{
                  padding:'9px 18px', borderRadius:'9px', border:'none',
                  background:'#d97706', color:'#fff', fontWeight:700, fontSize:'13px',
                  cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                }}>💾 업무중 저장</button>
              )}
              {/* 업무완료 — 선생님 완료 후에만 활성 */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                <button
                  onClick={() => teacherAllDone && setNoticeStatus('done')}
                  style={{
                    padding:'9px 18px', borderRadius:'9px', border:'none',
                    background: teacherAllDone ? '#16a34a' : '#e5e7eb',
                    color: teacherAllDone ? '#fff' : '#9ca3af',
                    fontWeight:700, fontSize:'13px',
                    cursor: teacherAllDone ? 'pointer' : 'not-allowed',
                    fontFamily:'Noto Sans KR, sans-serif',
                    boxShadow: teacherAllDone ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
                  }}
                >✅ 업무완료</button>
                {!teacherAllDone && (
                  <span style={{ fontSize:'10px', color:'#9ca3af' }}>
                    {remainCount}명 {completeOn==='submitted'?'제출':'회신'} 대기중
                  </span>
                )}
              </div>
            </>
          )}
          {notice.status === 'done' && (
            <button onClick={()=>setNoticeStatus('active')} style={{
              padding:'9px 18px', borderRadius:'9px', border:`1px solid ${C.border}`,
              background:'#fff', color:C.muted, fontWeight:600, fontSize:'13px',
              cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
            }}>↩ 진행중으로 되돌리기</button>
          )}
          <Btn color="secondary" onClick={onClose}>닫기</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ── 공지·업무 관리 탭
function NoticesTab({ session }) {
  const { success, error } = useToast()
  const confirm = useSchoolConfirm()
  const [notices,     setNotices]     = useState([])
  const [invites,     setInvites]     = useState([])
  const [teachers,    setTeachers]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [editNotice,  setEditNotice]  = useState(null)  // 수정 대상
  const [detailNotice,setDetailNotice]= useState(null)
  const [filterStatus,setFilterStatus]= useState('all')
  const [deploying,   setDeploying]   = useState({})    // { noticeId: true }

  const load = useCallback(async () => {
    setLoading(true)
    const [n, t, inv] = await Promise.all([
      DB.notices(session.adminId),
      DB.teachers(session.adminId),
      dbCall('getAll', 'schoolTeacherInvites').then(d =>
        (d||[]).filter(i => i.adminId === session.adminId)
      ),
    ])
    setNotices(n.sort((a,b)=>b.createdAt?.localeCompare(a.createdAt)))
    setTeachers(t); setInvites(inv)
    setLoading(false)
  }, [session.adminId])

  useEffect(() => { load() }, [load])

  const deleteNotice = (id) => {
    confirm('삭제하시겠습니까?', async () => {
      try {
        const linkedInvites = invites.filter(i => i.noticeId === id)
        await Promise.all(linkedInvites.map(i => {
          if (i.status === 'accepted') {
            return dbCall('update', 'schoolTeacherInvites', { id: i.id, patch: { noticeId: null } })
          } else {
            return dbCall('update', 'schoolTeacherInvites', { id: i.id, patch: { noticeId: null, status: 'declined', sentAt: null } })
          }
        }))
        const allSubs = await dbCall('getAll','schoolNoticeSubmits').then(d=>(d||[]).filter(s=>s.noticeId===id))
        await Promise.all(allSubs.map(s => dbCall('delete','schoolNoticeSubmits',{ id:s.id })))
        await DB.deleteNotice(id)
        success('삭제되었습니다.')
        load()
      } catch { error('삭제 중 오류가 발생했습니다.') }
    })
  }

  // 배포 — draft → active + 선생님들에게 submit 레코드 생성
  const deployNotice = async (notice) => {
    setDeploying(prev => ({ ...prev, [notice.id]: true }))
    try {
      // 기존 submit 레코드 조회 (재배포 시 중복 방지)
      const existingSubs = await dbCall('getAll','schoolNoticeSubmits')
        .then(d=>(d||[]).filter(s=>s.noticeId===notice.id))
      const existingTeacherIds = new Set(existingSubs.map(s=>s.teacherId))

      const targets = notice.targetTeacherIds || []
      // 신규 대상만 submit 생성
      const newTargets = targets.filter(tid => !existingTeacherIds.has(tid))
      await Promise.all(newTargets.map(tid => DB.saveSubmit({
        id: uid(), noticeId: notice.id, teacherId: tid,
        adminId: session.adminId, status: 'pending', createdAt: now(),
      })))
      // active 상태로 변경
      await dbCall('update', 'schoolNotices', { id: notice.id, patch: { status: 'active' } })
      success(`✅ 배포 완료! ${targets.length}명에게 전달되었습니다.`)
      load()
    } catch { error('배포 중 오류가 발생했습니다.') }
    setDeploying(prev => ({ ...prev, [notice.id]: false }))
  }

  const getInviteSummary = (noticeId) => {
    const linked = invites.filter(i => i.noticeId === noticeId)
    if (!linked.length) return null
    return {
      total:    linked.length,
      accepted: linked.filter(i=>i.status==='accepted').length,
      pending:  linked.filter(i=>i.status==='pending').length,
      emailed:  linked.filter(i=>i.status==='emailed').length,
    }
  }

  const filtered = notices.filter(n => filterStatus==='all' || n.status===filterStatus)

  const typeInfo = (type) =>
    type==='invite_connect' ? { icon:'🔗', text:'연결 초대',  color:'#3b82f6', bg:'#eff6ff' } :
    type==='invite_signup'  ? { icon:'📧', text:'서비스 초대', color:'#f97316', bg:'#fff7ed' } :
    type==='invite'         ? { icon:'🔗', text:'연결 초대',  color:'#3b82f6', bg:'#eff6ff' } :
    type==='task'           ? { icon:'📎', text:'업무 요청',  color:'#d97706', bg:'#fffbeb' } :
                              { icon:'📋', text:'공지 전달',  color:'#6b7280', bg:'#f3f4f6' }

  const isInviteType = (type) => ['invite_connect','invite_signup','invite'].includes(type)

  return (
    <div style={{ padding:'24px', maxWidth:'960px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>📋 공지·업무 관리</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>등록 후 배포 버튼을 누르면 선생님들에게 전달됩니다</div>
        </div>
        <Btn onClick={()=>setShowCreate(true)}>+ 등록</Btn>
      </div>

      {/* 상태 필터 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[['all','전체'],['draft','초안'],['active','진행중'],['working','업무중'],['done','업무완료']].map(([v,l]) => {
          const cnt = v==='all' ? notices.length : notices.filter(n=>n.status===v).length
          return (
            <button key={v} onClick={()=>setFilterStatus(v)} style={{
              padding:'6px 14px', borderRadius:'999px', border:'none', cursor:'pointer',
              fontFamily:'Noto Sans KR, sans-serif', fontSize:'12px', fontWeight:filterStatus===v?700:400,
              background:filterStatus===v?'#1e3a5f':'#e5e7eb', color:filterStatus===v?'#fff':C.muted,
            }}>{l} {cnt>0?`(${cnt})`:''}</button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.muted, background:'#f8fafc', borderRadius:'14px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>📋</div>
          <div>등록된 항목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {filtered.map(notice => {
            const ti    = typeInfo(notice.type)
            const ns    = NOTICE_STATUS[notice.status] || NOTICE_STATUS.active
            const cnt   = (notice.targetTeacherIds||[]).length
            const inv   = getInviteSummary(notice.id)
            const isDraft = notice.status === 'draft'
            const isDeploying = deploying[notice.id]

            return (
              <div key={notice.id} style={{
                background: isDraft ? '#fafafa' : C.card,
                borderRadius:'14px',
                border:`2px solid ${
                  notice.status==='done'   ? '#86efac' :
                  notice.status==='working'? '#fcd34d' :
                  isDraft                  ? '#d1d5db' : C.border
                }`,
                padding:'18px 20px',
                opacity: isDraft ? 0.9 : 1,
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    {/* 뱃지 + 제목 */}
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'11px', fontWeight:700, color:ti.color, background:ti.bg, padding:'2px 8px', borderRadius:'999px' }}>{ti.icon} {ti.text}</span>
                      <span style={{ fontSize:'11px', fontWeight:700, color:ns.color, background:ns.bg, padding:'2px 8px', borderRadius:'999px' }}>{ns.label}</span>
                      {isDraft && <span style={{ fontSize:'11px', color:'#9ca3af' }}>— 배포 전 초안</span>}
                    </div>
                    <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'8px' }}>{notice.title}</div>

                    {/* 날짜 크게 */}
                    <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'6px' }}>
                      {notice.startDate && (
                        <div style={{ background:'#f0f9ff', borderRadius:'8px', padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontSize:'13px' }}>📅</span>
                          <div>
                            <div style={{ fontSize:'11px', color:'#0369a1', fontWeight:600 }}>기간</div>
                            <div style={{ fontSize:'13px', fontWeight:700, color:'#0c4a6e' }}>
                              {notice.startDate}{notice.endDate ? ` ~ ${notice.endDate}` : ''}
                            </div>
                          </div>
                        </div>
                      )}
                      {notice.dueDate && (
                        <div style={{ background:'#fef2f2', borderRadius:'8px', padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontSize:'13px' }}>⏰</span>
                          <div>
                            <div style={{ fontSize:'11px', color:'#991b1b', fontWeight:600 }}>마감</div>
                            <div style={{ fontSize:'14px', fontWeight:800, color:'#7f1d1d' }}>{notice.dueDate}</div>
                          </div>
                        </div>
                      )}
                      <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ fontSize:'13px' }}>👥</span>
                        <div>
                          <div style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>대상</div>
                          <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{cnt}명</div>
                        </div>
                      </div>
                    </div>

                    {/* 메모 */}
                    {notice.memo && (
                      <div style={{ fontSize:'12px', color:'#92400e', background:'#fffbeb', borderRadius:'6px', padding:'4px 10px', marginTop:'4px', display:'inline-block' }}>
                        📝 {notice.memo}
                      </div>
                    )}
                    {/* 초대 현황 */}
                    {isInviteType(notice.type) && inv && (
                      <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'11px', fontWeight:600, color:'#16a34a', background:'#f0fdf4', padding:'2px 8px', borderRadius:'999px' }}>✅ 연결완료 {inv.accepted}</span>
                        <span style={{ fontSize:'11px', fontWeight:600, color:'#d97706', background:'#fffbeb', padding:'2px 8px', borderRadius:'999px' }}>📨 수락대기 {inv.pending}</span>
                        {inv.emailed>0 && <span style={{ fontSize:'11px', fontWeight:600, color:'#f97316', background:'#fff7ed', padding:'2px 8px', borderRadius:'999px' }}>📧 이메일발송 {inv.emailed}</span>}
                      </div>
                    )}
                  </div>

                  {/* 버튼 영역 */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>
                    {/* 배포 버튼 — draft이거나 수정 후 재배포 */}
                    {(isDraft || notice.status === 'active') && (
                      <button onClick={() => deployNotice(notice)} disabled={isDeploying} style={{
                        padding:'8px 16px', borderRadius:'9px', border:'none', cursor:isDeploying?'not-allowed':'pointer',
                        background: isDraft ? '#7c3aed' : '#0369a1',
                        color:'#fff', fontWeight:700, fontSize:'13px',
                        fontFamily:'Noto Sans KR, sans-serif',
                        opacity: isDeploying ? .6 : 1,
                      }}>
                        {isDeploying ? '배포 중...' : isDraft ? '🚀 배포' : '🔄 재배포'}
                      </button>
                    )}
                    <Btn onClick={()=>setDetailNotice(notice)}>현황</Btn>
                    <button onClick={()=>setEditNotice(notice)} style={{
                      padding:'8px 16px', borderRadius:'9px', border:`1px solid ${C.border}`,
                      background:'#fff', color:C.text, fontWeight:600, fontSize:'13px',
                      cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    }}>수정</button>
                    <Btn color="danger" onClick={()=>deleteNotice(notice.id)}>삭제</Btn>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate  && <NoticeCreateModal session={session} teachers={teachers} onSave={load} onClose={()=>setShowCreate(false)} />}
      {editNotice  && <NoticeCreateModal session={session} teachers={teachers} onSave={()=>{load();setEditNotice(null)}} onClose={()=>setEditNotice(null)} editNotice={editNotice} />}
      {detailNotice && (
        <NoticeDetailModal
          notice={detailNotice} session={session} teachers={teachers}
          onClose={()=>setDetailNotice(null)} onReload={load}
        />
      )}
    </div>
  )
}

const CURRENT_YEAR = new Date().getFullYear()
const DAYS_LIST = ['월', '화', '수', '목', '금', '토']

// ── 과목 관리 탭 (학교별 연도 과목 등록)
function SubjectsTab({ session }) {
  const { success, error } = useToast()
  const [subjects, setSubjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selYear,  setSelYear]  = useState(CURRENT_YEAR)
  const [input,    setInput]    = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const all = await dbCall('getAll', 'schoolSubjects')
      setSubjects((all||[]).filter(s => s.adminId === session.adminId && s.active !== false))
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const years = [...new Set([CURRENT_YEAR, ...subjects.map(s => s.year).filter(Boolean)])].sort((a,b)=>b-a)
  const filtered = subjects.filter(s => s.year == selYear)

  const handleAdd = async () => {
    const name = input.trim()
    if (!name) { error('과목명을 입력해주세요.'); return }
    if (filtered.find(s => s.name === name)) { error('이미 등록된 과목입니다.'); return }
    await dbCall('upsert', 'schoolSubjects', {
      data: {
        id: uid(), adminId: session.adminId,
        schoolName: session.admin?.schoolName || '',
        year: selYear, name, active: true, createdAt: now(),
      }
    })
    setInput('')
    success('과목이 등록되었습니다.')
    load()
  }

  const handleDelete = async (id) => {
    await dbCall('update', 'schoolSubjects', { id, patch: { active: false } })
    success('삭제되었습니다.')
    load()
  }

  return (
    <div style={{ padding:'28px', maxWidth:'600px' }}>
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>📚 과목 관리</div>
        <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>
          연도별 진행 과목을 등록하세요. 선생님 등록 시 목록에서 선택할 수 있습니다.
        </div>
      </div>

      {/* 연도 탭 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelYear(y)} style={{
            padding:'6px 18px', borderRadius:'999px', border:'none', cursor:'pointer',
            fontFamily:'Noto Sans KR, sans-serif', fontWeight:selYear===y?700:400, fontSize:'13px',
            background:selYear===y?'#1e3a5f':'#e5e7eb', color:selYear===y?'#fff':C.muted,
          }}>
            {y}년{y===CURRENT_YEAR&&<span style={{ fontSize:'10px', opacity:.8 }}> 올해</span>}
          </button>
        ))}
        <button onClick={() => { if(!years.includes(selYear-0||CURRENT_YEAR)) setSelYear(CURRENT_YEAR) }} style={{ display:'none' }} />
      </div>

      {/* 추가 입력 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
        <input
          style={{ ...iSt, flex:1 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && handleAdd()}
          placeholder={`${selYear}년 과목명 입력 (예: 로봇, 코딩, 미술)`}
        />
        <Btn onClick={handleAdd}>+ 추가</Btn>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'30px', color:C.muted }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:C.muted, background:'#f8fafc', borderRadius:'12px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'32px', marginBottom:'8px' }}>📚</div>
          <div style={{ fontWeight:600 }}>{selYear}년 등록된 과목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {filtered.map((s, i) => (
            <div key={s.id} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 16px',
              borderBottom: i < filtered.length-1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'18px' }}>📌</span>
                <span style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{s.name}</span>
              </div>
              <button onClick={() => handleDelete(s.id)} style={{
                padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5',
                background:'#fef2f2', color:C.danger, fontSize:'12px',
                cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
              }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── 선생님 등록/수정 모달 (TeachersTab 밖에 정의 — 안에 두면 리렌더 시 unmount됨)
function TeacherFormModal({ mode, form, setForm, session, subjects, onSave, onClose }) {
  const iSt2 = {
    width:'100%', padding:'9px 12px', borderRadius:'9px',
    border:'1.5px solid #e5e7eb', fontSize:'13px',
    fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
  }
  const LBL = ({ children }) => (
    <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px', fontWeight:600 }}>{children}</label>
  )

  const toggleDay = (day) => {
    const current = form.days ? form.days.split('·').filter(Boolean) : []
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day]
    // 요일 순서 유지
    const ordered = DAYS_LIST.filter(d => next.includes(d))
    setForm(f => ({ ...f, days: ordered.join('·') }))
  }

  const selectedDays = form.days ? form.days.split('·').filter(Boolean) : []

  // 파일 선택
  const feeRef    = React.useRef()
  const bizRef    = React.useRef()
  const accRef    = React.useRef()

  const pickFile = (ref, key) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,application/pdf'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => setForm(f => ({ ...f, [key]: { name: file.name, data: ev.target.result } }))
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const FilePicker = ({ label, fieldKey }) => {
    const val = form[fieldKey]
    return (
      <div>
        <LBL>{label}</LBL>
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          <button type="button" onClick={() => pickFile(null, fieldKey)}
            style={{ padding:'7px 12px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:'#fff', fontSize:'12px', cursor:'pointer', color:C.muted, fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            📎 파일 선택
          </button>
          {val?.name
            ? <span style={{ fontSize:'11px', color:C.primary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'120px' }}>{val.name}</span>
            : <span style={{ fontSize:'11px', color:'#d1d5db' }}>미첨부</span>
          }
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div style={{ background:'#fff', borderRadius:'18px', width:'640px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', padding:'28px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>
            {mode === 'add' ? '➕ 선생님 등록' : '✏️ 선생님 정보 수정'}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
        </div>

        {/* 기본 정보 */}
        <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'10px', letterSpacing:'.8px' }}>기본 정보</div>
        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div>
            <LBL>연도 *</LBL>
            <input style={iSt2} type="number" value={form.year}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              placeholder="2026" />
          </div>
          <div>
            <LBL>학교명</LBL>
            <input style={iSt2} value={form.schoolName}
              onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))}
              placeholder={session.admin?.schoolName || '학교명'} />
          </div>
          <div>
            <LBL>선생님 이름(본명) *</LBL>
            <input style={iSt2} value={form.teacherName}
              onChange={e => setForm(f => ({ ...f, teacherName: e.target.value }))}
              placeholder="실명" />
          </div>
        </div>

        {/* 과목 선택 */}
        <div style={{ marginBottom:'10px' }}>
          <LBL>과목 *</LBL>
          {subjects.length > 0 ? (
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
              {subjects.map(s => (
                <button key={s.id} type="button"
                  onClick={() => setForm(f => ({ ...f, subject: s.name }))}
                  style={{
                    padding:'6px 14px', borderRadius:'999px', border:'none', cursor:'pointer',
                    fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:form.subject===s.name?700:400,
                    background: form.subject===s.name ? '#1e3a5f' : '#e5e7eb',
                    color: form.subject===s.name ? '#fff' : C.muted,
                    transition:'all .15s',
                  }}>
                  {s.name}
                </button>
              ))}
            </div>
          ) : null}
          <input style={iSt2} value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="과목 선택 또는 직접 입력" />
        </div>

        {/* 요일 클릭 선택 */}
        <div style={{ marginBottom:'10px' }}>
          <LBL>수업 요일 *</LBL>
          <div style={{ display:'flex', gap:'8px' }}>
            {DAYS_LIST.map(day => (
              <button key={day} type="button" onClick={() => toggleDay(day)}
                style={{
                  width:'40px', height:'40px', borderRadius:'50%', border:'none',
                  cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                  fontSize:'14px', fontWeight:700,
                  background: selectedDays.includes(day) ? '#1e3a5f' : '#e5e7eb',
                  color: selectedDays.includes(day) ? '#fff' : C.muted,
                  transition:'all .15s',
                }}>
                {day}
              </button>
            ))}
          </div>
          {selectedDays.length > 0 && (
            <div style={{ fontSize:'12px', color:C.primary, marginTop:'6px' }}>
              선택: {form.days}요일
            </div>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div>
            <LBL>전화번호 *</LBL>
            <input style={iSt2} value={form.teacherPhone}
              onChange={e => setForm(f => ({ ...f, teacherPhone: e.target.value }))}
              placeholder="010-0000-0000" />
          </div>
          <div>
            <LBL>이메일 * (앱 연결 키)</LBL>
            <input style={iSt2} type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="teacher@email.com" />
          </div>
        </div>

        {/* 계약 기간 */}
        <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, margin:'14px 0 10px', letterSpacing:'.8px' }}>계약 기간</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div>
            <LBL>시작 날짜</LBL>
            <input style={iSt2} type="date" value={form.startDate||''}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <LBL>마감 날짜</LBL>
            <input style={iSt2} type="date" value={form.endDate||''}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>

        {/* 첨부 서류 */}
        <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, margin:'16px 0 10px', letterSpacing:'.8px' }}>첨부 서류</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'24px' }}>
          <FilePicker label="수강료 통장사본"       fieldKey="feeAccount"    />
          <FilePicker label="교구업체 사업자등록증"  fieldKey="vendorBiz"     />
          <FilePicker label="교구업체 통장사본"      fieldKey="vendorAccount" />
        </div>

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <Btn color="secondary" onClick={onClose}>취소</Btn>
          <Btn onClick={onSave}>{mode==='add' ? '등록' : '수정 저장'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ── 선생님 상세 보기 모달
function TeacherDetailModal({ t, onClose }) {
  const FileView = ({ label, field }) => (
    <div style={{ marginBottom:'10px' }}>
      <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>{label}</div>
      {field?.data
        ? field.data.startsWith('data:image')
          ? <img src={field.data} alt={label} style={{ maxWidth:'100%', maxHeight:'160px', borderRadius:'8px', border:`1px solid ${C.border}` }} />
          : <a href={field.data} download={field.name} style={{ fontSize:'12px', color:C.primary }}>📎 {field.name} 다운로드</a>
        : <span style={{ fontSize:'12px', color:'#d1d5db' }}>미첨부</span>
      }
    </div>
  )
  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:'18px', width:'500px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', padding:'28px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>👩‍🏫 {t.teacherName} 선생님</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
        </div>
        {[
          ['연도', t.year], ['학교명', t.schoolName], ['과목', t.subject],
          ['요일', t.days ? t.days+'요일' : '-'], ['전화번호', t.teacherPhone], ['이메일', t.email],
          ['시작 날짜', t.startDate || '-'], ['마감 날짜', t.endDate || '-'],
        ].map(([k,v]) => (
          <div key={k} style={{ display:'flex', gap:'12px', padding:'9px 0', borderBottom:`1px solid ${C.border}`, fontSize:'13px' }}>
            <span style={{ color:C.muted, width:'110px', flexShrink:0 }}>{k}</span>
            <span style={{ color:C.text, fontWeight:500 }}>{v||'-'}</span>
          </div>
        ))}
        <div style={{ marginTop:'16px' }}>
          <FileView label="수강료 통장사본"       field={t.feeAccount}     />
          <FileView label="교구업체 사업자등록증"  field={t.vendorBiz}      />
          <FileView label="교구업체 통장사본"      field={t.vendorAccount}  />
        </div>
      </div>
    </div>
  )
}

// ── 선생님 현황 탭
function TeachersTab({ session }) {
  const { success, error } = useToast()
  const confirm = useSchoolConfirm()
  const [teachers,   setTeachers]   = useState([])
  const [subjects,   setSubjects]   = useState([]) // 이 학교·연도 과목 목록
  const [loading,    setLoading]    = useState(true)
  const [modalMode,  setModalMode]  = useState(null) // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [selYear,    setSelYear]    = useState(CURRENT_YEAR)

  const EMPTY = {
    year: CURRENT_YEAR, schoolName: session.admin?.schoolName || '',
    teacherName: '', subject: '', days: '', teacherPhone: '', email: '',
    startDate: '', endDate: '',
    feeAccount: null, vendorBiz: null, vendorAccount: null,
  }
  const [form, setForm] = useState(EMPTY)

  const load = async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([
        DB.teachers(session.adminId),
        dbCall('getAll', 'schoolSubjects').then(d =>
          (d||[]).filter(s => s.adminId === session.adminId && s.active !== false && s.year == CURRENT_YEAR)
        ),
      ])
      setTeachers(t)
      setSubjects(s)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const validate = (f) => {
    if (!String(f.year).trim())  { error('연도를 입력해주세요.');       return false }
    if (!f.teacherName.trim())   { error('선생님 이름을 입력해주세요.'); return false }
    if (!f.subject.trim())       { error('과목을 선택해주세요.');        return false }
    if (!f.days.trim())          { error('요일을 선택해주세요.');        return false }
    if (!f.teacherPhone.trim())  { error('전화번호를 입력해주세요.');    return false }
    if (!f.email.trim())         { error('이메일을 입력해주세요.');      return false }
    const dup = teachers.filter(t =>
      t.year == f.year &&
      t.email?.toLowerCase() === f.email.trim().toLowerCase() &&
      (!editTarget || t.id !== editTarget.id)
    )
    if (dup.length) { error('동일 연도에 같은 이메일이 이미 등록되어 있습니다.'); return false }
    return true
  }

  const baseData = (f) => ({
    adminId: session.adminId,
    schoolName: f.schoolName || session.admin?.schoolName || '',
    year: Number(f.year),
    teacherName: f.teacherName.trim(),
    subject: f.subject.trim(),
    days: f.days.trim(),
    teacherPhone: f.teacherPhone.trim(),
    email: f.email.trim().toLowerCase(),
    startDate: f.startDate || null,
    endDate: f.endDate || null,
    feeAccount: f.feeAccount || null,
    vendorBiz: f.vendorBiz || null,
    vendorAccount: f.vendorAccount || null,
    active: true,
  })

  const handleAdd = async () => {
    if (!validate(form)) return
    await DB.saveTeacher({ id: uid(), teacherId: uid(), createdAt: now(), ...baseData(form) })
    setModalMode(null); setForm(EMPTY)
    success('선생님이 등록되었습니다.'); load()
  }

  const handleEdit = async () => {
    if (!validate(form)) return
    await dbCall('update', 'schoolAdminTeachers', { id: editTarget.id, patch: baseData(form) })
    setModalMode(null); setEditTarget(null); setForm(EMPTY)
    success('수정되었습니다.'); load()
  }

  const openEdit = (t) => {
    setEditTarget(t)
    setForm({
      year: t.year || CURRENT_YEAR, schoolName: t.schoolName || '',
      teacherName: t.teacherName || '', subject: t.subject || '',
      days: t.days || '', teacherPhone: t.teacherPhone || '', email: t.email || '',
      startDate: t.startDate || '', endDate: t.endDate || '',
      feeAccount: t.feeAccount || null, vendorBiz: t.vendorBiz || null, vendorAccount: t.vendorAccount || null,
    })
    setModalMode('edit')
  }

  const removeTeacher = (id) => {
    confirm('선생님을 목록에서 제외하시겠습니까?', async () => {
      await dbCall('update', 'schoolAdminTeachers', { id, patch: { active: false } })
      success('제외되었습니다.'); load()
    })
  }

  const years = [...new Set([CURRENT_YEAR, ...teachers.map(t => t.year).filter(Boolean)])].sort((a,b)=>b-a)
  const filtered = teachers.filter(t => t.year == selYear || (!t.year && selYear === CURRENT_YEAR))
  // 선택된 연도의 과목만
  const yearSubjects = subjects.filter(s => s.year == selYear)

  return (
    <div style={{ padding:'28px', maxWidth:'1100px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>👩‍🏫 선생님 현황</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>담당 학교 방과후 강사 연도별 목록</div>
        </div>
        <Btn onClick={() => { setForm(EMPTY); setEditTarget(null); setModalMode('add') }}>+ 선생님 등록</Btn>
      </div>

      {/* 연도 탭 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelYear(y)} style={{
            padding:'6px 18px', borderRadius:'999px', border:'none', cursor:'pointer',
            fontFamily:'Noto Sans KR, sans-serif', fontWeight:selYear===y?700:400, fontSize:'13px',
            background:selYear===y?'#1e3a5f':'#e5e7eb', color:selYear===y?'#fff':C.muted,
          }}>
            {y}년{y===CURRENT_YEAR&&<span style={{ fontSize:'10px', opacity:.8 }}> 올해</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.muted, background:'#f8fafc', borderRadius:'14px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>👩‍🏫</div>
          <div style={{ fontWeight:600 }}>{selYear}년 등록된 선생님이 없습니다.</div>
          <div style={{ fontSize:'12px', marginTop:'6px' }}>위의 "+ 선생님 등록" 버튼으로 추가하세요.</div>
        </div>
      ) : (
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr 110px', padding:'10px 16px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
            <span>이름</span><span>과목·요일</span><span>계약 기간</span><span>전화번호</span><span>이메일</span><span>서류</span><span></span>
          </div>
          {filtered.map((t, i) => (
            <div key={t.id} style={{
              display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr 110px',
              padding:'12px 16px', borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none', alignItems:'center',
            }}>
              <span style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{t.teacherName}</span>
              <div>
                <div style={{ fontSize:'13px', color:C.text }}>{t.subject||'-'}</div>
                <div style={{ fontSize:'11px', color:C.muted }}>{t.days ? t.days+'요일' : '-'}</div>
              </div>
              <div>
                {t.startDate
                  ? <><div style={{ fontSize:'12px', color:C.text }}>{t.startDate}</div>
                      <div style={{ fontSize:'11px', color:C.muted }}>~ {t.endDate||'미정'}</div></>
                  : <span style={{ fontSize:'12px', color:'#d1d5db' }}>미설정</span>
                }
              </div>
              <span style={{ fontSize:'13px', color:C.muted }}>{t.teacherPhone||'-'}</span>
              <span style={{ fontSize:'12px', color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.email||'-'}</span>
              <div style={{ fontSize:'11px', color:C.muted }}>
                {[t.feeAccount&&'통장', t.vendorBiz&&'사업자', t.vendorAccount&&'업체통장'].filter(Boolean).join(' · ')||'-'}
              </div>
              <div style={{ display:'flex', gap:'4px' }}>
                <button onClick={() => setDetailItem(t)} style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f8fafc', color:C.muted, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>상세</button>
                <button onClick={() => openEdit(t)}       style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f8fafc', color:C.muted, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                <button onClick={() => removeTeacher(t.id)} style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>제외</button>
              </div>
            </div>
          ))}
          <div style={{ padding:'10px 16px', background:'#f8fafc', borderTop:`1px solid ${C.border}`, fontSize:'12px', color:C.muted, textAlign:'right' }}>
            {selYear}년 총 <strong style={{ color:C.text }}>{filtered.length}명</strong>
          </div>
        </div>
      )}

      {modalMode && (
        <TeacherFormModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          session={session}
          subjects={yearSubjects}
          onSave={modalMode==='add' ? handleAdd : handleEdit}
          onClose={() => { setModalMode(null); setEditTarget(null); setForm(EMPTY) }}
        />
      )}
      {detailItem && <TeacherDetailModal t={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  )
}

// ── 학생 현황 탭

// ── 공휴일 목록
const SCH_HOLIDAYS = {
  2025:[
    '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-03-01',
    '2025-05-05','2025-05-06','2025-05-13','2025-06-06','2025-08-15',
    '2025-10-03','2025-10-05','2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-12-25',
  ],
  2026:[
    '2026-01-01','2026-01-28','2026-01-29','2026-01-30','2026-03-01',
    '2026-05-05','2026-05-24','2026-06-03','2026-06-06','2026-08-15',
    '2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-09','2026-12-25',
  ],
  2027:[
    '2027-01-01','2027-02-16','2027-02-17','2027-02-18','2027-03-01',
    '2027-05-05','2027-05-13','2027-06-06','2027-08-15',
    '2027-09-14','2027-09-15','2027-09-16','2027-10-03','2027-10-09','2027-12-25',
  ],
}
const SCH_HOLIDAY_NAMES = {
  '2025-01-01':'신정','2025-01-28':'설날','2025-01-29':'설날','2025-01-30':'설날',
  '2025-03-01':'삼일절','2025-05-05':'어린이날','2025-05-06':'어린이날 대체',
  '2025-05-13':'부처님오신날','2025-06-06':'현충일','2025-08-15':'광복절',
  '2025-10-03':'개천절','2025-10-05':'추석','2025-10-06':'추석','2025-10-07':'추석',
  '2025-10-08':'추석 대체','2025-10-09':'한글날','2025-12-25':'성탄절',
  '2026-01-01':'신정','2026-01-28':'설날','2026-01-29':'설날','2026-01-30':'설날',
  '2026-03-01':'삼일절','2026-05-05':'어린이날','2026-05-24':'부처님오신날',
  '2026-06-03':'지방선거일','2026-06-06':'현충일','2026-08-15':'광복절',
  '2026-09-24':'추석','2026-09-25':'추석','2026-09-26':'추석',
  '2026-10-03':'개천절','2026-10-09':'한글날','2026-12-25':'성탄절',
}

function schEmptyForm() {
  return {
    organization:'', className:'', section:'',
    termType:'semester', termCount:4, termSizes:[4,4,4,4],
    days:[], repeatType:'every', time:'', timeEnd:'',
    startDate:'', endDate:'', description:'',
    cancelledDates:[], makeupDates:[],
    alarm:{ enabled:false, minutesBefore:10 },
    alarmEnd:{ enabled:false, minutesBefore:10 },
    promotionImgs:[], noticeFiles:[], templateFile:null,
  }
}


// ══════════════════════════════════════════════════════
// 연간 수업 달력 탭 (학교 담당자 전용 — schoolCalendar 테이블)
// ══════════════════════════════════════════════════════
const DAY_ORDER_CAL = ['월','화','수','목','금','토','일']

function schCalEmptyForm() {
  return {
    title: '',           // 일정명 (예: 2026 로봇과학 월요일)
    days: [],            // 요일 배열
    termType: 'semester',
    termCount: 4,
    termSizes: [4,4,4,4],
    repeatType: 'every',
    startDate: '', endDate: '',
    cancelledDates: [],
    makeupDates: [],
    memo: '',
  }
}

function SchoolCalendarTab({ session }) {
  const { success, error } = useToast()
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selItem,  setSelItem]  = useState(null)
  const [delId,    setDelId]    = useState(null)
  const [selYear,  setSelYear]  = useState(String(CURRENT_YEAR))

  const load = React.useCallback(async () => {
    setLoading(true)
    const data = await dbCall('getAll','schoolCalendar').catch(() => [])
    const mine = (data||[]).filter(c => c.adminId === session.adminId)
    setItems(mine)
    if (mine.length > 0 && !selItem) setSelItem(mine[0])
    setLoading(false)
  }, [session.adminId])

  useEffect(() => { load() }, [load])

  const yearItems = items.filter(c => c.startDate?.slice(0,4) === selYear)
  const years = [...new Set(items.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort().reverse()

  const del = async (id) => {
    try {
      await dbCall('delete','schoolCalendar',{ id })
      success('삭제되었습니다.')
      setDelId(null)
      if (selItem?.id === id) setSelItem(yearItems.find(i => i.id !== id) || null)
      load()
    } catch { error('삭제 중 오류가 발생했습니다.') }
  }

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:C.muted }}>불러오는 중...</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:'100vh' }}>

      {/* 상단: 연도 탭 */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 24px', borderBottom:`1px solid ${C.border}`, background:'#fff', flexShrink:0 }}>
        <span style={{ fontSize:'13px', fontWeight:700, color:C.text, marginRight:'4px' }}>📅 연간 수업 달력</span>
        {(years.length>0 ? years : [String(CURRENT_YEAR)]).map(y => (
          <button key={y} onClick={() => { setSelYear(y); setSelItem(items.find(c=>c.startDate?.slice(0,4)===y)||null) }}
            style={{ padding:'6px 16px', borderRadius:'20px', border:'none', cursor:'pointer',
              background:selYear===y?'#1e3a5f':'#e5e7eb',
              color:selYear===y?'#fff':C.text,
              fontWeight:selYear===y?700:400,
              fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif' }}>{y}년</button>
        ))}
        {/* 저장된 일정 목록 */}
        {yearItems.map(item => {
          const isSel = selItem?.id === item.id
          const isDelConfirm = delId === item.id
          return (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              {isDelConfirm ? (
                <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', background:'#fef2f2', borderRadius:'8px', border:'1px solid #fca5a5' }}>
                  <span style={{ fontSize:'12px', color:'#ef4444' }}>삭제?</span>
                  <button onClick={() => setDelId(null)} style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>취소</button>
                  <button onClick={() => del(item.id)} style={{ padding:'2px 8px', borderRadius:'5px', border:'none', background:'#ef4444', color:'#fff', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 12px',
                  borderRadius:'20px', border:`1.5px solid ${isSel?C.primary:C.border}`,
                  background:isSel?'#eff6ff':'#fff', cursor:'pointer' }}
                  onClick={() => setSelItem(item)}>
                  <span style={{ fontSize:'12px', fontWeight:isSel?700:400, color:isSel?C.primary:C.text }}>{item.title||'(제목없음)'}</span>
                  <button onClick={e=>{e.stopPropagation();setDelId(item.id)}}
                    style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:'14px', padding:'0', lineHeight:1, marginLeft:'2px' }}>×</button>
                </div>
              )}
            </div>
          )
        })}
        {yearItems.length===0 && (
          <span style={{ fontSize:'12px', color:C.muted }}>아래에서 일정명 입력 후 저장하세요</span>
        )}
      </div>

      {/* 본문: 달력 */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <SchoolCalendar
          session={session}
          cls={selItem || { year: parseInt(selYear), cancelledDates:[], makeupDates:[], days:[], termType:'quarter', quarters:4, quarterTermCounts:[3,3,3,3], sessionsPerTerm:4 }}
          onUpdate={async (updated) => {
            try {
              if (selItem) {
                await dbCall('update','schoolCalendar',{ id:selItem.id, patch:{ ...updated } })
                const merged = {...selItem, ...updated}
                setSelItem(merged)
                setItems(prev => prev.map(it => it.id===selItem.id ? merged : it))
              } else {
                const newItem = { ...updated, id:uid(), adminId:session.adminId, schoolName:session.admin?.schoolName||'', createdAt:now() }
                await dbCall('upsert','schoolCalendar',{ data: newItem })
                setSelItem(newItem)
                setItems(prev => [...prev, newItem])
                success('일정이 저장되었습니다.')
              }
            } catch { error('저장 중 오류가 발생했습니다.') }
          }}
        />
      </div>
    </div>
  )
}


// ── 수업 관리 탭
function SchoolClassesTab({ session }) {
  const { success, error } = useToast()
  const [teachers,    setTeachers]    = useState([])
  const [selTeacher,  setSelTeacher]  = useState(null)
  const [classes,     setClasses]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editId,      setEditId]      = useState(null)
  const [form,        setForm]        = useState(schEmptyForm())
  const [tab,         setTab]         = useState('info')
  const [deleteId,    setDeleteId]    = useState(null)
  const [selYear,     setSelYear]     = useState('')
  const [view,        setView]        = useState('요일별')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // 선생님 목록 로드
  useEffect(() => {
    DB.teachers(session.adminId).then(t => {
      setTeachers(t)
      if (t.length > 0) setSelTeacher(t[0])
      setLoading(false)
    })
  }, [session.adminId])

  // 선택된 선생님 수업 로드
  const loadClasses = React.useCallback(async () => {
    if (!selTeacher?.teacherId) { setClasses([]); return }
    const data = await dbCall('getAll','classes').catch(() => [])
    setClasses((data||[]).filter(c => c.teacherId === selTeacher.teacherId))
  }, [selTeacher?.teacherId])

  useEffect(() => { loadClasses() }, [loadClasses])

  const t = getToday()
  const years = [...new Set(classes.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const filtered = selYear ? classes.filter(c => c.startDate?.startsWith(selYear)) : classes

  // 그룹핑
  const DAY_ORDER_SCH = ['월','화','수','목','금','토','일']
  const grouped = {}
  filtered.forEach(cls => {
    const key = view==='요일별' ? (cls.days?.join(', ')||'미설정')
              : view==='학교별' ? (cls.organization||'미설정')
              : (cls.className||'미설정')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(cls)
  })
  const sortedKeys = Object.keys(grouped).sort((a,b) => {
    if (view==='요일별') return (DAY_ORDER_SCH.indexOf(a.split(', ')[0])??99) - (DAY_ORDER_SCH.indexOf(b.split(', ')[0])??99)
    return a.localeCompare(b)
  })

  const openAdd = () => {
    setForm({ ...schEmptyForm(), organization: selTeacher?.schoolName||session.admin?.schoolName||'' })
    setEditId(null); setTab('info'); setShowModal(true)
  }
  const openEdit = (cls) => {
    setForm({ ...schEmptyForm(), ...cls,
      termCount: cls.termCount||4, termSizes: cls.termSizes?.length>0?cls.termSizes:[4,4,4,4],
      cancelledDates: cls.cancelledDates||[], makeupDates: cls.makeupDates||[],
      alarm: cls.alarm||{enabled:false,minutesBefore:10},
      alarmEnd: cls.alarmEnd||{enabled:false,minutesBefore:10},
    })
    setEditId(cls.id); setTab('info'); setShowModal(true)
  }

  const save = async () => {
    if (!form.organization.trim()||!form.className.trim()||!form.days.length||!form.startDate||!form.endDate) {
      error('필수 항목을 입력하세요 (단체명, 수업명, 요일, 기간)'); return
    }
    try {
      if (editId) {
        await dbCall('update','classes',{ id:editId, patch:{ ...form } })
        success('수정되었습니다.')
      } else {
        const newId = uid()
        await dbCall('upsert','classes',{ data:{ ...form, id:newId, teacherId:selTeacher.teacherId, createdAt:now() } })
        success('등록되었습니다.')
      }
      setShowModal(false); loadClasses()
    } catch { error('저장 중 오류가 발생했습니다.') }
  }

  const del = async () => {
    try {
      await dbCall('delete','classes',{ id:deleteId })
      success('삭제되었습니다.')
      setDeleteId(null); loadClasses()
    } catch { error('삭제 중 오류가 발생했습니다.') }
  }

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:C.muted }}>불러오는 중...</div>

  return (
    <div style={{ display:'flex', minHeight:'100%' }}>
      {/* 선생님 선택 사이드 */}
      <div style={{ width:'160px', flexShrink:0, borderRight:`1px solid ${C.border}`, padding:'16px 10px', background:'#f8fafc' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>선생님 선택</div>
        {teachers.map(t => (
          <button key={t.id} onClick={() => setSelTeacher(t)} style={{
            width:'100%', padding:'8px 10px', borderRadius:'10px', marginBottom:'4px',
            border:`1.5px solid ${selTeacher?.id===t.id?C.primary:C.border}`,
            background: selTeacher?.id===t.id?'#eff6ff':'#fff',
            color: selTeacher?.id===t.id?C.primary:C.text,
            fontSize:'12px', fontWeight: selTeacher?.id===t.id?700:400,
            cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif',
          }}>
            <div>{t.teacherName}</div>
            <div style={{ fontSize:'10px', color:C.muted }}>{t.subject||''}</div>
          </button>
        ))}
      </div>

      {/* 메인 */}
      <div style={{ flex:1, padding:'24px', overflowY:'auto' }}>
        {!selTeacher ? (
          <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>선생님을 선택하세요</div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div>
                <div style={{ fontSize:'18px', fontWeight:800, color:C.text }}>📚 수업 관리</div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{selTeacher.teacherName} 선생님</div>
              </div>
              <Btn onClick={openAdd}>+ 수업 등록</Btn>
            </div>

            {/* 연도 필터 */}
            {years.length > 0 && (
              <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
                <button onClick={() => setSelYear('')} style={{ padding:'5px 12px', borderRadius:'8px', border:'none', cursor:'pointer', background:selYear===''?'#18181b':'#f3f4f6', color:selYear===''?'#fff':'#374151', fontWeight:selYear===''?700:400, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>전체</button>
                {years.map(y => (
                  <button key={y} onClick={() => setSelYear(y)} style={{ padding:'5px 12px', borderRadius:'8px', border:'none', cursor:'pointer', background:selYear===y?'#18181b':'#f3f4f6', color:selYear===y?'#fff':'#374151', fontWeight:selYear===y?700:400, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>{y}년</button>
                ))}
              </div>
            )}

            {/* 뷰 탭 */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
              {['요일별','학교별','과목별'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', background:view===v?'#f97316':'#f3f4f6', color:view===v?'#fff':'#374151', fontWeight:view===v?600:400, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif' }}>{v}</button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', color:C.muted, background:C.bg, borderRadius:'12px', border:`1px dashed ${C.border}` }}>
                등록된 수업이 없습니다. + 수업 등록 버튼을 눌러 추가하세요.
              </div>
            ) : (
              sortedKeys.map(group => (
                <div key={group} style={{ marginBottom:'24px' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af', marginBottom:'8px' }}>
                    {view==='요일별' ? `${group} 수업` : group}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:'12px' }}>
                    {grouped[group].map(cls => {
                      const sessions = calcSessionDates(cls)
                      const upcoming = sessions.find(d => d >= t)
                      return (
                        <div key={cls.id} onClick={() => openEdit(cls)} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', cursor:'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background=C.card}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                            <div>
                              <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{cls.className}</div>
                              {cls.section && <div style={{ fontSize:'11px', color:C.muted }}>{cls.section}반</div>}
                            </div>
                            <span style={{ fontSize:'11px', fontWeight:700, background:'#fff7ed', color:'#f97316', padding:'2px 8px', borderRadius:'999px' }}>{cls.days?.join(', ')}</span>
                          </div>
                          <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>{cls.organization}</div>
                          <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'10px' }}>
                            📅 {cls.startDate?.slice(5)} ~ {cls.endDate?.slice(5)}
                            {cls.time && ` · 🕐 ${cls.time}`}
                          </div>
                          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'10px' }}>
                            <span style={{ fontSize:'11px', background:'#eff6ff', color:C.primary, padding:'2px 7px', borderRadius:'999px', fontWeight:600 }}>총 {sessions.length}차시</span>
                            {upcoming && <span style={{ fontSize:'11px', background:'#fffbeb', color:'#d97706', padding:'2px 7px', borderRadius:'999px', fontWeight:600 }}>다음 {upcoming.slice(5)}</span>}
                          </div>
                          <div style={{ display:'flex', justifyContent:'flex-end', gap:'6px' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(cls)} style={{ padding:'5px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>편집</button>
                            <button onClick={() => setDeleteId(cls.id)} style={{ padding:'5px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* 수업 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '수업 편집' : '수업 등록'} width={660}>
        {/* 서브탭 */}
        <div style={{ display:'flex', gap:'0', marginBottom:'20px', borderBottom:`1px solid ${C.border}`, overflowX:'auto' }}>
          {[
            { key:'info',     label:'기본 정보' },
            { key:'calendar', label:'수업 달력' },
          ].map(s => (
            <button key={s.key} onClick={() => setTab(s.key)} style={{
              padding:'10px 16px', border:'none', cursor:'pointer', background:'none', whiteSpace:'nowrap',
              color: tab===s.key?'#f97316':'#9ca3af',
              fontWeight: tab===s.key?700:400, fontSize:'14px',
              borderBottom: tab===s.key?'2px solid #f97316':'2px solid transparent',
              fontFamily:'Noto Sans KR, sans-serif', marginBottom:'-1px',
            }}>{s.label}</button>
          ))}
        </div>

        {/* 기본 정보 */}
        {tab === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <Input label="단체명(학교명)" value={form.organization} onChange={v => set('organization',v)} required />
              <Input label="수업명(과목)" value={form.className} onChange={v => set('className',v)} required />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
              <Input label="반 (선택)" value={form.section} onChange={v => set('section',v)} />
              <Input label="시작시간" value={form.time} onChange={v => set('time',v)} placeholder="09:00" />
              <Input label="종료시간" value={form.timeEnd} onChange={v => set('timeEnd',v)} placeholder="10:00" />
            </div>
            <Select label="수업 운영 방식" value={form.termType} onChange={v => set('termType',v)} options={TERM_TYPES} required />
            <div>
              <div style={{ fontSize:'13px', fontWeight:500, color:C.text, marginBottom:'8px' }}>수업 요일 <span style={{ color:'#ef4444' }}>*</span></div>
              <DayPicker value={form.days} onChange={v => set('days',v)} />
            </div>
            <div>
              <div style={{ fontSize:'13px', fontWeight:500, color:C.text, marginBottom:'8px' }}>반복 패턴</div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {[{ value:'every', label:'매주' }, ...REPEAT_TYPES.filter(r => r.value !== 'every')].map(rt => (
                  <button key={rt.value} type="button" onClick={() => set('repeatType', rt.value)} style={{
                    padding:'7px 14px', borderRadius:'8px',
                    border:`1.5px solid ${form.repeatType===rt.value?'#f97316':'#e5e7eb'}`,
                    background: form.repeatType===rt.value?'#f97316':'#fff',
                    color: form.repeatType===rt.value?'#fff':'#374151',
                    fontSize:'13px', fontWeight: form.repeatType===rt.value?700:400,
                    cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                  }}>{rt.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <Input label="수업 시작일" value={form.startDate} onChange={v => set('startDate',v)} type="date" required />
              <Input label="수업 종료일" value={form.endDate} onChange={v => set('endDate',v)} type="date" required />
            </div>
            {/* 텀 설정 */}
            <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'12px', padding:'14px 16px' }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:'#ea580c', marginBottom:'10px' }}>📅 텀 구성</div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                <span style={{ fontSize:'12px', fontWeight:600, color:C.text }}>총 텀 수</span>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} type="button" onClick={() => {
                    const prev = form.termSizes||[4]
                    const next = Array.from({length:n},(_,i) => prev[i]||4)
                    set('termCount',n); set('termSizes',next)
                  }} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:700, background:(form.termCount||4)===n?'#f97316':'#f3f4f6', color:(form.termCount||4)===n?'#fff':'#374151' }}>{n}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {Array.from({length:form.termCount||4},(_,i) => {
                  const sizes = form.termSizes||[4,4,4,4]
                  return (
                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
                      <label style={{ fontSize:'11px', color:'#ea580c', fontWeight:700 }}>{i+1}텀</label>
                      <input type="number" min="1" max="99" value={sizes[i]||4}
                        onChange={e => { const next=[...sizes]; next[i]=parseInt(e.target.value)||1; set('termSizes',next) }}
                        style={{ width:'48px', padding:'6px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'13px', textAlign:'center', outline:'none' }} />
                    </div>
                  )
                })}
              </div>
            </div>
            {/* 공휴일 추가 */}
            <div style={{ background:'#fafafa', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'14px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px' }}>📌 휴일 추가</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'8px' }}>
                <input type="date" min={form.startDate} max={form.endDate}
                  style={{ padding:'7px 10px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', outline:'none' }}
                  onChange={e => {
                    const date=e.target.value; if(!date) return
                    if((form.cancelledDates||[]).some(c=>c.date===date)) { error('이미 추가된 날짜입니다.'); return }
                    setForm(f=>({...f, cancelledDates:[...(f.cancelledDates||[]),{date,reason:'school_holiday',memo:''}]}))
                    e.target.value=''
                  }} />
                <select style={{ padding:'7px 10px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', background:'#fff', outline:'none' }}
                  onChange={e => {
                    const date=e.target.value; if(!date) return
                    if(!(form.cancelledDates||[]).some(c=>c.date===date))
                      setForm(f=>({...f, cancelledDates:[...(f.cancelledDates||[]),{date,reason:'public_holiday',memo:SCH_HOLIDAY_NAMES[date]||'공휴일'}]}))
                    e.target.value=''
                  }} defaultValue="">
                  <option value="">공휴일 빠른 추가</option>
                  {(SCH_HOLIDAYS[parseInt(form.startDate?.slice(0,4))]||SCH_HOLIDAYS[2026]||[]).map(d => (
                    <option key={d} value={d}>{d.slice(5)} {SCH_HOLIDAY_NAMES[d]||''}</option>
                  ))}
                </select>
              </div>
              {(form.cancelledDates||[]).length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                  {[...(form.cancelledDates||[])].sort((a,b)=>a.date.localeCompare(b.date)).map((c,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 10px', background:'#fff', borderRadius:'7px', border:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:'12px', fontWeight:600, color:C.text, minWidth:'70px' }}>{c.date.slice(5)}</span>
                      <span style={{ fontSize:'11px', color:C.muted, flex:1 }}>{c.memo||c.reason}</span>
                      <button onClick={() => setForm(f=>({...f, cancelledDates:(f.cancelledDates||[]).filter((_,j)=>j!==i)}))}
                        style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'16px', padding:'0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Textarea label="메모 (선택)" value={form.description} onChange={v => set('description',v)} rows={2} />
          </div>
        )}

        {/* 수업 달력 */}
        {tab === 'calendar' && (
          <SchoolCalendar cls={form} onUpdate={updated => setForm(updated)} />
        )}

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'20px', paddingTop:'16px', borderTop:`1px solid ${C.border}` }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>취소</Btn>
          <Btn onClick={save}>{editId ? '저장' : '등록'}</Btn>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="수업 삭제" width={360}>
        <p style={{ fontSize:'14px', color:C.text, marginBottom:'20px' }}>정말 삭제하시겠습니까?</p>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <Btn color="secondary" onClick={() => setDeleteId(null)}>취소</Btn>
          <Btn color="danger" onClick={del}>삭제</Btn>
        </div>
      </Modal>
    </div>
  )
}

function StudentsTab({ session }) {
  const [teachers,   setTeachers]   = useState([])
  const [classMap,   setClassMap]   = useState({}) // teacherId → classes[]
  const [studentMap, setStudentMap] = useState({}) // teacherId → students[]
  const [loading,    setLoading]    = useState(true)
  const [selTeacher, setSelTeacher] = useState(null)
  const [selYear,    setSelYear]    = useState(String(CURRENT_YEAR))
  const [selSection, setSelSection] = useState('A')  // 'A' | 'B' | 'all'

  useEffect(() => {
    async function load() {
      setLoading(true)
      const t = await DB.teachers(session.adminId)
      setTeachers(t)
      const cMap = {}, sMap = {}
      await Promise.all(t.map(async teacher => {
        if (!teacher.teacherId) return
        const [classes, students] = await Promise.all([
          dbCall('where', 'classes', { where: { teacherId: teacher.teacherId } }).catch(() => []),
          dbCall('where', 'students', { where: { teacherId: teacher.teacherId } }).catch(() => []),
        ])
        cMap[teacher.teacherId] = classes || []
        sMap[teacher.teacherId] = students || []
      }))
      setClassMap(cMap)
      setStudentMap(sMap)
      if (t.length > 0) setSelTeacher(t[0])
      setLoading(false)
    }
    load()
  }, [session.adminId])

  const TERM_LABEL = { semester: '학기제', quarter: '분기제', monthly: '월정액', custom: '자유' }

  // 선택된 선생님의 수업 목록
  const allClasses = selTeacher ? (classMap[selTeacher.teacherId] || []) : []

  // 연도 목록
  const years = [...new Set(allClasses.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort().reverse()
  if (years.length > 0 && !years.includes(selYear)) { /* no-op, selYear유지 */ }

  // 선택 연도의 수업만
  const yearClasses = allClasses.filter(c => c.startDate?.slice(0,4) === selYear)

  // termType / termCount 요약 (해당 연도 수업들 중 첫번째 기준)
  const refClass = yearClasses[0]
  const termLabel = refClass ? (TERM_LABEL[refClass.termType] || refClass.termType || '-') : '-'
  const termCount = refClass ? (refClass.termCount || '-') : '-'

  // 반(section) 목록
  const sections = [...new Set(yearClasses.map(c => c.section || 'A').filter(Boolean))].sort()

  // 선택된 반의 수업
  const filteredClasses = selSection === 'all'
    ? yearClasses
    : yearClasses.filter(c => (c.section || 'A') === selSection)

  // 해당 수업들의 classId 셋
  const classIdSet = new Set(filteredClasses.map(c => c.id))

  // 학생 리스트 — 해당 수업 중 하나라도 포함된 학생
  const allStudents = selTeacher ? (studentMap[selTeacher.teacherId] || []) : []
  const filteredStudents = allStudents.filter(s =>
    (s.classIds || []).some(cid => classIdSet.has(cid))
  )

  // 학생별 수강 과목 (중복 표시)
  const getSubjects = (s) => {
    const cids = (s.classIds || []).filter(cid => classIdSet.has(cid))
    return [...new Set(cids.map(cid => {
      const cls = filteredClasses.find(c => c.id === cid)
      return cls ? cls.className : null
    }).filter(Boolean))]
  }

  return (
    <div style={{ padding:'24px' }}>
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>👥 학생 현황</div>
        <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>담당 선생님별 학생 현황을 확인하세요</div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div> : (
        <div style={{ display:'flex', gap:'16px' }}>

          {/* 선생님 목록 */}
          <div style={{ width:'180px', flexShrink:0 }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>선생님 선택</div>
            {teachers.map(t => (
              <button key={t.id} onClick={() => { setSelTeacher(t); setSelYear(String(CURRENT_YEAR)); setSelSection('A') }} style={{
                width:'100%', padding:'10px 14px', borderRadius:'10px',
                border:`1.5px solid ${selTeacher?.id===t.id ? C.primary : C.border}`,
                background: selTeacher?.id===t.id ? '#eff6ff' : C.card,
                color: selTeacher?.id===t.id ? C.primary : C.text,
                fontSize:'13px', fontWeight: selTeacher?.id===t.id ? 700 : 400,
                cursor:'pointer', textAlign:'left', marginBottom:'6px',
                fontFamily:'Noto Sans KR, sans-serif',
              }}>
                <div>{t.teacherName}</div>
                <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{t.subject||''} {t.days ? t.days+'요일' : ''}</div>
              </button>
            ))}
          </div>

          {/* 오른쪽 */}
          <div style={{ flex:1, minWidth:0 }}>
            {!selTeacher ? (
              <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>선생님을 선택하세요</div>
            ) : (
              <>
                {/* 상단 정보 바 */}
                <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'14px 18px', marginBottom:'14px', display:'flex', flexWrap:'wrap', gap:'16px', alignItems:'center' }}>
                  {/* 연도 */}
                  <div>
                    <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>연도</div>
                    <div style={{ display:'flex', gap:'4px' }}>
                      {(years.length > 0 ? years : [String(CURRENT_YEAR)]).map(y => (
                        <button key={y} onClick={() => setSelYear(y)} style={{
                          padding:'4px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:700,
                          border:`1.5px solid ${selYear===y ? C.primary : C.border}`,
                          background: selYear===y ? C.primary : '#fff',
                          color: selYear===y ? '#fff' : C.text,
                          cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                        }}>{y}</button>
                      ))}
                    </div>
                  </div>

                  {/* 학기/분기제 */}
                  <div>
                    <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>운영방식</div>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{termLabel}</div>
                  </div>

                  {/* 텀수 */}
                  <div>
                    <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>텀 수</div>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{termCount}텀</div>
                  </div>

                  {/* 요일 */}
                  <div>
                    <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>요일</div>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                      {[...new Set(yearClasses.flatMap(c => c.days || []))].join('·') || '-'}요일
                    </div>
                  </div>

                  {/* 과목 */}
                  <div>
                    <div style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>과목</div>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                      {[...new Set(yearClasses.map(c => c.className).filter(Boolean))].join(', ') || '-'}
                    </div>
                  </div>
                </div>

                {/* 반 탭 */}
                {sections.length > 0 && (
                  <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                    {sections.length > 1 && (
                      <button onClick={() => setSelSection('all')} style={{
                        padding:'6px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:700,
                        border:`1.5px solid ${selSection==='all' ? C.primary : C.border}`,
                        background: selSection==='all' ? C.primary : '#fff',
                        color: selSection==='all' ? '#fff' : C.text,
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                      }}>전체</button>
                    )}
                    {sections.map(sec => (
                      <button key={sec} onClick={() => setSelSection(sec)} style={{
                        padding:'6px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:700,
                        border:`1.5px solid ${selSection===sec ? C.primary : C.border}`,
                        background: selSection===sec ? C.primary : '#fff',
                        color: selSection===sec ? '#fff' : C.text,
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                      }}>{sec}반</button>
                    ))}
                  </div>
                )}

                {/* 학생 수 요약 */}
                <div style={{ fontSize:'13px', color:C.muted, marginBottom:'8px' }}>
                  확정 <strong style={{ color:C.success }}>{filteredStudents.filter(s=>s.status==='confirmed').length}명</strong> / 전체 <strong>{filteredStudents.length}명</strong>
                </div>

                {/* 학생 테이블 */}
                {filteredStudents.length === 0
                  ? <div style={{ textAlign:'center', padding:'40px', color:C.muted, background:C.bg, borderRadius:'12px', border:`1px dashed ${C.border}` }}>학생 데이터가 없습니다.</div>
                  : (
                    <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'40px 100px 1fr 120px 1fr', padding:'10px 16px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted, textAlign:'center' }}>
                        <span>#</span>
                        <span>학년·반</span>
                        <span>이름</span>
                        <span>전화번호</span>
                        <span>수강 과목</span>
                      </div>
                      {filteredStudents.map((s, i) => {
                        const subjects = getSubjects(s)
                        return (
                          <div key={s.id} style={{ display:'grid', gridTemplateColumns:'40px 100px 1fr 120px 1fr', padding:'10px 16px', borderBottom: i < filteredStudents.length-1 ? `1px solid ${C.border}` : 'none', alignItems:'center', fontSize:'13px', textAlign:'center' }}>
                            <span style={{ color:C.muted }}>{i+1}</span>
                            <span style={{ color:C.muted }}>{s.grade ? `${s.grade}학년` : '-'}{s.classNum ? ` ${s.classNum}반` : ''}</span>
                            <span style={{ fontWeight:600, color:C.text }}>{s.name}</span>
                            <span style={{ color:C.muted, fontSize:'12px' }}>{s.parentPhone || '-'}</span>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', justifyContent:'center' }}>
                              {subjects.length > 0 ? subjects.map((sub, si) => (
                                <span key={si} style={{ fontSize:'11px', fontWeight:600, background:'#eff6ff', color:C.primary, padding:'2px 8px', borderRadius:'999px' }}>{sub}</span>
                              )) : <span style={{ color:C.muted }}>-</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 연결 초대 이메일 (이미 가입된 선생님 → 연결 수락 요청)
async function sendTeacherInviteEmail({ teacherName, email, schoolName, adminName }) {
  const html = `
    <div style="font-family:'Noto Sans KR',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#3b82f6;font-size:22px;margin-bottom:6px">📋 방과후 출석부</h1>
      <p style="color:#374151;font-size:15px;margin-bottom:24px">
        안녕하세요, <strong>${teacherName}</strong> 선생님!<br/>
        <strong>${schoolName}</strong>${adminName ? ` 담당자 <strong>${adminName}</strong>님이` : '에서'} 연결을 요청했습니다.
      </p>
      <div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:14px;color:#1e3a5f;margin-bottom:6px">🏫 학교: <strong>${schoolName}</strong></div>
        ${adminName ? `<div style="font-size:14px;color:#1e3a5f;margin-bottom:16px">👤 담당자: <strong>${adminName}</strong></div>` : ''}
        <p style="font-size:13px;color:#374151;margin-bottom:16px;">
          방과후 출석부 앱 대시보드에 연결 초대장이 도착했습니다.<br/>
          앱에 접속하여 수락해주세요.
        </p>
        <a href="${window.location.origin}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;">
          앱 접속 후 수락하기 →
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.7;">
        본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
  `
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: `[방과후 출석부] ${schoolName} 담당자가 연결을 요청했습니다`,
        html,
      }),
    })
    return res.ok
  } catch { return false }
}

// ── 서비스 가입 초대 이메일 (미가입 선생님 - 가입 안내)
async function sendSignupInviteEmail({ teacherName, email, schoolName, adminName }) {
  const html = `
    <div style="font-family:'Noto Sans KR',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#f97316;font-size:22px;margin-bottom:6px">📋 방과후 출석부</h1>
      <p style="color:#374151;font-size:15px;margin-bottom:24px">
        안녕하세요, <strong>${teacherName}</strong> 선생님!<br/>
        <strong>${schoolName}</strong>${adminName ? ` 담당자 <strong>${adminName}</strong>님이` : '에서'} 방과후 출석부 서비스에 초대했습니다.
      </p>
      <div style="background:#fff7ed;border:2px solid #fdba74;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:14px;color:#9a3412;margin-bottom:6px">🏫 학교: <strong>${schoolName}</strong></div>
        ${adminName ? `<div style="font-size:14px;color:#9a3412;margin-bottom:12px">👤 담당자: <strong>${adminName}</strong></div>` : ''}
        <p style="font-size:13px;color:#374151;margin-bottom:16px;">
          아래 버튼을 눌러 <strong>이 이메일 주소(${email})로 가입</strong>해주세요.<br/>
          가입 후 대시보드에서 연결 초대장을 확인하실 수 있습니다.
        </p>
        <a href="${window.location.origin}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;">
          서비스 가입하기 →
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.7;">
        ※ 반드시 이 이메일(${email})로 가입하셔야 학교 담당자와 연결됩니다.<br/>
        본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
  `
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: `[방과후 출석부] ${schoolName} 담당자가 서비스에 초대했습니다`,
        html,
      }),
    })
    return res.ok
  } catch { return false }
}

// ── 선생님 연결 관리 탭
// ● 이메일 일치(앱 가입) → 이메일 발송 + DB 초대(대시보드 팝업)
// ● 이메일 불일치(미가입) → 이메일만 발송 (대시보드 팝업 없음)
// ── 기간 설정 모달
function PeriodModal({ teacher, onClose, onSave }) {
  const [startDate, setStartDate] = useState(teacher.startDate || '')
  const [endDate,   setEndDate]   = useState(teacher.endDate   || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(startDate, endDate)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'380px', maxWidth:'92vw', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>📅 계약 기간 설정</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
        </div>
        <div style={{ fontSize:'13px', fontWeight:600, color:C.muted, marginBottom:'14px' }}>
          {teacher.teacherName} 선생님 · {teacher.subject||''}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px' }}>
          <div>
            <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>시작일</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>종료일</label>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <Btn color="secondary" onClick={onClose}>취소</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Btn>
        </div>
      </div>
    </div>
  )
}

function ConnectTab({ session }) {
  const { success, error } = useToast()
  const confirm = useSchoolConfirm()
  const [roster,      setRoster]      = useState([])
  const [appUsers,    setAppUsers]    = useState([])
  const [invites,     setInvites]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState({})
  const [selYear,     setSelYear]     = useState(CURRENT_YEAR)
  const [periodModal, setPeriodModal] = useState(null) // { teacher } 기간 설정 모달

  const fetchData = async () => {
    const [r, u, inv] = await Promise.all([
      dbCall('getAll', 'schoolAdminTeachers').then(d =>
        (d||[]).filter(t => t.adminId === session.adminId && t.active !== false)
      ),
      dbCall('getAll', 'users').then(d => (d||[]).filter(u => u.role === 'teacher')),
      dbCall('getAll', 'schoolTeacherInvites').then(d =>
        (d||[]).filter(i => i.adminId === session.adminId)
      ),
    ])
    setRoster(r); setAppUsers(u); setInvites(inv)
  }

  const load = async () => {
    setLoading(true)
    try { await fetchData() } catch {}
    setLoading(false)
  }

  const silentRefresh = () => { fetchData().catch(() => {}) }

  // 초대 취소 — pending/emailed 상태 초대 취소
  const cancelInvite = (t) => {
    confirm(`${t.teacherName} 선생님의 초대를 취소하시겠습니까?`, async () => {
      const inv = inviteByEmail[t.email?.toLowerCase()]
      if (!inv) return
      try {
        await dbCall('update', 'schoolTeacherInvites', {
          id: inv.id,
          patch: { status: 'declined', noticeId: null, sentAt: null },
        })
        success(`${t.teacherName} 선생님 초대를 취소했습니다.`)
        silentRefresh()
      } catch { error('취소 중 오류가 발생했습니다.') }
    })
  }

  // 연결 끊기 — accepted 상태 해제 + schoolAdminTeachers 비활성화
  const disconnectTeacher = (t) => {
    confirm(`⚠️ ${t.teacherName} 선생님과의 연결을 끊으시겠습니까?\n\n• 선생님이 공지·업무를 더 이상 받을 수 없습니다.\n• 진행 중인 업무가 있다면 미완료로 처리됩니다.\n• 선생님도 대시보드에서 연결이 해제됩니다.`, async () => {
      try {
        const inv = inviteByEmail[t.email?.toLowerCase()]
        if (inv) {
          await dbCall('update', 'schoolTeacherInvites', {
            id: inv.id,
            patch: { status: 'declined', noticeId: null },
          })
        }
        if (t.id && !t._virtual) {
          await dbCall('update', 'schoolAdminTeachers', {
            id: t.id,
            patch: { active: false },
          })
        }
        success(`${t.teacherName} 선생님과의 연결을 끊었습니다.`)
        load()
      } catch { error('처리 중 오류가 발생했습니다.') }
    })
  }


  useEffect(() => { load() }, [])

  // 이메일 기준 룩업
  const appByEmail    = Object.fromEntries(appUsers.map(u => [u.email?.toLowerCase(), u]))
  const inviteByEmail = Object.fromEntries(invites.map(i => [i.teacherEmail?.toLowerCase(), i]))

  const years    = [...new Set([CURRENT_YEAR, ...roster.map(t => t.year).filter(Boolean)])].sort((a,b)=>b-a)
  const filtered = roster.filter(t => t.year == selYear || (!t.year && selYear === CURRENT_YEAR))

  // 상태 계산
  // accepted  → 연결 완료 (수락됨)
  // pending   → 초대 발송됨 (대시보드 팝업 대기)
  // emailed   → 이메일만 발송됨 (앱 미가입 상태였음)
  // ready     → 앱 가입됨, 아직 초대 안 보냄
  // notjoined → 앱 미가입, 초대 안 보냄
  const getStatus = (t) => {
    const email = t.email?.toLowerCase()
    const inv   = inviteByEmail[email]
    if (inv?.status === 'accepted') return 'accepted'
    if (inv?.status === 'pending')  return 'pending'
    if (inv?.status === 'emailed')  return 'emailed'
    if (appByEmail[email])          return 'ready'
    return 'notjoined'
  }

  const SI = {
    accepted:  { label:'✅ 연결 완료',    bg:'#f0fdf4', badge:'#dcfce7', color:'#16a34a' },
    pending:   { label:'📨 수락 대기 중', bg:'#fffbeb', badge:'#fef9c3', color:'#d97706' },
    emailed:   { label:'📧 초대 발송됨',  bg:'#fff7ed', badge:'#fed7aa', color:'#c2410c' },
    ready:     { label:'🔗 연결 가능',    bg:'#f8fafc', badge:'#eff6ff', color:'#3b82f6' },
    notjoined: { label:'서비스 미가입',   bg:'transparent', badge:'#f3f4f6', color:'#9ca3af' },
  }

  const counts = filtered.reduce((acc, t) => {
    const s = getStatus(t); acc[s] = (acc[s]||0)+1; return acc
  }, {})

  // 단일 선생님에게 초대 발송 (noticeId 지정 가능)
  const sendInvite = async (t, noticeId = null) => {
    const email = t.email?.toLowerCase()
    if (!email) { error('이메일이 등록되지 않은 선생님입니다.'); return }
    setSending(prev => ({ ...prev, [t.id]: true }))
    try {
      const appUser     = appByEmail[email]
      const existingInv = inviteByEmail[email]
      const newStatus   = appUser ? 'pending' : 'emailed'

      // 개별 발송 시 — noticeId 없으면 schoolNotices에 공지 자동 생성
      let useNoticeId = noticeId || existingInv?.noticeId || null
      if (!useNoticeId) {
        const newNoticeId = uid()
        const inviteType  = appUser ? 'invite_connect' : 'invite_signup'
        await dbCall('upsert', 'schoolNotices', {
          data: {
            id:               newNoticeId,
            adminId:          session.adminId,
            schoolName:       session.admin?.schoolName || '',
            type:             inviteType,
            title:            `${appUser ? '연결' : '서비스'} 초대 — ${t.teacherName} 선생님`,
            content:          '',
            startDate:        t.startDate || null,
            endDate:          t.endDate   || null,
            dueDate:          null,
            targetTeacherIds: [t.teacherId || t.id],
            status:           'active',
            createdAt:        now(),
          }
        })
        // schoolNoticeSubmits 생성
        await dbCall('upsert', 'schoolNoticeSubmits', {
          data: {
            id:        uid(),
            noticeId:  newNoticeId,
            teacherId: t.teacherId || t.id,
            adminId:   session.adminId,
            status:    'pending',
            createdAt: now(),
          }
        })
        useNoticeId = newNoticeId
      }

      const inviteData = {
        id:           existingInv?.id || uid(),
        adminId:      session.adminId,
        schoolName:   session.admin?.schoolName || '',
        adminName:    session.admin?.adminName  || '',
        teacherEmail: email,
        teacherName:  t.teacherName,
        teacherId:    appUser?.id || null,
        noticeId:     useNoticeId,
        status:       newStatus,
        sentAt:       now(),
        createdAt:    existingInv?.createdAt || now(),
      }

      await dbCall('upsert', 'schoolTeacherInvites', { data: inviteData })

      if (appUser) {
        await sendTeacherInviteEmail({
          teacherName: t.teacherName, email,
          schoolName:  session.admin?.schoolName || '',
          adminName:   session.admin?.adminName  || '',
        })
      } else {
        await sendSignupInviteEmail({
          teacherName: t.teacherName, email,
          schoolName:  session.admin?.schoolName || '',
          adminName:   session.admin?.adminName  || '',
        })
      }

      setInvites(prev => {
        const without = prev.filter(i => i.teacherEmail?.toLowerCase() !== email)
        return [...without, inviteData]
      })

      if (!noticeId) {
        success(appUser
          ? `✅ ${t.teacherName} 선생님께 연결 초대장을 발송했습니다!`
          : `✅ ${t.teacherName} 선생님께 서비스 가입 초대를 발송했습니다!`
        )
        silentRefresh()
      }
    } catch { error('초대 발송 중 오류가 발생했습니다.') }
    setSending(prev => ({ ...prev, [t.id]: false }))
  }

  // 일괄 초대 — schoolNotices에 업무 자동 생성 후 각 선생님 발송
  const sendBulk = async () => {
    const targets = filtered.filter(t => ['ready','notjoined'].includes(getStatus(t)))
    if (!targets.length) { error('발송할 선생님이 없습니다.'); return }

    // 1) schoolNotices에 업무 1건 자동 생성
    const noticeId = uid()
    const notice = {
      id:               noticeId,
      adminId:          session.adminId,
      schoolName:       session.admin?.schoolName || '',
      type:             'invite',
      title:            `연결 초대 — ${selYear}년 ${session.admin?.schoolName||''}`,
      content:          `${targets.length}명 선생님에게 연결 초대를 발송했습니다.`,
      startDate:        null,
      endDate:          null,
      dueDate:          null,
      targetTeacherIds: targets.map(t => t.teacherId || t.id),
      status:           'active',
      createdAt:        now(),
    }
    await dbCall('upsert', 'schoolNotices', { data: notice })

    // 2) 각 선생님별 submit 레코드 생성 (pending)
    await Promise.all(targets.map(t =>
      dbCall('upsert', 'schoolNoticeSubmits', {
        data: {
          id:        uid(),
          noticeId,
          teacherId: t.teacherId || t.id,
          adminId:   session.adminId,
          status:    'pending',
          createdAt: now(),
        }
      })
    ))

    // 3) 각 선생님에게 초대 발송
    for (const t of targets) {
      await sendInvite(t, noticeId)
    }

    success(`✅ ${targets.length}명에게 초대를 발송했습니다! 공지·업무 탭에서 현황을 확인하세요.`)
    silentRefresh()
  }
  const bulkCount = filtered.filter(t => ['ready','notjoined'].includes(getStatus(t))).length


  return (
    <div style={{ padding:'28px', maxWidth:'960px' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px', gap:'12px', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>🔗 선생님 연결 관리</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>명단의 선생님에게 초대를 발송하고 수락 현황을 확인하세요</div>
        </div>
        {bulkCount > 0 && (
          <button onClick={sendBulk} style={{
            padding:'9px 18px', borderRadius:'10px', border:'none', cursor:'pointer',
            background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px',
            fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 2px 8px rgba(59,130,246,0.3)',
          }}>📨 일괄 초대 ({bulkCount}명)</button>
        )}
      </div>

      {/* 안내 박스 */}
      <div style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'13px', color:'#374151', lineHeight:1.9 }}>
        <strong style={{ color:C.text }}>상태 구분</strong><br/>
        • <strong style={{ color:'#3b82f6' }}>🔗 연결 가능</strong> — 이 이메일로 서비스에 가입되어 있음. 초대 시 이메일 + 대시보드 팝업 동시 전달<br/>
        • <strong style={{ color:'#9ca3af' }}>서비스 미가입</strong> — 아직 미가입. 가입 초대 이메일 발송 가능. 가입 후 대시보드에 연결 팝업 자동 표시
      </div>

      {/* 통계 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'20px' }}>
        {[
          { label:'전체 등록',    value:filtered.length,      color:'#6b7280', bg:'#f9fafb' },
          { label:'✅ 연결 완료', value:counts.accepted||0,   ...SI.accepted  },
          { label:'📨 초대 발송됨', value:(counts.pending||0)+(counts.emailed||0), ...SI.pending },
          { label:'미초대',       value:(counts.ready||0)+(counts.notjoined||0), color:'#9ca3af', bg:'#f3f4f6' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:'12px', padding:'12px 14px', border:`1px solid ${s.color}22` }}>
            <div style={{ fontSize:'20px', fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 연도 탭 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelYear(y)} style={{
            padding:'6px 18px', borderRadius:'999px', border:'none', cursor:'pointer',
            fontFamily:'Noto Sans KR, sans-serif', fontWeight:selYear===y?700:400, fontSize:'13px',
            background:selYear===y?'#1e3a5f':'#e5e7eb', color:selYear===y?'#fff':C.muted,
          }}>
            {y}년{y===CURRENT_YEAR&&<span style={{ fontSize:'10px', opacity:.8 }}> 올해</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.muted, background:'#f8fafc', borderRadius:'14px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>👩‍🏫</div>
          <div style={{ fontWeight:600 }}>{selYear}년 등록된 선생님이 없습니다.</div>
          <div style={{ fontSize:'12px', marginTop:'6px' }}>선생님 현황 탭에서 먼저 등록해주세요.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

          {/* ── 섹션 1: 연결 가능 (앱 가입됨) */}
          {(() => {
            const group = filtered.filter(t => ['ready','pending','accepted'].includes(getStatus(t)))
            return (
              <div style={{ borderRadius:'14px', border:`2px solid #bfdbfe`, overflow:'hidden' }}>
                {/* 섹션 헤더 */}
                <div style={{ background:'#eff6ff', padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'16px' }}>🔗</span>
                    <span style={{ fontSize:'14px', fontWeight:700, color:'#1e40af' }}>연결 가능</span>
                    <span style={{ fontSize:'12px', color:'#3b82f6', background:'#dbeafe', padding:'2px 8px', borderRadius:'999px', fontWeight:600 }}>{group.length}명</span>
                  </div>
                  <span style={{ fontSize:'12px', color:'#6b7280' }}>이 이메일로 서비스에 가입되어 있습니다</span>
                </div>
                {/* 테이블 헤더 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 110px 130px 100px', padding:'9px 18px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
                  <span>이름</span><span>과목·요일</span><span>이메일</span><span style={{ textAlign:'center' }}>기간</span>
                  <span style={{ textAlign:'center' }}>상태</span>
                  <span style={{ textAlign:'center' }}>초대</span>
                </div>
                {group.length === 0 ? (
                  <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:'13px' }}>
                    해당 선생님이 없습니다
                  </div>
                ) : group.map((t, i) => {
                  const st  = getStatus(t)
                  const si  = SI[st]
                  const inv = inviteByEmail[t.email?.toLowerCase()]
                  return (
                    <div key={t.id} style={{
                      display:'grid', gridTemplateColumns:'1fr 1fr 1fr 110px 130px 100px',
                      padding:'13px 18px', borderBottom:i<group.length-1?`1px solid ${C.border}`:'none',
                      alignItems:'center', background: st==='accepted'?'#f0fdf4':'#fff',
                    }}>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{t.teacherName}</div>
                        {inv?.sentAt && <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>발송: {inv.sentAt.slice(0,10)}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize:'13px', color:C.text }}>{t.subject||'-'}</div>
                        <div style={{ fontSize:'11px', color:C.muted }}>{t.days||'-'}</div>
                      </div>
                      <span style={{ fontSize:'12px', color:C.muted }}>{t.email||'-'}</span>
                      <div style={{ textAlign:'center' }}>
                        {t.startDate ? (
                          <div>
                            <div style={{ fontSize:'11px', color:C.text }}>{t.startDate}</div>
                            <div style={{ fontSize:'10px', color:C.muted }}>~{t.endDate||'미정'}</div>
                          </div>
                        ) : (
                          <button onClick={()=>setPeriodModal(t)} style={{ fontSize:'11px', color:C.muted, background:'none', border:`1px dashed ${C.border}`, borderRadius:'6px', padding:'3px 8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            기간설정
                          </button>
                        )}
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <span style={{ fontSize:'11px', fontWeight:700, color:si.color, background:si.badge, padding:'3px 10px', borderRadius:'999px', whiteSpace:'nowrap' }}>
                          {si.label}
                        </span>
                      </div>
                      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'4px', alignItems:'center' }}>
                        {st === 'accepted' ? (
                          <button onClick={() => disconnectTeacher(t)} style={{
                            padding:'5px 12px', borderRadius:'7px', border:'1px solid #fca5a5',
                            background:'#fef2f2', color:'#ef4444', fontSize:'11px', fontWeight:700,
                            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                          }}>연결 끊기</button>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'center' }}>
                            <button onClick={() => sendInvite(t)} disabled={!!sending[t.id]} style={{
                              padding:'5px 12px', borderRadius:'7px', border:'none', cursor:sending[t.id]?'not-allowed':'pointer',
                              background: st==='pending' ? '#f1f5f9' : '#3b82f6',
                              color:      st==='pending' ? C.muted   : '#fff',
                              fontSize:'11px', fontWeight:700, fontFamily:'Noto Sans KR, sans-serif',
                              opacity: sending[t.id] ? .6 : 1, whiteSpace:'nowrap',
                            }}>
                              {sending[t.id] ? '발송 중...' : st==='pending' ? '연결 재발송' : '연결 초대'}
                            </button>
                            {st === 'pending' && (
                              <button onClick={() => cancelInvite(t)} style={{
                                padding:'4px 10px', borderRadius:'7px', border:'1px solid #e5e7eb',
                                background:'#fff', color:'#9ca3af', fontSize:'10px', fontWeight:600,
                                cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                              }}>초대 취소</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── 섹션 2: 서비스 미가입 */}
          {(() => {
            const group = filtered.filter(t => ['notjoined','emailed'].includes(getStatus(t)))
            return (
              <div style={{ borderRadius:'14px', border:`2px solid #e5e7eb`, overflow:'hidden' }}>
                {/* 섹션 헤더 */}
                <div style={{ background:'#f9fafb', padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'16px' }}>📧</span>
                    <span style={{ fontSize:'14px', fontWeight:700, color:'#374151' }}>서비스 미가입</span>
                    <span style={{ fontSize:'12px', color:'#9ca3af', background:'#f3f4f6', padding:'2px 8px', borderRadius:'999px', fontWeight:600 }}>{group.length}명</span>
                  </div>
                  <span style={{ fontSize:'12px', color:'#6b7280' }}>가입 초대 이메일을 발송할 수 있습니다</span>
                </div>
                {/* 테이블 헤더 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 110px 130px 100px', padding:'9px 18px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
                  <span>이름</span><span>과목·요일</span><span>이메일</span><span style={{ textAlign:'center' }}>기간</span>
                  <span style={{ textAlign:'center' }}>상태</span>
                  <span style={{ textAlign:'center' }}>초대</span>
                </div>
                {group.length === 0 ? (
                  <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:'13px' }}>
                    모든 선생님이 서비스에 가입되어 있습니다 🎉
                  </div>
                ) : group.map((t, i) => {
                  const st  = getStatus(t)
                  const si  = SI[st]
                  const inv = inviteByEmail[t.email?.toLowerCase()]
                  return (
                    <div key={t.id} style={{
                      display:'grid', gridTemplateColumns:'1fr 1fr 1fr 110px 130px 100px',
                      padding:'13px 18px', borderBottom:i<group.length-1?`1px solid ${C.border}`:'none',
                      alignItems:'center', background:'#fff',
                      opacity: st==='notjoined' ? 0.75 : 1,
                    }}>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{t.teacherName}</div>
                        {inv?.sentAt && <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>발송: {inv.sentAt.slice(0,10)}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize:'13px', color:C.text }}>{t.subject||'-'}</div>
                        <div style={{ fontSize:'11px', color:C.muted }}>{t.days||'-'}</div>
                      </div>
                      <span style={{ fontSize:'12px', color:C.muted }}>{t.email||'-'}</span>
                      <div style={{ textAlign:'center' }}>
                        {t.startDate ? (
                          <div>
                            <div style={{ fontSize:'11px', color:C.text }}>{t.startDate}</div>
                            <div style={{ fontSize:'10px', color:C.muted }}>~{t.endDate||'미정'}</div>
                          </div>
                        ) : (
                          <button onClick={()=>setPeriodModal(t)} style={{ fontSize:'11px', color:C.muted, background:'none', border:`1px dashed ${C.border}`, borderRadius:'6px', padding:'3px 8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            기간설정
                          </button>
                        )}
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <span style={{ fontSize:'11px', fontWeight:700, color:si.color, background:si.badge, padding:'3px 10px', borderRadius:'999px', whiteSpace:'nowrap' }}>
                          {si.label}
                        </span>
                      </div>
                      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'4px', alignItems:'center' }}>
                        <button onClick={() => sendInvite(t)} disabled={!!sending[t.id]} style={{
                          padding:'5px 12px', borderRadius:'7px', border:'none', cursor:sending[t.id]?'not-allowed':'pointer',
                          background: st==='emailed' ? '#f1f5f9' : '#f97316',
                          color:      st==='emailed' ? C.muted   : '#fff',
                          fontSize:'11px', fontWeight:700, fontFamily:'Noto Sans KR, sans-serif',
                          opacity: sending[t.id] ? .6 : 1, whiteSpace:'nowrap',
                        }}>
                          {sending[t.id] ? '발송 중...' : st==='emailed' ? '가입 재발송' : '가입 초대'}
                        </button>
                        {st === 'emailed' && (
                          <button onClick={() => cancelInvite(t)} style={{
                            padding:'4px 10px', borderRadius:'7px', border:'1px solid #e5e7eb',
                            background:'#fff', color:'#9ca3af', fontSize:'10px', fontWeight:600,
                            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                          }}>초대 취소</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

        </div>
      )}

      {/* 기간 설정 모달 */}
      {periodModal && (
        <PeriodModal
          teacher={periodModal}
          onClose={() => setPeriodModal(null)}
          onSave={async (startDate, endDate) => {
            await dbCall('update', 'schoolAdminTeachers', {
              id: periodModal.id,
              patch: { startDate: startDate||null, endDate: endDate||null },
            })
            success('기간이 설정되었습니다.')
            setPeriodModal(null)
            silentRefresh()
          }}
        />
      )}
    </div>
  )
}

// ── 학교 담당자 대시보드
function SchoolDashboard({ session, onNav }) {
  const [notices,  setNotices]  = useState([])
  const [submits,  setSubmits]  = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [calYear,  setCalYear]  = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selDate,  setSelDate]  = useState(null)

  const today = new Date().toISOString().slice(0,10)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [n, t, s] = await Promise.all([
          dbCall('getAll','schoolNotices').then(d=>(d||[]).filter(x=>x.adminId===session.adminId)),
          dbCall('getAll','schoolAdminTeachers').then(d=>(d||[]).filter(x=>x.adminId===session.adminId&&x.active!==false)),
          dbCall('getAll','schoolNoticeSubmits').then(d=>(d||[]).filter(x=>x.adminId===session.adminId)),
        ])
        setNotices(n); setTeachers(t); setSubmits(s)
      } catch {}
      setLoading(false)
    }
    load()
  }, [session.adminId])

  // 업무 상태 계산
  const getNoticeStatus = (notice) => {
    const subs = submits.filter(s => s.noticeId === notice.id)
    const total = (notice.targetTeacherIds||[]).length
    if (!total) return { pending:0, replied:0, submitted:0, total:0 }
    return {
      total,
      pending:   subs.filter(s=>s.status==='pending').length,
      replied:   subs.filter(s=>s.status==='replied').length,
      submitted: subs.filter(s=>s.status==='submitted').length,
    }
  }

  // 달력에 표시할 이벤트 수집
  const getEventsForDate = (dateStr) => {
    const events = []
    notices.forEach(n => {
      if (n.startDate && n.startDate <= dateStr && (!n.endDate || n.endDate >= dateStr))
        events.push({ type:'period', notice:n, color:'#3b82f6' })
      if (n.dueDate === dateStr)
        events.push({ type:'due', notice:n, color:'#ef4444' })
    })
    return events
  }

  // 업무 분류
  const activeNotices = notices.filter(n => n.status !== 'done')
  const urgentNotices = activeNotices.filter(n => n.dueDate && n.dueDate <= today && n.dueDate >= today)
  const overdueNotices = activeNotices.filter(n => n.dueDate && n.dueDate < today)
  const needActionNotices = activeNotices.filter(n => {
    const st = getNoticeStatus(n)
    return st.pending > 0
  })

  // 달력 렌더
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate()
  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const DAYS_KO     = ['일','월','화','수','목','금','토']
  const prevMonth   = () => calMonth===0 ? (setCalYear(y=>y-1),setCalMonth(11)) : setCalMonth(m=>m-1)
  const nextMonth   = () => calMonth===11 ? (setCalYear(y=>y+1),setCalMonth(0)) : setCalMonth(m=>m+1)

  const calDays = []
  for (let i=0; i<firstDay; i++) calDays.push(null)
  for (let d=1; d<=daysInMonth; d++) calDays.push(d)

  const selDateStr = selDate ? `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(selDate).padStart(2,'0')}` : null
  const selEvents  = selDateStr ? getEventsForDate(selDateStr) : []

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:C.muted }}>불러오는 중...</div>

  return (
    <div style={{ padding:'24px', maxWidth:'1100px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'22px', fontWeight:800, color:C.text }}>🏠 대시보드</div>
        <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>{session.admin?.schoolName} — {today}</div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
        {[
          { label:'전체 업무',     value:notices.length,         color:'#6b7280', bg:'#f9fafb', icon:'📋', nav:'notices' },
          { label:'진행중',        value:activeNotices.length,   color:'#3b82f6', bg:'#eff6ff', icon:'🔄', nav:'notices' },
          { label:'⚠️ 확인 필요', value:needActionNotices.length,color:'#d97706', bg:'#fffbeb', icon:'⚠️', nav:'notices' },
          { label:'등록 선생님',   value:teachers.length,        color:'#16a34a', bg:'#f0fdf4', icon:'👩‍🏫', nav:'teachers' },
        ].map(s => (
          <div key={s.label} onClick={()=>onNav(s.nav)}
            style={{ background:s.bg, borderRadius:'14px', padding:'16px 20px', border:`1px solid ${s.color}22`, cursor:'pointer', transition:'box-shadow .15s' }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
            <div style={{ fontSize:'24px', fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:'20px', alignItems:'start' }}>

        {/* 달력 */}
        <div style={{ background:C.card, borderRadius:'16px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {/* 달력 헤더 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:'#f8fafc' }}>
            <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:C.muted }}>‹</button>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{calYear}년 {calMonth+1}월</span>
            <button onClick={nextMonth} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:C.muted }}>›</button>
          </div>
          {/* 요일 헤더 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'8px 8px 4px' }}>
            {DAYS_KO.map((d,i) => (
              <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:700, color:i===0?'#ef4444':i===6?'#3b82f6':C.muted, padding:'4px 0' }}>{d}</div>
            ))}
          </div>
          {/* 날짜 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'0 8px 8px', gap:'2px' }}>
            {calDays.map((d, i) => {
              if (!d) return <div key={i} />
              const ds     = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
              const evts   = getEventsForDate(ds)
              const isToday = ds === today
              const isSel   = d === selDate
              const hasDue  = evts.some(e=>e.type==='due')
              const hasPeriod = evts.some(e=>e.type==='period')
              return (
                <div key={d} onClick={()=>setSelDate(d===selDate?null:d)} style={{
                  textAlign:'center', padding:'6px 2px', borderRadius:'8px', cursor:'pointer',
                  background: isSel?'#1e3a5f':isToday?'#eff6ff':'transparent',
                  color: isSel?'#fff':isToday?'#3b82f6':C.text,
                  fontWeight: isToday||isSel?700:400, fontSize:'13px',
                  position:'relative',
                }}>
                  {d}
                  {(hasDue||hasPeriod) && (
                    <div style={{ display:'flex', justifyContent:'center', gap:'2px', marginTop:'2px' }}>
                      {hasDue    && <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#ef4444' }} />}
                      {hasPeriod && <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#3b82f6' }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* 달력 범례 */}
          <div style={{ padding:'8px 16px 12px', display:'flex', gap:'12px', borderTop:`1px solid ${C.border}` }}>
            <span style={{ fontSize:'11px', color:C.muted, display:'flex', alignItems:'center', gap:'4px' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#ef4444' }} />마감일
            </span>
            <span style={{ fontSize:'11px', color:C.muted, display:'flex', alignItems:'center', gap:'4px' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#3b82f6' }} />진행기간
            </span>
          </div>
          {/* 선택 날짜 이벤트 */}
          {selDateStr && selEvents.length > 0 && (
            <div style={{ borderTop:`1px solid ${C.border}`, padding:'10px 14px', background:'#f8fafc' }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:C.text, marginBottom:'6px' }}>{selDateStr} 일정</div>
              {selEvents.map((e,i) => (
                <div key={i} onClick={()=>onNav('notices')} style={{ fontSize:'12px', color:e.color, padding:'3px 0', cursor:'pointer' }}>
                  {e.type==='due'?'⏰ 마감':'📅 진행중'} — {e.notice.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 업무 현황 */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* 확인 필요 */}
          <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'#fffbeb', borderBottom:`1px solid #fcd34d`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'13px', fontWeight:700, color:'#92400e' }}>⚠️ 확인이 필요한 업무</span>
              <span style={{ fontSize:'11px', color:'#92400e' }}>{needActionNotices.length}건</span>
            </div>
            {needActionNotices.length === 0 ? (
              <div style={{ padding:'16px', textAlign:'center', color:C.muted, fontSize:'13px' }}>모두 처리 완료 🎉</div>
            ) : (
              needActionNotices.slice(0,5).map(n => {
                const st = getNoticeStatus(n)
                const notReplied = st.pending
                const subs = submits.filter(s=>s.noticeId===n.id&&s.status==='pending')
                const pendingTeachers = subs.map(s=>{
                  const t = teachers.find(x=>x.teacherId===s.teacherId||x.id===s.teacherId)
                  return t?.teacherName || '?'
                }).filter(Boolean)
                return (
                  <div key={n.id} onClick={()=>onNav('notices')} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fffbeb'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{n.title}</div>
                    <div style={{ fontSize:'11px', color:'#d97706', marginTop:'3px' }}>
                      미확인 {notReplied}명 {pendingTeachers.length>0?`— ${pendingTeachers.slice(0,3).join(', ')}${pendingTeachers.length>3?` 외 ${pendingTeachers.length-3}명`:''}`:''}</div>
                    {n.dueDate && <div style={{ fontSize:'11px', color:n.dueDate<today?'#ef4444':C.muted, marginTop:'2px' }}>마감 {n.dueDate}{n.dueDate<today?' (초과)':''}</div>}
                  </div>
                )
              })
            )}
          </div>

          {/* 마감 초과 */}
          {overdueNotices.length > 0 && (
            <div style={{ background:C.card, borderRadius:'14px', border:'1px solid #fca5a5', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:'#fef2f2', borderBottom:'1px solid #fca5a5' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:'#991b1b' }}>🚨 마감 초과 업무 — {overdueNotices.length}건</span>
              </div>
              {overdueNotices.map(n => (
                <div key={n.id} onClick={()=>onNav('notices')} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', fontSize:'13px' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{ fontWeight:600, color:C.text }}>{n.title}</span>
                  <span style={{ fontSize:'11px', color:'#ef4444', marginLeft:'8px' }}>마감 {n.dueDate}</span>
                </div>
              ))}
            </div>
          )}

          {/* 전체 업무 현황 */}
          <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'#f8fafc', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>📋 전체 업무 현황</span>
            </div>
            {activeNotices.length === 0 ? (
              <div style={{ padding:'16px', textAlign:'center', color:C.muted, fontSize:'13px' }}>진행중인 업무가 없습니다</div>
            ) : (
              activeNotices.map(n => {
                const st = getNoticeStatus(n)
                const completeCount = n.completeOn==='submitted' ? st.submitted : (st.replied + st.submitted)
                const rate = st.total > 0 ? Math.round(completeCount/st.total*100) : 0
                const typeI = n.type==='invite_connect'?{icon:'🔗',color:'#3b82f6'}:n.type==='invite_signup'?{icon:'📧',color:'#f97316'}:n.type==='task'?{icon:'📎',color:'#d97706'}:{icon:'📋',color:'#6b7280'}
                return (
                  <div key={n.id} onClick={()=>onNav('notices')} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <span style={{ fontSize:'11px', color:typeI.color }}>{typeI.icon}</span>
                        <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{n.title}</span>
                      </div>
                      <span style={{ fontSize:'12px', fontWeight:700, color:rate===100?'#16a34a':C.primary }}>{rate}%</span>
                    </div>
                    <div style={{ height:'4px', background:'#e5e7eb', borderRadius:'999px', overflow:'hidden' }}>
                      <div style={{ width:`${rate}%`, height:'100%', background:rate===100?'#16a34a':C.primary, borderRadius:'999px', transition:'width .4s' }} />
                    </div>
                    <div style={{ fontSize:'11px', color:C.muted, marginTop:'4px', display:'flex', gap:'10px' }}>
                      <span>미확인 {st.pending}</span>
                      <span>회신 {st.replied}</span>
                      {n.type==='task'&&<span>제출 {st.submitted}</span>}
                      {n.dueDate&&<span style={{color:n.dueDate<today?'#ef4444':C.muted}}>마감 {n.dueDate}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

const SchoolConfirmContext = React.createContext(null)
function useSchoolConfirm() { return React.useContext(SchoolConfirmContext) }

export function SchoolAdminApp({ session: initialSession, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [session, setSession] = useState(initialSession)
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onOk: null })

  // 마운트 시 최신 schoolAdmins 데이터로 세션 갱신 (본사에서 학교명 변경 반영)
  useEffect(() => {
    async function refreshSession() {
      try {
        const admin = await dbCall('getOne', 'schoolAdmins', { id: initialSession.adminId })
        if (!admin) return
        const updated = { ...initialSession, admin }
        localStorage.setItem('asa_school_session', JSON.stringify(updated))
        setSession(updated)
      } catch {}
    }
    refreshSession()
  }, [initialSession.adminId])

  const schoolConfirm = React.useCallback((message, onOk) => {
    setConfirmState({ open: true, message, onOk })
  }, [])

  const handleOk = () => {
    const cb = confirmState.onOk
    setConfirmState(s => ({ ...s, open: false }))
    cb?.()
  }
  const handleCancel = () => setConfirmState(s => ({ ...s, open: false }))

  return (
    <SchoolConfirmContext.Provider value={schoolConfirm}>
      <div style={{ display:'flex', minHeight:'100vh', background:'#f1f5f9', fontFamily:'Noto Sans KR, sans-serif' }}>
        <ConfirmDialog open={confirmState.open} message={confirmState.message} onOk={handleOk} onCancel={handleCancel} />
        <Sidebar session={session} page={page} onNav={setPage} onLogout={onLogout} />
        <main style={{ flex:1, overflowY:'auto' }}>
          {page === 'dashboard' && <SchoolDashboard session={session} onNav={setPage} />}
          {page === 'notices'  && <NoticesTab session={session} />}
          {page === 'subjects' && <SubjectsTab session={session} />}
          {page === 'teachers' && <TeachersTab session={session} />}
          {page === 'connect'  && <ConnectTab session={session} />}
          {page === 'schoolcal' && <SchoolCalendarTab key="schoolcal" session={session} />}
        {page === 'classes'  && <SchoolClassesTab key="classes" session={session} />}
          {page === 'students' && <StudentsTab session={session} />}
        </main>
      </div>
    </SchoolConfirmContext.Provider>
  )
}
