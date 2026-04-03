import React, { useState } from 'react'
import { AdSlots } from '../lib/db.js'
import { Btn, Card, PageHeader, Toggle, Textarea } from '../components/Atoms.jsx'

export function Adsense() {
  const [slots, setSlots] = useState(() => AdSlots.all())
  const [editId, setEditId] = useState(null)
  const [code, setCode] = useState('')

  const update = (id, patch) => {
    AdSlots.update(id, patch)
    setSlots(AdSlots.all())
  }

  const saveCode = (id) => {
    update(id, { code })
    setEditId(null)
  }

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <PageHeader title="광고 슬롯 관리" sub="Google AdSense 광고 코드를 관리합니다." />

      <div style={{ marginBottom: '20px', padding: '16px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', fontSize: '13px', color: '#92400e', lineHeight: 1.7 }}>
        <strong>등록 방법:</strong><br />
        1. Google AdSense에서 광고 단위를 생성합니다.<br />
        2. 생성된 <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>&lt;script&gt;</code> 코드를 해당 슬롯에 입력합니다.<br />
        3. ON/OFF 스위치로 노출을 조정합니다.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {slots.map(slot => (
          <Card key={slot.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{slot.name}</div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '6px' }}>
                    {typeof slot.w === 'number' ? `${slot.w}` : '100%'} × {slot.h}px
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>슬롯 ID: {slot.id}</div>

                {/* 플레이스홀더 미리보기 */}
                <div style={{
                  width: '100%', maxWidth: typeof slot.w === 'number' ? `${slot.w}px` : '100%',
                  height: `${slot.h}px`,
                  background: slot.active && slot.code ? '#f0fdf4' : '#f9fafb',
                  border: `2px dashed ${slot.active && slot.code ? '#86efac' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: '#9ca3af',
                  marginBottom: '12px',
                }}>
                  {slot.active && slot.code ? '✅ 광고 활성' : slot.code ? '광고 코드 있음 (OFF)' : '광고 코드 없음'}
                </div>

                {editId === slot.id ? (
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
                )}
              </div>

              {/* 토글 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Toggle checked={slot.active} onChange={v => update(slot.id, { active: v })} />
                <span style={{ fontSize: '12px', color: slot.active ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>
                  {slot.active ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
