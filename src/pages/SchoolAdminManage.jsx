/**
 * SchoolAdminManage.jsx
 * 본사 관리자(Lv.5) 전용 — 학교 담당자 등록/초대/관리
 * VendorManage.jsx와 동일한 패턴
 */
import React, { useState, useEffect, useCallback } from 'react'
import { dbCall, isConfigured, FUNCTIONS_BASE } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary:'#3b82f6', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', card:'#fff', bg:'#f8fafc',
  success:'#16a34a', danger:'#ef4444',
}
const iSt = {
  width:'100%', padding:'9px 12px', borderRadius:'9px',
  border:'1.5px solid #e5e7eb', fontSize:'13px',
  fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}

function Btn({ children, onClick, disabled, danger, secondary, style={} }) {
  const bg = disabled?'#e5e7eb':danger?C.danger:secondary?'#fff':C.primary
  const cl = disabled?C.muted:secondary?C.text:'#fff'
  return (
    <button onClick={disabled?undefined:onClick} style={{
      padding:'8px 16px', borderRadius:'9px', border:secondary?`1px solid ${C.border}`:'none',
      background:bg, color:cl, fontWeight:600, fontSize:'13px',
      cursor:disabled?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', ...style,
    }}>{children}</button>
  )
}

function Modal({ title, onClose, width=480, children }) {
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

const STATUS = {
  pending:  { label:'초대 전',   bg:'#f3f4f6', color:'#6b7280' },
  invited:  { label:'초대 발송', bg:'#eff6ff', color:'#3b82f6' },
  joined:   { label:'가입 완료', bg:'#f0fdf4', color:'#16a34a' },
  inactive: { label:'비활성',    bg:'#fef2f2', color:'#ef4444' },
}
function Badge({ status }) {
  const s = STATUS[status] || STATUS.pending
  return <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'999px', background:s.bg, color:s.color }}>{s.label}</span>
}

const SchoolAdmins = {
  all:    async ()    => (await dbCall('getAll', 'schoolAdmins')) || [],
  save:   async (v)   => dbCall('upsert', 'schoolAdmins', { data: v }),
  delete: async (id)  => dbCall('delete', 'schoolAdmins', { id }),
}

// ── 등록/수정 폼
function AdminForm({ admin, onSave, onCancel }) {
  const [form, setForm] = useState({
    schoolName:'', adminName:'', phone:'', email:'', memo:'',
    ...(admin||{})
  })
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const { error } = useToast()

  const handleSave = async () => {
    if (!form.schoolName.trim()) { error('학교명을 입력해주세요.'); return }
    if (!form.email.trim()) { error('이메일을 입력해주세요.'); return }
    await SchoolAdmins.save({
      ...form,
      id: form.id || uid(),
      status: form.status || 'pending',
      createdAt: form.createdAt || now(),
    })
    onSave()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        <div>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>학교명 *</label>
          <input style={iSt} value={form.schoolName} onChange={set('schoolName')} placeholder="예: 산본초등학교" />
        </div>
        <div>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>담당자명</label>
          <input style={iSt} value={form.adminName} onChange={set('adminName')} placeholder="예: 홍길동" />
        </div>
        <div>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>연락처</label>
          <input style={iSt} value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" />
        </div>
        <div>
          <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>이메일 (로그인 ID) *</label>
          <input style={iSt} type="email" value={form.email} onChange={set('email')} placeholder="admin@school.kr" />
        </div>
      </div>
      <div>
        <label style={{ fontSize:'11px', color:C.muted, display:'block', marginBottom:'3px' }}>메모</label>
        <textarea style={{ ...iSt, resize:'vertical' }} rows={2} value={form.memo} onChange={set('memo')} placeholder="내부 메모" />
      </div>
      <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
        {onCancel && <Btn secondary onClick={onCancel}>취소</Btn>}
        <Btn onClick={handleSave}>{admin ? '수정 저장' : '+ 담당자 등록'}</Btn>
      </div>
    </div>
  )
}

