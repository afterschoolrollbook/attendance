import React, { useState, useEffect, useRef } from 'react'
import { uid, now, sortClasses } from '../lib/utils.js'
import { Classes, Students, SupplySubjects, SupplyVendors, SupplyItems, SupplyPlans } from '../lib/db.js'

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  blue: '#3b82f6', purple: '#8b5cf6',
}

const DEFAULT_SUBJECTS = ['일반', '로봇', '항공', '보드게임']

// plan fileType: 'annual'=연간지도안, 'session'=차시별지도안, 'promo'=홍보물

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

// ── 파일 행 컴포넌트
function FileRow({ item, onDelete }) {
  const icon = item.fileType === 'promo' ? '🖼' : '📄'
  const typeLabel = { annual:'연간지도안', session:'차시별지도안', promo:'홍보물' }[item.fileType] || ''
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:C.card, borderRadius:'9px', border:`1px solid ${C.border}` }}>
      <span style={{ fontSize:'20px', flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
        <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px', display:'flex', gap:'8px' }}>
          <span style={{ background:'#f3f4f6', borderRadius:'4px', padding:'0 5px' }}>{typeLabel}</span>
          {item.school && <span>🏫 {item.school}</span>}
          {item.fileName && <span>{item.fileName}</span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
        {item.fileUrl && (
          <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer"
            style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'11px', fontWeight:600, textDecoration:'none' }}>
            ⬇ 다운
          </a>
        )}
        <button onClick={() => onDelete(item.id)}
          style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
      </div>
    </div>
  )
}

