import { db, Users, Classes, Students, Attendance, AdSlots } from './db.js'
import { uid, today } from './utils.js'
import { AD_SLOTS } from '../constants/config.js'

export function seedIfEmpty() {
  if (db.get('users').length > 0) return // 이미 시드됨

  // 관리자
  const admin = {
    id: 'admin1',
    name: '관리자',
    email: 'admin@test.com',
    pw: 'admin1234',
    phone: '010-0000-0000',
    role: 'admin',
    level: 5,
    verified: true,
    verifyImg: null,
    permissionOverrides: {},
    createdAt: new Date().toISOString(),
  }

  // 선생님 (인증완료)
  const teacher = {
    id: 'teacher1',
    name: '김선생',
    email: 'teacher@test.com',
    pw: '1234',
    phone: '010-1234-5678',
    role: 'teacher',
    level: 2,
    verified: true,
    verifyImg: null,
    permissionOverrides: {},
    createdAt: new Date().toISOString(),
  }

  // 미인증 선생님
  const teacher2 = {
    id: 'teacher2',
    name: '이선생',
    email: 'teacher2@test.com',
    pw: '1234',
    phone: '010-9876-5432',
    role: 'teacher',
    level: 1,
    verified: false,
    verifyImg: null,
    permissionOverrides: {},
    createdAt: new Date().toISOString(),
  }

  db.set('users', [admin, teacher, teacher2])

  // 수업 등록
  const cls1 = {
    id: 'class1',
    teacherId: 'teacher1',
    organization: '판교초등학교',
    className: '바이올린',
    section: 'A',
    termType: 'semester',
    days: ['화', '목'],
    time: '14:00',
    startDate: '2026-03-04',
    endDate: '2026-06-30',
    cancelledDates: [
      { date: '2026-05-05', reason: 'public_holiday', memo: '어린이날' },
    ],
    description: '초등학생 바이올린 기초 수업입니다.',
    promotionImg: null,
    createdAt: new Date().toISOString(),
  }

  const cls2 = {
    id: 'class2',
    teacherId: 'teacher1',
    organization: '판교초등학교',
    className: '미술',
    section: 'B',
    termType: 'quarter',
    days: ['수'],
    time: '15:00',
    startDate: '2026-03-04',
    endDate: '2026-05-31',
    cancelledDates: [],
    description: '미술 창의력 수업',
    promotionImg: null,
    createdAt: new Date().toISOString(),
  }

  db.set('classes', [cls1, cls2])

  // 학생 등록
  const studentData = [
    { name: '홍길동', grade: '3학년', classNum: '2', number: '5', parentPhone: '010-1111-2222' },
    { name: '이영희', grade: '4학년', classNum: '1', number: '12', parentPhone: '010-3333-4444' },
    { name: '박철수', grade: '3학년', classNum: '3', number: '8', parentPhone: '010-5555-6666' },
    { name: '김민지', grade: '5학년', classNum: '2', number: '3', parentPhone: '010-7777-8888' },
    { name: '정수현', grade: '4학년', classNum: '1', number: '15', parentPhone: '010-9999-0000' },
  ]

  const students = studentData.map((s, i) => ({
    id: `student${i + 1}`,
    teacherId: 'teacher1',
    school: '판교초등학교',
    grade: s.grade,
    classNum: s.classNum,
    number: s.number,
    name: s.name,
    parentPhone: s.parentPhone,
    studentPhone: '',
    classIds: ['class1'],
    status: i < 4 ? 'confirmed' : 'applied',
    statusHistory: [{ status: i < 4 ? 'confirmed' : 'applied', changedAt: new Date().toISOString(), memo: '' }],
    createdAt: new Date().toISOString(),
  }))

  db.set('students', students)

  // 출석 데이터 (오늘 날짜)
  const t = today()
  const attRecords = [
    { id: uid(), classId: 'class1', studentId: 'student1', date: t, session: 1, status: 'present', markedAt: new Date().toISOString() },
    { id: uid(), classId: 'class1', studentId: 'student2', date: t, session: 1, status: 'absent', markedAt: new Date().toISOString() },
    { id: uid(), classId: 'class1', studentId: 'student3', date: t, session: 1, status: 'present', markedAt: new Date().toISOString() },
  ]
  db.set('attendance', attRecords)

  // 광고 슬롯 초기화
  const adSlots = AD_SLOTS.map(s => ({ ...s, active: false, code: '' }))
  db.set('adSlots', adSlots)

  console.log('✅ 시드 데이터 생성 완료')
}
