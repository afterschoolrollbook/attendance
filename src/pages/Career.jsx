import React, { useState, useEffect } from 'react'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs'
import { uid, now } from '../lib/utils.js'
import { Careers, Educations } from '../lib/db.js'
import { Modal } from '../components/Atoms.jsx'
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
  isCurrent: false, isOneDay: false, description:''
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
  const [eduModalFile, setEduModalFile] = useState(null)
  const [eduModalDrag, setEduModalDrag] = useState(false)
  const { success, error: toastError } = useToast()

  const reload = () => {
    setRecords(Careers.byTeacher(user.id))
    setEduRecords(Educations.byTeacher(user.id))
  }
  useEffect(() => { reload() }, [])

  const GROUP_ORDER = ['방과후 강사', '늘봄', '돌봄', '특강']
  const GROUP_LABEL = { '방과후 강사':'📋 방과후 강사', '특강':'⚡ 특강', '늘봄':'🌱 늘봄', '돌봄':'💛 돌봄' }

  // 그룹별로 묶고, 각 그룹 내 오래된 것 먼저(startDate 오름차순)
  const grouped = GROUP_ORDER.reduce((acc, type) => {
    const items = records
      .filter(r => (r.jobType || '방과후 강사') === type)
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
    if (items.length > 0) acc.push({ type, label: GROUP_LABEL[type] || type, items })
    return acc
  }, [])

  // 엑셀용 flat 배열 (그룹 순서 유지)
  const sorted = grouped.flatMap(g => g.items)

  // 진행중 여부: isCurrent이거나, endDate 없고 시작일이 있는 경우
  const isOngoing = r => r.isCurrent || (!r.endDate && !!r.startDate && !r.isOneDay)

  const getDuration = r => {
    if (!r.startDate) return ''
    if (r.isOneDay) return '하루'
    const start  = new Date(r.startDate)
    const end    = isOngoing(r) ? new Date() : new Date(r.endDate || new Date())
    const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30))
    if (months < 1) return '1개월 미만'
    if (months < 12) return `${months}개월`
    return `${Math.floor(months / 12)}년 ${months % 12 ? ` ${months % 12}개월` : ''}`
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
      isCurrent: !!r.isCurrent, isOneDay: !!r.isOneDay, description: r.description || ''
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

      // 하루짜리 특강이면 endDate = startDate
      const finalEndDate = form.isOneDay ? form.startDate : form.endDate

      const item = {
        id: itemId,
        teacherId: user.id,
        ...form,
        endDate: finalEndDate,
        ...(fileUrl && { fileUrl, fileName, fileType }),
        ...(!editId && { createdAt: now() }),
      }

      if (editId) Careers.update(editId, item)
      else Careers.insert(item)

      reload()
      success(editId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
      setModal(false); setModalFile(null)
    } catch(e) {
      toastError('저장 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteRecord = id => {
    setConfirm({ msg:'이 이력을 삭제할까요?', onOk: () => {
      Careers.delete(id); reload(); success('삭제되었습니다.')
    }})
  }

  const uploadFile = async (careerId, file) => {
    if (!validateFile(file)) return
    setUploading(true)
    try {
      const fileUrl = await uploadToStorage(user.id, careerId, file)
      Careers.update(careerId, { fileUrl, fileName: file.name, fileType: file.type })
      reload(); success('파일이 저장되었습니다.')
    } catch(e) {
      toastError('파일 업로드 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = careerId => {
    setConfirm({ msg:'첨부파일을 삭제할까요?', onOk: () => {
      Careers.update(careerId, { fileUrl: null, fileName: null, fileType: null })
      reload(); success('파일이 삭제되었습니다.')
    }})
  }

  const openPreview = r => {
    if (!r.fileUrl) return
    setPreview({ url: r.fileUrl, type: r.fileType || '', name: r.fileName || '첨부파일' })
  }

  const openEduAdd  = () => { setEduForm(EMPTY_EDU); setEduEditId(null); setEduModalFile(null); setEduModal(true) }
  const openEduEdit = r => {
    setEduForm({
      schoolName: r.schoolName, eduType: r.eduType || '대학교',
      major: r.major || '', admissionDate: r.admissionDate || '',
      graduationDate: r.graduationDate || '', status: r.status || '졸업', memo: r.memo || ''
    })
    setEduEditId(r.id); setEduModalFile(null); setEduModal(true)
  }
  const saveEdu = async () => {
    if (!eduForm.schoolName.trim()) { toastError('학교명을 입력하세요'); return }
    setUploading(true)
    try {
      const itemId = eduEditId || uid()
      let fileUrl = null, fileName = null, fileType = null

      if (eduModalFile) {
        if (!validateFile(eduModalFile)) { setUploading(false); return }
        fileUrl  = await uploadToStorage(user.id, itemId, eduModalFile)
        fileName = eduModalFile.name
        fileType = eduModalFile.type
      }

      const item = {
        id: itemId, teacherId: user.id, ...eduForm,
        ...(fileUrl && { fileUrl, fileName, fileType }),
        ...(!eduEditId && { createdAt: now() }),
      }
      if (eduEditId) Educations.update(eduEditId, item)
      else Educations.insert(item)
      reload(); success(eduEditId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
      setEduModal(false); setEduModalFile(null)
    } catch(e) {
      toastError('저장 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteEduFile = eduId => {
    setConfirm({ msg:'첨부파일을 삭제할까요?', onOk: () => {
      Educations.update(eduId, { fileUrl: null, fileName: null, fileType: null })
      reload(); success('파일이 삭제되었습니다.')
    }})
  }
  const deleteEdu = id => {
    setConfirm({ msg:'이 학력을 삭제할까요?', onOk: () => {
      Educations.delete(id); reload(); success('삭제되었습니다.')
    }})
  }

  // 학력: 오래된 것(입학일) 먼저
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
      '종료일': r.isOneDay ? r.startDate : (isOngoing(r) ? '진행중' : (r.endDate || '')),
      '재직기간': getDuration(r),
      '재직여부': r.isCurrent ? '재직중' : (isOngoing(r) ? '진행중' : '종료'),
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
    success('다운로드가 완료되었습니다.')
  }

  // 날짜 표시 헬퍼
  const getDateLabel = r => {
    if (!r.startDate) return ''
    if (r.isOneDay) return `📅 ${r.startDate} (하루)`
    if (r.isCurrent) return `📅 ${r.startDate} ~ 현재 ${getDuration(r) ? `(${getDuration(r)})` : ''}`
    if (!r.endDate) return `📅 ${r.startDate} ~ 진행중 ${getDuration(r) ? `(${getDuration(r)})` : ''}`
    return `📅 ${r.startDate} ~ ${r.endDate} ${getDuration(r) ? `(${getDuration(r)})` : ''}`
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

      {/* 이력 목록 — 그룹별 */}
      {records.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 이력이 없습니다</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 이력 추가 버튼으로 경력을 등록하세요</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'28px' }}>
          {grouped.map(group => (
            <div key={group.type}>
              {/* 그룹 헤더 */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{group.label}</span>
                <span style={{ fontSize:'12px', color:C.muted, background:'#f3f4f6', borderRadius:'20px', padding:'1px 10px', fontWeight:600 }}>{group.items.length}건</span>
                <div style={{ flex:1, height:'1px', background:C.border }} />
              </div>
              {/* 타임라인 */}
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', left:'19px', top:'24px', bottom:'24px', width:'2px', background:'#e5e7eb' }} />
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {group.items.map(r => (
                    <div key={r.id} style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
                      {/* 타임라인 점 */}
                      <div style={{ width:'38px', height:'38px', borderRadius:'50%', background: isOngoing(r) ? C.primary : '#f3f4f6', border:`2px solid ${isOngoing(r) ? C.primary : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                        <span style={{ fontSize:'16px' }}>{r.isOneDay ? '⚡' : isOngoing(r) ? '🏫' : '🏛'}</span>
                      </div>
                      {/* 카드 */}
                      <div
                        onClick={() => r.fileUrl && openPreview(r)}
                        onDragOver={e => { e.preventDefault(); setDragOverId(r.id) }}
                        onDragLeave={() => setDragOverId(null)}
                        onDrop={e => { e.preventDefault(); setDragOverId(null); const f = e.dataTransfer.files[0]; if(f) uploadFile(r.id, f) }}
                        style={{ flex:1, borderRadius:'12px', border: dragOverId===r.id ? `2px dashed ${C.primary}` : `1.5px solid ${isOngoing(r) ? '#fed7aa' : C.border}`, padding:'14px 16px', background: dragOverId===r.id ? '#fff7ed' : isOngoing(r) ? '#fffbf5' : C.card, cursor: r.fileUrl ? 'pointer' : 'default', transition:'box-shadow 0.15s, border 0.15s' }}
                        onMouseEnter={e => { if(r.fileUrl && dragOverId!==r.id) e.currentTarget.style.boxShadow='0 2px 12px rgba(249,115,22,0.15)' }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow='' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                          <div style={{ flex:1 }}>
                            {/* 기관명 + 뱃지 */}
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                              <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.orgName}</span>
                              {r.schoolType && <span style={{ fontSize:'11px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{r.schoolType === '직접입력' ? (r.customSchoolType || r.schoolType) : r.schoolType}</span>}
                              {r.isOneDay && <span style={{ fontSize:'11px', background:'#fef9c3', color:'#854d0e', border:'1px solid #fde047', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>하루특강</span>}
                              {!r.isOneDay && r.isCurrent && <span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>재직중</span>}
                              {!r.isOneDay && !r.isCurrent && !r.endDate && r.startDate && <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>진행중</span>}
                            </div>
                            {/* 상세 */}
                            <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                              {r.role    && <span>💼 {r.role}</span>}
                              {r.subject && <span>📚 {r.subject}</span>}
                              {r.startDate && <span>{getDateLabel(r)}</span>}
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
            </div>
          ))}
        </div>
      )}

      {/* 추가/편집 모달 */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? '이력 편집' : '이력 추가'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* 기관명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관명 *</label>
                <input value={form.orgName} onChange={e => setForm(v => ({...v, orgName:e.target.value}))}
                  placeholder="예: 청계초등학교"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>이력 분류</label>
                  <select value={form.jobType} onChange={e => setForm(v => ({...v, jobType:e.target.value, isOneDay: e.target.value !== '특강' ? false : v.isOneDay}))}
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
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input type="text" value={form[f.key]}
                    onChange={e => setForm(v => ({...v, [f.key]: e.target.value}))}
                    placeholder={f.placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              {form.jobType === '특강' && (
                <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', background:'#fef9c3', border:'1px solid #fde047', borderRadius:'8px', padding:'8px 12px' }}>
                  <input type="checkbox" checked={form.isOneDay}
                    onChange={e => setForm(v => ({...v, isOneDay: e.target.checked, endDate: e.target.checked ? '' : v.endDate, isCurrent: e.target.checked ? false : v.isCurrent}))} />
                  <span>⚡ 하루짜리 특강 <span style={{ color:'#92400e', fontSize:'11px' }}>(시작일 = 종료일로 자동 저장)</span></span>
                </label>
              )}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{form.isOneDay ? '특강 날짜' : '시작일'}</label>
                <input type="date" value={form.startDate} onChange={e => setForm(v => ({...v, startDate:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {!form.isOneDay && (
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>종료일</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(v => ({...v, endDate:e.target.value}))}
                    disabled={form.isCurrent}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', opacity: form.isCurrent ? 0.4 : 1 }} />
                </div>
              )}
              {!form.isOneDay && (
                <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <input type="checkbox" checked={form.isCurrent}
                    onChange={e => setForm(v => ({...v, isCurrent: e.target.checked, endDate: e.target.checked ? '' : v.endDate}))} />
                  현재 재직중
                </label>
              )}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>주요 업무 / 설명</label>
                <input type="text" value={form.description} onChange={e => setForm(v => ({...v, description:e.target.value}))}
                  placeholder="담당 내용을 적어주세요"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
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
      </Modal>

      {/* 미리보기 모달 */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.type?.startsWith('image/') ? '🖼' : '📄'} ${preview.name}` : ''} width={800}>
        {preview && (
          <>
            <div style={{ textAlign:'right', marginBottom:'10px' }}>
              <a href={preview.url} download={preview.name} target="_blank" rel="noopener noreferrer"
                style={{ padding:'6px 14px', borderRadius:'8px', background:'#f0fdf4', border:'1.5px solid #86efac', color:C.success, fontSize:'12px', fontWeight:700, textDecoration:'none' }}>
                ⬇ 다운로드
              </a>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb', borderRadius:'8px', padding:'16px', minHeight:'300px' }}>
              {preview.type?.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name}
                  style={{ maxWidth:'100%', maxHeight:'60vh', borderRadius:'8px', objectFit:'contain' }} />
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
          </>
        )}
      </Modal>

      {/* 학력 섹션 */}
      <div style={{ marginTop:'32px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>🎓 학력</span>
          {eduSorted.length > 0 && <span style={{ fontSize:'12px', color:C.muted, background:'#f3f4f6', borderRadius:'20px', padding:'1px 10px', fontWeight:600 }}>{eduSorted.length}건</span>}
          <div style={{ flex:1, height:'1px', background:C.border }} />
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
              <div key={r.id} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${C.border}`, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
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
                  {/* 첨부파일 */}
                  {r.fileUrl && (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px' }}>
                      <button onClick={() => setPreview({ url:r.fileUrl, type:r.fileType||'', name:r.fileName||'졸업증명서' })}
                        style={{ fontSize:'12px', color:'#3b82f6', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', gap:'4px' }}>
                        {r.fileType?.startsWith('image/') ? '🖼' : '📄'} {r.fileName || '졸업증명서'}
                      </button>
                      <span style={{ fontSize:'11px', color:C.primary, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'4px', padding:'1px 6px' }}>클릭하여 미리보기</span>
                      <button onClick={() => deleteEduFile(r.id)}
                        style={{ fontSize:'11px', color:C.danger, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <label style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted, whiteSpace:'nowrap' }}>
                    {r.fileUrl ? '🔄 교체' : '📎 증명서'}
                    <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                      onChange={async e => {
                        const f = e.target.files[0]; if(!f) return
                        if (!validateFile(f)) return
                        setUploading(true)
                        try {
                          const url = await uploadToStorage(user.id, r.id, f)
                          Educations.update(r.id, { fileUrl:url, fileName:f.name, fileType:f.type })
                          reload(); success('파일이 저장되었습니다.')
                        } catch(err) { toastError('업로드 실패: ' + err.message) }
                        finally { setUploading(false) }
                      }} />
                  </label>
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
      <Modal open={eduModal} onClose={() => setEduModal(false)} title={eduEditId ? '학력 편집' : '학력 추가'} width={440}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
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
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>졸업증명서 (이미지·PDF)</label>
                <div
                  onDragOver={e => { e.preventDefault(); setEduModalDrag(true) }}
                  onDragLeave={() => setEduModalDrag(false)}
                  onDrop={e => { e.preventDefault(); setEduModalDrag(false); const f = e.dataTransfer.files[0]; if(f) setEduModalFile(f) }}
                  style={{ border: eduModalDrag ? `2px dashed ${C.primary}` : `1.5px dashed ${C.border}`, borderRadius:'9px', padding:'16px', textAlign:'center', background: eduModalDrag ? '#fff7ed' : '#fafafa', transition:'all 0.15s' }}>
                  {eduModalFile ? (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                      <span style={{ fontSize:'13px', color:C.text, fontWeight:600 }}>
                        {eduModalFile.type.startsWith('image/') ? '🖼' : '📄'} {eduModalFile.name}
                      </span>
                      <button onClick={() => setEduModalFile(null)}
                        style={{ fontSize:'11px', color:C.danger, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>제거</button>
                    </div>
                  ) : (
                    <label style={{ cursor:'pointer', display:'block' }}>
                      <div style={{ fontSize:'22px', marginBottom:'4px' }}>📎</div>
                      <div style={{ fontSize:'12px', color:C.muted }}>클릭하거나 파일을 여기에 끌어다 놓으세요</div>
                      <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>JPG·PNG·PDF · 10MB 이하</div>
                      <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                        onChange={e => e.target.files[0] && setEduModalFile(e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button onClick={saveEdu}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setEduModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
        </div>
      </Modal>

      {/* 확인 모달 */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="삭제 확인" width={320}>
        {confirm && (
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontSize:'15px', fontWeight:600, color:'#111827', marginBottom:'20px' }}>{confirm.msg}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={() => setConfirm(null)}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
              <button onClick={() => { confirm.onOk(); setConfirm(null) }}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#ef4444', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          </div>
        )}
      </Modal>

{uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}
    </div>
  )
}
