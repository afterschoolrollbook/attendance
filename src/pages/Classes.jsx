import React, { useState, useRef, useEffect } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Templates as TemplatesDB, DocumentsDB, Attendance as AttendanceDB, RevenueFees, RevenuePayments, TeacherParentLinks, SupplyStudentProgress, SupplyProgressLogs, SupplySessionChecks, SupplyItems, SupplyGiven, LessonMemos } from '../lib/db.js'
import { uid, now, calcSessionDates, sortClasses, today } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Textarea, DayPicker, Tag, EmptyState, PageHeader } from '../components/Atoms.jsx'
import { ClassCalendar } from '../pages/ClassCalendar.jsx'
import { TERM_TYPES, REPEAT_TYPES } from '../constants/config.js'
import { useToast } from '../hooks/useToast.js'

const VIEW_TABS = ['요일별', '학교별', '과목별']
const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']
const MAX_PROMO_IMAGES = 8
const MAX_NOTICE_FILES = 4
const MAX_TEMPLATE_FILES = 2

// 연도별 공휴일 목록
const HOLIDAYS = {
  2025: [
    { date:'2025-01-01', name:'신정 (1/1)' },
    { date:'2025-01-27', name:'설날 연휴 (1/27)' }, { date:'2025-01-28', name:'설날 (1/28)' }, { date:'2025-01-29', name:'설날 (1/29)' }, { date:'2025-01-30', name:'설날 대체 (1/30)' },
    { date:'2025-03-01', name:'삼일절 (3/1)' },
    { date:'2025-05-01', name:'근로자의날 (5/1)' },
    { date:'2025-05-05', name:'어린이날 (5/5)' },
    { date:'2025-05-06', name:'어린이날 대체 (5/6)' },
    { date:'2025-05-13', name:'부처님오신날 (5/13)' },
    { date:'2025-06-06', name:'현충일 (6/6)' },
    { date:'2025-07-17', name:'제헌절 (7/17)' },
    { date:'2025-08-15', name:'광복절 (8/15)' },
    { date:'2025-10-03', name:'개천절 (10/3)' },
    { date:'2025-10-05', name:'추석 연휴 (10/5)' }, { date:'2025-10-06', name:'추석 (10/6)' }, { date:'2025-10-07', name:'추석 연휴 (10/7)' },
    { date:'2025-10-08', name:'추석 대체 (10/8)' },
    { date:'2025-10-09', name:'한글날 (10/9)' },
    { date:'2025-12-25', name:'성탄절 (12/25)' },
  ],
  2026: [
    { date:'2026-01-01', name:'신정 (1/1)' },
    { date:'2026-01-28', name:'설날 연휴 (1/28)' }, { date:'2026-01-29', name:'설날 (1/29)' }, { date:'2026-01-30', name:'설날 연휴 (1/30)' },
    { date:'2026-03-01', name:'삼일절 (3/1)' },
    { date:'2026-05-01', name:'근로자의날 (5/1)' },
    { date:'2026-05-05', name:'어린이날 (5/5)' },
    { date:'2026-05-24', name:'부처님오신날 (5/24)' },
    { date:'2026-05-25', name:'부처님오신날 대체 (5/25)' },
    { date:'2026-06-03', name:'지방선거일 (6/3)' },
    { date:'2026-06-06', name:'현충일 (6/6)' },
    { date:'2026-07-17', name:'제헌절 (7/17)' },
    { date:'2026-08-15', name:'광복절 (8/15)' },
    { date:'2026-08-17', name:'광복절 대체 (8/17)' },
    { date:'2026-09-24', name:'추석 연휴 (9/24)' }, { date:'2026-09-25', name:'추석 (9/25)' }, { date:'2026-09-26', name:'추석 연휴 (9/26)' },
    { date:'2026-10-03', name:'개천절 (10/3)' },
    { date:'2026-10-05', name:'개천절 대체 (10/5)' },
    { date:'2026-10-09', name:'한글날 (10/9)' },
    { date:'2026-12-25', name:'성탄절 (12/25)' },
  ],
  2027: [
    { date:'2027-01-01', name:'신정 (1/1)' },
    { date:'2027-02-15', name:'설날 연휴 (2/15)' }, { date:'2027-02-16', name:'설날 (2/16)' }, { date:'2027-02-17', name:'설날 연휴 (2/17)' },
    { date:'2027-03-01', name:'삼일절 (3/1)' },
    { date:'2027-05-01', name:'근로자의날 (5/1)' },
    { date:'2027-05-05', name:'어린이날 (5/5)' },
    { date:'2027-05-13', name:'부처님오신날 (5/13)' },
    { date:'2027-06-06', name:'현충일 (6/6)' },
    { date:'2027-06-07', name:'현충일 대체 (6/7)' },
    { date:'2027-07-17', name:'제헌절 (7/17)' },
    { date:'2027-08-15', name:'광복절 (8/15)' },
    { date:'2027-09-03', name:'추석 연휴 (9/3)' }, { date:'2027-09-04', name:'추석 (9/4)' }, { date:'2027-09-05', name:'추석 연휴 (9/5)' },
    { date:'2027-09-06', name:'추석 대체 (9/6)' },
    { date:'2027-10-03', name:'개천절 (10/3)' },
    { date:'2027-10-04', name:'개천절 대체 (10/4)' },
    { date:'2027-10-09', name:'한글날 (10/9)' },
    { date:'2027-10-11', name:'한글날 대체 (10/11)' },
    { date:'2027-12-25', name:'성탄절 (12/25)' },
  ],
  2028: [
    { date:'2028-01-01', name:'신정 (1/1)' },
    { date:'2028-02-04', name:'설날 연휴 (2/4)' }, { date:'2028-02-05', name:'설날 (2/5)' }, { date:'2028-02-06', name:'설날 연휴 (2/6)' },
    { date:'2028-03-01', name:'삼일절 (3/1)' },
    { date:'2028-05-01', name:'근로자의날 (5/1)' },
    { date:'2028-05-05', name:'어린이날 (5/5)' },
    { date:'2028-06-01', name:'부처님오신날 (6/1)' },
    { date:'2028-06-06', name:'현충일 (6/6)' },
    { date:'2028-07-17', name:'제헌절 (7/17)' },
    { date:'2028-08-15', name:'광복절 (8/15)' },
    { date:'2028-09-21', name:'추석 연휴 (9/21)' }, { date:'2028-09-22', name:'추석 (9/22)' }, { date:'2028-09-23', name:'추석 연휴 (9/23)' },
    { date:'2028-10-03', name:'개천절 (10/3)' },
    { date:'2028-10-09', name:'한글날 (10/9)' },
    { date:'2028-12-25', name:'성탄절 (12/25)' },
  ],
}

