// ── Students.jsx에서 changeStatus 함수를 아래로 교체하세요 ──
// (import 상단에 autoPromoteWaitlist 추가도 필요)

// ① import 라인 맨 위에 추가:
// import { autoPromoteWaitlist } from './StudentConfirm.jsx'

// ② changeStatus 함수 교체:
const changeStatus_NEW = (id, newStatus) => {
  const s = StudentsDB.find(id)
  if (!s) return

  const oldStatus = s.status

  StudentsDB.update(id, {
    status: newStatus,
    statusHistory: [...(s.statusHistory || []), { status: newStatus, changedAt: now(), memo: '' }],
  })

  // confirmed → cancelled/기타 로 변경 시 대기자 자동 승격
  if (oldStatus === 'confirmed' && newStatus !== 'confirmed') {
    // 해당 학생이 속한 각 수업에서 대기자 승격 시도
    const classIds = s.classIds || []
    classIds.forEach(classId => {
      const result = autoPromoteWaitlist(classId)
      if (result) {
        const promoted = StudentsDB.find(result.promoted.id)
        const msg = result.type === 'selected_to_confirmed'
          ? `✅ "${promoted?.name}" 학생이 대기에서 자동 확정되었습니다.`
          : `📋 "${promoted?.name}" 학생이 추첨완료로 자동 승격되었습니다.`
        alert(msg)
      }
    })
  }
}

// ③ JSX에서 기존 changeStatus를 changeStatus_NEW로 교체:
// onChange={e => changeStatus_NEW(s.id, e.target.value)}
