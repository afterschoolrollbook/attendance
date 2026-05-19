import React, { useState, useEffect } from 'react'
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs'
import { uid, now } from '../lib/utils.js'
import { Trainings, Settings } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import { ToastContainer, Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const C = {
  primary:'#f97316', success:'#16a34a', danger:'#ef4444',
  border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff',
}

const DEFAULT_TRAINING_SITES = [
  {
    name: '경기도교육청남부연수원',
    url: 'https://www.gtie.go.kr/',
    desc: '경기도 방과후 강사 의무연수',
    courses: ['4대폭력예방교육 (성희롱·성매매·성폭력·가정폭력)', '개인정보 관련 교육'],
  },
  {
    name: '경기도평생학습포털 (GSEEK)',
    url: 'https://www.gseek.kr/',
    desc: '경기도 온라인 평생학습 포털',
    courses: ['공감의온도 가정폭력예방교육', '공감의온도 성폭력예방교육', '공감의온도 성매매예방교육', '성희롱 예방교육'],
  },
  {
    name: '서울교육연수원',
    url: 'https://seti.sen.go.kr/',
    desc: '서울시교육청 연수원',
    courses: ['방과후 강사 직무연수', '교원 역량강화 연수'],
  },
  {
    name: '한국양성평등교육진흥원',
    url: 'https://www.kigepe.or.kr/',
    desc: '성희롱·성폭력 예방교육 전문기관',
    courses: ['성희롱·성폭력 예방교육', '폭력예방통합교육'],
  },
  {
    name: '중앙교육연수원',
    url: 'https://www.neti.go.kr/',
    desc: '국가 교원 원격연수 포털',
    courses: ['아동학대 신고의무자 교육', '학교안전교육의 이해', '긴급복지 지원신고의무 교육'],
  },
  {
    name: '사)대한인명구조협회',
    url: 'https://www.klifeguard.or.kr/',
    desc: '응급처치 및 심폐소생술 교육',
    courses: ['응급처치 교육', '심폐소생술(CPR) 교육'],
  },
  {
    name: '개인정보배움터',
    url: 'https://www.privacy.go.kr/',
    desc: '개인정보보호위원회 교육 포털',
    courses: ['개인정보 보호 기본교육', '개인정보 처리방침 이해'],
  },
]

function loadTrainingSites() {
  try {
    const ts = Settings.get('teacherService')
    const adminSites = ts?.trainingSites || []
    return adminSites.length > 0 ? [...adminSites, ...DEFAULT_TRAINING_SITES] : DEFAULT_TRAINING_SITES
  } catch { return DEFAULT_TRAINING_SITES }
}

// [보안 수정] Storage 업로드: ANON_KEY → 사용자 JWT 사용
// - supabase.storage.upload() 는 내부적으로 세션 토큰을 Authorization 헤더에 자동 포함
// - teacher-files 버킷은 private으로 설정하고, Storage RLS policy로 본인 경로만 허용
// - 파일 경로: training/{userId}/{trainingId}/{timestamp}.{ext}
async function uploadToStorage(userId, trainingId, file) {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.')

  // 허용 MIME 타입 화이트리스트 (서버 측 재검증과 함께 사용)
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error('이미지(JPG·PNG·GIF·WebP) 또는 PDF 파일만 업로드 가능합니다.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('10MB 이하 파일만 업로드 가능합니다.')
  }

  // 확장자는 파일명에서 추출 (MIME 타입이 아닌 원본 파일명 기준)
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
  const filePath = `training/${userId}/${trainingId}/${Date.now()}.${ext}`

  // supabase.storage.upload() — 세션 JWT를 자동으로 Authorization 헤더에 포함
  // Storage RLS: training/{userId}/ 경로는 해당 userId 본인만 업로드 가능
  const { error } = await supabase.storage
    .from('teacher-files')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    })

  if (error) throw new Error(`파일 업로드 실패: ${error.message}`)

  // private 버킷이므로 signed URL 사용 (1시간 유효)
  const { data: signedData, error: signErr } = await supabase.storage
    .from('teacher-files')
    .createSignedUrl(filePath, 60 * 60)

  if (signErr) throw new Error(`URL 생성 실패: ${signErr.message}`)

  // DB에는 filePath 저장 (URL이 아닌 경로) — 조회 시 signed URL 재생성
  return { url: signedData.signedUrl, path: filePath }
}

