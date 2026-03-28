import React, { useState, useEffect } from 'react'
import { Classes as ClassesDB, Students as StudentsDB } from '../lib/db.js'
import { now, fmtPhone } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, EmptyState, Modal, Input } from '../components/Atoms.jsx'
import { STUDENT_STATUS } from '../constants/config.js'

// ─────────────────────────────────────────
// 대기자 자동 승격 헬퍼 (외부에서도 사용 가능)
// ─────────────────────────────────────────
export function autoPromoteWaitlist(classId) {
  // confirmed 한 자리 빈 경우: selected → confirmed 자동 승격
  const selected = StudentsDB.byClass(classId)
    .filter(s => s.status === 'selected')
    .sort((a, b) => (a.waitlistOrder || 999) - (b.waitlistOrder || 999) || new Date(a.createdAt) - new Date(b.createdAt))

  if (selected.length > 0) {
    const promoted = selected[0]
    StudentsDB.update(promoted.id, {
      status: 'confirmed',
      waitlistOrder: null,
      statusHistory: [...(promoted.statusHistory || []), {
        status: 'confirmed', changedAt: now(), memo: '대기자 자동 승격 (selected → confirmed)',
      }],
    })
    return { promoted, type: 'selected_to_confirmed' }
  }

  // selected도 없으면: applied → selected 자동 승격 (대기 순서대로)
  const applied = StudentsDB.byClass(classId)
    .filter(s => s.status === 'applied')
    .sort((a, b) => (a.waitlistOrder || 999) - (b.waitlistOrder || 999) || new Date(a.createdAt) - new Date(b.createdAt))

  if (applied.length > 0) {
    const promoted = applied[0]
    StudentsDB.update(promoted.id, {
      status: 'selected',
      waitlistOrder: null,
      statusHistory: [...(promoted.statusHistory || []), {
        status: 'selected', changedAt: now(), memo: '대기자 자동 승격 (applied → selected)',
      }],
    })
    return { promoted, type: 'applied_to_selected' }
  }

  return null
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function StudentConfirm({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [tick, setTick] = useState(0) // 강제 리렌더

  // 추첨 모달
  const [showLottery, setShowLottery] = useState(false)
  const [lotteryCount, setLotteryCount] = useState('')
  const [lotteryResult, setLotteryResult] = useState(null) // { winners, waitlist }

  // 승격 알림 토스트
  const [promotionMsg, setPromotionMsg] = useState('')

  const refresh = () => setTick(t => t + 1)

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)

  const allStudents = selectedClass
    ? StudentsDB.byClass(selectedClass).filter(s => s.status !== 'cancelled')
    : []

  const applied    = allStudents.filter(s => s.status === 'applied').sort((a,b)=>(a.waitlistOrder||999)-(b.waitlistOrder||999)||new Date(a.createdAt)-new Date(b.createdAt))
  const selectedSt = allStudents.filter(s => s.status === 'selected').sort((a,b)=>(a.waitlistOrder||999)-(b.waitlistOrder||999)||new Date(a.createdAt)-new Date(b.createdAt))
  const confirmed  = allStudents.filter(s => s.status === 'confirmed')

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const notConfirmed = allStudents.filter(s => s.status !== 'confirmed')
    if (selected.size === notConfirmed.length) setSelected(new Set())
    else setSelected(new Set(notConfirmed.map(s => s.id)))
  }

  // ── 최종 확정
  const confirm = () => {
    if (!selected.size) return
    selected.forEach(id => {
      const s = StudentsDB.find(id)
      StudentsDB.update(id, {
        status: 'confirmed',
        waitlistOrder: null,
        statusHistory: [...(s.statusHistory || []), { status: 'confirmed', changedAt: now(), memo: '최종 확정' }],
      })
    })
    setSelected(new Set())
    refresh()
  }

  // ── 확정 취소 → 대기자 자동 승격
  const cancelConfirmed = (studentId) => {
    const s = StudentsDB.find(studentId)
    if (!s) return
    StudentsDB.update(studentId, {
      status: 'cancelled',
      statusHistory: [...(s.statusHistory || []), { status: 'cancelled', changedAt: now(), memo: '확정 취소' }],
    })

    const result = autoPromoteWaitlist(selectedClass)
    if (result) {
      const msg = result.type === 'selected_to_confirmed'
        ? `✅ "${StudentsDB.find(result.promoted.id)?.name}" 학생이 대기에서 자동 확정되었습니다.`
        : `📋 "${StudentsDB.find(result.promoted.id)?.name}" 학생이 추첨완료로 자동 승격되었습니다.`
      setPromotionMsg(msg)
      setTimeout(() => setPromotionMsg(''), 4000)
    }
    refresh()
  }

  // ── 추첨 실행
  const runLottery = () => {
    const n = parseInt(lotteryCount)
    if (!n || n <= 0) { alert('모집 인원을 1명 이상 입력하세요.'); return }
    const pool = applied.concat(selectedSt.filter(s => s.status === 'applied')) // applied 전체
    const applicants = StudentsDB.byClass(selectedClass).filter(s => s.status === 'applied' || s.status === 'selected')

    // 현재 selected + confirmed 수 확인
    const currentConfirmed = confirmed.length
    const currentSelected  = selectedSt.length
    const remaining = Math.max(0, n - currentConfirmed - currentSelected)

    if (remaining === 0) {
      alert(`이미 확정 ${currentConfirmed}명 + 추첨완료 ${currentSelected}명 = ${currentConfirmed+currentSelected}명으로 모집 인원(${n}명)이 충족되었습니다.`)
      return
    }

    const available = applied
    if (available.length === 0) { alert('추첨할 신청자가 없습니다.'); return }

    // 랜덤 셔플
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const winners  = shuffled.slice(0, remaining)
    const waitlist = shuffled.slice(remaining)

    setLotteryResult({ winners, waitlist, n, remaining })
  }

  // ── 추첨 결과 확정 저장
  const confirmLottery = () => {
    if (!lotteryResult) return
    const { winners, waitlist } = lotteryResult

    winners.forEach(s => {
      StudentsDB.update(s.id, {
        status: 'selected',
        waitlistOrder: null,
        statusHistory: [...(s.statusHistory || []), { status: 'selected', changedAt: now(), memo: '랜덤 추첨 선발' }],
      })
    })

    waitlist.forEach((s, idx) => {
      StudentsDB.update(s.id, {
        waitlistOrder: idx + 1,
        statusHistory: [...(s.statusHistory || []), { status: 'applied', changedAt: now(), memo: `대기 ${idx+1}번 (추첨 미선발)` }],
      })
    })

    setLotteryResult(null)
    setShowLottery(false)
    setLotteryCount('')
    refresh()
    setPromotionMsg(`🎲 추첨 완료! 선발 ${winners.length}명, 대기 ${waitlist.length}명`)
    setTimeout(() => setPromotionMsg(''), 4000)
  }

  const studentsForTable = allStudents.sort((a, b) => {
    const order = { confirmed: 0, selected: 1, applied: 2, cancelled: 3 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return (a.waitlistOrder || 999) - (b.waitlistOrder || 999) || new Date(a.createdAt) - new Date(b.createdAt)
  })

  return (
    <div style={{ padding: '28px', maxWidth: '960px' }}>
      <PageHeader
        title="최종 인원 확정"
        sub="신청 인원 추첨 및 최종 수강생을 확정합니다."
      />

      {/* 승격 알림 */}
      {promotionMsg && (
        <div style={{
          marginBottom: '16px', padding: '12px 18px',
          background: '#f0fdf4', border: '1.5px solid #86efac',
          borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#15803d',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn .3s ease',
        }}>
          {promotionMsg}
        </div>
      )}

      {/* 수업 선택 */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', minWidth: 'fit-content' }}>수업 선택</div>
          <select value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setSelected(new Set()); setLotteryResult(null) }}
            style={{ flex: 1, maxWidth: '360px', padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
            <option value="">-- 수업을 선택하세요 --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
            ))}
          </select>
          {cls && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Tag color="#6b7280" bg="#f3f4f6">신청 {applied.length}명</Tag>
              <Tag color="#3b82f6" bg="#eff6ff">추첨완료 {selectedSt.length}명</Tag>
              <Tag color="#16a34a" bg="#f0fdf4">확정 {confirmed.length}명</Tag>
            </div>
          )}
        </div>
      </Card>

      {!selectedClass ? (
        <EmptyState icon="📋" title="수업을 선택하세요" desc="수업을 선택하면 신청 인원 목록이 표시됩니다." />
      ) : allStudents.length === 0 ? (
        <EmptyState icon="👥" title="신청 인원이 없습니다" desc="학생 관리에서 학생을 먼저 등록하세요." />
      ) : (
        <>
          {/* ── 추첨 & 일괄 확정 툴바 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '10px', marginBottom: '16px',
            padding: '14px 18px', background: '#fff', borderRadius: '12px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* 추첨 버튼 */}
              {applied.length > 0 && (
                <Btn
                  style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', border:'none' }}
                  onClick={() => setShowLottery(true)}
                >
                  🎲 무작위 추첨
                </Btn>
              )}

              {/* 선택된 학생 일괄 추첨완료로 */}
              {selected.size > 0 && (
                <>
                  <Btn size="sm" variant="ghost"
                    onClick={() => {
                      selected.forEach(id => {
                        const s = StudentsDB.find(id)
                        if (s && s.status !== 'confirmed') {
                          StudentsDB.update(id, {
                            status: 'selected',
                            statusHistory: [...(s.statusHistory||[]), { status:'selected', changedAt:now(), memo:'직접 선발' }]
                          })
                        }
                      })
                      setSelected(new Set()); refresh()
                    }}
                  >✔ {selected.size}명 추첨완료로</Btn>
                  <Btn size="sm" onClick={confirm}>✅ {selected.size}명 최종 확정</Btn>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {selected.size > 0 ? <span style={{ color: '#f97316', fontWeight: 600 }}>{selected.size}명 선택됨</span> : ''}
              </span>
              <Btn size="sm" variant="ghost" onClick={toggleAll}>
                {selected.size === allStudents.filter(s=>s.status!=='confirmed').length && allStudents.filter(s=>s.status!=='confirmed').length > 0 ? '전체 해제' : '전체 선택'}
              </Btn>
            </div>
          </div>

          {/* ── 학생 목록 테이블 */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 14px', width: '40px' }}>
                    <input type="checkbox"
                      checked={selected.size === allStudents.filter(s=>s.status!=='confirmed').length && allStudents.filter(s=>s.status!=='confirmed').length > 0}
                      onChange={toggleAll}
                      style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }} />
                  </th>
                  {['순서', '이름', '학년/반/번호', '학부모 전화', '상태', '작업'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsForTable.map((s, i) => {
                  const isChk = selected.has(s.id)
                  const cfg = STUDENT_STATUS[s.status] || {}
                  const isConfirmed = s.status === 'confirmed'
                  const rowBg = isChk ? '#fff7ed' : isConfirmed ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa'

                  // 대기 순서 라벨
                  let orderLabel = null
                  if (s.status === 'applied' && s.waitlistOrder) {
                    orderLabel = <span style={{ fontSize:'12px', background:'#fef3c7', color:'#92400e', padding:'2px 7px', borderRadius:'5px', fontWeight:700 }}>대기 {s.waitlistOrder}번</span>
                  } else if (s.status === 'confirmed') {
                    orderLabel = <span style={{ fontSize:'14px' }}>✅</span>
                  } else if (s.status === 'selected') {
                    orderLabel = <span style={{ fontSize:'12px', background:'#eff6ff', color:'#1e40af', padding:'2px 7px', borderRadius:'5px', fontWeight:700 }}>선발</span>
                  } else {
                    orderLabel = <span style={{ fontSize:'12px', color:'#9ca3af' }}>{i+1}</span>
                  }

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: rowBg, cursor: isConfirmed ? 'default' : 'pointer', transition: 'background .1s' }}
                      onClick={() => !isConfirmed && toggle(s.id)}>
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        {!isConfirmed && (
                          <input type="checkbox" checked={isChk} onChange={() => toggle(s.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }} />
                        )}
                        {isConfirmed && <span style={{ fontSize:'16px' }}>✅</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{orderLabel}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#111827', fontSize: '14px' }}>{s.name}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#6b7280' }}>
                        {s.grade} {s.classNum ? s.classNum + '반' : ''} {s.number ? s.number + '번' : ''}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#6b7280' }}>{fmtPhone(s.parentPhone) || '-'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <Tag color={cfg.color} bg={cfg.bg}>{cfg.label}</Tag>
                      </td>
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          {!isConfirmed ? (
                            <Btn size="sm" onClick={() => {
                              const st = StudentsDB.find(s.id)
                              StudentsDB.update(s.id, {
                                status: 'confirmed',
                                waitlistOrder: null,
                                statusHistory: [...(st.statusHistory||[]), { status:'confirmed', changedAt:now(), memo:'개별 확정' }],
                              })
                              refresh()
                            }}>확정</Btn>
                          ) : (
                            <Btn size="sm" variant="outlineDanger" onClick={() => cancelConfirmed(s.id)}>확정 취소</Btn>
                          )}
                          {/* cancelled로 변경 */}
                          {s.status !== 'confirmed' && s.status !== 'cancelled' && (
                            <Btn size="sm" variant="ghost" style={{ color:'#ef4444' }} onClick={() => {
                              const st = StudentsDB.find(s.id)
                              StudentsDB.update(s.id, {
                                status: 'cancelled',
                                statusHistory: [...(st.statusHistory||[]), { status:'cancelled', changedAt:now(), memo:'취소 처리' }],
                              })
                              refresh()
                            }}>취소</Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px', fontSize: '13px', color: '#9ca3af', display:'flex', gap:'16px', flexWrap:'wrap' }}>
            <span>* 확정된 학생만 출석부에 표시됩니다.</span>
            <span>* 확정 취소 시 대기자가 자동 승격됩니다.</span>
          </div>
        </>
      )}

      {/* ── 추첨 모달 */}
      <Modal open={showLottery} onClose={() => { setShowLottery(false); setLotteryResult(null); setLotteryCount('') }} title="🎲 무작위 추첨" width={520}>
        {!lotteryResult ? (
          // 추첨 설정
          <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
            <div style={{ padding:'14px 16px', background:'#fff7ed', borderRadius:'12px', border:'1.5px solid #fed7aa' }}>
              <div style={{ fontSize:'14px', fontWeight:700, color:'#c2410c', marginBottom:'6px' }}>현재 현황</div>
              <div style={{ display:'flex', gap:'16px', fontSize:'13px', color:'#374151' }}>
                <span>신청자 <strong style={{color:'#f97316'}}>{applied.length}명</strong></span>
                <span>추첨완료 <strong style={{color:'#3b82f6'}}>{selectedSt.length}명</strong></span>
                <span>확정 <strong style={{color:'#16a34a'}}>{confirmed.length}명</strong></span>
              </div>
            </div>

            <div>
              <Input
                label="총 모집 인원"
                value={lotteryCount}
                onChange={v => setLotteryCount(v)}
                placeholder="예: 15"
                type="number"
              />
              {lotteryCount && parseInt(lotteryCount) > 0 && (
                <div style={{ marginTop:'8px', padding:'10px 14px', background:'#f0fdf4', borderRadius:'8px', fontSize:'13px', color:'#374151' }}>
                  확정 <strong>{confirmed.length}</strong>명 + 추첨완료 <strong>{selectedSt.length}</strong>명 = <strong>{confirmed.length+selectedSt.length}</strong>명 이미 처리
                  → 신청자 중 <strong style={{color:'#f97316'}}>{Math.max(0, parseInt(lotteryCount)-confirmed.length-selectedSt.length)}명</strong> 추가 선발 예정
                  {applied.length < Math.max(0, parseInt(lotteryCount)-confirmed.length-selectedSt.length) && (
                    <div style={{ color:'#ef4444', fontWeight:600, marginTop:'4px' }}>⚠ 신청자({applied.length}명)가 부족합니다. 전원 선발됩니다.</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <Btn variant="ghost" onClick={() => { setShowLottery(false); setLotteryCount('') }}>취소</Btn>
              <Btn onClick={runLottery} style={{ background:'linear-gradient(135deg,#f97316,#ea580c)', border:'none' }}>🎲 추첨하기</Btn>
            </div>
          </div>
        ) : (
          // 추첨 결과 확인
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div style={{ textAlign:'center', padding:'16px', background:'linear-gradient(135deg,#fff7ed,#fef3c7)', borderRadius:'12px', border:'1.5px solid #fed7aa' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🎲</div>
              <div style={{ fontSize:'16px', fontWeight:700, color:'#c2410c' }}>추첨 결과</div>
              <div style={{ fontSize:'13px', color:'#6b7280', marginTop:'4px' }}>아래 결과를 확인하고 확정하세요</div>
            </div>

            {/* 선발 */}
            <div>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#16a34a', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
                ✅ 선발 ({lotteryResult.winners.length}명)
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {lotteryResult.winners.map(s => (
                  <span key={s.id} style={{ padding:'4px 12px', borderRadius:'20px', background:'#f0fdf4', border:'1.5px solid #86efac', fontSize:'13px', fontWeight:600, color:'#15803d' }}>{s.name}</span>
                ))}
              </div>
            </div>

            {/* 대기자 */}
            {lotteryResult.waitlist.length > 0 && (
              <div>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'8px' }}>
                  ⏳ 대기 ({lotteryResult.waitlist.length}명) — 순서대로 자동 승격됩니다
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {lotteryResult.waitlist.map((s, idx) => (
                    <span key={s.id} style={{ padding:'4px 12px', borderRadius:'20px', background:'#fef3c7', border:'1.5px solid #fcd34d', fontSize:'13px', color:'#92400e' }}>
                      <span style={{ fontWeight:700 }}>대기{idx+1}</span> {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <Btn variant="ghost" onClick={() => { setLotteryResult(null); }}>다시 추첨</Btn>
              <Btn onClick={confirmLottery} style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', border:'none' }}>✅ 이 결과로 확정</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
