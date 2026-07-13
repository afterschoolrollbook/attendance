/**
 * CoupangManage.jsx — 쿠팡 파트너스 링크/배너 관리
 * Fresh_Season components/admin/CoupangPanel.js를 그대로 이식.
 * Next.js API 라우트(fetch) 대신 supabase 클라이언트로 coupang_links / coupang_widgets 테이블을 직접 조회한다.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'

const ACCENT = '#ea580c'

const EMPTY_LINK   = { label: '', url: '', enabled: true }
const EMPTY_WIDGET = { label: '', size: '728x90', widget_html: '', enabled: true }

// 쿠팡 파트너스 배너 생성 페이지 사이즈 탭 그대로 + 우리 사이트 어느 슬롯에 맞는지 표시
const BANNER_SIZE_OPTIONS = [
  { value: '728x90',  label: '728×90  → 상단/중단/하단 배너' },
  { value: '300x250', label: '300×250 → 대기화면' },
  { value: '160x600', label: '160×600 → 사이드바' },
  { value: '600x900', label: '600×900' },
  { value: '320x480', label: '320×480' },
  { value: '320x100', label: '320×100' },
  { value: '320x50',  label: '320×50' },
  { value: '200x200', label: '200×200' },
  { value: '150x60',  label: '150×60' },
  { value: '120x60',  label: '120×60' },
]

const C = { border: '#e5e7eb', muted: '#6b7280', text: '#111827', card: '#fff' }
const S = {
  card: { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#0f1f0f' },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'monospace', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 },
  btn: (color = ACCENT) => ({ background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }),
  btnGhost: { padding: '10px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
  row: { background: '#f9fafb', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' },
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 50, height: 28, borderRadius: 14, background: value ? '#16a34a' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', position: 'absolute', top: 3, left: value ? 25 : 3, transition: 'left 0.2s' }} />
    </div>
  )
}

// ── 쿠팡 파트너스 바로가기 카드
// 쿠팡 파트너스 공식 링크 생성 도구를 거치지 않은 URL은 실적으로 집계되지 않으므로
// 링크/위젯은 반드시 쿠팡 파트너스 사이트에서 직접 생성한 뒤 아래 목록에 등록해야 한다.
function ShortcutCard() {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>🔗 쿠팡 파트너스</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 10, marginBottom: 14, lineHeight: 1.6 }}>
        링크/배너는 반드시 쿠팡 파트너스 사이트에서 직접 생성해야 실적(수익)으로 집계됩니다.
        생성한 링크는 아래 "링크 목록"에, 위젯 코드는 "위젯 목록"에 등록하세요.
      </div>
      <a href="https://partners.coupang.com/" target="_blank" rel="noopener noreferrer"
        style={{ ...S.btn(ACCENT), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
        🔗 쿠팡파트너스 바로가기
      </a>
    </div>
  )
}

// ── 공용: 여러 개 추가되는 목록의 개별 행
function RepeatableRow({ table, item, isNew, fields, renderPreview, onSaved, onDeleted, onCancelNew }) {
  const [form, setForm] = useState(item)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(isNew)
  const [deleting, setDeleting] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!supabase) return
    setSaving(true)
    try {
      if (isNew) {
        const row = { ...form, id: uid(), created_at: now(), updated_at: now() }
        const { data, error } = await supabase.from(table).insert([row]).select().single()
        if (error) throw error
        onSaved(true, data)
      } else {
        const patch = { ...form, updated_at: now() }
        delete patch.id
        const { error } = await supabase.from(table).update(patch).eq('id', item.id)
        if (error) throw error
        onSaved(false, { ...form, id: item.id })
      }
    } catch (e) {
      alert('저장 실패: ' + e.message)
    }
    setSaving(false)
  }

  const del = async () => {
    if (!window.confirm(`"${form.label || '이 항목'}"을(를) 삭제할까요?`)) return
    if (!supabase) return
    setDeleting(true)
    try {
      const { error } = await supabase.from(table).delete().eq('id', item.id)
      if (error) throw error
      onDeleted(item.id)
    } catch (e) {
      alert('삭제 실패: ' + e.message)
    }
    setDeleting(false)
  }

  return (
    <div style={{ ...S.row, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(p => !p)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, color: '#0f1f0f' }}>{form.label || (isNew ? '(새 항목)' : '(이름없음)')}</span>
          {form.size && (
            <span style={{ fontSize: 11, color: ACCENT, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '1px 8px', fontWeight: 700 }}>
              {form.size}
            </span>
          )}
          {form.enabled ? <span style={{ fontSize: 11, color: '#16a34a' }}>● 사용중</span> : <span style={{ fontSize: 11, color: '#9ca3af' }}>○ 꺼짐</span>}
        </div>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </div>

      {renderPreview && (form.widget_html || form.url) && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#fafaf9', border: '1px dashed #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
          {renderPreview(form)}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={S.label}>{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.key] || (f.options && f.options[0]?.value) || ''} onChange={e => set(f.key, e.target.value)} style={S.input}>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.multiline ? (
                <textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={3} style={S.textarea} placeholder={f.placeholder} />
              ) : (
                <input value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} style={S.input} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={S.label}>사용</label>
            <Toggle value={form.enabled} onChange={v => set('enabled', v)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ ...S.btn(ACCENT), flex: 1, opacity: saving ? 0.6 : 1 }}>
              {saving ? '저장 중...' : (isNew ? '추가' : '저장하기')}
            </button>
            {isNew ? (
              <button onClick={onCancelNew} style={S.btnGhost}>취소</button>
            ) : (
              <button onClick={del} disabled={deleting}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff1f2', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 공용: 여러 개 추가되는 목록 카드
function RepeatableListCard({ table, title, description, empty, fields, addLabel, renderPreview, notice }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDraft, setNewDraft] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true })
      if (error) throw error
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }, [table])

  useEffect(() => { load() }, [load])

  const addNew = () => setNewDraft({ ...empty })
  const onSaved = (isNew, row) => {
    if (isNew) { setItems(p => [...p, row]); setNewDraft(null) }
    else setItems(p => p.map(x => x.id === row.id ? row : x))
  }
  const onDeleted = (id) => setItems(p => p.filter(x => x.id !== id))

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4, marginBottom: 16 }}>{description}</div>

      {notice && (
        <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12, color: '#9a3412', lineHeight: 1.7 }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>불러오는 중...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {items.map(it => (
            <RepeatableRow key={it.id} table={table} item={it} isNew={false}
              fields={fields} renderPreview={renderPreview} onSaved={onSaved} onDeleted={onDeleted} />
          ))}
          {newDraft && (
            <RepeatableRow table={table} item={newDraft} isNew={true}
              fields={fields} renderPreview={renderPreview} onSaved={onSaved} onDeleted={() => {}} onCancelNew={() => setNewDraft(null)} />
          )}
          {items.length === 0 && !newDraft && (
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>
              아직 등록된 항목이 없어요.
            </div>
          )}
        </div>
      )}

      {!newDraft && (
        <button onClick={addNew} style={{ ...S.btn(ACCENT), width: '100%' }}>{addLabel}</button>
      )}
    </div>
  )
}

export function CoupangManage({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10
  if (!isAdmin) return null

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>🛒 쿠팡 관리</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          쿠팡 파트너스 사이트에서 만든 링크/위젯을 등록하세요.
        </div>
      </div>

      <ShortcutCard />

      <RepeatableListCard
        table="coupang_links"
        title="📋 링크 목록 (필요한 만큼 추가)"
        description="쿠팡 링크(URL)만 추가하는 목록입니다. 위젯 코드는 아래 위젯 목록에서 따로 추가하세요."
        empty={EMPTY_LINK}
        addLabel="+ 링크 추가"
        fields={[
          { key: 'label', label: '이름 (구분용)', placeholder: '예: 저출력 로봇청소기, 초등 학습 교구' },
          { key: 'url',   label: '링크 URL', placeholder: 'https://link.coupang.com/a/... 또는 https://coupa.ng/...' },
        ]}
      />

      <RepeatableListCard
        table="coupang_widgets"
        title="🖼️ 배너/위젯 목록 (사이즈별로 필요한 만큼 추가)"
        description="쿠팡 파트너스에서 만든 배너/위젯 코드를 등록하는 목록입니다. 링크(URL)만 있는 경우엔 위 링크 목록을 이용하세요."
        empty={EMPTY_WIDGET}
        addLabel="+ 배너/위젯 추가"
        notice={
          <>
            <strong>⚠️ 쿠팡 파트너스에서 배너 만들 때 꼭 확인하세요</strong><br />
            배너 생성 페이지 오른쪽 "HTML" 영역에서 <strong>자바스크립트 태그 / iframe 태그가 아니라
            반드시 "HTML 태그"</strong>를 선택한 뒤 코드를 복사해서 아래에 붙여넣으세요.<br />
            사이즈는 아래 드롭다운에서 방금 쿠팡 사이트에서 만든 것과 같은 사이즈를 선택하면,
            어느 슬롯에 넣으면 좋을지 옆에 같이 표시됩니다.
          </>
        }
        fields={[
          { key: 'label', label: '이름 (구분용)', placeholder: '예: 로켓배송1, 문구완구1' },
          { key: 'size', label: '사이즈', type: 'select', options: BANNER_SIZE_OPTIONS },
          { key: 'widget_html', label: '배너/위젯 코드 (HTML 태그)', placeholder: '<a href="https://link.coupang.com/a/..." target="_blank" ...><img src="..." ...></a>', multiline: true },
        ]}
        renderPreview={(item) => (
          <div dangerouslySetInnerHTML={{ __html: item.widget_html || '' }} />
        )}
      />
    </div>
  )
}
