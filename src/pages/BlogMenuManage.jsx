import React, { useState } from 'react'
import { Settings } from '../lib/db.js'
import { Card, PageHeader, Btn } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { LEVEL_NAMES, LEVEL_COLORS, BOARD_PERM_DEFAULTS, getBoardPermissions } from '../constants/permissions.js'

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

// 게시판/콘텐츠 유형 목록. access/read는 게시판 탭(blog/review/qna/secret)에만 의미가 있고,
// notice/docs/template은 작성(write) 최소 레벨만 사용합니다.
const BOARDS = [
  { key: 'blog',     label: '📝 블로그',       hasAccessRead: true },
  { key: 'review',   label: '⭐ 사용자 후기',   hasAccessRead: true },
  { key: 'qna',      label: '❓ 질문 게시판',   hasAccessRead: true },
  { key: 'request',  label: '🙏 부탁해요~',     hasAccessRead: true },
  { key: 'secret',   label: '🔐 비밀 게시판',   hasAccessRead: true },
  { key: 'notice',   label: '📢 공지글',        hasAccessRead: false },
  { key: 'docs',     label: '📖 사용 설명서',   hasAccessRead: false },
  { key: 'template', label: '📋 템플릿',        hasAccessRead: false },
]

export function BlogMenuManage({ user }) {
  const [boardPerms, setBoardPerms] = useState(() => getBoardPermissions())

  const { success } = useToast()

  const save = () => {
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
      <PageHeader title="블로그 메뉴관리" sub="게시판 접근/읽기/글쓰기 권한 및 콘텐츠 작성 최소 레벨을 설정합니다." />

      <div style={{ marginTop:'20px' }}>
        <Card style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🔐 권한 설정</div>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
            게시판 및 콘텐츠 유형별 최소 레벨을 설정합니다. 관리자(Lv.10)는 모든 권한이 적용됩니다.
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

          {/* 게시판/콘텐츠 권한 */}
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'12px' }}>📋 게시판 · 콘텐츠 작성 권한</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px' }}>
            {/* 헤더 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px', padding:'8px 16px', background:'#f3f4f6', borderRadius:'8px', fontSize:'12px', fontWeight:700, color:C.muted }}>
              <span>게시판 / 콘텐츠</span>
              <span>접근 (메뉴 표시)</span>
              <span>읽기 (글 열람)</span>
              <span>글쓰기</span>
            </div>
            {BOARDS.map(board => (
              <div key={board.key} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px', padding:'12px 16px', borderRadius:'10px', border:`1.5px solid ${C.border}`, background:'#fff', alignItems:'center' }}>
                <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{board.label}</div>
                {board.hasAccessRead ? (
                  <>
                    <LevelButtons value={boardPerms[board.key]?.access ?? BOARD_PERM_DEFAULTS[board.key]?.access ?? 1} onChange={lv => setPerm(board.key, 'access', lv)} />
                    <LevelButtons value={boardPerms[board.key]?.read   ?? BOARD_PERM_DEFAULTS[board.key]?.read   ?? 1} onChange={lv => setPerm(board.key, 'read',   lv)} />
                  </>
                ) : (
                  <>
                    <span style={{ fontSize:'12px', color:'#d1d5db' }}>—</span>
                    <span style={{ fontSize:'12px', color:'#d1d5db' }}>—</span>
                  </>
                )}
                <LevelButtons value={boardPerms[board.key]?.write ?? BOARD_PERM_DEFAULTS[board.key]?.write ?? 1} onChange={lv => setPerm(board.key, 'write', lv)} />
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'16px' }}>
            <Btn onClick={save}>💾 저장</Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}