// 파일 경로로 signed URL 생성 (조회 시 사용)
export async function getSignedUrl(filePath) {
  if (!supabase || !filePath) return null
  // 구버전 호환: http로 시작하면 그대로 반환
  if (filePath.startsWith('http')) return filePath
  const { data, error } = await supabase.storage
    .from('teacher-files')
    .createSignedUrl(filePath, 60 * 60)
  if (error) return null
  return data.signedUrl
}

const EMPTY_FORM = {
  year: String(new Date().getFullYear()),
  title:'', provider:'', providerUrl:'',
  completionNum:'', completedAt:'', hours:'', memo:''
}

export function Training({ user }) {
  const [tab, setTab]             = useState('list')
  const [records, setRecords]     = useState([])
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [editId, setEditId]       = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOverId, setDragOverId] = useState(null)
  const [modalFile, setModalFile] = useState(null)
  const [modalDrag, setModalDrag] = useState(false)
  const [trainingSites]           = useState(() => loadTrainingSites())
  const [preview, setPreview]     = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const { toasts, success, error: toastError, info } = useToast()
  const [confirm, setConfirm]     = useState(null) // { msg, onOk }
  const currentYear               = String(new Date().getFullYear())
  const [selYear, setSelYear]     = useState(currentYear)

  const reload = () => setRecords(Trainings.byTeacher(user.id))
  useEffect(() => { reload() }, [])

  const years   = [...new Set([currentYear, ...records.map(r => r.year)])].sort()
  const filtered = records.filter(r => !selYear || r.year === selYear)
                          .sort((a,b) => (a.completedAt||'').localeCompare(b.completedAt||''))
  const totalHours = filtered.reduce((s,r) => s + (Number(r.hours)||0), 0)

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setModalFile(null); setModal(true) }
  const openEdit = (r) => {
    setForm({
      year: r.year, title: r.title, provider: r.provider||'',
      providerUrl: r.providerUrl||'', completionNum: r.completionNum||'',
      completedAt: r.completedAt||'', hours: String(r.hours||''), memo: r.memo||''
    })
    setEditId(r.id)
    setModalFile(null)
    setModal(true)
  }

  const validateFile = (file) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf']
    if (!allowed.includes(file.type)) { toastError('이미지·PDF 파일만 업로드 가능합니다'); return false }
    if (file.size > 10 * 1024 * 1024) { toastError('10MB 이하 파일만 업로드 가능합니다'); return false }
    return true
  }

  // 저장: db.js Trainings 사용 + 파일 있으면 Storage 업로드
  const save = async () => {
    if (!form.title.trim()) { toastError('연수명을 입력하세요'); return }
    setUploading(true)
    try {
      const itemId = editId || uid()
      let fileUrl = null, fileName = null, fileType = null, filePath = null

      // 파일 먼저 업로드
      if (modalFile) {
        if (!validateFile(modalFile)) { setUploading(false); return }
        const result = await uploadToStorage(user.id, itemId, modalFile)
        fileUrl   = result.path  // DB에는 경로 저장
        fileName  = modalFile.name
        fileType  = modalFile.type
      }

      const item = {
        id: itemId,
        teacherId: user.id,
        ...form,
        hours: Number(form.hours) || 0,
        ...(fileUrl && { fileUrl, fileName, fileType }),
        ...(!editId && { createdAt: now() })
      }

      if (editId) Trainings.update(editId, item)
      else Trainings.insert(item)

      reload()
      success(editId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
      setModal(false)
      setModalFile(null)
      setSelYear(form.year)
    } catch(e) {
      toastError('저장 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteRecord = (id) => {
    setConfirm({ msg:'이 연수 기록을 삭제할까요?', onOk: () => {
      Trainings.delete(id); reload(); success('삭제가 완료되었습니다.')
    }})
  }

  // 기존 기록에 파일 업로드/교체
  const uploadFile = async (trainingId, file) => {
    if (!validateFile(file)) return
    setUploading(true)
    try {
      const result = await uploadToStorage(user.id, trainingId, file)
      Trainings.update(trainingId, { fileUrl: result.path, fileName: file.name, fileType: file.type })
      reload()
      success('파일이 저장되었습니다.')
    } catch(e) {
      toastError('파일 업로드 실패: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = (trainingId) => {
    setConfirm({ msg:'첨부파일을 삭제할까요?', onOk: () => {
      Trainings.update(trainingId, { fileUrl: null, fileName: null, fileType: null })
      reload(); success('삭제가 완료되었습니다.')
    }})
  }

  // [보안 수정] private 버킷이므로 signed URL 먼저 생성 후 미리보기
  const openPreview = async (r) => {
    if (!r.fileUrl) return
    try {
      const url = await getSignedUrl(r.fileUrl)
      if (!url) { toastError('파일 URL을 가져올 수 없습니다.'); return }
      setPreview({ path: r.fileUrl, type: r.fileType || '', name: r.fileName || '첨부파일' })
      setPreviewUrl(url)
    } catch(e) {
      toastError('파일을 열 수 없습니다: ' + e.message)
    }
  }

  const downloadExcel = () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = [...records]
      .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''))
      .map((r, i) => ({
        'No': i + 1,
        '연수년도': r.year || '',
        '연수명': r.title || '',
        '연수기관': r.provider || '',
        '기관홈페이지': r.providerUrl || '',
        '이수번호': r.completionNum || '',
        '이수일': r.completedAt || '',
        '이수시간(h)': r.hours || '',
        '메모': r.memo || '',
      }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 10 }, // 연수년도
      { wch: 30 }, // 연수명
      { wch: 20 }, // 연수기관
      { wch: 25 }, // 기관홈페이지
      { wch: 20 }, // 이수번호
      { wch: 12 }, // 이수일
      { wch: 12 }, // 이수시간
      { wch: 20 }, // 메모
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '연수이수목록')
    XLSX.writeFile(wb, `연수이수목록_${today}.xlsx`)
    success('다운로드가 완료되었습니다.')
  }

  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>📚 연수관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>의무연수 이수 기록 및 서류 관리</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {['list','sites'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:'8px 18px', borderRadius:'9px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'13px', background: tab===t ? C.primary : '#f3f4f6', color: tab===t ? '#fff' : C.muted }}>
              {t==='list' ? '📋 이수 목록' : '🔗 연수 사이트'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' && (
        <>
          {/* 연도 탭 + 통계 + 추가 버튼 */}
          <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {years.map(y => (
                <button key={y} onClick={() => setSelYear(y)}
                  style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${selYear===y ? C.primary : C.border}`, background: selYear===y ? '#fff7ed' : '#fff', color: selYear===y ? C.primary : C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {y}년
                </button>
              ))}
            </div>
            {totalHours > 0 && (
              <div style={{ marginLeft:'auto', fontSize:'13px', color:C.success, fontWeight:700, background:'#f0fdf4', padding:'6px 14px', borderRadius:'8px', border:'1px solid #86efac' }}>
                ✅ {selYear}년 총 {totalHours}시간 이수
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
              + 이수 추가
            </button>
          </div>

          {/* 목록 */}
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>📚</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>이수 기록이 없습니다</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 이수 추가 버튼을 눌러 기록하세요</div>
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
                        {r.hours > 0 && <span style={{ fontSize:'12px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'6px', padding:'1px 8px', fontWeight:600 }}>{r.hours}시간</span>}
                        {r.completionNum && <span style={{ fontSize:'11px', color:'#1d4ed8', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'6px', padding:'1px 8px' }}>이수번호: {r.completionNum}</span>}
                      </div>
                      <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                        {r.provider    && <span>🏛 {r.provider}</span>}
                        {r.completedAt && <span>📅 {r.completedAt}</span>}
                        {r.memo        && <span>📌 {r.memo}</span>}
                      </div>
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
        </>
      )}

      {tab === 'sites' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'4px' }}>방과후 강사 의무연수를 받을 수 있는 공인 연수 기관 목록입니다.</div>
          {trainingSites.map((s) => (
            <div key={s.id || s.name} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${s.id ? '#fed7aa' : C.border}`, padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                    <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{s.name}</div>
                    {s.id && <span style={{ fontSize:'10px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'4px', padding:'1px 6px', fontWeight:700 }}>관리자 등록</span>}
                  </div>
                  <div style={{ fontSize:'12px', color:C.muted, marginBottom:'8px' }}>{s.desc}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                    {(s.courses || []).map(c => (
                      <span key={c} style={{ fontSize:'11px', background:'#fff7ed', color:'#92400e', border:'1px solid #fde68a', borderRadius:'5px', padding:'2px 8px' }}>{c}</span>
                    ))}
                  </div>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'8px 18px', borderRadius:'9px', background:'#f0fdf4', border:'1.5px solid #86efac', color:C.success, fontSize:'13px', fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                    🔗 바로가기
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/편집 모달 */}
      {modal && (
        <Modal onClose={() => setModal(false)} title={editId ? '연수 편집' : '연수 추가'}>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'연수년도', key:'year', placeholder:'예: 2025', type:'number' },
                { label:'연수명 *', key:'title', placeholder:'예: 인공지능 기초 직무연수' },
                { label:'연수기관', key:'provider', placeholder:'예: 한국교원연수원' },
                { label:'기관 홈페이지', key:'providerUrl', placeholder:'https://' },
                { label:'이수번호', key:'completionNum', placeholder:'이수확인번호' },
                { label:'이수일', key:'completedAt', placeholder:'2026-03-15', type:'date' },
                { label:'이수시간', key:'hours', placeholder:'15', type:'number' },
                { label:'메모', key:'memo', placeholder:'비고' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input type={f.type||'text'} value={form[f.key]}
                    onChange={e => setForm(v=>({...v,[f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}

              {/* 파일 첨부 */}
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
      )}

      {/* 미리보기 모달 */}
      {preview && previewUrl && (
        <Modal onClose={() => { setPreview(null); setPreviewUrl(null) }} title={`${preview.type?.startsWith('image/') ? '🖼' : '📄'} ${preview.name}`}>
          <div style={{ display:'flex', justifyContent:'flex-end', padding:'8px 16px 0' }}>
            <a href={previewUrl} download={preview.name} target="_blank" rel="noopener noreferrer"
              style={{ padding:'6px 14px', borderRadius:'8px', background:'#f0fdf4', border:'1.5px solid #86efac', color:C.success, fontSize:'12px', fontWeight:700, textDecoration:'none' }}>
              ⬇ 다운로드
            </a>
          </div>
          <div style={{ overflow:'auto', flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb', padding:'16px' }}>
            {preview.type?.startsWith('image/') ? (
              <img src={previewUrl} alt={preview.name}
                style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:'8px', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', objectFit:'contain' }} />
            ) : preview.type === 'application/pdf' ? (
              <iframe src={previewUrl} title={preview.name}
                style={{ width:'100%', height:'600px', border:'none', borderRadius:'8px' }} />
            ) : (
              <div style={{ textAlign:'center', color:C.muted }}>
                <div style={{ fontSize:'40px', marginBottom:'12px' }}>📄</div>
                <div style={{ fontSize:'14px' }}>미리보기를 지원하지 않는 파일 형식입니다</div>
                <a href={previewUrl} download={preview.name}
                  style={{ display:'inline-block', marginTop:'12px', color:C.primary, fontSize:'13px' }}>다운로드하여 확인하기</a>
              </div>
            )}
          </div>
        </Modal>
      )}

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

      <ToastContainer toasts={toasts} />

      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}
    </div>
  )
}
