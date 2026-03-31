import React, { useState, useEffect, useRef } from 'react'
import { uid, now } from '../lib/utils.js'
import { supabase } from '../lib/supabase.js'

const C = {
  primary:'#f97316', success:'#16a34a', danger:'#ef4444',
  border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff',
}

// 관리자 등록 연수기관 불러오기 (없으면 기본값 사용)
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
    const ts = JSON.parse(localStorage.getItem('asa_settings_teacherService') || 'null')
    const adminSites = ts?.trainingSites || []
    // 관리자 등록 기관이 있으면 앞에, 없으면 기본 목록만
    return adminSites.length > 0 ? [...adminSites, ...DEFAULT_TRAINING_SITES] : DEFAULT_TRAINING_SITES
  } catch { return DEFAULT_TRAINING_SITES }
}

const STORAGE_KEY = 'asa_training'

function loadData(teacherId) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  return all.filter(r => r.teacherId === teacherId)
}
function saveItem(item) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  const idx = all.findIndex(r => r.id === item.id)
  if (idx >= 0) all[idx] = item; else all.push(item)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
function deleteItem(id) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(r => r.id !== id)))
}

const EMPTY_FORM = { year: String(new Date().getFullYear()), title:'', provider:'', providerUrl:'', completionNum:'', completedAt:'', hours:'', memo:'' }

export function Training({ user }) {
  const [tab, setTab]       = useState('list')
  const [records, setRecords] = useState([])
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fileMap, setFileMap] = useState({})
  const [trainingSites, setTrainingSites] = useState(() => loadTrainingSites())
  const fileRef = useRef()

  const reload = () => setRecords(loadData(user.id))
  useEffect(() => { reload() }, [])

  const years = [...new Set(records.map(r => r.year))].sort().reverse()
  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)
  const [selYear, setSelYear] = useState(currentYear)
  const filtered = records.filter(r => !selYear || r.year === selYear)
    .sort((a,b) => (b.completedAt||'').localeCompare(a.completedAt||''))

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ year:r.year, title:r.title, provider:r.provider||'', providerUrl:r.providerUrl||'', completionNum:r.completionNum||'', completedAt:r.completedAt||'', hours:String(r.hours||''), memo:r.memo||'' }); setEditId(r.id); setModal(true) }

  const save = () => {
    if (!form.title.trim()) { alert('연수명을 입력하세요'); return }
    const item = { id: editId||uid(), teacherId: user.id, ...form, hours: Number(form.hours)||0, updatedAt: now() }
    if (!editId) item.createdAt = now()
    saveItem(item)
    reload(); setModal(false)
  }

  const uploadFile = async (trainingId, file) => {
    if (!file) return
    setUploading(true)
    try {
      const path = `training/${user.id}/${trainingId}/${file.name}`
      const { error } = await supabase.storage.from('teacher-files').upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from('teacher-files').getPublicUrl(path)
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      const idx = all.findIndex(r => r.id === trainingId)
      if (idx >= 0) { all[idx].fileUrl = data.publicUrl; all[idx].fileName = file.name }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      reload()
    } catch(e) { alert('파일 업로드 실패: ' + e.message) }
    finally { setUploading(false) }
  }

  const totalHours = filtered.reduce((s,r) => s + (r.hours||0), 0)

  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
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
          {/* 통계 + 필터 */}
          <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:'8px' }}>
              {years.map(y => (
                <button key={y} onClick={() => setSelYear(y)}
                  style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${selYear===y?C.primary:C.border}`, background: selYear===y?'#fff7ed':'#fff', color: selYear===y?C.primary:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {y}년
                </button>
              ))}
            </div>
            {totalHours > 0 && (
              <div style={{ marginLeft:'auto', fontSize:'13px', color:C.success, fontWeight:700, background:'#f0fdf4', padding:'6px 14px', borderRadius:'8px', border:'1px solid #86efac' }}>
                ✅ {selYear}년 총 {totalHours}시간 이수
              </div>
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
                <div key={r.id} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'16px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.title}</span>
                        {r.hours > 0 && <span style={{ fontSize:'12px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'6px', padding:'1px 8px', fontWeight:600 }}>{r.hours}시간</span>}
                        {r.completionNum && <span style={{ fontSize:'11px', color:'#1d4ed8', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'6px', padding:'1px 8px' }}>이수번호: {r.completionNum}</span>}
                      </div>
                      <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                        {r.provider && <span>🏛 {r.provider}</span>}
                        {r.completedAt && <span>📅 {r.completedAt}</span>}
                        {r.memo && <span>📌 {r.memo}</span>}
                      </div>
                      {r.fileUrl && (
                        <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display:'inline-flex', alignItems:'center', gap:'4px', marginTop:'8px', fontSize:'12px', color:'#3b82f6', textDecoration:'none' }}>
                          📎 {r.fileName || '첨부파일'} 보기
                        </a>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      <label style={{ padding:'5px 10px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                        📎 파일
                        <input type="file" style={{ display:'none' }} onChange={e => e.target.files[0] && uploadFile(r.id, e.target.files[0])} />
                      </label>
                      <button onClick={() => openEdit(r)} style={{ padding:'5px 10px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                      <button onClick={() => { if(confirm('삭제할까요?')) { deleteItem(r.id); reload() } }} style={{ padding:'5px 10px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>삭제</button>
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
          {trainingSites.map((s, idx) => (
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
                      <span key={c} style={{ fontSize:'11px', background:'#fff7ed', color:'#92400e', border:'1px solid #fde68a', borderRadius:'5px', padding:'2px 8px' }}>
                        {c}
                      </span>
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
        <div onClick={e => { if(e.target===e.currentTarget) setModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>{editId ? '연수 편집' : '연수 추가'}</span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'연수년도', key:'year', placeholder:'2026' },
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
                  <input type={f.type||'text'} value={form[f.key]} onChange={e => setForm(v=>({...v,[f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button onClick={save} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={() => setModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 파일 업로드 중...</div>
        </div>
      )}
    </div>
  )
}
