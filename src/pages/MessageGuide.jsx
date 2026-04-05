import React, { useState } from 'react'
import { PageHeader, Card, Modal, Btn, EmptyState } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const CATEGORIES = ['결석', '지각', '개강전', '개강', '수업신청감사', '추첨']
const STORAGE_KEY = 'asa_message_guides'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }

export function MessageGuide({ user }) {
  const [tab, setTab] = useState('결석')
  const [items, setItems] = useState(load)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title:'', content:'' })
  const { success } = useToast()

  const filtered = items.filter(i => i.category === tab && i.teacherId === user.id)

  const openAdd = () => {
    setEditId(null)
    setForm({ title:'', content:'' })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditId(item.id)
    setForm({ title: item.title, content: item.content })
    setModal(true)
  }

  const saveItem = () => {
    if (!form.content.trim()) return
    const all = load()
    if (editId) {
      const updated = all.map(i => i.id === editId ? { ...i, ...form } : i)
      save(updated)
      setItems(updated)
      success('수정이 완료되었습니다.')
    } else {
      const newItem = { id: uid(), teacherId: user.id, category: tab, title: form.title, content: form.content, createdAt: new Date().toISOString() }
      const updated = [...all, newItem]
      save(updated)
      setItems(updated)
      success('등록이 완료되었습니다.')
    }
    setModal(false)
  }

  const deleteItem = (id) => {
    const updated = items.filter(i => i.id !== id)
    save(updated)
    setItems(updated)
    success('삭제가 완료되었습니다.')
  }

  const copyText = (content) => {
    navigator.clipboard.writeText(content).then(() => success('클립보드에 복사되었습니다.'))
  }

  const fStyle = { width:'100%', padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', color:C.text, boxSizing:'border-box' }

  return (
    <div style={{ padding:'28px', maxWidth:'860px' }}>
      <PageHeader title="안내 문구 관리" sub="문자나 카카오 발송 시 사용할 문구를 카테고리별로 관리합니다." />

      {/* 카테고리 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'24px', flexWrap:'wrap' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setTab(cat)}
            style={{ padding:'9px 18px', borderRadius:'20px', border:`2px solid ${tab===cat ? C.primary : C.border}`, background: tab===cat ? '#fff7ed' : '#fff', color: tab===cat ? C.primary : C.muted, fontSize:'14px', fontWeight: tab===cat ? 700 : 400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
            {cat}
          </button>
        ))}
        <button onClick={openAdd}
          style={{ padding:'9px 18px', borderRadius:'20px', border:`2px solid ${C.primary}`, background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', marginLeft:'auto' }}>
          + 문구 추가
        </button>
      </div>

      {/* 문구 목록 */}
      {filtered.length === 0 ? (
        <EmptyState icon="💬" title="등록된 문구가 없습니다" desc={`${tab} 카테고리에 문구를 추가해보세요.`} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {filtered.map(item => (
            <Card key={item.id} style={{ padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  {item.title && (
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.primary, marginBottom:'8px' }}>{item.title}</div>
                  )}
                  <div style={{ fontSize:'14px', color:C.text, lineHeight:1.8, whiteSpace:'pre-wrap', background:'#f9fafb', padding:'14px 16px', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                    {item.content}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => copyText(item.content)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    📋 복사
                  </button>
                  <button onClick={() => openEdit(item)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    편집
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    삭제
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 추가/편집 모달 */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? '문구 편집' : `${tab} 문구 추가`} width={520}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>제목 (선택)</label>
            <input value={form.title} onChange={e => setForm(p => ({...p, title:e.target.value}))}
              placeholder="예: 결석 안내 기본 문구" style={fStyle}/>
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>문구 내용 *</label>
            <textarea value={form.content} onChange={e => setForm(p => ({...p, content:e.target.value}))}
              placeholder={`예)\n안녕하세요~\n판교초 발명교실 푸우쌤 입니다.\n000 친구가 수업에 도착하지 않아 연락드리오니\n확인부탁드립니다.`}
              rows={8} style={{ ...fStyle, resize:'vertical', lineHeight:1.7 }}/>
          </div>
          <div style={{ fontSize:'12px', color:C.muted }}>
            * 000 처럼 자리표시자를 사용하면 복사 후 직접 수정해서 발송할 수 있습니다.
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'4px' }}>
            <button onClick={() => setModal(false)}
              style={{ padding:'10px 20px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
              취소
            </button>
            <button onClick={saveItem}
              style={{ padding:'10px 24px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              저장
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
