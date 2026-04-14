import React, { useState, useEffect, useRef } from 'react'
import { DocumentsDB, CustomCategoriesDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { PageHeader } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../components/Atoms.jsx'

// ─── 툴팁 ───
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{position:'relative',display:'inline-flex'}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && (
        <div style={{
          position:'absolute', bottom:'calc(100% + 6px)', left:'50%',
          transform:'translateX(-50%)',
          background:'#1e293b', color:'#fff',
          fontSize:'11px', fontWeight:500, whiteSpace:'nowrap',
          padding:'5px 10px', borderRadius:'6px',
          pointerEvents:'none', zIndex:9999,
          fontFamily:'Noto Sans KR, sans-serif',
          boxShadow:'0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {text}
          <div style={{position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:'5px solid #1e293b'}}/>
        </div>
      )}
    </div>
  )
}


const DOC_TYPES = {
  keep:        { label: '보관',           color: '#2563eb', bg: '#dbeafe' },
  form_submit: { label: '양식작성 후 제출', color: '#ea580c', bg: '#ffedd5' },
  submit:      { label: '제출',           color: '#16a34a', bg: '#dcfce7' },
  submit_mat:  { label: '재료비 관련 제출', color: '#0d9488', bg: '#ccfbf1' },
  form:        { label: '양식',           color: '#7c3aed', bg: '#ede9fe' },
}
const TYPE_ORDER = ['keep', 'form_submit', 'submit', 'submit_mat', 'form']

// ─── 기본 카테고리 (첫 진입 시 DB에 자동 세팅) ───
const DEFAULT_CATEGORIES = [
  { key: 'notice',        label: '안내장',              icon: '📢', color: '#f97316', type: 'keep',        sortOrder: 0 },
  { key: 'attendance',    label: '출석부',              icon: '✅', color: '#16a34a', type: 'form_submit', sortOrder: 0 },
  { key: 'annual_plan',   label: '연간지도안',           icon: '📅', color: '#2563eb', type: 'form_submit', sortOrder: 1 },
  { key: 'daily_plan',    label: '차시별(일일)지도안',   icon: '📝', color: '#7c3aed', type: 'form_submit', sortOrder: 2 },
  { key: 'collect',       label: '수납요구',             icon: '💰', color: '#0891b2', type: 'form_submit', sortOrder: 3 },
  { key: 'safety',        label: '안전관리대장',          icon: '🦺', color: '#059669', type: 'form_submit', sortOrder: 4 },
  { key: 'refund',        label: '환불자 명단',           icon: '📃', color: '#6366f1', type: 'form_submit', sortOrder: 5 },
  { key: 'promo',         label: '홍보물',              icon: '🎨', color: '#db2777', type: 'submit',      sortOrder: 0 },
  { key: 'tuition_bank',  label: '수강료 통장사본',      icon: '🏦', color: '#0891b2', type: 'submit',      sortOrder: 1 },
  { key: 'medical',       label: '공무원 채용신체검사서', icon: '🏥', color: '#dc2626', type: 'submit',      sortOrder: 2 },
  { key: 'drug_test',     label: '마약검사서',           icon: '🔬', color: '#9333ea', type: 'submit',      sortOrder: 3 },
  { key: 'tb_test',       label: '결핵검사서',           icon: '💊', color: '#065f46', type: 'submit',      sortOrder: 4 },
  { key: 'material_bank', label: '재료비 통장사본',      icon: '💳', color: '#0d9488', type: 'submit_mat',  sortOrder: 0 },
  { key: 'business_reg',  label: '재료비 사업자 사본',   icon: '📋', color: '#b45309', type: 'submit_mat',  sortOrder: 1 },
]

const ACCEPT    = '.hwp,.hwpx,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.pdf'
const DAYS      = ['해당없음','월','화','수','목','금','토','일']
const PERIODS1  = ['해당없음','1학기','2학기','1분기','2분기','3분기','4분기']
const PERIODS2  = ['해당없음','1텀','2텀','3텀','4텀','5텀','6텀','7텀','8텀','9텀','10텀']
const DAY_ORDER = { '월':1,'화':2,'수':3,'목':4,'금':5,'토':6,'일':7 }

const PRESET_COLORS = ['#f97316','#16a34a','#2563eb','#7c3aed','#db2777','#0891b2','#0d9488','#b45309','#dc2626','#9333ea','#065f46','#1d4ed8','#be185d','#92400e','#1e3a5f']
const PRESET_ICONS  = ['📁','📄','📝','📋','📊','📅','📢','🏫','✅','⭐','🔖','💼','🗂️','📌','🎯','🧾','💡','🔍']

