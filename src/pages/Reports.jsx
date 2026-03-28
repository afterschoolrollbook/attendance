import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB } from '../lib/db.js'
import { calcSessionDates, today, fmtDateFull } from '../lib/utils.js'
import { Card, PageHeader, Tag, ProgressBar, EmptyState, Btn } from '../components/Atoms.jsx'
import { ATTENDANCE_STATUS } from '../constants/config.js'
import { AdSlot } from '../components/AdSlot.jsx'

// ── 출석 상태 한글 변환
const STATUS_KR = {
  present: '출석',
  absent: '결석',
  late: '지각',
  early: '조퇴',
  pending: '-',
}

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
    return { ...s, present, absent, late, early, rate, total: pastSessions.length, records }
  })

  const getAttStatus = (studentId, date) => {
    const records = AttendanceDB.byClassDate(selectedClass, date)
    return records.find(r => r.studentId === studentId)?.status || 'pending'
  }

  const recentSessions = pastSessions.slice(-10)

  // ──────────────────────────────────────
  // 엑셀 다운로드
  // ──────────────────────────────────────
  const downloadExcel = async () => {
    if (!cls || students.length === 0) return
    setDownloading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // ── 시트 1: 학생별 출석 요약
      const summaryHeader = ['번호', '이름', '학교', '학년', '반', '전체 차시', '출석', '결석', '지각', '조퇴', '출석률(%)']
      const summaryRows = studentStats.map((s, i) => [
        i + 1, s.name, s.school, s.grade,
        s.classNum ? s.classNum + '반' : '',
        s.total, s.present, s.absent, s.late, s.early, s.rate,
      ])

      const ws1Data = [summaryHeader, ...summaryRows]
      const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
      ws1['!cols'] = [
        {wch:6},{wch:10},{wch:14},{wch:8},{wch:6},
        {wch:8},{wch:6},{wch:6},{wch:6},{wch:6},{wch:10},
      ]
      // 헤더 스타일
      summaryHeader.forEach((_, ci) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: ci })
        if (ws1[cell]) ws1[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'F97316' } }, alignment: { horizontal: 'center' } }
      })
      XLSX.utils.book_append_sheet(wb, ws1, '출석 요약')

      // ── 시트 2: 전체 출석 매트릭스
      const matrixHeader = ['이름', '학년', '반', ...pastSessions.map((d, i) => `${i+1}차\n${d.slice(5)}`), '출석률(%)']
      const matrixRows = studentStats.map(s => {
        const statusCells = pastSessions.map(d => STATUS_KR[getAttStatus(s.id, d)] || '-')
        return [s.name, s.grade, s.classNum ? s.classNum+'반' : '', ...statusCells, s.rate + '%']
      })

      const ws2Data = [matrixHeader, ...matrixRows]
      const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
      const colWidths = [
        {wch:10},{wch:8},{wch:6},
        ...pastSessions.map(() => ({wch:7})),
        {wch:10},
      ]
      ws2['!cols'] = colWidths
      XLSX.utils.book_append_sheet(wb, ws2, '출석 매트릭스')

      // ── 파일명
      const clsName = `${cls.organization}_${cls.className}${cls.section ? '_'+cls.section+'반' : ''}`
      const filename = `출석리포트_${clsName}_${today()}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (e) {
      console.error(e)
      alert('엑셀 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  // ──────────────────────────────────────
  // PDF 인쇄 (브라우저 인쇄 → PDF 저장)
  // ──────────────────────────────────────
  const printPDF = () => {
    if (!cls || students.length === 0) return

    const clsTitle = `${cls.organization} ${cls.className}${cls.section ? ' ' + cls.section + '반' : ''}`
    const avgRate = Math.round(studentStats.reduce((a, s) => a + s.rate, 0) / (studentStats.length || 1))

    const matrixRows = studentStats.map((s, i) => {
      const cells = recentSessions.map(d => {
        const st = getAttStatus(s.id, d)
        const colors = { present:'#bbf7d0', absent:'#fecaca', late:'#fde68a', early:'#ddd6fe', pending:'#f3f4f6' }
        const labels = { present:'○', absent:'✕', late:'지', early:'조', pending:'-' }
        return `<td style="text-align:center;padding:6px 4px;border:1px solid #e5e7eb;background:${colors[st]||'#f3f4f6'};font-size:12px;font-weight:600">${labels[st]||'-'}</td>`
      }).join('')

      const rateColor = s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444'

      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:600">${s.name}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280">${s.grade} ${s.classNum?s.classNum+'반':''}</td>
        ${cells}
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:700;color:${rateColor};text-align:center">${s.rate}%</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center">${s.present}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center;color:#ef4444">${s.absent}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center;color:#f59e0b">${s.late}</td>
      </tr>`
    }).join('')

    const sessionHeaders = recentSessions.map((d, i) => {
      const sessionNum = sessions.indexOf(d) + 1
      return `<th style="padding:8px 4px;border:1px solid #e5e7eb;background:#f97316;color:#fff;font-size:11px;text-align:center;min-width:38px">${sessionNum}차<br><span style="font-weight:400;font-size:10px">${d.slice(5)}</span></th>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>출석 리포트 - ${clsTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans KR', sans-serif; padding: 24px; color: #111; background: #fff; }
  .header { margin-bottom: 20px; border-bottom: 3px solid #f97316; padding-bottom: 14px; }
  .title { font-size: 20px; font-weight: 700; color: #111; }
  .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .stats { display: flex; gap: 20px; margin: 14px 0; flex-wrap: wrap; }
  .stat { background: #f9fafb; border-radius: 8px; padding: 10px 16px; }
  .stat-label { font-size: 11px; color: #6b7280; }
  .stat-value { font-size: 20px; font-weight: 700; color: #f97316; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
  th { background: #18181b; color: #fff; padding: 10px 10px; text-align: left; border: 1px solid #374151; }
  @media print {
    body { padding: 10px; }
    @page { margin: 10mm; size: A4 landscape; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="title">📊 출석 리포트 — ${clsTitle}</div>
  <div class="subtitle">출력일: ${fmtDateFull(today())} | 진행 차시: ${pastSessions.length}/${sessions.length} | 평균 출석률: ${avgRate}%</div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-label">전체 학생</div><div class="stat-value">${students.length}명</div></div>
  <div class="stat"><div class="stat-label">평균 출석률</div><div class="stat-value" style="color:#16a34a">${avgRate}%</div></div>
  <div class="stat"><div class="stat-label">진행 차시</div><div class="stat-value">${pastSessions.length}/${sessions.length}</div></div>
  <div class="stat"><div class="stat-label">무결석 학생</div><div class="stat-value" style="color:#8b5cf6">${studentStats.filter(s=>s.absent===0&&s.total>0).length}명</div></div>
</div>

<table>
  <thead>
    <tr>
      <th style="background:#18181b;min-width:70px">이름</th>
      <th style="background:#18181b;min-width:70px">학년/반</th>
      ${sessionHeaders}
      <th style="background:#f97316;text-align:center;min-width:52px">출석률</th>
      <th style="background:#16a34a;text-align:center;min-width:36px">출석</th>
      <th style="background:#ef4444;text-align:center;min-width:36px">결석</th>
      <th style="background:#f59e0b;text-align:center;min-width:36px">지각</th>
    </tr>
  </thead>
  <tbody>${matrixRows}</tbody>
</table>

<div style="margin-top:16px;font-size:11px;color:#9ca3af">
  ○ 출석 | ✕ 결석 | 지 지각 | 조 조퇴 | - 미처리
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader
        title="출석 리포트"
        sub="수업별 출석 현황을 확인하고 다운로드합니다."
      />
      <AdSlot slotId="report_bottom" />

      {/* 수업 선택 + 다운로드 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer', minWidth: '280px' }}>
          <option value="">-- 수업을 선택하세요 --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
          ))}
        </select>

        {selectedClass && students.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Btn
              variant="ghost"
              onClick={downloadExcel}
              disabled={downloading}
              style={{ display:'flex', alignItems:'center', gap:'6px' }}
            >
              📊 {downloading ? '생성 중...' : '엑셀 다운로드'}
            </Btn>
            <Btn
              variant="ghost"
              onClick={printPDF}
              style={{ display:'flex', alignItems:'center', gap:'6px' }}
            >
              🖨 PDF 인쇄
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
              { label: '전체 학생',   value: students.length, color: '#3b82f6' },
              { label: '진행 차시',   value: `${pastSessions.length}/${sessions.length}`, color: '#f97316' },
              { label: '평균 출석률', value: `${Math.round(studentStats.reduce((a, s) => a + s.rate, 0) / (studentStats.length || 1))}%`, color: '#16a34a' },
              { label: '무결석 학생', value: studentStats.filter(s => s.absent === 0 && s.total > 0).length, color: '#8b5cf6' },
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
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                  출석 현황 (최근 {recentSessions.length}차시)
                </div>
                {pastSessions.length > 10 && (
                  <div style={{ fontSize:'12px', color:'#9ca3af' }}>최근 10차시 표시 중 / 전체 {pastSessions.length}차시</div>
                )}
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
                          <td key={d} style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', fontSize: '16px', background: status !== 'pending' ? cfg?.bg : undefined }}>
                            {cfg?.emoji || '-'}
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
