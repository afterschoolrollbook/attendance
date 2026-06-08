import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, Notes, LessonMemos, SupplyItems, SupplyProducts, SupplyStudentProgress, SupplySessionChecks, SupplyProductPlans, SupplyPlans, MessageGuides, MessageCategories, TeacherProfiles, ParentMembers, SupplyGiven, SupplyParts, refreshTablesFromSupabase, onDbChange } from '../lib/db.js'
import { uid, now, calcSessionDates, sortClasses, getSession, getSessionInfo, fmtPhone } from '../lib/utils.js'
import { ATTENDANCE_STATUS, HOME_RETURN_TYPES } from '../constants/config.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { sendPush, isConfigured } from '../lib/supabase.js'

// ── 웹 푸시 발송 헬퍼
function pushAttendance(student, status, extra = {}) {
  if (!isConfigured) return
  if (status === 'pending') return
  if (!student?.parentPhone) return
  const subs = ParentMembers.getPushSubscriptions(student.parentPhone)
  if (!subs.length) return
  const label = { present:'출석', absent:'결석', late:'지각', early:'조퇴' }[status] || status
  const title = `${student.name} ${label} 알림`
  const body  = extra.absentReason ? `사유: ${extra.absentReason}` : `${student.name} 학생이 ${label} 처리되었습니다.`
  subs.forEach(sub => sendPush(sub, { title, body, tag: 'attendance' }))
}

// 결석 사유 (출석체크용 확장)
const ABSENT_REASONS = [
  { value: '',           label: '사유 없음' },
  { value: 'sick',       label: '질병' },
  { value: 'field_trip', label: '현장학습' },
  { value: 'exp_trip',   label: '체험학습' },
  { value: 'condolence', label: '경조사' },
  { value: 'personal',   label: '개인사유' },
  { value: 'unexcused',  label: '무단' },
  { value: 'infection',  label: '법정감염병' },
  { value: 'transferred',     label: '전학' },
  { value: 'schedule_change', label: '스케줄변경' },
  { value: 'etc',             label: '기타' },
]

