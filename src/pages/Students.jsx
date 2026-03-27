import React, { useState, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB } from '../lib/db.js'
import { uid, now, fmtPhone } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Tag, EmptyState, PageHeader, Checkbox, Textarea } from '../components/Atoms.jsx'
import { STUDENT_STATUS, GRADES } from '../constants/config.js'

function emptyStudent() {
  return { school: '', grade: '3학년', classNum: '', number: '', name: '', parentPhone: '', studentPhone: '', classIds: [], status: 'applied', memo: '' }
}

export function Students({ user, onNav }) {
  const classes = ClassesDB.byTeacher(user.id)

  // ── 컨텍스트 필터 (학교/과목/반 미리 선택)
  const [ctxSchool,  setCtxSchool]  = useState('')
  const [ctxClass,   setCtxClass]   = useState('')  // classId
  const [ctxSection, setCtxSection] = useState('')  // 반

  // ── 정렬/상태 필터
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder,    setSortOrder]    = useState('asc')  // asc=신청순, desc=내림차순

  // ── 학생 모달
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(emptyStudent())

  // ── 엑셀
  const [showExcel,    setShowExcel]    = useState(false)
  const [excelPreview, setExcelPreview] = useState([])
  const [excelStep,    setExcelStep]    = useState(1)
  const fileRef = useRef()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ── 유니크 학교 목록
  const schools = [...new Set(classes.map(c => c.organization).filter(Boolean))]

  // ── 선택된 학교의 수업 목록
  const filteredClasses = ctxSchool ? classes.filter(c => c.organization === ctxSchool) : classes

  // ── 선택된 수업의 반 목록
  const sections = ctxClass
    ? [...new Set(classes.filter(c => c.id === ctxClass).map(c => c.section).filter(Boolean))]
    : []

  // ── 현재 컨텍스트로 필터된 학생 목록
  const allStudents = StudentsDB.byTeacher(user.id)
  const filtered = allStudents.filter(s => {
    if (ctxClass && !s.classIds?.includes(ctxClass)) return false
    if (ctxSchool && s.school !== ctxSchool) return false
    if (ctxSection && s.classNum !== ctxSection) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    return true
  }).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return sortOrder === 'asc' ? ta - tb : tb - ta
  })

  // ── 상태별 카운트 (컨텍스트 적용)
  const ctxBase = allStudents.filter(s => {
    if (ctxClass && !s.classIds?.includes(ctxClass)) return false
    if (ctxSchool && s.school !== ctxSchool) return false
    if (ctxSection && s.classNum !== ctxSection) return false
    return true
  })
  const statusCounts = {
    all: ctxBase.length,
    applied: ctxBase.filter(s => s.status === 'applied').length,
    selected: ctxBase.filter(s => s.status === 'selected').length,
    confirmed: ctxBase.filter(s => s.status === 'confirmed').length,
    cancelled: ctxBase.filter(s => s.status === 'cancelled').length,
  }

  // ── 학생 등록 모달 열기 (컨텍스트 자동 채움)
  const openAdd = () => {
    const cls = classes.find(c => c.id === ctxClass)
    setForm({
      ...emptyStudent(),
      school: ctxSchool || cls?.organization || '',
      classIds: ctxClass ? [ctxClass] : [],
      classNum: ctxSection || '',
    })
    setEditId(null)
    setShowModal(true)
  }

  const openEdit = (s) => { setForm({ ...s, memo: s.memo || '' }); setEditId(s.id); setShowModal(true) }

  const save = () => {
    if (!form.name.trim() || !form.school.trim() || !form.grade) { alert('필수 항목을 입력하세요.'); return }
    if (editId) {
      StudentsDB.update(editId, { ...form })
    } else {
      StudentsDB.insert({
        id: uid(), teacherId: user.id, ...form,
        statusHistory: [{ status: form.status, changedAt: now(), memo: '' }],
        createdAt: now(),
      })
    }
    setShowModal(false)
  }

  const changeStatus = (id, status) => {
    const s = StudentsDB.find(id)
    StudentsDB.update(id, { status, statusHistory: [...(s.statusHistory || []), { status, changedAt: now(), memo: '' }] })
  }

  // ── 엑셀 파싱
  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1)
      const parsed = rows.filter(r => r[3]).map(r => ({
        grade: r[0] ? String(r[0]) : '', classNum: r[1] ? String(r[1]) : '',
        number: r[2] ? String(r[2]) : '', name: String(r[3] || '').trim(),
        parentPhone: r[4] ? String(r[4]) : '', studentPhone: r[5] ? String(r[5]) : '',
      }))
      setExcelPreview(parsed); setExcelStep(2)
    } catch { alert('파일을 읽을 수 없습니다.') }
  }

  const downloadSample = () => {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['학년', '반', '번호', '이름', '학부모전화번호', '학생전화번호'],
        ['3학년', '2', '5', '홍길동', '010-1234-5678', ''],
        ['4학년', '1', '12', '이영희', '010-9876-5432', '010-1111-2222'],
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '학생목록')
      XLSX.writeFile(wb, '학생등록_샘플.xlsx')
    })
  }

  const importExcel = () => {
    const school = ctxSchool || classes.find(c => c.id === ctxClass)?.organization || ''
    excelPreview.forEach(row => {
      StudentsDB.insert({
        id: uid(), teacherId: user.id, school,
        grade: row.grade, classNum: row.classNum || ctxSection, number: row.number,
        name: row.name, parentPhone: row.parentPhone, studentPhone: row.studentPhone,
        classIds: ctxClass ? [ctxClass] : [],
        status: 'applied', memo: '',
        statusHistory: [{ status: 'applied', changedAt: now(), memo: '엑셀 일괄 등록' }],
        createdAt: now(),
      })
    })
    setShowExcel(false); setExcelPreview([]); setExcelStep(1)
  }

  const selectedCls = classes.find(c => c.id === ctxClass)

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader
        title="학생 관리"
        sub="학교 · 과목 · 반을 먼저 선택하고 학생을 관리하세요."
        right={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn variant="ghost" onClick={() => { setExcelStep(1); setShowExcel(true) }}>📊 엑셀 업로드</Btn>
            <Btn variant="ghost" onClick={() => onNav('confirm')}>✅ 최종 확정</Btn>
            <Btn onClick={openAdd}>+ 학생 등록</Btn>
          </div>
        }
      />

      {/* ── 컨텍스트 선택 바 (학교 / 과목 / 반) */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginBottom: '10px', letterSpacing: '0.05em' }}>📍 학생 보기 범위 선택</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* 학교 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>학교</label>
            <select value={ctxSchool} onChange={e => { setCtxSchool(e.target.value); setCtxClass(''); setCtxSection('') }}
              style={selStyle}>
              <option value="">전체 학교</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 과목/수업 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>과목</label>
            <select value={ctxClass} onChange={e => { setCtxClass(e.target.value); setCtxSection('') }}
              style={selStyle}>
              <option value="">전체 과목</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>{c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
              ))}
            </select>
          </div>

          {/* 반 선택 (수업 선택 시에만) */}
          {sections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>반</label>
              <select value={ctxSection} onChange={e => setCtxSection(e.target.value)} style={selStyle}>
                <option value="">전체 반</option>
                {sections.map(s => <option key={s} value={s}>{s}반</option>)}
              </select>
            </div>
          )}

          {/* 현재 선택 뱃지 */}
          {(ctxSchool || ctxClass) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1px' }}>
              {ctxSchool && <Tag color="#3b82f6" bg="#eff6ff" size="md">🏫 {ctxSchool}</Tag>}
              {ctxClass && selectedCls && <Tag color="#f97316" bg="#fff7ed" size="md">📚 {selectedCls.className}</Tag>}
              {ctxSection && <Tag color="#8b5cf6" bg="#f5f3ff" size="md">📋 {ctxSection}반</Tag>}
              <button onClick={() => { setCtxSchool(''); setCtxClass(''); setCtxSection('') }}
                style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>초기화</button>
            </div>
          )}
        </div>
      </div>

      {/* ── 상태 필터 + 정렬 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: `전체 ${statusCounts.all}` },
            { key: 'applied',   label: `신청 ${statusCounts.applied}` },
            { key: 'selected',  label: `추첨완료 ${statusCounts.selected}` },
            { key: 'confirmed', label: `확정 ${statusCounts.confirmed}` },
            { key: 'cancelled', label: `취소 ${statusCounts.cancelled}` },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: statusFilter === f.key ? '#f97316' : '#f3f4f6',
              color: statusFilter === f.key ? '#fff' : '#374151',
              fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
              fontWeight: statusFilter === f.key ? 600 : 400, transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>

        {/* 정렬 */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setSortOrder('asc')} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: sortOrder === 'asc' ? 700 : 400, background: sortOrder === 'asc' ? '#18181b' : '#f3f4f6', color: sortOrder === 'asc' ? '#fff' : '#374151', transition: 'all .15s' }}>신청순 ↑</button>
          <button onClick={() => setSortOrder('desc')} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: sortOrder === 'desc' ? 700 : 400, background: sortOrder === 'desc' ? '#18181b' : '#f3f4f6', color: sortOrder === 'desc' ? '#fff' : '#374151', transition: 'all .15s' }}>최신순 ↓</button>
        </div>
      </div>

      {/* ── 학생 테이블 */}
      {filtered.length === 0 ? (
        <EmptyState icon="👥" title="학생이 없습니다" desc="학생을 등록하거나 필터를 변경하세요." />
      ) : (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['이름', '학교', '학년 / 반 / 번호', '학부모 전화', '수업 · 반', '상태', '메모', '작업'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const cfg = STUDENT_STATUS[s.status] || {}
                const sClasses = (s.classIds || []).map(cid => {
                  const cls = classes.find(c => c.id === cid)
                  if (!cls) return null
                  return cls.className + (cls.section ? ' ' + cls.section + '반' : '')
                }).filter(Boolean)

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '11px 14px', fontSize: '14px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{s.school}</td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      <span>{s.grade}</span>
                      {s.classNum && <span style={{ marginLeft: '4px', padding: '1px 7px', borderRadius: '5px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '12px' }}>{s.classNum}반</span>}
                      {s.number && <span style={{ marginLeft: '4px', color: '#9ca3af', fontSize: '12px' }}>{s.number}번</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtPhone(s.parentPhone) || '-'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {sClasses.map(c => <Tag key={c} color="#6b7280" bg="#f3f4f6">{c}</Tag>)}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <select value={s.status} onChange={e => { changeStatus(s.id, e.target.value); /* force re-render */ }}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${cfg.color}50`, background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer', outline: 'none' }}>
                        {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '11px 14px', maxWidth: '160px' }}>
                      {s.memo
                        ? <span style={{ fontSize: '12px', color: '#374151', background: '#fffbeb', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📌 {s.memo}</span>
                        : <span style={{ fontSize: '12px', color: '#d1d5db' }}>-</span>
                      }
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>편집</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 학생 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '학생 정보 편집' : '학생 등록'} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="학교명" value={form.school} onChange={v => set('school', v)} placeholder="판교초등학교" required />
            <Select label="학년" value={form.grade} onChange={v => set('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <Input label="반" value={form.classNum} onChange={v => set('classNum', v)} placeholder="2" />
            <Input label="번호" value={form.number} onChange={v => set('number', v)} placeholder="5" />
            <Input label="이름" value={form.name} onChange={v => set('name', v)} placeholder="홍길동" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="학부모 전화번호" value={form.parentPhone} onChange={v => set('parentPhone', v)} placeholder="010-0000-0000" />
            <Input label="학생 전화번호" value={form.studentPhone} onChange={v => set('studentPhone', v)} placeholder="010-0000-0000" />
          </div>

          {/* 수강 수업 선택 */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>수강 수업</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflow: 'auto', padding: '2px' }}>
              {classes.map(c => (
                <Checkbox key={c.id}
                  checked={form.classIds?.includes(c.id)}
                  onChange={v => set('classIds', v ? [...(form.classIds || []), c.id] : (form.classIds || []).filter(id => id !== c.id))}
                  label={`${c.organization} · ${c.className}${c.section ? ' ' + c.section + '반' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* 특이사항 메모 */}
          <Textarea label="📌 특이사항 메모" value={form.memo} onChange={v => set('memo', v)} placeholder="예: 알레르기 있음 / 조기 귀가 필요 / 부모님 요청사항 등" rows={2} />

          <Select label="상태" value={form.status} onChange={v => set('status', v)}
            options={Object.entries(STUDENT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn onClick={save}>{editId ? '저장' : '등록'}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── 엑셀 업로드 모달 */}
      <Modal open={showExcel} onClose={() => { setShowExcel(false); setExcelPreview([]); setExcelStep(1) }} title="엑셀 일괄 업로드" width={640}>
        {excelStep === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151', lineHeight: 1.8 }}>
              <strong>파일 형식:</strong> .xlsx, .xls, .csv<br />
              <strong>컬럼 순서:</strong> 학년 | 반 | 번호 | 이름 | 학부모전화번호 | 학생전화번호<br />
              {ctxClass && <><strong>현재 선택 수업:</strong> {classes.find(c=>c.id===ctxClass)?.className}에 등록됩니다.</>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn variant="ghost" onClick={downloadSample}>샘플 파일 다운로드</Btn>
              <Btn onClick={() => fileRef.current?.click()}>파일 선택</Btn>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>미리보기 ({excelPreview.length}명)</div>
            <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>{['학년','반','번호','이름','학부모전화'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {excelPreview.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px' }}>{r.grade}</td>
                      <td style={{ padding: '8px 12px' }}>{r.classNum}</td>
                      <td style={{ padding: '8px 12px' }}>{r.number}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: '8px 12px' }}>{r.parentPhone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setExcelStep(1)}>← 다시 선택</Btn>
              <Btn onClick={importExcel}>{excelPreview.length}명 등록</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const selStyle = {
  padding: '8px 12px', borderRadius: '9px', border: '1.5px solid #e5e7eb',
  fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif',
  background: '#fff', color: '#111827', cursor: 'pointer', outline: 'none',
  minWidth: '160px',
}
