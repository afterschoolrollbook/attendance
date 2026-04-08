/**
 * SchoolAdminApp.jsx
 * 학교 담당자 포털
 * - 공지/업무 요청 생성
 * - 선생님별 제출 현황 실시간 확인
 * - 전원 제출 시 자동 알림
 * - 담당 선생님 학생 현황 조회
 */
import React, { useState, useEffect, useCallback } from 'react'
import { dbCall, isConfigured, FUNCTIONS_BASE } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'

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
  deleteNotice: async (id) => dbCall('delete','schoolNotices',{id}),
}

// ── 사이드바
function Sidebar({ session, page, onNav, onLogout }) {
  const nav = [
    { id:'notices', icon:'📋', label:'공지·업무 관리' },
    { id:'teachers', icon:'👩‍🏫', label:'선생님 현황' },
    { id:'connect', icon:'🔗', label:'선생님 연결 관리' },
    { id:'students', icon:'👥', label:'학생 현황' },
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
function NoticeCreateModal({ session, teachers, onSave, onClose }) {
  const { success, error } = useToast()
  const [form, setForm] = useState({ title:'', content:'', dueDate:'', attachName:'', attachUrl:'' })
  const [targets, setTargets] = useState([]) // 선택된 teacherId[]
  const [saving, setSaving] = useState(false)
  const fileRef = React.useRef()

  const toggleTeacher = (tid) => setTargets(prev => prev.includes(tid) ? prev.filter(t=>t!==tid) : [...prev, tid])
  const allSelected = targets.length === teachers.length && teachers.length > 0

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, attachUrl: ev.target.result, attachName: file.name }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!form.title.trim()) { error('제목을 입력해주세요.'); return }
    if (targets.length === 0) { error('대상 선생님을 선택해주세요.'); return }
    setSaving(true)
    try {
      const notice = {
        id: uid(), adminId: session.adminId,
        schoolName: session.admin?.schoolName || '',
        title: form.title, content: form.content,
        dueDate: form.dueDate, attachName: form.attachName, attachUrl: form.attachUrl,
        targetTeacherIds: targets, status: 'active', createdAt: now(),
      }
      await DB.saveNotice(notice)
      // 각 선생님별 submit 레코드 생성 (pending)
      await Promise.all(targets.map(tid => DB.saveSubmit({
        id: uid(), noticeId: notice.id, teacherId: tid,
        adminId: session.adminId, status: 'pending', createdAt: now(),
      })))
      success('공지가 등록되었습니다.')
      onSave()
      onClose()
    } catch { error('저장 중 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="📋 공지·업무 요청 등록" onClose={onClose} width={540}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>제목 *</label>
          <input style={iSt} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="예: 1분기 출석부 제출" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>내용</label>
          <textarea style={{ ...iSt, resize:'vertical' }} rows={3} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="상세 안내 내용..." />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>마감일</label>
          <input style={iSt} type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'4px' }}>첨부 양식 (선택)</label>
          <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFile} />
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button type="button" onClick={()=>fileRef.current?.click()} style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📎 파일 선택</button>
            {form.attachName && <span style={{ fontSize:'12px', color:C.primary }}>{form.attachName}</span>}
          </div>
        </div>
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
            <label style={{ fontSize:'12px', color:C.muted }}>대상 선생님 * ({targets.length}명 선택)</label>
            <button type="button" onClick={()=>setTargets(allSelected?[]:[...teachers.map(t=>t.teacherId)])} style={{ fontSize:'12px', color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              {allSelected ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div style={{ maxHeight:'180px', overflowY:'auto', border:`1px solid ${C.border}`, borderRadius:'9px', padding:'8px' }}>
            {teachers.length === 0
              ? <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', padding:'12px' }}>등록된 선생님이 없습니다.</div>
              : teachers.map(t => (
                <label key={t.teacherId} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'6px', cursor:'pointer', background: targets.includes(t.teacherId)?'#eff6ff':'transparent' }}>
                  <input type="checkbox" checked={targets.includes(t.teacherId)} onChange={()=>toggleTeacher(t.teacherId)} style={{ accentColor:C.primary }} />
                  <span style={{ fontSize:'13px', color:C.text }}>{t.teacherName}</span>
                  <span style={{ fontSize:'11px', color:C.muted }}>{t.schoolName}</span>
                </label>
              ))
            }
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', paddingTop:'4px' }}>
          <Btn color="secondary" onClick={onClose}>취소</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?'저장 중...':'📋 공지 등록'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ── 제출 현황 모달
function SubmitDetailModal({ notice, session, teachers, onClose }) {
  const [submits, setSubmits] = useState([])
  const [loading, setLoading] = useState(true)
  const { success } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const s = await DB.submits(notice.id)
    setSubmits(s)
    setLoading(false)
  }, [notice.id])

  useEffect(() => { load() }, [load])

  const targets = notice.targetTeacherIds || []
  const submitted = submits.filter(s => s.status === 'submitted')
  const rate = targets.length > 0 ? Math.round(submitted.length / targets.length * 100) : 0

  const sendRemind = () => {
    const pending = targets.filter(tid => !submitted.find(s => s.teacherId === tid))
    const names = pending.map(tid => teachers.find(t=>t.teacherId===tid)?.teacherName||'').filter(Boolean)
    if (!names.length) { success('모두 제출 완료!'); return }
    const msg = `[방과후 출석부] 📋 ${notice.title}\n미제출 선생님: ${names.join(', ')}\n마감일: ${notice.dueDate||'미정'}\n빠른 제출 부탁드립니다.`
    navigator.clipboard?.writeText(msg).then(() => success('독촉 문자 문구가 복사됐습니다.'))
  }

  return (
    <Modal title={`📋 ${notice.title} — 제출 현황`} onClose={onClose} width={560}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        {/* 진행률 */}
        <div style={{ background:'#f8fafc', borderRadius:'12px', padding:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
            <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{submitted.length} / {targets.length}명 제출</span>
            <span style={{ fontSize:'14px', fontWeight:700, color: rate===100?C.success:C.primary }}>{rate}%</span>
          </div>
          <div style={{ height:'8px', background:'#e5e7eb', borderRadius:'999px', overflow:'hidden' }}>
            <div style={{ width:`${rate}%`, height:'100%', background: rate===100?C.success:C.primary, borderRadius:'999px', transition:'width .4s' }}/>
          </div>
          {notice.dueDate && <div style={{ fontSize:'12px', color:C.muted, marginTop:'6px' }}>마감일: {notice.dueDate}</div>}
        </div>

        {/* 제출 목록 */}
        {loading ? <div style={{ textAlign:'center', padding:'20px', color:C.muted }}>불러오는 중...</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'300px', overflowY:'auto' }}>
            {targets.map(tid => {
              const teacher = teachers.find(t=>t.teacherId===tid)
              const submit = submits.find(s=>s.teacherId===tid)
              const done = submit?.status === 'submitted'
              return (
                <div key={tid} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:'10px', background: done?'#f0fdf4':'#fef2f2', border:`1px solid ${done?'#86efac':'#fca5a5'}` }}>
                  <div>
                    <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{teacher?.teacherName||'알 수 없음'}</span>
                    {done && submit?.submittedAt && (
                      <span style={{ fontSize:'11px', color:C.muted, marginLeft:'8px' }}>{submit.submittedAt.slice(0,10)}</span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    {done && submit?.fileUrl && (
                      <a href={submit.fileUrl} download={submit.fileName} style={{ fontSize:'12px', color:C.primary, textDecoration:'none', fontWeight:600 }}>⬇ 파일</a>
                    )}
                    <span style={{ fontSize:'12px', fontWeight:700, color: done?C.success:C.danger }}>
                      {done ? '✅ 제출완료' : '⏳ 미제출'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          {rate < 100 && <Btn color="secondary" onClick={sendRemind}>📨 미제출자 독촉 문구 복사</Btn>}
          <Btn color="secondary" onClick={onClose}>닫기</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ── 공지 관리 탭
function NoticesTab({ session }) {
  const { success, error } = useToast()
  const [notices, setNotices]   = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detailNotice, setDetailNotice] = useState(null)
  const [submitCounts, setSubmitCounts] = useState({}) // noticeId → {total, done}

  const load = useCallback(async () => {
    setLoading(true)
    const [n, t] = await Promise.all([DB.notices(session.adminId), DB.teachers(session.adminId)])
    setNotices(n.sort((a,b)=>b.createdAt?.localeCompare(a.createdAt)))
    setTeachers(t)
    // 각 공지별 제출 현황 카운트
    const counts = {}
    await Promise.all(n.map(async notice => {
      const s = await DB.submits(notice.id)
      counts[notice.id] = {
        total: (notice.targetTeacherIds||[]).length,
        done: s.filter(x=>x.status==='submitted').length,
      }
    }))
    setSubmitCounts(counts)
    setLoading(false)
  }, [session.adminId])

  useEffect(() => { load() }, [load])

  const deleteNotice = async (id) => {
    if (!window.confirm('공지를 삭제하시겠습니까?')) return
    await DB.deleteNotice(id)
    success('삭제되었습니다.')
    load()
  }

  return (
    <div style={{ padding:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>📋 공지·업무 관리</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>선생님들에게 업무를 요청하고 제출 현황을 확인하세요</div>
        </div>
        <Btn onClick={()=>setShowCreate(true)}>+ 공지 등록</Btn>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div> : (
        notices.length === 0
          ? <div style={{ textAlign:'center', padding:'60px', color:C.muted, background:C.bg, borderRadius:'14px', border:`1px dashed ${C.border}` }}>
              <div style={{ fontSize:'40px', marginBottom:'10px' }}>📋</div>
              <div>등록된 공지가 없습니다.</div>
            </div>
          : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {notices.map(notice => {
                const cnt = submitCounts[notice.id] || { total:0, done:0 }
                const rate = cnt.total > 0 ? Math.round(cnt.done/cnt.total*100) : 0
                const done = rate === 100 && cnt.total > 0
                return (
                  <div key={notice.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${done?'#86efac':C.border}`, padding:'16px 20px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{notice.title}</span>
                          {done && <span style={{ fontSize:'11px', fontWeight:700, background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:'999px' }}>✅ 전원 제출</span>}
                        </div>
                        {notice.dueDate && <div style={{ fontSize:'12px', color:C.muted }}>마감일: {notice.dueDate}</div>}
                        {notice.content && <div style={{ fontSize:'12px', color:C.muted, marginTop:'4px', lineHeight:1.6 }}>{notice.content}</div>}
                        {/* 진행바 */}
                        <div style={{ marginTop:'10px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ fontSize:'12px', color:C.muted }}>{cnt.done}/{cnt.total}명 제출</span>
                            <span style={{ fontSize:'12px', fontWeight:700, color:done?C.success:C.primary }}>{rate}%</span>
                          </div>
                          <div style={{ height:'6px', background:'#e5e7eb', borderRadius:'999px', overflow:'hidden' }}>
                            <div style={{ width:`${rate}%`, height:'100%', background:done?C.success:C.primary, borderRadius:'999px', transition:'width .4s' }}/>
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                        <Btn onClick={()=>setDetailNotice(notice)}>현황 보기</Btn>
                        <Btn color="danger" onClick={()=>deleteNotice(notice.id)}>삭제</Btn>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
      )}

      {showCreate && <NoticeCreateModal session={session} teachers={teachers} onSave={load} onClose={()=>setShowCreate(false)} />}
      {detailNotice && <SubmitDetailModal notice={detailNotice} session={session} teachers={teachers} onClose={()=>{ setDetailNotice(null); load() }} />}
    </div>
  )
}

// ── 선생님 현황 탭
const CURRENT_YEAR = new Date().getFullYear()

// 파일(base64) 업로드 헬퍼
function useFileField(formState, setFormState, key) {
  const ref = React.useRef()
  const pick = () => ref.current?.click()
  const onChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFormState(f => ({
      ...f,
      [key]: { name: file.name, data: ev.target.result }
    }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const val = formState[key]
  return { ref, pick, onChange, name: val?.name, data: val?.data }
}

function TeachersTab({ session }) {
  const { success, error } = useToast()
  const [teachers,    setTeachers]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modalMode,   setModalMode]   = useState(null)  // null | 'add' | 'edit'
  const [editTarget,  setEditTarget]  = useState(null)
  const [selYear,     setSelYear]     = useState(CURRENT_YEAR)
  const [detailItem,  setDetailItem]  = useState(null)  // 상세 보기

  const EMPTY = {
    year: CURRENT_YEAR, schoolName: session.admin?.schoolName || '',
    teacherName: '', subject: '', days: '', teacherPhone: '', email: '',
    feeAccount: null,    // { name, data }
    vendorBiz:  null,    // 교구업체 사업자등록증
    vendorAccount: null, // 교구업체 통장사본
  }
  const [form, setForm] = useState(EMPTY)

  const feeAccField    = useFileField(form, setForm, 'feeAccount')
  const vendorBizField = useFileField(form, setForm, 'vendorBiz')
  const vendorAccField = useFileField(form, setForm, 'vendorAccount')

  const load = async () => {
    setLoading(true)
    const t = await DB.teachers(session.adminId)
    setTeachers(t)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const validate = (f) => {
    if (!String(f.year).trim())     { error('연도를 입력해주세요.');         return false }
    if (!f.teacherName.trim())      { error('선생님 이름을 입력해주세요.');   return false }
    if (!f.subject.trim())          { error('과목을 입력해주세요.');          return false }
    if (!f.days.trim())             { error('요일을 입력해주세요.');          return false }
    if (!f.teacherPhone.trim())     { error('전화번호를 입력해주세요.');      return false }
    if (!f.email.trim())            { error('이메일 주소를 입력해주세요.');   return false }
    // 같은 연도+이메일 중복 체크
    const dup = teachers.filter(t =>
      t.year == f.year &&
      t.email?.toLowerCase() === f.email.trim().toLowerCase() &&
      (!editTarget || t.id !== editTarget.id)
    )
    if (dup.length) { error('동일 연도에 같은 이메일이 이미 등록되어 있습니다.'); return false }
    return true
  }

  const baseData = (f) => ({
    adminId:      session.adminId,
    schoolName:   f.schoolName || session.admin?.schoolName || '',
    year:         Number(f.year),
    teacherName:  f.teacherName.trim(),
    subject:      f.subject.trim(),
    days:         f.days.trim(),
    teacherPhone: f.teacherPhone.trim(),
    email:        f.email.trim().toLowerCase(),
    feeAccount:   f.feeAccount   || null,
    vendorBiz:    f.vendorBiz    || null,
    vendorAccount:f.vendorAccount|| null,
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
      feeAccount: t.feeAccount || null, vendorBiz: t.vendorBiz || null, vendorAccount: t.vendorAccount || null,
    })
    setModalMode('edit')
  }

  const removeTeacher = async (id) => {
    if (!window.confirm('선생님을 목록에서 제외하시겠습니까?')) return
    await dbCall('update', 'schoolAdminTeachers', { id, patch: { active: false } })
    success('제외되었습니다.'); load()
  }

  const years = [...new Set([CURRENT_YEAR, ...teachers.map(t => t.year).filter(Boolean)])].sort((a,b)=>b-a)
  const filtered = teachers.filter(t => t.year == selYear || (!t.year && selYear === CURRENT_YEAR))

  // ── 등록/수정 모달
  const FormModal = ({ mode }) => {
    const title = mode === 'add' ? '➕ 선생님 등록' : '✏️ 선생님 정보 수정'
    const onSave = mode === 'add' ? handleAdd : handleEdit
    const onClose = () => { setModalMode(null); setEditTarget(null); setForm(EMPTY) }
    const LBL = ({ children }) => (
      <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px', fontWeight:600 }}>{children}</label>
    )
    const FilePicker = ({ label, field }) => (
      <div>
        <LBL>{label}</LBL>
        <input ref={field.ref} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={field.onChange} />
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          <button type="button" onClick={field.pick}
            style={{ padding:'7px 12px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:'#fff', fontSize:'12px', cursor:'pointer', color:C.muted, fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            📎 파일 선택
          </button>
          {field.name
            ? <span style={{ fontSize:'11px', color:C.primary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'120px' }}>{field.name}</span>
            : <span style={{ fontSize:'11px', color:'#d1d5db' }}>미첨부</span>
          }
        </div>
      </div>
    )
    return (
      <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
        onClick={e => e.target===e.currentTarget && onClose()}>
        <div style={{ background:'#fff', borderRadius:'18px', width:'620px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', padding:'28px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{title}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
          </div>

          {/* 기본 정보 */}
          <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.5px' }}>기본 정보</div>
          <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <LBL>연도 *</LBL>
              <input style={iSt} type="number" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} placeholder="2026" />
            </div>
            <div>
              <LBL>학교명</LBL>
              <input style={iSt} value={form.schoolName} onChange={e=>setForm(f=>({...f,schoolName:e.target.value}))} placeholder={session.admin?.schoolName||'학교명'} />
            </div>
            <div>
              <LBL>선생님 이름(본명) *</LBL>
              <input style={iSt} value={form.teacherName} onChange={e=>setForm(f=>({...f,teacherName:e.target.value}))} placeholder="실명" />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <LBL>과목 *</LBL>
              <input style={iSt} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="예: 로봇, 코딩" />
            </div>
            <div>
              <LBL>수업 요일 *</LBL>
              <input style={iSt} value={form.days} onChange={e=>setForm(f=>({...f,days:e.target.value}))} placeholder="예: 월·수, 화·목" />
            </div>
            <div>
              <LBL>전화번호 *</LBL>
              <input style={iSt} value={form.teacherPhone} onChange={e=>setForm(f=>({...f,teacherPhone:e.target.value}))} placeholder="010-0000-0000" />
            </div>
            <div>
              <LBL>이메일 * (앱 연결 키)</LBL>
              <input style={iSt} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="teacher@email.com" />
            </div>
          </div>

          {/* 첨부 서류 */}
          <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, margin:'16px 0 10px', textTransform:'uppercase', letterSpacing:'.5px' }}>첨부 서류</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'20px' }}>
            <FilePicker label="수강료 통장사본"          field={feeAccField}    />
            <FilePicker label="교구업체 사업자등록증"     field={vendorBizField} />
            <FilePicker label="교구업체 통장사본"         field={vendorAccField} />
          </div>

          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <Btn color="secondary" onClick={onClose}>취소</Btn>
            <Btn onClick={onSave}>{mode==='add'?'등록':'수정 저장'}</Btn>
          </div>
        </div>
      </div>
    )
  }

  // ── 상세 보기 모달
  const DetailModal = ({ t }) => {
    const onClose = () => setDetailItem(null)
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
        <div style={{ background:'#fff', borderRadius:'18px', width:'520px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', padding:'28px', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>👩‍🏫 {t.teacherName} 선생님</div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>✕</button>
          </div>
          {[
            ['연도', t.year], ['학교명', t.schoolName], ['과목', t.subject],
            ['요일', t.days], ['전화번호', t.teacherPhone], ['이메일', t.email],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', gap:'12px', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:'13px' }}>
              <span style={{ color:C.muted, width:'110px', flexShrink:0 }}>{k}</span>
              <span style={{ color:C.text, fontWeight:500 }}>{v || '-'}</span>
            </div>
          ))}
          <div style={{ marginTop:'16px' }}>
            <FileView label="수강료 통장사본"      field={t.feeAccount}    />
            <FileView label="교구업체 사업자등록증" field={t.vendorBiz}    />
            <FileView label="교구업체 통장사본"     field={t.vendorAccount} />
          </div>
        </div>
      </div>
    )
  }

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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 110px', padding:'10px 16px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
            <span>이름</span><span>과목·요일</span><span>전화번호</span><span>이메일</span><span>서류</span><span></span>
          </div>
          {filtered.map((t, i) => (
            <div key={t.id} style={{
              display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 110px',
              padding:'12px 16px', borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none', alignItems:'center',
            }}>
              <span style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{t.teacherName}</span>
              <div>
                <div style={{ fontSize:'13px', color:C.text }}>{t.subject||'-'}</div>
                <div style={{ fontSize:'11px', color:C.muted }}>{t.days||'-'}</div>
              </div>
              <span style={{ fontSize:'13px', color:C.muted }}>{t.teacherPhone||'-'}</span>
              <span style={{ fontSize:'12px', color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.email||'-'}</span>
              <div style={{ fontSize:'11px', color:C.muted }}>
                {[t.feeAccount&&'통장', t.vendorBiz&&'사업자', t.vendorAccount&&'업체통장'].filter(Boolean).join(' · ') || '-'}
              </div>
              <div style={{ display:'flex', gap:'4px' }}>
                <button onClick={() => setDetailItem(t)}
                  style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f8fafc', color:C.muted, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>상세</button>
                <button onClick={() => openEdit(t)}
                  style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f8fafc', color:C.muted, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                <button onClick={() => removeTeacher(t.id)}
                  style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>제외</button>
              </div>
            </div>
          ))}
          <div style={{ padding:'10px 16px', background:'#f8fafc', borderTop:`1px solid ${C.border}`, fontSize:'12px', color:C.muted, textAlign:'right' }}>
            {selYear}년 총 <strong style={{ color:C.text }}>{filtered.length}명</strong>
          </div>
        </div>
      )}

      {modalMode && <FormModal mode={modalMode} />}
      {detailItem && <DetailModal t={detailItem} />}
    </div>
  )
}

// ── 학생 현황 탭
function StudentsTab({ session }) {
  const [teachers, setTeachers] = useState([])
  const [studentMap, setStudentMap] = useState({}) // teacherId → students[]
  const [loading, setLoading] = useState(true)
  const [selTeacher, setSelTeacher] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const t = await DB.teachers(session.adminId)
      setTeachers(t)
      // 각 선생님의 학생 조회
      const map = {}
      await Promise.all(t.map(async teacher => {
        if (!teacher.teacherId) return
        const students = await dbCall('where','students',{ where:{ teacherId: teacher.teacherId } }).catch(()=>[])
        map[teacher.teacherId] = students || []
      }))
      setStudentMap(map)
      if (t.length > 0) setSelTeacher(t[0])
      setLoading(false)
    }
    load()
  }, [session.adminId])

  const students = selTeacher ? (studentMap[selTeacher.teacherId] || []) : []
  const confirmed = students.filter(s => s.status === 'confirmed')

  return (
    <div style={{ padding:'24px' }}>
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>👥 학생 현황</div>
        <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>담당 선생님별 학생 현황을 확인하세요</div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div> : (
        <div style={{ display:'flex', gap:'16px' }}>
          {/* 선생님 목록 */}
          <div style={{ width:'200px', flexShrink:0 }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>선생님 선택</div>
            {teachers.map(t => (
              <button key={t.id} onClick={()=>setSelTeacher(t)} style={{
                width:'100%', padding:'10px 14px', borderRadius:'10px', border:`1.5px solid ${selTeacher?.id===t.id?C.primary:C.border}`,
                background: selTeacher?.id===t.id?'#eff6ff':C.card,
                color: selTeacher?.id===t.id?C.primary:C.text,
                fontSize:'13px', fontWeight: selTeacher?.id===t.id?700:400,
                cursor:'pointer', textAlign:'left', marginBottom:'6px',
                fontFamily:'Noto Sans KR, sans-serif',
              }}>
                {t.teacherName}
                <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>{(studentMap[t.teacherId]||[]).filter(s=>s.status==='confirmed').length}명 확정</div>
              </button>
            ))}
          </div>

          {/* 학생 목록 */}
          <div style={{ flex:1 }}>
            {selTeacher && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                  <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{selTeacher.teacherName} 선생님</span>
                  <span style={{ fontSize:'12px', background:'#eff6ff', color:C.primary, padding:'3px 10px', borderRadius:'999px', fontWeight:600 }}>확정 {confirmed.length}명 / 전체 {students.length}명</span>
                </div>
                {students.length === 0
                  ? <div style={{ textAlign:'center', padding:'40px', color:C.muted, background:C.bg, borderRadius:'12px', border:`1px dashed ${C.border}` }}>학생 데이터가 없습니다.</div>
                  : <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 80px 80px 1fr', padding:'10px 16px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
                        <span>#</span><span>이름</span><span>학년</span><span>상태</span><span>학부모 연락처</span>
                      </div>
                      {students.map((s,i) => (
                        <div key={s.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr 80px 80px 1fr', padding:'10px 16px', borderBottom: i<students.length-1?`1px solid ${C.border}`:'none', alignItems:'center', fontSize:'13px' }}>
                          <span style={{ color:C.muted }}>{i+1}</span>
                          <span style={{ fontWeight:600, color:C.text }}>{s.name}</span>
                          <span style={{ color:C.muted }}>{s.grade?`${s.grade}학년`:'-'}</span>
                          <span style={{ fontSize:'11px', fontWeight:700, color: s.status==='confirmed'?C.success:C.muted }}>{s.status==='confirmed'?'✅확정':'대기'}</span>
                          <span style={{ color:C.muted }}>{s.parentPhone||'-'}</span>
                        </div>
                      ))}
                    </div>
                }
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 선생님 초대 이메일 발송
async function sendTeacherInviteEmail({ teacherName, email, schoolName, adminName }) {
  const html = `
    <div style="font-family:'Noto Sans KR',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#3b82f6;font-size:22px;margin-bottom:6px">📋 방과후 출석부</h1>
      <p style="color:#374151;font-size:15px;margin-bottom:24px">
        안녕하세요, <strong>${teacherName}</strong> 선생님!<br/>
        <strong>${schoolName}</strong>${adminName ? ` 담당자 <strong>${adminName}</strong>님이` : '에서'} 연결을 초대했습니다.
      </p>
      <div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:14px;color:#1e3a5f;margin-bottom:6px">🏫 학교: <strong>${schoolName}</strong></div>
        ${adminName ? `<div style="font-size:14px;color:#1e3a5f;margin-bottom:16px">👤 담당자: <strong>${adminName}</strong></div>` : ''}
        <p style="font-size:13px;color:#374151;margin-bottom:16px;">
          방과후 출석부 앱에 <strong>이 이메일(${email})로 가입</strong>하신 후,<br/>
          대시보드에서 초대장을 확인하고 수락해주세요.
        </p>
        <a href="${window.location.origin}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;">
          앱 접속하기 →
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.7;">
        ※ 앱 가입 시 이 이메일 주소(${email})를 사용하셔야 대시보드에 초대장이 표시됩니다.<br/>
        본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
  `
  if (!isConfigured) {
    alert(`[개발모드] ${teacherName}(${email}) 초대 이메일\n앱: ${window.location.origin}`)
    return true
  }
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: `[방과후 출석부] ${schoolName} 담당자가 초대했습니다`,
        html,
      }),
    })
    return res.ok
  } catch { return false }
}

// ── 선생님 연결 관리 탭
// ● 이메일 일치(앱 가입) → 이메일 발송 + DB 초대(대시보드 팝업)
// ● 이메일 불일치(미가입) → 이메일만 발송 (대시보드 팝업 없음)
function ConnectTab({ session }) {
  const { success, error } = useToast()
  const [roster,   setRoster]   = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [invites,  setInvites]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState({})
  const [selYear,  setSelYear]  = useState(CURRENT_YEAR)

  const load = async () => {
    setLoading(true)
    try {
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
    } catch {}
    setLoading(false)
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
    emailed:   { label:'📧 이메일 발송됨',bg:'#f0f9ff', badge:'#e0f2fe', color:'#0369a1' },
    ready:     { label:'앱 가입됨',       bg:'#f8fafc', badge:'#eff6ff', color:'#3b82f6' },
    notjoined: { label:'앱 미가입',       bg:'transparent', badge:'#f3f4f6', color:'#9ca3af' },
  }

  const counts = filtered.reduce((acc, t) => {
    const s = getStatus(t); acc[s] = (acc[s]||0)+1; return acc
  }, {})

  const sendInvite = async (t) => {
    const email = t.email?.toLowerCase()
    if (!email) { error('이메일이 등록되지 않은 선생님입니다.'); return }
    setSending(prev => ({ ...prev, [t.id]: true }))
    try {
      const appUser       = appByEmail[email]
      const existingInv   = inviteByEmail[email]
      // 앱 가입 여부에 따라 status 결정
      // 가입됨 → pending (대시보드 팝업 발송)
      // 미가입  → emailed (이메일만, 팝업 없음)
      const newStatus = appUser ? 'pending' : 'emailed'

      // DB 저장 (가입된 선생님만 대시보드 팝업 트리거)
      await dbCall('upsert', 'schoolTeacherInvites', {
        data: {
          id:           existingInv?.id || uid(),
          adminId:      session.adminId,
          schoolName:   session.admin?.schoolName || '',
          adminName:    session.admin?.adminName  || '',
          teacherEmail: email,
          teacherName:  t.teacherName,
          teacherId:    appUser?.id || null,
          status:       newStatus,
          sentAt:       now(),
          createdAt:    existingInv?.createdAt || now(),
        }
      })
      // 이메일 항상 발송
      await sendTeacherInviteEmail({
        teacherName: t.teacherName,
        email,
        schoolName:  session.admin?.schoolName || '',
        adminName:   session.admin?.adminName  || '',
      })

      if (appUser) {
        success(`${t.teacherName} 선생님에게 초대를 발송했습니다. (이메일 + 대시보드 알림)`)
      } else {
        success(`${t.teacherName} 선생님에게 이메일을 발송했습니다. (앱 미가입 — 대시보드 알림 없음)`)
      }
      await load()
    } catch { error('초대 발송 중 오류가 발생했습니다.') }
    setSending(prev => ({ ...prev, [t.id]: false }))
  }

  // 일괄 초대: ready + notjoined 모두 (ready는 팝업, notjoined는 이메일만)
  const sendBulk = async () => {
    const targets = filtered.filter(t => ['ready','notjoined'].includes(getStatus(t)))
    if (!targets.length) { error('발송할 선생님이 없습니다.'); return }
    for (const t of targets) await sendInvite(t)
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
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'13px', color:'#1e40af', lineHeight:1.9 }}>
        <strong>초대 흐름</strong><br/>
        ① 선생님 현황 탭에서 등록 &nbsp;→&nbsp;
        ② <strong>초대 발송</strong><br/>
        &nbsp;&nbsp;&nbsp;• 앱 가입 선생님 → <strong>이메일 + 대시보드 팝업</strong> 동시 발송<br/>
        &nbsp;&nbsp;&nbsp;• 앱 미가입 선생님 → <strong>이메일만</strong> 발송 (가입 후 대시보드에 팝업)<br/>
        ③ 선생님이 대시보드에서 <strong>수락</strong> → ✅ 연결 완료
      </div>

      {/* 통계 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'20px' }}>
        {[
          { label:'전체',       value:filtered.length,      ...SI.notjoined },
          { label:'✅ 연결 완료', value:counts.accepted||0,  ...SI.accepted  },
          { label:'수락 대기',   value:counts.pending||0,   ...SI.pending   },
          { label:'이메일 발송', value:counts.emailed||0,   ...SI.emailed   },
          { label:'앱 미가입',   value:counts.notjoined||0, color:'#9ca3af', bg:'#f3f4f6' },
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
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 130px 120px', padding:'10px 18px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
            <span>이름</span><span>과목·요일</span><span>이메일</span>
            <span style={{ textAlign:'center' }}>상태</span>
            <span style={{ textAlign:'center' }}>초대</span>
          </div>
          {filtered.map((t, i) => {
            const st  = getStatus(t)
            const si  = SI[st]
            const inv = inviteByEmail[t.email?.toLowerCase()]
            return (
              <div key={t.id} style={{
                display:'grid', gridTemplateColumns:'1fr 1fr 1fr 130px 120px',
                padding:'13px 18px', borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none',
                alignItems:'center', background:si.bg,
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
                  <span style={{ fontSize:'11px', fontWeight:700, color:si.color, background:si.badge, padding:'3px 10px', borderRadius:'999px', whiteSpace:'nowrap' }}>
                    {si.label}
                  </span>
                </div>
                <div style={{ textAlign:'center' }}>
                  {st === 'accepted' ? (
                    <span style={{ fontSize:'12px', color:'#16a34a' }}>—</span>
                  ) : (
                    <button onClick={() => sendInvite(t)} disabled={!!sending[t.id]} style={{
                      padding:'5px 12px', borderRadius:'7px', border:'none',
                      cursor:sending[t.id]?'not-allowed':'pointer',
                      background: st==='pending'||st==='emailed' ? '#f1f5f9' : C.primary,
                      color:      st==='pending'||st==='emailed' ? C.muted   : '#fff',
                      fontSize:'12px', fontWeight:700,
                      fontFamily:'Noto Sans KR, sans-serif',
                      opacity: sending[t.id] ? .6 : 1,
                    }}>
                      {sending[t.id] ? '발송 중...' : (st==='pending'||st==='emailed') ? '재발송' : '초대 발송'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SchoolAdminApp({ session, onLogout }) {
  const [page, setPage] = useState('notices')

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f1f5f9', fontFamily:'Noto Sans KR, sans-serif' }}>
      <Sidebar session={session} page={page} onNav={setPage} onLogout={onLogout} />
      <main style={{ flex:1, overflowY:'auto' }}>
        {page === 'notices'  && <NoticesTab session={session} />}
        {page === 'teachers' && <TeachersTab session={session} />}
        {page === 'connect'  && <ConnectTab session={session} />}
        {page === 'students' && <StudentsTab session={session} />}
      </main>
    </div>
  )
}
