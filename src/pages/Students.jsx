import React, { useState, useRef } from 'react'
import { Classes, Students as StudentsDB } from '../lib/db.js'
import { uid, now, fmtPhone } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Tag, EmptyState, PageHeader, Checkbox } from '../components/Atoms.jsx'
import { STUDENT_STATUS, GRADES } from '../constants/config.js'

function emptyForm() {
  return { school: '', grade: '3학년', classNum: '', number: '', name: '', parentPhone: '', studentPhone: '', classIds: [], status: 'applied' }
}

export function Students({ user, onNav }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [showExcel, setShowExcel] = useState(false)
  const [excelPreview, setExcelPreview] = useState([])
  const [excelStep, setExcelStep] = useState(1)
  const fileRef = useRef()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const classes = Classes.byTeacher(user.id)
  const classOpts = [{ value: '', label: '전체 수업' }, ...classes.map(c => ({ value: c.id, label: `${c.organization} ${c.className}${c.section ? ' ' + c.section + '반' : ''}` }))]

  const students = StudentsDB.byTeacher(user.id).filter(s => {
    if (selectedClass && !s.classIds?.includes(selectedClass)) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    return true
  })

  const openAdd = () => {
    setForm({ ...emptyForm(), school: classes.find(c => c.id === selectedClass)?.organization || '', classIds: selectedClass ? [selectedClass] : [] })
    setEditId(null)
    setShowModal(true)
  }

  const openEdit = (s) => {
    setForm({ ...s })
    setEditId(s.id)
    setShowModal(true)
  }

  const save = () => {
    if (!form.name.trim() || !form.school.trim() || !form.grade) {
      alert('필수 항목을 입력하세요.')
      return
    }
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
    StudentsDB.update(id, {
      status,
      statusHistory: [...(s.statusHistory || []), { status, changedAt: now(), memo: '' }],
    })
  }

  // 엑셀 파싱
  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1)
      const parsed = rows
        .filter(r => r[3]) // 이름 있는 행만
        .map(r => ({
          grade: r[0] ? String(r[0]) : '',
          classNum: r[1] ? String(r[1]) : '',
          number: r[2] ? String(r[2]) : '',
          name: String(r[3] || '').trim(),
          parentPhone: r[4] ? String(r[4]) : '',
          studentPhone: r[5] ? String(r[5]) : '',
        }))
      setExcelPreview(parsed)
      setExcelStep(2)
    } catch {
      alert('파일을 읽을 수 없습니다. xlsx 형식인지 확인하세요.')
    }
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
    const school = classes.find(c => c.id === selectedClass)?.organization || ''
    excelPreview.forEach(row => {
      StudentsDB.insert({
        id: uid(), teacherId: user.id,
        school,
        grade: row.grade, classNum: row.classNum, number: row.number,
        name: row.name, parentPhone: row.parentPhone, studentPhone: row.studentPhone,
        classIds: selectedClass ? [selectedClass] : [],
        status: 'applied',
        statusHistory: [{ status: 'applied', changedAt: now(), memo: '엑셀 일괄 등록' }],
        createdAt: now(),
      })
    })
    setShowExcel(false)
    setExcelPreview([])
    setExcelStep(1)
  }

  const statusCounts = {
    all: StudentsDB.byTeacher(user.id).length,
    applied: StudentsDB.byTeacher(user.id).filter(s => s.status === 'applied').length,
    selected: StudentsDB.byTeacher(user.id).filter(s => s.status === 'selected').length,
    confirmed: StudentsDB.byTeacher(user.id).filter(s => s.status === 'confirmed').length,
    cancelled: StudentsDB.byTeacher(user.id).filter(s => s.status === 'cancelled').length,
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader
        title="학생 관리"
        sub="학생을 등록하고 상태를 관리합니다."
        right={
          <>
            <Btn variant="ghost" onClick={() => { setExcelStep(1); setShowExcel(true) }}>📊 엑셀 업로드</Btn>
            <Btn variant="ghost" onClick={() => onNav('confirm')}>✅ 최종 확정</Btn>
            <Btn onClick={openAdd}>+ 학생 등록</Btn>
          </>
        }
      />

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', color: '#111827', cursor: 'pointer', outline: 'none' }}>
          {classOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'all', label: `전체 ${statusCounts.all}` },
            { key: 'applied', label: `신청 ${statusCounts.applied}` },
            { key: 'selected', label: `추첨완료 ${statusCounts.selected}` },
            { key: 'confirmed', label: `확정 ${statusCounts.confirmed}` },
            { key: 'cancelled', label: `취소 ${statusCounts.cancelled}` },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: statusFilter === f.key ? '#f97316' : '#f3f4f6',
              color: statusFilter === f.key ? '#fff' : '#374151',
              fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
              fontWeight: statusFilter === f.key ? 600 : 400,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* 학생 목록 */}
      {students.length === 0 ? (
        <EmptyState icon="👥" title="학생이 없습니다" desc="학생을 등록하거나 엑셀로 일괄 업로드 하세요." />
      ) : (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['이름', '학교', '학년/반/번호', '학부모 전화', '수업', '상태', '작업'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const cfg = STUDENT_STATUS[s.status] || {}
                const sClasses = (s.classIds || []).map(cid => classes.find(c => c.id === cid)?.className).filter(Boolean)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>{s.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{s.school}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{s.grade} {s.classNum ? s.classNum + '반' : ''} {s.number ? s.number + '번' : ''}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{fmtPhone(s.parentPhone) || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {sClasses.map(c => <Tag key={c} color="#6b7280" bg="#f3f4f6">{c}</Tag>)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select value={s.status} onChange={e => changeStatus(s.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${cfg.color}40`, background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer', outline: 'none' }}>
                        {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>편집</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 학생 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '학생 정보 편집' : '학생 등록'} width={500}>
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
          <Input label="학부모 전화번호" value={form.parentPhone} onChange={v => set('parentPhone', v)} placeholder="010-0000-0000" />
          <Input label="학생 전화번호 (선택)" value={form.studentPhone} onChange={v => set('studentPhone', v)} placeholder="010-0000-0000" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>수강 수업 선택</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {classes.map(c => (
                <Checkbox key={c.id} checked={form.classIds?.includes(c.id)}
                  onChange={v => set('classIds', v ? [...(form.classIds || []), c.id] : (form.classIds || []).filter(id => id !== c.id))}
                  label={`${c.organization} ${c.className}${c.section ? ' ' + c.section + '반' : ''}`} />
              ))}
            </div>
          </div>
          <Select label="상태" value={form.status} onChange={v => set('status', v)}
            options={Object.entries(STUDENT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn onClick={save}>{editId ? '저장' : '등록'}</Btn>
          </div>
        </div>
      </Modal>

      {/* 엑셀 업로드 모달 */}
      <Modal open={showExcel} onClose={() => { setShowExcel(false); setExcelPreview([]); setExcelStep(1) }} title="엑셀 일괄 업로드" width={640}>
        {excelStep === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151', lineHeight: 1.8 }}>
              <strong>파일 형식:</strong> .xlsx, .xls, .csv<br />
              <strong>컬럼 순서:</strong> 학년 | 반 | 번호 | 이름 | 학부모전화번호 | 학생전화번호<br />
              <strong>주의:</strong> 첫 번째 행은 헤더입니다. 두 번째 행부터 데이터를 입력하세요.
            </div>
            {selectedClass && (
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                선택된 수업: <strong>{classes.find(c => c.id === selectedClass)?.className || ''}</strong>에 일괄 등록됩니다.
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn variant="ghost" onClick={downloadSample}>샘플 파일 다운로드</Btn>
              <Btn onClick={() => fileRef.current?.click()}>파일 선택</Btn>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>미리보기 ({excelPreview.length}명)</div>
            <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    {['학년', '반', '번호', '이름', '학부모전화'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
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
