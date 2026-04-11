import React, { useState, useRef } from 'react'
import { DocumentsDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, PageHeader } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../components/Atoms.jsx'

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
  if (!name) return 'file'
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

// ─── 등록 모달 ───
function AddModal({ cat, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    let fileData = '', fileName = '', fileType = 'file'
    if (file) {
      fileData = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.readAsDataURL(file)
      })
      fileName = file.name
      fileType = getFileType(file.name)
    }
    onSave({ title: title.trim(), fileData, fileName, fileType })
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '28px 28px 24px',
        width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        fontFamily: 'Noto Sans KR, sans-serif',
      }}>
        {/* 모달 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px', borderRadius: '8px',
            background: `${cat.color}12`, border: `1px solid ${cat.color}30`,
            fontSize: '13px', fontWeight: 700, color: cat.color,
          }}>
            <span>{cat.icon}</span><span>{cat.label}</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>서류 등록</span>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        {/* 제목 */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
            제목 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="서류 제목을 입력하세요"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '8px',
              border: `1.5px solid ${title ? cat.color : '#e5e7eb'}`,
              fontSize: '14px', color: '#111827', outline: 'none',
              fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = cat.color}
            onBlur={e => e.target.style.borderColor = title ? cat.color : '#e5e7eb'}
          />
        </div>

        {/* 파일 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
            파일 <span style={{ color: '#9ca3af', fontWeight: 400 }}>(선택)</span>
          </label>
          <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0] || null)} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: '9px 12px',
              border: `1.5px dashed ${file ? cat.color : '#d1d5db'}`,
              borderRadius: '8px',
              background: file ? `${cat.color}08` : '#fafafa',
              cursor: 'pointer', fontSize: '13px',
              color: file ? cat.color : '#9ca3af',
              fontFamily: 'Noto Sans KR, sans-serif',
              textAlign: 'left', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
          >
            {file ? `✅ ${file.name}` : '📁 파일을 선택하세요'}
          </button>
          {file && (
            <button onClick={() => setFile(null)} style={{
              marginTop: '6px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '11px', color: '#9ca3af', padding: 0,
            }}>✕ 파일 제거</button>
          )}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: '8px',
            border: '1.5px solid #e5e7eb', background: '#fff',
            fontSize: '13px', fontWeight: 600, color: '#6b7280',
            cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
          }}>취소</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            style={{
              padding: '9px 22px', borderRadius: '8px',
              border: 'none', background: title.trim() ? cat.color : '#d1d5db',
              fontSize: '13px', fontWeight: 700, color: '#fff',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'Noto Sans KR, sans-serif',
              transition: 'background 0.15s',
            }}
          >
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 서류 칩 ───
function DocChip({ doc, color, onDelete }) {
  const ft = FT[doc.fileType] || FT.file
  const noFile = !doc.fileData

  const handleClick = () => {
    if (noFile) return
    const a = document.createElement('a')
    a.href = doc.fileData; a.download = doc.fileName; a.click()
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '5px 8px 5px 10px',
      background: noFile ? '#fffbeb' : '#f9fafb',
      border: `1px solid ${noFile ? '#fcd34d' : '#e5e7eb'}`,
      borderRadius: '8px', cursor: noFile ? 'default' : 'pointer',
      fontSize: '12px', maxWidth: '220px',
      transition: 'all 0.15s',
    }}
      onClick={handleClick}
      title={noFile ? '파일 없음 (다운로드 불가)' : `${doc.fileName} 다운로드`}
      onMouseEnter={e => { if (!noFile) e.currentTarget.style.background = `${color}10`; if (!noFile) e.currentTarget.style.borderColor = color }}
      onMouseLeave={e => { e.currentTarget.style.background = noFile ? '#fffbeb' : '#f9fafb'; e.currentTarget.style.borderColor = noFile ? '#fcd34d' : '#e5e7eb' }}
    >
      {/* 파일타입 뱃지 */}
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '1px 5px',
        borderRadius: '4px', background: ft.bg, color: ft.color,
        flexShrink: 0,
      }}>{ft.label}</span>

      {/* 제목 */}
      <span style={{
        fontWeight: 600, color: '#374151',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '100px',
      }}>{doc.title}</span>

      {/* 서류첨부 필요 */}
      {noFile && (
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '1px 5px',
          borderRadius: '4px', background: '#fef3c7', color: '#b45309',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>서류첨부 필요</span>
      )}

      {/* 다운로드 아이콘 */}
      {!noFile && (
        <span style={{ fontSize: '11px', flexShrink: 0, opacity: 0.5 }}>⬇️</span>
      )}

      {/* 삭제 */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#d1d5db', fontSize: '13px', padding: '0 0 0 2px',
          lineHeight: 1, flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
        title="삭제"
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
      >×</button>
    </div>
  )
}

