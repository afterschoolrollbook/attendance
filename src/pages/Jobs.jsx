import React, { useState, useEffect } from 'react'
import { Btn } from '../components/Atoms.jsx'
import { uid, now } from '../lib/utils.js'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../hooks/useConfirm.js'

const C = { primary:'#f97316', success:'#16a34a', danger:'#ef4444', border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff', warning:'#f59e0b' }
const STORAGE_KEY = 'asa_job_subs'

function loadAdminJobPostings() {
  try {
    const ts = JSON.parse(localStorage.getItem('asa_settings_teacherService') || 'null')
    return ts?.jobPostings || []
  } catch { return [] }
}

function loadSubs(tid) { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').filter(r=>r.teacherId===tid) }
function saveSub(item) { const a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); const i=a.findIndex(r=>r.id===item.id); if(i>=0)a[i]=item; else a.push(item); localStorage.setItem(STORAGE_KEY,JSON.stringify(a)) }
function deleteSub(id) { localStorage.setItem(STORAGE_KEY,JSON.stringify(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').filter(r=>r.id!==id))) }

const EMPTY_SUB = { sido:'', office:'', school:'', subject:'', notifySms:false, notifyKakao:false, notifyEmail:true }

// NEIS API로 공고 조회
async function fetchJobPostings(settings, subscription) {
  try {
    const regionMap = settings?.regionMap
    if (!regionMap?.neisApiKey) return []
    const { neisApiKey } = regionMap
    // 나이스 방과후 공고 API (실제 엔드포인트는 교육청별 상이)
    const officeCode = regionMap.regions?.find(r => r.office === subscription.office)?.officeCode || ''
    if (!officeCode) return []
    const url = `https://open.neis.go.kr/hub/afterSchoolInfo?KEY=${neisApiKey}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&pIndex=1&pSize=20`
    const res = await fetch(url)
    const data = await res.json()
    return data?.afterSchoolInfo?.[1]?.row || []
  } catch { return [] }
}

export function Jobs({ user }) {
  const { success, error: toastError } = useToast()
  const { confirm } = useConfirm()
  const [tab, setTab]       = useState('postings')
  const [subs, setSubs]     = useState([])
  const [postings, setPostings] = useState([])
  const [adminPostings, setAdminPostings] = useState(() => loadAdminJobPostings())
  const [loading, setLoading] = useState(false)
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(EMPTY_SUB)
  const [editId, setEditId] = useState(null)
  const [settings, setSettings] = useState({})
  const [regionMap, setRegionMap] = useState(null)

  useEffect(() => {
    setSubs(loadSubs(user.id))
    // settings에서 regionMap 가져오기
    const s = JSON.parse(localStorage.getItem('asa_settings_regionMap') || 'null') ||
              JSON.parse(localStorage.getItem('asa_settings') || '{}')?.regionMap || null
    setSettings({ regionMap: s })
    setRegionMap(s)
  }, [])

  const reloadSubs = () => setSubs(loadSubs(user.id))

  const openAdd = () => { setForm(EMPTY_SUB); setEditId(null); setModal(true) }
  const openEdit = r => {
    setForm({ sido:r.sido||'', office:r.office||'', school:r.school||'', subject:r.subject||'', notifySms:!!r.notifySms, notifyKakao:!!r.notifyKakao, notifyEmail:!!r.notifyEmail })
    setEditId(r.id); setModal(true)
  }
  const save = () => {
    if (!form.subject.trim()) { toastError('과목을 입력하세요'); return }
    const item = { id:editId||uid(), teacherId:user.id, ...form, active:true, updatedAt:now() }
    if (!editId) item.createdAt = now()
    saveSub(item); reloadSubs(); setModal(false)
  }

  const loadPostings = async () => {
    setLoading(true)
    try {
      const results = []
      for (const sub of subs.filter(s=>s.active)) {
        const rows = await fetchJobPostings(settings, sub)
        results.push(...rows.map(r => ({ ...r, _sub: sub })))
      }
      setPostings(results)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'postings' && subs.length > 0) loadPostings()
  }, [tab, subs.length])

  // 지역/교육청 목록
  const regions = regionMap?.regions || []
  const sidos   = [...new Set(regions.map(r=>r.sido))]
  const offices = form.sido ? regions.filter(r=>r.sido===form.sido).map(r=>r.office) : regions.map(r=>r.office)

  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>📢 공고관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>방과후 구인 공고 알림 구독 및 조회</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {[['postings','📋 공고 조회'],['subs','🔔 구독 설정']].map(([t,label]) => (
            <button key={t} onClick={()=>setTab(t)}
              style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'13px', background: tab===t?C.primary:'#f3f4f6', color: tab===t?'#fff':C.muted }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 공고 조회 탭 */}
      {tab === 'postings' && (
        <>
          {/* 관리자 직접 등록 공고 */}
          {adminPostings.length > 0 && (
            <div style={{ marginBottom:'20px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
                📌 관리자 등록 공고
                <span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{adminPostings.length}건</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {adminPostings.map((j, i) => {
                  const isOver = j.deadline && j.deadline < new Date().toISOString().slice(0,10)
                  return (
                    <div key={j.id||i} style={{ background: isOver?'#f9fafb':C.card, borderRadius:'12px', border:`1px solid ${isOver?C.border:'#fed7aa'}`, padding:'14px 20px', opacity: isOver?0.7:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{j.title}</span>
                            {j.subject && <span style={{ fontSize:'12px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{j.subject}</span>}
                            {isOver && <span style={{ fontSize:'11px', background:'#fef2f2', color:C.danger, border:'1px solid #fca5a5', borderRadius:'5px', padding:'1px 6px', fontWeight:700 }}>마감</span>}
                          </div>
                          <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                            {j.office && <span>🏛 {j.office}</span>}
                            {j.school && <span>🏫 {j.school}</span>}
                            {j.deadline && <span>⏰ 마감: {j.deadline}</span>}
                            {j.memo && <span>📌 {j.memo}</span>}
                          </div>
                        </div>
                        {j.url && (
                          <a href={j.url} target="_blank" rel="noopener noreferrer"
                            style={{ padding:'6px 14px', borderRadius:'8px', background:'#f0fdf4', border:'1px solid #86efac', color:C.success, fontSize:'12px', fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                            공고 보기
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* NEIS 자동 조회 공고 */}
          {subs.length === 0 && adminPostings.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>🔔</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>구독 설정이 없습니다</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>구독 설정 탭에서 관심 지역과 과목을 등록하세요</div>
              <button onClick={()=>setTab('subs')} style={{ marginTop:'16px', padding:'9px 20px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>구독 설정하기</button>
            </div>
          ) : subs.length > 0 ? (
            <>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px' }}>🔍 NEIS 자동 조회 공고</div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap', alignItems:'center' }}>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {subs.filter(s=>s.active).map(s => (
                    <span key={s.id} style={{ fontSize:'12px', padding:'4px 10px', borderRadius:'6px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', fontWeight:600 }}>
                      {s.office||s.sido} · {s.subject}
                    </span>
                  ))}
                </div>
                <button onClick={loadPostings} style={{ marginLeft:'auto', padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:'#fff', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.text }}>
                  🔄 새로고침
                </button>
              </div>
              {loading ? (
                <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>🔍 공고 검색 중...</div>
              ) : postings.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                  <div style={{ fontSize:'24px', marginBottom:'8px' }}>📭</div>
                  <div style={{ fontSize:'14px' }}>현재 등록된 공고가 없습니다</div>
                  {!regionMap?.neisApiKey && <div style={{ fontSize:'12px', marginTop:'8px', color:C.danger }}>⚠️ 관리자 설정에서 NEIS API 키를 등록해주세요</div>}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {postings.map((p, i) => (
                    <div key={i} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px 20px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                        <div>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>
                            {p.AFTER_SCHL_NM || p.SCHOOL_NM || '공고명 없음'}
                          </div>
                          <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                            {p.SCHUL_NM && <span>🏫 {p.SCHUL_NM}</span>}
                            {p.COURS_NM && <span>📚 {p.COURS_NM}</span>}
                            {p.RCRT_BGDE && <span>📅 {p.RCRT_BGDE} ~ {p.RCRT_EDDE}</span>}
                            <span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, padding:'1px 6px', borderRadius:'4px' }}>{p._sub?.subject}</span>
                          </div>
                        </div>
                        {p.URL && (
                          <a href={p.URL} target="_blank" rel="noopener noreferrer"
                            style={{ padding:'6px 14px', borderRadius:'8px', background:'#eff6ff', border:'1px solid #bfdbfe', color:'#3b82f6', fontSize:'12px', fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                            공고 보기
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      {/* 구독 설정 탭 */}
      {tab === 'subs' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div style={{ fontSize:'13px', color:C.muted }}>관심 지역과 과목을 등록하면 새 공고 시 알림을 보내드립니다.</div>
            <button onClick={openAdd} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 구독 추가</button>
          </div>

          {!regionMap?.neisApiKey && (
            <div style={{ padding:'12px 16px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'10px', marginBottom:'14px', fontSize:'13px', color:'#92400e' }}>
              ⚠️ <strong>관리자 설정 필요:</strong> 관리자 페이지 → 서비스 설정 → NEIS API 키를 등록해야 공고 조회가 가능합니다.
            </div>
          )}

          {subs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>🔔</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>구독 설정이 없습니다</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {subs.map(s => (
                <div key={s.id} style={{ borderRadius:'12px', border:`1.5px solid ${s.active?'#fed7aa':C.border}`, padding:'14px 18px', background: s.active?'#fffbf5':C.card }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexWrap:'wrap' }}>
                        {s.sido && <span style={{ fontSize:'12px', background:'#f3f4f6', color:C.muted, padding:'1px 7px', borderRadius:'5px' }}>{s.sido}</span>}
                        {s.office && <span style={{ fontSize:'12px', background:'#f3f4f6', color:C.muted, padding:'1px 7px', borderRadius:'5px' }}>{s.office}</span>}
                        {s.school && <span style={{ fontSize:'12px', background:'#f3f4f6', color:C.muted, padding:'1px 7px', borderRadius:'5px' }}>🏫 {s.school}</span>}
                        <span style={{ fontSize:'13px', fontWeight:700, color:C.primary }}>📚 {s.subject}</span>
                      </div>
                      <div style={{ display:'flex', gap:'10px', fontSize:'11px', color:C.muted }}>
                        {s.notifyEmail  && <span>📧 이메일</span>}
                        {s.notifySms    && <span>💬 SMS</span>}
                        {s.notifyKakao  && <span>💛 카톡</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <button onClick={() => { const u={...s,active:!s.active}; saveSub(u); reloadSubs() }}
                        style={{ padding:'5px 12px', borderRadius:'7px', border:`1.5px solid ${s.active?'#86efac':'#e5e7eb'}`, background: s.active?'#f0fdf4':'#f9fafb', color: s.active?C.success:C.muted, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        {s.active ? '활성' : '비활성'}
                      </button>
                      <button onClick={()=>openEdit(s)} style={{ padding:'5px 10px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                      <Btn size='sm' variant='outlineDanger' onClick={() => confirm('삭제할까요?', () => { deleteSub(s.id); reloadSubs() }, { icon: '🗑', confirmLabel: '삭제' })}>삭제</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 구독 추가/편집 모달 */}
      {modal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>{editId ? '구독 편집' : '구독 추가'}</span>
              <button onClick={()=>setModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'13px' }}>
              {/* 시도 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>시도</label>
                <select value={form.sido} onChange={e=>setForm(v=>({...v,sido:e.target.value,office:''}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
                  <option value="">전체</option>
                  {sidos.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* 교육지원청 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청</label>
                <select value={form.office} onChange={e=>setForm(v=>({...v,office:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
                  <option value="">전체</option>
                  {offices.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* 학교명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>학교명 (선택)</label>
                <input value={form.school} onChange={e=>setForm(v=>({...v,school:e.target.value}))}
                  placeholder="특정 학교만 검색 시 입력"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 과목 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>과목 *</label>
                <input value={form.subject} onChange={e=>setForm(v=>({...v,subject:e.target.value}))}
                  placeholder="예: 로봇과학, 코딩, 미술"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 알림 방법 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'8px' }}>알림 방법</label>
                <div style={{ display:'flex', gap:'16px' }}>
                  {[['notifyEmail','📧 이메일'],['notifySms','💬 SMS'],['notifyKakao','💛 카톡']].map(([k,label]) => (
                    <label key={k} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      <input type="checkbox" checked={form[k]} onChange={e=>setForm(v=>({...v,[k]:e.target.checked}))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <Btn onClick={save} full>저장</Btn>
                <button onClick={()=>setModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
