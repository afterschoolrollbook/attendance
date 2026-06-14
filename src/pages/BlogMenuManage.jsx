import React, { useState } from 'react'
import { Settings } from '../lib/db.js'
import { Card, PageHeader, Btn } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { LEVEL_NAMES, LEVEL_COLORS } from '../constants/permissions.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a' }

// ─── 권한 레벨 선택 버튼 (BlogAdmin 권한설정에서 사용)
function LevelButtons({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
      {[1,2,3,4,5,6,7,8,9,10].map(lv => (
        <button key={lv} onClick={() => onChange(lv)}
          style={{ width:'28px', height:'28px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:700,
            background: value === lv ? (LEVEL_COLORS[lv] || '#9ca3af') : '#f3f4f6',
            color: value === lv ? '#fff' : '#9ca3af', transition:'all .15s', fontFamily:'Noto Sans KR, sans-serif' }}>
          {lv}
        </button>
      ))}
    </div>
  )
}

const BOARDS = [
  { key: 'blog',     label: '📝 블로그' },
  { key: 'docs',     label: '📖 사용 설명서' },
  { key: 'template', label: '📋 템플릿' },
  { key: 'review',   label: '⭐ 사용자 후기' },
  { key: 'qna',      label: '❓ 질문 게시판' },
  { key: 'secret',   label: '🔐 비밀 게시판' },
]

export function BlogMenuManage({ user }) {
  const [blogWriteMinLevel,  setBlogWriteMinLevel]  = useState(() => Settings.get('blogWriteMinLevel')  ?? 1)
  const [blogNoticeMinLevel, setBlogNoticeMinLevel] = useState(() => Settings.get('blogNoticeMinLevel') ?? 10)

  const defaultBoardPerm = () => ({ access: 1, read: 1, write: 1 })
  const [boardPerms, setBoardPerms] = useState(() => {
    const saved = Settings.get('boardPermissions') || {}
    const result = {}
    BOARDS.forEach(b => { result[b.key] = { ...defaultBoardPerm(), ...(saved[b.key] || {}) } })
    return result
  })

  const { success } = useToast()

  const save = () => {
    Settings.set('blogWriteMinLevel',  blogWriteMinLevel)
    Settings.set('blogNoticeMinLevel', blogNoticeMinLevel)
    const prevBoardPerms = Settings.get('boardPermissions') || {}
    const next = { ...prevBoardPerms }
    BOARDS.forEach(b => { next[b.key] = boardPerms[b.key] })
    Settings.set('boardPermissions', next)
    success('저장이 완료되었습니다.')
  }

  const setPerm = (boardKey, permType, lv) => {
    setBoardPerms(prev => ({ ...prev, [boardKey]: { ...prev[boardKey], [permType]: lv } }))
  }

  return (
    <div style={{ padding:'28px', maxWidth:'1100px' }}>
      <PageHeader title="블로그 메뉴관리" sub="게시판 접근/읽기/글쓰기 권한 및 블로그 작성 최소 레벨을 설정합니다." />

      <div style={{ marginTop:'20px' }}>
        <Card style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🔐 권한 설정</div>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
            게시판별 최소 레벨을 설정합니다. 관리자(Lv.10)는 모든 권한이 적용됩니다.
          </div>

          {/* 레벨 범례 */}
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'24px', padding:'12px 16px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
            {[1,2,3,4,5,6,7,8,9,10].map(lv => (
              <div key={lv} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <span style={{ width:'20px', height:'20px', borderRadius:'5px', background: LEVEL_COLORS[lv] || '#9ca3af', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, color:'#fff' }}>{lv}</span>
                <span style={{ fontSize:'11px', color:C.muted }}>{LEVEL_NAMES[lv]}</span>
              </div>
            ))}
          </div>

          {/* 게시판별 권한 */}
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'12px' }}>📋 게시판별 권한</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'24px' }}>
            {/* 헤더 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px', padding:'8px 16px', background:'#f3f4f6', borderRadius:'8px', fontSize:'12px', fontWeight:700, color:C.muted }}>
              <span>게시판</span>
              <span>접근 (메뉴 표시)</span>
              <span>읽기 (글 열람)</span>
              <span>글쓰기</span>
            </div>
            {BOARDS.map(board => (
              <div key={board.key} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px', padding:'12px 16px', borderRadius:'10px', border:`1.5px solid ${C.border}`, background:'#fff', alignItems:'center' }}>
                <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{board.label}</div>
                <LevelButtons value={boardPerms[board.key]?.access ?? 1} onChange={lv => setPerm(board.key, 'access', lv)} />
                <LevelButtons value={boardPerms[board.key]?.read   ?? 1} onChange={lv => setPerm(board.key, 'read',   lv)} />
                <LevelButtons value={boardPerms[board.key]?.write  ?? 1} onChange={lv => setPerm(board.key, 'write',  lv)} />
              </div>
            ))}
          </div>

          {/* 블로그 글쓰기/공지 최소 레벨 */}
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'12px' }}>📝 블로그 작성 권한</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:'10px', border:`1.5px solid ${C.border}`, background:'#fff', flexWrap:'wrap', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>블로그 글쓰기 최소 레벨</div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                  현재: <span style={{ fontWeight:700, color: LEVEL_COLORS[blogWriteMinLevel] || '#9ca3af' }}>Lv.{blogWriteMinLevel} 이상</span>
                </div>
              </div>
              <LevelButtons value={blogWriteMinLevel} onChange={setBlogWriteMinLevel} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:'10px', border:`1.5px solid ${C.border}`, background:'#fff', flexWrap:'wrap', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>공지글 작성 최소 레벨</div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                  현재: <span style={{ fontWeight:700, color: LEVEL_COLORS[blogNoticeMinLevel] || '#9ca3af' }}>Lv.{blogNoticeMinLevel} 이상</span>
                </div>
              </div>
              <LevelButtons value={blogNoticeMinLevel} onChange={setBlogNoticeMinLevel} />
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'16px' }}>
            <Btn onClick={save}>💾 저장</Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}
