import React, { useState, useEffect, useRef } from 'react'
import {
  Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB,
  Notes, SupplyItems, SupplyProducts, SupplyStudentProgress, SupplySessionChecks,
  RevenueFees, RevenuePayments,
  Trainings, Careers, Educations, Certificates, Awards,
  Settings,
} from '../lib/db.js'
import { calcSessionDates, sortClasses, uid, now, getSessionInfo } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatDateKo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()%100}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${DAYS_KO[d.getDay()]}요일`
}
function weatherIcon(code) {
  if (code === 0)  return { icon: '☀️', text: '맑음' }
  if (code <= 2)   return { icon: '🌤️', text: '구름 조금' }
  if (code <= 3)   return { icon: '☁️', text: '흐림' }
  if (code <= 49)  return { icon: '🌫️', text: '안개' }
  if (code <= 59)  return { icon: '🌦️', text: '이슬비' }
  if (code <= 69)  return { icon: '🌧️', text: '비' }
  if (code <= 79)  return { icon: '❄️', text: '눈' }
  if (code <= 82)  return { icon: '🌧️', text: '소나기' }
  return { icon: '⛈️', text: '뇌우' }
}
function useWeather() {
  const [w, setW] = useState(null)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.39&longitude=126.95&current=temperature_2m,weathercode,windspeed_10m&timezone=Asia%2FSeoul')
      .then(r => r.json())
      .then(d => setW({ temp: Math.round(d.current.temperature_2m), code: d.current.weathercode, wind: Math.round(d.current.windspeed_10m) }))
      .catch(() => setW(null))
  }, [])
  return w
}
function smBtn(bg, color) {
  return { padding: '3px 8px', borderRadius: '5px', border: 'none', background: bg, color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
}

// ═══════════════════════════════════════════════════════════════════
//  CARD ON/OFF 시스템
//  Settings.get/set 사용 → localStorage + Supabase 자동 싱크
//  저장 키: dashboardCards_${userId}
// ═══════════════════════════════════════════════════════════════════

export const DASHBOARD_CARDS = [
  { id: 'calendar',     label: '달력 & 출석부',  icon: '📅', desc: '수업 달력 및 날짜별 출결 현황',  navKey: 'classes'      },
  { id: 'supply',       label: '교구 관리',       icon: '🎒', desc: '이번 주 교구 준비 알림',         navKey: 'supply'       },
  { id: 'revenue',      label: '수익 관리',       icon: '💰', desc: '진행 중인 텀의 수납 현황',       navKey: 'revenue'      },
  { id: 'training',     label: '연수 관리',       icon: '📚', desc: '이수 필요 연수 알림',            navKey: 'training'     },
  { id: 'certificate',  label: '자격증 관리',     icon: '🏆', desc: '최근 자격증 목록',              navKey: 'certificate'  },
  { id: 'career',       label: '학력 및 이력',    icon: '📋', desc: '최근 학력·경력 이력',           navKey: 'career'       },
  { id: 'award',        label: '수상 경력',       icon: '🥇', desc: '최근 수상 내역',                navKey: 'award'        },
  { id: 'announcement', label: '공고 관리',       icon: '📢', desc: '실시간 채용·모집 공고',         navKey: 'announcement' },
]

const DEFAULT_CARDS = Object.fromEntries(DASHBOARD_CARDS.map(c => [c.id, true]))

function useCardSettings(userId) {
  const sKey = `dashboardCards_${userId}`
  const load = () => ({ ...DEFAULT_CARDS, ...(Settings.get(sKey) || {}) })
  const [settings, setSettings] = useState(load)

  const save = (next) => {
    Settings.set(sKey, next)  // localStorage + Supabase 자동 싱크
    setSettings(next)
  }

  return {
    settings,
    hideCard:   (id)    => save({ ...settings, [id]: false }),
    toggleCard: (id, v) => save({ ...settings, [id]: v }),
    resetAll:   ()      => save({ ...DEFAULT_CARDS }),
  }
}

// 드래그 순서 기본값 (수익관리 오른쪽에 공고관리)
const DRAGGABLE_ORDER_DEFAULT = ['revenue', 'announcement', 'training', 'certificate', 'career', 'award']

function useCardOrder(userId) {
  const sKey = `dashboardCardOrder_${userId}`
  const load = () => {
    const saved = Settings.get(sKey)
    if (Array.isArray(saved) && saved.length === DRAGGABLE_ORDER_DEFAULT.length) return saved
    return [...DRAGGABLE_ORDER_DEFAULT]
  }
  const [cardOrder, setCardOrder] = useState(load)
  const saveCardOrder = (next) => {
    Settings.set(sKey, next)
    setCardOrder(next)
  }
  return { cardOrder, saveCardOrder }
}

// ─────────────────────────────────────────────────────────────────
//  내정보 페이지에서 사용하는 컴포넌트
//  import { DashboardCardSettings } from './Dashboard'
//  <DashboardCardSettings userId={user.id} />
// ─────────────────────────────────────────────────────────────────
export function DashboardCardSettings({ userId, settings: extSettings, onToggle, onResetAll }) {
  const own      = useCardSettings(userId)
  const settings   = extSettings  ?? own.settings
  const toggleCard = onToggle     ?? own.toggleCard
  const resetAll   = onResetAll   ?? own.resetAll

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>대시보드 카드 설정</div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>
            대시보드에서 ✕로 숨긴 카드를 여기서 다시 켤 수 있어요.
          </div>
        </div>
        <button
          onClick={resetAll}
          style={{ fontSize: '12px', color: C.muted, background: 'none', border: `1px solid ${C.border}`, borderRadius: '7px', padding: '4px 12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap', marginLeft: '12px' }}
        >전체 켜기</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {DASHBOARD_CARDS.map(card => {
          const on = settings[card.id]
          return (
            <div
              key={card.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: on ? '#fff' : '#f9fafb', borderRadius: '10px', border: `1px solid ${C.border}`, gap: '12px', transition: 'all .15s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, opacity: on ? 1 : 0.45 }}>
                <span style={{ fontSize: '20px' }}>{card.icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{card.label}</div>
                  <div style={{ fontSize: '11px', color: C.muted }}>{card.desc}</div>
                </div>
              </div>
              <button
                onClick={() => toggleCard(card.id, !on)}
                style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: on ? C.primary : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
                aria-label={on ? '끄기' : '켜기'}
              >
                <span style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', left: on ? '22px' : '2px', transition: 'left .2s', display: 'block' }} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  요약 카드 공통 wrapper
// ═══════════════════════════════════════════════════════════════════

function SummaryCard({ id, icon, label, navKey, onHide, onNav, children }) {
  return (
    <div style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
      <div
        onClick={() => navKey && onNav(navKey)}
        style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: navKey ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{label}</span>
          {navKey && <span style={{ fontSize: '11px', color: C.primary, fontWeight: 600 }}>바로가기 →</span>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onHide(id) }}
          title="카드 숨기기 (내정보 또는 ⚙️에서 다시 켤 수 있어요)"
          style={{ width: '22px', height: '22px', borderRadius: '50%', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '12px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >✕</button>
      </div>
      <div style={{ padding: '12px 16px', flex: 1 }}>{children}</div>
    </div>
  )
}

function Empty({ msg = '데이터가 없습니다' }) {
  return <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>{msg}</div>
}

function ListRow({ left, sub, badge, badgeColor = '#1d4ed8', badgeBg = '#eff6ff', badgeBorder = '#bfdbfe' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f9fafb', borderRadius: '8px', border: `1px solid ${C.border}`, gap: '8px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</div>
        {sub && <div style={{ fontSize: '11px', color: C.muted, marginTop: '1px' }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{ fontSize: '11px', fontWeight: 700, color: badgeColor, background: badgeBg, border: `1px solid ${badgeBorder}`, borderRadius: '5px', padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  개별 요약 카드
// ═══════════════════════════════════════════════════════════════════

// ── 💰 수익 관리
// 텀별 그룹 → 요일 · 학교명 · 금액 · 상태(미수/마감/진행중/예정)
function RevenueCard({ user, onHide, onNav }) {
  const today    = todayStr()
  const classes  = ClassesDB.byTeacher(user.id)
  const fees     = RevenueFees.byTeacher(user.id)
  const payments = RevenuePayments.byTeacher(user.id)

  // 텀별 맵 구성
  const termMap = new Map()  // termNum → [{...}]

  classes.forEach(cls => {
    const allSessions = calcSessionDates(cls)
    if (!allSessions.length) return
    const confirmed = StudentsDB.confirmed(cls.id)
    if (!confirmed.length) return

    const fee       = fees.find(f => f.classId === cls.id)
    const classPmts = payments.filter(p => p.classId === cls.id)
    const paidSids  = new Set(classPmts.map(p => p.studentId))
    const unpaidCount = confirmed.filter(s => !paidSids.has(s.id)).length

    // 요일 레이블 (cls.day 숫자 또는 cls.days 배열 첫번째)
    const dayIdx   = cls.day ?? cls.days?.[0] ?? null
    const dayLabel = dayIdx != null ? DAYS_KO[dayIdx] : ''

    // 이 수업이 속한 텀들 추출
    const seenTerms = new Set()
    allSessions.forEach(date => {
      const info = getSessionInfo(cls, date)
      if (!info || seenTerms.has(info.termNum)) return
      seenTerms.add(info.termNum)

      // 해당 텀의 세션만 필터
      const termSessions  = allSessions.filter(d => getSessionInfo(cls, d)?.termNum === info.termNum)
      const pastSessions  = termSessions.filter(d => d < today)
      const futureSessions = termSessions.filter(d => d >= today)

      // 행 상태 결정
      let rowStatus
      if (futureSessions.length === 0)     rowStatus = unpaidCount > 0 ? 'unpaid' : 'closed'  // 완료텀
      else if (pastSessions.length === 0)  rowStatus = 'upcoming'   // 아직 시작 전
      else                                 rowStatus = 'active'     // 진행중

      if (!termMap.has(info.termNum)) termMap.set(info.termNum, [])
      termMap.get(info.termNum).push({
        key: `${cls.id}-${info.termNum}`,
        cls, dayLabel, rowStatus,
        feeAmount: fee?.amount ?? null,
        unpaidCount,
        totalCount: confirmed.length,
      })
    })
  })

  const sortedTerms = [...termMap.entries()].sort((a, b) => a[0] - b[0])

  const DAY_COLOR = (d) => d === '일' ? '#ef4444' : d === '토' ? '#3b82f6' : C.muted

  const ROW_STYLE = {
    unpaid:   { label: '미수',  color: C.danger,   bg: '#fef2f2', border: '#fca5a5' },
    closed:   { label: '마감',  color: C.success,  bg: '#f0fdf4', border: '#86efac' },
    active:   { label: '진행중', color: C.success,  bg: '#f0fdf4', border: '#86efac' },
    upcoming: { label: '예정',  color: '#2563eb',  bg: '#eff6ff', border: '#bfdbfe' },
  }

  return (
    <SummaryCard id="revenue" icon="💰" label="수익 관리" navKey="revenue" onHide={onHide} onNav={onNav}>
      {sortedTerms.length === 0
        ? <Empty msg="등록된 수업이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sortedTerms.map(([termNum, rows]) => {
              const hasActive   = rows.some(r => r.rowStatus === 'active')
              const hasUpcoming = rows.some(r => r.rowStatus === 'upcoming')
              const termBadge   = hasActive ? '진행중' : hasUpcoming ? '예정' : null
              const termBadgeColor = hasActive ? C.success : '#2563eb'

              return (
                <div key={termNum}>
                  {/* 텀 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{termNum}텀</span>
                    <span style={{ fontSize: '12px', color: C.muted }}>→</span>
                    {termBadge && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: termBadgeColor, background: `${termBadgeColor}18`, border: `1px solid ${termBadgeColor}44`, borderRadius: '5px', padding: '1px 8px' }}>
                        {termBadge}
                      </span>
                    )}
                  </div>

                  {/* 수업 행들 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {rows.map(({ key, cls, dayLabel, rowStatus, feeAmount, unpaidCount }) => {
                      const st = ROW_STYLE[rowStatus]
                      const amtText = feeAmount != null ? feeAmount.toLocaleString() + '원' : '-'
                      const isDone  = rowStatus === 'unpaid' || rowStatus === 'closed'

                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: '#f9fafb', borderRadius: '8px', border: `1px solid ${C.border}` }}>
                          {/* 요일 */}
                          {dayLabel && (
                            <span style={{ fontSize: '12px', fontWeight: 700, color: DAY_COLOR(dayLabel), minWidth: '16px', flexShrink: 0 }}>{dayLabel}</span>
                          )}
                          {/* 학교명 */}
                          <span style={{ fontSize: '13px', fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cls.organization}
                          </span>
                          {/* 금액 + 상태 */}
                          <span style={{ fontSize: '11px', fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.border}`, borderRadius: '5px', padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {isDone ? `${amtText} ${st.label}` : amtText}
                          </span>
                          {/* 진행중/예정 뱃지 (완료 텀은 표시 안 함) */}
                          {!isDone && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {st.label}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 📚 연수 관리
// Trainings 테이블 — 이수 필요 목록 + 26년도 완료 연수 5개
function TrainingCard({ user, onHide, onNav }) {
  const all     = Trainings.byTeacher(user.id)
  const pending = all
    .filter(t => !t.completedAt && t.status !== 'done')
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))

  const done2026 = all
    .filter(t => (t.completedAt && t.completedAt.startsWith('2026')) || (t.status === 'done' && t.completedAt?.startsWith('2026')))
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="training" icon="📚" label="연수 관리" navKey="training" onHide={onHide} onNav={onNav}>
      {all.length === 0
        ? <Empty msg="등록된 연수가 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* 이수 필요 */}
            {pending.length === 0
              ? <div style={{ fontSize: '13px', color: C.success, textAlign: 'center', padding: '8px 0' }}>✅ 이수해야 할 연수가 없습니다</div>
              : pending.slice(0, 5).map((t, i) => (
                <ListRow
                  key={t.id || i}
                  left={t.title || t.name}
                  sub={[t.organization, t.deadline ? `마감 ${t.deadline}` : ''].filter(Boolean).join(' · ')}
                  badge="이수 필요"
                  badgeColor={C.primary}
                  badgeBg="#fff7ed"
                  badgeBorder="#fed7aa"
                />
              ))
            }
            {pending.length > 5 && <div style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>외 {pending.length - 5}건 더 있어요</div>}

            {/* 26년도 완료 연수 */}
            {done2026.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, marginTop: '6px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                  2026년 완료 연수
                </div>
                {done2026.map((t, i) => (
                  <ListRow
                    key={t.id || i}
                    left={t.title || t.name}
                    sub={[t.organization, t.completedAt ? `완료 ${t.completedAt}` : ''].filter(Boolean).join(' · ')}
                    badge="완료"
                    badgeColor={C.success}
                    badgeBg="#f0fdf4"
                    badgeBorder="#86efac"
                  />
                ))}
              </>
            )}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 🏆 자격증 관리
