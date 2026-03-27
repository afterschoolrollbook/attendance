import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB } from '../lib/db.js'
import { now, fmtPhone } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, EmptyState } from '../components/Atoms.jsx'
import { STUDENT_STATUS } from '../constants/config.js'

export function StudentConfirm({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selected, setSelected] = useState(new Set())

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)

  const students = selectedClass
    ? StudentsDB.byClass(selectedClass).filter(s => s.status !== 'cancelled')
    : []

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === students.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(students.map(s => s.id)))
    }
  }

  const confirm = () => {
    if (!selected.size) return
    selected.forEach(id => {
      const s = StudentsDB.find(id)
      StudentsDB.update(id, {
        status: 'confirmed',
        statusHistory: [...(s.statusHistory || []), { status: 'confirmed', changedAt: now(), memo: '최종 확정' }],
      })
    })
    setSelected(new Set())
    alert(`${selected.size}명이 최종 확정되었습니다.`)
  }

  const confirmedCount = students.filter(s => s.status === 'confirmed').length

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <PageHeader
        title="최종 인원 확정"
        sub="수강 신청 인원 중 최종 수강생을 선택하여 확정합니다."
      />

      {/* 수업 선택 */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', minWidth: 'fit-content' }}>수업 선택</div>
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelected(new Set()) }}
            style={{ flex: 1, maxWidth: '360px', padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
            <option value="">-- 수업을 선택하세요 --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
            ))}
          </select>
          {cls && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Tag color="#3b82f6" bg="#eff6ff">총 {students.length}명</Tag>
              <Tag color="#16a34a" bg="#f0fdf4">확정 {confirmedCount}명</Tag>
              <Tag color="#f97316" bg="#fff7ed">미확정 {students.filter(s => s.status !== 'confirmed').length}명</Tag>
            </div>
          )}
        </div>
      </Card>

      {!selectedClass ? (
        <EmptyState icon="📋" title="수업을 선택하세요" desc="수업을 선택하면 신청 인원 목록이 표시됩니다." />
      ) : students.length === 0 ? (
        <EmptyState icon="👥" title="신청 인원이 없습니다" desc="학생 관리에서 학생을 먼저 등록하세요." />
      ) : (
        <>
          {/* 선택 도구 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {selected.size > 0 ? <span style={{ color: '#f97316', fontWeight: 600 }}>{selected.size}명 선택됨</span> : '확정할 학생을 체크하세요'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn size="sm" variant="ghost" onClick={toggleAll}>
                {selected.size === students.length ? '전체 해제' : '전체 선택'}
              </Btn>
              {selected.size > 0 && (
                <Btn size="sm" onClick={confirm}>✅ {selected.size}명 최종 확정</Btn>
              )}
            </div>
          </div>

          {/* 학생 목록 */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', width: '40px' }}>
                    <input type="checkbox" checked={selected.size === students.length && students.length > 0}
                      onChange={toggleAll} style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }} />
                  </th>
                  {['이름', '학년/반/번호', '학부모 전화', '현재 상태', '작업'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const isSelected = selected.has(s.id)
                  const cfg = STUDENT_STATUS[s.status] || {}
                  return (
                    <tr key={s.id} style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isSelected ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#fafafa',
                      cursor: 'pointer',
                    }} onClick={() => s.status !== 'confirmed' && toggle(s.id)}>
                      <td style={{ padding: '12px 16px' }}>
                        {s.status !== 'confirmed' && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggle(s.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }}
                            onClick={e => e.stopPropagation()} />
                        )}
                        {s.status === 'confirmed' && <span style={{ fontSize: '16px' }}>✅</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', fontSize: '14px' }}>{s.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                        {s.grade} {s.classNum ? s.classNum + '반' : ''} {s.number ? s.number + '번' : ''}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{fmtPhone(s.parentPhone) || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Tag color={cfg.color} bg={cfg.bg}>{cfg.label}</Tag>
                      </td>
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        {s.status !== 'confirmed' ? (
                          <Btn size="sm" onClick={() => {
                            const st = StudentsDB.find(s.id)
                            StudentsDB.update(s.id, {
                              status: 'confirmed',
                              statusHistory: [...(st.statusHistory || []), { status: 'confirmed', changedAt: now(), memo: '개별 확정' }],
                            })
                          }}>확정</Btn>
                        ) : (
                          <Btn size="sm" variant="outlineDanger" onClick={() => {
                            const st = StudentsDB.find(s.id)
                            StudentsDB.update(s.id, {
                              status: 'selected',
                              statusHistory: [...(st.statusHistory || []), { status: 'selected', changedAt: now(), memo: '확정 취소' }],
                            })
                          }}>확정 취소</Btn>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px', fontSize: '13px', color: '#9ca3af' }}>
            * 최종 확정된 학생만 출석부에 표시됩니다. 확정 후에도 개별 수정이 가능합니다.
          </div>
        </>
      )}
    </div>
  )
}
