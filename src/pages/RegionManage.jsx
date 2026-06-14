import React, { useState, useEffect } from 'react'
import { Settings, SecretSettings, Students as StudentsDB, Classes as ClassesDB } from '../lib/db.js'
import { Card, PageHeader, Btn, Modal, useConfirm } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a' }

function Field({ label, value, onChange, placeholder, type='text', mono=false }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily: mono ? 'monospace' : 'Noto Sans KR, sans-serif', outline:'none', color:C.text }}
        onFocus={e => e.target.style.borderColor=C.primary}
        onBlur={e => e.target.style.borderColor=C.border} />
    </div>
  )
}

export function RegionManage({ user }) {
  const [regions,    setRegions]    = useState(() => (Settings.get('regionMap') || {}).regions    || [])
  const [neisApiKey, setNeisApiKey] = useState('')
  const { success, toastError } = useToast()
  const confirm = useConfirm()

  // [보안] NEIS API 키는 regionMap_secret 키에 별도 저장 (관리자만 조회 가능, localStorage 미저장)
  React.useEffect(() => {
    SecretSettings.get('regionMap_secret').then(secret => {
      if (secret?.neisApiKey) setNeisApiKey(secret.neisApiKey)
    })
  }, [])

  // NEIS 학교 검색
  const [neisQuery,   setNeisQuery]   = useState('')
  const [neisResults, setNeisResults] = useState([])
  const [neisLoading, setNeisLoading] = useState(false)
  const [neisMsg,     setNeisMsg]     = useState(null)

  const searchNeis = async () => {
    if (!neisApiKey.trim()) { setNeisMsg({ ok:false, msg:'NEIS API 키를 먼저 입력하고 저장하세요.' }); return }
    if (!neisQuery.trim())  { setNeisMsg({ ok:false, msg:'학교명을 입력하세요.' }); return }
    setNeisLoading(true); setNeisMsg(null); setNeisResults([])
    try {
      const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${neisApiKey.trim()}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(neisQuery.trim())}`
      const res  = await fetch(url)
      const data = await res.json()
      const rows = data?.schoolInfo?.[1]?.row || []
      if (rows.length === 0) { setNeisMsg({ ok:false, msg:'검색 결과가 없습니다.' }); return }
      setNeisResults(rows.map(r => ({
        name:       r.SCHUL_NM,
        sido:       r.ATPT_OFCDC_SC_NM?.replace('교육청','').replace('특별시','').replace('광역시','').replace('특별자치시','').replace('특별자치도','').replace('도','').trim() || '',
        sidoFull:   r.ATPT_OFCDC_SC_NM || '',
        support:    r.JU_ORG_NM || '',
        address:    r.ORG_RDNMA || '',
        url:        r.HMPG_ADRES || '',
        phone:      r.ORG_TELNO || '',
      })))
    } catch(e) {
      setNeisMsg({ ok:false, msg:'검색 중 오류가 발생했습니다. API 키를 확인해주세요.' })
    } finally {
      setNeisLoading(false)
    }
  }

  const addFromNeis = (school) => {
    const existing = regions.find(r => r.support === school.support && r.sido === school.sido)
    let updated
    if (existing) {
      if (!existing.schools.find(s => (s.name||s) === school.name)) {
        updated = regions.map(r =>
          r.id === existing.id
            ? { ...r, schools: [...r.schools, { name: school.name, url: school.url }] }
            : r
        )
        setRegions(updated)
        Settings.set('regionMap', { regions: updated })
        setNeisMsg({ ok:true, msg:`✅ ${school.name}을(를) "${school.support}"에 추가하고 저장했습니다.` })
      } else {
        setNeisMsg({ ok:false, msg:`${school.name}은(는) 이미 등록되어 있습니다.` })
      }
    } else {
      const newEntry = {
        id: String(Date.now()), sido: school.sido, office: school.sidoFull,
        officeUrl: '', support: school.support, supportUrl: '',
        schools: [{ name: school.name, url: school.url }]
      }
      updated = [...regions, newEntry]
      setRegions(updated)
      Settings.set('regionMap', { regions: updated })
      setNeisMsg({ ok:true, msg:`✅ ${school.name}과(와) "${school.support}"을(를) 추가하고 저장했습니다.` })
    }
    // 저장 확인 로그
  }

  // 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form, setForm] = useState({ sido:'', office:'', officeUrl:'', support:'', supportUrl:'', schoolInput:'', schoolUrlInput:'' })
  const [schools, setSchools] = useState([])  // [{ name, url }, ...]

  // 미매핑 학교 계산
  const { Students, Classes } = (() => {
    try {
      const s = StudentsDB.all()
      const c = ClassesDB.all()
      return { Students: s, Classes: c }
    } catch { return { Students: [], Classes: [] } }
  })()

  const allSchools = [...new Set([
    ...Students.map(s => s.school).filter(Boolean),
    ...Classes.map(c => c.organization).filter(Boolean),
  ])]
  const mappedSchools = new Set(regions.flatMap(r => r.schools.map(s => s.name || s)))
  const unmappedSchools = allSchools.filter(s => !mappedSchools.has(s))

  const inSt  = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }
  const selSt = { ...inSt, background:'#fff' }

  const SIDO_LIST = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']

  const saveAll = async () => {
    Settings.set('regionMap', { regions })
    await SecretSettings.set('regionMap_secret', { neisApiKey })
    success('수정이 완료되었습니다.')
  }

  const openNew = () => {
    setForm({ sido:'', office:'', officeUrl:'', support:'', supportUrl:'', schoolInput:'', schoolUrlInput:'' })
    setSchools([]); setEditId(null); setShowForm(true)
  }

  const openEdit = (r) => {
    setForm({ sido:r.sido, office:r.office||'', officeUrl:r.officeUrl||'', support:r.support||'', supportUrl:r.supportUrl||'', schoolInput:'', schoolUrlInput:'' })
    setSchools(r.schools.map(s => typeof s === 'string' ? { name:s, url:'' } : s))
    setEditId(r.id); setShowForm(true)
  }

  const addSchool = () => {
    const name = form.schoolInput.trim()
    if (!name) return
    if (!schools.find(s => s.name === name)) setSchools(p => [...p, { name, url: form.schoolUrlInput.trim() }])
    setForm(p => ({ ...p, schoolInput:'', schoolUrlInput:'' }))
  }

  const addUnmapped = (school) => {
    if (!schools.find(s => s.name === school)) setSchools(p => [...p, { name: school, url: '' }])
  }

  const removeSchool = (name) => setSchools(p => p.filter(s => s.name !== name))

  const saveForm = () => {
    if (!form.sido) { toastError('시도를 선택하세요.'); return }
    if (!form.support.trim()) { toastError('교육지원청명을 입력하세요.'); return }
    const entry = { id: editId || String(Date.now()), sido: form.sido, office: form.office.trim(), officeUrl: form.officeUrl.trim(), support: form.support.trim(), supportUrl: form.supportUrl.trim(), schools }
    if (editId) {
      setRegions(p => p.map(r => r.id === editId ? entry : r))
    } else {
      setRegions(p => [...p, entry])
    }
    setShowForm(false); setEditId(null)
  }

  const deleteRegion = (id) => {
    confirm('삭제하시겠습니까?', () => {
      setRegions(p => p.filter(r => r.id !== id))
    })
  }

  return (
    <div style={{ padding:'28px', maxWidth:'1100px' }}>
      <PageHeader title="지역/학교 관리" sub="시도 → 교육청 → 교육지원청 → 학교 계층을 등록합니다." />
      <Card style={{ marginTop:'20px' }}>

      {/* NEIS API 키 입력 */}
      <div style={{ padding:'16px', background:'#f0f9ff', borderRadius:'12px', border:'1.5px solid #bae6fd', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
          <span style={{ fontSize:'20px' }}>🏫</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>NEIS 교육정보 Open API</div>
            <div style={{ fontSize:'12px', color:C.muted }}>학교명 검색 시 교육지원청·홈페이지 자동 입력</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>
              API 인증키 <a href="https://open.neis.go.kr/portal/guide/apiUsageGuide.do" target="_blank" rel="noopener noreferrer" style={{ color:'#0369a1', fontSize:'11px', marginLeft:'6px' }}>📋 발급받기</a>
            </label>
            <input value={neisApiKey} onChange={e => setNeisApiKey(e.target.value)}
              placeholder="NEIS Open API 인증키 입력"
              style={{ padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'monospace', outline:'none', width:'100%', boxSizing:'border-box' }} />
          </div>
          <button onClick={saveAll}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', height:'38px' }}>
            💾 저장
          </button>
        </div>

        {/* NEIS 학교 검색 */}
        <div style={{ marginTop:'14px', borderTop:`1px solid #bae6fd`, paddingTop:'14px' }}>
          <div style={{ fontSize:'13px', fontWeight:600, color:C.text, marginBottom:'8px' }}>🔍 학교 검색 (NEIS API)</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <input value={neisQuery} onChange={e => setNeisQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchNeis()}
              placeholder="학교명 입력 후 검색 (예: 군포초등학교)"
              style={{ flex:1, padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
            <button onClick={searchNeis} disabled={neisLoading}
              style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid #0369a1`, background:neisLoading?'#f0f9ff':'#0369a1', color:neisLoading?'#0369a1':'#fff', fontSize:'13px', fontWeight:700, cursor:neisLoading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', opacity:neisLoading?0.7:1 }}>
              {neisLoading ? '검색 중...' : '검색'}
            </button>
          </div>

          {neisMsg && (
            <div style={{ marginTop:'8px', fontSize:'12px', padding:'8px 12px', borderRadius:'7px', background:neisMsg.ok?'#f0fdf4':'#fef2f2', color:neisMsg.ok?'#16a34a':'#ef4444', border:`1px solid ${neisMsg.ok?'#86efac':'#fca5a5'}` }}>
              {neisMsg.ok ? '✅' : '⚠️'} {neisMsg.msg}
            </div>
          )}

          {neisResults.length > 0 && (
            <div style={{ marginTop:'10px', display:'flex', flexDirection:'column', gap:'6px', maxHeight:'280px', overflowY:'auto' }}>
              {neisResults.map((school, i) => (
                <div key={i} style={{ padding:'10px 12px', background:'#fff', borderRadius:'9px', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{school.name}</div>
                    <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                      {school.sido} · {school.support}
                      {school.address && ` · ${school.address}`}
                    </div>
                    {school.url && <a href={school.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#3b82f6' }}>🔗 홈페이지</a>}
                  </div>
                  <button onClick={() => addFromNeis(school)}
                    style={{ padding:'5px 12px', borderRadius:'7px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 미매핑 학교 알림 */}
      {unmappedSchools.length > 0 && (
        <div style={{ padding:'14px 16px', background:'#fffbeb', borderRadius:'12px', border:'1.5px solid #fde68a', marginBottom:'20px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:'#92400e', marginBottom:'10px' }}>
            ⚠️ 지역/교육청 미등록 학교 {unmappedSchools.length}곳
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {unmappedSchools.map(s => (
              <span key={s} style={{ fontSize:'12px', padding:'3px 10px', background:'#fff', border:'1px solid #fde68a', borderRadius:'6px', color:'#92400e', display:'flex', alignItems:'center', gap:'6px' }}>
                {s}
                {showForm && (
                  <button onClick={() => addUnmapped(s)}
                    style={{ background:'#f97316', color:'#fff', border:'none', borderRadius:'4px', padding:'1px 6px', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    + 추가
                  </button>
                )}
              </span>
            ))}
          </div>
          {!showForm && (
            <div style={{ fontSize:'12px', color:'#b45309', marginTop:'8px' }}>
              📌 교육지원청 등록/수정 시 미등록 학교를 바로 추가할 수 있습니다.
            </div>
          )}
        </div>
      )}

      {/* 추가 버튼 */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
        <button onClick={openNew}
          style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 교육지원청 추가
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <div style={{ padding:'18px', background:'#fff7ed', borderRadius:'12px', border:`1.5px solid ${C.primary}`, marginBottom:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{editId ? '교육지원청 수정' : '교육지원청 추가'}</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>시도 *</label>
              <select value={form.sido} onChange={e => setForm(p=>({...p,sido:e.target.value}))} style={selSt}>
                <option value="">선택</option>
                {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육청 (시도교육청)</label>
              <input value={form.office} onChange={e => setForm(p=>({...p,office:e.target.value}))} placeholder="예: 경기도교육청" style={inSt} />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청 *</label>
              <input value={form.support} onChange={e => setForm(p=>({...p,support:e.target.value}))} placeholder="예: 군포의왕교육지원청" style={inSt} />
            </div>
          </div>

          {/* 교육청/교육지원청 URL */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육청 홈페이지 URL</label>
              <input value={form.officeUrl} onChange={e => setForm(p=>({...p,officeUrl:e.target.value}))} placeholder="https://www.goe.go.kr" style={inSt} />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청 홈페이지 URL</label>
              <input value={form.supportUrl} onChange={e => setForm(p=>({...p,supportUrl:e.target.value}))} placeholder="https://gunpo.goe.go.kr" style={inSt} />
            </div>
          </div>

          {/* 학교 추가 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>소속 학교</label>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr auto', gap:'8px', marginBottom:'8px', alignItems:'flex-end' }}>
              <div>
                <div style={{ fontSize:'11px', color:C.muted, marginBottom:'3px' }}>학교명</div>
                <input value={form.schoolInput} onChange={e => setForm(p=>({...p,schoolInput:e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && addSchool()}
                  placeholder="예: 군포초등학교" style={inSt} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:C.muted, marginBottom:'3px' }}>홈페이지 URL (선택)</div>
                <input value={form.schoolUrlInput} onChange={e => setForm(p=>({...p,schoolUrlInput:e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && addSchool()}
                  placeholder="https://gunpo.es.kr" style={inSt} />
              </div>
              <button onClick={addSchool}
                style={{ padding:'8px 14px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff', color:C.primary, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', height:'38px' }}>
                추가
              </button>
            </div>
            {unmappedSchools.length > 0 && (
              <div style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'11px', color:'#b45309', marginBottom:'4px' }}>⚠️ 미등록 학교 클릭하여 빠르게 추가:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {unmappedSchools.filter(s => !schools.find(x => x.name === s)).map(s => (
                    <button key={s} onClick={() => addUnmapped(s)}
                      style={{ padding:'2px 8px', borderRadius:'5px', border:'1px solid #fde68a', background:'#fffbeb', color:'#92400e', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {schools.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {schools.map(s => (
                  <div key={s.name} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 10px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'7px' }}>
                    <span style={{ fontSize:'12px', fontWeight:600, color:'#15803d', flex:1 }}>🏫 {s.name}</span>
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#3b82f6', textDecoration:'none' }}>🔗 홈페이지</a>
                      : <span style={{ fontSize:'11px', color:'#d1d5db' }}>URL 미등록</span>
                    }
                    <button onClick={() => removeSchool(s.name)}
                      style={{ background:'#fef2f2', border:'1px solid #fca5a5', color:'#ef4444', cursor:'pointer', padding:'2px 8px', fontSize:'12px', borderRadius:'5px', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            <button onClick={saveForm}
              style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
          </div>
        </div>
      )}

      {/* 등록된 목록 */}
      {regions.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px', color:C.muted, background:'#f9fafb', borderRadius:'12px', fontSize:'14px' }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>🗺️</div>
          등록된 지역이 없습니다.<br/>
          <span style={{ fontSize:'13px' }}>교육지원청 추가 버튼으로 시작하세요.</span>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'20px' }}>
          {/* 시도별 그룹 */}
          {SIDO_LIST.filter(sido => regions.some(r => r.sido === sido)).map(sido => (
            <div key={sido}>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', padding:'6px 10px', background:'#f3f4f6', borderRadius:'8px', marginBottom:'6px' }}>
                📍 {sido}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', paddingLeft:'10px' }}>
                {regions.filter(r => r.sido === sido).map(r => (
                  <div key={r.id} style={{ padding:'12px 16px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:'12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                        {r.office && <span style={{ fontSize:'12px', color:C.muted }}>
                          {r.officeUrl
                            ? <a href={r.officeUrl} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, textDecoration:'none' }}>{r.office} 🔗</a>
                            : r.office} &rsaquo;
                        </span>}
                        <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>
                          {r.supportUrl
                            ? <a href={r.supportUrl} target="_blank" rel="noopener noreferrer" style={{ color:C.text, textDecoration:'none' }}>{r.support} 🔗</a>
                            : r.support}
                        </span>
                        <span style={{ fontSize:'11px', background:'#eff6ff', color:'#3b82f6', padding:'1px 7px', borderRadius:'5px', fontWeight:600 }}>
                          학교 {r.schools.length}곳
                        </span>
                      </div>
                      {r.schools.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'6px' }}>
                          {r.schools.map(s => (
                            <span key={s.name || s} style={{ fontSize:'11px', padding:'2px 8px', background:'#f9fafb', border:`1px solid ${C.border}`, borderRadius:'5px', color:C.muted, display:'flex', alignItems:'center', gap:'4px' }}>
                              {s.name || s}
                              {(s.url) && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color:'#3b82f6', textDecoration:'none', fontSize:'11px' }}>🔗</a>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      <button onClick={() => openEdit(r)}
                        style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>수정</button>
                      <button onClick={() => deleteRegion(r.id)}
                        style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      </Card>
    </div>
  )
}