const DAYS_KO = ['일','월','화','수','목','금','토']
const MONTHS  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function formatDateKo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear() % 100}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${DAYS_KO[d.getDay()]}요일`
}

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}


// ─── 수업 메모장 패널
function LessonMemoPanel({ cls, date, students, spItems, spProds, spProg, spChecks, spGiven, onProgOpen, onOpenScreen }) {
  const { success } = useToast()
  const [memos, setMemos] = useState(() => cls ? LessonMemos.byClassDate(cls.id, date).filter(m => !m.content?.startsWith('__PARTS_ORDER__:')) : [])
  const [memoText, setMemoText] = useState('')
  // 부품 주문 메모
  const [addOpen, setAddOpen]               = useState(false)
  const [orderOpen, setOrderOpen]           = useState(false)
  const [partsData, setPartsData]           = useState([])   // { id, productId, stage, name }
  const [selProductId, setSelProductId]     = useState('')
  const [selStage, setSelStage]             = useState('')
  const [selPartId, setSelPartId]           = useState('')
  const [selQty, setSelQty]                 = useState(1)
  const [selMemo, setSelMemo]               = useState('')
  const PARTS_ORDER_KEY = '__PARTS_ORDER__:'
  const orderListRef = useRef([])
  const [orderList, setOrderList] = useState(() => {
    if (!cls) return []
    const saved = LessonMemos.byClassDate(cls.id, date).find(m => m.content?.startsWith(PARTS_ORDER_KEY))
    if (saved) { try {
      const parsed = JSON.parse(saved.content.slice(PARTS_ORDER_KEY.length))
        .map(({ _memoEdit, _edit, _editProductId, _editStage, _editPartId, ...rest }) => rest)
      orderListRef.current = parsed
      return parsed
    } catch {} }
    return []
  })
  const _saveOrderToSupabase = (list) => {
    if (!cls) return
    const clean = list.map(({ _memoEdit, _edit, _editProductId, _editStage, _editPartId, ...rest }) => rest)
    const content = PARTS_ORDER_KEY + JSON.stringify(clean)
    const allMemos = LessonMemos.byClassDate(cls.id, date)
    const existing = allMemos.find(m => m.content?.startsWith(PARTS_ORDER_KEY))
    if (existing) {
      LessonMemos.update(existing.id, { content })
    } else {
      LessonMemos.insert({ id: uid(), teacherId: cls.teacherId, classId: cls.id, date, content, createdAt: now() })
    }
  }
  const _setOrderList = (updater) => {
    const prev = orderListRef.current
    const next = typeof updater === 'function' ? updater(prev) : updater
    orderListRef.current = next
    setOrderList(next)
    _saveOrderToSupabase(next)
  }
  const [addingNew, setAddingNew]           = useState(false)
  const [newPartName, setNewPartName]       = useState('')
  const [partsLoading, setPartsLoading]     = useState(false)
  // 진도 섹션 접기/펼치기 상태 (기본: 펼침)
  const [openSections, setOpenSections] = useState({
    교구지급: false, 교구준비: false, 미지급: false, 확인필요: false,
    추가지급: false, 미입금: false, 미체크: false,
  })
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  // 다른 기기에서 변경 시 실시간 반영
  useEffect(() => {
    if (!cls) return
    const unsub = onDbChange('lessonMemos', () => {
      const all = LessonMemos.byClassDate(cls.id, date)
      setMemos(all.filter(m => !m.content?.startsWith(PARTS_ORDER_KEY)))
      const saved = all.find(m => m.content?.startsWith(PARTS_ORDER_KEY))
      if (saved) { try { const p = JSON.parse(saved.content.slice(PARTS_ORDER_KEY.length)); orderListRef.current = p; setOrderList(p) } catch {} }
    })
    return unsub
  }, [cls?.id, date])

  // 다른 기기 변경사항 폴링 (30초마다 Supabase 재조회)
  useEffect(() => {
    if (!cls) return
    const poll = async () => {
      await refreshTablesFromSupabase('lessonMemos')
      const all = LessonMemos.byClassDate(cls.id, date)
      setMemos(all.filter(m => !m.content?.startsWith(PARTS_ORDER_KEY)))
      const saved = all.find(m => m.content?.startsWith(PARTS_ORDER_KEY))
      if (saved) { try { const p = JSON.parse(saved.content.slice(PARTS_ORDER_KEY.length)); orderListRef.current = p; setOrderList(p) } catch {} }
    }
    const timer = setInterval(poll, 30000)
    return () => clearInterval(timer)
  }, [cls?.id, date])

  const addMemo = () => {
    if (!memoText.trim() || !cls) return
    LessonMemos.insert({ id: uid(), teacherId: cls.teacherId, classId: cls.id, date, content: memoText.trim(), createdAt: now() })
    setMemos(LessonMemos.byClassDate(cls.id, date).filter(m => !m.content?.startsWith(PARTS_ORDER_KEY)))
    setMemoText('')
  }
  const delMemo = (id) => { LessonMemos.delete(id); setMemos(LessonMemos.byClassDate(cls.id, date).filter(m => !m.content?.startsWith(PARTS_ORDER_KEY))) }

  const activeStudents = students.filter(s => ['applied','selected','confirmed'].includes(s.status))
  const studentProgList = activeStudents.map(s => {
    // classId가 통합카드 id와 다를 수 있음 (구버전 별도카드 → 통합카드 이동)
    // 우선 현재 cls.id로 찾고, 없으면 학생의 classIds 중 아무 카드로 찾음
    const si = spItems.find(i => i.studentId === s.id && i.classId === cls?.id)
    if (!si?.productId) return null
    const prog = spProg.find(p => p.studentId === s.id && p.productId === si.productId)
    const curStage = prog?.curStage || si.stage || 1
    const prod = spProds.find(p => p.id === si.productId)
    const todayChecks = spChecks.filter(c =>
      c.studentId === s.id && c.productId === si.productId &&
      c.stage === curStage && c.checkedAt && localDateStr(new Date(c.checkedAt)) === date
    )
    const allChecks = spChecks.filter(c => c.studentId === s.id && c.productId === si.productId && c.stage === curStage)
    const lastCheck = allChecks.length > 0 ? allChecks.reduce((a, b) => a.sessionNo > b.sessionNo ? a : b) : null
    const stagePlans = lastCheck ? SupplyProductPlans.byProductStage(si.productId, curStage) : []
    const lastModelTitle = lastCheck ? (stagePlans.find(p => p.sessionNo === lastCheck.sessionNo)?.title || null) : null
    return { s, si, prod, curStage, todayChecks, allChecks, lastModelTitle }
  }).filter(Boolean)

  const checkedToday    = studentProgList.filter(p => p.todayChecks.length > 0).sort((a, b) => a.s.name.localeCompare(b.s.name, 'ko'))
  const notCheckedToday = studentProgList.filter(p => p.todayChecks.length === 0).sort((a, b) => a.s.name.localeCompare(b.s.name, 'ko'))

  // 교구+단계별 그룹 (정렬은 기존 가나다순 유지, 같은 교구 안에서 단계 오름차순)
  const groupByProductStage = (list) => {
    const map = {}
    list.forEach(item => {
      const pid = item.prod?.id || '노교구'
      const key = `${pid}__${item.curStage}`
      if (!map[key]) {
        map[key] = { prod: item.prod, curStage: item.curStage, items: [], _pid: pid }
      }
      map[key].items.push(item)
    })
    // 큐보 → 스카이로보 → 나머지(가나다순), 단계 오름차순
    const prodPriority = (name) => {
      if ((name||'').startsWith('큐보')) return 0
      if ((name||'').startsWith('스카이')) return 1
      return 2
    }
    return Object.values(map).sort((a, b) => {
      const pa = prodPriority(a.prod?.name), pb = prodPriority(b.prod?.name)
      if (pa !== pb) return pa - pb
      const nameCmp = (a.prod?.name||'').localeCompare(b.prod?.name||'', 'ko')
      if (nameCmp !== 0) return nameCmp
      return (a.curStage||1) - (b.curStage||1)
    })
  }

  if (!cls) return null

  return (
    <div style={{ marginTop:'16px', borderTop:`1px solid ${C.border}`, paddingTop:'14px' }}>
      {/* 진도 섹션 — 항상 표시 */}
      <div style={{ marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:C.muted }}>📋 진도</div>
          {studentProgList.length > 0 && (
            <button
              onClick={() => {
                const payload = { cls, date }
                onOpenScreen && onOpenScreen(payload)
                const url = window.location.origin + window.location.pathname + '?progress_screen=1'
                const existing = window._progressWindow
                if (existing && !existing.closed) {
                  existing.focus()
                  const ch = new BroadcastChannel('progress_screen')
                  ch.postMessage(payload)
                  ch.close()
                } else {
                  window._progressWindow = window.open(url, 'progress_screen', 'width=640,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')
                  setTimeout(() => {
                    const ch = new BroadcastChannel('progress_screen')
                    ch.postMessage(payload)
                    ch.close()
                  }, 800)
                }
              }}
              style={{ fontSize:'11px', fontWeight:700, color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'8px', padding:'2px 8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              🖥️ 수업 화면
            </button>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {checkedToday.length > 0 && (
            <div>
              <div style={{ fontSize:'11px', fontWeight:700, color:'#16a34a', marginBottom:'5px' }}>✅ 진도체크 완료 ({checkedToday.length}명)</div>
              {groupByProductStage(checkedToday).map(({ prod, curStage, items }) => (
                <div key={`${prod?.id}__${curStage}`} style={{ marginBottom:'5px' }}>
                  <div style={{ fontSize:'10px', fontWeight:700, color:'#15803d', background:'#dcfce7', borderRadius:'4px', padding:'1px 7px', display:'inline-block', marginBottom:'3px' }}>
                    {prod?.name} {curStage}단계
                  </div>
                  {items.map(({ s, todayChecks, allChecks, lastModelTitle }) => (
                    <div key={s.id} onClick={() => onProgOpen(s, spItems.find(i=>i.studentId===s.id&&i.classId===cls?.id)?.productId)}
                      style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#f0fdf4', border:'1px solid #86efac', marginBottom:'3px', cursor:'pointer' }}>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#16a34a' }}>{s.name}</span>
                      <span style={{ marginLeft:'auto', fontSize:'11px', fontWeight:700, color:'#16a34a' }}>+{todayChecks.length}차시 ({allChecks.length}차시)</span>
                      {lastModelTitle && <span style={{ fontSize:'11px', color:'#6b7280' }}>{lastModelTitle}</span>}
                      {todayChecks.length >= 2 && <span style={{ fontSize:'10px', background:'#fef2f2', color:'#ef4444', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 5px' }}>최대</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {/* ── 공통 접기/펼치기 헤더 렌더러 */}
          {(() => {
            const SectionHeader = ({ sectionKey, label, count, color }) => (
              <div
                onClick={() => toggleSection(sectionKey)}
                style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', userSelect:'none', marginBottom: openSections[sectionKey] ? '5px' : '0' }}>
                <span style={{ fontSize:'9px', color, transition:'transform .2s', display:'inline-block', transform: openSections[sectionKey] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <span style={{ fontSize:'11px', fontWeight:700, color }}>{label} ({count}명)</span>
              </div>
            )

            // ── 1. 교구지급
            const todayGiven = (spGiven || [])
              .filter(g => g.classId === cls?.id && g.givenAt === date)
              .sort((a, b) => (a.studentName||'').localeCompare(b.studentName||'', 'ko'))

            // ── 2. 교구 준비 필요
            const supplyAlertList = activeStudents.flatMap(s => {
              const si = spItems.find(i => i.studentId === s.id && i.classId === cls?.id)
              if (!si?.productId) return []
              const prod = spProds.find(p => p.id === si.productId)
              if (!prod) return []
              const prog = spProg.find(p => p.studentId === s.id && p.productId === si.productId)
              if (prog?.supplyDelivered) return []
              const spp = prod.sessionsPerStage || 12
              const alertSess = prod.alertSession || 3
              const curStage = prog?.curStage || si.stage || 1
              const stagePlans = SupplyProductPlans.byProductStage(si.productId, curStage)
              const actualSessions = stagePlans.length > 0 ? stagePlans.length : spp
              const chk = spChecks.filter(c => c.studentId === s.id && c.productId === si.productId && c.stage === curStage).length
              const isDone = chk >= actualSessions
              const isAlert = chk >= (actualSessions - alertSess) && !isDone
              if (!isDone && !isAlert) return []
              const nextProd = prog?.nextProductId ? spProds.find(p => p.id === prog.nextProductId) : null
              const nextStage = prog?.nextStage || 1
              const noNextInfo = !nextProd
              const label = isDone
                ? (nextProd ? `${nextProd.name} ${nextStage}단계 준비 필요` : `진도확인 바람`)
                : (nextProd ? `${prod.name} ${curStage}단계 ${chk}/${actualSessions}차시 — ${nextProd.name} ${nextStage}단계 준비 필요` : `${prod.name} ${curStage}단계 ${chk}/${actualSessions}차시 — 진도확인 바람`)
              return [{ s, label, isDone, noNextInfo }]
            }).sort((a, b) => a.s.name.localeCompare(b.s.name, 'ko'))

            // ── 3. 미지급 (supplyStatus === 'unpaid')
            const unpaidRaw = (spGiven || []).filter(g => {
              if (g.classId !== cls?.id) return false
              const ss = g.supplyStatus
                ? g.supplyStatus
                : (['billed','paid'].includes(g.status) ? 'given' : g.status) || 'given'
              return ss === 'unpaid'
            })
            const unpaidByStudent = {}
            unpaidRaw.forEach(g => {
              const key = g.studentId || g.studentName
              if (!unpaidByStudent[key]) unpaidByStudent[key] = { name: g.studentName, items: [] }
              unpaidByStudent[key].items.push(g)
            })
            const unpaidEntries = Object.values(unpaidByStudent).sort((a, b) => a.name.localeCompare(b.name, 'ko'))

            // ── 4. 확인필요 (status === 'check')
            const checkRaw = (spGiven || []).filter(g => {
              if (g.classId !== cls?.id) return false
              const bs = g.supplyStatus != null
                ? (g.status || 'none')
                : (g.status === 'paid' ? 'paid' : g.status === 'billed' ? 'billed' : g.paymentStatus === 'unpaid' ? 'unpaid' : 'none')
              return bs === 'check'
            })
            const checkByStudent = {}
            checkRaw.forEach(g => {
              const key = g.studentId || g.studentName
              if (!checkByStudent[key]) checkByStudent[key] = { name: g.studentName, items: [] }
              checkByStudent[key].items.push(g)
            })
            const checkEntries = Object.values(checkByStudent).sort((a, b) => a.name.localeCompare(b.name, 'ko'))

            // ── 5. 추가지급 (supplyStatus === 'extra' 또는 status === 'extra')
            const extraRaw = (spGiven || []).filter(g => {
              if (g.classId !== cls?.id) return false
              const ss = g.supplyStatus || g.status || ''
              return ss === 'extra'
            })
            const extraByStudent = {}
            extraRaw.forEach(g => {
              const key = g.studentId || g.studentName
              if (!extraByStudent[key]) extraByStudent[key] = { name: g.studentName, items: [] }
              extraByStudent[key].items.push(g)
            })
            const extraEntries = Object.values(extraByStudent).sort((a, b) => a.name.localeCompare(b.name, 'ko'))

            // ── 6. 미입금: 신규모델(supplyStatus 있음) → status === 'unpaid', 구모델 → paymentStatus === 'unpaid'
            const unpaidPayRaw = (spGiven || []).filter(g => {
              if (g.classId !== cls?.id) return false
              if (g.supplyStatus != null) return g.status === 'unpaid'
              return g.paymentStatus === 'unpaid'
            })
            const unpaidPayByStudent = {}
            unpaidPayRaw.forEach(g => {
              const key = g.studentId || g.studentName
              if (!unpaidPayByStudent[key]) unpaidPayByStudent[key] = { name: g.studentName, items: [] }
              unpaidPayByStudent[key].items.push(g)
            })
            const unpaidPayEntries = Object.values(unpaidPayByStudent).sort((a, b) => a.name.localeCompare(b.name, 'ko'))

            // ── 7. 미체크 (가나다순)
            const notCheckedSorted = [...notCheckedToday].sort((a, b) => a.s.name.localeCompare(b.s.name, 'ko'))

            // 순서: 미체크(항상펼침) → 교구지급 → 교구준비 → 미지급 → 추가지급 → 확인필요 → 미입금
            return (
              <>
                {/* 미체크 — 접기 없이 항상 표시 */}
                {notCheckedSorted.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <div style={{ fontSize:'11px', fontWeight:700, color:'#9ca3af', marginBottom:'5px' }}>⬜ 미체크 ({notCheckedSorted.length}명)</div>
                    {groupByProductStage(notCheckedSorted).map(({ prod, curStage, items }) => (
                      <div key={`${prod?.id}__${curStage}`} style={{ marginBottom:'5px' }}>
                        <div style={{ fontSize:'10px', fontWeight:700, color:'#9ca3af', background:'#f3f4f6', borderRadius:'4px', padding:'1px 7px', display:'inline-block', marginBottom:'3px' }}>
                          {prod?.name} {curStage}단계
                        </div>
                        {items.map(({ s, lastModelTitle }) => (
                          <div key={s.id} onClick={() => onProgOpen(s, spItems.find(i=>i.studentId===s.id&&i.classId===cls?.id)?.productId)}
                            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#f9fafb', border:'1px solid #e5e7eb', marginBottom:'3px', cursor:'pointer' }}>
                            <span style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>{s.name}</span>
                            {lastModelTitle && <span style={{ marginLeft:'auto', fontSize:'11px', color:'#9ca3af' }}>{lastModelTitle}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* 교구지급 */}
                {todayGiven.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <SectionHeader sectionKey="교구지급" label="📦 교구지급" count={todayGiven.length} color="#7c3aed" />
                    {openSections['교구지급'] && todayGiven.map(g => (
                      <div key={g.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#f5f3ff', border:'1px solid #c4b5fd', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#6d28d9' }}>{g.studentName}</span>
                        <span style={{ fontSize:'11px', color:'#6b7280' }}>{g.productName}</span>
                        {g.itemName && <span style={{ fontSize:'11px', color:'#9ca3af' }}>{g.itemName}</span>}
                        <span style={{ marginLeft:'auto', fontSize:'11px', color:'#9ca3af' }}>{g.givenAt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 교구준비 */}
                {supplyAlertList.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <SectionHeader sectionKey="교구준비" label="⚠️ 교구 준비 필요" count={supplyAlertList.length} color="#ef4444" />
                    {openSections['교구준비'] && supplyAlertList.map(({ s, label, isDone, noNextInfo }) => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background: noNextInfo ? '#fefce8' : isDone ? '#f0fdf4' : '#fef2f2', border:`1px solid ${noNextInfo ? '#fde047' : isDone ? '#86efac' : '#fca5a5'}`, marginBottom:'4px' }}>
                        <span style={{ fontSize:'11px', fontWeight:700, color: noNextInfo ? '#854d0e' : isDone ? '#16a34a' : '#ef4444' }}>
                          {noNextInfo ? '📋' : isDone ? '✅' : '⚠️'}
                        </span>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>{s.name}</span>
                        <span style={{ fontSize:'11px', color:'#6b7280', flex:1 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 미지급 */}
                {unpaidEntries.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <SectionHeader sectionKey="미지급" label="📦 미지급" count={unpaidEntries.length} color="#b91c1c" />
                    {openSections['미지급'] && unpaidEntries.map(({ name, items }) => (
                      <div key={name} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#fee2e2', border:'1px solid #fca5a5', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#b91c1c' }}>{name}</span>
                        <span style={{ fontSize:'11px', color:'#6b7280', flex:1 }}>
                          {items.map(i => i.itemName || i.productName).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 추가지급 */}
                {extraEntries.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <SectionHeader sectionKey="추가지급" label="➕ 추가지급" count={extraEntries.length} color="#0891b2" />
                    {openSections['추가지급'] && extraEntries.map(({ name, items }) => (
                      <div key={name} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#ecfeff', border:'1px solid #67e8f9', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#0891b2' }}>{name}</span>
                        <span style={{ fontSize:'11px', color:'#6b7280', flex:1 }}>
                          {items.map(i => i.itemName || i.productName).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 확인필요 */}
                {checkEntries.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <SectionHeader sectionKey="확인필요" label="🔍 확인필요" count={checkEntries.length} color="#7c3aed" />
                    {openSections['확인필요'] && checkEntries.map(({ name, items }) => (
                      <div key={name} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#f3e8ff', border:'1px solid #c4b5fd', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#7c3aed' }}>{name}</span>
                        <span style={{ fontSize:'11px', color:'#6b7280', flex:1 }}>
                          {items.map(i => i.itemName || i.productName).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 미입금 — 주황색 */}
                {unpaidPayEntries.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <SectionHeader sectionKey="미입금" label="💰 미입금" count={unpaidPayEntries.length} color="#ea580c" />
                    {openSections['미입금'] && unpaidPayEntries.map(({ name, items }) => (
                      <div key={name} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', borderRadius:'7px', background:'#fff7ed', border:'1px solid #fdba74', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#ea580c' }}>{name}</span>
                        <span style={{ fontSize:'11px', color:'#6b7280', flex:1 }}>
                          {items.map(i => i.itemName || i.productName).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {studentProgList.length === 0 && (
                  <div style={{ fontSize:'12px', color:'#d1d5db', textAlign:'center', padding:'8px 0' }}>교구 배정된 학생이 없습니다</div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* 부품 주문 메모 */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:'12px', marginTop:'0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:(addOpen||orderOpen) ? '10px' : '0' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:C.muted }}>🔧 부품 주문 메모</div>
          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={() => {
              if (!addOpen) {
                setSelProductId(''); setSelStage(''); setSelPartId('')
                setAddingNew(false); setNewPartName('')
                setOrderOpen(false)
              }
              setAddOpen(v => !v)
            }}
              style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid #d6d3d1', background: addOpen ? '#f59e0b' : '#fff', color: addOpen ? '#fff' : '#78716c', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight: addOpen ? 700 : 400 }}>
              {addOpen ? '닫기' : '➕ 부품추가'}
            </button>
            <button onClick={() => {
              if (!orderOpen) {
                setSelProductId(''); setSelStage(''); setSelPartId('')
                setAddingNew(false); setNewPartName(''); setSelQty(1); setSelMemo('')
                setAddOpen(false)
              }
              setOrderOpen(v => !v)
            }}
              style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid #d6d3d1', background: orderOpen ? '#78716c' : '#fff', color: orderOpen ? '#fff' : '#78716c', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight: orderOpen ? 700 : 400 }}>
              {orderOpen ? '닫기' : '📋 주문'}
            </button>
          </div>
        </div>

        {/* 부품추가 패널 — 교구/단계 선택 후 새 부품명 등록 */}
        {addOpen && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {partsLoading ? (
              <div style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', padding:'8px' }}>불러오는 중...</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <select value={selProductId} onChange={async e => {
                  const pid = e.target.value
                  setSelProductId(pid); setSelStage(''); setSelPartId(''); setAddingNew(false)
                  if (!pid) return
                  try {
                    const rows = await SupplyParts.byProduct(pid)
                    setPartsData(prev => [...prev.filter(p => p.productId !== pid), ...(rows || [])])
                  } catch(e) {}
                }}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <option value="">-- 교구 선택 --</option>
                  {spProds.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name}</option>
                  ))}
                </select>
                {selProductId && (
                  <select value={selStage} onChange={e => { setSelStage(Number(e.target.value)); setSelPartId(''); setAddingNew(false) }}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                    <option value="">-- 단계 선택 --</option>
                    {(() => {
                      const fromPlans = SupplyPlans.byProduct(selProductId).filter(pl => (pl.fileType==='session'||pl.type==='session') && pl.stage).map(pl => Number(pl.stage))
                      const fromProductPlans = SupplyProductPlans.byProduct(selProductId).map(pl => Number(pl.stage))
                      return [...new Set([...fromProductPlans, ...fromPlans])].sort((a,b)=>a-b).map(st => (
                        <option key={st} value={st}>{st}단계</option>
                      ))
                    })()}
                  </select>
                )}
                {selProductId && selStage !== '' && (
                  <>
                    <input value={newPartName} onChange={e => setNewPartName(e.target.value)}
                      placeholder="등록할 부품명 입력"
                      style={{ width:'100%', boxSizing:'border-box', padding:'7px 10px', borderRadius:'7px', border:'1px solid #f59e0b', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }} />
                    {newPartName.trim() && (
                      <button onClick={async () => {
                        try {
                          const trimmedName = newPartName.trim()
                          const allParts = SupplyParts.byProduct(selProductId)
                          if (allParts.some(p => p.name === trimmedName)) {
                            success('이미 등록된 부품입니다')
                            setNewPartName('')
                            return
                          }
                          await SupplyParts.insert({ productId: selProductId, stage: Number(selStage), name: trimmedName })
                          const updated = await SupplyParts.byProduct(selProductId)
                          setPartsData(prev => [...prev.filter(p => p.productId !== selProductId), ...updated])
                          setNewPartName('')
                          success('부품이 등록되었습니다')
                        } catch(e) {}
                      }}
                        style={{ width:'100%', padding:'7px', borderRadius:'7px', background:'#f59e0b', color:'#fff', border:'none', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        부품 등록
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 주문 패널 — 기존 부품 선택 → 수량/메모 → 목록에 추가 */}
        {orderOpen && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {partsLoading ? (
              <div style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', padding:'8px' }}>불러오는 중...</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <select value={selProductId} onChange={async e => {
                  const pid = e.target.value
                  setSelProductId(pid); setSelStage(''); setSelPartId('')
                  if (!pid) return
                  try {
                    const rows = await SupplyParts.byProduct(pid)
                    setPartsData(prev => [...prev.filter(p => p.productId !== pid), ...(rows || [])])
                    const stages = [...new Set((rows || []).map(p => Number(p.stage)))].sort((a,b)=>a-b)
                    setSelStage(stages[0] || '')
                  } catch(e) {}
                }}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <option value="">-- 교구 선택 --</option>
                  {spProds.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name}</option>
                  ))}
                </select>
                {selProductId && (
                  <select value={selStage} onChange={e => { setSelStage(Number(e.target.value)); setSelPartId('') }}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                    <option value="">-- 단계 선택 --</option>
                    {(() => {
                      const fromPlans = SupplyPlans.byProduct(selProductId).filter(pl => (pl.fileType==='session'||pl.type==='session') && pl.stage).map(pl => Number(pl.stage))
                      const fromProductPlans = SupplyProductPlans.byProduct(selProductId).map(pl => Number(pl.stage))
                      return [...new Set([...fromProductPlans, ...fromPlans])].sort((a,b)=>a-b).map(st => (
                        <option key={st} value={st}>{st}단계</option>
                      ))
                    })()}
                  </select>
                )}
                {selProductId && selStage !== '' && (
                  <select value={selPartId} onChange={e => setSelPartId(e.target.value)}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                    <option value="">-- 부품 선택 --</option>
                    {(() => {
                      const seen = new Set()
                      return partsData.filter(p => p.productId === selProductId && Number(p.stage) === Number(selStage) && (seen.has(p.name) ? false : seen.add(p.name)))
                    })().map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                {selPartId && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'12px', color:'#6b7280', whiteSpace:'nowrap' }}>수량</span>
                      <input type="number" min={1} value={selQty} onChange={e => setSelQty(Math.max(1, Number(e.target.value)))}
                        style={{ width:'60px', padding:'7px 8px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }} />
                    </div>
                    <input value={selMemo} onChange={e => setSelMemo(e.target.value)}
                      placeholder="메모 (선택)"
                      style={{ width:'100%', boxSizing:'border-box', padding:'7px 8px', borderRadius:'7px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                    <button onClick={() => {
                      const prod = spProds.find(p => p.id === selProductId)
                      const partName = partsData.find(p => p.id === selPartId)?.name || ''

                      // ── 다른 수업 주문 메모에 같은 부품이 이미 있는지 확인
                      const allMemos = LessonMemos.byTeacher(cls.teacherId)
                      const otherOrderMemos = allMemos.filter(m =>
                        m.content?.startsWith(PARTS_ORDER_KEY) &&
                        m.classId !== cls.id  // 현재 수업 제외
                      )
                      let duplicateFound = false
                      otherOrderMemos.forEach(m => {
                        try {
                          const list = JSON.parse(m.content.slice(PARTS_ORDER_KEY.length))
                          if (list.some(o => o.partId === selPartId)) duplicateFound = true
                        } catch {}
                      })

                      if (duplicateFound) {
                        alert(`⚠️ "${partName}" 은(는) 이미 다른 수업 주문 목록에 있습니다.\n대시보드 상단의 주문 목록을 확인해 주세요.`)
                        return
                      }

                      _setOrderList(prev => {
                        const existing = prev.find(o => o.partId === selPartId)
                        if (existing) return prev.map(o => o.partId === selPartId ? { ...o, qty: o.qty + selQty, memo: selMemo || o.memo } : o)
                        return [...prev, { productId: selProductId, productName: prod?.name || '', stage: Number(selStage), partId: selPartId, partName, qty: selQty, memo: selMemo || '' }]
                      })
                      setSelQty(1); setSelMemo('')
                      success('목록에 추가되었습니다')
                    }}
                      style={{ width:'100%', padding:'7px', borderRadius:'7px', background:'#78716c', color:'#fff', border:'none', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      목록에 추가
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 주문 목록 — partsOpen 상관없이 항상 표시 */}
        {orderList.length > 0 && (
          <div style={{ marginTop:'8px', background:'#f9fafb', borderRadius:'8px', padding:'10px', display:'flex', flexDirection:'column', gap:'4px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#374151', marginBottom:'3px' }}>📋 주문 목록</div>
              {orderList.map((o, i) => {
                const editPid   = o._editProductId   ?? o.productId
                const editStage = o._editStage       ?? o.stage
                const editPartId= o._editPartId      ?? o.partId
                const updUI = (patch) => setOrderList(prev => prev.map((x,j) => j===i ? {...x, ...patch} : x))
                const upd = (patch) => _setOrderList(prev => prev.map((x,j) => j===i ? {...x, ...patch} : x))
                return (
                <div key={i}>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 6px', background:'#fff', borderRadius: (o._edit || o._memoEdit) ? '6px 6px 0 0' : '6px', border:'1px solid #e5e7eb' }}>
                    <span style={{ flex:1, fontSize:'12px', color:'#1c1917' }}>
                      {o.productName} · {o.stage}단계 · {o.partName} · <b>{o.qty}개</b>
                    </span>
                    {o.memo && (
                      <button onClick={() => updUI({ _memoEdit: !o._memoEdit, _edit: false })}
                        title="메모" style={{ fontSize:'14px', lineHeight:1, color:'#f59e0b', background:'none', border:'none', cursor:'pointer', padding:'0 1px' }}>🗒️</button>
                    )}
                    <button onClick={async () => {
                      updUI({ _edit: !o._edit, _memoEdit: false, _editProductId: o.productId, _editStage: o.stage, _editPartId: o.partId })
                      if (!o._edit) {
                        try {
                          const rows = await SupplyParts.byProduct(o.productId)
                          setPartsData(prev => [...prev.filter(p => p.productId !== o.productId), ...(rows || [])])
                        } catch(e) {}
                      }
                    }}
                      title="수정" style={{ fontSize:'13px', lineHeight:1, color: o._edit ? '#3b82f6' : '#9ca3af', background:'none', border:'none', cursor:'pointer', padding:'0 1px' }}>✏️</button>
                    <button onClick={() => { _setOrderList(prev => prev.filter((_,j) => j!==i)); success('삭제되었습니다') }}
                      title="삭제" style={{ fontSize:'13px', lineHeight:1, color:'#fca5a5', background:'none', border:'none', cursor:'pointer', padding:'0 1px' }}>✕</button>
                  </div>
                  {o._memoEdit && (
                    <div style={{ padding:'7px 8px', background:'#fffbeb', borderRadius:'0 0 6px 6px', border:'1px solid #fde68a', borderTop:'none', display:'flex', flexDirection:'column', gap:'4px' }}>
                      {o.memo
                        ? <div style={{ fontSize:'12px', color:'#92400e', lineHeight:1.6 }}>{o.memo}</div>
                        : <div style={{ fontSize:'12px', color:'#d1d5db' }}>메모 없음</div>
                      }
                      <button onClick={() => updUI({ _memoEdit: false })}
                        style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid #fde68a', background:'#fff', color:'#92400e', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', alignSelf:'flex-end' }}>
                        닫기
                      </button>
                    </div>
                  )}
                  {o._edit && (
                    <div style={{ padding:'8px', background:'#f0f9ff', borderRadius:'0 0 6px 6px', border:'1px solid #bae6fd', borderTop:'none', display:'flex', flexDirection:'column', gap:'6px' }}>
                      <select value={editPid} onChange={async e => {
                        const pid = e.target.value
                        try {
                          const rows = await SupplyParts.byProduct(pid)
                          setPartsData(prev => [...prev.filter(p => p.productId !== pid), ...(rows || [])])
                        } catch(e) {}
                        updUI({ _editProductId: pid, _editStage: '', _editPartId: '' })
                      }} style={{ width:'100%', padding:'6px 8px', borderRadius:'6px', border:'1px solid #bae6fd', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                        <option value="">-- 교구 선택 --</option>
                        {spProds.map(prod => (
                          <option key={prod.id} value={prod.id}>{prod.name}</option>
                        ))}
                      </select>
                      {editPid && (
                        <select value={editStage} onChange={e => updUI({ _editStage: Number(e.target.value), _editPartId: '' })}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:'6px', border:'1px solid #bae6fd', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                          <option value="">-- 단계 선택 --</option>
                          {(() => {
                            const fromPlans = SupplyPlans.byProduct(editPid).filter(pl => (pl.fileType==='session'||pl.type==='session') && pl.stage).map(pl => Number(pl.stage))
                            const fromProductPlans = SupplyProductPlans.byProduct(editPid).map(pl => Number(pl.stage))
                            return [...new Set([...fromProductPlans, ...fromPlans])].sort((a,b)=>a-b).map(st => (
                              <option key={st} value={st}>{st}단계</option>
                            ))
                          })()}
                        </select>
                      )}
                      {editPid && editStage !== '' && (
                        <select value={editPartId} onChange={e => updUI({ _editPartId: e.target.value })}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:'6px', border:'1px solid #bae6fd', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
                          <option value="">-- 부품 선택 --</option>
                          {(() => {
                            const seen = new Set()
                            return partsData.filter(p => p.productId === editPid && Number(p.stage) === Number(editStage) && (seen.has(p.name) ? false : seen.add(p.name)))
                          })().map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <span style={{ fontSize:'11px', color:'#6b7280' }}>수량</span>
                        <button onClick={() => updUI({ qty: Math.max(1, o.qty - 1) })}
                          style={{ width:'22px', height:'22px', borderRadius:'4px', border:'1px solid #d1d5db', background:'#fff', fontSize:'13px', cursor:'pointer', lineHeight:1, padding:0 }}>-</button>
                        <span style={{ fontSize:'12px', fontWeight:700, minWidth:'24px', textAlign:'center' }}>{o.qty}</span>
                        <button onClick={() => updUI({ qty: o.qty + 1 })}
                          style={{ width:'22px', height:'22px', borderRadius:'4px', border:'1px solid #d1d5db', background:'#fff', fontSize:'13px', cursor:'pointer', lineHeight:1, padding:0 }}>+</button>
                      </div>
                      <input value={o.memo || ''} onChange={e => updUI({ memo: e.target.value })}
                        placeholder="메모 (선택)"
                        style={{ width:'100%', boxSizing:'border-box', padding:'5px 8px', borderRadius:'6px', border:'1px solid #bae6fd', fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                      <button onClick={() => {
                        const prod = spProds.find(p => p.id === editPid)
                        const partName = partsData.find(p => p.id === editPartId)?.name || o.partName
                        _setOrderList(prev => prev.map((x,j) => j===i ? {
                          ...x,
                          productId: editPid, productName: prod?.name || o.productName,
                          stage: editStage || o.stage, partId: editPartId || o.partId, partName,
                          memo: o.memo,
                          _edit: false, _editProductId: undefined, _editStage: undefined, _editPartId: undefined,
                        } : x))
                        success('저장되었습니다')
                      }} style={{ padding:'6px', borderRadius:'6px', background:'#3b82f6', color:'#fff', border:'none', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        확인
                      </button>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
      </div>

      {/* 메모 섹션 — 항상 표시 */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:'12px' }}>
        <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>📝 메모</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {memos.length === 0 && <div style={{ fontSize:'12px', color:'#d1d5db', textAlign:'center', padding:'8px 0' }}>메모가 없습니다</div>}
          {memos.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'flex-start', gap:'6px', padding:'8px 10px', background:'#fffbeb', borderRadius:'8px', border:'1px solid #fde68a' }}>
              <span style={{ flex:1, fontSize:'12px', color:'#374151', lineHeight:1.6 }}>{m.content}</span>
              <button onClick={() => delMemo(m.id)} style={{ fontSize:'11px', color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>삭제</button>
            </div>
          ))}
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <textarea value={memoText} onChange={e => setMemoText(e.target.value)} rows={2}
              placeholder="수업 특이사항을 입력하세요..."
              style={{ width:'100%', boxSizing:'border-box', padding:'7px 10px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', resize:'none', outline:'none' }} />
            <button onClick={addMemo}
              style={{ padding:'6px', borderRadius:'7px', border:'none', background:C.primary, color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 진도 수업 화면 (별도 창 전용 — DB 직접 연결 + 실시간 양방향 동기화)
export function ProgressWindow() {
  // 메인 창에서 보낸 cls/date 메타 수신
  const [meta, setMeta] = useState(null)
  const [tick, setTick] = useState(0)
  const [progStudent, setProgStudent] = useState(null)
  const [progProductId, setProgProductId] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  // BroadcastChannel: 메인→별도창 메타 수신 / 별도창→메인 갱신 신호 송신
  useEffect(() => {
    const ch = new BroadcastChannel('progress_screen')
    ch.onmessage = async (e) => {
      if (e.data.type === 'refresh') {
        // 별도 창은 인메모리 캐시가 독립적 → Supabase에서 직접 재조회 후 리렌더
        await refreshTablesFromSupabase('supplySessionChecks', 'supplyStudentProgress', 'supplyItems', 'supplyProducts')
        setTick(t => t + 1)
        setLastUpdated(new Date())
      } else {
        // 최초 메타(cls, date) 수신
        setMeta({ cls: e.data.cls, date: e.data.date })
        setLastUpdated(new Date())
      }
    }
    // 창 열리자마자 준비 신호 → 메인이 즉시 메타 재전송
    const ready = new BroadcastChannel('progress_screen_ready')
    ready.postMessage('ready')
    ready.close()
    return () => ch.close()
  }, [])

  if (!meta) return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f9fafb', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ fontSize:'48px', marginBottom:'16px' }}>🖥️</div>
      <div style={{ fontSize:'18px', fontWeight:700, color:'#374151', marginBottom:'8px' }}>수업 화면 대기 중</div>
      <div style={{ fontSize:'13px', color:'#9ca3af' }}>출석부에서 <b>🖥️ 수업 화면</b> 버튼을 눌러주세요</div>
    </div>
  )

  const { cls, date } = meta

  // DB 직접 조회 (tick 변경 시 재계산)
  const spItems  = SupplyItems.byTeacher(cls.teacherId||'')
  const spProds  = SupplyProducts.byTeacher(cls.teacherId||'')
  const spProg   = SupplyStudentProgress.byTeacher(cls.teacherId||'')
  const spChecks = SupplySessionChecks.byTeacher(cls.teacherId||'')
  const students = StudentsDB.byClass(cls.id)
  const activeStudents = students.filter(s => ['applied','selected','confirmed'].includes(s.status))

  const studentProgList = activeStudents.map(s => {
    const si = spItems.find(i => i.studentId === s.id && i.classId === cls.id)
    if (!si?.productId) return null
    const prog = spProg.find(p => p.studentId === s.id && p.productId === si.productId)
    const curStage = prog?.curStage || si.stage || 1
    const prod = spProds.find(p => p.id === si.productId)
    const todayChecks = spChecks.filter(c =>
      c.studentId === s.id && c.productId === si.productId &&
      c.stage === curStage && c.checkedAt && localDateStr(new Date(c.checkedAt)) === date
    )
    const allChecks = spChecks.filter(c => c.studentId === s.id && c.productId === si.productId && c.stage === curStage)
    const lastCheck = allChecks.length > 0 ? allChecks.reduce((a, b) => a.sessionNo > b.sessionNo ? a : b) : null
    const stagePlans = lastCheck ? SupplyProductPlans.byProductStage(si.productId, curStage) : []
    const lastModelTitle = lastCheck ? (stagePlans.find(p => p.sessionNo === lastCheck.sessionNo)?.title || null) : null
    return { s, si, prod, curStage, todayChecks, allChecks, lastModelTitle, isMax: todayChecks.length >= 2 }
  }).filter(Boolean)

  const checkedToday   = studentProgList.filter(p => p.todayChecks.length > 0).sort((a,b) => a.s.name.localeCompare(b.s.name,'ko'))
  const notCheckedToday = studentProgList.filter(p => p.todayChecks.length === 0).sort((a,b) => a.s.name.localeCompare(b.s.name,'ko'))
  const total = checkedToday.length + notCheckedToday.length
  const pct = total > 0 ? Math.round(checkedToday.length / total * 100) : 0

  const groupByProductStage = (list) => {
    const map = {}
    list.forEach(item => {
      const pid = item.prod?.id || '노교구'
      const key = `${pid}__${item.curStage}`
      if (!map[key]) {
        map[key] = { prod: item.prod, curStage: item.curStage, items: [], _pid: pid }
      }
      map[key].items.push(item)
    })
    // 큐보 → 스카이로보 → 나머지(가나다순), 단계 오름차순
    const prodPriority = (name) => {
      if ((name||'').startsWith('큐보')) return 0
      if ((name||'').startsWith('스카이')) return 1
      return 2
    }
    return Object.values(map).sort((a, b) => {
      const pa = prodPriority(a.prod?.name), pb = prodPriority(b.prod?.name)
      if (pa !== pb) return pa - pb
      const nameCmp = (a.prod?.name||'').localeCompare(b.prod?.name||'', 'ko')
      if (nameCmp !== 0) return nameCmp
      return (a.curStage||1) - (b.curStage||1)
    })
  }

  const DAYS_KO2 = ['일','월','화','수','목','금','토']
  const d = new Date(date + 'T00:00:00')
  const dateLabel = `${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS_KO2[d.getDay()]})`
  const clsName = (cls?.className||'') + ((cls?.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls?.section ? cls?.section+'반' : '')) ? ' '+(cls?.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls?.section ? cls?.section+'반' : '')) : '')

  // 진도체크 완료 후 → DB 재계산 + 메인 창에 갱신 신호
  const handleSaved = () => {
    setTick(t => t + 1)
    setLastUpdated(new Date())
    const ch = new BroadcastChannel('progress_screen')
    ch.postMessage({ type: 'refresh' })
    ch.close()
  }

  const openProgCheck = (s, productId) => {
    setProgStudent({ ...s, _clsId: cls.id })
    setProgProductId(productId || spItems.find(i => i.studentId===s.id && i.classId===cls.id)?.productId || '')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Noto Sans KR, sans-serif', display:'flex', flexDirection:'column' }}>
      {/* 헤더 */}
      <div style={{ background:'linear-gradient(135deg,#f97316 0%,#fb923c 100%)', padding:'20px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'22px', fontWeight:800, color:'#fff' }}>{clsName}</div>
          <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', marginTop:'3px' }}>📅 {dateLabel} 진도 현황</div>
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'14px', padding:'10px 18px', textAlign:'center', minWidth:'64px' }}>
            <div style={{ fontSize:'28px', fontWeight:800, color:'#fff', lineHeight:1 }}>{checkedToday.length}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', marginTop:'3px' }}>완료</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'14px', padding:'10px 18px', textAlign:'center', minWidth:'64px' }}>
            <div style={{ fontSize:'28px', fontWeight:800, color:'#fff', lineHeight:1 }}>{notCheckedToday.length}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', marginTop:'3px' }}>미체크</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'14px', padding:'10px 18px', textAlign:'center', minWidth:'64px' }}>
            <div style={{ fontSize:'28px', fontWeight:800, color:'#fff', lineHeight:1 }}>{pct}%</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', marginTop:'3px' }}>달성률</div>
          </div>
        </div>
      </div>

      {/* 진행바 */}
      <div style={{ height:'6px', background:'#e5e7eb' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:'#16a34a', transition:'width 0.5s ease' }} />
      </div>

      {/* 본문 */}
      <div style={{ flex:1, padding:'20px 24px', display:'grid', gridTemplateColumns: notCheckedToday.length > 0 && checkedToday.length > 0 ? '1fr 1fr' : '1fr', gap:'20px', alignItems:'start' }}>
        {/* 완료 */}
        {checkedToday.length > 0 && (
          <div>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#16a34a', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
              ✅ 진도체크 완료
              <span style={{ background:'#dcfce7', borderRadius:'20px', padding:'2px 10px', fontSize:'12px' }}>{checkedToday.length}명</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {groupByProductStage(checkedToday).map(({ prod, curStage, items }) => (
                <div key={`${prod?.id}__${curStage}`}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'#15803d', background:'#dcfce7', borderRadius:'6px', padding:'2px 10px', display:'inline-block', marginBottom:'6px' }}>
                    🤖 {prod?.name} {curStage}단계
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {items.map(({ s, todayChecks, allChecks, lastModelTitle, isMax }) => (
                      <div key={s.id} onClick={() => openProgCheck(s, spItems.find(i=>i.studentId===s.id&&i.classId===cls.id)?.productId)}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'12px', background:'#f0fdf4', border:'2px solid #86efac', cursor:'pointer' }}>
                        <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:'16px', color:'#fff', fontWeight:800 }}>{(s.name||'?')[0]}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:'#15803d' }}>{s.name}</div>
                          {lastModelTitle && <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'2px' }}>{lastModelTitle}</div>}
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'14px', fontWeight:700, color:'#16a34a' }}>+{todayChecks.length}차시</div>
                          <div style={{ fontSize:'11px', color:'#9ca3af' }}>누적 {allChecks.length}차시</div>
                        </div>
                        {isMax && <span style={{ fontSize:'10px', background:'#fef2f2', color:'#ef4444', border:'1px solid #fca5a5', borderRadius:'4px', padding:'2px 6px', fontWeight:700 }}>최대</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미체크 */}
        {notCheckedToday.length > 0 && (
          <div>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#9ca3af', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
              ⬜ 미체크
              <span style={{ background:'#f3f4f6', borderRadius:'20px', padding:'2px 10px', fontSize:'12px' }}>{notCheckedToday.length}명</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {groupByProductStage(notCheckedToday).map(({ prod, curStage, items }) => (
                <div key={`${prod?.id}__${curStage}`}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'#9ca3af', background:'#f3f4f6', borderRadius:'6px', padding:'2px 10px', display:'inline-block', marginBottom:'6px' }}>
                    🤖 {prod?.name} {curStage}단계
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {items.map(({ s, lastModelTitle }) => (
                      <div key={s.id} onClick={() => openProgCheck(s, spItems.find(i=>i.studentId===s.id&&i.classId===cls.id)?.productId)}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'12px', background:'#f9fafb', border:'2px solid #e5e7eb', cursor:'pointer' }}>
                        <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:'16px', color:'#9ca3af', fontWeight:800 }}>{(s.name||'?')[0]}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>{s.name}</div>
                          {lastModelTitle && <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>{lastModelTitle}</div>}
                        </div>
                        <div style={{ fontSize:'12px', color:'#f97316', fontWeight:700 }}>체크하기 ›</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {studentProgList.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#d1d5db', fontSize:'14px' }}>교구 배정된 학생이 없습니다</div>
        )}
      </div>

      {/* 하단 업데이트 시각 */}
      {lastUpdated && (
        <div style={{ padding:'8px 24px 14px', textAlign:'right', fontSize:'11px', color:'#d1d5db' }}>
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
        </div>
      )}

      {/* 별도 창 내 ProgCheckModal */}
      {progStudent && ReactDOM.createPortal(
        <ProgCheckModal
          student={progStudent}
          initialProductId={progProductId}
          spProds={spProds}
          teacherId={cls.teacherId}
          onClose={() => setProgStudent(null)}
          onSaved={handleSaved}
        />,
        document.body
      )}
    </div>
  )
}

// ─── 수업 메모장 래퍼
function LessonMemoPanelWrapper({ cls, date, classId, selSection, filteredStudents, onProgClose }) {
  const [spItems,  setSpItems]  = useState(() => cls ? SupplyItems.byTeacher(cls.teacherId||'') : [])
  const [spProds,  setSpProds]  = useState(() => cls ? SupplyProducts.byTeacher(cls.teacherId||'') : [])
  const [spProg,   setSpProg]   = useState(() => cls ? SupplyStudentProgress.byTeacher(cls.teacherId||'') : [])
  const [spChecks, setSpChecks] = useState(() => cls ? SupplySessionChecks.byTeacher(cls.teacherId||'') : [])
  const [spGiven,  setSpGiven]  = useState(() => cls ? SupplyGiven.byTeacher(cls.teacherId||'') : [])
  const [progStudent, setProgStudent] = useState(null)
  const [progProductId, setProgProductId] = useState('')
  const [tick, setTick] = useState(0)
  const lastPayloadRef = useRef(null)

  useEffect(() => {
    if (!cls) return
    setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
    setSpProds(SupplyProducts.byTeacher(cls.teacherId||''))
    setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
    setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
    setSpGiven(SupplyGiven.byTeacher(cls.teacherId||''))
  }, [cls?.id, date, tick])

  // 수업화면(별도 창)에서 진도체크 시 왼쪽 패널 갱신
  useEffect(() => {
    const ch = new BroadcastChannel('progress_screen')
    ch.onmessage = async (e) => {
      if (e.data?.type === 'refresh') {
        if (!cls) return
        if (e.data?.source !== 'main') {
          await refreshTablesFromSupabase('supplySessionChecks', 'supplyStudentProgress', 'supplyItems', 'supplyProducts')
        }
        setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
        setSpProds(SupplyProducts.byTeacher(cls.teacherId||''))
        setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
        setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
        setTick(t => t+1)
      }
    }
    return () => ch.close()
  }, [cls?.id])

  // 별도 창이 열리면 즉시 최신 메타 재전송
  useEffect(() => {
    const ready = new BroadcastChannel('progress_screen_ready')
    ready.onmessage = () => {
      if (lastPayloadRef.current) {
        const ch = new BroadcastChannel('progress_screen')
        ch.postMessage(lastPayloadRef.current)
        ch.close()
      }
    }
    return () => ready.close()
  }, [])

  // PC Attendance의 students (이미 반/수업 필터 적용됨)를 그대로 사용
  // filteredStudents가 없으면 cls.id 기준 전체
  const allClassStudents = cls ? StudentsDB.byClass(cls.id) : []
  const students = filteredStudents || allClassStudents
  if (!cls || !classId) return null

  return (
    <>
      <LessonMemoPanel
        cls={cls} date={date} students={students}
        spItems={spItems} spProds={spProds} spProg={spProg} spChecks={spChecks} spGiven={spGiven}
        onProgOpen={(s, pid) => { setProgStudent({...s, _clsId: cls.id}); setProgProductId(pid) }}
        onOpenScreen={(payload) => { lastPayloadRef.current = payload }}
      />
      {progStudent && ReactDOM.createPortal(
        <ProgCheckModal
          student={progStudent} initialProductId={progProductId}
          spProds={spProds} teacherId={cls.teacherId}
          onClose={() => { setProgStudent(null); onProgClose && onProgClose() }}
          onSaved={() => {
            setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
            setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
            setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
            setSpGiven(SupplyGiven.byTeacher(cls.teacherId||''))
            setTick(t => t+1)
            // 별도 창에 갱신 신호 전송
            const ch = new BroadcastChannel('progress_screen')
            ch.postMessage({ type: 'refresh', source: 'main' })
            ch.close()
          }}
        />,
        document.body
      )}
    </>
  )
}

// ─── 달력
function AttCalendar({ year, month, selectedDate, sessionDates, onSelect, onPrevMonth, onNextMonth, onToday }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayStr()
  const sessionSet = new Set(sessionDates)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={onPrevMonth} style={navBtn}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{year}년 {MONTHS[month]}</span>
          <button onClick={onToday} style={{ padding: '2px 9px', borderRadius: '6px', border: `1px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>오늘</button>
        </div>
        <button onClick={onNextMonth} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAYS_KO.map((d, i) => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '3px 0', color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSession = sessionSet.has(dateStr)
          const isToday = dateStr === today
          const isSel = dateStr === selectedDate
          const isPast = dateStr < today
          const isSun = (firstDay + day - 1) % 7 === 0
          const isSat = (firstDay + day - 1) % 7 === 6
          // 수업 미선택 시 모든 날짜 클릭 가능, 선택 시 수업일만 활성
          if (!isSession) return (
            <button key={day} onClick={() => onSelect(dateStr)} style={{
              padding: '6px 2px', textAlign: 'center', fontSize: '12px', border: 'none', borderRadius: '6px',
              background: isSel ? '#e5e7eb' : 'transparent',
              color: isSun ? '#fca5a5' : isSat ? '#93c5fd' : '#9ca3af',
              cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
            }}>{day}</button>
          )
          return (
            <button key={day} onClick={() => onSelect(dateStr)} style={{
              position: 'relative', padding: '7px 2px', border: 'none', borderRadius: '8px', cursor: 'pointer',
              background: isSel ? C.primary : isToday ? '#fff7ed' : isPast ? '#f9fafb' : '#f0fdf4',
              color: isSel ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : C.text,
              fontWeight: isSel || isToday ? 700 : 500, fontSize: '13px',
              outline: isToday && !isSel ? `2px solid ${C.primary}` : 'none', outlineOffset: '-2px',
              transition: 'all .12s', fontFamily: 'Noto Sans KR, sans-serif',
            }}>
              {day}
              <span style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', display: 'block', background: isSel ? '#fff' : isPast ? '#16a34a' : C.primary }} />
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '12px', fontSize: '11px', color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width:6,height:6,borderRadius:'50%',background:'#16a34a',display:'inline-block' }}/> 지난 수업</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width:6,height:6,borderRadius:'50%',background:C.primary,display:'inline-block' }}/> 예정 수업</span>
      </div>
    </div>
  )
}

