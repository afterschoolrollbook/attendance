/**
 * ParentServiceManage.jsx
 * 출결 서비스 관리 페이지
 *
 * 탭 1: 학부모 현황  — Students.jsx와 동일한 필터/테이블 패턴
 * 탭 2: 서비스 설정  — 약관·문구 편집 (localStorage + Supabase 저장)
 *
 * Supabase 저장 구조:
 *   teacher_service_configs { teacher_id, config_key:'parent_service', config_value JSONB }
 *   parent_members { teacher_id, phone, app_joined, marketing_agree, ... }
 *
 * SQL 파일: migration_parent_service.sql 실행 필요
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, ParentMembers, TeacherParentLinks } from '../lib/db.js'
import { dbCall, isConfigured } from '../lib/supabase.js'
import { uid, now, fmtPhone, sortClasses } from '../lib/utils.js'
import { Btn, Modal, Tag, EmptyState, PageHeader } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../hooks/useConfirm.js'

// ─────────────────────────────────────────────
// 설정 기본값 & localStorage
// ─────────────────────────────────────────────
const LS_KEY  = 'asa_parent_service_config'
const DB_KEY  = 'parent_service'

export const DEFAULT_CONFIG = {
  // 초대장 안내 문구
  inviteNotice:   `이 출결서비스는 {선생님} 선생님께서 수업 운영상 학부모님들께 학생들의 출결 현황을 편리하게 안내드리기 위해 운영하는 서비스입니다.`,
  schoolNotice:   `학교에서 운영하는 공식 서비스가 아닙니다.`,
  notAgreeNotice: `동의를 원하지 않으실 경우 가입하지 않으셔도 됩니다.`,

  // 이용약관
  terms: `방과후 출결서비스 이용약관

제1조 (목적)
본 약관은 담당 선생님이 제공하는 방과후 출결서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와 운영자의 권리·의무에 관한 사항을 규정함을 목적으로 합니다.

제2조 (서비스 성격 및 운영 주체)
① 본 서비스는 학교 공식 서비스가 아니며, 담당 방과후 강사(이하 "선생님")가 자녀의 출결 현황을 학부모님께 편리하게 안내하기 위해 자체 운영하는 서비스입니다.
② 가입 여부는 학부모님의 자유 의사에 따르며, 가입하지 않아도 수업 수강에 불이익이 없습니다.

제3조 (서비스 내용)
① 자녀의 수업별 출결 현황 조회
② 출석·결석·지각·조퇴 알림 수신
③ 수업 일정 및 공지사항 확인

제4조 (이용자의 의무)
① 이용자는 본인의 정보를 정확하게 제공해야 합니다.
② 타인의 정보를 무단으로 이용하거나 서비스를 비정상적인 방법으로 이용할 수 없습니다.

제5조 (탈퇴 및 서비스 종료)
① 이용자는 언제든지 서비스 화면에서 탈퇴 신청을 할 수 있습니다.
② 탈퇴 즉시 출결 알림 수신이 중단됩니다.
③ 탈퇴 후 재가입을 원하실 경우 담당 선생님께 초대 링크를 다시 요청하시면 됩니다.
④ 담당 선생님이 수업을 종료하거나 서비스 이용을 중단할 경우 서비스가 종료될 수 있습니다.

제6조 (면책 조항)
① 본 서비스는 출결 안내 목적으로만 운영되며, 서비스 이용과 관련하여 발생한 분쟁에 대해 운영자는 관계 법령에서 정한 범위 내에서 책임을 집니다.
② 천재지변, 서버 장애 등 불가항력적 사유로 서비스가 일시 중단될 수 있습니다.

[시행일] 본 약관은 서비스 가입 시점부터 적용됩니다.`,

  // 개인정보 수집·이용 동의
  privacy: `개인정보 수집·이용 동의서

수집 주체: 방과후 출결서비스 담당 선생님

1. 수집 항목
   - 필수: 학부모 성명, 휴대전화 번호
   - 자녀 정보: 이름, 학년, 반 (출결 확인 목적)
   - 선택: 마케팅 수신 동의 여부

2. 수집 목적
   - 자녀 출결 현황 알림 발송
   - 수업 관련 공지사항 안내
   - 서비스 운영 및 관리

3. 보유 및 이용 기간
   - 서비스 탈퇴 시까지
   - 탈퇴 후 지체 없이 파기
     (단, 관련 법령에서 보존을 요구하는 경우 해당 기간 동안 보관)

4. 제3자 제공
   - 원칙적으로 제3자에게 제공하지 않습니다.
   - 단, 이용자 동의 또는 법령에 의한 경우 제공될 수 있습니다.

5. 동의 거부권 및 불이익
   - 필수 항목 동의를 거부하실 권리가 있으나,
     거부 시 출결 알림 서비스를 이용하실 수 없습니다.

※ 개인정보 관련 문의는 담당 선생님께 연락해 주시기 바랍니다.`,

  // 마케팅 동의
  marketingLabel: `[선택] 마케팅 정보 수신 동의`,
  marketingDesc:  `수업 관련 교육 정보, 교구 공동구매, 행사 안내 등 유익한 정보를 받아보실 수 있습니다.`,

  // 탈퇴 안내
  withdrawNotice: `• 탈퇴 즉시 출결 알림 수신이 중단됩니다.\n• 자녀의 기존 출결 기록은 선생님 측에 유지됩니다.\n• 재가입을 원하시면 담당 선생님께 초대 링크를 다시 요청해 주세요.\n• 탈퇴는 취소할 수 없습니다.`,

  // 초대 SMS 템플릿 ({선생님} {학생} {링크} 치환)
  inviteSmsTemplate: `안녕하세요 😊 {학생} 학생 학부모님!\n{선생님} 선생님의 방과후 출결서비스에 초대드립니다.\n\n출결 현황을 실시간으로 확인하고 알림을 받으실 수 있습니다.\n아래 링크를 눌러 간편하게 가입해 주세요 🙏\n{링크}\n\n※ 이 서비스는 학교 공식 서비스가 아닙니다.\n   원하시지 않으시면 무시하셔도 됩니다.`,
}

export function loadParentServiceConfig() {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') } }
  catch { return { ...DEFAULT_CONFIG } }
}

// Supabase에서 최신 설정 로드
async function fetchConfigFromSupabase(teacherId) {
  if (!isConfigured) return null
  try {
    const rows = await dbCall('where', 'teacherServiceConfigs', {
      where: { teacher_id: teacherId, config_key: DB_KEY },
    })
    return rows?.[0]?.configValue || null
  } catch { return null }
}

// Supabase에 설정 저장
async function saveConfigToSupabase(teacherId, cfg) {
  if (!isConfigured) return
  try {
    await dbCall('upsert', 'teacherServiceConfigs', {
      data: { teacher_id: teacherId, config_key: DB_KEY, config_value: cfg, updated_at: new Date().toISOString() },
    })
  } catch (e) {
    console.warn('[ParentServiceConfig] Supabase 저장 실패:', e)
  }
}

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', success: '#16a34a', card: '#fff',
}

const selSt = {
  padding: '8px 12px', borderRadius: '9px', border: '1.5px solid #e5e7eb',
  fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif',
  background: '#fff', color: '#111827', cursor: 'pointer', outline: 'none',
  minWidth: '140px',
}

// ─────────────────────────────────────────────
// 초대 모달 (Attendance.jsx의 InviteModal과 동일 패턴)
// ─────────────────────────────────────────────
function InviteModal({ student, user, config, onClose, onSent }) {
  const phone = student.parentPhone?.replace(/[^0-9]/g, '') || ''
  const link  = `${window.location.origin}/parent-invite?phone=${encodeURIComponent(student.parentPhone || '')}&teacher=${encodeURIComponent(user?.id || '')}`

  // 설정에서 SMS 템플릿 로드, 치환
  const teacherName = user?.nickname || user?.name || ''
  const tpl = (config.inviteSmsTemplate || DEFAULT_CONFIG.inviteSmsTemplate)
    .replace(/{선생님}/g, teacherName)
    .replace(/{학생}/g,   student.name || '')
    .replace(/{링크}/g,   link)

  const [text, setText] = useState(tpl)
  const { success } = useToast()

  const send = (method) => {
    if (!phone) { return }
    if (method === 'sms')   window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    if (method === 'kakao') window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(text)}`)
    StudentsDB.update(student.id, { parentInviteSentAt: new Date().toISOString() })
    onSent && onSent(student.id)
    success(`${student.name} 학부모님께 초대 메시지를 발송했습니다.`)
    onClose()
  }
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
    })
    success('복사되었습니다.')
  }

  return (
    <Modal open={true} onClose={onClose} title={`📨 출결초대 — ${student.name}`} width={480}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <div style={{ fontSize:'13px', color:C.muted }}>
          문구를 확인하고 발송 방법을 선택하세요.
          <br/><span style={{ fontSize:'12px', color:'#9ca3af' }}>서비스 설정 탭에서 SMS 문구를 수정할 수 있습니다.</span>
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={8}
          style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', resize:'vertical', outline:'none', lineHeight:1.6, boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={() => send('sms')}
            style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            💬 문자 발송
          </button>
          <button onClick={() => send('kakao')}
            style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#FEE500', color:'#3C1E1E', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            💛 카카오 발송
          </button>
          <button onClick={copy}
            style={{ padding:'11px 16px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            복사
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// 탭 1: 학부모 현황
// ─────────────────────────────────────────────
function ParentListTab({ user, config }) {
  const teacherId = user?.id
  const { success: showSuccess, error: showError } = useToast()
  const { confirm } = useConfirm()

  const classes = ClassesDB.byTeacher(teacherId)

  // Students.jsx와 동일한 필터 구조
  const [ctxYear,   setCtxYear]   = useState('')
  const [ctxSchool, setCtxSchool] = useState('')
  const [ctxClass,  setCtxClass]  = useState('')
  const [ctxStatus, setCtxStatus] = useState('') // '' | joined | not_joined | withdrawn
  const [subTab,    setSubTab]    = useState('all')
  const [tick,      setTick]      = useState(0)
  const refresh = () => setTick(t => t + 1)

  // 초대 모달
  const [inviteTarget, setInviteTarget] = useState(null)
  // 자동종료 예외 메모 모달
  const [exceptionTarget, setExceptionTarget] = useState(null)
  const [exceptionMemo,   setExceptionMemo]   = useState('')

  // 년도/학교 목록 — Students.jsx와 동일 로직
  const years = [...new Set(classes.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const yearClasses = ctxYear ? classes.filter(c => c.startDate?.startsWith(ctxYear) || c.endDate?.startsWith(ctxYear)) : classes
  const schools = [...new Set(yearClasses.map(c => c.organization).filter(Boolean))]
  const filteredClasses = sortClasses(ctxSchool ? yearClasses.filter(c => c.organization === ctxSchool) : yearClasses)

  // 학부모 전화번호가 있는 confirmed 학생만
  const allStudents = StudentsDB.byTeacher(teacherId)
  const withPhone = allStudents.filter(s => {
    if (!s.parentPhone) return false
    if (ctxYear) {
      const inYear = yearClasses.some(c => s.classIds?.includes(c.id))
      if (!inYear) return false
    }
    if (ctxClass  && !s.classIds?.includes(ctxClass))    return false
    if (ctxSchool && s.school !== ctxSchool)              return false
    return true
  })

  // 각 학생에 학부모 가입 상태 enriched
  const enriched = withPhone.map(s => {
    const member = ParentMembers?.findByPhoneAndTeacher?.(s.parentPhone, teacherId) || null
    const cls = (s.classIds || []).map(cid => classes.find(c => c.id === cid)).filter(Boolean)[0] || null

    const todayStr = new Date().toISOString().slice(0,10)
    const nowTs = new Date()

    // 세부 조건
    const inRoster   = s.status === 'confirmed'
    const classEnded = !!(cls?.endDate && todayStr > cls.endDate)
    const applyOver  = !!(cls?.applyEndAt && nowTs > new Date(cls.applyEndAt))
    // 신청기간 진행 중
    const applyOpen  = !!(cls?.applyStartAt && cls?.applyEndAt &&
                          nowTs >= new Date(cls.applyStartAt) && nowTs <= new Date(cls.applyEndAt))

    // 수업 상태 — 수업중/신청기간은 동시에 가능하므로 독립 계산
    let classStatus = 'none'
    if (s.status === 'cancelled') {
      classStatus = 'cancelled'
    } else if (cls) {
      if (cls.endDate && todayStr > cls.endDate)          classStatus = 'ended'
      else if (cls.startDate && todayStr >= cls.startDate) classStatus = 'active'
      else                                                 classStatus = 'upcoming'
    }

    // 자동종료 대상: 가입 중 && 수업종료 && 신청기간끝 && 명단없음
    const autoEndTarget = !!(member?.appJoined && classEnded && applyOver && !inRoster && !s.autoEndException)

    return {
      ...s, member, cls, classStatus,
      inRoster, classEnded, applyOver, applyOpen, autoEndTarget,
      joined:        !!member?.appJoined,
      withdrawn:     !!(member && !member.appJoined && member.withdrawnAt),
      invited:       !!s.parentInviteSentAt,
      marketing:     !!member?.marketingAgree,
      termType:      cls?.termType || null,
      autoEndLinked: !!member?.appJoined,
    }
  })

  const cnt = {
    all:       enriched.length,
    joined:    enriched.filter(s => s.joined).length,
    not_joined:enriched.filter(s => !s.joined && !s.withdrawn).length,
    withdrawn: enriched.filter(s => s.withdrawn).length,
  }

  const filtered = enriched.filter(s => {
    if (subTab === 'joined')     return s.joined
    if (subTab === 'not_joined') return !s.joined && !s.withdrawn
    if (subTab === 'withdrawn')  return s.withdrawn
    // 필터 바 상태 필터
    if (ctxStatus === 'joined')     return s.joined
    if (ctxStatus === 'not_joined') return !s.joined && !s.withdrawn
    if (ctxStatus === 'withdrawn')  return s.withdrawn
    return true
  })

  const bulkInvite = () => {
    const targets = enriched.filter(s => !s.joined && s.parentPhone)
    if (targets.length === 0) { showSuccess('초대할 학부모가 없습니다.'); return }
    const teacherName = user?.nickname || user?.name || ''
    targets.forEach(s => {
      const phone = s.parentPhone.replace(/[^0-9]/g, '')
      const link  = `${window.location.origin}/parent-invite?phone=${encodeURIComponent(s.parentPhone)}&teacher=${encodeURIComponent(teacherId)}`
      const text  = (config.inviteSmsTemplate || DEFAULT_CONFIG.inviteSmsTemplate)
        .replace(/{선생님}/g, teacherName).replace(/{학생}/g, s.name).replace(/{링크}/g, link)
      window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
      StudentsDB.update(s.id, { parentInviteSentAt: new Date().toISOString() })
    })
    showSuccess(`${targets.length}명에게 초대 문자를 발송했습니다.`)
    refresh()
  }

  // 선생님이 직접 출결서비스 종료 (X 버튼)
  const handleTeacherWithdraw = async (s) => {
    const ok = await confirm(`${s.name} 학부모님의 출결서비스를 종료하시겠습니까?`)
    if (!ok) return
    ParentMembers.withdrawByTeacher(s.parentPhone, teacherId, 'teacher_request')
    if (s.member) TeacherParentLinks.unlinkByMember(teacherId, s.member.id, 'teacher_request')
    showSuccess(`${s.name} 출결서비스가 종료되었습니다.`)
    refresh()
  }

  // 자동종료 일괄 실행
  const handleAutoEnd = async () => {
    const targets = enriched.filter(s => s.autoEndTarget)
    if (targets.length === 0) { showSuccess('자동종료 대상이 없습니다.'); return }
    const ok = await confirm(
      `자동종료 대상 ${targets.length}명의 출결서비스를 종료하시겠습니까?\n(수업종료 + 신청기간종료 + 명단없음 조건)`
    )
    if (!ok) return
    targets.forEach(s => {
      ParentMembers.withdrawByTeacher(s.parentPhone, teacherId, 'auto_end')
      if (s.member) TeacherParentLinks.unlinkByMember(teacherId, s.member.id, 'auto_end')
    })
    showSuccess(`${targets.length}명 자동종료 완료`)
    refresh()
  }

  // 예외 처리 저장 (자동종료 제외)
  const handleSaveException = async () => {
    if (!exceptionTarget) return
    await StudentsDB.update(exceptionTarget.id, {
      autoEndException: true,
      autoEndExceptionMemo: exceptionMemo,
      autoEndExceptionAt: new Date().toISOString(),
    })
    showSuccess(`${exceptionTarget.name} 예외 처리됨`)
    setExceptionTarget(null)
    setExceptionMemo('')
    refresh()
  }

  // 예외 해제
  const handleRemoveException = async (s) => {
    await StudentsDB.update(s.id, { autoEndException: false, autoEndExceptionMemo: '', autoEndExceptionAt: null })
    showSuccess('예외 해제됨')
    refresh()
  }
  const handleRosterConfirm = async () => {
    const currentPhones = new Set(
      allStudents.filter(s => s.parentPhone).map(s => s.parentPhone.replace(/[^0-9]/g, ''))
    )
    const activeMembers = ParentMembers.all().filter(m =>
      m.teacherId === teacherId && m.appJoined && !m.withdrawnAt
    )
    const toEnd = activeMembers.filter(m => !currentPhones.has(m.phone))
    if (toEnd.length === 0) {
      showSuccess('종료할 대상이 없습니다. 현재 명단과 일치합니다.')
      return
    }
    const ok = await confirm(
      `현재 명단에 없는 학부모 ${toEnd.length}명의 출결서비스가 자동 종료됩니다.\n계속하시겠습니까?`
    )
    if (!ok) return
    toEnd.forEach(m => {
      ParentMembers.update(m.id, {
        appJoined: false,
        withdrawnAt: new Date().toISOString(),
        withdrawReason: 'not_in_roster',
      })
      TeacherParentLinks.unlinkByMember(teacherId, m.id, 'not_in_roster')
    })
    showSuccess(`${toEnd.length}명의 출결서비스가 자동 종료되었습니다.`)
    refresh()
  }

  return (
    <div>
      {/* 통계 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        {[
          { label:'전체', value:cnt.all,        color:C.primary },
          { label:'가입',  value:cnt.joined,     color:'#16a34a' },
          { label:'미가입',value:cnt.not_joined, color:'#f59e0b' },
          { label:'탈퇴',  value:cnt.withdrawn,  color:'#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'14px 16px' }}>
            <div style={{ fontSize:'22px', fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 필터 바 — Students.jsx와 동일한 구조 */}
      <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px 20px', marginBottom:'14px' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af', marginBottom:'10px', letterSpacing:'0.05em' }}>📍 보기 범위 선택</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>년도</label>
            <select value={ctxYear} onChange={e => { setCtxYear(e.target.value); setCtxSchool(''); setCtxClass('') }} style={selSt}>
              <option value="">전체 년도</option>
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>학교</label>
            <select value={ctxSchool} onChange={e => { setCtxSchool(e.target.value); setCtxClass('') }} style={selSt}>
              <option value="">전체 학교</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>과목</label>
            <select value={ctxClass} onChange={e => setCtxClass(e.target.value)} style={selSt}>
              <option value="">전체 과목</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>{c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'12px', fontWeight:500, color:'#374151' }}>가입상태</label>
            <select value={ctxStatus} onChange={e => setCtxStatus(e.target.value)} style={selSt}>
              <option value="">전체 상태</option>
              <option value="joined">가입</option>
              <option value="not_joined">미가입</option>
              <option value="withdrawn">종료</option>
            </select>
          </div>
          {(ctxYear || ctxSchool || ctxClass || ctxStatus) && (
            <button onClick={() => { setCtxYear(''); setCtxSchool(''); setCtxClass(''); setCtxStatus('') }}
              style={{ fontSize:'11px', color:'#9ca3af', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'1px' }}>
              초기화
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {[
            { key:'all',       label:`전체 ${cnt.all}` },
            { key:'joined',    label:`가입 ${cnt.joined}` },
            { key:'not_joined',label:`미가입 ${cnt.not_joined}` },
            { key:'withdrawn', label:`종료 ${cnt.withdrawn}` },
          ].map(f => (
            <button key={f.key} onClick={() => { setSubTab(f.key); setCtxStatus('') }} style={{
              padding:'6px 12px', borderRadius:'7px', border:'none', cursor:'pointer',
              background: subTab===f.key ? C.primary : '#f3f4f6',
              color: subTab===f.key ? '#fff' : '#374151',
              fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif',
              fontWeight: subTab===f.key ? 600 : 400, transition:'all .15s',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={bulkInvite}
            style={{ padding:'8px 16px', borderRadius:'8px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📨 미가입 전체 초대
          </button>
          <button onClick={handleRosterConfirm}
            style={{ padding:'8px 16px', borderRadius:'8px', border:'1.5px solid #ef4444', background:'#fef2f2', color:'#dc2626', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📋 분기 명단 확정
          </button>
          {enriched.filter(s => s.autoEndTarget).length > 0 && (
            <button onClick={handleAutoEnd}
              style={{ padding:'8px 16px', borderRadius:'8px', border:'1.5px solid #7c3aed', background:'#faf5ff', color:'#7c3aed', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', gap:'6px' }}>
              ⚡ 자동종료
              <span style={{ background:'#7c3aed', color:'#fff', borderRadius:'10px', padding:'1px 7px', fontSize:'11px' }}>
                {enriched.filter(s => s.autoEndTarget).length}명
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 안내 박스 */}
      <div style={{ background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe', padding:'10px 14px', fontSize:'12px', color:'#1d4ed8', marginBottom:'14px', lineHeight:1.7 }}>
        💡 초대 버튼 → SMS/카카오 앱이 열리며 문구가 자동 입력됩니다. 발송 후 <strong>발송됨</strong>으로 표시가 바뀝니다.<br/>
        학부모가 링크를 클릭해 가입하면 <strong>가입 ✅</strong>으로 변경됩니다.
      </div>

      {/* 학생·학부모 테이블 */}
      {filtered.length === 0 ? (
        <EmptyState icon="📲" title="표시할 학부모가 없습니다" desc="학생 등록 시 학부모 전화번호를 입력하면 이 목록에 나타납니다." />
      ) : (
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflowX:'auto' }}>
          <table style={{ width:'100%', minWidth:'1300px', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:1 }}>
                {[
                  { label:'#',         w:'44px'  },
                  { label:'학교',       w:'110px' },
                  { label:'수업·반',    w:'150px' },
                  { label:'학년/반',    w:'90px'  },
                  { label:'학생 이름',  w:'100px' },
                  { label:'학부모 전화',w:'140px' },
                  { label:'수업상태',   w:'150px' },
                  { label:'가입상태',   w:'100px' },
                  { label:'운영방식',   w:'90px'  },
                  { label:'마케팅',     w:'70px'  },
                  { label:'초대',       w:'100px' },
                  { label:'종료',       w:'80px'  },
                  { label:'예외',       w:'110px' },
                ].map(h => (
                  <th key={h.label} style={{ padding:'11px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:'#6b7280', whiteSpace:'nowrap', minWidth:h.w }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const sClasses = (s.classIds || []).map(cid => {
                  const cls = classes.find(c => c.id === cid)
                  if (!cls) return null
                  return cls.className + (cls.section ? ' ' + cls.section + '반' : '')
                }).filter(Boolean)

                return (
                  <tr key={s.id} style={{ borderBottom:`1px solid #f3f4f6`, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding:'11px 14px', fontSize:'13px', color:'#9ca3af', textAlign:'center' }}>{i+1}</td>
                    <td style={{ padding:'11px 14px', fontSize:'13px', color:'#6b7280', whiteSpace:'nowrap' }}>{s.school}</td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {sClasses.map(c => <Tag key={c} color="#6b7280" bg="#f3f4f6">{c}</Tag>)}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:'13px', color:'#374151', whiteSpace:'nowrap' }}>
                      {s.grade ? s.grade+'학년' : '-'}
                      {s.classNum && <span style={{ marginLeft:'4px', padding:'1px 7px', borderRadius:'5px', background:'#f0fdf4', color:'#16a34a', fontWeight:600, fontSize:'12px' }}>{s.classNum}반</span>}
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:'14px', fontWeight:700, color:'#111827' }}>
                      {s.name}
                      <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginTop:'3px' }}>
                        {s.student_careers?.length > 0 && (
                          <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px',
                            background:s.student_careers.length<=1?'#eff6ff':'#f0fdf4',
                            border:`1px solid ${s.student_careers.length<=1?'#bfdbfe':'#86efac'}`,
                            color:s.student_careers.length<=1?'#1d4ed8':'#15803d' }}>
                            {s.student_careers.length<=1?'신규':'기존'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:'13px', color:'#374151', whiteSpace:'nowrap' }}>
                      {fmtPhone(s.parentPhone) || '-'}
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        {/* 1줄: 수업 진행 상태 */}
                        {s.classStatus === 'active' ? (
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'5px',
                            background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', whiteSpace:'nowrap', width:'fit-content' }}>
                            🟢 수업중
                          </span>
                        ) : s.classStatus === 'upcoming' ? (
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'5px',
                            background:'#fefce8', border:'1px solid #fde047', color:'#a16207', whiteSpace:'nowrap', width:'fit-content' }}>
                            🟡 수업예정
                          </span>
                        ) : s.classStatus === 'ended' ? (
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'5px',
                            background:'#f9fafb', border:'1px solid #e5e7eb', color:'#9ca3af', whiteSpace:'nowrap', width:'fit-content' }}>
                            ⚫ 수업종료
                          </span>
                        ) : s.classStatus === 'cancelled' ? (
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'5px',
                            background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', whiteSpace:'nowrap', width:'fit-content' }}>
                            🔴 취소
                          </span>
                        ) : (
                          <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>
                        )}

                        {/* 2줄: 신청기간 여부 (독립) */}
                        {s.applyOpen ? (
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'5px',
                            background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', whiteSpace:'nowrap', width:'fit-content' }}>
                            🔵 신청기간
                          </span>
                        ) : s.applyOver ? (
                          <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px',
                            background:'#f9fafb', border:'1px solid #e5e7eb', color:'#9ca3af', whiteSpace:'nowrap', width:'fit-content' }}>
                            신청기간 종료
                          </span>
                        ) : s.cls?.applyStartAt ? (
                          <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px',
                            background:'#fefce8', border:'1px solid #fde047', color:'#a16207', whiteSpace:'nowrap', width:'fit-content' }}>
                            신청 예정
                          </span>
                        ) : null}

                        {/* 3줄: 명단 여부 (독립) */}
                        {s.inRoster ? (
                          <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px',
                            background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', whiteSpace:'nowrap', width:'fit-content' }}>
                            📋 명단있음
                          </span>
                        ) : (
                          <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px',
                            background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', whiteSpace:'nowrap', width:'fit-content' }}>
                            📋 명단없음
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        {/* 가입상태 */}
                        {s.joined ? (
                          <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 9px', borderRadius:'6px',
                            background: s.autoEndTarget ? '#faf5ff' : '#f0fdf4',
                            border: `1px solid ${s.autoEndTarget ? '#d8b4fe' : '#86efac'}`,
                            color: s.autoEndTarget ? '#7c3aed' : '#16a34a', whiteSpace:'nowrap' }}>
                            {s.autoEndTarget ? '⚠️ 자동종료대상' : '✅ 가입'}
                          </span>
                        ) : s.withdrawn ? (
                          <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 9px', borderRadius:'6px',
                            background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>종료</span>
                        ) : (
                          <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 9px', borderRadius:'6px',
                            background:'#f9fafb', border:'1px solid #e5e7eb', color:'#9ca3af' }}>미가입</span>
                        )}
                        {/* 예외 처리 — 가입상태 td에서 제거, 별도 컬럼으로 이동 */}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                        <span style={{ fontSize:'11px', fontWeight:600, padding:'2px 7px', borderRadius:'5px', width:'fit-content',
                          background: s.termType==='semester' ? '#eff6ff' : s.termType==='quarter' ? '#faf5ff' : '#f9fafb',
                          color:      s.termType==='semester' ? '#1d4ed8' : s.termType==='quarter' ? '#7c3aed'  : '#9ca3af',
                          border:     `1px solid ${s.termType==='semester' ? '#bfdbfe' : s.termType==='quarter' ? '#e9d5ff' : '#e5e7eb'}`,
                        }}>
                          {s.termType==='semester' ? '학기제' : s.termType==='quarter' ? '분기제' : '-'}
                        </span>
                        {s.autoEndLinked && (
                          <span style={{ fontSize:'10px', color:'#f97316', fontWeight:600 }}>⚙️ 자동종료 연결</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      {s.marketing
                        ? <span style={{ fontSize:'12px', fontWeight:600, padding:'2px 8px', borderRadius:'5px', background:'#faf5ff', border:'1px solid #e9d5ff', color:'#7c3aed' }}>동의</span>
                        : <span style={{ fontSize:'12px', color:'#d1d5db' }}>-</span>
                      }
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      {s.parentPhone ? (
                        <button onClick={() => setInviteTarget(s)}
                          style={{
                            padding:'5px 10px', borderRadius:'7px', border:'none', cursor:'pointer',
                            fontFamily:'Noto Sans KR, sans-serif', fontSize:'12px', fontWeight:700, whiteSpace:'nowrap',
                            background: s.joined ? '#f0fdf4' : s.invited ? '#eff6ff' : '#fff7ed',
                            color:      s.joined ? '#16a34a' : s.invited ? '#3b82f6' : C.primary,
                            border:     `1.5px solid ${s.joined ? '#86efac' : s.invited ? '#93c5fd' : '#fed7aa'}`,
                          }}>
                          {s.joined ? '✅ 가입됨' : s.invited ? '📨 재발송' : '📨 초대'}
                        </button>
                      ) : <span style={{ fontSize:'12px', color:'#d1d5db' }}>전화번호 없음</span>}
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <button
                        onClick={() => s.joined ? handleTeacherWithdraw(s) : showError('아직 미가입 상태입니다.')}
                        style={{
                          padding:'5px 10px', borderRadius:'7px', cursor: s.joined ? 'pointer' : 'default',
                          fontFamily:'Noto Sans KR, sans-serif', fontSize:'12px', fontWeight:700, whiteSpace:'nowrap',
                          background: s.joined ? '#fef2f2' : '#f9fafb',
                          color:      s.joined ? '#dc2626'  : '#d1d5db',
                          border:     `1.5px solid ${s.joined ? '#fca5a5' : '#e5e7eb'}`,
                        }}>
                        {s.joined ? '🚫 종료' : '종료'}
                      </button>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      {!s.withdrawn && !s.autoEndException ? (
                        <button onClick={() => { setExceptionTarget(s); setExceptionMemo('') }}
                          style={{ padding:'5px 10px', borderRadius:'7px', border:'1.5px solid #f59e0b',
                            background:'#fffbeb', color:'#b45309', fontSize:'12px', fontWeight:700,
                            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                          🛡 예외 처리
                        </button>
                      ) : s.autoEndException ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                          <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'5px',
                            background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e', whiteSpace:'nowrap' }}>
                            🛡 {s.autoEndExceptionMemo || '예외처리됨'}
                          </span>
                          <button onClick={() => handleRemoveException(s)}
                            style={{ padding:'2px 7px', borderRadius:'5px', border:'1px solid #e5e7eb',
                              background:'none', color:'#9ca3af', fontSize:'11px', cursor:'pointer',
                              fontFamily:'Noto Sans KR, sans-serif' }}>
                            해제
                          </button>
                        </div>
                      ) : <span style={{ fontSize:'12px', color:'#d1d5db' }}>-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {inviteTarget && (
        <InviteModal
          student={inviteTarget}
          user={user}
          config={config}
          onClose={() => setInviteTarget(null)}
          onSent={() => { setInviteTarget(null); refresh() }}
        />
      )}

      {/* 예외 처리 인라인 패널 */}
      {exceptionTarget && (
        <div style={{ marginTop:'14px', borderRadius:'14px', border:'1.5px solid #fde68a',
          background:'#fffbeb', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#b45309' }}>
              🛡 예외 처리
              <span style={{ fontWeight:400, color:'#9ca3af', marginLeft:'8px', fontSize:'13px' }}>
                {exceptionTarget.name}
              </span>
            </div>
            <button onClick={() => setExceptionTarget(null)}
              style={{ background:'none', border:'none', fontSize:'18px', color:'#9ca3af', cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>
          <div style={{ fontSize:'13px', color:'#92400e', marginBottom:'12px', lineHeight:1.6 }}>
            자동종료 대상에서 제외합니다. 사유를 메모해 두세요.
          </div>
          <textarea
            value={exceptionMemo}
            onChange={e => setExceptionMemo(e.target.value)}
            placeholder="예: 다음 분기 재등록 예정, 학부모 요청으로 유지 등"
            rows={3}
            autoFocus
            style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1.5px solid #fde68a',
              fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', resize:'vertical',
              outline:'none', lineHeight:1.6, boxSizing:'border-box', background:'#fff' }}
          />
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'10px' }}>
            <Btn variant="ghost" onClick={() => setExceptionTarget(null)}>닫기</Btn>
            <Btn onClick={handleSaveException}>예외 저장</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 탭 2: 서비스 설정
// ─────────────────────────────────────────────
function ServiceSettingsTab({ config, teacherId, onChange, showToast }) {
  const [local,   setLocal]   = useState({ ...config })
  const [section, setSection] = useState('invite')
  const [dirty,   setDirty]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  // config prop이 바뀌면 동기화
  useEffect(() => { setLocal({ ...config }); setDirty(false) }, [config])

  const set = (k, v) => { setLocal(p => ({ ...p, [k]: v })); setDirty(true) }

  const save = async () => {
    setSaving(true)
    localStorage.setItem(LS_KEY, JSON.stringify(local))
    onChange(local)
    await saveConfigToSupabase(teacherId, local)
    setSaving(false)
    setDirty(false)
    showToast('설정이 저장되었습니다.')
  }

  const resetField = (k) => { set(k, DEFAULT_CONFIG[k]); }

  const sections = [
    { id:'invite',    icon:'📋', label:'초대 안내 문구' },
    { id:'terms',     icon:'📜', label:'이용약관' },
    { id:'privacy',   icon:'🔒', label:'개인정보 동의' },
    { id:'marketing', icon:'📣', label:'마케팅 동의' },
    { id:'sms',       icon:'💬', label:'초대 SMS 문자' },
    { id:'auto_end',  icon:'⚙️', label:'자동 종료 설정' },
    { id:'withdraw',  icon:'👋', label:'탈퇴 안내' },
  ]

  const FieldBlock = ({ title, k, multiline = true, hint }) => (
    <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
        <label style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>{title}</label>
        <button onClick={() => resetField(k)}
          style={{ fontSize:'11px', color:'#9ca3af', background:'none', border:`1px solid #e5e7eb`, borderRadius:'5px', padding:'2px 8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          기본값 복원
        </button>
      </div>
      {hint && <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'8px' }}>{hint}</div>}
      {multiline ? (
        <textarea value={local[k] || ''} onChange={e => set(k, e.target.value)} rows={10}
          style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${local[k]!==config[k]?C.primary:C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', lineHeight:1.7, resize:'vertical', outline:'none' }} />
      ) : (
        <input value={local[k] || ''} onChange={e => set(k, e.target.value)}
          style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${local[k]!==config[k]?C.primary:C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
      )}
    </div>
  )

  const InfoBox = ({ color, bg, border, children }) => (
    <div style={{ background:bg, borderRadius:'10px', border:`1px solid ${border}`, padding:'12px 14px', fontSize:'12px', color, lineHeight:1.8 }}>
      {children}
    </div>
  )

  return (
    <div style={{ display:'flex', gap:'20px', alignItems:'flex-start' }}>
      {/* 섹션 사이드 메뉴 */}
      <div style={{ minWidth:'152px', display:'flex', flexDirection:'column', gap:'2px', position:'sticky', top:'20px' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              padding:'10px 14px', borderRadius:'10px', border:'none', cursor:'pointer',
              fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, textAlign:'left',
              display:'flex', alignItems:'center', gap:'8px',
              background: section===s.id ? '#fff7ed' : 'transparent',
              color:      section===s.id ? C.primary  : C.muted,
              borderLeft: section===s.id ? `3px solid ${C.primary}` : '3px solid transparent',
            }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {/* 편집 영역 */}
      <div style={{ flex:1, minWidth:'260px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {section === 'invite' && <>
          <InfoBox color="#15803d" bg="#f0fdf4" border="#bbf7d0">
            💡 초대장 첫 화면에 표시되는 안내 문구입니다.
            <code style={{ background:'#dcfce7', borderRadius:'4px', padding:'1px 5px' }}>{'{선생님}'}</code>은 선생님 이름으로 자동 변환됩니다.
          </InfoBox>
          <FieldBlock title="서비스 소개 문구" k="inviteNotice" />
          <FieldBlock title="🏫 학교 공식 서비스 아님 안내" k="schoolNotice" multiline={false} />
          <FieldBlock title="동의 거부 안내" k="notAgreeNotice" multiline={false} />
        </>}

        {section === 'terms' && <>
          <InfoBox color="#1d4ed8" bg="#eff6ff" border="#bfdbfe">
            💡 [필수] 서비스 이용약관 "보기" 버튼 클릭 시 보여지는 약관 본문입니다.
          </InfoBox>
          <FieldBlock title="이용약관 본문" k="terms" />
        </>}

        {section === 'privacy' && <>
          <InfoBox color="#1d4ed8" bg="#eff6ff" border="#bfdbfe">
            💡 [필수] 개인정보 수집·이용 동의 "보기" 버튼 클릭 시 보여지는 내용입니다.
          </InfoBox>
          <FieldBlock title="개인정보 수집·이용 동의 본문" k="privacy" />
        </>}

        {section === 'marketing' && <>
          <InfoBox color="#7c3aed" bg="#faf5ff" border="#e9d5ff">
            💡 [선택] 마케팅 수신 동의 항목의 문구입니다. 학부모님이 거부해도 출결 서비스 이용에 지장 없습니다.
          </InfoBox>
          <FieldBlock title="마케팅 동의 레이블" k="marketingLabel" multiline={false} />
          <FieldBlock title="마케팅 동의 설명" k="marketingDesc" multiline={false} />
        </>}

        {section === 'sms' && <>
          <InfoBox color="#15803d" bg="#f0fdf4" border="#bbf7d0">
            💡 초대 버튼을 누를 때 발송되는 SMS 문자 내용입니다.<br/>
            사용 가능한 자리표시자:{' '}
            <code style={{ background:'#dcfce7', borderRadius:'4px', padding:'1px 5px' }}>{'{선생님}'}</code>{' '}
            <code style={{ background:'#dcfce7', borderRadius:'4px', padding:'1px 5px' }}>{'{학생}'}</code>{' '}
            <code style={{ background:'#dcfce7', borderRadius:'4px', padding:'1px 5px' }}>{'{링크}'}</code>
          </InfoBox>
          <FieldBlock title="초대 SMS 문자 템플릿" k="inviteSmsTemplate" />
          {/* 미리보기 */}
          <div style={{ background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, padding:'14px' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>📱 미리보기 (홍길동 선생님 / 김철수 학생 기준)</div>
            <div style={{ fontSize:'13px', color:C.text, lineHeight:1.9, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
              {(local.inviteSmsTemplate || '')
                .replace(/{선생님}/g, '홍길동')
                .replace(/{학생}/g,   '김철수')
                .replace(/{링크}/g,   `${window.location.origin}/parent-invite?teacher=xxx&phone=01012345678`)}
            </div>
          </div>
        </>}

        {section === 'auto_end' && <>
          <InfoBox color="#92400e" bg="#fffbeb" border="#fde68a">
            💡 아래 조건이 충족되면 출결서비스가 <strong>자동으로 종료</strong>됩니다.<br/>
            각 항목을 ON/OFF하거나 설정을 변경할 수 있습니다.
          </InfoBox>

          {/* 조건 1 — 분기/학기 명단 미포함 */}
          <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>📋 분기·학기 명단 미포함 시 자동 종료</div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px', lineHeight:1.7 }}>
                  학부모 현황 탭의 <strong style={{ color:C.primary }}>📋 분기 명단 확정</strong> 버튼을 누르면<br/>
                  현재 명단에 없는 학부모의 출결서비스가 자동 종료됩니다.
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', flexShrink:0 }}>
                <input type="checkbox"
                  checked={local.autoEndOnRoster !== false}
                  onChange={e => set('autoEndOnRoster', e.target.checked)}
                  style={{ width:'16px', height:'16px', accentColor: C.primary }} />
                <span style={{ fontSize:'13px', fontWeight:600, color: local.autoEndOnRoster !== false ? C.primary : C.muted }}>
                  {local.autoEndOnRoster !== false ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
            <div style={{ background:'#fff7ed', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#92400e', lineHeight:1.8 }}>
              ① 새 분기·학기 수업 등록 후<br/>
              ② 학부모 현황 탭으로 이동<br/>
              ③ <strong>📋 분기 명단 확정</strong> 버튼 클릭<br/>
              → 이전 명단에는 있었지만 현재 명단에 없는 학부모 자동 종료
            </div>
          </div>

          {/* 조건 2 — 수업 삭제 시 자동 종료 */}
          <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>🗑️ 수업 삭제 시 자동 종료</div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px', lineHeight:1.7 }}>
                  수업을 삭제하면 해당 수업 학생의 학부모<br/>
                  출결서비스가 자동으로 종료됩니다.
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', flexShrink:0 }}>
                <input type="checkbox"
                  checked={local.autoEndOnClassDelete !== false}
                  onChange={e => set('autoEndOnClassDelete', e.target.checked)}
                  style={{ width:'16px', height:'16px', accentColor: C.primary }} />
                <span style={{ fontSize:'13px', fontWeight:600, color: local.autoEndOnClassDelete !== false ? C.primary : C.muted }}>
                  {local.autoEndOnClassDelete !== false ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          </div>

          {/* 현재 가입자 중 자동종료 대상 현황 */}
          <div style={{ background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📊 현재 자동종료 연결 현황</div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
              {[
                { label:'학기제 가입', count: 0, color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', key:'semester' },
                { label:'분기제 가입', count: 0, color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff', key:'quarter'  },
              ].map(item => {
                const cnt_ = (ParentMembers.all() || []).filter(m =>
                  m.teacherId === teacherId && m.appJoined && !m.withdrawnAt
                ).length
                return (
                  <div key={item.key} style={{ flex:1, minWidth:'120px', background:item.bg, borderRadius:'10px', border:`1px solid ${item.border}`, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:'20px', fontWeight:800, color:item.color }}>{item.key==='semester' ? cnt_ : 0}</div>
                    <div style={{ fontSize:'11px', color:item.color, marginTop:'3px' }}>{item.label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize:'11px', color:C.muted, marginTop:'10px', lineHeight:1.8 }}>
              ※ 각 학생의 운영방식은 학부모 현황 탭 테이블의 <strong>운영방식</strong> 컬럼에서 확인할 수 있습니다.
            </div>
          </div>

          {/* 약관 문구 안내 */}
          <div style={{ background:'#f0fdf4', borderRadius:'10px', border:'1px solid #86efac', padding:'12px 14px', fontSize:'12px', color:'#15803d', lineHeight:1.9 }}>
            💡 아래 문구가 <strong>이용약관</strong>에 포함되어 있는지 확인하세요.
            <div style={{ marginTop:'8px', background:'#dcfce7', borderRadius:'8px', padding:'10px 12px', color:'#166534', whiteSpace:'pre-line' }}>
{`출결서비스는 아래의 경우 자동으로 종료될 수 있습니다.
· 담당 선생님이 해당 수업을 취소하는 경우
· 새 분기/학기 수업 명단에 포함되지 않은 경우
서비스 재이용을 원하시면 담당 선생님께
문자 또는 카카오톡으로 문의해 주세요.`}
            </div>
          </div>
        </>}

        {section === 'withdraw' && <>
          <InfoBox color="#991b1b" bg="#fef2f2" border="#fecaca">
            💡 학부모님이 탈퇴 버튼을 눌렀을 때 표시되는 주의 안내 문구입니다.
          </InfoBox>
          <FieldBlock title="탈퇴 안내 문구" k="withdrawNotice" />
        </>}

        {/* 저장 버튼 */}
        <div style={{ display:'flex', gap:'8px', paddingTop:'8px', alignItems:'center' }}>
          <button onClick={save} disabled={!dirty || saving}
            style={{
              flex:1, padding:'13px', borderRadius:'10px', border:'none',
              background: dirty ? C.primary : '#e5e7eb',
              color:      dirty ? '#fff'    : C.muted,
              fontSize:'14px', fontWeight:700,
              cursor: dirty ? 'pointer' : 'default',
              fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s',
            }}>
            {saving ? '저장 중...' : dirty ? '💾 변경사항 저장' : '✅ 저장됨'}
          </button>
        </div>
        {dirty && (
          <div style={{ fontSize:'12px', color:'#d97706', textAlign:'center' }}>
            ⚠️ 저장하지 않은 변경사항이 있습니다.
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function ParentServiceManage({ user }) {
  const teacherId = user?.id
  const [mainTab, setMainTab] = useState('list')
  const [config,  setConfig]  = useState(loadParentServiceConfig)
  const [toast,   setToast]   = useState(null)

  // Supabase에서 최신 설정 로드
  useEffect(() => {
    if (!teacherId) return
    fetchConfigFromSupabase(teacherId).then(remote => {
      if (remote) {
        const merged = { ...DEFAULT_CONFIG, ...remote }
        localStorage.setItem(LS_KEY, JSON.stringify(merged))
        setConfig(merged)
      }
    })
  }, [teacherId])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding:'24px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <PageHeader
        title="📲 출결 서비스 관리"
        sub="학부모 초대 현황 관리 및 약관·문구 설정"
      />

      {/* 메인 탭 */}
      <div style={{ display:'flex', gap:'4px', background:'#f3f4f6', borderRadius:'12px', padding:'4px', marginBottom:'20px', width:'fit-content' }}>
        {[
          { id:'list',     icon:'👥', label:'학부모 현황' },
          { id:'settings', icon:'⚙️', label:'서비스 설정' },
        ].map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            style={{
              padding:'9px 20px', borderRadius:'9px', border:'none', cursor:'pointer',
              fontFamily:'Noto Sans KR, sans-serif', fontSize:'14px', fontWeight:700,
              display:'flex', alignItems:'center', gap:'6px',
              background: mainTab===t.id ? C.card : 'transparent',
              color:      mainTab===t.id ? C.primary : C.muted,
              boxShadow:  mainTab===t.id ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
              transition:'all .15s',
            }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {mainTab === 'list' && (
        <ParentListTab user={user} config={config} />
      )}
      {mainTab === 'settings' && (
        <ServiceSettingsTab
          config={config}
          teacherId={teacherId}
          onChange={setConfig}
          showToast={showToast}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          background: toast.type==='error' ? '#ef4444' : '#18181b',
          color:'#fff', borderRadius:'12px', padding:'12px 20px',
          fontSize:'14px', fontWeight:600, zIndex:10000,
          boxShadow:'0 8px 24px rgba(0,0,0,0.2)', whiteSpace:'nowrap',
          animation:'_psmToast .25s ease',
        }}>
          <style>{`@keyframes _psmToast{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
