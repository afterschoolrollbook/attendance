import React, { useState, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Templates as TemplatesDB } from '../lib/db.js'
import { uid, now, calcSessionDates, today } from '../lib/utils.js'
import { Btn, Card, Modal, Input, Select, Textarea, DayPicker, Tag, EmptyState, PageHeader } from '../components/Atoms.jsx'
import { ClassCalendar } from '../components/ClassCalendar.jsx'
import { TERM_TYPES } from '../constants/config.js'

const VIEW_TABS = ['요일별', '학교별', '과목별']
const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']
const MAX_PROMO_IMAGES = 2

function emptyForm() {
  return {
    organization: '', className: '', section: '',
    termType: 'semester', days: [], time: '',
    startDate: '', endDate: '', description: '',
    promotionImgs: [],   // 최대 2장 base64[]
    templateFile: null,  // { name, type, data(base64) }
    cancelledDates: [],
  }
}

// 이미지 base64 변환
async function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export function Classes({ user }) {
  const [view, setView] = useState('요일별')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [tab, setTab] = useState('info') // 'info' | 'promo' | 'template' | 'calendar'
  const [deleteId, setDeleteId] = useState(null)
  const promoRef = useRef()
  const templateRef = useRef()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const classes = ClassesDB.byTeacher(user.id)
  const t = today()

  const openAdd = () => { setForm(emptyForm()); setEditId(null); setTab('info'); setShowModal(true) }
  const openEdit = (cls) => { setForm({ ...cls, promotionImgs: cls.promotionImgs || [], templateFile: cls.templateFile || null }); setEditId(cls.id); setTab('info'); setShowModal(true) }

  const save = () => {
    if (!form.organization.trim() || !form.className.trim() || !form.days.length || !form.startDate || !form.endDate) {
      alert('필수 항목을 입력하세요 (단체명, 수업명, 요일, 기간).')
      return
    }
    if (editId) {
      ClassesDB.update(editId, { ...form })
    } else {
      ClassesDB.insert({ id: uid(), teacherId: user.id, ...form, createdAt: now() })
    }
    setShowModal(false)
  }

  const del = () => { ClassesDB.delete(deleteId); setDeleteId(null) }

  // 홍보물 이미지 추가
  const handlePromoFile = async (e) => {
    const files = Array.from(e.target.files)
    const current = form.promotionImgs || []
    const remaining = MAX_PROMO_IMAGES - current.length
    if (remaining <= 0) { alert('최대 2장까지 등록 가능합니다.'); return }
    const toAdd = files.slice(0, remaining)
    const bases = await Promise.all(toAdd.map(toBase64))
    set('promotionImgs', [...current, ...bases])
    e.target.value = ''
  }

  const removePromo = (idx) => {
    set('promotionImgs', form.promotionImgs.filter((_, i) => i !== idx))
  }

  // 출석부 양식 파일
  const handleTemplateFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    const fileType = (ext === 'hwp' || ext === 'hwpx') ? 'hwp' : 'xlsx'
    const data = await toBase64(file)
    set('templateFile', { name: file.name, fileType, data })
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
                const upcoming = sessions.find(d => d >= t)
                const studentCount = StudentsDB.confirmed(cls.id).length
                const hasPromo = cls.promotionImgs?.length > 0
                const hasTpl = !!cls.templateFile

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
                      {cls.time && ` · 🕐 ${cls.time}`}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <Tag color="#3b82f6" bg="#eff6ff">학생 {studentCount}명</Tag>
                      <Tag color="#16a34a" bg="#f0fdf4">총 {sessions.length}차시</Tag>
                      {upcoming && <Tag color="#f59e0b" bg="#fffbeb">다음 {upcoming.slice(5)}</Tag>}
                      {hasTpl && <Tag color="#8b5cf6" bg="#f5f3ff">양식 ✓</Tag>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
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

      {/* ─── 수업 등록/편집 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '수업 편집' : '수업 등록'} width={660}>
        {/* 서브탭 */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
          {[
            { key: 'info',     label: '기본 정보' },
            { key: 'promo',    label: `홍보물 ${form.promotionImgs?.length ? `(${form.promotionImgs.length})` : ''}` },
            { key: 'template', label: `출석부 양식 ${form.templateFile ? '✓' : ''}` },
            { key: 'calendar', label: '수업 달력' },
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
              <Input label="단체명(학교명)" value={form.organization} onChange={v => set('organization', v)} placeholder="판교초등학교" required />
              <Input label="수업명(과목)" value={form.className} onChange={v => set('className', v)} placeholder="로봇과학" required />
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
        )}

        {/* ── 홍보물 이미지 */}
        {tab === 'promo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, background: '#f9fafb', padding: '12px 14px', borderRadius: '8px' }}>
              A4 전단지 이미지를 최대 <strong>2장</strong>까지 등록할 수 있습니다.<br />
              학부모 공유, 수업 홍보에 활용됩니다.
            </div>

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

        {/* ── 출석부 양식 */}
        {tab === 'template' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, background: '#f9fafb', padding: '12px 14px', borderRadius: '8px' }}>
              이 수업에서 사용하는 <strong>출석부 양식</strong>을 등록합니다.<br />
              지원 형식: <strong>.hwp, .hwpx, .xlsx</strong><br />
              출석부 출력 시 AI가 자동으로 학생 정보를 삽입합니다.
            </div>

            {form.templateFile ? (
              <div style={{ padding: '16px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '28px' }}>{form.templateFile.fileType === 'hwp' ? '📝' : '📊'}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{form.templateFile.name}</div>
                    <div style={{ fontSize: '12px', color: '#16a34a' }}>.{form.templateFile.fileType} 양식 등록됨</div>
                  </div>
                </div>
                <Btn size="sm" variant="outlineDanger" onClick={() => set('templateFile', null)}>삭제</Btn>
              </div>
            ) : (
              <button onClick={() => templateRef.current?.click()}
                style={{ padding: '36px', borderRadius: '12px', border: '2px dashed #e5e7eb', background: '#f9fafb', cursor: 'pointer', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📄</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>파일 선택</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>.hwp / .hwpx / .xlsx 지원</div>
              </button>
            )}
            <input ref={templateRef} type="file" accept=".hwp,.hwpx,.xlsx,.xls" onChange={handleTemplateFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* ── 수업 달력 */}
        {tab === 'calendar' && (
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
