import React, { useState } from 'react'
import { Users, Classes, Students, Attendance, Branches, Settings } from '../lib/db.js'  // ✅ 버그수정: Branches 추가, 중복 import 정리
import { uid, now } from '../lib/utils.js'                                      // ✅ 버그수정: uid 추가
import { Btn, Card, PageHeader, Tag, Modal, Toggle, StatCard, useConfirm } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { FUNCTIONS_BASE, sendEmail } from '../lib/supabase.js'
import { supabase } from '../lib/supabase.js'
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

// ─── 한국 시도 선택 (버튼 목록)
const SIDO_LIST_TOP  = ['서울','인천']
const SIDO_LIST_REST = ['경기','강원','충북','세종','대전','충남','경북','대구','전북','광주','전남','울산','부산','경남','제주']

function KoreaMapSVG({ regionCounts, onSelect, selectedSido }) {
  const renderBtn = (sido) => {
    const count = regionCounts[sido] || 0
    const isSel = selectedSido === sido
    return (
      <button key={sido} onClick={() => onSelect(sido)}
        style={{
          padding:'6px 14px', borderRadius:'20px', fontSize:'13px', cursor:'pointer',
          fontFamily:'Noto Sans KR, sans-serif', border:'1.5px solid',
          borderColor: isSel ? '#f97316' : count > 0 ? '#fdba74' : '#e5e7eb',
          background: isSel ? '#f97316' : count > 0 ? '#fff7ed' : '#f9fafb',
          color: isSel ? '#fff' : count > 0 ? '#ea580c' : '#6b7280',
          fontWeight: isSel ? 700 : 400, transition:'all .15s',
        }}>
        {sido}{count > 0 && <span style={{ marginLeft:'4px', fontSize:'11px', opacity:.8 }}>{count}명</span>}
      </button>
    )
  }

  return (
    <div>
      <div style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'8px' }}>시도를 클릭하세요</div>
      <div style={{ display:'flex', gap:'6px', marginBottom:'10px', paddingBottom:'10px', borderBottom:'1px solid #f3f4f6' }}>
        {SIDO_LIST_TOP.map(renderBtn)}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
        {SIDO_LIST_REST.map(renderBtn)}
      </div>
    </div>
  )
}


