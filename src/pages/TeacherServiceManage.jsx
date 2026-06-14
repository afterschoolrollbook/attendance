import React, { useState } from 'react'
import { Settings } from '../lib/db.js'
import { Card, PageHeader, Btn, Modal, Toggle, useConfirm } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a' }

const TS_KEY = 'asa_settings_teacherService'

function loadTS() {
  return Settings.get('teacherService') || { menuVisible:{ training:true, certificates:true, career:true, jobs:true }, trainingSites:[], certPartners:[], jobPostings:[] }
}
function saveTS(data) { Settings.set('teacherService', data) }


function SubTitle({ children }) {
  return <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'14px', paddingBottom:'10px', borderBottom:`1px solid ${C.border}` }}>{children}</div>
}

export function TeacherServiceManage({ user }) {
  const [ts, setTs]       = useState(loadTS)
  const [subtab, setSubtab] = useState('training')
  const { success, toastError } = useToast()
  const confirm = useConfirm()

  // ── 연수기관 폼
  const EMPTY_SITE = { name:'', url:'', desc:'', courses:'' }
  const [siteModal, setSiteModal]   = useState(false)
  const [siteForm, setSiteForm]     = useState(EMPTY_SITE)
  const [siteEditIdx, setSiteEditIdx] = useState(null)

  // ── 자격증 제휴처 폼
  const EMPTY_PARTNER = { name:'', url:'', desc:'', tag:'제휴', subjects:'' }
  const [partnerModal, setPartnerModal]   = useState(false)
  const [partnerForm, setPartnerForm]     = useState(EMPTY_PARTNER)
  const [partnerEditIdx, setPartnerEditIdx] = useState(null)

  // ── 공고 직접 등록 폼
  const EMPTY_JOB = { title:'', office:'', school:'', subject:'', deadline:'', url:'', memo:'' }
  const [jobModal, setJobModal]   = useState(false)
  const [jobForm, setJobForm]     = useState(EMPTY_JOB)
  const [jobEditIdx, setJobEditIdx] = useState(null)

  const update = (patch) => { const next = { ...ts, ...patch }; setTs(next); return next }

  const save = (patch) => {
    const next = patch ? { ...ts, ...patch } : ts
    setTs(next); saveTS(next)
    success('수정이 완료되었습니다.')
  }

  // ─ 연수기관 저장
  const saveSite = () => {
    if (!siteForm.name.trim()) { toastError('기관명을 입력하세요.'); return }
    const item = { ...siteForm, courses: siteForm.courses.split('\n').map(s=>s.trim()).filter(Boolean), id: siteEditIdx !== null ? ts.trainingSites[siteEditIdx].id : String(Date.now()) }
    const updated = siteEditIdx !== null
      ? ts.trainingSites.map((s,i) => i===siteEditIdx ? item : s)
      : [...ts.trainingSites, item]
    save({ trainingSites: updated })
    setSiteModal(false)
  }
  const openAddSite = () => { setSiteForm(EMPTY_SITE); setSiteEditIdx(null); setSiteModal(true) }
  const openEditSite = (i) => {
    const s = ts.trainingSites[i]
    setSiteForm({ name:s.name, url:s.url||'', desc:s.desc||'', courses: Array.isArray(s.courses) ? s.courses.join('\n') : (s.courses||'') })
    setSiteEditIdx(i); setSiteModal(true)
  }
  const deleteSite = (i) => {
    confirm('삭제할까요?', () => {
      save({ trainingSites: ts.trainingSites.filter((_,idx)=>idx!==i) })
    })
  }

  // ─ 자격증 제휴처 저장
  const savePartner = () => {
    if (!partnerForm.name.trim()) { toastError('기관명을 입력하세요.'); return }
    const item = { ...partnerForm, subjects: partnerForm.subjects.split(',').map(s=>s.trim()).filter(Boolean), id: partnerEditIdx !== null ? ts.certPartners[partnerEditIdx].id : String(Date.now()) }
    const updated = partnerEditIdx !== null
      ? ts.certPartners.map((p,i) => i===partnerEditIdx ? item : p)
      : [...ts.certPartners, item]
    save({ certPartners: updated })
    setPartnerModal(false)
  }
  const openAddPartner = () => { setPartnerForm(EMPTY_PARTNER); setPartnerEditIdx(null); setPartnerModal(true) }
  const openEditPartner = (i) => {
    const p = ts.certPartners[i]
    setPartnerForm({ name:p.name, url:p.url||'', desc:p.desc||'', tag:p.tag||'제휴', subjects: Array.isArray(p.subjects) ? p.subjects.join(', ') : (p.subjects||'') })
    setPartnerEditIdx(i); setPartnerModal(true)
  }
  const deletePartner = (i) => {
    confirm('삭제할까요?', () => {
      save({ certPartners: ts.certPartners.filter((_,idx)=>idx!==i) })
    })
  }

  // ─ 공고 직접 등록
  const saveJob = () => {
    if (!jobForm.title.trim()) { toastError('공고 제목을 입력하세요.'); return }
    const item = { ...jobForm, id: jobEditIdx !== null ? ts.jobPostings[jobEditIdx].id : String(Date.now()), createdAt: jobEditIdx !== null ? ts.jobPostings[jobEditIdx].createdAt : new Date().toISOString().slice(0,10) }
    const updated = jobEditIdx !== null
      ? ts.jobPostings.map((j,i) => i===jobEditIdx ? item : j)
      : [item, ...ts.jobPostings]
    save({ jobPostings: updated })
    setJobModal(false)
  }
  const openAddJob = () => { setJobForm(EMPTY_JOB); setJobEditIdx(null); setJobModal(true) }
  const openEditJob = (i) => { setJobForm({ ...ts.jobPostings[i] }); setJobEditIdx(i); setJobModal(true) }
  const deleteJob = (i) => {
    confirm('삭제할까요?', () => {
      save({ jobPostings: ts.jobPostings.filter((_,idx)=>idx!==i) })
    })
  }

  const fStyle = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }
  const tagColors = { '제휴':'#eff6ff:#bfdbfe:#1d4ed8', '광고':'#fff7ed:#fed7aa:#9a3412', '공식':'#f0fdf4:#86efac:#15803d' }
  const getTagColor = (tag) => { const [bg,border,text] = (tagColors[tag]||'#f3f4f6:#d1d5db:#374151').split(':'); return { bg,border,color:text } }

  return (
    <div style={{ padding:'28px', maxWidth:'1100px' }}>
      <PageHeader title="강사 서비스 관리" sub="연수기관·자격증 제휴처·공고를 직접 등록하고 관리합니다." />
      <Card style={{ marginTop:'20px' }}>

      {/* 서브탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap' }}>
        {[
          { key:'training', label:'🎓 연수기관 관리' },
          { key:'cert',     label:'🏆 자격증 제휴처' },
          { key:'jobs',     label:'📢 공고 직접 등록' },
        ].map(t => (
          <button key={t.key} onClick={() => setSubtab(t.key)}
            style={{ padding:'7px 14px', borderRadius:'8px', border:`1.5px solid ${subtab===t.key?C.primary:C.border}`, background: subtab===t.key?'#fff7ed':'#fff', color: subtab===t.key?C.primary:'#6b7280', fontWeight: subtab===t.key?700:400, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 메뉴 ON/OFF */}
      {/* ── 연수기관 관리 */}
      {subtab === 'training' && (
        <>
          <SubTitle>🎓 연수기관 목록 관리</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            여기서 등록한 기관이 강사의 <strong>연수관리 → 연수 사이트</strong> 탭에 표시됩니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={openAddSite} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 기관 추가</button>
          </div>
          {ts.trainingSites.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>🎓</div>
              등록된 연수기관이 없습니다.<br/>
              <span style={{ fontSize:'12px' }}>기본 연수기관은 강사 페이지에 하드코딩된 목록이 표시됩니다.</span>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
              {ts.trainingSites.map((s,i) => (
                <div key={s.id||i} style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{s.name}</span>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#3b82f6' }}>🔗 사이트</a>}
                    </div>
                    {s.desc && <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>{s.desc}</div>}
                    {s.courses?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                        {s.courses.map((c,ci) => <span key={ci} style={{ fontSize:'11px', background:'#fff7ed', color:'#92400e', border:'1px solid #fde68a', borderRadius:'5px', padding:'1px 7px' }}>{c}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    <button onClick={() => openEditSite(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                    <button onClick={() => deleteSite(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 자격증 제휴처 */}
      {subtab === 'cert' && (
        <>
          <SubTitle>🏆 자격증 취득 제휴처 / 광고 기관</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            여기서 등록한 기관이 강사의 <strong>자격증관리 → 취득 기관 안내</strong> 탭에 표시됩니다.<br/>
            제휴처·공식기관·광고 등 태그로 구분할 수 있습니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={openAddPartner} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 기관 추가</button>
          </div>
          {ts.certPartners.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>🏆</div>
              등록된 제휴처가 없습니다.
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:'8px', marginBottom:'12px' }}>
              {ts.certPartners.map((p,i) => {
                const tc = getTagColor(p.tag)
                return (
                  <div key={p.id||i} style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{p.name}</span>
                      <span style={{ fontSize:'11px', padding:'1px 7px', borderRadius:'5px', background:tc.bg, border:`1px solid ${tc.border}`, color:tc.color, fontWeight:700 }}>{p.tag}</span>
                    </div>
                    {p.desc && <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>{p.desc}</div>}
                    {p.subjects?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginBottom:'8px' }}>
                        {p.subjects.map((s,si) => <span key={si} style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, borderRadius:'4px', padding:'1px 6px' }}>{s}</span>)}
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:'#3b82f6' }}>🔗 바로가기</a>}
                      <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
                        <button onClick={() => openEditPartner(i)} style={{ padding:'3px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                        <button onClick={() => deletePartner(i)} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 공고 직접 등록 */}
      {subtab === 'jobs' && (
        <>
          <SubTitle>📢 공고 직접 등록</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            NEIS에서 자동 수집되지 않는 공고를 직접 등록하세요.<br/>
            강사의 <strong>공고관리 → 공고 조회</strong>에 함께 표시됩니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={openAddJob} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 공고 등록</button>
          </div>
          {ts.jobPostings.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>📢</div>
              직접 등록된 공고가 없습니다.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
              {ts.jobPostings.map((j,i) => (
                <div key={j.id||i} style={{ padding:'14px 18px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{j.title}</span>
                      {j.subject && <span style={{ fontSize:'12px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{j.subject}</span>}
                      {j.deadline && new Date(j.deadline) < new Date() && <span style={{ fontSize:'11px', background:'#fef2f2', color:'#ef4444', border:'1px solid #fca5a5', borderRadius:'5px', padding:'1px 6px', fontWeight:700 }}>마감</span>}
                    </div>
                    <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                      {j.office && <span>🏛 {j.office}</span>}
                      {j.school && <span>🏫 {j.school}</span>}
                      {j.deadline && <span>⏰ 마감: {j.deadline}</span>}
                      <span>📅 등록: {j.createdAt}</span>
                    </div>
                    {j.memo && <div style={{ fontSize:'12px', color:'#374151', marginTop:'5px' }}>{j.memo}</div>}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0, alignItems:'center' }}>
                    {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" style={{ padding:'4px 10px', borderRadius:'6px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:'12px', color:'#15803d', textDecoration:'none', fontWeight:600 }}>🔗 공고</a>}
                    <button onClick={() => openEditJob(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                    <button onClick={() => deleteJob(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── 연수기관 모달 */}
      <Modal open={siteModal} onClose={()=>setSiteModal(false)} title={siteEditIdx !== null ? '연수기관 편집' : '연수기관 추가'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관명 *</label><input value={siteForm.name} onChange={e=>setSiteForm(v=>({...v,name:e.target.value}))} placeholder="예: 경기도교육청남부연수원" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>홈페이지 URL</label><input value={siteForm.url} onChange={e=>setSiteForm(v=>({...v,url:e.target.value}))} placeholder="https://" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>설명</label><input value={siteForm.desc} onChange={e=>setSiteForm(v=>({...v,desc:e.target.value}))} placeholder="간단한 설명" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>과정 목록 (줄바꿈으로 구분)</label>
            <textarea value={siteForm.courses} onChange={e=>setSiteForm(v=>({...v,courses:e.target.value}))} placeholder={'4대폭력예방교육\n개인정보 보호 교육'} rows={4} style={{ ...fStyle, resize:'vertical' }}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={saveSite} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
            <button onClick={()=>setSiteModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
          </div>
        </div>
      </Modal>

      {/* ─── 자격증 제휴처 모달 */}
      <Modal open={partnerModal} onClose={()=>setPartnerModal(false)} title={partnerEditIdx !== null ? '제휴처 편집' : '제휴처 추가'} width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관명 *</label><input value={partnerForm.name} onChange={e=>setPartnerForm(v=>({...v,name:e.target.value}))} placeholder="예: 한국로봇산업협회" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>홈페이지 URL</label><input value={partnerForm.url} onChange={e=>setPartnerForm(v=>({...v,url:e.target.value}))} placeholder="https://" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>설명</label><input value={partnerForm.desc} onChange={e=>setPartnerForm(v=>({...v,desc:e.target.value}))} placeholder="간단한 설명" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>태그</label>
            <select value={partnerForm.tag} onChange={e=>setPartnerForm(v=>({...v,tag:e.target.value}))} style={fStyle}>
              <option value="제휴">제휴</option>
              <option value="광고">광고</option>
              <option value="공식">공식</option>
            </select>
          </div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>관련 과목 (쉼표 구분)</label><input value={partnerForm.subjects} onChange={e=>setPartnerForm(v=>({...v,subjects:e.target.value}))} placeholder="로봇과학, 코딩, 드론" style={fStyle}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={savePartner} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
            <button onClick={()=>setPartnerModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
          </div>
        </div>
      </Modal>

      {/* ─── 공고 등록 모달 */}
      <Modal open={jobModal} onClose={()=>setJobModal(false)} title={jobEditIdx !== null ? '공고 편집' : '공고 등록'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>공고 제목 *</label><input value={jobForm.title} onChange={e=>setJobForm(v=>({...v,title:e.target.value}))} placeholder="예: 2026년 로봇과학 방과후 강사 모집" style={fStyle}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청</label><input value={jobForm.office} onChange={e=>setJobForm(v=>({...v,office:e.target.value}))} placeholder="예: 경기군포의왕" style={fStyle}/></div>
            <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>학교명</label><input value={jobForm.school} onChange={e=>setJobForm(v=>({...v,school:e.target.value}))} placeholder="예: 군포초등학교" style={fStyle}/></div>
          </div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>과목</label><input value={jobForm.subject} onChange={e=>setJobForm(v=>({...v,subject:e.target.value}))} placeholder="예: 로봇과학" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>마감일</label><input type="date" value={jobForm.deadline} onChange={e=>setJobForm(v=>({...v,deadline:e.target.value}))} style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>공고 URL</label><input value={jobForm.url} onChange={e=>setJobForm(v=>({...v,url:e.target.value}))} placeholder="https://" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모</label><input value={jobForm.memo} onChange={e=>setJobForm(v=>({...v,memo:e.target.value}))} placeholder="추가 안내사항" style={fStyle}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={saveJob} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
            <button onClick={()=>setJobModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
          </div>
        </div>
      </Modal>

      </Card>
    </div>
  )
}

