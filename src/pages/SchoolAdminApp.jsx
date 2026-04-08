/**
 * SchoolAdminApp.jsx
 * 학교 담당자 포털
 * - 공지/업무 요청 생성
 * - 선생님별 제출 현황 실시간 확인
 * - 전원 제출 시 자동 알림
 * - 담당 선생님 학생 현황 조회
 */
import React, { useState, useEffect, useCallback } from 'react'
import { dbCall, isConfigured } from '../lib/supabase.js'
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
function TeachersTab({ session }) {
  const { success, error } = useToast()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ teacherName:'', teacherPhone:'', teacherId:'' })

  const load = async () => {
    setLoading(true)
    const t = await DB.teachers(session.adminId)
    setTeachers(t)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.teacherName.trim()) { error('선생님 이름을 입력해주세요.'); return }
    await DB.saveTeacher({
      id: uid(), adminId: session.adminId,
      schoolName: session.admin?.schoolName || '',
      teacherName: form.teacherName, teacherPhone: form.teacherPhone,
      teacherId: form.teacherId || uid(),
      active: true, createdAt: now(),
    })
    setForm({ teacherName:'', teacherPhone:'', teacherId:'' })
    setShowAdd(false)
    success('선생님이 추가되었습니다.')
    load()
  }

  const removeTeacher = async (id) => {
    if (!window.confirm('선생님을 목록에서 제외하시겠습니까?')) return
    await dbCall('update', 'schoolAdminTeachers', { id, patch: { active: false } })
    success('제외되었습니다.')
    load()
  }

  return (
    <div style={{ padding:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>👩‍🏫 선생님 현황</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>담당 학교 방과후 강사 목록</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)}>{showAdd?'취소':'+ 선생님 추가'}</Btn>
      </div>

      {showAdd && (
        <div style={{ background:'#eff6ff', borderRadius:'12px', border:'2px solid #93c5fd', padding:'16px', marginBottom:'16px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:2, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>이름 *</label>
            <input style={iSt} value={form.teacherName} onChange={e=>setForm(f=>({...f,teacherName:e.target.value}))} placeholder="선생님 이름" />
          </div>
          <div style={{ flex:2, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>연락처</label>
            <input style={iSt} value={form.teacherPhone} onChange={e=>setForm(f=>({...f,teacherPhone:e.target.value}))} placeholder="010-0000-0000" />
          </div>
          <Btn onClick={handleAdd}>추가</Btn>
        </div>
      )}

      {loading ? <div style={{ textAlign:'center', padding:'40px', color:C.muted }}>불러오는 중...</div> : (
        teachers.length === 0
          ? <div style={{ textAlign:'center', padding:'60px', color:C.muted, background:C.bg, borderRadius:'14px', border:`1px dashed ${C.border}` }}>
              <div style={{ fontSize:'40px', marginBottom:'10px' }}>👩‍🏫</div>
              <div>등록된 선생님이 없습니다.</div>
            </div>
          : <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 80px', padding:'10px 16px', background:'#f8fafc', borderBottom:`1px solid ${C.border}`, fontSize:'12px', fontWeight:700, color:C.muted }}>
                <span>이름</span><span>연락처</span><span>소속 학교</span><span></span>
              </div>
              {teachers.map((t,i) => (
                <div key={t.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 80px', padding:'12px 16px', borderBottom: i<teachers.length-1?`1px solid ${C.border}`:'none', alignItems:'center' }}>
                  <span style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{t.teacherName}</span>
                  <span style={{ fontSize:'13px', color:C.muted }}>{t.teacherPhone||'-'}</span>
                  <span style={{ fontSize:'13px', color:C.muted }}>{t.schoolName||'-'}</span>
                  <button onClick={()=>removeTeacher(t.id)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>제외</button>
                </div>
              ))}
            </div>
      )}
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

// ── 메인
// ── 선생님 연결 관리 탭
function ConnectTab({ session }) {
  const { success, error } = useToast()
  const [allTeachers, setAllTeachers] = useState([])   // Supabase users (level=1, role=teacher)
  const [linked, setLinked]           = useState([])   // schoolAdminTeachers linked
  const [requests, setRequests]       = useState([])   // schoolTeacherConnectRequests (pending/accepted)
  const [selected, setSelected]       = useState([])   // 선택된 teacherIds
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [tab, setTab]                 = useState('unlinked') // 'unlinked' | 'linked'

  const load = async () => {
    setLoading(true)
    try {
      const [teachers, linkedList, reqList] = await Promise.all([
        dbCall('getAll', 'users').then(r => (r||[]).filter(u => u.role === 'teacher')),
        dbCall('getAll', 'schoolAdminTeachers').then(r => (r||[]).filter(t => t.adminId === session.adminId && t.active !== false)),
        dbCall('getAll', 'schoolTeacherConnectRequests').then(r => (r||[]).filter(q => q.adminId === session.adminId)),
      ])
      setAllTeachers(teachers)
      setLinked(linkedList)
      setRequests(reqList)
    } catch(e) {
      error('데이터 로딩 실패')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const linkedTeacherIds  = new Set(linked.map(t => t.teacherId))
  const pendingTeacherIds = new Set(requests.filter(r => r.status === 'pending').map(r => r.teacherId))
  const acceptedIds       = new Set(requests.filter(r => r.status === 'accepted').map(r => r.teacherId))

  // 미연결 선생님: linked에 없고 accepted에도 없는 사람
  const unlinkedTeachers = allTeachers.filter(t =>
    !linkedTeacherIds.has(t.id) && !acceptedIds.has(t.id)
  )
  const linkedTeachers = allTeachers.filter(t =>
    linkedTeacherIds.has(t.id) || acceptedIds.has(t.id)
  )

  const toggleSelect = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const allSelected = selected.length === unlinkedTeachers.length && unlinkedTeachers.length > 0
  const toggleAll   = () => setSelected(allSelected ? [] : unlinkedTeachers.map(t => t.id))

  const sendRequests = async () => {
    if (selected.length === 0) { error('선생님을 선택해주세요.'); return }
    setSending(true)
    try {
      // 이미 pending 요청이 있는 건 skip
      const toSend = selected.filter(tid => !pendingTeacherIds.has(tid))
      if (toSend.length === 0) { error('선택한 선생님 모두 이미 요청이 발송된 상태입니다.'); setSending(false); return }
      await Promise.all(toSend.map(tid =>
        dbCall('upsert', 'schoolTeacherConnectRequests', {
          data: {
            id: uid(),
            adminId:    session.adminId,
            schoolName: session.admin?.schoolName || '',
            teacherId:  tid,
            status:     'pending',
            createdAt:  now(),
          }
        })
      ))
      success(`${toSend.length}명에게 연결 요청을 발송했습니다.`)
      setSelected([])
      await load()
    } catch { error('요청 발송 중 오류가 발생했습니다.') }
    setSending(false)
  }

  const cancelRequest = async (teacherId) => {
    const req = requests.find(r => r.teacherId === teacherId && r.status === 'pending')
    if (!req) return
    await dbCall('delete', 'schoolTeacherConnectRequests', { id: req.id })
    success('연결 요청을 취소했습니다.')
    await load()
  }

  const unlinkTeacher = async (teacherId) => {
    if (!window.confirm('연결을 해제하시겠습니까?')) return
    // schoolAdminTeachers 비활성화
    const lt = linked.find(t => t.teacherId === teacherId)
    if (lt) await dbCall('update', 'schoolAdminTeachers', { id: lt.id, patch: { active: false } })
    // accepted request도 정리
    const req = requests.find(r => r.teacherId === teacherId && r.status === 'accepted')
    if (req) await dbCall('delete', 'schoolTeacherConnectRequests', { id: req.id })
    success('연결이 해제되었습니다.')
    await load()
  }

  const TAB_BTN = (id, label, count) => (
    <button onClick={() => setTab(id)} style={{
      padding:'8px 20px', borderRadius:'9px', border:'none', cursor:'pointer',
      fontFamily:'Noto Sans KR, sans-serif', fontWeight: tab===id?700:400, fontSize:'13px',
      background: tab===id?C.primary:'#f1f5f9', color: tab===id?'#fff':C.muted,
      transition:'all .15s',
    }}>
      {label} {count > 0 && <span style={{ marginLeft:'4px', background: tab===id?'rgba(255,255,255,0.3)':'#e5e7eb', borderRadius:'999px', padding:'1px 7px', fontSize:'11px' }}>{count}</span>}
    </button>
  )

  return (
    <div style={{ padding:'28px', maxWidth:'900px' }}>
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>🔗 선생님 연결 관리</div>
        <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>
          레벨1 선생님에게 연결 요청을 보내고, 수락된 선생님과 연동하세요
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'연결된 선생님', value: linkedTeachers.length, color:'#16a34a', bg:'#f0fdf4' },
          { label:'요청 발송 중',  value: [...pendingTeacherIds].filter(id => !linkedTeacherIds.has(id) && !acceptedIds.has(id)).length, color:'#d97706', bg:'#fffbeb' },
          { label:'미연결 선생님', value: unlinkedTeachers.filter(t => !pendingTeacherIds.has(t.id)).length, color:'#6b7280', bg:'#f9fafb' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:'14px', padding:'16px 20px', border:`1px solid ${s.color}22` }}>
            <div style={{ fontSize:'24px', fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {TAB_BTN('unlinked', '미연결 선생님', unlinkedTeachers.length)}
        {TAB_BTN('linked',   '연결된 선생님', linkedTeachers.length)}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>로딩 중...</div>
      ) : tab === 'unlinked' ? (
        <div style={{ background:C.card, borderRadius:'16px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {/* 상단 액션바 */}
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8fafc' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor:C.primary, width:'15px', height:'15px' }} />
              <span style={{ fontSize:'13px', color:C.muted }}>
                {selected.length > 0 ? `${selected.length}명 선택됨` : '전체 선택'}
              </span>
            </div>
            <button
              onClick={sendRequests}
              disabled={sending || selected.length === 0}
              style={{
                padding:'8px 18px', borderRadius:'9px', border:'none',
                background: selected.length===0?'#e5e7eb':C.primary,
                color: selected.length===0?C.muted:'#fff',
                fontWeight:700, fontSize:'13px', cursor: selected.length===0?'not-allowed':'pointer',
                fontFamily:'Noto Sans KR, sans-serif',
              }}
            >
              {sending ? '발송 중...' : `📨 일괄 연결요청 (${selected.length}명)`}
            </button>
          </div>

          {unlinkedTeachers.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>
              미연결 선생님이 없습니다 🎉
            </div>
          ) : (
            <div>
              {unlinkedTeachers.map((t, i) => {
                const isPending = pendingTeacherIds.has(t.id)
                return (
                  <div key={t.id} style={{
                    display:'grid', gridTemplateColumns:'40px 1fr auto',
                    padding:'12px 18px', borderBottom: i<unlinkedTeachers.length-1?`1px solid ${C.border}`:'none',
                    alignItems:'center', gap:'12px',
                    background: selected.includes(t.id)?'#eff6ff':'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(t.id)}
                      onChange={() => !isPending && toggleSelect(t.id)}
                      disabled={isPending}
                      style={{ accentColor:C.primary, width:'15px', height:'15px' }}
                    />
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>
                        {t.name} 선생님
                      </div>
                      <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                        {t.email || t.phone || '-'} · Lv.{t.level||1}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {isPending ? (
                        <>
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', background:'#fffbeb', color:'#d97706' }}>요청 발송됨</span>
                          <button onClick={() => cancelRequest(t.id)}
                            style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            취소
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { setSelected([t.id]); setTimeout(sendRequests, 0) }}
                          style={{ fontSize:'12px', padding:'5px 12px', borderRadius:'7px', border:'none', background:'#eff6ff', color:C.primary, fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                          요청보내기
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        // 연결된 선생님 탭
        <div style={{ background:C.card, borderRadius:'16px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {linkedTeachers.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>
              연결된 선생님이 없습니다
            </div>
          ) : (
            linkedTeachers.map((t, i) => (
              <div key={t.id} style={{
                display:'grid', gridTemplateColumns:'1fr auto',
                padding:'14px 18px', borderBottom: i<linkedTeachers.length-1?`1px solid ${C.border}`:'none',
                alignItems:'center',
              }}>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>
                    ✅ {t.name} 선생님
                  </div>
                  <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                    {t.email || t.phone || '-'} · Lv.{t.level||1}
                  </div>
                </div>
                <button onClick={() => unlinkTeacher(t.id)}
                  style={{ fontSize:'12px', padding:'5px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  연결 해제
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}


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
