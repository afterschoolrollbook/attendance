import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../hooks/useToast.js'

const C = { border: '#e5e7eb', text: '#111827', muted: '#6b7280', primary: '#f97316', success: '#16a34a', danger: '#ef4444' }

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
// 새로고침해도 업로드 목록이 사라지지 않도록 완료된 항목만 localStorage에 저장한다
// (업로드 중이거나 실패한 항목은 새로고침 시점엔 이미 의미가 없어져서 제외).
// ⚠️ 앱 시작 시 App.jsx 쪽에 'sb-'/'asa_'/'access_warn_sent_' 접두사가 아닌 localStorage
// 키를 전부 지우는 정리 루틴이 있다(2026-07-19에 라이브 번들에서 직접 확인함 — 새로고침할
// 때마다 업로드 목록이 사라지던 진짜 원인이 이거였고, 처음에 effect 실행 순서 레이스로
// 잘못 짚었었다). 그 정리 루틴에 걸리지 않도록 반드시 'asa_' 접두사를 붙여야 한다.
const STORAGE_KEY = 'asa_blog_image_uploads'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 특정 글에 종속되지 않는 독립 이미지 업로드함 — 외부 자료 스크린샷 등을 미리 올려서
// URL만 받아두고, 어느 글의 어디에 쓸지는 나중에(채팅으로 Claude에게 "N번" 식으로 전달해서) 정한다.
// 업로드/삭제는 api/admin/blog-images.js(서비스롤 키)를 거친다 — 원래는 dbCall('storageUpload')로
// anon 키 + RLS 정책에 의존했는데, 이 화면에 기능을 추가할 때마다 새 RLS 정책이 필요해서
// 반복적으로 문제가 생겼다(2026-07-19). 서비스롤 키가 RLS를 완전히 우회하므로 이제 이
// 화면 쪽 기능은 앞으로 RLS 정책 없이 확장 가능하다.
export function BlogImagePanel() {
  const { success, error: toastError } = useToast()
  const [items, setItems] = useState([]) // { id, seq, filename, previewUrl, url, path, status, error }
  const [copiedId, setCopiedId] = useState('')
  const [previewItem, setPreviewItem] = useState(null) // 썸네일 클릭 시 크게 보여줄 항목
  const fileInputRef = useRef(null)
  // 업로드 순서를 가리키는 번호는 삭제해도 재배치되지 않도록 별도 카운터로 관리한다
  // (배열 index로 매기면 앞의 항목을 지웠을 때 뒤 항목 번호가 밀려서, 채팅에서 이미
  // 말해둔 "3번"이 다른 사진을 가리키게 되는 문제가 생긴다).
  const seqRef = useRef(0)
  // 복원(localStorage → state) effect가 끝나기 전에 저장 effect가 먼저 실행돼서
  // 빈 배열([])로 기존 저장 내용을 덮어써버리는 레이스가 이론상 있어서 막아둔다
  // (실제 "새로고침하면 사라짐" 버그의 진짜 원인은 STORAGE_KEY 접두사 문제였지만,
  // 이 가드 자체도 불필요한 건 아니라 유지한다).
  const hydratedRef = useRef(false)

  // 마운트 시 이전에 저장해둔 완료 항목을 복원한다 (새로고침 대비).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(saved) && saved.length > 0) {
        setItems(saved)
        seqRef.current = saved.reduce((max, it) => Math.max(max, it.seq || 0), 0)
      }
    } catch {}
    hydratedRef.current = true
  }, [])

  // 완료된 항목만 골라 localStorage에 저장 — 업로드/삭제/새 항목 추가마다 자동 반영.
  useEffect(() => {
    if (!hydratedRef.current) return // 복원 전에는 절대 쓰지 않는다(빈 배열로 덮어쓰기 방지)
    try {
      const persistable = items
        .filter(it => it.status === 'done')
        .map(({ id, seq, filename, url, path }) => ({ id, seq, filename, url, path, status: 'done' }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable))
    } catch {}
  }, [items])

  const uploadOne = async (file) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    seqRef.current += 1
    const seq = seqRef.current
    const previewUrl = URL.createObjectURL(file)
    setItems(prev => [{ id, seq, filename: file.name, previewUrl, url: '', path: '', status: 'uploading', error: '' }, ...prev])

    try {
      if (!ALLOWED.includes(file.type)) throw new Error('이미지 파일(jpg/png/gif/webp)만 업로드할 수 있습니다.')
      if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하 파일만 업로드할 수 있습니다.')
      const base64 = await fileToBase64(file)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다.')
      const res = await fetch('/api/admin/blog-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ base64, contentType: file.type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '업로드 실패')
      setItems(prev => prev.map(it => it.id === id ? { ...it, url: data.url, path: data.path, status: 'done' } : it))
    } catch (e) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'error', error: e.message } : it))
    }
  }

  const handleFiles = (fileList) => {
    Array.from(fileList || []).forEach(uploadOne)
  }

  const onInputChange = (e) => {
    handleFiles(e.target.files)
    e.target.value = '' // 같은 파일을 다시 선택해도 onChange가 발생하도록 초기화
  }

  const onDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const copyUrl = (id, seq, url) => {
    if (!url) return
    try {
      navigator.clipboard.writeText(`${seq}번 ${url}`)
      setCopiedId(id)
      setTimeout(() => setCopiedId(''), 1500)
      success('✅ 번호와 함께 복사됐습니다')
    } catch {}
  }

  const deleteItem = async (item) => {
    if (item.path) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch('/api/admin/blog-images', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ path: item.path }),
          })
        }
      } catch {}
    }
    try { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl) } catch {}
    setItems(prev => prev.filter(it => it.id !== item.id))
    success('🗑️ 삭제됨')
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>🖼️ 블로그 사진</h1>
        <p style={{ fontSize: '13px', color: C.muted, marginTop: '4px', lineHeight: 1.6 }}>
          외부 자료 스크린샷 등 이미지를 여기서 올리면 바로 URL이 생성됩니다. 어느 글에 쓸지는
          정해두지 않아도 되고, 앞의 번호와 함께 URL을 복사해서 Claude 채팅에 "N번 사진이에요"처럼
          붙여넣으면 원하는 글의 원하는 위치에 삽입해드립니다. 완료된 목록은 새로고침해도 유지됩니다.
        </p>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${C.border}`, borderRadius: 12, padding: '32px 20px',
          textAlign: 'center', cursor: 'pointer', marginBottom: 20, background: '#f9fafb',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>클릭하거나 이미지를 여기로 끌어다 놓으세요</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>jpg / png / gif / webp, 10MB 이하 (여러 장 동시 선택 가능)</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {items.length === 0 && (
        <p style={{ fontSize: 13, color: C.muted }}>아직 업로드한 이미지가 없습니다.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(it => (
          <div key={it.id} style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#f9fafb',
              border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: C.primary,
            }}>{it.seq}</div>
            <img
              src={it.url || it.previewUrl}
              alt=""
              onClick={() => (it.url || it.previewUrl) && setPreviewItem(it)}
              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f3f4f6', cursor: (it.url || it.previewUrl) ? 'zoom-in' : 'default' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.seq}번 · {it.filename}
              </div>
              {it.status === 'uploading' && <div style={{ fontSize: 12, color: C.muted }}>업로드 중...</div>}
              {it.status === 'error' && <div style={{ fontSize: 12, color: C.danger }}>❌ {it.error}</div>}
              {it.status === 'done' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input readOnly value={it.url} onFocus={e => e.target.select()}
                    style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.text, fontFamily: 'inherit' }} />
                  <button onClick={() => copyUrl(it.id, it.seq, it.url)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none', background: copiedId === it.id ? C.muted : C.success, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {copiedId === it.id ? '복사됨!' : '복사'}
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => deleteItem(it)} title="삭제" style={{
              flexShrink: 0, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
              color: C.danger, fontSize: 12, fontWeight: 700, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit',
            }}>삭제</button>
          </div>
        ))}
      </div>

      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <img
              src={previewItem.url || previewItem.previewUrl}
              alt=""
              style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 10, display: 'block', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff', fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{previewItem.seq}번 · {previewItem.filename}</span>
              <button onClick={() => setPreviewItem(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
