import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Templates } from '../lib/db.js'
import { calcSessionDates, today } from '../lib/utils.js'
import { Btn, Card, Select, PageHeader, Tag, EmptyState } from '../components/Atoms.jsx'
import { can, FEATURES } from '../constants/permissions.js'

export function PrintSetup({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [step, setStep] = useState(1)
  const [analyzing, setAnalyzing] = useState(false)
  const [preview, setPreview] = useState(false)

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
  const sessions = cls ? calcSessionDates(cls) : []
  const templates = cls ? Templates.bySchool(cls.organization) : []

  const handleAnalyze = () => {
    setAnalyzing(true)
    setTimeout(() => {
      setAnalyzing(false)
      setPreview(true)
    }, 1800)
  }

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <PageHeader title="출석부 출력" sub="AI가 양식을 분석하여 학생 정보와 수업 일정을 자동으로 삽입합니다." />

      {/* 단계 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
        {[
          { n: 1, label: '수업 선택' },
          { n: 2, label: '양식 선택' },
          { n: 3, label: '기간 선택' },
          { n: 4, label: '출력' },
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
            {i < 3 && <div style={{ flex: 1, height: '1px', background: step > s.n ? '#f97316' : '#e5e7eb', maxWidth: '40px' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: 수업 선택 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>① 수업 선택</div>
        <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setStep(2); setPreview(false) }}
          style={{ width: '100%', padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
          <option value="">-- 수업을 선택하세요 --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
          ))}
        </select>
        {cls && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Tag color="#3b82f6" bg="#eff6ff">확정 학생 {students.length}명</Tag>
            <Tag color="#f97316" bg="#fff7ed">총 {sessions.length}차시</Tag>
            <Tag color="#6b7280" bg="#f3f4f6">{cls.startDate} ~ {cls.endDate}</Tag>
          </div>
        )}
      </Card>

      {/* Step 2: 양식 */}
      {selectedClass && (
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>② 출석부 양식</div>
          {templates.length === 0 ? (
            <div style={{ padding: '16px', background: '#fff7ed', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
              ⚠️ {cls?.organization}에 등록된 양식이 없습니다. 양식 관리에서 먼저 등록하세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {templates.map(t => (
                <div key={t.id} style={{ padding: '12px 14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{t.templateName}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>.{t.fileType} 형식</div>
                  </div>
                  <Tag color="#16a34a" bg="#dcfce7">사용 가능</Tag>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Step 3 & 4: 분석 및 출력 */}
      {selectedClass && templates.length > 0 && (
        <Card>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>③ AI 분석 및 출력</div>

          {!preview && !analyzing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7 }}>
                AI가 등록된 양식을 분석하여 다음 내용을 자동으로 삽입합니다:<br />
                학년, 반, 번호, 이름, 학부모 전화번호, 수업 날짜(차시), 수업명/강사명
              </div>
              <Btn onClick={handleAnalyze}>🤖 AI 분석 시작</Btn>
            </div>
          )}

          {analyzing && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⚙️</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>AI가 양식을 분석 중입니다...</div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>셀 위치 매핑, 데이터 삽입 준비 중</div>
              <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
            </div>
          )}

          {preview && (
            <div>
              <div style={{ padding: '14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803d', marginBottom: '8px' }}>✅ 분석 완료</div>
                <div style={{ fontSize: '13px', color: '#16a34a', lineHeight: 1.8 }}>
                  · 학생 {students.length}명 정보 삽입 준비 완료<br />
                  · 수업일 {sessions.filter(d => d <= today()).length}차시 날짜 매핑 완료<br />
                  · 양식: {templates[0].templateName}
                </div>
              </div>

              {/* 미리보기 테이블 */}
              <div style={{ overflow: 'auto', marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      {['번호', '이름', '학년', '반', '학부모전화', ...sessions.slice(0, 5).map((d, i) => `${i+1}차시`)].map(h => (
                        <th key={h} style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 5).map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px' }}>{s.number || i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '8px 12px' }}>{s.grade}</td>
                        <td style={{ padding: '8px 12px' }}>{s.classNum}</td>
                        <td style={{ padding: '8px 12px' }}>{s.parentPhone || '-'}</td>
                        {sessions.slice(0, 5).map(d => (
                          <td key={d} style={{ padding: '8px 12px', textAlign: 'center', color: '#d1d5db' }}>□</td>
                        ))}
                      </tr>
                    ))}
                    {students.length > 5 && (
                      <tr><td colSpan={10} style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>... 외 {students.length - 5}명</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn onClick={() => alert('PDF 다운로드 기능은 Phase 4에서 실제 파일 생성이 지원됩니다.')}>📥 PDF 다운로드</Btn>
                <Btn variant="ghost" onClick={() => alert('엑셀 다운로드 기능은 Phase 4에서 실제 파일 생성이 지원됩니다.')}>📊 엑셀 다운로드</Btn>
                <Btn variant="ghost" onClick={() => window.print()}>🖨️ 인쇄</Btn>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
