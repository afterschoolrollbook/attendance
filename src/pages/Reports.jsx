import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB } from '../lib/db.js'
import { calcSessionDates, today, fmtDate } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, ProgressBar, EmptyState } from '../components/Atoms.jsx'
import { ATTENDANCE_STATUS } from '../constants/config.js'
import { AdSlot } from '../components/AdSlot.jsx'

// 출석 상태 → 텍스트 (엑셀용)
const STATUS_TEXT = { present: '출석', absent: '결석', late: '지각', early: '조퇴', pending: '-' }
const STATUS_EMOJI = { present: '✅', absent: '❌', late: '🕐', early: '🔜', pending: '-' }

export function Reports({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [downloading, setDownloading] = useState(false)

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)
  const students = selectedClass ? StudentsDB.confirmed(selectedClass) : []

  const sessions = cls ? calcSessionDates(cls) : []
  const t = today()
  const pastSessions = sessions.filter(d => d <= t)

  // 학생별 출석 통계
  const studentStats = students.map(s => {
    const records = AttendanceDB.byStudentClass(s.id, selectedClass).filter(r => pastSessions.includes(r.date))
    const present = records.filter(r => r.status === 'present').length
    const absent  = records.filter(r => r.status === 'absent').length
    const late    = records.filter(r => r.status === 'late').length
    const early   = records.filter(r => r.status === 'early').length
    const rate    = pastSessions.length > 0 ? Math.round((present + late) / pastSessions.length * 100) : 0
    return { ...s, present, absent, late, early, rate, total: pastSessions.length }
  })

  const getAttStatus = (studentId, date) => {
    const records = AttendanceDB.byClassDate(selectedClass, date)
    return records.find(r => r.studentId === studentId)?.status || 'pending'
  }

  const recentSessions = pastSessions.slice(-10)

  // ─── 엑셀 다운로드
  const downloadExcel = async () => {
    if (!cls || students.length === 0) return
    setDownloading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // ── 시트1: 출석 현황 (매트릭스)
      const headerRow1 = ['이름', '학년', '반', ...pastSessions.map((d, i) => `${i+1}차시\n${d}`), '출석', '결석', '지각', '조퇴', '출석률']
      const dataRows1 = studentStats.map(s => [
        s.name, s.grade, s.classNum || '-',
        ...pastSessions.map(d => STATUS_TEXT[getAttStatus(s.id, d)]),
        s.present, s.absent, s.late, s.early, `${s.rate}%`,
      ])
      const ws1 = XLSX.utils.aoa_to_sheet([headerRow1, ...dataRows1])
      // 열 너비 설정
      ws1['!cols'] = [
        { wch: 10 }, { wch: 8 }, { wch: 6 },
        ...pastSessions.map(() => ({ wch: 7 })),
        { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 },
      ]
      XLSX.utils.book_append_sheet(wb, ws1, '출석현황')

      // ── 시트2: 학생별 통계 요약
      const headerRow2 = ['이름', '학년', '반', '전체 차시', '출석', '결석', '지각', '조퇴', '출석률']
      const dataRows2 = studentStats.map(s => [
        s.name, s.grade, s.classNum || '-',
        s.total, s.present, s.absent, s.late, s.early, `${s.rate}%`,
      ])
      const ws2 = XLSX.utils.aoa_to_sheet([headerRow2, ...dataRows2])
      ws2['!cols'] = [{ wch:10},{wch:8},{wch:6},{wch:10},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10}]
      XLSX.utils.book_append_sheet(wb, ws2, '통계요약')

      const filename = `${cls.organization}_${cls.className}${cls.section ? '_'+cls.section+'반' : ''}_출석리포트_${today()}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (e) {
      alert('엑셀 다운로드 중 오류가 발생했습니다.')
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  // ─── PDF 다운로드 (브라우저 인쇄 기능 활용)
  const downloadPDF = () => {
    if (!cls || students.length === 0) return

    const className = `${cls.organization} ${cls.className}${cls.section ? ' '+cls.section+'반' : ''}`

    // 인쇄용 HTML 생성
    const tableRows = studentStats.map((s, i) => `
      <tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="padding:6px 10px;font-weight:600">${s.name}</td>
        <td style="padding:6px 10px;text-align:center">${s.grade}</td>
        <td style="padding:6px 10px;text-align:center">${s.classNum||'-'}</td>
        ${recentSessions.map(d => {
          const st = getAttStatus(s.id, d)
          const color = st==='present'?'#16a34a':st==='absent'?'#ef4444':st==='late'?'#f59e0b':st==='early'?'#8b5cf6':'#9ca3af'
          return `<td style="padding:6px 10px;text-align:center;color:${color};font-weight:600">${STATUS_EMOJI[st]}</td>`
        }).join('')}
        <td style="padding:6px 10px;text-align:center">${s.present}</td>
        <td style="padding:6px 10px;text-align:center">${s.absent}</td>
        <td style="padding:6px 10px;text-align:center">${s.late}</td>
        <td style="padding:6px 10px;font-weight:700;text-align:center;color:${s.rate>=80?'#16a34a':s.rate>=60?'#f59e0b':'#ef4444'}">${s.rate}%</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${className} 출석 리포트</title>
<style>
  * { font-family: 'Noto Sans KR', Arial, sans-serif; box-sizing: border-box; }
  body { margin: 20px; color: #111; font-size: 13px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  .summary { display: flex; gap: 20px; margin-bottom: 20px; }
  .stat { text-align: center; }
  .stat-val { font-size: 22px; font-weight: 700; }
  .stat-lbl { font-size: 11px; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f3f4f6; padding: 8px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
  th:first-child { text-align: left; }
  td { border-bottom: 1px solid #f3f4f6; font-size: 12px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${className} 출석 리포트</h1>
<div class="sub">출력일: ${today()} | 진행 차시: ${pastSessions.length}/${sessions.length} | 학생 수: ${students.length}명</div>
<div class="summary">
  <div class="stat"><div class="stat-val" style="color:#3b82f6">${students.length}</div><div class="stat-lbl">전체 학생</div></div>
  <div class="stat"><div class="stat-val" style="color:#f97316">${pastSessions.length}/${sessions.length}</div><div class="stat-lbl">진행 차시</div></div>
  <div class="stat"><div class="stat-val" style="color:#16a34a">${Math.round(studentStats.reduce((a,s)=>a+s.rate,0)/(studentStats.length||1))}%</div><div class="stat-lbl">평균 출석률</div></div>
  <div class="stat"><div class="stat-val" style="color:#8b5cf6">${studentStats.filter(s=>s.absent===0&&s.total>0).length}</div><div class="stat-lbl">무결석</div></div>
</div>
<table>
  <thead>
    <tr>
      <th style="text-align:left">이름</th>
      <th>학년</th>
      <th>반</th>
      ${recentSessions.map((d,i)=>`<th>${sessions.indexOf(d)+1}차<br><span style="font-weight:400;font-size:10px">${d.slice(5)}</span></th>`).join('')}
      <th>출석</th><th>결석</th><th>지각</th><th>출석률</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
</body>
</html>`

    const win = window.open('', '_blank', 'width=1000,height=700')
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader title="출석 리포트" sub="수업별 출석 현황을 확인합니다." />
      <AdSlot slotId="report_bottom" />

      {/* 수업 선택 + ✅ 다운로드 버튼 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer', minWidth: '280px' }}>
          <option value="">-- 수업을 선택하세요 --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
          ))}
        </select>

        {/* ✅ 다운로드 버튼 (수업 선택 후 활성화) */}
        {selectedClass && students.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn
              variant="ghost"
              onClick={downloadExcel}
              disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#16a34a', color: '#16a34a' }}
            >
              {downloading ? '⏳ 생성 중...' : '📊 엑셀 다운로드'}
            </Btn>
            <Btn
              variant="ghost"
              onClick={downloadPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#3b82f6', color: '#3b82f6' }}
            >
              🖨️ PDF 인쇄
            </Btn>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <EmptyState icon="📊" title="수업을 선택하세요" desc="리포트를 확인할 수업을 선택하세요." />
      ) : students.length === 0 ? (
        <EmptyState icon="👥" title="확정된 학생이 없습니다" desc="학생 관리에서 최종 확정 처리를 먼저 하세요." />
      ) : (
        <>
          {/* 전체 통계 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: '전체 학생',   value: students.length,                                                                                              color: '#3b82f6' },
              { label: '진행 차시',   value: `${pastSessions.length}/${sessions.length}`,                                                                  color: '#f97316' },
              { label: '평균 출석률', value: `${Math.round(studentStats.reduce((a,s)=>a+s.rate,0)/(studentStats.length||1))}%`,                           color: '#16a34a' },
              { label: '무결석 학생', value: studentStats.filter(s => s.absent === 0 && s.total > 0).length,                                              color: '#8b5cf6' },
            ].map(item => (
              <Card key={item.label}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{item.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: item.color }}>{item.value}</div>
              </Card>
            ))}
          </div>

          {/* 매트릭스 테이블 */}
          {recentSessions.length > 0 && (
            <Card style={{ marginBottom: '24px', overflow: 'auto' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
                출석 현황 (최근 {recentSessions.length}차시)
              </div>
              <table style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280', minWidth: '80px', borderBottom: '1px solid #e5e7eb' }}>이름</th>
                    {recentSessions.map(d => {
                      const sessionNum = sessions.indexOf(d) + 1
                      return (
                        <th key={d} style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #e5e7eb', minWidth: '50px' }}>
                          <div>{sessionNum}차</div>
                          <div style={{ fontSize: '11px', fontWeight: 400 }}>{d.slice(5)}</div>
                        </th>
                      )
                    })}
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>출석률</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>{s.name}</td>
                      {recentSessions.map(d => {
                        const status = getAttStatus(s.id, d)
                        const cfg = ATTENDANCE_STATUS[status]
                        return (
                          <td key={d} style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', fontSize: '16px', background: status !== 'pending' ? cfg.bg : undefined }}>
                            {cfg.emoji}
                          </td>
                        )
                      })}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
                          <ProgressBar value={s.rate} max={100} color={s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444'} height={6} />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444', minWidth: '36px' }}>{s.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 학생별 상세 */}
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>학생별 상세</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {studentStats.map(s => (
                <Card key={s.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{s.name}</div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444' }}>{s.rate}%</span>
                  </div>
                  <ProgressBar value={s.rate} max={100} color={s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444'} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <Tag color="#16a34a" bg="#f0fdf4">출석 {s.present}</Tag>
                    <Tag color="#ef4444" bg="#fef2f2">결석 {s.absent}</Tag>
                    <Tag color="#f59e0b" bg="#fffbeb">지각 {s.late}</Tag>
                    <Tag color="#8b5cf6" bg="#f5f3ff">조퇴 {s.early}</Tag>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>총 {s.total}차시 중</div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
