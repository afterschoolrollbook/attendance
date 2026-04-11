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

// 카테고리별 입력 슬롯 초기화
function initEntries() {
  return Object.fromEntries(CATEGORIES.map(c => [c.key, [{ id: uid(), title: '', file: null }]]))
}

export function Templates({ user }) {
  const [docs, setDocs] = useState(() =>
    (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin')
  )
  const [entries, setEntries] = useState(initEntries)
  const [saving, setSaving] = useState(false)
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()
  const fileRefs = useRef({})

  const reload = () =>
    setDocs((DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin'))

  // 슬롯 조작
  const addEntry    = (catKey) => {
    setEntries(e => {
      if (e[catKey].length >= 10) return e
      return { ...e, [catKey]: [...e[catKey], { id: uid(), title: '', file: null }] }
    })
  }
  const removeEntry = (catKey, id) =>
    setEntries(e => ({ ...e, [catKey]: e[catKey].filter(x => x.id !== id) }))
  const patchEntry  = (catKey, id, patch) =>
    setEntries(e => ({ ...e, [catKey]: e[catKey].map(x => x.id === id ? { ...x, ...patch } : x) }))

  // 저장
  const save = async () => {
    const toSave = []
    for (const cat of CATEGORIES) {
      for (const entry of entries[cat.key]) {
        if (!entry.title.trim() && !entry.file) continue
        if (!entry.title.trim() || !entry.file) {
          toastError(`[${cat.label}] 제목과 파일을 모두 입력해주세요.`)
          return
        }
        toSave.push({ cat, entry })
      }
    }
    if (!toSave.length) { toastError('입력된 서류가 없습니다.'); return }

    setSaving(true)
    for (const { cat, entry } of toSave) {
      const fileData = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.readAsDataURL(entry.file)
      })
      DocumentsDB.insert({
        id: uid(), teacherId: user.id,
        category: cat.key, title: entry.title.trim(),
        fileName: entry.file.name, fileType: getFileType(entry.file.name),
        fileData, createdAt: now(),
      })
    }
    reload()
    setEntries(initEntries())
    setSaving(false)
    success(`${toSave.length}개 서류가 등록되었습니다.`)
  }

  const download = (doc) => {
    if (!doc.fileData) return
    const a = document.createElement('a')
    a.href = doc.fileData; a.download = doc.fileName; a.click()
  }
  const del = (id) => confirm('이 서류를 삭제하시겠습니까?', () => { DocumentsDB.delete(id); reload() })

  const docsFor = (catKey) => docs.filter(d => d.category === catKey)

  return (
    <div style={{ padding: '28px', maxWidth: '1000px' }}>
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

      {/* ─── 메인 카드 ─── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>

        {/* 컬럼 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 200px 36px',
          gap: '10px', padding: '11px 20px',
          background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
          fontSize: '12px', fontWeight: 700, color: '#6b7280',
        }}>
          <span>분류</span>
          <span>제목 <span style={{ color: '#dc2626' }}>*</span></span>
          <span>파일 <span style={{ color: '#dc2626' }}>*</span></span>
          <span />
        </div>

        {/* 카테고리 행 */}
        <div style={{ padding: '8px 0' }}>
          {CATEGORIES.map((cat, ci) => (
            <div key={cat.key}>
              {ci > 0 && <div style={{ height: '1px', background: '#f3f4f6', margin: '4px 0' }} />}

              {/* 입력 슬롯들 */}
              {entries[cat.key].map((entry, ei) => (
                <div key={entry.id} style={{
                  display: 'grid', gridTemplateColumns: '160px 1fr 200px 36px',
                  gap: '10px', padding: '6px 20px', alignItems: 'center',
                }}>
                  {/* 분류 라벨 */}
                  <div>
                    {ei === 0 ? (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 10px', borderRadius: '8px',
                        background: `${cat.color}12`, border: `1px solid ${cat.color}30`,
                        fontSize: '12px', fontWeight: 700, color: cat.color,
                        whiteSpace: 'nowrap',
                      }}>
                        <span>{cat.icon}</span><span>{cat.label}</span>
                      </div>
                    ) : (
                      <div style={{ paddingLeft: '14px', color: '#d1d5db', fontSize: '13px' }}>↳</div>
                    )}
                  </div>

                  {/* 제목 */}
                  <input
                    value={entry.title}
                    onChange={e => patchEntry(cat.key, entry.id, { title: e.target.value })}
                    placeholder=""
                    style={{
                      padding: '7px 10px', borderRadius: '8px',
                      border: '1.5px solid #e5e7eb', fontSize: '13px',
                      fontFamily: 'Noto Sans KR, sans-serif',
                      color: '#111827', outline: 'none', width: '100%', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = cat.color}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />

                  {/* 파일 선택 */}
                  <div>
                    <input
                      ref={el => fileRefs.current[entry.id] = el}
                      type="file" accept={ACCEPT} style={{ display: 'none' }}
                      onChange={e => patchEntry(cat.key, entry.id, { file: e.target.files[0] || null })}
                    />
                    <button
                      onClick={() => fileRefs.current[entry.id]?.click()}
                      style={{
                        width: '100%', padding: '7px 10px',
                        border: `1.5px dashed ${entry.file ? cat.color : '#d1d5db'}`,
                        borderRadius: '8px',
                        background: entry.file ? `${cat.color}10` : '#fafafa',
                        cursor: 'pointer', fontSize: '12px',
                        color: entry.file ? cat.color : '#9ca3af',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        textAlign: 'left', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                      }}
                    >
                      {entry.file ? `✅ ${entry.file.name}` : '📁 파일 선택'}
                    </button>
                  </div>

                  {/* + / ✕ */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {ei === entries[cat.key].length - 1 ? (
                      entries[cat.key].length < 10 && (
                        <button onClick={() => addEntry(cat.key)}
                          style={{
                            background: `${cat.color}18`, border: 'none',
                            borderRadius: '6px', width: '26px', height: '26px',
                            cursor: 'pointer', color: cat.color,
                            fontSize: '18px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>+</button>
                      )
                    ) : (
                      <button onClick={() => removeEntry(cat.key, entry.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#d1d5db', fontSize: '16px', padding: 0,
                        }}>✕</button>
                    )}
                  </div>
                </div>
              ))}

              {/* 이미 등록된 파일 목록 */}
              {docsFor(cat.key).length > 0 && (
                <div style={{ margin: '4px 20px 4px 190px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {docsFor(cat.key).map(doc => {
                    const ft = FT[doc.fileType] || FT.file
                    return (
                      <div key={doc.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 10px', background: '#f9fafb',
                        border: '1px solid #f3f4f6', borderRadius: '8px',
                        fontSize: '12px',
                      }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '1px 5px',
                          borderRadius: '4px', background: ft.bg, color: ft.color, flexShrink: 0,
                        }}>{ft.label}</span>
                        <span style={{ fontWeight: 600, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.title}
                        </span>
                        <span style={{ color: '#9ca3af', flexShrink: 0 }}>{doc.fileName}</span>
                        <span style={{ color: '#d1d5db', flexShrink: 0 }}>{doc.createdAt?.slice(0,10)}</span>
                        <button onClick={() => { const a = document.createElement('a'); a.href = doc.fileData; a.download = doc.fileName; a.click() }}
                          style={{ background: '#eff6ff', border: 'none', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>⬇️</button>
                        <button onClick={() => del(doc.id)}
                          style={{ background: '#fef2f2', border: 'none', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>🗑️</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 등록 버튼 */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Btn onClick={save} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
