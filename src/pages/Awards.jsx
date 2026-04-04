import React, { useState, useEffect } from 'react'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs'
import { uid, now } from '../lib/utils.js'
import { Awards } from '../lib/db.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary:'#f97316', success:'#16a34a', danger:'#ef4444',
  border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff',
}

async function uploadToStorage(userId, awardId, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const ext      = file.name.split('.').pop().toLowerCase()
  const filePath = `awards/${userId}/${awardId}/${Date.now()}.${ext}`
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

const AWARD_TYPES = ['표창', '우수상', '최우수상', '대상', '장려상', '감사패', '공로상', '심사위원', '기타']

const DIVISIONS = ['초등부', '중등부', '고등부', '대학부', '일반부', '기타']

const EMPTY_FORM = {
  year: String(new Date().getFullYear()),
  contestName: '', title: '', awardType: '표창', division: '', host: '', awardedAt: '', memo: ''
}

export function AwardsPage({ user }) {
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
  const currentYear = String(new Date().getFullYear())
  const [selYear, setSelYear] = useState('')

  const { success, error: toastError, info } = useToast()

  const reload = () => setRecords(Awards.byTeacher(user.id))
  useEffect(() => { reload() }, [])

  const years    = [...new Set(records.map(r => r.year))].filter(Boolean).sort()
  const filtered = records
    .filter(r => !selYear || r.year === selYear)
    .sort((a, b) => (a.awardedAt || '').localeCompare(b.awardedAt || ''))

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setModalFile(null); setModal(true) }
  const openEdit = r => {
    setForm({
      year: r.year, contestName: r.contestName || '', title: r.title,
      awardType: r.awardType || '표창', division: r.division || '',
      host: r.host || '', awardedAt: r.awardedAt || '', memo: r.memo || ''
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
    if (!form.title.trim()) { toastError('수상명을 입력하세요'); return }
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
        id: itemId, teacherId: user.id, ...form,
        ...(fileUrl && { fileUrl, fileName, fileType }),
        ...(!editId && { createdAt: now() }),
      }
      if (editId) Awards.update(editId, item)
      else Awards.insert(item)
      reload()
      success(editId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
      setModal(false); setModalFile(null); setSelYear(form.year)
    } catch(e) {
      toastError('저장 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteRecord = id => {
    setConfirm({ msg:'이 수상 기록을 삭제할까요?', onOk: () => {
      Awards.delete(id); reload(); success('삭제가 완료되었습니다.')
    }})
  }

  const uploadFile = async (awardId, file) => {
    if (!validateFile(file)) return
    setUploading(true)
    try {
      const fileUrl = await uploadToStorage(user.id, awardId, file)
      Awards.update(awardId, { fileUrl, fileName: file.name, fileType: file.type })
      reload(); success('파일이 저장되었습니다.')
    } catch(e) {
      toastError('파일 업로드 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = awardId => {
    setConfirm({ msg:'첨부파일을 삭제할까요?', onOk: () => {
      Awards.update(awardId, { fileUrl: null, fileName: null, fileType: null })
      reload(); success('삭제가 완료되었습니다.')
    }})
  }

  const openPreview = r => {
    if (!r.fileUrl) return
    setPreview({ url: r.fileUrl, type: r.fileType || '', name: r.fileName || '첨부파일' })
  }

  const downloadExcel = () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = [...records]
      .sort((a, b) => (a.awardedAt || '').localeCompare(b.awardedAt || ''))
      .map((r, i) => ({
        'No': i + 1,
        '연도': r.year || '',
        '대회명': r.contestName || '',
        '수상명': r.title || '',
        '수상종류': r.awardType || '',
        '부문': r.division || '',
        '수여기관': r.host || '',
        '수상일': r.awardedAt || '',
        '메모': r.memo || '',
      }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch:5 },{ wch:10 },{ wch:25 },{ wch:25 },{ wch:12 },{ wch:10 },{ wch:20 },{ wch:12 },{ wch:20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '수상경력')
    XLSX.writeFile(wb, `수상경력_${today}.xlsx`)
    success('다운로드가 완료되었습니다.')
  }

  const typeColors = {
    '대상':'#7c3aed', '최우수상':'#1d4ed8', '우수상':'#0369a1',
    '표창':'#16a34a', '장려상':'#d97706', '감사패':'#f97316',
    '공로상':'#9ca3af', '기타':'#6b7280',
  }

  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🏅 수상경력</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>수상 이력 및 표창 기록 관리</p>
        </div>
      </div>

      {/* 연도 탭 + 버튼 */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={() => setSelYear('')}
            style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${!selYear ? C.primary : C.border}`, background: !selYear ? '#fff7ed' : '#fff', color: !selYear ? C.primary : C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            전체
          </button>
          {years.map(y => (
            <button key={y} onClick={() => setSelYear(prev => prev === y ? '' : y)}
              style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${selYear===y ? C.primary : C.border}`, background: selYear===y ? '#fff7ed' : '#fff', color: selYear===y ? C.primary : C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              {y}년
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <div style={{ marginLeft:'auto', fontSize:'13px', color:'#7c3aed', fontWeight:700, background:'#f5f3ff', padding:'6px 14px', borderRadius:'8px', border:'1px solid #ddd6fe' }}>
            🏅 {selYear ? `${selYear}년 ` : '전체 '}{filtered.length}건
          </div>
        )}
        {records.length > 0 && (
          <button onClick={downloadExcel}
            style={{ padding:'8px 18px', borderRadius:'9px', border:'1.5px solid #86efac', background:'#f0fdf4', color:'#15803d', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📊 목록 받기
          </button>
        )}
        <button onClick={openAdd}
          style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 수상 추가
        </button>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏅</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>수상 기록이 없습니다</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 수상 추가 버튼을 눌러 기록하세요</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtered.map(r => (
            <div key={r.id}
              onClick={() => r.fileUrl && openPreview(r)}
              onDragOver={e => { e.preventDefault(); setDragOverId(r.id) }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={e => { e.preventDefault(); setDragOverId(null); const f = e.dataTransfer.files[0]; if(f) uploadFile(r.id, f) }}
              style={{ background: dragOverId===r.id ? '#fff7ed' : C.card, borderRadius:'12px', border: dragOverId===r.id ? `2px dashed ${C.primary}` : `1px solid ${C.border}`, padding:'16px 20px', cursor: r.fileUrl ? 'pointer' : 'default', transition:'box-shadow 0.15s, border 0.15s, background 0.15s' }}
              onMouseEnter={e => { if(r.fileUrl && dragOverId!==r.id) e.currentTarget.style.boxShadow='0 2px 12px rgba(249,115,22,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.title}</span>
                    {r.awardType && (
                      <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'5px', padding:'1px 8px', border:'1px solid', color: typeColors[r.awardType] || C.muted, background: (typeColors[r.awardType] || '#6b7280') + '15', borderColor: (typeColors[r.awardType] || '#6b7280') + '44' }}>
                        {r.awardType}
                      </span>
                    )}
                    {r.division && (
                      <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>
                        {r.division}
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                    {r.contestName && <span>🏆 {r.contestName}</span>}
                    {r.host        && <span>🏛 {r.host}</span>}
                    {r.awardedAt   && <span>📅 {r.awardedAt}</span>}
                    {r.memo        && <span>📌 {r.memo}</span>}
                  </div>
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
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  <label style={{ padding:'5px 10px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted, whiteSpace:'nowrap' }}>
                    {r.fileUrl ? '🔄 교체' : '📎 파일'}
                    <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                      onChange={e => e.target.files[0] && uploadFile(r.id, e.target.files[0])} />
                  </label>
                  <button onClick={() => openEdit(r)}
                    style={{ padding:'5px 10px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                  <button onClick={() => deleteRecord(r.id)}
                    style={{ padding:'5px 10px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/편집 모달 */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? '수상 편집' : '수상 추가'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* 연도 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>연도</label>
                <input type="number" value={form.year} onChange={e => setForm(v => ({...v, year:e.target.value}))}
                  placeholder="예: 2025"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 대회명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>대회명</label>
                <input value={form.contestName} onChange={e => setForm(v => ({...v, contestName:e.target.value}))}
                  placeholder="예: 전국 방과후 강사 경진대회"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 수상명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>수상명 *</label>
                <input value={form.title} onChange={e => setForm(v => ({...v, title:e.target.value}))}
                  placeholder="예: 우수 방과후 강사 표창"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 수상 종류 + 부문 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>수상 종류</label>
                  <select value={form.awardType} onChange={e => setForm(v => ({...v, awardType:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    {AWARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>부문</label>
                  <select value={form.division} onChange={e => setForm(v => ({...v, division:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    <option value=''>선택 안함</option>
                    {DIVISIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {/* 수여기관 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>수여기관</label>
                <input value={form.host} onChange={e => setForm(v => ({...v, host:e.target.value}))}
                  placeholder="예: 경기도교육청"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 수상일 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>수상일</label>
                <input type="date" value={form.awardedAt} onChange={e => setForm(v => ({...v, awardedAt:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 메모 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모</label>
                <input value={form.memo} onChange={e => setForm(v => ({...v, memo:e.target.value}))}
                  placeholder="비고"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              {/* 파일 첨부 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>첨부파일 (상장·표창장 이미지·PDF)</label>
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
                  style={{ maxWidth:'100%', maxHeight:'60vh', borderRadius:'8px', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', objectFit:'contain' }} />
              ) : preview.type === 'application/pdf' ? (
                <iframe src={preview.url} title={preview.name}
                  style={{ width:'100%', height:'600px', border:'none', borderRadius:'8px' }} />
              ) : (
                <div style={{ textAlign:'center', color:C.muted }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px' }}>📄</div>
                  <div style={{ fontSize:'14px' }}>미리보기를 지원하지 않는 파일 형식입니다</div>
                  <a href={preview.url} download={preview.name}
                    style={{ display:'inline-block', marginTop:'12px', color:C.primary, fontSize:'13px' }}>다운로드하여 확인하기</a>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* 확인 모달 */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'320px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', textAlign:'center' }}>
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

{uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}
    </div>
  )
}