// ─── 학교 상세 (학교정보 / 관리정보 탭)
function SchoolDetail({ selectedSchool, selectedSupport, enriched, allClasses, teacherList, regionMap, neisLoading, neisSchoolStats, neisApiKey, C, STATUS_LABEL, STATUS_COLOR, setSelectedTeacher }) {
  const [schoolTab, setSchoolTab] = useState('info')
  const schoolStudents = enriched.filter(s => s.school === selectedSchool)
  const schoolInfo = regionMap.find(r => r.support === selectedSupport)?.schools?.find(s => (s.name||s) === selectedSchool)

  const teacherGroups = teacherList.map(t => {
    const tStudents = schoolStudents.filter(s => s.teacherId === t.id)
    const classMap = {}
    tStudents.forEach(s => {
      (s.classIds || []).forEach(cid => {
        const cls = allClasses.find(c => c.id === cid)
        if (!cls) return
        if (!classMap[cid]) classMap[cid] = { cls, students:[] }
        classMap[cid].students.push(s)
      })
    })
    return { t, tStudents, classGroups: Object.values(classMap) }
  })

  const tabBtn = (key, label) => (
    <button onClick={() => setSchoolTab(key)}
      style={{ padding:'7px 16px', borderRadius:'8px', border:'none', cursor:'pointer',
        fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:600,
        background: schoolTab===key ? C.primary : '#f3f4f6',
        color: schoolTab===key ? '#fff' : C.muted, transition:'all .15s' }}>
      {label}
    </button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      <div style={{ display:'flex', gap:'6px' }}>
        {tabBtn('info', '🏫 학교정보')}
        {tabBtn('manage', '📋 관리정보')}
      </div>

      {/* ── 학교정보 탭 ── */}
      {schoolTab === 'info' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ padding:'14px 16px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>{selectedSchool}</div>
            {schoolInfo?.url && <a href={schoolInfo.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:'#3b82f6', display:'block', marginBottom:'4px' }}>🔗 홈페이지</a>}
            <div style={{ fontSize:'12px', color:C.muted }}>방과후 등록 학생 {schoolStudents.length}명</div>
          </div>

          {neisLoading && (
            <div style={{ padding:'12px 16px', background:'#f0f9ff', borderRadius:'10px', border:'1px solid #bae6fd', fontSize:'13px', color:'#0369a1', textAlign:'center' }}>
              📊 NEIS에서 학교 정보 불러오는 중...
            </div>
          )}
          {!neisLoading && neisSchoolStats && (
            <div style={{ padding:'14px 16px', background:'#f0fdf4', borderRadius:'10px', border:'1.5px solid #86efac' }}>
              <div style={{ fontSize:'12px', fontWeight:600, color:'#6b7280', marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
                <span>📊 NEIS 학생 현황 ({neisSchoolStats.year}년)</span>
                <span style={{ fontSize:'11px', background:'#eff6ff', color:'#3b82f6', padding:'1px 7px', borderRadius:'5px' }}>{neisSchoolStats.schoolType} · {neisSchoolStats.coedu}</span>
              </div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                {[
                  { label:'전체', value:neisSchoolStats.total, color:'#16a34a', bg:'#f0fdf4' },
                  { label:'남학생', value:neisSchoolStats.male, color:'#3b82f6', bg:'#eff6ff' },
                  { label:'여학생', value:neisSchoolStats.female, color:'#ec4899', bg:'#fdf2f8' },
                ].map(item => (
                  <div key={item.label} style={{ flex:1, padding:'10px', background:item.bg, borderRadius:'8px', textAlign:'center', border:`1px solid ${item.color}22` }}>
                    <div style={{ fontSize:'20px', fontWeight:700, color:item.color }}>{item.value.toLocaleString()}</div>
                    <div style={{ fontSize:'11px', color:'#6b7280', marginTop:'2px' }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {neisSchoolStats.gradeClassCount && Object.keys(neisSchoolStats.gradeClassCount).length > 0 && (
                <div>
                  <div style={{ fontSize:'11px', fontWeight:600, color:'#6b7280', marginBottom:'6px' }}>학년별 현황 ({neisSchoolStats.classYear}년)</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    <div style={{ display:'flex', gap:'4px' }}>
                      {['학년','학급수','전체','남','여'].map((h,i) => (
                        <div key={h} style={{ width:i===0?'52px':undefined, flex:i>0?1:undefined, fontSize:'10px', color:'#9ca3af', textAlign:'center' }}>{h}</div>
                      ))}
                    </div>
                    {Object.entries(neisSchoolStats.gradeClassCount).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([grade, classes]) => {
                      const stu = neisSchoolStats.gradeStudentCount?.[parseInt(grade)]
                      return (
                        <div key={grade} style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                          <div style={{ width:'52px', padding:'5px', background:'#f3f4f6', borderRadius:'6px', fontSize:'12px', fontWeight:700, color:'#374151', textAlign:'center' }}>{grade}학년</div>
                          <div style={{ flex:1, padding:'5px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'12px', textAlign:'center' }}>{classes}반</div>
                          <div style={{ flex:1, padding:'5px', background:'#f0fdf4', borderRadius:'6px', fontSize:'12px', fontWeight:700, color:'#16a34a', textAlign:'center' }}>{stu?.total ?? '—'}</div>
                          <div style={{ flex:1, padding:'5px', background:'#eff6ff', borderRadius:'6px', fontSize:'12px', fontWeight:700, color:'#3b82f6', textAlign:'center' }}>{stu?.male ?? '—'}</div>
                          <div style={{ flex:1, padding:'5px', background:'#fdf2f8', borderRadius:'6px', fontSize:'12px', fontWeight:700, color:'#ec4899', textAlign:'center' }}>{stu?.female ?? '—'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {!neisLoading && !neisSchoolStats && neisApiKey && (
            <div style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:'8px', fontSize:'12px', color:'#9ca3af', textAlign:'center' }}>📊 NEIS 학생 현황을 불러올 수 없습니다.</div>
          )}
          {!neisApiKey && (
            <div style={{ padding:'10px 14px', background:'#fffbeb', borderRadius:'8px', fontSize:'12px', color:'#92400e', textAlign:'center' }}>
              ⚙️ NEIS API 키를 등록하면 학교 정보를 자동으로 불러옵니다.<br/>서비스설정 → 지역/학교
            </div>
          )}
        </div>
      )}

      {/* ── 관리정보 탭 ── */}
      {schoolTab === 'manage' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {/* 요약 카드 */}
          <div style={{ display:'flex', gap:'8px' }}>
            {[
              { label:'담당 선생님', value:`${teacherList.length}명`, color:'#7c3aed', bg:'#f5f3ff' },
              { label:'수업', value:`${[...new Set(schoolStudents.flatMap(s=>s.classIds||[]))].length}개`, color:'#f97316', bg:'#fff7ed' },
              { label:'등록 학생', value:`${schoolStudents.length}명`, color:'#16a34a', bg:'#f0fdf4' },
            ].map(item => (
              <div key={item.label} style={{ flex:1, padding:'10px', background:item.bg, borderRadius:'8px', textAlign:'center' }}>
                <div style={{ fontSize:'18px', fontWeight:700, color:item.color }}>{item.value}</div>
                <div style={{ fontSize:'11px', color:'#6b7280', marginTop:'2px' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* 선생님별 수업 + 학생 */}
          {teacherGroups.length === 0 ? (
            <div style={{ padding:'30px', background:'#f9fafb', borderRadius:'10px', textAlign:'center', color:C.muted, fontSize:'13px' }}>등록된 선생님이 없습니다.</div>
          ) : teacherGroups.map(({ t, tStudents, classGroups }) => (
            <div key={t.id} style={{ border:`1.5px solid ${C.border}`, borderRadius:'12px', overflow:'hidden', background:'#fff' }}>
              {/* 선생님 헤더 */}
              <div style={{ padding:'12px 16px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#7c3aed18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px' }}>👩‍🏫</div>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{t.name}</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>{t.email}</div>
                  </div>
                </div>
                <div style={{ fontSize:'12px', color:C.muted }}>수업 {classGroups.length}개 · 학생 {tStudents.length}명</div>
              </div>
              {/* 수업별 학생 */}
              {classGroups.length === 0 ? (
                <div style={{ padding:'12px 16px', fontSize:'12px', color:C.muted }}>등록된 수업이 없습니다.</div>
              ) : classGroups.map(({ cls, students }) => (
                <div key={cls.id} style={{ borderBottom:`1px solid #f3f4f6` }}>
                  <div style={{ padding:'8px 16px', background:'#fff7ed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#ea580c' }}>📚 {cls.className}{cls.section?` (${cls.section}반)`:''}</span>
                    <span style={{ fontSize:'11px', color:C.muted }}>{students.length}명</span>
                  </div>
                  <div style={{ padding:'6px 16px 8px', display:'flex', flexWrap:'wrap', gap:'6px' }}>
                    {students.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', background:'#f9fafb', borderRadius:'20px', border:'1px solid #e5e7eb' }}>
                        <span style={{ fontSize:'12px', fontWeight:600, color:C.text }}>{s.name}</span>
                        <span style={{ fontSize:'11px', color:C.muted }}>{s.grade}{s.classNum?`·${s.classNum}반`:''}</span>
                        <span style={{ fontSize:'10px', fontWeight:600, padding:'1px 5px', borderRadius:'4px', background:`${STATUS_COLOR[s.status]}18`, color:STATUS_COLOR[s.status] }}>
                          {STATUS_LABEL[s.status]||s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 지도 드릴다운 패널
function MapDrilldown({ allStudents, allClasses, allTeachers, allBranches, STATUS_LABEL, STATUS_COLOR }) {
  const [selectedSido,    setSelectedSido]    = useState(null)
  const [selectedSupport, setSelectedSupport] = useState(null)
  const [selectedSchool,  setSelectedSchool]  = useState(null)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [neisSchoolStats, setNeisSchoolStats] = useState(null)   // NEIS 학생수 데이터
  const [neisLoading,     setNeisLoading]     = useState(false)

  const neisApiKey = (() => {
    try { return Settings.get('regionMap')?.neisApiKey || '' } catch { return '' }
  })()

  // 학교 선택 시 NEIS에서 성별 학생수 조회
  const fetchNeisSchoolStats = async (schoolName) => {
    if (!neisApiKey) return
    setNeisLoading(true); setNeisSchoolStats(null)
    try {
      // 1) 학교 기본정보로 표준학교코드 조회
      const infoRes = await fetch(`https://open.neis.go.kr/hub/schoolInfo?KEY=${neisApiKey}&Type=json&pIndex=1&pSize=5&SCHUL_NM=${encodeURIComponent(schoolName)}`)
      const infoData = await infoRes.json()
      const school = infoData?.schoolInfo?.[1]?.row?.[0]
      if (!school) { setNeisLoading(false); return }

      const { ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE, SCHUL_KND_SC_NM, COEDU_SC_NM } = school

      // 2) 성별 학생수 + 학년별 학급정보 + 학년별학생수 병렬 조회
      const [stuRes, classRes, gradeStudentRes] = await Promise.all([
        fetch(`https://open.neis.go.kr/hub/stuSexEnsnStatus?KEY=${neisApiKey}&Type=json&pIndex=1&pSize=10&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}`),
        fetch(`https://open.neis.go.kr/hub/classInfo?KEY=${neisApiKey}&Type=json&pIndex=1&pSize=50&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}`),
        fetch(`https://open.neis.go.kr/hub/schoolInfo?KEY=${neisApiKey}&Type=json&pIndex=1&pSize=1&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}`),
      ])
      const stuData          = await stuRes.json()
      const classData        = await classRes.json()

      // 성별 학생수
      const stuRows = stuData?.stuSexEnsnStatus?.[1]?.row || []
      const latestYear = stuRows.reduce((max, r) => Math.max(max, parseInt(r.AY||0)), 0)
      const latestRows = stuRows.filter(r => parseInt(r.AY) === latestYear)
      const total  = latestRows.reduce((s, r) => s + parseInt(r.TOTSTUNUM||0), 0)
      const male   = latestRows.reduce((s, r) => s + parseInt(r.MALESTUNUM||0), 0)
      const female = latestRows.reduce((s, r) => s + parseInt(r.FEMALESTUNUM||0), 0)

      // 학년별 학급수 (classInfo)
      const classRows = classData?.classInfo?.[1]?.row || []
      const classYear = classRows.reduce((max, r) => Math.max(max, parseInt(r.AY||0)), 0)
      const gradeClassCount = {}
      classRows
        .filter(r => parseInt(r.AY) === classYear)
        .forEach(r => {
          const grade = parseInt(r.GRADE)
          if (!gradeClassCount[grade]) gradeClassCount[grade] = 0
          gradeClassCount[grade] += 1
        })

      // 학년별 학생수 — stuSexEnsnStatus의 GRADE 필드 활용
      const gradeStudentCount = {}
      latestRows.forEach(r => {
        if (r.GRADE) {
          const grade = parseInt(r.GRADE)
          if (!gradeStudentCount[grade]) gradeStudentCount[grade] = { total:0, male:0, female:0 }
          gradeStudentCount[grade].total  += parseInt(r.TOTSTUNUM||0)
          gradeStudentCount[grade].male   += parseInt(r.MALESTUNUM||0)
          gradeStudentCount[grade].female += parseInt(r.FEMALESTUNUM||0)
        }
      })

      setNeisSchoolStats({
        year: latestYear, total, male, female,
        schoolType: SCHUL_KND_SC_NM, coedu: COEDU_SC_NM,
        gradeClassCount,    // { 1:6, 2:5, ... } 학년별 학급수
        gradeStudentCount,  // { 1:{total,male,female}, ... } 학년별 학생수
        classYear,
      })
    } catch(e) {
      console.warn('NEIS 학생수 조회 실패:', e)
    } finally {
      setNeisLoading(false)
    }
  }

  const regionMap = (() => {
    try { return Settings.get('regionMap')?.regions || [] } catch { return [] }
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

  // 선택된 교육지원청의 학교 목록 — regionMap에 등록된 학교 기준 (학생 없어도 표시)
  const schoolList = selectedSupport
    ? (regionMap.find(r => r.support === selectedSupport)?.schools || []).map(s => s.name || s).filter(Boolean)
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

        {/* 지도 */}
        <div style={{ flex:'0 0 700px', background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'20px' }}>
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
              {(() => {
                const totalSupports = supportList.length
                const totalSchools = regionMap.filter(r => r.sido === selectedSido).reduce((acc, r) => acc + (r.schools?.length || 0), 0)
                const totalStudents = enriched.filter(s => s.region?.sido === selectedSido).length
                const officeName = regionMap.find(r => r.sido === selectedSido)?.office || `${selectedSido}교육청`
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {/* 교육청 요약 */}
                    <div style={{ padding:'12px 16px', background:'#f0f9ff', borderRadius:'10px', border:'1px solid #bae6fd', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#0369a1' }}>🏢 {officeName}</span>
                      <span style={{ fontSize:'12px', color:'#0284c7' }}>교육지원청 {totalSupports}개 · 학교 {totalSchools}개 · 학생 {totalStudents}명</span>
                    </div>

                    {/* 교육지원청 목록 */}
                    <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, padding:'4px 2px' }}>🏛️ 교육지원청 — 클릭하면 학교 목록</div>
                    {supportList.length === 0 ? (
                      <div style={{ padding:'20px', background:'#f9fafb', borderRadius:'10px', color:C.muted, fontSize:'13px', textAlign:'center' }}>
                        등록된 교육지원청이 없습니다.<br/>서비스설정 → 지역/학교에서 등록하세요.
                      </div>
                    ) : supportList.map(support => {
                      const regionInfo = regionMap.find(r => r.support === support)
                      const schoolCnt = regionInfo?.schools?.length || 0
                      const studentCnt = enriched.filter(s => s.region?.support === support).length
                      return (
                        <button key={support} onClick={() => setSelectedSupport(support)}
                          style={{ padding:'12px 16px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${C.border}`, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor=C.primary}
                          onMouseLeave={e => e.currentTarget.style.borderColor=C.border}>
                          <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{support}</span>
                          <span style={{ fontSize:'12px', color:C.muted, flexShrink:0 }}>학교 {schoolCnt}개 · 학생 {studentCnt}명 ›</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* 학교 목록 */}
          {selectedSupport && !selectedSchool && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, padding:'4px 2px' }}>🏫 학교 {schoolList.length}개 — 클릭하면 학생 목록</div>
              {schoolList.length === 0 ? (
                <div style={{ padding:'20px', background:'#f9fafb', borderRadius:'10px', color:C.muted, fontSize:'13px', textAlign:'center' }}>등록된 학교가 없습니다.</div>
              ) : schoolList.map(school => {
                const cnt = enriched.filter(s => s.school === school).length
                return (
                  <button key={school} onClick={() => { setSelectedSchool(school); fetchNeisSchoolStats(school) }}
                    style={{ padding:'12px 16px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${C.border}`, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=C.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor=C.border}>
                    <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{school}</span>
                    <span style={{ fontSize:'12px', fontWeight:700, color: cnt > 0 ? C.primary : C.muted, flexShrink:0 }}>학생 {cnt}명 ›</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 학교 상세 */}
          {selectedSchool && !selectedTeacher && (
            <SchoolDetail
              selectedSchool={selectedSchool}
              selectedSupport={selectedSupport}
              enriched={enriched}
              allClasses={allClasses}
              teacherList={teacherList}
              regionMap={regionMap}
              neisLoading={neisLoading}
              neisSchoolStats={neisSchoolStats}
              neisApiKey={neisApiKey}
              C={C}
              STATUS_LABEL={STATUS_LABEL}
              STATUS_COLOR={STATUS_COLOR}
              setSelectedTeacher={setSelectedTeacher}
            />
          )}
        </div>
      </div>

      {/* 학생 목록 테이블 */}
      {selectedSido && (selectedSchool || selectedSupport || selectedTeacher) && (
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, fontSize:'14px', fontWeight:700, color:C.text }}>
            👥 학생 목록 ({finalStudents.length}명)
          </div>
          {finalStudents.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:C.muted, fontSize:'13px' }}>
              등록된 학생이 없습니다.
            </div>
          ) : (
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
          )}
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
  const { toastError, success } = useToast()
  const confirm = useConfirm()

  const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }
  const selSt = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', background:'#fff' }
  const inSt  = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }

  const managers = teachers.filter(t => t.level >= 4)

  const save = () => {
    if (!form.name.trim()) { toastError('지사명을 입력하세요.'); return }
    if (editId) {
      Branches.update(editId, { name:form.name.trim(), managerId:form.managerId||null, memo:form.memo })
      success('수정이 완료되었습니다.')
    } else {
      Branches.insert({ id:uid(), name:form.name.trim(), managerId:form.managerId||null, memo:form.memo, active:true, createdAt:now() })
      success('등록이 완료되었습니다.')
    }
    setBranches(Branches.all())
    setForm({ name:'', managerId:'', memo:'' }); setEditId(null); setShowForm(false)
  }

  const startEdit = (b) => {
    setForm({ name:b.name, managerId:b.managerId||'', memo:b.memo||'' })
    setEditId(b.id); setShowForm(true)
  }

  const del = (id) => {
    confirm('삭제하시겠습니까?', () => {
      Branches.delete(id); setBranches(Branches.all())
    })
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
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTab, setDetailTab] = useState('period') // 'classes' | 'students' | 'period' | 'level'
  const [showPermModal, setShowPermModal] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [, forceUpdate] = useState(0)  // ✅ 강제 리렌더용
  const { toastError, success } = useToast()
  const confirm = useConfirm()

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

  const openDetail = (u) => { setSelectedUser({ ...u }); setDetailTab('period'); setShowDetailModal(true) }
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

  const saveDetail = () => {
    Users.update(selectedUser.id, {
      level:               selectedUser.level,
      permissionOverrides: selectedUser.permissionOverrides,
      accessStartAt:       selectedUser.accessStartAt   || null,
      accessExpiredAt:     selectedUser.accessExpiredAt || null,
    })
    setShowDetailModal(false)
    refresh()
    success('저장되었습니다.')
  }

  const savePerms = () => {
    Users.update(selectedUser.id, {
      level: selectedUser.level,
      permissionOverrides: selectedUser.permissionOverrides,
      accessStartAt:   selectedUser.accessStartAt   || null,
      accessExpiredAt: selectedUser.accessExpiredAt || null,
    })
    setShowPermModal(false)
    refresh()  // ✅ 즉시 반영
    success('수정이 완료되었습니다.')
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
                {['이름', '이메일', '연락처', '등급', '접속기간', '가입일', '관리'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const levelColors = { 1: '#9ca3af', 2: '#f97316', 3: '#16a34a', 4: '#8b5cf6', 5: '#ef4444' }
                const deleteTeacher = () => {
                  confirm(`${t.name} 선생님을 삭제하시겠습니까?\n관련 수업·학생·출석 데이터는 유지됩니다.`, () => {
                    Users.delete(t.id)
                    refresh()
                  })
                }
                // 접속기간 상태 계산
                const now2 = new Date()
                const expDate = t.accessExpiredAt ? new Date(t.accessExpiredAt) : null
                const daysLeft = expDate ? Math.ceil((expDate - now2) / (1000 * 60 * 60 * 24)) : null
                let periodTag = null
                if (!expDate) {
                  periodTag = <Tag color="#6b7280" bg="#f3f4f6">무제한</Tag>
                } else if (daysLeft < 0) {
                  periodTag = <Tag color="#ef4444" bg="#fef2f2">만료됨</Tag>
                } else if (daysLeft <= 7) {
                  periodTag = <Tag color="#f97316" bg="#fff7ed">D-{daysLeft}</Tag>
                } else {
                  periodTag = <Tag color="#16a34a" bg="#f0fdf4">~{t.accessExpiredAt?.slice(0,10)}</Tag>
                }
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', fontSize: '14px' }}>{t.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{t.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{t.phone}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Tag color={levelColors[t.level]} bg={`${levelColors[t.level]}18`}>{LEVEL_NAMES[t.level] || 'Lv.' + t.level}</Tag>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{periodTag}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af' }}>{t.createdAt?.slice(0, 10)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Btn size="sm" variant="ghost" onClick={() => openDetail(t)}>상세보기</Btn>
                        <button onClick={() => {
                          if (!t.phone) { toastError('등록된 핸드폰 번호가 없어 초기화할 수 없습니다.'); return }
                          if (!t.authId) { toastError('Supabase Auth 계정이 없는 사용자입니다.'); return }
                          const normalized = t.phone.replace(/-/g, '').slice(0, 11)
                          confirm(`${t.name} 선생님의 비밀번호를\n핸드폰 번호(${normalized})로 초기화하시겠습니까?`, async () => {
                            try {
                              const { data: { session } } = await supabase.auth.getSession()
                              const res = await fetch(`${FUNCTIONS_BASE}/reset-user-password`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${session?.access_token}`,
                                },
                                body: JSON.stringify({ authId: t.authId, newPassword: normalized }),
                              })
                              const result = await res.json()
                              if (!result.success) throw new Error(result.error)
                              success(`비밀번호가 ${normalized}(으)로 초기화되었습니다.`)
                            } catch (e) {
                              toastError('비밀번호 초기화 실패: ' + e.message)
                            }
                          })
                        }}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309', fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          비번초기화
                        </button>
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

      {/* ───────────────────────────────────────────
          선생님 상세보기 모달
      ─────────────────────────────────────────── */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title={`👤 ${selectedUser?.name} 선생님 상세`} width={600}>
        {selectedUser && (() => {
          const teacherClasses   = Classes.byTeacher(selectedUser.id)
          const teacherStudents  = Students.byTeacher(selectedUser.id).filter(s => s.status === 'confirmed')
          const levelColors      = { 1: '#9ca3af', 2: '#f97316', 3: '#16a34a', 4: '#8b5cf6', 5: '#ef4444' }

          // 탭 스타일
          const tabStyle = (key) => ({
            padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'none',
            color: detailTab === key ? '#f97316' : '#9ca3af',
            fontWeight: detailTab === key ? 700 : 400, fontSize: '13px',
            borderBottom: detailTab === key ? '2px solid #f97316' : '2px solid transparent',
            fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '-1px',
          })

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {/* 탭 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
                <button style={tabStyle('classes')}  onClick={() => setDetailTab('classes')}>📚 수업 목록 ({teacherClasses.length})</button>
                <button style={tabStyle('students')} onClick={() => setDetailTab('students')}>👥 학생 목록 ({teacherStudents.length})</button>
                <button style={tabStyle('period')}   onClick={() => setDetailTab('period')}>📅 기간 설정</button>
                <button style={tabStyle('level')}    onClick={() => setDetailTab('level')}>⭐ 레벨/권한</button>
              </div>

              {/* ── 수업 목록 ── */}
              {detailTab === 'classes' && (
                <div style={{ minHeight: 200 }}>
                  {teacherClasses.length === 0
                    ? <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>등록된 수업이 없습니다</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 360, overflowY: 'auto' }}>
                        {teacherClasses.map(c => (
                          <div key={c.id} style={{ padding: '12px 14px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>{c.className || '수업명 미설정'}</span>
                              {c.section && <span style={{ fontSize: '12px', color: '#6b7280', background: '#e5e7eb', padding: '1px 7px', borderRadius: '10px' }}>{c.section}반</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              {c.organization && <span>🏫 {c.organization}</span>}
                              {c.days?.length > 0 && <span>📅 {c.days.join(', ')}</span>}
                              {c.time && <span>🕐 {c.time}{c.timeEnd ? ' ~ ' + c.timeEnd : ''}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )}

              {/* ── 학생 목록 ── */}
              {detailTab === 'students' && (
                <div style={{ minHeight: 200 }}>
                  {teacherStudents.length === 0
                    ? <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>등록된 학생이 없습니다</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 360, overflowY: 'auto' }}>
                        {teacherStudents.map(s => {
                          const studentClasses = (s.classIds || [])
                            .map(cid => teacherClasses.find(c => c.id === cid))
                            .filter(Boolean)
                          return (
                            <div key={s.id} style={{ padding: '12px 14px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                {/* 이름 + 학교/학년/반/번호 */}
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>{s.name}</span>
                                    {s.grade && <span style={{ fontSize: '12px', color: '#fff', background: '#f97316', padding: '1px 7px', borderRadius: '10px' }}>{s.grade}학년</span>}
                                    {s.classNum && <span style={{ fontSize: '12px', color: '#6b7280' }}>{s.classNum}반</span>}
                                    {s.number && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.number}번</span>}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {s.school && <span>🏫 {s.school}</span>}
                                    {s.parentPhone && <span>👨‍👩‍👧 {s.parentPhone}</span>}
                                    {s.studentPhone && <span>📱 {s.studentPhone}</span>}
                                  </div>
                                </div>
                                {/* 수강 수업 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                                  {studentClasses.map(c => (
                                    <span key={c.id} style={{ fontSize: '11px', color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                                      {c.className}{c.section ? ` ${c.section}반` : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>
              )}

              {/* ── 기간 설정 ── */}
              {detailTab === 'period' && (() => {
                const now2    = new Date()
                const expDate = selectedUser.accessExpiredAt ? new Date(selectedUser.accessExpiredAt) : null
                const daysLeft = expDate ? Math.ceil((expDate - now2) / (1000 * 60 * 60 * 24)) : null

                const setQuick = (days) => {
                  const start  = new Date().toISOString().slice(0,10)
                  const expire = new Date(Date.now() + days * 86400000).toISOString().slice(0,10)
                  setSelectedUser(p => ({ ...p, accessStartAt: start, accessExpiredAt: expire }))
                }
                const setUnlimited = () => setSelectedUser(p => ({ ...p, accessStartAt: null, accessExpiredAt: null }))

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* 현재 상태 배너 */}
                    <div style={{
                      padding: '12px 16px', borderRadius: '10px',
                      background: !expDate ? '#f0fdf4' : daysLeft < 0 ? '#fef2f2' : daysLeft <= 7 ? '#fff7ed' : '#f0fdf4',
                      border: `1px solid ${!expDate ? '#86efac' : daysLeft < 0 ? '#fca5a5' : daysLeft <= 7 ? '#fed7aa' : '#86efac'}`,
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <span style={{ fontSize: '20px' }}>{!expDate ? '♾️' : daysLeft < 0 ? '🔴' : daysLeft <= 7 ? '⚠️' : '✅'}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                          {!expDate ? '무제한 접속 중'
                            : daysLeft < 0 ? '접속 기간 만료됨'
                            : daysLeft <= 7 ? `접속 기간 ${daysLeft}일 남음`
                            : `접속 기간 ${daysLeft}일 남음`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {selectedUser.accessStartAt ? `${selectedUser.accessStartAt?.slice(0,10)} ~ ` : ''}
                          {selectedUser.accessExpiredAt ? selectedUser.accessExpiredAt?.slice(0,10) : '만료일 없음'}
                        </div>
                      </div>
                    </div>

                    {/* 빠른 설정 버튼 */}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>빠른 설정</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[{label:'7일', days:7},{label:'30일', days:30},{label:'90일', days:90},{label:'180일', days:180},{label:'1년', days:365}].map(({label, days}) => (
                          <button key={label} onClick={() => setQuick(days)}
                            style={{ padding: '7px 16px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 500 }}>
                            {label}
                          </button>
                        ))}
                        <button onClick={setUnlimited}
                          style={{ padding: '7px 16px', borderRadius: '8px', border: '1.5px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 500 }}>
                          무제한
                        </button>
                      </div>
                    </div>

                    {/* 직접 날짜 입력 */}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>직접 설정</div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>시작일</div>
                          <input type="date"
                            value={selectedUser.accessStartAt?.slice(0,10) || ''}
                            onChange={e => setSelectedUser(p => ({ ...p, accessStartAt: e.target.value || null }))}
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>만료일</div>
                          <input type="date"
                            value={selectedUser.accessExpiredAt?.slice(0,10) || ''}
                            onChange={e => setSelectedUser(p => ({ ...p, accessExpiredAt: e.target.value || null }))}
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 이메일 안내 발송 */}
                    {selectedUser.email && (
                      <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>📧 기간 안내 이메일 발송</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{selectedUser.email}</div>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={async () => {
                          try {
                            const expStr = selectedUser.accessExpiredAt?.slice(0,10) || '무제한'
                            await sendEmail(selectedUser.email, `접속 기간 안내: ${expStr}까지`)
                            success('이메일을 발송했습니다.')
                          } catch(e) {
                            toastError('이메일 발송 실패: ' + e.message)
                          }
                        }}>발송</Btn>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── 레벨/권한 ── */}
              {detailTab === 'level' && (
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {Object.entries(FEATURE_LABELS).map(([feature, label]) => {
                      const base        = LEVEL_PERMISSIONS[selectedUser.level]?.[feature] ?? false
                      const override    = selectedUser.permissionOverrides?.[feature]
                      const hasOverride = feature in (selectedUser.permissionOverrides || {})
                      let indColor = '#9ca3af'
                      if (hasOverride && override === true)  indColor = '#16a34a'
                      if (hasOverride && override === false) indColor = '#ef4444'
                      return (
                        <div key={feature} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: '#f9fafb', border: `1px solid ${hasOverride ? indColor + '40' : '#e5e7eb'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: indColor, flexShrink: 0 }} />
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
                </div>
              )}

              {/* 하단 버튼 */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px', marginTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <Btn variant="ghost" onClick={() => setShowDetailModal(false)}>취소</Btn>
                <Btn onClick={saveDetail}>저장</Btn>
              </div>
            </div>
          )
        })()}
      </Modal>

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