export function Supplies({ user }) {
  const [subjects, setSubjects]           = useState([])
  const [selSubject, setSelSubject]       = useState(null)
  const [vendorList, setVendorList]       = useState([])
  const [itemList, setItemList]           = useState([])
  const [planList, setPlanList]           = useState([])
  const [classes, setClasses]             = useState([])
  const [students, setStudents]           = useState([])

  // 내부 탭: 'supply' | 'plan' | 'promo' | 'vendor'
  const [innerTab, setInnerTab]           = useState('supply')
  const [selClassId, setSelClassId]       = useState('')
  const [checkedStudents, setCheckedStudents] = useState([])

  // 교구 설정 모달
  const [supplyModal, setSupplyModal]     = useState(false)
  const [supplyForm, setSupplyForm]       = useState({ name: '', stage: '' })

  // 파일 등록 모달 (지도안 + 홍보물 공용)
  const [fileModal, setFileModal]         = useState(false)
  // fileModalMode: 'plan' = 선생님 지도안/홍보물, 'vendor' = 업체 파일
  const [fileModalMode, setFileModalMode] = useState('plan')
  const [fileForm, setFileForm]           = useState({ fileType:'annual', title:'', school:'', vendorId:'' })
  const [fileTarget, setFileTarget]       = useState(null) // vendor id (업체 모드일 때)
  const [modalFile, setModalFile]         = useState(null)
  const [uploading, setUploading]         = useState(false)
  const fileRef = useRef()

  // 교구업체 모달
  const [vendorModal, setVendorModal]     = useState(false)
  const [vendorForm, setVendorForm]       = useState({ name:'', managerName:'', contact:'', memo:'' })
  const [expandedVendor, setExpandedVendor] = useState(null)

  // 과목 추가 모달
  const [subjectModal, setSubjectModal]   = useState(false)
  const [newSubject, setNewSubject]       = useState('')

  // 삭제 확인 모달
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // 미리보기 모달
  const [preview, setPreview]             = useState(null)

  const reload = () => {
    const dbSubjects = SupplySubjects.byTeacher(user.id)
    if (dbSubjects.length === 0) {
      DEFAULT_SUBJECTS.forEach((name, i) =>
        SupplySubjects.insert({ id: uid(), teacherId: user.id, name, sortOrder: i, createdAt: now() })
      )
      setSubjects(DEFAULT_SUBJECTS)
    } else {
      setSubjects(dbSubjects.sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0)).map(s => s.name))
    }
    setVendorList(SupplyVendors.byTeacher(user.id))
    setItemList(SupplyItems.byTeacher(user.id))
    setPlanList(SupplyPlans.byTeacher(user.id))
    setClasses(sortClasses(Classes.byTeacher(user.id)))
    setStudents(Students.byTeacher(user.id))
  }

  useEffect(() => { reload() }, [])
  useEffect(() => { if (subjects.length > 0 && !selSubject) setSelSubject(subjects[0]) }, [subjects])
  useEffect(() => { setCheckedStudents([]) }, [selClassId, selSubject])

  // ── 교구 관련
  const confirmedStudents = students.filter(s => s.classIds?.includes(selClassId) && s.status === 'confirmed')
  const allChecked = confirmedStudents.length > 0 && checkedStudents.length === confirmedStudents.length
  const toggleAll  = () => setCheckedStudents(allChecked ? [] : confirmedStudents.map(s => s.id))
  const toggleOne  = (id) => setCheckedStudents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const getStudentSupply = (sid) => itemList.find(i => i.classId === selClassId && i.studentId === sid) || { name:'', stage:'' }

  const saveSupply = () => {
    if (!supplyForm.name) { alert('교구명을 입력하세요'); return }
    checkedStudents.forEach(sid =>
      SupplyItems.upsert({ id: uid(), teacherId: user.id, classId: selClassId, studentId: sid, subject: selSubject, name: supplyForm.name, stage: supplyForm.stage, createdAt: now() })
    )
    reload(); setSupplyModal(false); setSupplyForm({ name:'', stage:'' })
  }

  // ── 과목별 데이터
  const subjectVendors = vendorList.filter(v => v.subject === selSubject)
  // 선생님 파일 (지도안/홍보물) — school 필드 있음
  const subjectPlans = planList.filter(p => p.subject === selSubject && !p.vendorId)
  // 업체별 파일 — vendorId 있음
  const vendorFiles  = (vendorId) => planList.filter(p => p.vendorId === vendorId)

  // 학교 목록 (등록된 수업에서 추출)
  const schoolList = [...new Set(classes.map(c => c.organization).filter(Boolean))]

  // ── 파일 등록 (지도안/홍보물 공용)
  const openFileModal = (mode, vendorId = null) => {
    setFileModalMode(mode)
    setFileTarget(vendorId)
    setFileForm({ fileType: mode === 'vendor' ? 'annual' : 'annual', title:'', school:'', vendorId: vendorId || '' })
    setModalFile(null)
    setFileModal(true)
  }

  const saveFile = async () => {
    if (!fileForm.title) { alert('제목을 입력하세요'); return }
    setUploading(true)
    try {
      let fileUrl = null, fileName = null
      if (modalFile) {
        fileUrl  = await uploadToStorage(user.id, `${selSubject}/${fileForm.fileType}`, modalFile)
        fileName = modalFile.name
      }
      SupplyPlans.insert({
        id: uid(), teacherId: user.id, subject: selSubject,
        type: fileForm.fileType,       // 'annual' | 'session' | 'promo'
        fileType: fileForm.fileType,   // supply_plans.file_type 컬럼
        title: fileForm.title,
        school: fileForm.school || null,
        vendorId: fileTarget || null,
        fileUrl, fileName, createdAt: now(),
      })
      reload(); setFileModal(false); setModalFile(null)
      setFileForm({ fileType:'annual', title:'', school:'', vendorId:'' })
    } catch(e) { alert('업로드 실패: ' + e.message) }
    finally { setUploading(false) }
  }

  const deleteFile = (id) => {
    setDeleteConfirm({ msg:'이 파일을 삭제할까요?', onOk: () => { SupplyPlans.delete(id); reload() } })
  }

  // ── 교구업체
  const saveVendor = () => {
    if (!vendorForm.name) { alert('업체명을 입력하세요'); return }
    SupplyVendors.insert({ id: uid(), teacherId: user.id, subject: selSubject, ...vendorForm, createdAt: now() })
    reload(); setVendorModal(false); setVendorForm({ name:'', managerName:'', contact:'', memo:'' })
  }
  const deleteVendor = (id) => {
    setDeleteConfirm({ msg:'이 업체를 삭제할까요?\n업체 파일도 함께 삭제됩니다.', onOk: () => {
      SupplyVendors.delete(id)
      planList.filter(p => p.vendorId === id).forEach(p => SupplyPlans.delete(p.id))
      reload()
    }})
  }

  // ── 과목 관리
  const addSubject = () => {
    const s = newSubject.trim()
    if (!s) return
    if (subjects.includes(s)) { alert('이미 있는 과목이에요'); return }
    SupplySubjects.insert({ id: uid(), teacherId: user.id, name: s, sortOrder: subjects.length, createdAt: now() })
    reload(); setNewSubject(''); setSubjectModal(false); setSelSubject(s)
  }
  const deleteSubject = (s) => {
    setDeleteConfirm({
      msg: `"${s}" 과목을 삭제할까요?`,
      onOk: () => {
        const rec = SupplySubjects.byTeacher(user.id).find(r => r.name === s)
        if (rec) SupplySubjects.delete(rec.id)
        reload()
        if (selSubject === s) setSelSubject(subjects.filter(x => x !== s)[0] || null)
      }
    })
  }

  const isRobot = selSubject === '로봇'

  // 탭 정의
  const INNER_TABS = [
    { key:'supply', label:`🎒 교구(${selSubject||''})` },
    { key:'plan',   label:`📋 지도안(${selSubject||''})` },
    { key:'promo',  label:`🖼 홍보물(${selSubject||''})` },
    { key:'vendor', label:`🏢 교구업체(${selSubject||''})` },
  ]

  // 파일 타입 옵션
  const FILE_TYPE_OPTIONS = fileModalMode === 'vendor'
    ? [{ v:'annual', l:'📅 연간지도안' }, { v:'session', l:'📝 차시별지도안' }, { v:'promo', l:'🖼 홍보물' }]
    : innerTab === 'promo'
      ? [{ v:'promo', l:'🖼 홍보물' }]
      : [{ v:'annual', l:'📅 연간지도안' }, { v:'session', l:'📝 차시별지도안' }]

  return (
    <div style={{ padding:'24px', maxWidth:'1200px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🎒 교구 및 지도안 관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>과목별 교구 · 지도안 · 홍보물 · 교구업체 관리</p>
        </div>
      </div>

      {/* 과목 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        {subjects.map(s => (
          <div key={s} style={{ display:'flex', alignItems:'center' }}>
            <button onClick={() => { setSelSubject(s); setSelClassId(''); setInnerTab('supply') }}
              style={{ padding:'8px 16px', borderRadius: selSubject===s ? '8px 0 0 8px' : '8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'14px', background: selSubject===s ? C.primary : '#f3f4f6', color: selSubject===s ? '#fff' : C.muted, transition:'all .15s' }}>
              {s}
            </button>
            {selSubject === s && (
              <button onClick={() => deleteSubject(s)}
                style={{ padding:'8px 7px', borderRadius:'0 8px 8px 0', border:'none', cursor:'pointer', background:'#dc262620', color:C.danger, fontSize:'13px', lineHeight:1 }}>✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setSubjectModal(true)}
          style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 과목 추가
        </button>
      </div>

      {selSubject && (
        <>
          {/* 내부 탭 */}
          <div style={{ display:'flex', marginBottom:'20px', borderBottom:`1px solid ${C.border}`, overflowX:'auto' }}>
            {INNER_TABS.map(t => (
              <button key={t.key} onClick={() => setInnerTab(t.key)}
                style={{ padding:'10px 18px', border:'none', cursor:'pointer', background:'none', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight: innerTab===t.key ? 700 : 400, color: innerTab===t.key ? C.primary : C.muted, borderBottom: innerTab===t.key ? `2px solid ${C.primary}` : '2px solid transparent', marginBottom:'-1px', whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── 교구 관리 탭 */}
          {innerTab === 'supply' && (
            <div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>수업 선택</label>
                <select value={selClassId} onChange={e => setSelClassId(e.target.value)}
                  style={{ ...iStyle, width:'auto', minWidth:'300px' }}>
                  <option value=''>-- 수업을 선택하세요 --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.organization} · {cls.className}{cls.section ? ' '+cls.section : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selClassId ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', padding:'10px 14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'7px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:C.text }}>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width:'16px', height:'16px', cursor:'pointer' }} />
                      전체 선택 ({checkedStudents.length}/{confirmedStudents.length}명)
                    </label>
                    <div style={{ flex:1 }} />
                    {checkedStudents.length > 0 && (
                      <button onClick={() => setSupplyModal(true)}
                        style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        🎒 교구 설정 ({checkedStudents.length}명)
                      </button>
                    )}
                  </div>
                  {confirmedStudents.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>확정된 학생이 없습니다</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {confirmedStudents.map(s => {
                        const supply = getStudentSupply(s.id)
                        const isChecked = checkedStudents.includes(s.id)
                        return (
                          <div key={s.id} onClick={() => toggleOne(s.id)}
                            style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderRadius:'10px', border:`1.5px solid ${isChecked ? C.primary : C.border}`, background: isChecked ? '#fff7ed' : C.card, cursor:'pointer', transition:'all .15s' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => toggleOne(s.id)}
                              onClick={e => e.stopPropagation()} style={{ width:'16px', height:'16px', cursor:'pointer', flexShrink:0 }} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>
                                {s.name}
                                <span style={{ fontSize:'12px', color:C.muted, fontWeight:400, marginLeft:'8px' }}>{s.grade} {s.classNum}반</span>
                              </div>
                              {supply.name
                                ? <div style={{ fontSize:'12px', color:'#7c3aed', marginTop:'2px' }}>🎒 {supply.name}{supply.stage ? ` · ${supply.stage}단계` : ''}</div>
                                : <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>교구 미설정</div>
                              }
                            </div>
                            {supply.name && <span style={{ fontSize:'11px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'1px 7px', flexShrink:0 }}>설정완료</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>🎒</div>
                  <div style={{ fontSize:'14px' }}>수업을 선택하면 학생 목록이 표시됩니다</div>
                </div>
              )}
            </div>
          )}

          {/* ── 지도안 탭 */}
          {innerTab === 'plan' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>연간/차시별 지도안을 등록합니다. 학교를 지정하면 해당 학교 제출용으로 분류됩니다.</div>
                <button onClick={() => { setFileForm({ fileType:'annual', title:'', school:'', vendorId:'' }); openFileModal('plan') }}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 지도안 등록
                </button>
              </div>

              {/* 학교별 그룹핑 */}
              {(() => {
                const planItems = subjectPlans.filter(p => p.fileType !== 'promo' && p.type !== 'promo')
                if (!planItems.length) return (
                  <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                    <div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div>
                    <div style={{ fontSize:'14px' }}>등록된 지도안이 없습니다</div>
                  </div>
                )
                // 공통(학교 미지정) + 학교별
                const noSchool = planItems.filter(p => !p.school)
                const schools  = [...new Set(planItems.filter(p => p.school).map(p => p.school))]
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {noSchool.length > 0 && (
                      <div>
                        <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px', letterSpacing:'0.05em' }}>📁 공통 자료</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {noSchool.map(p => <FileRow key={p.id} item={p} onDelete={deleteFile} />)}
                        </div>
                      </div>
                    )}
                    {schools.map(school => (
                      <div key={school}>
                        <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px', letterSpacing:'0.05em' }}>🏫 {school}</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {planItems.filter(p => p.school === school).map(p => <FileRow key={p.id} item={p} onDelete={deleteFile} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 홍보물 탭 */}
          {innerTab === 'promo' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>과목별 홍보물을 보관합니다. 학교를 지정하면 해당 학교 제출용으로 분류됩니다.</div>
                <button onClick={() => { setFileForm({ fileType:'promo', title:'', school:'', vendorId:'' }); openFileModal('promo') }}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 홍보물 등록
                </button>
              </div>

              {(() => {
                const promoItems = subjectPlans.filter(p => p.fileType === 'promo' || p.type === 'promo')
                if (!promoItems.length) return (
                  <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                    <div style={{ fontSize:'36px', marginBottom:'10px' }}>🖼</div>
                    <div style={{ fontSize:'14px' }}>등록된 홍보물이 없습니다</div>
                  </div>
                )
                const noSchool = promoItems.filter(p => !p.school)
                const schools  = [...new Set(promoItems.filter(p => p.school).map(p => p.school))]
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {noSchool.length > 0 && (
                      <div>
                        <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px', letterSpacing:'0.05em' }}>📁 공통 홍보물</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {noSchool.map(p => <FileRow key={p.id} item={p} onDelete={deleteFile} />)}
                        </div>
                      </div>
                    )}
                    {schools.map(school => (
                      <div key={school}>
                        <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px', letterSpacing:'0.05em' }}>🏫 {school}</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {promoItems.filter(p => p.school === school).map(p => <FileRow key={p.id} item={p} onDelete={deleteFile} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 교구업체 탭 */}
          {innerTab === 'vendor' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>교구업체별 담당자 정보 및 업체 제공 자료를 관리합니다.</div>
                <button onClick={() => setVendorModal(true)}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 업체 등록
                </button>
              </div>

              {subjectVendors.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏢</div>
                  <div style={{ fontSize:'14px' }}>등록된 교구업체가 없습니다</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {subjectVendors.map(v => {
                    const vFiles   = vendorFiles(v.id)
                    const isExpanded = expandedVendor === v.id
                    return (
                      <div key={v.id} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                        {/* 업체 헤더 */}
                        <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', background: isExpanded ? '#f9fafb' : C.card }}
                          onClick={() => setExpandedVendor(isExpanded ? null : v.id)}>
                          <span style={{ fontSize:'20px' }}>🏢</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{v.name}</div>
                            <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, marginTop:'2px', flexWrap:'wrap' }}>
                              {v.managerName && <span>👤 {v.managerName}</span>}
                              {v.contact     && <span>📞 {v.contact}</span>}
                              {v.memo        && <span>📌 {v.memo}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            {vFiles.length > 0 && (
                              <span style={{ fontSize:'12px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>
                                파일 {vFiles.length}개
                              </span>
                            )}
                            <button onClick={e => { e.stopPropagation(); deleteVendor(v.id) }}
                              style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                            <span style={{ fontSize:'14px', color:C.muted }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* 업체 파일 영역 */}
                        {isExpanded && (
                          <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 18px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                              <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>업체 제공 자료</span>
                              <button onClick={() => openFileModal('vendor', v.id)}
                                style={{ padding:'5px 12px', borderRadius:'7px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                + 파일 추가
                              </button>
                            </div>
                            {vFiles.length === 0 ? (
                              <div style={{ textAlign:'center', padding:'20px', color:C.muted, fontSize:'13px' }}>등록된 파일이 없습니다</div>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                {vFiles.map(f => <FileRow key={f.id} item={f} onDelete={deleteFile} />)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 교구 설정 모달 */}
      {supplyModal && (
        <div onClick={e => { if(e.target===e.currentTarget) setSupplyModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>🎒 교구 설정 ({checkedStudents.length}명)</span>
              <button onClick={() => setSupplyModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={supplyForm.name} onChange={e => setSupplyForm(v => ({...v, name:e.target.value}))}
                  placeholder="예: 로봇 키트 A형" style={iStyle} autoFocus />
              </div>
              {isRobot && (
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계</label>
                  <input value={supplyForm.stage} onChange={e => setSupplyForm(v => ({...v, stage:e.target.value}))}
                    placeholder="예: 1단계, 2단계" style={iStyle} />
                </div>
              )}
              <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                선택된 <strong>{checkedStudents.length}명</strong>에게 동일하게 적용됩니다.
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveSupply}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setSupplyModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 파일 등록 모달 (지도안/홍보물/업체파일 공용) */}
      {fileModal && (
        <div onClick={e => { if(e.target===e.currentTarget) { setFileModal(false); setModalFile(null) } }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'460px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>
                {fileModalMode === 'vendor' ? '🏢 업체 파일 추가' : innerTab === 'promo' ? '🖼 홍보물 등록' : '📋 지도안 등록'}
                <span style={{ fontSize:'13px', color:C.muted, fontWeight:400, marginLeft:'6px' }}>— {selSubject}</span>
              </span>
              <button onClick={() => { setFileModal(false); setModalFile(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* 파일 종류 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>종류</label>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {FILE_TYPE_OPTIONS.map(o => (
                    <button key={o.v} onClick={() => setFileForm(f => ({...f, fileType:o.v}))}
                      style={{ padding:'7px 14px', borderRadius:'8px', border:`1.5px solid ${fileForm.fileType===o.v ? C.primary : C.border}`, background: fileForm.fileType===o.v ? '#fff7ed' : '#fff', color: fileForm.fileType===o.v ? C.primary : C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>제목 *</label>
                <input value={fileForm.title} onChange={e => setFileForm(f => ({...f, title:e.target.value}))}
                  placeholder="예: 2026년 로봇과학 연간지도안" style={iStyle} autoFocus />
              </div>

              {/* 학교 지정 (선생님 파일만) */}
              {fileModalMode !== 'vendor' && (
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>
                    학교 지정 <span style={{ fontWeight:400, color:C.muted }}>(선택 — 특정 학교 제출용이면 지정)</span>
                  </label>
                  <select value={fileForm.school} onChange={e => setFileForm(f => ({...f, school:e.target.value}))}
                    style={{ ...iStyle, background:'#fff' }}>
                    <option value=''>지정 안함 (공통 자료)</option>
                    {schoolList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* 파일 첨부 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>
                  파일 첨부 <span style={{ fontWeight:400 }}>(hwp, pdf, xlsx, jpg, png)</span>
                </label>
                {modalFile ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #86efac' }}>
                    <span style={{ fontSize:'20px' }}>📄</span>
                    <span style={{ fontSize:'13px', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{modalFile.name}</span>
                    <button onClick={() => setModalFile(null)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'18px', flexShrink:0 }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width:'100%', padding:'20px', borderRadius:'9px', border:`2px dashed ${C.border}`, background:'#f9fafb', cursor:'pointer', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                    <div style={{ fontSize:'24px', marginBottom:'4px' }}>📎</div>
                    <div style={{ fontSize:'13px' }}>클릭하여 파일 선택</div>
                    <div style={{ fontSize:'11px', marginTop:'2px' }}>.hwp · .hwpx · .pdf · .xlsx · .jpg · .png</div>
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".hwp,.hwpx,.pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display:'none' }}
                  onChange={e => e.target.files[0] && setModalFile(e.target.files[0])} />
              </div>

              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveFile} disabled={uploading}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background: uploading ? '#e5e7eb' : C.primary, color: uploading ? C.muted : '#fff', fontSize:'14px', fontWeight:700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {uploading ? '업로드 중...' : '저장'}
                </button>
                <button onClick={() => { setFileModal(false); setModalFile(null) }}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 교구업체 등록 모달 */}
      {vendorModal && (
        <div onClick={e => { if(e.target===e.currentTarget) setVendorModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>🏢 교구업체 등록 — {selSubject}</span>
              <button onClick={() => setVendorModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'업체명 *',      key:'name',        placeholder:'예: (주)로봇나라' },
                { label:'담당자 이름',   key:'managerName', placeholder:'예: 홍길동' },
                { label:'담당자 연락처', key:'contact',     placeholder:'예: 010-1234-5678' },
                { label:'메모',          key:'memo',        placeholder:'비고' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input value={vendorForm[f.key]} onChange={e => setVendorForm(v => ({...v, [f.key]:e.target.value}))}
                    placeholder={f.placeholder} style={iStyle} />
                </div>
              ))}
              <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                💡 업체 등록 후 업체 카드를 펼쳐서 홍보물·지도안을 추가할 수 있습니다.
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveVendor}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setVendorModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 과목 추가 모달 */}
      {subjectModal && (
        <div onClick={e => { if(e.target===e.currentTarget) setSubjectModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'360px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>+ 과목 추가</span>
              <button onClick={() => setSubjectModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubject()}
                placeholder="예: 드론, 코딩, 미술 ..." style={iStyle} autoFocus />
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={addSubject}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>추가</button>
                <button onClick={() => setSubjectModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'320px', width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontSize:'14px', fontWeight:600, color:'#111827', marginBottom:'20px', whiteSpace:'pre-line' }}>{deleteConfirm.msg}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
              <button onClick={() => { deleteConfirm.onOk(); setDeleteConfirm(null) }}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#ef4444', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 업로드 중...</div>
        </div>
      )}
    </div>
  )
}
