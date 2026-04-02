import React, { useState, useEffect, useRef } from 'react'
import { uid, now } from '../lib/utils.js'
import { Classes, Students } from '../lib/db.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  blue: '#3b82f6', purple: '#8b5cf6',
}

const KEY_SUBJECTS = 'asa_supplies_subjects'
const KEY_VENDORS  = 'asa_supplies_vendors'
const KEY_SUPPLIES = 'asa_supplies_items'
const KEY_PLANS    = 'asa_supplies_plans'

const DEFAULT_SUBJECTS = ['일반', '로봇', '항공', '보드게임']

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def } catch { return def }
}
function persist(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

async function uploadToStorage(userId, folder, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const filePath = `supplies/${userId}/${folder}/${Date.now()}_${file.name}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/teacher-files/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.message || res.statusText) }
  return `${SUPABASE_URL}/storage/v1/object/public/teacher-files/${filePath}`
}

const iStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  border: '1.5px solid #e5e7eb', fontSize: '13px',
  fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box',
}

export function Supplies({ user }) {
  const [subjects, setSubjects]       = useState(() => load(KEY_SUBJECTS, DEFAULT_SUBJECTS))
  const [selSubject, setSelSubject]   = useState(null)
  const [vendors, setVendors]         = useState(() => load(KEY_VENDORS, {}))
  const [supplyItems, setSupplyItems] = useState(() => load(KEY_SUPPLIES, {}))
  const [plans, setPlans]             = useState(() => load(KEY_PLANS, {}))
  const [classes, setClasses]         = useState([])
  const [students, setStudents]       = useState([])
  const [innerTab, setInnerTab]       = useState('supply')
  const [selClassId, setSelClassId]   = useState('')
  const [checkedStudents, setCheckedStudents] = useState([])
  const [supplyModal, setSupplyModal] = useState(false)
  const [supplyForm, setSupplyForm]   = useState({ name: '', stage: '' })
  const [vendorModal, setVendorModal] = useState(false)
  const [vendorForm, setVendorForm]   = useState({ name: '', contact: '', memo: '' })
  const [planModal, setPlanModal]     = useState(false)
  const [planForm, setPlanForm]       = useState({ type: 'annual', title: '', vendorId: '' })
  const [planFile, setPlanFile]       = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [subjectModal, setSubjectModal] = useState(false)
  const [newSubject, setNewSubject]   = useState('')
  const planFileRef = useRef()

  useEffect(() => {
    setClasses(Classes.byTeacher(user.id))
    setStudents(Students.byTeacher(user.id))
  }, [])

  useEffect(() => {
    if (subjects.length > 0 && !selSubject) setSelSubject(subjects[0])
  }, [subjects])

  useEffect(() => { setCheckedStudents([]) }, [selClassId, selSubject])

  const confirmedStudents = students.filter(s =>
    s.classIds?.includes(selClassId) && s.status === 'confirmed'
  )
  const allChecked = confirmedStudents.length > 0 && checkedStudents.length === confirmedStudents.length
  const toggleAll  = () => setCheckedStudents(allChecked ? [] : confirmedStudents.map(s => s.id))
  const toggleOne  = (id) => setCheckedStudents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const getStudentSupply = (sid) => supplyItems[`${selClassId}_${sid}`] || { name: '', stage: '' }

  const saveSupply = () => {
    if (!supplyForm.name) { alert('교구명을 입력하세요'); return }
    const next = { ...supplyItems }
    checkedStudents.forEach(sid => { next[`${selClassId}_${sid}`] = { name: supplyForm.name, stage: supplyForm.stage } })
    setSupplyItems(next); persist(KEY_SUPPLIES, next)
    setSupplyModal(false); setSupplyForm({ name: '', stage: '' })
  }

  const subjectVendors = vendors[selSubject] || []
  const saveVendor = () => {
    if (!vendorForm.name) { alert('업체명을 입력하세요'); return }
    const next = { ...vendors, [selSubject]: [...subjectVendors, { id: uid(), ...vendorForm }] }
    setVendors(next); persist(KEY_VENDORS, next)
    setVendorModal(false); setVendorForm({ name: '', contact: '', memo: '' })
  }
  const deleteVendor = (id) => {
    const next = { ...vendors, [selSubject]: subjectVendors.filter(v => v.id !== id) }
    setVendors(next); persist(KEY_VENDORS, next)
  }

  const subjectPlans = plans[selSubject] || []
  const savePlan = async () => {
    if (!planForm.title) { alert('제목을 입력하세요'); return }
    setUploading(true)
    try {
      let fileUrl = null, fileName = null
      if (planFile) {
        fileUrl  = await uploadToStorage(user.id, `plans/${selSubject}`, planFile)
        fileName = planFile.name
      }
      const item = { id: uid(), ...planForm, fileUrl, fileName, createdAt: now() }
      const next = { ...plans, [selSubject]: [...subjectPlans, item] }
      setPlans(next); persist(KEY_PLANS, next)
      setPlanModal(false); setPlanFile(null); setPlanForm({ type: 'annual', title: '', vendorId: '' })
    } catch(e) { alert('업로드 실패: ' + e.message) }
    finally { setUploading(false) }
  }
  const deletePlan = (id) => {
    const next = { ...plans, [selSubject]: subjectPlans.filter(p => p.id !== id) }
    setPlans(next); persist(KEY_PLANS, next)
  }

  const addSubject = () => {
    const s = newSubject.trim()
    if (!s) return
    if (subjects.includes(s)) { alert('이미 있는 과목이에요'); return }
    const next = [...subjects, s]
    setSubjects(next); persist(KEY_SUBJECTS, next)
    setNewSubject(''); setSubjectModal(false); setSelSubject(s)
  }
  const deleteSubject = (s) => {
    if (!window.confirm(`"${s}" 과목을 삭제할까요?`)) return
    const next = subjects.filter(x => x !== s)
    setSubjects(next); persist(KEY_SUBJECTS, next)
    if (selSubject === s) setSelSubject(next[0] || null)
  }

  const isRobot = selSubject === '로봇'

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, margin: 0 }}>🎒 교구 및 지도안 관리</h1>
          <p style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>과목별 교구 설정 · 업체 관리 · 지도안 등록</p>
        </div>
      </div>

      {/* 과목 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {subjects.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={() => { setSelSubject(s); setSelClassId(''); setInnerTab('supply') }}
              style={{ padding: '8px 16px', borderRadius: selSubject === s ? '8px 0 0 8px' : '8px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600, fontSize: '14px', background: selSubject === s ? C.primary : '#f3f4f6', color: selSubject === s ? '#fff' : C.muted, transition: 'all .15s' }}>
              {s}
            </button>
            {selSubject === s && (
              <button onClick={() => deleteSubject(s)}
                style={{ padding: '8px 7px', borderRadius: '0 8px 8px 0', border: 'none', cursor: 'pointer', background: '#dc262620', color: C.danger, fontSize: '13px', lineHeight: 1 }}>✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setSubjectModal(true)}
          style={{ padding: '8px 14px', borderRadius: '8px', border: `1.5px dashed ${C.border}`, background: '#fff', color: C.muted, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 과목 추가
        </button>
      </div>

      {selSubject && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* 좌측 메인 */}
          <div style={{ flex: 1, minWidth: '320px' }}>

            {/* 내부 탭 */}
            <div style={{ display: 'flex', marginBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
              {[{ key: 'supply', label: '🎒 교구 관리' }, { key: 'plan', label: '📋 지도안' }].map(t => (
                <button key={t.key} onClick={() => setInnerTab(t.key)}
                  style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'none', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '14px', fontWeight: innerTab === t.key ? 700 : 400, color: innerTab === t.key ? C.primary : C.muted, borderBottom: innerTab === t.key ? `2px solid ${C.primary}` : '2px solid transparent', marginBottom: '-1px' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── 교구 관리 */}
            {innerTab === 'supply' && (
              <div>
                {/* 수업 선택 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '6px' }}>수업 선택</label>
                  <select value={selClassId} onChange={e => setSelClassId(e.target.value)}
                    style={{ ...iStyle, width: 'auto', minWidth: '300px' }}>
                    <option value=''>-- 수업을 선택하세요 --</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.organization} · {cls.className}{cls.section ? ' ' + cls.section : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selClassId ? (
                  <>
                    {/* 전체선택 + 교구설정 버튼 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '10px 14px', background: '#f9fafb', borderRadius: '10px', border: `1px solid ${C.border}` }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: C.text }}>
                        <input type="checkbox" checked={allChecked} onChange={toggleAll}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                        전체 선택 ({checkedStudents.length}/{confirmedStudents.length}명)
                      </label>
                      <div style={{ flex: 1 }} />
                      {checkedStudents.length > 0 && (
                        <button onClick={() => setSupplyModal(true)}
                          style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          🎒 교구 설정 ({checkedStudents.length}명)
                        </button>
                      )}
                    </div>

                    {confirmedStudents.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontSize: '14px' }}>확정된 학생이 없습니다</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {confirmedStudents.map(s => {
                          const supply    = getStudentSupply(s.id)
                          const isChecked = checkedStudents.includes(s.id)
                          return (
                            <div key={s.id} onClick={() => toggleOne(s.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: `1.5px solid ${isChecked ? C.primary : C.border}`, background: isChecked ? '#fff7ed' : C.card, cursor: 'pointer', transition: 'all .15s' }}>
                              <input type="checkbox" checked={isChecked} onChange={() => toggleOne(s.id)}
                                onClick={e => e.stopPropagation()} style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
                                  {s.name}
                                  <span style={{ fontSize: '12px', color: C.muted, fontWeight: 400, marginLeft: '8px' }}>{s.grade} {s.classNum}반</span>
                                </div>
                                {supply.name ? (
                                  <div style={{ fontSize: '12px', color: C.success, marginTop: '2px' }}>
                                    🎒 {supply.name}{supply.stage ? ` · ${supply.stage}단계` : ''}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>교구 미설정</div>
                                )}
                              </div>
                              {supply.name && (
                                <span style={{ fontSize: '11px', background: '#f0fdf4', color: C.success, border: '1px solid #86efac', borderRadius: '5px', padding: '1px 7px', flexShrink: 0 }}>설정완료</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎒</div>
                    <div style={{ fontSize: '14px' }}>수업을 선택하면 학생 목록이 표시됩니다</div>
                  </div>
                )}
              </div>
            )}

            {/* ── 지도안 */}
            {innerTab === 'plan' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                  <button onClick={() => setPlanModal(true)}
                    style={{ padding: '8px 18px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    + 지도안 등록
                  </button>
                </div>

                {subjectPlans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📋</div>
                    <div style={{ fontSize: '14px' }}>등록된 지도안이 없습니다</div>
                  </div>
                ) : (
                  ['annual', 'session'].map(type => {
                    const typePlans = subjectPlans.filter(p => p.type === type)
                    if (!typePlans.length) return null
                    return (
                      <div key={type} style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: C.muted, marginBottom: '8px', letterSpacing: '0.05em' }}>
                          {type === 'annual' ? '📅 연간 지도안' : '📝 차시별 지도안'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {typePlans.map(p => {
                            const vendor = subjectVendors.find(v => v.id === p.vendorId)
                            return (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                                <span style={{ fontSize: '24px', flexShrink: 0 }}>📄</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{p.title}</div>
                                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                                    {vendor && <span>🏢 {vendor.name} · </span>}
                                    {p.fileName || '파일 없음'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                  {p.fileUrl && (
                                    <a href={p.fileUrl} download={p.fileName} target="_blank" rel="noopener noreferrer"
                                      style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid #86efac', background: '#f0fdf4', color: C.success, fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                                      ⬇ 다운로드
                                    </a>
                                  )}
                                  <button onClick={() => deletePlan(p.id)}
                                    style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fef2f2', color: C.danger, fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* 우측: 업체 관리 */}
          <div style={{ width: '260px', flexShrink: 0 }}>
            <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>🏢 업체 관리</span>
                <button onClick={() => setVendorModal(true)}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: C.primary, color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>+ 추가</button>
              </div>
              {subjectVendors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: '13px' }}>등록된 업체가 없습니다</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {subjectVendors.map(v => (
                    <div key={v.id} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: '9px', border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{v.name}</div>
                        <button onClick={() => deleteVendor(v.id)}
                          style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                      {v.contact && <div style={{ fontSize: '11px', color: C.muted, marginTop: '3px' }}>📞 {v.contact}</div>}
                      {v.memo    && <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>📌 {v.memo}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 교구 설정 모달 */}
      {supplyModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setSupplyModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>🎒 교구 설정 ({checkedStudents.length}명)</span>
              <button onClick={() => setSupplyModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>교구명 *</label>
                <input value={supplyForm.name} onChange={e => setSupplyForm(v => ({ ...v, name: e.target.value }))}
                  placeholder="예: 로봇 키트 A형" style={iStyle} autoFocus />
              </div>
              {isRobot && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>단계</label>
                  <input value={supplyForm.stage} onChange={e => setSupplyForm(v => ({ ...v, stage: e.target.value }))}
                    placeholder="예: 1단계, 2단계" style={iStyle} />
                </div>
              )}
              <div style={{ fontSize: '12px', color: C.muted, background: '#f9fafb', padding: '10px 12px', borderRadius: '8px' }}>
                선택된 <strong>{checkedStudents.length}명</strong>에게 동일하게 적용됩니다.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveSupply}
                  style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setSupplyModal(false)}
                  style={{ padding: '11px 18px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 업체 추가 모달 */}
      {vendorModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setVendorModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>🏢 업체 추가</span>
              <button onClick={() => setVendorModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: '업체명 *', key: 'name', placeholder: '예: (주)로봇나라' },
                { label: '연락처',   key: 'contact', placeholder: '예: 02-1234-5678' },
                { label: '메모',     key: 'memo',    placeholder: '비고' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>{f.label}</label>
                  <input value={vendorForm[f.key]} onChange={e => setVendorForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={iStyle} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveVendor}
                  style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setVendorModal(false)}
                  style={{ padding: '11px 18px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 지도안 등록 모달 */}
      {planModal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setPlanModal(false); setPlanFile(null) } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>📋 지도안 등록</span>
              <button onClick={() => { setPlanModal(false); setPlanFile(null) }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '6px' }}>종류</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ v: 'annual', l: '📅 연간 지도안' }, { v: 'session', l: '📝 차시별 지도안' }].map(o => (
                    <button key={o.v} onClick={() => setPlanForm(f => ({ ...f, type: o.v }))}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${planForm.type === o.v ? C.primary : C.border}`, background: planForm.type === o.v ? '#fff7ed' : '#fff', color: planForm.type === o.v ? C.primary : C.muted, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>제목 *</label>
                <input value={planForm.title} onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 2026년 로봇과학 연간지도안" style={iStyle} autoFocus />
              </div>
              {subjectVendors.length > 0 && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>업체 연결 (선택)</label>
                  <select value={planForm.vendorId} onChange={e => setPlanForm(f => ({ ...f, vendorId: e.target.value }))}
                    style={{ ...iStyle, background: '#fff' }}>
                    <option value=''>선택 안함</option>
                    {subjectVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '5px' }}>파일 (hwp, pdf, xlsx)</label>
                {planFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                    <span style={{ fontSize: '20px' }}>📄</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{planFile.name}</span>
                    <button onClick={() => setPlanFile(null)} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: '18px', flexShrink: 0 }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => planFileRef.current?.click()}
                    style={{ width: '100%', padding: '20px', borderRadius: '9px', border: `2px dashed ${C.border}`, background: '#f9fafb', cursor: 'pointer', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📎</div>
                    <div style={{ fontSize: '13px' }}>클릭하여 파일 선택</div>
                    <div style={{ fontSize: '11px', marginTop: '2px' }}>.hwp · .hwpx · .pdf · .xlsx</div>
                  </button>
                )}
                <input ref={planFileRef} type="file" accept=".hwp,.hwpx,.pdf,.xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && setPlanFile(e.target.files[0])} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={savePlan} disabled={uploading}
                  style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', background: uploading ? '#e5e7eb' : C.primary, color: uploading ? C.muted : '#fff', fontSize: '14px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {uploading ? '업로드 중...' : '저장'}
                </button>
                <button onClick={() => { setPlanModal(false); setPlanFile(null) }}
                  style={{ padding: '11px 18px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 과목 추가 모달 */}
      {subjectModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setSubjectModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>+ 과목 추가</span>
              <button onClick={() => setSubjectModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubject()}
                placeholder="예: 드론, 코딩, 미술 ..." style={iStyle} autoFocus />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addSubject}
                  style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>추가</button>
                <button onClick={() => setSubjectModal(false)}
                  style={{ padding: '11px 18px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
