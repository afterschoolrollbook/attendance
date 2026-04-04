import React, { useState, useEffect } from 'react'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs'
import { uid, now } from '../lib/utils.js'
import { Certificates as CertDB, Settings } from '../lib/db.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary:'#f97316', success:'#16a34a', danger:'#ef4444',
  border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff',
}

function loadCertPartners() {
  try {
    const ts = Settings.get('teacherService')
    return ts?.certPartners || []
  } catch { return [] }
}

// 파일을 base64로 변환
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

// Training과 동일한 방식으로 Storage 업로드
async function uploadToStorage(userId, certId, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }

  const ext      = file.name.split('.').pop().toLowerCase()
  const filePath = `certificates/${userId}/${certId}/${Date.now()}.${ext}`

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

const CERT_TYPES = ['국가자격증', '민간자격증', '기타']

const EMPTY_FORM = {
  name: '', issuer: '', certType: '국가자격증', grade: '',
  certNumber: '', privateRegNum: '', issuedAt: '', expiresAt: '', noExpiry: false, memo: '',
}

export function Certificates({ user }) {
  const [tab, setTab]               = useState('list')
  const [records, setRecords]       = useState([])
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [editId, setEditId]         = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [dragOverId, setDragOverId] = useState(null)
  const [modalFile, setModalFile]   = useState(null)
  const [modalDrag, setModalDrag]   = useState(false)
  const [certPartners]              = useState(() => loadCertPartners())
  const [preview, setPreview]       = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const { success, error: toastError } = useToast()

  const [selYear, setSelYear] = useState('전체')

  const reload = () => setRecords(CertDB.byTeacher(user.id))
  useEffect(() => { reload() }, [])

  // 취득일 기준 연도 목록 자동 추출
  const years = ['전체', ...new Set(
    records.map(r => r.issuedAt ? r.issuedAt.slice(0, 4) : null).filter(Boolean)
  )].sort((a, b) => a === '전체' ? -1 : b === '전체' ? 1 : b.localeCompare(a))

  const filtered = selYear === '전체'
    ? records
    : records.filter(r => (r.issuedAt || '').slice(0, 4) === selYear)

  const sorted = [...filtered].sort((a, b) => (a.issuedAt || '').localeCompare(b.issuedAt || ''))

  const isExpired    = r => !r.noExpiry && r.expiresAt && r.expiresAt < new Date().toISOString().slice(0, 10)
  const expiringSoon = r => {
    if (r.noExpiry || !r.expiresAt) return false
    const diff = (new Date(r.expiresAt) - new Date()) / 86400000
    return diff > 0 && diff <= 90
  }

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setModalFile(null); setModal(true) }
  const openEdit = r => {
    setForm({
      name: r.name, issuer: r.issuer || '', certType: r.certType || '국가자격증',
      grade: r.grade || '', certNumber: r.certNumber || '', privateRegNum: r.privateRegNum || '',
      issuedAt: r.issuedAt || '', expiresAt: r.expiresAt || '',
      noExpiry: r.noExpiry || false, memo: r.memo || '',
    })
    setEditId(r.id)
    setModalFile(null)
    setModal(true)
  }

  const validateFile = file => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) { toastError('이미지·PDF 파일만 업로드 가능합니다'); return false }
    if (file.size > 10 * 1024 * 1024) { toastError('10MB 이하 파일만 업로드 가능합니다'); return false }
    return true
  }

  const save = async () => {
    if (!form.name.trim()) { toastError('자격증명을 입력하세요'); return }
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

      if (editId) CertDB.update(editId, item)
      else CertDB.insert(item)

      reload()
      success(editId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
      setModal(false)
      setModalFile(null)
    } catch(e) {
      toastError('저장 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteRecord = id => {
    setConfirm({ msg: '이 자격증을 삭제할까요?', onOk: () => {
      CertDB.delete(id); reload(); success('삭제되었습니다.')
    }})
  }

  const uploadFile = async (certId, file) => {
    if (!validateFile(file)) return
    setUploading(true)
    try {
      const fileUrl = await uploadToStorage(user.id, certId, file)
      CertDB.update(certId, { fileUrl, fileName: file.name, fileType: file.type })
      reload()
      success('파일이 저장되었습니다.')
    } catch(e) {
      toastError('파일 업로드 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = certId => {
    setConfirm({ msg: '첨부파일을 삭제할까요?', onOk: () => {
      CertDB.update(certId, { fileUrl: null, fileName: null, fileType: null })
      reload(); success('파일이 삭제되었습니다.')
    }})
  }

  const openPreview = r => {
    if (!r.fileUrl) return
    setPreview({ url: r.fileUrl, type: r.fileType || '', name: r.fileName || '첨부파일' })
  }

  const downloadExcel = () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = [...records]
      .sort((a, b) => (a.issuedAt || '').localeCompare(b.issuedAt || ''))
      .map((r, i) => ({
        'No': i + 1,
        '자격증명': r.name || '',
        '종류': r.certType || '',
        '급수': r.grade || '',
        '발급기관': r.issuer || '',
        '자격번호': r.certNumber || '',
        '민간자격등록번호': r.privateRegNum || '',
        '취득일': r.issuedAt || '',
        '만료일': r.noExpiry ? '영구유효' : (r.expiresAt || ''),
        '상태': r.noExpiry ? '유효' : !r.expiresAt ? '유효' : isExpired(r) ? '만료' : expiringSoon(r) ? '만료임박' : '유효',
        '메모': r.memo || '',
      }))

    const ws = XLSX.utils.json_to_sheet(rows)

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 25 }, // 자격증명
      { wch: 12 }, // 종류
      { wch: 8 },  // 급수
      { wch: 20 }, // 발급기관
      { wch: 18 }, // 자격번호
      { wch: 20 }, // 민간자격등록번호
      { wch: 12 }, // 취득일
      { wch: 12 }, // 만료일
      { wch: 10 }, // 상태
      { wch: 20 }, // 메모
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '보유자격증')
    XLSX.writeFile(wb, `보유자격증_${today}.xlsx`)
    success('다운로드가 완료되었습니다.')
  }

  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🏆 자격증관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>보유 자격증 및 취득 현황 관리</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {[['list','📋 내 자격증'], ['partners','🏛 취득 기관 안내']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:'8px 18px', borderRadius:'9px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'13px', background: tab===t ? C.primary : '#f3f4f6', color: tab===t ? '#fff' : C.muted }}>
              {label}
            </button>
          ))}
          {records.length > 0 && (
            <button onClick={downloadExcel}
              style={{ padding:'8px 18px', borderRadius:'9px', border:'1.5px solid #86efac', background:'#f0fdf4', color:'#15803d', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              📊 목록 받기
            </button>
          )}
        </div>
      </div>

      {/* ── 내 자격증 탭 */}
      {tab === 'list' && (
        <>
          {/* 연도 탭 */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
            {years.map(y => (
              <button key={y} onClick={() => setSelYear(y)}
                style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${selYear===y ? C.primary : C.border}`, background: selYear===y ? '#fff7ed' : '#fff', color: selYear===y ? C.primary : C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                {y === '전체' ? '전체' : `${y}년`}
              </button>
            ))}
          </div>

          {/* 통계 + 추가 버튼 */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
            {records.length > 0 && (
              <>
                {[
                  { label:'총 자격증', value:`${records.length}개`, color:C.primary, bg:'#fff7ed', border:'#fed7aa' },
                  { label:'유효', value:`${records.filter(r => !isExpired(r)).length}개`, color:C.success, bg:'#f0fdf4', border:'#86efac' },
                  { label:'만료임박(90일)', value:`${records.filter(expiringSoon).length}개`, color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
                  { label:'만료', value:`${records.filter(isExpired).length}개`, color:C.danger, bg:'#fef2f2', border:'#fca5a5' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'8px 16px', borderRadius:'10px', background:s.bg, border:`1px solid ${s.border}` }}>
                    <div style={{ fontSize:'17px', fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>{s.label}</div>
                  </div>
                ))}
              </>
            )}
            <button onClick={openAdd} style={{ marginLeft:'auto', padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              + 자격증 추가
            </button>
          </div>

          {/* 목록 */}
          {sorted.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏆</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 자격증이 없습니다</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 자격증 추가 버튼으로 등록하세요</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {sorted.map(r => {
                const expired = isExpired(r)
                const soon    = expiringSoon(r)
                return (
                  <div key={r.id}
                    onClick={() => r.fileUrl && openPreview(r)}
                    onDragOver={e => { e.preventDefault(); setDragOverId(r.id) }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={e => { e.preventDefault(); setDragOverId(null); const f = e.dataTransfer.files[0]; if(f) uploadFile(r.id, f) }}
                    style={{ background: dragOverId===r.id ? '#fff7ed' : C.card, borderRadius:'12px', border: dragOverId===r.id ? `2px dashed ${C.primary}` : `1.5px solid ${expired?'#fca5a5':soon?'#fde68a':C.border}`, padding:'16px 20px', cursor: r.fileUrl ? 'pointer' : 'default', transition:'box-shadow 0.15s, border 0.15s' }}
                    onMouseEnter={e => { if(r.fileUrl && dragOverId!==r.id) e.currentTarget.style.boxShadow='0 2px 12px rgba(249,115,22,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                      <div style={{ flex:1 }}>
                        {/* 자격증명 + 뱃지 */}
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.name}</span>
                          {r.certType && (
                            <span style={{ fontSize:'11px', background: r.certType==='국가자격증'?'#eff6ff':'#f5f3ff', color: r.certType==='국가자격증'?'#1d4ed8':'#7c3aed', border: `1px solid ${r.certType==='국가자격증'?'#bfdbfe':'#ddd6fe'}`, borderRadius:'6px', padding:'1px 8px', fontWeight:600 }}>
                              {r.certType}
                            </span>
                          )}
                          {r.grade && (
                            <span style={{ fontSize:'11px', background:'#fff7ed', color:'#c2410c', border:'1px solid #fed7aa', borderRadius:'6px', padding:'1px 8px', fontWeight:600 }}>
                              {r.grade}
                            </span>
                          )}
                          {expired && <span style={{ fontSize:'11px', background:'#fef2f2', color:C.danger, border:'1px solid #fca5a5', borderRadius:'6px', padding:'1px 8px', fontWeight:700 }}>만료</span>}
                          {soon && !expired && <span style={{ fontSize:'11px', background:'#fffbeb', color:'#b45309', border:'1px solid #fde68a', borderRadius:'6px', padding:'1px 8px', fontWeight:700 }}>만료임박</span>}
                        </div>
                        {/* 상세 정보 */}
                        <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                          {r.issuer     && <span>🏛 {r.issuer}</span>}
                          {r.certNumber && <span>🔢 {r.certNumber}</span>}
                          {r.privateRegNum && <span>📋 민간등록번호: {r.privateRegNum}</span>}
                          {r.issuedAt   && <span>📅 취득: {r.issuedAt}</span>}
                          {r.noExpiry
                            ? <span>♾ 영구유효</span>
                            : r.expiresAt && <span style={{ color: expired?C.danger:soon?'#b45309':C.muted }}>⏰ 만료: {r.expiresAt}</span>
                          }
                          {r.memo && <span>📌 {r.memo}</span>}
                        </div>
                        {/* 첨부파일 표시 */}
                        {r.fileUrl && (
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px' }}>
                            <span style={{ fontSize:'12px', color:'#3b82f6' }}>
                              {r.fileType?.startsWith('image/') ? '🖼' : '📄'} {r.fileName || '첨부파일'}
                            </span>
                            <span style={{ fontSize:'11px', color:C.primary, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'4px', padding:'1px 6px' }}>
                              클릭하여 미리보기
                            </span>
                            <button onClick={e => { e.stopPropagation(); deleteFile(r.id) }}
                              style={{ fontSize:'11px', color:C.danger, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                      {/* 버튼 */}
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
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 취득 기관 안내 탭 */}
      {tab === 'partners' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'4px' }}>자격증을 취득할 수 있는 제휴 기관 및 공식 기관 안내입니다.</div>
          {certPartners.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏛</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 제휴 기관이 없습니다</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>관리자가 제휴처를 등록하면 여기에 표시됩니다</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'12px' }}>
              {certPartners.map((p, i) => {
                const tagColors = { '제휴':'#eff6ff:#bfdbfe:#1d4ed8', '광고':'#fff7ed:#fed7aa:#9a3412', '공식':'#f0fdf4:#86efac:#15803d' }
                const [bg, border, textColor] = (tagColors[p.tag] || '#f3f4f6:#d1d5db:#374151').split(':')
                return (
                  <div key={p.id || i} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${border}`, padding:'18px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'8px' }}>
                      <span style={{ fontSize:'15px', fontWeight:700, color:C.text, flex:1, paddingRight:'8px' }}>{p.name}</span>
                      <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'5px', background:bg, border:`1px solid ${border}`, color:textColor, fontWeight:700, flexShrink:0 }}>{p.tag}</span>
                    </div>
                    {p.desc && <div style={{ fontSize:'12px', color:C.muted, marginBottom:'10px', lineHeight:1.5 }}>{p.desc}</div>}
                    {p.subjects?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'12px' }}>
                        {p.subjects.map((s, si) => (
                          <span key={si} style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, borderRadius:'5px', padding:'2px 8px' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'9px', background:'#f0fdf4', border:'1.5px solid #86efac', color:C.success, fontSize:'13px', fontWeight:700, textDecoration:'none' }}>
                        🔗 바로가기
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 추가/편집 모달 */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? '자격증 편집' : '자격증 추가'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>자격증명 *</label>
                <input value={form.name} onChange={e => setForm(v => ({...v, name:e.target.value}))}
                  placeholder="예: 로봇전문지도사 2급"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>자격증 종류</label>
                  <select value={form.certType} onChange={e => setForm(v => ({...v, certType:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }}>
                    {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>급수</label>
                  <input value={form.grade} onChange={e => setForm(v => ({...v, grade:e.target.value}))}
                    placeholder="예: 1급, 2급"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              {[
                { label:'발급기관', key:'issuer', placeholder:'예: 한국로봇산업협회' },
                { label:'자격번호', key:'certNumber', placeholder:'자격증 번호' },
                { label:'민간자격등록번호', key:'privateRegNum', placeholder:'민간자격 등록번호 (해당 시 입력)' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm(v => ({...v, [f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>취득일</label>
                <input type="date" value={form.issuedAt} onChange={e => setForm(v => ({...v, issuedAt:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>만료일</label>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <input type="date" value={form.expiresAt} onChange={e => setForm(v => ({...v, expiresAt:e.target.value}))}
                    disabled={form.noExpiry}
                    style={{ flex:1, padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', opacity: form.noExpiry ? 0.4 : 1 }} />
                  <label style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:C.muted, cursor:'pointer', whiteSpace:'nowrap' }}>
                    <input type="checkbox" checked={form.noExpiry} onChange={e => setForm(v => ({...v, noExpiry:e.target.checked, expiresAt: e.target.checked ? '' : v.expiresAt}))} />
                    해당없음
                  </label>
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모</label>
                <input value={form.memo} onChange={e => setForm(v => ({...v, memo:e.target.value}))}
                  placeholder="비고"
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
