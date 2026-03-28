// DB 레이어 — localStorage 기반. 추후 API 교체 시 이 파일만 수정.

const PREFIX = 'asa_'

function key(table) { return PREFIX + table }

export const db = {
  get(table) {
    try { return JSON.parse(localStorage.getItem(key(table)) || '[]') }
    catch { return [] }
  },
  set(table, data) {
    localStorage.setItem(key(table), JSON.stringify(data))
  },
  getOne(table, id) {
    return db.get(table).find(r => r.id === id) || null
  },
  insert(table, record) {
    const rows = db.get(table)
    rows.push(record)
    db.set(table, rows)
    return record
  },
  update(table, id, patch) {
    const rows = db.get(table).map(r => r.id === id ? { ...r, ...patch } : r)
    db.set(table, rows)
    return rows.find(r => r.id === id)
  },
  delete(table, id) {
    db.set(table, db.get(table).filter(r => r.id !== id))
  },
  where(table, predicate) {
    return db.get(table).filter(predicate)
  },
  clear(table) {
    localStorage.removeItem(key(table))
  },
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  },
}

// 각 테이블별 헬퍼
export const Users = {
  all: () => db.get('users'),
  find: (id) => db.getOne('users', id),
  findByEmail: (email) => db.get('users').find(u => u.email === email),
  insert: (u) => db.insert('users', u),
  update: (id, patch) => db.update('users', id, patch),
  teachers: () => db.get('users').filter(u => u.role === 'teacher'),
  pending: () => db.get('users').filter(u => u.role === 'teacher' && u.level === 1 && u.verifyImg),
}

export const Classes = {
  all: () => db.get('classes'),
  find: (id) => db.getOne('classes', id),
  byTeacher: (tid) => db.where('classes', c => c.teacherId === tid),
  insert: (c) => db.insert('classes', c),
  update: (id, patch) => db.update('classes', id, patch),
  delete: (id) => db.delete('classes', id),
}

export const Students = {
  all: () => db.get('students'),
  find: (id) => db.getOne('students', id),
  byTeacher: (tid) => db.where('students', s => s.teacherId === tid),
  byClass: (cid) => db.where('students', s => s.classIds?.includes(cid)),
  confirmed: (cid) => db.where('students', s => s.classIds?.includes(cid) && s.status === 'confirmed'),
  insert: (s) => db.insert('students', s),
  update: (id, patch) => db.update('students', id, patch),
  delete: (id) => db.delete('students', id),
}

export const Attendance = {
  all: () => db.get('attendance'),
  byClass: (cid) => db.where('attendance', a => a.classId === cid),
  byClassDate: (cid, date) => db.where('attendance', a => a.classId === cid && a.date === date),
  byStudentClass: (sid, cid) => db.where('attendance', a => a.studentId === sid && a.classId === cid),
  find: (cid, sid, date) => db.get('attendance').find(a => a.classId === cid && a.studentId === sid && a.date === date),
  upsert: (record) => {
    const existing = Attendance.find(record.classId, record.studentId, record.date)
    if (existing) return db.update('attendance', existing.id, record)
    return db.insert('attendance', record)
  },
  delete: (id) => db.delete('attendance', id),
}

export const AdSlots = {
  all: () => db.get('adSlots'),
  find: (id) => db.getOne('adSlots', id),
  update: (id, patch) => db.update('adSlots', id, patch),
  insert: (s) => db.insert('adSlots', s),
}

export const Templates = {
  all: () => db.get('attendanceTemplates'),
  find: (id) => db.getOne('attendanceTemplates', id),
  bySchool: (school) => db.where('attendanceTemplates', t => t.school === school && t.active),
  insert: (t) => db.insert('attendanceTemplates', t),
  update: (id, patch) => db.update('attendanceTemplates', id, patch),
  delete: (id) => db.delete('attendanceTemplates', id),
}

export const Notes = {
  all: () => db.get('notes'),
  byTeacherDate: (tid, date) => db.where('notes', n => n.teacherId === tid && n.date === date),
  insert: (n) => db.insert('notes', n),
  update: (id, patch) => db.update('notes', id, patch),
  delete: (id) => db.delete('notes', id),
}

export const Settings = {
  get: (key) => {
    try { return JSON.parse(localStorage.getItem('asa_settings_' + key)) }
    catch { return null }
  },
  set: (key, value) => {
    localStorage.setItem('asa_settings_' + key, JSON.stringify(value))
  },
  getAll: () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('asa_settings_'))
    const result = {}
    keys.forEach(k => {
      try { result[k.replace('asa_settings_', '')] = JSON.parse(localStorage.getItem(k)) }
      catch {}
    })
    return result
  },
}