// Certificates 테이블 — 취득일 역순 최근 5개
function CertificateCard({ user, onHide, onNav }) {
  const items = Certificates.byTeacher(user.id)
    .sort((a, b) => (b.date || b.issuedAt || '').localeCompare(a.date || a.issuedAt || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="certificate" icon="🏆" label="자격증 관리" navKey="certificate" onHide={onHide} onNav={onNav}>
      {items.length === 0
        ? <Empty msg="등록된 자격증이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((c, i) => (
              <ListRow
                key={c.id || i}
                left={c.name || c.title}
                sub={[c.issuer || c.organization, c.date || c.issuedAt].filter(Boolean).join(' · ')}
                badge="자격증"
                badgeColor="#1d4ed8"
                badgeBg="#eff6ff"
                badgeBorder="#bfdbfe"
              />
            ))}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 📋 학력 및 이력
// Careers + Educations 합쳐서 최근 5개
function CareerCard({ user, onHide, onNav }) {
  const items = [
    ...Careers.byTeacher(user.id).map(r    => ({ ...r, _type: '경력' })),
    ...Educations.byTeacher(user.id).map(r => ({ ...r, _type: '학력' })),
  ]
    .sort((a, b) => (b.startDate || b.date || '').localeCompare(a.startDate || a.date || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="career" icon="📋" label="학력 및 이력" navKey="career" onHide={onHide} onNav={onNav}>
      {items.length === 0
        ? <Empty msg="등록된 학력·이력이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((c, i) => {
              const period = c.startDate ? `${c.startDate} ~ ${c.endDate || '현재'}` : c.date || ''
              const title  = c.title || c.name || c.school || c.company || period
              const sub    = title === period
                ? (c.organization || c.company || c.school || '')
                : [c.organization || c.company || c.school, period].filter(Boolean).join(' · ')
              return (
                <ListRow
                  key={c.id || i}
                  left={title}
                  sub={sub}
                  badge={c._type}
                  badgeColor={c._type === '학력' ? '#1d4ed8' : '#15803d'}
                  badgeBg={c._type === '학력' ? '#eff6ff' : '#f0fdf4'}
                  badgeBorder={c._type === '학력' ? '#bfdbfe' : '#86efac'}
                />
              )
            })}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 🥇 수상 경력
// Awards 테이블 — 수상일 역순 최근 5개
function AwardCard({ user, onHide, onNav }) {
  const items = Awards.byTeacher(user.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="award" icon="🥇" label="수상 경력" navKey="award" onHide={onHide} onNav={onNav}>
      {items.length === 0
        ? <Empty msg="등록된 수상 경력이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((a, i) => (
              <ListRow
                key={a.id || i}
                left={a.title || a.name}
                sub={[a.organization || a.issuer, a.date].filter(Boolean).join(' · ')}
                badge="수상"
                badgeColor="#a16207"
                badgeBg="#fefce8"
                badgeBorder="#fde047"
              />
            ))}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 📢 공고 관리
// JobSubs(구독 설정)는 공고관리 페이지에서 관리, 여기선 바로가기만
function AnnouncementCard({ user, onHide, onNav }) {
  return (
    <SummaryCard id="announcement" icon="📢" label="공고 관리" navKey="announcement" onHide={onHide} onNav={onNav}>
      <div style={{ textAlign: 'center', padding: '14px 0' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📢</div>
        <div style={{ fontSize: '13px', color: C.muted }}>채용·모집 공고를 확인하세요</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>공고관리 페이지에서 실시간 목록을 볼 수 있어요</div>
        <button
          onClick={() => onNav('announcement')}
          style={{ marginTop: '12px', padding: '7px 18px', borderRadius: '8px', border: `1.5px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}
        >공고 보러 가기</button>
      </div>
    </SummaryCard>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  기존 컴포넌트 (변경 없음)
// ═══════════════════════════════════════════════════════════════════

function NoteItem({ note, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.content)
  const save = () => { onEdit(note.id, text); setEditing(false) }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
      <span style={{ fontSize: '14px', marginTop: '1px' }}>📌</span>
      {editing ? (
        <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
          <input value={text} onChange={e => setText(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            style={{ flex: 1, border: '1.5px solid #f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
          <button onClick={save} style={smBtn('#f97316','#fff')}>저장</button>
          <button onClick={() => setEditing(false)} style={smBtn('#e5e7eb','#374151')}>취소</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{note.content}</span>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={smBtn('#f3f4f6','#6b7280')}>편집</button>
            <button onClick={() => onDelete(note.id)} style={smBtn('#fef2f2','#ef4444')}>삭제</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MonthCalendar({ year, month, selectedDate, classDates, onSelectDate }) {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today       = todayStr()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAYS_KO.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, padding: '4px 0', color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = dateStr === today
          const isSel   = dateStr === selectedDate
          const hasCls  = classDates.has(dateStr)
          const isSun   = (firstDay + day - 1) % 7 === 0
          const isSat   = (firstDay + day - 1) % 7 === 6
          return (
            <button key={day} onClick={() => onSelectDate(dateStr)} style={{
              position: 'relative', padding: '6px 2px', border: 'none', borderRadius: '8px',
              background: isSel ? C.primary : isToday ? '#fff7ed' : 'transparent',
              color: isSel ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : C.text,
              fontWeight: isToday || isSel ? 700 : 400, fontSize: '13px', cursor: 'pointer', textAlign: 'center',
              outline: isToday && !isSel ? `2px solid ${C.primary}` : 'none', outlineOffset: '-2px',
              transition: 'all .15s', fontFamily: 'Noto Sans KR, sans-serif',
            }}>
              {day}
              {hasCls && <span style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: isSel ? '#fff' : C.primary, display: 'block' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayDetail({ date, user, classes, onNav }) {
  const [notes, setNotes]           = useState(() => Notes.byTeacherDate(user.id, date))
  const [newNote, setNewNote]       = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const inputRef = useRef()
  const { success } = useToast()

  const [spItems,  setSpItems]  = useState([])
  const [spProds,  setSpProds]  = useState([])
  const [spProg,   setSpProg]   = useState([])
  const [spChecks, setSpChecks] = useState([])

  useEffect(() => {
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
    try { setSpItems(SupplyItems.byTeacher(user.id)) }              catch {}
    try { setSpProds(SupplyProducts.byTeacher(user.id)) }          catch {}
    try { setSpProg(SupplyStudentProgress.byTeacher(user.id)) }    catch {}
    try { setSpChecks(SupplySessionChecks.byTeacher(user.id)) }    catch {}
  }, [date, user.id])

  const dayClasses = sortClasses(classes.filter(cls => calcSessionDates(cls).includes(date)))

  const addNote    = () => {
    if (!newNote.trim()) return
    Notes.insert({ id: uid(), teacherId: user.id, date, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
    success('등록이 완료되었습니다.')
  }
  const deleteNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(user.id, date)) }
  const editNote   = (id, content) => { Notes.update(id, { content }); setNotes(Notes.byTeacherDate(user.id, date)); success('수정이 완료되었습니다.') }

  const schools = {}
  dayClasses.forEach(cls => { if (!schools[cls.organization]) schools[cls.organization] = []; schools[cls.organization].push(cls) })
  Object.keys(schools).forEach(k => { schools[k] = sortClasses(schools[k]) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* 날짜 헤더 */}
      <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)', borderRadius: '14px', border: '1.5px solid #fed7aa' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>{formatDateKo(date)}</div>
        <div style={{ fontSize: '13px', marginTop: '4px', color: dayClasses.length ? C.primary : C.muted, fontWeight: dayClasses.length ? 600 : 400 }}>
          {dayClasses.length ? `수업 ${dayClasses.length}개` : '수업이 없는 날입니다'}
        </div>
      </div>

      {/* 학교별 수업 */}
      {Object.entries(schools).map(([school, schoolClasses]) => (
        <div key={school} style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', background: '#f9fafb', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏫</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{school}</span>
              <span style={{ fontSize: '12px', color: C.muted }}>수업 장소</span>
            </div>
            <a href={`https://map.naver.com/v5/search/${encodeURIComponent(school)}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '9px', background: '#f0fdf4', border: '1.5px solid #86efac', color: '#16a34a', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              🗺️ 네비게이션
            </a>
          </div>

          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schoolClasses.map(cls => {
              const students = StudentsDB.confirmed(cls.id).sort((a, b) => {
                const g = parseInt(a.grade||'0') - parseInt(b.grade||'0'); if (g !== 0) return g
                const c = parseInt(a.classNum||'0') - parseInt(b.classNum||'0'); if (c !== 0) return c
                const n = parseInt(a.number||'0') - parseInt(b.number||'0'); if (n !== 0) return n
                return (a.name||'').localeCompare(b.name||'', 'ko')
              })
              const attRecords = AttendanceDB.byClassDate(cls.id, date)
              const presentCnt = attRecords.filter(a => a.status === 'present' || a.status === 'late').length
              const doneCnt    = attRecords.filter(a => a.status !== 'pending').length
              const pendingCnt = students.length - doneCnt
              const sessInfo   = getSessionInfo(cls, date)
              const TERM_COLORS = [
                { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
                { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
                { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
                { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
              ]
              const tc        = sessInfo ? TERM_COLORS[(sessInfo.termNum-1) % TERM_COLORS.length] : null
              const startTime = cls.time || ''
              const endTime   = cls.timeEnd || ''

              return (
                <div key={cls.id} style={{ borderRadius: '10px', border: '1px solid #fed7aa', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fff7ed', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>수업 과목 · {cls.className}</span>
                        {cls.section && <span style={{ fontSize: '12px', background: C.primary, color: '#fff', borderRadius: '6px', padding: '1px 8px', fontWeight: 600 }}>{cls.section}반</span>}
                        {sessInfo && (
                          <>
                            <span style={{ fontSize: '11px', color: C.muted, background: '#f3f4f6', padding: '1px 7px', borderRadius: '5px' }}>{sessInfo.total}차시</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: tc?.text, background: tc?.bg, border: `1px solid ${tc?.border}`, padding: '1px 7px', borderRadius: '5px' }}>
                              {sessInfo.termNum}텀 {sessInfo.termSess}차시
                            </span>
                          </>
                        )}
                      </div>
                      {startTime && <div style={{ fontSize: '12px', color: C.muted }}>🕐 {startTime}{endTime ? ` ~ ${endTime}` : ''}</div>}
                      {(() => {
                        const supplyData = SupplyItems.byClass(cls.id)
                        if (!supplyData.length) return null
                        const set    = supplyData.filter(item => item.name)
                        const notSet = students.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
                        return (
                          <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {set.length > 0    && <span style={{ fontSize: '11px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '5px', padding: '1px 8px' }}>🎒 교구 {set.length}명 설정</span>}
                            {notSet.length > 0 && <span style={{ fontSize: '11px', background: '#fef2f2', color: C.danger, border: '1px solid #fca5a5', borderRadius: '5px', padding: '1px 8px' }}>⚠️ 미설정 {notSet.length}명</span>}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: doneCnt === students.length && students.length > 0 ? C.success : C.text }}>
                        {presentCnt}/{students.length}명 출석
                      </div>
                      {pendingCnt > 0 && <span style={{ fontSize: '11px', color: C.muted }}>미처리 {pendingCnt}명</span>}
                      <button onClick={() => onNav('attendance', { classId: cls.id, date })} style={{ ...smBtn(C.primary, '#fff'), padding: '5px 12px', fontSize: '12px', borderRadius: '7px' }}>
                        출석 체크
                      </button>
                    </div>
                  </div>

                  {(() => {
                    if (!students.length) return <div style={{ padding: '12px 14px', fontSize: '13px', color: C.muted }}>등록된 학생이 없습니다</div>
                    const S = {
                      present: { label: '출석', color: '#16a34a', bg: '#f0fdf4' },
                      late:    { label: '지각', color: '#d97706', bg: '#fffbeb' },
                      leave:   { label: '조퇴', color: '#7c3aed', bg: '#f5f3ff' },
                      absent:  { label: '결석', color: '#ef4444', bg: '#fef2f2' },
                      pending: { label: '예정', color: '#6b7280', bg: '#f9fafb' },
                    }
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                            {['순번','학년·반·번호','이름','학부모전화','출석·지각·조퇴·결석','진도','특이사항·메모'].map(h => (
                              <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((stu, idx) => {
                            const ar  = attRecords.find(a => a.studentId === stu.id)
                            const ac  = S[ar?.status || 'pending'] || S.pending
                            const si  = spItems.find(i => i.studentId === stu.id && i.classId === cls.id)
                            const sp  = si?.productId ? spProds.find(p => p.id === si.productId) : null
                            const sg  = si?.productId ? spProg.find(p => p.studentId === stu.id && p.productId === si.productId) : null
                            const st  = sg?.curStage || si?.stage || 1
                            const spp = sp?.sessionsPerStage || 12
                            const chk = si?.productId ? spChecks.filter(c => c.studentId === stu.id && c.productId === si.productId && c.stage === st).length : 0
                            const pct = si ? Math.min(Math.round(chk/spp*100), 100) : 0
                            const hb  = stu.remark || (stu.student_careers?.length > 0) || stu.status === 'cancel_before' || stu.status === 'cancel_after' || (stu.relations||[]).length > 0
                            return (
                              <tr key={stu.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx%2===0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                                  {stu.applyOrder ? <span style={{ fontWeight: 700, color: '#f97316' }}>{stu.applyOrder}</span> : idx+1}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>
                                  {stu.grade ? stu.grade+'학년' : '-'}
                                  {stu.classNum && <span style={{ marginLeft: '3px', padding: '1px 5px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '11px' }}>{stu.classNum}반</span>}
                                  {stu.number  && <span style={{ marginLeft: '3px', color: '#9ca3af', fontSize: '11px' }}>{stu.number}번</span>}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                                  <div>{stu.name}</div>
                                  {hb && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                                      {stu.remark && <span style={{ fontSize: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 5px', fontWeight: 600 }}>{stu.remark}</span>}
                                      {(stu.student_careers?.length > 0) && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: stu.student_careers.length<=1?'#eff6ff':'#f0fdf4', border: `1px solid ${stu.student_careers.length<=1?'#bfdbfe':'#86efac'}`, color: stu.student_careers.length<=1?'#1d4ed8':'#15803d' }}>{stu.student_careers.length<=1?'신규':'기존'}</span>}
                                      {(stu.status==='cancel_before'||stu.status==='cancel_after') && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>{stu.status==='cancel_after'?'개강후취소':'개강전취소'}{stu.cancel_info?.date&&(()=>{const [y,m,day]=stu.cancel_info.date.split('-');return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`})()}</span>}
                                      {(stu.relations||[]).map((r,ri)=><span key={ri} style={{ fontSize:'10px',fontWeight:600,padding:'1px 5px',borderRadius:'4px',background:r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed',border:`1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`,color:r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>{r.type}{r.with?` · ${r.with}`:''}</span>)}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{stu.parentPhone||'-'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: ac.bg, color: ac.color, border: `1px solid ${ac.color}40` }}>{ac.label}</span>
                                </td>
                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                  {si ? (
                                    <div style={{ fontSize: '11px' }}>
                                      <div style={{ fontWeight: 600, color: '#374151' }}>{sp?.name||si.name||''}</div>
                                      <div style={{ color: '#6b7280', marginTop: '1px' }}>{st}단계 {chk}/{spp}차시</div>
                                      <div style={{ height: '3px', background: '#e5e7eb', borderRadius: '2px', marginTop: '3px', width: '70px' }}>
                                        <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: pct>=100?'#16a34a':pct>=80?'#f59e0b':'#f97316' }} />
                                      </div>
                                    </div>
                                  ) : <span style={{ fontSize: '11px', color: '#d1d5db' }}>-</span>}
                                </td>
                                <td style={{ padding: '8px 12px', maxWidth: '150px' }}>
                                  {ar?.note
                                    ? <span style={{ fontSize: '11px', color: '#374151', background: '#fffbeb', padding: '2px 6px', borderRadius: '5px', border: '1px solid #fde68a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ar.note}</span>
                                    : <span style={{ fontSize: '11px', color: '#d1d5db' }}>-</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* 특이사항 메모 */}
      <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📝</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>특이사항 메모</span>
          </div>
          <button onClick={() => { setAddingNote(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{ padding: '5px 12px', borderRadius: '8px', border: '1.5px solid #fbbf24', background: '#fff', color: '#b45309', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 추가
          </button>
        </div>
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.length === 0 && !addingNote && (
            <div style={{ fontSize: '13px', color: C.muted, textAlign: 'center', padding: '16px 0' }}>오늘의 특이사항을 기록하세요</div>
          )}
          {notes.map(note => <NoteItem key={note.id} note={note} onDelete={deleteNote} onEdit={editNote} />)}
          {addingNote && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input ref={inputRef} value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="예: 홍길동 로봇교구 준비 / 배터리 안내"
                onKeyDown={e => { if (e.key === 'Enter') addNote(); if (e.key === 'Escape') { setAddingNote(false); setNewNote('') } }}
                style={{ flex: 1, border: '1.5px solid #f97316', borderRadius: '8px', padding: '9px 13px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
              <button onClick={addNote} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
              <button onClick={() => { setAddingNote(false); setNewNote('') }}
                style={{ padding: '9px 13px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD  메인 export
// ═══════════════════════════════════════════════════════════════════

export function Dashboard({ user, onNav }) {
  const { settings, hideCard, toggleCard, resetAll } = useCardSettings(user.id)
  const { cardOrder, saveCardOrder } = useCardOrder(user.id)
  const [showSettings, setShowSettings] = useState(false)
  const [dragId,     setDragId]     = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const handleDragStart = (e, id) => { e.dataTransfer.effectAllowed = 'move'; setDragId(id) }
  const handleDragOver  = (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(id) }
  const handleDrop      = (e, id) => {
    e.preventDefault()
    if (dragId && dragId !== id) {
      const next = [...cardOrder]
      const fi = next.indexOf(dragId), ti = next.indexOf(id)
      if (fi !== -1 && ti !== -1) { next.splice(fi, 1); next.splice(ti, 0, dragId) }
      saveCardOrder(next)
    }
    setDragId(null); setDragOverId(null)
  }
  const handleDragEnd = () => { setDragId(null); setDragOverId(null) }

  const today = todayStr()
  const d     = new Date()
  const [calYear,      setCalYear]      = useState(d.getFullYear())
  const [calMonth,     setCalMonth]     = useState(d.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const weather = useWeather()

  const classes    = sortClasses(ClassesDB.byTeacher(user.id))
  const classDates = new Set()
  classes.forEach(cls => calcSessionDates(cls).forEach(s => classDates.add(s)))

  const weekEnd    = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const supplyAlerts = classes.flatMap(cls => {
    const upcoming   = calcSessionDates(cls).filter(d => d >= today && d <= weekEndStr)
    if (!upcoming.length) return []
    const confirmed  = StudentsDB.confirmed(cls.id)
    if (!confirmed.length) return []
    const supplyData = SupplyItems.byClass(cls.id)
    const notSet     = confirmed.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
    return notSet.length > 0 ? [{ cls, nextDate: upcoming[0], notSetCount: notSet.length, total: confirmed.length }] : []
  })

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0)  } else setCalMonth(m=>m+1) }
  const goToday   = () => { const t = new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); setSelectedDate(today) }

  const hiddenCount = Object.values(settings).filter(v => !v).length

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>
            안녕하세요, {(user.displayNameMode === 'nickname' && user.nickname) ? user.nickname : user.name} 선생님 👋
          </h1>
          <div style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>{formatDateKo(today)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 날씨 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 22px', background: '#fff', borderRadius: '14px', border: `1px solid ${C.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            {weather ? (
              <>
                <span style={{ fontSize: '34px' }}>{weatherIcon(weather.code).icon}</span>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: C.text }}>{weather.temp}°C</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{weatherIcon(weather.code).text} · 바람 {weather.wind}km/h</div>
                </div>
              </>
            ) : <div style={{ fontSize: '13px', color: C.muted }}>날씨 불러오는 중...</div>}
          </div>
          {/* ⚙️ 카드 설정 버튼 */}
          <button
            onClick={() => setShowSettings(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: C.muted, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', fontFamily: 'Noto Sans KR, sans-serif' }}
          >
            ⚙️ 카드 설정
            {hiddenCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: C.primary, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{hiddenCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── 카드 설정 모달 ── */}
      {showSettings && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 40px', overflowY: 'auto' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: C.text }}>⚙️ 대시보드 카드 설정</div>
              <button onClick={() => setShowSettings(false)} style={{ width: '30px', height: '30px', borderRadius: '50%', border: `1px solid ${C.border}`, background: '#f9fafb', cursor: 'pointer', fontSize: '16px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {/* props 전달 → Dashboard 상태와 즉시 동기화 */}
            <DashboardCardSettings userId={user.id} settings={settings} onToggle={toggleCard} onResetAll={resetAll} />
          </div>
        </div>
      )}

      {/* ── 교구 준비 알림 ── */}
      {settings.supply && supplyAlerts.length > 0 && (
        <div style={{ background: '#fef2f2', borderRadius: '12px', border: '1.5px solid #fca5a5', padding: '14px 18px', position: 'relative' }}>
          <button
            onClick={() => hideCard('supply')}
            title="카드 숨기기"
            style={{ position: 'absolute', top: '10px', right: '12px', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
          <div onClick={() => onNav('supply')} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: C.danger }}>교구 준비 필요 — 이번주 수업</span>
              <span style={{ fontSize: '11px', color: C.primary, fontWeight: 600 }}>바로가기 →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {supplyAlerts.map(({ cls, nextDate, notSetCount, total }) => (
                <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #fca5a5', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '13px', color: C.text }}>
                    <span style={{ fontWeight: 700 }}>{cls.organization}</span>
                    <span style={{ color: C.muted }}> · {cls.className}{cls.section ? ' ' + cls.section + '반' : ''}</span>
                    <span style={{ fontSize: '12px', color: C.muted, marginLeft: '6px' }}>📅 {nextDate}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.danger, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                    🎒 교구 미설정 {notSetCount}/{total}명
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 달력 + 출석부 ── */}
      {settings.calendar && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => hideCard('calendar')}
            title="카드 숨기기"
            style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, width: '22px', height: '22px', borderRadius: '50%', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>

          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <button onClick={prevMonth} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{calYear}년 {MONTHS[calMonth]}</span>
                  <button onClick={goToday} style={{ padding: '3px 10px', borderRadius: '7px', border: `1px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>오늘</button>
                </div>
                <button onClick={nextMonth} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>

              <MonthCalendar year={calYear} month={calMonth} selectedDate={selectedDate} classDates={classDates} onSelectDate={setSelectedDate} />

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '14px', fontSize: '11px', color: C.muted }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.primary, display: 'inline-block' }} /> 수업 있는 날
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '5px', border: `2px solid ${C.primary}`, display: 'inline-block' }} /> 오늘
                </div>
              </div>

              {/* 이달 수업 요약 — 클릭 시 수업관리로 이동 */}
              <div
                onClick={() => onNav('classes')}
                style={{ marginTop: '14px', padding: '12px 14px', background: '#fff7ed', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>이달의 수업 요약 →</div>
                {classes.length === 0
                  ? <div style={{ fontSize: '12px', color: C.muted }}>등록된 수업이 없습니다</div>
                  : classes.map(cls => {
                      const monthDates = calcSessionDates(cls).filter(s => s.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`))
                      if (!monthDates.length) return null
                      return (
                        <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#374151' }}>{cls.className}{cls.section ? ' ' + cls.section + '반' : ''}</span>
                          <span style={{ color: C.primary, fontWeight: 700 }}>{monthDates.length}회</span>
                        </div>
                      )
                    })
                }
              </div>
            </div>

            <DayDetail date={selectedDate} user={user} classes={classes} onNav={onNav} />
          </div>
        </div>
      )}

      {/* ── 요약 카드 그리드 (드래그로 순서 변경 가능) ── */}
      {(() => {
        const CARDS = {
          revenue:      <RevenueCard      user={user} onHide={hideCard} onNav={onNav} />,
          announcement: <AnnouncementCard user={user} onHide={hideCard} onNav={onNav} />,
          training:     <TrainingCard     user={user} onHide={hideCard} onNav={onNav} />,
          certificate:  <CertificateCard  user={user} onHide={hideCard} onNav={onNav} />,
          career:       <CareerCard       user={user} onHide={hideCard} onNav={onNav} />,
          award:        <AwardCard        user={user} onHide={hideCard} onNav={onNav} />,
        }
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {cardOrder.map(id => {
              if (!settings[id]) return null
              const isDragging  = dragId === id
              const isDragOver  = dragOverId === id && dragId !== id
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={e => handleDragStart(e, id)}
                  onDragOver={e  => handleDragOver(e, id)}
                  onDrop={e      => handleDrop(e, id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    opacity: isDragging ? 0.4 : 1,
                    outline: isDragOver ? `2px dashed ${C.primary}` : 'none',
                    outlineOffset: '2px',
                    borderRadius: '16px',
                    transition: 'opacity .15s, outline .1s',
                    cursor: 'grab',
                  }}
                >
                  {CARDS[id]}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* 숨겨진 카드 안내 */}
      {hiddenCount > 0 && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, padding: '4px 0' }}>
          카드 {hiddenCount}개가 숨겨져 있어요.{' '}
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: C.primary, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', textDecoration: 'underline' }}
          >⚙️ 카드 설정</button>에서 다시 켤 수 있어요.
        </div>
      )}
    </div>
  )
}
