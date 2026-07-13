import React, { useState, useEffect } from 'react'
import { AdSlots } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import { SLOT_BANNER_SIZE } from '../lib/adSlotSizes.js'
import { Btn, Toggle, Textarea } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const SOURCE_OPTIONS = [
  { value: 'adsense', label: '애드센스' },
  { value: 'coupang', label: '쿠팡' },
  { value: 'random',  label: '무작위' },
]

// Fresh_Season AdsensePanel.js와 동일하게 카드 하나 안에 타이틀+설명+슬롯 목록이
// 전부 들어가는 구조 (슬롯마다 별도 카드로 떨어져 있지 않음)
const C = { primary: '#f97316', border: '#e5e7eb', muted: '#6b7280', text: '#111827', card: '#fff', bg: '#f9fafb' }
const S = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 },
  cardTitle: { fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14 },
  row: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' },
}

export function Adsense() {
  const [slots, setSlots] = useState(() => AdSlots.all())
  const [editId, setEditId] = useState(null)
  const [code, setCode] = useState('')
  const [pendingActive, setPendingActive] = useState({})  // 저장 전 토글 상태
  const [coupangWidgets, setCoupangWidgets] = useState([])
  const { success } = useToast()

  // 슬롯별 "쿠팡" 소스를 골랐을 때 실제로 매칭되는 배너가 몇 개 등록됐는지 보여주기 위해 로드
  // (쿠팡관리 단계 전에는 coupang_widgets 테이블이 없어 조회가 실패할 수 있음 → 조용히 빈 배열로 처리)
  useEffect(() => {
    if (!supabase) return
    supabase.from('coupang_widgets').select('size, enabled, widget_html')
      .then(({ data, error }) => { if (!error) setCoupangWidgets(Array.isArray(data) ? data : []) })
      .catch(() => setCoupangWidgets([]))
  }, [])

  const countCoupangBanners = (slotId) => {
    const size = SLOT_BANNER_SIZE[slotId]
    if (!size) return 0
    return coupangWidgets.filter(w => w.enabled && w.widget_html && w.size === size).length
  }

  const reload = () => setSlots(AdSlots.all())

  const update = (id, patch) => {
    AdSlots.update(id, patch)
    reload()
  }

  const saveCode = (id) => {
    update(id, { code })
    setEditId(null)
    success('수정이 완료되었습니다.')
  }

  const saveActive = (id) => {
    const val = pendingActive[id]
    update(id, { active: val })
    setPendingActive(p => { const next = { ...p }; delete next[id]; return next })
    success('수정이 완료되었습니다.')
  }

  const setSource = (id, source) => {
    update(id, { source })
    success('수정이 완료되었습니다.')
  }

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <div style={S.card}>
        <div style={S.cardTitle}>📢 광고 슬롯 관리</div>

        <div style={{ marginBottom: '20px', padding: '16px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', fontSize: '13px', color: '#92400e', lineHeight: 1.7 }}>
          <strong>동작 방식</strong><br />
          ⚪ <strong>OFF</strong> — 사용자 화면에서 해당 광고 영역이 완전히 숨겨집니다.<br />
          🟡 <strong>대기</strong> — ON인데 노출할 코드/배너가 없는 상태. 빈 광고 자리만 표시됩니다.<br />
          ✅ <strong>ON + 코드/배너 등록</strong> — 실제 광고가 노출됩니다.<br /><br />
          <strong>소스 선택 (애드센스 / 쿠팡 / 무작위)</strong><br />
          <strong>애드센스</strong> — 아래 "코드 입력"에 등록한 애드센스 코드를 보여줍니다.<br />
          <strong>쿠팡</strong> — 쿠팡 관리 &gt; 배너/위젯 목록에서 이 슬롯 사이즈와 맞는 배너를 자동으로(여러 개면 무작위로) 골라 보여줍니다. 코드 입력은 필요 없어요.<br />
          <strong>무작위</strong> — 애드센스 코드와 쿠팡 배너 중 있는 것을 무작위로 섞어서 보여줍니다.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {slots.map(slot => {
          const isActivePending = slot.id in pendingActive
          const activeVal = isActivePending ? pendingActive[slot.id] : slot.active
          const source = slot.source || 'adsense'
          const coupangCount = countCoupangBanners(slot.id)
          const hasContent = source === 'coupang' ? coupangCount > 0
            : source === 'random' ? (!!slot.code || coupangCount > 0)
            : !!slot.code
          let statusText = '⚪ OFF (숨김)'
          if (activeVal) {
            if (!hasContent) statusText = '🟡 대기 (코드/배너 등록 필요)'
            else if (source === 'coupang') statusText = `🛒 쿠팡 배너 자동 노출 (${coupangCount}개 등록됨)`
            else if (source === 'random') statusText = '🔀 무작위 노출 중'
            else statusText = '✅ 광고 노출 중'
          }
          return (
            <div key={slot.id} style={S.row}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{slot.name}</div>
                    <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '6px' }}>
                      {typeof slot.w === 'number' ? `${slot.w}` : '100%'} × {slot.h}px
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>슬롯 ID: {slot.id}</div>

                  {/* 소스 선택 (애드센스 / 쿠팡 / 무작위) */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', maxWidth: typeof slot.w === 'number' ? slot.w : 320 }}>
                    {SOURCE_OPTIONS.map(opt => {
                      const on = source === opt.value
                      return (
                        <button key={opt.value} onClick={() => setSource(slot.id, opt.value)}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                            border: `1.5px solid ${on ? '#f97316' : '#e5e7eb'}`,
                            background: on ? '#fff7ed' : '#fff',
                            color: on ? '#f97316' : '#6b7280',
                          }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* 플레이스홀더 미리보기 */}
                  <div style={{
                    width: '100%', maxWidth: typeof slot.w === 'number' ? `${slot.w}px` : '100%',
                    height: `${slot.h}px`,
                    background: activeVal && hasContent ? '#f0fdf4' : activeVal ? '#fffbeb' : '#f9fafb',
                    border: `2px dashed ${activeVal && hasContent ? '#86efac' : activeVal ? '#fde68a' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', color: activeVal && hasContent ? '#16a34a' : activeVal ? '#92400e' : '#9ca3af',
                    marginBottom: '12px', textAlign: 'center', padding: '0 8px',
                  }}>
                    {statusText}
                  </div>

                  {source !== 'coupang' ? (
                    editId === slot.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <Textarea value={code} onChange={setCode} placeholder="<script>... AdSense 코드를 붙여넣으세요 ...</script>" rows={5} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Btn size="sm" onClick={() => saveCode(slot.id)}>저장</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>취소</Btn>
                          {slot.code && <Btn size="sm" variant="outlineDanger" onClick={() => { update(slot.id, { code: '' }); setEditId(null) }}>코드 삭제</Btn>}
                        </div>
                      </div>
                    ) : (
                      <Btn size="sm" variant="ghost" onClick={() => { setCode(slot.code || ''); setEditId(slot.id) }}>
                        {slot.code ? '코드 편집' : '+ 코드 입력'}
                      </Btn>
                    )
                  ) : (
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      쿠팡 관리 &gt; 배너/위젯 목록에서 이 슬롯 사이즈에 맞는 배너를 등록하면 자동으로 노출돼요. 코드 입력 필요 없음.
                    </div>
                  )}
                </div>

                {/* 토글 + 저장 버튼 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Toggle
                    checked={activeVal}
                    onChange={v => setPendingActive(p => ({ ...p, [slot.id]: v }))}
                  />
                  <span style={{ fontSize: '12px', color: activeVal && hasContent ? '#16a34a' : activeVal ? '#92400e' : '#9ca3af', fontWeight: 600 }}>
                    {activeVal && hasContent ? 'ON' : activeVal ? '대기' : 'OFF'}
                  </span>
                  {isActivePending && (
                    <Btn size="sm" onClick={() => saveActive(slot.id)}>저장</Btn>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
