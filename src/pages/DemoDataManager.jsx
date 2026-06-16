/**
 * DemoDataManager.jsx
 * 관리자 전용 — 데모 데이터 생성 페이지
 * 선택한 선생님의 수업/학생/출석 데이터를 복사하되,
 * 이름·학교명·전화번호 등 개인정보를 가명으로 치환합니다.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Users, Classes, Students, Attendance } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { supabase } from '../lib/supabase.js'
import { PageHeader, Btn, Card, Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

// ─── 가명 데이터 풀
const FAKE_LAST  = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권']
const FAKE_FIRST = ['민준','서준','도윤','예준','시우','주원','하준','지호','준서','준우',
                    '서연','서윤','지우','채원','수아','지유','하은','예은','윤서','다은']
const FAKE_SCHOOL_PREFIX = ['행복','미래','희망','평화','사랑','한빛','새봄','푸른','하늘','별빛']
const FAKE_SCHOOL_SUFFIX = ['초등학교','초등학교','초등학교','중학교','중학교']
const FAKE_EMAIL_DOMAINS = ['demo.com','example.com','test.kr','sample.net']

// 시드 기반 난수 (같은 인덱스면 항상 같은 이름)
function seededPick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}
function fakeName(seed) {
  return seededPick(FAKE_LAST, seed) + seededPick(FAKE_FIRST, seed * 7 + 3)
}
function fakeSchool(seed) {
  return seededPick(FAKE_SCHOOL_PREFIX, seed) + seededPick(FAKE_SCHOOL_SUFFIX, seed * 3 + 1)
}
function fakePhone() {
  return '010-0000-0000'
}
function fakeEmail(seed) {
  const user = `demo${Math.abs(seed) % 9000 + 1000}`
  return `${user}@${seededPick(FAKE_EMAIL_DOMAINS, seed)}`
}

// 문자열 → 간단한 정수 해시
function strHash(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}

const C = {
  primary: '#f97316',
  border:  '#e5e7eb',
  text:    '#111827',
  muted:   '#6b7280',
  bg:      '#f9fafb',
}

// ─────────────────────────────────────────────
export function DemoDataManager({ user }) {
  const [teachers,      setTeachers]      = useState([])
  const [targetTeacher, setTargetTeacher] = useState(null)   // 데이터를 복사받을 대상 선생님
  const [sourceTeacher, setSourceTeacher] = useState(null)   // 원본 선생님
  const [preview,       setPreview]       = useState(null)   // 미리보기 데이터
  const [running,       setRunning]       = useState(false)
  const [done,          setDone]          = useState(false)
  const [log,           setLog]           = useState([])
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const { toastError, success } = useToast()

  useEffect(() => {
    const all = Users.all().filter(u => u.role === 'teacher' || u.role === 'admin')
    setTeachers(all.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')))
  }, [])

  // ── 미리보기 계산
  useEffect(() => {
    if (!sourceTeacher) { setPreview(null); return }
    const classes  = Classes.byTeacher(sourceTeacher.id)
    const students = Students.byTeacher(sourceTeacher.id)
    const attendanceCount = classes.reduce((acc, c) => {
      return acc + Attendance.byClass(c.id).length
    }, 0)

    // 학교 목록 수집
    const schools = [...new Set([
      ...classes.map(c => c.organization).filter(Boolean),
      ...students.map(s => s.school).filter(Boolean),
    ])]

    setPreview({ classes, students, attendanceCount, schools })
  }, [sourceTeacher])

  // ── 복사 이력 (localStorage) — 원본id 기준으로 중복 스킵
  const COPY_KEY = (srcId, dstId) => `demoCopied:${srcId}:${dstId}`
  const loadCopied = (srcId, dstId) => {
    try { return new Set(JSON.parse(localStorage.getItem(COPY_KEY(srcId, dstId)) || '[]')) }
    catch { return new Set() }
  }
  const saveCopied = (srcId, dstId, set) => {
    try { localStorage.setItem(COPY_KEY(srcId, dstId), JSON.stringify([...set])) }
    catch {}
  }

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: Date.now() }])
  }

  // ── 대상 선생님 데이터 초기화
  const runReset = useCallback(async () => {
    if (!targetTeacher) return
    setRunning(true)
    setLog([])
    setDone(false)
    setShowResetConfirm(false)

    const dstId = targetTeacher.id
    addLog(`🗑 "${targetTeacher.name}" 선생님 데이터 초기화 시작…`, 'info')

    try {
      // 1) 대상 선생님 수업 id 목록 조회
      addLog('  수업 목록 조회 중…', 'debug')
      const { data: dstClasses, error: e0 } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', dstId)
      if (e0) throw new Error(`수업 조회 실패: ${e0.message}`)
      const dstClassIds = (dstClasses || []).map(c => c.id)
      addLog(`  ✓ 수업 ${dstClassIds.length}개 확인`, 'debug')

      // 2) 출석 삭제 — class_id 기준
      if (dstClassIds.length > 0) {
        addLog('  출석 데이터 삭제 중…', 'debug')
        const { error: e1, count: c1 } = await supabase
          .from('attendance')
          .delete({ count: 'exact' })
          .in('class_id', dstClassIds)
        if (e1) throw new Error(`출석 삭제 실패: ${e1.message}`)
        addLog(`  ✓ 출석 ${c1 ?? '?'}건 삭제`, 'ok')
      } else {
        addLog('  출석 데이터 없음 (스킵)', 'debug')
      }

      // 3) 학생 삭제
      addLog('  학생 데이터 삭제 중…', 'debug')
      const { error: e2, count: c2 } = await supabase
        .from('students')
        .delete({ count: 'exact' })
        .eq('teacher_id', dstId)
      if (e2) throw new Error(`학생 삭제 실패: ${e2.message}`)
      addLog(`  ✓ 학생 ${c2 ?? '?'}명 삭제`, 'ok')

      // 4) 수업 삭제
      addLog('  수업 데이터 삭제 중…', 'debug')
      const { error: e3, count: c3 } = await supabase
        .from('classes')
        .delete({ count: 'exact' })
        .eq('teacher_id', dstId)
      if (e3) throw new Error(`수업 삭제 실패: ${e3.message}`)
      addLog(`  ✓ 수업 ${c3 ?? '?'}개 삭제`, 'ok')

      // 4) 복사 이력도 초기화
      if (sourceTeacher) {
        localStorage.removeItem(COPY_KEY(sourceTeacher.id, dstId))
        addLog('  ✓ 복사 이력 초기화', 'ok')
      }

      addLog('──────────────────────────────', 'divider')
      addLog(`✅ "${targetTeacher.name}" 선생님 데이터가 모두 삭제되었습니다.`, 'success')
    } catch (e) {
      addLog(`❌ 오류: ${e.message}`, 'error')
      toastError(e.message)
    } finally {
      setRunning(false)
    }
  }, [targetTeacher, sourceTeacher, toastError])

  // ── 복사 실행
  const runCopy = useCallback(async () => {
    if (!sourceTeacher || !targetTeacher) return
    if (sourceTeacher.id === targetTeacher.id) {
      toastError('원본과 대상 선생님이 같습니다.')
      return
    }
    setRunning(true)
    setDone(false)
    setLog([])
    setShowConfirm(false)

    try {
      const srcId = sourceTeacher.id
      const dstId = targetTeacher.id

      // 이전에 복사 완료된 원본 id 목록 로드
      const copied = loadCopied(srcId, dstId)
      addLog(`이전 복사 이력: ${copied.size}건 스킵 예정`, 'info')

      // ── 학교명 매핑 (원본 학교 → 가짜 학교)
      const srcClasses  = Classes.byTeacher(srcId)
      const srcStudents = Students.byTeacher(srcId)
      const allSchools  = [...new Set([
        ...srcClasses.map(c => c.organization).filter(Boolean),
        ...srcStudents.map(s => s.school).filter(Boolean),
      ])]

      const schoolMap = {}  // 원본학교 → 가짜학교
      allSchools.forEach((s, i) => { schoolMap[s] = fakeSchool(strHash(s) + i) })

      addLog(`학교 ${allSchools.length}개 → 가명 치환 완료`, 'ok')
      allSchools.forEach(s => addLog(`  "${s}" → "${schoolMap[s]}"`, 'debug'))

      // ── 수업 복사 (classId 매핑 필요)
      const classIdMap = {}   // 원본 classId → 새 classId
      let classCount = 0

      addLog(`수업 ${srcClasses.length}개 복사 시작…`, 'info')
      for (const cls of srcClasses) {
        if (copied.has(`cls:${cls.id}`)) {
          // 이미 복사된 수업 — classIdMap은 복원 불가하므로 Supabase에서 조회
          const { data: existing } = await supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', dstId)
            .eq('source_origin_id', cls.id)   // 없으면 스킵만
            .maybeSingle()
          if (existing) classIdMap[cls.id] = existing.id
          addLog(`  [SKIP] "${cls.className || cls.id}" — 이미 복사됨`, 'debug')
          classCount++
          continue
        }

        const newId = uid()
        classIdMap[cls.id] = newId

        const newCls = {
          ...cls,
          id:           newId,
          teacherId:    dstId,
          organization: cls.organization ? schoolMap[cls.organization] || cls.organization : cls.organization,
          updatedAt:    now(),
          createdAt:    now(),
        }

        addLog(`  [${classCount + 1}/${srcClasses.length}] "${cls.className || cls.id}" upsert 중…`, 'debug')
        const snakeCls = toSnakeObj(newCls)
        addLog(`    payload: ${JSON.stringify(snakeCls)}`, 'trace')

        // Supabase에 직접 upsert (다른 선생님 데이터이므로 db.insert는 현재 user 기준)
        const { error } = await supabase
          .from('classes')
          .upsert(snakeCls)
        if (error) {
          addLog(`    ❌ 실패 payload: ${JSON.stringify(snakeCls)}`, 'error')
          throw new Error(`수업 복사 실패: ${error.message}`)
        }
        copied.add(`cls:${cls.id}`)
        addLog(`    ✓ 완료 (new id: ${newId})`, 'debug')
        classCount++
      }
      saveCopied(srcId, dstId, copied)
      addLog(`수업 ${classCount}개 복사 완료`, 'ok')

      // ── 학생 복사 (studentId 매핑 필요)
      const studentIdMap = {}  // 원본 studentId → 새 studentId
      let studentCount = 0

      addLog(`학생 ${srcStudents.length}명 복사 시작…`, 'info')
      for (const [idx, stu] of srcStudents.entries()) {
        if (copied.has(`stu:${stu.id}`)) {
          addLog(`  [SKIP] "${stu.name}" — 이미 복사됨`, 'debug')
          studentCount++
          continue
        }

        const newId = uid()
        studentIdMap[stu.id] = newId

        const nameSeed = strHash(stu.id) + idx
        const newStu = {
          ...stu,
          id:          newId,
          teacherId:   dstId,
          name:        fakeName(nameSeed),
          school:      stu.school ? schoolMap[stu.school] || fakeSchool(nameSeed) : stu.school,
          parentPhone: fakePhone(),
          phone:       stu.phone ? fakePhone() : stu.phone,
          memo:        '',    // 메모는 비움
          // classIds → 새 classId로 교체
          classIds:    (stu.classIds || []).map(cid => classIdMap[cid]).filter(Boolean),
          updatedAt:   now(),
          createdAt:   now(),
        }

        addLog(`  [${idx + 1}/${srcStudents.length}] "${stu.name}" → "${newStu.name}" upsert 중…`, 'debug')
        const snakeStu = toSnakeObj(newStu)
        addLog(`    payload: ${JSON.stringify(snakeStu)}`, 'trace')

        const { error } = await supabase
          .from('students')
          .upsert(snakeStu)
        if (error) {
          addLog(`    ❌ 실패 payload: ${JSON.stringify(snakeStu)}`, 'error')
          throw new Error(`학생 복사 실패: ${error.message}`)
        }
        copied.add(`stu:${stu.id}`)
        studentCount++
        addLog(`    ✓ 완료 (new id: ${newId})`, 'debug')
      }
      saveCopied(srcId, dstId, copied)
      addLog(`학생 ${studentCount}명 복사 완료 (이름·학교·연락처 가명 처리)`, 'ok')

      // ── 출석 복사 (배치 처리)
      let attCount = 0
      const ATT_BATCH = 50

      addLog(`출석 복사 시작… (수업 ${srcClasses.length}개)`, 'info')
      for (const cls of srcClasses) {
        const attRows = Attendance.byClass(cls.id)
        const newClassId = classIdMap[cls.id]
        if (!newClassId) {
          addLog(`  [SKIP] "${cls.className || cls.id}" — classIdMap 없음`, 'debug')
          continue
        }

        const batch = []
        let skippedAtt = 0
        for (const att of attRows) {
          const newStuId = studentIdMap[att.studentId]
          if (!newStuId) { skippedAtt++; continue }
          batch.push({
            ...att,
            id:         uid(),
            class_id:   newClassId,
            student_id: newStuId,
            teacher_id: dstId,
            updated_at: now(),
          })
        }
        addLog(`  "${cls.className || cls.id}" — 출석 ${attRows.length}건 중 ${batch.length}건 준비 (studentId 불일치 스킵: ${skippedAtt}건)`, 'debug')

        if (copied.has(`att:${cls.id}`)) {
          addLog(`  [SKIP] "${cls.className || cls.id}" 출석 — 이미 복사됨`, 'debug')
          attCount += batch.length
          continue
        }

        // 배치 분할 upsert
        for (let i = 0; i < batch.length; i += ATT_BATCH) {
          const chunk = batch.slice(i, i + ATT_BATCH)
          const chunkPayload = chunk.map(r => ({
            id:         r.id,
            class_id:   r.class_id,
            student_id: r.student_id,
            date:       r.date || null,
            status:     r.status,
            updated_at: r.updated_at,
          }))
          addLog(`    배치 upsert ${i + 1}–${Math.min(i + ATT_BATCH, batch.length)}건…`, 'debug')
          addLog(`    payload[0]: ${JSON.stringify(chunkPayload[0])}`, 'trace')
          const { error } = await supabase
            .from('attendance')
            .upsert(chunkPayload, { onConflict: 'class_id,student_id,date' })
          if (error) {
            addLog(`    ❌ 실패 payload[0]: ${JSON.stringify(chunkPayload[0])}`, 'error')
            throw new Error(`출석 복사 실패: ${error.message}`)
          }
          attCount += chunk.length
          addLog(`    ✓ ${chunk.length}건 완료 (누계: ${attCount})`, 'debug')
        }
        copied.add(`att:${cls.id}`)
        saveCopied(srcId, dstId, copied)
      }
      addLog(`출석 ${attCount}건 복사 완료`, 'ok')

      addLog('──────────────────────────────', 'divider')
      addLog(`✅ 완료! ${targetTeacher.name} 선생님 계정에 데모 데이터가 생성되었습니다.`, 'success')
      setDone(true)
      success('데모 데이터 생성이 완료되었습니다!')

    } catch (e) {
      addLog(`❌ 오류: ${e.message}`, 'error')
      addLog(`  stack: ${e.stack || '(없음)'}`, 'error')
      toastError(e.message)
    } finally {
      setRunning(false)
    }
  }, [sourceTeacher, targetTeacher, toastError, success])

  // camelCase → snake_case 변환 (최소한)
  function toSnakeObj(obj) {
    const MAP = {
      teacherId:    'teacher_id',
      classId:      'class_id',
      studentId:    'student_id',
      classIds:     'class_ids',
      className:    'class_name',
      startDate:    'start_date',
      endDate:      'end_date',
      updatedAt:    'updated_at',
      createdAt:    'created_at',
      parentPhone:  'parent_phone',
      classNum:     'class_num',
      cancelledDates: 'cancelled_dates',
      makeupDates:  'makeup_dates',
      termSizes:    'term_sizes',
      termCount:    'term_count',
      termSize:     'term_size',
      repeatType:   'repeat_type',
      timeEnd:      'time_end',
      accessStartAt:   'access_start_at',
      accessExpiredAt: 'access_expired_at',
      verifyImg:    'verify_img',
      authId:       'auth_id',
      branchId:     'branch_id',
    }

    const result = {}
    for (const [k, v] of Object.entries(obj)) {
      const snakeKey = MAP[k] || k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
      // _date / _at 으로 끝나는 컬럼에 빈 문자열이 오면 PostgreSQL date/timestamptz 오류 발생
      // → 해당 패턴의 키이거나 값이 빈 문자열이면 null로 저장
      const isDateCol = /_date$|_at$|^date$/.test(snakeKey)
      result[snakeKey] = (isDateCol && v === '') ? null : v
    }
    return result
  }

  // ─────────────────────────── UI
  const selStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '9px',
    border: `1.5px solid ${C.border}`, fontSize: '13px',
    fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', background: '#fff', color: C.text,
  }
  const labelStyle = {
    fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '6px',
  }

  const logColor = { ok:'#16a34a', error:'#ef4444', success:'#7c3aed', info:C.muted, divider:'#e5e7eb', debug:'#0369a1', trace:'#9ca3af' }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 0 60px' }}>
      <PageHeader
        title="🎬 데모 데이터 생성"
        sub="선생님 데이터를 복사하고 개인정보를 가명으로 처리합니다."
      />

      {/* ── 안내 배너 */}
      <div style={{ padding: '14px 18px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', color: '#1e40af', lineHeight: 1.8 }}>
        <strong>📋 이렇게 동작합니다</strong><br />
        · 원본 선생님의 <strong>수업 / 학생 / 출석 데이터</strong>를 그대로 복사합니다.<br />
        · 학생 이름 → 가명, 학교명 → 가상 학교명, 전화번호 → <code>010-0000-0000</code> 으로 치환합니다.<br />
        · 원본 데이터는 <strong>변경되지 않습니다.</strong> 대상 선생님 계정에만 추가됩니다.
      </div>

      {/* ── 선택 영역 */}
      <Card style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* 원본 선생님 */}
        <div>
          <label style={labelStyle}>📤 원본 선생님 (데이터를 가져올 계정)</label>
          <select style={selStyle} value={sourceTeacher?.id || ''}
            onChange={e => {
              const t = teachers.find(u => u.id === e.target.value) || null
              setSourceTeacher(t)
              setPreview(null)
              setLog([])
              setDone(false)
            }}>
            <option value=''>-- 선택하세요 --</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}  ({t.email})
              </option>
            ))}
          </select>
        </div>

        {/* 미리보기 */}
        {preview && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', fontSize: '13px', color: '#15803d', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <span>📚 수업 <strong>{preview.classes.length}개</strong></span>
            <span>👥 학생 <strong>{preview.students.length}명</strong></span>
            <span>✅ 출석 <strong>{preview.attendanceCount}건</strong></span>
            <span>🏫 학교 <strong>{preview.schools.length}곳</strong> → 가명 치환</span>
          </div>
        )}

        {/* 대상 선생님 */}
        <div>
          <label style={labelStyle}>📥 대상 선생님 (데모 데이터를 받을 계정)</label>
          <select style={selStyle} value={targetTeacher?.id || ''}
            onChange={e => {
              const t = teachers.find(u => u.id === e.target.value) || null
              setTargetTeacher(t)
              setLog([])
              setDone(false)
            }}>
            <option value=''>-- 선택하세요 --</option>
            {teachers
              .filter(t => !sourceTeacher || t.id !== sourceTeacher.id)
              .map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}  ({t.email})
                </option>
              ))}
          </select>
          {targetTeacher && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#f97316' }}>
              ⚠️ 이 계정에 데모 데이터가 <strong>추가</strong>됩니다. (기존 데이터는 유지됩니다)
            </div>
          )}
        </div>

        {/* 실행 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          {sourceTeacher && targetTeacher && (
            <Btn variant="ghost"
              disabled={running}
              onClick={() => {
                localStorage.removeItem(COPY_KEY(sourceTeacher.id, targetTeacher.id))
                setLog([])
                setDone(false)
                addLog('🗑 복사 이력 초기화 완료 — 다음 실행 시 전체 재복사합니다.', 'info')
              }}
            >
              🗑 이력 초기화
            </Btn>
          )}
          {targetTeacher && (
            <Btn variant="ghost"
              disabled={running}
              onClick={() => setShowResetConfirm(true)}
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
            >
              ⚠️ 데이터 초기화
            </Btn>
          )}
          <Btn
            disabled={!sourceTeacher || !targetTeacher || running}
            onClick={() => setShowConfirm(true)}
            style={{ minWidth: 160 }}
          >
            {running ? '⏳ 생성 중...' : '🎬 데모 데이터 만들기'}
          </Btn>
        </div>
      </Card>

      {/* ── 실행 로그 */}
      {log.length > 0 && (
        <Card style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '10px' }}>
            📋 실행 로그
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: logColor[l.type] || C.muted, whiteSpace: 'pre', fontSize: l.type === 'trace' ? '11px' : '12px', opacity: l.type === 'trace' ? 0.7 : 1 }}>
                {l.type === 'divider' ? <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} /> : l.msg}
              </div>
            ))}
          </div>
          {done && (
            <div style={{ marginTop: '14px', padding: '12px 16px', background: '#f5f3ff', border: '1.5px solid #c4b5fd', borderRadius: '10px', fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>
              ✅ 완료! {targetTeacher?.name} 선생님 계정으로 로그인하면 데모 데이터를 확인할 수 있습니다.
            </div>
          )}
        </Card>
      )}

      {/* ── 확인 모달 */}
      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="데모 데이터 생성 확인"
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: C.text, lineHeight: 1.7 }}>
            <strong>{sourceTeacher?.name}</strong> 선생님의 데이터를<br />
            <strong>{targetTeacher?.name}</strong> 선생님 계정으로 복사합니다.
          </div>
          <div style={{ padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '9px', fontSize: '13px', color: '#92400e', lineHeight: 1.7 }}>
            · 수업 <strong>{preview?.classes.length || 0}개</strong>,
            학생 <strong>{preview?.students.length || 0}명</strong>,
            출석 <strong>{preview?.attendanceCount || 0}건</strong> 복사<br />
            · 이름·학교·전화번호 → 가명 처리<br />
            · 원본 데이터 변경 없음
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowConfirm(false)}>취소</Btn>
            <Btn onClick={runCopy}>확인, 생성하기</Btn>
          </div>
        </div>
      </Modal>

      {/* ── 데이터 초기화 확인 모달 */}
      <Modal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="⚠️ 데이터 초기화 확인"
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: C.text, lineHeight: 1.7 }}>
            <strong>{targetTeacher?.name}</strong> 선생님 계정의<br />
            <strong style={{ color: '#ef4444' }}>수업 / 학생 / 출석 데이터를 모두 삭제</strong>합니다.
          </div>
          <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '9px', fontSize: '13px', color: '#991b1b', lineHeight: 1.7 }}>
            · 삭제된 데이터는 복구할 수 없습니다.<br />
            · 원본 선생님 데이터는 변경되지 않습니다.<br />
            · 복사 이력도 함께 초기화됩니다.
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowResetConfirm(false)}>취소</Btn>
            <Btn onClick={runReset} style={{ background: '#ef4444' }}>삭제 실행</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
