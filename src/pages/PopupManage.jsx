/**
 * PopupManage.jsx — 사이트 팝업/공지 관리
 * Fresh_Season components/admin/PopupPanel.js를 그대로 이식.
 * Next.js API 라우트(fetch) 대신 supabase 클라이언트로 popups 테이블을 직접 조회한다.
 * 공개 화면에 실제로 팝업을 띄우는 부분은 Fresh_Season 저장소에 없어서 PopupDisplay.jsx를 새로 만들었다.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'

const ACCENT = '#f97316'
const C = { border: '#e5e7eb', muted: '#6b7280', text: '#111827', card: '#fff' }
const S = {
  label: { fontSize: 12, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 },
  btn: (color = ACCENT) => ({ background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }),
  btnGhost: { padding: '10px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
}

function fmtDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function AddPopupModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    title: '', content: '', link_url: '', link_label: '자세히 보기',
    bg_color: '#ffffff', text_color: '#111827',
    expires_at: '', is_active: true,
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: C.text }}>📢 팝업 추가</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.label}>제목 *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} style={S.input} placeholder="팝업 제목" />
          </div>
          <div>
            <label style={S.label}>내용 *</label>
            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={4} style={S.textarea} placeholder="팝업에 표시할 내용" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>링크 URL (선택)</label>
              <input value={form.link_url} onChange={e => set('link_url', e.target.value)} style={S.input} placeholder="https://..." />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>링크 버튼 텍스트</label>
              <input value={form.link_label} onChange={e => set('link_label', e.target.value)} style={S.input} placeholder="자세히 보기" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>배경색</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.bg_color} onChange={e => set('bg_color', e.target.value)}
                  style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <input value={form.bg_color} onChange={e => set('bg_color', e.target.value)} style={{ ...S.input, flex: 1 }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>텍스트색</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.text_color} onChange={e => set('text_color', e.target.value)}
                  style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <input value={form.text_color} onChange={e => set('text_color', e.target.value)} style={{ ...S.input, flex: 1 }} />
              </div>
            </div>
          </div>
          <div>
            <label style={S.label}>만료일 (비우면 무기한)</label>
            <input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)} style={S.input} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="is_active" style={{ fontSize: 14, color: C.text, cursor: 'pointer' }}>즉시 활성화</label>
          </div>

          {/* 미리보기 */}
          <div>
            <label style={S.label}>미리보기</label>
            <div style={{
              background: form.bg_color, color: form.text_color,
              border: `1px solid ${C.border}`, borderRadius: 10, padding: 20,
              maxWidth: 360, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{form.title || '제목'}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{form.content || '내용'}</div>
              {form.link_url && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer' }}>
                    {form.link_label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btnGhost}>취소</button>
          <button onClick={() => { if (form.title.trim() && form.content.trim()) onSave(form) }}
            disabled={!form.title.trim() || !form.content.trim()}
            style={{ ...S.btn(), opacity: form.title.trim() && form.content.trim() ? 1 : 0.4 }}>저장</button>
        </div>
      </div>
    </div>
  )
}

export function PopupManage({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10
  const [popups, setPopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('popups').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setPopups(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addPopup = async (form) => {
    if (!supabase) return
    setShowAdd(false)
    try {
      const row = { ...form, id: uid(), created_at: now() }
      const { error } = await supabase.from('popups').insert([row])
      if (error) throw error
      showToast('✅ 팝업 추가됨')
      load()
    } catch (e) {
      showToast('❌ 추가 실패: ' + e.message)
    }
  }

  const toggleActive = async (id, current) => {
    if (!supabase) return
    try {
      const { error } = await supabase.from('popups').update({ is_active: !current }).eq('id', id)
      if (error) throw error
      setPopups(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
      showToast(!current ? '✅ 활성화됨' : '⏸ 비활성화됨')
    } catch (e) {
      showToast('❌ 변경 실패: ' + e.message)
    }
  }

  const deletePopup = async (id) => {
    if (!window.confirm('팝업을 삭제할까요?')) return
    if (!supabase) return
    try {
      const { error } = await supabase.from('popups').delete().eq('id', id)
      if (error) throw error
      setPopups(prev => prev.filter(p => p.id !== id))
      showToast('삭제됨')
    } catch (e) {
      showToast('❌ 삭제 실패: ' + e.message)
    }
  }

  if (!isAdmin) return null

  const activeCount = popups.filter(p => p.is_active).length

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>📢 팝업 관리</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            활성 팝업 <span style={{ color: ACCENT, fontWeight: 700 }}>{activeCount}개</span> / 전체 {popups.length}개
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ ...S.btn(), padding: '8px 16px', fontSize: 13 }}>+ 팝업 추가</button>
      </div>

      {loading ? (
        <div style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>불러오는 중...</div>
      ) : popups.length === 0 ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📢</div>
          <div style={{ marginBottom: 16 }}>등록된 팝업이 없어요</div>
          <button onClick={() => setShowAdd(true)} style={{ ...S.btn(), fontSize: 13 }}>+ 첫 팝업 추가하기</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {popups.map(p => (
            <div key={p.id} style={{
              background: '#fff', border: `1px solid ${p.is_active ? '#fed7aa' : C.border}`,
              borderLeft: `4px solid ${p.is_active ? ACCENT : '#d1d5db'}`,
              borderRadius: 10, padding: '16px 18px',
              opacity: p.is_active ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                  background: p.bg_color || '#fff',
                  border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>📢</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{p.title}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: p.is_active ? '#fff7ed' : '#f3f4f6',
                      color: p.is_active ? ACCENT : '#9ca3af',
                    }}>{p.is_active ? '활성' : '비활성'}</span>
                    {p.expires_at && (
                      <span style={{ fontSize: 11, color: '#f59e0b' }}>~{fmtDate(p.expires_at)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>{p.content}</div>
                  {p.link_url && (
                    <div style={{ fontSize: 12, color: '#16a34a' }}>🔗 {p.link_url}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>등록 {fmtDate(p.created_at)}</div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => toggleActive(p.id, p.is_active)}
                    style={{ background: 'none', border: `1px solid ${p.is_active ? '#fca5a5' : '#fed7aa'}`, borderRadius: 7, color: p.is_active ? '#ef4444' : ACCENT, cursor: 'pointer', padding: '5px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {p.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button onClick={() => deletePopup(p.id)}
                    style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 7, color: '#f87171', cursor: 'pointer', padding: '5px 9px', fontSize: 13 }}>×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddPopupModal onClose={() => setShowAdd(false)} onSave={addPopup} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '12px 22px', fontSize: 14, color: C.text, zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}
    </div>
  )
}
