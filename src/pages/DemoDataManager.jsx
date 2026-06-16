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

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: Date.now() }])
  }

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

      // ── 수업 복사 (classId 매핑 필요)
      const classIdMap = {}   // 원본 classId → 새 classId
      let classCount = 0

      for (const cls of srcClasses) {
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

        // Supabase에 직접 upsert (다른 선생님 데이터이므로 db.insert는 현재 user 기준)
        const { error } = await supabase
          .from('classes')
          .upsert(toSnakeObj(newCls))
        if (error) throw new Error(`수업 복사 실패: ${error.message}`)
        classCount++
      }
      addLog(`수업 ${classCount}개 복사 완료`, 'ok')

      // ── 학생 복사 (studentId 매핑 필요)
      const studentIdMap = {}  // 원본 studentId → 새 studentId
      let studentCount = 0

      for (const [idx, stu] of srcStudents.entries()) {
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

        const { error } = await supabase
          .from('students')
          .upsert(toSnakeObj(newStu))
        if (error) throw new Error(`학생 복사 실패: ${error.message}`)
        studentCount++
      }
      addLog(`학생 ${studentCount}명 복사 완료 (이름·학교·연락처 가명 처리)`, 'ok')

      // ── 출석 복사 (배치 처리)
      let attCount = 0
      const ATT_BATCH = 50

      for (const cls of srcClasses) {
        const attRows = Attendance.byClass(cls.id)
        const newClassId = classIdMap[cls.id]
        if (!newClassId) continue

        const batch = []
        for (const att of attRows) {
          const newStuId = studentIdMap[att.studentId]
          if (!newStuId) continue
          batch.push({
            ...att,
            id:         uid(),
            class_id:   newClassId,
            student_id: newStuId,
            teacher_id: dstId,
            updated_at: now(),
          })
        }

        // 배치 분할 upsert
        for (let i = 0; i < batch.length; i += ATT_BATCH) {
          const chunk = batch.slice(i, i + ATT_BATCH)
          const { error } = await supabase
            .from('attendance')
            .upsert(chunk.map(r => ({
              id:         r.id,
              class_id:   r.class_id,
              student_id: r.student_id,
              teacher_id: r.teacher_id,
              date:       r.date,
              status:     r.status,
              memo:       r.memo || null,
              updated_at: r.updated_at,
              _deleted:   false,
            })), { onConflict: 'class_id,student_id,date' })
          if (error) throw new Error(`출석 복사 실패: ${error.message}`)
          attCount += chunk.length
        }
      }
      addLog(`출석 ${attCount}건 복사 완료`, 'ok')

      addLog('──────────────────────────────', 'divider')
      addLog(`✅ 완료! ${targetTeacher.name} 선생님 계정에 데모 데이터가 생성되었습니다.`, 'success')
      setDone(true)
      success('데모 데이터 생성이 완료되었습니다!')

    } catch (e) {
      addLog(`❌ 오류: ${e.message}`, 'error')
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

    // date 타입 컬럼 목록 — 빈 문자열을 null로 치환해야 PostgreSQL 오류 방지
    const DATE_SNAKE_KEYS = new Set([
      'start_date', 'end_date', 'birth_date', 'date',
      'access_start_at', 'access_expired_at',
    ])

    const result = {}
    for (const [k, v] of Object.entries(obj)) {
      const snakeKey = MAP[k] || k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
      // 빈 문자열("")인 날짜 필드는 null로 저장 (invalid input syntax for type date 방지)
      result[snakeKey] = (DATE_SNAKE_KEYS.has(snakeKey) && v === '') ? null : v
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

  const logColor = { ok:'#16a34a', error:'#ef4444', success:'#7c3aed', info:C.muted, divider:'#e5e7eb' }

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
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
              <div key={i} style={{ color: logColor[l.type] || C.muted }}>
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
    </div>
  )
}
