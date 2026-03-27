import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB } from '../lib/db.js'
import { uid, now, calcSessionDates, today } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Textarea, DayPicker, Tag, EmptyState, PageHeader } from '../components/Atoms.jsx'
import { ClassCalendar } from '../components/ClassCalendar.jsx'
import { TERM_TYPES, DAYS } from '../constants/config.js'

const VIEW_TABS = ['요일별', '학교별', '수업명별']
const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

function emptyForm() {
  return {
    organization: '', className: '', section: '',
    termType: 'semester', days: [], time: '',
    startDate: '', endDate: '', description: '', promotionImg: null,
    cancelledDates: [],
  }
}

export function Classes({ user }) {
  const [view, setView] = useState('요일별')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [tab, setTab] = useState('info') // 'info' | 'calendar'
  const [deleteId, setDeleteId] = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const classes = ClassesDB.byTeacher(user.id)

  const openAdd = () => {
    setForm(emptyForm())
    setEditId(null)
    setTab('info')
    setShowModal(true)
  }

  const openEdit = (cls) => {
    setForm({ ...cls })
    setEditId(cls.id)
    setTab('info')
    setShowModal(true)
  }

  const save = () => {
    if (!form.organization.trim() || !form.className.trim() || !form.days.length || !form.startDate || !form.endDate) {
      alert('필수 항목을 입력하세요.')
      return
    }
    if (editId) {
      ClassesDB.update(editId, { ...form })
    } else {
      ClassesDB.insert({ id: uid(), teacherId: user.id, ...form, createdAt: now() })
    }
    setShowModal(false)
  }

  const del = () => {
    ClassesDB.delete(deleteId)
    setDeleteId(null)
  }

  // 뷰별 그룹핑
  const grouped = {}
  classes.forEach(cls => {
    let key
    if (view === '요일별') {
      key = cls.days?.join(', ') || '미설정'
    } else if (view === '학교별') {
      key = cls.organization || '미설정'
    } else {
      key = cls.className || '미설정'
    }
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(cls)
  })

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (view === '요일별') {
      const ai = DAY_ORDER.indexOf(a.split(', ')[0])
      const bi = DAY_ORDER.indexOf(b.split(', ')[0])
      return ai - bi
    }
    return a.localeCompare(b)
  })

  const t = today()

  return (
    <div style={{ padding: '28px', maxWidth: '1100px' }}>
      <PageHeader
        title="수업 관리"
        sub="수업을 등록하고 일정을 관리합니다."
        right={<Btn onClick={openAdd}>+ 수업 등록</Btn>}
      />

      {/* 뷰 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {VIEW_TABS.map(t => (
          <button key={t} onClick={() => setView(t)} style={{
            padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: view === t ? '#f97316' : '#f3f4f6',
            color: view === t ? '#fff' : '#374151',
            fontWeight: view === t ? 600 : 400,
            fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
          }}>{t}</button>
        ))}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon="📚" title="등록된 수업이 없습니다" desc="수업을 등록하여 출석 관리를 시작하세요." />
      ) : (
        sortedKeys.map(group => (
          <div key={group} style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {view === '요일별' ? `${group} 수업` : group}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {grouped[group].map(cls => {
                const sessions = calcSessionDates(cls)
                const upcoming = sessions.find(d => d >= t)
                const studentCount = StudentsDB.confirmed(cls.id).length
                const totalSessions = sessions.length
                const done = sessions.filter(d => d < t).length

                return (
                  <Card key={cls.id} onClick={() => openEdit(cls)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{cls.className}</div>
                        {cls.section && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{cls.section}반</div>}
                      </div>
                      <Tag color="#f97316" bg="#fff7ed">{cls.days?.join(', ')}</Tag>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>{cls.organization}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
                      <span>📅 {cls.startDate?.slice(5)} ~ {cls.endDate?.slice(5)}</span>
                      {cls.time && <span>🕐 {cls.time}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Tag color="#3b82f6" bg="#eff6ff">학생 {studentCount}명</Tag>
                      <Tag color="#16a34a" bg="#f0fdf4">총 {totalSessions}차시</Tag>
                      {upcoming && <Tag color="#f59e0b" bg="#fffbeb">다음: {upcoming.slice(5)}</Tag>}
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(cls)}>편집</Btn>
                      <Btn size="sm" variant="outlineDanger" onClick={() => setDeleteId(cls.id)}>삭제</Btn>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* 수업 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '수업 편집' : '수업 등록'} width={620}>
        {/* 탭 */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
          {['info', 'calendar'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', background: 'none',
              color: tab === t ? '#f97316' : '#9ca3af',
              fontWeight: tab === t ? 700 : 400,
              fontSize: '14px',
              borderBottom: tab === t ? '2px solid #f97316' : '2px solid transparent',
              fontFamily: 'Noto Sans KR, sans-serif',
            }}>{t === 'info' ? '기본 정보' : '수업 달력'}</button>
          ))}
        </div>

        {tab === 'info' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="단체명(학교명)" value={form.organization} onChange={v => set('organization', v)} placeholder="판교초등학교" required />
              <Input label="수업명" value={form.className} onChange={v => set('className', v)} placeholder="바이올린" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="반 (선택)" value={form.section} onChange={v => set('section', v)} placeholder="A" />
              <Input label="수업 시간 (선택)" value={form.time} onChange={v => set('time', v)} placeholder="14:00" />
            </div>
            <Select label="수업 운영 방식" value={form.termType} onChange={v => set('termType', v)} options={TERM_TYPES} required />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>수업 요일 <span style={{ color: '#ef4444' }}>*</span></div>
              <DayPicker value={form.days} onChange={v => set('days', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="수업 시작일" value={form.startDate} onChange={v => set('startDate', v)} type="date" required />
              <Input label="수업 종료일" value={form.endDate} onChange={v => set('endDate', v)} type="date" required />
            </div>
            <Textarea label="수업 안내글 (선택)" value={form.description} onChange={v => set('description', v)} placeholder="수업 소개, 준비물, 유의사항 등" rows={3} />
          </div>
        ) : (
          <ClassCalendar cls={form} onUpdate={updated => setForm(updated)} />
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
          <Btn onClick={save}>{editId ? '저장' : '등록'}</Btn>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="수업 삭제" width={380}>
        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '20px' }}>정말 삭제하시겠습니까? 관련 출석 데이터도 영향을 받을 수 있습니다.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setDeleteId(null)}>취소</Btn>
          <Btn variant="danger" onClick={del}>삭제</Btn>
        </div>
      </Modal>
    </div>
  )
}