// ─── 메인 컴포넌트 ───
export function Templates({ user }) {
  const [docs, setDocs] = useState(() =>
    (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin')
  )
  const [modalCat, setModalCat] = useState(null) // 현재 모달 열린 카테고리
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()

  const reload = () =>
    setDocs((DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin'))

  const handleSave = ({ title, fileData, fileName, fileType }) => {
    DocumentsDB.insert({
      id: uid(), teacherId: user.id,
      category: modalCat.key, title,
      fileName, fileType, fileData, createdAt: now(),
    })
    reload()
    success(`${modalCat.label}이(가) 등록 완료되었습니다.`)
    setModalCat(null)
  }

  const handleDelete = (id) =>
    confirm('이 서류를 삭제하시겠습니까?', () => { DocumentsDB.delete(id); reload() })

  const docsFor = (catKey) => docs.filter(d => d.category === catKey)

  return (
    <div style={{ padding: '28px', maxWidth: '1100px', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <PageHeader
        title="방과후 서류"
        sub="방과후 수업에 필요한 서류를 보관하고 관리합니다."
      />

      <div style={{
        marginBottom: '20px', padding: '12px 16px',
        background: '#eff6ff', border: '1.5px solid #bfdbfe',
        borderRadius: '10px', fontSize: '13px', color: '#1e40af',
      }}>
        📌 학교마다 다른 서류를 여러 개 등록할 수 있습니다. 지원 형식: <strong>HWP · Excel · 이미지 · PDF</strong>
      </div>

      {/* ─── 카테고리 목록 ─── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '12px', overflow: 'hidden',
      }}>
        {CATEGORIES.map((cat, ci) => {
          const catDocs = docsFor(cat.key)
          return (
            <div key={cat.key} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 20px',
              borderBottom: ci < CATEGORIES.length - 1 ? '1px solid #f3f4f6' : 'none',
              minHeight: '56px',
            }}>
              {/* 카테고리 버튼 */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '8px',
                background: `${cat.color}12`, border: `1px solid ${cat.color}30`,
                fontSize: '12px', fontWeight: 700, color: cat.color,
                whiteSpace: 'nowrap', flexShrink: 0, width: '148px',
                justifyContent: 'center',
              }}>
                <span>{cat.icon}</span><span>{cat.label}</span>
              </div>

              {/* + 버튼 */}
              <button
                onClick={() => setModalCat(cat)}
                title="서류 추가"
                style={{
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: `${cat.color}18`,
                  border: `1.5px solid ${cat.color}40`,
                  color: cat.color, fontSize: '18px', fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${cat.color}30` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${cat.color}18` }}
              >+</button>

              {/* 등록된 서류 칩들 */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1,
                alignItems: 'center',
              }}>
                {catDocs.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#d1d5db' }}>
                    + 버튼을 눌러 서류를 등록하세요
                  </span>
                ) : (
                  catDocs.map(doc => (
                    <DocChip
                      key={doc.id}
                      doc={doc}
                      color={cat.color}
                      onDelete={() => handleDelete(doc.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── 등록 모달 ─── */}
      {modalCat && (
        <AddModal
          cat={modalCat}
          onClose={() => setModalCat(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