// ── 초대 이메일 발송
async function sendInviteEmail(admin) {
  const link = `${window.location.origin}/school`
  const html = `
    <div style="font-family:'Noto Sans KR',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#3b82f6;font-size:22px;margin-bottom:6px">🏫 방과후 출석부</h1>
      <p style="color:#374151;font-size:15px;margin-bottom:24px">학교 담당자 포털에 초대되었습니다.</p>
      <div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:14px;color:#1e3a5f;margin-bottom:6px">🏫 학교: <strong>${admin.schoolName}</strong></div>
        <div style="font-size:14px;color:#1e3a5f;margin-bottom:16px">👤 담당자: <strong>${admin.adminName||''}</strong></div>
        <a href="${link}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;">
          포털 접속 및 가입하기 →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.7">
        접속 URL: ${link}<br/>
        등록된 이메일: ${admin.email}<br/><br/>
        본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
  `
  if (!isConfigured) {
    alert(`[개발모드] 초대 링크: ${link}`)
    return true
  }
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/send-email`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        to: admin.email,
        subject: `[방과후 출석부] ${admin.schoolName} 담당자 포털 초대`,
        html,
      }),
    })
    return res.ok
  } catch { return false }
}

export function SchoolAdminManage({ user }) {
  const { success, error } = useToast()
  const [admins, setAdmins]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [inviteModal, setInviteModal] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await SchoolAdmins.all()
    setAdmins(data.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    await SchoolAdmins.delete(id)
    success('삭제되었습니다.')
    load()
  }

  const handleInvite = async (admin) => {
    const ok = await sendInviteEmail(admin)
    if (ok) {
      await SchoolAdmins.save({ ...admin, status:'invited', invitedAt:now(), invitedEmail:admin.email })
      success(`${admin.schoolName} 담당자에게 초대 이메일을 발송했습니다.`)
      setInviteModal(null)
      load()
    } else {
      error('이메일 발송에 실패했습니다.')
    }
  }

  const filtered = admins.filter(a => {
    const matchQ = !q || a.schoolName?.includes(q) || a.adminName?.includes(q) || a.phone?.includes(q) || a.email?.includes(q)
    const matchS = !filterStatus || a.status === filterStatus
    return matchQ && matchS
  })

  const cnt = {
    total:   admins.length,
    invited: admins.filter(a=>a.status==='invited').length,
    joined:  admins.filter(a=>a.status==='joined').length,
    pending: admins.filter(a=>a.status==='pending').length,
  }

  return (
    <div style={{ padding:'24px', fontFamily:'Noto Sans KR, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'22px', fontWeight:800, color:C.text }}>🏫 학교 담당자 관리</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>학교 담당자를 등록하고 포털 초대를 발송하세요</div>
        </div>
        <Btn onClick={()=>{ setShowForm(s=>!s); setEditTarget(null) }}>
          {showForm?'닫기':'+ 담당자 등록'}
        </Btn>
      </div>

      {/* 통계 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
        {[
          ['전체', cnt.total, C.primary],
          ['초대 발송', cnt.invited, '#f59e0b'],
          ['가입 완료', cnt.joined, C.success],
          ['초대 전', cnt.pending, C.muted],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'14px 16px' }}>
            <div style={{ fontSize:'22px', fontWeight:800, color }}>{val}</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 등록 폼 */}
      {showForm && !editTarget && (
        <div style={{ background:'#eff6ff', borderRadius:'14px', border:'2px solid #93c5fd', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.primary, marginBottom:'12px' }}>📝 신규 담당자 등록</div>
          <AdminForm onSave={()=>{ setShowForm(false); success('등록되었습니다.'); load() }} />
        </div>
      )}

      {/* 수정 폼 */}
      {editTarget && (
        <div style={{ background:'#eff6ff', borderRadius:'14px', border:'2px solid #93c5fd', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.primary, marginBottom:'12px' }}>✏️ {editTarget.schoolName} 수정 중</div>
          <AdminForm admin={editTarget} onSave={()=>{ setEditTarget(null); success('수정되었습니다.'); load() }} onCancel={()=>setEditTarget(null)} />
        </div>
      )}

      {/* 필터 */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
        <input style={{ ...iSt, maxWidth:'280px' }} value={q} onChange={e=>setQ(e.target.value)} placeholder="학교명·담당자·연락처 검색" />
        <select style={{ ...iSt, maxWidth:'140px' }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">전체 상태</option>
          <option value="pending">초대 전</option>
          <option value="invited">초대 발송</option>
          <option value="joined">가입 완료</option>
          <option value="inactive">비활성</option>
        </select>
        {(q||filterStatus) && <Btn secondary onClick={()=>{ setQ(''); setFilterStatus('') }}>초기화</Btn>}
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.muted, background:C.bg, borderRadius:'14px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>🏫</div>
          <div>등록된 학교 담당자가 없습니다.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtered.map(admin => (
            <div key={admin.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'16px', fontWeight:700, color:C.text }}>🏫 {admin.schoolName}</span>
                    <Badge status={admin.status} />
                  </div>
                  {admin.adminName && <div style={{ fontSize:'13px', color:C.muted }}>👤 {admin.adminName}</div>}
                  <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                    {admin.phone && <span>📱 {admin.phone}</span>}
                    {admin.email && <span>✉️ {admin.email}</span>}
                    {admin.invitedAt && <span>📨 초대: {admin.invitedAt.slice(0,10)}</span>}
                  </div>
                  {admin.memo && <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'4px' }}>💬 {admin.memo}</div>}
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <Btn onClick={()=>setInviteModal(admin)}>
                    {admin.status==='invited'||admin.status==='joined' ? '📨 재발송' : '📨 초대'}
                  </Btn>
                  <Btn secondary onClick={()=>{ setEditTarget(admin); setShowForm(false) }}>수정</Btn>
                  <Btn danger onClick={()=>handleDelete(admin.id)}>삭제</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 초대 확인 모달 */}
      {inviteModal && (
        <Modal title="📨 초대 이메일 발송" onClose={()=>setInviteModal(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'6px' }}>🏫 {inviteModal.schoolName}</div>
              {inviteModal.adminName && <div style={{ fontSize:'13px', color:C.muted }}>담당자: {inviteModal.adminName}</div>}
              <div style={{ fontSize:'13px', color:C.muted }}>이메일: {inviteModal.email}</div>
            </div>
            <div style={{ fontSize:'13px', color:C.muted, lineHeight:1.7 }}>
              위 이메일로 학교 담당자 포털 초대장을 발송합니다.<br/>
              담당자는 이메일을 통해 가입 후 포털을 이용할 수 있습니다.<br/>
              접속 URL: <strong>{window.location.origin}/school</strong>
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <Btn secondary onClick={()=>setInviteModal(null)}>취소</Btn>
              <Btn onClick={()=>handleInvite(inviteModal)}>📨 발송</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
