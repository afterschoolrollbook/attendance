import React, { useState, useRef } from 'react'
import { DocumentsDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, Modal, PageHeader } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../components/Atoms.jsx'

// ─── 카테고리 정의 ────────────────────────────────────────────
const CATEGORIES = [
  { key: 'notice',        label: '안내장',              icon: '📢', color: '#f97316' },
  { key: 'attendance',    label: '출석부',              icon: '✅', color: '#16a34a' },
  { key: 'annual_plan',   label: '연간지도안',           icon: '📅', color: '#2563eb' },
  { key: 'daily_plan',    label: '차시별(일일)지도안',   icon: '📝', color: '#7c3aed' },
  { key: 'promo',         label: '홍보물',              icon: '🎨', color: '#db2777' },
  { key: 'tuition_bank',  label: '수강료 통장사본',      icon: '🏦', color: '#0891b2' },
  { key: 'material_bank', label: '재료비 통장사본',      icon: '💳', color: '#0d9488' },
  { key: 'business_reg',  label: '재료비 사업자 사본',   icon: '📋', color: '#b45309' },
  { key: 'medical',       label: '공무원 채용신체검사서', icon: '🏥', color: '#dc2626' },
  { key: 'drug_test',     label: '마약검사서',           icon: '🔬', color: '#9333ea' },
  { key: 'tb_test',       label: '결핵검사서',           icon: '💊', color: '#065f46' },
]

