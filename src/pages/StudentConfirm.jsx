import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, TeacherParentLinks } from '../lib/db.js'
import { now, fmtPhone } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, EmptyState, Modal } from '../components/Atoms.jsx'
import { STUDENT_STATUS } from '../constants/config.js'

export function StudentConfirm({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selected, setSelected] = useState(new Set())

  // ✅ 추첨 관련 상태
  const [showLottery, setShowLottery]         = useState(false)   // 추첨 모달
  const [lotteryCount, setLotteryCount]       = useState('')      // 추첨 인원 수
  const [lotteryResult, setLotteryResult]     = useState([])      // 추첨 결과
  const [lotteryDone, setLotteryDone]         = useState(false)   // 추첨 완료 여부
  const [lotteryAnimating, setLotteryAnimating] = useState(false) // 추첨 애니메이션

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)

  // 취소되지 않은 학생 전체
  const students = selectedClass
    ? StudentsDB.byClass(selectedClass).filter(s => s.status !== 'cancelled')
    : []

  // 추첨 대상: applied + selected (아직 confirmed 아닌 학생)
  const lotteryPool = students.filter(s => s.status === 'applied' || s.status === 'selected')
  const confirmedCount = students.filter(s => s.status === 'confirmed').length

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const confirmable = students.filter(s => s.status !== 'confirmed')
    if (selected.size === confirmable.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(confirmable.map(s => s.id)))
    }
  }

  // ✅ 확정 처리 + TeacherParentLinks 연동
  const doConfirm = (ids, memo = '최종 확정') => {
    ids.forEach(id => {
      const s = StudentsDB.find(id)
      if (!s) return
      StudentsDB.update(id, {
        status: 'confirmed',
        statusHistory: [...(s.statusHistory || []), { status: 'confirmed', changedAt: now(), memo }],
      })
      // ✅ 버그수정: 확정 시 학부모-선생님 연결 생성
      TeacherParentLinks.link(user.id, { ...s, status: 'confirmed' }, selectedClass)
    })
  }

  const confirm = () => {
    if (!selected.size) return
    doConfirm([...selected])
    setSelected(new Set())
    alert(`${selected.size}명이 최종 확정되었습니다.`)
  }

  // ✅ 랜덤 추첨 실행
  const runLottery = () => {
    const count = parseInt(lotteryCount)
    if (!count || count <= 0) { alert('추첨 인원을 입력하세요.'); return }
    if (count > lotteryPool.length) { alert(`추첨 대상(${lotteryPool.length}명)보다 많은 인원을 뽑을 수 없습니다.`); return }

    setLotteryAnimating(true)

    // 애니메이션 효과: 0.8초 후 결과 표시
    setTimeout(() => {
      // Fisher-Yates 셔플 후 앞에서 count명 선발
      const pool = [...lotteryPool]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      const winners = pool.slice(0, count)
      const losers  = pool.slice(count)

      setLotteryResult({ winners, losers })
      setLotteryDone(true)
      setLotteryAnimating(false)
    }, 800)
  }

  // ✅ 추첨 결과 적용: 당첨자 → selected, 탈락자 → waiting
  const applyLottery = () => {
    const { winners, losers } = lotteryResult

    winners.forEach(s => {
      StudentsDB.update(s.id, {
        status: 'selected',
        statusHistory: [...(s.statusHistory || []), { status: 'selected', changedAt: now(), memo: '추첨 선발' }],
      })
    })
    losers.forEach(s => {
      StudentsDB.update(s.id, {
        status: 'waiting',
        statusHistory: [...(s.statusHistory || []), { status: 'waiting', changedAt: now(), memo: '추첨 대기' }],
      })
    })

    setShowLottery(false)
    setLotteryDone(false)
    setLotteryResult([])
    setLotteryCount('')
    alert(`추첨 완료! 선발 ${winners.length}명 / 대기 ${losers.length}명`)
  }

  const closeLottery = () => {
    setShowLottery(false)
    setLotteryDone(false)
    setLotteryResult([])
    setLotteryCount('')
    setLotteryAnimating(false)
  }

  const confirmableStudents = students.filter(s => s.status !== 'confirmed')

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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Tag color="#3b82f6"  bg="#eff6ff">총 {students.length}명</Tag>
              <Tag color="#16a34a"  bg="#f0fdf4">확정 {confirmedCount}명</Tag>
              <Tag color="#f97316"  bg="#fff7ed">신청 {lotteryPool.filter(s=>s.status==='applied').length}명</Tag>
              <Tag color="#8b5cf6"  bg="#f5f3ff">대기 {students.filter(s=>s.status==='waiting').length}명</Tag>
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
          {/* 도구 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {selected.size > 0
                ? <span style={{ color: '#f97316', fontWeight: 600 }}>{selected.size}명 선택됨</span>
                : '확정할 학생을 체크하거나 추첨을 실행하세요'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* ✅ 추첨 버튼 */}
              {lotteryPool.length > 0 && (
                <Btn size="sm" variant="outline" onClick={() => { setShowLottery(true); setLotteryDone(false); setLotteryResult([]) }}
                  style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                  🎲 랜덤 추첨
                </Btn>
              )}
              <Btn size="sm" variant="ghost" onClick={toggleAll}>
                {selected.size === confirmableStudents.length && confirmableStudents.length > 0 ? '전체 해제' : '전체 선택'}
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
                    <input type="checkbox"
                      checked={confirmableStudents.length > 0 && selected.size === confirmableStudents.length}
                      onChange={toggleAll}
                      style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }} />
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
                  const isConfirmed = s.status === 'confirmed'
                  return (
                    <tr key={s.id} style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isSelected ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#fafafa',
                      cursor: isConfirmed ? 'default' : 'pointer',
                    }} onClick={() => !isConfirmed && toggle(s.id)}>
                      <td style={{ padding: '12px 16px' }}>
                        {!isConfirmed ? (
                          <input type="checkbox" checked={isSelected} onChange={() => toggle(s.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }}
                            onClick={e => e.stopPropagation()} />
                        ) : (
                          <span style={{ fontSize: '16px' }}>✅</span>
                        )}
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
                        {!isConfirmed ? (
                          <Btn size="sm" onClick={() => { doConfirm([s.id], '개별 확정'); }}>확정</Btn>
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

      {/* ✅ 추첨 모달 */}
      <Modal open={showLottery} onClose={closeLottery} title="🎲 랜덤 추첨" width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 추첨 풀 안내 */}
          <div style={{ padding: '12px 16px', background: '#f5f3ff', borderRadius: '10px', border: '1.5px solid #c4b5fd', fontSize: '14px', color: '#5b21b6' }}>
            추첨 대상: <strong>{lotteryPool.length}명</strong>
            <span style={{ fontSize: '12px', color: '#7c3aed', marginLeft: '8px' }}>
              (신청 {lotteryPool.filter(s=>s.status==='applied').length}명 + 추첨완료 {lotteryPool.filter(s=>s.status==='selected').length}명)
            </span>
          </div>

          {/* 추첨 인원 입력 */}
          {!lotteryDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>선발 인원</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={lotteryCount}
                  onChange={e => setLotteryCount(e.target.value)}
                  placeholder={`최대 ${lotteryPool.length}`}
                  min={1} max={lotteryPool.length}
                  style={{ padding: '10px 14px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '15px', fontFamily: 'Noto Sans KR, sans-serif', width: '120px', outline: 'none', textAlign: 'center', fontWeight: 700 }}
                />
                <span style={{ fontSize: '14px', color: '#6b7280' }}>명을 선발합니다</span>
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                선발되지 않은 {lotteryPool.length - (parseInt(lotteryCount) || 0)}명은 자동으로 <strong>대기자</strong>로 전환됩니다.
              </div>
            </div>
          )}

          {/* 추첨 애니메이션 */}
          {lotteryAnimating && (
            <div style={{ textAlign: 'center', padding: '24px', fontSize: '32px', animation: 'spin 0.5s linear infinite' }}>
              🎲
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '10px', fontFamily: 'Noto Sans KR, sans-serif' }}>추첨 중...</div>
            </div>
          )}

          {/* 추첨 결과 */}
          {lotteryDone && lotteryResult.winners && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 당첨자 */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginBottom: '8px' }}>
                  🎉 선발 ({lotteryResult.winners.length}명)
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {lotteryResult.winners.map(s => (
                    <span key={s.id} style={{ padding: '5px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1.5px solid #86efac', fontSize: '13px', fontWeight: 700, color: '#15803d' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
              {/* 대기자 */}
              {lotteryResult.losers.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', marginBottom: '8px' }}>
                    ⏳ 대기 ({lotteryResult.losers.length}명)
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {lotteryResult.losers.map(s => (
                      <span key={s.id} style={{ padding: '5px 12px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#9ca3af', background: '#f9fafb', padding: '10px 14px', borderRadius: '8px' }}>
                ※ 확인 버튼을 누르면 선발자는 <strong>추첨완료</strong>, 대기자는 <strong>대기</strong> 상태로 변경됩니다.<br />
                이후 최종 확정 버튼으로 수강생을 확정하세요.
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <Btn variant="ghost" onClick={closeLottery}>취소</Btn>
            {!lotteryDone && !lotteryAnimating && (
              <Btn onClick={runLottery}
                style={{ background: '#8b5cf6' }}
                disabled={!lotteryCount || parseInt(lotteryCount) <= 0}>
                🎲 추첨 시작
              </Btn>
            )}
            {lotteryDone && (
              <>
                <Btn variant="ghost" onClick={() => { setLotteryDone(false); setLotteryResult([]) }}>다시 추첨</Btn>
                <Btn onClick={applyLottery}>✅ 결과 적용</Btn>
              </>
            )}
          </div>
        </div>
      </Modal>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
