import React, { useState, useEffect } from 'react'
import { uid, now } from '../lib/utils.js'


const C = { primary:'#f97316', success:'#16a34a', danger:'#ef4444', border:'#e5e7eb', text:'#111827', muted:'#6b7280', card:'#fff' }
const STORAGE_KEY = 'asa_career'

function loadData(tid) { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').filter(r=>r.teacherId===tid) }
function saveItem(item) { const a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); const i=a.findIndex(r=>r.id===item.id); if(i>=0)a[i]=item; else a.push(item); localStorage.setItem(STORAGE_KEY,JSON.stringify(a)) }
function deleteItem(id) { localStorage.setItem(STORAGE_KEY,JSON.stringify(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').filter(r=>r.id!==id))) }

const EMPTY = { orgName:'', role:'', subject:'', startDate:'', endDate:'', isCurrent:false, description:'' }

export function Career({ user }) {
  const [records, setRecords] = useState([])
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [uploading, setUploading] = useState(false)

  const reload = () => setRecords(loadData(user.id))
  useEffect(() => reload(), [])

  const sorted = [...records].sort((a,b) => {
    if (a.isCurrent && !b.isCurrent) return -1
    if (!a.isCurrent && b.isCurrent) return 1
    return (b.startDate||'').localeCompare(a.startDate||'')
  })

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = r => { setForm({ orgName:r.orgName, role:r.role||'', subject:r.subject||'', startDate:r.startDate||'', endDate:r.endDate||'', isCurrent:!!r.isCurrent, description:r.description||'' }); setEditId(r.id); setModal(true) }

  const save = () => {
    if (!form.orgName.trim()) { alert('기관명을 입력하세요'); return }
    const item = { id:editId||uid(), teacherId:user.id, ...form, updatedAt:now() }
    if (!editId) item.createdAt = now()
    saveItem(item); reload(); setModal(false)
  }

  const uploadFile = async (careerId, file) => {
    setUploading(true)
    try {
      const path = `career/${user.id}/${careerId}/${file.name}`
      const { supabase } = await import('../lib/supabase.js')
      const { error } = await supabase.storage.from('teacher-files').upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from('teacher-files').getPublicUrl(path)
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')
      const idx = all.findIndex(r=>r.id===careerId)
      if (idx>=0) { all[idx].fileUrl=data.publicUrl; all[idx].fileName=file.name }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); reload()
    } catch(e) { alert('업로드 실패: '+e.message) }
    finally { setUploading(false) }
  }

  const getDuration = r => {
    if (!r.startDate) return ''
    const start = new Date(r.startDate)
    const end   = r.isCurrent ? new Date() : new Date(r.endDate || new Date())
    const months = Math.round((end - start) / (1000*60*60*24*30))
    if (months < 12) return `${months}개월`
    return `${Math.floor(months/12)}년 ${months%12}개월`
  }

  return (
    <div style={{ padding:'24px', maxWidth:'900px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>📋 이력관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>강사 활동 이력 및 관련 서류 관리</p>
        </div>
        <button onClick={openAdd} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 이력 추가</button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 이력이 없습니다</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 이력 추가 버튼으로 경력을 등록하세요</div>
        </div>
      ) : (
        <div style={{ position:'relative' }}>
          {/* 타임라인 선 */}
          <div style={{ position:'absolute', left:'19px', top:'24px', bottom:'24px', width:'2px', background:'#e5e7eb' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {sorted.map((r, idx) => (
              <div key={r.id} style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
                {/* 타임라인 점 */}
                <div style={{ width:'38px', height:'38px', borderRadius:'50%', background: r.isCurrent ? C.primary : '#f3f4f6', border:`2px solid ${r.isCurrent ? C.primary : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                  <span style={{ fontSize:'16px' }}>{r.isCurrent ? '🏫' : '🏛'}</span>
                </div>
                <div style={{ flex:1, borderRadius:'12px', border:`1.5px solid ${r.isCurrent ? '#fed7aa' : C.border}`, padding:'14px 16px', background: r.isCurrent ? '#fffbf5' : C.card }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', marginBottom:'6px' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{r.orgName}</span>
                        {r.isCurrent && <span style={{ fontSize:'11px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:700 }}>재직중</span>}
                      </div>
                      <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, marginTop:'4px', flexWrap:'wrap' }}>
                        {r.role && <span>💼 {r.role}</span>}
                        {r.subject && <span>📚 {r.subject}</span>}
                        <span>📅 {r.startDate||'?'} ~ {r.isCurrent ? '현재' : (r.endDate||'?')} {getDuration(r) && `(${getDuration(r)})`}</span>
                      </div>
                      {r.description && <div style={{ fontSize:'12px', color:'#374151', marginTop:'6px', lineHeight:1.5 }}>{r.description}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      {r.fileUrl
                        ? <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #bfdbfe', background:'#eff6ff', fontSize:'11px', color:'#3b82f6', textDecoration:'none' }}>📎 서류</a>
                        : <label style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>📎 파일<input type="file" style={{ display:'none' }} onChange={e=>e.target.files[0]&&uploadFile(r.id,e.target.files[0])} /></label>
                      }
                      <button onClick={()=>openEdit(r)} style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                      <button onClick={()=>{ if(confirm('삭제할까요?')){ deleteItem(r.id); reload() } }} style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.danger }}>삭제</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'16px', fontWeight:700 }}>{editId ? '이력 편집' : '이력 추가'}</span>
              <button onClick={()=>setModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:C.muted }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'13px' }}>
              {[
                { label:'기관명 *', key:'orgName', placeholder:'예: 청계초등학교' },
                { label:'담당 역할', key:'role', placeholder:'예: 방과후 강사' },
                { label:'담당 과목', key:'subject', placeholder:'예: 로봇과학, 코딩' },
                { label:'시작일', key:'startDate', type:'date' },
                { label:'종료일', key:'endDate', type:'date' },
                { label:'주요 업무 / 설명', key:'description', placeholder:'담당 내용을 적어주세요' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                    placeholder={f.placeholder||''}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                <input type="checkbox" checked={form.isCurrent} onChange={e=>setForm(v=>({...v,isCurrent:e.target.checked,endDate:e.target.checked?'':v.endDate}))} />
                현재 재직중
              </label>
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
