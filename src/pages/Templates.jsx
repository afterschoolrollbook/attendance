import React, { useState, useRef } from 'react'
import { DocumentsDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, Card, Input, Modal, PageHeader, Tag, EmptyState } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../components/Atoms.jsx'

// ─────────────────────────────────────────
// 서류 카테고리 정의
// ─────────────────────────────────────────
const CATEGORIES = [
  { key: 'notice',       label: '안내장',             icon: '📢', color: '#f97316', bg: '#fff7ed', desc: '수업 안내, 가정통신문 등' },
  { key: 'attendance',   label: '출석부',             icon: '✅', color: '#16a34a', bg: '#f0fdf4', desc: '출석 확인용 서류' },
  { key: 'annual_plan',  label: '연간지도안',          icon: '📅', color: '#2563eb', bg: '#eff6ff', desc: '연간 수업 계획서' },
  { key: 'daily_plan',   label: '차시별(일일)지도안',  icon: '📝', color: '#7c3aed', bg: '#f5f3ff', desc: '차시·일일 수업 계획서' },
  { key: 'promo',        label: '홍보물',              icon: '🎨', color: '#db2777', bg: '#fdf2f8', desc: '수업 홍보 포스터, 전단 등' },
  { key: 'tuition_bank', label: '수강료 통장사본',     icon: '🏦', color: '#0891b2', bg: '#ecfeff', desc: '수강료 입금 계좌 서류' },
  { key: 'material_bank',label: '재료비 통장사본',     icon: '💳', color: '#0d9488', bg: '#f0fdfa', desc: '재료비 입금 계좌 서류' },
  { key: 'business_reg', label: '재료비 사업자 사본',  icon: '📋', color: '#b45309', bg: '#fffbeb', desc: '재료비 관련 사업자등록증' },
  { key: 'medical',      label: '공무원 채용신체검사서',icon: '🏥', color: '#dc2626', bg: '#fef2f2', desc: '채용 신체검사 결과서' },
  { key: 'drug_test',    label: '마약검사서',          icon: '🔬', color: '#9333ea', bg: '#faf5ff', desc: '마약 음성 확인서' },
  { key: 'tb_test',      label: '결핵검사서',          icon: '💊', color: '#065f46', bg: '#ecfdf5', desc: '결핵 음성 확인서' },
]

const ACCEPT_TYPES = '.hwp,.hwpx,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.pdf'

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['hwp', 'hwpx'].includes(ext)) return 'hwp'
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

