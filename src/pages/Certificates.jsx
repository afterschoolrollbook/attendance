import React, { useState, useEffect } from 'react'
import { uid, now } from '../lib/utils.js'
import { supabase } from '../lib/supabase.js'

const C = { primary:'#f97316', success:'#16a34a', danger:'#ef4444', border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff' }
const STORAGE_KEY = 'asa_certificates'

function loadCertPartners() {
  try {
    const ts = JSON.parse(localStorage.getItem('asa_settings_teacherService') || 'null')
    return ts?.certPartners || []
  } catch { return [] }
}

function loadData(tid) { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').filter(r=>r.teacherId===tid) }
function saveItem(item) { const a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); const i=a.findIndex(r=>r.id===item.id); if(i>=0)a[i]=item; else a.push(item); localStorage.setItem(STORAGE_KEY,JSON.stringify(a)) }
function deleteItem(id) { localStorage.setItem(STORAGE_KEY,JSON.stringify(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').filter(r=>r.id!==id))) }

const EMPTY = { name:'', issuer:'', issuedAt:'', expiresAt:'', certNumber:'', memo:'' }

export function Certificates({ user }) {
  const [tab, setTab]         = useState('list')
  const [records, setRecords] = useState([])
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [certPartners]        = useState(() => loadCertPartners())

  const reload = () => setRecords(loadData(user.id))
  useEffect(() => reload(), [])

  const sorted = [...records].sort((a,b) => (b.issuedAt||'').localeCompare(a.issuedAt||''))

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = r => { setForm({ name:r.name, issuer:r.issuer||'', issuedAt:r.issuedAt||'', expiresAt:r.expiresAt||'', certNumber:r.certNumber||'', memo:r.memo||'' }); setEditId(r.id); setModal(true) }

  const save = () => {
    if (!form.name.trim()) { alert('자격증명을 입력하세요'); return }
    const item = { id: editId||uid(), teacherId:user.id, ...form, updatedAt:now() }
    if (!editId) item.createdAt = now()
    saveItem(item); reload(); setModal(false)
  }

  const uploadFile = async (certId, file) => {
    setUploading(true)
    try {
      const path = `certificates/${user.id}/${certId}/${file.name}`
      const { error } = await supabase.storage.from('teacher-files').upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from('teacher-files').getPublicUrl(path)
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')
      const idx = all.findIndex(r=>r.id===certId)
      if (idx>=0) { all[idx].fileUrl=data.publicUrl; all[idx].fileName=file.name }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); reload()
    } catch(e) { alert('업로드 실패: '+e.message) }
    finally { setUploading(false) }
  }

  const isExpired = r => r.expiresAt && r.expiresAt < new Date().toISOString().slice(0,10)
  const expiringSoon = r => {
    if (!r.expiresAt) return false
    const diff = (new Date(r.expiresAt) - new Date()) / 86400000
    return diff > 0 && diff <= 90
  }

  return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🏆 자격증관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>보유 자격증 및 취득 기관 안내</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {[['list','📋 내 자격증'],['partners','🏛 취득 기관 안내']].map(([t,label]) => (
            <button key={t} onClick={()=>setTab(t)}
              style={{ padding:'8px 16px', borderRadius:'9px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'13px', background: tab===t?C.primary:'#f3f4f6', color: tab===t?'#fff':C.muted }}>
              {label}
            </button>
          ))}
          {tab === 'list' && (
            <button onClick={openAdd} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:'#18181b', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 자격증 추가</button>
          )}
        </div>
      </div>

      {/* ── 내 자격증 탭 */}
      {tab === 'list' && (
        <>
          {/* 통계 */}
          {records.length > 0 && (
            <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
              {[
                { label:'총 자격증', value:`${records.length}개`, color:C.primary, bg:'#fff7ed', border:'#fed7aa' },
                { label:'유효', value:`${records.filter(r=>!isExpired(r)).length}개`, color:C.success, bg:'#f0fdf4', border:'#86efac' },
                { label:'만료임박(90일)', value:`${records.filter(expiringSoon).length}개`, color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
                { label:'만료', value:`${records.filter(isExpired).length}개`, color:C.danger, bg:'#fef2f2', border:'#fca5a5' },
              ].map(s => (
                <div key={s.label} style={{ padding:'10px 18px', borderRadius:'10px', background:s.bg, border:`1px solid ${s.border}` }}>
                  <div style={{ fontSize:'18px', fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:'11px', color:C.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {sorted.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏆</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 자격증이 없습니다</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 자격증 추가 버튼으로 등록하세요</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'12px' }}>
              {sorted.map(r => {
                const expired = isExpired(r)
                const soon = expiringSoon(r)
                return (
                  <div key={r.id} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${expired?'#fca5a5':soon?'#fde68a':C.border}`, padding:'16px', position:'relative' }}>
                    {expired && <span style={{ position:'absolute', top:'12px', right:'12px', fontSize:'10px', background:'#fef2f2', color:C.danger, border:'1px solid #fca5a5', borderRadius:'5px', padding:'1px 6px', fontWeight:700 }}>만료</span>}
                    {soon && !expired && <span style={{ position:'absolute', top:'12px', right:'12px', fontSize:'10px', background:'#fffbeb', color:'#b45309', border:'1px solid #fde68a', borderRadius:'5px', padding:'1px 6px', fontWeight:700 }}>만료임박</span>}
                    <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'8px', paddingRight:'60px' }}>{r.name}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px', fontSize:'12px', color:C.muted, marginBottom:'10px' }}>
                      {r.issuer && <span>🏛 {r.issuer}</span>}
                      {r.certNumber && <span>🔢 자격번호: {r.certNumber}</span>}
                      {r.issuedAt && <span>📅 취득일: {r.issuedAt}</span>}
                      {r.expiresAt && <span style={{ color: expired?C.danger:soon?'#b45309':C.muted }}>⏰ 만료일: {r.expiresAt}</span>}
                      {r.memo && <span>📌 {r.memo}</span>}
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      {r.fileUrl
                        ? <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:'#3b82f6', textDecoration:'none' }}>📎 {r.fileName||'첨부파일'}</a>
                        : <label style={{ fontSize:'12px', color:C.muted, cursor:'pointer', textDecoration:'underline' }}>📎 파일 첨부<input type="file" style={{ display:'none' }} onChange={e=>e.target.files[0]&&uploadFile(r.id,e.target.files[0])} /></label>
                      }
                      <button onClick={()=>openEdit(r)} style={{ marginLeft:'auto', padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                      <button onClick={()=>{ if(confirm('삭제할까요?')){ deleteItem(r.id); reload() } }} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>삭제</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 취득 기관 안내 탭 */}
      {tab === 'partners' && (
        <div>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'16px' }}>
            자격증을 취득할 수 있는 제휴 기관 및 공식 기관 안내입니다.
          </div>
          {certPartners.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏛</div>
              <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 제휴 기관이 없습니다</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>관리자가 제휴처를 등록하면 여기에 표시됩니다</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'12px' }}>
              {certPartners.map((p, i) => {
                const tagColors = { '제휴':'#eff6ff:#bfdbfe:#1d4ed8', '광고':'#fff7ed:#fed7aa:#9a3412', '공식':'#f0fdf4:#86efac:#15803d' }
                const [bg, border, textColor] = (tagColors[p.tag] || '#f3f4f6:#d1d5db:#374151').split(':')
                return (
                  <div key={p.id || i} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${border}`, padding:'18px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'8px' }}>
                      <span style={{ fontSize:'15px', fontWeight:700, color:C.text, flex:1, paddingRight:'8px' }}>{p.name}</span>
                      <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'5px', background:bg, border:`1px solid ${border}`, color:textColor, fontWeight:700, flexShrink:0 }}>{p.tag}</span>
                    </div>
                    {p.desc && <div style={{ fontSize:'12px', color:C.muted, marginBottom:'10px', lineHeight:1.5 }}>{p.desc}</div>}
                    {p.subjects?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'12px' }}>
                        {p.subjects.map((s, si) => (
                          <span key={si} style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, borderRadius:'5px', padding:'2px 8px' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'9px', background:'#f0fdf4', border:'1.5px solid #86efac', color:C.success, fontSize:'13px', fontWeight:700, textDecoration:'none' }}>
                        🔗 바로가기
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>{editId ? '자격증 편집' : '자격증 추가'}</span>
              <button onClick={()=>setModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'13px' }}>
              {[
                { label:'자격증명 *', key:'name', placeholder:'예: 로봇전문지도사 2급' },
                { label:'발급기관', key:'issuer', placeholder:'예: 한국로봇산업협회' },
                { label:'자격번호', key:'certNumber', placeholder:'자격증 번호' },
                { label:'취득일', key:'issuedAt', type:'date', placeholder:'' },
                { label:'만료일', key:'expiresAt', type:'date', placeholder:'없으면 비워두세요' },
                { label:'메모', key:'memo', placeholder:'비고' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button onClick={save} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
                <button onClick={()=>setModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {uploading && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 파일 업로드 중...</div></div>}
    </div>
  )
}
