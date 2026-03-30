import React, { useState } from 'react'
import { Users, Classes, Students, Attendance, Branches } from '../lib/db.js'  // ✅ 버그수정: Branches 추가, 중복 import 정리
import { uid, now } from '../lib/utils.js'                                      // ✅ 버그수정: uid 추가
import { Btn, Card, PageHeader, Tag, Modal, Toggle, StatCard } from '../components/Atoms.jsx'
import { LEVEL_NAMES, FEATURES, LEVEL_PERMISSIONS } from '../constants/permissions.js'

const FEATURE_LABELS = {
  [FEATURES.MANAGE_CLASS]:      '수업 등록/수정/삭제',
  [FEATURES.ADD_STUDENT]:       '학생 개별 등록',
  [FEATURES.EXCEL_UPLOAD]:      '엑셀 일괄 업로드',
  [FEATURES.ATTENDANCE]:        '출석체크',
  [FEATURES.VIEW_REPORT]:       '출석 리포트 조회',
  [FEATURES.PRINT_ATTENDANCE]:  '출석부 출력 (AI 자동삽입)',
  [FEATURES.MANAGE_TEMPLATE]:   '출석부 양식 등록',
  [FEATURES.SHOP_DISCOUNT]:     '쇼핑몰 일반 할인',
  [FEATURES.SHOP_EXTRA]:        '쇼핑몰 추가 할인·혜택',
  [FEATURES.VIEW_ALL_DATA]:     '전체 데이터 조회',
  [FEATURES.APPROVE_TEACHER]:   '선생님 인증 승인/거절',
  [FEATURES.MANAGE_AD]:         '광고 슬롯 관리',
  [FEATURES.MANAGE_LEVEL]:      '등급 관리 / 권한 예외 설정',
}

// ─── 한국 SVG 지도 (시도별 클릭)
const SIDO_PATHS = {
  '서울':  'M 188 140 L 210 140 L 215 155 L 205 165 L 188 160 Z',
  '인천':  'M 155 140 L 188 140 L 188 160 L 170 168 L 152 158 Z',
  '경기':  'M 152 95 L 240 95 L 245 140 L 215 155 L 205 165 L 188 160 L 188 140 L 155 140 L 152 158 L 145 170 L 138 155 L 140 120 Z',
  '강원':  'M 240 80 L 330 80 L 335 170 L 290 175 L 245 140 L 240 95 Z',
  '충북':  'M 215 155 L 245 140 L 290 175 L 285 215 L 250 220 L 225 200 Z',
  '세종':  'M 190 200 L 210 198 L 215 210 L 195 212 Z',
  '충남':  'M 138 155 L 145 170 L 188 160 L 205 165 L 225 200 L 210 198 L 195 212 L 175 218 L 148 210 L 130 190 L 128 168 Z',
  '대전':  'M 210 198 L 225 200 L 228 212 L 215 215 L 210 210 Z',
  '전북':  'M 148 210 L 175 218 L 195 212 L 210 210 L 215 215 L 228 212 L 235 240 L 215 260 L 185 265 L 155 255 L 140 235 Z',
  '전남':  'M 140 235 L 155 255 L 185 265 L 215 260 L 225 290 L 210 320 L 180 335 L 148 325 L 128 300 L 125 268 Z',
  '광주':  'M 168 268 L 185 265 L 190 278 L 175 282 Z',
  '경북':  'M 285 215 L 290 175 L 335 170 L 345 200 L 360 220 L 355 270 L 330 285 L 295 275 L 275 250 L 270 228 Z',
  '대구':  'M 295 248 L 315 245 L 318 260 L 300 262 Z',
  '경남':  'M 225 290 L 235 240 L 275 250 L 295 275 L 330 285 L 340 310 L 320 335 L 285 340 L 255 330 L 232 310 Z',
  '울산':  'M 340 260 L 360 255 L 362 280 L 342 282 Z',
  '부산':  'M 320 335 L 340 325 L 355 338 L 345 355 L 322 352 Z',
  '제주':  'M 162 395 L 220 390 L 228 410 L 210 422 L 168 420 Z',
}

const SIDO_LABEL_POS = {
  '서울': [198, 153], '인천': [168, 152], '경기': [190, 128],
  '강원': [282, 128], '충북': [252, 188], '세종': [200, 207],
  '충남': [160, 188], '대전': [217, 207], '전북': [185, 238],
  '전남': [170, 295], '광주': [177, 276], '경북': [315, 228],
  '대구': [305, 255], '경남': [285, 308], '울산': [348, 268],
  '부산': [335, 342], '제주': [192, 408],
}

