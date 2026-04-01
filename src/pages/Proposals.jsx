import React from 'react'

const C = {
  primary:'#f97316', border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff',
}

export function Proposals({ user }) {
  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>📝 제안서 및 자기소개서</h1>
        <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>제안서·자기소개서·지원서류 관리</p>
      </div>
      <div style={{ textAlign:'center', padding:'80px 40px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>📝</div>
        <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'8px' }}>준비 중입니다</div>
        <div style={{ fontSize:'13px' }}>제안서 및 자기소개서 관리 기능이 곧 추가됩니다.</div>
      </div>
    </div>
  )
}
