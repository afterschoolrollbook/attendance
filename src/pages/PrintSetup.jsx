import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Templates } from '../lib/db.js'
import { calcSessionDates, today, fmtDate } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, EmptyState } from '../components/Atoms.jsx'
import { can, FEATURES } from '../constants/permissions.js'

// 출석 체크 칸 기호
const BLANK = '□'

export function PrintSetup({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [step, setStep] = useState(1)
  const [downloading, setDownloading] = useState('')   // 'excel' | 'pdf' | ''
  const [periodType, setPeriodType] = useState('all')  // 'all' | 'first10' | 'last10'

  if (!can(user, FEATURES.PRINT_ATTENDANCE)) {
    return (
      <div style={{ padding: '28px' }}>
        <EmptyState icon="🔒" title="인증이 필요합니다" desc="출석부 출력은 Lv.2 인증 선생님 이상만 사용할 수 있습니다." />
      </div>
    )
  }

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)
  const students = selectedClass ? StudentsDB.confirmed(selectedClass) : []
  const allSessions = cls ? calcSessionDates(cls) : []

  // 기간 선택에 따른 실제 출력 차시
  const sessions = (() => {
    if (periodType === 'first10') return allSessions.slice(0, 10)
    if (periodType === 'last10')  return allSessions.slice(-10)
    return allSessions
  })()

  const templates = cls ? Templates.bySchool(cls.organization) : []
  const tmpl = templates.find(t => t.id === selectedTemplate) || templates[0]

  // ─── 엑셀 출석부 실제 생성
  const downloadExcel = async () => {
    if (!cls || !students.length) return
    setDownloading('excel')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const className = `${cls.organization} ${cls.className}${cls.section ? ' '+cls.section+'반' : ''}`
      const teacherName = user.name || '선생님'

      // ── 헤더 정보 행
      const infoRows = [
        [`${className} 출석부`],
        [`강사명: ${teacherName}`, '', `수업기간: ${cls.startDate} ~ ${cls.endDate}`, '', `출력일: ${today()}`],
        [],  // 빈 행 구분
      ]

      // ── 날짜 헤더 행 (차시 번호 + 날짜)
      const sessionHeader1 = ['번호', '이름', '학년', '반', '학부모 전화', ...sessions.map((_, i) => `${i+1}차`), '출석', '결석', '비고']
      const sessionHeader2 = ['', '', '', '', '', ...sessions.map(d => d.slice(5)), '', '', '']

      // ── 학생 데이터 행
      const studentRows = students.map((s, i) => [
        s.number || (i + 1),
        s.name,
        s.grade,
        s.classNum ? s.classNum + '반' : '',
        s.parentPhone || '',
        ...sessions.map(() => BLANK),   // 출석 체크 칸 (□)
        '',  // 출석 합계 (선생님이 직접 기재)
        '',  // 결석 합계
        '',  // 비고
      ])

      const allRows = [...infoRows, sessionHeader1, sessionHeader2, ...studentRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)

      // ── 열 너비 설정
      ws['!cols'] = [
        { wch: 5 },   // 번호
        { wch: 10 },  // 이름
        { wch: 8 },   // 학년
        { wch: 5 },   // 반
        { wch: 14 },  // 학부모 전화
        ...sessions.map(() => ({ wch: 5 })),  // 차시 칸
        { wch: 5 },   // 출석
        { wch: 5 },   // 결석
        { wch: 12 },  // 비고
      ]

      // ── 행 높이 (학생 행은 넉넉하게)
      ws['!rows'] = [
        { hpt: 24 },  // 제목
        { hpt: 18 },  // 정보
        { hpt: 6 },   // 빈행
        { hpt: 20 },  // 헤더1
        { hpt: 18 },  // 헤더2
        ...studentRows.map(() => ({ hpt: 22 })),
      ]

      // ── 셀 스타일 (openpyxl 없이 기본 스타일만)
      // 제목 셀 병합
      const titleRange = { s: { r: 0, c: 0 }, e: { r: 0, c: 4 + sessions.length + 2 } }
      ws['!merges'] = [titleRange]

      XLSX.utils.book_append_sheet(wb, ws, '출석부')

      // ── 시트2: 학생 명단 (참고용)
      const rosterHeader = ['번호', '이름', '학년', '반', '학부모 전화', '학생 전화', '비고']
      const rosterRows = students.map((s, i) => [
        s.number || (i + 1), s.name, s.grade,
        s.classNum ? s.classNum + '반' : '',
        s.parentPhone || '', s.studentPhone || '', s.memo || '',
      ])
      const ws2 = XLSX.utils.aoa_to_sheet([rosterHeader, ...rosterRows])
      ws2['!cols'] = [{wch:5},{wch:10},{wch:8},{wch:5},{wch:14},{wch:14},{wch:20}]
      XLSX.utils.book_append_sheet(wb, ws2, '학생 명단')

      const filename = `${className}_출석부_${today()}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (e) {
      alert('엑셀 생성 중 오류가 발생했습니다.')
      console.error(e)
    } finally {
      setDownloading('')
    }
  }

  // ─── PDF 출석부 (브라우저 인쇄)
  const downloadPDF = () => {
    if (!cls || !students.length) return
    setDownloading('pdf')

    const className = `${cls.organization} ${cls.className}${cls.section ? ' '+cls.section+'반' : ''}`
    const teacherName = user.name || '선생님'

    // 차시 헤더 HTML
    const sessionThs = sessions.map((d, i) =>
      `<th class="sess">${i+1}차<br><span class="dt">${d.slice(5)}</span></th>`
    ).join('')

    // 학생 행 HTML
    const studentTrs = students.map((s, idx) => `
      <tr>
        <td class="center">${s.number || idx+1}</td>
        <td class="name">${s.name}</td>
        <td class="center">${s.grade}</td>
        <td class="center">${s.classNum ? s.classNum+'반' : ''}</td>
        <td>${s.parentPhone || ''}</td>
        ${sessions.map(() => `<td class="center chk">${BLANK}</td>`).join('')}
        <td class="center"></td>
        <td class="center"></td>
        <td></td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${className} 출석부</title>
<style>
  * { font-family: 'Noto Sans KR', '맑은 고딕', Arial, sans-serif; box-sizing: border-box; margin:0; padding:0; }
  body { padding: 16px; font-size: 12px; color: #111; }
  h1 { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 8px; }
  .info { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 14px; padding: 6px 10px; background: #f9f9f9; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f3f4f6; padding: 5px 4px; border: 1px solid #ccc; font-weight: 600; text-align: center; font-size: 11px; }
  td { border: 1px solid #ddd; padding: 5px 4px; }
  td.center { text-align: center; }
  td.name { font-weight: 600; }
  td.chk { font-size: 13px; color: #aaa; }
  th.sess { font-size: 10px; min-width: 30px; }
  .dt { font-size: 9px; font-weight: 400; color: #777; }
  th.wide { min-width: 55px; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 14px; font-size: 10px; color: #999; text-align: right; }
  @media print {
    body { padding: 8px; }
    @page { margin: 10mm; size: A4 landscape; }
  }
</style>
</head>
<body>
<h1>${className} 출석부</h1>
<div class="info">
  <span>강사: ${teacherName}</span>
  <span>수업기간: ${cls.startDate} ~ ${cls.endDate}</span>
  <span>총 ${allSessions.length}차시</span>
  <span>학생 수: ${students.length}명</span>
  <span>출력일: ${today()}</span>
</div>
<table>
  <thead>
    <tr>
      <th style="width:30px">번호</th>
      <th class="wide">이름</th>
      <th style="width:50px">학년</th>
      <th style="width:30px">반</th>
      <th class="wide">학부모 전화</th>
      ${sessionThs}
      <th style="width:30px">출석</th>
      <th style="width:30px">결석</th>
      <th class="wide">비고</th>
    </tr>
  </thead>
  <tbody>
    ${studentTrs}
  </tbody>
</table>
<div class="footer">※ 이 출석부는 방과후 출석부 시스템에서 자동 생성되었습니다.</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=1100,height=750')
    win.document.write(html)
    win.document.close()
    win.onload = () => {
      win.focus()
      win.print()
      setDownloading('')
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <PageHeader title="출석부 출력" sub="AI가 양식을 분석하여 학생 정보와 수업 일정을 자동으로 삽입합니다." />

      {/* 단계 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
        {[
          { n: 1, label: '수업 선택' },
          { n: 2, label: '양식 선택' },
          { n: 3, label: '기간 선택 & 출력' },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: step >= s.n ? '#f97316' : '#f3f4f6',
                color: step >= s.n ? '#fff' : '#9ca3af',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, flexShrink: 0,
              }}>{s.n}</div>
              <span style={{ fontSize: '13px', color: step >= s.n ? '#111827' : '#9ca3af', fontWeight: step === s.n ? 600 : 400 }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: '1px', background: step > s.n ? '#f97316' : '#e5e7eb', maxWidth: '40px' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: 수업 선택 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>① 수업 선택</div>
        <select value={selectedClass}
          onChange={e => { setSelectedClass(e.target.value); setStep(2); setSelectedTemplate('') }}
          style={{ width: '100%', padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
          <option value="">-- 수업을 선택하세요 --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
          ))}
        </select>
        {cls && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Tag color="#3b82f6" bg="#eff6ff">확정 학생 {students.length}명</Tag>
            <Tag color="#f97316" bg="#fff7ed">총 {allSessions.length}차시</Tag>
            <Tag color="#6b7280" bg="#f3f4f6">{cls.startDate} ~ {cls.endDate}</Tag>
          </div>
        )}
      </Card>

      {/* Step 2: 양식 선택 */}
      {selectedClass && (
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>② 출석부 양식</div>
          {templates.length === 0 ? (
            <div style={{ padding: '14px 16px', background: '#fff7ed', borderRadius: '10px', fontSize: '13px', color: '#92400e', lineHeight: 1.7 }}>
              ⚠️ <strong>{cls?.organization}</strong>에 등록된 양식이 없습니다.<br />
              양식 관리에서 먼저 등록하거나, 아래에서 <strong>기본 양식</strong>으로 바로 출력할 수 있습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {templates.map(t => (
                <label key={t.id} style={{
                  padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: selectedTemplate === t.id ? '#f0fdf4' : '#f9fafb',
                  border: `1.5px solid ${selectedTemplate === t.id ? '#86efac' : '#e5e7eb'}`,
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <input type="radio" name="template" value={t.id}
                    checked={selectedTemplate === t.id}
                    onChange={() => { setSelectedTemplate(t.id); setStep(Math.max(step, 3)) }}
                    style={{ accentColor: '#f97316' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{t.templateName}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>.{t.fileType} 형식</div>
                  </div>
                  <Tag color="#16a34a" bg="#dcfce7" style={{ marginLeft: 'auto' }}>사용 가능</Tag>
                </label>
              ))}
            </div>
          )}

          {/* 기본 양식 옵션 (항상 노출) */}
          <div style={{ marginTop: '10px', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', border: '1.5px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', color: '#1e40af' }}>
              📋 <strong>기본 양식으로 출력</strong> — 별도 템플릿 없이 표준 형식으로 바로 출력
            </div>
            <Btn size="sm" onClick={() => { setSelectedTemplate('default'); setStep(Math.max(step, 3)) }}
              style={{ background: '#3b82f6', fontSize: '12px' }}>
              기본 양식 선택
            </Btn>
          </div>
        </Card>
      )}

      {/* Step 3: 기간 선택 + 출력 */}
      {selectedClass && (selectedTemplate || templates.length === 0) && (
        <Card>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>③ 출력 기간 & 다운로드</div>

          {/* 기간 선택 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { key: 'all',     label: `전체 ${allSessions.length}차시` },
              { key: 'first10', label: `앞 10차시 (${allSessions.slice(0,10)[0]?.slice(5)||'-'} ~)` },
              { key: 'last10',  label: `최근 10차시 (~ ${allSessions.slice(-10).slice(-1)[0]?.slice(5)||'-'})` },
            ].map(opt => (
              <button key={opt.key} onClick={() => { setPeriodType(opt.key); setStep(3) }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: periodType === opt.key ? '#f97316' : '#f3f4f6',
                  color: periodType === opt.key ? '#fff' : '#374151',
                  fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
                  fontWeight: periodType === opt.key ? 600 : 400,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
            출력 범위: <strong style={{ color: '#f97316' }}>{sessions.length}차시</strong>
            {sessions[0] && <span style={{ marginLeft: '8px' }}>({sessions[0]} ~ {sessions[sessions.length-1]})</span>}
          </div>

          {/* 미리보기 테이블 */}
          {students.length > 0 && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>미리보기 (앞 5명 · 앞 5차시)</div>
              <div style={{ overflow: 'auto', marginBottom: '20px', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      {['번호', '이름', '학년', '반', '학부모전화', ...sessions.slice(0, 5).map((d, i) => `${i+1}차\n${d.slice(5)}`), '출석', '결석', '비고'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, color: '#6b7280', whiteSpace: 'pre', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 5).map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{s.number || i+1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{s.grade}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{s.classNum || '-'}</td>
                        <td style={{ padding: '8px 10px' }}>{s.parentPhone || '-'}</td>
                        {sessions.slice(0, 5).map(d => (
                          <td key={d} style={{ padding: '8px 10px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>{BLANK}</td>
                        ))}
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#ccc' }}>-</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#ccc' }}>-</td>
                        <td style={{ padding: '8px 10px' }}></td>
                      </tr>
                    ))}
                    {students.length > 5 && (
                      <tr>
                        <td colSpan={10 + Math.min(sessions.length, 5)} style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                          ... 외 {students.length - 5}명 포함
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 다운로드 버튼 */}
          {students.length === 0 ? (
            <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', fontSize: '13px', color: '#ef4444' }}>
              ⚠️ 확정된 학생이 없습니다. 학생 관리에서 최종 확정 처리를 먼저 하세요.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Btn
                onClick={downloadExcel}
                disabled={!!downloading}
                style={{ background: downloading === 'excel' ? '#9ca3af' : '#16a34a' }}
              >
                {downloading === 'excel' ? '⏳ 생성 중...' : '📊 엑셀 다운로드 (.xlsx)'}
              </Btn>
              <Btn
                variant="ghost"
                onClick={downloadPDF}
                disabled={!!downloading}
                style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
              >
                {downloading === 'pdf' ? '⏳ 준비 중...' : '🖨️ PDF 인쇄'}
              </Btn>
            </div>
          )}

          <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.7 }}>
            · 엑셀: 출석부 + 학생 명단 2개 시트로 구성된 .xlsx 파일<br />
            · PDF 인쇄: A4 가로 형식으로 브라우저 인쇄 창 열림 (PDF로 저장 가능)
          </div>
        </Card>
      )}
    </div>
  )
}
