import React, { useState, useEffect, useRef, useMemo } from 'react'
import { uid, now, sortClasses } from '../lib/utils.js'
import {
  Classes, Students,
  SupplySubjects, SupplyVendors, SupplyItems, SupplyPlans,
  SupplyProducts, SupplyProductPlans, SupplyStudentProgress, SupplySessionChecks,
  SupplyGiven,
  SupplySchoolPrices,
  onDbChange,
  refreshTablesFromSupabase,
} from '../lib/db.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

// ── 교구 목록 엑셀 다운로드 (업체+교구+차시 전체)
async function downloadProductsExcel(vendor, products, productPlanList) {
  const XLSX = await import('xlsx')
  const rows = [['업체명', '담당자', '연락처', '과목', '교구명', '단계', '차시번호', '차시제목', '메모']]
  products.forEach(p => {
    const plans = productPlanList.filter(pl => pl.productId === p.id).sort((a,b) => a.stage - b.stage || a.sessionNo - b.sessionNo)
    if (plans.length === 0) {
      rows.push([vendor.name, vendor.managerName||'', vendor.contact||'', p.subject||'', p.name, '', '', '', ''])
    } else {
      plans.forEach(pl => {
        rows.push([vendor.name, vendor.managerName||'', vendor.contact||'', p.subject||'', p.name, pl.stage||'', pl.sessionNo||'', pl.title||'', pl.memo||''])
      })
    }
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, '교구목록')
  XLSX.writeFile(wb, `교구목록_${vendor.name}_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`)
}

// ── 샘플 엑셀 다운로드
async function downloadSampleExcel() {
  const XLSX = await import('xlsx')
  const rows = [
    ['업체명', '담당자', '연락처', '과목', '교구명', '단계', '차시번호', '차시제목', '메모'],
    ['집현전에듀', '민찬홍', '010-2704-0307', '로봇', '큐보', 1, 1, '큐보 1단계 1차시', ''],
    ['집현전에듀', '민찬홍', '010-2704-0307', '로봇', '큐보', 1, 2, '큐보 1단계 2차시', ''],
    ['집현전에듀', '민찬홍', '010-2704-0307', '로봇', '큐보', 2, 1, '큐보 2단계 1차시', ''],
    ['집현전에듀', '민찬홍', '010-2704-0307', '로봇', '드론', 1, 1, '드론 1단계 1차시', ''],
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, '교구목록샘플')
  XLSX.writeFile(wb, '교구목록_샘플양식.xlsx')
}

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  blue: '#3b82f6', purple: '#8b5cf6', warning: '#f59e0b',
}

// ── 반 표시 레이블 생성
function getClassLabel(cls) {
  if (!cls) return ''
  const year = cls.startDate ? new Date(cls.startDate + 'T00:00:00').getFullYear() : ''
  const termLabel = cls.periods?.length > 0
    ? cls.periods.map(p => p.label).join('/')
    : ''
  const base = `${cls.organization || ''} ${cls.className || ''}${cls.section ? ' ' + cls.section : ''}`
  return year && termLabel ? `${base} · ${year}년 ${termLabel}` : base
}

const DEFAULT_SUBJECTS = ['일반', '로봇', '항공', '보드게임']
const STAGES = Array.from({ length: 10 }, (_, i) => i + 1)

async function uploadToStorage(userId, folder, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const filePath = `supplies/${userId}/${folder}/${Date.now()}_${file.name}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/teacher-files/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.message || res.statusText) }
  return `${SUPABASE_URL}/storage/v1/object/public/teacher-files/${filePath}`
}

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }


// ── 파일 행
function FileRow({ item, onDelete, onEdit, schools=[] }) {
  const icon = item.fileType === 'promo' ? '🖼' : '📄'
  const typeLabel = { annual:'연간지도안', session:'차시별지도안', promo:'홍보물' }[item.fileType] || ''
  const noFile = !item.fileUrl
  const allSchools = schools.length > 0 ? schools : (item.school ? [item.school] : [])
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:C.card, borderRadius:'9px', border:`1.5px solid ${noFile ? '#fca5a5' : C.border}` }}>
      <span style={{ fontSize:'20px' }}>{noFile ? '⚠️' : icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13px', fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
        <div style={{ fontSize:'11px', marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ background:'#f3f4f6', borderRadius:'4px', padding:'0 5px', color:C.muted }}>{typeLabel}</span>
          {item.stage && <span style={{ background:'#eff6ff', color:'#3b82f6', borderRadius:'4px', padding:'0 5px' }}>{item.stage}단계</span>}
          {allSchools.map(s => <span key={s} style={{ color:C.muted }}>🏫 {s}</span>)}
          {noFile
            ? <span style={{ color:'#ef4444', fontWeight:600 }}>파일 업로드가 필요합니다</span>
            : <span style={{ color:C.muted }}>{item.fileName}</span>
          }
        </div>
      </div>
      <div style={{ display:'flex', gap:'5px' }}>
        {item.fileUrl && (
          <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer"
            style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'11px', fontWeight:600, textDecoration:'none' }}>
            ⬇ 다운
          </a>
        )}
        {onEdit && (
          <button onClick={() => onEdit(item)}
            style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${'#f97316'}`, background:'#fff7ed', color:'#f97316', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            수정
          </button>
        )}
        <button onClick={() => onDelete(item.id)}
          style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
      </div>
    </div>
  )
}

// ── 진도 뱃지
function ProgressBadge({ checkedCount, totalCount, alertSession, sessionsPerStage }) {
  if (!totalCount) return null
  const rate = Math.round(checkedCount / totalCount * 100)
  const isDone  = checkedCount >= sessionsPerStage
  const isAlert = checkedCount >= (totalCount - alertSession) && !isDone
  const color   = isDone ? C.success : isAlert ? C.warning : C.blue
  const bg      = isDone ? '#f0fdf4' : isAlert ? '#fffbeb' : '#eff6ff'
  const border  = isDone ? '#86efac' : isAlert ? '#fde68a' : '#bfdbfe'
  const label   = isDone ? '단계완료' : isAlert ? '준비필요' : `${checkedCount}/${totalCount}`
  return (
    <span style={{ fontSize:'11px', fontWeight:700, color, background:bg, border:`1px solid ${border}`, borderRadius:'5px', padding:'1px 7px' }}>
      {isDone ? '✅' : isAlert ? '⚠️' : '📖'} {label}
    </span>
  )
}

