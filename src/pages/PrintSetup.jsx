import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Templates } from '../lib/db.js'
import { calcSessionDates, today, fmtDate } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, EmptyState } from '../components/Atoms.jsx'
import { can, FEATURES } from '../constants/permissions.js'
import { useToast } from '../hooks/useToast.js'

// 출석 체크 칸 기호
const BLANK = ''

export function PrintSetup({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [step, setStep] = useState(1)
  const [downloading, setDownloading] = useState('')
  const [checkedDates, setCheckedDates] = useState(null)  // null=전체, Set=명시적 선택
  const [selectMode, setSelectMode] = useState('term')  // 'all' | 'term' | 'quarter' | 'session'
  const { error: toastError } = useToast()

  if (!can(user, FEATURES.PRINT_ATTENDANCE)) {
    return (
      <div style={{ padding: '28px' }}>
        <EmptyState icon="🔒" title="인증이 필요합니다" desc="출석부 출력은 Lv.2 인증 선생님 이상만 사용할 수 있습니다." />
      </div>
    )
  }

  const DAY_ORDER = ['월','화','수','목','금','토','일']
  const classes = ClassesDB.byTeacher(user.id).slice().sort((a, b) => {
    const orgCmp = (a.organization||'').localeCompare(b.organization||'', 'ko')
    if (orgCmp !== 0) return orgCmp
    const aDay = DAY_ORDER.indexOf(a.days?.[0] ?? '')
    const bDay = DAY_ORDER.indexOf(b.days?.[0] ?? '')
    const dayCmp = (aDay===-1?99:aDay) - (bDay===-1?99:bDay)
    if (dayCmp !== 0) return dayCmp
    return (a.section||'').localeCompare(b.section||'', 'ko')
  })
  const cls = classes.find(c => c.id === selectedClass)

  // 학생 정렬: 학년 → 반 → 번호 → 이름 ㄱㄴㄷ
  const rawStudents = selectedClass ? StudentsDB.confirmed(selectedClass) : []
  const students = rawStudents.slice().sort((a, b) => {
    const ga = parseInt(a.grade) || 0, gb = parseInt(b.grade) || 0
    if (ga !== gb) return ga - gb
    const ca = parseInt(a.classNum) || 0, cb = parseInt(b.classNum) || 0
    if (ca !== cb) return ca - cb
    const na = parseInt(a.number) || 0, nb = parseInt(b.number) || 0
    if (na !== nb) return na - nb
    return (a.name||'').localeCompare(b.name||'', 'ko')
  })

  const allSessions = cls ? calcSessionDates(cls) : []

  // ── 실제 수업일 계산 (ClassCalendar와 동일 로직)
  const cancelled = new Set((cls?.cancelledDates || []).map(c => c.date))
  const makeupDates = cls?.makeupDates || []
  const totalCap = cls?.totalSessions ? Number(cls.totalSessions) : null
  const regularDates = (totalCap ? allSessions.slice(0, totalCap) : allSessions)
    .filter(d => !cancelled.has(d))
  const makeupSessionDates = makeupDates.map(m => m.date)
  const actualSessionDates = [...new Set([...regularDates, ...makeupSessionDates])].sort()

  // ── 텀 그룹 계산 (ClassCalendar와 동일 로직)
  const termSizes = cls
    ? (cls.termSizes?.length > 0
        ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
        : [cls.termSize ? Number(cls.termSize) : actualSessionDates.length])
    : []
  const termGroups = (() => {
    const baseSessions = totalCap ? allSessions.slice(0, totalCap) : allSessions
    const groups = []
    let cursor = 0
    termSizes.forEach((size, ti) => {
      const termDates = baseSessions.slice(cursor, cursor + size).filter(d => !cancelled.has(d))
      if (termDates.length > 0) groups.push({ num: ti + 1, dates: termDates })
      cursor += size
    })
    if (cursor < baseSessions.length) {
      const rest = baseSessions.slice(cursor).filter(d => !cancelled.has(d))
      if (rest.length > 0) groups.push({ num: groups.length + 1, dates: rest })
    }
    if (makeupSessionDates.length > 0) {
      if (groups.length === 0) groups.push({ num: 1, dates: [] })
      groups[groups.length - 1].dates = [...groups[groups.length - 1].dates, ...makeupSessionDates].sort()
    }
    return groups
  })()

  // ── 분기 그룹 계산 (학기 기준)
  const QUARTER_DEFS = [
    { label: '1학기', months: [3,4,5,6,7,8] },
    { label: '2학기', months: [9,10,11,12,1,2] },
  ]
  const quarterGroups = QUARTER_DEFS.map(q => ({
    label: q.label,
    dates: actualSessionDates.filter(d => q.months.includes(parseInt(d.slice(5,7)))),
  })).filter(q => q.dates.length > 0)

  // ── 선택된 날짜 최종 (전체 모드=null이면 전체, 아니면 명시 Set)
  const sessions = (selectMode === 'all' || checkedDates === null)
    ? actualSessionDates
    : actualSessionDates.filter(d => checkedDates.has(d))

  // 수업에 직접 등록한 templateFiles + Templates.bySchool 통합
  const dbTemplates = cls ? Templates.bySchool(cls.organization) : []
  const clsTemplates = (cls?.templateFiles || []).map((f, i) => {
    const url = f.url || f.fileData || ''
    const ext = url.split('?')[0].split('.').pop().toLowerCase()
    const fileType = f.fileType || (ext === 'pdf' ? 'pdf' : ext === 'hwp' || ext === 'hwpx' ? 'hwp' : 'xlsx')
    return {
      id: 'cls_' + (f.docId || url || i),
      templateName: f.name || f.fileName || '양식 ' + (i+1),
      fileType,
      url,
      fromClass: true,
    }
  })
  const templates = [
    ...clsTemplates,
    ...dbTemplates.filter(t => !clsTemplates.some(ct => ct.id === 'cls_' + t.id)),
  ]

  const tmpl = templates.find(t => t.id === selectedTemplate) || templates[0]

  // ─── PDF 양식 자동 채우기 (pdf.js 렌더 + 학생 데이터 오버레이)
  const downloadFilledPdf = async () => {
    const selTmpl = templates.find(t => t.id === selectedTemplate)
    if (!selTmpl?.url || !cls || !students.length) return
    setDownloading('pdf_fill')
    try {
      // pdf.js 동적 로드
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script) })
      const pdfjsLib = window['pdfjs-dist/build/pdf']
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      // PDF 로드
      const pdfData = await fetch(selTmpl.url).then(r => r.arrayBuffer())
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise
      const page = await pdfDoc.getPage(1)

      // A4 가로 고해상도 렌더
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const bgImage = canvas.toDataURL('image/png')
      const pW = viewport.width, pH = viewport.height

      // 텍스트 위치 분석 → 헤더행 Y 좌표 자동 탐지
      const textContent = await page.getTextContent()
      const items = textContent.items

      // 키워드로 헤더 위치 탐색 (이름, 연번, 학년 등)
      const keywords = ['이름', '연번', '학년', '번호', '성명']
      let headerY = null
      for (const kw of keywords) {
        const found = items.find(it => it.str.trim() === kw || it.str.includes(kw))
        if (found) {
          // pdf.js 좌표는 하단 기준 → 상단 기준으로 변환
          headerY = pH - found.transform[5] * 2  // scale 2 반영
          break
        }
      }
      if (!headerY) headerY = pH * 0.18  // 기본값: 상단 18% 지점

      const rowH = Math.max(18, Math.min(28, (pH - headerY - 40) / Math.max(students.length, 1)))
      const firstDataY = headerY + rowH + 4

      // 학생 행 HTML
      const studentRowsHtml = students.map((s, i) => `
        <tr style="height:${rowH}px">
          <td>${i+1}</td>
          <td>${s.grade||''}</td>
          <td>${s.classNum||''}</td>
          <td>${s.number||''}</td>
          <td style="font-weight:600;text-align:left;padding-left:3px">${s.name}</td>
          <td style="font-size:8px">${s.parentPhone||''}</td>
          <td>${cls.days?.join('·')||''}</td>
          ${sessions.map(()=>'<td></td>').join('')}
          <td></td>
          <td></td>
        </tr>`).join('')

      const colWidths = [28, 36, 28, 28, 60, 80, 28, ...sessions.map(()=>24), 44, 60]
      const totalW = colWidths.reduce((a,b)=>a+b,0)
      const scaleX = pW / totalW

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${cls.organization} ${cls.className} 출석부</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-family:'맑은 고딕','Noto Sans KR',sans-serif; }
  html,body { width:${pW}px; }
  .page { position:relative; width:${pW}px; height:${pH}px; }
  .bg { position:absolute; top:0; left:0; width:${pW}px; height:${pH}px; }
  .data-overlay { position:absolute; top:${firstDataY}px; left:0; width:${pW}px; }
  table { border-collapse:collapse; font-size:${Math.max(7, Math.min(10, rowH*0.55))}px;
          table-layout:fixed; width:${pW}px; }
  td { text-align:center; overflow:hidden; white-space:nowrap; padding:0 1px;
       vertical-align:middle; }
  ${colWidths.map((w,i)=>`td:nth-child(${i+1}){width:${Math.round(w*scaleX)}px}`).join('\n')}
  @media print {
    html,body{width:${pW}px;}
    @page{size:A4 landscape;margin:0;}
  }
