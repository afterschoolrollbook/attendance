import React, { useState, useEffect } from 'react'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs'
import { uid, now } from '../lib/utils.js'
import { Careers, Educations } from '../lib/db.js'
import { ToastContainer } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary:'#f97316', success:'#16a34a', danger:'#ef4444',
  border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff',
}

// Training과 동일한 방식으로 Storage 업로드
async function uploadToStorage(userId, careerId, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')

  const ext      = file.name.split('.').pop().toLowerCase()
  const filePath = `career/${userId}/${careerId}/${Date.now()}.${ext}`

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/teacher-files/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`파일 업로드 실패: ${err?.message || err?.error || res.statusText}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/teacher-files/${filePath}`
}

const EDU_TYPES = ['대학원(박사)', '대학원(석사)', '대학교', '전문대학', '고등학교', '기타']
const EDU_STATUS = ['졸업', '재학중', '중퇴', '수료']

const EMPTY_EDU = {
  schoolName: '', eduType: '대학교', major: '', admissionDate: '',
  graduationDate: '', status: '졸업', memo: ''
}

const EMPTY_FORM = {
  orgName:'', jobType:'방과후 강사', schoolType:'초등', customSchoolType:'',
  role:'', subject:'', startDate:'', endDate:'',
  isCurrent: false, description:''
}