const ACCEPT = '.hwp,.hwpx,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.pdf'

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['hwp','hwpx'].includes(ext)) return 'hwp'
  if (['xlsx','xls'].includes(ext)) return 'excel'
  if (['jpg','jpeg','png','gif'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

const FT = {
  hwp:   { label:'HWP',   color:'#1d4ed8', bg:'#dbeafe' },
  excel: { label:'Excel', color:'#15803d', bg:'#dcfce7' },
  image: { label:'이미지', color:'#b45309', bg:'#fef3c7' },
  pdf:   { label:'PDF',   color:'#dc2626', bg:'#fee2e2' },
  file:  { label:'FILE',  color:'#6b7280', bg:'#f3f4f6' },
}

const emptySlot = () => ({ id: uid(), category: '', title: '', file: null })

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export function Templates({ user }) {
  const [docs, setDocs] = useState(() =>
    (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin')
  )
  const [showModal, setShowModal] = useState(false)
  const [slots, setSlots] = useState([emptySlot()])
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()
  const fileRefs = useRef({})

  const reload = () =>
    setDocs((DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin'))

  // ─ 슬롯 조작
  const addSlot    = () => { if (slots.length < 10) setSlots(s => [...s, emptySlot()]) }
  const removeSlot = (id) => setSlots(s => s.filter(sl => sl.id !== id))
  const patchSlot  = (id, patch) => setSlots(s => s.map(sl => sl.id === id ? { ...sl, ...patch } : sl))

  const openModal = () => { setSlots([emptySlot()]); setShowModal(true) }

  // ─ 저장
  const save = async () => {
    const filled = slots.filter(sl => sl.category || sl.title || sl.file)
    if (!filled.length) { toastError('최소 1개를 입력하세요.'); return }
    const bad = filled.find(sl => !sl.category || !sl.title.trim() || !sl.file)
    if (bad) { toastError('분류·제목·파일을 모두 입력해주세요.'); return }

    for (const sl of filled) {
      const fileData = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.readAsDataURL(sl.file)
      })
      DocumentsDB.insert({
        id: uid(), teacherId: user.id,
        category: sl.category, title: sl.title.trim(),
        fileName: sl.file.name, fileType: getFileType(sl.file.name),
        fileData, createdAt: now(),
      })
    }
    reload()
    setShowModal(false)
    success(`${filled.length}개 서류가 등록되었습니다.`)
  }

  // ─ 다운로드 / 삭제
  const download = (doc) => {
    if (!doc.fileData) return
    const a = document.createElement('a')
    a.href = doc.fileData; a.download = doc.fileName; a.click()
  }
  const del = (id) => confirm('이 서류를 삭제하시겠습니까?', () => { DocumentsDB.delete(id); reload() })

  // 카테고리 순서대로 정렬된 전체 행
  const rows = CATEGORIES.flatMap(cat =>
    docs.filter(d => d.category === cat.key).map((doc, idx) => ({ doc, cat, idx }))
  )

  return (
    <div style={{ padding: '28px', maxWidth: '1000px' }}>
      <PageHeader
        title="방과후 서류"
        sub="방과후 수업에 필요한 서류를 보관하고 관리합니다."
        right={<Btn onClick={openModal}>+ 서류 등록</Btn>}
      />

      {/* 안내 */}
      <div style={{
        marginBottom: '20px', padding: '12px 16px',
        background: '#eff6ff', border: '1.5px solid #bfdbfe',
        borderRadius: '10px', fontSize: '13px', color: '#1e40af',
      }}>
        📌 학교마다 다른 서류를 여러 개 등록할 수 있습니다. 지원 형식: <strong>HWP · Excel · 이미지 · PDF</strong>
      </div>

      {/* 서류 테이블 */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '150px 1fr 70px 150px 90px 72px',
          padding: '10px 16px', background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '12px', fontWeight: 700, color: '#6b7280',
        }}>
          <span>분류</span><span>제목</span><span>형식</span>
          <span>파일명</span><span>등록일</span>
          <span style={{ textAlign: 'center' }}>관리</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontSize: '14px' }}>등록된 서류가 없습니다</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>우측 상단 <strong>서류 등록</strong> 버튼으로 추가하세요</div>
          </div>
        ) : rows.map(({ doc, cat, idx }) => {
          const ft = FT[doc.fileType] || FT.file
          return (
            <div key={doc.id} style={{
              display: 'grid', gridTemplateColumns: '150px 1fr 70px 150px 90px 72px',
              padding: '10px 16px', alignItems: 'center',
              borderBottom: '1px solid #f3f4f6',
              background: idx === 0 ? '#fff' : '#fafafa',
              fontSize: '13px',
            }}>
              {/* 분류 — 첫 번째만 라벨 표시, 이후엔 들여쓰기 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {idx === 0 ? (
                  <>
                    <span style={{ fontSize: '15px' }}>{cat.icon}</span>
                    <span style={{ fontWeight: 700, color: cat.color, fontSize: '12px' }}>{cat.label}</span>
                  </>
                ) : (
                  <span style={{ color: '#d1d5db', paddingLeft: '24px', fontSize: '12px' }}>↳</span>
                )}
              </div>

              {/* 제목 */}
              <div style={{ fontWeight: 500, color: '#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {doc.title}
              </div>

              {/* 형식 */}
              <div>
                <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 6px', borderRadius:'4px', background:ft.bg, color:ft.color }}>
                  {ft.label}
                </span>
              </div>

              {/* 파일명 */}
              <div style={{ color:'#9ca3af', fontSize:'12px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {doc.fileName}
              </div>

              {/* 등록일 */}
              <div style={{ color:'#9ca3af', fontSize:'12px' }}>{doc.createdAt?.slice(0,10)}</div>

              {/* 버튼 */}
              <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
                <button onClick={() => download(doc)} title="다운로드"
                  style={{ background:'#eff6ff', border:'none', borderRadius:'6px', padding:'4px 7px', cursor:'pointer', fontSize:'13px' }}>⬇️</button>
                <button onClick={() => del(doc.id)} title="삭제"
                  style={{ background:'#fef2f2', border:'none', borderRadius:'6px', padding:'4px 7px', cursor:'pointer', fontSize:'13px' }}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── 등록 모달 ─── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="📂 서류 등록" width={660}>
        <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>

          {/* 컬럼 헤더 */}
          <div style={{
            display:'grid', gridTemplateColumns:'170px 1fr 180px 28px',
            gap:'8px', paddingBottom:'8px',
            fontSize:'12px', fontWeight:700, color:'#6b7280',
          }}>
            <span>분류 <span style={{ color:'#dc2626' }}>*</span></span>
            <span>제목 <span style={{ color:'#dc2626' }}>*</span></span>
            <span>파일 <span style={{ color:'#dc2626' }}>*</span></span>
            <span />
          </div>

          {/* 슬롯 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'400px', overflowY:'auto' }}>
            {slots.map((sl) => (
              <div key={sl.id} style={{ display:'grid', gridTemplateColumns:'170px 1fr 180px 28px', gap:'8px', alignItems:'center' }}>

                {/* 분류 select */}
                <select
                  value={sl.category}
                  onChange={e => patchSlot(sl.id, { category: e.target.value })}
                  style={{
                    padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb',
                    fontSize:'13px', color: sl.category ? '#111827' : '#9ca3af',
                    background:'#fff', fontFamily:'Noto Sans KR, sans-serif', cursor:'pointer',
                  }}
                >
                  <option value="">분류 선택</option>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>

                {/* 제목 */}
                <input
                  value={sl.title}
                  onChange={e => patchSlot(sl.id, { title: e.target.value })}
                  placeholder="예) 2026년 1학기 판교초"
                  style={{
                    padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb',
                    fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif',
                    color:'#111827', outline:'none',
                  }}
                />

                {/* 파일 선택 */}
                <>
                  <input
                    ref={el => fileRefs.current[sl.id] = el}
                    type="file" accept={ACCEPT} style={{ display:'none' }}
                    onChange={e => patchSlot(sl.id, { file: e.target.files[0] || null })}
                  />
                  <button
                    onClick={() => fileRefs.current[sl.id]?.click()}
                    style={{
                      width:'100%', padding:'8px 10px',
                      border:`1.5px dashed ${sl.file ? '#16a34a' : '#d1d5db'}`,
                      borderRadius:'8px',
                      background: sl.file ? '#f0fdf4' : '#fafafa',
                      cursor:'pointer', fontSize:'12px',
                      color: sl.file ? '#15803d' : '#9ca3af',
                      fontFamily:'Noto Sans KR, sans-serif',
                      textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}
                  >
                    {sl.file ? `✅ ${sl.file.name}` : '📁 파일 선택'}
                  </button>
                </>

                {/* 행 삭제 */}
                {slots.length > 1
                  ? <button onClick={() => removeSlot(sl.id)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db', fontSize:'16px', padding:0, lineHeight:1 }}>✕</button>
                  : <div />
                }
              </div>
            ))}
          </div>

          {/* + 추가 버튼 */}
          {slots.length < 10 && (
            <button onClick={addSlot} style={{
              marginTop:'10px', width:'100%', padding:'9px',
              border:'1.5px dashed #d1d5db', borderRadius:'8px',
              background:'#fafafa', cursor:'pointer',
              color:'#9ca3af', fontSize:'13px',
              fontFamily:'Noto Sans KR, sans-serif',
              transition:'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#f97316'; e.currentTarget.style.color='#f97316' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#d1d5db'; e.currentTarget.style.color='#9ca3af' }}
            >
              + 행 추가 ({slots.length} / 10)
            </button>
          )}

          {/* 저장 */}
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #f3f4f6' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn onClick={save}>등록</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
