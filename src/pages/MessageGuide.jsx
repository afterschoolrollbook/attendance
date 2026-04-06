import React, { useState } from 'react'
import { PageHeader, Card, Modal, Btn, EmptyState } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { MessageGuides, MessageCategories, TeacherProfiles } from '../lib/db.js'

const DEFAULT_CATEGORIES = ['출석', '결석', '지각', '하교', '출결서비스', '개강전', '개강', '수업신청감사', '추첨', '종강']

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

const DEFAULT_GUIDES = [
  { category:'출석', title:'출석 안내 (기본)', content:'안녕하세요 😊 {학교명} {선생님닉네임}입니다. {학생이름} 친구가 오늘 수업에 출석했습니다! 수업 잘 마치고 안전하게 귀가할 수 있도록 하겠습니다 🙏' },
  { category:'출석', title:'출석 안내 (간단)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생 {날짜} 수업 출석 확인되었습니다 ✅' },
  { category:'하교', title:'하교 안내 (기본)', content:'안녕하세요 😊 {학교명} {선생님닉네임}입니다. {학생이름} 친구가 오늘 수업을 마치고 지금 하교합니다 🏠 안전한 귀가 부탁드립니다!' },
  { category:'하교', title:'하교 안내 (간단)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생 {날짜} 수업 종료 후 하교했습니다 🚶' },
  { category:'결석', title:'결석 안내 (기본)', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 😊 {학생이름} 친구가 오늘 수업에 아직 도착하지 않아 연락드립니다. 혹시 결석 예정이신가요? 확인 부탁드립니다. 감사합니다 🙏' },
  { category:'결석', title:'결석 안내 (간단)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생이 {날짜} 수업에 결석 처리되었습니다. 문의사항은 언제든지 연락주세요.' },
  { category:'지각', title:'지각 안내 (기본)', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 😊 {학생이름} 친구가 오늘 수업에 늦게 도착했습니다. 수업은 잘 참여하고 있으니 안심하세요 😄' },
  { category:'지각', title:'지각 안내 (확인 요청)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생이 {날짜} 수업에 지각하였습니다. 다음에는 정시에 올 수 있도록 부탁드립니다. 감사합니다 🙏' },
  { category:'개강전', title:'개강 전 안내 (기본)', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 😊 곧 새 학기 수업이 시작됩니다! 첫 수업 날짜와 준비물을 안내해드릴게요. 기대해주세요 🎉' },
  { category:'개강전', title:'개강 전 안내 (준비물)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생의 {수업명} 수업이 곧 시작됩니다. 준비물: (직접 입력) 첫 수업일: (직접 입력) 궁금한 점은 언제든지 연락주세요 😊' },
  { category:'개강', title:'개강 알림 (기본)', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 🎉 오늘 {날짜}부터 수업이 시작됩니다! {학생이름} 친구와 즐겁고 알찬 시간 보내겠습니다. 잘 부탁드립니다 😄' },
  { category:'개강', title:'개강 알림 (환영)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {수업명} 수업 개강을 진심으로 환영합니다! 🎊 {학생이름} 학생이 즐겁게 배울 수 있도록 최선을 다하겠습니다. 감사합니다 🙏' },
  { category:'수업신청감사', title:'신청 감사 (기본)', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 😊 {학생이름} 학생의 수업 신청 감사드립니다 🙏 수업 관련 안내는 추후 별도로 연락드리겠습니다. 기대해주세요!' },
  { category:'수업신청감사', title:'신청 감사 (확정 안내)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생의 {수업명} 수업 신청이 완료되었습니다. 수업 시작 전 안내사항은 별도로 연락드리겠습니다. 신청해주셔서 감사합니다 😄' },
  { category:'추첨', title:'추첨 당첨 알림', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 🎉 {학생이름} 학생이 {날짜} 추첨 결과 최종 선발되었습니다! 🎊 수업 관련 안내는 추후 연락드리겠습니다. 감사합니다 🙏' },
  { category:'추첨', title:'추첨 대기 알림', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {학생이름} 학생께서 {날짜} 추첨에서 대기자로 등록되셨습니다. 결원 발생 시 순서대로 연락드리겠습니다. 감사합니다 🙏' },
  { category:'종강', title:'종강 안내 (기본)', content:'안녕하세요, {학교명} {수업명} {선생님닉네임}입니다 😊 {날짜}을 끝으로 이번 학기 수업이 종강되었습니다. {학생이름} 친구와 함께한 소중한 시간이었습니다. 수고 많으셨습니다! 🎉' },
  { category:'종강', title:'종강 안내 (감사 인사)', content:'안녕하세요 {학교명} {선생님닉네임}입니다. {수업명} 수업이 {날짜}부로 종강되었습니다. 한 학기 동안 {학생이름} 학생이 성실하게 참여해주어 감사합니다 🙏 다음 학기에도 함께하길 바랍니다 😄' },
  { category:'출결서비스', title:'출결서비스 초대 안내', content:'안녕하세요 😊 {학교명} {선생님닉네임}입니다. {학생이름} 학생의 출결 현황을 실시간으로 확인하실 수 있는 출결서비스에 초대드립니다! 아래 링크를 클릭하시면 간편하게 가입하실 수 있습니다. {출결서비스링크} 출결 알림을 받아보시고 언제든 수업 현황을 확인해보세요 🙏' },
]

function seedDefaults(userId) {
  const mine = MessageGuides.byTeacher(userId)

  // 1) category+title 기준으로 중복 제거 (더 오래된 것 삭제)
  const seen = new Map()
  mine.forEach(item => {
    const k = `${item.category}__${item.title}`
    const prev = seen.get(k)
    if (!prev || new Date(item.createdAt) >= new Date(prev.createdAt)) {
      if (prev) MessageGuides.delete(prev.id)
      seen.set(k, item)
    } else {
      MessageGuides.delete(item.id)
    }
  })

  // 2) 없는 기본 문구만 추가
  DEFAULT_GUIDES
    .filter(g => !seen.has(`${g.category}__${g.title}`))
    .forEach(g => MessageGuides.insert({ id: uid(), teacherId: userId, ...g, createdAt: new Date().toISOString() }))
}

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }

export function MessageGuide({ user }) {
  const [tab, setTab] = useState('결석')

  const [items, setItems] = useState(() => {
    seedDefaults(user.id)
    return MessageGuides.byTeacher(user.id)
  })

  const [customCats, setCustomCats] = useState(() => MessageCategories.byTeacher(user.id))
  const categories = [...DEFAULT_CATEGORIES, ...customCats.map(c => c.name)]

  // 선생님 프로필
  const [profile, setProfile] = useState(() => TeacherProfiles.byTeacher(user.id) || {})
  const [profileForm, setProfileForm] = useState(() => {
    const p = TeacherProfiles.byTeacher(user.id) || {}
    return { name: p.name || '', nickname: p.nickname || '' }
  })

  // 문구 추가/편집 모달
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ category:'', title:'', content:'' })

  // 카테고리 관리 모달
  const [catModal, setCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const { success, error } = useToast()

  const filtered = items.filter(i => i.category === tab)

  // ── 문구 ──────────────────────────────────────────────────────
  const openAdd = () => {
    setEditId(null)
    setForm({ category: tab, title:'', content:'' })
    setModal(true)
  }
  const openEdit = (item) => {
    setEditId(item.id)
    setForm({ category: item.category, title: item.title, content: item.content })
    setModal(true)
  }
  const saveItem = () => {
    if (!form.category.trim() || !form.content.trim()) return
    if (editId) {
      MessageGuides.update(editId, form)
      success('수정이 완료되었습니다.')
    } else {
      MessageGuides.insert({ id: uid(), teacherId: user.id, category: form.category, title: form.title, content: form.content, createdAt: new Date().toISOString() })
      setTab(form.category)
      success('등록이 완료되었습니다.')
    }
    setItems(MessageGuides.byTeacher(user.id))
    setModal(false)
  }
  const deleteItem = (id) => {
    MessageGuides.delete(id)
    setItems(MessageGuides.byTeacher(user.id))
    success('삭제가 완료되었습니다.')
  }
  const copyText = (content) => {
    navigator.clipboard.writeText(content).then(() => success('클립보드에 복사되었습니다.'))
  }

  // ── 카테고리 ──────────────────────────────────────────────────
  const openCatModal = () => {
    setNewCatName('')
    setCatModal(true)
  }
  const addCategory = () => {
    const name = newCatName.trim()
    if (!name) return
    if (categories.includes(name)) { error('이미 존재하는 카테고리입니다.'); return }
    MessageCategories.insert({ id: uid(), teacherId: user.id, name, createdAt: new Date().toISOString() })
    setCustomCats(MessageCategories.byTeacher(user.id))
    setNewCatName('')
    success('카테고리가 추가되었습니다.')
  }
  const deleteCategory = (catName) => {
    if (DEFAULT_CATEGORIES.includes(catName)) return
    const catRecord = customCats.find(c => c.name === catName)
    if (catRecord) MessageCategories.delete(catRecord.id)
    items.filter(i => i.category === catName).forEach(i => MessageGuides.delete(i.id))
    setCustomCats(MessageCategories.byTeacher(user.id))
    setItems(MessageGuides.byTeacher(user.id))
    if (tab === catName) setTab(DEFAULT_CATEGORIES[0])
    success('카테고리가 삭제되었습니다.')
  }

  // ── 선생님 프로필 ─────────────────────────────────────────────
  const saveTeacherProfile = () => {
    TeacherProfiles.save(user.id, profileForm.name, profileForm.nickname)
    setProfile(p => ({ ...p, ...profileForm }))
    success('저장이 완료되었습니다.')
  }

  const fStyle = { width:'100%', padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', color:C.text, boxSizing:'border-box' }

  return (
    <div style={{ padding:'28px', maxWidth:'860px' }}>
      <PageHeader title="안내 문구 관리" sub="문자나 카카오 발송 시 사용할 문구를 카테고리별로 관리합니다." />

      {/* 선생님 정보 설정 */}
      <Card style={{ padding:'20px', marginBottom:'24px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'14px' }}>👤 선생님 정보 설정</div>
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>선생님 이름</label>
            <input value={profileForm.name || ''} onChange={e => setProfileForm(p => ({...p, name: e.target.value}))}
              placeholder="예: 홍길동" style={fStyle} />
          </div>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>선생님 닉네임</label>
            <input value={profileForm.nickname || ''} onChange={e => setProfileForm(p => ({...p, nickname: e.target.value}))}
              placeholder="예: 푸우쌤" style={fStyle} />
          </div>
          <button onClick={saveTeacherProfile}
            style={{ padding:'9px 22px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', flexShrink:0, height:'38px' }}>
            저장
          </button>
        </div>
        {(profile.name || profile.nickname) && (
          <div style={{ marginTop:'10px', fontSize:'12px', color:C.muted }}>
            현재 저장됨 — 이름: <strong style={{ color:C.text }}>{profile.name || '미설정'}</strong> / 닉네임: <strong style={{ color:C.text }}>{profile.nickname || '미설정'}</strong>
          </div>
        )}
      </Card>

      {/* 카테고리 탭 + 버튼 영역 */}
      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'24px', flexWrap:'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setTab(cat)}
            style={{ padding:'9px 18px', borderRadius:'20px', border:`2px solid ${tab===cat ? C.primary : C.border}`, background: tab===cat ? '#fff7ed' : '#fff', color: tab===cat ? C.primary : C.muted, fontSize:'14px', fontWeight: tab===cat ? 700 : 400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
            {cat}
          </button>
        ))}
        <button onClick={openCatModal} title="카테고리 관리"
          style={{ padding:'9px 14px', borderRadius:'20px', border:`2px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'18px', lineHeight:1, cursor:'pointer', transition:'all .15s', flexShrink:0 }}>
          ⚙️
        </button>
        <button onClick={openAdd}
          style={{ padding:'9px 18px', borderRadius:'20px', border:`2px solid ${C.primary}`, background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', marginLeft:'auto', flexShrink:0 }}>
          + 문구 추가
        </button>
      </div>

      {/* 문구 목록 */}
      {filtered.length === 0 ? (
        <EmptyState icon="💬" title="등록된 문구가 없습니다" desc={`${tab} 카테고리에 문구를 추가해보세요.`} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {filtered.map(item => (
            <Card key={item.id} style={{ padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  {item.title && (
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.primary, marginBottom:'8px' }}>{item.title}</div>
                  )}
                  <div style={{ fontSize:'14px', color:C.text, lineHeight:1.8, whiteSpace:'pre-wrap', background:'#f9fafb', padding:'14px 16px', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                    {item.content}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => copyText(item.content)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    📋 복사
                  </button>
                  <button onClick={() => openEdit(item)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    편집
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    삭제
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── 문구 추가/편집 모달 ── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? '문구 편집' : '문구 추가'} width={520}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>카테고리 *</label>
            <select value={form.category} onChange={e => setForm(p => ({...p, category:e.target.value}))}
              style={{ ...fStyle, background:'#fff', cursor:'pointer', appearance:'auto' }}>
              <option value="">카테고리를 선택하세요</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>제목 (선택)</label>
            <input value={form.title} onChange={e => setForm(p => ({...p, title:e.target.value}))}
              placeholder="예: 결석 안내 기본 문구" style={fStyle}/>
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>문구 내용 *</label>
            <textarea value={form.content} onChange={e => setForm(p => ({...p, content:e.target.value}))}
              placeholder={`예)\n안녕하세요~\n판교초 발명교실 푸우쌤 입니다.\n000 친구가 수업에 도착하지 않아 연락드리오니\n확인부탁드립니다.`}
              rows={8} style={{ ...fStyle, resize:'vertical', lineHeight:1.7 }}/>
          </div>
          <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px 14px', border:'1px solid #86efac' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#15803d', marginBottom:'8px' }}>🔖 자동 치환 태그 (출석부에서 발송 시 자동으로 바뀝니다)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {['{학생이름}','{학교명}','{수업명}','{선생님이름}','{선생님닉네임}','{날짜}','{출결서비스링크}'].map(tag => (
                <button key={tag} onClick={() => setForm(p => ({...p, content: p.content + tag}))}
                  style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid #86efac', background:'#fff', fontSize:'12px', fontWeight:600, color:'#15803d', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  {tag}
                </button>
              ))}
            </div>
            <div style={{ fontSize:'11px', color:'#6b7280', marginTop:'8px' }}>태그를 클릭하면 커서 위치에 삽입됩니다. 출석부 메시지 발송 시 실제 값으로 자동 변환됩니다.</div>
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'4px' }}>
            <button onClick={() => setModal(false)}
              style={{ padding:'10px 20px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
              취소
            </button>
            <button onClick={saveItem}
              style={{ padding:'10px 24px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 카테고리 관리 모달 ── */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="카테고리 관리" width={420}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'6px' }}>새 카테고리 추가</label>
            <div style={{ display:'flex', gap:'8px' }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="카테고리 이름 입력" style={{ ...fStyle, flex:1 }} />
              <button onClick={addCategory}
                style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', flexShrink:0 }}>
                추가
              </button>
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${C.border}` }} />
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'10px' }}>전체 카테고리</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'300px', overflowY:'auto' }}>
              {categories.map(cat => {
                const isDefault = DEFAULT_CATEGORIES.includes(cat)
                const count = items.filter(i => i.category === cat).length
                return (
                  <div key={cat} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fafafa' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'14px', color:C.text, fontWeight:500 }}>{cat}</span>
                      {isDefault && <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:'#f3f4f6', color:C.muted, fontWeight:600 }}>기본</span>}
                      <span style={{ fontSize:'12px', color:C.muted }}>{count}개</span>
                    </div>
                    {!isDefault ? (
                      <button onClick={() => deleteCategory(cat)}
                        style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                        삭제
                      </button>
                    ) : (
                      <span style={{ fontSize:'11px', color:'#d1d5db' }}>삭제 불가</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ background:'#fffbeb', borderRadius:'9px', padding:'10px 13px', border:'1px solid #fde68a', fontSize:'12px', color:'#92400e' }}>
            ⚠️ 커스텀 카테고리 삭제 시 해당 카테고리의 문구도 함께 삭제됩니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => setCatModal(false)}
              style={{ padding:'10px 24px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
              닫기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
