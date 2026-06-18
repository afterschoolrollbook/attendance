import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
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
  const [categories, setCategories] = useState([])
  const [newCat, setNewCat] = useState('')
  const [catLoading, setCatLoading] = useState(false)

  const { success } = useToast()

  // 기본 카테고리 (DB에 없으면 초기 시드로 추가)
  const DEFAULT_CATS = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']
  const DEFAULT_CAT_KEYS = {
    '출석 관리': 'blog_attendance',
    '교구 관리': 'blog_materials',
    '업무 팁':   'blog_tips',
    '공지사항':  'blog_notice',
    '업데이트':  'blog_update',
    '기타':      'blog_etc',
  }

  useEffect(() => { loadCategories() }, [])

  const loadCategories = async () => {
    try {
      const rows = await dbCall('getAll', 'customCategories')
      const blogCats = (rows || []).filter(c => c.type === 'blog').sort((a, b) => (a.label || '').localeCompare(b.label || '', 'ko'))
      // 한 번도 시드가 안 된 경우 기본 카테고리를 DB에 삽입
      if (blogCats.length === 0) {
        for (const label of DEFAULT_CATS) {
          await dbCall('insert', 'customCategories', { data: { id: uid(), key: DEFAULT_CAT_KEYS[label], type: 'blog', label, createdAt: now(), updatedAt: now() } })
        }
        return loadCategories()
      }
      setCategories(blogCats)
    } catch (e) { console.warn('[BlogMenuManage]', e) }
  }

  const addCategory = async () => {
    const label = newCat.trim()
    if (!label) return
    if (DEFAULT_CATS.includes(label) || categories.find(c => c.label === label)) return alert('이미 있는 카테고리예요.')
    setCatLoading(true)
    try {
      await dbCall('insert', 'customCategories', { data: { id: uid(), key: `blog_${uid()}`, type: 'blog', label, createdAt: now(), updatedAt: now() } })
      setNewCat('')
      loadCategories()
      success(`"${label}" 카테고리가 추가되었습니다.`)
    } catch (e) { alert('추가 실패: ' + e.message) }
    setCatLoading(false)
  }

  const deleteCategory = async (cat) => {
    if (!window.confirm(`"${cat.label}" 카테고리를 삭제할까요?`)) return
    try {
      await dbCall('delete', 'customCategories', { id: cat.id })
      loadCategories()
      success(`"${cat.label}" 카테고리가 삭제되었습니다.`)
    } catch (e) { alert('삭제 실패: ' + e.message) }
  }

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

        {/* 카테고리 관리 */}
        <Card style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📂 블로그 카테고리 관리</div>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px' }}>블로그 카테고리를 추가하거나 삭제할 수 있어요. 기본 카테고리는 삭제할 수 없어요.</div>

          {/* 전체 카테고리 목록 (모두 삭제 가능) */}
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>등록된 카테고리</div>
            {categories.length === 0 ? (
              <div style={{ fontSize:'13px', color:C.muted }}>카테고리가 없습니다.</div>
            ) : (
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 10px 5px 14px', borderRadius:'999px', background:'#fff7ed', border:'1.5px solid #fed7aa' }}>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#c2410c' }}>{cat.label}</span>
                    <button onClick={() => deleteCategory(cat)} style={{ background:'none', border:'none', cursor:'pointer', color:'#f97316', fontSize:'14px', lineHeight:1, padding:'0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 추가 입력 */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <input value={newCat} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="새 카테고리 이름 입력 (예: 교육 칼럼)"
              style={{ flex:1, padding:'9px 12px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
            <Btn onClick={addCategory} disabled={catLoading || !newCat.trim()}>+ 추가</Btn>
          </div>
        </Card>

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