function getFileType(name) {
  if (!name) return 'file'
  const ext = name.split('.').pop().toLowerCase()
  if (['hwp','hwpx'].includes(ext)) return 'hwp'
  if (['xlsx','xls'].includes(ext)) return 'excel'
  if (['jpg','jpeg','png','gif'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}
function getDayFromTitle(t) { return DAY_ORDER[t?.split(' ')[0]] ?? 99 }
function buildTitle(day, school, subject, p1, p2, catLabel) {
  const parts = []
  if (day && day !== '해당없음') parts.push(day)
  if (school.trim()) parts.push(school.trim())
  if (subject.trim()) parts.push(subject.trim())
  if (p1 && p1 !== '해당없음') parts.push(p1)
  if (p2 && p2 !== '해당없음') parts.push(p2)
  parts.push(catLabel)
  return parts.join(' ')
}
const ds = () => ({ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', color:'#111827', outline:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', boxSizing:'border-box', width:'100%', appearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', paddingRight:'28px' })
const lbl = (text, opt) => <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>{text}{opt && <span style={{ color:'#9ca3af', fontWeight:400 }}> (선택)</span>}</label>

// ─── 서류 등록 모달 ───
function AddModal({ cat, onClose, onSave }) {
  const [day,setDay]=useState('해당없음'), [school,setSchool]=useState(''), [subject,setSubject]=useState('')
  const [p1,setP1]=useState('해당없음'), [p2,setP2]=useState('해당없음')
  const [file,setFile]=useState(null), [saving,setSaving]=useState(false)
  const fileRef=useRef()
  const autoTitle=buildTitle(day,school,subject,p1,p2,cat.label)
  const handleSave=async()=>{
    setSaving(true)
    let fileData='',fileName='',fileType='file'
    if(file){fileData=await new Promise(r=>{const rd=new FileReader();rd.onload=e=>r(e.target.result);rd.readAsDataURL(file)});fileName=file.name;fileType=getFileType(file.name)}
    const days = (day && day !== '해당없음') ? [day] : []
    onSave({title:autoTitle,fileData,fileName,fileType,days});setSaving(false)
  }
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'28px',width:'420px',boxShadow:'0 20px 60px rgba(0,0,0,0.18)',fontFamily:'Noto Sans KR, sans-serif'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'5px',padding:'5px 12px',borderRadius:'8px',background:cat.color+'12',border:'1px solid '+cat.color+'30',fontSize:'13px',fontWeight:700,color:cat.color}}><span>{cat.icon}</span><span>{cat.label}</span></div>
          <span style={{fontSize:'14px',fontWeight:600,color:'#111827'}}>서류 등록</span>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:'20px',lineHeight:1,padding:0}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'14px'}}>
          <div>{lbl('요일',true)}<select value={day} onChange={e=>setDay(e.target.value)} style={ds()}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div>{lbl('기간1',true)}<select value={p1} onChange={e=>setP1(e.target.value)} style={ds()}>{PERIODS1.map(p=><option key={p}>{p}</option>)}</select></div>
          <div>{lbl('기간2',true)}<select value={p2} onChange={e=>setP2(e.target.value)} style={ds()}>{PERIODS2.map(p=><option key={p}>{p}</option>)}</select></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
          <div>{lbl('학교명',true)}<input autoFocus value={school} onChange={e=>setSchool(e.target.value)} placeholder="예) 대한초" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',color:'#111827',outline:'none',fontFamily:'Noto Sans KR, sans-serif',boxSizing:'border-box'}} onFocus={e=>e.target.style.borderColor=cat.color} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/></div>
          <div>{lbl('과목명',true)}<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="예) 로봇" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',color:'#111827',outline:'none',fontFamily:'Noto Sans KR, sans-serif',boxSizing:'border-box'}} onFocus={e=>e.target.style.borderColor=cat.color} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/></div>
        </div>
        <div style={{marginBottom:'16px',padding:'10px 14px',background:cat.color+'08',border:'1.5px solid '+cat.color+'30',borderRadius:'8px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'11px',color:cat.color,fontWeight:700,flexShrink:0}}>제목 미리보기</span>
          <span style={{fontSize:'13px',fontWeight:700,color:'#111827'}}>{autoTitle}</span>
        </div>
        <div style={{marginBottom:'24px'}}>
          {lbl('파일',true)}
          <input ref={fileRef} type="file" accept={ACCEPT} style={{display:'none'}} onChange={e=>setFile(e.target.files[0]||null)}/>
          <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'9px 12px',border:'1.5px dashed '+(file?cat.color:'#d1d5db'),borderRadius:'8px',background:file?cat.color+'08':'#fafafa',cursor:'pointer',fontSize:'13px',color:file?cat.color:'#9ca3af',fontFamily:'Noto Sans KR, sans-serif',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',boxSizing:'border-box'}}>{file?'✅ '+file.name:'📁 파일을 선택하세요'}</button>
          {file&&<button onClick={()=>setFile(null)} style={{marginTop:'6px',background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:'#9ca3af',padding:0}}>✕ 파일 제거</button>}
        </div>
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:'8px',border:'1.5px solid #e5e7eb',background:'#fff',fontSize:'13px',fontWeight:600,color:'#6b7280',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{padding:'9px 22px',borderRadius:'8px',border:'none',background:cat.color,fontSize:'13px',fontWeight:700,color:'#fff',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{saving?'등록 중...':'등록'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── 미리보기/수정 모달 ───
function PreviewModal({ doc, color, onClose, onAttach, onUpdate }) {
  const VALID_DAYS = ['월','화','수','목','금','토','일']
  const initDay = doc.days?.length ? doc.days[0] : '해당없음'
  const titleParts = doc.title?.split(' ') || []
  const initSchool = VALID_DAYS.includes(titleParts[0]) ? titleParts.slice(1,-1).join(' ') : titleParts.slice(0,-1).join(' ')

  const [editMode, setEditMode] = useState(false)
  const [day, setDay] = useState(initDay)
  const [school, setSchool] = useState(initSchool)
  const [newFile, setNewFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const { success } = useToast()

  const noFile = !doc.fileData && !newFile
  const catLabel = titleParts[titleParts.length - 1] || ''
  const autoTitle = buildTitle(day, school, '', '해당없음', '해당없음', catLabel)

  const handleDownload = () => { const a=document.createElement('a');a.href=doc.fileData;a.download=doc.fileName;a.click() }

  const handleSave = async () => {
    setSaving(true)
    const patch = {}
    const newDays = (day && day !== '해당없음') ? [day] : []
    patch.days = newDays
    patch.title = autoTitle
    if (newFile) {
      patch.fileData = await new Promise(r => { const rd=new FileReader();rd.onload=e=>r(e.target.result);rd.readAsDataURL(newFile) })
      patch.fileName = newFile.name
      patch.fileType = getFileType(newFile.name)
    }
    onUpdate(doc.id, patch)
    success('수정이 완료되었습니다.')
    setSaving(false)
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'24px',width:'520px',maxWidth:'92vw',boxShadow:'0 24px 64px rgba(0,0,0,0.22)',fontFamily:'Noto Sans KR, sans-serif',display:'flex',flexDirection:'column',gap:'16px'}}>
        {/* 헤더 */}
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontWeight:700,fontSize:'15px',color:'#111827',flex:1}}>{editMode ? autoTitle : doc.title}</span>
          <button onClick={()=>setEditMode(e=>!e)} style={{padding:'5px 12px',borderRadius:'7px',border:'1.5px solid '+color+'40',background:editMode?color+'12':'#fff',color:editMode?color:'#6b7280',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>
            {editMode ? '✏️ 수정중' : '✏️ 수정'}
          </button>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:'22px',lineHeight:1,padding:0}}>×</button>
        </div>

        {/* 수정 폼 */}
        {editMode && (
          <div style={{display:'flex',flexDirection:'column',gap:'10px',padding:'14px',background:'#f9fafb',borderRadius:'10px',border:'1px solid #e5e7eb'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              <div>{lbl('요일',true)}<select value={day} onChange={e=>setDay(e.target.value)} style={ds()}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
              <div>{lbl('학교명',true)}<input value={school} onChange={e=>setSchool(e.target.value)} placeholder="예) 대한초" style={{width:'100%',padding:'9px 12px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'13px',color:'#111827',outline:'none',fontFamily:'Noto Sans KR, sans-serif',boxSizing:'border-box'}}/></div>
            </div>
            <div>
              {lbl('파일 교체',true)}
              <input ref={fileRef} type="file" accept={ACCEPT} style={{display:'none'}} onChange={e=>setNewFile(e.target.files[0]||null)}/>
              <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'9px 12px',border:'1.5px dashed '+(newFile?color:'#d1d5db'),borderRadius:'8px',background:newFile?color+'08':'#fff',cursor:'pointer',fontSize:'13px',color:newFile?color:'#9ca3af',fontFamily:'Noto Sans KR, sans-serif',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',boxSizing:'border-box'}}>
                {newFile ? '✅ '+newFile.name : (doc.fileName ? '🔄 '+doc.fileName+' (클릭하여 교체)' : '📁 파일 선택')}
              </button>
              {newFile && <button onClick={()=>setNewFile(null)} style={{marginTop:'4px',background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:'#9ca3af',padding:0}}>✕ 취소</button>}
            </div>
          </div>
        )}

        {/* 파일 미리보기 */}
        {!editMode && (
          <div style={{borderRadius:'10px',overflow:'hidden',border:'1px solid #e5e7eb',minHeight:'180px',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb'}}>
            {!doc.fileData
              ?(<div style={{textAlign:'center',padding:'40px'}}><div style={{fontSize:'40px',marginBottom:'10px'}}>📭</div><div style={{fontSize:'13px',fontWeight:600,color:'#b45309'}}>파일이 첨부되지 않았습니다</div><div style={{fontSize:'11px',marginTop:'4px',color:'#9ca3af'}}>수정 버튼을 눌러 파일을 첨부하세요</div></div>)
              :doc.fileType==='image'?(<img src={doc.fileData} alt={doc.title} style={{maxWidth:'100%',maxHeight:'320px',objectFit:'contain',display:'block'}}/>)
              :doc.fileType==='pdf'?(<iframe src={doc.fileData} title={doc.title} style={{width:'100%',height:'320px',border:'none'}}/>)
              :(<div style={{textAlign:'center',padding:'40px'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>{doc.fileType==='hwp'?'📄':doc.fileType==='excel'?'📊':'📁'}</div><div style={{fontSize:'13px',fontWeight:600,color:'#374151'}}>{doc.fileName}</div><div style={{fontSize:'12px',marginTop:'4px',color:'#9ca3af'}}>이 형식은 브라우저에서 미리볼 수 없습니다</div></div>)
            }
          </div>
        )}

        {/* 버튼 */}
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:'8px',border:'1.5px solid #e5e7eb',background:'#fff',fontSize:'13px',fontWeight:600,color:'#6b7280',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>닫기</button>
          {editMode
            ? <button onClick={handleSave} disabled={saving} style={{padding:'9px 22px',borderRadius:'8px',border:'none',background:color,fontSize:'13px',fontWeight:700,color:'#fff',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>{saving?'저장 중...':'💾 저장'}</button>
            : doc.fileData && <button onClick={handleDownload} style={{padding:'9px 22px',borderRadius:'8px',border:'none',background:color,fontSize:'13px',fontWeight:700,color:'#fff',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>⬇️ 다운로드</button>
          }
        </div>
      </div>
    </div>
  )
}

// ─── 서류 칩 ───
function DocChip({ doc, color, onDelete, onUpdate }) {
  const [show,setShow]=useState(false)
  const noFile=!doc.fileData
  return (
    <>
      <div style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'5px 8px 5px 11px',background:noFile?'#fffbeb':'#f9fafb',border:'1px solid '+(noFile?'#fcd34d':'#e5e7eb'),borderRadius:'8px',cursor:'pointer',fontSize:'12px',transition:'all 0.15s'}}
        onClick={()=>setShow(true)}
        onMouseEnter={e=>{e.currentTarget.style.background=noFile?'#fef3c7':color+'10';e.currentTarget.style.borderColor=noFile?'#f59e0b':color}}
        onMouseLeave={e=>{e.currentTarget.style.background=noFile?'#fffbeb':'#f9fafb';e.currentTarget.style.borderColor=noFile?'#fcd34d':'#e5e7eb'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
          <span style={{fontWeight:600,color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'120px',lineHeight:1.3}}>{doc.title}</span>
          {noFile&&<span style={{fontSize:'10px',fontWeight:700,color:'#b45309',lineHeight:1.2}}>서류첨부 필요</span>}
        </div>
        <button onClick={e=>{e.stopPropagation();onDelete()}} style={{background:'none',border:'none',cursor:'pointer',color:'#d1d5db',fontSize:'14px',padding:'0 0 0 2px',lineHeight:1,flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='#d1d5db'}>×</button>
      </div>
      {show&&<PreviewModal doc={doc} color={color} onClose={()=>setShow(false)} onAttach={p=>onUpdate(doc.id,p)} onUpdate={onUpdate}/>}
    </>
  )
}

// ─── 카테고리 편집/추가 모달 ───
function CatModal({ cat, onClose, onSave }) {
  const isEdit = !!cat
  const [label,setLabel]=useState(cat?.label||'')
  const [icon,setIcon]=useState(cat?.icon||'📁')
  const [color,setColor]=useState(cat?.color||'#2563eb')
  const [type,setType]=useState(cat?.type||'keep')

  const handleSave=()=>{
    if(!label.trim())return
    onSave({label:label.trim(),icon,color,type})
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'28px',width:'420px',boxShadow:'0 20px 60px rgba(0,0,0,0.18)',fontFamily:'Noto Sans KR, sans-serif',display:'flex',flexDirection:'column',gap:'18px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>{isEdit?'카테고리 수정':'카테고리 추가'}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:'22px',lineHeight:1,padding:0}}>×</button>
        </div>

        {/* 미리보기 */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',background:'#f9fafb',borderRadius:'10px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'5px',padding:'6px 12px',borderRadius:'8px',background:color+'12',border:'1px solid '+color+'30',fontSize:'12px',fontWeight:700,color}}><span>{icon}</span><span>{label||'카테고리명'}</span></div>
          {DOC_TYPES[type]&&<span style={{fontSize:'10px',fontWeight:700,padding:'3px 7px',borderRadius:'5px',background:DOC_TYPES[type].bg,color:DOC_TYPES[type].color}}>{DOC_TYPES[type].label}</span>}
        </div>

        {/* 카테고리명 */}
        <div>
          <label style={{display:'block',fontSize:'12px',fontWeight:700,color:'#374151',marginBottom:'6px'}}>카테고리명 <span style={{color:'#dc2626'}}>*</span></label>
          <input autoFocus value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSave()} placeholder="예) 행정서류"
            style={{width:'100%',padding:'9px 12px',borderRadius:'8px',border:'1.5px solid '+(label?color:'#e5e7eb'),fontSize:'13px',color:'#111827',outline:'none',fontFamily:'Noto Sans KR, sans-serif',boxSizing:'border-box'}}
            onFocus={e=>e.target.style.borderColor=color} onBlur={e=>e.target.style.borderColor=label?color:'#e5e7eb'}/>
        </div>

        {/* 아이콘 */}
        <div>
          <label style={{display:'block',fontSize:'12px',fontWeight:700,color:'#374151',marginBottom:'8px'}}>아이콘</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {PRESET_ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{width:'34px',height:'34px',borderRadius:'8px',fontSize:'18px',border:ic===icon?'2px solid '+color:'1.5px solid #e5e7eb',background:ic===icon?color+'12':'#fff',cursor:'pointer'}}>{ic}</button>)}
          </div>
        </div>

        {/* 색상 */}
        <div>
          <label style={{display:'block',fontSize:'12px',fontWeight:700,color:'#374151',marginBottom:'8px'}}>색상</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {PRESET_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:'28px',height:'28px',borderRadius:'50%',background:c,border:c===color?'3px solid #111827':'2px solid transparent',cursor:'pointer',boxSizing:'border-box'}}/>)}
          </div>
        </div>

        {/* 분류 그룹 */}
        <div>
          <label style={{display:'block',fontSize:'12px',fontWeight:700,color:'#374151',marginBottom:'8px'}}>분류 그룹</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {Object.entries(DOC_TYPES).map(([k,dt])=>(
              <button key={k} onClick={()=>setType(k)} style={{padding:'5px 12px',borderRadius:'6px',border:'none',background:type===k?dt.bg:'#f3f4f6',color:type===k?dt.color:'#6b7280',fontWeight:type===k?700:500,fontSize:'12px',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif',outline:type===k?'2px solid '+dt.color:'none'}}>{dt.label}</button>
            ))}
          </div>
        </div>

        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:'8px',border:'1.5px solid #e5e7eb',background:'#fff',fontSize:'13px',fontWeight:600,color:'#6b7280',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}>취소</button>
          <button onClick={handleSave} disabled={!label.trim()} style={{padding:'9px 22px',borderRadius:'8px',border:'none',background:label.trim()?color:'#d1d5db',fontSize:'13px',fontWeight:700,color:'#fff',cursor:label.trim()?'pointer':'not-allowed',fontFamily:'Noto Sans KR, sans-serif'}}>{isEdit?'저장':'추가'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── 카테고리 관리 모달 (위로/아래로/수정/삭제) ───
function CatManageModal({ info, onClose, onMove, onEdit, onDelete }) {
  const { cat, groupCats, ci } = info
  const isFirst = ci === 0
  const isLast  = ci === groupCats.length - 1

  const btnStyle = (disabled, color, bg, border) => ({
    display:'flex', alignItems:'center', gap:'12px', padding:'13px 16px',
    borderRadius:'10px', border:'1.5px solid '+border,
    background: disabled ? '#fafafa' : bg,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily:'Noto Sans KR, sans-serif', fontSize:'14px', fontWeight:600,
    color: disabled ? '#d1d5db' : color, width:'100%',
  })

  return (
    <div style={{position:'fixed',inset:0,zIndex:1050,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'24px',width:'300px',boxShadow:'0 20px 60px rgba(0,0,0,0.18)',fontFamily:'Noto Sans KR, sans-serif'}}>
        {/* 헤더 */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'5px',padding:'6px 14px',borderRadius:'8px',background:cat.color+'12',border:'1px solid '+cat.color+'30',fontSize:'13px',fontWeight:700,color:cat.color}}>
            <span>{cat.icon}</span><span>{cat.label}</span>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:'22px',lineHeight:1,padding:0}}>×</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <button disabled={isFirst} onClick={()=>onMove(cat,-1)} style={btnStyle(isFirst,'#374151','#f9fafb','#e5e7eb')}
            onMouseEnter={e=>{if(!isFirst)e.currentTarget.style.background='#f3f4f6'}} onMouseLeave={e=>e.currentTarget.style.background=isFirst?'#fafafa':'#f9fafb'}>
            <span style={{fontSize:'20px'}}>⬆️</span> 위로 이동
          </button>
          <button disabled={isLast} onClick={()=>onMove(cat,1)} style={btnStyle(isLast,'#374151','#f9fafb','#e5e7eb')}
            onMouseEnter={e=>{if(!isLast)e.currentTarget.style.background='#f3f4f6'}} onMouseLeave={e=>e.currentTarget.style.background=isLast?'#fafafa':'#f9fafb'}>
            <span style={{fontSize:'20px'}}>⬇️</span> 아래로 이동
          </button>
          <button onClick={()=>onEdit(cat)} style={btnStyle(false,'#2563eb','#eff6ff','#bfdbfe')}
            onMouseEnter={e=>e.currentTarget.style.background='#dbeafe'} onMouseLeave={e=>e.currentTarget.style.background='#eff6ff'}>
            <span style={{fontSize:'20px'}}>✏️</span> 수정
          </button>
          <button onClick={()=>onDelete(cat)} style={btnStyle(false,'#ef4444','#fef2f2','#fecaca')}
            onMouseEnter={e=>e.currentTarget.style.background='#fee2e2'} onMouseLeave={e=>e.currentTarget.style.background='#fef2f2'}>
            <span style={{fontSize:'20px'}}>🗑️</span> 삭제
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ───
export function Templates({ user }) {
  const currentYear = String(new Date().getFullYear())
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [allDocs, setAllDocs] = useState(() =>
    (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin')
  )
  const [cats, setCats] = useState([])
  const [modalCat, setModalCat]         = useState(null)
  const [editCat, setEditCat]           = useState(null)
  const [manageCat, setManageCat]       = useState(null)  // 관리 모달
  const [showAddCat, setShowAddCat]     = useState(false)
  const { error: toastError, success } = useToast()
  const confirm = useConfirm()

  // ─── 카테고리 로드 (없으면 기본값 세팅) ───
  const loadCats = () => {
    let list = CustomCategoriesDB.byTeacher(user.id)
    const existingKeys = new Set(list.map(c => c.key))
    if (!list.length) {
      DEFAULT_CATEGORIES.forEach(c => {
        if (!existingKeys.has(c.key)) {
          CustomCategoriesDB.insert({ id: uid(), ...c, teacherId: user.id, createdAt: now() })
        }
      })
      list = CustomCategoriesDB.byTeacher(user.id)
    }
    setCats(list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)))
  }

  useEffect(() => {
    loadCats()
    // 기존 서류 중 days가 없는 것들 title에서 요일 파싱하여 자동 업데이트
    const VALID_DAYS = ['월','화','수','목','금','토','일']
    const myDocs = (DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id)
    myDocs.forEach(doc => {
      if (!doc.days?.length) {
        const firstWord = doc.title?.split(' ')[0]
        const parsedDay = VALID_DAYS.includes(firstWord) ? [firstWord] : []
        DocumentsDB.update(doc.id, { days: parsedDay })
      }
    })
  }, [])

  const docs  = allDocs.filter(d => (d.year || '2026') === selectedYear)
  const years = [...new Set(allDocs.map(d => d.year || '2026'))]
  if (!years.includes(currentYear)) years.push(currentYear)
  years.sort((a, b) => b - a)

  const reload    = () => setAllDocs((DocumentsDB?.all?.() || []).filter(d => d.teacherId === user.id || user.role === 'admin'))
  const docsFor   = (catKey) => docs.filter(d => d.category === catKey).sort((a,b) => getDayFromTitle(a.title)-getDayFromTitle(b.title))

  const handleSave = ({ title, fileData, fileName, fileType, days }) => {
    DocumentsDB.insert({ id: uid(), teacherId: user.id, category: modalCat.key, title, year: selectedYear, fileName, fileType, fileData, days: days || [], createdAt: now() })
    reload()
    success(modalCat.label + '이(가) 등록 완료되었습니다.')
    setModalCat(null)
  }

  const handleDelete    = (id)   => confirm('이 서류를 삭제하시겠습니까?', () => { DocumentsDB.delete(id); reload() })
  const handleUpdate    = (id, patch) => { DocumentsDB.update(id, patch); reload() }

  // ─── 카테고리 추가 ───
  const handleAddCat = ({ label, icon, color, type }) => {
    const groupCats = cats.filter(c => c.type === type)
    const maxOrder  = groupCats.length ? Math.max(...groupCats.map(c => c.sortOrder || 0)) + 1 : 0
    CustomCategoriesDB.insert({ id: uid(), key: 'custom_' + Date.now(), label, icon, color, type, sortOrder: maxOrder, teacherId: user.id, createdAt: now() })
    loadCats()
    success('"' + label + '" 카테고리가 추가되었습니다.')
  }

  // ─── 카테고리 수정 ───
  const handleEditCat = ({ label, icon, color, type }) => {
    CustomCategoriesDB.update(editCat.id, { label, icon, color, type })
    loadCats()
    success('"' + label + '" 카테고리가 수정되었습니다.')
    setEditCat(null)
  }

  // ─── 카테고리 삭제 ───
  const handleDeleteCat = (cat) => {
    confirm('이 카테고리를 삭제하시겠습니까?\n등록된 서류도 함께 삭제됩니다.', () => {
      CustomCategoriesDB.delete(cat.id)
      allDocs.filter(d => d.category === cat.key).forEach(d => DocumentsDB.delete(d.id))
      loadCats(); reload()
    })
  }

  // ─── 순서 이동 ───
  const movecat = (cat, dir) => {
    const group = cats.filter(c => c.type === cat.type).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0))
    const idx   = group.findIndex(c => c.id === cat.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= group.length) return
    const a = group[idx], b = group[swapIdx]
    const aOrder = a.sortOrder ?? idx, bOrder = b.sortOrder ?? swapIdx
    CustomCategoriesDB.update(a.id, { sortOrder: bOrder })
    CustomCategoriesDB.update(b.id, { sortOrder: aOrder })
    loadCats()
  }

  const handleAddYear = () => {
    const input = window.prompt('추가할 연도를 입력하세요 (예: 2025, 2027)')
    if (!input) return
    const yr = input.trim()
    if (!/^\d{4}$/.test(yr)) { toastError('올바른 연도를 입력해주세요 (4자리 숫자)'); return }
    if (years.includes(yr)) { toastError(yr + '년 세트는 이미 존재합니다.'); return }
    setSelectedYear(yr); success(yr + '년 세트가 생성되었습니다.')
  }

  // ─── 그룹핑 ───
  const grouped = TYPE_ORDER.reduce((acc, tk) => {
    const c = cats.filter(x => x.type === tk).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0))
    if (c.length) acc.push({ tk, c })
    return acc
  }, [])
  const untyped = cats.filter(c => !c.type || !DOC_TYPES[c.type])
  if (untyped.length) grouped.push({ tk: null, c: untyped })

  // ─── 카테고리 행 렌더 ───
  const renderRow = (cat, groupCats, ci) => {
    const catDocs = docsFor(cat.key)
    const isLast  = ci === groupCats.length - 1
    return (
      <div key={cat.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'11px 20px',borderBottom:isLast?'none':'1px solid #f3f4f6',minHeight:'52px'}}>
        {/* 카테고리 버튼 — 클릭 시 관리 모달 */}
        <Tooltip text="클릭하면 위치·수정·삭제할 수 있습니다">
          <button onClick={()=>setManageCat({cat, groupCats, ci})}
            style={{display:'inline-flex',alignItems:'center',gap:'5px',padding:'6px 12px',borderRadius:'8px',background:cat.color+'12',border:'1px solid '+cat.color+'30',fontSize:'12px',fontWeight:700,color:cat.color,whiteSpace:'nowrap',flexShrink:0,minWidth:'130px',justifyContent:'center',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif',transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background=cat.color+'25';e.currentTarget.style.borderColor=cat.color+'60'}}
            onMouseLeave={e=>{e.currentTarget.style.background=cat.color+'12';e.currentTarget.style.borderColor=cat.color+'30'}}>
            <span>{cat.icon}</span><span>{cat.label}</span>
          </button>
        </Tooltip>

        {/* + 서류 등록 버튼 */}
        <Tooltip text="양식을 추가할 수 있습니다">
          <button onClick={()=>setModalCat(cat)} style={{width:'26px',height:'26px',borderRadius:'7px',background:cat.color+'18',border:'1.5px solid '+cat.color+'40',color:cat.color,fontSize:'18px',fontWeight:700,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background=cat.color+'30'}} onMouseLeave={e=>{e.currentTarget.style.background=cat.color+'18'}}>+</button>
        </Tooltip>

        {/* 서류 칩들 */}
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px',flex:1,alignItems:'center'}}>
          {catDocs.length===0
            ?<span style={{fontSize:'12px',color:'#d1d5db'}}>+ 버튼을 눌러 서류를 등록하세요</span>
            :catDocs.map(doc=><DocChip key={doc.id} doc={doc} color={cat.color} onDelete={()=>handleDelete(doc.id)} onUpdate={handleUpdate}/>)
          }
        </div>
      </div>
    )
  }

  return (
    <div style={{padding:'28px',maxWidth:'1100px',fontFamily:'Noto Sans KR, sans-serif'}}>
      <PageHeader title="방과후 서류" sub="방과후 수업에 필요한 서류를 보관하고 관리합니다."/>

      {/* 연도 탭 */}
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {years.map(yr=>(
          <button key={yr} onClick={()=>setSelectedYear(yr)} style={{padding:'7px 20px',borderRadius:'20px',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif',fontSize:'14px',fontWeight:700,border:yr===selectedYear?'none':'1.5px solid #e5e7eb',background:yr===selectedYear?'#1e3a5f':'#fff',color:yr===selectedYear?'#fff':'#6b7280'}}>
            {yr}년
          </button>
        ))}
        <button onClick={handleAddYear} style={{padding:'7px 16px',borderRadius:'20px',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif',fontSize:'13px',fontWeight:600,border:'1.5px dashed #d1d5db',background:'#fafafa',color:'#9ca3af'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#2563eb';e.currentTarget.style.color='#2563eb'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#d1d5db';e.currentTarget.style.color='#9ca3af'}}>＋ 연도 추가</button>
      </div>

      <div style={{marginBottom:'20px',padding:'12px 16px',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:'10px',fontSize:'13px',color:'#1e40af'}}>
        📌 학교마다 다른 서류를 여러 개 등록할 수 있습니다. 요일을 입력하면 <strong>월·화·수·목·금·토·일 순</strong>으로 자동 정렬됩니다. 지원 형식: <strong>HWP · Excel · 이미지 · PDF</strong>
      </div>

      {/* 그룹별 카테고리 */}
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {grouped.map(({tk,c})=>{
          const dt=tk?DOC_TYPES[tk]:{label:'기타',color:'#6b7280',bg:'#f3f4f6'}
          return (
            <div key={tk||'etc'} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 20px',background:dt.bg,borderBottom:'1px solid '+dt.color+'20'}}>
                <span style={{fontSize:'12px',fontWeight:800,color:dt.color}}>{dt.label}</span>
                <span style={{fontSize:'11px',color:dt.color+'aa'}}>({c.length}개)</span>
              </div>
              {c.map((cat,ci)=>renderRow(cat,c,ci))}
            </div>
          )
        })}

        <button onClick={()=>setShowAddCat(true)} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'11px',borderRadius:'12px',border:'1.5px dashed #d1d5db',background:'#fafafa',fontSize:'13px',fontWeight:700,color:'#6b7280',cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#2563eb';e.currentTarget.style.color='#2563eb';e.currentTarget.style.background='#eff6ff'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#d1d5db';e.currentTarget.style.color='#6b7280';e.currentTarget.style.background='#fafafa'}}>
          ＋ 카테고리 추가
        </button>
      </div>

      {modalCat   && <AddModal  cat={modalCat} onClose={()=>setModalCat(null)}    onSave={handleSave}/>}
      {showAddCat && <CatModal  cat={null}     onClose={()=>setShowAddCat(false)} onSave={handleAddCat}/>}
      {editCat    && <CatModal  cat={editCat}  onClose={()=>setEditCat(null)}     onSave={handleEditCat}/>}
      {manageCat  && <CatManageModal info={manageCat} onClose={()=>setManageCat(null)} onMove={(cat,dir)=>{movecat(cat,dir);setManageCat(null)}} onEdit={(cat)=>{setManageCat(null);setEditCat(cat)}} onDelete={(cat)=>{setManageCat(null);handleDeleteCat(cat)}}/>}
    </div>
  )
}
