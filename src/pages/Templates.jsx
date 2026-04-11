import React, { useState, useRef } from 'react'
import { DocumentsDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, PageHeader } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../components/Atoms.jsx'

const DOC_TYPES = {
  keep:         { label: '보관',          color: '#2563eb', bg: '#dbeafe' },
  form:         { label: '양식',          color: '#7c3aed', bg: '#ede9fe' },
  form_submit:  { label: '양식작성 후 제출', color: '#ea580c', bg: '#ffedd5' },
  submit:       { label: '제출',          color: '#16a34a', bg: '#dcfce7' },
  submit_mat:   { label: '재료비 관련 제출', color: '#0d9488', bg: '#ccfbf1' },
}

const CATEGORIES = [
  { key: 'notice',        label: '안내장',              icon: '📢', color: '#f97316', type: 'keep' },
  { key: 'attendance',    label: '출석부',              icon: '✅', color: '#16a34a', type: 'form_submit' },
  { key: 'annual_plan',   label: '연간지도안',           icon: '📅', color: '#2563eb', type: 'form_submit' },
  { key: 'daily_plan',    label: '차시별(일일)지도안',   icon: '📝', color: '#7c3aed', type: 'form_submit' },
  { key: 'collect',       label: '수납요구',             icon: '💰', color: '#0891b2', type: 'form_submit' },
  { key: 'safety',        label: '안전관리대장',          icon: '🦺', color: '#059669', type: 'form_submit' },
  { key: 'refund',        label: '환불자 명단',           icon: '📃', color: '#6366f1', type: 'form_submit' },
  { key: 'promo',         label: '홍보물',              icon: '🎨', color: '#db2777', type: 'submit' },
  { key: 'tuition_bank',  label: '수강료 통장사본',      icon: '🏦', color: '#0891b2', type: 'submit' },
  { key: 'medical',       label: '공무원 채용신체검사서', icon: '🏥', color: '#dc2626', type: 'submit' },
  { key: 'drug_test',     label: '마약검사서',           icon: '🔬', color: '#9333ea', type: 'submit' },
  { key: 'tb_test',       label: '결핵검사서',           icon: '💊', color: '#065f46', type: 'submit' },
  { key: 'material_bank', label: '재료비 통장사본',      icon: '💳', color: '#0d9488', type: 'submit_mat' },
  { key: 'business_reg',  label: '재료비 사업자 사본',   icon: '📋', color: '#b45309', type: 'submit_mat' },
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

const DAYS     = ['해당없음', '월', '화', '수', '목', '금', '토', '일']
const PERIODS1 = ['해당없음', '1학기', '2학기', '1분기', '2분기', '3분기', '4분기']
const PERIODS2 = ['해당없음', '1텀', '2텀', '3텀', '4텀', '5텀', '6텀', '7텀', '8텀', '9텀', '10텀']

// 제목 자동 조합: 선택된 항목만 + 카테고리명
function buildTitle(day, school, subject, period1, period2, catLabel) {
  const parts = []
  if (day && day !== '해당없음') parts.push(day)
  if (school.trim()) parts.push(school.trim())
  if (subject.trim()) parts.push(subject.trim())
  if (period1 && period1 !== '해당없음') parts.push(period1)
  if (period2 && period2 !== '해당없음') parts.push(period2)
  parts.push(catLabel)
  return parts.join(' ')
}

const dropStyle = (color) => ({
  padding: '9px 12px', borderRadius: '8px',
  border: '1.5px solid #e5e7eb', fontSize: '13px',
  color: '#111827', outline: 'none', cursor: 'pointer',
  fontFamily: 'Noto Sans KR, sans-serif', background: '#fff',
  boxSizing: 'border-box', width: '100%',
  appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  paddingRight: '28px',
})

// ─── 등록 모달 ───
function AddModal({ cat, onClose, onSave }) {
  const [day, setDay]         = useState('해당없음')
  const [school, setSchool]   = useState('')
  const [subject, setSubject] = useState('')
  const [period1, setPeriod1] = useState('해당없음')
  const [period2, setPeriod2] = useState('해당없음')
  const [docType, setDocType] = useState('')
  const [file, setFile]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const fileRef = useRef()

  const autoTitle = buildTitle(day, school, subject, period1, period2, cat.label)

  const handleSave = async () => {
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
    onSave({ title: autoTitle, fileData, fileName, fileType })
    setSaving(false)
  }

  const fieldLabel = (text, optional) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
      {text} {optional && <span style={{ color: '#9ca3af', fontWeight: 400 }}>(선택)</span>}
    </label>
  )

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
        {/* 헤더 */}
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

        {/* 요일 + 기간1 + 기간2 나란히 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            {fieldLabel('요일', true)}
            <select value={day} onChange={e => setDay(e.target.value)} style={dropStyle(cat.color)}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            {fieldLabel('기간1', true)}
            <select value={period1} onChange={e => setPeriod1(e.target.value)} style={dropStyle(cat.color)}>
              {PERIODS1.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            {fieldLabel('기간2', true)}
            <select value={period2} onChange={e => setPeriod2(e.target.value)} style={dropStyle(cat.color)}>
              {PERIODS2.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* 학교명 + 과목명 나란히 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            {fieldLabel('학교명', true)}
            <input
              autoFocus
              value={school}
              onChange={e => setSchool(e.target.value)}
              placeholder="예) 대한초"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1.5px solid #e5e7eb', fontSize: '13px',
                color: '#111827', outline: 'none',
                fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = cat.color}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div>
            {fieldLabel('과목명', true)}
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="예) 로봇"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: '1.5px solid #e5e7eb', fontSize: '13px',
                color: '#111827', outline: 'none',
                fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = cat.color}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        {/* 자동 생성 제목 미리보기 */}
        <div style={{
          marginBottom: '16px', padding: '10px 14px',
          background: `${cat.color}08`, border: `1.5px solid ${cat.color}30`,
          borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '11px', color: cat.color, fontWeight: 700, flexShrink: 0 }}>제목 미리보기</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{autoTitle}</span>
        </div>

        {/* 파일 */}
        <div style={{ marginBottom: '24px' }}>
          {fieldLabel('파일', true)}
          <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0] || null)} />
          <button onClick={() => fileRef.current?.click()} style={{
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
          }}>
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
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 22px', borderRadius: '8px',
            border: 'none', background: cat.color,
            fontSize: '13px', fontWeight: 700, color: '#fff',
            cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
          }}>
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 미리보기 모달 ───
function PreviewModal({ doc, color, onClose, onAttach }) {
  const noFile  = !doc.fileData
  const isImage = doc.fileType === 'image'
  const isPdf   = doc.fileType === 'pdf'
  const [newFile, setNewFile] = useState(null)
  const [attaching, setAttaching] = useState(false)
  const fileRef = useRef()
  const { error: toastError, success } = useToast()

  const handleDownload = () => {
    if (noFile) { toastError('첨부된 파일이 없습니다.'); return }
    const a = document.createElement('a')
    a.href = doc.fileData; a.download = doc.fileName; a.click()
  }

  const handleAttach = async () => {
    if (!newFile) return
    setAttaching(true)
    const fileData = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.readAsDataURL(newFile)
    })
    onAttach({ fileData, fileName: newFile.name, fileType: getFileType(newFile.name) })
    success('파일이 첨부되었습니다.')
    setAttaching(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '24px',
        width: '520px', maxWidth: '92vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        fontFamily: 'Noto Sans KR, sans-serif',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827', flex: 1 }}>{doc.title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: '22px', lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        {/* 파일명 */}
        {doc.fileName && !noFile && (
          <div style={{ fontSize: '12px', color: '#6b7280', background: '#f9fafb', padding: '8px 12px', borderRadius: '8px' }}>
            📎 {doc.fileName}
          </div>
        )}

        {/* 미리보기 영역 */}
        <div style={{
          borderRadius: '10px', overflow: 'hidden',
          border: '1px solid #e5e7eb', minHeight: '200px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f9fafb',
        }}>
          {noFile ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#b45309' }}>서류 파일이 첨부되지 않았습니다</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>아래에서 파일을 첨부해주세요</div>
            </div>
          ) : isImage ? (
            <img src={doc.fileData} alt={doc.title}
              style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block' }} />
          ) : isPdf ? (
            <iframe src={doc.fileData} title={doc.title}
              style={{ width: '100%', height: '380px', border: 'none' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                {doc.fileType === 'hwp' ? '📄' : doc.fileType === 'excel' ? '📊' : '📁'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{doc.fileName}</div>
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#9ca3af' }}>이 형식은 브라우저에서 미리볼 수 없습니다</div>
            </div>
          )}
        </div>

        {/* 파일 없을 때 — 파일 첨부 영역 */}
        {noFile && (
          <div>
            <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
              onChange={e => setNewFile(e.target.files[0] || null)} />
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '9px 12px',
              border: `1.5px dashed ${newFile ? color : '#d1d5db'}`,
              borderRadius: '8px',
              background: newFile ? `${color}08` : '#fafafa',
              cursor: 'pointer', fontSize: '13px',
              color: newFile ? color : '#9ca3af',
              fontFamily: 'Noto Sans KR, sans-serif',
              textAlign: 'left', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}>
              {newFile ? `✅ ${newFile.name}` : '📁 파일 찾기'}
            </button>
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: '8px',
            border: '1.5px solid #e5e7eb', background: '#fff',
            fontSize: '13px', fontWeight: 600, color: '#6b7280',
            cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
          }}>닫기</button>
          {noFile ? (
            <button disabled style={{
              padding: '9px 22px', borderRadius: '8px', border: 'none',
              background: '#e5e7eb', fontSize: '13px', fontWeight: 700, color: '#9ca3af',
              cursor: 'not-allowed', fontFamily: 'Noto Sans KR, sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>⬇️ 다운로드</button>
          ) : (
            <button onClick={handleDownload} style={{
              padding: '9px 22px', borderRadius: '8px',
              border: 'none', background: color,
              fontSize: '13px', fontWeight: 700, color: '#fff',
              cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>⬇️ 다운로드</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 서류 칩 ───
function DocChip({ doc, color, onDelete, onUpdate }) {
  const [showPreview, setShowPreview] = useState(false)
  const noFile = !doc.fileData

  const handleAttach = ({ fileData, fileName, fileType }) => {
    onUpdate(doc.id, { fileData, fileName, fileType })
  }

  return (
    <>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 8px 5px 11px',
        background: noFile ? '#fffbeb' : '#f9fafb',
        border: `1px solid ${noFile ? '#fcd34d' : '#e5e7eb'}`,
        borderRadius: '8px', cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.15s',
      }}
        onClick={() => setShowPreview(true)}
        onMouseEnter={e => { e.currentTarget.style.background = noFile ? '#fef3c7' : `${color}10`; e.currentTarget.style.borderColor = noFile ? '#f59e0b' : color }}
        onMouseLeave={e => { e.currentTarget.style.background = noFile ? '#fffbeb' : '#f9fafb'; e.currentTarget.style.borderColor = noFile ? '#fcd34d' : '#e5e7eb' }}
      >
        {/* 제목 + 서류첨부필요 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            fontWeight: 600, color: '#374151',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '120px', lineHeight: 1.3,
          }}>{doc.title}</span>
          {noFile && (
            <span style={{
              fontSize: '10px', fontWeight: 700, color: '#b45309', lineHeight: 1.2,
            }}>서류첨부 필요</span>
          )}
        </div>

        {/* 삭제 */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#d1d5db', fontSize: '14px', padding: '0 0 0 2px',
            lineHeight: 1, flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
        >×</button>
      </div>

      {showPreview && (
        <PreviewModal doc={doc} color={color} onClose={() => setShowPreview(false)} onAttach={handleAttach} />
      )}
    </>
  )
}

const DAY_ORDER = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 }

function getDayFromTitle(title) {
  const first = title?.split(' ')[0]
  return DAY_ORDER[first] ?? 99
}

// ─── 커스텀 카테고리 localStorage
const CUSTOM_CAT_KEY = 'asa_custom_categories'
function loadCustomCats() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CAT_KEY) || '[]') } catch { return [] }
}
function saveCustomCats(cats) {
  localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(cats))
}

// ─── 카테고리 추가 모달 ───
const PRESET_COLORS = [
  '#f97316','#16a34a','#2563eb','#7c3aed','#db2777',
  '#0891b2','#0d9488','#b45309','#dc2626','#9333ea',
  '#065f46','#1d4ed8','#be185d','#92400e','#1e3a5f',
]
const PRESET_ICONS = ['📁','📄','📝','📋','📊','📅','📢','🏫','✅','⭐','🔖','💼','🗂️','📌','🎯','🧾','💡','🔍']

function AddCatModal({ onClose, onAdd }) {
  const [label, setLabel] = useState('')
  const [icon, setIcon]   = useState('📁')
  const [color, setColor] = useState('#2563eb')
  const [type, setType]   = useState('keep')

  const handleAdd = () => {
    if (!label.trim()) return
    onAdd({ key: 'custom_' + Date.now(), label: label.trim(), icon, color, type, custom: true })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '28px',
        width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        fontFamily: 'Noto Sans KR, sans-serif', display: 'flex', flexDirection: 'column', gap: '18px',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>카테고리 추가</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '22px', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* 미리보기 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f9fafb', borderRadius: '10px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px',
            background: color + '12', border: '1px solid ' + color + '30',
            fontSize: '12px', fontWeight: 700, color,
          }}>
            <span>{icon}</span><span>{label || '카테고리명'}</span>
          </div>
          {DOC_TYPES[type] && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '3px 7px', borderRadius: '5px',
              background: DOC_TYPES[type].bg, color: DOC_TYPES[type].color,
            }}>{DOC_TYPES[type].label}</span>
          )}
        </div>

        {/* 카테고리명 */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
            카테고리명 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            autoFocus value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="예) 행정서류"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '8px',
              border: '1.5px solid ' + (label ? color : '#e5e7eb'), fontSize: '13px',
              color: '#111827', outline: 'none', fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e => e.target.style.borderColor = label ? color : '#e5e7eb'}
          />
        </div>

        {/* 아이콘 */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>아이콘</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PRESET_ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={{
                width: '34px', height: '34px', borderRadius: '8px', fontSize: '18px',
                border: ic === icon ? '2px solid ' + color : '1.5px solid #e5e7eb',
                background: ic === icon ? color + '12' : '#fff', cursor: 'pointer',
              }}>{ic}</button>
            ))}
          </div>
        </div>

        {/* 색상 */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>색상</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: c, border: c === color ? '3px solid #111827' : '2px solid transparent',
                cursor: 'pointer', boxSizing: 'border-box',
              }} />
            ))}
          </div>
        </div>

        {/* 서류 유형 */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>서류 유형</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(DOC_TYPES).map(([k, dt]) => (
              <button key={k} onClick={() => setType(k)} style={{
                padding: '5px 12px', borderRadius: '6px', border: 'none',
                background: type === k ? dt.bg : '#f3f4f6',
                color: type === k ? dt.color : '#6b7280',
                fontWeight: type === k ? 700 : 500,
                fontSize: '12px', cursor: 'pointer',
                fontFamily: 'Noto Sans KR, sans-serif',
                outline: type === k ? '2px solid ' + dt.color : 'none',
              }}>{dt.label}</button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
            background: '#fff', fontSize: '13px', fontWeight: 600, color: '#6b7280',
            cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
          }}>취소</button>
          <button onClick={handleAdd} disabled={!label.trim()} style={{
            padding: '9px 22px', borderRadius: '8px', border: 'none',
            background: label.trim() ? color : '#d1d5db',
            fontSize: '13px', fontWeight: 700, color: '#fff',
            cursor: label.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'Noto Sans KR, sans-serif',
          }}>추가</button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ───
export function Templates({ user }) {
  const [docs, setDocs] = useState(() =>
    (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin')
  )
  const [modalCat, setModalCat]     = useState(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [customCats, setCustomCats] = useState(loadCustomCats)
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()

  const allCats = [...CATEGORIES, ...customCats]

  const reload = () =>
    setDocs((DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin'))

  const handleSave = ({ title, fileData, fileName, fileType }) => {
    DocumentsDB.insert({
      id: uid(), teacherId: user.id,
      category: modalCat.key, title,
      fileName, fileType, fileData, createdAt: now(),
    })
    reload()
    success(modalCat.label + '이(가) 등록 완료되었습니다.')
    setModalCat(null)
  }

  const handleDelete = (id) =>
    confirm('이 서류를 삭제하시겠습니까?', () => { DocumentsDB.delete(id); reload() })

  const handleUpdate = (id, patch) => { DocumentsDB.update(id, patch); reload() }

  const handleAddCat = (cat) => {
    const updated = [...customCats, cat]
    setCustomCats(updated)
    saveCustomCats(updated)
    success('"' + cat.label + '" 카테고리가 추가되었습니다.')
  }

  const handleDeleteCat = (catKey) => {
    confirm('이 카테고리를 삭제하시겠습니까?\n등록된 서류도 함께 삭제됩니다.', () => {
      const updated = customCats.filter(c => c.key !== catKey)
      setCustomCats(updated)
      saveCustomCats(updated)
      docs.filter(d => d.category === catKey).forEach(d => DocumentsDB.delete(d.id))
      reload()
    })
  }

  const docsFor = (catKey) =>
    docs
      .filter(d => d.category === catKey)
      .sort((a, b) => getDayFromTitle(a.title) - getDayFromTitle(b.title))

  const renderCatRow = (cat, isCustom, isLast) => {
    const catDocs = docsFor(cat.key)
    return (
      <div key={cat.key} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 20px',
        borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
        minHeight: '52px',
      }}>
        {/* 카테고리 버튼 */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '8px',
          background: cat.color + '12', border: '1px solid ' + cat.color + '30',
          fontSize: '12px', fontWeight: 700, color: cat.color,
          whiteSpace: 'nowrap', flexShrink: 0, width: '148px', justifyContent: 'center',
        }}>
          <span>{cat.icon}</span><span>{cat.label}</span>
        </div>

        {/* + 버튼 */}
        <button onClick={() => setModalCat(cat)} style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: cat.color + '18', border: '1.5px solid ' + cat.color + '40',
          color: cat.color, fontSize: '18px', fontWeight: 700,
          cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = cat.color + '30' }}
          onMouseLeave={e => { e.currentTarget.style.background = cat.color + '18' }}
        >+</button>

        {/* 서류 칩들 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, alignItems: 'center' }}>
          {catDocs.length === 0
            ? <span style={{ fontSize: '12px', color: '#d1d5db' }}>+ 버튼을 눌러 서류를 등록하세요</span>
            : catDocs.map(doc => (
                <DocChip key={doc.id} doc={doc} color={cat.color}
                  onDelete={() => handleDelete(doc.id)} onUpdate={handleUpdate} />
              ))
          }
        </div>

        {/* 커스텀 카테고리 삭제 */}
        {isCustom && (
          <button onClick={() => handleDeleteCat(cat.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#d1d5db', fontSize: '15px', flexShrink: 0, padding: '2px',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
          >🗑️</button>
        )}
      </div>
    )
  }

  // 타입 순서 정의
  const TYPE_ORDER = ['keep', 'form_submit', 'submit', 'submit_mat', 'form']

  // 전체 카테고리를 타입별로 그룹핑
  const allCatsByType = TYPE_ORDER.reduce((acc, typeKey) => {
    const cats = [...CATEGORIES, ...customCats].filter(c => c.type === typeKey)
    if (cats.length) acc.push({ typeKey, cats })
    return acc
  }, [])
  // 타입 없는 커스텀 카테고리 (혹시 있을 경우)
  const untyped = customCats.filter(c => !c.type || !DOC_TYPES[c.type])
  if (untyped.length) allCatsByType.push({ typeKey: null, cats: untyped })

  return (
    <div style={{ padding: '28px', maxWidth: '1100px', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <PageHeader title="방과후 서류" sub="방과후 수업에 필요한 서류를 보관하고 관리합니다." />

      <div style={{
        marginBottom: '20px', padding: '12px 16px',
        background: '#eff6ff', border: '1.5px solid #bfdbfe',
        borderRadius: '10px', fontSize: '13px', color: '#1e40af',
      }}>
        📌 학교마다 다른 서류를 여러 개 등록할 수 있습니다. 요일을 입력하면 <strong>월·화·수·목·금·토·일 순</strong>으로 자동 정렬됩니다. 지원 형식: <strong>HWP · Excel · 이미지 · PDF</strong>
      </div>

      {/* ─── 그룹별 카테고리 목록 ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {allCatsByType.map(({ typeKey, cats }) => {
          const dt = typeKey ? DOC_TYPES[typeKey] : { label: '기타', color: '#6b7280', bg: '#f3f4f6' }
          return (
            <div key={typeKey || 'untyped'} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: '12px', overflow: 'hidden',
            }}>
              {/* 그룹 헤더 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px',
                background: dt.bg,
                borderBottom: '1px solid ' + dt.color + '20',
              }}>
                <span style={{
                  fontSize: '12px', fontWeight: 800, color: dt.color,
                  letterSpacing: '0.3px',
                }}>{dt.label}</span>
                <span style={{ fontSize: '11px', color: dt.color + 'aa' }}>
                  ({cats.length}개)
                </span>
              </div>

              {/* 카테고리 행들 */}
              {cats.map((cat, ci) =>
                renderCatRow(cat, cat.custom === true, ci === cats.length - 1)
              )}
            </div>
          )
        })}

        {/* + 카테고리 추가 버튼 */}
        <button onClick={() => setShowAddCat(true)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '11px', borderRadius: '12px',
          border: '1.5px dashed #d1d5db', background: '#fafafa',
          fontSize: '13px', fontWeight: 700, color: '#6b7280',
          cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#eff6ff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = '#fafafa' }}
        >＋ 카테고리 추가</button>
      </div>

      {modalCat && <AddModal cat={modalCat} onClose={() => setModalCat(null)} onSave={handleSave} />}
      {showAddCat && <AddCatModal onClose={() => setShowAddCat(false)} onAdd={handleAddCat} />}
    </div>
  )
}
