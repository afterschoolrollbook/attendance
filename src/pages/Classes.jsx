import React, { useState, useRef, useEffect } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Templates as TemplatesDB, DocumentsDB } from '../lib/db.js'
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
    { date:'2025-01-28', name:'설날 (1/28)' }, { date:'2025-01-29', name:'설날 (1/29)' }, { date:'2025-01-30', name:'설날 (1/30)' },
    { date:'2025-03-01', name:'삼일절 (3/1)' },
    { date:'2025-05-05', name:'어린이날 (5/5)' },
    { date:'2025-05-06', name:'어린이날 대체 (5/6)' },
    { date:'2025-05-13', name:'부처님오신날 (5/13)' },
    { date:'2025-06-06', name:'현충일 (6/6)' },
    { date:'2025-08-15', name:'광복절 (8/15)' },
    { date:'2025-10-03', name:'개천절 (10/3)' },
    { date:'2025-10-05', name:'추석 (10/5)' }, { date:'2025-10-06', name:'추석 (10/6)' }, { date:'2025-10-07', name:'추석 (10/7)' },
    { date:'2025-10-08', name:'추석 대체 (10/8)' },
    { date:'2025-10-09', name:'한글날 (10/9)' },
    { date:'2025-12-25', name:'성탄절 (12/25)' },
  ],
  2026: [
    { date:'2026-01-01', name:'신정 (1/1)' },
    { date:'2026-01-28', name:'설날 (1/28)' }, { date:'2026-01-29', name:'설날 (1/29)' }, { date:'2026-01-30', name:'설날 (1/30)' },
    { date:'2026-03-01', name:'삼일절 (3/1)' },
    { date:'2026-05-05', name:'어린이날 (5/5)' },
    { date:'2026-05-24', name:'부처님오신날 (5/24)' },
    { date:'2026-06-03', name:'지방선거일 (6/3)' },
    { date:'2026-06-06', name:'현충일 (6/6)' },
    { date:'2026-08-15', name:'광복절 (8/15)' },
    { date:'2026-09-24', name:'추석 (9/24)' }, { date:'2026-09-25', name:'추석 (9/25)' }, { date:'2026-09-26', name:'추석 (9/26)' },
    { date:'2026-10-03', name:'개천절 (10/3)' },
    { date:'2026-10-09', name:'한글날 (10/9)' },
    { date:'2026-12-25', name:'성탄절 (12/25)' },
  ],
  2027: [
    { date:'2027-01-01', name:'신정 (1/1)' },
    { date:'2027-02-16', name:'설날 (2/16)' }, { date:'2027-02-17', name:'설날 (2/17)' }, { date:'2027-02-18', name:'설날 (2/18)' },
    { date:'2027-03-01', name:'삼일절 (3/1)' },
    { date:'2027-05-05', name:'어린이날 (5/5)' },
    { date:'2027-05-13', name:'부처님오신날 (5/13)' },
    { date:'2027-06-06', name:'현충일 (6/6)' },
    { date:'2027-08-15', name:'광복절 (8/15)' },
    { date:'2027-09-14', name:'추석 (9/14)' }, { date:'2027-09-15', name:'추석 (9/15)' }, { date:'2027-09-16', name:'추석 (9/16)' },
    { date:'2027-10-03', name:'개천절 (10/3)' },
    { date:'2027-10-09', name:'한글날 (10/9)' },
    { date:'2027-12-25', name:'성탄절 (12/25)' },
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

function emptyForm() {
  return {
    organization: '', className: '', section: '',
    termType: 'semester', termCount: 4, termSizes: [4,4,4,4], days: [], repeatType: 'every', time: '', timeEnd: '', classDuration: '',
    startDate: '', endDate: '', description: '',
    officePhone: '', schoolAddress: '', classLocation: '',
    contactPhone: '', contactMobile: '',
    promotionImgs: [],   // Supabase Storage URL 배열
    noticeFiles: [],     // 안내장 파일 { url, name, fileType } 배열
    templateFiles: [],   // 출석부 양식 파일 배열 (최대 2)
    cancelledDates: [],
    makeupDates: [],
    specialPeriods: [],
    alarm:    { enabled: false, minutesBefore: 10 },
    alarmEnd: { enabled: false, minutesBefore: 10 },
  }
}

export function Classes({ user, onNav }) {
  const [view,    setView]    = useState('요일별')
  const [selYear, setSelYear] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [tab, setTab] = useState('info') // 'info' | 'promo' | 'notice' | 'template' | 'calendar'
  const [deleteId, setDeleteId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [noticePreview, setNoticePreview] = useState(null)
  const [promoSearch,    setPromoSearch]    = useState('')
  const [noticeSearch,   setNoticeSearch]   = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [docPickerTarget, setDocPickerTarget] = useState(null) // 'promo' | 'notice' | 'template'
  const promoRef = useRef()
  const noticeRef = useRef()
  const templateRef = useRef()

  const [alarmToast, setAlarmToast] = useState(null) // { className, minutesBefore, type: 'start'|'end' }
  const { success, error: toastError } = useToast()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
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
      termCount: cls.termCount || 4,
      termSizes: cls.termSizes?.length > 0 ? cls.termSizes : [4,4,4,4],
      contactPhone: cls.contactPhone || '',
      contactMobile: cls.contactMobile || '',
      classDuration: cls.classDuration || '',
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
      termCount: cls.termCount || 4,
      termSizes: cls.termSizes?.length > 0 ? cls.termSizes : [4,4,4,4],
      officePhone: cls.officePhone || '',
      schoolAddress: cls.schoolAddress || '',
      classLocation: cls.classLocation || '',
      contactPhone: cls.contactPhone || '',
      contactMobile: cls.contactMobile || '',
      classDuration: cls.classDuration || '',
    })
    setEditId(cls.id)
    setTab('info')
    setShowModal(true)
  }

  const save = () => {
    if (!form.organization.trim() || !form.className.trim() || !form.days.length || !form.startDate || !form.endDate) {
      toastError('필수 항목을 입력하세요 (단체명, 수업명, 요일, 기간).')
      return
    }
    const cleanForm = {
      ...form,
      classDuration: form.classDuration === '' ? null : Number(form.classDuration),
      termCount:     form.termCount === '' ? null : Number(form.termCount),
    }
    if (editId && editId !== '__copy__') {
      ClassesDB.update(editId, cleanForm)
      success('수정이 완료되었습니다.')
    } else {
      const { id: _oldId, ...formWithoutId } = cleanForm
      ClassesDB.insert({ ...formWithoutId, id: uid(), teacherId: user.id, createdAt: now() })
      success('등록이 완료되었습니다.')
    }
    setShowModal(false)
  }

  const del = () => { ClassesDB.delete(deleteId); setDeleteId(null) }

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
      <PageHeader
        title="수업 관리"
        sub="수업을 등록하고 일정을 관리합니다."
        right={<Btn onClick={openAdd}>+ 수업 등록</Btn>}
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
                        {cls.section && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{cls.section}반</div>}
                      </div>
                      <Tag color="#f97316" bg="#fff7ed">{cls.days?.join(', ')}</Tag>
                    </div>

                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>{cls.organization}</div>

                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
                      📅 {cls.startDate?.slice(5)} ~ {cls.endDate?.slice(5)}
                      {cls.time && ` · 🕐 ${cls.time}${cls.timeEnd ? ' ~ ' + cls.timeEnd : ''}`}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <Tag color="#3b82f6" bg="#eff6ff">학생 {studentCount}명</Tag>
                      <Tag color="#16a34a" bg="#f0fdf4">총 {displaySessions}차시</Tag>
                      {upcoming && <Tag color="#f59e0b" bg="#fffbeb">다음 {upcoming.slice(5)}</Tag>}
                      {hasTpl && <Tag color="#8b5cf6" bg="#f5f3ff">양식 ✓</Tag>}
                      {cls.alarm?.enabled && <Tag color="#3b82f6" bg="#eff6ff">🔔 시작 {cls.alarm.minutesBefore}분전</Tag>}
                      {cls.alarmEnd?.enabled && <Tag color="#7c3aed" bg="#ede9fe">🔕 종료 {cls.alarmEnd.minutesBefore}분전</Tag>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(cls)}>편집</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => openCopy(cls)} style={{ color:'#3b82f6', borderColor:'#93c5fd' }}>복사</Btn>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="반 (선택)" value={form.section} onChange={v => set('section', v)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:500, color:'#111827', display:'block', marginBottom:'6px' }}>수업 시작시간 (선택)</label>
                  <input type="time" value={form.time}
                    onChange={e => {
                      const v = e.target.value
                      set('time', v)
                      if (v && form.classDuration) {
                        const [h, m] = v.split(':').map(Number)
                        const total = h * 60 + m + parseInt(form.classDuration)
                        const eh = Math.floor(total / 60) % 24
                        const em = total % 60
                        set('timeEnd', `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`)
                      }
                    }}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:500, color:'#111827', display:'block', marginBottom:'6px' }}>수업시간(분)</label>
                  <input type="number" min="1" max="300" value={form.classDuration || ''}
                    placeholder="80"
                    onChange={e => {
                      const v = e.target.value
                      set('classDuration', v)
                      if (form.time && v) {
                        const [h, m] = form.time.split(':').map(Number)
                        const total = h * 60 + m + parseInt(v)
                        const eh = Math.floor(total / 60) % 24
                        const em = total % 60
                        set('timeEnd', `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`)
                      }
                    }}
                    style={{ width:'68px', padding:'7px 8px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', background:'#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:500, color:'#111827', display:'block', marginBottom:'6px' }}>종료시간</label>
                  <input type="time" value={form.timeEnd}
                    onChange={e => set('timeEnd', e.target.value)}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background: form.classDuration ? '#f0fdf4' : '#fff', boxSizing:'border-box' }} />
                </div>
              </div>
            </div>
            <Select label="수업 운영 방식" value={form.termType} onChange={v => set('termType', v)} options={TERM_TYPES} required />

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="수업 시작일" value={form.startDate} onChange={v => set('startDate', v)} type="date" required />
              <Input label="수업 종료일" value={form.endDate} onChange={v => set('endDate', v)} type="date" required />
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
            {/* 텀 구성 설정 — 달력과 연동 */}
            <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'12px', padding:'14px 16px' }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:'#ea580c', marginBottom:'12px' }}>📅 텀 구성 설정</div>

              {/* 총 수업횟수 입력 */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
                <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>총 수업횟수</label>
                <input type="number" min="1" max="200"
                  value={form.totalSessions || ''}
                  placeholder="예: 20"
                  onChange={e => {
                    const total = parseInt(e.target.value) || 0
                    set('totalSessions', total || null)
                  }}
                  style={{ width:'72px', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', background:'#fff' }} />
                {form.totalSessions > 0 && form.totalSessions !== (form.termSizes||[4,4,4,4]).slice(0,form.termCount||4).reduce((a,b)=>a+b,0) && (
                  <span style={{ fontSize:'12px', color:'#ef4444', fontWeight:600 }}>
                    {'\u26a0\ufe0f'} 텀 합산({(form.termSizes||[4,4,4,4]).slice(0,form.termCount||4).reduce((a,b)=>a+b,0)}차시)과 다릅니다. 확인해주세요.
                  </span>
                )}
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
                <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>총 텀 수</label>
                <div style={{ display:'flex', gap:'6px' }}>
                  {[1,2,3,4,5,6].map(n => (
                    <button key={n} type="button" onClick={() => {
                      const prev = form.termSizes || [4]
                      const next = Array.from({length:n}, (_,i) => prev[i] || 4)
                      set('termCount', n); set('termSizes', next)
                    }} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:700, background:(form.termCount||4)===n?'#f97316':'#f3f4f6', color:(form.termCount||4)===n?'#fff':'#374151', transition:'all .15s' }}>{n}</button>
                  ))}
                </div>
                <span style={{ fontSize:'12px', color:'#9ca3af' }}>텀</span>
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'flex-end' }}>
                {Array.from({length: form.termCount || 4}, (_, i) => {
                  const sizes = form.termSizes || [4,4,4,4]
                  const startSession = sizes.slice(0,i).reduce((a,b)=>a+b,0) + 1
                  const endSession   = sizes.slice(0,i+1).reduce((a,b)=>a+b,0)
                  return (
                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                      <label style={{ fontSize:'11px', color:'#ea580c', fontWeight:700 }}>{i+1}텀</label>
                      <input type="number" min="1" max="99"
                        value={sizes[i] || 4}
                        onChange={e => {
                          const next = [...sizes]
                          next[i] = parseInt(e.target.value) || 1
                          set('termSizes', next)
                        }}
                        style={{ width:'52px', padding:'7px 6px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', background:'#fff' }} />
                      <span style={{ fontSize:'10px', color:'#9ca3af' }}>{startSession}~{endSession}차시</span>
                    </div>
                  )
                })}
                <div style={{ fontSize:'12px', color:'#9ca3af', marginLeft:'4px', marginBottom:'18px' }}>
                  = 총 {(form.termSizes||[4,4,4,4]).slice(0,form.termCount||4).reduce((a,b)=>a+b,0)}차시
                </div>
              </div>
            </div>
            <ClassCalendar cls={form} onUpdate={updated => setForm(updated)} />

            {/* 휴일 직접 추가 */}
            <div style={{ background:'#fafafa', borderRadius:'12px', border:'1px solid #e5e7eb', padding:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'12px' }}>📌 휴일 직접 추가 (개교기념일 등)</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
                <input type="date"
                  style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}
                  min={form.startDate} max={form.endDate}
                  onChange={e => {
                    const date = e.target.value
                    if (!date) return
                    const already = (form.cancelledDates||[]).some(c => c.date === date)
                    if (already) { toastError('이미 추가된 날짜입니다.'); return }
                    setForm(f => ({ ...f, cancelledDates: [...(f.cancelledDates||[]), { date, reason:'school_holiday', memo:'' }] }))
                    e.target.value = ''
                  }}
                />
                <select
                  style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}
                  onChange={e => {
                    const date = e.target.value
                    if (!date) return
                    const already = (form.cancelledDates||[]).some(c => c.date === date)
                    if (!already) setForm(f => ({ ...f, cancelledDates: [...(f.cancelledDates||[]), { date, reason:'public_holiday', memo:'공휴일' }] }))
                    e.target.value = ''
                  }}
                  defaultValue="">
                  <option value="">공휴일 빠른 추가</option>
                  {(HOLIDAYS[parseInt(form.startDate?.slice(0,4))] || HOLIDAYS[2026]).map(h => (
                    <option key={h.date} value={h.date}>{h.name}</option>
                  ))}
                </select>
              </div>
              {/* 추가된 휴일 목록 */}
              {(form.cancelledDates||[]).length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {[...(form.cancelledDates||[])].sort((a,b) => a.date.localeCompare(b.date)).map((c, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'#fff', borderRadius:'8px', border:'1px solid #f3f4f6' }}>
                      <span style={{ fontSize:'13px', fontWeight:600, color:'#374151', minWidth:'80px' }}>{c.date.slice(5)}</span>
                      <span style={{ fontSize:'12px', color:'#6b7280', flex:1 }}>{c.memo || ({public_holiday:'공휴일', school_holiday:'학교재량휴일', teacher_absent:'강사사정', etc:'기타'}[c.reason] || c.reason)}</span>
                      <button onClick={() => setForm(f => ({ ...f, cancelledDates: (f.cancelledDates||[]).filter((_,j) => j !== i) }))}
                        style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'16px', padding:'0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
          <Btn onClick={save}>{editId === '__copy__' ? '복사 저장' : editId ? '저장' : '등록'}</Btn>
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
        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '20px' }}>정말 삭제하시겠습니까? 관련 출석 데이터도 영향을 받을 수 있습니다.</p>
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
