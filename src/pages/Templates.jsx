import React, { useState, useRef } from 'react'
import { Templates as TemplatesDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, Card, Input, Modal, PageHeader, Tag, EmptyState, Toggle } from '../components/Atoms.jsx'

export function Templates({ user }) {
  const [templates, setTemplates] = useState(() => TemplatesDB.all().filter(t => t.teacherId === user.id || user.role === 'admin'))
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ school: '', templateName: '', fileType: 'xlsx' })
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  const reload = () => setTemplates(TemplatesDB.all().filter(t => t.teacherId === user.id || user.role === 'admin'))

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    const fileType = ext === 'hwp' || ext === 'hwpx' ? 'hwp' : 'xlsx'
    setForm(p => ({ ...p, fileType }))
    setFile(f)
  }

  const save = async () => {
    if (!form.school.trim() || !form.templateName.trim()) {
      alert('학교명과 양식 이름을 입력하세요.')
      return
    }
    let fileData = ''
    if (file) {
      fileData = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.readAsDataURL(file)
      })
    }
    TemplatesDB.insert({
      id: uid(),
      teacherId: user.id,
      school: form.school.trim(),
      templateName: form.templateName.trim(),
      fileType: form.fileType,
      fileData,
      fieldMap: {},
      active: true,
      createdAt: now(),
    })
    reload()
    setShowModal(false)
    setFile(null)
    setForm({ school: '', templateName: '', fileType: 'xlsx' })
  }

  const toggleActive = (id, v) => {
    TemplatesDB.update(id, { active: v })
    reload()
  }

  const del = (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    TemplatesDB.delete(id)
    reload()
  }

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <PageHeader
        title="출석부 양식 관리"
        sub="학교별 출석부 양식을 등록하고 관리합니다."
        right={<Btn onClick={() => setShowModal(true)}>+ 양식 등록</Btn>}
      />

      <div style={{ marginBottom: '20px', padding: '14px 18px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '10px', fontSize: '13px', color: '#1e40af', lineHeight: 1.7 }}>
        📌 학교별로 사용하는 출석부 양식(.hwp, .xlsx)을 등록하면, 출석부 출력 시 AI가 자동으로 학생 정보와 수업 일정을 삽입합니다.
      </div>

      {templates.length === 0 ? (
        <EmptyState icon="📄" title="등록된 양식이 없습니다" desc="출석부 양식을 등록하여 자동 출력 기능을 사용하세요." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {templates.map(t => (
            <Card key={t.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{t.templateName}</div>
                    <Tag color={t.fileType === 'hwp' ? '#8b5cf6' : '#16a34a'} bg={t.fileType === 'hwp' ? '#f5f3ff' : '#f0fdf4'}>
                      .{t.fileType}
                    </Tag>
                    {!t.active && <Tag color="#9ca3af" bg="#f3f4f6">비활성</Tag>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    🏫 {t.school} &nbsp;·&nbsp; 등록일 {t.createdAt?.slice(0, 10)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <Toggle checked={t.active} onChange={v => toggleActive(t.id, v)} />
                    <span style={{ fontSize: '11px', color: t.active ? '#16a34a' : '#9ca3af' }}>{t.active ? '활성' : '비활성'}</span>
                  </div>
                  <Btn size="sm" variant="outlineDanger" onClick={() => del(t.id)}>삭제</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="출석부 양식 등록" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="학교명" value={form.school} onChange={v => set('school', v)} placeholder="판교초등학교" required />
          <Input label="양식 이름" value={form.templateName} onChange={v => set('templateName', v)} placeholder="2026년 판교초 방과후 출석부" required />

          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>양식 파일 업로드</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Btn variant="ghost" onClick={() => fileRef.current?.click()}>파일 선택</Btn>
              {file && <span style={{ fontSize: '13px', color: '#374151' }}>{file.name}</span>}
              {!file && <span style={{ fontSize: '13px', color: '#9ca3af' }}>지원 형식: .hwp, .hwpx, .xlsx</span>}
            </div>
            <input ref={fileRef} type="file" accept=".hwp,.hwpx,.xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn onClick={save}>등록</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