const navBtn = { width:'28px',height:'28px',borderRadius:'7px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center' }

// ─── 전화번호 클릭 액션 (문자/전화/카톡)
function PhoneAction({ phone, children }) {
  const [open, setOpen] = useState(false)
  const { success } = useToast()
  const raw = (phone || '').replace(/[^0-9]/g, '')
  if (!raw) return <span style={{ fontSize:'11px', color:'#9ca3af' }}>-</span>
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  const handleAction = (action) => {
    setOpen(false)
    if (!isMobile) {
      success('📱 핸드폰에서 작동합니다')
      return
    }
    if (action === 'call') window.location.href = `tel:${raw}`
    if (action === 'sms')  window.open(`sms:${raw}`)
    if (action === 'kakao') window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${raw}`)
  }

  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <span onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{ fontSize:'11px', color:'#3b82f6', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:'2px' }}>
        {children}
      </span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:1 }} />
          <div style={{ position:'absolute', top:'100%', left:0, zIndex:1000, background:'#fff', borderRadius:'10px', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', border:'1px solid #e5e7eb', overflow:'hidden', minWidth:'130px', marginTop:'4px' }}>
            <button onClick={() => handleAction('call')}  style={phoneActionBtn}>📞 전화하기</button>
            <button onClick={() => handleAction('sms')}   style={phoneActionBtn}>💬 문자 보내기</button>
            <button onClick={() => handleAction('kakao')} style={phoneActionBtn}>💛 카톡 보내기</button>
          </div>
        </>
      )}
    </div>
  )
}
const phoneActionBtn = { display:'block', width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', textAlign:'left', color:'#374151', borderBottom:'1px solid #f3f4f6' }

// ─── 플레이스홀더 치환
const PLACEHOLDER_LABELS = [
  ['{학생이름}', '학생 이름'],
  ['{학교명}',   '학교 이름'],
  ['{수업명}',   '수업 이름'],
  ['{선생님이름}','선생님 이름'],
  ['{선생님닉네임}','선생님 닉네임'],
  ['{날짜}',     '오늘 날짜'],
]
function replacePlaceholders(text, student, cls, user) {
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`
  // 메시지 가이드 설정의 선생님 이름/닉네임 우선 사용
  const profile = user?.id ? TeacherProfiles.byTeacher(user.id) : null
  const teacherName     = profile?.name     || user?.name     || ''
  const teacherNickname = profile?.nickname || profile?.name  || user?.nickname || user?.name || ''
  const inviteLink = `${window.location.origin}/parent-invite?phone=${encodeURIComponent(student?.parentPhone||'')}&teacher=${encodeURIComponent(user?.id||'')}`
  return text
    .replace(/{학생이름}/g, student?.name || '')
    .replace(/{학교명}/g,   cls?.organization || student?.school || '')
    .replace(/{수업명}/g,   cls ? `${cls.className}${(cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')) ? ' '+(cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')) : ''}` : '')
    .replace(/{선생님이름}/g, teacherName)
    .replace(/{선생님닉네임}/g, teacherNickname)
    .replace(/{날짜}/g, dateStr)
    .replace(/{출결서비스링크}/g, inviteLink)
}

const GUIDE_CATS = ['출석', '결석', '지각', '하교']

// ─── 학부모 메시지 발송
function MsgModal({ student, cls, user, onClose }) {
  const { success, error } = useToast()
  const phone = student.parentPhone?.replace(/[^0-9]/g, '') || ''

  // contactMethod는 저장 후 즉시 반영되도록 로컬 state로 관리
  const [contactMethod, setContactMethodState] = useState(student.contactMethod || '')
  const [guideTab, setGuideTab]  = useState('결석')
  const [text, setText]          = useState('')

  // MessageGuide에 등록된 카테고리 — 모바일은 4개만 표시
  const allGuides  = MessageGuides.byTeacher(user?.id || '')
  const guideCats  = GUIDE_CATS
  const guides     = allGuides.filter(g => g.category === guideTab)

  // 연락 방법 저장 (학생 DB에 반영)
  const saveContactMethod = (method) => {
    StudentsDB.update(student.id, { contactMethod: method })
    setContactMethodState(method)
  }

  const applyGuide = (content) => setText(replacePlaceholders(content, student, cls, user))

  const sendSMS = () => {
    if (!phone) { error('학부모 전화번호가 없습니다.'); return }
    window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    onClose()
  }
  const sendKakao = () => {
    if (!phone) { error('학부모 전화번호가 없습니다.'); return }
    window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(text)}`)
    onClose()
  }
  const copyText = () => {
    navigator.clipboard.writeText(text).then(() => success('메시지가 복사되었습니다.')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta); success('복사되었습니다.')
    })
  }

  // ── 연락 방법 미설정 → 설정 화면
  if (!contactMethod) {
    return (
      <Modal open={true} onClose={onClose} title="📱 연락 방법 설정" width={380}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>{student.name} 학부모</div>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '24px' }}>어떤 방법으로 연락하시나요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => saveContactMethod('sms')}
              style={{ padding: '15px', borderRadius: '12px', border: '2px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💬 문자 메시지
            </button>
            <button onClick={() => saveContactMethod('kakao')}
              style={{ padding: '15px', borderRadius: '12px', border: '2px solid #ca8a04', background: '#fefce8', color: '#3c1e1e', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💛 카카오톡
            </button>
            <button onClick={() => saveContactMethod('both')}
              style={{ padding: '15px', borderRadius: '12px', border: '2px solid #9ca3af', background: '#f9fafb', color: '#374151', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💬💛 문자 + 카카오 둘 다
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── 메시지 발송 화면
  const showSMS   = contactMethod === 'sms'   || contactMethod === 'both'
  const showKakao = contactMethod === 'kakao' || contactMethod === 'both'

  return (
    <Modal open={true} onClose={onClose} title="📱 학부모 메시지" width={500}>
      {/* 헤더: 학생명 + 연락방법 배지 + 변경 버튼 */}
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '14px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
        <span style={{ fontWeight:600, color:C.text }}>{student.name}</span>
        <span>{fmtPhone(student.parentPhone) || '전화번호 없음'}</span>
        {contactMethod === 'kakao' && <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#FEE500', color:'#3c1e1e' }}>💛 카톡</span>}
        {contactMethod === 'sms'   && <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#eff6ff', color:'#1d4ed8' }}>💬 문자</span>}
        {contactMethod === 'both'  && <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#f3f4f6', color:'#6b7280' }}>💬💛 둘 다</span>}
        <button onClick={() => setContactMethodState('')}
          style={{ marginLeft:'auto', fontSize:'11px', color:C.muted, background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'2px 8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          변경
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 1단계: 카테고리 탭 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>① 카테고리 선택</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {guideCats.map(cat => (
              <button key={cat} onClick={() => { setGuideTab(cat); setText('') }}
                style={{ padding: '4px 10px', borderRadius: '12px', border: `1.5px solid ${guideTab===cat ? C.primary : C.border}`, background: guideTab===cat ? '#fff7ed' : '#fff', color: guideTab===cat ? C.primary : C.muted, fontSize: '12px', fontWeight: guideTab===cat ? 700 : 400, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: '11px', color: '#9ca3af' }}>
            💡 추첨·종강·개강 등 다른 문구는 PC 버전에서 발송해주세요.
          </div>
        </div>

        {/* 2단계: 문구 선택 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>② 문구 선택</div>
          {guides.length === 0 ? (
            <div style={{ fontSize: '12px', color: C.muted, padding: '12px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              이 카테고리에 등록된 문구가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
              {guides.map(g => (
                <button key={g.id} onClick={() => applyGuide(g.content)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${text === replacePlaceholders(g.content, student, cls, user) ? C.primary : C.border}`, background: text === replacePlaceholders(g.content, student, cls, user) ? '#fff7ed' : '#f9fafb', textAlign: 'left', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#fff7ed'; e.currentTarget.style.borderColor=C.primary }}
                  onMouseLeave={e => { const sel = text === replacePlaceholders(g.content, student, cls, user); e.currentTarget.style.background=sel?'#fff7ed':'#f9fafb'; e.currentTarget.style.borderColor=sel?C.primary:C.border }}>
                  {g.title && <div style={{ fontSize: '11px', fontWeight: 700, color: C.primary, marginBottom: '2px' }}>{g.title}</div>}
                  <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {g.content}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3단계: 발송 내용 확인 + 직접 수정 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>
            ③ {text ? '발송 내용 확인 · 수정' : '직접 입력'}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
            placeholder="위에서 문구를 선택하거나 직접 입력하세요..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1.5px solid ${text ? C.primary : C.border}`, fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.7 }} />
        </div>

        {/* 발송 버튼 — contactMethod에 설정된 방법만 표시 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {showSMS && (
            <button onClick={sendSMS}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #3b82f6', background: '#3b82f6', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💬 문자 발송
            </button>
          )}
          {showKakao && (
            <button onClick={sendKakao}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #ca8a04', background: '#fee500', color: '#3c1e1e', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💛 카톡 발송
            </button>
          )}
          <button onClick={copyText}
            style={{ padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>
            복사
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── 출결초대 모달
function InviteModal({ student, user, onClose, onSent }) {
  const phone = student.parentPhone?.replace(/[^0-9]/g, '') || ''
  const link  = `${window.location.origin}/parent-invite?phone=${encodeURIComponent(student.parentPhone||'')}&teacher=${encodeURIComponent(user?.id||'')}`
  const defaultText = `안녕하세요 😊 ${student.name} 학생 학부모님!\n출결 현황을 실시간으로 확인하실 수 있는 출결서비스에 초대드립니다.\n아래 링크를 클릭해 가입해주세요 🙏\n${link}`
  const [text, setText] = useState(defaultText)
  const { success } = useToast()

  const send = (method) => {
    if (method === 'kakao') window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(text)}`)
    else window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    StudentsDB.update(student.id, { parentInviteSentAt: new Date().toISOString() })
    onSent && onSent(student.id)
    success('초대 메시지가 발송되었습니다.')
    onClose()
  }
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
    })
    success('복사되었습니다.')
  }

  return (
    <Modal open={true} onClose={onClose} title={`📨 출결초대 — ${student.name}`} width={480}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <div style={{ fontSize:'13px', color:C.muted }}>
          아래 문구를 확인하고 발송 방법을 선택하세요.
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={7}
          style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', resize:'vertical', outline:'none', lineHeight:1.6, boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={() => send('sms')}
            style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            💬 문자 발송
          </button>
          <button onClick={() => send('kakao')}
            style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#FEE500', color:'#3C1E1E', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            💛 카카오 발송
          </button>
          <button onClick={copy}
            style={{ padding:'11px 16px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            복사
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── 학생 메모 팝업 (예정 수업 행에서 사용)
function StudentMemoModal({ student, onClose, onSave }) {
  const [text, setText] = useState(student.memo || '')
  const doSave = () => {
    StudentsDB.update(student.id, { memo: text })
    onSave(text)
    onClose()
  }
  return (
    <Modal open={true} onClose={onClose} title={`📌 ${student.name} 메모`} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus
          placeholder="메모를 입력하세요..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1.5px solid ${C.border}`, fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={doSave} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── 지급 기록 인라인 수정 행 (신형: 지급상태 + 청구·입금상태 분리, givenAt + paidAt 별도)
function GivenRecordRow({ record, classId, onSaved, hideQuarter }) {
  const [editing, setEditing]     = React.useState(false)
  const [item, setItem]           = React.useState(record.itemName)
  const [quarter, setQuarter]     = React.useState(record.quarter || '')
  const [givenDate, setGivenDate] = React.useState(record.givenAt || '')
  const [paidDate, setPaidDate]   = React.useState(record.paidAt  || '')

  // 초기값: supplyStatus 컬럼 있으면 신규모델, 없으면 구모델에서 역산
  const initSupply = () => {
    if (record.supplyStatus) return record.supplyStatus
    const s = record.status || 'given'
    return ['billed','paid'].includes(s) ? 'given' : s
  }
  const initBilling = () => {
    if (record.supplyStatus != null) return record.status || 'none'
    const s = record.status || 'given'
    if (s === 'billed') return 'billed'
    if (s === 'paid')   return 'paid'
    if (record.paymentStatus === 'unpaid') return 'unpaid'
    return 'none'
  }
  const [supplyStatus,  setSupplyStatus]  = React.useState(initSupply)
  const [billingStatus, setBillingStatus] = React.useState(initBilling)

  const SUPPLY_STYLE = {
    ready:  { bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db', label:'준비' },
    given:  { bg:'#dbeafe', color:'#1d4ed8', border:'#93c5fd', label:'지급' },
    unpaid: { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', label:'미지급(보관)' },
    extra:  { bg:'#ede9fe', color:'#7c3aed', border:'#c4b5fd', label:'추가지급' },
    own:    { bg:'#fef9c3', color:'#854d0e', border:'#fde047', label:'보유교구' },
  }
  const BILLING_STYLE = {
    billed: { bg:'#fef9c3', color:'#a16207', border:'#fde047', label:'청' },
    paid:   { bg:'#dcfce7', color:'#15803d', border:'#86efac', label:'입' },
    unpaid: { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', label:'미입금' },
    check:  { bg:'#f3e8ff', color:'#7c3aed', border:'#c4b5fd', label:'확인필요' },
  }
  const st = (billingStatus !== 'none' && BILLING_STYLE[billingStatus])
    || SUPPLY_STYLE[supplyStatus]
    || SUPPLY_STYLE.given
  const ssStyle = SUPPLY_STYLE[supplyStatus]  || SUPPLY_STYLE.given
  const bsStyle = (billingStatus !== 'none' && BILLING_STYLE[billingStatus]) || { bg:'#f3f4f6', color:'#9ca3af' }

  const classInfo = ClassesDB.find(classId)
  const isQuarter = classInfo?.termType === 'quarter'
  const termUnit  = isQuarter ? '분기' : '학기'
  const termCount = isQuarter ? 4 : 2
  const curYear   = new Date().getFullYear()
  const termOpts  = []
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    for (let t = 1; t <= termCount; t++) termOpts.push(`${y}-${t}${termUnit}`)
  }

  const doUpdate = async (ss, bs, gd, pd) => {
    const paymentStatus = bs === 'paid' ? 'paid' : bs === 'unpaid' ? 'unpaid' : 'paid'
    await SupplyGiven.update(record.id, {
      supplyStatus: ss, status: bs, paymentStatus, givenAt: gd, paidAt: pd || null,
    })
    onSaved && onSaved()
  }

  const handleSupplyChange  = async (val) => { setSupplyStatus(val);  await doUpdate(val, billingStatus, givenDate, paidDate) }
  const handleBillingChange = async (val) => { setBillingStatus(val); await doUpdate(supplyStatus, val, givenDate, paidDate) }
  const handleGivenDate     = async (val) => { setGivenDate(val);     await doUpdate(supplyStatus, billingStatus, val, paidDate) }
  const handlePaidDate      = async (val) => { setPaidDate(val);      await doUpdate(supplyStatus, billingStatus, givenDate, val) }

  const handleSave = async () => {
    if (!item.trim()) return
    const paymentStatus = billingStatus === 'paid' ? 'paid' : billingStatus === 'unpaid' ? 'unpaid' : 'paid'
    await SupplyGiven.update(record.id, {
      itemName: item.trim(), givenAt: givenDate, quarter: quarter || null,
      supplyStatus, status: billingStatus, paymentStatus, paidAt: paidDate || null,
    })
    setEditing(false)
    onSaved && onSaved()
  }

  const showGivenDate = supplyStatus === 'given' || supplyStatus === 'extra'
  const showPaidDate  = billingStatus === 'billed' || billingStatus === 'paid'

  if (editing) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap', padding:'7px 10px', background:st.bg, borderRadius:'8px', border:`1px solid ${st.border}` }}>
        <input value={item} onChange={e => setItem(e.target.value)}
          style={{ width:'100px', padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <select value={supplyStatus} onChange={e => setSupplyStatus(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
          <option value="ready">준비</option>
          <option value="given">지급</option>
          <option value="unpaid">미지급</option>
          <option value="extra">추가지급</option>
          <option value="own">보유교구</option>
        </select>
        <input type="date" value={givenDate} onChange={e => setGivenDate(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        {!hideQuarter && (
          <select value={quarter} onChange={e => setQuarter(e.target.value)}
            style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
            <option value="">{termUnit} 선택</option>
            {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <select value={billingStatus} onChange={e => setBillingStatus(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
          <option value="none">-</option>
          <option value="billed">청구</option>
          <option value="paid">입금</option>
          <option value="unpaid">미입금</option>
          <option value="check">확인필요</option>
        </select>
        <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <button onClick={handleSave}
          style={{ padding:'2px 8px', borderRadius:'5px', border:'none', background:'#16a34a', color:'#fff', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
        <button onClick={() => { setItem(record.itemName); setGivenDate(record.givenAt||''); setPaidDate(record.paidAt||''); setQuarter(record.quarter||''); setSupplyStatus(initSupply()); setBillingStatus(initBilling()); setEditing(false) }}
          style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'11px', cursor:'pointer' }}>취소</button>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:st.bg, borderRadius:'8px', border:`1px solid ${st.border}`, flexWrap:'wrap' }}>
      {/* 교구명 */}
      <span style={{ fontSize:'13px', fontWeight:600, color:st.color, flex:1, minWidth:'60px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {record.itemName}
      </span>
      {/* 드롭1: 지급상태 */}
      <select value={supplyStatus} onChange={e => handleSupplyChange(e.target.value)}
        style={{ padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background:ssStyle.bg, color:ssStyle.color }}>
        <option value="ready">준비</option>
        <option value="given">지급</option>
        <option value="unpaid">미지급</option>
        <option value="extra">추가지급</option>
        <option value="own">보유교구</option>
      </select>
      {/* 지급날짜 */}
      <input type="date" value={givenDate} onChange={e => handleGivenDate(e.target.value)}
        title="지급날짜"
        style={{ padding:'2px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', cursor:'pointer' }} />
      {/* 드롭2: 청구·입금 */}
      <select value={billingStatus} onChange={e => handleBillingChange(e.target.value)}
        style={{ padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background:bsStyle.bg, color:bsStyle.color }}>
        <option value="none">-</option>
        <option value="billed">청구</option>
        <option value="paid">입금</option>
        <option value="unpaid">미입금</option>
        <option value="check">확인필요</option>
      </select>
      {/* 입금날짜 */}
      <input type="date" value={paidDate} onChange={e => handlePaidDate(e.target.value)}
        title="입금날짜"
        style={{ padding:'2px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', cursor:'pointer' }} />
      {/* 수정·삭제 */}
      <button onClick={() => setEditing(true)}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fed7aa', background:'#fff7ed', color:'#f97316', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
      <button onClick={async () => { await SupplyGiven.delete(record.id); onSaved && onSaved() }}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
    </div>
  )
}

// ─── 교구 미배정 학생 — 진도체크 모달 안에서 바로 교구 설정
function NoSupplyAssignModal({ student, classId, teacherId, allProds, onClose, onSaved }) {
  const { success, error } = useToast()
  const [selProductId, setSelProductId] = React.useState('')
  const [selStage, setSelStage] = React.useState(1)
  const [saving, setSaving] = React.useState(false)

  const product = allProds.find(p => p.id === selProductId)
  const maxStage = product?.maxStage || 10

  const handleSave = async () => {
    if (!selProductId) { error('교구를 선택해주세요'); return }
    setSaving(true)
    await SupplyItems.upsert({
      id: uid(), teacherId: teacherId || '', classId, studentId: student.id,
      productId: selProductId, stage: selStage, remoteNo: '', createdAt: now(),
    })
    await SupplyStudentProgress.upsert({
      id: uid(), teacherId: teacherId || '', studentId: student.id, classId,
      productId: selProductId, curStage: selStage, curSession: 1,
      updatedAt: now(), createdAt: now(),
    })
    setSaving(false)
    success('교구가 설정되었습니다')
    onSaved && onSaved()
  }

  return (
    <Modal open={true} onClose={onClose} title={`📊 ${student.name} 진도 체크`} width={780}>
      <div style={{ padding:'24px' }}>
        <div style={{ padding:'14px 16px', background:'#fff7ed', borderRadius:'10px', border:'1px solid #fed7aa', marginBottom:'20px' }}>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'4px' }}>📦 교구가 배정되지 않은 학생입니다</div>
          <div style={{ fontSize:'12px', color:'#b45309' }}>아래에서 교구를 선택하면 바로 진도체크를 시작할 수 있습니다</div>
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'160px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>교구 선택 *</label>
            <select value={selProductId} onChange={e => { setSelProductId(e.target.value); setSelStage(1) }}
              style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value=''>-- 교구를 선택하세요 --</option>
              {allProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
            <select value={selStage} onChange={e => setSelStage(Number(e.target.value))}
              style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              {Array.from({ length: maxStage }, (_, i) => i+1).map(s => (
                <option key={s} value={s}>{s}단계</option>
              ))}
            </select>
          </div>
          <button onClick={handleSave} disabled={saving || !selProductId}
            style={{ padding:'8px 20px', borderRadius:'8px', border:'none', background: selProductId ? C.primary : '#e5e7eb', color: selProductId ? '#fff' : '#9ca3af', fontSize:'13px', fontWeight:700, cursor: selProductId ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            {saving ? '저장 중...' : '저장 후 진도체크'}
          </button>
        </div>
      </div>
      <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb' }}>
        <button onClick={onClose} style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>닫기</button>
      </div>
    </Modal>
  )
}

// ─── 예정 수업 학생 행 — StudentRow 코드 완전 동일, 출석컬럼만 예정버튼으로 교체
// ─── 진도 체크 모달 (공통 컴포넌트 — 교구/단계 변경 지원)
function ProgCheckModal({ student, initialProductId, spProds, teacherId, onClose, onSaved }) {
  const classId = student._clsId || student.classIds?.[0] || ''
  const [selProductId, setSelProductId] = React.useState(initialProductId || '')
  const [selStage, setSelStage] = React.useState(() => {
    const si = SupplyItems.byClassStudent(classId, student.id)[0]
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === (initialProductId || si?.productId || ''))
    return prog?.curStage ? Number(prog.curStage) : (si?.stage ? Number(si.stage) : 1)
  })
  const [remoteNo, setRemoteNo] = React.useState(() => {
    const si = SupplyItems.byClassStudent(classId, student.id)[0]
    return si?.remoteNo || ''
  })
  const [remoteNoSaved, setRemoteNoSaved] = React.useState(false)
  const [tick, setTick] = React.useState(0)
  const [nextProductId, setNextProductId] = React.useState(() => {
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === (initialProductId || ''))
    return prog?.nextProductId || ''
  })
  const [nextStage, setNextStage] = React.useState(() => {
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === (initialProductId || ''))
    return prog?.nextStage || 1
  })
  const [nextSaved, setNextSaved] = React.useState(false)

  // ── 학교/학생/교구 이관 상태
  const [transferSchool, setTransferSchool] = React.useState(() => {
    const _si = SupplyItems.byClassStudent(classId, student.id)[0]
    const _pid = initialProductId || _si?.productId || ''
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
      || SupplyStudentProgress.byStudent(student.id, classId)[0]
    return prog?.transferSchool || ''
  })
  const [transferStudent, setTransferStudent] = React.useState(() => {
    const _si = SupplyItems.byClassStudent(classId, student.id)[0]
    const _pid = initialProductId || _si?.productId || ''
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
      || SupplyStudentProgress.byStudent(student.id, classId)[0]
    return prog?.transferStudent || ''
  })
  const [transferSupply, setTransferSupply] = React.useState(() => {
    const _si = SupplyItems.byClassStudent(classId, student.id)[0]
    const _pid = initialProductId || _si?.productId || ''
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
      || SupplyStudentProgress.byStudent(student.id, classId)[0]
    return prog?.transferSupply || ''
  })
  const [transferSaved, setTransferSaved] = React.useState(false)

  // 모달 열릴 때 Supabase에서 최신 이관 정보 로드 (1회만)
  const _transferLoaded = React.useRef(false)
  React.useEffect(() => {
    if (_transferLoaded.current) return
    _transferLoaded.current = true
    refreshTablesFromSupabase('supplyStudentProgress').then(() => {
      const _si = SupplyItems.byClassStudent(classId, student.id)[0]
      const _pid = initialProductId || _si?.productId || ''
      const _prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
        || SupplyStudentProgress.byStudent(student.id, classId)[0]
      if (_prog) {
        setTransferSchool(_prog.transferSchool || '')
        setTransferStudent(_prog.transferStudent || '')
        setTransferSupply(_prog.transferSupply || '')
      }
    })
  }, [])

  const [givenNewItem, setGivenNewItem] = React.useState('')
  const [givenNewDate, setGivenNewDate] = React.useState('')
  const [givenNewPaidDate, setGivenNewPaidDate] = React.useState('')
  const [givenNewQuarter, setGivenNewQuarter] = React.useState('')
  const [givenNewSupplyStatus, setGivenNewSupplyStatus] = React.useState('given')
  const [givenNewBillingStatus, setGivenNewBillingStatus] = React.useState('none')
  const [givenSaving, setGivenSaving] = React.useState(false)

  // 매 렌더링마다 DB 직접 조회 — prop 교체와 무관하게 항상 최신값
  const si = SupplyItems.byClassStudent(classId, student.id)[0]
  const allProds = SupplyProducts.byTeacher(teacherId || '')
  const product = allProds.find(p => p.id === selProductId)

  // si 없음 → 교구 미배정 상태 — 모달 안에서 바로 교구 설정
  if (!si) return (
    <NoSupplyAssignModal
      student={student} classId={classId} teacherId={teacherId}
      allProds={allProds}
      onClose={onClose}
      onSaved={onSaved}
    />
  )

  // si 있는데 product 없음 → 교구가 삭제된 케이스
  if (!product) return (
    <Modal open={true} onClose={onClose} title={`📊 ${student.name} 진도 체크`} width={780}>
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <div style={{ fontSize:'36px', marginBottom:'12px' }}>⚠️</div>
        <div style={{ fontSize:'15px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>교구 정보를 찾을 수 없습니다</div>
        <div style={{ fontSize:'13px', color:'#9ca3af' }}>배정된 교구가 삭제되었거나 데이터가 올바르지 않습니다</div>
      </div>
      <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb' }}>
        <button onClick={onClose} style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>닫기</button>
      </div>
    </Modal>
  )

  const spp = product.sessionsPerStage || 12
  const alertSess = product.alertSession || 3
  const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === selProductId)
  const curStage = prog?.curStage || selStage || 1
  const maxShowStage = Math.max(selStage, curStage)
  const STAGES = Array.from({ length: maxShowStage }, (_, i) => i + 1)
  const maxStage = product.maxStage || 10

  const origProductId = si?.productId || ''
  const origStage = si?.stage ? Number(si.stage) : 1
  const isChanged = selProductId !== origProductId || selStage !== origStage

  const nextProduct = allProds.find(p => p.id === nextProductId)
  const nextMaxStage = nextProduct?.maxStage || 10
  const origNextProductId = prog?.nextProductId || ''
  const origNextStage = prog?.nextStage || 1
  const isNextChanged = nextProductId !== origNextProductId || Number(nextStage) !== Number(origNextStage)

  const givenRecords = SupplyGiven.byStudentClass(student.id, classId)

  const handleAddGiven = async () => {
    const dateRequired = givenNewSupplyStatus !== 'unpaid' && givenNewSupplyStatus !== 'own'
    if (!givenNewItem.trim() || (dateRequired && !givenNewDate)) return
    const classInfo = ClassesDB.find(classId)
    const className = classInfo ? ((classInfo.className || '') + (classInfo.section ? ' ' + classInfo.section : '')) : ''
    setGivenSaving(true)
    await SupplyGiven.insert({
      teacherId: teacherId || '',
      studentId: student.id,
      studentName: student.name,
      classId,
      className,
      schoolName: classInfo?.organization || '',
      productId: selProductId,
      productName: product.name,
      itemName: givenNewItem.trim(),
      givenAt: givenNewDate || undefined,
      paidAt: givenNewPaidDate || null,
      quarter: givenNewQuarter || null,
      supplyStatus: givenNewSupplyStatus,
      status: givenNewBillingStatus,
      createdAt: now(),
    })
    setGivenNewItem('')
    setGivenNewDate('')
    setGivenNewPaidDate('')
    setGivenNewQuarter('')
    setGivenNewSupplyStatus('given')
    setGivenNewBillingStatus('none')
    setGivenSaving(false)
    onSaved && onSaved()
  }

  const handleProductChange = (newId) => {
    setSelProductId(newId)
    setSelStage(1)
  }

  const handleApply = () => {
    if (!si) return
    SupplyItems.upsert({ ...si, productId: selProductId, stage: selStage, remoteNo: si.remoteNo || '' })
    onSaved && onSaved()
    setTick(t => t + 1)
  }

  const handleSaveRemoteNo = () => {
    if (!si) return
    SupplyItems.upsert({ ...si, remoteNo })
    setRemoteNoSaved(true)
    setTimeout(() => setRemoteNoSaved(false), 2000)
    onSaved && onSaved()
  }

  const handleSaveNext = () => {
    if (!nextProductId) return
    const base = prog || { id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId: selProductId, curStage: selStage, curSession: 1, createdAt: now() }
    SupplyStudentProgress.upsert({ ...base, nextProductId, nextStage: Number(nextStage), updatedAt: now() })
    setNextSaved(true)
    setTimeout(() => setNextSaved(false), 2000)
    onSaved && onSaved()
  }

  const [checking, setChecking] = React.useState(false)
  const toggleCheck = async (productId, stage, sessionNo) => {
    if (checking) return
    setChecking(true)
    try {
      const existing = SupplySessionChecks.byProductStudent(productId, student.id, classId).find(c => Number(c.stage)===Number(stage) && Number(c.sessionNo)===Number(sessionNo))
      if (existing) await SupplySessionChecks.delete(existing.id)
      else await SupplySessionChecks.upsert({ id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId, stage: Number(stage), sessionNo: Number(sessionNo), checkedAt: now(), createdAt: now() })
      const allChks = SupplySessionChecks.byProductStudent(productId, student.id, classId).filter(c => Number(c.stage)===Number(stage))
      const maxSess = allChks.length > 0 ? Math.max(...allChks.map(c => c.sessionNo)) : 1
      await Promise.all([
        SupplyStudentProgress.upsert({ id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId, curStage: stage, curSession: maxSess, updatedAt: now(), createdAt: now() }),
        si ? SupplyItems.upsert({ ...si, productId, stage, remoteNo: si.remoteNo || '' }) : Promise.resolve(),
      ])
      setTick(t => t + 1)
      onSaved && onSaved()
    } catch(e) {
      console.error('[toggleCheck] ERROR', e.message)
    } finally {
      setChecking(false)
    }
  }
  const updateCheckDate = async (productId, stage, sessionNo, newDateStr) => {
    const existing = SupplySessionChecks.byProductStudent(productId, student.id, classId).find(c => c.stage===stage && c.sessionNo===sessionNo)
    if (!existing) return
    await SupplySessionChecks.upsert({ ...existing, checkedAt: new Date(newDateStr).toISOString() })
    onSaved && onSaved()
    setTick(t => t + 1)
  }

  return (
    <Modal open={true} onClose={() => {}} title={`📊 ${student.name} 진도 체크`} width={780}>
      <div style={{ padding:'16px 24px', overflowY:'auto', maxHeight:'65vh' }}>
        {/* 교구 시리즈 / 단계 변경 */}
        <div style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:'10px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'10px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'160px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>교구 시리즈</label>
              <select value={selProductId} onChange={e => handleProductChange(e.target.value)}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {spProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={selStage} onChange={e => setSelStage(Number(e.target.value))}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: maxStage }, (_, i) => i+1).map(s => (
                  <option key={s} value={s}>{s}단계</option>
                ))}
              </select>
            </div>
            {isChanged && (
              <button onClick={handleApply}
                style={{ padding:'8px 18px', borderRadius:'8px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                ✓ 적용
              </button>
            )}
          </div>
          <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'8px' }}>
            🤖 {product.name} · {selStage}단계 배정 · 단계당 {spp}차시 기준
          </div>
        </div>
        {/* 리모컨 번호 */}
        <div style={{ padding:'10px 14px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:'10px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color:'#0369a1', whiteSpace:'nowrap' }}>🎮 리모컨 번호</span>
          <input
            value={remoteNo}
            onChange={e => setRemoteNo(e.target.value)}
            placeholder="예: A-12, 5번, RC03..."
            style={{ flex:1, padding:'6px 10px', borderRadius:'7px', border:'1.5px solid #bae6fd', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}
          />
          <button onClick={handleSaveRemoteNo}
            style={{ padding:'6px 14px', borderRadius:'7px', border:'none', background: remoteNoSaved ? '#16a34a' : '#0284c7', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            {remoteNoSaved ? '✓ 저장됨' : '저장'}
          </button>
        </div>
        {/* 이전 단계 완료 표시 */}
        {selStage > 1 && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' }}>
            {Array.from({ length: selStage - 1 }, (_, i) => i + 1).map(s => (
              <div key={s} style={{ padding:'6px 12px', borderRadius:'8px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:'12px', fontWeight:600, color:'#16a34a' }}>
                ✅ {s}단계 완료
              </div>
            ))}
          </div>
        )}
        {/* 현재 단계 진도 목록 */}
        {(() => {
          const stage = selStage
          const stagePlans = SupplyProductPlans.byProductStage(selProductId, stage).sort((a,b) => a.sessionNo-b.sessionNo)
          const sessions = stagePlans.length > 0 ? stagePlans
            : Array.from({ length: spp }, (_, i) => ({ id:`d_${stage}_${i+1}`, stage, sessionNo:i+1, dummy:true }))
          const stageChecks = SupplySessionChecks.byProductStudent(selProductId, student.id, classId).filter(c => c.stage===stage)
          const checkedNos = new Set(stageChecks.map(c => c.sessionNo))
          const cnt = stageChecks.length
          const isDone = cnt >= spp
          const actualSessions = sessions.length > 0 ? sessions.length : spp
          const isAlert = cnt >= (actualSessions - alertSess) && !isDone
          return (
            <div style={{ border:`1px solid ${isDone?'#86efac':isAlert?'#fde68a':'#e5e7eb'}`, borderRadius:'10px', overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:isDone?'#f0fdf4':isAlert?'#fffbeb':'#f9fafb', display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:isDone?'#16a34a':isAlert?'#f59e0b':'#111827' }}>{stage}단계</span>
                <span style={{ fontSize:'12px', color:'#6b7280' }}>{cnt}/{spp}차시</span>
                {isDone && (() => {
                  const np = nextProductId ? spProds.find(p => p.id === nextProductId) : null
                  return np
                    ? <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료 → {np.name} {nextStage}단계 준비</span>
                    : <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료</span>
                })()}
                {isAlert && !isDone && (() => {
                  const np = nextProductId ? spProds.find(p => p.id === nextProductId) : null
                  const alertLabel = np
                    ? `${np.name} ${nextStage}단계 준비 필요`
                    : `${product.name} ${selStage + 1}단계 준비 필요`
                  return <span style={{ fontSize:'11px', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>⚠️ {alertLabel}</span>
                })()}
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'4px' }}>
                {sessions.map(sess => {
                  const isChk = checkedNos.has(sess.sessionNo)
                  const chkRecord = stageChecks.find(c => c.sessionNo === sess.sessionNo)
                  const chkDateStr = chkRecord?.checkedAt ? (() => {
                    const d = new Date(chkRecord.checkedAt)
                    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                  })() : null
                  return (
                    <div key={sess.id}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px', borderRadius:'7px', background:isChk?'#f0fdf4':'#fff', border:`1px solid ${isChk?'#86efac':'#e5e7eb'}`, transition:'all .12s' }}>
                      <div onClick={() => toggleCheck(selProductId, stage, sess.sessionNo)}
                        style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${isChk?'#16a34a':'#e5e7eb'}`, background:isChk?'#16a34a':'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                        {isChk && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                      </div>
                      <span onClick={() => toggleCheck(selProductId, stage, sess.sessionNo)} style={{ fontSize:'13px', fontWeight:isChk?600:400, color:isChk?'#16a34a':'#111827', flex:1, cursor:'pointer' }}>
                        {sess.sessionNo}차시{!sess.dummy && sess.title ? ` · ${sess.title}` : ''}
                      </span>
                      {isChk && chkDateStr && (
                        <input type="date" defaultValue={chkDateStr}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { if(e.target.value) updateCheckDate(selProductId, stage, sess.sessionNo, e.target.value) }}
                          style={{ fontSize:'11px', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:'5px', padding:'1px 4px', background:'#fff', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
      {/* 학교/학생/교구 이관 정보 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#fffbeb', position:'relative', zIndex:1 }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'4px' }}>🏫 학교·학생·교구 이관 정보</div>
        <div style={{ fontSize:'11px', color:'#b45309', marginBottom:'10px' }}>새 학교 전입 시 이전 선생님의 교구를 사용 중인지 파악하는 정보입니다</div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', fontWeight:700, color:'#92400e' }}>학교 구분</label>
            <select value={transferSchool} onChange={e => { setTransferSchool(e.target.value); setTransferSaved(false) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택</option>
              <option value="신규학교">신규학교</option>
              <option value="기존학교">기존학교</option>
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', fontWeight:700, color:'#92400e' }}>학생 구분</label>
            <select value={transferStudent} onChange={e => { setTransferStudent(e.target.value); setTransferSaved(false) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택</option>
              <option value="신규학생">신규학생</option>
              <option value="신규전학">신규전학</option>
              <option value="기존학생">기존학생</option>
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', fontWeight:700, color:'#92400e' }}>교구 구분</label>
            <select value={transferSupply} onChange={e => { setTransferSupply(e.target.value); setTransferSaved(false) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택</option>
              <option value="기존교구">기존교구</option>
              <option value="지급교구">지급교구</option>
            </select>
          </div>
          <button
            onClick={async () => {
              const _productId = selProductId || si?.productId || ''
              const _prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _productId)
                || SupplyStudentProgress.byStudent(student.id, classId)[0]
              const base = _prog
                ? { ..._prog }
                : { id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId: _productId, createdAt: now() }
              await SupplyStudentProgress.upsert({ ...base, transferSchool, transferStudent, transferSupply, updatedAt: now() })
              setTransferSaved(true)
              setTimeout(() => {
                setTransferSaved(false)
                onSaved && onSaved()
              }, 1500)
            }}
            style={{ padding:'8px 16px', borderRadius:'8px', border:'none', background: transferSaved ? '#16a34a' : '#f59e0b', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', transition:'all .2s', alignSelf:'flex-end' }}>
            {transferSaved ? '✅ 저장됨' : '저장'}
          </button>
        </div>
        {(transferSchool || transferStudent || transferSupply) && (
          <div style={{ marginTop:'8px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {transferSchool && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px',
                background: transferSchool === '신규학교' ? '#dbeafe' : '#dcfce7',
                color: transferSchool === '신규학교' ? '#1d4ed8' : '#15803d',
                border: `1px solid ${transferSchool === '신규학교' ? '#93c5fd' : '#86efac'}` }}>
                🏫 {transferSchool}
              </span>
            )}
            {transferStudent && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px',
                background: transferStudent === '신규학생' ? '#dbeafe' : '#f3e8ff',
                color: transferStudent === '신규학생' ? '#1d4ed8' : '#7e22ce',
                border: `1px solid ${transferStudent === '신규학생' ? '#93c5fd' : '#d8b4fe'}` }}>
                👤 {transferStudent}
              </span>
            )}
            {transferSupply && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px',
                background: transferSupply === '기존교구' ? '#fef3c7' : '#dcfce7',
                color: transferSupply === '기존교구' ? '#92400e' : '#15803d',
                border: `1px solid ${transferSupply === '기존교구' ? '#fcd34d' : '#86efac'}` }}>
                📦 {transferSupply}
              </span>
            )}
            {transferSchool === '신규학교' && transferStudent === '기존학생' && transferSupply === '기존교구' && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}>
                ⚠️ 이전 선생님 교구 사용 중
              </span>
            )}
          </div>
        )}
      </div>

      {/* 다음 진도 준비 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#fafafa' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📌 다음 진도 준비</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'10px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'150px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>다음 교구</label>
            <select value={nextProductId} onChange={e => { setNextProductId(e.target.value); setNextStage(1) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택 안함</option>
              {spProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {nextProductId && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={nextStage} onChange={e => setNextStage(Number(e.target.value))}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: nextMaxStage }, (_, i) => i+1).map(s => (
                  <option key={s} value={s}>{s}단계</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={handleSaveNext} disabled={!nextProductId || (!isNextChanged && !nextSaved)}
            style={{ padding:'8px 16px', borderRadius:'8px', border:'none', background: nextSaved ? '#16a34a' : (nextProductId && isNextChanged ? '#f97316' : '#e5e7eb'), color: (nextProductId && isNextChanged) || nextSaved ? '#fff' : '#9ca3af', fontSize:'13px', fontWeight:700, cursor: nextProductId && isNextChanged ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', transition:'all .2s' }}>
            {nextSaved ? '✅ 저장됨' : '저장'}
          </button>
        </div>
        {nextProduct && (
          <div style={{ marginTop:'8px', fontSize:'12px', color:'#6b7280' }}>
            → {nextProduct.name} {nextStage}단계로 이어집니다
          </div>
        )}
      </div>
      {/* 교구 지급일 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#f8fafc' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📦 교구 지급 기록</div>
        {/* 기존 기록 목록 - 학기별 그룹 */}
        {givenRecords.length > 0 && (() => {
          const classInfo = ClassesDB.find(classId)
          const isQuarter = classInfo?.termType === 'quarter'
          const termUnit  = isQuarter ? '분기' : '학기'
          const termCount = isQuarter ? 4 : 2
          const curYear   = new Date().getFullYear()
          const termOpts  = []
          for (let y = curYear - 1; y <= curYear + 1; y++) {
            for (let t = 1; t <= termCount; t++) termOpts.push(`${y}-${t}${termUnit}`)
          }
          const grouped = {}
          givenRecords.forEach(r => {
            const k = r.quarter || '미분류'
            if (!grouped[k]) grouped[k] = []
            grouped[k].push(r)
          })
          const _palettes = [
            { hdrBg:'#dcfce7', hdrBorder:'#86efac', hdrColor:'#15803d', bodyBg:'#f0fdf4' },
            { hdrBg:'#dbeafe', hdrBorder:'#93c5fd', hdrColor:'#1d4ed8', bodyBg:'#eff6ff' },
            { hdrBg:'#fef9c3', hdrBorder:'#fde047', hdrColor:'#92400e', bodyBg:'#fefce8' },
            { hdrBg:'#ede9fe', hdrBorder:'#c4b5fd', hdrColor:'#6d28d9', bodyBg:'#f5f3ff' },
            { hdrBg:'#fce7f3', hdrBorder:'#f9a8d4', hdrColor:'#9d174d', bodyBg:'#fdf2f8' },
          ]
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'10px' }}>
              {Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([qKey, recs], qIdx) => {
                const isUnclassified = qKey === '미분류'
                const p = isUnclassified
                  ? { hdrBg:'#f3f4f6', hdrBorder:'#d1d5db', hdrColor:'#6b7280', bodyBg:'#fafafa' }
                  : _palettes[qIdx % _palettes.length]
                return (
                <div key={qKey} style={{ border:`1.5px solid ${p.hdrBorder}`, borderRadius:'10px', overflow:'hidden' }}>
                  <div style={{ background:p.hdrBg, padding:'4px 12px' }}>
                    <select
                      defaultValue={qKey === '미분류' ? '' : qKey}
                      onChange={async e => {
                        const newQ = e.target.value || null
                        for (const r of recs) {
                          await SupplyGiven.update(r.id, { quarter: newQ })
                        }
                        onSaved && onSaved()
                      }}
                      style={{ fontSize:'12px', fontWeight:700, color:p.hdrColor, background:'transparent', border:'none', outline:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', padding:'2px 0' }}>
                      <option value="">미분류</option>
                      {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px', padding:'6px 8px', background:p.bodyBg }}>
                    {recs.map(r => (
                      <GivenRecordRow key={r.id} record={r} classId={classId} onSaved={onSaved} hideQuarter />
                    ))}
                  </div>
                </div>
                )
              })}
            </div>
          )
        })()}
        {/* 새 기록 입력 */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={givenNewItem} onChange={e => setGivenNewItem(e.target.value)}
            placeholder="교구명 입력"
            style={{ flex:1, minWidth:'80px', padding:'7px 10px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          {(() => {
            const classInfo = ClassesDB.find(classId)
            const isQuarter = classInfo?.termType === 'quarter'
            const termUnit  = isQuarter ? '분기' : '학기'
            const termCount = isQuarter ? 4 : 2
            const curYear   = new Date().getFullYear()
            const termOpts  = []
            for (let y = curYear - 1; y <= curYear + 1; y++) {
              for (let t = 1; t <= termCount; t++) termOpts.push(`${y}-${t}${termUnit}`)
            }
            return (
              <select value={givenNewQuarter} onChange={e => setGivenNewQuarter(e.target.value)}
                style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
                <option value="">{termUnit} 선택</option>
                {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )
          })()}
          <select value={givenNewSupplyStatus} onChange={e => setGivenNewSupplyStatus(e.target.value)}
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
            <option value="ready">준비</option>
            <option value="given">지급</option>
            <option value="unpaid">미지급</option>
            <option value="extra">추가지급</option>
            <option value="own">보유교구</option>
          </select>
          <input type="date" value={givenNewDate} onChange={e => setGivenNewDate(e.target.value)}
            title={['unpaid','own','ready'].includes(givenNewSupplyStatus) ? '지급날짜 (생략 가능)' : '지급날짜'}
            style={{ padding:'7px 6px', borderRadius:'7px', border:`1.5px solid ${['unpaid','own','ready'].includes(givenNewSupplyStatus) ? '#fde68a' : '#e5e7eb'}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background: ['unpaid','own','ready'].includes(givenNewSupplyStatus) ? '#fffbeb' : '#fff' }} />
          <select value={givenNewBillingStatus} onChange={e => setGivenNewBillingStatus(e.target.value)}
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
            <option value="none">-</option>
            <option value="billed">청구</option>
            <option value="paid">입금</option>
            <option value="unpaid">미입금</option>
            <option value="check">확인필요</option>
          </select>
          <input type="date" value={givenNewPaidDate} onChange={e => setGivenNewPaidDate(e.target.value)}
            title="입금날짜"
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }} />
          <button onClick={handleAddGiven} disabled={!givenNewItem.trim() || (!['unpaid','own','ready'].includes(givenNewSupplyStatus) && !givenNewDate) || givenSaving}
            style={{ padding:'7px 12px', borderRadius:'7px', border:'none', background: givenNewItem.trim() && (['unpaid','own','ready'].includes(givenNewSupplyStatus) || givenNewDate) ? '#16a34a' : '#e5e7eb', color: givenNewItem.trim() && (['unpaid','own','ready'].includes(givenNewSupplyStatus) || givenNewDate) ? '#fff' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor: givenNewItem.trim() && (['unpaid','own','ready'].includes(givenNewSupplyStatus) || givenNewDate) ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            + 추가
          </button>
        </div>
      </div>
      <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb', display:'flex', gap:'8px' }}>
        <button onClick={onClose}
          style={{ flex:1, padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

function FutureStudentRow({ s, idx, onMsgOpen, onStudentClick, classId, onProgOpen, spProds, user }) {
  const note = s.memo || ''
  const [showInfo, setShowInfo] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState(s.memo || '')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSent, setInviteSent] = useState(!!s.parentInviteSentAt)
  const [fscOpen, setFscOpen] = useState(false)
  const [fscLocalDelivered, setFscLocalDelivered] = useState(false)

  const handlePredictClick = () => {
    setShowInfo(true)
    setTimeout(() => setShowInfo(false), 2500)
  }

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', background: '#fff', borderLeft: '3px solid transparent', transition: 'all .12s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '35px 90px 90px 130px 220px 70px 110px 90px 1fr', gap: '6px', alignItems: 'center', padding: '10px 14px' }}>

        {/* 순번 */}
        <span style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>{idx+1}</span>

        {/* 학년·반·번호 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, lineHeight: 1.4 }}>
          {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
        </div>

        {/* 이름 */}
        <div style={{ textAlign: 'center' }}>
          {(() => {
            const _cid2 = classId || s.classIds?.[0] || ''
            const _si2 = SupplyItems.byClassStudent(_cid2, s.id)[0]
            if (!_si2?.productId) return null
            const _prod2 = (spProds||[]).find(p => p.id === _si2.productId)
            const _prog2 = SupplyStudentProgress.byStudent(s.id, _cid2).find(p => p.productId === _si2.productId)
            const _cs2 = _prog2?.curStage || _si2.stage || 1
            const _spp2 = _prod2?.sessionsPerStage || 12
            const _chk2 = SupplySessionChecks.byProductStudent(_si2.productId, s.id, _cid2).filter(c => c.stage === _cs2).length
            const _plans2 = SupplyProductPlans.byProductStage(_si2.productId, _cs2)
            const _actual2 = _plans2.length > 0 ? _plans2.length : _spp2
            const _alert2 = _prod2?.alertSession || 3
            const _done2 = _chk2 >= _actual2
            const _near2 = _chk2 >= (_actual2 - _alert2) && !_done2
            if ((!_done2 && !_near2) || _prog2?.supplyDelivered || fscLocalDelivered) return null
            const _np2 = _prog2?.nextProductId ? (spProds||[]).find(p => p.id === _prog2.nextProductId) : null
            const _lbl2 = _done2
              ? (_np2 ? `${_np2.name} ${_prog2.nextStage || 1}단계 준비` : `${_prod2?.name} ${_cs2+1}단계 준비`)
              : (_np2 ? `${_np2.name} ${_prog2.nextStage || 1}단계 준비 필요` : `${_prod2?.name} ${_cs2+1}단계 준비 필요`)
            return (
              <div style={{ marginBottom: '4px', fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block', cursor: 'pointer' }}
                onClick={() => setFscOpen(true)}>
                ⚠️ {_lbl2}
              </div>
            )
          })()}
          <span onClick={() => onStudentClick(s)}
            style={{ fontSize: '14px', fontWeight: 700, color: C.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.name}</span>
          {(s.remark || (s.student_careers?.length > 0) || s.status === 'cancel_before' || s.status === 'cancel_after' || (s.relations||[]).length > 0) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginTop:'3px', alignItems:'center' }}>
              {s.remark && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px', fontWeight:600 }}>{s.remark}</span>}
              {(s.student_careers?.length > 0) && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:s.student_careers.length<=1?'#eff6ff':'#f0fdf4', border:`1px solid ${s.student_careers.length<=1?'#bfdbfe':'#86efac'}`, color:s.student_careers.length<=1?'#1d4ed8':'#15803d' }}>{s.student_careers.length<=1?'신규':'기존'}</span>}
              {(s.status==='cancel_before'||s.status==='cancel_after') && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>{s.status==='cancel_after'?'개강후취소':'개강전취소'}{s.cancel_info?.date&&(()=>{const [y,m,day]=s.cancel_info.date.split('-');return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`})()}</span>}
              {(s.relations||[]).map((r,ri)=><span key={ri} style={{ fontSize:'10px', fontWeight:600, padding:'1px 5px', borderRadius:'4px', background:r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed', border:`1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`, color:r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>{r.type}{r.with?` · ${r.with}`:''}</span>)}
            </div>
          )}
        </div>

        {/* 학부모 전화 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <PhoneAction phone={s.parentPhone}>{fmtPhone(s.parentPhone) || '-'}</PhoneAction>
        </div>

        {/* 출석컬럼만 다름: 예정 버튼 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={handlePredictClick}
            style={{ padding: '4px 6px', borderRadius: '6px', border: '1.5px solid #93c5fd', background: '#eff6ff', color: '#3b82f6', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            예정
          </button>
          {showInfo && (
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2000,
              background: 'rgba(30,30,30,0.88)', color: '#fff', borderRadius: '12px', padding: '14px 24px',
              fontSize: '14px', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
              🗓️ 아직 수업일이 아닙니다<br/>
              <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.8 }}>당일부터 출석체크가 가능합니다</span>
            </div>
          )}
        </div>

        {/* 리모컨 */}
        {(() => {
          const _cid = classId || s.classIds?.[0] || ''
          const si = SupplyItems.byClassStudent(_cid, s.id)[0]
          return <span style={{ fontSize:'12px', color: si?.remoteNo ? '#0284c7' : '#d1d5db', textAlign:'center', fontWeight: si?.remoteNo ? 600 : 400 }}>{si?.remoteNo || '-'}</span>
        })()}

        {/* 진도 */}
        {(() => {
          const _cid = classId || s.classIds?.[0] || ''
          const si = SupplyItems.byClassStudent(_cid, s.id)[0]
          if (!si?.productId) return <span style={{ fontSize:'11px', color:'#d1d5db', textAlign:'center' }}>-</span>
          const prod = (spProds||[]).find(p => p.id === si.productId)
          const prog = SupplyStudentProgress.byStudent(s.id, _cid).find(p => p.productId === si.productId)
          const curStage = prog?.curStage || si.stage || 1
          const spp = prod?.sessionsPerStage || 12
          const chk = SupplySessionChecks.byProductStudent(si.productId, s.id, _cid).filter(c => c.stage === curStage).length
          const pct = Math.min(Math.round(chk/spp*100),100)
          const stagePlans = SupplyProductPlans.byProductStage(si.productId, curStage)
          const actualSess = stagePlans.length > 0 ? stagePlans.length : spp
          const alertSess = prod?.alertSession || 3
          const isDone = chk >= actualSess
          const isAlert = chk >= (actualSess - alertSess) && !isDone
          const nextProd = prog?.nextProductId ? spProds.find(p => p.id === prog.nextProductId) : null
          const alertLabel = isDone
            ? (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비` : `${prod?.name} ${curStage+1}단계 준비`)
            : (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비 필요` : `${prod?.name} ${curStage+1}단계 준비 필요`)
          return (
            <div onClick={() => onProgOpen && onProgOpen(s, si.productId)}
              style={{ fontSize:'11px', cursor:'pointer', padding:'4px 6px', borderRadius:'6px', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>{prod?.name||si.name||''}</div>
              <div style={{ color:'#6b7280', marginTop:'1px' }}>{curStage}단계 {chk}/{spp}차시</div>
              <div style={{ height:'3px', background:'#e5e7eb', borderRadius:'2px', marginTop:'3px', width:'70px' }}>
                <div style={{ height:'100%', borderRadius:'2px', width:`${pct}%`, background:pct>=100?'#16a34a':pct>=80?'#f59e0b':'#f97316' }} />
              </div>
            </div>
          )
        })()}

        {/* 출결초대 */}
        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
          {s.parentPhone ? (
            <button onClick={() => setInviteOpen(true)}
              style={{ padding:'4px 8px', borderRadius:'7px', border:`1.5px solid ${inviteSent?'#86efac':'#a78bfa'}`, background:inviteSent?'#f0fdf4':'#f5f3ff', color:inviteSent?'#16a34a':'#7c3aed', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              {inviteSent ? '✅발송됨' : '📨초대'}
            </button>
          ) : <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>}
          <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px',
            background: s.parentJoined ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${s.parentJoined ? '#86efac' : '#e5e7eb'}`,
            color: s.parentJoined ? '#16a34a' : '#9ca3af' }}>
            {s.parentJoined ? '출결 ON' : '출결 OFF'}
          </span>
          {inviteOpen && <InviteModal student={s} user={user} onClose={() => setInviteOpen(false)} onSent={() => setInviteSent(true)} />}
        </div>

        {/* 특이사항·메모 */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {memo
              ? <span style={{ fontSize: '12px', color: '#374151', background: '#fffbeb', padding: '3px 9px', borderRadius: '6px', border: '1px solid #fde68a' }}>📌 {memo}</span>
              : <span style={{ fontSize: '11px', color: '#d1d5db' }}>메모 없음</span>
            }
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => setMemoOpen(true)}
                style={{ fontSize: '11px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {memo ? '편집' : '+ 메모'}
              </button>
              {memo && (
                <button onClick={() => { setMemo(''); StudentsDB.update(s.id, { memo: '' }) }}
                  style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {memoOpen && (
        <StudentMemoModal student={{ ...s, memo }} onClose={() => setMemoOpen(false)} onSave={v => setMemo(v)} />
      )}
      {fscOpen && (() => {
        const _cid3 = classId || s.classIds?.[0] || ''
        const _si3 = SupplyItems.byClassStudent(_cid3, s.id)[0]
        if (!_si3?.productId) return null
        const _prod3 = (spProds||[]).find(p => p.id === _si3.productId)
        const _prog3 = SupplyStudentProgress.byStudent(s.id, _cid3).find(p => p.productId === _si3.productId)
        const _cs3 = _prog3?.curStage || _si3.stage || 1
        const _spp3 = _prod3?.sessionsPerStage || 12
        const _chk3 = SupplySessionChecks.byProductStudent(_si3.productId, s.id, _cid3).filter(c => c.stage === _cs3).length
        const _plans3 = SupplyProductPlans.byProductStage(_si3.productId, _cs3)
        const _actual3 = _plans3.length > 0 ? _plans3.length : _spp3
        const _np3 = _prog3?.nextProductId ? (spProds||[]).find(p => p.id === _prog3.nextProductId) : null
        const _done3 = _chk3 >= _actual3
        const _lbl3 = _done3
          ? (_np3 ? `${_np3.name} ${_prog3.nextStage||1}단계 준비` : `${_prod3?.name} ${_cs3+1}단계 준비`)
          : (_np3 ? `${_np3.name} ${_prog3.nextStage||1}단계 준비 필요` : `${_prod3?.name} ${_cs3+1}단계 준비 필요`)
        return (
          <SupplyCheckModal
            studentName={s.name} alertLabel={_lbl3}
            studentId={s.id} classId={_cid3} productId={_si3.productId}
            teacherId={user?.id || ''}
            onClose={() => setFscOpen(false)}
            onDelivered={() => { setFscLocalDelivered(true); setFscOpen(false) }}
          />
        )
      })()}
    </div>
  )
}

// ─── 단일 학생 출석 행
function StudentRow({ s, idx, rec, onMark, onMsgOpen, onStudentClick, onProgOpen, classId, spItems, spProds, spProg, spChecks, user }) {
  const status = rec?.status || 'pending'
  const cfg = ATTENDANCE_STATUS[status]
  const isPending = status === 'pending'
  const absentReason = rec?.absentReason || ''
  const note         = rec?.note         || ''
  const setField = (field, val) => onMark(s.id, status === 'pending' ? 'present' : status, { [field]: val })
  const isAbsent = ['absent','late','early'].includes(status)
  const appendNote = (text) => setField('note', note ? note + ' / ' + text : text)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSent, setInviteSent] = useState(!!s.parentInviteSentAt)
  const [sMemo, setSMemo] = useState(s.memo || '')
  const [sMemoOpen, setSMemoOpen] = useState(false)
  const [hrType, setHrType] = useState(() => s.homeReturn?.startsWith('학원') ? '학원' : (s.homeReturn || ''))
  const [hrMemo, setHrMemo] = useState(() => s.homeReturn?.startsWith('학원-') ? s.homeReturn.slice(3) : '')

  // ── 교구 준비 알림 사전 계산 (이름 위 뱃지용)
  const _cid = classId || s.classIds?.[0] || ''
  const _si = spItems.find(i => i.studentId === s.id && i.classId === _cid)
  const _prod = _si?.productId ? spProds.find(p => p.id === _si.productId) : null
  const _prog = _si?.productId ? spProg.find(p => p.studentId === s.id && p.productId === _si.productId) : null
  const _curStage = _prog?.curStage || _si?.stage || 1
  const _spp = _prod?.sessionsPerStage || 12
  const _chk = _si?.productId ? spChecks.filter(c => c.studentId === s.id && c.productId === _si.productId && c.stage === _curStage).length : 0
  const _stagePlans = _si?.productId ? SupplyProductPlans.byProductStage(_si.productId, _curStage) : []
  const _actualSess = _stagePlans.length > 0 ? _stagePlans.length : _spp
  const _alertSess = _prod?.alertSession || 3
  const _supplyDone = _si?.productId ? _chk >= _actualSess : false
  const _supplyAlert = _si?.productId ? (_chk >= (_actualSess - _alertSess) && !_supplyDone) : false
  const _nextProd = _prog?.nextProductId ? spProds.find(p => p.id === _prog.nextProductId) : null
  const _supplyLabel = _supplyDone
    ? (_nextProd ? `${_nextProd.name} ${_prog.nextStage || 1}단계 준비` : `${_prod?.name} ${_curStage+1}단계 준비`)
    : (_nextProd ? `${_nextProd.name} ${_prog.nextStage || 1}단계 준비 필요` : `${_prod?.name} ${_curStage+1}단계 준비 필요`)
  const [scOpen, setScOpen] = useState(false)
  const [scLocalDelivered, setScLocalDelivered] = useState(false)
  const showSupplyBadge = (_supplyDone || _supplyAlert) && !_prog?.supplyDelivered && !scLocalDelivered
  const _lastCheck = _si?.productId ? (() => {
    const all = spChecks.filter(c => c.studentId === s.id && c.productId === _si.productId)
    if (!all.length) return null
    return all.reduce((latest, c) => (!latest || c.checkedAt > latest) ? c.checkedAt : latest, null)
  })() : null
  const _showProgAlert = _si?.productId && (() => {
    if (!_lastCheck) return true
    return (Date.now() - new Date(_lastCheck).getTime()) / (1000*60*60*24) >= 14
  })()

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', background: isPending ? '#fff' : cfg.bg, borderLeft: `3px solid ${isPending ? 'transparent' : cfg.color}`, transition: 'all .12s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '35px 90px 90px 130px 220px 70px 110px 90px 1fr', gap: '6px', alignItems: 'center', padding: '10px 14px' }}>

        {/* 순번 */}
        <span style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>{idx+1}</span>

        {/* 학년·반·번호 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, lineHeight: 1.4 }}>
          {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
        </div>

        {/* 이름 */}
        <div style={{ textAlign: 'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
          {_showProgAlert && (
            <div onClick={() => onProgOpen(s, _si?.productId)}
              style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              📋 진도체크!
            </div>
          )}
          {showSupplyBadge && (
            <div onClick={() => setScOpen(true)}
              style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              ⚠️ {_supplyLabel}
            </div>
          )}
          <span onClick={() => onStudentClick(s)}
            style={{ fontSize: '14px', fontWeight: 700, color: C.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.name}</span>
          {(s.remark || (s.student_careers?.length > 0) || s.status === 'cancel_before' || s.status === 'cancel_after' || (s.relations||[]).length > 0) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginTop:'3px', alignItems:'center' }}>
              {s.remark && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px', fontWeight:600 }}>{s.remark}</span>}
              {(s.student_careers?.length > 0) && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:s.student_careers.length<=1?'#eff6ff':'#f0fdf4', border:`1px solid ${s.student_careers.length<=1?'#bfdbfe':'#86efac'}`, color:s.student_careers.length<=1?'#1d4ed8':'#15803d' }}>{s.student_careers.length<=1?'신규':'기존'}</span>}
              {(s.status==='cancel_before'||s.status==='cancel_after') && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>{s.status==='cancel_after'?'개강후취소':'개강전취소'}{s.cancel_info?.date&&(()=>{const [y,m,day]=s.cancel_info.date.split('-');return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`})()}</span>}
              {(s.relations||[]).map((r,ri)=><span key={ri} style={{ fontSize:'10px', fontWeight:600, padding:'1px 5px', borderRadius:'4px', background:r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed', border:`1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`, color:r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>{r.type}{r.with?` · ${r.with}`:''}</span>)}
            </div>
          )}
        </div>

        {/* 학부모 전화 — 문자버튼 제거, PhoneAction만 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <PhoneAction phone={s.parentPhone}>{fmtPhone(s.parentPhone) || '-'}</PhoneAction>
        </div>

        {/* 출석·지각·조퇴·결석 — 모두 동일한 텍스트 버튼 스타일 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          {[
            { s:'present', label:'출석', c:'#16a34a' },
            { s:'late',    label:'지각', c:'#f59e0b' },
            { s:'early',   label:'조퇴', c:'#8b5cf6' },
            { s:'absent',  label:'결석', c:'#ef4444' },
          ].map(btn => (
            <button key={btn.s} onClick={() => onMark(s.id, status === btn.s ? 'pending' : btn.s)}
              style={{ padding: '4px 6px', borderRadius: '6px', border: `1.5px solid ${status===btn.s ? btn.c : C.border}`, background: status===btn.s ? btn.c : '#fff', color: status===btn.s ? '#fff' : C.muted, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {btn.label}
            </button>
          ))}
        </div>

        {/* 리모컨 */}
        {(() => {
          const si = spItems.find(i => i.studentId === s.id && i.classId === (classId || s.classIds?.[0] || ''))
          return <span style={{ fontSize:'12px', color: si?.remoteNo ? '#0284c7' : '#d1d5db', textAlign:'center', fontWeight: si?.remoteNo ? 600 : 400 }}>{si?.remoteNo || '-'}</span>
        })()}

        {/* 진도 */}
        {(() => {
          const si = spItems.find(i => i.studentId === s.id && i.classId === (classId || s.classIds?.[0] || ''))
          if (!si?.productId) return <span style={{ fontSize:'11px', color:'#d1d5db', textAlign:'center' }}>-</span>
          const prod = spProds.find(p => p.id === si.productId)
          const prog = spProg.find(p => p.studentId === s.id && p.productId === si.productId)
          const curStage = prog?.curStage || si.stage || 1
          const spp = prod?.sessionsPerStage || 12
          const chk = spChecks.filter(c => c.studentId === s.id && c.productId === si.productId && c.stage === curStage).length
          const pct = Math.min(Math.round(chk/spp*100),100)
          const stagePlans = SupplyProductPlans.byProductStage(si.productId, curStage)
          const actualSess = stagePlans.length > 0 ? stagePlans.length : spp
          const alertSess = prod?.alertSession || 3
          const isDone = chk >= actualSess
          const isAlert = chk >= (actualSess - alertSess) && !isDone
          const nextProd = prog?.nextProductId ? spProds.find(p => p.id === prog.nextProductId) : null
          const alertLabel = isDone
            ? (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비` : `${prod?.name} ${curStage+1}단계 준비`)
            : (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비 필요` : `${prod?.name} ${curStage+1}단계 준비 필요`)
          return (
            <div onClick={() => onProgOpen && onProgOpen(s, si.productId)}
              style={{ fontSize:'11px', cursor:'pointer', padding:'4px 6px', borderRadius:'6px', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>{prod?.name||si.name||''}</div>
              {si.remoteNo && <div style={{ fontSize:'10px', color:'#0284c7', fontWeight:600, marginTop:'1px' }}>🎮 {si.remoteNo}</div>}
              <div style={{ color:'#6b7280', marginTop:'1px' }}>{curStage}단계 {chk}/{spp}차시</div>
              <div style={{ height:'3px', background:'#e5e7eb', borderRadius:'2px', marginTop:'3px', width:'70px' }}>
                <div style={{ height:'100%', borderRadius:'2px', width:`${pct}%`, background:pct>=100?'#16a34a':pct>=80?'#f59e0b':'#f97316' }} />
              </div>
            </div>
          )
        })()}

        {/* 출결초대 */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', textAlign:'center' }}>
          {s.parentPhone ? (
            <button onClick={() => setInviteOpen(true)}
              style={{ padding:'4px 8px', borderRadius:'7px', border:`1.5px solid ${inviteSent?'#86efac':'#a78bfa'}`, background:inviteSent?'#f0fdf4':'#f5f3ff', color:inviteSent?'#16a34a':'#7c3aed', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              {inviteSent ? '✅발송됨' : '📨초대'}
            </button>
          ) : <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>}
          <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px',
            background: s.parentJoined ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${s.parentJoined ? '#86efac' : '#e5e7eb'}`,
            color: s.parentJoined ? '#16a34a' : '#9ca3af' }}>
            {s.parentJoined ? '출결 ON' : '출결 OFF'}
          </span>
          {inviteOpen && <InviteModal student={s} user={user} onClose={() => setInviteOpen(false)} onSent={() => setInviteSent(true)} />}
        </div>

        {/* 특이사항·메모 */}
        <div>
          {/* 학생 영구 메모 — 편집/삭제 */}
          {sMemo ? (
            <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'11px', color:'#92400e', background:'#fffbeb', padding:'3px 8px', borderRadius:'5px' }}>👤 {sMemo}</span>
              <button onClick={() => setSMemoOpen(true)} style={{ fontSize:'11px', color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'Noto Sans KR, sans-serif' }}>편집</button>
              <button onClick={() => { setSMemo(''); StudentsDB.update(s.id, { memo: '' }) }} style={{ fontSize:'11px', color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          ) : (
            <button onClick={() => setSMemoOpen(true)} style={{ fontSize:'11px', color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'4px', display:'block' }}>+ 학생메모</button>
          )}
          {sMemoOpen && (
            <StudentMemoModal student={{ ...s, memo: sMemo }} onClose={() => setSMemoOpen(false)} onSave={v => setSMemo(v)} />
          )}
          {/* 귀가방법 드롭다운 */}
          <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'11px', color:'#1d4ed8' }}>🚌</span>
            <select value={hrType} onChange={e => {
              const v = e.target.value
              setHrType(v)
              if (v !== '학원') { setHrMemo(''); StudentsDB.update(s.id, { homeReturn: v }) }
            }} style={{ fontSize:'11px', padding:'2px 6px', borderRadius:'5px', border:`1px solid ${C.border}`, background:'#fff', color: hrType ? '#1d4ed8' : '#9ca3af', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              <option value="">귀가방법</option>
              <option value="학원">학원</option>
              <option value="돌봄">돌봄</option>
              <option value="늘봄">늘봄</option>
              <option value="픽업">픽업</option>
              <option value="직접귀가">직접귀가</option>
            </select>
            {hrType === '학원' && (
              <input value={hrMemo} onChange={e => setHrMemo(e.target.value)}
                onBlur={e => StudentsDB.update(s.id, { homeReturn: e.target.value.trim() ? `학원-${e.target.value.trim()}` : '학원' })}
                placeholder="학원명"
                style={{ fontSize:'11px', width:'70px', padding:'2px 6px', borderRadius:'5px', border:`1.5px solid ${C.primary}`, fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
            )}
            {hrType && (
              <button onClick={() => { setHrType(''); setHrMemo(''); StudentsDB.update(s.id, { homeReturn: '' }) }}
                style={{ fontSize:'10px', color:'#9ca3af', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>
            )}
          </div>
          <NoteInline note={note} onSave={v => setField('note', v)} placeholder="연락 내역 메모" />
        </div>
      </div>

      {/* 결석/지각/조퇴 시 — 사유 + 연락 내역 빠른버튼 */}
      {isAbsent && (
        <div style={{ padding: '6px 14px 10px', borderTop: `1px solid ${C.border}`, background: '#fafafa', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '3px' }}>사유</label>
            <select value={absentReason.startsWith('schedule_change') ? 'schedule_change' : absentReason} onChange={e => {
              const val = e.target.value
              if (val === 'schedule_change') {
                const today = new Date().toISOString().slice(0,10)
                setField('absentReason', `schedule_change:${today}`)
              } else {
                setField('absentReason', val)
              }
              if (val === 'transferred') {
                const today = new Date().toISOString().slice(0,10)
                const existing = StudentsDB.find(s.id)
                StudentsDB.update(s.id, {
                  status: 'transfer_out',
                  statusHistory: [...(existing?.statusHistory||[]), { status: 'transfer_out', changedAt: now(), memo: `[전학] ${today}` }],
                })
              }
            }} style={selSm}>
              {ABSENT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {absentReason === 'transferred' && (
              <div style={{ marginTop:'6px', display:'flex', flexDirection:'column', gap:'4px' }}>
                <label style={{ fontSize:'10px', fontWeight:600, color:'#0369a1' }}>✈️ 전학 날짜</label>
                <input type="date" defaultValue={new Date().toISOString().slice(0,10)}
                  onChange={e => {
                    const existing = StudentsDB.find(s.id)
                    StudentsDB.update(s.id, {
                      status: 'transfer_out',
                      statusHistory: [...(existing?.statusHistory||[]), { status: 'transfer_out', changedAt: now(), memo: `[전학] ${e.target.value}` }],
                    })
                  }}
                  style={{ padding:'4px 8px', borderRadius:'6px', border:'1.5px solid #7dd3fc', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#f0f9ff', color:'#0369a1' }} />
                <div style={{ fontSize:'10px', color:'#0369a1', background:'#f0f9ff', border:'1px solid #7dd3fc', borderRadius:'5px', padding:'3px 7px', fontWeight:600 }}>
                  전학 처리됨 — 다음 수업부터 명단에서 제외됩니다
                </div>
              </div>
            )}
            {absentReason.startsWith('schedule_change') && (
              <div style={{ marginTop:'6px', display:'flex', flexDirection:'column', gap:'4px' }}>
                <label style={{ fontSize:'10px', fontWeight:600, color:'#7c3aed' }}>📅 스케줄변경 날짜 (이 날짜 다음 수업부터 명단 제외)</label>
                <input type="date" defaultValue={new Date().toISOString().slice(0,10)}
                  onChange={e => setField('absentReason', `schedule_change:${e.target.value}`)}
                  style={{ padding:'4px 8px', borderRadius:'6px', border:'1.5px solid #c4b5fd', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#f5f3ff', color:'#7c3aed' }} />
                <div style={{ fontSize:'10px', color:'#7c3aed', background:'#f5f3ff', border:'1px solid #c4b5fd', borderRadius:'5px', padding:'3px 7px', fontWeight:600 }}>
                  스케줄변경 — 지정 날짜 다음 수업부터 명단에서 제외됩니다
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '3px' }}>연락 내역</label>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
              {['📞 통화', '💬 문자', '💛 카톡'].map(method => {
                const tag = method.split(' ')[1]
                const active = note.startsWith(tag) || note.includes(' '+tag)
                return (
                  <button key={tag} onClick={() => appendNote(tag)}
                    style={{ padding: '3px 10px', borderRadius: '5px', border: `1px solid ${active ? '#6b7280' : '#d1d5db'}`, background: active ? '#f3f4f6' : '#fff', fontSize: '11px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: active ? 700 : 400, color: active ? '#111827' : '#6b7280' }}>
                    {method}
                  </button>
                )
              })}
            </div>
            <NoteInline note={note} onSave={v => setField('note', v)} placeholder="연락 내용 메모" />
          </div>
        </div>
      )}

      {scOpen && _si?.productId && (
        <SupplyCheckModal
          studentName={s.name} alertLabel={_supplyLabel}
          studentId={s.id} classId={_cid} productId={_si.productId}
          teacherId={user?.id || ''}
          onClose={() => setScOpen(false)}
          onDelivered={() => { setScLocalDelivered(true); setScOpen(false) }}
        />
      )}
    </div>
  )
}

// ─── 교구 준비/지급 체크 모달 (출석부용)
function SupplyCheckModal({ studentName, alertLabel, studentId, classId, productId, teacherId, onClose, onDelivered }) {
  const [tick, setTick] = useState(0)
  const prog = SupplyStudentProgress.byStudent(studentId, classId).find(p => p.productId === productId)
  const supplyReady     = prog?.supplyReady     || false
  const supplyDelivered = prog?.supplyDelivered || false

  const upsertProg = (patch) => {
    const base = prog || { id: uid(), teacherId, studentId, classId, productId, createdAt: now() }
    SupplyStudentProgress.upsert({ ...base, ...patch, updatedAt: now() })
    setTick(t => t + 1)
  }
  const toggleReady = () => upsertProg({ supplyReady: !supplyReady, supplyDelivered })
  const toggleDelivered = () => {
    upsertProg({ supplyReady, supplyDelivered: !supplyDelivered })
    if (!supplyDelivered) { onDelivered && onDelivered(); onClose() }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', maxWidth:'320px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom:'6px', fontSize:'10px', fontWeight:700, color:'#ef4444', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'3px 8px', display:'inline-block' }}>
          ⚠️ {alertLabel}
        </div>
        <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'20px' }}>{studentName}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'24px' }}>
          {[
            { checked: supplyReady,     label:'교구 준비 완료', toggle: toggleReady,     color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
            { checked: supplyDelivered, label:'교구 지급 완료', toggle: toggleDelivered,  color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
          ].map((item, i) => (
            <label key={i} onClick={item.toggle}
              style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', borderRadius:'10px', border:`1.5px solid ${item.checked ? item.border : '#e5e7eb'}`, background: item.checked ? item.bg : '#f9fafb', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ width:'20px', height:'20px', borderRadius:'5px', border:`2px solid ${item.checked ? item.color : '#d1d5db'}`, background: item.checked ? item.color : '#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {item.checked && <span style={{ color:'#fff', fontSize:'13px', fontWeight:700, lineHeight:1 }}>✓</span>}
              </div>
              <span style={{ fontSize:'14px', fontWeight: item.checked ? 700 : 500, color: item.checked ? item.color : '#374151' }}>{item.label}</span>
            </label>
          ))}
        </div>
        <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'16px', textAlign:'center' }}>지급 완료 체크 시 알림이 자동으로 사라집니다</div>
        <button onClick={onClose}
          style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
          닫기
        </button>
      </div>
    </div>
  )
}

// 인라인 메모
function NoteInline({ note, onSave, studentMemo, placeholder = '특이사항 메모' }) {
  const { success } = useToast()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note)
  const ref = useRef()
  useEffect(() => setVal(note), [note])
  const save = () => { onSave(val); setEditing(false); success('수정이 완료되었습니다.') }
  return (
    <div>
      {studentMemo && (
        <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', marginBottom: '5px', display: 'inline-block' }}>👤 {studentMemo}</div>
      )}
      {editing ? (
        <div style={{ display: 'flex', flexDirection:'column', gap: '5px' }}>
          <input ref={ref} value={val} onChange={e => setVal(e.target.value)} autoFocus placeholder={placeholder}
            onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') { setEditing(false); setVal(note) } }}
            style={{ width:'100%', boxSizing:'border-box', border:`1.5px solid ${C.primary}`, borderRadius:'6px', padding:'4px 9px', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          <div style={{ display:'flex', gap:'5px' }}>
            <button onClick={save} style={sm('#f97316','#fff')}>저장</button>
            <button onClick={() => { setEditing(false); setVal(note) }} style={sm('#f3f4f6','#374151')}>취소</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {note ? <span style={{ fontSize:'12px', color:'#374151', background:'#fffbeb', padding:'3px 9px', borderRadius:'6px', border:'1px solid #fde68a' }}>📌 {note}</span>
                : <span style={{ fontSize:'11px', color:'#d1d5db' }}>메모 없음</span>}
          <button onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 30) }}
            style={{ fontSize:'11px', color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'Noto Sans KR, sans-serif' }}>
            {note ? '편집' : '+ 메모'}
          </button>
          {note && <button onClick={() => onSave('')} style={{ fontSize:'11px', color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>}
        </div>
      )}
    </div>
  )
}
const sm = (bg,color) => ({ padding:'4px 9px', borderRadius:'5px', border:'none', background:bg, color, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' })
const selSm = { padding:'5px 9px', borderRadius:'7px', border:`1px solid ${C.border}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', width:'100%', cursor:'pointer' }

// ─── 취소/대기 학생 행 (출석 처리 불가, 표시만)
function InactiveStudentRow({ s, idx }) {
  const statusLabel = { cancelled: '취소', waiting: '대기' }
  const statusColor = { cancelled: '#ef4444', waiting: '#f59e0b' }
  const st = s.status
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 14px', borderRadius:'10px', border:`1.5px dashed ${statusColor[st]}40`, background:`${statusColor[st]}08`, opacity:0.75 }}>
      <div style={{ fontSize:'12px', color:C.muted, minWidth:'22px', textAlign:'center' }}>{s.number||idx+1}</div>
      <div style={{ minWidth:'70px' }}>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#9ca3af' }}>{s.name}</div>
        <div style={{ fontSize:'11px', color:'#d1d5db' }}>{s.grade}{s.classNum?' '+s.classNum+'반':''}</div>
      </div>
      <div style={{ fontSize:'11px', color:'#d1d5db', minWidth:'90px' }}>{fmtPhone(s.parentPhone)||'-'}</div>
      <div style={{ marginLeft:'auto' }}>
        <span style={{ padding:'3px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:700, background:`${statusColor[st]}15`, color:statusColor[st], border:`1px solid ${statusColor[st]}30` }}>
          {statusLabel[st] || st}
        </span>
      </div>
    </div>
  )
}

// ─── 수업 1개 — 대시보드 카드 스타일 + 바로 아래 학생 출석 리스트
function ClassAttendanceSection({ cls, date, allStudents, user }) {
  const today = todayStr()
  const [tick, setTick] = useState(0)
  const [msgStudent, setMsgStudent] = useState(null)
  const [selStudent, setSelStudent] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [progStudent,   setProgStudent]   = useState(null)
  const [progProductId, setProgProductId] = useState('')
  const [progTick,      setProgTick]      = useState(0)
  const [spItems,  setSpItems]  = useState(() => SupplyItems.byTeacher(cls.teacherId||''))
  const [spProds,  setSpProds]  = useState(() => SupplyProducts.byTeacher(cls.teacherId||''))
  const [spProg,   setSpProg]   = useState(() => SupplyStudentProgress.byTeacher(cls.teacherId||''))
  const [spChecks, setSpChecks] = useState(() => SupplySessionChecks.byTeacher(cls.teacherId||''))

  useEffect(() => {
    setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
    setSpProds(SupplyProducts.byTeacher(cls.teacherId||''))
    setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
    setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
  }, [progTick])

  const isFuture = date > today
  const sessInfo = getSessionInfo(cls, date)
  const TERM_COLORS = [
    { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
    { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
    { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
    { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
  ]
  const tc = sessInfo ? TERM_COLORS[(sessInfo.termNum - 1) % TERM_COLORS.length] : null
  const startTime = (cls.sections?.length>0 ? cls.sections[0].time : cls.time) || ''; const endTime = (cls.sections?.length>0 ? cls.sections[0].timeEnd : cls.timeEnd) || ''

  // 반별 그룹핑을 위해 section 기준으로 정렬
  // 현재방식: 학생의 section 필드 / 예전방식: 수업카드의 section
  const activeStudents = allStudents.filter(s =>
    s.classIds?.includes(cls.id) && ['applied','selected','confirmed'].includes(s.status)
  )
  const inactiveStudents = allStudents.filter(s =>
    s.classIds?.includes(cls.id) && ['cancelled','waiting'].includes(s.status)
  )
  const sorted = [...activeStudents].sort((a, b) => {
    // section 먼저 정렬 (A반 → C반 등)
    const aSec = a.section || allClasses?.find?.(c => a.classIds?.includes(c.id))?.section || ''
    const bSec = b.section || allClasses?.find?.(c => b.classIds?.includes(c.id))?.section || ''
    const secCmp = aSec.localeCompare(bSec, 'ko'); if (secCmp) return secCmp
    const g = parseInt(a.grade||'0') - parseInt(b.grade||'0'); if (g) return g
    const c = parseInt(a.classNum||0) - parseInt(b.classNum||0); if (c) return c
    const n = parseInt(a.number||0) - parseInt(b.number||0); if (n) return n
    return (a.name||'').localeCompare(b.name||'','ko')
  })

  const records = isFuture ? [] : AttendanceDB.byClassDate(cls.id, date)
  const getRec  = (sid) => records.find(r => r.studentId === sid)
  const mark = async (studentId, status, extra = {}) => {
    if (isFuture) return
    const existing = AttendanceDB.find(cls.id, studentId, date)
    try {
      await AttendanceDB.upsert({
        id: existing?.id || uid(),
        classId: cls.id, studentId, date,
        session: sessInfo?.session || 0, status,
        note: existing?.note || '', absentReason: existing?.absentReason || '', homeReturn: existing?.homeReturn || '',
        ...extra, markedAt: now(),
      })
    } catch (e) {
      console.error('[출석저장 실패]', e.message)
      return
    }
    setTick(t => t + 1)
    pushAttendance(sorted.find(s => s.id === studentId), status, extra)
  }
  const markAll = (status) => sorted.forEach(s => mark(s.id, status))

  const counts = { pending:0, present:0, absent:0, late:0, early:0 }
  if (!isFuture) sorted.forEach(s => { const st = getRec(s.id)?.status || 'pending'; counts[st]++ })
  const presentCnt = counts.present + counts.late
  const done = sorted.length - counts.pending
  const rate = sorted.length > 0 ? Math.round(presentCnt / sorted.length * 100) : 0

  return (
    <div style={{ marginBottom:'12px' }}>
      {/* 수업 카드 (대시보드 동일 스타일, 버튼 없음) */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'10px 10px 0 0', background:'#fff7ed', border:'1px solid #fed7aa', borderBottom:'none', gap:'12px', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:'150px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>수업 과목 · {cls.className}</span>
            {(cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')) && <span style={{ fontSize:'12px', background:C.primary, color:'#fff', borderRadius:'6px', padding:'1px 8px', fontWeight:600 }}>{(cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : ''))}</span>}
            {sessInfo && (
              <>
                <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', padding:'1px 7px', borderRadius:'5px' }}>{sessInfo.total}차시</span>
                <span style={{ fontSize:'11px', fontWeight:700, color:tc?.text, background:tc?.bg, border:`1px solid ${tc?.border}`, padding:'1px 7px', borderRadius:'5px' }}>
                  {sessInfo.termNum}텀 {sessInfo.termSess}차시
                </span>
              </>
            )}
          </div>
          {startTime && <div style={{ fontSize:'12px', color:C.muted }}>🕐 {startTime}{endTime ? ` ~ ${endTime}` : ''}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:700, color:C.text }}>{sorted.length}명</div>
            <div style={{ fontSize:'11px', color:presentCnt>0?C.success:C.muted }}>출석 {presentCnt}명</div>
          </div>
          {!isFuture && done > 0 && (
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {Object.entries(ATTENDANCE_STATUS).map(([k,v]) => counts[k] > 0
                ? <span key={k} style={{ padding:'3px 8px', borderRadius:'6px', background:v.bg, fontSize:'11px', fontWeight:700, color:v.color }}>{v.emoji}{counts[k]}</span>
                : null)}
            </div>
          )}
          {isFuture && <span style={{ fontSize:'12px', color:'#3b82f6', fontWeight:600, background:'#eff6ff', padding:'4px 10px', borderRadius:'6px' }}>예정</span>}
        </div>
      </div>

      {/* 학생 리스트 */}
      <div style={{ background:C.card, border:`1px solid #fed7aa`, borderTop:`1px solid ${C.border}`, borderRadius:'0 0 10px 10px', overflow:'hidden' }}>
        {/* 일괄처리 + 진행률 */}
        {!isFuture && sorted.length > 0 && (
          <div style={{ padding:'8px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:'5px' }}>
              <button onClick={() => markAll('present')} style={{ padding:'4px 11px', borderRadius:'6px', border:'1.5px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>전체 출석</button>
              <button onClick={() => markAll('absent')}  style={{ padding:'4px 11px', borderRadius:'6px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:C.danger,   fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>전체 결석</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, maxWidth:'220px' }}>
              <div style={{ flex:1, height:'5px', background:'#f3f4f6', borderRadius:'999px', overflow:'hidden' }}>
                <div style={{ width:`${sorted.length?done/sorted.length*100:0}%`, height:'100%', background:C.primary, borderRadius:'999px', transition:'width .4s' }} />
              </div>
              <span style={{ fontSize:'11px', color:C.muted, whiteSpace:'nowrap' }}>{done}/{sorted.length} · {rate}%</span>
            </div>
          </div>
        )}
        {/* 컬럼 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'35px 90px 90px 130px 220px 70px 110px 90px 1fr', gap:'6px', padding:'7px 14px', background:'#f3f4f6', borderBottom:`1px solid ${C.border}`, fontSize:'11px', fontWeight:700, color:C.muted, textAlign:'center' }}>
          <span>순번</span><span>학년·반·번호</span><span>이름</span><span>학부모전화</span><span>출석·지각·조퇴·결석</span><span>리모컨</span><span>진도</span><span>출결초대</span><span>특이사항·메모</span>
        </div>
        {sorted.length === 0
          ? <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:'13px' }}>등록된 학생이 없습니다</div>
          : sorted.map((s, i) =>
              isFuture
                ? <FutureStudentRow key={s.id} s={s} idx={i} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} classId={cls.id} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls.id}); setProgProductId(pid) }} spProds={spProds} user={user} />
                : <StudentRow      key={s.id} s={s} idx={i} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls.id}); setProgProductId(pid) }} classId={cls.id} spItems={spItems} spProds={spProds} spProg={spProg} spChecks={spChecks} user={user} />
            )
        }
        {inactiveStudents.length > 0 && (
          <div style={{ borderTop:'1.5px dashed #e5e7eb' }}>
            <button onClick={() => setShowInactive(v=>!v)}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fafafa', border:'none', cursor:'pointer', padding:'9px 14px', fontFamily:'Noto Sans KR, sans-serif', width:'100%', textAlign:'left' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af' }}>{showInactive?'▼':'▶'} 취소·대기 {inactiveStudents.length}명</span>
              <span style={{ fontSize:'11px', color:'#d1d5db' }}>(출석 처리 제외)</span>
            </button>
            {showInactive && (
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'0 8px 8px' }}>
                {inactiveStudents.map((s,i) => <InactiveStudentRow key={s.id} s={s} idx={i} />)}
              </div>
            )}
          </div>
        )}
      </div>
      {msgStudent && <MsgModal student={msgStudent} cls={cls} user={user} onClose={() => setMsgStudent(null)} />}
      {selStudent  && <StudentDetailModal student={selStudent} onClose={() => setSelStudent(null)} />}
      {progStudent && progProductId && (
        <ProgCheckModal
          student={progStudent}
          initialProductId={progProductId}
          spProds={spProds}
          teacherId={cls.teacherId||''}
          onClose={() => setProgStudent(null)}
          onSaved={() => { setProgTick(t => t+1); const ch = new BroadcastChannel('progress_screen'); ch.postMessage({ type:'refresh', source:'main' }); ch.close() }}
        />
      )}
    </div>
  )
}

// ─── 날짜별 전체 출석 패널 (대시보드 스타일, 네비게이션 없음)
function DayAttendancePanel({ date, allClasses, allStudents, schoolClasses, user }) {
  const dayClasses = sortClasses(schoolClasses.filter(cls => calcSessionDates(cls).includes(date)))

  if (dayClasses.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
        <div style={{ fontSize:'36px', marginBottom:'10px' }}>🗓️</div>
        <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>수업이 없는 날입니다</div>
        <div style={{ fontSize:'13px', marginTop:'6px' }}>달력에서 수업일(점 표시)을 선택하세요</div>
      </div>
    )
  }

  const schools = {}
  dayClasses.forEach(cls => {
    if (!schools[cls.organization]) schools[cls.organization] = []
    schools[cls.organization].push(cls)
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {/* 날짜 헤더 */}
      <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#fff7ed 0%,#fff 100%)', borderRadius:'14px', border:'1.5px solid #fed7aa' }}>
        <div style={{ fontSize:'20px', fontWeight:700, color:C.text }}>{formatDateKo(date)}</div>
        <div style={{ fontSize:'13px', marginTop:'4px', color:C.primary, fontWeight:600 }}>수업 {dayClasses.length}개</div>
      </div>

      {/* 학교별 섹션 */}
      {Object.entries(schools).map(([school, classes]) => (
        <div key={school} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {/* 학교 헤더 (네비게이션 버튼 없음) */}
          <div style={{ padding:'13px 18px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:'8px' }}>
            <span>🏫</span>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{school}</span>
            <span style={{ fontSize:'12px', color:C.muted }}>수업 장소</span>
          </div>
          <div style={{ padding:'12px 16px' }}>
            {classes.map(cls => {
              const clsStudents = allStudents.filter(s => s.classIds?.includes(cls.id) && ['applied','selected','confirmed','cancelled','waiting','cancel_after','cancel_before'].includes(s.status))
              return <UnifiedPanel key={cls.id + date} cls={cls} date={date} students={clsStudents} user={user} allClasses={allClasses} />
            })}
          </div>
        </div>
      ))}
    </div>
  )
}


// ─── 통합 패널 (수강생 명단 + 수업준비메모 + 출석체크 — 모드에 따라 표시)
function UnifiedPanel({ cls, date, students, user, allClasses }) {
  const today = todayStr()
  const isSessionDate = cls ? calcSessionDates(cls).includes(date) : false
  const isFuture = date > today
  const isPast   = date < today
  const isToday  = date === today
  const showAttendance = isSessionDate && !isFuture  // 오늘 or 과거 수업일

  const [tick,         setTick]         = useState(0)
  const [msgStudent,   setMsgStudent]   = useState(null)
  const [selStudent,   setSelStudent]   = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [progStudent,  setProgStudent]  = useState(null)
  const [progProductId,setProgProductId]= useState('')
  const [progTick,     setProgTick]     = useState(0)
  const [badgeModal,   setBadgeModal]   = useState(null) // { type, students }
  const [spItems,  setSpItems]  = useState(() => cls ? SupplyItems.byTeacher(cls.teacherId||'') : [])
  const [spProds,  setSpProds]  = useState(() => cls ? SupplyProducts.byTeacher(cls.teacherId||'') : [])
  const [spProg,   setSpProg]   = useState(() => cls ? SupplyStudentProgress.byTeacher(cls.teacherId||'') : [])
  const [spChecks, setSpChecks] = useState(() => cls ? SupplySessionChecks.byTeacher(cls.teacherId||'') : [])

  useEffect(() => {
    if (!cls) return
    setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
    setSpProds(SupplyProducts.byTeacher(cls.teacherId||''))
    setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
    setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
  }, [progTick])

  // 수업화면(별도 창) 및 왼쪽 패널 진도체크 시 오른쪽 패널 갱신
  // setProgTick만 호출 → 리마운트 없이 데이터만 갱신 (모달 유지됨)
  useEffect(() => {
    if (!cls) return
    const ch = new BroadcastChannel('progress_screen')
    ch.onmessage = async (e) => {
      if (e.data?.type === 'refresh') {
        if (e.data?.source !== 'main') {
          await refreshTablesFromSupabase('supplySessionChecks', 'supplyStudentProgress', 'supplyItems', 'supplyProducts')
        }
        setProgTick(t => t+1)
      }
    }
    return () => ch.close()
  }, [cls?.id])
  const noteKey = cls ? date+'_'+cls.id : null
  const [notes,   setNotes]   = useState(() => noteKey ? Notes.byTeacherDate(cls.teacherId, noteKey) : [])
  const [newNote, setNewNote] = useState('')
  const [adding,  setAdding]  = useState(false)
  const inputRef = useRef()
  const addNote = () => {
    if (!newNote.trim() || !cls) return
    Notes.insert({ id: uid(), teacherId: cls.teacherId, date: noteKey, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(cls.teacherId, noteKey))
    setNewNote(''); setAdding(false)
  }
  const delNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(cls.teacherId, noteKey)) }

  // 출석 처리
  const records = (cls && showAttendance) ? AttendanceDB.byClassDate(cls.id, date) : []
  const getRec  = (sid) => records.find(r => r.studentId === sid)
  const session = cls ? getSession(cls, date) : null
  const mark = async (studentId, status, extra = {}) => {
    if (!cls) return
    const existing = AttendanceDB.find(cls.id, studentId, date)
    try {
      await AttendanceDB.upsert({
        id: existing?.id || uid(),
        classId: cls.id, studentId, date,
        session: session || 0, status,
        note: existing?.note || '',
        absentReason: existing?.absentReason || '',
        homeReturn: existing?.homeReturn || '',
        ...extra, markedAt: now(),
      })
    } catch (e) {
      console.error('[출석저장 실패]', e.message)
      return
    }
    setTick(t => t+1)
    pushAttendance(activeStudents.find(s => s.id === studentId), status, extra)
  }
  const markAll = (status) => activeStudents.forEach(s => mark(s.id, status))

  // 스케줄변경: 해당 수업의 가장 최근 attendance에 schedule_change:날짜가 있고 date > 그 날짜이면 제외
  const getScheduleChangeDate = (studentId) => {
    const recs = AttendanceDB.byStudentClass(studentId, cls?.id || '')
    const rec = recs.slice().sort((a,b) => (b.date||'').localeCompare(a.date||'')).find(r => r.absentReason?.startsWith('schedule_change:'))
    if (!rec) return null
    return rec.absentReason.split(':')[1] || null
  }
  const activeStudents      = students.filter(s => {
    if (!['applied','selected','confirmed'].includes(s.status)) return false
    const scDate = getScheduleChangeDate(s.id)
    if (scDate && date > scDate) return false
    return true
  })
  const scheduleChangedStudents = students.filter(s => {
    // attendance 기반 스케줄변경 (날짜 이후 제외)
    if (['applied','selected','confirmed'].includes(s.status)) {
      const scDate = getScheduleChangeDate(s.id)
      if (scDate && date > scDate) return true
    }
    // 학생 상태 자체가 schedule_change
    if (s.status === 'schedule_change') return true
    return false
  })
  const inactiveStudents    = students.filter(s => ['cancelled','waiting'].includes(s.status))
  const transferredStudents = students.filter(s => s.status === 'transfer_out')

  const counts = { pending:0, present:0, absent:0, late:0, early:0 }
  if (showAttendance) activeStudents.forEach(s => { const st = getRec(s.id)?.status || 'pending'; counts[st]++ })
  const done = activeStudents.length - counts.pending
  const rate = activeStudents.length > 0 ? Math.round((counts.present + counts.late) / activeStudents.length * 100) : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

      {/* ── 헤더 */}
      {cls && date && (
        <div style={{ padding:'14px 18px', borderRadius:'12px', border:`1.5px solid ${showAttendance ? (isPast?C.border:'#fed7aa') : '#86efac'}`, background: showAttendance ? (isPast?'#f9fafb':'linear-gradient(135deg,#fff7ed,#fff)') : 'linear-gradient(135deg,#f0fdf4,#fff)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text, display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                <span>{date} ({DAYS_KO[new Date(date+'T00:00:00').getDay()]}요일)</span>
                {session && (() => {
                  const si = getSessionInfo(cls, date)
                  const TC = [
                    { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
                    { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
                    { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
                    { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
                  ]
                  const tc = si ? TC[(si.termNum-1) % TC.length] : null
                  return (
                    <>
                      <span style={{ fontSize:'13px', color:showAttendance?C.primary:'#16a34a', fontWeight:600 }}>{session}차시{isFuture?' 예정':''}</span>
                      {si && <span style={{ fontSize:'12px', fontWeight:700, color:tc?.text, background:tc?.bg, border:`1px solid ${tc?.border}`, padding:'1px 8px', borderRadius:'5px' }}>{si.termNum}텀 {si.termSess}차시</span>}
                    </>
                  )
                })()}
              </div>
              <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>
                {/* 선택된 반만 표시: students의 section 필드 기준 (현재방식) 또는 cls.section (예전방식) */}
                {(() => {
                  const activeSecs = [...new Set(activeStudents.map(s => s.section || cls.section || ''))].filter(Boolean).sort()
                  const secLabel = activeSecs.length > 0 ? activeSecs.map(s => s+'반').join('·') : (cls.section ? cls.section+'반' : '')
                  return <span>{cls.organization} · {cls.className}{secLabel ? ' ' + secLabel : ''} · {activeStudents.length}명</span>
                })()}
              </div>
            </div>
            <span style={{ fontSize:'12px', padding:'4px 10px', borderRadius:'6px', fontWeight:600,
              background: isToday?'#f0fdf4': isPast?'#f3f4f6':'#eff6ff',
              color:       isToday?'#16a34a': isPast?C.muted:'#3b82f6' }}>
              {isToday?'오늘 수업': isPast?'지난 수업':'예정 수업'}
            </span>
          </div>
        </div>
      )}

      {/* ── 수업 준비 메모 (미래 수업일만) */}
      {cls && isFuture && isSessionDate && (
        <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ padding:'11px 16px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'13px', fontWeight:700, color:'#92400e' }}>📝 수업 준비 메모</span>
            <button onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 30) }}
              style={{ padding:'3px 10px', borderRadius:'6px', border:'1.5px solid #fbbf24', background:'#fff', color:'#b45309', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
          </div>
          <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:'7px' }}>
            {notes.length === 0 && !adding && <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'10px 0' }}>준비사항을 기록하세요</div>}
            {notes.map(n => (
              <div key={n.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', background:'#fffbeb', borderRadius:'7px', border:'1px solid #fde68a', fontSize:'13px', color:'#374151' }}>
                <span>📌 {n.content}</span>
                <button onClick={() => delNote(n.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>삭제</button>
              </div>
            ))}
            {adding && (
              <div style={{ display:'flex', gap:'6px' }}>
                <input ref={inputRef} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="예: 교구 준비 / 배터리 충전"
                  onKeyDown={e => { if (e.key==='Enter') addNote(); if (e.key==='Escape') { setAdding(false); setNewNote('') } }}
                  style={{ flex:1, border:`1.5px solid ${C.primary}`, borderRadius:'7px', padding:'7px 11px', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                <button onClick={addNote} style={sm('#f97316','#fff')}>저장</button>
                <button onClick={() => { setAdding(false); setNewNote('') }} style={sm('#f3f4f6','#374151')}>취소</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 출석 통계 + 일괄 버튼 (출석체크 모드만) */}
      {showAttendance && (
        <>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
              {Object.entries(ATTENDANCE_STATUS).map(([k,v]) => {
                const list = activeStudents.filter(s => (getRec(s.id)?.status || 'pending') === k)
                return (
                  <div key={k}
                    onClick={() => list.length > 0 && setBadgeModal({ type: v.label, color: v.color, bg: v.bg, emoji: v.emoji, students: list })}
                    style={{ padding:'5px 10px', borderRadius:'7px', background:v.bg, border:`1px solid ${v.color}30`, fontSize:'12px', fontWeight:600, color:v.color, cursor: list.length > 0 ? 'pointer' : 'default', transition:'opacity .15s' }}
                    onMouseEnter={e => { if(list.length>0) e.currentTarget.style.opacity='0.75' }}
                    onMouseLeave={e => e.currentTarget.style.opacity='1'}
                  >
                    {v.emoji} {v.label} {counts[k]||0}
                  </div>
                )
              })}
              {transferredStudents.length > 0 && (
                <div
                  onClick={() => setBadgeModal({ type: '전학', color:'#0369a1', bg:'#f0f9ff', emoji:'✈️', students: transferredStudents, showDate: true, dateKey: 'transfer_out' })}
                  style={{ padding:'5px 10px', borderRadius:'7px', background:'#f0f9ff', border:'1px solid #7dd3fc30', fontSize:'12px', fontWeight:600, color:'#0369a1', cursor:'pointer', transition:'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity='0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}
                >
                  ✈️ 전학 {transferredStudents.length}명
                </div>
              )}
              {scheduleChangedStudents.length > 0 && (
                <div
                  onClick={() => setBadgeModal({ type: '스케줄변경', color:'#7c3aed', bg:'#f5f3ff', emoji:'📅', students: scheduleChangedStudents, showDate: true, dateKey: 'schedule_change' })}
                  style={{ padding:'5px 10px', borderRadius:'7px', background:'#f5f3ff', border:'1px solid #c4b5fd30', fontSize:'12px', fontWeight:600, color:'#7c3aed', cursor:'pointer', transition:'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity='0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}
                >
                  📅 스케줄변경 {scheduleChangedStudents.length}명
                </div>
              )}
              {(() => {
                const cancelAfter = students.filter(s =>
                  s.status === 'cancel_after' ||
                  (s.status === 'cancelled' && s.cancel_info?.type === 'after')
                )
                if (cancelAfter.length === 0) return null

                const allSessions = calcSessionDates(cls)
                const sessions = cls.totalSessions ? allSessions.slice(0, cls.totalSessions) : allSessions
                const cancelledSet = new Set((cls.cancelledDates || []).map(c => c.date))
                const termSizes = cls.periods?.length > 0
                  ? cls.periods.flatMap(p =>
                      (p.termSizes?.length > 0)
                        ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
                        : Array(Number(p.termCount) || 1).fill(4)
                    )
                  : (cls.termSizes?.length > 0)
                    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
                    : [cls.termSize ? Number(cls.termSize) : 4]

                const termMap = {}
                let cursor = 0
                termSizes.forEach((size, ti) => {
                  sessions.slice(cursor, cursor + size).forEach(d => { termMap[d] = ti + 1 })
                  cursor += size
                })
                if (!cls.totalSessions && cursor < sessions.length) {
                  sessions.slice(cursor).forEach(d => { termMap[d] = termSizes.length })
                }

                const termCounts = {}
                let hasUnknown = false
                cancelAfter.forEach(s => {
                  // cancel_info가 JSON 문자열로 올 수도 있으므로 파싱
                  const ci = typeof s.cancel_info === 'string'
                    ? (() => { try { return JSON.parse(s.cancel_info) } catch { return null } })()
                    : s.cancel_info
                  const cd = ci?.date
                  if (!cd) { hasUnknown = true; return }

                  // 저장된 termNum 우선 사용
                  if (ci.termNum != null) {
                    termCounts[ci.termNum] = (termCounts[ci.termNum] || 0) + 1
                    return
                  }
                  // 없으면 날짜로 계산 시도
                  const before = sessions.filter(d => d <= cd && !cancelledSet.has(d))
                  const lastSess = before[before.length - 1]
                  const tn = lastSess ? termMap[lastSess] : null
                  if (tn != null) termCounts[tn] = (termCounts[tn] || 0) + 1
                  else hasUnknown = true
                })

                const isQuarter = cls.termType === 'quarter'
                const termUnit = isQuarter ? '분기' : '학기'
                const termBreakdown = Object.entries(termCounts)
                  .sort(([a],[b]) => Number(a) - Number(b))
                  .map(([t, cnt]) => `${t}텀:${cnt}명`)
                  .join(', ')
                const parts = [termBreakdown, hasUnknown ? '확인필요' : ''].filter(Boolean).join(', ')

                return (
                  <div style={{ padding:'5px 10px', borderRadius:'7px', background:'#fef2f2', border:'1px solid #fca5a530', fontSize:'12px', fontWeight:600, color:'#dc2626' }}>
                    ✕ 취소({termUnit}) {cancelAfter.length}명{parts ? ` (${parts})` : ''}
                  </div>
                )
              })()}
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => markAll('present')} style={actionBtn('#f0fdf4','#16a34a','#86efac')}>전체 출석</button>
              <button onClick={() => markAll('absent')}  style={actionBtn('#fef2f2','#ef4444','#fca5a5')}>전체 결석</button>
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:C.muted, marginBottom:'5px' }}>
              <span>처리 {done}/{activeStudents.length}</span>
              <span style={{ fontWeight:700, color: rate>=80?'#16a34a':C.warning }}>출석률 {rate}%</span>
            </div>
            <div style={{ height:'6px', background:'#f3f4f6', borderRadius:'999px', overflow:'hidden' }}>
              <div style={{ width:`${activeStudents.length ? done/activeStudents.length*100 : 0}%`, height:'100%', background:C.primary, borderRadius:'999px', transition:'width .4s' }} />
            </div>
          </div>
        </>
      )}

      {/* ── 학생 리스트 — 반별로 섹션 나눠서 표시 */}
      {(() => {
        // 반(section) 기준으로 그룹핑
        // 현재방식: 학생의 section 필드 / 예전방식: 수업카드의 section
        const sections = [...new Set(activeStudents.map(s => {
          if (s.section) return s.section
          const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
          return sc?.section || ''
        }))].sort()

        const ColHeader = () => (
          <div style={{ display:'grid', gridTemplateColumns:'35px 90px 90px 130px 220px 70px 110px 90px 1fr', gap:'6px', padding:'8px 14px', background:'#f3f4f6', borderBottom:`1px solid ${C.border}`, fontSize:'11px', fontWeight:700, color:C.muted, textAlign:'center' }}>
            <span>순번</span>
            <span>학년·반·번호</span>
            <span>이름</span>
            <span>학부모전화</span>
            <span>출석·지각·조퇴·결석</span>
            <span>리모컨</span>
            <span>진도</span>
            <span>출결초대</span>
            <span>특이사항·메모</span>
          </div>
        )

        return sections.map(sec => {
          const secStudents = activeStudents.filter(s => {
            if (s.section) return s.section === sec
            const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
            return (sc?.section || '') === sec
          }).sort((a, b) => {
            const g = parseInt(a.grade||'0') - parseInt(b.grade||'0'); if (g) return g
            const c = parseInt(a.classNum||'0') - parseInt(b.classNum||'0'); if (c) return c
            const n = parseInt(a.number||'0') - parseInt(b.number||'0'); if (n) return n
            return (a.name||'').localeCompare(b.name||'','ko')
          })
          return (
            <div key={sec||'all'} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:'12px' }}>
              <div style={{ padding:'10px 16px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                  📋 {showAttendance ? '출석체크' : '수강생 명단'}{sec ? ` — ${sec}반` : ''} ({secStudents.length}명)
                </span>
                {!cls && <span style={{ fontSize:'12px', color:C.muted }}>수업을 선택하면 출석체크를 시작할 수 있습니다</span>}
              </div>
              <ColHeader />
              {secStudents.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', color:C.muted, fontSize:'14px' }}>학생이 없습니다</div>
              ) : (
                <div>
                  {secStudents.map((s, i) => (
                    showAttendance
                      ? <StudentRow key={s.id} s={s} idx={i} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls?.id}); setProgProductId(pid) }} classId={cls?.id} spItems={spItems} spProds={spProds} spProg={spProg} spChecks={spChecks} user={user} />
                      : <FutureStudentRow key={s.id} s={s} idx={i} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} classId={cls?.id} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls?.id}); setProgProductId(pid) }} spProds={spProds} user={user} />
                  ))}
                </div>
              )}
              {inactiveStudents.filter(s => {
                if (s.section) return s.section === sec
                const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
                return (sc?.section || '') === sec
              }).length > 0 && (
                <div style={{ borderTop:`1.5px dashed #e5e7eb` }}>
                  <button onClick={() => setShowInactive(v=>!v)}
                    style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fafafa', border:'none', cursor:'pointer', padding:'10px 16px', fontFamily:'Noto Sans KR, sans-serif', width:'100%', textAlign:'left' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af' }}>
                      {showInactive ? '▼' : '▶'} 취소·대기 {inactiveStudents.length}명
                    </span>
                    <span style={{ fontSize:'11px', color:'#d1d5db' }}>(출석 처리 제외)</span>
                  </button>
                  {showInactive && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'0 8px 8px' }}>
                      {inactiveStudents.filter(s => {
                        if (s.section) return s.section === sec
                        const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
                        return (sc?.section || '') === sec
                      }).map((s,i) => <InactiveStudentRow key={s.id} s={s} idx={i} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      })()}

      {msgStudent  && <MsgModal student={msgStudent} cls={cls} user={user} onClose={() => setMsgStudent(null)} />}
      {selStudent  && <StudentDetailModal student={selStudent} onClose={() => setSelStudent(null)} />}
      {badgeModal  && (
        <BadgeDetailModal
          modal={badgeModal}
          onClose={() => setBadgeModal(null)}
          getRec={getRec}
          allAttendance={AttendanceDB.byStudentClass}
        />
      )}
      {progStudent && progProductId && (
        <ProgCheckModal
          student={progStudent}
          initialProductId={progProductId}
          spProds={spProds}
          teacherId={cls?.teacherId||''}
          onClose={() => setProgStudent(null)}
          onSaved={() => { setProgTick(t => t+1); const ch = new BroadcastChannel('progress_screen'); ch.postMessage({ type:'refresh', source:'main' }); ch.close() }}
        />
      )}
    </div>
  )
}


// ─── 배지 클릭 상세 모달
function BadgeDetailModal({ modal, onClose, getRec, allAttendance }) {
  const { type, color, bg, emoji, students, showDate, dateKey } = modal

  // 전학 날짜 추출 (statusHistory에서)
  const getTransferDate = (s) => {
    const h = (s.statusHistory||[]).slice().reverse()
      .find(h => h.status === 'transfer_out' && h.memo?.startsWith('[전학]'))
    const m = h?.memo?.match(/\d{4}-\d{2}-\d{2}/)
    return m ? m[0] : null
  }

  // 스케줄변경 날짜 추출 (attendance absentReason에서)
  const getScheduleDate = (s) => {
    const recs = allAttendance(s.id, s.classIds?.[0] || '')
    const rec = recs.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''))
      .find(r => r.absentReason?.startsWith('schedule_change:'))
    return rec ? rec.absentReason.split(':')[1] : null
  }

  // 결석 사유 가져오기
  const getAbsentReason = (s) => {
    const rec = getRec(s.id)
    if (!rec?.absentReason) return null
    const REASON_LABELS = {
      sick: '질병', field_trip: '현장학습', exp_trip: '체험학습',
      condolence: '경조사', personal: '개인사유', unexcused: '무단',
      infection: '법정감염병', transferred: '전학', etc: '기타',
    }
    return REASON_LABELS[rec.absentReason] || rec.absentReason
  }

  const fmtDate = (d) => {
    if (!d) return '-'
    const [y,m,day] = d.split('-')
    return `${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`
  }

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:'440px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}
      >
        {/* 헤더 */}
        <div style={{ padding:'18px 20px', background: bg, borderBottom:`1px solid ${color}20`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'20px' }}>{emoji}</span>
            <div>
              <div style={{ fontSize:'16px', fontWeight:700, color, fontFamily:'Noto Sans KR, sans-serif' }}>
                {type}
              </div>
              <div style={{ fontSize:'12px', color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif' }}>
                총 {students.length}명
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width:'28px', height:'28px', borderRadius:'50%', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}
          >✕</button>
        </div>

        {/* 학생 목록 */}
        <div style={{ maxHeight:'420px', overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
          {students.map((s, i) => {
            const dateStr = dateKey === 'transfer_out'    ? getTransferDate(s)
                          : dateKey === 'schedule_change' ? getScheduleDate(s)
                          : null
            const reason = getAbsentReason(s)
            return (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', borderRadius:'10px', background:'#f9fafb', border:'1px solid #f3f4f6', fontFamily:'Noto Sans KR, sans-serif' }}>
                {/* 순번 */}
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background: color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {i+1}
                </div>
                {/* 학년·반·번호 */}
                <div style={{ fontSize:'12px', color:'#9ca3af', minWidth:'70px', flexShrink:0 }}>
                  {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
                </div>
                {/* 이름 */}
                <div style={{ fontSize:'15px', fontWeight:700, color:'#111827', flex:1 }}>
                  {s.name}
                </div>
                {/* 날짜 or 사유 */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {dateStr && (
                    <div style={{ fontSize:'12px', fontWeight:600, color, background:bg, padding:'2px 8px', borderRadius:'6px' }}>
                      {fmtDate(dateStr)}
                    </div>
                  )}
                  {reason && !dateStr && (
                    <div style={{ fontSize:'12px', color:'#6b7280' }}>{reason}</div>
                  )}
                </div>
              </div>
            )
          })}
          {students.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif' }}>
              해당 학생이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudentDetailModal({ student, onClose }) {
  return (
    <Modal open={true} onClose={onClose} title={student.name} width={400}>
      {[
        ['학교', student.school || '-'],
        ['학년', student.grade ? student.grade+'학년' : '-'],
        ['학급반', student.classNum ? student.classNum+'반' : '-'],
        ['번호', student.number || '-'],
        ['학부모 전화', student.parentPhone || '-'],
        ['학생 전화', student.studentPhone || '-'],
        ['메모', student.memo || '-'],
      ].map(([label, value]) => (
        <div key={label} style={{ display:'flex', gap:'12px', padding:'9px 0', borderBottom:'1px solid #f3f4f6', fontSize:'14px' }}>
          <span style={{ color:'#9ca3af', fontWeight:600, minWidth:'90px' }}>{label}</span>
          {label.includes('전화') && value !== '-'
            ? <PhoneAction phone={value}><span style={{ color:'#3b82f6' }}>{fmtPhone(value)}</span></PhoneAction>
            : <span style={{ color:'#18181b' }}>{value}</span>
          }
        </div>
      ))}
    </Modal>
  )
}

function actionBtn(bg,color,border) {
  return { padding:'6px 12px', borderRadius:'7px', border:`1.5px solid ${border}`, background:bg, color, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }
}

// ═══════════════════════════════════════════════════════════════════
//  MOBILE ATTENDANCE  (768px 이하 전용)
// ═══════════════════════════════════════════════════════════════════

function MobileStudentCard({ s, rec, onMark, onMsgOpen, onProgOpen, isFuture, spItem, spProg, spChecks, onInviteSent, user }) {
  const status   = rec?.status || 'pending'
  const statusMap = {
    present: { label:'출석', color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
    late:    { label:'지각', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    leave:   { label:'조퇴', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
    absent:  { label:'결석', color:'#ef4444', bg:'#fef2f2', border:'#fca5a5' },
    pending: { label:'미처리', color:'#9ca3af', bg:'#f9fafb', border:'#e5e7eb' },
  }
  const cur = statusMap[status] || statusMap.pending

  // 진도 미리보기
  const hasProgress = spItem?.productId
  const prog = hasProgress ? spProg?.find(p => p.studentId === s.id && p.productId === spItem.productId) : null
  const checks = hasProgress ? (spChecks||[]).filter(c => c.studentId === s.id && c.productId === spItem.productId) : []
  const curStage = prog?.curStage || spItem?.stage || 1
  const checkedInStage = checks.filter(c => c.stage === curStage).length

  // 사유/메모 모달
  const [reasonModal, setReasonModal] = useState(null) // 클릭된 status
  const [reasonVal, setReasonVal]     = useState('')
  const [noteVal, setNoteVal]         = useState('')

  const handleMark = (key) => {
    if (status === key) { onMark(s.id, 'pending'); return }
    if (['late','leave','absent'].includes(key)) {
      setReasonVal(rec?.absentReason || '')
      setNoteVal(rec?.note || '')
      setReasonModal(key)
    } else {
      onMark(s.id, key)
    }
  }
  const confirmReason = () => {
    onMark(s.id, reasonModal, { absentReason: reasonVal, note: noteVal })
    setReasonModal(null)
  }

  // 출결초대 모달
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSent, setInviteSent] = useState(!!s.parentInviteSentAt)

  return (
    <div style={{
      background: '#fff', borderRadius: '14px',
      border: `1.5px solid ${status !== 'pending' ? cur.border : '#e5e7eb'}`,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* 학생 정보 */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 한줄: 학년반 이름 👨‍👩‍👧 전화번호 출석상태 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {(s.grade || s.classNum) && (
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                {s.grade ? `${s.grade}학년` : ''}{s.classNum ? `${s.classNum}반` : ''}
              </span>
            )}
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>{s.name}</span>
            {s.parentPhone && (
              <>
                <span style={{ fontSize: '13px' }}>👨‍👩‍👧</span>
                <a href={`tel:${s.parentPhone.replace(/[^0-9]/g,'')}`}
                  style={{ color: '#3b82f6', textDecoration: 'underline', textUnderlineOffset: '2px', fontSize: '15px', fontWeight: 600 }}>
                  {fmtPhone(s.parentPhone)}
                </a>
                <button onClick={() => setInviteOpen(true)}
                  style={{ padding:'2px 8px', borderRadius:'6px', border:`1.5px solid ${inviteSent?'#86efac':'#a78bfa'}`, background: inviteSent ? '#f0fdf4' : '#fff', color: inviteSent ? '#16a34a' : '#7c3aed', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  {inviteSent ? '✅출결' : '출결초대'}
                </button>
                {inviteOpen && <InviteModal student={s} user={user} onClose={() => setInviteOpen(false)} onSent={() => { setInviteSent(true); onInviteSent && onInviteSent(s.id) }} />}
              </>
            )}
            {status !== 'pending' && (
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: cur.bg, color: cur.color, border: `1px solid ${cur.border}` }}>
                {cur.label}
              </span>
            )}
            <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px',
              background: s.parentJoined ? '#f0fdf4' : '#f9fafb',
              border: `1px solid ${s.parentJoined ? '#86efac' : '#e5e7eb'}`,
              color: s.parentJoined ? '#16a34a' : '#9ca3af' }}>
              {s.parentJoined ? '출결 ON' : '출결 OFF'}
            </span>
          </div>
        </div>
        {/* 메시지 버튼 + 연락방법 */}
        {s.parentPhone && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => onMsgOpen(s)}
              style={{
                width: '44px', height: '44px', borderRadius: '10px', fontSize: '20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: s.contactMethod ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
                background: s.contactMethod ? '#f0fdf4' : '#fef2f2',
              }}>
              💬
            </button>
            <span style={{ fontSize: '10px', fontWeight: 700, color: s.contactMethod ? '#16a34a' : '#ef4444' }}>
              {s.contactMethod === 'kakao' ? '💛카톡'
                : s.contactMethod === 'sms' ? '💬문자'
                : s.contactMethod === 'both' ? '💬💛'
                : '📵미설정'}
            </span>
          </div>
        )}
      </div>

      {/* 출석 버튼 */}
      {isFuture ? (
        <div style={{ padding: '10px 14px', background: '#f9fafb', borderTop: '1px solid #f3f4f6', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          🗓️ 수업 예정일입니다
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: hasProgress ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', borderTop: '1px solid #f3f4f6' }}>
          {[
            { key:'present', label:'출석', emoji:'✅', color:'#16a34a', bg:'#f0fdf4', active:'#dcfce7' },
            { key:'late',    label:'지각', emoji:'⏰', color:'#d97706', bg:'#fffbeb', active:'#fef9c3' },
            { key:'leave',   label:'조퇴', emoji:'🚶', color:'#7c3aed', bg:'#f5f3ff', active:'#ede9fe' },
            { key:'absent',  label:'결석', emoji:'❌', color:'#ef4444', bg:'#fef2f2', active:'#fee2e2' },
          ].map((btn, i) => (
            <button key={btn.key} onClick={() => handleMark(btn.key)}
              style={{
                padding: '12px 4px', border: 'none',
                borderRight: '1px solid #f3f4f6',
                background: status === btn.key ? btn.active : '#fff',
                cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                transition: 'background .1s',
              }}>
              <span style={{ fontSize: '20px' }}>{btn.emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: status===btn.key ? 700 : 400, color: status===btn.key ? btn.color : '#9ca3af' }}>{btn.label}</span>
            </button>
          ))}
          {hasProgress && (
            <button onClick={() => onProgOpen && onProgOpen(s, spItem.productId)}
              style={{
                padding: '12px 4px', border: 'none',
                background: '#f0fdf4', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>{curStage}단계/{checkedInStage}차시</span>
            </button>
          )}
        </div>
      )}
      {/* 사유/메모 모달 */}
      {reasonModal && (
        <Modal open={true} onClose={() => setReasonModal(null)}
          title={reasonModal === 'late' ? '⏰ 지각 사유' : reasonModal === 'leave' ? '🚶 조퇴 사유' : '❌ 결석 사유'}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'6px' }}>사유</label>
              <select value={reasonVal} onChange={e => setReasonVal(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
                {[
                  { value:'',           label:'사유 없음' },
                  { value:'sick',       label:'질병' },
                  { value:'field_trip', label:'현장학습' },
                  { value:'exp_trip',   label:'체험학습' },
                  { value:'condolence', label:'경조사' },
                  { value:'personal',   label:'개인사유' },
                  { value:'other',      label:'기타' },
                ].map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'6px' }}>연락 내역</label>
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                {['📞 통화', '💬 문자', '💛 카톡'].map(method => {
                  const tag = method.split(' ')[1]
                  const active = noteVal.includes(tag)
                  return (
                    <button key={tag} onClick={() => setNoteVal(v => v ? (v.includes(tag) ? v : v + ' / ' + tag) : tag)}
                      style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1.5px solid ${active?'#6b7280':'#e5e7eb'}`, background:active?'#f3f4f6':'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:active?700:400 }}>
                      {method}
                    </button>
                  )
                })}
              </div>
              <input value={noteVal} onChange={e => setNoteVal(e.target.value)}
                placeholder="메모 입력 (선택)"
                style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setReasonModal(null)}
                style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
                취소
              </button>
              <button onClick={confirmReason}
                style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                확인
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── 일괄 메시지 발송 모달
function BulkMsgModal({ students, cls, user, statusFilter, onClose }) {
  const { success, error } = useToast()
  const label     = statusFilter === 'present' ? '출석' : '결석'
  const guides    = MessageGuides.byTeacher(user?.id || '').filter(g => g.category === label)
  const [text, setText]   = useState(guides[0] ? replacePlaceholders(guides[0].content, null, cls, user) : '')
  const [guideIdx, setGuideIdx] = useState(0)
  const [sentIds, setSentIds]   = useState(new Set())

  const filtered = students.filter(s => {
    const st = statusFilter
    return st === 'present'
      ? ['present','late'].includes(s._status)
      : s._status === 'absent'
  })

  const applyGuide = (g) => setText(replacePlaceholders(g.content, null, cls, user))

  const sendOne = (s) => {
    const phone = s.parentPhone?.replace(/[^0-9]/g, '')
    if (!phone) { error(`${s.name}: 전화번호 없음`); return }
    const msg = text.replace(/{학생이름}/g, s.name)
    const method = s.contactMethod || ''
    if (method === 'kakao') {
      window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(msg)}`)
    } else {
      window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`)
    }
    setSentIds(prev => new Set([...prev, s.id]))
  }

  return (
    <Modal open={true} onClose={onClose} title={`📢 ${label} 일괄 안내`} width={520}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

        {/* 문구 선택 */}
        {guides.length > 0 && (
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'6px' }}>📋 문구 선택</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'120px', overflowY:'auto' }}>
              {guides.map((g, i) => (
                <button key={g.id} onClick={() => { setGuideIdx(i); applyGuide(g) }}
                  style={{ padding:'8px 12px', borderRadius:'8px', border:`1.5px solid ${guideIdx===i?C.primary:C.border}`, background:guideIdx===i?'#fff7ed':'#f9fafb', textAlign:'left', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.primary }}>{g.title||g.category}</div>
                  <div style={{ fontSize:'11px', color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.content.slice(0,50)}...</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 발송 내용 */}
        <div>
          <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'6px' }}>발송 내용 ({'{학생이름}'} 자동 치환)</div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
            style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.7 }} />
        </div>

        {/* 발송 대상 목록 */}
        <div>
          <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'6px' }}>발송 대상 {filtered.length}명</div>
          {filtered.length === 0
            ? <div style={{ fontSize:'13px', color:C.muted, padding:'12px', background:'#f9fafb', borderRadius:'8px', textAlign:'center' }}>{label} 처리된 학생이 없습니다</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'200px', overflowY:'auto' }}>
                {filtered.map(s => {
                  const sent = sentIds.has(s.id)
                  const method = s.contactMethod
                  return (
                    <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'9px', border:`1px solid ${sent?'#86efac':C.border}`, background:sent?'#f0fdf4':'#fff' }}>
                      <div>
                        <span style={{ fontSize:'13px', fontWeight:600, color:'#111827' }}>{s.name}</span>
                        <span style={{ fontSize:'11px', color:C.muted, marginLeft:'8px' }}>{fmtPhone(s.parentPhone)||'전화번호 없음'}</span>
                        {method === 'kakao' && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#FEE500', color:'#3c1e1e', marginLeft:'6px' }}>💛카톡</span>}
                        {method === 'sms'   && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#eff6ff', color:'#3b82f6', marginLeft:'6px' }}>💬문자</span>}
                      </div>
                      <button onClick={() => sendOne(s)} disabled={!s.parentPhone}
                        style={{ padding:'5px 12px', borderRadius:'7px', border:'none', background:sent?'#16a34a':'#f97316', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', opacity:s.parentPhone?1:0.4 }}>
                        {sent ? '✓ 발송됨' : '발송'}
                      </button>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        <button onClick={onClose}
          style={{ padding:'10px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

function MobileAttendance({ user, pageParams = {} }) {
  const today    = todayStr()
  const allClasses  = ClassesDB.byTeacher(user.id)
  const allStudents = StudentsDB.byTeacher(user.id)

  const [selDate,   setSelDate]   = useState(() => pageParams.date || today)
  const [selClassId, setSelClassId] = useState(() => pageParams.classId || '')
  const [calOpen,   setCalOpen]   = useState(false)
  const [tick,      setTick]      = useState(0)
  const [msgStudent,   setMsgStudent]   = useState(null)
  const [bulkModal,    setBulkModal]    = useState(null) // 'present' | 'absent' | null
  const [progStudent,  setProgStudent]  = useState(null)
  const [progProductId,setProgProductId]= useState(null)
  const [progTick,     setProgTick]     = useState(0)

  const d = new Date(selDate + 'T00:00:00')
  const [calYear,  setCalYear]  = useState(d.getFullYear())
  const [calMonth, setCalMonth] = useState(d.getMonth())

  // 선택 날짜의 수업 목록 — section 기준 정렬 (A반 왼쪽, B반 오른쪽)
  const dayClasses = allClasses
    .filter(cls => calcSessionDates(cls).includes(selDate))
    .sort((a, b) => (a.section||'').localeCompare(b.section||'', 'ko'))

  // 수업 미선택 시 첫 번째 자동 선택
  useEffect(() => {
    if (!selClassId && dayClasses.length > 0) setSelClassId(dayClasses[0].id)
  }, [selDate])

  // selClassId 파싱: 'classId::반' 형태 (Students.jsx 동일 방식)
  const selClassIdParsedM = selClassId.includes('::') ? selClassId.split('::')[0] : selClassId
  const selSectionParsedM = selClassId.includes('::') ? selClassId.split('::')[1] : selSection

  const selClass  = allClasses.find(c => c.id === selClassIdParsedM)
  const isFuture  = selDate > today

  // 달력 점 표시용 날짜
  const classDates = [...new Set(allClasses.flatMap(c => calcSessionDates(c)))]

  // 진도 관련 데이터
  const spItems  = selClass ? SupplyItems.byClass(selClass.id) : []
  const spProds  = SupplyProducts.byTeacher(user.id)
  const spProg   = SupplyStudentProgress.byTeacher(user.id)
  const spChecks = SupplySessionChecks.byTeacher ? SupplySessionChecks.byTeacher(user.id) : []

  // 반 필터: 수업 드롭다운 '::' 파싱값 우선, 없으면 별도 selSection
  const calSelSection = selSectionParsedM

  const students = selClass
    ? [...allStudents.filter(s => {
        if (!s.classIds?.includes(selClass.id)) return false
        if (!['applied','selected','confirmed'].includes(s.status)) return false
        // 반 필터 (현재방식: 학생 section / 예전방식: 수업카드 section)
        if (calSelSection) {
          const studentSec = s.section || ''
          if (studentSec) {
            if (studentSec !== calSelSection) return false
          } else {
            // 예전방식: 수업카드 자체 section 비교
            const cls = allClasses.find(c => s.classIds?.includes(c.id) && c.section === calSelSection)
            if (!cls) return false
          }
        }
        return true
      })].sort((a,b) => {
          const g = parseInt(a.grade||0)-parseInt(b.grade||0); if(g) return g
          const c = parseInt(a.classNum||0)-parseInt(b.classNum||0); if(c) return c
          const n = parseInt(a.number||0)-parseInt(b.number||0); if(n) return n
          return (a.name||'').localeCompare(b.name||'','ko')
        })
    : []

  const records  = isFuture ? [] : AttendanceDB.byClassDate(selClass?.id||'', selDate)
  const getRec   = (sid) => records.find(r => r.studentId === sid)
  const mark = async (studentId, status, extra = {}) => {
    if (!selClass || isFuture) return
    const existing = AttendanceDB.find(selClass.id, studentId, selDate)
    const session  = getSession ? getSession(selClass, selDate) : 0
    try {
      await AttendanceDB.upsert({
        id: existing?.id || uid(), classId: selClass.id, studentId,
        date: selDate, session: session||0, status,
        note: existing?.note||'', absentReason: existing?.absentReason||'',
        homeReturn: existing?.homeReturn||'', markedAt: now(),
        ...extra,
      })
    } catch (e) {
      console.error('[출석저장 실패]', e.message)
      return
    }
    setTick(t => t+1)
    pushAttendance(students.find(s => s.id === studentId), status, extra)
  }
  const markAll = (status) => students.forEach(s => mark(s.id, status))

  const doneCnt    = students.filter(s => (getRec(s.id)?.status||'pending') !== 'pending').length
  const presentCnt = students.filter(s => ['present','late'].includes(getRec(s.id)?.status||'')).length

  const prevMonth = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1) }

  const handleSelectDate = (date) => {
    setSelDate(date)
    setCalOpen(false)
    const dc = allClasses.filter(c => calcSessionDates(c).includes(date))
    setSelClassId(dc.length > 0 ? dc[0].id : '')
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* 날짜 헤더 + 달력 토글 */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <button onClick={() => setCalOpen(v => !v)}
          style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Noto Sans KR, sans-serif' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              📅 {selDate === today ? '오늘 · ' : ''}{formatDateKo(selDate)}
            </div>
            {dayClasses.length > 0
              ? <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{dayClasses.length}개 수업</div>
              : <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>수업 없는 날</div>
            }
          </div>
          <span style={{ fontSize: '20px', color: '#9ca3af' }}>{calOpen ? '▲' : '▼'}</span>
        </button>

        {/* 달력 접기/펼치기 */}
        {calOpen && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 10px' }}>
              <button onClick={prevMonth} style={{ width:'32px',height:'32px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'18px' }}>‹</button>
              <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
                <span style={{ fontSize:'15px',fontWeight:700,color:'#111827' }}>{calYear}년 {MONTHS[calMonth]}</span>
                <button onClick={() => handleSelectDate(today)} style={{ padding:'2px 8px',borderRadius:'6px',border:'1px solid #f97316',background:'#fff7ed',color:'#f97316',fontSize:'11px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>오늘</button>
              </div>
              <button onClick={nextMonth} style={{ width:'32px',height:'32px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'18px' }}>›</button>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'4px' }}>
              {DAYS_KO.map((d,i)=><div key={d} style={{ textAlign:'center',fontSize:'11px',fontWeight:600,padding:'3px 0',color:i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>)}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px' }}>
              {(() => {
                const firstDay = new Date(calYear,calMonth,1).getDay()
                const dim = new Date(calYear,calMonth+1,0).getDate()
                const classSet = new Set(classDates)
                const cells = []
                for(let i=0;i<firstDay;i++) cells.push(null)
                for(let d=1;d<=dim;d++) cells.push(d)
                return cells.map((day,idx) => {
                  if(!day) return <div key={`e${idx}`}/>
                  const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isClass=classSet.has(ds), isToday=ds===today, isSel=ds===selDate
                  const isSun=(firstDay+day-1)%7===0, isSat=(firstDay+day-1)%7===6
                  return (
                    <button key={day} onClick={()=>handleSelectDate(ds)} style={{
                      position:'relative',padding:'8px 2px',border:'none',borderRadius:'8px',cursor:'pointer',
                      background:isSel?'#f97316':isToday?'#fff7ed':isClass?'#f0fdf4':'transparent',
                      color:isSel?'#fff':isSun?'#ef4444':isSat?'#3b82f6':'#111827',
                      fontWeight:isSel||isToday?700:400,fontSize:'14px',
                      outline:isToday&&!isSel?'2px solid #f97316':'none',outlineOffset:'-2px',
                      fontFamily:'Noto Sans KR, sans-serif',
                    }}>
                      {day}
                      {isClass&&<span style={{ position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'4px',height:'4px',borderRadius:'50%',background:isSel?'#fff':'#f97316',display:'block' }}/>}
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 수업 탭 (A반/B반 등) — sections > 1이면 반별로 분리 버튼 */}
      {dayClasses.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
          {dayClasses.flatMap(cls => {
            const secs = cls.sections?.filter(s => s.section) || []
            if (secs.length > 1) {
              // 통합카드: 반별 분리 버튼
              return secs.map(s => {
                const val = cls.id + '::' + s.section
                const isActive = selClassId === val
                return (
                  <button key={val} onClick={() => setSelClassId(val)}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: '1.5px solid',
                      borderColor: isActive ? '#f97316' : '#e5e7eb',
                      background: isActive ? '#fff7ed' : '#fff',
                      color: isActive ? '#f97316' : '#6b7280',
                      fontSize: '13px', fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                    {cls.className} {s.section}반
                  </button>
                )
              })
            }
            // 단일 반 or 반 없음
            const secLabel = cls.section ? ' ' + cls.section + '반' : ''
            const isActive = selClassIdParsedM === cls.id
            return [(
              <button key={cls.id} onClick={() => setSelClassId(cls.id)}
                style={{
                  padding: '8px 16px', borderRadius: '10px', border: '1.5px solid',
                  borderColor: isActive ? '#f97316' : '#e5e7eb',
                  background: isActive ? '#fff7ed' : '#fff',
                  color: isActive ? '#f97316' : '#6b7280',
                  fontSize: '13px', fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                {cls.className}{secLabel}
              </button>
            )]
          })}
        </div>
      )}

      {/* 수업 없는 날 */}
      {dayClasses.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 20px', background:'#fff', borderRadius:'14px', color:'#9ca3af' }}>
          <div style={{ fontSize:'32px', marginBottom:'8px' }}>🗓️</div>
          <div style={{ fontSize:'14px', fontWeight:600, color:'#6b7280' }}>수업이 없는 날입니다</div>
          <div style={{ fontSize:'12px', marginTop:'4px' }}>위 달력에서 수업일을 선택하세요</div>
        </div>
      )}

      {/* 선택된 수업 헤더 + 일괄처리 */}
      {selClass && (
        <>
          <div style={{ background: '#fff7ed', borderRadius: '14px', border: '1px solid #fed7aa', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                  {selClass.className}{selClass.section ? ` ${selClass.section}반` : ''}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                  {selClass.organization && <span>{selClass.organization} · </span>}
                  {selClass.time && <span>🕐 {selClass.time}{selClass.timeEnd ? ` ~ ${selClass.timeEnd}` : ''}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: doneCnt===students.length&&students.length>0 ? '#16a34a' : '#f97316' }}>
                  {presentCnt}<span style={{ fontSize:'13px',color:'#9ca3af' }}>/{students.length}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{doneCnt}/{students.length} 처리</div>
              </div>
            </div>
            {/* 진행률 바 */}
            {!isFuture && students.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${students.length ? doneCnt/students.length*100 : 0}%`, height: '100%', background: '#f97316', borderRadius: '999px', transition: 'width .3s' }} />
                </div>
              </div>
            )}
            {/* 일괄처리 + 일괄보내기 버튼 */}
            {!isFuture && students.length > 0 && (
              <div style={{ display: 'flex', flexDirection:'column', gap:'8px', marginTop: '10px' }}>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => markAll('present')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #86efac',background:'#f0fdf4',color:'#16a34a',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    ✅ 전체 출석
                  </button>
                  <button onClick={() => markAll('absent')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #fca5a5',background:'#fef2f2',color:'#ef4444',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    ❌ 전체 결석
                  </button>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setBulkModal('present')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #86efac',background:'#fff',color:'#16a34a',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    💬 출석 일괄 안내
                  </button>
                  <button onClick={() => setBulkModal('absent')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #fca5a5',background:'#fff',color:'#ef4444',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    💬 결석 일괄 안내
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 학생 카드 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {students.length === 0
              ? <div style={{ textAlign:'center',padding:'32px',background:'#fff',borderRadius:'14px',color:'#9ca3af',fontSize:'14px' }}>등록된 학생이 없습니다</div>
              : students.map(s => (
                  <MobileStudentCard key={s.id+tick+progTick} s={s} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} isFuture={isFuture}
                    onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: selClass.id}); setProgProductId(pid) }}
                    spItem={spItems.find(si => si.studentId === s.id && si.classId === selClass?.id)}
                    spProg={spProg} spChecks={spChecks} user={user} />
                ))
            }
          </div>
        </>
      )}

      {/* 메시지 모달 */}
      {msgStudent && <MsgModal student={msgStudent} cls={selClass} user={user} onClose={() => setMsgStudent(null)} />}

      {/* 진도 체크 모달 */}
      {progStudent && progProductId && (
        <ProgCheckModal
          student={progStudent}
          initialProductId={progProductId}
          spProds={spProds}
          teacherId={selClass?.teacherId||''}
          onClose={() => setProgStudent(null)}
          onSaved={() => { setProgTick(t => t+1); const ch = new BroadcastChannel('progress_screen'); ch.postMessage({ type:'refresh', source:'main' }); ch.close() }}
        />
      )}

      {/* 일괄 메시지 모달 */}
      {bulkModal && (
        <BulkMsgModal
          students={students.map(s => ({ ...s, _status: getRec(s.id)?.status || 'pending' }))}
          cls={selClass} user={user}
          statusFilter={bulkModal}
          onClose={() => setBulkModal(null)}
        />
      )}
    </div>
  )
}

export function Attendance({ user, pageParams = {} }) {
  const isMobile = window.innerWidth <= 768
  if (isMobile) return <MobileAttendance user={user} pageParams={pageParams} />
  const today = todayStr()
  const now_ = new Date()
  const allClasses = ClassesDB.byTeacher(user.id)
  const allStudents = StudentsDB.byTeacher(user.id)
  const schools = [...new Set(allClasses.map(c => c.organization).filter(Boolean))]

  const years = [...new Set(allClasses.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const currentYear = String(now_.getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  // 오늘 요일에 수업이 있으면 자동 선택
  const todayDayKo = ['일','월','화','수','목','금','토'][now_.getDay()]
  const autoClass = (() => {
    if (pageParams.classId) return null
    // 오늘 요일 수업 중 현재 년도에 해당하는 수업
    const candidates = allClasses.filter(c =>
      (c.days||[]).includes(todayDayKo) &&
      (c.startDate?.startsWith(currentYear) || c.endDate?.startsWith(currentYear))
    )
    if (candidates.length === 0) return null
    // sortClasses 적용 후 첫번째
    return sortClasses(candidates)[0]
  })()

  const [selYear,    setSelYear]    = useState(() => {
    if (pageParams.classId) { const cls = allClasses.find(c=>c.id===pageParams.classId); return cls?.startDate?.slice(0,4) || currentYear }
    return currentYear
  })
  const [selSchool,  setSelSchool]  = useState(() => {
    if (pageParams.classId) { const cls = allClasses.find(c=>c.id===pageParams.classId); return cls?.organization || '' }
    return autoClass?.organization || ''
  })
  const [selClassId, setSelClassId] = useState(() => pageParams.classId || autoClass?.id || '')
  const [selSection, setSelSection] = useState('')
  const [selTerm,    setSelTerm]    = useState('')
  const [selDay,     setSelDay]     = useState('')  // 요일 필터 ('월','화','수','목','금','토','일')
  const [activeMode, setActiveMode] = useState('class') // 'class' | 'day' — 두 모드 완전 분리
  const [selDate,    setSelDate]    = useState(() => pageParams.date || today)
  const [dateClicked, setDateClicked] = useState(false)
  const [rightPanelTick, setRightPanelTick] = useState(0)
  const [calYear,    setCalYear]    = useState(() => { const d = pageParams.date ? new Date(pageParams.date+'T00:00:00') : now_; return d.getFullYear() })
  const [calMonth,   setCalMonth]   = useState(() => { const d = pageParams.date ? new Date(pageParams.date+'T00:00:00') : now_; return d.getMonth() })

  // 기간 필터 날짜 범위 계산
  const TERM_RANGES = {
    q1: ['-01-01', '-03-31'], q2: ['-04-01', '-06-30'],
    q3: ['-07-01', '-09-30'], q4: ['-10-01', '-12-31'],
    s1: ['-03-01', '-08-31'], s2: ['-09-01', '-02-28'],
  }
  const termInRange = (cls) => {
    if (!selTerm) return true
    // 분기제 필터(q1~q4)는 분기제 수업에만, 학기제 필터(s1~s2)는 학기제 수업에만 적용
    const isQuarter = selTerm.startsWith('q')
    const isSemester = selTerm.startsWith('s')
    if (isQuarter && cls.termType !== 'quarter') return false
    if (isSemester && cls.termType === 'quarter') return false
    const r = TERM_RANGES[selTerm]
    if (!r) return true
    const y = selTerm === 's2' ? String(Number(selYear)) : selYear
    const nextY = String(Number(selYear) + 1)
    const from = selTerm === 's2' ? y + r[0] : selYear + r[0]
    const to   = selTerm === 's2' ? nextY + r[1] : selYear + r[1]
    return (cls.startDate || '') <= to && (cls.endDate || '') >= from
  }

  // 필터 적용된 수업 목록
  // - 수업 검색 모드: 년도 + 학교 + 수업 + 기간 적용
  // - 요일 검색 모드: 년도 + 요일만 적용 (학교 필터 완전 분리)
  const schoolClasses = sortClasses(allClasses.filter(c => {
    if (selYear && !c.startDate?.startsWith(selYear) && !c.endDate?.startsWith(selYear)) return false
    if (activeMode === 'class') {
      if (selSchool && c.organization !== selSchool) return false
      if (selDay && !(c.days||[]).includes(selDay)) return false
      if (!termInRange(c)) return false
    } else {
      // 요일 모드: 학교/기간 필터 무시, 요일만 적용
      if (selDay && !(c.days||[]).includes(selDay)) return false
    }
    return true
  }))
  // selClassId 파싱: 'classId::반' 또는 'classId'  (Students.jsx와 동일 방식)
  const selClassIdParsed = selClassId.includes('::') ? selClassId.split('::')[0] : selClassId
  const selSectionParsed = selClassId.includes('::') ? selClassId.split('::')[1] : selSection

  const selClass = allClasses.find(c => c.id === selClassIdParsed)
  // 달력 표시용 수업일: 선택된 수업이 있으면 그 수업일만, 없으면 필터된 전체 수업일 합산
  const sessionDates = selClass
    ? calcSessionDates(selClass)
    : [...new Set(schoolClasses.flatMap(c => calcSessionDates(c)))].sort()

  // 달력 점 전용: 연도만 적용 (요일 필터 무관 — 달력은 항상 전체 수업일 표시)
  const calendarDates = selClass
    ? calcSessionDates(selClass)
    : [...new Set(
        allClasses
          .filter(c =>
            (!selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
          )
          .flatMap(c => calcSessionDates(c))
      )].sort()
  // 수업 선택 시 해당 수업의 반 목록 (같은 학교+수업명 내 section 목록)
  // 같은 학교+수업명 내 반 목록 (section 기준)
  const sectionClasses = selClassIdParsed
    ? schoolClasses.filter(c => c.className === selClass?.className && c.organization === selClass?.organization)
    : []
  const sections = [...new Set([
    // 현재방식: 선택한 수업카드의 sections 배열에서 반 목록
    ...(selClass?.sections?.filter(s => s.section).map(s => s.section) || []),
    // 예전방식: 같은 학교+수업명의 별도 수업카드들의 section
    ...sectionClasses.flatMap(c =>
      c.sections?.length > 0
        ? c.sections.map(s => s.section).filter(Boolean)
        : c.section ? [c.section] : []
    ),
  ])].sort()

  // 정렬: Students.jsx 와 동일하게 학교→수업→반→학년→학급반→번호→이름
  const sortStudents = (arr) => [...arr].sort((a, b) => {
    const DAY_ORDER = ['월','화','수','목','금','토','일']
    const aClass = allClasses.find(c => c.id === a.classIds?.[0])
    const bClass = allClasses.find(c => c.id === b.classIds?.[0])
    const aOrg = (a.classIds?.length ? allClasses.find(c => c.id === a.classIds[0])?.organization : null) || a.school || ''
    const bOrg = (b.classIds?.length ? allClasses.find(c => c.id === b.classIds[0])?.organization : null) || b.school || ''
    const schoolCmp = aOrg.localeCompare(bOrg,'ko')
    if (schoolCmp !== 0) return schoolCmp
    const aDay = DAY_ORDER.indexOf(aClass?.days?.[0] ?? '')
    const bDay = DAY_ORDER.indexOf(bClass?.days?.[0] ?? '')
    const dayCmp = (aDay === -1 ? 99 : aDay) - (bDay === -1 ? 99 : bDay)
    if (dayCmp !== 0) return dayCmp
    const classCmp = (aClass?.className||'').localeCompare(bClass?.className||'','ko')
    if (classCmp !== 0) return classCmp
    const sectionCmp = (aClass?.section||'').localeCompare(bClass?.section||'','ko')
    if (sectionCmp !== 0) return sectionCmp
    const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
    if (gradeCmp !== 0) return gradeCmp
    const classNumCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
    if (classNumCmp !== 0) return classNumCmp
    const numCmp = parseInt(a.number||'0') - parseInt(b.number||'0')
    if (numCmp !== 0) return numCmp
    return (a.name||'').localeCompare(b.name||'','ko')
  })

  // ★ 핵심: 모드에 따라 필터 적용 분리
  // - 수업 검색 모드: 년도 + 기간 + 학교 + 수업 + 반 + 요일 모두 적용
  // - 요일 검색 모드: 년도 + 요일만 적용 (학교/기간 필터 완전 무시)
  const students = sortStudents(allStudents.filter(s => {
    const hasClassIds = s.classIds?.length > 0
    // 년도 필터 (공통)
    if (selYear) {
      const yearCls = allClasses.filter(c => c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
      const inYear = hasClassIds
        ? yearCls.some(c => s.classIds.includes(c.id))
        : yearCls.some(c => c.organization === s.school)
      if (!inYear) return false
    }
    if (activeMode === 'class') {
      // 기간 필터
      if (selTerm) {
        const termCls = allClasses.filter(c => termInRange(c))
        const inTerm = hasClassIds
          ? termCls.some(c => s.classIds.includes(c.id))
          : termCls.some(c => c.organization === s.school)
        if (!inTerm) return false
      }
      // 학교 필터
      if (selSchool) {
        const actualSchool = hasClassIds
          ? (s.classIds.map(cid => allClasses.find(c => c.id === cid)?.organization).filter(Boolean)[0] || s.school || '')
          : s.school || ''
        if (actualSchool !== selSchool) return false
      }
      // 수업 필터
      if (selClassIdParsed) {
        const inClass = hasClassIds
          ? s.classIds.includes(selClassIdParsed)
          : selClass?.organization === s.school
        if (!inClass) return false
      }
      // 반 필터: selSectionParsed = 수업드롭다운 '::' 파싱값 또는 별도 반 드롭다운값
      if (selSectionParsed) {
        // 현재방식: 학생에 section 필드가 있으면 그걸로 비교
        if (s.section) {
          if (s.section !== selSectionParsed) return false
        } else {
          // 예전방식: 수업카드 자체의 section으로 비교
          const sectionCls = sectionClasses.find(c => c.section === selSectionParsed)
          if (sectionCls) {
            const inSection = s.classIds?.includes(sectionCls.id) ||
              (!s.classIds?.length && selClass?.organization === s.school)
            if (!inSection) return false
          }
        }
      }
    } else {
      // 요일 검색 모드: 요일 필터만 (학교/기간 무시)
      if (selDay) {
        const inDay = hasClassIds
          ? s.classIds.some(cid => (allClasses.find(c => c.id === cid)?.days || []).includes(selDay))
          : false
        if (!inDay) return false
      }
    }
    return true
  }))

  const handleSchoolChange = (school) => {
    setSelSchool(school)
    setSelClassId('')
    setDateClicked(false)
  }

  const handleSelectDate = (date) => {
    setSelDate(date)
    setDateClicked(true)
    const d = new Date(date+'T00:00:00')
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())

    // 해당 날짜의 수업 찾기 (같은 날짜 A/B반 모두 포함)
    const matched = allClasses.filter(c => calcSessionDates(c).includes(date))
    if (matched.length > 0) {
      const rep = matched[0]
      const year = rep.startDate?.slice(0,4) || String(d.getFullYear())
      setSelYear(year)
      setSelSchool(rep.organization || '')
      setSelClassId(matched.length === 1 ? matched[0].id : '')      // 수업 1개면 자동 선택, 여러개면 전체 표시
      setSelSection('')

      // 기간(분기/학기) 자동 세팅
      const month = d.getMonth() + 1
      if (rep.termType === 'quarter') {
        if (month <= 3)       setSelTerm('q1')
        else if (month <= 6)  setSelTerm('q2')
        else if (month <= 9)  setSelTerm('q3')
        else                  setSelTerm('q4')
      } else {
        setSelTerm(month >= 3 && month <= 8 ? 's1' : 's2')
      }
    }
  }

  const prevMonth = () => { if (calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1) }
  const goToday   = () => { const d=new Date(); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setSelDate(today) }

  // 별도 창(ProgressWindow)에서 진도체크 시 메인 창 강제 갱신
  useEffect(() => {
    const ch = new BroadcastChannel('progress_screen')
    ch.onmessage = (e) => {
      if (e.data?.type === 'refresh' && e.data?.source !== 'main') { /* 각 패널 자체 리스너가 처리 */ }
    }
    return () => ch.close()
  }, [])

  const isSessionDate = sessionDates.includes(selDate)  // 달력에서 수업일 클릭 시에만 출석체크 패널
  const isPast = selDate <= today
  const monthSessions = sessionDates.filter(d => d.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`))

  return (
    <div style={{ padding:'24px', maxWidth:'1400px', width:'100%', display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ fontSize:'22px', fontWeight:700, color:C.text }}>출석부</div>

      {/* 필터 카드 — 두 검색 모드 */}
      <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>

        {/* ── 모드 A: 수업 검색 (달력과 세트) ── */}
        <div style={{
          padding:'14px 20px',
          borderLeft: activeMode === 'class' ? `4px solid ${C.primary}` : '4px solid transparent',
          background: activeMode === 'class' ? 'linear-gradient(90deg,#fff7ed 0%,#fff 60%)' : '#fafafa',
          transition:'all .2s',
        }}>
          {/* 모드 레이블 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
            <button onClick={() => { setActiveMode('class'); setSelDay(''); setDateClicked(false) }}
              style={{
                width:'20px', height:'20px', borderRadius:'50%', border:'none', cursor:'pointer',
                background: activeMode === 'class' ? C.primary : '#e5e7eb',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'11px', fontWeight:700, color:'#fff',
                boxShadow: activeMode === 'class' ? `0 0 0 3px #fed7aa` : 'none',
                transition:'all .2s', padding:0,
              }}>✓</button>
            <span style={{ fontSize:'12px', fontWeight:700, color: activeMode === 'class' ? C.primary : '#9ca3af', cursor:'pointer' }}
              onClick={() => { setActiveMode('class'); setSelDay(''); setDateClicked(false) }}>
              수업 검색
            </span>
            <span style={{ fontSize:'11px', color: activeMode === 'class' ? '#92400e' : '#d1d5db', background: activeMode === 'class' ? '#fff7ed' : 'transparent', padding:'1px 8px', borderRadius:'10px', border: activeMode === 'class' ? '1px solid #fde68a' : '1px solid transparent' }}>
              📅 달력과 함께 사용
            </span>
            <div style={{ marginLeft:'auto', fontSize:'14px', fontWeight:700, color:C.primary }}>
              👥 {students.filter(s => ['applied','selected','confirmed'].includes(s.status)).length}명
            </div>
          </div>
          {/* 필터 드롭다운 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr 1fr 1fr', gap:'10px', alignItems:'end', opacity: activeMode === 'day' ? 0.45 : 1, transition:'opacity .2s', pointerEvents: activeMode === 'day' ? 'none' : 'auto' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>년도</label>
              <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelClassId(''); setSelSection(''); setSelTerm(''); setActiveMode('class'); setSelDay('') }} style={{ ...selSt, width:'100%' }}>
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>학교</label>
              <select value={selSchool} onChange={e => { handleSchoolChange(e.target.value); setActiveMode('class'); setSelDay('') }} style={{ ...selSt, width:'100%' }}>
                <option value="">전체 학교</option>
                {(() => {
                  const DAY_ORDER = ['월','화','수','목','금','토','일']
                  const filteredCls = allClasses.filter(c => !selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
                  const schoolDaysMap = {}
                  filteredCls.forEach(c => {
                    if (!c.organization) return
                    if (!schoolDaysMap[c.organization]) schoolDaysMap[c.organization] = new Set()
                    ;(c.days || []).forEach(d => schoolDaysMap[c.organization].add(d))
                  })
                  const getDayLabel = (s) => {
                    const days = DAY_ORDER.filter(d => (schoolDaysMap[s] || new Set()).has(d))
                    return days.length > 0 ? `(${days.join(',')}) ` : ''
                  }
                  return [...new Set(filteredCls.map(c => c.organization).filter(Boolean))].map(s => (
                    <option key={s} value={s}>{getDayLabel(s)}{s}</option>
                  ))
                })()}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>수업</label>
              <select value={selClassId} onChange={e => { setSelClassId(e.target.value); setSelSection(''); setSelTerm(''); setDateClicked(false); setActiveMode('class'); setSelDay('') }} style={{ ...selSt, width:'100%' }}>
                <option value="">전체 수업</option>
                {[...schoolClasses].sort((a, b) => {
                  const DAY_ORDER = ['월','화','수','목','금','토','일']
                  const aDay = DAY_ORDER.indexOf(a.days?.[0] ?? '')
                  const bDay = DAY_ORDER.indexOf(b.days?.[0] ?? '')
                  if (aDay !== bDay) return aDay - bDay
                  return (a.section||'').localeCompare(b.section||'', 'ko')
                }).flatMap(c => {
                  // sections 배열에 반이 2개 이상이면 반별로 분리 옵션 (Students.jsx 동일 방식)
                  const secs = c.sections?.filter(s => s.section) || []
                  if (secs.length > 1) {
                    return secs.map(s => (
                      <option key={c.id + '::' + s.section} value={c.id + '::' + s.section}>
                        {c.className} {s.section}반
                      </option>
                    ))
                  }
                  const secLabel = (c.section ? c.section + '반' : '')
                  return [<option key={c.id} value={c.id}>{c.className}{secLabel ? ' ' + secLabel : ''}</option>]
                })}
              </select>
            </div>
            {/* 반 드롭다운: 수업 드롭다운에서 이미 반을 선택한 경우(::) 숨김, 단일 반 수업카드는 표시 */}
            {!selClassId.includes('::') && sections.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>반</label>
                <select value={selSection} onChange={e => setSelSection(e.target.value)} style={{ ...selSt, width:'100%' }}>
                  <option value="">전체 반</option>
                  {sections.map(s => <option key={s} value={s}>{s}반</option>)}
                </select>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>기간</label>
              <select value={selTerm} onChange={e => setSelTerm(e.target.value)} style={{ ...selSt, width:'100%' }}>
                <option value="">전체 기간</option>
                {(!selClass || selClass.termType === 'quarter') && (
                  <optgroup label="── 분기제 ──">
                    <option value="q1">1분기 (1~3월)</option>
                    <option value="q2">2분기 (4~6월)</option>
                    <option value="q3">3분기 (7~9월)</option>
                    <option value="q4">4분기 (10~12월)</option>
                  </optgroup>
                )}
                {(!selClass || selClass.termType !== 'quarter') && (
                  <optgroup label="── 학기제 ──">
                    <option value="s1">1학기 (3~8월)</option>
                    <option value="s2">2학기 (9~2월)</option>
                  </optgroup>
                )}
              </select>
            </div>
          </div>
          {selClass && <div style={{ marginTop:'6px', fontSize:'11px', color:C.muted }}>📅 {selClass.startDate?.slice(5)} ~ {selClass.endDate?.slice(5)} · {sessionDates.length}차시</div>}
        </div>

        {/* 구분선 */}
        <div style={{ height:'1px', background: activeMode === 'day' ? `linear-gradient(90deg,${C.primary}40,#e5e7eb)` : '#e5e7eb' }} />

        {/* ── 모드 B: 요일 검색 ── */}
        <div style={{
          padding:'12px 20px',
          borderLeft: activeMode === 'day' ? `4px solid ${C.primary}` : '4px solid transparent',
          background: activeMode === 'day' ? 'linear-gradient(90deg,#fff7ed 0%,#fff 60%)' : '#fff',
          transition:'all .2s',
        }}>
          {/* 모드 레이블 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
            <button onClick={() => { setActiveMode('day'); setSelClassId(''); setSelSection(''); setDateClicked(false) }}
              style={{
                width:'20px', height:'20px', borderRadius:'50%', border:'none', cursor:'pointer',
                background: activeMode === 'day' ? C.primary : '#e5e7eb',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'11px', fontWeight:700, color:'#fff',
                boxShadow: activeMode === 'day' ? `0 0 0 3px #fed7aa` : 'none',
                transition:'all .2s', padding:0,
              }}>✓</button>
            <span style={{ fontSize:'12px', fontWeight:700, color: activeMode === 'day' ? C.primary : '#9ca3af', cursor:'pointer' }}
              onClick={() => { setActiveMode('day'); setSelClassId(''); setSelSection(''); setDateClicked(false) }}>
              요일 검색
            </span>
            {activeMode === 'day' && selDay && (
              <span style={{ fontSize:'11px', color:'#92400e', background:'#fff7ed', padding:'1px 8px', borderRadius:'10px', border:'1px solid #fde68a' }}>
                {selDay}요일 선택됨
              </span>
            )}
            {activeMode === 'day' && selDay && (
              <button onClick={() => setSelDay('')}
                style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                ✕ 초기화
              </button>
            )}
          </div>
          {/* 요일 버튼들 — 학교 필터와 완전 독립, 년도만 반영 */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
            {['월','화','수','목','금','토','일'].map(day => {
              // 요일 카운트: 학교/기간 필터 완전 무시, 년도만 적용
              const dayCount = allClasses.filter(c =>
                (c.days||[]).includes(day) &&
                (!selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
              ).length
              const isActive = activeMode === 'day' && selDay === day
              return (
                <button key={day} onClick={() => {
                  setActiveMode('day')
                  setSelDay(selDay === day ? '' : day)
                  setSelClassId('')
                  setSelSection('')
                  setDateClicked(false)
                }}
                  style={{
                    padding:'6px 14px', borderRadius:'20px', cursor:'pointer', transition:'all .15s',
                    border: isActive ? `2px solid ${C.primary}` : dayCount>0 ? `1.5px solid #e5e7eb` : '1.5px solid #f3f4f6',
                    background: isActive ? C.primary : dayCount>0 ? '#fff' : '#fafafa',
                    color: isActive ? '#fff' : dayCount>0 ? C.text : '#d1d5db',
                    fontSize:'13px', fontWeight: isActive ? 700 : 500,
                    fontFamily:'Noto Sans KR, sans-serif',
                    opacity: dayCount===0 ? 0.4 : 1,
                    boxShadow: isActive ? `0 2px 8px ${C.primary}40` : 'none',
                  }}>
                  {isActive ? '✓ ' : ''}{day}{dayCount > 0 ? ` (${dayCount})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 항상 달력 + 패널 레이아웃 */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'20px', alignItems:'start' }}>
        {/* 달력 */}
        <div style={{ background:C.card, borderRadius:'16px', border:`1px solid ${C.border}`, padding:'20px', position:'sticky', top:'24px', zIndex:10 }}>
          <AttCalendar year={calYear} month={calMonth} selectedDate={selDate} sessionDates={calendarDates}
            onSelect={handleSelectDate} onPrevMonth={prevMonth} onNextMonth={nextMonth} onToday={goToday} />
          {selClassId && monthSessions.length > 0 && (
            <div style={{ marginTop:'14px', padding:'12px 14px', background:'#fff7ed', borderRadius:'10px' }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:'#92400e', marginBottom:'6px' }}>이달 수업 {monthSessions.length}회</div>
              {monthSessions.slice(0,8).map(d => {
                const recs = AttendanceDB.byClassDate(selClassIdParsed, d)
                const done = recs.filter(r => r.status !== 'pending').length
                const isPast_ = d <= today
                return (
                  <div key={d} onClick={() => handleSelectDate(d)}
                    style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px', cursor:'pointer', padding:'3px 5px', borderRadius:'5px', background:selDate===d?'#fff7ed':'transparent', border:selDate===d?'1px solid #fed7aa':'1px solid transparent' }}>
                    <span style={{ color:'#374151' }}>{d.slice(5)} ({DAYS_KO[new Date(d+'T00:00:00').getDay()]})</span>
                    <span style={{ color:isPast_?(done>0?'#16a34a':C.muted):C.primary, fontWeight:600 }}>{isPast_?(done>0?`${done}명`:'미처리'):'예정'}</span>
                  </div>
                )
              })}
            </div>
          )}
          <LessonMemoPanelWrapper cls={selClass||null} date={selDate} classId={selClassId} selSection={selSectionParsed} filteredStudents={students} key={selDate+selClassId} onProgClose={() => setRightPanelTick(t => t+1)} />
        </div>

        {/* 오른쪽 패널 */}
        <div style={{ minWidth:0, overflowX:'auto' }}>
          {/* 요일 모드: 요일 선택 시 학생 목록 표시 */}
          {activeMode === 'day' && selDay && !dateClicked ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {/* 수업 요약 카드 */}
              <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#fff7ed 0%,#fff 100%)', borderRadius:'14px', border:'1.5px solid #fed7aa' }}>
                <div style={{ fontSize:'18px', fontWeight:700, color:C.text, marginBottom:'12px' }}>{selDay}요일 수업 {schoolClasses.length}개</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {schoolClasses.map(cls => {
                    const cnt = allStudents.filter(s => s.classIds?.includes(cls.id) && ['applied','selected','confirmed'].includes(s.status)).length
                    return (
                      <div key={cls.id} style={{ padding:'10px 16px', borderRadius:'10px', background:'#fff', border:`1.5px solid ${C.border}`, minWidth:'160px' }}>
                        <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{cls.className}{((cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : ''))) ? ' '+(cls.sections?.filter(s=>s.section).map(s=>s.section+'반').join('·') || (cls.section ? cls.section+'반' : '')) : ''}</div>
                        <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>🏫 {cls.organization}</div>
                        <div style={{ fontSize:'13px', fontWeight:700, color:C.primary, marginTop:'4px' }}>👥 {cnt}명</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 수업별 학생 목록 — ClassAttendanceSection 재활용 */}
              {schoolClasses.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
                  <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>{selDay}요일 수업이 없습니다</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {schoolClasses.map(cls => {
                    const clsStudents = allStudents.filter(s => s.classIds?.includes(cls.id) && ['applied','selected','confirmed','cancelled','waiting','cancel_after','cancel_before'].includes(s.status))
                    return <UnifiedPanel key={cls.id + selDate + rightPanelTick} cls={cls} date={selDate} students={clsStudents} user={user} allClasses={allClasses} />
                  })}
                </div>
              )}
            </div>
          ) : selClassId ? (
            (!isSessionDate && dateClicked) ? (
              <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>🗓️</div>
                <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>수업이 없는 날입니다</div>
                <div style={{ fontSize:'13px', marginTop:'6px' }}>달력에서 수업일(점 표시)을 선택하세요</div>
              </div>
            ) : (
              <UnifiedPanel cls={selClass||null} date={selDate} students={students} user={user} allClasses={allClasses} key={selDate+selClassId+rightPanelTick} />
            )
          ) : (
            <DayAttendancePanel date={selDate} allClasses={allClasses} allStudents={allStudents} schoolClasses={schoolClasses} user={user} key={selDate} />
          )}
        </div>
      </div>
    </div>
  )
}

const selSt = { padding:'8px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', color:'#111827', cursor:'pointer', outline:'none', minWidth:'180px' }