// Supabase Storage 업로드
async function uploadToStorage(userId, classId, folder, file) {
  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const ext      = file.name.split('.').pop().toLowerCase()
  const filePath = `classes/${userId}/${classId}/${folder}/${Date.now()}_${file.name}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/teacher-files/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`업로드 실패: ${err?.message || res.statusText}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/teacher-files/${filePath}`
}

function emptyPeriod(label) {
  return { label, startDate: '', endDate: '', termCount: 1, termSizes: [4] }
}

function emptySection() {
  return { section: '', time: '', timeEnd: '', classDuration: '' }
}

function emptyForm() {
  return {
    organization: '', className: '',
    sections: [emptySection()], // [{ section, time, timeEnd, classDuration }]
    // 하위호환 (기존 저장 데이터용)
    section: '', time: '', timeEnd: '', classDuration: '',
    termType: 'semester', termCount: 4, termSizes: [4,4,4,4],
    periods: [], // 학기/분기별 기간 배열 [{ label, startDate, endDate, termCount, termSizes }]
    days: [], repeatType: 'every',
    startDate: '', endDate: '', description: '',
    officePhone: '', schoolAddress: '', classLocation: '',
    contactPhone: '', contactMobile: '',
    promotionImgs: [],
    noticeFiles: [],
    templateFiles: [],
    cancelledDates: [],
    makeupDates: [],
    specialPeriods: [],
    alarm:    { enabled: false, minutesBefore: 10 },
    alarmEnd: { enabled: false, minutesBefore: 10 },
  }
}

// 기존 단일 section/time 데이터 → sections 배열로 변환 (하위호환)
function toSections(cls) {
  if (cls.sections?.length > 0) return cls.sections.map(s => ({ ...s, classDuration: s.classDuration != null ? String(s.classDuration) : '' }))
  return [{ section: cls.section || '', time: cls.time || '', timeEnd: cls.timeEnd || '', classDuration: cls.classDuration != null ? String(cls.classDuration) : '' }]
}

export function Classes({ user, onNav }) {
  const [view,    setView]    = useState('요일별')
  const [selYear, setSelYear] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const oldSectionsRef = useRef([]) // 편집 시작 시점의 반 목록 저장
  const [form, setForm] = useState(emptyForm())
  const [tab, setTab] = useState('info') // 'info' | 'promo' | 'notice' | 'template' | 'calendar'
  const importFileRef = React.useRef(null)
  const [deleteId, setDeleteId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [noticePreview, setNoticePreview] = useState(null)
  const [promoSearch,    setPromoSearch]    = useState('')
  const [noticeSearch,   setNoticeSearch]   = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [docPickerTarget, setDocPickerTarget] = useState(null) // 'promo' | 'notice' | 'template'
  const [editCancelIdx,  setEditCancelIdx]  = useState(null)
  const [editCancelMemo, setEditCancelMemo] = useState('')
  const [newCancelDate,  setNewCancelDate]  = useState('')
  const [newCancelReason,setNewCancelReason]= useState('school_holiday')
  const promoRef = useRef()
  const noticeRef = useRef()
  const templateRef = useRef()

  const [alarmToast, setAlarmToast] = useState(null) // { className, minutesBefore, type: 'start'|'end' }
  const [openPeriods, setOpenPeriods] = useState({}) // 분기 접기/펼치기 상태
  const { success, error: toastError } = useToast()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // ── 수업 템플릿 내보내기 (.after)
  // 수업 카드의 📤 내보내기 버튼 → 수업명_학생.after + 수업명_교구.after 두 파일 생성
  const exportTemplate = (cls) => {
    try {
      const safeName = (str) => (str || '').replace(/[/\\:*?"<>|]/g, '_').trim()
      const label = [cls.days?.join(''), cls.organization, cls.className, cls.section].filter(Boolean).join('_')

      // 기본정보 + 수업달력만 내보내기
      const payload = {
        __type: 'classes',
        __version: 1,
        exportedAt: new Date().toISOString(),
        class: {
          // 기본 정보
          organization:  cls.organization  || '',
          className:     cls.className     || '',
          section:       cls.section       || '',
          termType:      cls.termType      || 'semester',
          termCount:     cls.termCount     || 4,
          termSizes:     cls.termSizes     || [4,4,4,4],
          periods:       cls.periods       || [],
          days:          cls.days          || [],
          repeatType:    cls.repeatType    || 'every',
          time:          cls.time          || '',
          timeEnd:       cls.timeEnd       || '',
          classDuration: cls.classDuration || null,
          startDate:     cls.startDate     || '',
          endDate:       cls.endDate       || '',
          description:   cls.description   || '',
          officePhone:   cls.officePhone   || '',
          schoolAddress: cls.schoolAddress || '',
          classLocation: cls.classLocation || '',
          contactPhone:  cls.contactPhone  || '',
          contactMobile: cls.contactMobile || '',
          alarm:         cls.alarm         || { enabled: false, minutesBefore: 10 },
          alarmEnd:      cls.alarmEnd      || { enabled: false, minutesBefore: 10 },
          // 수업 달력
          cancelledDates: cls.cancelledDates || [],
          makeupDates:    cls.makeupDates    || [],
          specialPeriods: cls.specialPeriods || [],
          totalSessions:  cls.totalSessions  || null,
        },
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${safeName(label)}_수업설정.after`
      a.click()
      URL.revokeObjectURL(url)
      success(`📤 ${safeName(label)}_수업설정.after 저장 완료!`)
    } catch (e) {
      toastError('내보내기 실패: ' + e.message)
    }
  }

  // ── 수업 템플릿 불러오기 (.after)
  // 📥 템플릿 불러오기 버튼 → 파일 타입에 따라 학생 명단 또는 수업 설정 자동 처리
  const importTemplate = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // ── 학생 명단 불러오기
      if (data.__type === 'students') {
        const meta = data.classMeta || {}
        // 대상 수업 찾기: 같은 수업명+단체명 우선, 없으면 새 수업 생성
        let targetCls = allClasses.find(c =>
          c.organization === meta.organization &&
          c.className    === meta.className &&
          (c.section     === meta.section || (!c.section && !meta.section))
        )

        if (!targetCls) {
          // 수업이 없으면 메타 정보로 새 수업 생성
          const newCls = {
            id:           uid(),
            teacherId:    user.id,
            organization: meta.organization || '',
            className:    meta.className    || '',
            section:      meta.section      || '',
            days:         meta.days         || [],
            time:         meta.time         || '',
            timeEnd:      meta.timeEnd      || '',
            termType:     meta.termType     || 'semester',
            termCount:    4,
            termSizes:    [4,4,4,4],
            periods:      [],
            repeatType:   'every',
            startDate:    '',
            endDate:      '',
            description:  '',
            promotionImgs: [],
            noticeFiles:  [],
            templateFiles:[],
            cancelledDates:[],
            makeupDates:  [],
            specialPeriods:[],
            alarm:    { enabled: false, minutesBefore: 10 },
            alarmEnd: { enabled: false, minutesBefore: 10 },
            createdAt: now(),
          }
          ClassesDB.insert(newCls)
          targetCls = newCls
        }

        // 기존 학생 중복 체크 (이름 + 부모전화)
        const existing = StudentsDB.byClass(targetCls.id)
        const existingKeys = new Set(existing.map(s => `${s.name}__${(s.parentPhone||'').replace(/\D/g,'')}` ))

        let added = 0, skipped = 0
        for (const s of (data.students || [])) {
          const key = `${s.name}__${(s.parentPhone||'').replace(/\D/g,'')}`
          if (existingKeys.has(key)) { skipped++; continue }
          StudentsDB.insert({
            id:           uid(),
            teacherId:    user.id,
            classIds:     [targetCls.id],
            name:          s.name          || '',
            status:        s.status        || 'applied',
            school:        s.school        || targetCls.organization || '',
            grade:         s.grade         || '',
            classNum:      s.classNum      || '',
            number:        s.number        || '',
            parentPhone:   s.parentPhone   || '',
            studentPhone:  s.studentPhone  || '',
            contactMethod: s.contactMethod || '',
            homeReturn:    s.homeReturn    || '',
            memo:          s.memo          || '',
            remark:        s.remark        || '',
            applyOrder:    s.applyOrder    || '',
            relations:     s.relations     || [],
            student_careers: s.student_careers || [],
            statusHistory: [{ status: s.status || 'applied', changedAt: now(), memo: '템플릿 불러오기' }],
            movedToManage: false,
            createdAt:     now(),
          })
          existingKeys.add(key)
          added++
        }
        success(
          `✅ [${targetCls.organization} ${targetCls.className}] 학생 ${added}명 추가` +
          (skipped > 0 ? ` (중복 ${skipped}명 스킵)` : '')
        )

      // ── 수업 설정 불러오기
      } else if (data.__type === 'classes') {
        const c = data.class || {}
        // 같은 수업 이미 있으면 덮어쓸지 확인
        const existing = allClasses.find(x =>
          x.organization === c.organization &&
          x.className    === c.className &&
          (x.section     === c.section || (!x.section && !c.section))
        )
        if (existing) {
          ClassesDB.update(existing.id, {
            ...c,
            promotionImgs: existing.promotionImgs || [],
            noticeFiles:   existing.noticeFiles   || [],
            templateFiles: existing.templateFiles  || [],
            cancelledDates: existing.cancelledDates || [],
            makeupDates:   existing.makeupDates    || [],
            specialPeriods: existing.specialPeriods || [],
          })
          success(`✅ [${c.organization} ${c.className}] 수업 설정을 업데이트했습니다.`)
        } else {
          ClassesDB.insert({
            ...c,
            id:           uid(),
            teacherId:    user.id,
            promotionImgs: [],
            noticeFiles:  [],
            templateFiles:[],
            cancelledDates:[],
            makeupDates:  [],
            specialPeriods:[],
            createdAt:    now(),
          })
          success(`✅ [${c.organization} ${c.className}] 수업이 새로 등록되었습니다.`)
        }

      } else {
        toastError('지원하지 않는 파일 형식입니다. (_학생.after 또는 _수업설정.after 파일을 선택하세요)')
      }
    } catch (e) {
      toastError('파일을 읽을 수 없습니다: ' + e.message)
    }
  }

  const allClasses = ClassesDB.byTeacher(user.id)
  const years = [...new Set(allClasses.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const classes = selYear ? allClasses.filter(c => c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear)) : allClasses
  const t = today()

  // 알람: 1분마다 시작/종료 시간 체크
  useEffect(() => {
    const fireAlarm = (cls, type, minutesBefore) => {
      setAlarmToast({ className: cls.className, minutesBefore, type })
      setTimeout(() => setAlarmToast(null), 8000)
      const body = type === 'start'
        ? `${cls.className} 수업이 ${minutesBefore}분 후 시작됩니다!`
        : `${cls.className} 수업이 ${minutesBefore}분 후 종료됩니다!`
      if (Notification.permission === 'granted') {
        new Notification('🔔 수업 알람', { body, icon: '/favicon.ico' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification('🔔 수업 알람', { body })
        })
      }
    }

    const check = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const todayDay = ['일','월','화','수','목','금','토'][now.getDay()]

      classes.forEach(cls => {
        if (!cls.days?.includes(todayDay)) return

        // ── 시작 알람
        if (cls.alarm?.enabled && cls.time) {
          const startTime = cls.time.includes('~') ? cls.time.split('~')[0].trim() : cls.time
          const [sh, sm] = startTime.split(':').map(Number)
          const alarmTime = new Date(now)
          alarmTime.setHours(sh, sm - (cls.alarm.minutesBefore || 10), 0, 0)
          const alarmHHMM = `${String(alarmTime.getHours()).padStart(2,'0')}:${String(alarmTime.getMinutes()).padStart(2,'0')}`
          if (hhmm === alarmHHMM) fireAlarm(cls, 'start', cls.alarm.minutesBefore)
        }

        // ── 종료 알람
        if (cls.alarmEnd?.enabled && cls.timeEnd) {
          const [eh, em] = cls.timeEnd.split(':').map(Number)
          const alarmTime = new Date(now)
          alarmTime.setHours(eh, em - (cls.alarmEnd.minutesBefore || 10), 0, 0)
          const alarmHHMM = `${String(alarmTime.getHours()).padStart(2,'0')}:${String(alarmTime.getMinutes()).padStart(2,'0')}`
          if (hhmm === alarmHHMM) fireAlarm(cls, 'end', cls.alarmEnd.minutesBefore)
        }
      })
    }
    check()
    const timer = setInterval(check, 60000)
    return () => clearInterval(timer)
  }, [classes])

  const openAdd = () => { setForm(emptyForm()); setEditId(null); setTab('info'); setShowModal(true) }

  const openCopy = (cls) => {
    const { id: _removeId, createdAt: _removeCreatedAt, ...clsWithoutId } = cls
    setForm({
      ...clsWithoutId,
      promotionImgs: cls.promotionImgs || [],
      noticeFiles: cls.noticeFiles || [],
      templateFiles: cls.templateFiles || (cls.templateFile ? [cls.templateFile] : []),
      alarm: cls.alarm || { enabled: false, minutesBefore: 10 },
      alarmEnd: cls.alarmEnd || { enabled: false, minutesBefore: 10 },
      cancelledDates: cls.cancelledDates || [],
      makeupDates: cls.makeupDates || [],
      specialPeriods: cls.specialPeriods || [],
      periods: cls.periods || [],
      termCount: cls.termCount || 4,
      termSizes: cls.termSizes?.length > 0 ? cls.termSizes : [4,4,4,4],
      contactPhone: cls.contactPhone || '',
      contactMobile: cls.contactMobile || '',
      classDuration: cls.classDuration || '',
      sections: toSections(cls),
    })
    setEditId('__copy__')
    setTab('info')
    setShowModal(true)
  }

  const openEdit = (cls) => {
    setForm({
      ...cls,
      promotionImgs: cls.promotionImgs || [],
      noticeFiles: cls.noticeFiles || [],
      templateFiles: cls.templateFiles || (cls.templateFile ? [cls.templateFile] : []),
      alarm: cls.alarm || { enabled: false, minutesBefore: 10 },
      alarmEnd: cls.alarmEnd || { enabled: false, minutesBefore: 10 },
      cancelledDates: cls.cancelledDates || [],
      makeupDates: cls.makeupDates || [],
      specialPeriods: cls.specialPeriods || [],
      periods: cls.periods || [],
      termCount: cls.termCount || 4,
      termSizes: cls.termSizes?.length > 0 ? cls.termSizes : [4,4,4,4],
      officePhone: cls.officePhone || '',
      schoolAddress: cls.schoolAddress || '',
      classLocation: cls.classLocation || '',
      contactPhone: cls.contactPhone || '',
      contactMobile: cls.contactMobile || '',
      classDuration: cls.classDuration || '',
      sections: toSections(cls),
    })
    oldSectionsRef.current = toSections(cls) // 이전 반 목록 저장
    setEditId(cls.id)
    setTab('info')
    setShowModal(true)
  }

  // 분기 추가/삭제 시 openPeriods 동기화
  useEffect(() => {
    const periods = form.periods || []
    if (periods.length === 0) return
    const today = new Date().toISOString().slice(0,10)
    const activeIdx = periods.findIndex(p => p.startDate && p.endDate && today >= p.startDate && today <= p.endDate)
    const defaultIdx = activeIdx >= 0 ? activeIdx : periods.length - 1
    setOpenPeriods(prev => {
      const next = {}
      periods.forEach((_, i) => {
        // 기존에 명시적으로 설정된 값은 유지, 새로 추가된 분기는 마지막이면 열기
        next[i] = prev[i] !== undefined ? prev[i] : i === defaultIdx
      })
      return next
    })
  }, [(form.periods || []).length, showModal])

  const save = async () => {
    if (!form.organization.trim() || !form.className.trim() || !form.days.length) {
      toastError('필수 항목을 입력하세요 (단체명, 수업명, 요일).')
      return
    }
    const periods = form.periods || []
    const hasPeriods = periods.length > 0 && periods.some(p => p.startDate && p.endDate)
    if (!hasPeriods && (!form.startDate || !form.endDate)) {
      toastError('수업 기간을 설정하세요.')
      return
    }

    // periods → startDate/endDate/termSizes/termCount 통합 변환
    // 어떤 방식으로 저장하든 calcSessionDates가 동작하는 기존 방식으로 통일
    let autoStart = form.startDate
    let autoEnd   = form.endDate
    let autoTermSizes = form.termSizes
    let autoTermCount = form.termCount

    if (hasPeriods) {
      autoStart     = periods.find(p => p.startDate)?.startDate || form.startDate
      autoEnd       = [...periods].reverse().find(p => p.endDate)?.endDate || form.endDate
      // 모든 학기/분기의 termSizes를 하나로 합침
      autoTermSizes = periods.flatMap(p =>
        (p.termSizes?.length > 0)
          ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
          : Array(Number(p.termCount) || 1).fill(4)
      )
      autoTermCount = autoTermSizes.length
    }

    // sections → 첫번째 반을 기존 필드에도 저장 (하위호환)
    const sections = form.sections?.length > 0 ? form.sections : [{ section: form.section || '', time: form.time || '', timeEnd: form.timeEnd || '', classDuration: form.classDuration || '' }]
    const firstSec = sections[0] || {}

    const cleanForm = {
      ...form,
      sections,
      // 하위호환: 첫번째 반 정보를 기존 필드에도 저장
      section:      firstSec.section      || '',
      time:         firstSec.time         || '',
      timeEnd:      firstSec.timeEnd      || '',
      startDate:    autoStart,
      endDate:      autoEnd,
      termSizes:    autoTermSizes,
      termCount:    autoTermCount,
      classDuration: firstSec.classDuration === '' ? null : Number(firstSec.classDuration) || null,
    }
    if (editId && editId !== '__copy__') {
      ClassesDB.update(editId, cleanForm)
      // 반 이름이 변경/삭제된 경우 학생 section 필드 업데이트
      const oldSecs = oldSectionsRef.current
      const newSecs = sections
      for (let i = 0; i < oldSecs.length; i++) {
        const oldSec = oldSecs[i]
        if (!oldSec.section) continue
        const newSec = newSecs[i]
        if (!newSec || !newSec.section) {
          // 반이 삭제된 경우 → 해당 학생 section 초기화
          await Promise.all(
            StudentsDB.byClass(editId)
              .filter(s => s.section === oldSec.section)
              .map(s => StudentsDB.update(s.id, { section: '' }))
          )
        } else if (oldSec.section !== newSec.section) {
          // 반 이름이 변경된 경우 → 새 이름으로 업데이트
          await Promise.all(
            StudentsDB.byClass(editId)
              .filter(s => s.section === oldSec.section)
              .map(s => StudentsDB.update(s.id, { section: newSec.section }))
          )
        }
      }
      success('수정이 완료되었습니다.')
    } else {
      const { id: _oldId, ...formWithoutId } = cleanForm
      ClassesDB.insert({ ...formWithoutId, id: uid(), teacherId: user.id, createdAt: now() })
      success('등록이 완료되었습니다.')
    }
    // 저장 후 모달 유지 (X버튼으로만 닫기)
    // setShowModal(false)
  }

  const del = () => {
    if (!deleteId) return
    const cid = deleteId
    // 학부모 연결 해제
    TeacherParentLinks.unlinkByClass(user.id, cid)
    // 출결 기록 삭제
    AttendanceDB.byClass(cid).forEach(a => AttendanceDB.delete(a.id))
    // 수납 기록 삭제 (byClass 없으므로 byTeacher 후 필터)
    RevenuePayments.byTeacher(user.id).filter(p => p.classId === cid).forEach(p => RevenuePayments.delete(p.id))
    RevenueFees.byTeacher(user.id).filter(f => f.classId === cid).forEach(f => RevenueFees.delete(f.id))
    // 교구 진도 기록 삭제
    SupplyItems.byClass(cid).forEach(i => SupplyItems.delete(i.id))
    SupplyStudentProgress.byClass(cid).forEach(p => SupplyStudentProgress.delete(p.id))
    SupplyGiven.byClass(cid).forEach(g => SupplyGiven.delete(g.id))
    SupplyProgressLogs.byTeacher(user.id).filter(l => l.classId === cid).forEach(l => SupplyProgressLogs.delete(l.id))
    SupplySessionChecks.byTeacher(user.id).filter(c => c.classId === cid).forEach(c => SupplySessionChecks.delete(c.id))
    // 수업 메모 삭제
    LessonMemos.byTeacher(user.id).filter(m => m.classId === cid).forEach(m => LessonMemos.delete(m.id))
    // 학생 수업 배정 해제
    StudentsDB.byClass(cid).forEach(s => {
      StudentsDB.update(s.id, { classIds: (s.classIds || []).filter(id => id !== cid) })
    })
    ClassesDB.delete(cid)
    setDeleteId(null)
  }


  // 홍보물 이미지 — Supabase Storage 업로드
  const handlePromoFile = async (e) => {
    const files = Array.from(e.target.files)
    const current = form.promotionImgs || []
    const remaining = MAX_PROMO_IMAGES - current.length
    if (remaining <= 0) { toastError('최대 2장까지 등록 가능합니다.'); return }
    const toAdd = files.slice(0, remaining)
    const classId = editId && editId !== '__copy__' ? editId : ('tmp_' + uid())
    setUploading(true)
    try {
      const urls = await Promise.all(toAdd.map(f => uploadToStorage(user.id, classId, 'promo', f)))
      set('promotionImgs', [...current, ...urls])
    } catch(err) { toastError('업로드 실패: ' + err.message) }
    finally { setUploading(false) }
    e.target.value = ''
  }

  const removePromo = (idx) => {
    set('promotionImgs', form.promotionImgs.filter((_, i) => i !== idx))
  }

  // 안내장 파일 — Supabase Storage 업로드 (jpg/png/pdf)
  const handleNoticeFile = async (e) => {
    const files = Array.from(e.target.files)
    const current = form.noticeFiles || []
    const remaining = MAX_NOTICE_FILES - current.length
    if (remaining <= 0) { toastError(`최대 ${MAX_NOTICE_FILES}개까지 등록 가능합니다.`); return }
    const allowed = ['image/jpeg','image/png','application/pdf']
    const valid = files.filter(f => allowed.includes(f.type)).slice(0, remaining)
    if (valid.length < files.length) toastError('jpg, png, pdf 파일만 업로드 가능합니다.')
    if (!valid.length) return
    const classId = editId && editId !== '__copy__' ? editId : ('tmp_' + uid())
    setUploading(true)
    try {
      const results = await Promise.all(valid.map(async f => ({
        url: await uploadToStorage(user.id, classId, 'notice', f),
        name: f.name,
        fileType: f.type,
      })))
      set('noticeFiles', [...current, ...results])
    } catch(err) { toastError('업로드 실패: ' + err.message) }
    finally { setUploading(false) }
    e.target.value = ''
  }

  const removeNotice = (idx) => {
    set('noticeFiles', (form.noticeFiles || []).filter((_, i) => i !== idx))
  }

  // 출석부 양식 — Supabase Storage 업로드
  const handleTemplateFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const current = form.templateFiles || []
    if (current.length >= MAX_TEMPLATE_FILES) { toastError(`최대 ${MAX_TEMPLATE_FILES}개까지 등록 가능합니다.`); return }
    const ext = file.name.split('.').pop().toLowerCase()
    const fileType = (ext === 'hwp' || ext === 'hwpx') ? 'hwp' : 'xlsx'
    const classId = editId && editId !== '__copy__' ? editId : ('tmp_' + uid())
    setUploading(true)
    try {
      const url = await uploadToStorage(user.id, classId, 'template', file)
      set('templateFiles', [...current, { name: file.name, fileType, url }])
    } catch(err) { toastError('업로드 실패: ' + err.message) }
    finally { setUploading(false) }
    e.target.value = ''
  }

  // 뷰별 그룹핑
  const grouped = {}
  classes.forEach(cls => {
    let key
    if (view === '요일별') key = cls.days?.join(', ') || '미설정'
    else if (view === '학교별') key = cls.organization || '미설정'
    else key = cls.className || '미설정' // 과목별
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(cls)
  })

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (view === '요일별') return (DAY_ORDER.indexOf(a.split(', ')[0]) ?? 99) - (DAY_ORDER.indexOf(b.split(', ')[0]) ?? 99)
    return a.localeCompare(b)
  })

  // 그룹 내 카드 정렬: sortClasses 공통 함수 사용
  sortedKeys.forEach(key => { grouped[key] = sortClasses(grouped[key]) })

  return (
    <div style={{ padding: '28px', maxWidth: '1100px' }}>
      {/* 알람 토스트 */}
      {alarmToast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: alarmToast.type === 'end' ? '#7c3aed' : '#1d4ed8',
          color: '#fff', padding: '16px 22px',
          borderRadius: '14px', fontSize: '14px', fontWeight: 600,
          boxShadow: `0 4px 24px ${alarmToast.type === 'end' ? 'rgba(124,58,237,0.35)' : 'rgba(29,78,216,0.35)'}`,
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeIn 0.2s ease', maxWidth: '320px',
        }}>
          <span style={{ fontSize: '24px' }}>{alarmToast.type === 'end' ? '🔕' : '🔔'}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>{alarmToast.className}</div>
            <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
              {alarmToast.type === 'end'
                ? `수업 종료 ${alarmToast.minutesBefore}분 전입니다!`
                : `수업 시작 ${alarmToast.minutesBefore}분 전입니다!`}
            </div>
          </div>
          <button onClick={() => setAlarmToast(null)}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}
      <input ref={importFileRef} type="file" accept=".after" style={{ display:'none' }} onChange={importTemplate} />
      <PageHeader
        title="수업 관리"
        sub="수업을 등록하고 일정을 관리합니다."
        right={
          <div style={{ display:'flex', gap:'8px' }}>
            <button
              onClick={() => importFileRef.current?.click()}
              style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              📥 템플릿 불러오기
            </button>
            <Btn onClick={openAdd}>+ 수업 등록</Btn>
          </div>
        }
      />

      {/* 년도 필터 */}
      {years.length > 0 && (
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
          <button onClick={() => setSelYear('')} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', background:selYear===''?'#18181b':'#f3f4f6', color:selYear===''?'#fff':'#374151', fontWeight:selYear===''?700:400, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>전체</button>
          {years.map(y => (
            <button key={y} onClick={() => setSelYear(y)} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', background:selYear===y?'#18181b':'#f3f4f6', color:selYear===y?'#fff':'#374151', fontWeight:selYear===y?700:400, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>{y}년</button>
          ))}
        </div>
      )}

      {/* 뷰 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {VIEW_TABS.map(t => (
          <button key={t} onClick={() => setView(t)} style={{
            padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: view === t ? '#f97316' : '#f3f4f6',
            color: view === t ? '#fff' : '#374151',
            fontWeight: view === t ? 600 : 400,
            fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
            transition: 'all .15s',
          }}>{t}</button>
        ))}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon="📚" title="등록된 수업이 없습니다" desc="수업을 등록하여 출석 관리를 시작하세요." />
      ) : (
        sortedKeys.map(group => (
          <div key={group} style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {view === '요일별' ? `${group} 수업` : group}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {grouped[group].map(cls => {
                const sessions = calcSessionDates(cls)
                const displaySessions = cls.totalSessions || sessions.length
                const upcoming = sessions.find(d => d >= t)
                const studentCount = StudentsDB.confirmed(cls.id).length
                const hasPromo = cls.promotionImgs?.length > 0
                const hasTpl = (cls.templateFiles?.length > 0) || !!cls.templateFile

                const secs = cls.sections?.length > 0 ? cls.sections : (cls.section ? [{ section: cls.section, time: cls.time, timeEnd: cls.timeEnd }] : [])
                // 현재 진행중인 분기 찾기
                const activePeriod = (cls.periods||[]).find(p => p.startDate && p.endDate && t >= p.startDate && t <= p.endDate)
                const nextPeriod = !activePeriod ? (cls.periods||[]).find(p => p.startDate && p.startDate > t) : null
                const showPeriod = activePeriod || nextPeriod
                // 진행중 분기 차시 계산
                const periodSessions = showPeriod
                  ? calcSessionDates({ ...cls, periods: [showPeriod] }).length
                  : displaySessions

                return (
                  <Card key={cls.id} onClick={() => openEdit(cls)}>
                    {/* 홍보물 썸네일 */}
                    {hasPromo && (
                      <div style={{ margin: '-20px -20px 14px', borderRadius: '10px 10px 0 0', overflow: 'hidden', height: '120px', position: 'relative' }}>
                        <img src={cls.promotionImgs[0]} alt="홍보물" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {cls.promotionImgs.length > 1 && (
                          <div style={{ position: 'absolute', bottom: '6px', right: '8px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '11px', padding: '2px 7px', borderRadius: '6px' }}>+{cls.promotionImgs.length - 1}</div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{cls.className}</div>
                        {secs.length > 0 && (
                          <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginTop:'3px' }}>
                            {secs.map((s,i) => {
                              const LABELS = ['A','B','C','D','E','F']
                              const secLabel = s.section || LABELS[i] || String(i+1)
                              return (
                                <div key={i} style={{ fontSize:'12px', color:'#6b7280', display:'flex', alignItems:'center', gap:'6px' }}>
                                  <span style={{ fontWeight:700, color:'#f97316', minWidth:'28px' }}>{secLabel}반</span>
                                  {s.time && <span>{s.time}{s.timeEnd ? ` ~ ${s.timeEnd}` : ''}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <Tag color="#f97316" bg="#fff7ed">{cls.days?.join(', ')}</Tag>
                    </div>

                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>{cls.organization}</div>

                    {/* 분기 전체 목록 */}
                    {(cls.periods||[]).filter(p => p.startDate && p.endDate).map((p, i) => {
                      const isActive = t >= p.startDate && t <= p.endDate
                      const pSessions = calcSessionDates({ ...cls, periods: [p] }).length
                      return (
                        <div key={i} style={{ fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px',
                          padding: isActive ? '2px 6px' : '0',
                          borderRadius: isActive ? '6px' : '0',
                          background: isActive ? '#f0fdf4' : 'transparent',
                          border: isActive ? '1px solid #bbf7d0' : 'none',
                        }}>
                          <span style={{ fontWeight:700, color: isActive ? '#16a34a' : '#374151' }}>{p.label}</span>
                          <span style={{ color:'#9ca3af' }}>{p.startDate?.slice(5)} ~ {p.endDate?.slice(5)}</span>
                          <span style={{ color:'#6b7280', fontWeight:600 }}>({pSessions}차시)</span>
                          {isActive && <span style={{ padding:'1px 5px', borderRadius:'4px', background:'#16a34a', color:'#fff', fontSize:'10px', fontWeight:700 }}>진행중</span>}
                        </div>
                      )
                    })}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', marginTop:'8px' }}>
                      {secs.length > 1 ? secs.map((s,i) => {
                        const LABELS = ['A','B','C','D','E','F']
                        const secLabel = s.section || LABELS[i] || String(i+1)
                        const secStudents = StudentsDB.confirmed(cls.id).filter(st => st.section === s.section || (!st.section && i === 0))
                        return <Tag key={i} color="#3b82f6" bg="#eff6ff">{secLabel}반 {secStudents.length}명</Tag>
                      }) : (
                        <Tag color="#3b82f6" bg="#eff6ff">학생 {studentCount}명</Tag>
                      )}
                      {upcoming && <Tag color="#f59e0b" bg="#fffbeb">다음 {upcoming.slice(5)}</Tag>}
                      {hasTpl && <Tag color="#8b5cf6" bg="#f5f3ff">양식 ✓</Tag>}
                      {cls.alarm?.enabled && <Tag color="#3b82f6" bg="#eff6ff">🔔 시작 {cls.alarm.minutesBefore}분전</Tag>}
                      {cls.alarmEnd?.enabled && <Tag color="#7c3aed" bg="#ede9fe">🔕 종료 {cls.alarmEnd.minutesBefore}분전</Tag>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(cls)}>편집</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => openCopy(cls)} style={{ color:'#3b82f6', borderColor:'#93c5fd' }}>복사</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => exportTemplate(cls)} style={{ color:'#16a34a', borderColor:'#86efac' }}>📤 내보내기</Btn>
                      <Btn size="sm" variant="outlineDanger" onClick={() => setDeleteId(cls.id)}>삭제</Btn>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* ─── 수업 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId === '__copy__' ? '수업 복사' : editId ? '수업 편집' : '수업 등록'} width={660}>
        {/* 서브탭 */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
          {[
            { key: 'info',     label: '기본 정보' },
            { key: 'calendar', label: '수업 달력' },
            { key: 'promo',    label: `홍보물 ${form.promotionImgs?.length ? `(${form.promotionImgs.length})` : ''}` },
            { key: 'notice',   label: `안내장 ${form.noticeFiles?.length ? `(${form.noticeFiles.length})` : ''}` },
            { key: 'template', label: `출석부 양식 ${(form.templateFiles||[]).length > 0 ? '✓' : ''}` },
          ].map(s => (
            <button key={s.key} onClick={() => setTab(s.key)} style={{
              padding: '10px 16px', border: 'none', cursor: 'pointer', background: 'none', whiteSpace: 'nowrap',
              color: tab === s.key ? '#f97316' : '#9ca3af',
              fontWeight: tab === s.key ? 700 : 400, fontSize: '14px',
              borderBottom: tab === s.key ? '2px solid #f97316' : '2px solid transparent',
              fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '-1px',
            }}>{s.label}</button>
          ))}
        </div>

        {/* ── 기본 정보 */}
        {tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="단체명(학교명)" value={form.organization} onChange={v => set('organization', v)} required />
              <Input label="수업명(과목)" value={form.className} onChange={v => set('className', v)} required />
            </div>
            {/* ── 반별 시간 설정 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <label style={{ fontSize:'13px', fontWeight:700, color:'#111827' }}>반 설정</label>
                <button type="button" onClick={() => set('sections', [...(form.sections||[]), emptySection()])}
                  style={{ padding:'4px 12px', borderRadius:'7px', border:'1.5px solid #f97316', background:'#fff7ed', color:'#f97316', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  + 반 추가
                </button>
              </div>
              {(form.sections||[]).map((sec, idx) => {
                const setSecField = (field, val) => {
                  setForm(prev => ({
                    ...prev,
                    sections: (prev.sections||[]).map((s,i) => i===idx ? {...s, [field]: val} : s)
                  }))
                }
                const calcEnd = (time, dur) => {
                  if (!time || !dur) return
                  const [h,m] = time.split(':').map(Number)
                  const total = h*60 + m + parseInt(dur)
                  const eh = Math.floor(total/60)%24
                  const em = total%60
                  setForm(prev => ({
                    ...prev,
                    sections: (prev.sections||[]).map((s,i) => i===idx ? {...s, timeEnd: `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`} : s)
                  }))
                }
                const SECTION_LABELS = ['A','B','C','D','E','F']
                return (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'60px 1fr 80px 1fr auto', gap:'8px', alignItems:'end', padding:'10px 12px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'#fafafa' }}>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'4px' }}>반</label>
                      <input value={sec.section} onChange={e => setSecField('section', e.target.value)}
                        placeholder={SECTION_LABELS[idx] || String(idx+1)}
                        style={{ width:'100%', padding:'7px 8px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box', textAlign:'center', fontWeight:700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'4px' }}>시작시간</label>
                      <input type="time" value={sec.time||''}
                        onChange={e => { setSecField('time', e.target.value); calcEnd(e.target.value, sec.classDuration) }}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'4px' }}>수업시간(분)</label>
                      <input type="number" min="1" max="300" value={sec.classDuration||''} placeholder="80"
                        onChange={e => { setSecField('classDuration', e.target.value); calcEnd(sec.time, e.target.value) }}
                        style={{ width:'100%', padding:'7px 8px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', background:'#fff', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'4px' }}>종료시간</label>
                      <input type="time" value={sec.timeEnd||''}
                        onChange={e => setSecField('timeEnd', e.target.value)}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background: sec.classDuration ? '#f0fdf4' : '#fff', boxSizing:'border-box' }} />
                    </div>
                    <div style={{ paddingBottom:'2px' }}>
                      {(form.sections||[]).length > 1 && (
                        <button type="button" onClick={async () => {
                          const removedSection = (form.sections||[])[idx]?.section
                          if (editId && editId !== '__copy__' && removedSection) {
                            await Promise.all(
                              StudentsDB.byClass(editId)
                                .filter(s => s.section === removedSection)
                                .map(s => StudentsDB.update(s.id, { section: '' }))
                            )
                          }
                          set('sections', (form.sections||[]).filter((_,i)=>i!==idx))
                        }}
                          style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', background:'#fff', color:'#ef4444', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>✕</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <Select label="수업 운영 방식" value={form.termType} onChange={v => {
              // 방식 바꿀 때 periods 초기화
              const isSemester = v === 'semester'
              const labels = isSemester ? ['1학기','2학기','3학기'] : ['1분기','2분기','3분기','4분기']
              const defaultCount = isSemester ? 2 : 4
              set('termType', v)
              if ((form.periods || []).length === 0) {
                set('periods', labels.slice(0, defaultCount).map(l => emptyPeriod(l)))
              }
            }} options={TERM_TYPES} required />

            {/* ── 학기/분기별 기간 및 텀 설정 */}
            {(() => {
              const isSemester = form.termType === 'semester'
              const allLabels = isSemester
                ? ['1학기','2학기','3학기']
                : ['1분기','2분기','3분기','4분기']
              const maxCount = allLabels.length
              const periods = form.periods?.length > 0
                ? form.periods
                : [emptyPeriod(allLabels[0])]

              const setPeriod = (idx, patch) => {
                const next = periods.map((p, i) => i === idx ? { ...p, ...patch } : p)
                set('periods', next)
              }
              const addPeriod = () => {
                if (periods.length >= maxCount) return
                // form.periods가 비어있으면 현재 periods(기본값 포함)를 먼저 저장
                const base = form.periods?.length > 0 ? form.periods : periods
                set('periods', [...base, emptyPeriod(allLabels[base.length])])
              }
              const removePeriod = (idx) => {
                if (periods.length <= 1) return
                set('periods', periods.filter((_, i) => i !== idx))
              }
              const setTermSize = (pIdx, tIdx, val) => {
                const sizes = [...(periods[pIdx].termSizes || [])]
                sizes[tIdx] = Number(val) || 0
                setPeriod(pIdx, { termSizes: sizes })
              }
              const setTermCount = (pIdx, count) => {
                const n = Number(count)
                const prev = periods[pIdx].termSizes || []
                const sizes = Array.from({ length: n }, (_, i) => prev[i] || 4)
                setPeriod(pIdx, { termCount: n, termSizes: sizes })
              }

              // 기존 startDate/endDate 방식이면 periods에 반영
              if (form.periods?.length === 0 && form.startDate) {
                set('periods', [{ label: allLabels[0], startDate: form.startDate, endDate: form.endDate, termCount: form.termCount || 1, termSizes: form.termSizes || [4] }])
              }

              const inputSt = { padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }

              return (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  <div style={{ fontSize:'13px', fontWeight:700, color:'#111827' }}>
                    📅 {isSemester ? '학기' : '분기'}별 기간 및 텀 설정
                  </div>

                  {periods.map((p, pIdx) => {
                    const today = new Date().toISOString().slice(0,10)
                    const isActive = p.startDate && p.endDate && today >= p.startDate && today <= p.endDate
                    return (
                    <div key={pIdx} style={{ border:`1.5px solid ${isActive ? '#f97316' : '#e5e7eb'}`, borderRadius:'12px', background: isActive ? '#fff7ed' : '#fafafa', overflow:'hidden' }}>
                      {/* 헤더 — 항상 표시, 클릭으로 접기/펼치기 */}
                      <div
                        onClick={() => setOpenPeriods(prev => ({ ...prev, [pIdx]: !prev[pIdx] }))}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer', userSelect:'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'13px', fontWeight:700, color: isActive ? '#f97316' : '#6b7280' }}>{p.label}</span>
                          {isActive && <span style={{ fontSize:'10px', background:'#f97316', color:'#fff', borderRadius:'4px', padding:'1px 6px', fontWeight:700 }}>진행중</span>}
                          {p.startDate && p.endDate && (
                            <span style={{ fontSize:'11px', color:'#9ca3af' }}>{p.startDate} ~ {p.endDate}</span>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          {periods.length > 1 && (
                            <button type="button" onClick={e => { e.stopPropagation(); removePeriod(pIdx) }}
                              style={{ background:'none', border:'none', color:'#9ca3af', fontSize:'18px', cursor:'pointer', lineHeight:1 }}>×</button>
                          )}
                          <span style={{ color:'#9ca3af', fontSize:'13px' }}>{openPeriods[pIdx] ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {/* 내용 — open일 때만 표시 */}
                      {openPeriods[pIdx] && <div style={{ padding:'0 16px 14px', display:'flex', flexDirection:'column', gap:'12px' }}>
                      {/* 기간 */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'8px', alignItems:'center' }}>
                        <div>
                          <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'4px' }}>시작일</label>
                          <input type="date" value={p.startDate || ''} onChange={e => {
                            setPeriod(pIdx, { startDate: e.target.value })
                            // 첫 번째 학기면 form.startDate도 연동
                            if (pIdx === 0) set('startDate', e.target.value)
                          }} style={{ ...inputSt, width:'100%' }} />
                        </div>
                        <span style={{ color:'#9ca3af', marginTop:'16px' }}>~</span>
                        <div>
                          <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'4px' }}>종료일</label>
                          <input type="date" value={p.endDate || ''} onChange={e => {
                            setPeriod(pIdx, { endDate: e.target.value })
                            // 마지막 학기면 form.endDate도 연동
                            if (pIdx === periods.length - 1) set('endDate', e.target.value)
                          }} style={{ ...inputSt, width:'100%' }} />
                        </div>
                      </div>
                      {/* 텀 수 */}
                      <div>
                        <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'6px' }}>텀 수</label>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {[1,2,3,4,5,6].map(n => (
                            <button key={n} type="button" onClick={() => setTermCount(pIdx, n)}
                              style={{ padding:'5px 14px', borderRadius:'7px', border:`1.5px solid ${(p.termCount||1)===n?'#f97316':'#e5e7eb'}`, background:(p.termCount||1)===n?'#fff7ed':'#fff', color:(p.termCount||1)===n?'#f97316':'#374151', fontSize:'13px', fontWeight:(p.termCount||1)===n?700:400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                              {n}텀
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* 텀당 차시 */}
                      <div>
                        <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'6px' }}>텀당 차시</label>
                        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                          {Array.from({ length: p.termCount || 1 }, (_, tIdx) => (
                            <div key={tIdx} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
                              <span style={{ fontSize:'10px', color:'#9ca3af' }}>{tIdx+1}텀</span>
                              <input type="number" min="1" max="30" value={p.termSizes?.[tIdx] || 4}
                                onChange={e => setTermSize(pIdx, tIdx, e.target.value)}
                                style={{ width:'52px', padding:'5px 6px', borderRadius:'7px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center' }} />
                              <span style={{ fontSize:'10px', color:'#9ca3af' }}>차시</span>
                            </div>
                          ))}
                          <div style={{ fontSize:'12px', color:'#9ca3af', alignSelf:'center' }}>
                            = 총 {(p.termSizes||[]).slice(0, p.termCount||1).reduce((s,v)=>s+(Number(v)||0),0)}차시
                          </div>
                        </div>
                      </div>
                      </div>}
                    </div>
                  )})}
                  {periods.length < maxCount && (
                    <button type="button" onClick={addPeriod}
                      style={{ padding:'9px', borderRadius:'10px', border:'2px dashed #e5e7eb', background:'#fafafa', color:'#9ca3af', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                      + {allLabels[periods.length]} 추가
                    </button>
                  )}
                  {/* 전체 요약 */}
                  <div style={{ fontSize:'12px', color:'#6b7280', padding:'8px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #86efac' }}>
                    전체 {periods.reduce((s,p)=>(p.termSizes||[]).slice(0,p.termCount||1).reduce((a,v)=>a+(Number(v)||0),0)+s,0)}차시
                    · {periods.length}{isSemester?'학기':'분기'}
                    · {periods.reduce((s,p)=>s+(p.termCount||1),0)}텀
                  </div>
                </div>
              )
            })()}

            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>수업 요일 <span style={{ color: '#ef4444' }}>*</span></div>
              <DayPicker value={form.days} onChange={v => set('days', v)} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>반복 패턴 <span style={{ color: '#ef4444' }}>*</span></div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[{ value: 'none', label: '해당없음' }, ...REPEAT_TYPES].map(rt => (
                  <button key={rt.value} type="button" onClick={() => set('repeatType', rt.value)}
                    style={{
                      padding: '7px 14px', borderRadius: '8px', border: `1.5px solid ${form.repeatType === rt.value ? '#f97316' : '#e5e7eb'}`,
                      background: form.repeatType === rt.value ? '#f97316' : '#fff',
                      color: form.repeatType === rt.value ? '#fff' : '#374151',
                      fontSize: '13px', fontWeight: form.repeatType === rt.value ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all .15s',
                    }}>{rt.label}</button>
                ))}
              </div>
              {form.repeatType !== 'every' && form.repeatType !== 'none' && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#f97316', background: '#fff7ed', padding: '8px 12px', borderRadius: '7px', border: '1px solid #fed7aa' }}>
                  💡 선택된 패턴: <strong>{REPEAT_TYPES.find(r=>r.value===form.repeatType)?.label}</strong> — 수업 달력에서 실제 날짜를 확인하세요
                </div>
              )}
              {form.repeatType === 'none' && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', background: '#f9fafb', padding: '8px 12px', borderRadius: '7px', border: '1px solid #e5e7eb' }}>
                  ℹ️ 반복 없음 — 수업 달력에서 날짜를 직접 지정하세요
                </div>
              )}
            </div>

            {/* ── 알람 설정 */}
            <div style={{ background: '#f8faff', border: '1.5px solid #dbeafe', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', marginBottom: '14px' }}>🔔 알람 설정</div>

              {/* 시작 알람 */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>🟢 수업 시작 알람</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: form.alarm?.enabled ? '10px' : '0' }}>
                  {[{ value: false, label: '선택안함' }, { value: true, label: '알람 설정' }].map(opt => (
                    <button key={String(opt.value)} type="button"
                      onClick={() => set('alarm', { ...(form.alarm || {}), enabled: opt.value })}
                      style={{
                        padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                        fontFamily: 'Noto Sans KR, sans-serif', fontSize: '13px', transition: 'all .15s',
                        border: `1.5px solid ${form.alarm?.enabled === opt.value ? '#3b82f6' : '#e5e7eb'}`,
                        background: form.alarm?.enabled === opt.value ? '#3b82f6' : '#fff',
                        color: form.alarm?.enabled === opt.value ? '#fff' : '#374151',
                        fontWeight: form.alarm?.enabled === opt.value ? 700 : 400,
                      }}>{opt.label}</button>
                  ))}
                </div>
                {form.alarm?.enabled && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>수업 시작 몇 분 전?</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[5, 10, 15, 20, 30, 60].map(min => (
                        <button key={min} type="button"
                          onClick={() => set('alarm', { ...(form.alarm || {}), minutesBefore: min })}
                          style={{
                            padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                            fontFamily: 'Noto Sans KR, sans-serif', fontSize: '13px', transition: 'all .15s',
                            border: `1.5px solid ${form.alarm?.minutesBefore === min ? '#3b82f6' : '#e5e7eb'}`,
                            background: form.alarm?.minutesBefore === min ? '#dbeafe' : '#fff',
                            color: form.alarm?.minutesBefore === min ? '#1d4ed8' : '#374151',
                            fontWeight: form.alarm?.minutesBefore === min ? 700 : 400,
                          }}>{min}분 전</button>
                      ))}
                    </div>
                    {!form.time && <div style={{ marginTop: '6px', fontSize: '11px', color: '#f97316' }}>⚠️ 수업 시작시간을 입력해야 알람이 작동합니다</div>}
                  </div>
                )}
              </div>

              <div style={{ height: '1px', background: '#dbeafe', margin: '4px 0 14px' }} />

              {/* 종료 알람 */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>🔴 수업 종료 알람</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: form.alarmEnd?.enabled ? '10px' : '0' }}>
                  {[{ value: false, label: '선택안함' }, { value: true, label: '알람 설정' }].map(opt => (
                    <button key={String(opt.value)} type="button"
                      onClick={() => set('alarmEnd', { ...(form.alarmEnd || {}), enabled: opt.value })}
                      style={{
                        padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                        fontFamily: 'Noto Sans KR, sans-serif', fontSize: '13px', transition: 'all .15s',
                        border: `1.5px solid ${form.alarmEnd?.enabled === opt.value ? '#7c3aed' : '#e5e7eb'}`,
                        background: form.alarmEnd?.enabled === opt.value ? '#7c3aed' : '#fff',
                        color: form.alarmEnd?.enabled === opt.value ? '#fff' : '#374151',
                        fontWeight: form.alarmEnd?.enabled === opt.value ? 700 : 400,
                      }}>{opt.label}</button>
                  ))}
                </div>
                {form.alarmEnd?.enabled && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>수업 종료 몇 분 전?</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[5, 10, 15, 20, 30, 60].map(min => (
                        <button key={min} type="button"
                          onClick={() => set('alarmEnd', { ...(form.alarmEnd || {}), minutesBefore: min })}
                          style={{
                            padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                            fontFamily: 'Noto Sans KR, sans-serif', fontSize: '13px', transition: 'all .15s',
                            border: `1.5px solid ${form.alarmEnd?.minutesBefore === min ? '#7c3aed' : '#e5e7eb'}`,
                            background: form.alarmEnd?.minutesBefore === min ? '#ede9fe' : '#fff',
                            color: form.alarmEnd?.minutesBefore === min ? '#6d28d9' : '#374151',
                            fontWeight: form.alarmEnd?.minutesBefore === min ? 700 : 400,
                          }}>{min}분 전</button>
                      ))}
                    </div>
                    {!form.timeEnd && <div style={{ marginTop: '6px', fontSize: '11px', color: '#f97316' }}>⚠️ 종료시간을 입력해야 알람이 작동합니다</div>}
                  </div>
                )}
              </div>
            </div>

            <Textarea label="수업 안내글 (선택)" value={form.description} onChange={v => set('description', v)} placeholder="수업 소개, 준비물, 유의사항 등" rows={3} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="📞 교무실 전화번호 (선택)" value={form.officePhone} onChange={v => set('officePhone', v)} placeholder="예: 031-123-4567" />
              <Input label="📍 학교 주소 (선택)" value={form.schoolAddress} onChange={v => set('schoolAddress', v)} placeholder="예: 경기도 군포시 ..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="☎️ 담당자 일반전화 (선택)" value={form.contactPhone} onChange={v => set('contactPhone', v)} placeholder="예: 031-123-4567" />
              <Input label="📱 담당자 핸드폰 (선택)" value={form.contactMobile} onChange={v => set('contactMobile', v)} placeholder="예: 010-1234-5678" />
            </div>
            <Input label="🏫 수업 장소 (선택)" value={form.classLocation} onChange={v => set('classLocation', v)} placeholder="예: 3층 컴퓨터실, 음악실 201호" />
          </div>
        )}

        {/* ── 홍보물 이미지 */}
        {tab === 'promo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, background: '#f9fafb', padding: '12px 14px', borderRadius: '8px' }}>
              A4 전단지 이미지를 최대 <strong>{MAX_PROMO_IMAGES}장</strong>까지 등록할 수 있습니다.<br />
              학부모 공유, 수업 홍보에 활용됩니다.
            </div>

            {/* 방과후 서류 안내 배너 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#c2410c' }}>📂 홍보물은 <strong>방과후 서류</strong> 메뉴에서 등록·관리할 수 있습니다.</span>
              {onNav && <button onClick={() => onNav('templates')} style={{ padding:'5px 12px', borderRadius:'7px', border:'none', background:'#f97316', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>바로가기 →</button>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#374151', flex:1 }}>🗂️ 방과후 서류에서 선택</span>
              {(() => {
                const _docs = DocumentsDB?.byCategory?.(user.id, 'promo') || []
                const _DAYS = ['월','화','수','목','금','토','일']
                const _classDays = form.days || []
                const _filtered = _classDays.length > 0
                  ? _docs.filter(doc => {
                      const dd = doc.days?.length ? doc.days : (_DAYS.includes(doc.title?.split(' ')[0]) ? [doc.title.split(' ')[0]] : [])
                      return dd.length === 0 || _classDays.some(d => dd.includes(d))
                    })
                  : _docs
                if (_docs.length === 0) return <span style={{ fontSize:'12px', color:'#9ca3af' }}>아직 등록된 서류가 없습니다</span>
                if (_filtered.length === 0) return <span style={{ fontSize:'12px', color:'#9ca3af' }}>이 수업 요일({_classDays.join('·')})에 해당하는 서류가 없습니다</span>
                return <button onClick={() => { setPromoSearch(''); setDocPickerTarget('promo') }}
                  style={{ padding:'6px 16px', borderRadius:'8px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  서류 선택 ({_filtered.length}개)
                </button>
              })()}
            </div>
            <div style={{ height:'1px', background:'#e5e7eb', margin:'4px 0 8px' }} />
            <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📤 직접 업로드</div>

            {/* 선택/업로드된 이미지 미리보기 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {(form.promotionImgs || []).map((img, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb', aspectRatio: '0.707' }}>
                  <img src={img} alt={`홍보물 ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removePromo(i)}
                    style={{ position: 'absolute', top: '8px', right: '8px', width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '11px', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '2px 7px', borderRadius: '5px' }}>{i+1}번째</div>
                </div>
              ))}
              {(form.promotionImgs || []).length < MAX_PROMO_IMAGES && (
                <button onClick={() => promoRef.current?.click()}
                  style={{ borderRadius: '10px', border: '2px dashed #e5e7eb', background: '#f9fafb', cursor: 'pointer', aspectRatio: '0.707', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <span style={{ fontSize: '28px' }}>+</span>
                  <span>이미지 추가<br /><span style={{ fontSize: '11px' }}>JPG, PNG, PDF</span></span>
                </button>
              )}
            </div>
            <input ref={promoRef} type="file" accept="image/*,.pdf" multiple onChange={handlePromoFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* ── 안내장 */}
        {tab === 'notice' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div style={{ fontSize:'13px', color:'#6b7280', lineHeight:1.7, background:'#f9fafb', padding:'12px 14px', borderRadius:'8px' }}>
              학교에서 받은 <strong>수업 안내장</strong>을 등록합니다.<br />
              지원 형식: <strong>JPG, PNG, PDF</strong> · 최대 {MAX_NOTICE_FILES}개
            </div>

            {/* 방과후 서류 안내 배너 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#1d4ed8' }}>📂 안내장은 <strong>방과후 서류</strong> 메뉴에서 등록·관리할 수 있습니다.</span>
              {onNav && <button onClick={() => onNav('templates')} style={{ padding:'5px 12px', borderRadius:'7px', border:'none', background:'#2563eb', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>바로가기 →</button>}
            </div>

            {/* ── 방과후 서류에서 선택 */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#374151', flex:1 }}>🗂️ 방과후 서류에서 선택</span>
              {(() => {
                const _docs = DocumentsDB?.byCategory?.(user.id, 'notice') || []
                const _DAYS = ['월','화','수','목','금','토','일']
                const _classDays = form.days || []
                const _filtered = _classDays.length > 0
                  ? _docs.filter(doc => {
                      const dd = doc.days?.length ? doc.days : (_DAYS.includes(doc.title?.split(' ')[0]) ? [doc.title.split(' ')[0]] : [])
                      return dd.length === 0 || _classDays.some(d => dd.includes(d))
                    })
                  : _docs
                if (_docs.length === 0) return <span style={{ fontSize:'12px', color:'#9ca3af' }}>아직 등록된 서류가 없습니다</span>
                if (_filtered.length === 0) return <span style={{ fontSize:'12px', color:'#9ca3af' }}>이 수업 요일({_classDays.join('·')})에 해당하는 서류가 없습니다</span>
                return <button onClick={() => { setNoticeSearch(''); setDocPickerTarget('notice') }}
                  style={{ padding:'6px 16px', borderRadius:'8px', border:'none', background:'#2563eb', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  서류 선택 ({_filtered.length}개)
                </button>
              })()}
            </div>
            <div style={{ height:'1px', background:'#e5e7eb', margin:'4px 0 8px' }} />
            <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📤 직접 업로드</div>

            {/* 등록된 안내장 목록 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {(form.noticeFiles || []).map((f, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb' }}>
                  <span style={{ fontSize:'24px' }}>{f.fileType === 'application/pdf' ? '📄' : '🖼'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:600, color:'#111827' }}>{f.name}</div>
                    <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>{f.docId ? '방과후 서류 연동' : f.fileType}</div>
                  </div>
                  <button onClick={() => setNoticePreview(f)}
                    style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>미리보기</button>
                  <button onClick={() => removeNotice(i)}
                    style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                </div>
              ))}
              {(form.noticeFiles || []).length < MAX_NOTICE_FILES && (
                <button onClick={() => noticeRef.current?.click()}
                  style={{ padding:'24px', borderRadius:'10px', border:'2px dashed #e5e7eb', background:'#f9fafb', cursor:'pointer', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', color:'#9ca3af' }}>
                  <div style={{ fontSize:'28px', marginBottom:'6px' }}>📎</div>
                  <div style={{ fontSize:'13px', fontWeight:600 }}>안내장 추가</div>
                  <div style={{ fontSize:'11px', marginTop:'3px' }}>JPG · PNG · PDF</div>
                </button>
              )}
            </div>
            <input ref={noticeRef} type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={handleNoticeFile} style={{ display:'none' }} />
          </div>
        )}

        {/* ── 출석부 양식 */}
        {tab === 'template' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, background: '#f9fafb', padding: '12px 14px', borderRadius: '8px' }}>
              이 수업에서 사용하는 <strong>출석부 양식</strong>을 등록합니다.<br />
              지원 형식: <strong>.hwp, .hwpx, .xlsx</strong> · 최대 {MAX_TEMPLATE_FILES}개<br />
              출석부 출력 시 AI가 자동으로 학생 정보를 삽입합니다.
            </div>

            {/* 방과후 서류 안내 배너 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#15803d' }}>📂 출석부는 <strong>방과후 서류</strong> 메뉴에서 등록·관리할 수 있습니다.</span>
              {onNav && <button onClick={() => onNav('templates')} style={{ padding:'5px 12px', borderRadius:'7px', border:'none', background:'#16a34a', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>바로가기 →</button>}
            </div>

            {/* ── 방과후 서류에서 선택 */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#374151', flex:1 }}>🗂️ 방과후 서류에서 선택</span>
              {(() => {
                const _docs = DocumentsDB?.byCategory?.(user.id, 'attendance') || []
                const _DAYS = ['월','화','수','목','금','토','일']
                const _classDays = form.days || []
                const _filtered = _classDays.length > 0
                  ? _docs.filter(doc => {
                      const dd = doc.days?.length ? doc.days : (_DAYS.includes(doc.title?.split(' ')[0]) ? [doc.title.split(' ')[0]] : [])
                      return dd.length === 0 || _classDays.some(d => dd.includes(d))
                    })
                  : _docs
                if (_docs.length === 0) return <span style={{ fontSize:'12px', color:'#9ca3af' }}>아직 등록된 서류가 없습니다</span>
                if (_filtered.length === 0) return <span style={{ fontSize:'12px', color:'#9ca3af' }}>이 수업 요일({_classDays.join('·')})에 해당하는 서류가 없습니다</span>
                return <button onClick={() => { setTemplateSearch(''); setDocPickerTarget('template') }}
                  style={{ padding:'6px 16px', borderRadius:'8px', border:'none', background:'#16a34a', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  서류 선택 ({_filtered.length}개)
                </button>
              })()}
            </div>
            <div style={{ height:'1px', background:'#e5e7eb', margin:'4px 0 8px' }} />
            <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📤 직접 업로드</div>

            {/* 등록된 파일 목록 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {(form.templateFiles || []).map((f, i) => (
                <div key={i} style={{ padding:'14px 16px', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ fontSize:'24px' }}>{f.fileType === 'hwp' ? '📝' : '📊'}</span>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:700, color:'#111827' }}>{f.name}</div>
                      <div style={{ fontSize:'12px', color:'#16a34a' }}>{f.docId ? '방과후 서류 연동' : `.${f.fileType} 양식`}</div>
                    </div>
                  </div>
                  <Btn size="sm" variant="outlineDanger" onClick={() => set('templateFiles', (form.templateFiles || []).filter((_, j) => j !== i))}>삭제</Btn>
                </div>
              ))}
              {(form.templateFiles || []).length < MAX_TEMPLATE_FILES && (
                <button onClick={() => templateRef.current?.click()}
                  style={{ padding:'28px', borderRadius:'12px', border:'2px dashed #e5e7eb', background:'#f9fafb', cursor:'pointer', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <div style={{ fontSize:'32px', marginBottom:'8px' }}>📄</div>
                  <div style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>파일 추가</div>
                  <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'4px' }}>.hwp / .hwpx / .xlsx · {(form.templateFiles||[]).length}/{MAX_TEMPLATE_FILES}</div>
                </button>
              )}
            </div>
            <input ref={templateRef} type="file" accept=".hwp,.hwpx,.xlsx,.xls" onChange={handleTemplateFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* ── 수업 달력 */}
        {tab === 'calendar' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <ClassCalendar cls={form} onUpdate={updated => setForm(updated)} />

            {/* 휴일 직접 추가 */}
            <div style={{ background:'#fafafa', borderRadius:'12px', border:'1px solid #e5e7eb', padding:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'12px' }}>📌 휴일 직접 추가 (개교기념일 등)</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
                <input type="date" value={newCancelDate} onChange={e => setNewCancelDate(e.target.value)}
                  style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}
                  min={form.startDate} max={form.endDate}
                />
                <select value={newCancelReason} onChange={e => setNewCancelReason(e.target.value)}
                  style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                  <option value="school_holiday">학교재량휴일</option>
                  <option value="new_year">신정 (1/1)</option>
                  <option value="seollal">설날</option>
                  <option value="independence_day">삼일절 (3/1)</option>
                  <option value="workers_day">근로자의날 (5/1)</option>
                  <option value="childrens_day">어린이날 (5/5)</option>
                  <option value="buddha">부처님오신날</option>
                  <option value="memorial_day">현충일 (6/6)</option>
                  <option value="constitution_day">제헌절 (7/17)</option>
                  <option value="liberation_day">광복절 (8/15)</option>
                  <option value="chuseok">추석</option>
                  <option value="national_foundation_day">개천절 (10/3)</option>
                  <option value="hangul_day">한글날 (10/9)</option>
                  <option value="christmas">성탄절 (12/25)</option>
                  <option value="childrens_day_alt">대체공휴일</option>
                  <option value="election_day">선거일</option>
                  <option value="teacher_absent">강사사정</option>
                  <option value="etc">기타</option>
                </select>
                <button
                  disabled={!newCancelDate}
                  onClick={() => {
                    if (!newCancelDate) return
                    const already = (form.cancelledDates||[]).some(c => c.date === newCancelDate)
                    if (already) { toastError('이미 추가된 날짜입니다.'); return }
                    setForm(f => ({ ...f, cancelledDates: [...(f.cancelledDates||[]), { date: newCancelDate, reason: newCancelReason, memo:'' }] }))
                    setNewCancelDate('')
                    setNewCancelReason('school_holiday')
                  }}
                  style={{ padding:'7px 14px', borderRadius:'8px', border:'none', background: newCancelDate ? '#374151' : '#e5e7eb',
                    color: newCancelDate ? '#fff' : '#9ca3af', fontSize:'13px', fontWeight:700, cursor: newCancelDate ? 'pointer' : 'default',
                    fontFamily:'Noto Sans KR, sans-serif' }}>추가</button>
              </div>
              {/* 추가된 휴일 목록 */}
              {(form.cancelledDates||[]).length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {[...(form.cancelledDates||[])].map((c, origIdx) => ({ ...c, origIdx }))
                    .sort((a,b) => a.date.localeCompare(b.date))
                    .map((c) => {
                    const REASON_MAP = { public_holiday:'공휴일', school_holiday:'학교재량휴일', teacher_absent:'강사사정', vacation:'방학 휴강', new_year:'신정', seollal:'설날', independence_day:'삼일절', workers_day:'근로자의날', childrens_day:'어린이날', buddha:'부처님오신날', memorial_day:'현충일', constitution_day:'제헌절', liberation_day:'광복절', chuseok:'추석', national_foundation_day:'개천절', hangul_day:'한글날', christmas:'성탄절', childrens_day_alt:'대체공휴일', election_day:'선거일', etc:'기타' }
                    return (
                    <div key={c.origIdx} style={{ borderRadius:'8px', border:'1px solid #f3f4f6', overflow:'hidden' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'#fff' }}>
                        <span style={{ fontSize:'13px', fontWeight:600, color:'#374151', minWidth:'48px' }}>{c.date.slice(5)}</span>
                        <span style={{ fontSize:'12px', color:'#6b7280', flex:1 }}>{c.memo || REASON_MAP[c.reason] || c.reason}</span>
                        <button
                          onClick={() => { setEditCancelIdx(c.origIdx); setEditCancelMemo(c.memo || REASON_MAP[c.reason] || '') }}
                          style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'14px', padding:'0 4px' }}
                          title="수정">✏️</button>
                        <button onClick={() => setForm(f => ({ ...f, cancelledDates: (f.cancelledDates||[]).filter((_,j) => j !== c.origIdx) }))}
                          style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'16px', padding:'0 4px' }}>×</button>
                      </div>

                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <Btn onClick={save}>{editId === '__copy__' ? '복사 저장' : editId ? '저장' : '등록'}</Btn>
        </div>
      </Modal>

      {/* ── 휴일 수정 모달 */}
      <Modal open={editCancelIdx !== null} onClose={() => setEditCancelIdx(null)} title="휴일 사유 수정" width={360}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ fontSize:'13px', color:'#6b7280' }}>
            {editCancelIdx !== null && (form.cancelledDates||[])[editCancelIdx]?.date} 날짜의 사유를 수정합니다.
          </div>
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'6px' }}>사유</div>
            <input value={editCancelMemo} onChange={e => setEditCancelMemo(e.target.value)}
              placeholder="사유를 입력하세요"
              style={{ width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb',
                fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEditCancelIdx(null)}>취소</Btn>
            <Btn onClick={() => {
              setForm(f => ({ ...f, cancelledDates: (f.cancelledDates||[]).map((x,j) => j === editCancelIdx ? { ...x, memo: editCancelMemo, reason: 'etc' } : x) }))
              setEditCancelIdx(null)
            }}>저장</Btn>
          </div>
        </div>
      </Modal>

      {/* ── 방과후 서류 선택 모달 */}
      <Modal open={!!docPickerTarget} onClose={() => setDocPickerTarget(null)} title="방과후 서류에서 선택" width={560}>
        {docPickerTarget && (() => {
          const category = docPickerTarget === 'promo' ? 'promo' : docPickerTarget === 'notice' ? 'notice' : 'attendance'
          const allDocs = DocumentsDB?.byCategory?.(user.id, category) || []
          const classDays = form.days || []
          const VALID_DAYS = ['월','화','수','목','금','토','일']
          const showDocs = classDays.length > 0
            ? allDocs.filter(doc => {
                const docDays = doc.days?.length
                  ? doc.days
                  : (VALID_DAYS.includes(doc.title?.split(' ')[0]) ? [doc.title.split(' ')[0]] : [])
                return docDays.length === 0 || classDays.some(d => docDays.includes(d))
              })
            : allDocs
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {classDays.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'12px', color:'#374151', fontWeight:600 }}>현재 수업 요일:</span>
                  {classDays.map(day => (
                    <span key={day} style={{ padding:'3px 8px', borderRadius:'20px', background:'#eff6ff', border:'1.5px solid #3b82f6', fontSize:'12px', color:'#1d4ed8', fontWeight:700 }}>{day}요일</span>
                  ))}
                  <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'4px' }}>· 전체 {allDocs.length}개 중 {showDocs.length}개 표시</span>
                </div>
              )}
              {showDocs.length === 0 ? (
                <div style={{ padding:'32px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>해당 요일({classDays.join('·')})에 맞는 서류가 없습니다.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'360px', overflowY:'auto' }}>
                  {showDocs.map(doc => {
                    const isPromo    = docPickerTarget === 'promo'
                    const isNotice   = docPickerTarget === 'notice'
                    const isTemplate = docPickerTarget === 'template'
                    const selected = isPromo
                      ? (form.promotionImgs || []).includes(doc.fileData)
                      : isNotice
                        ? (form.noticeFiles || []).some(f => f.docId === doc.id)
                        : (form.templateFiles || []).some(f => f.docId === doc.id)
                    const isFull = isPromo
                      ? (form.promotionImgs || []).length >= MAX_PROMO_IMAGES
                      : isNotice
                        ? (form.noticeFiles || []).length >= MAX_NOTICE_FILES
                        : (form.templateFiles || []).length >= MAX_TEMPLATE_FILES
                    const accentColor = isPromo ? '#f97316' : isNotice ? '#3b82f6' : '#16a34a'
                    const bgColor     = isPromo ? '#fff7ed' : isNotice ? '#eff6ff' : '#f0fdf4'
                    return (
                      <div key={doc.id} style={{
                        display:'flex', alignItems:'center', gap:'12px',
                        padding:'10px 14px', borderRadius:'10px',
                        border:`1.5px solid ${selected ? accentColor : '#e5e7eb'}`,
                        background: selected ? bgColor : '#fafafa',
                        cursor: (!selected && isFull) ? 'not-allowed' : 'pointer',
                        opacity: (!selected && isFull) ? 0.5 : 1, transition:'all .15s',
                      }} onClick={() => {
                        if (selected) {
                          if (isPromo)    set('promotionImgs', (form.promotionImgs||[]).filter(u => u !== doc.fileData))
                          if (isNotice)   set('noticeFiles',   (form.noticeFiles||[]).filter(f => f.docId !== doc.id))
                          if (isTemplate) set('templateFiles', (form.templateFiles||[]).filter(f => f.docId !== doc.id))
                        } else {
                          if (isFull) return
                          if (isPromo)    set('promotionImgs', [...(form.promotionImgs||[]), doc.fileData])
                          if (isNotice)   set('noticeFiles',   [...(form.noticeFiles||[]),   { docId: doc.id, url: doc.fileData, name: doc.title || doc.fileName, fileType: doc.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg' }])
                          if (isTemplate) set('templateFiles', [...(form.templateFiles||[]), { docId: doc.id, name: doc.title || doc.fileName, fileType: doc.fileType, url: doc.fileData }])
                        }
                      }}>
                        <span style={{ fontSize:'22px', flexShrink:0 }}>
                          {doc.fileType === 'pdf' ? '📄' : doc.fileType === 'image' ? '🖼' : doc.fileType === 'hwp' ? '📝' : doc.fileType === 'excel' ? '📊' : '📎'}
                        </span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'13px', fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.title}</div>
                          <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>
                            {doc.fileName}
                            {doc.days?.length ? ` · ${doc.days.join('·')}요일` : ''}
                            {doc.organization ? ` · ${doc.organization}` : ''}
                          </div>
                        </div>
                        <div style={{ width:'22px', height:'22px', borderRadius:'50%', flexShrink:0, border:`2px solid ${selected ? accentColor : '#d1d5db'}`, background: selected ? accentColor : '#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {selected && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'8px', borderTop:'1px solid #e5e7eb' }}>
                <Btn onClick={() => setDocPickerTarget(null)}>확인</Btn>
              </div>
            </div>
          )
        })()}
      </Modal>


      {/* 삭제 확인 */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="수업 삭제" width={380}>
        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>정말 이 수업을 삭제하시겠습니까?</p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>아래 데이터가 함께 삭제됩니다.</p>
        <ul style={{ fontSize: '13px', color: '#374151', marginBottom: '12px', paddingLeft: '18px', lineHeight: '1.8' }}>
          <li>출결 기록</li>
          <li>수납 기록</li>
          <li>교구 진도 기록</li>
          <li>학부모 연결 정보</li>
          <li>학생 수업 배정 해제</li>
        </ul>
        <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '20px' }}>삭제 후 복구할 수 없습니다.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setDeleteId(null)}>취소</Btn>
          <Btn variant="danger" onClick={del}>삭제</Btn>
        </div>
      </Modal>

      {/* 안내장 미리보기 모달 */}
      <Modal open={!!noticePreview} onClose={() => setNoticePreview(null)} title={noticePreview?.name || ''} width={800}>
        {noticePreview && (
          <>
            <div style={{ textAlign:'right', marginBottom:'10px' }}>
              <a href={noticePreview.url} download={noticePreview.name} target="_blank" rel="noopener noreferrer"
                style={{ padding:'6px 14px', borderRadius:'8px', background:'#f0fdf4', border:'1.5px solid #86efac', color:'#16a34a', fontSize:'12px', fontWeight:700, textDecoration:'none' }}>⬇ 다운로드</a>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb', borderRadius:'8px', padding:'16px', minHeight:'300px' }}>
              {noticePreview.fileType === 'application/pdf' ? (
                <iframe src={noticePreview.url} title={noticePreview.name} style={{ width:'100%', height:'600px', border:'none', borderRadius:'8px' }} />
              ) : (
                <img src={noticePreview.url} alt={noticePreview.name} style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:'8px', objectFit:'contain' }} />
              )}
            </div>
          </>
        )}
      </Modal>

      {/* 업로딩 오버레이 */}
      {uploading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'24px 36px', fontSize:'14px', fontWeight:600 }}>📤 업로드 중...</div>
        </div>
      )}
    </div>
  )
}