// 교구 지급 기록 한 줄 (드롭1: 지급상태 / 드롭2: 청구·입금상태)
function GivenRecord({ record, onDelete, onUpdate, termType }) {
  const [editing, setEditing] = React.useState(false)
  const [item, setItem]       = React.useState(record.itemName)
  const [quarter, setQuarter] = React.useState(record.quarter || '')
  const [givenDate, setGivenDate] = React.useState(record.givenAt || '')
  const [paidDate, setPaidDate]   = React.useState(record.paidAt  || '')

  // 초기값: supplyStatus 컬럼 있으면 신규모델, 없으면 구모델에서 역산
  const initSupply = () => {
    if (record.supplyStatus) return record.supplyStatus
    const s = record.status || 'given'
    return ['billed','paid'].includes(s) ? 'given' : s
  }
  const initBilling = () => {
    if (record.supplyStatus != null) return record.status || 'none'  // 신규: status = billing
    const s = record.status || 'given'
    if (s === 'billed') return 'billed'
    if (s === 'paid')   return 'paid'
    if (record.paymentStatus === 'unpaid') return 'unpaid'
    return 'none'
  }
  const [supplyStatus,  setSupplyStatus]  = React.useState(initSupply)
  const [billingStatus, setBillingStatus] = React.useState(initBilling)

  // 스타일 정의
  const SUPPLY_STYLE = {
    ready:  { bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db', label:'준비' },
    given:  { bg:'#dbeafe', color:'#1d4ed8', border:'#93c5fd', label:'지급' },
    unpaid: { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', label:'미지급(보관)' },
    extra:  { bg:'#ede9fe', color:'#7c3aed', border:'#c4b5fd', label:'추가지급' },
    own:    { bg:'#fef9c3', color:'#854d0e', border:'#fde047', label:'보유교구' },
  }
  const BILLING_STYLE = {
    billed: { bg:'#fef9c3', color:'#a16207', border:'#fde047', label:'청' },
    paid:   { bg:'#dcfce7', color:'#15803d', border:'#86efac', label:'입' },
    unpaid: { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', label:'미입금' },
  }
  // 행 색상: 청구/입금 상태가 있으면 우선
  const st = (billingStatus !== 'none' && BILLING_STYLE[billingStatus])
    || SUPPLY_STYLE[supplyStatus]
    || SUPPLY_STYLE.given

  const isQuarter = termType === 'quarter'
  const termUnit  = isQuarter ? '분기' : '학기'
  const termCount = isQuarter ? 4 : 2
  const curYear   = new Date().getFullYear()
  const termOpts  = []
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    for (let t = 1; t <= termCount; t++) termOpts.push(`${y}-${t}${termUnit}`)
  }

  // onUpdate(itemName, givenAt, quarter, supplyStatus, billingStatus, paidAt)
  // → 호출자(부모)에서 DB 컬럼 매핑
  const doUpdate = async (ss, bs, gd, pd) => {
    await onUpdate(record.itemName, gd, record.quarter, ss, bs, pd || null)
  }

  const handleSupplyChange  = async (val) => { setSupplyStatus(val);  await doUpdate(val, billingStatus, givenDate, paidDate) }
  const handleBillingChange = async (val) => { setBillingStatus(val); await doUpdate(supplyStatus, val, givenDate, paidDate) }
  const handleGivenDate     = async (val) => { setGivenDate(val);     await doUpdate(supplyStatus, billingStatus, val, paidDate) }
  const handlePaidDate      = async (val) => { setPaidDate(val);      await doUpdate(supplyStatus, billingStatus, givenDate, val) }

  const handleSave = async () => {
    if (!item.trim()) return
    await onUpdate(item.trim(), givenDate, quarter || null, supplyStatus, billingStatus, paidDate || null)
    setEditing(false)
  }

  // 수정 모드 (교구명·지급일·학기 편집)
  if (editing) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap', padding:'7px 10px', background:st.bg, borderRadius:'8px', border:`1px solid ${st.border}` }}>
        <input value={item} onChange={e => setItem(e.target.value)}
          style={{ width:'100px', padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <input type="date" value={givenDate} onChange={e => setGivenDate(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <select value={quarter} onChange={e => setQuarter(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
          <option value="">{termUnit} 선택</option>
          {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={handleSave}
          style={{ padding:'2px 8px', borderRadius:'5px', border:'none', background:'#16a34a', color:'#fff', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
        <button onClick={() => { setItem(record.itemName); setGivenDate(record.givenAt||''); setQuarter(record.quarter||''); setEditing(false) }}
          style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'11px', cursor:'pointer' }}>취소</button>
      </div>
    )
  }

  const showGivenDate  = supplyStatus  === 'given'  || supplyStatus  === 'extra'
  const showPaidDate   = billingStatus === 'billed'  || billingStatus === 'paid'

  // 드롭 셀렉트 색상
  const ssStyle = SUPPLY_STYLE[supplyStatus]  || SUPPLY_STYLE.given
  const bsStyle = (billingStatus !== 'none' && BILLING_STYLE[billingStatus]) || { bg:'#f3f4f6', color:'#9ca3af' }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:st.bg, borderRadius:'8px', border:`1px solid ${st.border}`, flexWrap:'wrap' }}>
      {/* 교구명 */}
      <span style={{ fontSize:'13px', fontWeight:600, color:st.color, flex:1, minWidth:'60px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {record.itemName}
      </span>

      {/* 드롭1: 지급상태 */}
      <select value={supplyStatus} onChange={e => handleSupplyChange(e.target.value)}
        style={{ padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background:ssStyle.bg, color:ssStyle.color }}>
        <option value="ready">준비</option>
        <option value="given">지급</option>
        <option value="unpaid">미지급</option>
        <option value="extra">추가지급</option>
        <option value="own">보유교구</option>
      </select>

      {/* 지급날짜 */}
      <input type="date" value={givenDate} onChange={e => handleGivenDate(e.target.value)}
        title="지급날짜"
        style={{ padding:'2px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', cursor:'pointer' }} />

      {/* 드롭2: 청구·입금 */}
      <select value={billingStatus} onChange={e => handleBillingChange(e.target.value)}
        style={{ padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background:bsStyle.bg, color:bsStyle.color }}>
        <option value="none">-</option>
        <option value="billed">청구</option>
        <option value="paid">입금</option>
        <option value="unpaid">미입금</option>
      </select>

      {/* 입금날짜 */}
      <input type="date" value={paidDate} onChange={e => handlePaidDate(e.target.value)}
        title="입금날짜"
        style={{ padding:'2px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', cursor:'pointer' }} />

      {/* 수정·삭제 */}
      <button onClick={() => setEditing(true)}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fed7aa', background:'#fff7ed', color:'#f97316', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
      <button onClick={onDelete}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
    </div>
  )
}

// ── 교구 가격 모달
function PriceModal({ product, teacherId, allSchools, onClose }) {
  const [form, setForm] = useState({
    consumerPrice: product.consumerPrice || 0,
    schoolPrice:   product.schoolPrice   || 0,
    branchPrice:   product.branchPrice   || 0,
    teacherPrice:  product.teacherPrice  || 0,
    purchasePrice: product.purchasePrice || 0,
  })
  const [schoolPrices, setSchoolPrices] = useState([])
  const [newSchool, setNewSchool]       = useState('')
  const [newPrice, setNewPrice]         = useState('')
  const [newMemo, setNewMemo]           = useState('')
  const [saving, setSaving]             = useState(false)
  const fmt = (n) => Number(n||0).toLocaleString('ko-KR')

  useEffect(() => {
    setSchoolPrices(SupplySchoolPrices.byProduct(product.id))
  }, [product.id])

  const handleSaveBase = async () => {
    setSaving(true)
    await SupplyProducts.update(product.id, form)
    setSaving(false)
  }

  const handleAddSchool = async () => {
    if (!newSchool.trim() || !newPrice) return
    await SupplySchoolPrices.insert({
      teacherId, productId: product.id, productName: product.name,
      schoolName: newSchool.trim(), price: Number(newPrice), memo: newMemo.trim(),
      createdAt: now(),
    })
    setSchoolPrices(SupplySchoolPrices.byProduct(product.id))
    setNewSchool(''); setNewPrice(''); setNewMemo('')
  }

  const handleDeleteSchool = async (id) => {
    await SupplySchoolPrices.delete(id)
    setSchoolPrices(SupplySchoolPrices.byProduct(product.id))
  }

  const handleUpdateSchool = async (id, patch) => {
    await SupplySchoolPrices.update(id, patch)
    setSchoolPrices(SupplySchoolPrices.byProduct(product.id))
  }

  const BASE_PRICES = [
    { key:'consumerPrice', label:'소비자가' },
    { key:'schoolPrice',   label:'학교공급가 (기준)' },
    { key:'branchPrice',   label:'지사가' },
    { key:'teacherPrice',  label:'선생님가' },
    { key:'purchasePrice', label:'매입가' },
  ]

  return (
    <Modal open={true} title={`💰 ${product.name} 가격 설정`} onClose={onClose} width={560}>
      {/* 기준 가격 */}
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📋 기준 가격</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {BASE_PRICES.map(({ key, label }) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'12px', color:'#6b7280', width:'120px' }}>{label}</span>
              <input type="number" min={0} value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: Number(e.target.value) }))}
                style={{ width:'130px', padding:'5px 8px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'right' }} />
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>원</span>
              <span style={{ fontSize:'11px', color:'#d1d5db' }}>({fmt(form[key])})</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'10px' }}>
          <button onClick={handleSaveBase} disabled={saving}
            style={{ padding:'6px 16px', borderRadius:'7px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            {saving ? '저장 중...' : '기준가 저장'}
          </button>
        </div>
      </div>

      <hr style={{ border:'none', borderTop:'1px solid #f3f4f6', margin:'4px 0 16px' }} />

      {/* 학교별 공급가 */}
      <div>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>🏫 학교별 공급가</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' }}>
          {schoolPrices.length === 0 && (
            <div style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', padding:'10px 0' }}>등록된 학교별 공급가가 없습니다</div>
          )}
          {[...schoolPrices].sort((a, b) => {
            const idxA = allSchools.findIndex(s => (s.value||s) === a.schoolName)
            const idxB = allSchools.findIndex(s => (s.value||s) === b.schoolName)
            return (idxA===-1?99:idxA) - (idxB===-1?99:idxB)
          }).map(sp => (
            <SchoolPriceRow key={sp.id} sp={sp} allSchools={allSchools}
              onUpdate={patch => handleUpdateSchool(sp.id, patch)}
              onDelete={() => handleDeleteSchool(sp.id)} />
          ))}
        </div>
        {/* 추가 폼 */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center', padding:'8px', background:'#f9fafb', borderRadius:'8px', border:'1px solid #e5e7eb' }}>
          <select value={newSchool} onChange={e => setNewSchool(e.target.value)}
            style={{ flex:1, minWidth:'120px', padding:'5px 7px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
            <option value="">학교 선택</option>
            {allSchools.map(s => <option key={s.value || s} value={s.value || s}>{s.label || s}</option>)}
          </select>
          <input type="number" min={0} value={newPrice} onChange={e => setNewPrice(e.target.value)}
            placeholder="공급가"
            style={{ width:'100px', padding:'5px 7px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'right' }} />
          <input value={newMemo} onChange={e => setNewMemo(e.target.value)}
            placeholder="메모 (선택)"
            style={{ width:'100px', padding:'5px 7px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          <button onClick={handleAddSchool} disabled={!newSchool || !newPrice}
            style={{ padding:'5px 12px', borderRadius:'6px', border:'none', background: newSchool && newPrice ? '#16a34a' : '#e5e7eb', color: newSchool && newPrice ? '#fff' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor: newSchool && newPrice ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            + 추가
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SchoolPriceRow({ sp, allSchools, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice]     = useState(sp.price)
  const [memo, setMemo]       = useState(sp.memo || '')
  const fmt = (n) => Number(n||0).toLocaleString('ko-KR')

  if (editing) return (
    <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap', padding:'6px 8px', background:'#fffbeb', borderRadius:'7px', border:'1px solid #fde68a' }}>
      <span style={{ fontSize:'12px', fontWeight:600, color:'#374151', minWidth:'80px' }}>{sp.schoolName}</span>
      <input type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value))}
        style={{ width:'100px', padding:'4px 7px', borderRadius:'6px', border:'1px solid #fde68a', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'right' }} />
      <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모"
        style={{ width:'100px', padding:'4px 7px', borderRadius:'6px', border:'1px solid #fde68a', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
      <button onClick={async () => { await onUpdate({ price, memo }); setEditing(false) }}
        style={{ padding:'3px 10px', borderRadius:'5px', border:'none', background:'#16a34a', color:'#fff', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
      <button onClick={() => setEditing(false)}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
    </div>
  )

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 10px', background:'#f0fdf4', borderRadius:'7px', border:'1px solid #86efac' }}>
      <span style={{ fontSize:'12px', fontWeight:600, color:'#15803d', flex:1 }}>
        {(() => { const s = allSchools.find(x => (x.value||x) === sp.schoolName); return s ? (s.label || s) : sp.schoolName })()}
      </span>
      {sp.memo && <span style={{ fontSize:'11px', color:'#9ca3af' }}>{sp.memo}</span>}
      <span style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>{fmt(sp.price)}원</span>
      <button onClick={() => setEditing(true)}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fed7aa', background:'#fff7ed', color:'#f97316', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
      <button onClick={onDelete}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
    </div>
  )
}

// ─── 교구 지급 기록 행 (GivenRecord 신형 모델과 동일)
function SuppliesGivenRow({ record, classId, classes, onSaved }) {
  const [editing, setEditing]     = React.useState(false)
  const [item, setItem]           = React.useState(record.itemName)
  const [quarter, setQuarter]     = React.useState(record.quarter || '')
  const [givenDate, setGivenDate] = React.useState(record.givenAt || '')
  const [paidDate, setPaidDate]   = React.useState(record.paidAt  || '')

  const initSupply = () => {
    if (record.supplyStatus) return record.supplyStatus
    const s = record.status || 'given'
    return ['billed','paid'].includes(s) ? 'given' : s
  }
  const initBilling = () => {
    if (record.supplyStatus != null) return record.status || 'none'
    const s = record.status || 'given'
    if (s === 'billed') return 'billed'
    if (s === 'paid')   return 'paid'
    if (record.paymentStatus === 'unpaid') return 'unpaid'
    return 'none'
  }
  const [supplyStatus,  setSupplyStatus]  = React.useState(initSupply)
  const [billingStatus, setBillingStatus] = React.useState(initBilling)

  const SUPPLY_STYLE = {
    ready:  { bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db', label:'준비' },
    given:  { bg:'#dbeafe', color:'#1d4ed8', border:'#93c5fd', label:'지급' },
    unpaid: { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', label:'미지급(보관)' },
    extra:  { bg:'#ede9fe', color:'#7c3aed', border:'#c4b5fd', label:'추가지급' },
    own:    { bg:'#fef9c3', color:'#854d0e', border:'#fde047', label:'보유교구' },
  }
  const BILLING_STYLE = {
    billed: { bg:'#fef9c3', color:'#a16207', border:'#fde047', label:'청' },
    paid:   { bg:'#dcfce7', color:'#15803d', border:'#86efac', label:'입' },
    unpaid: { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5', label:'미입금' },
  }
  const st      = (billingStatus !== 'none' && BILLING_STYLE[billingStatus]) || SUPPLY_STYLE[supplyStatus] || SUPPLY_STYLE.given
  const ssStyle = SUPPLY_STYLE[supplyStatus]  || SUPPLY_STYLE.given
  const bsStyle = (billingStatus !== 'none' && BILLING_STYLE[billingStatus]) || { bg:'#f3f4f6', color:'#9ca3af' }

  const classInfo = (classes||[]).find(c => c.id === classId)
  const isQuarter = classInfo?.termType === 'quarter'
  const termUnit  = isQuarter ? '분기' : '학기'
  const termCount = isQuarter ? 4 : 2
  const curYear   = new Date().getFullYear()
  const termOpts  = []
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    for (let t = 1; t <= termCount; t++) termOpts.push(`${y}-${t}${termUnit}`)
  }

  const doUpdate = async (ss, bs, gd, pd) => {
    const paymentStatus = bs === 'unpaid' ? 'unpaid' : 'paid'
    await SupplyGiven.update(record.id, { supplyStatus: ss, status: bs, paymentStatus, givenAt: gd, paidAt: pd || null })
    onSaved && onSaved()
  }
  const handleSupplyChange  = async (val) => { setSupplyStatus(val);  await doUpdate(val, billingStatus, givenDate, paidDate) }
  const handleBillingChange = async (val) => { setBillingStatus(val); await doUpdate(supplyStatus, val, givenDate, paidDate) }
  const handleGivenDate     = async (val) => { setGivenDate(val);     await doUpdate(supplyStatus, billingStatus, val, paidDate) }
  const handlePaidDate      = async (val) => { setPaidDate(val);      await doUpdate(supplyStatus, billingStatus, givenDate, val) }

  const handleSave = async () => {
    if (!item.trim()) return
    const paymentStatus = billingStatus === 'unpaid' ? 'unpaid' : 'paid'
    await SupplyGiven.update(record.id, { itemName: item.trim(), givenAt: givenDate, quarter: quarter || null, supplyStatus, status: billingStatus, paymentStatus, paidAt: paidDate || null })
    setEditing(false)
    onSaved && onSaved()
  }

  if (editing) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap', padding:'7px 10px', background:st.bg, borderRadius:'8px', border:`1px solid ${st.border}` }}>
        <input value={item} onChange={e => setItem(e.target.value)}
          style={{ width:'100px', padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <input type="date" value={givenDate} onChange={e => setGivenDate(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <select value={quarter} onChange={e => setQuarter(e.target.value)}
          style={{ padding:'3px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}>
          <option value="">{termUnit} 선택</option>
          {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={handleSave}
          style={{ padding:'2px 8px', borderRadius:'5px', border:'none', background:'#16a34a', color:'#fff', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
        <button onClick={() => { setItem(record.itemName); setGivenDate(record.givenAt||''); setQuarter(record.quarter||''); setEditing(false) }}
          style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'11px', cursor:'pointer' }}>취소</button>
      </div>
    )
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:st.bg, borderRadius:'8px', border:`1px solid ${st.border}`, flexWrap:'wrap' }}>
      <span style={{ fontSize:'13px', fontWeight:600, color:st.color, flex:1, minWidth:'60px' }}>{record.itemName}</span>
      <select value={supplyStatus} onChange={e => handleSupplyChange(e.target.value)}
        style={{ padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background:ssStyle.bg, color:ssStyle.color }}>
        <option value="ready">준비</option>
        <option value="given">지급</option>
        <option value="unpaid">미지급</option>
        <option value="extra">추가지급</option>
        <option value="own">보유교구</option>
      </select>
      <input type="date" value={givenDate} onChange={e => handleGivenDate(e.target.value)} title="지급날짜"
        style={{ padding:'2px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', cursor:'pointer' }} />
      <select value={billingStatus} onChange={e => handleBillingChange(e.target.value)}
        style={{ padding:'3px 6px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background:bsStyle.bg, color:bsStyle.color }}>
        <option value="none">-</option>
        <option value="billed">청구</option>
        <option value="paid">입금</option>
        <option value="unpaid">미입금</option>
      </select>
      <input type="date" value={paidDate} onChange={e => handlePaidDate(e.target.value)} title="입금날짜"
        style={{ padding:'2px 5px', borderRadius:'5px', border:`1px solid ${st.border}`, fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', cursor:'pointer' }} />
      <button onClick={() => setEditing(true)}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fed7aa', background:'#fff7ed', color:'#f97316', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
      <button onClick={async () => { await SupplyGiven.delete(record.id); onSaved && onSaved() }}
        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
    </div>
  )
}

// ─── Supplies 전용 진도체크 모달 (Attendance ProgCheckModal과 동일 기능)
function SuppliesProgCheckModal({ student, initialProductId, productList, productPlanList, givenList, teacherId, selClassId, classes, onClose, onSaved }) {
  const classId = student._clsId || selClassId || ''
  const { success: toastSuccess } = useToast()

  const si = SupplyItems.byClassStudent(classId, student.id)[0]
  const allProds = productList

  const [selProductId, setSelProductId] = React.useState(initialProductId || si?.productId || '')
  const [selStage, setSelStage] = React.useState(() => {
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === (initialProductId || si?.productId || ''))
    return prog?.curStage ? Number(prog.curStage) : (si?.stage ? Number(si.stage) : 1)
  })
  const [remoteNo, setRemoteNo] = React.useState(si?.remoteNo || '')
  const [remoteNoSaved, setRemoteNoSaved] = React.useState(false)
  const [tick, setTick] = React.useState(0)
  const [nextProductId, setNextProductId] = React.useState(() => {
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === (initialProductId || si?.productId || ''))
    return prog?.nextProductId || ''
  })
  const [nextStage, setNextStage] = React.useState(() => {
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === (initialProductId || si?.productId || ''))
    return prog?.nextStage || 1
  })
  const [nextSaved, setNextSaved] = React.useState(false)

  // ── 학교/학생/교구 이관 상태
  const [transferSchool, setTransferSchool] = React.useState(() => {
    const _pid = initialProductId || si?.productId || ''
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
      || SupplyStudentProgress.byStudent(student.id, classId)[0]
    return prog?.transferSchool || ''
  })
  const [transferStudent, setTransferStudent] = React.useState(() => {
    const _pid = initialProductId || si?.productId || ''
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
      || SupplyStudentProgress.byStudent(student.id, classId)[0]
    return prog?.transferStudent || ''
  })
  const [transferSupply, setTransferSupply] = React.useState(() => {
    const _pid = initialProductId || si?.productId || ''
    const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
      || SupplyStudentProgress.byStudent(student.id, classId)[0]
    return prog?.transferSupply || ''
  })
  const [transferSaved, setTransferSaved] = React.useState(false)

  // 모달 열릴 때 Supabase에서 최신 이관 정보 로드 (1회만)
  const _transferLoaded = React.useRef(false)
  React.useEffect(() => {
    if (_transferLoaded.current) return
    _transferLoaded.current = true
    refreshTablesFromSupabase('supplyStudentProgress').then(() => {
      const _pid = initialProductId || si?.productId || ''
      const _prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _pid)
        || SupplyStudentProgress.byStudent(student.id, classId)[0]
      if (_prog) {
        setTransferSchool(_prog.transferSchool || '')
        setTransferStudent(_prog.transferStudent || '')
        setTransferSupply(_prog.transferSupply || '')
      }
    })
  }, [])
  const [givenNewItem, setGivenNewItem] = React.useState('')
  const [givenNewDate, setGivenNewDate] = React.useState('')
  const [givenNewPaidDate, setGivenNewPaidDate] = React.useState('')
  const [givenNewQuarter, setGivenNewQuarter] = React.useState('')
  const [givenNewSupplyStatus, setGivenNewSupplyStatus] = React.useState('given')
  const [givenNewBillingStatus, setGivenNewBillingStatus] = React.useState('none')
  const [givenSaving, setGivenSaving] = React.useState(false)

  const product = allProds.find(p => p.id === selProductId)

  // 교구 미배정 상태 — 바로 여기서 교구 설정 가능
  const [noSupplySelPid,   setNoSupplySelPid]   = React.useState('')
  const [noSupplySelStage, setNoSupplySelStage] = React.useState(1)
  const [noSupplySaving,   setNoSupplySaving]   = React.useState(false)

  if (!si) {
    const nsProd   = allProds.find(p => p.id === noSupplySelPid)
    const nsMax    = nsProd?.maxStage || 10
    const handleNsSave = async () => {
      if (!noSupplySelPid) return
      setNoSupplySaving(true)
      await SupplyItems.upsert({
        id: uid(), teacherId: teacherId || '', classId, studentId: student.id,
        productId: noSupplySelPid, stage: noSupplySelStage, remoteNo: '', createdAt: now(),
      })
      await SupplyStudentProgress.upsert({
        id: uid(), teacherId: teacherId || '', studentId: student.id, classId,
        productId: noSupplySelPid, curStage: noSupplySelStage, curSession: 1,
        updatedAt: now(), createdAt: now(),
      })
      setNoSupplySaving(false)
      toastSuccess('교구가 설정되었습니다')
      onSaved && onSaved()
    }
    return (
      <Modal open={true} onClose={onClose} title={`📊 ${student.name} 진도 체크`} width={780}>
        <div style={{ padding:'24px' }}>
          <div style={{ padding:'14px 16px', background:'#fff7ed', borderRadius:'10px', border:'1px solid #fed7aa', marginBottom:'20px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'4px' }}>📦 교구가 배정되지 않은 학생입니다</div>
            <div style={{ fontSize:'12px', color:'#b45309' }}>아래에서 교구를 선택하면 바로 진도체크를 시작할 수 있습니다</div>
          </div>
          <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'160px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>교구 선택 *</label>
              <select value={noSupplySelPid} onChange={e => { setNoSupplySelPid(e.target.value); setNoSupplySelStage(1) }}
                style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                <option value=''>-- 교구를 선택하세요 --</option>
                {allProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={noSupplySelStage} onChange={e => setNoSupplySelStage(Number(e.target.value))}
                style={{ padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: nsMax }, (_, i) => i+1).map(stg => <option key={stg} value={stg}>{stg}단계</option>)}
              </select>
            </div>
            <button onClick={handleNsSave} disabled={noSupplySaving || !noSupplySelPid}
              style={{ padding:'8px 20px', borderRadius:'8px', border:'none', background: noSupplySelPid ? C.primary : '#e5e7eb', color: noSupplySelPid ? '#fff' : '#9ca3af', fontSize:'13px', fontWeight:700, cursor: noSupplySelPid ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              {noSupplySaving ? '저장 중...' : '저장 후 진도체크'}
            </button>
          </div>
        </div>
        <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb' }}>
          <button onClick={onClose} style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>닫기</button>
        </div>
      </Modal>
    )
  }

  if (!product) return (
    <Modal open={true} onClose={onClose} title={`📊 ${student.name} 진도 체크`} width={780}>
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <div style={{ fontSize:'36px', marginBottom:'12px' }}>⚠️</div>
        <div style={{ fontSize:'15px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>교구 정보를 찾을 수 없습니다</div>
        <div style={{ fontSize:'13px', color:'#9ca3af' }}>배정된 교구가 삭제되었거나 데이터가 올바르지 않습니다</div>
      </div>
      <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb' }}>
        <button onClick={onClose} style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>닫기</button>
      </div>
    </Modal>
  )

  const spp = product.sessionsPerStage || 12
  const alertSess = product.alertSession || 3
  const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === selProductId)
  const curStage = prog?.curStage || selStage || 1
  const maxStage = product.maxStage || 10

  const origProductId = si?.productId || ''
  const origStage = si?.stage ? Number(si.stage) : 1
  const isChanged = selProductId !== origProductId || selStage !== origStage

  const nextProduct = allProds.find(p => p.id === nextProductId)
  const nextMaxStage = nextProduct?.maxStage || 10
  const origNextProductId = prog?.nextProductId || ''
  const origNextStage = prog?.nextStage || 1
  const isNextChanged = nextProductId !== origNextProductId || Number(nextStage) !== Number(origNextStage)

  const givenRecords = (givenList || []).filter(g => g.studentId === student.id && g.classId === classId)

  const classInfo = classes?.find(c => c.id === classId)
  const isQuarter = classInfo?.termType === 'quarter'
  const termUnit  = isQuarter ? '분기' : '학기'
  const termCount = isQuarter ? 4 : 2
  const curYear   = new Date().getFullYear()
  const termOpts  = []
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    for (let t = 1; t <= termCount; t++) termOpts.push(`${y}-${t}${termUnit}`)
  }

  const handleAddGiven = async () => {
    const dateRequired = givenNewSupplyStatus !== 'unpaid' && givenNewSupplyStatus !== 'own' && givenNewSupplyStatus !== 'transfer'
    if (!givenNewItem.trim() || (dateRequired && !givenNewDate)) return
    const className = classInfo ? ((classInfo.className || '') + (classInfo.section ? ' ' + classInfo.section : '')) : ''
    setGivenSaving(true)
    await SupplyGiven.insert({
      teacherId: teacherId || '',
      studentId: student.id, studentName: student.name,
      classId, className, schoolName: classInfo?.organization || '',
      productId: selProductId, productName: product.name,
      itemName: givenNewItem.trim(), givenAt: givenNewDate || undefined,
      paidAt: givenNewPaidDate || null,
      quarter: givenNewQuarter || null,
      supplyStatus: givenNewSupplyStatus,
      status: givenNewBillingStatus,
      createdAt: now(),
    })
    setGivenNewItem(''); setGivenNewDate(''); setGivenNewPaidDate('')
    setGivenNewQuarter(''); setGivenNewSupplyStatus('given'); setGivenNewBillingStatus('none')
    setGivenSaving(false)
    onSaved && onSaved()
  }

  const handleApply = () => {
    if (!si) return
    SupplyItems.upsert({ ...si, productId: selProductId, stage: selStage, remoteNo: si.remoteNo || '' })
    onSaved && onSaved(); setTick(t => t+1)
  }

  const handleSaveRemoteNo = () => {
    if (!si) return
    SupplyItems.upsert({ ...si, remoteNo })
    setRemoteNoSaved(true); setTimeout(() => setRemoteNoSaved(false), 2000)
    onSaved && onSaved()
  }

  const handleSaveNext = () => {
    if (!nextProductId) return
    const base = prog || { id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId: selProductId, curStage: selStage, curSession: 1, createdAt: now() }
    SupplyStudentProgress.upsert({ ...base, nextProductId, nextStage: Number(nextStage), updatedAt: now() })
    setNextSaved(true); setTimeout(() => setNextSaved(false), 2000)
    onSaved && onSaved()
  }

  const toggleCheck = async (productId, stage, sessionNo) => {
    const existing = SupplySessionChecks.byProductStudent(productId, student.id, classId).find(c => c.stage===stage && c.sessionNo===sessionNo)
    if (existing) await SupplySessionChecks.delete(existing.id)
    else await SupplySessionChecks.upsert({ id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId, stage, sessionNo, checkedAt: now(), createdAt: now() })
    const allChks = SupplySessionChecks.byProductStudent(productId, student.id, classId).filter(c => c.stage===stage)
    const maxSess = allChks.length > 0 ? Math.max(...allChks.map(c => c.sessionNo)) : 1
    await Promise.all([
      SupplyStudentProgress.upsert({ id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId, curStage: stage, curSession: maxSess, updatedAt: now(), createdAt: now() }),
      si ? SupplyItems.upsert({ ...si, productId, stage, remoteNo: si.remoteNo || '' }) : Promise.resolve(),
    ])
    onSaved && onSaved(); setTick(t => t+1)
  }

  const updateCheckDate = async (productId, stage, sessionNo, newDateStr) => {
    const existing = SupplySessionChecks.byProductStudent(productId, student.id, classId).find(c => c.stage===stage && c.sessionNo===sessionNo)
    if (!existing) return
    await SupplySessionChecks.upsert({ ...existing, checkedAt: new Date(newDateStr).toISOString() })
    onSaved && onSaved(); setTick(t => t+1)
  }

  return (
    <Modal open={true} onClose={() => {}} title={`📊 ${student.name} 진도 체크`} width={780}>
      <div style={{ padding:'16px 24px', overflowY:'auto', maxHeight:'65vh' }}>
        {/* 교구 시리즈 / 단계 변경 */}
        <div style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:'10px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'10px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'160px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>교구 시리즈</label>
              <select value={selProductId} onChange={e => { setSelProductId(e.target.value); setSelStage(1) }}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {allProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={selStage} onChange={e => setSelStage(Number(e.target.value))}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: maxStage }, (_, i) => i+1).map(s => <option key={s} value={s}>{s}단계</option>)}
              </select>
            </div>
            {isChanged && (
              <button onClick={handleApply}
                style={{ padding:'8px 18px', borderRadius:'8px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                ✓ 적용
              </button>
            )}
          </div>
          <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'8px' }}>
            🤖 {product.name} · {selStage}단계 배정 · 단계당 {spp}차시 기준
          </div>
        </div>
        {/* 리모컨 번호 */}
        <div style={{ padding:'10px 14px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:'10px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color:'#0369a1', whiteSpace:'nowrap' }}>🎮 리모컨 번호</span>
          <input value={remoteNo} onChange={e => setRemoteNo(e.target.value)} placeholder="예: A-12, 5번, RC03..."
            style={{ flex:1, padding:'6px 10px', borderRadius:'7px', border:'1.5px solid #bae6fd', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }} />
          <button onClick={handleSaveRemoteNo}
            style={{ padding:'6px 14px', borderRadius:'7px', border:'none', background: remoteNoSaved ? '#16a34a' : '#0284c7', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            {remoteNoSaved ? '✓ 저장됨' : '저장'}
          </button>
        </div>
        {/* 이전 단계 완료 표시 */}
        {selStage > 1 && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' }}>
            {Array.from({ length: selStage - 1 }, (_, i) => i+1).map(s => (
              <div key={s} style={{ padding:'6px 12px', borderRadius:'8px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:'12px', fontWeight:600, color:'#16a34a' }}>✅ {s}단계 완료</div>
            ))}
          </div>
        )}
        {/* 현재 단계 진도 목록 */}
        {(() => {
          const stage = selStage
          const stagePlans = (productPlanList || []).filter(p => p.productId === selProductId && p.stage === stage).sort((a,b) => a.sessionNo-b.sessionNo)
          const sessions = stagePlans.length > 0 ? stagePlans
            : Array.from({ length: spp }, (_, i) => ({ id:`d_${stage}_${i+1}`, stage, sessionNo:i+1, dummy:true }))
          const stageChecks = SupplySessionChecks.byProductStudent(selProductId, student.id, classId).filter(c => c.stage===stage)
          const checkedNos = new Set(stageChecks.map(c => c.sessionNo))
          const cnt = stageChecks.length
          const isDone = cnt >= spp
          const actualSessions = stagePlans.length > 0 ? stagePlans.length : spp
          const isAlert = cnt >= (actualSessions - alertSess) && !isDone
          return (
            <div style={{ border:`1px solid ${isDone?'#86efac':isAlert?'#fde68a':'#e5e7eb'}`, borderRadius:'10px', overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:isDone?'#f0fdf4':isAlert?'#fffbeb':'#f9fafb', display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:isDone?'#16a34a':isAlert?'#f59e0b':'#111827' }}>{stage}단계</span>
                <span style={{ fontSize:'12px', color:'#6b7280' }}>{cnt}/{spp}차시</span>
                {isDone && (() => {
                  const np = nextProductId ? allProds.find(p => p.id === nextProductId) : null
                  return np
                    ? <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료 → {np.name} {nextStage}단계 준비</span>
                    : <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료</span>
                })()}
                {isAlert && !isDone && (() => {
                  const np = nextProductId ? allProds.find(p => p.id === nextProductId) : null
                  const alertLabel = np ? `${np.name} ${nextStage}단계 준비 필요` : `${product.name} ${selStage+1}단계 준비 필요`
                  return <span style={{ fontSize:'11px', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>⚠️ {alertLabel}</span>
                })()}
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'4px' }}>
                {sessions.map(sess => {
                  const isChk = checkedNos.has(sess.sessionNo)
                  const chkRecord = stageChecks.find(c => c.sessionNo === sess.sessionNo)
                  const chkDateStr = chkRecord?.checkedAt ? (() => {
                    const d = new Date(chkRecord.checkedAt)
                    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                  })() : null
                  return (
                    <div key={sess.id}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px', borderRadius:'7px', background:isChk?'#f0fdf4':'#fff', border:`1px solid ${isChk?'#86efac':'#e5e7eb'}`, transition:'all .12s' }}>
                      <div onClick={() => toggleCheck(selProductId, stage, sess.sessionNo)}
                        style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${isChk?'#16a34a':'#e5e7eb'}`, background:isChk?'#16a34a':'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                        {isChk && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                      </div>
                      <span onClick={() => toggleCheck(selProductId, stage, sess.sessionNo)}
                        style={{ fontSize:'13px', fontWeight:isChk?600:400, color:isChk?'#16a34a':'#111827', flex:1, cursor:'pointer' }}>
                        {sess.sessionNo}차시{!sess.dummy && sess.title ? ` · ${sess.title}` : ''}
                      </span>
                      {isChk && chkDateStr && (
                        <input type="date" defaultValue={chkDateStr}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { if(e.target.value) updateCheckDate(selProductId, stage, sess.sessionNo, e.target.value) }}
                          style={{ fontSize:'11px', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:'5px', padding:'1px 4px', background:'#fff', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
      {/* 학교/학생/교구 이관 정보 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#fffbeb', position:'relative', zIndex:1 }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'4px' }}>🏫 학교·학생·교구 이관 정보</div>
        <div style={{ fontSize:'11px', color:'#b45309', marginBottom:'10px' }}>새 학교 전입 시 이전 선생님의 교구를 사용 중인지 파악하는 정보입니다</div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', fontWeight:700, color:'#92400e' }}>학교 구분</label>
            <select value={transferSchool} onChange={e => { setTransferSchool(e.target.value); setTransferSaved(false) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택</option>
              <option value="신규학교">신규학교</option>
              <option value="기존학교">기존학교</option>
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', fontWeight:700, color:'#92400e' }}>학생 구분</label>
            <select value={transferStudent} onChange={e => { setTransferStudent(e.target.value); setTransferSaved(false) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택</option>
              <option value="신규학생">신규학생</option>
              <option value="신규전학">신규전학</option>
              <option value="기존학생">기존학생</option>
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' }}>
            <label style={{ fontSize:'11px', fontWeight:700, color:'#92400e' }}>교구 구분</label>
            <select value={transferSupply} onChange={e => { setTransferSupply(e.target.value); setTransferSaved(false) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택</option>
              <option value="기존교구">기존교구</option>
              <option value="지급교구">지급교구</option>
            </select>
          </div>
          <button
            onClick={async () => {
              const _productId = selProductId || si?.productId || ''
              const _prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === _productId)
                || SupplyStudentProgress.byStudent(student.id, classId)[0]
              const base = _prog
                ? { ..._prog }
                : { id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId: _productId, createdAt: now() }
              await SupplyStudentProgress.upsert({ ...base, transferSchool, transferStudent, transferSupply, updatedAt: now() })
              setTransferSaved(true)
              setTimeout(() => {
                setTransferSaved(false)
                onSaved && onSaved()
              }, 1500)
            }}
            style={{ padding:'8px 16px', borderRadius:'8px', border:'none', background: transferSaved ? '#16a34a' : '#f59e0b', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', transition:'all .2s', alignSelf:'flex-end' }}>
            {transferSaved ? '✅ 저장됨' : '저장'}
          </button>
        </div>
        {(transferSchool || transferStudent || transferSupply) && (
          <div style={{ marginTop:'8px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {transferSchool && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px',
                background: transferSchool === '신규학교' ? '#dbeafe' : '#dcfce7',
                color: transferSchool === '신규학교' ? '#1d4ed8' : '#15803d',
                border: `1px solid ${transferSchool === '신규학교' ? '#93c5fd' : '#86efac'}` }}>
                🏫 {transferSchool}
              </span>
            )}
            {transferStudent && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px',
                background: transferStudent === '신규학생' ? '#dbeafe' : '#f3e8ff',
                color: transferStudent === '신규학생' ? '#1d4ed8' : '#7e22ce',
                border: `1px solid ${transferStudent === '신규학생' ? '#93c5fd' : '#d8b4fe'}` }}>
                👤 {transferStudent}
              </span>
            )}
            {transferSupply && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px',
                background: transferSupply === '기존교구' ? '#fef3c7' : '#dcfce7',
                color: transferSupply === '기존교구' ? '#92400e' : '#15803d',
                border: `1px solid ${transferSupply === '기존교구' ? '#fcd34d' : '#86efac'}` }}>
                📦 {transferSupply}
              </span>
            )}
            {transferSchool === '신규학교' && transferStudent === '기존학생' && transferSupply === '기존교구' && (
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'20px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}>
                ⚠️ 이전 선생님 교구 사용 중
              </span>
            )}
          </div>
        )}
      </div>

      {/* 다음 진도 준비 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#fafafa' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📌 다음 진도 준비</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'10px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'150px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>다음 교구</label>
            <select value={nextProductId} onChange={e => { setNextProductId(e.target.value); setNextStage(1) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택 안함</option>
              {allProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {nextProductId && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={nextStage} onChange={e => setNextStage(Number(e.target.value))}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: nextMaxStage }, (_, i) => i+1).map(s => <option key={s} value={s}>{s}단계</option>)}
              </select>
            </div>
          )}
          <button onClick={handleSaveNext} disabled={!nextProductId || (!isNextChanged && !nextSaved)}
            style={{ padding:'8px 16px', borderRadius:'8px', border:'none', background: nextSaved ? '#16a34a' : (nextProductId && isNextChanged ? '#f97316' : '#e5e7eb'), color: (nextProductId && isNextChanged) || nextSaved ? '#fff' : '#9ca3af', fontSize:'13px', fontWeight:700, cursor: nextProductId && isNextChanged ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', transition:'all .2s' }}>
            {nextSaved ? '✅ 저장됨' : '저장'}
          </button>
        </div>
        {nextProduct && <div style={{ marginTop:'8px', fontSize:'12px', color:'#6b7280' }}>→ {nextProduct.name} {nextStage}단계로 이어집니다</div>}
      </div>
      {/* 교구 지급 기록 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#f8fafc' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📦 교구 지급 기록</div>
        {givenRecords.length > 0 && (() => {
          const grouped = {}
          givenRecords.forEach(r => { const k = r.quarter || '미분류'; if (!grouped[k]) grouped[k] = []; grouped[k].push(r) })
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'10px' }}>
              {Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([qKey, recs]) => (
                <div key={qKey} style={{ border:'1.5px solid #86efac', borderRadius:'10px', overflow:'hidden' }}>
                  <div style={{ background:'#dcfce7', padding:'4px 12px' }}>
                    <select defaultValue={qKey === '미분류' ? '' : qKey}
                      onChange={async e => { const newQ = e.target.value || null; for (const r of recs) { await SupplyGiven.update(r.id, { quarter: newQ }) }; onSaved && onSaved() }}
                      style={{ fontSize:'12px', fontWeight:700, color:'#15803d', background:'transparent', border:'none', outline:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', padding:'2px 0' }}>
                      <option value="">미분류</option>
                      {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px', padding:'6px 8px', background:'#f0fdf4' }}>
                    {recs.map(r => <SuppliesGivenRow key={r.id} record={r} classId={classId} classes={classes} onSaved={onSaved} />)}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={givenNewItem} onChange={e => setGivenNewItem(e.target.value)} placeholder="교구명 입력"
            style={{ flex:1, minWidth:'80px', padding:'7px 10px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          <select value={givenNewQuarter} onChange={e => setGivenNewQuarter(e.target.value)}
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
            <option value="">{termUnit} 선택</option>
            {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={givenNewSupplyStatus} onChange={e => setGivenNewSupplyStatus(e.target.value)}
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
            <option value="ready">준비</option>
            <option value="given">지급</option>
            <option value="unpaid">미지급</option>
            <option value="extra">추가지급</option>
            <option value="own">보유교구</option>
          </select>
          <input type="date" value={givenNewDate} onChange={e => setGivenNewDate(e.target.value)}
            title={['unpaid','own'].includes(givenNewSupplyStatus) ? '지급날짜 (생략 가능)' : '지급날짜'}
            style={{ padding:'7px 6px', borderRadius:'7px', border:`1.5px solid ${['unpaid','own'].includes(givenNewSupplyStatus) ? '#fde68a' : '#e5e7eb'}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer', background: ['unpaid','own'].includes(givenNewSupplyStatus) ? '#fffbeb' : '#fff' }} />
          <select value={givenNewBillingStatus} onChange={e => setGivenNewBillingStatus(e.target.value)}
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
            <option value="none">-</option>
            <option value="billed">청구</option>
            <option value="paid">입금</option>
            <option value="unpaid">미입금</option>
          </select>
          <input type="date" value={givenNewPaidDate} onChange={e => setGivenNewPaidDate(e.target.value)}
            title="입금날짜"
            style={{ padding:'7px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }} />
          <button onClick={handleAddGiven} disabled={!givenNewItem.trim() || (!['unpaid','own'].includes(givenNewSupplyStatus) && !givenNewDate) || givenSaving}
            style={{ padding:'7px 12px', borderRadius:'7px', border:'none', background: givenNewItem.trim() && (['unpaid','own'].includes(givenNewSupplyStatus) || givenNewDate) ? '#16a34a' : '#e5e7eb', color: givenNewItem.trim() && (['unpaid','own'].includes(givenNewSupplyStatus) || givenNewDate) ? '#fff' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor: givenNewItem.trim() && (['unpaid','own'].includes(givenNewSupplyStatus) || givenNewDate) ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            + 추가
          </button>
        </div>
      </div>
      <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb' }}>
        <button onClick={onClose}
          style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

export function Supplies({ user }) {
  // ── 기본 상태
  const [subjects, setSubjects]       = useState([])
  const [selSubject, setSelSubject]   = useState(null)
  const [vendorList, setVendorList]   = useState([])
  const [productList, setProductList] = useState([])
  const [productPlanList, setProductPlanList] = useState([])
  const [itemList, setItemList]       = useState([])
  const [planList, setPlanList]       = useState([])
  const [progressList, setProgressList] = useState([])
  const [checkList, setCheckList]     = useState([])
  const [classes, setClasses]         = useState([])
  const [students, setStudents]       = useState([])

  // 탭
  const [innerTab, setInnerTab]       = useState('supply')
  // 교구(로봇) 탭 내부 뷰: 'assign'=교구배정, 'progress'=진도체크
  const [robotView, setRobotView]     = useState('assign')
  const [selClassId, setSelClassId]   = useState('')
  const [checkedStudents, setCheckedStudents] = useState([])

  // 교구 설정 모달
  const [supplyModal, setSupplyModal] = useState(false)
  const [supplyForm, setSupplyForm]   = useState({ name:'', productId:'', stage:1, remoteNo:'' })

  // 진도 체크 모달 (학생별)
  const [progressModal, setProgressModal] = useState(false)
  const [progressStudent, setProgressStudent] = useState(null)
  const [progressProductId, setProgressProductId] = useState('')

  // 파일 모달
  const [fileModal, setFileModal]     = useState(false)
  const [fileModalMode, setFileModalMode] = useState('plan')
  const [fileForm, setFileForm]       = useState({ fileType:'annual', schools:[], vendorId:'', productId:'', stage:'' })
  const [fileTarget, setFileTarget]   = useState(null)   // vendorId
  const [fileProductTarget, setFileProductTarget] = useState(null) // productId
  const [modalFile, setModalFile]     = useState(null)
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef()

  // 교구업체 모달
  const [vendorModal, setVendorModal] = useState(false)
  const [vendorForm, setVendorForm]   = useState({ name:'', managerName:'', contact:'', memo:'', subjects:[] })
  const [vendorEditId, setVendorEditId] = useState(null)
  const [vendorNewSubject, setVendorNewSubject] = useState('')
  const [expandedVendor, setExpandedVendor] = useState(null)
  const [expandedStage, setExpandedStage]   = useState(null)  // 진도체크 단계 펼침

  // 교구 등록/수정 모달
  const [productModal, setProductModal] = useState(false)
  const [priceModal, setPriceModal]     = useState(null) // product object
  const [productVendorId, setProductVendorId] = useState(null)
  const [productForm, setProductForm] = useState({ id:null, name:'', maxStage:10, sessionsPerStage:12, alertSession:3, subject:'', price:0, consumerPrice:0, schoolPrice:0, branchPrice:0, teacherPrice:0, purchasePrice:0 })
  const [productStageTab, setProductStageTab] = useState(1)
  const [stageSessionTitles, setStageSessionTitles] = useState({})

  // 차시 지도안 모달 (교구+단계별)
  const [sessionPlanModal, setSessionPlanModal] = useState(false)
  const [sessionPlanTarget, setSessionPlanTarget] = useState({ productId:'', stage:1 })
  const [sessionPlanList, setSessionPlanList]   = useState([]) // 해당 단계 차시 목록
  const [sessionPlanEdits, setSessionPlanEdits] = useState([]) // 로컬 편집 상태

  // 과목 추가
  const [subjectModal, setSubjectModal] = useState(false)
  const [newSubject, setNewSubject]     = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  // 교구 준비/지급 체크 모달
  const [supplyCheckModal, setSupplyCheckModal] = useState(null) // { studentId, classId, productId, alertLabel, studentName }
  // 교구 지급 기록
  const [givenList, setGivenList]           = useState([])
  const [schoolPriceList, setSchoolPriceList] = useState([])
  const [givenFilter, setGivenFilter]   = useState({ school:'', classId:'' })
  const [givenTermFilter, setGivenTermFilter]       = useState('')
  const [givenStatusFilter, setGivenStatusFilter]   = useState('') // 'given'|'unpaid'|'extra'|'paid'|''
  const [givenStudentFilter, setGivenStudentFilter] = useState('') // '신규학생'|'신규전학'|'기존학생'|''
  const [summaryDetailModal, setSummaryDetailModal] = useState(null) // { label, recs, color }
  const [givenInputs, setGivenInputs]   = useState({}) // { studentId_productId: date }
  const [bulkChecked, setBulkChecked]   = useState([])
  const [bulkSupplyStatus,  setBulkSupplyStatus]  = useState('given')
  const [bulkBillingStatus, setBulkBillingStatus] = useState('none')
  const [bulkDate, setBulkDate]         = useState('')
  const [givenCalYM, setGivenCalYM]           = useState(() => new Date().toISOString().slice(0,7))
  const [givenCalDetailDate, setGivenCalDetailDate] = useState(null)

  const { error: toastError, success } = useToast()

  const schoolList = [...new Set(classes.map(c => c.organization).filter(Boolean))]

  const reload = () => {
    const dbSubjects = SupplySubjects.byTeacher(user.id)
    if (dbSubjects.length === 0) {
      DEFAULT_SUBJECTS.forEach((name, i) => {
        const already = SupplySubjects.byTeacher(user.id).find(s => s.name === name)
        if (!already) SupplySubjects.insert({ id: uid(), teacherId: user.id, name, sortOrder: i, createdAt: now() })
      })
      setSubjects(DEFAULT_SUBJECTS)
    } else {
      const unique = dbSubjects
        .sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0))
        .filter((s, idx, arr) => arr.findIndex(x => x.name === s.name) === idx)
      setSubjects(unique.map(s => s.name))
    }
    const vendors = SupplyVendors.byTeacher(user.id)
    setVendorList(vendors)
    // 첫 업체 자동 펼침 (아직 펼쳐진 것 없을 때만)
    setExpandedVendor(prev => prev || (vendors.length > 0 ? vendors[0].id : null))
    setProductList(SupplyProducts.byTeacher(user.id))
    setProductPlanList(SupplyProductPlans.byTeacher(user.id))
    setItemList(SupplyItems.byTeacher(user.id))
    setPlanList(SupplyPlans.byTeacher(user.id))
    setProgressList(SupplyStudentProgress.byTeacher(user.id))
    setCheckList(SupplySessionChecks.byTeacher(user.id))
    setClasses(sortClasses(Classes.byTeacher(user.id)))
    setStudents(Students.byTeacher(user.id))
    setGivenList(SupplyGiven.byTeacher(user.id))
    setSchoolPriceList(SupplySchoolPrices.all())
  }

  useEffect(() => {
    reload()
    const u1 = onDbChange('supplyStudentProgress', reload)
    const u2 = onDbChange('supplyItems',           reload)
    const u3 = onDbChange('supplySessionChecks',   reload)
    const u4 = onDbChange('supplyGiven',           reload)
    const u5 = onDbChange('supplySchoolPrices',    reload)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])
  useEffect(() => { if (subjects.length > 0 && !selSubject) setSelSubject(subjects[0]) }, [subjects])
  useEffect(() => { setCheckedStudents([]) }, [selClassId, selSubject])

  const isRobot = selSubject === '로봇'

  // ── 교구 배정
  const confirmedStudents = students
    .filter(s => s.classIds?.includes(selClassId) && s.status === 'confirmed')
    .sort((a, b) => {
      const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
      if (gradeCmp !== 0) return gradeCmp
      const classCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
      if (classCmp !== 0) return classCmp
      const numCmp = parseInt(a.number||'0') - parseInt(b.number||'0')
      if (numCmp !== 0) return numCmp
      return (a.name||'').localeCompare(b.name||'', 'ko')
    })
  const allChecked = confirmedStudents.length > 0 && checkedStudents.length === confirmedStudents.length
  const toggleAll  = () => setCheckedStudents(allChecked ? [] : confirmedStudents.map(s=>s.id))
  const toggleOne  = (id) => setCheckedStudents(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])
  const getStudentSupply = (sid) => itemList.find(i => i.classId===selClassId && i.studentId===sid) || { name:'', stage:'' }

  // 로봇 교구 목록 (과목 필터)
  const robotProducts = productList.filter(p => {
    const vendor = vendorList.find(v => v.id === p.vendorId)
    return vendor?.subject === '로봇'
  })

  // 파일 등록 모달 — 현재 과목 교구 목록 (IIFE 제거로 상단 이동)
  const modalProducts = productList.filter(p => {
    const vendor = vendorList.find(v => v.id === p.vendorId)
    return p.subject === selSubject || vendor?.subject === selSubject ||
      (vendor?.subjects?.length > 0 ? vendor.subjects.includes(selSubject) : false)
  })
  const selectedProduct = modalProducts.find(p => p.id === fileForm.productId)
  const toggleSchool = (s) => setFileForm(f => ({
    ...f,
    schools: f.schools.includes(s) ? f.schools.filter(x => x !== s) : [...f.schools, s]
  }))

  const saveSupply = async () => {
    if (!supplyForm.name && !supplyForm.productId) { toastError('교구명을 입력하거나 교구를 선택하세요'); return }
    const product = productList.find(p => p.id === supplyForm.productId)
    const finalName = supplyForm.productId ? (product?.name || supplyForm.name) : supplyForm.name
    for (const sid of checkedStudents) {
      await SupplyItems.upsert({
        id: uid(), teacherId: user.id, classId: selClassId, studentId: sid,
        subject: selSubject,
        name: finalName,
        productId: supplyForm.productId || null,
        stage: supplyForm.stage || '',
        remoteNo: supplyForm.remoteNo || '',
        createdAt: now(),
      })
      if (supplyForm.productId) {
        await SupplyStudentProgress.upsert({
          id: uid(), teacherId: user.id, studentId: sid, classId: selClassId,
          productId: supplyForm.productId, curStage: supplyForm.stage || 1, curSession: 1,
          updatedAt: now(), createdAt: now(),
        })
      }
    }
    reload(); setSupplyModal(false); setSupplyForm({ name:'', productId:'', stage:1, remoteNo:'' }); success('수정이 완료되었습니다.')
  }

  // ── 진도 체크 헬퍼
  const getStudentChecks = (studentId, productId) =>
    checkList.filter(c => c.studentId===studentId && c.classId===selClassId && c.productId===productId)

  const getProgress = (studentId, productId) =>
    progressList.find(p => p.studentId===studentId && p.classId===selClassId && p.productId===productId)

  // 평균 진도 계산
  const avgProgress = useMemo(() => {
    if (!selClassId) return {}
    const result = {}
    robotProducts.forEach(product => {
      const progresses = confirmedStudents.map(s => {
        const checks = checkList.filter(c => c.studentId===s.id && c.classId===selClassId && c.productId===product.id)
        const prog = progressList.find(p => p.studentId===s.id && p.classId===selClassId && p.productId===product.id)
        if (!prog) return 0
        const stageChecks = checks.filter(c => c.stage === prog.curStage).length
        return (prog.curStage - 1) * (product.sessionsPerStage || 12) + stageChecks
      })
      const total = progresses.reduce((a,b)=>a+b, 0)
      result[product.id] = progresses.length > 0 ? total / progresses.length : 0
    })
    return result
  }, [checkList, progressList, confirmedStudents, selClassId, robotProducts])

  // 진도 체크 토글
  const toggleCheck = async (studentId, productId, stage, sessionNo) => {
    const existing = checkList.find(c =>
      c.studentId===studentId && c.classId===selClassId && c.productId===productId &&
      c.stage===stage && c.sessionNo===sessionNo
    )
    if (existing) {
      await SupplySessionChecks.delete(existing.id)
    } else {
      await SupplySessionChecks.upsert({
        id: uid(), teacherId: user.id, studentId, classId: selClassId,
        productId, stage, sessionNo, checkedAt: now(), createdAt: now(),
      })
    }
    // 진도 업데이트: 현재 단계에서 체크된 최대 차시 기준
    const allChecks = SupplySessionChecks.byProductStudent(productId, studentId, selClassId)
    const stageChecks = allChecks.filter(c => c.stage === stage)
    const maxSession = stageChecks.length > 0 ? Math.max(...stageChecks.map(c=>c.sessionNo)) : 1
    await SupplyStudentProgress.upsert({
      id: uid(), teacherId: user.id, studentId, classId: selClassId,
      productId, curStage: stage, curSession: maxSession, updatedAt: now(), createdAt: now(),
    })
    reload()
  }

  // ── 업체/교구 관련
  const subjectVendors = vendorList.filter(v => (v.subjects?.length > 0 ? v.subjects.includes(selSubject) : v.subject === selSubject))
  const subjectPlans   = planList.filter(p => p.subject === selSubject && !p.vendorId)

  const vendorFiles    = (vendorId) => planList.filter(p => p.vendorId === vendorId)


  const openVendorModal = (existingVendor=null) => {
    if (existingVendor) {
      setVendorEditId(existingVendor.id)
      setVendorForm({
        name: existingVendor.name || '',
        managerName: existingVendor.managerName || '',
        contact: existingVendor.contact || '',
        memo: existingVendor.memo || '',
        subjects: existingVendor.subjects?.length > 0
          ? existingVendor.subjects
          : [existingVendor.subject].filter(Boolean),
      })
    } else {
      setVendorEditId(null)
      setVendorForm({ name:'', managerName:'', contact:'', memo:'', subjects: selSubject ? [selSubject] : [] })
    }
    setVendorNewSubject('')
    setVendorModal(true)
  }

  const saveVendor = () => {
    if (!vendorForm.name) { toastError('업체명을 입력하세요'); return }
    const subjectVal = vendorForm.subjects.length > 0 ? vendorForm.subjects[0] : selSubject
    if (vendorEditId) {
      SupplyVendors.update(vendorEditId, {
        name: vendorForm.name, managerName: vendorForm.managerName,
        contact: vendorForm.contact, memo: vendorForm.memo,
        subject: subjectVal, subjects: vendorForm.subjects,
      })
      reload(); setVendorModal(false); setVendorEditId(null); setVendorForm({ name:'', managerName:'', contact:'', memo:'', subjects:[] }); success('수정이 완료되었습니다.')
    } else {
      SupplyVendors.insert({ id: uid(), teacherId: user.id, subject: subjectVal, subjects: vendorForm.subjects, name: vendorForm.name, managerName: vendorForm.managerName, contact: vendorForm.contact, memo: vendorForm.memo, createdAt: now() })
      reload(); setVendorModal(false); setVendorForm({ name:'', managerName:'', contact:'', memo:'', subjects:[] }); success('등록이 완료되었습니다.')
    }
  }
  const deleteVendor = (id) => {
    setDeleteConfirm({ msg:'이 업체를 삭제하시겠습니까?\n업체 파일도 함께 삭제됩니다.', onOk: () => {
      SupplyVendors.delete(id)
      planList.filter(p=>p.vendorId===id).forEach(p=>SupplyPlans.delete(p.id))
      productList.filter(p=>p.vendorId===id).forEach(p=>SupplyProducts.delete(p.id))
      reload(); success('삭제가 완료되었습니다.')
    }})
  }

  // 교구 등록
  // ── 일괄 등록 (엑셀 업로드) — 업체/교구/차시 전체
  const handleBulkUpload = async (e, vendorId) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const dataRows = rows.slice(1).filter(r => r[0])
      if (dataRows.length === 0) { toastError('등록할 데이터가 없습니다.'); return }

      let vendorCount = 0, productCount = 0, planCount = 0
      const allVendors = SupplyVendors.byTeacher(user.id)
      const allProducts = SupplyProducts.byTeacher(user.id)
      const allPlans = SupplyProductPlans.byTeacher(user.id)

      // 업체+교구별 그룹핑
      // 컬럼: 업체명(0) 담당자(1) 연락처(2) 과목(3) 교구명(4) 단계(5) 차시번호(6) 차시제목(7) 메모(8)
      const vendorMap = {}
      dataRows.forEach(r => {
        const vendorName  = String(r[0] || '').trim()
        const managerName = String(r[1] || '').trim()
        const contact     = String(r[2] || '').trim()
        const subject     = String(r[3] || '').trim()
        const productName = String(r[4] || '').trim()
        const stage       = Number(r[5]) || 1
        const sessionNo   = Number(r[6]) || 1
        const title       = String(r[7] || '').trim()
        const memo        = String(r[8] || '').trim()
        if (!vendorName) return
        if (!vendorMap[vendorName]) vendorMap[vendorName] = { managerName, contact, subject, products: {} }
        if (productName) {
          if (!vendorMap[vendorName].products[productName]) vendorMap[vendorName].products[productName] = { subject, plans: [] }
          vendorMap[vendorName].products[productName].plans.push({ stage, sessionNo, title, memo })
        }
      })

      Object.entries(vendorMap).forEach(([vendorName, vInfo]) => {
        // 업체 등록 (중복이면 기존 것 사용)
        let vendor = allVendors.find(v => v.name === vendorName)
        if (!vendor) {
          const newVendorId = uid()
          SupplyVendors.insert({
            id: newVendorId, teacherId: user.id,
            name: vendorName, managerName: vInfo.managerName,
            contact: vInfo.contact, memo: '',
            subject: vInfo.subject, subjects: vInfo.subject ? [vInfo.subject] : [],
            createdAt: now(),
          })
          vendor = { id: newVendorId }
          vendorCount++
        }

        // 교구 등록
        Object.entries(vInfo.products).forEach(([productName, pInfo]) => {
          let product = allProducts.find(p => p.vendorId === vendor.id && p.name === productName)
          if (!product) {
            const maxStage = Math.max(...pInfo.plans.map(p => p.stage))
            const newProductId = uid()
            SupplyProducts.insert({
              id: newProductId, teacherId: user.id, vendorId: vendor.id,
              name: productName, maxStage, sessionsPerStage: 12, alertSession: 3,
              subject: pInfo.subject || vInfo.subject || '', createdAt: now(),
            })
            product = { id: newProductId }
            productCount++
          }

          // 차시 등록
          pInfo.plans.forEach(pl => {
            const exists = allPlans.find(x => x.productId === product.id && x.stage === pl.stage && x.sessionNo === pl.sessionNo)
            if (!exists) {
              SupplyProductPlans.insert({
                id: uid(), teacherId: user.id, productId: product.id,
                stage: pl.stage, sessionNo: pl.sessionNo,
                title: pl.title, memo: pl.memo, createdAt: now(),
              })
              planCount++
            }
          })
        })
      })

      reload()
      success(`업체 ${vendorCount}개, 교구 ${productCount}개, 차시 ${planCount}개 등록 완료!`)
    } catch(err) {
      toastError('파일 읽기 실패: ' + err.message)
    }
  }

  const openProductModal = (vendorId, existingProduct=null) => {
    try {
      setProductVendorId(vendorId || null)
      if (existingProduct) {
        const maxS = existingProduct.maxStage || 10
        const perS = existingProduct.sessionsPerStage || 12
        const titles = {}
        for (let s = 1; s <= maxS; s++) {
          const plans = (productPlanList || [])
            .filter(p => p.productId === existingProduct.id && p.stage === s)
            .sort((a,b) => a.sessionNo - b.sessionNo)
          titles[s] = Array.from({ length: perS }, (_, i) => ({
            title: plans[i]?.title || '',
            memo:  plans[i]?.memo  || '',
          }))
        }
        setProductForm({ id: existingProduct.id, name: existingProduct.name, maxStage: maxS, sessionsPerStage: perS, alertSession: existingProduct.alertSession||3, subject: existingProduct.subject||'', consumerPrice: existingProduct.consumerPrice||0, schoolPrice: existingProduct.schoolPrice||0, branchPrice: existingProduct.branchPrice||0, teacherPrice: existingProduct.teacherPrice||0, purchasePrice: existingProduct.purchasePrice||0 })
        setStageSessionTitles(titles)
      } else {
        const cnt = 12
        const titles = {}
        for (let s = 1; s <= 10; s++) {
          titles[s] = Array.from({length: cnt}, () => ({ title:'', memo:'' }))
        }
        setProductForm({ id:null, name:'', maxStage:10, sessionsPerStage:cnt, alertSession:3, subject: selSubject||'' })
        setStageSessionTitles(titles)
      }
      setProductStageTab(1)
      setProductModal(true)
    } catch(e) {
      console.error('openProductModal error:', e)
      toastError('오류가 발생했습니다: ' + e.message)
    }
  }

  const saveProduct = () => {
    if (!productForm.name) { toastError('교구명을 입력하세요'); return }
    const vendor = vendorList.find(v => v.id === productVendorId)
    const vendorSubjects = vendor ? (vendor.subjects?.length > 0 ? vendor.subjects : [vendor.subject].filter(Boolean)) : []
    if (vendorSubjects.length > 1 && !productForm.subject) { toastError('교구 과목 분류를 선택하세요'); return }
    // 같은 업체에 같은 이름의 교구 중복 등록 방지 (수정 제외)
    if (!productForm.id) {
      const duplicate = productList.find(p => p.vendorId === productVendorId && p.name === productForm.name)
      if (duplicate) { toastError(`이미 "${productForm.name}" 교구가 등록되어 있습니다`); return }
    }
    const isEdit = !!productForm.id
    const productId = isEdit ? productForm.id : uid()
    const priceFields = {
      consumerPrice: productForm.consumerPrice || 0,
      schoolPrice:   productForm.schoolPrice   || 0,
      branchPrice:   productForm.branchPrice   || 0,
      teacherPrice:  productForm.teacherPrice  || 0,
      purchasePrice: productForm.purchasePrice || 0,
    }
    if (isEdit) {
      SupplyProducts.update(productId, {
        name: productForm.name, maxStage: productForm.maxStage,
        sessionsPerStage: productForm.sessionsPerStage, alertSession: productForm.alertSession,
        subject: productForm.subject, price: productForm.consumerPrice || 0,
        ...priceFields,
      })
    } else {
      SupplyProducts.insert({
        id: productId, teacherId: user.id, vendorId: productVendorId, subject: productForm.subject || selSubject,
        name: productForm.name, maxStage: productForm.maxStage,
        sessionsPerStage: productForm.sessionsPerStage, alertSession: productForm.alertSession,
        price: productForm.consumerPrice || 0, createdAt: now(),
        ...priceFields,
      })
    }
    // 단계별 차시 제목+준비물 저장/수정
    for (let stage = 1; stage <= productForm.maxStage; stage++) {
      const items = stageSessionTitles[stage] || []
      items.forEach((item, idx) => {
        const t = typeof item === 'string' ? item : (item?.title || '')
        const m = typeof item === 'string' ? '' : (item?.memo || '')
        if (!t.trim()) return
        const sessionNo = idx + 1
        const existing = productPlanList.find(p =>
          p.productId === productId && p.stage === stage && p.sessionNo === sessionNo
        )
        if (existing) {
          SupplyProductPlans.update(existing.id, { title: t.trim(), memo: m.trim() })
        } else {
          SupplyProductPlans.insert({
            id: uid(), teacherId: user.id, productId,
            stage, sessionNo, title: t.trim(),
            memo: m.trim(), fileUrl: null, fileName: null, createdAt: now(),
          })
        }
      })
    }
    reload()
    setProductModal(false)
    setStageSessionTitles({})
    success(isEdit ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
  }
  const deleteProduct = (id) => {
    setDeleteConfirm({ msg:'이 교구를 삭제하시겠습니까?', onOk: () => { SupplyProducts.delete(id); reload(); success('삭제가 완료되었습니다.') } })
  }

  // 차시 지도안 열기
  const openSessionPlan = (productId, stage) => {
    const list = productPlanList.filter(p=>p.productId===productId && p.stage===stage).sort((a,b)=>a.sessionNo-b.sessionNo)
    setSessionPlanTarget({ productId, stage })
    setSessionPlanList(list)
    setSessionPlanEdits(list.map(p => ({ id:p.id, sessionNo:p.sessionNo, title:p.title||'', memo:p.memo||'', _isNew:false })))
    setSessionPlanModal(true)
  }
  const saveSessionPlan = async () => {
    setUploading(true)
    try {
      // 삭제: 원본에 있었는데 edits에 없는 것
      const editIds = sessionPlanEdits.filter(e=>!e._isNew).map(e=>e.id)
      sessionPlanList.forEach(o => { if (!editIds.includes(o.id)) SupplyProductPlans.delete(o.id) })
      // 추가/수정
      sessionPlanEdits.forEach(e => {
        if (e._isNew) {
          SupplyProductPlans.insert({
            id: e.id, teacherId: user.id,
            productId: sessionPlanTarget.productId,
            stage: sessionPlanTarget.stage,
            sessionNo: e.sessionNo, title: e.title, memo: e.memo||'', createdAt: now(),
          })
        } else {
          SupplyProductPlans.update(e.id, { sessionNo:e.sessionNo, title:e.title, memo:e.memo||'' })
        }
      })
      // 저장 후에도 해당 단계 레코드가 없으면 플레이스홀더 1건 삽입 (단계가 목록에 표시되도록)
      if (sessionPlanEdits.length === 0) {
        const alreadyExists = sessionPlanList.length > 0
        if (!alreadyExists) {
          SupplyProductPlans.insert({
            id: uid(), teacherId: user.id,
            productId: sessionPlanTarget.productId,
            stage: sessionPlanTarget.stage,
            sessionNo: 1, title: `${sessionPlanTarget.stage}단계 1차시`,
            memo: '', fileUrl: null, fileName: null, createdAt: now(),
          })
        }
      }
      reload()
      success('수정이 완료되었습니다.')
      setSessionPlanModal(false)
    } catch(e) { toastError('저장 실패: '+e.message) }
    finally { setUploading(false) }
  }

  // 파일 등록
  const [fileEditId, setFileEditId] = useState(null)  // 수정 중인 파일 id

  const openFileModal = (mode, vendorId=null, productId=null, editItem=null) => {
    try {
      setFileModalMode(mode)
      setFileTarget(vendorId || null)
      setFileProductTarget(productId || null)
      setFileEditId(editItem?.id || null)
      if (editItem) {
        // 수정 모드 — 같은 productId+fileType+stage인 항목들의 학교 모두 로드
        const fileType = editItem.fileType || editItem.type || 'annual'
        const siblings = planList.filter(p =>
          p.productId === editItem.productId &&
          (p.fileType||p.type) === fileType &&
          (p.stage||'') === (editItem.stage||'')
        )
        const allSchools = siblings.map(p=>p.school).filter(Boolean)
        setFileForm({
          fileType,
          schools: allSchools,
          stage: editItem.stage || '',
          vendorId: editItem.vendorId || '',
          productId: editItem.productId || '',
        })
      } else {
        const fileType = (mode==='promo' || mode==='product_promo') ? 'promo'
          : mode==='product_annual' ? 'annual'
          : mode==='product_session' ? 'session'
          : 'annual'
        setFileForm({
          fileType,
          schools:[], stage:'',
          vendorId: vendorId||'',
          productId: productId||'',
        })
      }
      setModalFile(null); setFileModal(true)
    } catch(e) {
      console.error('openFileModal error:', e)
    }
  }
  const saveFile = async () => {
    // 교구 선택 필수 (plan/session 모드)
    const needsProduct = ['plan','session','promo'].includes(fileModalMode)
    if (needsProduct && !fileForm.productId) { toastError('교구를 선택하세요'); return }
    // 차시별 지도안이면 단계 필수
    const isSession = fileModalMode === 'session' || (fileModalMode === 'plan' && fileForm.fileType === 'session')
    if (isSession && !fileForm.stage) { toastError('단계를 선택하세요'); return }
    // 제목 자동 생성
    const autoProduct = productList.find(p => p.id === (fileProductTarget || fileForm.productId))
    const autoTitle = autoProduct
      ? (fileModalMode === 'promo' || fileForm.fileType === 'promo'
          ? `${autoProduct.name} 홍보물`
          : (isSession || fileModalMode === 'product_session')
            ? `${autoProduct.name} ${fileForm.stage}단계 차시별 지도안`
            : `${autoProduct.name} 연간지도안`)
      : (fileForm.fileType === 'promo' ? '홍보물' : fileForm.fileType === 'session' ? '차시별지도안' : '지도안')
    setUploading(true)
    try {
      let fileUrl=null, fileName=null
      if (modalFile) {
        fileUrl = await uploadToStorage(user.id, `${selSubject}/${fileForm.fileType}`, modalFile)
        fileName = modalFile.name
      }
      if (fileEditId) {
        // 수정 모드 — 기존 siblings 전체 삭제 후 선택된 학교들로 새로 insert
        const productIdToUse = fileProductTarget || fileForm.productId || null
        const siblings = planList.filter(p =>
          p.productId === productIdToUse &&
          (p.fileType||p.type) === fileForm.fileType &&
          (p.stage||'') === (fileForm.stage||'')
        )
        // 기존 항목 모두 삭제
        siblings.forEach(p => SupplyPlans.delete(p.id))
        // 선택된 학교들로 새로 insert
        const schoolsToSave = fileForm.schools.length > 0 ? fileForm.schools : [null]
        schoolsToSave.forEach(school => {
          SupplyPlans.insert({
            id: uid(), teacherId: user.id, subject: selSubject,
            type: fileForm.fileType, fileType: fileForm.fileType,
            title: autoTitle,
            school: school || null,
            vendorId: fileTarget || siblings[0]?.vendorId || null,
            productId: productIdToUse,
            stage: fileForm.stage || null,
            fileUrl: fileUrl || siblings[0]?.fileUrl || null,
            fileName: fileName || siblings[0]?.fileName || null,
            createdAt: now(),
          })
        })
        setFileEditId(null)
      } else {
        // 학교 다중 저장: schools 배열 각각 insert (빈 배열이면 schools=null로 1건)
        const schoolsToSave = fileForm.schools.length > 0 ? fileForm.schools : [null]
        schoolsToSave.forEach(school => {
          SupplyPlans.insert({
            id: uid(), teacherId: user.id, subject: selSubject,
            type: fileForm.fileType, fileType: fileForm.fileType,
            title: autoTitle,
            school: school || null,
            vendorId: fileTarget||null,
            productId: fileProductTarget || fileForm.productId || null,
            stage: fileForm.stage || null,
            fileUrl, fileName, createdAt: now(),
          })
        })
      }
      reload(); setFileModal(false); setModalFile(null); setFileEditId(null); success(fileEditId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')
    } catch(e) { toastError('업로드 실패: '+e.message) }
    finally { setUploading(false) }
  }
  const deleteFile = (id) => {
    setDeleteConfirm({ msg:'이 파일을 삭제하시겠습니까?', onOk: () => { SupplyPlans.delete(id); reload(); success('삭제가 완료되었습니다.') } })
  }

  // 과목 관리
  const addSubject = () => {
    const s = newSubject.trim()
    if (!s) return
    if (subjects.includes(s)) { toastError('이미 있는 과목이에요'); return }
    SupplySubjects.insert({ id: uid(), teacherId: user.id, name:s, sortOrder:subjects.length, createdAt:now() })
    reload(); setNewSubject(''); setSubjectModal(false); setSelSubject(s)
  }
  const deleteSubject = (s) => {
    setDeleteConfirm({ msg:`"${s}" 과목을 삭제하시겠습니까?`, onOk: () => {
      const rec = SupplySubjects.byTeacher(user.id).find(r=>r.name===s)
      if (rec) SupplySubjects.delete(rec.id)
      reload()
      if (selSubject===s) setSelSubject(subjects.filter(x=>x!==s)[0]||null)
      success('삭제가 완료되었습니다.')
    }})
  }


  // 지도안/홍보물 정렬: 연간지도안 → 차시별지도안(단계 오름차순) → 나머지
  const sortPlanItems = (items) => {
    const typeOrder = { annual: 0, session: 1, promo: 2 }
    return [...items].sort((a, b) => {
      const ta = typeOrder[a.fileType || a.type] ?? 9
      const tb = typeOrder[b.fileType || b.type] ?? 9
      if (ta !== tb) return ta - tb
      // 같은 타입이면 단계 오름차순
      const sa = Number(a.stage) || 0
      const sb = Number(b.stage) || 0
      return sa - sb
    })
  }

  const INNER_TABS = [
    { key:'supply', label:`🎒 교구(${selSubject||''})` },
    { key:'plan',   label:`📋 지도안(${selSubject||''})` },
    { key:'promo',  label:`🖼 홍보물(${selSubject||''})` },
    { key:'vendor', label:`🏢 교구업체(${selSubject||''})` },
    ...(isRobot ? [{ key:'given', label:`📦 지급기록` }] : []),
  ]

  const FILE_TYPE_OPTIONS =
    fileModalMode === 'vendor'
      ? [{ v:'annual', l:'📅 연간지도안' }, { v:'session', l:'📝 차시별지도안' }, { v:'promo', l:'🖼 홍보물' }]
    : fileModalMode === 'product_annual'
      ? [{ v:'annual', l:'📅 연간지도안' }]
    : fileModalMode === 'product_session'
      ? [{ v:'session', l:'📝 차시별지도안' }]
    : fileModalMode === 'product_promo'
      ? [{ v:'promo', l:'🖼 홍보물' }]
    : innerTab === 'promo'
      ? [{ v:'promo', l:'🖼 홍보물' }]
      : [{ v:'annual', l:'📅 연간지도안' }, { v:'session', l:'📝 차시별지도안' }]

  // 파일 모달 타이틀
  const fileModalTitle =
    fileModalMode === 'product_annual' ? '📅 연간지도안 등록'
    : fileModalMode === 'product_session' ? '📝 차시별지도안 등록'
    : fileModalMode === 'product_promo' ? '🖼 홍보물 등록'
    : fileModalMode === 'vendor'        ? '🏢 업체 파일 추가'
    : innerTab === 'promo'              ? '🖼 홍보물 등록'
    : '📋 지도안 등록'

  // 연결 대상 교구명 (product_* 모드일 때)
  const fileProductName = fileProductTarget
    ? (productList.find(p => p.id === fileProductTarget)?.name || '')
    : ''

  return (
    <div style={{ padding:'24px', maxWidth:'1200px' }}>

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text, margin:0 }}>🎒 교구 및 지도안 관리</h1>
          <p style={{ fontSize:'14px', color:C.muted, marginTop:'4px' }}>과목별 교구 · 지도안 · 홍보물 · 교구업체 관리</p>
        </div>
      </div>

      {/* 과목 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        {subjects.map(s => (
          <div key={s} style={{ display:'flex', alignItems:'center' }}>
            <button onClick={() => { setSelSubject(s); setSelClassId(''); setInnerTab('supply') }}
              style={{ padding:'8px 16px', borderRadius: selSubject===s ? '8px 0 0 8px' : '8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, fontSize:'14px', background: selSubject===s ? C.primary : '#f3f4f6', color: selSubject===s ? '#fff' : C.muted, transition:'all .15s' }}>
              {s}
            </button>
            {selSubject===s && (
              <button onClick={() => deleteSubject(s)}
                style={{ padding:'8px 7px', borderRadius:'0 8px 8px 0', border:'none', cursor:'pointer', background:'#dc262620', color:C.danger, fontSize:'13px', lineHeight:1 }}>✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setSubjectModal(true)}
          style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 과목 추가
        </button>
      </div>

      {selSubject && (
        <>
          {/* 내부 탭 */}
          <div style={{ display:'flex', marginBottom:'20px', borderBottom:`1px solid ${C.border}`, overflowX:'auto' }}>
            {INNER_TABS.map(t => (
              <button key={t.key} onClick={() => setInnerTab(t.key)}
                style={{ padding:'10px 18px', border:'none', cursor:'pointer', background:'none', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight: innerTab===t.key ? 700 : 400, color: innerTab===t.key ? C.primary : C.muted, borderBottom: innerTab===t.key ? `2px solid ${C.primary}` : '2px solid transparent', marginBottom:'-1px', whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── 교구 탭 */}
          {innerTab === 'supply' && (
            <div>
              {/* 수업 선택 */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>수업 선택</label>
                <select value={selClassId} onChange={e => setSelClassId(e.target.value)}
                  style={{ ...iStyle, width:'auto', minWidth:'300px' }}>
                  <option value=''>-- 수업을 선택하세요 --</option>
                  {[...classes].sort((a, b) => {
                    const DAY = ['월','화','수','목','금','토','일']
                    const aDay = DAY.indexOf(a.days?.[0] ?? ''); const bDay = DAY.indexOf(b.days?.[0] ?? '')
                    const dayCmp = (aDay===-1?99:aDay) - (bDay===-1?99:bDay)
                    if (dayCmp !== 0) return dayCmp
                    const schoolCmp = (a.organization||'').localeCompare(b.organization||'','ko')
                    if (schoolCmp !== 0) return schoolCmp
                    const classCmp = (a.className||'').localeCompare(b.className||'','ko')
                    if (classCmp !== 0) return classCmp
                    return (a.section||'').localeCompare(b.section||'','ko')
                  }).map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.organization} · {cls.className}{cls.section ? ' '+cls.section : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selClassId && isRobot && (
                /* 로봇 전용: 교구배정 / 진도체크 뷰 전환 */
                <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
                  {[{ v:'assign', l:'🎒 교구 배정' }, { v:'progress', l:'📊 진도 체크' }].map(viewOpt => (
                    <button key={viewOpt.v} onClick={() => setRobotView(viewOpt.v)}
                      style={{ padding:'7px 18px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, background: robotView===viewOpt.v ? C.primary : '#f3f4f6', color: robotView===viewOpt.v ? '#fff' : C.muted, transition:'all .15s' }}>
                      {viewOpt.l}
                    </button>
                  ))}
                </div>
              )}

              {selClassId ? (
                <>
                  {/* ── 교구 배정 뷰 */}
                  {(!isRobot || robotView==='assign') && (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', padding:'10px 14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                        <label style={{ display:'flex', alignItems:'center', gap:'7px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:C.text }}>
                          <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width:'16px', height:'16px', cursor:'pointer' }} />
                          전체 선택 ({checkedStudents.length}/{confirmedStudents.length}명)
                        </label>
                        <div style={{ flex:1 }} />
                        {checkedStudents.length > 0 && (
                          <button onClick={() => {
                            // 다중 선택 시 빈 폼으로 열기 (일괄 설정)
                            setSupplyForm({ name:'', productId:'', stage:1 })
                            setSupplyModal(true)
                          }}
                            style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            🎒 교구 설정 ({checkedStudents.length}명)
                          </button>
                        )}
                      </div>
                      {confirmedStudents.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>확정된 학생이 없습니다</div>
                      ) : (() => {
                        const selClass   = classes.find(c => c.id === selClassId)
                        const school     = selClass?.organization || '-'
                        const classLabel = `${selClass?.className || ''}${selClass?.section ? ' '+selClass.section : ''}`
                        const cols = '32px 100px 90px 56px 44px 40px 1fr 1fr 62px 72px 110px 52px'
                        return (
                          <div style={{ display:'flex', flexDirection:'column', gap:'4px', overflowX:'auto' }}>
                            {/* 헤더 */}
                            <div style={{ display:'grid', gridTemplateColumns:cols, gap:'8px', padding:'7px 12px', background:'#f3f4f6', borderRadius:'8px', fontSize:'11px', fontWeight:700, color:C.muted, minWidth:'980px' }}>
                              <span></span>
                              <span>학교명</span>
                              <span>수업반</span>
                              <span>학년</span>
                              <span>반</span>
                              <span>번호</span>
                              <span>이름</span>
                              <span>교구명</span>
                              <span>단계</span>
                              <span>리모컨</span>
                              <span>진도</span>
                              <span></span>
                            </div>
                            {confirmedStudents.map(s => {
                              const supply    = getStudentSupply(s.id)
                              const isChecked = checkedStudents.includes(s.id)
                              const product   = productList.find(p => p.id === supply.productId)
                              const sps       = product?.sessionsPerStage || 12
                              const prog      = progressList.find(p => p.studentId===s.id && p.classId===selClassId && p.productId===supply.productId)
                              const curStage  = prog?.curStage || (supply.stage ? Number(supply.stage) : null)
                              const stageChecks = curStage
                                ? checkList.filter(c => c.studentId===s.id && c.classId===selClassId && c.productId===supply.productId && c.stage===curStage).length
                                : 0
                              const hasSupply = !!supply.name
                              return (
                                <div key={s.id}
                                  style={{ display:'grid', gridTemplateColumns:cols, gap:'8px', alignItems:'center', padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${isChecked ? C.primary : C.border}`, background: isChecked ? '#fff7ed' : C.card, minWidth:'980px' }}>
                                  <input type="checkbox" checked={isChecked} onChange={() => toggleOne(s.id)}
                                    style={{ width:'16px', height:'16px', cursor:'pointer' }} />
                                  <span style={{ fontSize:'12px', color:C.text }}>{school}</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{classLabel}</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{s.grade}학년</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{s.classNum}반</span>
                                  <span style={{ fontSize:'12px', color:C.muted }}>{s.number||'-'}</span>
                                  <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>
                                    {hasSupply && curStage && (() => {
                                      const stagePlans2 = SupplyProductPlans.byProductStage(supply.productId, curStage)
                                      const actualSess2 = stagePlans2.length > 0 ? stagePlans2.length : sps
                                      const alertSess2 = product?.alertSession || 3
                                      const isDone2 = stageChecks >= actualSess2
                                      const isAlert2 = stageChecks >= (actualSess2 - alertSess2) && !isDone2
                                      const progRec = progressList.find(p => p.studentId===s.id && p.classId===selClassId && p.productId===supply.productId)
                                      if ((!isDone2 && !isAlert2) || progRec?.supplyDelivered) return null
                                      const nextProd2 = progRec?.nextProductId ? productList.find(p => p.id === progRec.nextProductId) : null
                                      const alertLabel2 = isDone2
                                        ? (nextProd2 ? `${nextProd2.name} ${progRec.nextStage||1}단계 준비` : `${product?.name} ${curStage+1}단계 준비`)
                                        : (nextProd2 ? `${nextProd2.name} ${progRec?.nextStage||1}단계 준비 필요` : `${product?.name} ${curStage+1}단계 준비 필요`)
                                      return (
                                        <div
                                          onClick={e => { e.stopPropagation(); setSupplyCheckModal({ studentId:s.id, classId:selClassId, productId:supply.productId, alertLabel:alertLabel2, studentName:s.name }) }}
                                          style={{ marginBottom:'3px', fontSize:'10px', fontWeight:700, color:'#ef4444', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'2px 6px', whiteSpace:'nowrap', display:'inline-block', cursor:'pointer' }}>
                                          ⚠️ {alertLabel2}
                                        </div>
                                      )
                                    })()}
                                    <div>{s.name}</div>
                                  </span>
                                  <span style={{ fontSize:'12px', fontWeight:600, color: hasSupply ? '#7c3aed' : C.danger }}>
                                    {hasSupply ? (product?.name || supply.name) : '없음'}
                                  </span>
                                  <span style={{ fontSize:'12px', color: hasSupply && curStage ? C.text : C.danger }}>
                                    {hasSupply && curStage ? `${curStage}단계` : <span style={{ color:C.danger }}>없음</span>}
                                  </span>
                                  <span style={{ fontSize:'12px', color: supply.remoteNo ? C.text : C.muted }}>
                                    {supply.remoteNo || '-'}
                                  </span>
                                  <span style={{ fontSize:'12px', color: hasSupply && curStage ? C.text : C.danger }}>
                                    {hasSupply && curStage ? (() => {
                                      const stagePlans2 = SupplyProductPlans.byProductStage(supply.productId, curStage)
                                      const actualSess2 = stagePlans2.length > 0 ? stagePlans2.length : sps
                                      const alertSess2 = product?.alertSession || 3
                                      const isDone2 = stageChecks >= actualSess2
                                      const isAlert2 = stageChecks >= (actualSess2 - alertSess2) && !isDone2
                                      const nextProd2 = prog?.nextProductId ? productList.find(p => p.id === prog.nextProductId) : null
                                      const alertLabel2 = isDone2
                                        ? (nextProd2 ? `${nextProd2.name} ${prog.nextStage||1}단계 준비` : `${product?.name} ${curStage+1}단계 준비`)
                                        : (nextProd2 ? `${nextProd2.name} ${prog.nextStage||1}단계 준비 필요` : `${product?.name} ${curStage+1}단계 준비 필요`)
                                      return (
                                        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                                          <span>{sps}차시 중 {stageChecks}</span>
                                        </div>
                                      )
                                    })() : <span style={{ color:C.danger }}>없음</span>}
                                  </span>
                                  {hasSupply ? (
                                    <button onClick={e => {
                                      e.stopPropagation()
                                      // 기존 설정값 로드해서 모달 열기
                                      setCheckedStudents([s.id])
                                      // productId가 현재 productList에 없으면 무효 처리 (유령 차시 표시 방지)
                                      const validPid = productList.find(p => p.id === supply.productId) ? supply.productId : ''
                                      setSupplyForm({
                                        name: validPid ? (supply.name || '') : '',
                                        productId: validPid,
                                        stage: supply.stage ? Number(supply.stage) : 1,
                                        remoteNo: supply.remoteNo || '',
                                      })
                                      setSupplyModal(true)
                                    }}
                                      style={{ padding:'4px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                                      수정
                                    </button>
                                  ) : (
                                    <span style={{ fontSize:'11px', color:C.muted }}>—</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </>
                  )}

                  {/* ── 진도 체크 뷰 (로봇 전용) */}
                  {isRobot && robotView==='progress' && (
                    <div>
                      {robotProducts.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>
                          <div style={{ fontSize:'36px', marginBottom:'10px' }}>🤖</div>
                          <div style={{ marginBottom:'14px' }}>등록된 교구가 없습니다.</div>
                          <button
                            onClick={() => { setRobotView('assign'); setInnerTab('vendor') }}
                            style={{ fontSize:'13px', color:C.primary, background:'#fff7ed', border:`1.5px solid ${C.primary}`, borderRadius:'8px', padding:'8px 18px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:700 }}>
                            🏢 교구업체 · 교구 등록하러 가기 →
                          </button>
                        </div>
                      ) : (() => {
                        // 이 수업에서 실제 배정된 교구 목록만 (학생별 supply 기준)
                        const assignedProductIds = [...new Set(
                          confirmedStudents
                            .map(s => getStudentSupply(s.id).productId)
                            .filter(Boolean)
                        )]
                        const PRODUCT_ORDER = ['큐보', '스카이로보', '프로보테크닉']
                        const assignedProducts = robotProducts
                          .filter(p => assignedProductIds.includes(p.id))
                          .sort((a, b) => {
                            const ai = PRODUCT_ORDER.findIndex(n => (a.name||'').includes(n))
                            const bi = PRODUCT_ORDER.findIndex(n => (b.name||'').includes(n))
                            const ai2 = ai === -1 ? 99 : ai
                            const bi2 = bi === -1 ? 99 : bi
                            return ai2 - bi2
                          })

                        if (assignedProducts.length === 0) return (
                          <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>
                            <div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>
                            <div>교구가 배정된 학생이 없습니다.</div>
                            <div style={{ fontSize:'12px', marginTop:'4px' }}>교구 배정 탭에서 먼저 교구를 설정하세요.</div>
                          </div>
                        )

                        return (
                          <div>
                            {assignedProducts.map(product => {
                          const sessionsPerStage = product.sessionsPerStage || 12
                          const alertSession     = product.alertSession || 3
                          const avg = avgProgress[product.id] || 0
                          // 이 교구가 배정된 학생만
                          const productStudents = confirmedStudents.filter(s => getStudentSupply(s.id).productId === product.id)

                          return (
                            <div key={product.id} style={{ marginBottom:'24px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                              {/* 교구 헤더 */}
                              <div style={{ padding:'14px 18px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                                <div>
                                  <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>🤖 {product.name}</span>
                                  <span style={{ fontSize:'12px', color:C.muted, marginLeft:'10px' }}>단계당 {sessionsPerStage}차시 기준 · 마지막 {alertSession}차시 전 준비 알림</span>
                                </div>
                                <span style={{ fontSize:'12px', color:C.blue, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'6px', padding:'2px 8px', fontWeight:600 }}>
                                  평균 진도 {Math.round(avg * 10) / 10}차시 · {productStudents.length}명
                                </span>
                              </div>

                              {/* 학생별 진도 — 현재 진도 단계별 그룹 */}
                              <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:'10px' }}>
                                {(() => {
                                  // curStage별 그룹핑 (학생 정렬은 기존 가나다순 유지)
                                  const sortedStudents = [...productStudents].sort((a, b) => {
                                    const gd = parseInt(a.grade||'0') - parseInt(b.grade||'0')
                                    if (gd !== 0) return gd
                                    const cd = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
                                    if (cd !== 0) return cd
                                    return parseInt(a.number||'0') - parseInt(b.number||'0')
                                  })
                                  const stageMap = {}
                                  sortedStudents.forEach(s => {
                                    const prog = getProgress(s.id, product.id)
                                    const supply = getStudentSupply(s.id)
                                    const st = Number(prog?.curStage || supply.stage || 1)
                                    if (!stageMap[st]) stageMap[st] = []
                                    stageMap[st].push(s)
                                  })
                                  return Object.entries(stageMap).sort(([a],[b]) => Number(a)-Number(b)).map(([stageKey, stageStudents]) => (
                                    <div key={stageKey}>
                                      <div style={{ fontSize:'11px', fontWeight:700, color:'#6b7280', background:'#f3f4f6', borderRadius:'5px', padding:'2px 8px', display:'inline-block', marginBottom:'5px' }}>
                                        {stageKey}단계
                                      </div>
                                      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                                        {stageStudents.map(s => {
                                          const supply = getStudentSupply(s.id)
                                          const prog = getProgress(s.id, product.id)
                                          const curStage = Number(prog?.curStage || supply.stage || 1)
                                          const studentChecks = getStudentChecks(s.id, product.id)
                                          const curStageChecks = studentChecks.filter(c => c.stage === curStage)
                                          const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
                                          const todayChecks = curStageChecks.filter(c => c.checkedAt && (() => { const d = new Date(c.checkedAt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() === todayStr)
                                          const allChecks = curStageChecks
                                          const lastCheck = allChecks.length > 0 ? allChecks.reduce((a, b) => a.sessionNo > b.sessionNo ? a : b) : null
                                          const stagePlans = lastCheck ? (productPlanList || []).filter(p => p.productId === product.id && p.stage === curStage) : []
                                          const lastModelTitle = lastCheck ? (stagePlans.find(p => p.sessionNo === lastCheck.sessionNo)?.title || null) : null
                                          const totalSessions = (curStage-1)*sessionsPerStage + allChecks.length
                                          const isAhead  = totalSessions > avg + 2
                                          const isBehind = avg > 0 && totalSessions < avg - 2
                                          const hasTodayCheck = todayChecks.length > 0
                                          const rowBg     = hasTodayCheck ? '#f0fdf4' : '#f9fafb'
                                          const rowBorder = hasTodayCheck ? '#86efac' : C.border
                                          return (
                                            <div key={s.id} style={{ border:`1px solid ${rowBorder}`, borderRadius:'9px', overflow:'hidden' }}>
                                              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:rowBg }}>
                                                {/* 학년·반·번호 */}
                                                <div style={{ fontSize:'11px', color:C.muted, lineHeight:1.5, minWidth:'44px', textAlign:'center' }}>
                                                  <div>{s.grade ? s.grade+'학년' : '-'}</div>
                                                  <div>{s.classNum ? s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}</div>
                                                </div>
                                                {/* 이름 */}
                                                <span style={{ fontSize:'13px', fontWeight:700, color: hasTodayCheck ? '#16a34a' : C.text, minWidth:'50px' }}>{s.name}</span>
                                                {/* 교구 셀렉트 — 이 수업에서 진행중인 교구만 */}
                                                <select value={supply.productId || ''} onClick={e => e.stopPropagation()}
                                                  onChange={async e => {
                                                    const newPid = e.target.value; if (!newPid) return
                                                    await SupplyItems.upsert({ ...supply, id: supply.id || uid(), teacherId: user.id, classId: selClassId, studentId: s.id, productId: newPid, stage: 1, remoteNo: supply.remoteNo || '', createdAt: supply.createdAt || now() })
                                                    await SupplyStudentProgress.upsert({ id: uid(), teacherId: user.id, studentId: s.id, classId: selClassId, productId: newPid, curStage: 1, curSession: 1, updatedAt: now(), createdAt: now() })
                                                    reload()
                                                  }}
                                                  style={{ padding:'3px 6px', borderRadius:'6px', border:'1.5px solid #e5e7eb', fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none', maxWidth:'100px' }}>
                                                  {assignedProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                                {/* 단계 셀렉트 */}
                                                <select value={curStage} onClick={e => e.stopPropagation()}
                                                  onChange={async e => {
                                                    const newStage = Number(e.target.value)
                                                    await SupplyItems.upsert({ ...supply, id: supply.id || uid(), teacherId: user.id, classId: selClassId, studentId: s.id, productId: supply.productId, stage: newStage, remoteNo: supply.remoteNo || '', createdAt: supply.createdAt || now() })
                                                    await SupplyStudentProgress.upsert({ id: uid(), teacherId: user.id, studentId: s.id, classId: selClassId, productId: supply.productId, curStage: newStage, curSession: 1, updatedAt: now(), createdAt: now() })
                                                    reload()
                                                  }}
                                                  style={{ padding:'3px 6px', borderRadius:'6px', border:'1.5px solid #e5e7eb', fontSize:'11px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none', width:'64px' }}>
                                                  {Array.from({ length: product.maxStage || 10 }, (_, i) => i+1).map(stg => <option key={stg} value={stg}>{stg}단계</option>)}
                                                </select>
                                                {/* 오늘 체크 + 누적 */}
                                                {hasTodayCheck && <span style={{ fontSize:'11px', fontWeight:700, color:'#16a34a', whiteSpace:'nowrap' }}>+{todayChecks.length}차시 ({allChecks.length}차시)</span>}
                                                {!hasTodayCheck && allChecks.length > 0 && <span style={{ fontSize:'11px', color:C.muted, whiteSpace:'nowrap' }}>{allChecks.length}차시</span>}
                                                {/* 차시 제목 */}
                                                {lastModelTitle && <span style={{ fontSize:'11px', color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{lastModelTitle}</span>}
                                                {isAhead  && <span style={{ fontSize:'10px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'4px', padding:'0 4px' }}>🚀빠름</span>}
                                                {isBehind && <span style={{ fontSize:'10px', background:'#fef2f2', color:C.danger,  border:'1px solid #fca5a5', borderRadius:'4px', padding:'0 4px' }}>🐌느림</span>}
                                                {todayChecks.length >= 2 && <span style={{ fontSize:'10px', background:'#fef2f2', color:'#ef4444', border:'1px solid #fca5a5', borderRadius:'4px', padding:'1px 5px' }}>최대</span>}
                                                <button onClick={() => { setProgressStudent(s); setProgressProductId(product.id); setProgressModal(true) }}
                                                  style={{ marginLeft:'auto', padding:'4px 10px', borderRadius:'7px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                                                  체크 →
                                                </button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  ))
                                })()}
                              </div>
                            </div>
                          )
                        })}
                            {/* ── 교구 미배정 학생 섹션 */}
                            {(() => {
                              const unassigned = confirmedStudents.filter(s => !getStudentSupply(s.id).productId)
                              if (unassigned.length === 0) return null
                              return (
                                <div style={{ background:C.card, borderRadius:'14px', border:`1.5px dashed #fed7aa`, overflow:'hidden', marginBottom:'24px' }}>
                                  <div style={{ padding:'12px 18px', background:'#fff7ed', borderBottom:`1px solid #fed7aa`, display:'flex', alignItems:'center', gap:'8px' }}>
                                    <span style={{ fontSize:'14px', fontWeight:700, color:'#92400e' }}>📦 교구 미배정</span>
                                    <span style={{ fontSize:'12px', color:'#b45309' }}>{unassigned.length}명 · 클릭하면 바로 교구를 배정할 수 있습니다</span>
                                  </div>
                                  <div style={{ padding:'10px 18px', display:'flex', flexDirection:'column', gap:'6px' }}>
                                    {unassigned.map(s => (
                                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:'#fff', borderRadius:'9px', border:`1px solid #fed7aa`, cursor:'pointer' }}
                                        onClick={() => { setProgressStudent({ ...s, _clsId: selClassId }); setProgressProductId(''); setProgressModal(true) }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>
                                            {s.name}
                                            <span style={{ fontSize:'12px', color:C.muted, fontWeight:400, marginLeft:'8px' }}>{s.grade} {s.classNum}반</span>
                                          </div>
                                          <div style={{ fontSize:'12px', color:'#b45309', marginTop:'2px' }}>교구 미배정</div>
                                        </div>
                                        <span style={{ fontSize:'12px', color:C.primary }}>배정하기 →</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>🎒</div>
                  <div style={{ fontSize:'14px' }}>수업을 선택하면 학생 목록이 표시됩니다</div>
                </div>
              )}
            </div>
          )}

          {/* ── 지도안 탭 */}
          {innerTab === 'plan' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>연간/차시별 지도안을 등록합니다. 학교를 지정하면 해당 학교 제출용으로 분류됩니다.</div>
                <button onClick={() => openFileModal('plan')}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 지도안 등록
                </button>
              </div>
              {(() => {
                const planItems = subjectPlans.filter(p => p.fileType!=='promo' && p.type!=='promo')
                if (!planItems.length) return <div style={{ textAlign:'center', padding:'60px', color:C.muted }}><div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div><div style={{ fontSize:'14px' }}>등록된 지도안이 없습니다</div></div>
                // 같은 productId+fileType+stage끼리 묶어서 하나의 행으로 표시
                const grouped = []
                const seen = new Set()
                sortPlanItems(planItems).forEach(p => {
                  const key = `${p.productId||''}_${p.fileType}_${p.stage||''}`
                  if (!seen.has(key)) {
                    seen.add(key)
                    const siblings = planItems.filter(x => `${x.productId||''}_${x.fileType}_${x.stage||''}` === key)
                    const allSchools = siblings.map(x=>x.school).filter(Boolean)
                    grouped.push({ item: siblings[0], schools: allSchools, ids: siblings.map(x=>x.id) })
                  }
                })
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {grouped.map(({ item, schools, ids }) => (
                      <FileRow key={item.id} item={item} schools={schools}
                        onDelete={() => ids.forEach(id => deleteFile(id))}
                        onEdit={() => openFileModal('plan', null, item.productId, item)} />
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 홍보물 탭 */}
          {innerTab === 'promo' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>과목별 홍보물을 보관합니다. 학교를 지정하면 해당 학교 제출용으로 분류됩니다.</div>
                <button onClick={() => openFileModal('promo')}
                  style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  + 홍보물 등록
                </button>
              </div>
              {(() => {
                const promoItems = subjectPlans.filter(p=>p.fileType==='promo'||p.type==='promo')
                if (!promoItems.length) return <div style={{ textAlign:'center', padding:'60px', color:C.muted }}><div style={{ fontSize:'36px', marginBottom:'10px' }}>🖼</div><div style={{ fontSize:'14px' }}>등록된 홍보물이 없습니다</div></div>
                const noSchool = promoItems.filter(p=>!p.school)
                const schools  = [...new Set(promoItems.filter(p=>p.school).map(p=>p.school))]
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {noSchool.length > 0 && <div><div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>📁 공통 홍보물</div><div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>{sortPlanItems(noSchool).map(p=><FileRow key={p.id} item={p} onDelete={deleteFile} onEdit={item=>openFileModal('promo', null, item.productId, item)}/>)}</div></div>}
                    {schools.map(school => <div key={school}><div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>🏫 {school}</div><div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>{sortPlanItems(promoItems.filter(p=>p.school===school)).map(p=><FileRow key={p.id} item={p} onDelete={deleteFile} onEdit={item=>openFileModal('promo', null, item.productId, item)}/>)}</div></div>)}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── 교구업체 탭 */}
          {innerTab === 'vendor' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'13px', color:C.muted }}>교구업체별 담당자 · 교구 목록 · 업체 제공 자료를 관리합니다.</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => openProductModal(null)}
                    style={{ padding:'8px 18px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 교구 등록
                  </button>
                  <button onClick={() => openVendorModal()}
                    style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 업체 등록
                  </button>
                </div>
              </div>

              {subjectVendors.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px', color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏢</div>
                  <div style={{ fontSize:'14px' }}>등록된 교구업체가 없습니다</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {subjectVendors.map(v => {
                    const vFiles    = vendorFiles(v.id)
                    const vProducts = productList.filter(p => p.vendorId === v.id && (p.subject === selSubject || !p.subject))
                    const isExpanded = expandedVendor === v.id
                    return (
                      <div key={v.id} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                        {/* 업체 헤더 */}
                        <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', background: isExpanded ? '#f9fafb' : C.card }}
                          onClick={() => setExpandedVendor(isExpanded ? null : v.id)}>
                          <span style={{ fontSize:'20px' }}>🏢</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{v.name}</div>
                            <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, marginTop:'2px', flexWrap:'wrap' }}>
                              {v.managerName && <span>👤 {v.managerName}</span>}
                              {v.contact     && <span>📞 {v.contact}</span>}
                              {v.memo        && <span>📌 {v.memo}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            {vProducts.length > 0 && <span style={{ fontSize:'12px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>교구 {vProducts.length}종</span>}
                            {vFiles.length > 0    && <span style={{ fontSize:'12px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', borderRadius:'5px', padding:'2px 8px', fontWeight:600 }}>파일 {vFiles.length}개</span>}
                            <button onClick={e=>{ e.stopPropagation(); openVendorModal(v) }}
                              style={{ padding:'4px 9px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                            <button onClick={e=>{ e.stopPropagation(); deleteVendor(v.id) }}
                              style={{ padding:'4px 9px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                            <span style={{ fontSize:'14px', color:C.muted }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop:`1px solid ${C.border}` }}>
                            {/* 교구 목록 */}
                            <div style={{ padding:'14px 18px', borderBottom:`1px solid #f3f4f6` }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>🤖 교구 목록</span>
                                <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                                  {isRobot && (
                                    <button onClick={() => openProductModal(v.id)}
                                      style={{ padding:'4px 10px', borderRadius:'6px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                      + 교구 등록
                                    </button>
                                  )}
                                </div>
                              </div>
                              {vProducts.length === 0 ? (
                                <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'12px 0' }}>등록된 교구가 없습니다</div>
                              ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                                  {vProducts.map(p => {
                                    const planCount   = productPlanList.filter(pl=>pl.productId===p.id).length
                                    const sameSeriesIds = productList.filter(x=>x.name===p.name && x.vendorId===p.vendorId).map(x=>x.id)
                                    const annualPlans = planList.filter(pl=>sameSeriesIds.includes(pl.productId) && (pl.fileType==='annual'||pl.type==='annual'))
                                    const promos      = planList.filter(pl=>pl.productId===p.id && (pl.fileType==='promo'||pl.type==='promo'))
                                    return (
                                      <div key={p.id} style={{ background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                                        {/* 교구 헤더 */}
                                        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px' }}>
                                          <span style={{ fontSize:'18px' }}>🤖</span>
                                          <div style={{ flex:1 }}>
                                            <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name}</div>
                                            <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px', display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
                                              {/* 등록된 단계별 차시 수 */}
                                              {(() => {
                                                const stagesFromPlans = planList.filter(pl=>pl.productId===p.id&&(pl.fileType==='session'||pl.type==='session')&&pl.stage).map(pl=>Number(pl.stage))
                                                const stagesFromProductPlans = productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage)
                                                const registeredStages = [...new Set([...stagesFromProductPlans, ...stagesFromPlans])].sort((a,b)=>a-b)
                                                if (registeredStages.length === 0) return <span style={{ color:C.danger }}>차시지도안 미등록</span>
                                                return registeredStages.map(st => {
                                                  const cnt = productPlanList.filter(pl=>pl.productId===p.id&&pl.stage===st).length
                                                  return <span key={st} style={{ background:'#f5f3ff', color:'#7c3aed', borderRadius:'4px', padding:'1px 6px' }}>{st}단계{cnt>0?`(${cnt}차시)`:''}</span>
                                                })
                                              })()}
                                              {annualPlans.length > 0 && <span style={{ background:'#eff6ff', color:C.blue, borderRadius:'4px', padding:'1px 6px' }}>연간지도안 {[...new Set(annualPlans.map(f=>f.stage||'none'))].length}개</span>}
                                              {promos.length > 0      && <span style={{ background:'#f0fdf4', color:C.success, borderRadius:'4px', padding:'1px 6px' }}>홍보물 {promos.length}개</span>}
                                            </div>
                                          </div>
                                          <button onClick={() => openProductModal(v.id, p)}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                                          <button onClick={() => deleteProduct(p.id)}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                                          <button onClick={() => setPriceModal(p)}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #f59e0b', background:'#fffbeb', color:'#d97706', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>💰 가격</button>
                                          <button onClick={() => downloadProductsExcel(v, [p], productPlanList)}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #16a34a', background:'#f0fdf4', color:'#16a34a', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>⬇ 다운</button>
                                          <button onClick={() => downloadSampleExcel()}
                                            style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #3b82f6', background:'#eff6ff', color:'#3b82f6', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>📋 샘플</button>
                                          <label style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid #8b5cf6', background:'#f5f3ff', color:'#8b5cf6', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                            📤 일괄등록
                                            <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={(e) => handleBulkUpload(e, v.id)} />
                                          </label>
                                        </div>
                                        {/* 단계별 차시지도안 */}
                                        <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                            <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📊 단계별 진도체크</span>
                                            {(() => {
                                              const stagesFromPlans2 = planList.filter(pl=>pl.productId===p.id&&(pl.fileType==='session'||pl.type==='session')&&pl.stage).map(pl=>Number(pl.stage))
                                              const stagesFromProductPlans2 = productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage)
                                              const registeredStages = [...new Set([...stagesFromProductPlans2, ...stagesFromPlans2])].sort((a,b)=>a-b)
                                              const nextStage = registeredStages.length > 0 ? Math.max(...registeredStages) + 1 : 1
                                              return nextStage <= (p.maxStage||10) ? (
                                                <button onClick={() => openSessionPlan(p.id, nextStage)}
                                                  style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                  + 추가
                                                </button>
                                              ) : null
                                            })()}
                                          </div>
                                          {(() => {
                                            const stagesFromPlans3 = planList.filter(pl=>pl.productId===p.id&&(pl.fileType==='session'||pl.type==='session')&&pl.stage).map(pl=>Number(pl.stage))
                                            const stagesFromProductPlans3 = productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage)
                                            const registeredStages = [...new Set([...stagesFromProductPlans3, ...stagesFromPlans3])].sort((a,b)=>a-b)
                                            if (registeredStages.length === 0) return (
                                              <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시지도안이 없습니다</div>
                                            )
                                            return (
                                              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                                {registeredStages.map(stage => {
                                                  const plans = productPlanList
                                                    .filter(pl=>pl.productId===p.id&&pl.stage===stage)
                                                    .sort((a,b)=>a.sessionNo-b.sessionNo)
                                                  const expandKey = `${p.id}_${stage}`
                                                  return (
                                                    <div key={stage} style={{ background:C.card, borderRadius:'9px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                                                      {/* 단계 헤더 — 클릭하면 목차 토글 */}
                                                      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', cursor:'pointer' }}
                                                        onClick={() => setExpandedStage(prev => prev === expandKey ? null : expandKey)}>
                                                        <span style={{ fontSize:'16px' }}>📝</span>
                                                        <div style={{ flex:1 }}>
                                                          <span style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{p.name} {stage}단계 목차리스트</span>
                                                          <span style={{ fontSize:'11px', color:C.success, marginLeft:'8px' }}>{plans.length}차시</span>
                                                        </div>
                                                        <button onClick={e=>{ e.stopPropagation(); openSessionPlan(p.id, stage) }}
                                                          style={{ padding:'3px 10px', borderRadius:'6px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                          수정
                                                        </button>
                                                        <button onClick={e=>{ e.stopPropagation(); setDeleteConfirm({ msg:`${stage}단계 차시 진도체크 데이터를 삭제하시겠습니까?`, onOk: () => { productPlanList.filter(pl=>pl.productId===p.id&&pl.stage===stage).forEach(pl=>SupplyProductPlans.delete(pl.id)); reload(); success('삭제가 완료되었습니다.') } }) }}
                                                          style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                          삭제
                                                        </button>
                                                        <button onClick={e=>{ e.stopPropagation(); downloadProductsExcel(v, [p], productPlanList.filter(pl=>pl.productId===p.id&&pl.stage===stage)) }}
                                                          style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #16a34a', background:'#f0fdf4', color:'#16a34a', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                          ⬇ 다운
                                                        </button>
                                                        <button onClick={e=>{ e.stopPropagation(); downloadSampleExcel() }}
                                                          style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #3b82f6', background:'#eff6ff', color:'#3b82f6', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                          📋 샘플
                                                        </button>
                                                        <label onClick={e=>e.stopPropagation()} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #8b5cf6', background:'#f5f3ff', color:'#8b5cf6', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                          📤 일괄등록
                                                          <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={(e) => handleBulkUpload(e, v.id)} />
                                                        </label>
                                                        <span style={{ fontSize:'12px', color:C.muted, cursor:'pointer' }}>{expandedStage===expandKey ? '▲' : '▼'}</span>
                                                      </div>
                                                      {/* 차시 목차 — 펼쳤을 때만 */}
                                                      {expandedStage === expandKey && (
                                                        <div style={{ padding:'6px 12px 10px', borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:'3px' }}>
                                                          {plans.map(pl => (
                                                            <div key={pl.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr 1fr', gap:'6px', fontSize:'12px', padding:'4px 0', borderBottom:`1px solid #f9fafb` }}>
                                                              <span style={{ color:C.primary, fontWeight:700 }}>{pl.sessionNo}차시</span>
                                                              <span style={{ color:C.text }}>{pl.title}</span>
                                                              <span style={{ color:C.muted }}>{pl.memo ? `📌 ${pl.memo}` : ''}</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )
                                          })()}
                                        </div>
                                        {/* 연간지도안 */}
                                        <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                            <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📅 연간지도안</span>
                                            <button onClick={() => openFileModal('product_annual', v.id, p.id)}
                                              style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                              + 추가
                                            </button>
                                          </div>
                                          {annualPlans.length === 0 ? (
                                            <div style={{ fontSize:'12px', color:C.muted }}>등록된 연간지도안이 없습니다</div>
                                          ) : (
                                            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                              {(() => {
                                                const schools = annualPlans.map(x=>x.school).filter(Boolean)
                                                return <FileRow key={annualPlans[0].id} item={annualPlans[0]} schools={schools}
                                                  onDelete={() => annualPlans.forEach(f => deleteFile(f.id))}
                                                  onEdit={() => openFileModal('product_annual', null, annualPlans[0].productId, annualPlans[0])} />
                                              })()}
                                            </div>
                                          )}
                                        </div>

                                        {/* 차시별지도안 파일 — 단계별로 묶어서 표시 */}
                                        {(() => {
                                          const sessionPlans = planList.filter(pl => sameSeriesIds.includes(pl.productId) && (pl.fileType==='session'||pl.type==='session'))
                                          // 단계별로 묶기 (같은 단계는 학교들 합쳐서 1행)
                                          const stageGroups = []
                                          const seenStages = new Set()
                                          sessionPlans.forEach(pl => {
                                            const stage = pl.stage
                                            if (!seenStages.has(stage)) {
                                              seenStages.add(stage)
                                              const siblings = sessionPlans.filter(x => x.stage === stage)
                                              const schools = siblings.map(x=>x.school).filter(Boolean)
                                              stageGroups.push({ item: siblings[0], schools, ids: siblings.map(x=>x.id) })
                                            }
                                          })
                                          return (
                                            <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                                <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>📝 차시별지도안 파일</span>
                                                <button onClick={() => openFileModal('product_session', v.id, p.id)}
                                                  style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                                  + 추가
                                                </button>
                                              </div>
                                              {stageGroups.length === 0 ? (
                                                <div style={{ fontSize:'12px', color:C.muted }}>등록된 차시별지도안 파일이 없습니다</div>
                                              ) : (
                                                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                                  {stageGroups.sort((a,b)=>Number(a.item.stage||0)-Number(b.item.stage||0)).map(({ item, schools, ids }) => (
                                                    <FileRow key={item.id} item={item} schools={schools}
                                                      onDelete={() => ids.forEach(id => deleteFile(id))}
                                                      onEdit={() => openFileModal('product_session', null, item.productId, item)} />
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })()}
                                        {/* 홍보물 */}
                                        <div style={{ padding:'6px 14px 10px', borderTop:`1px solid ${C.border}` }}>
                                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                                            <span style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>🖼 홍보물</span>
                                            <button onClick={() => openFileModal('product_promo', v.id, p.id)}
                                              style={{ padding:'2px 8px', borderRadius:'5px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                                              + 추가
                                            </button>
                                          </div>
                                          {promos.length === 0 ? (
                                            <div style={{ fontSize:'12px', color:C.muted }}>등록된 홍보물이 없습니다</div>
                                          ) : (
                                            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                              {promos.map(f => <FileRow key={f.id} item={f} onDelete={deleteFile} onEdit={item=>openFileModal('product_promo', null, item.productId, item)}/>)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>


                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 지급기록 탭 */}
          {innerTab === 'given' && (() => {
            const today = new Date().toISOString().slice(0, 10)

            // 학기 레이블 헬퍼
            const getTermLabel = (cls) => {
              const year = cls.startDate?.slice(0, 4) || ''
              if (cls.termType === 'quarter') {
                const m = parseInt(cls.startDate?.slice(5, 7) || '1')
                const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4
                return `${year}년 ${q}분기`
              } else {
                const m = parseInt(cls.startDate?.slice(5, 7) || '3')
                const s = m >= 3 && m <= 8 ? 1 : 2
                return `${year}년 ${s}학기`
              }
            }

            // 현재 진행 중인 수업 (기본)
            const activeClasses = classes.filter(c => (c.startDate || '') <= today && (c.endDate || '') >= today)

            // 필터용 년도/학기 목록 (전체 classes 기준)
            const termOptions = [...new Map(
              classes.map(c => [getTermLabel(c), getTermLabel(c)])
            ).values()].sort().reverse()

            const filteredClasses = classes.filter(c =>
                  getTermLabel(c) === givenTermFilter &&
                  (!givenFilter.school || c.organization === givenFilter.school) &&
                  (!givenFilter.classId || c.id === givenFilter.classId)
                )

            const stuList = []
            filteredClasses.forEach(cls => {
              const clsStudents = students
                .filter(s => s.classIds?.includes(cls.id) && s.status === 'confirmed')
                .sort((a, b) => {
                  const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
                  if (gradeCmp !== 0) return gradeCmp
                  const classCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
                  if (classCmp !== 0) return classCmp
                  const numCmp = parseInt(a.number||'0') - parseInt(b.number||'0')
                  if (numCmp !== 0) return numCmp
                  return (a.name||'').localeCompare(b.name||'', 'ko')
                })
              clsStudents.forEach(stu => stuList.push({ cls, stu }))
            })

            // 반별 그룹핑
            const grouped = filteredClasses.map(cls => ({
              cls,
              studs: students
                .filter(s => s.classIds?.includes(cls.id) && s.status === 'confirmed')
                .sort((a, b) => {
                  const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
                  if (gradeCmp !== 0) return gradeCmp
                  const classCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
                  if (classCmp !== 0) return classCmp
                  const numCmp = parseInt(a.number||'0') - parseInt(b.number||'0')
                  if (numCmp !== 0) return numCmp
                  return (a.name||'').localeCompare(b.name||'', 'ko')
                })
            })).filter(g => g.studs.length > 0)

            // 학교별 수업 요일 맵
            const schoolDaysMap = {}
            classes.forEach(c => {
              if (!c.organization) return
              const days = c.days || []
              if (!schoolDaysMap[c.organization]) schoolDaysMap[c.organization] = new Set()
              days.forEach(d => schoolDaysMap[c.organization].add(d))
            })
            const DAY_ORDER = ['월','화','수','목','금','토','일']
            const getSchoolDayLabel = (school) => {
              const daySet = schoolDaysMap[school]
              if (!daySet || daySet.size === 0) return ''
              const sorted = DAY_ORDER.filter(d => daySet.has(d))
              return sorted.length > 0 ? `(${sorted.join(',')}) ` : ''
            }
            // 학교 목록 (전체 classes 기준 — 학기 필터와 무관하게 모든 학교 표시)
            const allSchools = [...new Set(
              classes.map(c => c.organization).filter(Boolean)
            )].sort((a, b) => {
              const DO = ['월','화','수','목','금','토','일']
              const aDay = DO.findIndex(d => (schoolDaysMap[a]||new Set()).has(d))
              const bDay = DO.findIndex(d => (schoolDaysMap[b]||new Set()).has(d))
              const ai = aDay === -1 ? 99 : aDay
              const bi = bDay === -1 ? 99 : bDay
              return ai !== bi ? ai - bi : a.localeCompare(b, 'ko')
            })

            // 반 목록 (학교 선택 후)
            const schoolFilteredClasses = (givenTermFilter === 'current' ? activeClasses : classes.filter(c => getTermLabel(c) === givenTermFilter))
              .filter(c => !givenFilter.school || c.organization === givenFilter.school)

            // 기간 목록 — 학교 선택 시 해당 학교 수업 기준, 미선택 시 전체
            const termBaseClasses = givenFilter.school
              ? classes.filter(c => c.organization === givenFilter.school)
              : classes
            const termOptionsForClass = [...new Map(
              termBaseClasses.map(c => [getTermLabel(c), getTermLabel(c)])
            ).values()].sort().reverse()

            // givenTermFilter 초기값 자동설정 (첫 렌더시)
            if (!givenTermFilter && termOptionsForClass.length > 0) {
              setGivenTermFilter(termOptionsForClass[0])
            }

            // ── 달력용 데이터
            const DAY_LABELS = ['월','화','수','목','금','토','일']
            const [calY, calM] = givenCalYM.split('-').map(Number)
            const firstDow = new Date(calY, calM - 1, 1).getDay()
            const calOffset = firstDow === 0 ? 6 : firstDow - 1
            const totalDays = new Date(calY, calM, 0).getDate()
            const calCells = []
            for (let i = 0; i < calOffset; i++) calCells.push(null)
            for (let d = 1; d <= totalDays; d++) calCells.push(`${givenCalYM}-${String(d).padStart(2,'0')}`)
            const givenByDate = {}
            givenList.forEach(g => {
              if (!g.givenAt) return
              if (!givenByDate[g.givenAt]) givenByDate[g.givenAt] = []
              givenByDate[g.givenAt].push(g)
            })
            const todayStr = new Date().toISOString().slice(0,10)

            // ── 요약용 데이터 (아래 리스트 필터와 동일하게 filteredClasses 기준)
            const summaryRecords = givenList.filter(g => filteredClasses.some(c => c.id === g.classId))
            const fmt = n => Number(n||0).toLocaleString('ko-KR')
            const getPrice = (r) => {
              // schoolPriceList에서 학교 + 교구명 매칭 (정확 or itemName이 productName으로 시작)
              const sp = schoolPriceList.find(x => x.schoolName === r.schoolName && r.itemName && r.itemName.startsWith(x.productName))
              if (sp) return sp.price || 0
              // productList 기준가 fallback
              const p = productList.find(x => r.itemName && r.itemName.startsWith(x.name))
              return p?.schoolPrice || p?.price || 0
            }
            // paidAt 기준 달력용 그룹
            const paidByDate = {}
            summaryRecords.filter(r => r.paidAt).forEach(g => {
              if (!paidByDate[g.paidAt]) paidByDate[g.paidAt] = []
              paidByDate[g.paidAt].push(g)
            })
            // 교구별 건수 텍스트 생성
            const itemBreakdown = (records) => {
              const map = {}
              records.forEach(r => { map[r.itemName] = (map[r.itemName] || 0) + 1 })
              return Object.entries(map).sort((a,b) => b[1]-a[1]).map(([name,cnt]) => `${name} ${cnt}`).join(', ')
            }
            const readyRecs   = summaryRecords.filter(r => r.status === 'ready')
            const givenRecs   = summaryRecords.filter(r => r.status === 'given')
            const billedRecs  = summaryRecords.filter(r => r.status === 'billed' || r.status === 'paid')
            const paidRecs    = summaryRecords.filter(r => r.status === 'paid')
            const unpaidRecs  = summaryRecords.filter(r => r.status === 'unpaid')
            const extraRecs   = summaryRecords.filter(r => r.isExtra || r.status === 'extra')

            return (
              <div>
                {/* ── 달력 */}
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                    <button onClick={() => { const d = new Date(calY, calM-2,1); setGivenCalYM(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }}
                      style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', fontSize:'14px' }}>‹</button>
                    <span style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>{calY}년 {calM}월</span>
                    <button onClick={() => { const d = new Date(calY, calM,1); setGivenCalYM(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }}
                      style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', fontSize:'14px' }}>›</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'2px' }}>
                    {DAY_LABELS.map((d,i) => (
                      <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:600, padding:'3px 0', color: i===5?'#3b82f6':i===6?'#ef4444':'#6b7280' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
                    {calCells.map((date, i) => {
                      if (!date) return <div key={i} style={{ minHeight:'56px' }} />
                      const dayRecs = givenByDate[date] || []
                      const paidDayRecs = paidByDate[date] || []
                      const isToday = date === todayStr
                      const dow = new Date(date+'T00:00:00').getDay()
                      const readyCnt  = dayRecs.filter(r => r.status === 'ready').length
                      const givenCnt  = dayRecs.filter(r => r.status === 'given').length
                      const billedCnt = dayRecs.filter(r => r.status === 'billed').length
                      const paidCnt   = dayRecs.filter(r => r.status === 'paid').length
                      const unpaidCnt = dayRecs.filter(r => r.status === 'unpaid').length
                      const paidAmt   = paidDayRecs.reduce((s,r) => s + getPrice(r), 0)
                      return (
                        <div key={date} onClick={() => (dayRecs.length > 0 || paidDayRecs.length > 0) && setGivenCalDetailDate(date)}
                          style={{ borderRadius:'7px', padding:'4px 3px', minHeight:'56px', background: isToday?'#fff7ed':'#fafafa', border:`1px solid ${isToday?'#fed7aa':'#f3f4f6'}`, cursor: (dayRecs.length>0||paidDayRecs.length>0)?'pointer':'default', transition:'box-shadow .1s' }}
                          onMouseEnter={e => { if(dayRecs.length>0||paidDayRecs.length>0) e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)' }}
                          onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                          <div style={{ fontSize:'11px', fontWeight:600, marginBottom:'2px', color: dow===6?'#3b82f6':dow===0?'#ef4444':'#374151' }}>{Number(date.slice(-2))}</div>
                          {readyCnt  > 0 && <div style={{ fontSize:'9px', background:'#f3f4f6', color:'#6b7280', borderRadius:'3px', padding:'1px 3px', marginBottom:'1px', fontWeight:600 }}>준비 {readyCnt}</div>}
                          {givenCnt  > 0 && <div style={{ fontSize:'9px', background:'#dbeafe', color:'#1d4ed8', borderRadius:'3px', padding:'1px 3px', marginBottom:'1px', fontWeight:600 }}>지급 {givenCnt}</div>}
                          {billedCnt > 0 && <div style={{ fontSize:'9px', background:'#fef9c3', color:'#a16207', borderRadius:'3px', padding:'1px 3px', marginBottom:'1px', fontWeight:600 }}>청구 {billedCnt}</div>}
                          {paidCnt   > 0 && <div style={{ fontSize:'9px', background:'#dcfce7', color:'#15803d', borderRadius:'3px', padding:'1px 3px', marginBottom:'1px', fontWeight:600 }}>입금 {paidCnt}</div>}
                          {unpaidCnt > 0 && <div style={{ fontSize:'9px', background:'#fee2e2', color:'#b91c1c', borderRadius:'3px', padding:'1px 3px', fontWeight:600 }}>미지급 {unpaidCnt}</div>}
                          {paidAmt   > 0 && <div style={{ fontSize:'9px', background:'#f0fdf4', color:'#15803d', borderRadius:'3px', padding:'1px 3px', marginTop:'1px', fontWeight:700 }}>💰{fmt(paidAmt)}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── 달력 상세 모달 */}
                <Modal open={!!givenCalDetailDate} onClose={() => setGivenCalDetailDate(null)}
                  title={`📦 ${givenCalDetailDate} 지급 기록`} width={520}>
                  <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'8px', maxHeight:'60vh', overflowY:'auto' }}>
                    {(givenByDate[givenCalDetailDate] || []).length === 0 ? (
                      <div style={{ textAlign:'center', color:'#9ca3af', padding:'20px' }}>기록 없음</div>
                    ) : (
                      (givenByDate[givenCalDetailDate] || []).map(r => {
                        return (
                          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:'#f9fafb', borderRadius:'8px', border:'1px solid #e5e7eb' }}>
                            <div style={{ fontSize:'12px', color:'#6b7280', minWidth:'70px' }}>{r.schoolName || '-'}</div>
                            <div style={{ fontSize:'13px', fontWeight:700, color:'#111827', minWidth:'60px' }}>{r.studentName || '-'}</div>
                            <div style={{ fontSize:'13px', color:'#374151', flex:1 }}>{r.itemName}</div>
                            {r.quarter && <div style={{ fontSize:'11px', color:'#9ca3af' }}>{r.quarter}</div>}

                          </div>
                        )
                      })
                    )}
                  </div>
                </Modal>

                {/* ── 지급 요약 */}
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
                  <div style={{ marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>📊 지급 요약</span>
                    <span style={{ fontSize:'11px', color:C.muted }}>
                      {givenFilter.school ? givenFilter.school : '전체 학교'}
                      {givenFilter.classId ? ` · ${schoolFilteredClasses.find(c=>c.id===givenFilter.classId)?.className || ''}` : ''}
                      {` · ${givenTermFilter}`}
                    </span>
                  </div>

                  {/* 학교별 교구 단가 목록 */}
                  {(() => {
                    const visibleSchools = givenFilter.school
                      ? allSchools.filter(s => s === givenFilter.school)
                      : allSchools
                    if (visibleSchools.length === 0) return null
                    return (
                      <div style={{ marginBottom:'12px' }}>
                        <div style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>🏫 학교별 교구비</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                          {visibleSchools.map(school => {
                            const sps = schoolPriceList.filter(sp => sp.schoolName === school)
                            const grouped = []
                            const handled = new Set()
                            // 단가 등록된 교구 (시리즈+같은단가 묶기)
                            sps.forEach(sp => {
                              if (handled.has(sp.productName)) return
                              const base = sp.productName.replace(/\d+$/, '')
                              const siblings = sps.filter(x =>
                                x.productName.replace(/\d+$/, '') === base && x.price === sp.price
                              )
                              siblings.forEach(x => handled.add(x.productName))
                              const label = siblings.length > 1
                                ? base + ' (' + siblings.map(x => x.productName.slice(base.length).trim() || '기본').join(', ') + ')'
                                : sp.productName
                              grouped.push({ label, price: sp.price, registered: true, productName: sp.productName })
                            })
                            // 단가 미등록 교구
                            productList.forEach(p => {
                              if (!sps.some(sp => sp.productName === p.name)) {
                                grouped.push({ label: p.name, price: 0, registered: false, productName: p.name })
                              }
                            })
                            return (
                              <div key={school} style={{ background:'#f9fafb', borderRadius:'7px', border:'1px solid #e5e7eb', overflow:'hidden' }}>
                                <div style={{ padding:'6px 10px', background:'#f3f4f6', borderBottom:'1px solid #e5e7eb' }}>
                                  <span style={{ fontSize:'12px', fontWeight:700, color:'#374151' }}>{getSchoolDayLabel(school)}{school}</span>
                                </div>
                                {grouped.map(({ label, price, registered, productName }) => {
                                  const prod = productList.find(p => p.name === productName)
                                  return (
                                    <div key={label}
                                      onClick={() => prod && setPriceModal(prod)}
                                      style={{ display:'flex', alignItems:'center', padding:'5px 10px', background:'#fff', borderBottom:'1px solid #f3f4f6', cursor: prod ? 'pointer' : 'default' }}>
                                      <span style={{ fontSize:'12px', color: registered ? '#374151' : '#9ca3af', flex:1 }}>{label}</span>
                                      <span style={{ fontSize:'12px', fontWeight:700, color: registered ? '#374151' : '#f97316' }}>
                                        {registered ? `${fmt(price)}원` : '단가 미등록 ✏️'}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 상태별 요약 rows */}
                  {(() => {
                    // 하위호환: supplyStatus 없는 구 레코드 처리
                    const getSupplyStatus = (r) => r.supplyStatus || (['billed','paid'].includes(r.status) ? 'given' : r.status) || 'given'
                    const getBillingStatus = (r) => {
                      if (r.supplyStatus != null) return r.status || 'none'
                      if (r.status === 'billed') return 'billed'
                      if (r.status === 'paid')   return 'paid'
                      if (r.paymentStatus === 'unpaid') return 'unpaid'
                      return 'none'
                    }
                    const givenOnlyRecs = summaryRecords.filter(r => ['given','extra'].includes(getSupplyStatus(r)))
                    const billedOnly  = summaryRecords.filter(r => getBillingStatus(r) === 'billed')
                    const paidAll     = summaryRecords.filter(r => getBillingStatus(r) === 'paid')
                    const unpaidRecs  = summaryRecords.filter(r => getBillingStatus(r) === 'unpaid')
                    const rows = [
                      { label:'준비 교구',      cnt: summaryRecords.filter(r=>getSupplyStatus(r)==='ready').length,  recs: summaryRecords.filter(r=>getSupplyStatus(r)==='ready'),  color:'#6b7280', bg:'#f3f4f6', extra: null },
                      { label:'지급 교구',      cnt: givenOnlyRecs.length, recs: givenOnlyRecs, color:'#1d4ed8', bg:'#dbeafe', extra: null },
                      { label:'청구 교구',      cnt: billedOnly.length,  recs: billedOnly,  color:'#a16207', bg:'#fef9c3',
                        extra: billedOnly.length > 0 ? `청구 ${fmt(billedOnly.reduce((s,r)=>s+getPrice(r),0))}원` : null },
                      { label:'입금',           cnt: paidAll.length, recs: paidAll, detailRecs: givenOnlyRecs, color:'#15803d', bg:'#dcfce7',
                        extra: paidAll.length > 0 ? (() => {
                          const amt = paidAll.reduce((s,r)=>s+getPrice(r),0)
                          const dates = [...new Set(paidAll.filter(r=>r.paidAt).map(r=>r.paidAt))].sort()
                          return `${fmt(amt)}원`
                        })() : null },
                      { label:'미입금',         cnt: unpaidRecs.length, recs: unpaidRecs, color:'#b91c1c', bg:'#fee2e2', extra: null },
                      { label:'추가 지급',      cnt: summaryRecords.filter(r=>getSupplyStatus(r)==='extra').length, recs: summaryRecords.filter(r=>getSupplyStatus(r)==='extra'), color:'#7c3aed', bg:'#ede9fe', extra: null },
                    ]
                    return (
                      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                        {rows.map(({ label, cnt, recs: rowRecs, detailRecs, color, bg, extra }) => {
                          const modalRecs = detailRecs || rowRecs
                          return (
                          <div key={label} onClick={() => { if (modalRecs.length > 0) { setSummaryDetailModal({ label, recs: modalRecs, color }); setBulkChecked([]) } }}
                            style={{ background:bg, borderRadius:'8px', padding:'8px 12px', cursor: modalRecs.length>0 ? 'pointer' : 'default', transition:'box-shadow .1s' }}
                            onMouseEnter={e => { if(modalRecs.length>0) e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)' }}
                            onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                            <div style={{ display:'flex', alignItems:'baseline', gap:'6px', flexWrap:'wrap', marginBottom: modalRecs.length>0?'4px':0 }}>
                              <span style={{ fontSize:'10px', color, fontWeight:600 }}>{label}</span>
                              <span style={{ fontSize:'16px', fontWeight:800, color }}>{cnt}건</span>
                              {extra && <span style={{ fontSize:'11px', fontWeight:700, color }}>{extra}</span>}
                              {modalRecs.length > 0 && <span style={{ fontSize:'10px', color, opacity:0.6, marginLeft:'auto' }}>▶ 상세보기</span>}
                            </div>
                            {rowRecs.length > 0 && (
                              <div style={{ fontSize:'11px', color, opacity:0.85, lineHeight:1.6 }}>{itemBreakdown(rowRecs)}</div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* 요약 상세 모달 */}
                {summaryDetailModal && (() => {
                  const toQKey = (q) => q ? q.replace(/^(\d+)년\s*(\d+)/, '$1-$2') : ''
                  const periodRecs = summaryDetailModal.recs.filter(r =>
                    toQKey(r.quarter) === toQKey(givenTermFilter)
                  )
                  const allIds = periodRecs.map(r => r.id)
                  const allBulkChecked = allIds.length > 0 && allIds.every(id => bulkChecked.includes(id))

                  const handleBulkApply = async () => {
                    if (bulkChecked.length === 0) return
                    const targetRecs = periodRecs.filter(r => bulkChecked.includes(r.id))
                    for (const r of targetRecs) {
                      const patch = { supplyStatus: bulkSupplyStatus, status: bulkBillingStatus }
                      if (['given','extra'].includes(bulkSupplyStatus) && bulkDate) patch.givenAt = bulkDate
                      if (['billed','paid'].includes(bulkBillingStatus) && bulkDate) patch.paidAt = bulkDate
                      if (bulkBillingStatus === 'none') patch.paidAt = null
                      patch.paymentStatus = bulkBillingStatus === 'unpaid' ? 'unpaid' : 'paid'
                      await SupplyGiven.update(r.id, patch)
                    }
                    reload()
                    setBulkChecked([])
                    success(`${targetRecs.length}건 일괄 적용 완료`)
                  }

                  const schoolOrder = allSchools.filter(s => filteredClasses.some(c => c.organization === s))

                  return (
                    <Modal open={true} onClose={() => { setSummaryDetailModal(null); setBulkChecked([]) }}
                      title={`📋 ${summaryDetailModal.label} 상세내역 (${summaryDetailModal.recs.length}건) · ${givenTermFilter}`} width={640}>
                      {/* 일괄처리 바 */}
                      <div style={{ padding:'10px 16px', background:'#f8fafc', borderBottom:'1px solid #e5e7eb', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                        <label style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', fontSize:'12px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>
                          <input type="checkbox" checked={allBulkChecked}
                            onChange={() => setBulkChecked(allBulkChecked ? [] : allIds)}
                            style={{ width:'15px', height:'15px', cursor:'pointer', accentColor:'#3b82f6' }} />
                          전체
                        </label>
                        <span style={{ fontSize:'11px', color:'#9ca3af' }}>{bulkChecked.length > 0 ? `${bulkChecked.length}건 선택` : '항목 선택 후'}</span>
                        {/* 지급 교구 모달: 지급상태 드롭만 표시 */}
                        {summaryDetailModal.label === '지급 교구' && (
                          <select value={bulkSupplyStatus} onChange={e => setBulkSupplyStatus(e.target.value)}
                            style={{ padding:'4px 7px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                            <option value="ready">준비</option>
                            <option value="given">지급</option>
                            <option value="unpaid">미지급</option>
                            <option value="extra">추가지급</option>
                          </select>
                        )}
                        {/* 청구 교구 모달: 청구/입금 드롭만 표시 */}
                        {summaryDetailModal.label === '청구 교구' && (
                          <select value={bulkBillingStatus} onChange={e => setBulkBillingStatus(e.target.value)}
                            style={{ padding:'4px 7px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                            <option value="billed">청구</option>
                            <option value="paid">입금</option>
                            <option value="unpaid">미입금</option>
                          </select>
                        )}
                        {/* 그 외(입금, 미입금 등): 둘 다 표시 */}
                        {summaryDetailModal.label !== '지급 교구' && summaryDetailModal.label !== '청구 교구' && (
                          <>
                            <select value={bulkSupplyStatus} onChange={e => setBulkSupplyStatus(e.target.value)}
                              style={{ padding:'4px 7px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                              <option value="ready">준비</option>
                              <option value="given">지급</option>
                              <option value="unpaid">미지급</option>
                              <option value="extra">추가지급</option>
                            </select>
                            <select value={bulkBillingStatus} onChange={e => setBulkBillingStatus(e.target.value)}
                              style={{ padding:'4px 7px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                              <option value="none">청구/입금 없음</option>
                              <option value="billed">청구</option>
                              <option value="paid">입금</option>
                              <option value="unpaid">미입금</option>
                            </select>
                          </>
                        )}
                        <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                          style={{ padding:'4px 7px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }} />
                        <button onClick={handleBulkApply} disabled={bulkChecked.length === 0}
                          style={{ padding:'5px 14px', borderRadius:'6px', border:'none', background: bulkChecked.length > 0 ? '#3b82f6' : '#e5e7eb', color: bulkChecked.length > 0 ? '#fff' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor: bulkChecked.length > 0 ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                          일괄적용
                        </button>
                      </div>
                      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'12px', maxHeight:'60vh', overflowY:'auto' }}>
                        {schoolOrder.map(school => {
                          const schoolClassIds = filteredClasses.filter(c => c.organization === school).map(c => c.id)
                          const allSchoolRecs = periodRecs.filter(r => r.schoolName === school)
                          if (allSchoolRecs.length === 0) return null
                          const stuList = students
                            .filter(s => s.status === 'confirmed' && s.classIds?.some(cid => schoolClassIds.includes(cid)))
                            .sort((a, b) => {
                              const ag = parseInt(a.grade||'0'), bg_ = parseInt(b.grade||'0')
                              if (ag !== bg_) return ag - bg_
                              const ac = parseInt(a.classNum||'0'), bc = parseInt(b.classNum||'0')
                              if (ac !== bc) return ac - bc
                              return parseInt(a.number||'0') - parseInt(b.number||'0')
                            })
                          return (
                            <div key={school}>
                              <div style={{ fontSize:'11px', fontWeight:700, color:'#6b7280', marginBottom:'4px', paddingBottom:'4px', borderBottom:'1px solid #e5e7eb' }}>
                                {getSchoolDayLabel(school)}{school}
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                                {stuList.map(stu => {
                                  const stuLabel = [
                                    stu.grade ? `${stu.grade}학년` : '',
                                    stu.classNum ? `${stu.classNum}반` : '',
                                    stu.number ? `${stu.number}번` : '',
                                  ].filter(Boolean).join(' ')
                                  const stuRecs = allSchoolRecs.filter(r => r.studentId === stu.id)
                                    .sort((a,b) => (a.givenAt||'').localeCompare(b.givenAt||''))
                                  if (stuRecs.length === 0) return null
                                  return (
                                    <div key={stu.id} style={{ display:'flex', gap:'8px', padding:'6px 10px', background: stuRecs.length > 1 ? '#eff6ff' : '#f9fafb', borderRadius:'7px', border: stuRecs.length > 1 ? '1px solid #bfdbfe' : '1px solid #e5e7eb' }}>
                                      <span style={{ fontSize:'11px', color:'#9ca3af', minWidth:'70px', paddingTop:'2px' }}>{stuLabel}</span>
                                      <span style={{ fontSize:'12px', fontWeight:700, color:'#111827', minWidth:'55px', paddingTop:'2px' }}>{stu.name}</span>
                                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'4px' }}>
                                        {stuRecs.map(r => (
                                          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                            <input type="checkbox"
                                              checked={bulkChecked.includes(r.id)}
                                              onChange={() => setBulkChecked(p => p.includes(r.id) ? p.filter(x=>x!==r.id) : [...p, r.id])}
                                              style={{ width:'13px', height:'13px', cursor:'pointer', accentColor:'#3b82f6' }} />
                                            <span style={{ fontSize:'12px', color:'#374151', flex:1 }}>{r.itemName}</span>
                                            {r.quarter && <span style={{ fontSize:'10px', color:'#3b82f6' }}>{r.quarter}</span>}
                                            {getPrice(r) > 0 && <span style={{ fontSize:'12px', fontWeight:700, color:'#15803d' }}>{fmt(getPrice(r))}원</span>}
                                            {summaryDetailModal.label === '입금'
                                              ? (r.paidAt
                                                ? <span style={{ fontSize:'10px', color:'#9ca3af' }}>입금 {r.paidAt}</span>
                                                : <span style={{ fontSize:'10px', color:'#ef4444', fontWeight:700 }}>등록필요</span>
                                              )
                                              : <span style={{ fontSize:'10px', color:'#9ca3af' }}>지급 {r.givenAt}</span>
                                            }
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Modal>
                  )
                })()}

                {/* 필터: 한 줄 */}
                <div style={{ display:'flex', gap:'8px', marginBottom:'16px', alignItems:'center' }}>
                  <select value={givenFilter.school} onChange={e => { setGivenFilter(f => ({ ...f, school: e.target.value, classId: '' })); setGivenTermFilter('') }}
                    style={{ flex:1, padding:'7px 10px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                    <option value=''>전체 학교</option>
                    {allSchools.map(s => <option key={s} value={s}>{getSchoolDayLabel(s)}{s}</option>)}
                  </select>
                  <select value={givenFilter.classId} onChange={e => setGivenFilter(f => ({ ...f, classId: e.target.value }))}
                    style={{ flex:1, padding:'7px 10px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                    <option value=''>전체 반</option>
                    {schoolFilteredClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.className}{c.section ? ' ' + c.section : ''}</option>
                    ))}
                  </select>
                  <select value={givenTermFilter} onChange={e => { setGivenTermFilter(e.target.value); setGivenFilter(f => ({ ...f, classId: '' })) }}
                    style={{ flex:1, padding:'7px 10px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                    {termOptionsForClass.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* 상태별 필터 버튼 */}
                {(() => {
                  const btns = [
                    { val: '',         label: '전체',    bg: '#f3f4f6', color: '#374151', act: '#374151', actBg: '#e5e7eb' },
                    { val: 'given',    label: '지급',    bg: '#dbeafe', color: '#1d4ed8', act: '#1d4ed8', actBg: '#bfdbfe' },
                    { val: 'unpaid',   label: '미지급',  bg: '#fee2e2', color: '#b91c1c', act: '#b91c1c', actBg: '#fca5a5' },
                    { val: 'extra',    label: '추가지급', bg: '#ede9fe', color: '#7c3aed', act: '#7c3aed', actBg: '#c4b5fd' },
                    { val: 'own',      label: '보유교구', bg: '#fef9c3', color: '#854d0e', act: '#854d0e', actBg: '#fde047' },
                    { val: 'paid',     label: '입금',    bg: '#dcfce7', color: '#15803d', act: '#15803d', actBg: '#86efac' },
                    { val: 'notpaid',  label: '미입금',  bg: '#fee2e2', color: '#b91c1c', act: '#b91c1c', actBg: '#fca5a5' },
                  ]
                  return (
                    <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
                      {btns.map(b => {
                        const active = givenStatusFilter === b.val
                        return (
                          <button key={b.val} onClick={() => setGivenStatusFilter(b.val)}
                            style={{ padding:'5px 14px', borderRadius:'20px', border: active ? `2px solid ${b.act}` : '1px solid #e5e7eb', background: active ? b.actBg : b.bg, color: b.color, fontSize:'12px', fontWeight: active ? 700 : 500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                            {b.label}
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* 학생 구분 필터 버튼 */}
                <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
                  {[
                    { val: '',       label: '전체학생',  bg: '#f3f4f6', color: '#374151', act: '#374151', actBg: '#e5e7eb' },
                    { val: '신규학생', label: '신규학생', bg: '#dbeafe', color: '#1d4ed8', act: '#1d4ed8', actBg: '#bfdbfe' },
                    { val: '신규전학', label: '신규전학', bg: '#e0f2fe', color: '#0369a1', act: '#0369a1', actBg: '#7dd3fc' },
                    { val: '기존학생', label: '기존학생', bg: '#f3e8ff', color: '#7e22ce', act: '#7e22ce', actBg: '#d8b4fe' },
                  ].map(b => {
                    const active = givenStudentFilter === b.val
                    return (
                      <button key={b.val} onClick={() => setGivenStudentFilter(b.val)}
                        style={{ padding:'5px 14px', borderRadius:'20px', border: active ? `2px solid ${b.act}` : '1px solid #e5e7eb', background: active ? b.actBg : b.bg, color: b.color, fontSize:'12px', fontWeight: active ? 700 : 500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        {b.label}
                      </button>
                    )
                  })}
                </div>

                {/* 학생 목록 - 반별 그룹핑 */}
                {grouped.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px', color:C.muted, fontSize:'14px' }}>해당 조건의 학생이 없습니다.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {grouped.map(({ cls, studs }) => {
                      const clsLabel = `${cls.className||''}${cls.section ? ' '+cls.section : ''}`
                      return (
                        <div key={cls.id}>
                          {/* 반 헤더 - 특정 반 선택 시 숨김 */}
                          {!givenFilter.classId && (
                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, padding:'6px 10px', background:'#f3f4f6', borderRadius:'7px', marginBottom:'6px' }}>
                              {clsLabel} <span style={{ fontWeight:400, color:C.muted }}>({studs.length}명)</span>
                            </div>
                          )}
                          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                            {studs.filter(stu => {
                              // 학생 구분 필터
                              if (givenStudentFilter) {
                                const _prog = progressList.find(p => p.studentId === stu.id && p.classId === cls.id)
                                if (!_prog || _prog.transferStudent !== givenStudentFilter) return false
                              }
                              if (!givenStatusFilter) return true
                              const recs = givenList.filter(g => g.studentId === stu.id && g.classId === cls.id)
                              return recs.some(r => {
                                const ss = r.supplyStatus || (['billed','paid'].includes(r.status) ? 'given' : r.status) || 'given'
                                const bs = r.supplyStatus != null ? (r.status || 'none') : (r.status === 'paid' ? 'paid' : r.status === 'billed' ? 'billed' : r.paymentStatus === 'unpaid' ? 'unpaid' : 'none')
                                if (givenStatusFilter === 'paid')    return bs === 'paid'
                                if (givenStatusFilter === 'notpaid') return bs === 'unpaid'
                                if (givenStatusFilter === 'unpaid')  return ss === 'unpaid'
                                if (givenStatusFilter === 'extra')   return ss === 'extra'
                                if (givenStatusFilter === 'given')   return ss === 'given'
                                return true
                              })
                            }).map(stu => {
                              const allRecords = givenList.filter(g => g.studentId === stu.id && g.classId === cls.id)
                              const matchRec = (r) => {
                                if (!givenStatusFilter) return true
                                const ss = r.supplyStatus || (['billed','paid'].includes(r.status) ? 'given' : r.status) || 'given'
                                const bs = r.supplyStatus != null ? (r.status || 'none') : (r.status === 'paid' ? 'paid' : r.status === 'billed' ? 'billed' : r.paymentStatus === 'unpaid' ? 'unpaid' : 'none')
                                if (givenStatusFilter === 'paid')    return bs === 'paid'
                                if (givenStatusFilter === 'notpaid') return bs === 'unpaid'
                                if (givenStatusFilter === 'unpaid')  return ss === 'unpaid'
                                if (givenStatusFilter === 'extra')   return ss === 'extra'
                                if (givenStatusFilter === 'given')   return ss === 'given'
                                return true
                              }
                              const records = allRecords.filter(matchRec)
                              const itemKey    = `item_${stu.id}_${cls.id}`
                              const dateKey    = `date_${stu.id}_${cls.id}`
                              const termKey    = `term_${stu.id}_${cls.id}`
                              const itemVal    = givenInputs[itemKey] || ''
                              const dateVal    = givenInputs[dateKey] || ''
                              const termVal    = givenInputs[termKey] || ''
                              const stuLabel   = [stu.grade ? `${stu.grade}학년` : '', stu.classNum ? `${stu.classNum}반` : '', stu.number ? `${stu.number}번` : ''].filter(Boolean).join(' ')

                              // 분기/학기 선택 옵션 (termType 기반)
                              const isQuarter  = cls.termType === 'quarter'
                              const termUnit   = isQuarter ? '분기' : '학기'
                              const termCount  = isQuarter ? 4 : 2
                              const curYear    = new Date().getFullYear()
                              const termOpts   = []
                              for (let y = curYear - 1; y <= curYear + 1; y++) {
                                for (let t = 1; t <= termCount; t++) {
                                  termOpts.push(`${y}-${t}${termUnit}`)
                                }
                              }

                              const extraKey   = `extra_${stu.id}_${cls.id}`
                              const isExtraVal = givenInputs[extraKey] || false

                              const handleAdd = async () => {
                                if (!itemVal.trim() || !dateVal) return
                                await SupplyGiven.insert({
                                  teacherId: user.id,
                                  studentId: stu.id,
                                  studentName: stu.name,
                                  classId: cls.id,
                                  className: clsLabel,
                                  schoolName: cls.organization || '',
                                  productId: '', productName: '',
                                  itemName: itemVal.trim(),
                                  givenAt: dateVal,
                                  quarter: termVal || null,
                                  isExtra: isExtraVal,
                                  status: isExtraVal ? 'unpaid' : 'ready',
                                  createdAt: now(),
                                })
                                setGivenInputs(p => ({ ...p, [itemKey]: '', [dateKey]: '', [termKey]: '', [extraKey]: false }))
                                reload()
                                success(`${stu.name} 지급 기록 추가됨`)
                              }

                              const canAdd = itemVal.trim() && dateVal

                              // quarter 기준 그룹핑
                              const grouped = {}
                              records.forEach(r => {
                                const k = r.quarter || '미분류'
                                if (!grouped[k]) grouped[k] = []
                                grouped[k].push(r)
                              })
                              const groupEntries = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b))
                              // 각 그룹 내 날짜순 정렬
                              groupEntries.forEach(([, recs]) => recs.sort((a,b) => (a.givenAt||'').localeCompare(b.givenAt||'')))

                              return (
                                <div key={`${stu.id}_${cls.id}`} style={{ background:'#fff', borderRadius:'8px', border:`1px solid ${C.border}`, padding:'6px 12px' }}>
                                  <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom: records.length > 0 ? '6px' : 0 }}>
                                    <span style={{ fontSize:'12px', color:C.muted, whiteSpace:'nowrap' }}>{stuLabel}</span>
                                    <span style={{ fontSize:'13px', fontWeight:700, color:C.text, whiteSpace:'nowrap' }}>{stu.name}</span>
                                    {(() => {
                                      const _prog = progressList.find(p => p.studentId === stu.id && p.classId === cls.id)
                                      if (!_prog) return null
                                      return (
                                        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                                          {_prog.transferSchool && (
                                            <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'10px',
                                              background: _prog.transferSchool === '신규학교' ? '#dbeafe' : '#dcfce7',
                                              color: _prog.transferSchool === '신규학교' ? '#1d4ed8' : '#15803d',
                                              border: `1px solid ${_prog.transferSchool === '신규학교' ? '#93c5fd' : '#86efac'}` }}>
                                              🏫 {_prog.transferSchool}
                                            </span>
                                          )}
                                          {_prog.transferStudent && (
                                            <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'10px',
                                              background: _prog.transferStudent === '신규학생' ? '#dbeafe' : _prog.transferStudent === '신규전학' ? '#e0f2fe' : '#f3e8ff',
                                              color: _prog.transferStudent === '신규학생' ? '#1d4ed8' : _prog.transferStudent === '신규전학' ? '#0369a1' : '#7e22ce',
                                              border: `1px solid ${_prog.transferStudent === '신규학생' ? '#93c5fd' : _prog.transferStudent === '신규전학' ? '#7dd3fc' : '#d8b4fe'}` }}>
                                              👤 {_prog.transferStudent}
                                            </span>
                                          )}
                                          {_prog.transferSupply && (
                                            <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'10px',
                                              background: _prog.transferSupply === '기존교구' ? '#fef3c7' : '#dcfce7',
                                              color: _prog.transferSupply === '기존교구' ? '#92400e' : '#15803d',
                                              border: `1px solid ${_prog.transferSupply === '기존교구' ? '#fcd34d' : '#86efac'}` }}>
                                              📦 {_prog.transferSupply}
                                            </span>
                                          )}
                                          {_prog.transferSchool === '신규학교' && _prog.transferStudent === '기존학생' && _prog.transferSupply === '기존교구' && (
                                            <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'10px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}>
                                              ⚠️ 이전 선생님 교구
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    <div style={{ flex:1 }} />
                                    <input value={itemVal} onChange={e => setGivenInputs(p => ({ ...p, [itemKey]: e.target.value }))}
                                      placeholder="교구명"
                                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                      style={{ width:'100px', padding:'4px 7px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                                    <select value={termVal} onChange={e => setGivenInputs(p => ({ ...p, [termKey]: e.target.value }))}
                                      style={{ padding:'4px 5px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }}>
                                      <option value="">{termUnit} 선택</option>
                                      {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <input type="date" value={dateVal} onChange={e => setGivenInputs(p => ({ ...p, [dateKey]: e.target.value }))}
                                      style={{ padding:'4px 5px', borderRadius:'6px', border:'1px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', cursor:'pointer' }} />
                                    <button onClick={handleAdd} disabled={!canAdd}
                                      style={{ padding:'4px 10px', borderRadius:'6px', border:'none', background: canAdd ? C.success : '#e5e7eb', color: canAdd ? '#fff' : '#9ca3af', fontSize:'12px', fontWeight:700, cursor: canAdd ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                                      + 추가
                                    </button>
                                  </div>
                                  {groupEntries.map(([qKey, qRecords]) => {
                                    const isUnclassified = qKey === '미분류'
                                    const hdrBg     = isUnclassified ? '#f3f4f6' : '#dcfce7'
                                    const hdrBorder = isUnclassified ? '#d1d5db' : '#86efac'
                                    const hdrColor  = isUnclassified ? '#6b7280' : '#15803d'
                                    const bodyBg    = isUnclassified ? '#fafafa'  : '#f0fdf4'
                                    return (
                                    <div key={qKey} style={{ border:`1.5px solid ${hdrBorder}`, borderRadius:'10px', overflow:'hidden', marginBottom:'4px' }}>
                                      <div style={{ background:hdrBg, padding:'4px 12px' }}>
                                        <select
                                          defaultValue={isUnclassified ? '' : qKey}
                                          onChange={async e => {
                                            const newQ = e.target.value || null
                                            for (const r of qRecords) {
                                              await SupplyGiven.update(r.id, { quarter: newQ })
                                            }
                                            reload()
                                          }}
                                          style={{ fontSize:'12px', fontWeight:700, color:hdrColor, background:'transparent', border:'none', outline:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', padding:'2px 0', fontStyle: isUnclassified ? 'italic' : 'normal' }}>
                                          <option value="">미분류</option>
                                          {termOpts.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      </div>
                                      <div style={{ display:'flex', flexDirection:'column', gap:'4px', padding:'6px 8px', background:bodyBg }}>
                                        {qRecords.map(r => (
                                          <GivenRecord key={r.id + '_' + (r.supplyStatus||r.status||'') + '_' + (r.status||'') + '_' + (r.paidAt||'') + '_' + (r.givenAt||'')} record={r} termType={cls.termType}
                                            onDelete={async () => { await SupplyGiven.delete(r.id); reload() }}
                                            onUpdate={async (itemName, givenAt, quarter, supplyStatus, billingStatus, paidAt) => {
                                              const paymentStatus = billingStatus === 'unpaid' ? 'unpaid' : 'paid'
                                              await SupplyGiven.update(r.id, { itemName, givenAt, quarter, supplyStatus, status: billingStatus, paymentStatus, paidAt })
                                              reload()
                                            }} />
                                        ))}
                                      </div>
                                    </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* ── 교구 설정 모달 */}
      <Modal open={supplyModal} onClose={() => setSupplyModal(false)} title={`🎒 교구 설정 (${checkedStudents.length}명)`} width={420}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* ① 교구 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구 선택 *</label>
                <select
                  value={supplyForm.productId}
                  onChange={e => {
                    const pid = e.target.value
                    const p = productList.find(x => x.id === pid)
                    setSupplyForm(v => ({ ...v, productId: pid, name: p ? p.name : '' }))
                  }}
                  style={{ ...iStyle, background:'#fff' }}
                >
                  <option value=''>-- 교구를 선택하세요 --</option>
                  {robotProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {/* 교구 없으면 등록 링크 */}
                {robotProducts.length === 0 && (
                  <div style={{ marginTop:'6px', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'12px', color:C.warning }}>⚠️ 등록된 교구가 없습니다.</span>
                    <button
                      onClick={() => { setSupplyModal(false); setInnerTab('vendor') }}
                      style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                      🏢 교구업체·교구 등록하러 가기 →
                    </button>
                  </div>
                )}
                {/* 교구 있는데 직접 입력하고 싶을 때 */}
                {robotProducts.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <input
                      value={supplyForm.productId ? '' : supplyForm.name}
                      onChange={e => setSupplyForm(v => ({ ...v, name: e.target.value, productId: '' }))}
                      placeholder="또는 교구명 직접 입력"
                      style={{ ...iStyle, fontSize:'12px', padding:'6px 10px', color: supplyForm.productId ? C.muted : C.text }}
                      disabled={!!supplyForm.productId}
                    />
                  </div>
                )}
              </div>

              {/* ② 리모컨 번호 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>리모컨 번호 <span style={{ fontWeight:400, color:'#9ca3af' }}>(선택)</span></label>
                <input
                  value={supplyForm.remoteNo}
                  onChange={e => setSupplyForm(v => ({ ...v, remoteNo: e.target.value }))}
                  placeholder="예: A-12, 5번, RC03..."
                  style={{ ...iStyle }}
                />
              </div>

              {/* ③ 단계 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계</label>
                <select
                  value={supplyForm.stage}
                  onChange={e => setSupplyForm(v => ({ ...v, stage: Number(e.target.value) }))}
                  style={{ ...iStyle, background:'#fff' }}
                >
                  <option value=''>단계 없음</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}단계</option>)}
                </select>
              </div>

              {/* ③ 선택된 교구+단계의 차시 제목 미리보기 */}
              {supplyForm.productId && supplyForm.stage && (() => {
                const plans = productPlanList
                  .filter(p => p.productId === supplyForm.productId && p.stage === supplyForm.stage)
                  .sort((a,b) => a.sessionNo - b.sessionNo)
                const product = productList.find(p => p.id === supplyForm.productId)
                const sessionsPerStage = product?.sessionsPerStage || 12

                if (plans.length === 0) {
                  return (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'12px', color:C.warning }}>⚠️ {supplyForm.stage}단계 차시 제목이 등록되지 않았습니다.</span>
                      <button
                        onClick={() => { setSupplyModal(false); setInnerTab('vendor'); openSessionPlan(supplyForm.productId, supplyForm.stage) }}
                        style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, whiteSpace:'nowrap' }}>
                        📝 차시 제목 등록하러 가기 →
                      </button>
                    </div>
                  )
                }
                return (
                  <div style={{ border:`1px solid ${C.border}`, borderRadius:'8px', overflow:'hidden' }}>
                    <div style={{ padding:'8px 12px', background:'#f0fdf4', borderBottom:`1px solid #86efac`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'12px', fontWeight:600, color:C.success }}>✅ {supplyForm.stage}단계 차시 제목 {plans.length}/{sessionsPerStage}개 등록됨</span>
                      <button
                        onClick={() => { setSupplyModal(false); setInnerTab('vendor'); openSessionPlan(supplyForm.productId, supplyForm.stage) }}
                        style={{ fontSize:'11px', color:C.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline' }}>
                        수정하러 가기
                      </button>
                    </div>
                    <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:'3px', maxHeight:'120px', overflowY:'auto' }}>
                      {plans.map(p => (
                        <div key={p.id} style={{ display:'flex', gap:'8px', fontSize:'12px' }}>
                          <span style={{ color:C.primary, fontWeight:600, minWidth:'40px' }}>{p.sessionNo}차시</span>
                          <span style={{ color:C.text }}>{p.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* 안내 */}
              <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                선택된 <strong>{checkedStudents.length}명</strong>에게 동일하게 적용됩니다.
              </div>

            </div>

            {/* footer 고정 버튼 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button onClick={saveSupply}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                저장
              </button>
              <button onClick={() => setSupplyModal(false)}
                style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                취소
              </button>
        </div>
      </Modal>

      {/* ── 진도 체크 모달 */}
      {progressModal && progressStudent && (
        <SuppliesProgCheckModal
          student={{ ...progressStudent, _clsId: selClassId }}
          initialProductId={progressProductId}
          productList={productList}
          productPlanList={productPlanList}
          givenList={givenList}
          teacherId={user.id}
          selClassId={selClassId}
          classes={classes}
          onClose={() => setProgressModal(false)}
          onSaved={() => { reload(); }}
        />
      )}

      {/* ── 교구 등록/수정 모달 */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title={productForm.id ? '🤖 교구 수정' : '🤖 교구 등록'} width={560}>

            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' }}>

              {/* 업체 선택 */}
              {(
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>업체 선택</label>
                  {subjectVendors.length === 0 ? (
                    <div style={{ fontSize:'12px', color:C.warning, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                      <span>⚠️ 등록된 업체가 없습니다.</span>
                      <button onClick={() => { setProductModal(false); setVendorModal(true) }}
                        style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                        + 업체 먼저 등록하기
                      </button>
                    </div>
                  ) : (
                    <select value={productVendorId||''} onChange={e => setProductVendorId(e.target.value||null)}
                      style={{ ...iStyle, background:'#fff' }}>
                      <option value=''>-- 업체 선택 (선택 안 해도 됨) --</option>
                      {subjectVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* 교구 과목 분류 */}
              {(() => {
                const vendor = vendorList.find(v => v.id === productVendorId)
                const vendorSubjects = vendor
                  ? (vendor.subjects?.length > 0 ? vendor.subjects : [vendor.subject].filter(Boolean))
                  : subjects
                // 신규: 복수과목 업체일 때만 / 수정: 항상 표시
                const isEdit = !!productForm.id
                const showSelector = isEdit || vendorSubjects.length > 1
                const selectorOptions = isEdit && vendorSubjects.length === 0 ? subjects : vendorSubjects
                return showSelector && selectorOptions.length > 0 ? (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>
                      교구 과목 분류 * <span style={{ fontWeight:400 }}>(이 교구가 속한 과목)</span>
                    </label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                      {selectorOptions.map(s => {
                        const selected = productForm.subject === s
                        return (
                          <button key={s} onClick={() => setProductForm(v=>({...v, subject:s}))}
                            style={{ padding:'7px 16px', borderRadius:'20px', border:`1.5px solid ${selected ? C.primary : C.border}`, background: selected ? '#fff7ed' : '#fff', color: selected ? C.primary : C.muted, fontSize:'13px', fontWeight: selected ? 700 : 400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                            {selected ? '✓ ' : ''}{s}
                          </button>
                        )
                      })}
                    </div>
                    {!productForm.subject && <div style={{ fontSize:'11px', color:C.danger, marginTop:'4px' }}>과목을 선택하세요</div>}
                  </div>
                ) : null
              })()}

              {/* 교구명 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교구명 *</label>
                <input value={productForm.name} onChange={e=>setProductForm(v=>({...v, name:e.target.value}))}
                  placeholder="예: 큐보 1단계, 로봇 키트 A형" style={iStyle} autoFocus />
              </div>

              {/* 교구 가격 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'8px' }}>교구 가격 (원)</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  {[
                    { key:'consumerPrice', label:'소비자가' },
                    { key:'schoolPrice',   label:'학교공급가 (기준)' },
                    { key:'branchPrice',   label:'지사가' },
                    { key:'teacherPrice',  label:'선생님가' },
                    { key:'purchasePrice', label:'매입가' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label style={{ fontSize:'11px', color:'#9ca3af', display:'block', marginBottom:'3px' }}>{label}</label>
                      <input type="number" min={0} value={productForm[key]||0}
                        onChange={e => setProductForm(v => ({ ...v, [key]: Number(e.target.value) }))}
                        placeholder="0" style={{ ...iStyle, textAlign:'right', width:'100%' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 기본 설정: 최대단계 / 단계당 차시수 / 준비알림 차시 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>최대 단계</label>
                  <input type="number" min={1} max={20} value={productForm.maxStage}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setProductForm(v => ({...v, maxStage: val}))
                      setStageSessionTitles(prev => {
                        const next = {...prev}
                        for (let s = 1; s <= val; s++) {
                          if (!next[s]) next[s] = Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))
                        }
                        return next
                      })
                      if (productStageTab > val) setProductStageTab(val)
                    }}
                    style={{ ...iStyle, textAlign:'center' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계당 차시 수</label>
                  <input type="number" min={1} max={50} value={productForm.sessionsPerStage}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setProductForm(v => ({...v, sessionsPerStage: val}))
                      setStageSessionTitles(prev => {
                        const newTitles = {}
                        for (let s = 1; s <= productForm.maxStage; s++) {
                          const cur = prev[s] || []
                          newTitles[s] = Array.from({length: val}, (_, i) => cur[i] || { title:'', memo:'' })
                        }
                        return newTitles
                      })
                    }}
                    style={{ ...iStyle, textAlign:'center' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>준비 알림 (차시 전)</label>
                  <input type="number" min={1} max={50} value={productForm.alertSession}
                    onChange={e => setProductForm(v=>({...v, alertSession: Number(e.target.value)}))}
                    style={{ ...iStyle, textAlign:'center' }} />
                </div>
              </div>

              {/* 단계 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>단계 선택</label>
                <select value={productStageTab}
                  onChange={e => {
                    const st = Number(e.target.value)
                    setProductStageTab(st)
                    setStageSessionTitles(prev => ({
                      ...prev,
                      [st]: prev[st] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))
                    }))
                  }}
                  style={{ ...iStyle, background:'#fff' }}>
                  {Array.from({length: productForm.maxStage}, (_, i) => i+1).map(s => {
                    const filled = (stageSessionTitles[s] || []).filter(t => (typeof t === 'string' ? t : t?.title || '').trim()).length
                    return <option key={s} value={s}>{s}단계 {filled > 0 ? `(${filled}개 입력됨)` : ''}</option>
                  })}
                </select>
              </div>

              {/* 차시 제목 + 준비물 입력 */}
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                {/* 헤더 */}
                <div style={{ padding:'10px 14px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                    📝 {productStageTab}단계 차시별 제목
                  </span>
                  <span style={{ fontSize:'11px', color:C.muted }}>
                    {(stageSessionTitles[productStageTab]||[]).filter(i => (typeof i === 'string' ? i : i?.title || '').trim()).length} / {(stageSessionTitles[productStageTab]||[]).length}개 입력
                  </span>
                </div>

                {/* 컬럼 헤더 */}
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>차시</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>제목</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>준비물</span>
                  <span></span>
                </div>

                {/* 차시 목록 */}
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'220px', overflowY:'auto' }}>
                  {(stageSessionTitles[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''}))).map((item, idx) => {
                    const t = typeof item === 'string' ? item : (item?.title || '')
                    const m = typeof item === 'string' ? '' : (item?.memo || '')
                    const updateItem = (field, val) => {
                      setStageSessionTitles(prev => {
                        const cur = [...(prev[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''})))]
                        cur[idx] = { ...cur[idx], title: field==='title' ? val : t, memo: field==='memo' ? val : m }
                        return {...prev, [productStageTab]: cur}
                      })
                    }
                    return (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                        <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{idx+1}차시</span>
                        <input value={t} onChange={e => updateItem('title', e.target.value)}
                          placeholder="제목 (선택)"
                          style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                        <input value={m} onChange={e => updateItem('memo', e.target.value)}
                          placeholder="준비물 (선택)"
                          style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                        <button onClick={() => setStageSessionTitles(prev => {
                          const cur = [...(prev[productStageTab]||[])]
                          cur.splice(idx, 1)
                          return {...prev, [productStageTab]: cur}
                        })} style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </div>
                    )
                  })}
                </div>

                {/* 차시 추가 버튼 */}
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button onClick={() => setStageSessionTitles(prev => {
                    const cur = [...(prev[productStageTab] || Array.from({length: productForm.sessionsPerStage}, () => ({title:'', memo:''})))]
                    cur.push({ title:'', memo:'' })
                    return {...prev, [productStageTab]: cur}
                  })} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                    + 차시 추가
                  </button>
                </div>
              </div>

            </div>

            {/* 저장/취소 버튼 — footer 고정 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button onClick={saveProduct}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                저장
              </button>
              <button onClick={() => setProductModal(false)}
                style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                취소
              </button>
            </div>
      </Modal>

      {/* ── 차시 목차리스트 모달 */}
      <Modal open={sessionPlanModal} onClose={() => setSessionPlanModal(false)} title={`📝 ${productList.find(p=>p.id===sessionPlanTarget.productId)?.name} — ${sessionPlanTarget.stage}단계 목차리스트`} width={560}>

            {/* 내용 스크롤 영역 */}
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' }}>

              {/* 차시 인라인 편집 박스 */}
              <div style={{ border:`1px solid ${C.border}`, borderRadius:'10px', overflow:'hidden' }}>
                {/* 헤더 */}
                <div style={{ padding:'10px 14px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                    📝 {sessionPlanTarget.stage}단계 차시별 제목
                  </span>
                  <span style={{ fontSize:'11px', color:C.muted }}>
                    {sessionPlanEdits.filter(e=>e.title.trim()).length} / {sessionPlanEdits.length}개 입력
                  </span>
                </div>
                {/* 컬럼 헤더 */}
                <div style={{ padding:'6px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px' }}>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>차시</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>제목</span>
                  <span style={{ fontSize:'11px', color:C.muted, fontWeight:600 }}>준비물</span>
                  <span></span>
                </div>
                {/* 차시 목록 */}
                <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'5px', maxHeight:'300px', overflowY:'auto' }}>
                  {sessionPlanEdits.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px', fontSize:'13px', color:C.muted }}>
                      아래 버튼으로 차시를 추가하세요
                    </div>
                  )}
                  {sessionPlanEdits.map((item, idx) => (
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'46px 1fr 1fr 28px', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:C.primary }}>{item.sessionNo}차시</span>
                      <input value={item.title}
                        onChange={e => setSessionPlanEdits(prev => prev.map((x,i) => i===idx ? {...x, title:e.target.value} : x))}
                        placeholder="제목 (선택)"
                        style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                      <input value={item.memo}
                        onChange={e => setSessionPlanEdits(prev => prev.map((x,i) => i===idx ? {...x, memo:e.target.value} : x))}
                        placeholder="준비물 (선택)"
                        style={{ ...iStyle, padding:'5px 8px', fontSize:'12px' }} />
                      <button onClick={() => setSessionPlanEdits(prev => prev.filter((_,i) => i!==idx))}
                        style={{ padding:'3px 8px', borderRadius:'5px', border:'1px solid #fca5a5', background:'#fef2f2', color:C.danger, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                    </div>
                  ))}
                </div>
                {/* 차시 추가 버튼 */}
                <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}` }}>
                  <button onClick={() => setSessionPlanEdits(prev => [
                    ...prev,
                    { id:uid(), sessionNo:prev.length+1, title:'', memo:'', _isNew:true }
                  ])} style={{ width:'100%', padding:'7px', borderRadius:'7px', border:`1.5px dashed ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                    + 차시 추가
                  </button>
                </div>
              </div>

            </div>

            {/* footer 고정 버튼 */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
              <button onClick={saveSessionPlan} disabled={uploading}
                style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:uploading?'#e5e7eb':C.primary, color:uploading?C.muted:'#fff', fontSize:'14px', fontWeight:700, cursor:uploading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                {uploading ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setSessionPlanModal(false)}
                style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                취소
              </button>
            </div>
      </Modal>

      {/* ── 파일 등록 모달 */}
      <Modal open={fileModal} onClose={() => { setFileModal(false); setModalFile(null) }} title={`${fileEditId ? '✏️ ' : ''}${fileModalTitle}${fileEditId ? ' 수정' : ''} — ${selSubject}`} width={500}>
              <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'16px', overflowY:'auto' }}>

                {/* 종류 선택 (연간 / 차시별) — plan 탭에서만 */}
                {FILE_TYPE_OPTIONS.length > 1 && (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>종류</label>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {FILE_TYPE_OPTIONS.map(ftOpt => (
                        <button key={ftOpt.v} onClick={()=>setFileForm(f=>({...f, fileType:ftOpt.v, stage:''}))}
                          style={{ padding:'8px 18px', borderRadius:'8px', border:`1.5px solid ${fileForm.fileType===ftOpt.v?C.primary:C.border}`, background: fileForm.fileType===ftOpt.v?'#fff7ed':'#fff', color: fileForm.fileType===ftOpt.v?C.primary:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                          {ftOpt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 교구 시리즈 선택 → 단계 선택 */}
                {['plan','session','promo'].includes(fileModalMode) && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {/* 1단계: 교구 시리즈 선택 (중복 제거) */}
                    <div>
                      <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>교구 시리즈 선택 *</label>
                      {modalProducts.length === 0 ? (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'12px', color:C.warning }}>⚠️ 등록된 교구가 없습니다.</span>
                          <button onClick={() => { setFileModal(false); setInnerTab('vendor') }}
                            style={{ fontSize:'12px', color:C.primary, background:'#fff7ed', border:`1px solid ${C.primary}`, borderRadius:'5px', padding:'2px 9px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                            🏢 교구 등록하러 가기 →
                          </button>
                        </div>
                      ) : (() => {
                        // 시리즈명 중복 제거 (같은 이름은 첫 번째 교구 대표)
                        const seriesMap = new Map()
                        modalProducts.forEach(p => { if (!seriesMap.has(p.name)) seriesMap.set(p.name, p) })
                        const seriesList = [...seriesMap.values()]
                        return (
                          <select value={fileForm.productId}
                            onChange={e => setFileForm(f=>({...f, productId:e.target.value, stage:''}))}
                            style={{ ...iStyle, background:'#fff' }}>
                            <option value=''>-- 교구 시리즈를 선택하세요 --</option>
                            {seriesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )
                      })()}
                    </div>

                    {/* 2단계: 단계 선택 — 차시별지도안일 때만 */}
                    {(fileModalMode === 'session' || (fileModalMode === 'plan' && fileForm.fileType === 'session')) && fileForm.productId && (() => {
                      const selectedSeries = modalProducts.find(p=>p.id===fileForm.productId)
                      // 같은 시리즈명의 모든 교구 ID 수집
                      const sameNameProducts = modalProducts.filter(p=>p.name===selectedSeries?.name)
                      const allStages = [...new Set(
                        sameNameProducts.flatMap(p => productPlanList.filter(pl=>pl.productId===p.id).map(pl=>pl.stage))
                      )].sort((a,b)=>a-b)
                      if (allStages.length === 0) return null
                      return (
                        <div>
                          <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>단계 선택 *</label>
                          <select value={fileForm.stage}
                            onChange={e => {
                              const stage = Number(e.target.value)
                              // 해당 단계를 가진 교구 ID로 productId 자동 변경
                              const matchProduct = sameNameProducts.find(p =>
                                productPlanList.some(pl=>pl.productId===p.id && pl.stage===stage)
                              )
                              setFileForm(f=>({...f, stage, productId: matchProduct?.id || f.productId}))
                            }}
                            style={{ ...iStyle, background:'#fff' }}>
                            <option value=''>-- 단계를 선택하세요 --</option>
                            {allStages.map(s => <option key={s} value={s}>{s}단계</option>)}
                          </select>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* 학교 다중 선택 — 동적 버튼 */}
                {!['vendor'].includes(fileModalMode) && (
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>
                      학교 지정 <span style={{ fontWeight:400, color:C.muted }}>(복수 선택 가능)</span>
                    </label>
                    {schoolList.length === 0 ? (
                      <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'8px 12px', borderRadius:'7px' }}>
                        수업에 등록된 학교가 없습니다
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                        {schoolList.map(s => {
                          const selected = fileForm.schools.includes(s)
                          return (
                            <button key={s} onClick={() => toggleSchool(s)}
                              style={{ padding:'6px 14px', borderRadius:'20px', border:`1.5px solid ${selected ? C.primary : C.border}`, background: selected ? '#fff7ed' : '#fff', color: selected ? C.primary : C.muted, fontSize:'13px', fontWeight: selected ? 700 : 400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                              {selected ? '✓ ' : ''}{s}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {fileForm.schools.length > 0 && (
                      <div style={{ fontSize:'11px', color:C.primary, marginTop:'5px' }}>
                        선택됨: {fileForm.schools.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 파일 첨부 */}
                <div>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>파일 첨부</label>
                  {modalFile ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #86efac' }}>
                      <span style={{ fontSize:'20px' }}>📄</span>
                      <span style={{ fontSize:'13px', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{modalFile.name}</span>
                      <button onClick={()=>setModalFile(null)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'18px' }}>×</button>
                    </div>
                  ) : (
                    <button onClick={()=>fileRef.current?.click()}
                      style={{ width:'100%', padding:'20px', borderRadius:'9px', border:`2px dashed ${C.border}`, background:'#f9fafb', cursor:'pointer', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                      <div style={{ fontSize:'24px', marginBottom:'4px' }}>📎</div>
                      <div style={{ fontSize:'13px' }}>클릭하여 파일 선택</div>
                      <div style={{ fontSize:'11px', marginTop:'2px' }}>.hwp · .hwpx · .pdf · .xlsx · .jpg · .png</div>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept=".hwp,.hwpx,.pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display:'none' }}
                    onChange={e=>e.target.files[0]&&setModalFile(e.target.files[0])} />
                </div>

              </div>

              {/* footer 고정 버튼 */}
              <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px' }}>
                <button onClick={saveFile} disabled={uploading}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background: uploading?'#e5e7eb':C.primary, color: uploading?C.muted:'#fff', fontSize:'14px', fontWeight:700, cursor: uploading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {uploading ? '업로드 중...' : fileForm.schools.length > 1 ? `저장 (${fileForm.schools.length}개 학교)` : '저장'}
                </button>
                <button onClick={()=>{ setFileModal(false); setModalFile(null) }}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
      </Modal>

      {/* ── 교구업체 등록/수정 모달 */}
      <Modal open={vendorModal} onClose={() => { setVendorModal(false); setVendorEditId(null) }} title={vendorEditId ? '🏢 교구업체 수정' : '🏢 교구업체 등록'} width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px', padding:'4px 0' }}>
              {[
                { label:'업체명 *',      key:'name',        placeholder:'예: (주)로봇나라' },
                { label:'담당자 이름',   key:'managerName', placeholder:'예: 홍길동' },
                { label:'담당자 연락처', key:'contact',     placeholder:'예: 010-1234-5678' },
                { label:'메모',          key:'memo',        placeholder:'비고' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>{f.label}</label>
                  <input value={vendorForm[f.key]} onChange={e=>setVendorForm(v=>({...v, [f.key]:e.target.value}))}
                    placeholder={f.placeholder} style={iStyle} />
                </div>
              ))}

              {/* 취급 과목 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>취급 과목</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                  {subjects.map(s => {
                    const selected = vendorForm.subjects.includes(s)
                    return (
                      <button key={s} onClick={() => setVendorForm(v => ({
                        ...v,
                        subjects: selected ? v.subjects.filter(x=>x!==s) : [...v.subjects, s]
                      }))}
                        style={{ padding:'6px 14px', borderRadius:'20px', border:`1.5px solid ${selected ? C.primary : C.border}`, background: selected ? '#fff7ed' : '#fff', color: selected ? C.primary : C.muted, fontSize:'13px', fontWeight: selected ? 700 : 400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                        {selected ? '✓ ' : ''}{s}
                      </button>
                    )
                  })}
                </div>
                {/* 과목 직접 추가 */}
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={vendorNewSubject} onChange={e=>setVendorNewSubject(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && vendorNewSubject.trim()) {
                        const s = vendorNewSubject.trim()
                        if (!subjects.includes(s)) {
                          SupplySubjects.insert({ id: uid(), teacherId: user.id, name:s, sortOrder:subjects.length, createdAt:now() })
                          reload()
                        }
                        setVendorForm(v => ({ ...v, subjects: v.subjects.includes(s) ? v.subjects : [...v.subjects, s] }))
                        setVendorNewSubject('')
                      }
                    }}
                    placeholder="과목 직접 추가 후 Enter"
                    style={{ ...iStyle, flex:1, fontSize:'12px', padding:'7px 10px' }} />
                  <button onClick={() => {
                    const s = vendorNewSubject.trim()
                    if (!s) return
                    if (!subjects.includes(s)) {
                      SupplySubjects.insert({ id: uid(), teacherId: user.id, name:s, sortOrder:subjects.length, createdAt:now() })
                      reload()
                    }
                    setVendorForm(v => ({ ...v, subjects: v.subjects.includes(s) ? v.subjects : [...v.subjects, s] }))
                    setVendorNewSubject('')
                  }}
                    style={{ padding:'7px 14px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 추가
                  </button>
                </div>
                {vendorForm.subjects.length > 0 && (
                  <div style={{ fontSize:'11px', color:C.primary, marginTop:'5px' }}>선택됨: {vendorForm.subjects.join(', ')}</div>
                )}
              </div>

              <div style={{ fontSize:'12px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                💡 업체 등록 후 업체 카드를 펼쳐서 교구·홍보물·지도안을 추가할 수 있습니다.
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveVendor}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>{vendorEditId ? '수정 완료' : '저장'}</button>
                <button onClick={()=>{ setVendorModal(false); setVendorEditId(null) }}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
        </div>
      </Modal>

      {/* ── 과목 추가 모달 */}
      <Modal open={subjectModal} onClose={() => setSubjectModal(false)} title="+ 과목 추가" width={360}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <input value={newSubject} onChange={e=>setNewSubject(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addSubject()}
                placeholder="예: 드론, 코딩, 미술 ..." style={iStyle} autoFocus />
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={addSubject}
                  style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>추가</button>
                <button onClick={()=>setSubjectModal(false)}
                  style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
              </div>
        </div>
      </Modal>

      {/* ── 교구 준비/지급 체크 모달 */}
      {supplyCheckModal && (() => {
        const prog = progressList.find(p =>
          p.studentId === supplyCheckModal.studentId &&
          p.classId   === supplyCheckModal.classId   &&
          p.productId === supplyCheckModal.productId
        )
        const supplyReady     = prog?.supplyReady     || false
        const supplyDelivered = prog?.supplyDelivered || false

        const upsertProg = (patch) => {
          const base = prog || {
            id: uid(), teacherId: user.id,
            studentId: supplyCheckModal.studentId,
            classId:   supplyCheckModal.classId,
            productId: supplyCheckModal.productId,
            createdAt: now(),
          }
          SupplyStudentProgress.upsert({ ...base, ...patch, updatedAt: now() })
          reload()
        }

        const toggleReady = () => upsertProg({ supplyReady: !supplyReady, supplyDelivered })
        const toggleDelivered = () => {
          upsertProg({ supplyReady, supplyDelivered: !supplyDelivered })
          if (!supplyDelivered) setSupplyCheckModal(null)
        }

        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
            onClick={() => setSupplyCheckModal(null)}>
            <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', maxWidth:'320px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div style={{ marginBottom:'6px', fontSize:'10px', fontWeight:700, color:'#ef4444', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'3px 8px', display:'inline-block' }}>
                ⚠️ {supplyCheckModal.alertLabel}
              </div>
              <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'20px' }}>
                {supplyCheckModal.studentName}
              </div>
              {/* 체크박스 목록 */}
              <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'24px' }}>
                {[
                  { key:'ready',     checked: supplyReady,     label:'교구 준비 완료', toggle: toggleReady,     color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
                  { key:'delivered', checked: supplyDelivered, label:'교구 지급 완료', toggle: toggleDelivered,  color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
                ].map(item => (
                  <label key={item.key} onClick={item.toggle}
                    style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', borderRadius:'10px', border:`1.5px solid ${item.checked ? item.border : '#e5e7eb'}`, background: item.checked ? item.bg : '#f9fafb', cursor:'pointer', transition:'all .15s' }}>
                    <div style={{ width:'20px', height:'20px', borderRadius:'5px', border:`2px solid ${item.checked ? item.color : '#d1d5db'}`, background: item.checked ? item.color : '#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}>
                      {item.checked && <span style={{ color:'#fff', fontSize:'13px', fontWeight:700, lineHeight:1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize:'14px', fontWeight: item.checked ? 700 : 500, color: item.checked ? item.color : '#374151' }}>{item.label}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'16px', textAlign:'center' }}>
                지급 완료 체크 시 알림이 자동으로 사라집니다
              </div>
              <button onClick={() => setSupplyCheckModal(null)}
                style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
                닫기
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── 삭제 확인 모달 */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'320px', width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontSize:'14px', fontWeight:600, color:'#111827', marginBottom:'20px', whiteSpace:'pre-line' }}>{deleteConfirm.msg}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <button onClick={()=>setDeleteConfirm(null)}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>취소</button>
              <button onClick={()=>{ deleteConfirm.onOk(); setDeleteConfirm(null) }}
                style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#ef4444', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          </div>
        </div>
      )}



      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 저장 중...</div>
        </div>
      )}

      {priceModal && (
        <PriceModal
          product={priceModal}
          teacherId={user?.id}
          allSchools={(() => {
            const DAY_ORDER = ['월','화','수','목','금','토','일']
            const sdMap = {}
            classes.forEach(c => {
              if (!c.organization) return
              if (!sdMap[c.organization]) sdMap[c.organization] = new Set()
              ;(c.days || []).forEach(d => sdMap[c.organization].add(d))
            })
            return [...new Set(classes.map(c => c.organization).filter(Boolean))]
              .sort((a, b) => {
                const ai = DAY_ORDER.findIndex(d => (sdMap[a]||new Set()).has(d))
                const bi = DAY_ORDER.findIndex(d => (sdMap[b]||new Set()).has(d))
                return (ai===-1?99:ai) !== (bi===-1?99:bi) ? (ai===-1?99:ai)-(bi===-1?99:bi) : a.localeCompare(b,'ko')
              })
              .map(s => {
                const days = DAY_ORDER.filter(d => (sdMap[s]||new Set()).has(d))
                const label = days.length > 0 ? `(${days.join(',')}) ${s}` : s
                return { value: s, label }
              })
          })()}
          onClose={() => setPriceModal(null)}
        />
      )}
    </div>
  )
}