function KoreaMapSVG({ regionCounts, onSelect, selectedSido }) {
  const maxCount = Math.max(...Object.values(regionCounts), 1)
  const sidos = Object.keys(SIDO_PATHS)

  return (
    <svg viewBox="0 0 490 450" style={{ width:'100%', maxWidth:'420px', cursor:'pointer' }} xmlns="http://www.w3.org/2000/svg">
      {sidos.map(sido => {
        const count = regionCounts[sido] || 0
        const intensity = count > 0 ? 0.2 + (count / maxCount) * 0.7 : 0
        const isSelected = selectedSido === sido
        const fill = isSelected ? '#f97316'
          : count > 0 ? `rgba(249,115,22,${intensity})`
          : '#e5e7eb'
        const stroke = isSelected ? '#ea580c' : '#fff'
        const [lx, ly] = SIDO_LABEL_POS[sido]

        return (
          <g key={sido} onClick={() => onSelect(sido)} style={{ cursor:'pointer' }}>
            <path d={SIDO_PATHS[sido]} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1}
              style={{ transition:'all .2s' }}
              onMouseEnter={e => { if (!isSelected) e.target.style.fill = 'rgba(249,115,22,0.5)' }}
              onMouseLeave={e => { if (!isSelected) e.target.style.fill = fill }} />
            <text x={lx} y={ly} textAnchor="middle" fontSize="8" fontFamily="Noto Sans KR, sans-serif"
              fill={isSelected || count > 0 ? '#fff' : '#6b7280'} fontWeight={isSelected ? 700 : 400}
              style={{ pointerEvents:'none', userSelect:'none' }}>
              {sido}
            </text>
            {count > 0 && (
              <text x={lx} y={ly + 9} textAnchor="middle" fontSize="7" fontFamily="monospace"
                fill={isSelected ? '#fff' : '#f97316'} style={{ pointerEvents:'none', userSelect:'none' }}>
                {count}명
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── 지도 드릴다운 패널
function MapDrilldown({ allStudents, allClasses, allTeachers, allBranches, STATUS_LABEL, STATUS_COLOR }) {
  const [selectedSido,    setSelectedSido]    = useState(null)
  const [selectedSupport, setSelectedSupport] = useState(null)
  const [selectedSchool,  setSelectedSchool]  = useState(null)
  const [selectedTeacher, setSelectedTeacher] = useState(null)

  const regionMap = (() => {
    try { return JSON.parse(localStorage.getItem('asa_settings_regionMap') || '{}').regions || [] } catch { return [] }
  })()

  // 학교 → 시도/교육지원청 매핑
  const schoolToRegion = {}
  regionMap.forEach(r => {
    r.schools.forEach(s => {
      const name = s.name || s
      schoolToRegion[name] = { sido: r.sido, support: r.support, supportUrl: r.supportUrl || '' }
    })
  })

  // 학생 enriched
  const enriched = allStudents.map(s => {
    const teacher = allTeachers.find(t => t.id === s.teacherId)
    const classes = (s.classIds || []).map(cid => allClasses.find(c => c.id === cid)).filter(Boolean)
    const region = schoolToRegion[s.school] || null
    return { ...s, teacher, classes, region }
  })

  // 시도별 학생 수 (지도 색상용)
  const regionCounts = {}
  enriched.forEach(s => {
    const sido = s.region?.sido || null
    if (sido) regionCounts[sido] = (regionCounts[sido] || 0) + 1
  })

  // 선택된 시도의 교육지원청 목록
  const supportList = selectedSido
    ? [...new Set(regionMap.filter(r => r.sido === selectedSido).map(r => r.support))]
    : []

  // 선택된 교육지원청의 학교 목록
  const schoolList = selectedSupport
    ? [...new Set(enriched.filter(s => s.region?.support === selectedSupport).map(s => s.school).filter(Boolean))]
    : []

  // 선택된 학교의 선생님 목록
  const teacherList = selectedSchool
    ? allTeachers.filter(t => enriched.some(s => s.school === selectedSchool && s.teacherId === t.id))
    : []

  // 최종 학생 목록
  const finalStudents = enriched.filter(s => {
    if (selectedTeacher) return s.teacherId === selectedTeacher && s.school === selectedSchool
    if (selectedSchool)  return s.school === selectedSchool
    if (selectedSupport) return s.region?.support === selectedSupport
    if (selectedSido)    return s.region?.sido === selectedSido
    return false
  })

  const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }

  const Breadcrumb = () => (
    <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', marginBottom:'16px', flexWrap:'wrap' }}>
      <button onClick={() => { setSelectedSido(null); setSelectedSupport(null); setSelectedSchool(null); setSelectedTeacher(null) }}
        style={{ background:'none', border:'none', color:C.primary, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, padding:0 }}>
        🗺️ 전체
      </button>
      {selectedSido && <>
        <span style={{ color:'#d1d5db' }}>›</span>
        <button onClick={() => { setSelectedSupport(null); setSelectedSchool(null); setSelectedTeacher(null) }}
          style={{ background:'none', border:'none', color:selectedSupport?C.muted:C.primary, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, padding:0 }}>
          📍 {selectedSido}
        </button>
      </>}
      {selectedSupport && <>
        <span style={{ color:'#d1d5db' }}>›</span>
        <button onClick={() => { setSelectedSchool(null); setSelectedTeacher(null) }}
          style={{ background:'none', border:'none', color:selectedSchool?C.muted:C.primary, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, padding:0 }}>
          🏛️ {selectedSupport}
        </button>
      </>}
      {selectedSchool && <>
        <span style={{ color:'#d1d5db' }}>›</span>
        <button onClick={() => setSelectedTeacher(null)}
          style={{ background:'none', border:'none', color:selectedTeacher?C.muted:C.primary, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600, padding:0 }}>
          🏫 {selectedSchool}
        </button>
      </>}
      {selectedTeacher && <>
        <span style={{ color:'#d1d5db' }}>›</span>
        <span style={{ color:C.primary, fontWeight:600 }}>
          👩‍🏫 {allTeachers.find(t => t.id === selectedTeacher)?.name}
        </span>
      </>}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* 지도 + 우측 패널 */}
      <div style={{ display:'flex', gap:'24px', alignItems:'flex-start', flexWrap:'wrap' }}>

        {/* SVG 지도 */}
        <div style={{ flex:'0 0 auto', background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'20px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'12px' }}>
            🗺️ 지역별 학생 현황 {selectedSido && <span style={{ color:C.primary }}>— {selectedSido} 선택됨</span>}
          </div>
          <KoreaMapSVG regionCounts={regionCounts} onSelect={sido => { setSelectedSido(sido); setSelectedSupport(null); setSelectedSchool(null); setSelectedTeacher(null) }} selectedSido={selectedSido} />
          {Object.keys(regionCounts).length === 0 && (
            <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', marginTop:'8px' }}>
              ※ 지역/학교 매핑 등록 후 표시됩니다<br/>(서비스설정 → 지역/학교)
            </div>
          )}
        </div>

        {/* 우측 드릴다운 패널 */}
        <div style={{ flex:1, minWidth:'260px', display:'flex', flexDirection:'column', gap:'12px' }}>
          <Breadcrumb />

          {/* 시도 미선택 */}
          {!selectedSido && (
            <div style={{ padding:'32px', background:'#f9fafb', borderRadius:'12px', textAlign:'center', color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>👆</div>
              지도에서 시도를 클릭하면<br/>해당 지역 현황을 볼 수 있습니다.
            </div>
          )}

          {/* 교육지원청 목록 */}
          {selectedSido && !selectedSupport && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>🏛️ {selectedSido} 교육지원청</div>
              {supportList.length === 0 ? (
                <div style={{ padding:'20px', background:'#f9fafb', borderRadius:'10px', color:C.muted, fontSize:'13px', textAlign:'center' }}>
                  등록된 교육지원청이 없습니다.<br/>서비스설정 → 지역/학교에서 등록하세요.
                </div>
              ) : supportList.map(support => {
                const cnt = enriched.filter(s => s.region?.support === support).length
                const regionInfo = regionMap.find(r => r.support === support)
                return (
                  <button key={support} onClick={() => setSelectedSupport(support)}
                    style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${C.border}`, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=C.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor=C.border}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{support}</div>
                      {regionInfo?.supportUrl && <div style={{ fontSize:'11px', color:'#3b82f6', marginTop:'2px' }}>🔗 홈페이지</div>}
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:700, color:C.primary }}>{cnt}명 ›</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 학교 목록 */}
          {selectedSupport && !selectedSchool && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>🏫 소속 학교</div>
              {schoolList.length === 0 ? (
                <div style={{ padding:'20px', background:'#f9fafb', borderRadius:'10px', color:C.muted, fontSize:'13px', textAlign:'center' }}>등록된 학교가 없습니다.</div>
              ) : schoolList.map(school => {
                const cnt = enriched.filter(s => s.school === school).length
                const schoolInfo = regionMap.find(r => r.support === selectedSupport)?.schools?.find(s => (s.name||s) === school)
                return (
                  <button key={school} onClick={() => setSelectedSchool(school)}
                    style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${C.border}`, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=C.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor=C.border}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{school}</div>
                      {schoolInfo?.url && <a href={schoolInfo.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:'11px', color:'#3b82f6' }}>🔗 홈페이지</a>}
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:700, color:C.primary }}>{cnt}명 ›</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 선생님 목록 */}
          {selectedSchool && !selectedTeacher && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>👩‍🏫 담당 선생님</div>
              {teacherList.length === 0 ? (
                <div style={{ padding:'20px', background:'#f9fafb', borderRadius:'10px', color:C.muted, fontSize:'13px', textAlign:'center' }}>담당 선생님이 없습니다.</div>
              ) : teacherList.map(t => {
                const cnt = enriched.filter(s => s.school === selectedSchool && s.teacherId === t.id).length
                return (
                  <button key={t.id} onClick={() => setSelectedTeacher(t.id)}
                    style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${C.border}`, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=C.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor=C.border}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{t.name}</div>
                      <div style={{ fontSize:'12px', color:C.muted }}>{t.email}</div>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:700, color:C.primary }}>{cnt}명 ›</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 학생 목록 테이블 */}
      {selectedSido && finalStudents.length > 0 && (
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, fontSize:'14px', fontWeight:700, color:C.text }}>
            👥 학생 목록 ({finalStudents.length}명)
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:`1px solid ${C.border}` }}>
                {['이름','학교/학년','수강수업','상태','담당선생님','학부모연락처'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finalStudents.map((s, i) => (
                <tr key={s.id} style={{ borderBottom:`1px solid #f3f4f6`, background:i%2===0?'#fff':'#fafafa' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:C.text, fontSize:'13px' }}>{s.name}</td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:C.muted }}>
                    {s.school && <div>{s.school}</div>}
                    <div>{s.grade}{s.classNum?` ${s.classNum}반`:''}</div>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:C.muted }}>
                    {s.classes.map(c => <div key={c.id}>{c.className}{c.section?` ${c.section}반`:''}</div>)}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:'11px', fontWeight:600, padding:'2px 7px', borderRadius:'5px', background:`${STATUS_COLOR[s.status]}18`, color:STATUS_COLOR[s.status] }}>
                      {STATUS_LABEL[s.status]||s.status}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:C.text }}>
                    {s.teacher ? <div><div style={{ fontWeight:600 }}>{s.teacher.name}</div><div style={{ fontSize:'11px', color:C.muted }}>{s.teacher.email}</div></div> : '—'}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:C.muted }}>{s.parentPhone||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── 학생 탭 (지도 / 리스트 뷰 전환)
function StudentTabPanel(props) {
  const [view, setView] = useState('map')
  const C = { primary:'#f97316', border:'#e5e7eb', muted:'#6b7280' }
  return (
    <div>
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
        {[{ key:'map', label:'🗺️ 지도 뷰' }, { key:'list', label:'📋 목록 뷰' }].map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            style={{ padding:'8px 18px', borderRadius:'9px', border:`1.5px solid ${view===v.key?C.primary:C.border}`, background:view===v.key?C.primary:'#fff', color:view===v.key?'#fff':C.muted, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'map'  && <MapDrilldown  {...props} />}
      {view === 'list' && <StudentListPanel {...props} />}
    </div>
  )
}

// ─── 학생 전체 목록 패널 (탭 뷰 전환)
function StudentListPanel({ allStudents, allClasses, allTeachers, allBranches, STATUS_LABEL, STATUS_COLOR }) {
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterBranch,  setFilterBranch]  = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')

  const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }
  const selSt = { padding:'7px 11px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }

  // 선생님 → 지사 매핑
  const teacherBranchMap = {}
  allTeachers.forEach(t => { teacherBranchMap[t.id] = t.branchId || null })

  // 필터링된 선생님 목록 (지사 필터 적용)
  const filteredTeachers = filterBranch
    ? allTeachers.filter(t => t.branchId === filterBranch)
    : allTeachers

  // 학생 enriched 데이터
  const enriched = allStudents.map(s => {
    const teacher = allTeachers.find(t => t.id === s.teacherId)
    const branchId = teacher ? teacherBranchMap[teacher.id] : null
    const branch = branchId ? allBranches.find(b => b.id === branchId) : null
    const classes = (s.classIds || []).map(cid => allClasses.find(c => c.id === cid)).filter(Boolean)
    return { ...s, teacher, branch, classes }
  })

  // 필터 적용
  const filtered = enriched.filter(s => {
    if (filterStatus  && s.status    !== filterStatus)            return false
    if (filterBranch  && s.branch?.id !== filterBranch)           return false
    if (filterTeacher && s.teacherId  !== filterTeacher)          return false
    if (search) {
      const q = search.toLowerCase()
      const hit = s.name?.toLowerCase().includes(q)
        || s.school?.toLowerCase().includes(q)
        || s.parentPhone?.includes(q)
        || s.teacher?.name?.toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* 요약 */}
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
        {[
          { label:'전체 학생', value: allStudents.length, color:'#3b82f6' },
          { label:'확정',      value: allStudents.filter(s=>s.status==='confirmed').length,  color:'#16a34a' },
          { label:'신청/대기', value: allStudents.filter(s=>['applied','waiting','selected'].includes(s.status)).length, color:'#f59e0b' },
          { label:'취소',      value: allStudents.filter(s=>s.status==='cancelled').length,  color:'#ef4444' },
        ].map(card => (
          <div key={card.label} style={{ padding:'12px 20px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${card.color}22`, minWidth:'110px' }}>
            <div style={{ fontSize:'22px', fontWeight:700, color:card.color }}>{card.value}</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 검색/필터 */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 / 학교 / 전화번호 / 선생님 검색"
          style={{ flex:1, minWidth:'200px', padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selSt}>
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setFilterTeacher('') }} style={selSt}>
          <option value="">전체 지사</option>
          <option value="__none__">지사 미배정</option>
          {allBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={selSt}>
          <option value="">전체 선생님</option>
          {filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(search || filterStatus || filterBranch || filterTeacher) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterBranch(''); setFilterTeacher('') }}
            style={{ padding:'7px 12px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'12px', color:C.muted, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            초기화
          </button>
        )}
        <span style={{ fontSize:'13px', color:C.muted }}>{filtered.length}명</span>
      </div>

      {/* 테이블 */}
      <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f9fafb', borderBottom:`1px solid ${C.border}` }}>
              {['이름', '학교/학년', '수강 수업', '상태', '지사', '담당 선생님', '학부모 연락처'].map(h => (
                <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:C.muted, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding:'48px', textAlign:'center', color:C.muted, fontSize:'14px' }}>
                  해당하는 학생이 없습니다.
                </td>
              </tr>
            ) : filtered.map((s, i) => (
              <tr key={s.id} style={{ borderBottom:`1px solid #f3f4f6`, background: i%2===0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding:'11px 14px', fontWeight:600, color:C.text, fontSize:'14px' }}>
                  {s.name}
                  {s.memo && <span style={{ marginLeft:'4px', fontSize:'11px' }}>📌</span>}
                </td>
                <td style={{ padding:'11px 14px', fontSize:'13px', color:C.muted }}>
                  {s.school && <div>{s.school}</div>}
                  <div>{s.grade}{s.classNum ? ` ${s.classNum}반` : ''}{s.number ? ` ${s.number}번` : ''}</div>
                </td>
                <td style={{ padding:'11px 14px', fontSize:'12px', color:C.muted }}>
                  {s.classes.length > 0
                    ? s.classes.map(c => (
                        <div key={c.id} style={{ whiteSpace:'nowrap' }}>
                          {c.className}{c.section ? ` ${c.section}반` : ''}
                        </div>
                      ))
                    : <span style={{ color:'#d1d5db' }}>—</span>
                  }
                </td>
                <td style={{ padding:'11px 14px' }}>
                  <span style={{ fontSize:'12px', fontWeight:600, padding:'2px 8px', borderRadius:'5px',
                    background:`${STATUS_COLOR[s.status]}18`, color:STATUS_COLOR[s.status] }}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </td>
                <td style={{ padding:'11px 14px', fontSize:'13px', color:C.muted }}>
                  {s.branch
                    ? <span style={{ color:'#8b5cf6', fontWeight:600 }}>🏢 {s.branch.name}</span>
                    : <span style={{ color:'#d1d5db' }}>본사 직속</span>}
                </td>
                <td style={{ padding:'11px 14px', fontSize:'13px', color:C.text }}>
                  {s.teacher
                    ? <div>
                        <div style={{ fontWeight:600 }}>{s.teacher.name}</div>
                        <div style={{ fontSize:'11px', color:C.muted }}>{s.teacher.email}</div>
                      </div>
                    : <span style={{ color:'#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding:'11px 14px', fontSize:'13px', color:C.muted }}>
                  {s.parentPhone || <span style={{ color:'#d1d5db' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── 지사 관리 패널
function BranchPanel({ branches, setBranches, teachers }) {
  const [form, setForm] = useState({ name: '', managerId: '', memo: '' })
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }
  const selSt = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', background:'#fff' }
  const inSt  = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }

  const managers = teachers.filter(t => t.level >= 4)

  const save = () => {
    if (!form.name.trim()) { alert('지사명을 입력하세요.'); return }
    if (editId) {
      Branches.update(editId, { name:form.name.trim(), managerId:form.managerId||null, memo:form.memo })
    } else {
      Branches.insert({ id:uid(), name:form.name.trim(), managerId:form.managerId||null, memo:form.memo, active:true, createdAt:now() })
    }
    setBranches(Branches.all())
    setForm({ name:'', managerId:'', memo:'' }); setEditId(null); setShowForm(false)
  }

  const startEdit = (b) => {
    setForm({ name:b.name, managerId:b.managerId||'', memo:b.memo||'' })
    setEditId(b.id); setShowForm(true)
  }

  const del = (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    Branches.delete(id); setBranches(Branches.all())
  }

  const teacherCount = (branchId) => teachers.filter(t => t.branchId === branchId).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ padding:'14px 18px', background:'#eff6ff', borderRadius:'12px', border:'1.5px solid #bfdbfe', fontSize:'13px', color:'#1e40af', lineHeight:1.8 }}>
        <strong>지사 구조:</strong> 본사 → 지사(지역관리자) → 선생님 → 학생/학부모<br />
        선생님은 선생님 목록에서 지사를 <strong>수동으로 배정</strong>합니다.<br />
        지사장은 등급을 <strong>Lv.4 파트너</strong>로 설정한 선생님 중에서 지정합니다.
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', managerId:'', memo:'' }) }}
          style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 지사 추가
        </button>
      </div>

      {showForm && (
        <div style={{ padding:'18px', background:'#fff', borderRadius:'12px', border:`1.5px solid ${C.primary}`, display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{editId ? '지사 수정' : '지사 추가'}</div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>지사명 *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="예: 경기남부지사" style={inSt} />
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>지사장 (Lv.4 이상 선생님)</label>
            <select value={form.managerId} onChange={e => set('managerId', e.target.value)} style={selSt}>
              <option value="">-- 미지정 --</option>
              {managers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
            </select>
            {managers.length === 0 && <div style={{ fontSize:'11px', color:'#f59e0b', marginTop:'4px' }}>⚠️ Lv.4 이상 선생님이 없습니다.</div>}
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모</label>
            <input value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="내부 메모" style={inSt} />
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            <button onClick={save}
              style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:C.muted, background:'#f9fafb', borderRadius:'12px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏢</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>등록된 지사가 없습니다</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>+ 지사 추가 버튼으로 생성하세요</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {branches.map(b => {
            const manager = teachers.find(t => t.id === b.managerId)
            const cnt = teacherCount(b.id)
            return (
              <div key={b.id} style={{ padding:'16px 20px', background:'#fff', borderRadius:'12px', border:`1.5px solid ${C.border}`, display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:'200px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'16px', fontWeight:700, color:C.text }}>🏢 {b.name}</span>
                    <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', padding:'2px 8px', borderRadius:'5px', fontWeight:600 }}>선생님 {cnt}명</span>
                  </div>
                  {manager && <div style={{ fontSize:'12px', color:'#f97316', fontWeight:600 }}>지사장: {manager.name}</div>}
                  {!manager && <div style={{ fontSize:'12px', color:'#d1d5db' }}>지사장 미지정</div>}
                  {b.memo && <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>{b.memo}</div>}
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => startEdit(b)}
                    style={{ padding:'5px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>수정</button>
                  <button onClick={() => del(b.id)}
                    style={{ padding:'5px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


export function Admin({ user: currentUser }) {
  const [tab, setTab] = useState('pending')
  const [branches, setBranches] = useState(() => Branches.all())
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPermModal, setShowPermModal] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [, forceUpdate] = useState(0)  // ✅ 강제 리렌더용

  const refresh = () => forceUpdate(n => n + 1)  // ✅ DB 변경 후 화면 즉시 갱신

  const teachers = Users.teachers()
  const pending = Users.pending()

  const approve = (id) => {
    Users.update(id, { level: 2, verified: true })
    refresh()  // ✅ 즉시 반영
  }
  const reject  = (id) => {
    Users.update(id, { verifyImg: null })
    refresh()  // ✅ 즉시 반영
  }

  const openPerm = (u) => { setSelectedUser({ ...u }); setShowPermModal(true) }

  const setOverride = (feature, value) => {
    setSelectedUser(prev => ({
      ...prev,
      permissionOverrides: { ...prev.permissionOverrides, [feature]: value },
    }))
  }

  const clearOverride = (feature) => {
    setSelectedUser(prev => {
      const overrides = { ...prev.permissionOverrides }
      delete overrides[feature]
      return { ...prev, permissionOverrides: overrides }
    })
  }

  const savePerms = () => {
    Users.update(selectedUser.id, {
      level: selectedUser.level,
      permissionOverrides: selectedUser.permissionOverrides,
    })
    setShowPermModal(false)
    refresh()  // ✅ 즉시 반영
  }

  const stats = {
    totalTeachers:   teachers.length,
    verified:        teachers.filter(t => t.level >= 2).length,
    pending:         pending.length,
    totalClasses:    Classes.all().length,
    totalStudents:   Students.all().filter(s => s.status === 'confirmed').length,
    todayAttendance: Attendance.all().filter(a => a.date === new Date().toISOString().slice(0, 10)).length,
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1100px' }}>
      <PageHeader title="관리자" sub="서비스 전체를 관리합니다." />

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {[
          { key: 'pending',  label: `인증 대기 ${pending.length}` },
          { key: 'teachers', label: '선생님 목록' },
          { key: 'students', label: '학생 목록' },
          { key: 'branches', label: '지사 관리' },
          { key: 'stats',    label: '전체 통계' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 18px', border: 'none', cursor: 'pointer', background: 'none',
            color: tab === t.key ? '#f97316' : '#9ca3af',
            fontWeight: tab === t.key ? 700 : 400, fontSize: '14px',
            borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent',
            fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '-1px',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 인증 대기 */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '15px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
              인증 대기 중인 선생님이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {pending.map(t => (
                <Card key={t.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{t.name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '3px' }}>{t.email} · {t.phone}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>가입일: {t.createdAt?.slice(0, 10)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {t.verifyImg && (
                        <Btn size="sm" variant="ghost" onClick={() => setLightboxImg(t.verifyImg)}>🖼 수업안내장 확인</Btn>
                      )}
                      <Btn size="sm" variant="success" onClick={() => approve(t.id)}>✅ 승인</Btn>
                      <Btn size="sm" variant="outlineDanger" onClick={() => reject(t.id)}>❌ 거절</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 선생님 목록 */}
      {tab === 'teachers' && (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['이름', '이메일', '연락처', '등급', '가입일', '관리'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const levelColors = { 1: '#9ca3af', 2: '#f97316', 3: '#16a34a', 4: '#8b5cf6', 5: '#ef4444' }
                const deleteTeacher = () => {
                  if (!window.confirm(`${t.name} 선생님을 삭제하시겠습니까?\n관련 수업·학생·출석 데이터는 유지됩니다.`)) return
                  Users.delete(t.id)
                  refresh()
                }
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', fontSize: '14px' }}>{t.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{t.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{t.phone}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Tag color={levelColors[t.level]} bg={`${levelColors[t.level]}18`}>{LEVEL_NAMES[t.level] || 'Lv.' + t.level}</Tag>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af' }}>{t.createdAt?.slice(0, 10)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Btn size="sm" variant="ghost" onClick={() => openPerm(t)}>권한 설정</Btn>
                        <button onClick={deleteTeacher}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 학생 목록 */}
      {tab === 'students' && (() => {
        const allStudents  = Students.all()
        const allClasses   = Classes.all()
        const allBranches  = Branches.all()
        const STATUS_LABEL = { applied:'신청', waiting:'대기', selected:'추첨완료', confirmed:'확정', cancelled:'취소' }
        const STATUS_COLOR = { applied:'#6b7280', waiting:'#f59e0b', selected:'#3b82f6', confirmed:'#16a34a', cancelled:'#ef4444' }
        return (
          <StudentTabPanel
            allStudents={allStudents} allClasses={allClasses}
            allTeachers={teachers} allBranches={allBranches}
            STATUS_LABEL={STATUS_LABEL} STATUS_COLOR={STATUS_COLOR}
          />
        )
      })()}

      {/* 지사 관리 */}
      {tab === 'branches' && (
        <BranchPanel branches={branches} setBranches={setBranches} teachers={teachers} />
      )}

      {/* 전체 통계 */}
      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard label="전체 선생님"    value={stats.totalTeachers}   icon="👩‍🏫" color="#3b82f6" />
          <StatCard label="인증 완료"      value={stats.verified}         icon="✅"   color="#16a34a" />
          <StatCard label="인증 대기"      value={stats.pending}          icon="⏳"   color="#f59e0b" />
          <StatCard label="전체 수업"      value={stats.totalClasses}     icon="📚"   color="#f97316" />
          <StatCard label="확정 학생"      value={stats.totalStudents}    icon="👥"   color="#8b5cf6" />
          <StatCard label="오늘 출석 처리" value={stats.todayAttendance}  icon="📋"   color="#ef4444" />
        </div>
      )}

      {/* 이미지 라이트박스 */}
      {lightboxImg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="수업안내장" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
        </div>
      )}

      {/* 권한 설정 모달 */}
      <Modal open={showPermModal} onClose={() => setShowPermModal(false)} title={`권한 설정 — ${selectedUser?.name}`} width={560}>
        {selectedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>등급 변경</span>
              <select value={selectedUser.level} onChange={e => setSelectedUser(p => ({ ...p, level: parseInt(e.target.value) }))}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}>
                {[1, 2, 3, 4].map(l => <option key={l} value={l}>{LEVEL_NAMES[l]}</option>)}
              </select>
            </div>

            <div style={{ fontSize: '13px', color: '#6b7280', background: '#f9fafb', padding: '10px 14px', borderRadius: '8px' }}>
              회색 = 등급 기본값 · 초록 = 개별 허용 · 빨강 = 개별 차단
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflow: 'auto' }}>
              {Object.entries(FEATURE_LABELS).map(([feature, label]) => {
                const base = LEVEL_PERMISSIONS[selectedUser.level]?.[feature] ?? false
                const override = selectedUser.permissionOverrides?.[feature]
                const hasOverride = feature in (selectedUser.permissionOverrides || {})

                let indicatorColor = '#9ca3af'
                if (hasOverride && override === true)  indicatorColor = '#16a34a'
                if (hasOverride && override === false) indicatorColor = '#ef4444'

                return (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: '#f9fafb', border: `1px solid ${hasOverride ? indicatorColor + '40' : '#e5e7eb'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: indicatorColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>기본: {base ? '허용' : '차단'}{hasOverride ? ` → 예외: ${override ? '허용' : '차단'}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setOverride(feature, true)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1.5px solid #16a34a', background: hasOverride && override ? '#16a34a' : '#fff', color: hasOverride && override ? '#fff' : '#16a34a', fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>허용</button>
                      <button onClick={() => setOverride(feature, false)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1.5px solid #ef4444', background: hasOverride && !override ? '#ef4444' : '#fff', color: hasOverride && !override ? '#fff' : '#ef4444', fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>차단</button>
                      {hasOverride && (
                        <button onClick={() => clearOverride(feature)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>초기화</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
              <Btn variant="ghost" onClick={() => setShowPermModal(false)}>취소</Btn>
              <Btn onClick={savePerms}>저장</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
