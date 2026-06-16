/**
 * DemoDataManager.jsx
 * 관리자 전용 — 데모 데이터 생성 페이지
 * 선택한 선생님의 수업/학생/출석 데이터를 복사하되,
 * 이름·학교명·전화번호 등 개인정보를 가명으로 치환합니다.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { db, Users, Classes, Students, Attendance } from '../lib/db.js'
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

    const sid = sourceTeacher.id
    const supplyItemCount     = db.where('supplyItems',           r => r.teacherId === sid).length
    const supplyGivenCount    = db.where('supplyGiven',           r => r.teacherId === sid).length
    const progressCount       = db.where('supplyStudentProgress', r => r.teacherId === sid).length
    const sessionCheckCount   = db.where('supplySessionChecks',   r => r.teacherId === sid).length
    const lessonMemoCount     = db.where('lessonMemos',           r => r.teacherId === sid).length
    const revenuePaymentCount = db.where('revenuePayments',       r => r.teacherId === sid).length

    setPreview({ classes, students, attendanceCount, schools, supplyItemCount, supplyGivenCount, progressCount, sessionCheckCount, lessonMemoCount, revenuePaymentCount })
  }, [sourceTeacher])

  // ── 복사 이력 (localStorage) — 원본id 기준 스킵 + id 매핑 영속화
  const COPY_KEY   = (srcId, dstId) => `demoCopied:${srcId}:${dstId}`
  const MAP_KEY    = (srcId, dstId) => `demoIdMap:${srcId}:${dstId}`

  const loadCopied = (srcId, dstId) => {
    try { return new Set(JSON.parse(localStorage.getItem(COPY_KEY(srcId, dstId)) || '[]')) }
    catch { return new Set() }
  }
  const saveCopied = (srcId, dstId, set) => {
    try { localStorage.setItem(COPY_KEY(srcId, dstId), JSON.stringify([...set])) }
    catch {}
  }
  // id 매핑 저장/로드 — 재실행 시 classIdMap·studentIdMap 등 복원용
  const loadIdMaps = (srcId, dstId) => {
    try { return JSON.parse(localStorage.getItem(MAP_KEY(srcId, dstId)) || '{}') }
    catch { return {} }
  }
  const saveIdMaps = (srcId, dstId, maps) => {
    try { localStorage.setItem(MAP_KEY(srcId, dstId), JSON.stringify(maps)) }
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

      // 3) 학생 + 수업 + 나머지 테이블 삭제 (teacher_id 기준)
      const teacherTables = [
        ['students',               '학생',           '명'],
        ['classes',                '수업',           '개'],
        ['revenue_fees',           '수강료 항목',    '개'],
        ['revenue_payments',       '납부 기록',      '건'],
        ['supply_subjects',        '교구 과목',      '개'],
        ['supply_vendors',         '교구 업체',      '개'],
        ['supply_products',        '교구 상품',      '개'],
        ['supply_product_plans',   '교구 상품 플랜', '개'],
        ['supply_plans',           '교구 플랜',      '개'],
        ['supply_promos',          '교구 프로모',    '개'],
        ['supply_items',           '교구 배정',      '개'],
        ['supply_given',           '교구 지급 기록', '건'],
        ['supply_student_progress','진도 현황',      '건'],
        ['supply_progress_logs',   '진도 로그',      '건'],
        ['supply_session_checks',  '세션 체크',      '건'],
        ['lesson_memos',           '수업 메모',      '개'],
        ['message_guides',         '안내 문구',      '개'],
        ['message_categories',     '메시지 카테고리','개'],
        ['custom_categories',      '커스텀 카테고리','개'],
        ['documents',              '방과후 서류',    '개'],
      ]
      for (const [tbl, label, unit] of teacherTables) {
        const { error, count } = await supabase.from(tbl).delete({ count: 'exact' }).eq('teacher_id', dstId)
        if (error) addLog(`  ⚠️ ${label} 삭제 실패: ${error.message}`, 'error')
        else if (count > 0) addLog(`  ✓ ${label} ${count}${unit} 삭제`, 'ok')
        // count === 0 이면 로그 생략 (이미 없는 데이터는 표시 안 함)
      }

      // 5) 복사 이력도 초기화
      if (sourceTeacher) {
        localStorage.removeItem(COPY_KEY(sourceTeacher.id, dstId))
        localStorage.removeItem(MAP_KEY(sourceTeacher.id, dstId))
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

      // 이전에 복사 완료된 원본 id 목록 + id 매핑 로드
      const copied   = loadCopied(srcId, dstId)
      const savedMaps = loadIdMaps(srcId, dstId)
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
      const classIdMap = { ...(savedMaps.classIdMap || {}) }   // 원본 classId → 새 classId (이전 실행분 복원)
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
      saveIdMaps(srcId, dstId, { ...loadIdMaps(srcId, dstId), classIdMap })
      addLog(`수업 ${classCount}개 복사 완료`, 'ok')

      // ── 학생 복사 (studentId 매핑 필요)
      const studentIdMap = { ...(savedMaps.studentIdMap || {}) }  // 원본 studentId → 새 studentId (이전 실행분 복원)
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
      saveIdMaps(srcId, dstId, { ...loadIdMaps(srcId, dstId), studentIdMap })
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

      // ── 1단계: teacherId만 의존하는 테이블 ──────────

      // 수강료 항목 (feeId 매핑 필요 — revenuePayments에서 참조)
      addLog('수강료 항목 복사 중…', 'info')
      const srcRevenueFees = db.where('revenueFees', r => r.teacherId === srcId)
      const feeIdMap = { ...(savedMaps.feeIdMap || {}) }
      for (const row of srcRevenueFees) {
        if (copied.has(`revenue_fees:${row.id}`)) {
          // 이미 복사된 경우 매핑 복원 불가 → 스킵만
          addLog(`  [SKIP] 수강료 항목 "${row.name || row.id}"`, 'debug')
          continue
        }
        const newId = uid()
        feeIdMap[row.id] = newId
        const newRow = {
          id: newId, teacher_id: dstId,
          class_id: classIdMap[row.classId] ?? classIdMap[row.class_id] ?? null,
          fee_type: row.feeType ?? row.fee_type ?? null,
          amount: row.amount ?? null,
          updated_at: now(), created_at: now(),
        }
        const { error } = await supabase.from('revenue_fees').upsert(newRow)
        if (error) throw new Error(`revenue_fees 복사 실패: ${error.message}`)
        copied.add(`revenue_fees:${row.id}`)
      }
      saveCopied(srcId, dstId, copied)
      saveIdMaps(srcId, dstId, { ...loadIdMaps(srcId, dstId), feeIdMap })
      addLog(`  ✓ 수강료 항목 ${Object.keys(feeIdMap).length}개`, 'ok')

      // 교구 업체 (vendorId 매핑 필요)
      addLog('교구 업체 복사 중…', 'info')
      const srcVendors = db.where('supplyVendors', r => r.teacherId === srcId)
      const vendorIdMap = { ...(savedMaps.vendorIdMap || {}) }
      for (const row of srcVendors) {
        if (copied.has(`supply_vendors:${row.id}`)) { continue }
        const newId = uid()
        vendorIdMap[row.id] = newId
        const newRow = {
          id: newId, teacher_id: dstId,
          subject: row.subject ?? null, name: row.name ?? null,
          manager_name: row.managerName ?? row.manager_name ?? null,
          contact: row.contact ?? null, memo: row.memo ?? null,
          updated_at: now(), created_at: now(),
        }
        const { error } = await supabase.from('supply_vendors').upsert(newRow)
        if (error) throw new Error(`supply_vendors 복사 실패: ${error.message}`)
        copied.add(`supply_vendors:${row.id}`)
      }
      saveCopied(srcId, dstId, copied)
      saveIdMaps(srcId, dstId, { ...loadIdMaps(srcId, dstId), vendorIdMap })
      addLog(`  ✓ 교구 업체 ${Object.keys(vendorIdMap).length}개`, 'ok')

      // 교구 상품 (productId 매핑 필요)
      addLog('교구 상품 복사 중…', 'info')
      const srcProducts = db.where('supplyProducts', r => r.teacherId === srcId)
      const productIdMap = { ...(savedMaps.productIdMap || {}) }
      for (const row of srcProducts) {
        if (copied.has(`supply_products:${row.id}`)) { continue }
        const newId = uid()
        productIdMap[row.id] = newId
        const newRow = {
          id: newId, teacher_id: dstId,
          vendor_id: vendorIdMap[row.vendorId] || row.vendorId || null,
          subject: row.subject ?? null, name: row.name ?? null,
          max_stage: row.maxStage ?? row.max_stage ?? null,
          sessions_per_stage: row.sessionsPerStage ?? row.sessions_per_stage ?? 12,
          alert_session: row.alertSession ?? row.alert_session ?? 3,
          updated_at: now(), created_at: now(),
        }
        const { error } = await supabase.from('supply_products').upsert(newRow)
        if (error) throw new Error(`supply_products 복사 실패: ${error.message}`)
        copied.add(`supply_products:${row.id}`)
      }
      saveCopied(srcId, dstId, copied)
      saveIdMaps(srcId, dstId, { ...loadIdMaps(srcId, dstId), productIdMap })
      addLog(`  ✓ 교구 상품 ${Object.keys(productIdMap).length}개`, 'ok')

      // 교구 상품 플랜
      addLog('교구 상품 플랜 복사 중…', 'info')
      const srcProductPlans = db.where('supplyProductPlans', r => r.teacherId === srcId)
      const productPlanIdMap = { ...(savedMaps.productPlanIdMap || {}) }
      for (const row of srcProductPlans) {
        if (copied.has(`supply_product_plans:${row.id}`)) { continue }
        const newId = uid()
        productPlanIdMap[row.id] = newId
        const newRow = {
          id: newId, teacher_id: dstId,
          product_id: productIdMap[row.productId] || row.productId,
          stage: row.stage ?? null,
          session_no: row.sessionNo ?? row.session_no ?? null,
          title: row.title ?? null,
          memo: row.memo ?? null,
          file_name: row.fileName ?? row.file_name ?? null,
          file_url: row.fileUrl ?? row.file_url ?? null,
          updated_at: now(), created_at: now(),
        }
        const { error } = await supabase.from('supply_product_plans').upsert(newRow)
        if (error) throw new Error(`supply_product_plans 복사 실패: ${error.message}`)
        copied.add(`supply_product_plans:${row.id}`)
      }
      saveCopied(srcId, dstId, copied)
      saveIdMaps(srcId, dstId, { ...loadIdMaps(srcId, dstId), productPlanIdMap })
      addLog(`  ✓ 교구 상품 플랜 ${Object.keys(productPlanIdMap).length}개`, 'ok')

      // 교구 과목, 플랜, 프로모, 안내문구, 카테고리, 서류 — 단순 복사
      const simpleTeacherTables = [
        { key: 'supplySubjects',     table: 'supply_subjects',     label: '교구 과목' },
        { key: 'supplyPlans',        table: 'supply_plans',        label: '교구 플랜',
          remap: r => ({ ...r, productId: productIdMap[r.productId] || r.productId, vendorId: vendorIdMap[r.vendorId] || r.vendorId }) },
        { key: 'supplyPromos',       table: 'supply_promos',       label: '교구 프로모' },
        { key: 'messageGuides',      table: 'message_guides',      label: '안내 문구' },
        { key: 'messageCategories',  table: 'message_categories',  label: '메시지 카테고리' },
        { key: 'customCategories',   table: 'custom_categories',   label: '커스텀 카테고리' },
        { key: 'documents',          table: 'documents',           label: '방과후 서류' },
      ]
      for (const { key, table, label, remap } of simpleTeacherTables) {
        const rows = db.where(key, r => r.teacherId === srcId)
        let cnt = 0
        for (const row of rows) {
          if (copied.has(`${table}:${row.id}`)) { cnt++; continue }
          const base = remap ? remap(row) : row
          const newRow = toSnakeObj({ ...base, id: uid(), teacherId: dstId, updatedAt: now(), createdAt: now() })
          const { error } = await supabase.from(table).upsert(newRow)
          if (error) throw new Error(`${table} 복사 실패: ${error.message}`)
          copied.add(`${table}:${row.id}`)
          cnt++
        }
        saveCopied(srcId, dstId, copied)
        addLog(`  ✓ ${label} ${cnt}개`, 'ok')
      }

      // ── 2단계: classId 의존 ──────────────────────────

      // 수업 메모
      addLog('수업 메모 복사 중…', 'info')
      const srcLessonMemos = db.where('lessonMemos', r => r.teacherId === srcId)
      let lessonMemoCount = 0
      for (const row of srcLessonMemos) {
        if (copied.has(`lesson_memos:${row.id}`)) { lessonMemoCount++; continue }
        const newClassId = classIdMap[row.classId]
        if (!newClassId) continue
        const newRow = {
          id: uid(), teacher_id: dstId, class_id: newClassId,
          content: row.content ?? null,
          date: row.date || null,
          updated_at: now(), created_at: now(),
        }
        const { error } = await supabase.from('lesson_memos').upsert(newRow)
        if (error) throw new Error(`lesson_memos 복사 실패: ${error.message}`)
        copied.add(`lesson_memos:${row.id}`)
        lessonMemoCount++
      }
      saveCopied(srcId, dstId, copied)
      addLog(`  ✓ 수업 메모 ${lessonMemoCount}개`, 'ok')

      // ── 3단계: studentId + classId 의존 ─────────────

      // 교구 배정 (productId도 교체 필요 — 대시보드가 item.productId로 상품 조회)
      {
        const rows = db.where('supplyItems', r => r.teacherId === srcId)
        let cnt = 0
        for (const row of rows) {
          if (copied.has(`supply_items:${row.id}`)) { cnt++; continue }
          const newStudentId = studentIdMap[row.studentId]
          const newClassId   = classIdMap[row.classId]
          if (!newStudentId || !newClassId) continue
          const newRow = {
            id:         uid(),
            teacher_id: dstId,
            student_id: newStudentId,
            class_id:   newClassId,
            product_id: productIdMap[row.productId] || row.productId,
            subject:    row.subject    ?? null,
            name:       row.name       ?? null,
            stage:      row.stage      ?? null,
            remote_no:  row.remoteNo   ?? row.remote_no ?? null,
            updated_at: now(),
            created_at: now(),
            _deleted:   false,
          }
          const { error } = await supabase.from('supply_items').upsert(newRow)
          if (error) throw new Error(`supply_items 복사 실패: ${error.message}`)
          copied.add(`supply_items:${row.id}`)
          cnt++
        }
        saveCopied(srcId, dstId, copied)
        addLog(`  ✓ 교구 배정 ${cnt}개`, 'ok')
      }

      // 교구 지급 기록 (productId 교체)
      {
        const rows = db.where('supplyGiven', r => r.teacherId === srcId)
        let cnt = 0
        for (const row of rows) {
          if (copied.has(`supply_given:${row.id}`)) { cnt++; continue }
          const newStudentId = studentIdMap[row.studentId]
          const newClassId   = classIdMap[row.classId]
          if (!newStudentId || !newClassId) continue
          const newRow = {
            id:           uid(),
            teacher_id:   dstId,
            student_id:   newStudentId,
            student_name: row.studentName ?? row.student_name ?? null,
            class_id:     newClassId,
            class_name:   row.className   ?? row.class_name   ?? null,
            school_name:  row.schoolName  ?? row.school_name  ?? null,
            product_id:   productIdMap[row.productId] || row.productId || null,
            product_name: row.productName ?? row.product_name ?? null,
            vendor_id:    row.vendorId    ?? row.vendor_id    ?? null,
            item_name:    row.itemName    ?? row.item_name    ?? null,
            given_at:     row.givenAt     ?? row.given_at     ?? null,
            paid_at:      row.paidAt      ?? row.paid_at      ?? null,
            quarter:      row.quarter     ?? null,
            supply_status: row.supplyStatus ?? row.supply_status ?? null,
            status:       row.status      ?? null,
            updated_at:   now(),
            created_at:   now(),
          }
          const { error } = await supabase.from('supply_given').upsert(newRow)
          if (error) throw new Error(`supply_given 복사 실패: ${error.message}`)
          copied.add(`supply_given:${row.id}`)
          cnt++
        }
        saveCopied(srcId, dstId, copied)
        addLog(`  ✓ 교구 지급 기록 ${cnt}개`, 'ok')
      }

      // 진도 현황 — next_product_id, next_stage 포함
      {
        const rows = db.where('supplyStudentProgress', r => r.teacherId === srcId)
        let cnt = 0
        for (const row of rows) {
          if (copied.has(`supply_student_progress:${row.id}`)) { cnt++; continue }
          const newStudentId = studentIdMap[row.studentId]
          const newClassId   = classIdMap[row.classId]
          if (!newStudentId || !newClassId) continue
          const newRow = {
            id:               uid(),
            teacher_id:       dstId,
            student_id:       newStudentId,
            class_id:         newClassId,
            product_id:       productIdMap[row.productId]     || row.productId,
            next_product_id:  productIdMap[row.nextProductId] || row.nextProductId || null,
            next_stage:       row.nextStage ?? row.next_stage ?? null,
            cur_stage:        row.curStage  ?? row.cur_stage  ?? 1,
            cur_session:      row.curSession ?? row.cur_session ?? 0,
            supplyReady:      row.supplyReady      ?? false,
            supplyDelivered:  row.supplyDelivered  ?? false,
            transferSchool:   row.transferSchool   ?? false,
            transferStudent:  row.transferStudent  ?? false,
            transferSupply:   row.transferSupply   ?? false,
            updated_at:       now(),
            created_at:       now(),
            _deleted:         false,
          }
          const { error } = await supabase.from('supply_student_progress').upsert(newRow)
          if (error) throw new Error(`supply_student_progress 복사 실패: ${error.message}`)
          copied.add(`supply_student_progress:${row.id}`)
          cnt++
        }
        saveCopied(srcId, dstId, copied)
        addLog(`  ✓ 진도 현황 ${cnt}개`, 'ok')
      }

      // 진도 로그 — next_product_id 없음
      {
        const rows = db.where('supplyProgressLogs', r => r.teacherId === srcId)
        let cnt = 0
        for (const row of rows) {
          if (copied.has(`supply_progress_logs:${row.id}`)) { cnt++; continue }
          const newStudentId = studentIdMap[row.studentId]
          const newClassId   = classIdMap[row.classId]
          if (!newStudentId || !newClassId) continue
          const newRow = {
            id:         uid(),
            teacher_id: dstId,
            student_id: newStudentId,
            class_id:   newClassId,
            product_id: productIdMap[row.productId] || row.productId,
            file_name:  row.fileName  ?? row.file_name  ?? null,
            file_url:   row.fileUrl   ?? row.file_url   ?? null,
            file_type:  row.fileType  ?? row.file_type  ?? null,
            updated_at: now(),
            created_at: now(),
            _deleted:   false,
          }
          const { error } = await supabase.from('supply_progress_logs').upsert(newRow)
          if (error) throw new Error(`supply_progress_logs 복사 실패: ${error.message}`)
          copied.add(`supply_progress_logs:${row.id}`)
          cnt++
        }
        saveCopied(srcId, dstId, copied)
        addLog(`  ✓ 진도 로그 ${cnt}개`, 'ok')
      }

      // 세션 체크 — nextProductId 컬럼 없음
      {
        const rows = db.where('supplySessionChecks', r => r.teacherId === srcId)
        let cnt = 0
        for (const row of rows) {
          if (copied.has(`supply_session_checks:${row.id}`)) { cnt++; continue }
          const newStudentId = studentIdMap[row.studentId]
          const newClassId   = classIdMap[row.classId]
          if (!newStudentId || !newClassId) continue
          const newRow = {
            id:         uid(),
            teacher_id: dstId,
            student_id: newStudentId,
            class_id:   newClassId,
            product_id: productIdMap[row.productId] || row.productId,
            stage:      row.stage,
            session_no: row.sessionNo ?? row.session_no,
            checked_at: row.checkedAt ?? row.checked_at ?? null,
            updated_at: now(),
            created_at: now(),
            _deleted:   false,
          }
          const { error } = await supabase.from('supply_session_checks').upsert(newRow)
          if (error) throw new Error(`supply_session_checks 복사 실패: ${error.message}`)
          copied.add(`supply_session_checks:${row.id}`)
          cnt++
        }
        saveCopied(srcId, dstId, copied)
        addLog(`  ✓ 세션 체크 ${cnt}개`, 'ok')
      }

      // 납부 기록 (feeId + studentId 매핑)
      addLog('납부 기록 복사 중…', 'info')
      const srcPayments = db.where('revenuePayments', r => r.teacherId === srcId)
      let paymentCount = 0
      for (const row of srcPayments) {
        if (copied.has(`revenue_payments:${row.id}`)) { paymentCount++; continue }
        const newStudentId = studentIdMap[row.studentId] || row.studentId
        const newFeeId     = feeIdMap[row.feeId]         || row.feeId
        const newRow = {
          id: uid(), teacher_id: dstId,
          class_id: classIdMap[row.classId] ?? classIdMap[row.class_id] ?? null,
          term_no: row.termNo ?? row.term_no ?? null,
          date: row.date || null,
          amount: row.amount ?? null,
          memo: row.memo ?? null,
          updated_at: now(), created_at: now(),
        }
        const { error } = await supabase.from('revenue_payments').upsert(newRow)
        if (error) throw new Error(`revenue_payments 복사 실패: ${error.message}`)
        copied.add(`revenue_payments:${row.id}`)
        paymentCount++
      }
      saveCopied(srcId, dstId, copied)
      addLog(`  ✓ 납부 기록 ${paymentCount}건`, 'ok')

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
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', fontSize: '13px', color: '#15803d', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>📚 수업 <strong>{preview.classes.length}개</strong></span>
            <span>👥 학생 <strong>{preview.students.length}명</strong></span>
            <span>✅ 출석 <strong>{preview.attendanceCount}건</strong></span>
            <span>🏫 학교 <strong>{preview.schools.length}곳</strong></span>
            {preview.supplyItemCount > 0    && <span>🎒 교구배정 <strong>{preview.supplyItemCount}건</strong></span>}
            {preview.supplyGivenCount > 0    && <span>📦 교구지급 <strong>{preview.supplyGivenCount}건</strong></span>}
            {preview.progressCount > 0       && <span>📈 진도 <strong>{preview.progressCount}건</strong></span>}
            {preview.sessionCheckCount > 0   && <span>☑️ 세션체크 <strong>{preview.sessionCheckCount}건</strong></span>}
            {preview.lessonMemoCount > 0     && <span>📝 수업메모 <strong>{preview.lessonMemoCount}건</strong></span>}
            {preview.revenuePaymentCount > 0 && <span>💰 납부기록 <strong>{preview.revenuePaymentCount}건</strong></span>}
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
                localStorage.removeItem(MAP_KEY(sourceTeacher.id, targetTeacher.id))
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