export function Career({ user }) {
  const [records, setRecords]       = useState([])
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [editId, setEditId]         = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [dragOverId, setDragOverId] = useState(null)
  const [modalFile, setModalFile]   = useState(null)
  const [modalDrag, setModalDrag]   = useState(false)
  const [preview, setPreview]       = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [eduRecords, setEduRecords] = useState([])
  const [eduModal, setEduModal]     = useState(false)
  const [eduForm, setEduForm]       = useState(EMPTY_EDU)
  const [eduEditId, setEduEditId]   = useState(null)
  const { toasts, success, error: toastError, info } = useToast()

  const reload = () => {
    setRecords(Careers.byTeacher(user.id))
    setEduRecords(Educations.byTeacher(user.id))
  }
  useEffect(() => { reload() }, [])

  const sorted = [...records].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1
    if (!a.isCurrent && b.isCurrent) return 1
    return (a.startDate || '').localeCompare(b.startDate || '')
  })

  const getDuration = r => {
    if (!r.startDate) return ''
    const start  = new Date(r.startDate)
    const end    = r.isCurrent ? new Date() : new Date(r.endDate || new Date())
    const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30))
    if (months < 12) return `${months}개월`
    return `${Math.floor(months / 12)}년 ${months % 12}개월`
  }

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setModalFile(null); setModal(true) }
  const openEdit = r => {
    setForm({
      orgName: r.orgName,
      jobType: r.jobType || '방과후 강사',
      schoolType: r.schoolType || '초등',
      customSchoolType: r.customSchoolType || '',
      role: r.role || '', subject: r.subject || '',
      startDate: r.startDate || '', endDate: r.endDate || '',
      isCurrent: !!r.isCurrent, description: r.description || ''
    })
    setEditId(r.id); setModalFile(null); setModal(true)
  }

  const validateFile = file => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf']
    if (!allowed.includes(file.type)) { toastError('이미지·PDF 파일만 업로드 가능합니다'); return false }
    if (file.size > 10 * 1024 * 1024) { toastError('10MB 이하 파일만 업로드 가능합니다'); return false }
    return true
  }

  const save = async () => {
    if (!form.orgName.trim()) { toastError('기관명을 입력하세요'); return }
    setUploading(true)
    try {
      const itemId = editId || uid()
      let fileUrl = null, fileName = null, fileType = null

      if (modalFile) {
        if (!validateFile(modalFile)) { setUploading(false); return }
        fileUrl  = await uploadToStorage(user.id, itemId, modalFile)
        fileName = modalFile.name
        fileType = modalFile.type
      }

      const item = {
        id: itemId,
        teacherId: user.id,
        ...form,
        ...(fileUrl && { fileUrl, fileName, fileType }),
        ...(!editId && { createdAt: now() }),
      }

      if (editId) Careers.update(editId, item)
      else Careers.insert(item)

      reload()
      success(editId ? '수정됐어요' : '등록됐어요 ✅')
      setModal(false); setModalFile(null)
    } catch(e) {
      toastError('저장 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteRecord = id => {
    setConfirm({ msg:'이 이력을 삭제할까요?', onOk: () => {
      Careers.delete(id); reload(); info('삭제됐어요')
    }})
  }

  const uploadFile = async (careerId, file) => {
    if (!validateFile(file)) return
    setUploading(true)
    try {
      const fileUrl = await uploadToStorage(user.id, careerId, file)
      Careers.update(careerId, { fileUrl, fileName: file.name, fileType: file.type })
      reload(); success('파일이 저장됐어요 📎')
    } catch(e) {
      toastError('파일 업로드 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = careerId => {
    setConfirm({ msg:'첨부파일을 삭제할까요?', onOk: () => {
      Careers.update(careerId, { fileUrl: null, fileName: null, fileType: null })
      reload(); info('파일을 삭제했어요')
    }})
  }

  const openPreview = r => {
    if (!r.fileUrl) return
    setPreview({ url: r.fileUrl, type: r.fileType || '', name: r.fileName || '첨부파일' })
  }

  const openEduAdd  = () => { setEduForm(EMPTY_EDU); setEduEditId(null); setEduModal(true) }
  const openEduEdit = r => {
    setEduForm({
      schoolName: r.schoolName, eduType: r.eduType || '대학교',
      major: r.major || '', admissionDate: r.admissionDate || '',
      graduationDate: r.graduationDate || '', status: r.status || '졸업', memo: r.memo || ''
    })
    setEduEditId(r.id); setEduModal(true)
  }
  const saveEdu = () => {
    if (!eduForm.schoolName.trim()) { toastError('학교명을 입력하세요'); return }
    const item = { id: eduEditId || uid(), teacherId: user.id, ...eduForm, ...(!eduEditId && { createdAt: now() }) }
    if (eduEditId) Educations.update(eduEditId, item)
    else Educations.insert(item)
    reload(); success(eduEditId ? '수정됐어요' : '등록됐어요 ✅'); setEduModal(false)
  }
  const deleteEdu = id => {
    setConfirm({ msg:'이 학력을 삭제할까요?', onOk: () => {
      Educations.delete(id); reload(); info('삭제됐어요')
    }})
  }

  const eduSorted = [...eduRecords].sort((a, b) => (a.admissionDate || '').localeCompare(b.admissionDate || ''))

  const downloadExcel = () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = sorted.map((r, i) => ({
      'No': i + 1,
      '기관명': r.orgName || '',
      '분류': r.jobType || '',
      '기관유형': r.schoolType === '직접입력' ? (r.customSchoolType || '') : (r.schoolType || ''),
      '역할': r.role || '',
      '담당과목': r.subject || '',
      '시작일': r.startDate || '',
      '종료일': r.isCurrent ? '현재' : (r.endDate || ''),
      '재직기간': getDuration(r),
      '재직여부': r.isCurrent ? '재직중' : '퇴직',
      '주요업무': r.description || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 20 }, // 기관명
      { wch: 15 }, // 역할
      { wch: 15 }, // 담당과목
      { wch: 12 }, // 시작일
      { wch: 12 }, // 종료일
      { wch: 12 }, // 재직기간
      { wch: 10 }, // 재직여부
      { wch: 30 }, // 주요업무
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '이력목록')

    // 학력 시트 추가
    if (eduRecords.length > 0) {
      const eduRows = eduSorted.map((r, i) => ({
        'No': i + 1,
        '학교명': r.schoolName || '',
        '구분': r.eduType || '',
        '전공': r.major || '',
        '입학일': r.admissionDate || '',
        '졸업일': r.status === '재학중' ? '재학중' : (r.graduationDate || ''),
        '상태': r.status || '',
        '메모': r.memo || '',
      }))
      const wsEdu = XLSX.utils.json_to_sheet(eduRows)
      wsEdu['!cols'] = [{ wch:5 },{ wch:20 },{ wch:12 },{ wch:18 },{ wch:12 },{ wch:12 },{ wch:10 },{ wch:20 }]
      XLSX.utils.book_append_sheet(wb, wsEdu, '학력목록')
    }

    XLSX.writeFile(wb, `이력및학력_${today}.xlsx`)
    success('엑셀 다운로드 완료 📊')
  }

  return (
    <div style={{ padding:'24px', maxWidth:'900px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>📋 이력 및 학력관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>강사 활동 이력 및 학력 관리</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {records.length > 0 && (
            <button onClick={downloadExcel}
              style={{ padding:'8px 18px', borderRadius:'9px', border:'1.5px solid #86efac', background:'#f0fdf4', color:'#15803d', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              📊 목록 받기
            </button>
          )}
          <button onClick={openEduAdd}
            style={{ padding:'8px 18px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff', color:C.primary, fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 학력 추가
          </button>
          <button onClick={openAdd}
            style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 이력 추가
          </button>
        </div>
      </div>

      {/* 목록 */}
      {sorted.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 이력이 없습니다</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 이력 추가 버튼으로 경력을 등록하세요</div>
        </div>
      ) : (
        <div style={{ position:'relative' }}>
          {/* 타임라인 선 */}
          <div style={{ position:'absolute', left:'19px', top:'24px', bottom:'24px', width:'2px', background:'#e5e7eb' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {sorted.map(r => (
              <div key={r.id} style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
                {/* 타임라인 점 */}
                <div style={{ width:'38px', height:'38px', borderRadius:'50%', background: r.isCurrent ? C.primary : '#f3f4f6', border:`2px solid ${r.isCurrent ? C.primary : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                  <span style={{ fontSize:'16px' }}>{r.isCurrent ? '🏫' : '🏛'}</span>
                </div>
                {/* 카드 */}
                <div
                  onClick={() => r.fileUrl && openPreview(r)}
                  onDragOver={e => { e.preventDefault(); setDragOverId(r.id) }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={e => { e.preventDefault(); setDragOverId(null); const f = e.dataTransfer.files[0]; if(f) uploadFile(r.id, f) }}
                  style={{ flex:1, borderRadius:'12px', border: dragOverId===r.id ? `2px dashed ${C.primary}` : `1.5px solid ${r.isCurrent ? '#fed7aa' : C.border}`, padding:'14px 16px', background: dragOverId===r.id ? '#fff7ed' : r.isCurrent ? '#fffbf5' : C.card, cursor: r.fileUrl ? 'pointer' : 'default', transition:'box-shadow 0.15s, border 0.15s' }}
                  onMouseEnter={e => { if(r.fileUrl && dragOverId!==r.id) e.currentTarget.style.boxShadow='0 2px 12px rgba(249,115,22,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                    <div style={{ flex:1 }}>
                      {/* 기관명 + 뱃지 */}
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                        <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.orgName}</span>
                        {r.jobType && <span style={{ fontSize:'11px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{r.jobType}</span>}
                        {(r.schoolType) && <span style={{ fontSize:'11px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{r.schoolType === '직접입력' ? (r.customSchoolType || r.schoolType) : r.schoolType}</span>}
                        {r.isCurrent && <span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>재직중</span>}
                      </div>
                      {/* 상세 */}
                      <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                        {r.role    && <span>💼 {r.role}</span>}
                        {r.subject && <span>📚 {r.subject}</span>}
                        {r.startDate && <span>📅 {r.startDate} ~ {r.isCurrent ? '현재' : (r.endDate || '?')} {getDuration(r) && `(${getDuration(r)})`}</span>}
                      </div>
                      {r.description && <div style={{ fontSize:'12px', color:'#374151', marginTop:'6px', lineHeight:1.5 }}>{r.description}</div>}
                      {/* 첨부파일 */}
                      {r.fileUrl && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px' }}>
                          <span style={{ fontSize:'12px', color:'#3b82f6' }}>
                            {r.fileType?.startsWith('image/') ? '🖼' : '📄'} {r.fileName || '첨부파일'}
                          </span>
                          <span style={{ fontSize:'11px', color:C.primary, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'4px', padding:'1px 6px' }}>클릭하여 미리보기</span>
                          <button onClick={e => { e.stopPropagation(); deleteFile(r.id) }}
                            style={{ fontSize:'11px', color:C.danger, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                        </div>
                      )}
                    </div>
                    {/* 버튼 */}
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }} onClick={e => e.stopPropagation()}>
                      <label style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted, whiteSpace:'nowrap' }}>
                        {r.fileUrl ? '🔄 교체' : '📎 파일'}
                        <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                          onChange={e => e.target.files[0] && uploadFile(r.id, e.target.files[0])} />
                      </label>
                      <button onClick={() => openEdit(r)}
                        style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                      <button onClick={() => deleteRecord(r.id)}
                        style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>삭제</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추가/편집 모달 */}
      {modal && (
        <div onClick={e => { if(e.target===e.currentTarget) setModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>{editId ? '이력 편집' : '이력 추가'}</span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* 기관명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관명 *</label>
                <input value={form.orgName} onChange={e => setForm(v => ({...v, orgName:e.target.value}))}
                  placeholder="예: 청계초등학교"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>

              {/* 이력 분류 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>이력 분류</label>
                  <select value={form.jobType} onChange={e => setForm(v => ({...v, jobType:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    {['방과후 강사','특강','늘봄','돌봄'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관 유형</label>
                  <select value={form.schoolType} onChange={e => setForm(v => ({...v, schoolType:e.target.value, customSchoolType:''}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    {['초등','중등','고등','청소년수련관','문화센터','직접입력'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {form.schoolType === '직접입력' && (
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관 유형 직접 입력</label>
                  <input value={form.customSchoolType} onChange={e => setForm(v => ({...v, customSchoolType:e.target.value}))}
                    placeholder="기관 유형을 입력하세요"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              )}

              {[
                { label:'담당 역할', key:'role', placeholder:'예: 방과후 강사' },
                { label:'담당 과목', key:'subject', placeholder:'예: 로봇과학, 코딩' },
                { label:'시작일', key:'startDate', type:'date' },
                { label:'종료일', key:'endDate', type:'date' },
                { label:'주요 업무 / 설명', key:'description', placeholder:'담당 내용을 적어주세요' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]}
                    onChange={e => setForm(v => ({...v, [f.key]: e.target.value}))}
                    disabled={f.key === 'endDate' && form.isCurrent}
                    placeholder={f.placeholder || ''}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', opacity: f.key==='endDate' && form.isCurrent ? 0.4 : 1 }} />
                </div>
              ))}
              <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                <input type="checkbox" checked={form.isCurrent}
                  onChange={e => setForm(v => ({...v, isCurrent: e.target.checked, endDate: e.target.checked ? '' : v.endDate}))} />
                현재 재직중
              </label>

              {/* 파일 첨부 (드래그앤드롭) */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>첨부파일 (이미지·PDF)</label>
                <div
                  onDragOver={e => { e.preventDefault(); setModalDrag(true) }}
                  onDragLeave={() => setModalDrag(false)}
                  onDrop={e => { e.preventDefault(); setModalDrag(false); const f = e.dataTransfer.files[0]; if(f) setModalFile(f) }}
                  style={{ border: modalDrag ? `2px dashed ${C.primary}` : `1.5px dashed ${C.border}`, borderRadius:'9px', padding:'16px', textAlign:'center', background: modalDrag ? '#fff7ed' : '#fafafa', transition:'all 0.15s' }}>
                  {modalFile ? (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                      <span style={{ fontSize:'13px', color:C.text, fontWeight:600 }}>
                        {modalFile.type.startsWith('image/') ? '🖼' : '📄'} {modalFile.name}
                      </span>
                      <button onClick={() => setModalFile(null)}
                        style={{ fontSize:'11px', color:C.danger, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>제거</button>
                    </div>
                  ) : (
                    <label style={{ cursor:'pointer', display:'block' }}>
                      <div style={{ fontSize:'22px', marginBottom:'4px' }}>📎</div>
                      <div style={{ fontSize:'12px', color:C.muted }}>클릭하거나 파일을 여기에 끌어다 놓으세요</div>
                      <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>JPG·PNG·PDF · 10MB 이하</div>
                      <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                        onChange={e => e.target.files[0] && setModalFile(e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button onClick={save}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {preview && (
        <div onClick={e => { if(e.target===e.currentTarget) setPreview(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:2000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'14px', overflow:'hidden', maxWidth:'800px', width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>
                {preview.type?.startsWith('image/') ? '🖼' : '📄'} {preview.name}
              </span>
              <div style={{ display:'flex', gap:'8px' }}>
                <a href={preview.url} download={preview.name} target="_blank" rel="noopener noreferrer"
                  style={{ padding:'6px 14px', borderRadius:'8px', background:'#f0fdf4', border:'1.5px solid #86efac', color:C.success, fontSize:'12px', fontWeight:700, textDecoration:'none' }}>
                  ⬇ 다운로드
                </a>
                <button onClick={() => setPreview(null)}
                  style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:C.muted, lineHeight:1 }}>×</button>
              </div>
            </div>
            <div style={{ overflow:'auto', flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb', padding:'16px' }}>
              {preview.type?.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name}
                  style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:'8px', objectFit:'contain' }} />
              ) : preview.type === 'application/pdf' ? (
                <iframe src={preview.url} title={preview.name}
                  style={{ width:'100%', height:'600px', border:'none', borderRadius:'8px' }} />
              ) : (
                <div style={{ textAlign:'center', color:C.muted }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px' }}>📄</div>
                  <a href={preview.url} download={preview.name}
                    style={{ color:C.primary, fontSize:'13px' }}>다운로드하여 확인하기</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 학력 섹션 */}
      <div style={{ marginTop:'32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <h2 style={{ fontSize:'17px', fontWeight:700, color:C.text, margin:0 }}>🎓 학력</h2>
        </div>
        {eduSorted.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
            <div style={{ fontSize:'30px', marginBottom:'8px' }}>🎓</div>
            <div style={{ fontSize:'14px', fontWeight:600 }}>등록된 학력이 없습니다</div>
            <div style={{ fontSize:'12px', marginTop:'4px' }}>+ 학력 추가 버튼으로 등록하세요</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {eduSorted.map(r => (
              <div key={r.id} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${C.border}`, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
                    <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.schoolName}</span>
                    <span style={{ fontSize:'11px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{r.eduType}</span>
                    <span style={{ fontSize:'11px', background: r.status==='재학중'?'#fff7ed':'#f3f4f6', color: r.status==='재학중'?C.primary:'#374151', border:`1px solid ${r.status==='재학중'?'#fed7aa':'#d1d5db'}`, borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{r.status}</span>
                  </div>
                  <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                    {r.major && <span>📖 {r.major}</span>}
                    {r.admissionDate && <span>📅 {r.admissionDate} ~ {r.status==='재학중' ? '현재' : (r.graduationDate || '?')}</span>}
                    {r.memo && <span>📌 {r.memo}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => openEduEdit(r)}
                    style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                  <button onClick={() => deleteEdu(r.id)}
                    style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 학력 모달 */}
      {eduModal && (
        <div onClick={e => { if(e.target===e.currentTarget) setEduModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'440px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>{eduEditId ? '학력 편집' : '학력 추가'}</span>
              <button onClick={() => setEduModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>학교명 *</label>
                <input value={eduForm.schoolName} onChange={e => setEduForm(v => ({...v, schoolName:e.target.value}))}
                  placeholder="예: 한국대학교"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>구분</label>
                  <select value={eduForm.eduType} onChange={e => setEduForm(v => ({...v, eduType:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    {EDU_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>상태</label>
                  <select value={eduForm.status} onChange={e => setEduForm(v => ({...v, status:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    {EDU_STATUS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>전공</label>
                <input value={eduForm.major} onChange={e => setEduForm(v => ({...v, major:e.target.value}))}
                  placeholder="예: 음악교육학과"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>입학일</label>
                  <input type="date" value={eduForm.admissionDate} onChange={e => setEduForm(v => ({...v, admissionDate:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>졸업일</label>
                  <input type="date" value={eduForm.graduationDate} onChange={e => setEduForm(v => ({...v, graduationDate:e.target.value}))}
                    disabled={eduForm.status === '재학중'}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', opacity: eduForm.status==='재학중' ? 0.4 : 1 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모</label>
                <input value={eduForm.memo} onChange={e => setEduForm(v => ({...v, memo:e.target.value}))}
                  placeholder="비고"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button onClick={saveEdu}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setEduModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'320px', width:'100%', textAlign:'center' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontSize:'15px', fontWeight:600, color:'#111827', marginBottom:'20px' }}>{confirm.msg}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={() => setConfirm(null)}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
              <button onClick={() => { confirm.onOk(); setConfirm(null) }}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#ef4444', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />

      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}
    </div>
  )
}
