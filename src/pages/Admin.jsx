import React, { useState } from 'react'
import { Users } from '../lib/db.js'
import { now } from '../lib/utils.js'
import { Btn, Card, PageHeader, Tag, Modal, Toggle, StatCard } from '../components/Atoms.jsx'
import { LEVEL_NAMES, FEATURES, LEVEL_PERMISSIONS } from '../constants/permissions.js'
import { Classes, Students, Attendance } from '../lib/db.js'

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

// ─── 지사 관리 패널
function BranchPanel({ branches, setBranches, teachers }) {
  const [form, setForm] = useState({ name: '', managerId: '', memo: '' })
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316' }
  const selSt = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', background:'#fff' }
  const inSt  = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }

  const managers = teachers.filter(t => t.level >= 4)

  const save = () => {
    if (!form.name.trim()) { alert('지사명을 입력하세요.'); return }
    if (editId) {
      Branches.update(editId, { name:form.name.trim(), managerId:form.managerId||null, memo:form.memo })
    } else {
      Branches.insert({ id:uid(), name:form.name.trim(), managerId:form.managerId||null, memo:form.memo, active:true, createdAt:now() })
    }
    setBranches(Branches.all())
    setForm({ name:'', managerId:'', memo:'' }); setEditId(null); setShowForm(false)
  }

  const startEdit = (b) => {
    setForm({ name:b.name, managerId:b.managerId||'', memo:b.memo||'' })
    setEditId(b.id); setShowForm(true)
  }

  const del = (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    Branches.delete(id); setBranches(Branches.all())
  }

  // 선생님 수 계산 (지사에 배정된)
  const teacherCount = (branchId) => teachers.filter(t => t.branchId === branchId).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {/* 상단 안내 */}
      <div style={{ padding:'14px 18px', background:'#eff6ff', borderRadius:'12px', border:'1.5px solid #bfdbfe', fontSize:'13px', color:'#1e40af', lineHeight:1.8 }}>
        <strong>지사 구조:</strong> 본사 → 지사(지역관리자) → 선생님 → 학생/학부모<br />
        선생님은 선생님 목록에서 지사를 <strong>수동으로 배정</strong>합니다.<br />
        지사장은 등급을 <strong>Lv.4 파트너</strong>로 설정한 선생님 중에서 지정합니다.
      </div>

      {/* 추가 버튼 */}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', region:'', managerId:'', memo:'' }) }}
          style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 지사 추가
        </button>
      </div>

      {/* 지사 등록/수정 폼 */}
      {showForm && (
        <div style={{ padding:'18px', background:'#fff', borderRadius:'12px', border:`1.5px solid ${C.primary}`, display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{editId ? '지사 수정' : '지사 추가'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>지사명 *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="예: 경기남부지사" style={inSt} />
            </div>

          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>지사장 (Lv.4 이상 선생님)</label>
            <select value={form.managerId} onChange={e => set('managerId', e.target.value)} style={selSt}>
              <option value="">-- 미지정 --</option>
              {managers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
            </select>
            {managers.length === 0 && <div style={{ fontSize:'11px', color:'#f59e0b', marginTop:'4px' }}>⚠️ Lv.4 이상 선생님이 없습니다. 선생님 목록에서 등급을 올려주세요.</div>}
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

      {/* 지사 목록 */}
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
  const [branches, setBranches] = useState(() => Branches.all()) // 'pending' | 'teachers' | 'stats'
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPermModal, setShowPermModal] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)

  const teachers = Users.teachers()
  const pending = Users.pending()

  const approve = (id) => {
    Users.update(id, { level: 2, verified: true })
  }
  const reject = (id) => {
    Users.update(id, { verifyImg: null })
  }

  const openPerm = (u) => {
    setSelectedUser({ ...u })
    setShowPermModal(true)
  }

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

  const savePerms = () => {
    Users.update(selectedUser.id, {
      level: selectedUser.level,
      permissionOverrides: selectedUser.permissionOverrides,
    })
    setShowPermModal(false)
  }

  // 전체 통계
  const stats = {
    totalTeachers: teachers.length,
    verified: teachers.filter(t => t.level >= 2).length,
    pending: pending.length,
    totalClasses: Classes.all().length,
    totalStudents: Students.all().filter(s => s.status === 'confirmed').length,
    todayAttendance: Attendance.all().filter(a => a.date === new Date().toISOString().slice(0, 10)).length,
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1100px' }}>
      <PageHeader title="관리자" sub="서비스 전체를 관리합니다." />

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {[
          { key: 'pending', label: `인증 대기 ${pending.length}` },
          { key: 'teachers', label: '선생님 목록' },
          { key: 'branches', label: '지사 관리' },
          { key: 'stats', label: '전체 통계' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 18px', border: 'none', cursor: 'pointer', background: 'none',
            color: tab === t.key ? '#f97316' : '#9ca3af',
            fontWeight: tab === t.key ? 700 : 400,
            fontSize: '14px',
            borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent',
            fontFamily: 'Noto Sans KR, sans-serif',
            marginBottom: '-1px',
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
                {['이름', '이메일', '연락처', '등급', '가입일', '권한 관리'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const levelColors = { 1: '#9ca3af', 2: '#f97316', 3: '#16a34a', 4: '#8b5cf6', 5: '#ef4444' }
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', fontSize: '14px' }}>{t.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{t.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{t.phone}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Tag color={levelColors[t.level]} bg={`${levelColors[t.level]}18`}>{LEVEL_NAMES[t.level] || 'Lv.' + t.level}</Tag>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af' }}>{t.createdAt?.slice(0, 10)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Btn size="sm" variant="ghost" onClick={() => openPerm(t)}>권한 설정</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 전체 통계 */}

      {/* 지사 관리 */}
      {tab === 'branches' && (
        <BranchPanel branches={branches} setBranches={setBranches} teachers={teachers} />
      )}

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard label="전체 선생님" value={stats.totalTeachers} icon="👩‍🏫" color="#3b82f6" />
          <StatCard label="인증 완료" value={stats.verified} icon="✅" color="#16a34a" />
          <StatCard label="인증 대기" value={stats.pending} icon="⏳" color="#f59e0b" />
          <StatCard label="전체 수업" value={stats.totalClasses} icon="📚" color="#f97316" />
          <StatCard label="확정 학생" value={stats.totalStudents} icon="👥" color="#8b5cf6" />
          <StatCard label="오늘 출석 처리" value={stats.todayAttendance} icon="📋" color="#ef4444" />
        </div>
      )}

      {/* 이미지 라이트박스 */}
      {lightboxImg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="수업안내장" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
        </div>
      )}

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
                const effective = hasOverride ? override : base

                let indicatorColor = '#9ca3af' // 기본값
                if (hasOverride && override === true) indicatorColor = '#16a34a'
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
