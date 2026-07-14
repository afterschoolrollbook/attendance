/**
 * CoupangProducts.jsx — 쿠팡상품(카테고리 탭 + 상품 카탈로그)
 * trader(EasyTrade) 프로젝트의 components/admin/CoupangProductsPanel.js를 이식.
 * Next.js API 라우트(fetch + x-admin-token) 대신 supabase 클라이언트로
 * coupang_products / coupang_product_categories 테이블을 직접 조회·수정한다.
 * (CoupangManage.jsx의 coupang_links/coupang_widgets — 광고 자동노출용 —와는 별개의,
 *  블로그 글 등에 수동으로 붙여넣어 쓸 상품을 카테고리별로 등록해두는 목록)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { Toggle, useConfirm } from '../components/Atoms.jsx'

const ACCENT = '#ea580c'
const ALL_TAB = { id: '', label: '전체' }

const emptyProduct = (categoryId) => ({
  id: null, label: '', url: '', banner_html: '', banner_html_blog: '', category_id: categoryId || '', enabled: true,
})

const C = { border: '#e5e7eb', muted: '#6b7280', text: '#111827', card: '#fff' }
const S = {
  card: { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#111827' },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'monospace', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 },
  btn: (color = ACCENT) => ({ background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }),
  btnGhost: { padding: '10px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
}

// isAdmin 체크만 하는 얇은 wrapper — 아래 Body가 실제 상태/훅을 전부 가진다.
// (CoupangManage.jsx와 동일한 패턴: 훅이 있는 컴포넌트를 통째로 조건부 렌더링해야
//  "훅 개수가 렌더마다 달라지는" 문제 없이 안전하게 얼리 리턴할 수 있다)
export function CoupangProducts({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10
  if (!isAdmin) return null
  return <CoupangProductsBody />
}

function CoupangProductsBody() {
  const confirm = useConfirm()

  const [categories, setCategories] = useState([])
  const [activeTab, setActiveTab] = useState('')
  const [newTab, setNewTab] = useState('')
  const [addingTab, setAddingTab] = useState(false)
  const [conceptDraft, setConceptDraft] = useState('')
  const [savingConcept, setSavingConcept] = useState(false)
  const [conceptSaved, setConceptSaved] = useState(false)

  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const activeCategory = categories.find(c => c.id === activeTab) || null

  const loadCategories = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('coupang_product_categories')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      setCategories(Array.isArray(data) ? data : [])
    } catch { setCategories([]) }
  }

  useEffect(() => { loadCategories() }, [])

  useEffect(() => {
    setConceptDraft(activeCategory?.concept || '')
    setConceptSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeCategory?.concept])

  const loadProducts = useCallback(async () => {
    if (!supabase) return
    setLoadingProducts(true)
    try {
      let query = supabase.from('coupang_products').select('*').order('created_at', { ascending: true })
      if (activeTab) query = query.eq('category_id', activeTab)
      const { data, error } = await query
      if (error) throw error
      setProducts(Array.isArray(data) ? data : [])
    } catch { setProducts([]) }
    setLoadingProducts(false)
  }, [activeTab])

  useEffect(() => { loadProducts(); setEditing(null) }, [loadProducts])

  const addTab = async () => {
    const label = newTab.trim()
    if (!label || categories.find(c => c.label === label)) { setNewTab(''); return }
    setAddingTab(true)
    try {
      const row = { id: uid(), label, concept: '', created_at: now() }
      const { data, error } = await supabase.from('coupang_product_categories').insert(row).select().single()
      if (error) throw error
      setCategories(p => [...p, data])
      setActiveTab(data.id)
      setNewTab('')
    } catch { alert('탭 추가 실패') }
    setAddingTab(false)
  }

  const deleteTab = async (id, label) => {
    if (!window.confirm(`"${label}" 탭을 삭제할까요? (이 탭에 등록된 상품은 삭제되지 않고 '전체'에서 계속 보여요)`)) return
    try {
      const { error } = await supabase.from('coupang_product_categories').delete().eq('id', id)
      if (error) throw error
      setCategories(p => p.filter(c => c.id !== id))
      if (activeTab === id) setActiveTab('')
      loadProducts() // FK(on delete set null)로 해당 상품들의 category_id가 비워지므로 목록 새로고침
    } catch { alert('탭 삭제 실패') }
  }

  const saveConcept = async () => {
    if (!activeTab) return
    setSavingConcept(true)
    try {
      const { error } = await supabase.from('coupang_product_categories').update({ concept: conceptDraft }).eq('id', activeTab)
      if (error) throw error
      setCategories(p => p.map(c => c.id === activeTab ? { ...c, concept: conceptDraft } : c))
      setConceptSaved(true)
      setTimeout(() => setConceptSaved(false), 2000)
    } catch {}
    setSavingConcept(false)
  }

  const setField = (k, v) => setEditing(p => ({ ...p, [k]: v }))

  const saveProduct = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const base = {
        label: editing.label ?? '',
        url: editing.url ?? '',
        banner_html: editing.banner_html ?? '',
        banner_html_blog: editing.banner_html_blog ?? '',
        category_id: editing.category_id || null,
        enabled: editing.enabled === undefined ? true : !!editing.enabled,
      }
      if (isNew) {
        const row = { ...base, id: uid(), created_at: now(), updated_at: now() }
        const { error } = await supabase.from('coupang_products').insert(row)
        if (error) throw error
      } else {
        const { error } = await supabase.from('coupang_products').update({ ...base, updated_at: now() }).eq('id', editing.id)
        if (error) throw error
      }
      await loadProducts()
      setEditing(null)
    } catch {
      alert('저장 실패')
    }
    setSaving(false)
  }

  const handleDeleteProduct = (id) => {
    confirm('이 상품을 삭제할까요?', async () => {
      try {
        const { error } = await supabase.from('coupang_products').delete().eq('id', id)
        if (error) throw error
        setProducts(p => p.filter(x => x.id !== id))
        if (editing?.id === id) setEditing(null)
      } catch { alert('삭제 실패') }
    })
  }

  const tabs = [ALL_TAB, ...categories]
  const categoryOptions = [{ value: '', label: '(미분류)' }, ...categories.map(c => ({ value: c.id, label: c.label }))]

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>📦 쿠팡상품</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          블로그 글 등에 수동으로 붙여넣어 쓸 쿠팡 상품을 등록해두는 목록입니다. (자동 판매/노출 기능 아님)
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {tabs.map(tab => (
          <div key={tab.id || 'all'} style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={() => setActiveTab(tab.id)} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${activeTab === tab.id ? ACCENT : C.border}`,
              background: activeTab === tab.id ? 'rgba(234,88,12,0.10)' : 'transparent',
              color: activeTab === tab.id ? ACCENT : C.muted,
              fontFamily: 'Noto Sans KR, sans-serif',
            }}>{tab.label}</button>
            {tab.id && (
              <button onClick={() => deleteTab(tab.id, tab.label)} title="탭 삭제" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: C.muted,
                fontSize: 13, marginLeft: -4, padding: '2px 6px',
              }}>×</button>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={newTab} onChange={e => setNewTab(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTab()}
            placeholder="+ 탭 추가"
            style={{
              width: 100, padding: '6px 10px', borderRadius: 999, fontSize: 12,
              background: '#fff', border: `1.5px dashed ${C.border}`, color: C.text,
              fontFamily: 'Noto Sans KR, sans-serif',
            }} />
          <button onClick={addTab} disabled={addingTab || !newTab.trim()} style={{
            padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${ACCENT}`, background: 'transparent', color: ACCENT,
            opacity: !newTab.trim() ? 0.5 : 1, fontFamily: 'Noto Sans KR, sans-serif',
          }}>추가</button>
        </div>
      </div>

      {activeTab && (
        <div style={{
          marginBottom: 16, padding: '12px 14px', background: '#fff7ed',
          border: '1px dashed #fed7aa', borderRadius: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>
            🏷️ "{activeCategory?.label}" 탭 컨셉
          </div>
          <textarea value={conceptDraft} onChange={e => setConceptDraft(e.target.value)}
            rows={2} placeholder="이 탭에 어떤 상품을 등록할지 메모해두세요 (예: 초등 학습 교구, 가성비 위주)"
            style={{ ...S.textarea, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button onClick={saveConcept} disabled={savingConcept} style={{ ...S.btn(ACCENT), opacity: savingConcept ? 0.6 : 1 }}>
              {savingConcept ? '저장 중...' : '컨셉 저장'}
            </button>
            {conceptSaved && <span style={{ fontSize: 12, color: '#16a34a' }}>✅ 저장됨</span>}
          </div>
        </div>
      )}

      {/* 상품이 많아져도 옆으로 채워지는 그리드 — 세로로 끝없이 안 늘어나게 */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ ...S.cardTitle, marginBottom: 0 }}>📦 상품 목록 ({products.length}개)</div>
          <button onClick={() => setEditing(emptyProduct(activeTab))} style={S.btn(ACCENT)}>+ 상품 추가</button>
        </div>

        {loadingProducts ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.muted }}>불러오는 중...</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 13 }}>아직 등록된 상품이 없어요.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {products.map(p => (
              <button key={p.id} onClick={() => setEditing({ ...p })} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                border: `1.5px solid ${editing?.id === p.id ? ACCENT : C.border}`,
                background: editing?.id === p.id ? 'rgba(234,88,12,0.06)' : '#fff',
              }}>
                <span style={{ fontSize: 10, flexShrink: 0, color: p.enabled ? '#16a34a' : '#9ca3af' }}>●</span>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: C.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.label || '(이름없음)'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div style={S.card}>
          <div style={S.cardTitle}>{editing.id ? '✏️ 상품 편집' : '➕ 새 상품'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div>
              <label style={S.label}>상품명</label>
              <input value={editing.label} onChange={e => setField('label', e.target.value)}
                placeholder="예: 초등 학습 교구" style={S.input} />
            </div>
            <div>
              <label style={S.label}>탭(카테고리)</label>
              <select value={editing.category_id || ''} onChange={e => setField('category_id', e.target.value)} style={S.input}>
                {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>링크</label>
              <input value={editing.url} onChange={e => setField('url', e.target.value)}
                placeholder="https://link.coupang.com/a/... 또는 https://coupa.ng/..." style={S.input} />
            </div>
            <div>
              <label style={S.label}>일반 태그</label>
              <textarea value={editing.banner_html} onChange={e => setField('banner_html', e.target.value)}
                rows={3} placeholder='<a href="https://link.coupang.com/a/..." target="_blank" ...><img src="..." ...></a>'
                style={S.textarea} />
            </div>
            <div>
              <label style={S.label}>블로그용 태그</label>
              <textarea value={editing.banner_html_blog} onChange={e => setField('banner_html_blog', e.target.value)}
                rows={3} placeholder='<a href="https://link.coupang.com/a/..." target="_blank" ...><img src="..." ...></a>'
                style={S.textarea} />
            </div>

            {(editing.banner_html || editing.banner_html_blog) && (
              <div>
                <label style={S.label}>미리보기</label>
                <div style={{
                  padding: '10px 12px', background: '#fafaf9', border: '1px dashed #e5e7eb',
                  borderRadius: 8, overflow: 'auto',
                }} dangerouslySetInnerHTML={{ __html: editing.banner_html || editing.banner_html_blog || '' }} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={S.label}>사용</label>
              <Toggle checked={editing.enabled} onChange={v => setField('enabled', v)} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveProduct} disabled={saving} style={{ ...S.btn(ACCENT), opacity: saving ? 0.6 : 1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setEditing(null)} style={S.btnGhost}>취소</button>
              {editing.id && (
                <button onClick={() => handleDeleteProduct(editing.id)} style={{ ...S.btnGhost, borderColor: '#f44336', color: '#f44336' }}>
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
