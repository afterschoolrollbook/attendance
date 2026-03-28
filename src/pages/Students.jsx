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
  const [excelStep,    setExcelStep]    = useState(0)  // 0=안내, 1=업로드, 2=미리보기
  const [excelSchool,  setExcelSchool]  = useState('')
  const [excelClassId, setExcelClassId] = useState('')
  const [excelSection, setExcelSection] = useState('')
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
  // 컬럼: 학교 | 과목 | 반 | 요일(화목) | 시간 | 학년 | 번호 | 이름 | 학부모전화 | 학생전화
  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      // 첫 행이 헤더인지 확인 (이름 컬럼이 '이름'이면 헤더)
      const startRow = rows[0] && String(rows[0][7] || rows[0][3] || '').includes('이름') ? 1 : 0
      const dataRows = rows.slice(startRow)

      const parsed = dataRows
        .filter(r => r[7] || r[3])  // 이름 있는 행 (컬럼7 또는 컬럼3)
        .map(r => {
          // 새 형식 (10컬럼): 학교|과목|반|요일|시간|학년|번호|이름|학부모전화|학생전화
          // 구 형식 (6컬럼):  학년|반|번호|이름|학부모전화|학생전화
          const isNewFormat = r.length >= 8 && r[7] // 8번째 컬럼(이름)이 있으면 새 형식
          if (isNewFormat) {
            return {
              school: String(r[0] || '').trim(),
              subject: String(r[1] || '').trim(),
              section: String(r[2] || '').trim(),
              days: String(r[3] || '').trim(),
              time: String(r[4] || '').trim(),
              grade: String(r[5] || '').trim(),
              number: String(r[6] || '').trim(),
              name: String(r[7] || '').trim(),
              parentPhone: String(r[8] || '').trim(),
              studentPhone: String(r[9] || '').trim(),
            }
          } else {
            return {
              school: '', subject: '', section: '', days: '', time: '',
              grade: String(r[0] || '').trim(),
              number: String(r[2] || '').trim(),
              classNum: String(r[1] || '').trim(),
              name: String(r[3] || '').trim(),
              parentPhone: String(r[4] || '').trim(),
              studentPhone: String(r[5] || '').trim(),
            }
          }
        })
        .filter(r => r.name)

      setExcelPreview(parsed); setExcelStep(2)
    } catch { alert('파일을 읽을 수 없습니다.') }
  }

  // 샘플A: 수업이 이미 있을 때 (간단 6컬럼)
  const downloadSampleSimple = () => {
    import('xlsx').then(XLSX => {
      const selCls = classes.find(c => c.id === excelClassId)
      const schoolName = excelSchool || selCls?.organization || '판교초등학교'
      const subjectName = selCls ? selCls.className + (selCls.section ? ' '+selCls.section+'반' : '') : '로봇과학 A반'
      const rows = [
        ['※ 학교·과목은 자동 적용 (아래 항목만 입력하세요)', '', '', '', '', ''],
        [`학교: ${schoolName}`, `과목: ${subjectName}`, '', '', '', ''],
        [''],
        ['학년', '학급반(학교반)', '번호', '이름 *필수', '학부모전화번호', '학생전화번호'],
        ['3학년', '2', '5', '홍길동', '010-1234-5678', ''],
        ['4학년', '1', '12', '이영희', '010-9876-5432', '010-1111-2222'],
        ['3학년', '2', '8', '박철수', '010-5555-6666', ''],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{wch:8},{wch:6},{wch:6},{wch:12},{wch:16},{wch:16}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '학생목록')
      XLSX.writeFile(wb, `${schoolName}_${subjectName}_학생등록.xlsx`)
    })
  }

  // 샘플B: 수업 자동생성 포함 (11컬럼)
  const downloadSampleFull = () => {
    import('xlsx').then(XLSX => {
      const rows = [
        ['학교', '과목', '수업반', '요일(예:화목)', '시작시간', '종료시간', '학년', '학급반(학교반)', '번호', '이름 *필수', '학부모전화번호', '학생전화번호'],
        ['판교초등학교', '로봇과학', 'A', '화목', '14:00', '15:00', '3학년', '2', '5', '홍길동', '010-1234-5678', ''],
        ['판교초등학교', '로봇과학', 'A', '화목', '14:00', '15:00', '4학년', '1', '12', '이영희', '010-9876-5432', '010-1111-2222'],
        ['판교초등학교', '바이올린', 'B', '수', '15:00', '16:00', '3학년', '3', '3', '박철수', '010-5555-6666', ''],
        ['안양남초등학교', '미술', 'A', '월수', '13:00', '14:00', '5학년', '2', '7', '김민지', '010-7777-8888', ''],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{wch:14},{wch:10},{wch:8},{wch:12},{wch:10},{wch:10},{wch:8},{wch:10},{wch:6},{wch:12},{wch:16},{wch:16}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '학생+수업자동생성')
      XLSX.writeFile(wb, '학생_전체_일괄등록_샘플.xlsx')
    })
  }

  const downloadSample = downloadSampleFull  // 기존 호환용

  const importExcel = () => {
    // 수업 자동 생성 캐시 (학교+과목+반 → classId)
    const classCache = {}

    const getOrCreateClass = (school, subject, section, days, timeStart, timeEnd) => {
      const key = [school, subject, section].filter(Boolean).join('|')
      if (classCache[key]) return classCache[key]

      // 기존 수업 탐색
      const existing = ClassesDB.byTeacher(user.id).find(c =>
        c.organization === school &&
        c.className === subject &&
        (section ? c.section === section : true)
      )
      if (existing) {
        classCache[key] = existing.id
        return existing.id
      }

      // 없으면 자동 생성
      const today_ = new Date()
      const endDate = new Date(today_.getFullYear(), 11, 31).toISOString().slice(0, 10)
      const startDate = today_.toISOString().slice(0, 10)

      // 요일 파싱 (예: "화목" → ["화", "목"])
      const dayMap = { '월':true,'화':true,'수':true,'목':true,'금':true,'토':true,'일':true }
      const parsedDays = days ? [...days].filter(d => dayMap[d]) : []

      const newCls = {
        id: uid(), teacherId: user.id,
        organization: school,
        className: subject,
        section: section || '',
        termType: 'semester',
        days: parsedDays.length ? parsedDays : [],
        time: timeStart ? (timeEnd ? `${timeStart}~${timeEnd}` : timeStart) : '',
        startDate,
        endDate,
        cancelledDates: [],
        description: '',
        promotionImgs: [],
        templateFile: null,
        createdAt: now(),
      }
      ClassesDB.insert(newCls)
      classCache[key] = newCls.id
      return newCls.id
    }

    // 수업 모달 컨텍스트 (모달에서 직접 선택한 경우)
    const ctxCls = ClassesDB.byTeacher(user.id).find(c => c.id === excelClassId)

    excelPreview.forEach(row => {
      const school    = row.school    || excelSchool || ctxCls?.organization || ''
      const subject   = row.subject   || ctxCls?.className || ''
      const section   = row.section   || excelSection || ctxCls?.section || ''  // 수업반 (A/B)
      const classNum  = row.classNum  || ''  // 학급반 (학교 소속 반 번호, 예: 2)
      const days      = row.days      || ''
      const timeStart = row.timeStart || ''
      const timeEnd   = row.timeEnd   || ''

      let classId = excelClassId
      // 엑셀에 학교/과목 정보가 있으면 자동 생성/탐색
      if (row.school && row.subject) {
        classId = getOrCreateClass(school, subject, section, days, timeStart, timeEnd)
      }

      StudentsDB.insert({
        id: uid(), teacherId: user.id, school,
        grade: row.grade,
        classNum: classNum,   // 학급반 (학교 소속 반) - 수업반(section)과 별개
        number: row.number,
        name: row.name, parentPhone: row.parentPhone, studentPhone: row.studentPhone,
        classIds: classId ? [classId] : [],
        status: 'applied', memo: '',
        statusHistory: [{ status: 'applied', changedAt: now(), memo: '엑셀 일괄 등록' }],
        createdAt: now(),
      })
    })

    const newClassCount = Object.keys(classCache).length
    const msg = newClassCount > 0
      ? `${excelPreview.length}명 등록 완료! (수업 ${newClassCount}개 자동 생성)`
      : `${excelPreview.length}명 등록 완료!`
    alert(msg)

    setShowExcel(false); setExcelPreview([]); setExcelStep(1)
    setExcelSchool(''); setExcelClassId(''); setExcelSection('')
  }

  const selectedCls = classes.find(c => c.id === ctxClass)

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader
        title="학생 관리"
        sub="학교 · 과목 · 반을 먼저 선택하고 학생을 관리하세요."
        right={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn variant="ghost" onClick={() => { setExcelStep(0); setShowExcel(true) }}>📊 엑셀 업로드</Btn>
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
            <Input label="학급 반 (학교 소속 반)" value={form.classNum} onChange={v => set('classNum', v)} placeholder="예: 2" />
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
      <Modal open={showExcel} onClose={() => { setShowExcel(false); setExcelPreview([]); setExcelStep(0); setExcelSchool(''); setExcelClassId(''); setExcelSection('') }} title="엑셀 일괄 업로드" width={700}>

        {/* ── 단계 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
          {[{n:0,label:'안내'},{n:1,label:'업로드'},{n:2,label:'확인 후 등록'}].map((s,i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,background:excelStep>=s.n?'#f97316':'#f3f4f6',color:excelStep>=s.n?'#fff':'#9ca3af' }}>{s.n+1}</div>
                <span style={{ fontSize:'13px',color:excelStep===s.n?'#111827':'#9ca3af',fontWeight:excelStep===s.n?700:400 }}>{s.label}</span>
              </div>
              {i<2 && <div style={{ flex:1,height:1,background:excelStep>s.n?'#f97316':'#e5e7eb',maxWidth:40 }} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 0: 안내 */}
        {excelStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7 }}>
              엑셀 파일로 학생을 한번에 등록합니다. <strong>두 가지 방식</strong> 중 선택하세요.
            </div>

            {/* 방식 A */}
            <div style={{ borderRadius: '12px', border: '1.5px solid #86efac', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#f0fdf4', borderBottom: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>방식 A — 수업이 이미 등록된 경우</div>
                  <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '2px' }}>학교·과목·반을 직접 선택 → 이름/학년만 입력하면 끝</div>
                </div>
                <button onClick={downloadSampleSimple} style={{ padding:'7px 14px',borderRadius:'8px',border:'1.5px solid #16a34a',background:'#fff',color:'#16a34a',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif',whiteSpace:'nowrap' }}>📥 샘플 A 다운로드</button>
              </div>
              <div style={{ padding: '12px 16px', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {['학년','학급반(예:2)','번호','이름 ★','학부모전화번호','학생전화번호'].map((c,i) => (
                    <span key={c} style={{ padding:'3px 9px',borderRadius:'5px',fontSize:'12px',fontWeight:600,background:i===3?'#fff7ed':'#f3f4f6',border:i===3?'1.5px solid #fed7aa':'1px solid #e5e7eb',color:i===3?'#c2410c':'#374151' }}>{c}</span>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>6개 컬럼 · 학교/과목은 아래 단계에서 선택</div>
              </div>
            </div>

            {/* 방식 B */}
            <div style={{ borderRadius: '12px', border: '1.5px solid #bfdbfe', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>방식 B — 수업까지 한번에 자동 생성</div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>파일에 학교·과목·반·요일·시간까지 입력 → 수업도 자동 생성</div>
                </div>
                <button onClick={downloadSampleFull} style={{ padding:'7px 14px',borderRadius:'8px',border:'1.5px solid #3b82f6',background:'#fff',color:'#3b82f6',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif',whiteSpace:'nowrap' }}>📥 샘플 B 다운로드</button>
              </div>
              <div style={{ padding: '12px 16px', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[
                    {label:'학교',auto:true},{label:'과목',auto:true},{label:'수업반(A/B)',auto:true},{label:'요일',auto:true},{label:'시작',auto:true},{label:'종료',auto:true},
                    {label:'학년',auto:false},{label:'학급반(2)',auto:false},{label:'번호',auto:false},{label:'이름 ★',auto:false},{label:'학부모전화',auto:false},{label:'학생전화',auto:false},
                  ].map((c,i) => (
                    <span key={i} style={{ padding:'3px 9px',borderRadius:'5px',fontSize:'11px',fontWeight:600,background:c.auto?'#eff6ff':c.label.includes('★')?'#fff7ed':'#f3f4f6',border:c.auto?'1.5px solid #bfdbfe':c.label.includes('★')?'1.5px solid #fed7aa':'1px solid #e5e7eb',color:c.auto?'#1d4ed8':c.label.includes('★')?'#c2410c':'#374151' }}>
                      {c.label}{c.auto?' 🔵':''}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>🔵 = 수업 자동생성에 사용 · 12개 컬럼 | 과목반(A/B) ≠ 학급반(1,2,3)</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <Btn onClick={() => setExcelStep(1)}>다음 →</Btn>
            </div>
          </div>
        )}

        {/* ── Step 1: 학교/과목 선택(방식A) or 바로 파일 업로드(방식B) */}
        {excelStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* 수업 선택 (방식A용, 선택사항) */}
            <div style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1.5px solid #86efac' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', marginBottom: '10px' }}>
                방식 A — 수업 선택 <span style={{ fontWeight:400, color:'#6b7280' }}>(방식 B는 파일에 있으므로 생략 가능)</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display:'flex',flexDirection:'column',gap:'4px',flex:1,minWidth:'130px' }}>
                  <label style={{ fontSize:'12px',fontWeight:600,color:'#374151' }}>학교</label>
                  <select value={excelSchool} onChange={e => { setExcelSchool(e.target.value); setExcelClassId(''); setExcelSection('') }} style={selSt}>
                    <option value="">-- 선택 --</option>
                    {[...new Set(classes.map(c => c.organization).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:'4px',flex:1,minWidth:'130px' }}>
                  <label style={{ fontSize:'12px',fontWeight:600,color:'#374151' }}>과목</label>
                  <select value={excelClassId} onChange={e => { setExcelClassId(e.target.value); setExcelSection('') }} style={selSt}>
                    <option value="">-- 선택 --</option>
                    {classes.filter(c => !excelSchool || c.organization === excelSchool).map(c => (
                      <option key={c.id} value={c.id}>{c.className}{c.section?' '+c.section+'반':''}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:'4px',minWidth:'80px' }}>
                  <label style={{ fontSize:'12px',fontWeight:600,color:'#374151' }}>반</label>
                  <input value={excelSection} onChange={e => setExcelSection(e.target.value)} placeholder="A" style={{ ...selSt, minWidth:'70px' }} />
                </div>
              </div>
              {(excelSchool || excelClassId) && (
                <div style={{ marginTop:'10px', padding:'8px 12px', background:'#fff', borderRadius:'7px', border:'1px solid #86efac', fontSize:'13px', display:'flex', gap:'14px', flexWrap:'wrap' }}>
                  {excelSchool && <span>🏫 <strong>{excelSchool}</strong></span>}
                  {excelClassId && <span>📚 <strong>{classes.find(c=>c.id===excelClassId)?.className}{classes.find(c=>c.id===excelClassId)?.section?' '+classes.find(c=>c.id===excelClassId)?.section+'반':''}</strong></span>}
                  {excelSection && <span>📋 <strong>{excelSection}반</strong></span>}
                </div>
              )}
            </div>

            {/* 파일 업로드 */}
            <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>파일 업로드</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px', lineHeight: 1.7 }}>
                지원 형식: .xlsx, .xls, .csv<br />
                방식A(6컬럼) 또는 방식B(11컬럼) 파일 모두 자동 인식됩니다.
              </div>
              <Btn onClick={() => fileRef.current?.click()}>📂 파일 선택</Btn>
            </div>

            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              <Btn variant="ghost" onClick={() => setExcelStep(0)}>← 안내로</Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: 미리보기 */}
        {excelStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1.5px solid #86efac', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ fontWeight:700,color:'#15803d' }}>✅ 등록 예정</span>
              {excelSchool && <span>🏫 {excelSchool}</span>}
              {excelClassId && <span>📚 {classes.find(c=>c.id===excelClassId)?.className}{classes.find(c=>c.id===excelClassId)?.section?' '+classes.find(c=>c.id===excelClassId)?.section+'반':''}</span>}
              {excelSection && <span>📋 {excelSection}반</span>}
              {excelPreview[0]?.school && !excelSchool && <span style={{color:'#3b82f6'}}>🔵 파일 내 학교/수업 자동생성</span>}
            </div>

            <div style={{ fontSize: '14px', fontWeight: 700 }}>미리보기 ({excelPreview.length}명)</div>

            <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    {['이름','학년','학급반','번호','수업반(자동)','학교(자동)','과목(자동)','시간(자동)'].map(h => (
                      <th key={h} style={{ padding:'8px 10px',textAlign:'left',fontWeight:600,color:h.includes('자동')?'#16a34a':'#6b7280',whiteSpace:'nowrap',borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelPreview.map((r, i) => {
                    const selCls       = classes.find(c => c.id === excelClassId)
                    const dispSchool   = r.school    || excelSchool  || selCls?.organization || '-'
                    const dispSubjectSec = r.subjectSec || excelSection || selCls?.section || ''
                    const dispSubject  = (r.subject  || (selCls ? selCls.className : '') || '-') + (dispSubjectSec ? ' ' + dispSubjectSec + '반' : '')
                    const dispSection  = r.studentClass || r.classNum || '-'
                    const dispTime     = r.timeStart ? (r.timeEnd ? `${r.timeStart}~${r.timeEnd}` : r.timeStart) : (selCls?.time || '-')
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa' }}>
                        <td style={{ padding:'7px 10px',fontWeight:700 }}>{r.name}</td>
                        <td style={{ padding:'7px 10px' }}>{r.grade||'-'}</td>
                        <td style={{ padding:'7px 10px' }}>{r.classNum ? r.classNum+'반' : '-'}</td>
                        <td style={{ padding:'7px 10px' }}>{r.number||'-'}</td>
                        <td style={{ padding:'7px 10px',color:'#8b5cf6',fontWeight:600 }}>{dispSection||'-'}</td>
                        <td style={{ padding:'7px 10px',color:'#16a34a',fontWeight:600 }}>{dispSchool}</td>
                        <td style={{ padding:'7px 10px',color:'#16a34a',fontWeight:600 }}>{dispSubject}</td>
                        <td style={{ padding:'7px 10px',color:'#16a34a' }}>{dispTime}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              <Btn variant="ghost" onClick={() => setExcelStep(1)}>← 다시 선택</Btn>
              <Btn onClick={importExcel}>✅ {excelPreview.length}명 등록 확정</Btn>
            </div>
          </div>
        )}

      </Modal>
    </div>
  )
}

const selSt = {
  padding: '8px 12px', borderRadius: '9px', border: '1.5px solid #e5e7eb',
  fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif',
  background: '#fff', color: '#111827', cursor: 'pointer', outline: 'none',
  minWidth: '160px',
}
