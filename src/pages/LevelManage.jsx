import React, { useState } from 'react'
import { Settings } from '../lib/db.js'
import { PageHeader } from '../components/Atoms.jsx'
import { DEFAULT_LEVEL_NAMES, MENU_ITEMS, LEVEL_COLORS } from '../constants/permissions.js'

export function LevelManage({ user }) {
  const initSettings = () => {
    const storedMin  = Settings.get('menuMinLevels') || {}
    const storedVis  = Settings.get('menuVisible')   || {}
    const result = {}
    MENU_ITEMS.forEach(item => {
      result[item.menuKey] = {
        minLevel: storedMin[item.menuKey] ?? 1,
        visible:  storedVis[item.menuKey] ?? true,
      }
    })
    return result
  }

  const [levelNames,   setLevelNames]   = React.useState(() => ({ ...DEFAULT_LEVEL_NAMES, ...(Settings.get('levelNames') || {}) }))
  const [menuSettings, setMenuSettings] = React.useState(initSettings)
  const [saved, setSaved] = React.useState(false)

  const handleSave = () => {
    const minLevels = {}, visible = {}
    Object.entries(menuSettings).forEach(([k, v]) => {
      minLevels[k] = v.minLevel
      visible[k]   = v.visible
    })
    Settings.set('levelNames',    levelNames)
    Settings.set('menuMinLevels', minLevels)
    Settings.set('menuVisible',   visible)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setMenu = (menuKey, field, val) =>
    setMenuSettings(p => ({ ...p, [menuKey]: { ...p[menuKey], [field]: val } }))

  const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff' }

  return (
    <div style={{ padding:'28px', maxWidth:'1100px' }}>
      <PageHeader title="등급 관리" sub="레벨 이름 및 메뉴별 접근 레벨/표시 여부를 설정합니다." />
      <div style={{ display:'flex', flexDirection:'column', gap:'28px', marginTop:'20px' }}>

      {/* ── 레벨 이름 설정 ── */}
      <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'24px' }}>
        <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'16px' }}>🎖️ 레벨 이름 설정</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'12px' }}>
          {Array.from({length:10}, (_,i) => i+1).map(lv => (
            <div key={lv} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderRadius:'10px', border:`1.5px solid ${LEVEL_COLORS[lv]}44`, background:`${LEVEL_COLORS[lv]}0a` }}>
              <div style={{ minWidth:'36px', height:'36px', borderRadius:'50%', background:LEVEL_COLORS[lv], display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:800, color:'#fff' }}>
                {lv}
              </div>
              <input
                value={levelNames[lv] || ''}
                onChange={e => setLevelNames(p => ({ ...p, [lv]: e.target.value }))}
                placeholder={DEFAULT_LEVEL_NAMES[lv]}
                style={{ flex:1, border:'none', borderBottom:`1.5px solid ${LEVEL_COLORS[lv]}66`, background:'transparent', fontSize:'13px', fontWeight:600, color:C.text, outline:'none', padding:'2px 4px', fontFamily:'Noto Sans KR, sans-serif' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 메뉴별 레벨 + 보이기/가리기 설정 ── */}
      <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'24px' }}>
        <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📋 메뉴별 레벨 · 표시 설정</div>
        <div style={{ fontSize:'13px', color:C.muted, marginBottom:'16px' }}>
          <strong>보이기</strong>: 메뉴가 보이지만 레벨 미달 시 클릭하면 안내 메시지 표시 &nbsp;·&nbsp;
          <strong>가리기</strong>: 해당 레벨 이하 선생님에게 메뉴 자체가 안 보임
        </div>
        {/* 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 160px 130px', gap:'8px', padding:'4px 14px 8px', fontSize:'11px', fontWeight:700, color:C.muted }}>
          <span>메뉴</span><span style={{textAlign:'center'}}>최소 레벨</span><span style={{textAlign:'center'}}>표시</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {MENU_ITEMS.map(item => {
            const s = menuSettings[item.menuKey] || { minLevel:1, visible:true }
            const lvColor = LEVEL_COLORS[s.minLevel] || '#9ca3af'
            return (
              <div key={item.menuKey} style={{ display:'grid', gridTemplateColumns:'1fr 160px 130px', gap:'8px', alignItems:'center', padding:'10px 14px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fafafa' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'16px', width:'22px', textAlign:'center' }}>{item.icon}</span>
                  <span style={{ fontSize:'14px', fontWeight:500, color:C.text }}>{item.label}</span>
                </div>
                {/* 최소 레벨 선택 */}
                <select
                  value={s.minLevel}
                  onChange={e => setMenu(item.menuKey, 'minLevel', parseInt(e.target.value))}
                  style={{ padding:'5px 8px', borderRadius:'8px', border:`1.5px solid ${lvColor}`, fontSize:'12px', fontWeight:700, color:lvColor, background:`${lvColor}11`, outline:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}
                >
                  {Array.from({length:10}, (_,i) => i+1).map(lv => (
                    <option key={lv} value={lv}>Lv.{lv} {levelNames[lv] || DEFAULT_LEVEL_NAMES[lv]}</option>
                  ))}
                </select>
                {/* 보이기/가리기 */}
                <div style={{ display:'flex', gap:'4px' }}>
                  <button onClick={() => setMenu(item.menuKey, 'visible', true)}
                    style={{ flex:1, padding:'5px 0', borderRadius:'6px', border:`1.5px solid ${s.visible ? '#16a34a' : '#e5e7eb'}`, background: s.visible ? '#f0fdf4' : '#f9fafb', color: s.visible ? '#16a34a' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    보이기
                  </button>
                  <button onClick={() => setMenu(item.menuKey, 'visible', false)}
                    style={{ flex:1, padding:'5px 0', borderRadius:'6px', border:`1.5px solid ${!s.visible ? '#ef4444' : '#e5e7eb'}`, background: !s.visible ? '#fef2f2' : '#f9fafb', color: !s.visible ? '#ef4444' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    가리기
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 저장 버튼 ── */}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={handleSave} style={{ padding:'12px 32px', borderRadius:'12px', border:'none', background: saved ? '#16a34a' : '#f97316', color:'#fff', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'background .2s' }}>
          {saved ? '✅ 저장됨' : '💾 저장'}
        </button>
      </div>
      </div>
    </div>
  )
}