const FILE_TYPE_META = {
  hwp:   { label: 'HWP',   color: '#1d4ed8', bg: '#dbeafe' },
  excel: { label: 'Excel', color: '#15803d', bg: '#dcfce7' },
  image: { label: '이미지', color: '#b45309', bg: '#fef3c7' },
  pdf:   { label: 'PDF',   color: '#dc2626', bg: '#fee2e2' },
  file:  { label: 'FILE',  color: '#6b7280', bg: '#f3f4f6' },
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function Templates({ user }) {
  const [docs, setDocs] = useState(() =>
    (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin')
  )
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null) // 업로드 대상 카테고리
  const [viewCategory, setViewCategory] = useState(null)         // 펼쳐진 카테고리
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState([])  // 다중 파일 선택
  const fileRef = useRef()
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()

  const reload = () =>
    setDocs((DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin'))

  const docsFor = (catKey) => docs.filter(d => d.category === catKey)

  // 파일 선택
  const handleFiles = (e) => {
    const selected = Array.from(e.target.files)
    setFiles(selected)
  }

  // 업로드 모달 열기
  const openUpload = (catKey) => {
    setSelectedCategory(catKey)
    setTitle('')
    setNote('')
    setFiles([])
    setShowModal(true)
  }

  // 저장
  const save = async () => {
    if (!title.trim()) {
      toastError('제목을 입력하세요.')
      return
    }
    if (!files.length) {
      toastError('파일을 선택하세요.')
      return
    }
    for (const f of files) {
      const fileData = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.readAsDataURL(f)
      })
      DocumentsDB.insert({
        id: uid(),
        teacherId: user.id,
        category: selectedCategory,
        title: title.trim(),
        fileName: f.name,
        fileType: getFileType(f.name),
        fileData,
        note: note.trim(),
        createdAt: now(),
      })
    }
    reload()
    setShowModal(false)
    success(`${files.length}개 파일이 등록되었습니다.`)
  }

  // 다운로드
  const download = (doc) => {
    if (!doc.fileData) return
    const a = document.createElement('a')
    a.href = doc.fileData
    a.download = doc.fileName
    a.click()
  }

  // 삭제
  const del = (id) => {
    confirm('이 파일을 삭제하시겠습니까?', () => {
      DocumentsDB.delete(id)
      reload()
    })
  }

  const toggleView = (catKey) =>
    setViewCategory(v => (v === catKey ? null : catKey))

  const cat = CATEGORIES.find(c => c.key === selectedCategory)

  return (
    <div style={{ padding: '28px', maxWidth: '960px' }}>
      <PageHeader
        title="방과후 서류"
        sub="방과후 수업에 필요한 서류를 종류별로 보관하고 관리합니다."
      />

      {/* 안내 배너 */}
      <div style={{
        marginBottom: '24px', padding: '14px 18px',
        background: '#eff6ff', border: '1.5px solid #bfdbfe',
        borderRadius: '10px', fontSize: '13px', color: '#1e40af', lineHeight: 1.7,
      }}>
        📌 서류를 카테고리별로 업로드해두면 출석부 출력, 지도안 작성 등 다른 기능과 자동으로 연동됩니다.
        지원 형식: <strong>.hwp / .hwpx / .xlsx / .xls / .jpg / .png / .gif / .pdf</strong>
      </div>

      {/* 카테고리 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '14px',
      }}>
        {CATEGORIES.map(cat => {
          const catDocs = docsFor(cat.key)
          const isOpen = viewCategory === cat.key

          return (
            <div key={cat.key} style={{
              background: '#fff',
              border: `1.5px solid ${isOpen ? cat.color : '#e5e7eb'}`,
              borderRadius: '12px',
              overflow: 'hidden',
              transition: 'border-color .2s',
              boxShadow: isOpen ? `0 0 0 3px ${cat.color}18` : '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              {/* 카드 헤더 */}
              <div
                onClick={() => toggleView(cat.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  background: isOpen ? `${cat.color}08` : '#fff',
                  transition: 'background .2s',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: cat.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', flexShrink: 0,
                }}>
                  {cat.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{cat.label}</span>
                    {catDocs.length > 0 && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700,
                        padding: '1px 7px', borderRadius: '999px',
                        background: cat.color, color: '#fff',
                      }}>{catDocs.length}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{cat.desc}</div>
                </div>
                <span style={{ fontSize: '18px', color: '#d1d5db', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                  ▾
                </span>
              </div>

              {/* 파일 목록 (펼쳐졌을 때) */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${cat.color}22`, padding: '12px 16px' }}>
                  {catDocs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: '13px' }}>
                      등록된 파일이 없습니다
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {catDocs.map(doc => {
                        const ftMeta = FILE_TYPE_META[doc.fileType] || FILE_TYPE_META.file
                        return (
                          <div key={doc.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px', background: '#f9fafb',
                            borderRadius: '8px', border: '1px solid #f3f4f6',
                          }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 700,
                              padding: '2px 6px', borderRadius: '4px',
                              background: ftMeta.bg, color: ftMeta.color,
                              flexShrink: 0,
                            }}>{ftMeta.label}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: '13px', color: '#111827', fontWeight: 600,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{doc.title || doc.fileName}</div>
                              <div style={{
                                fontSize: '11px', color: '#9ca3af',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>📎 {doc.fileName}</div>
                              {doc.note && (
                                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{doc.note}</div>
                              )}
                              <div style={{ fontSize: '11px', color: '#d1d5db' }}>
                                {doc.createdAt?.slice(0, 10)}
                              </div>
                            </div>
                            <button
                              onClick={() => download(doc)}
                              title="다운로드"
                              style={{
                                background: '#eff6ff', border: 'none', borderRadius: '6px',
                                padding: '5px 8px', cursor: 'pointer', fontSize: '14px',
                                flexShrink: 0,
                              }}>⬇️</button>
                            <button
                              onClick={() => del(doc.id)}
                              title="삭제"
                              style={{
                                background: '#fef2f2', border: 'none', borderRadius: '6px',
                                padding: '5px 8px', cursor: 'pointer', fontSize: '14px',
                                flexShrink: 0,
                              }}>🗑️</button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 업로드 버튼 */}
                  <button
                    onClick={() => openUpload(cat.key)}
                    style={{
                      width: '100%', padding: '9px',
                      background: `${cat.color}12`,
                      border: `1.5px dashed ${cat.color}66`,
                      borderRadius: '8px', cursor: 'pointer',
                      color: cat.color, fontWeight: 600, fontSize: '13px',
                      fontFamily: 'Noto Sans KR, sans-serif',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${cat.color}22`}
                    onMouseLeave={e => e.currentTarget.style.background = `${cat.color}12`}
                  >
                    + 파일 업로드
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 업로드 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`${cat?.icon || ''} ${cat?.label || ''} 파일 등록`} width={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="제목"
            value={title}
            onChange={v => setTitle(v)}
            placeholder="예) 2026년 1학기 판교초 출석부"
            required
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>
              파일 선택 <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <div style={{
              border: '2px dashed #d1d5db', borderRadius: '10px', padding: '20px',
              textAlign: 'center', cursor: 'pointer', background: '#fafafa',
              transition: 'border-color .15s',
            }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}
            >
              {files.length > 0 ? (
                <div>
                  {files.map((f, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                      📎 {f.name}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>클릭하여 파일 선택 (다중 선택 가능)</div>
                  <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>
                    HWP · Excel · 이미지 · PDF
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_TYPES}
              multiple
              onChange={handleFiles}
              style={{ display: 'none' }}
            />
          </div>

          <Input
            label="메모 (선택)"
            value={note}
            onChange={v => setNote(v)}
            placeholder="예) 2026년 1학기 판교초"
          />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn onClick={save}>등록</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