</style></head><body>
<div class="page">
  <img class="bg" src="${bgImage}"/>
  <div class="data-overlay">
    <table><tbody>${studentRowsHtml}</tbody></table>
  </div>
</div>
<div style="margin-top:12px;padding:8px;background:#fffbeb;border:1px solid #f59e0b;font-size:11px;color:#92400e;font-family:sans-serif">
  ⚠️ 데이터 위치가 맞지 않으면 위쪽 여백(현재: ${Math.round(firstDataY)}px)을 조정해주세요.
  <button onclick="adj(-5)" style="margin-left:8px;padding:2px 8px;cursor:pointer">▲ 위로</button>
  <button onclick="adj(5)" style="margin-left:4px;padding:2px 8px;cursor:pointer">▼ 아래로</button>
  <button onclick="window.print()" style="margin-left:16px;padding:4px 12px;background:#f97316;color:#fff;border:none;cursor:pointer;border-radius:4px">🖨️ 인쇄/PDF저장</button>
</div>
<script>
  let offset = 0;
  function adj(d){ offset+=d; document.querySelector('.data-overlay').style.top=(${Math.round(firstDataY)}+offset)+'px'; }
</script>
</body></html>`

      const win = window.open('', '_blank', 'width=1400,height=900')
      win.document.write(html)
      win.document.close()
    } catch(e) {
      toastError('PDF 처리 중 오류: ' + e.message)
      console.error(e)
    } finally {
      setDownloading('')
    }
  }

  // ─── 엑셀 출석부 생성 (HWP 양식 스타일 / 기본 스타일 분기)
  const downloadExcel = async () => {
    if (!cls || !students.length) return
    setDownloading('excel')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const selTmpl = templates.find(t => t.id === selectedTemplate)
      const isHwp = selTmpl?.fileType === 'hwp'
      const className = `${cls.organization} ${cls.className}${cls.section ? ' '+cls.section+'반' : ''}`
      const teacherName = user.name || '선생님'
      const DAY_KR = ['일','월','화','수','목','금','토']

      if (isHwp) {
        // ── 판교초 HWP 분석 기반 완전 동일 구조
        // 22 cols: 연번(0) 학년(1) 반(2) 번호(3) 이름(4) 전화번호(5) 요일(6) 날짜(7-19,13개) 총출석(20) 비고(21)
        // 차시가 13개 초과/미만이면 열 수 자동 조정
        const dateCols = sessions.length  // 실제 차시 수
        const totalCols = 7 + dateCols + 2  // 고정7 + 날짜N + 총출석+비고

        // 행 데이터 구성
        const r0 = Array(totalCols).fill('')  // 제목
        r0[0] = `(      ${cls.organization}      ${cls.section||''}반 )  학 생 출 석 부`

        const r1 = Array(totalCols).fill('')  // 기간/강사
        r1[0] = ` • 기간 :  ${cls.startDate} ~ ${cls.endDate}                    • 강사명 :    (인)`

        const r2 = Array(totalCols).fill('')  // 헤더1 (RowSpan=2 항목)
        r2[0]='연번'; r2[1]='학년'; r2[2]='반'; r2[3]='번호'; r2[4]='이름'; r2[5]='전화번호'
        r2[6]='요일'  // row1에서 RowSpan=1 → 두 행 모두 컨텐츠
        // cols 7~6+dateCols: 날짜 영역 — 헤더1행은 비워둠 (row2에서 채움)
        r2[7 + dateCols] = '총출석일수'
        r2[7 + dateCols + 1] = '비고\n(지각·결석 사유)'

        const r3 = Array(totalCols).fill('')  // 헤더2 (날짜 서브헤더)
        r3[6] = '날짜'  // 요일 컬럼 하단에 날짜 라벨
        sessions.forEach((d, i) => {
          const dow = DAY_KR[new Date(d+'T00:00:00').getDay()]
          r3[7 + i] = `${d.slice(5)}(${dow})`
        })

        const studentRows = students.map((s, i) => {
          const row = Array(totalCols).fill('')
          row[0] = i + 1
          row[1] = s.grade || ''
          row[2] = s.classNum || ''
          row[3] = s.number || ''
          row[4] = s.name || ''
          row[5] = s.parentPhone || ''
          row[6] = cls.days?.join('·') || ''
          sessions.forEach((_, j) => { row[7 + j] = '' })
          return row
        })

        const rTotal = Array(totalCols).fill('')  // 계 행
        rTotal[0] = '계'
        rTotal[5] = `${students.length}명`

        const allRows = [r0, r1, r2, r3, ...studentRows, rTotal]
        const ws = XLSX.utils.aoa_to_sheet(allRows)

        // ── 셀 병합 (HWP 원본 구조 완전 재현)
        const sn = 4 + students.length  // 계 행 인덱스
        ws['!merges'] = [
          {s:{r:0,c:0}, e:{r:0,c:totalCols-1}},          // 제목 전체
          {s:{r:1,c:0}, e:{r:1,c:totalCols-1}},          // 기간 전체
          {s:{r:2,c:0}, e:{r:3,c:0}},                    // 연번 (RowSpan=2)
          {s:{r:2,c:1}, e:{r:3,c:1}},                    // 학년 (RowSpan=2)
          {s:{r:2,c:2}, e:{r:3,c:2}},                    // 반 (RowSpan=2)
          {s:{r:2,c:3}, e:{r:3,c:3}},                    // 번호 (RowSpan=2)
          {s:{r:2,c:4}, e:{r:3,c:4}},                    // 이름 (RowSpan=2)
          {s:{r:2,c:5}, e:{r:3,c:5}},                    // 전화번호 (RowSpan=2)
          // col 6 요일/날짜: RowSpan=1 (두 행 모두 내용 있음 — 병합 없음)
          {s:{r:2,c:7+dateCols}, e:{r:3,c:7+dateCols}},  // 총출석일수 (RowSpan=2)
          {s:{r:2,c:8+dateCols}, e:{r:3,c:8+dateCols}},  // 비고 (RowSpan=2)
          {s:{r:sn,c:0}, e:{r:sn,c:4}},                  // 계 (cols 0-4 merge)
        ]

        // ── 열 너비 (HWP Width 기준 비례)
        ws['!cols'] = [
          {wch:6},   // 연번  (2092)
          {wch:7},   // 학년  (2092)
          {wch:5},   // 반    (2092)
          {wch:6},   // 번호  (2092)
          {wch:12},  // 이름  (5452)
          {wch:15},  // 전화번호 (8140)
          {wch:6},   // 요일  (1817)
          ...sessions.map(()=>({wch:8})),  // 날짜 각 1817
          {wch:8},   // 총출석일수 (1817)
          {wch:18},  // 비고 (4570)
        ]

        // ── 행 높이
        ws['!rows'] = [
          {hpt:30},  // 제목
          {hpt:22},  // 기간
          {hpt:30},  // 헤더1
          {hpt:25},  // 헤더2(날짜)
          ...studentRows.map(()=>({hpt:22})),
          {hpt:22},  // 계
        ]

        XLSX.utils.book_append_sheet(wb, ws, '학생출석부')
        const filename = `${cls.organization}_${cls.className}${cls.section?'_'+cls.section+'반':''}_출석부_${today()}.xlsx`
        XLSX.writeFile(wb, filename)

      } else {
        // ── 기본 양식 레이아웃
        const infoRows = [
          [`${className} 출석부`],
          [`강사명: ${teacherName}`, '', `수업기간: ${cls.startDate} ~ ${cls.endDate}`, '', `출력일: ${today()}`],
          [],
        ]
        const sessionHeader1 = ['번호', '이름', '학년', '반', '학부모 전화', ...sessions.map((_,i)=>`${i+1}차`), '출석', '결석', '비고']
        const sessionHeader2 = ['', '', '', '', '', ...sessions.map(d=>d.slice(5)), '', '', '']
        const studentRows = students.map((s,i) => [
          s.number||(i+1), s.name, s.grade,
          s.classNum ? s.classNum+'반' : '',
          s.parentPhone||'',
          ...sessions.map(()=>''),
          '', '', '',
        ])
        const ws = XLSX.utils.aoa_to_sheet([...infoRows, sessionHeader1, sessionHeader2, ...studentRows])
        ws['!cols'] = [{wch:5},{wch:10},{wch:8},{wch:5},{wch:14},...sessions.map(()=>({wch:5})),{wch:5},{wch:5},{wch:12}]
        ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:4+sessions.length+2} }]
        XLSX.utils.book_append_sheet(wb, ws, '출석부')

        const rosterRows = students.map((s,i) => [
          s.number||(i+1), s.name, s.grade,
          s.classNum ? s.classNum+'반' : '',
          s.parentPhone||'', s.studentPhone||'', s.memo||'',
        ])
        const ws2 = XLSX.utils.aoa_to_sheet([['번호','이름','학년','반','학부모 전화','학생 전화','비고'],...rosterRows])
        ws2['!cols'] = [{wch:5},{wch:10},{wch:8},{wch:5},{wch:14},{wch:14},{wch:20}]
        XLSX.utils.book_append_sheet(wb, ws2, '학생 명단')

        XLSX.writeFile(wb, `${className}_출석부_${today()}.xlsx`)
      }
    } catch (e) {
      toastError('엑셀 생성 중 오류가 발생했습니다.')
      console.error(e)
    } finally {
      setDownloading('')
    }
  }

  // ─── PDF 출석부 (브라우저 인쇄)
  const downloadPDF = () => {
    if (!cls || !students.length) return
    setDownloading('pdf')

    const selTmpl = templates.find(t => t.id === selectedTemplate)
    const isHwp = selTmpl?.fileType === 'hwp'
    const className = `${cls.organization} ${cls.className}${cls.section ? ' '+cls.section+'반' : ''}`
    const teacherName = user.name || '선생님'
    const DAY_KR = ['일','월','화','수','목','금','토']

    let tableHtml = ''

    if (isHwp) {
      // HWP 양식 레이아웃
      const sessionThs = sessions.map((d,i) =>
        `<th class="sess">${i+1}차<br><span class="dt">${d.slice(5)}</span></th>`
      ).join('')
      const studentTrs = students.map((s,idx) => `
        <tr>
          <td class="center">${idx+1}</td>
          <td class="center">${s.grade||''}</td>
          <td class="center">${s.classNum||''}</td>
          <td class="center">${s.number||''}</td>
          <td class="name">${s.name}</td>
          <td>${s.parentPhone||''}</td>
          <td class="center">${cls.days?.join('·')||''}</td>
          ${sessions.map(()=>'<td class="center chk"></td>').join('')}
          <td class="center"></td>
          <td></td>
        </tr>`).join('')

      tableHtml = `
        <h1>( ${cls.organization}  ${cls.section||''}반 )  학생출석부</h1>
        <div class="info">
          <span>기간: ${cls.startDate} ~ ${cls.endDate}</span>
          <span>강사명: ${teacherName} (인)</span>
          <span>출력일: ${today()}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:28px">연번</th>
              <th style="width:40px">학년</th>
              <th style="width:28px">반</th>
              <th style="width:28px">번호</th>
              <th class="wide">이름</th>
              <th class="wide">전화번호</th>
              <th style="width:32px">요일</th>
              ${sessionThs}
              <th style="width:50px">총출석일수</th>
              <th class="wide">비고 (지각·결석 사유)</th>
            </tr>
          </thead>
          <tbody>${studentTrs}</tbody>
        </table>`
    } else {
      const sessionThs = sessions.map((d,i) =>
        `<th class="sess">${i+1}차<br><span class="dt">${d.slice(5)}</span></th>`
      ).join('')
      const studentTrs = students.map((s,idx) => `
        <tr>
          <td class="center">${s.number||idx+1}</td>
          <td class="name">${s.name}</td>
          <td class="center">${s.grade}</td>
          <td class="center">${s.classNum ? s.classNum+'반' : ''}</td>
          <td>${s.parentPhone||''}</td>
          ${sessions.map(()=>'<td class="center chk"></td>').join('')}
          <td class="center"></td>
          <td class="center"></td>
          <td></td>
        </tr>`).join('')
      tableHtml = `
        <h1>${className} 출석부</h1>
        <div class="info">
          <span>강사: ${teacherName}</span>
          <span>수업기간: ${cls.startDate} ~ ${cls.endDate}</span>
          <span>총 ${sessions.length}차시 (선택)</span>
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
          <tbody>${studentTrs}</tbody>
        </table>`
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${className} 출석부</title>
<style>
  * { font-family: '맑은 고딕', 'Noto Sans KR', Arial, sans-serif; box-sizing:border-box; margin:0; padding:0; }
  body { padding:12px; font-size:11px; color:#111; }
  h1 { font-size:15px; font-weight:700; text-align:center; margin-bottom:6px; }
  .info { display:flex; justify-content:space-between; font-size:10px; color:#555; margin-bottom:10px; padding:5px 8px; background:#f9f9f9; border:1px solid #ddd; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:#e8e8e8; padding:4px 3px; border:1px solid #999; font-weight:700; text-align:center; }
  td { border:1px solid #ccc; padding:4px 3px; }
  td.center { text-align:center; }
  td.name { font-weight:600; }
  td.chk { font-size:12px; color:#aaa; text-align:center; }
  th.sess { font-size:9px; min-width:26px; }
  th.wide { min-width:50px; }
  .dt { font-size:8px; font-weight:400; color:#777; }
  tr:nth-child(even) td { background:#f8f8f8; }
  @media print { body{padding:5px;} @page{margin:8mm; size:A4 landscape;} }
</style></head>
<body>${tableHtml}
<div style="margin-top:10px;font-size:9px;color:#aaa;text-align:right;">방과후 출석부 시스템</div>
</body></html>`

    const win = window.open('', '_blank', 'width=1200,height=800')
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print(); setDownloading('') }
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
          onChange={e => { setSelectedClass(e.target.value); setStep(2); setSelectedTemplate(''); setCheckedDates(null); setSelectMode('term') }}
          style={{ width: '100%', padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
          <option value="">-- 수업을 선택하세요 --</option>
          {(() => {
            const groups = []
            let lastOrg = null
            classes.forEach(c => {
              if (c.organization !== lastOrg) {
                groups.push({ type: 'group', label: c.organization })
                lastOrg = c.organization
              }
              groups.push({ type: 'option', cls: c })
            })
            return groups.map((g, i) =>
              g.type === 'group'
                ? <optgroup key={'g'+i} label={g.label} />
                : <option key={g.cls.id} value={g.cls.id}>
                    {g.cls.className}{g.cls.section ? ' ' + g.cls.section + '반' : ''}
                    {g.cls.days?.length ? ' (' + g.cls.days.join('') + ')' : ''}
                  </option>
            )
          })()}
        </select>
        {cls && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Tag color="#3b82f6" bg="#eff6ff">확정 학생 {students.length}명</Tag>
            <Tag color="#f97316" bg="#fff7ed">총 {actualSessionDates.length}차시</Tag>
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
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>.{t.fileType} 형식{t.fromClass ? ' · 수업 등록 양식' : ''}</div>
                  </div>
                  <Tag color="#16a34a" bg="#dcfce7" style={{ marginLeft: 'auto' }}>{t.fromClass ? '수업 등록' : '사용 가능'}</Tag>
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

      {/* Step 3: 날짜 선택 + 출력 */}
      {selectedClass && (selectedTemplate || templates.length === 0) && (
        <Card>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>③ 출력 기간 & 다운로드</div>

          {/* ── 출력 기간 선택 모드 ── */}
          <div style={{ marginBottom:'16px' }}>
            {/* 모드 탭 */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
              {[
                { key:'all',     label:'📋 전체' },
                ...(termGroups.length > 1 ? [{ key:'term',    label:'📦 텀별' }] : []),
                ...(quarterGroups.length > 1 ? [{ key:'quarter', label:'🗓 학기별' }] : []),
                { key:'session', label:'🔢 차시별' },
              ].map(m => (
                <button key={m.key} onClick={() => { setSelectMode(m.key); setCheckedDates(m.key === 'all' ? null : new Set()) }}
                  style={{ padding:'6px 14px', borderRadius:'20px', border:`1.5px solid ${selectMode===m.key?'#f97316':'#e5e7eb'}`,
                    background:selectMode===m.key?'#fff7ed':'#f9fafb', fontSize:'12px', fontWeight:selectMode===m.key?700:400,
                    color:selectMode===m.key?'#f97316':'#6b7280', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* 전체 모드 */}
            {selectMode === 'all' && (
              <div style={{ padding:'14px 16px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'10px', fontSize:'13px', color:'#92400e' }}>
                ✅ 전체 <strong>{actualSessionDates.length}차시</strong> 출력
                <span style={{ color:'#d97706', marginLeft:'8px' }}>({actualSessionDates[0]?.slice(5,7).replace(/^0/,'')}/{actualSessionDates[0]?.slice(8).replace(/^0/,'')} ~ {actualSessionDates[actualSessionDates.length-1]?.slice(5,7).replace(/^0/,'')}/{actualSessionDates[actualSessionDates.length-1]?.slice(8).replace(/^0/,'')})</span>
              </div>
            )}

            {/* 텀별 모드 */}
            {selectMode === 'term' && (
              <div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'10px' }}>
                  {termGroups.map((tg, ti) => {
                    const TERM_COLORS = ['#f97316','#16a34a','#3b82f6','#a855f7','#f43f5e','#eab308']
                    const color = TERM_COLORS[ti % TERM_COLORS.length]
                    const allIn = tg.dates.every(d => checkedDates?.has(d))
                    const someIn = tg.dates.some(d => checkedDates?.has(d))
                    return (
                      <button key={tg.num} onClick={() => {
                        const next = new Set(checkedDates)
                        if (allIn) tg.dates.forEach(d => next.delete(d))
                        else tg.dates.forEach(d => next.add(d))
                        setCheckedDates(next)
                      }} style={{ padding:'10px 18px', borderRadius:'10px', border:`2px solid ${allIn||someIn?color:'#e5e7eb'}`,
                        background:allIn?color:someIn?color+'22':'#f9fafb',
                        color:allIn?'#fff':someIn?color:'#6b7280',
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s', textAlign:'left' }}>
                        <div style={{ fontSize:'14px', fontWeight:700 }}>{tg.num}텀</div>
                        <div style={{ fontSize:'11px', opacity:0.85, marginTop:'2px' }}>
                          {tg.dates.length}차시 · {tg.dates[0]?.slice(5,7).replace(/^0/,'')}/{tg.dates[0]?.slice(8).replace(/^0/,'')}~{tg.dates[tg.dates.length-1]?.slice(5,7).replace(/^0/,'')}/{tg.dates[tg.dates.length-1]?.slice(8).replace(/^0/,'')}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize:'11px', color:'#9ca3af' }}>여러 텀 동시 선택 가능 · 클릭으로 선택/해제</div>
              </div>
            )}

            {/* 학기별 모드 */}
            {selectMode === 'quarter' && (
              <div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'10px' }}>
                  {quarterGroups.map((qg, qi) => {
                    const colors = ['#3b82f6','#16a34a']
                    const color = colors[qi % colors.length]
                    const allIn = qg.dates.every(d => checkedDates?.has(d))
                    const someIn = qg.dates.some(d => checkedDates?.has(d))
                    return (
                      <button key={qg.label} onClick={() => {
                        const next = new Set(checkedDates)
                        if (allIn) qg.dates.forEach(d => next.delete(d))
                        else qg.dates.forEach(d => next.add(d))
                        setCheckedDates(next)
                      }} style={{ padding:'10px 18px', borderRadius:'10px', border:`2px solid ${allIn||someIn?color:'#e5e7eb'}`,
                        background:allIn?color:someIn?color+'22':'#f9fafb',
                        color:allIn?'#fff':someIn?color:'#6b7280',
                        cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s', textAlign:'left' }}>
                        <div style={{ fontSize:'14px', fontWeight:700 }}>{qg.label}</div>
                        <div style={{ fontSize:'11px', opacity:0.85, marginTop:'2px' }}>
                          {qg.dates.length}차시 · {qg.dates[0]?.slice(5,7).replace(/^0/,'')}/{qg.dates[0]?.slice(8).replace(/^0/,'')}~{qg.dates[qg.dates.length-1]?.slice(5,7).replace(/^0/,'')}/{qg.dates[qg.dates.length-1]?.slice(8).replace(/^0/,'')}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize:'11px', color:'#9ca3af' }}>여러 학기 동시 선택 가능 · 클릭으로 선택/해제</div>
              </div>
            )}

            {/* 차시별 모드 */}
            {selectMode === 'session' && (
              <div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginBottom:'8px' }}>
                  <button onClick={() => setCheckedDates(new Set(actualSessionDates))}
                    style={{ padding:'4px 12px', borderRadius:'6px', border:'1.5px solid #e5e7eb', background:'#f9fafb', fontSize:'12px', color:'#374151', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    전체 선택
                  </button>
                  <button onClick={() => setCheckedDates(new Set())}
                    style={{ padding:'4px 12px', borderRadius:'6px', border:'1.5px solid #e5e7eb', background:'#f9fafb', fontSize:'12px', color:'#374151', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    전체 해제
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', padding:'12px', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb' }}>
                  {actualSessionDates.map((d, i) => {
                    const checked = checkedDates === null || checkedDates.has(d)
                    const isMakeup = makeupSessionDates.includes(d)
                    return (
                      <label key={d} style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px',
                        borderRadius:'8px', cursor:'pointer',
                        border:`1.5px solid ${checked?'#f97316':'#e5e7eb'}`,
                        background:checked?'#fff7ed':'#fff', fontSize:'12px',
                        fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const next = new Set(checkedDates === null ? actualSessionDates : checkedDates)
                            if (e.target.checked) next.add(d)
                            else next.delete(d)
                            setCheckedDates(next)
                          }}
                          style={{ accentColor:'#f97316', width:'14px', height:'14px' }} />
                        <span style={{ fontWeight:600, color:'#f97316' }}>{i+1}차</span>
                        <span style={{ color:'#6b7280' }}>{d.slice(5,7).replace(/^0/,'')}/{d.slice(8).replace(/^0/,'')}</span>
                        {isMakeup && <span style={{ fontSize:'10px', color:'#3b82f6', fontWeight:700 }}>보강</span>}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 선택 결과 요약 */}
            <div style={{ marginTop:'10px', padding:'8px 12px', background:'#f3f4f6', borderRadius:'8px', fontSize:'12px', color:'#6b7280', display:'flex', alignItems:'center', gap:'12px' }}>
              <span>선택된 차시:</span>
              <strong style={{ color:'#f97316', fontSize:'14px' }}>{sessions.length}차시</strong>
              {sessions.length > 0 && (
                <span>{sessions[0].slice(5,7).replace(/^0/,'')}/{sessions[0].slice(8).replace(/^0/,'')} ~ {sessions[sessions.length-1].slice(5,7).replace(/^0/,'')}/{sessions[sessions.length-1].slice(8).replace(/^0/,'')}</span>
              )}
              {sessions.length === 0 && selectMode !== 'all' && (
                <span style={{ color:'#ef4444' }}>⚠️ 선택된 차시 없음 — 텀 또는 차시를 선택하세요</span>
              )}
            </div>
          </div>
          {/* 미리보기 테이블 — 전체 학생 */}
          {students.length > 0 && (
            <div style={{ overflow:'auto', marginBottom:'20px', border:'1px solid #e5e7eb', borderRadius:'10px', maxHeight:'400px' }}>
              <div style={{ fontSize:'13px', fontWeight:600, color:'#374151', padding:'10px 12px 0', position:'sticky', top:0, background:'#fff', zIndex:2 }}>
                미리보기 — 전체 {students.length}명
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead style={{ background:'#f9fafb', position:'sticky', top:'34px', zIndex:1 }}>
                  <tr>
                    {[
                      '번호','학년','반','번호(학급)','이름','학부모전화',
                      ...sessions.map((d,i)=>`${i+1}차\n${d.slice(5,7).replace(/^0/,'')}/${d.slice(8).replace(/^0/,'')}`),
                      '출석','결석','비고'
                    ].map((h,hi)=>(
                      <th key={hi} style={{ padding:'7px 8px', borderBottom:'1px solid #e5e7eb', textAlign:'center', fontWeight:600, color:'#6b7280', whiteSpace:'pre', fontSize:'11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s,i)=>(
                    <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'#fff':'#fafafa' }}>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{i+1}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{s.grade||'-'}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{s.classNum||'-'}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{s.number||'-'}</td>
                      <td style={{ padding:'7px 8px', fontWeight:600 }}>{s.name}</td>
                      <td style={{ padding:'7px 8px' }}>{s.parentPhone||'-'}</td>
                      {sessions.map(d=>(
                        <td key={d} style={{ padding:'7px 8px', textAlign:'center' }}></td>
                      ))}
                      <td style={{ padding:'7px 8px', textAlign:'center' }}></td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}></td>
                      <td style={{ padding:'7px 8px' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 다운로드 버튼 — 양식 파일 형식에 따라 분기 */}
          {students.length === 0 ? (
            <div style={{ padding:'12px 16px', background:'#fef2f2', borderRadius:'8px', fontSize:'13px', color:'#ef4444' }}>
              ⚠️ 확정된 학생이 없습니다. 학생 관리에서 최종 확정 처리를 먼저 하세요.
            </div>
          ) : (() => {
            const selTmpl = templates.find(t => t.id === selectedTemplate)
            const isHwp = selTmpl?.fileType === 'hwp'
            const isPdf = selTmpl?.fileType === 'pdf'

            if (isPdf) {
              return (
                <div>
                  <div style={{ padding:'12px 14px', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:'10px', marginBottom:'12px', fontSize:'13px', color:'#15803d', lineHeight:1.7 }}>
                    📄 PDF 양식을 배경으로 깔고 학생 데이터를 자동으로 위에 입력합니다.<br />
                    위치가 안 맞으면 인쇄 화면에서 <strong>▲▼ 버튼으로 조정</strong> 후 인쇄하세요.
                  </div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
                    <Btn onClick={downloadFilledPdf} disabled={!!downloading}
                      style={{ background:downloading==='pdf_fill'?'#9ca3af':'#16a34a' }}>
                      {downloading==='pdf_fill'?'⏳ PDF 처리 중...':'📄 PDF 양식에 학생 데이터 채워서 출력'}
                    </Btn>
                  </div>
                  <div style={{ fontSize:'12px', color:'#9ca3af' }}>· 인쇄 창에서 "PDF로 저장" 선택하면 파일로 저장됩니다.</div>
                </div>
              )
            }
            if (isHwp) {
              return (
                <div>
                  <div style={{ padding:'12px 14px', background:'#fdf4ff', border:'1.5px solid #d8b4fe', borderRadius:'10px', marginBottom:'12px', fontSize:'13px', color:'#6d28d9', lineHeight:1.7 }}>
                    📝 <strong>HWP 양식 레이아웃</strong>으로 학생 데이터를 자동 채워 Excel 다운로드 또는 PDF 인쇄합니다.<br />
                    원본 HWP 파일도 함께 받을 수 있습니다.
                  </div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
                    {/* TODO: 다운로드 버튼 삭제 구현 예정 */}
                    <Btn onClick={downloadExcel} disabled={!!downloading} style={{ background:downloading==='excel'?'#9ca3af':'#7c3aed' }}>
                      {downloading==='excel'?'⏳ 생성 중...':'📊 HWP 양식 스타일 Excel 다운로드'}
                    </Btn>
                    <Btn variant="ghost" onClick={downloadPDF} disabled={!!downloading} style={{ borderColor:'#7c3aed', color:'#7c3aed' }}>
                      {downloading==='pdf'?'⏳ 준비 중...':'🖨️ HWP 양식 스타일 PDF 인쇄'}
                    </Btn>
                    <Btn variant="ghost" onClick={()=>{ if(selTmpl?.url){ const a=document.createElement('a'); a.href=selTmpl.url; a.download=selTmpl.templateName||'출석부양식.hwp'; a.click() }}} style={{ borderColor:'#9ca3af', color:'#6b7280', fontSize:'12px' }}>
                      원본 HWP 받기
                    </Btn>
                  </div>
                </div>
              )
            }
            return (
              <div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
                  <Btn onClick={downloadExcel} disabled={!!downloading} style={{ background:downloading==='excel'?'#9ca3af':'#16a34a' }}>
                    {downloading==='excel'?'⏳ 생성 중...':'📊 엑셀 다운로드 (.xlsx)'}
                  </Btn>
                  <Btn variant="ghost" onClick={downloadPDF} disabled={!!downloading} style={{ borderColor:'#3b82f6', color:'#3b82f6' }}>
                    {downloading==='pdf'?'⏳ 준비 중...':'🖨️ PDF 인쇄'}
                  </Btn>
                </div>
                <div style={{ fontSize:'12px', color:'#9ca3af', lineHeight:1.7 }}>
                  · 엑셀: 출석부 + 학생 명단 2개 시트 .xlsx<br />
                  · PDF: A4 가로 형식으로 브라우저 인쇄 창 열림
                </div>
              </div>
            )
          })()}
        </Card>
      )}
    </div>
  )
}
