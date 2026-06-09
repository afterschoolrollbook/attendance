# 방과후 출석부

> 방과후 강사를 위한 출결·학생·수업 관리 플랫폼

- **GitHub**: [afterschoolrollbook/attendance](https://github.com/afterschoolrollbook/attendance)
- **Supabase 프로젝트**: afterschool-attendance

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| 오프라인 캐시 | IndexedDB (`asa_cache`) |
| 알림 | Resend (이메일) + Solapi (SMS/알림톡) |
| 소셜 로그인 | Google / 카카오 / 네이버 |
| 배포 | Vercel |

---

## 화면 목록

### 공개 화면

| 경로 | 화면 | 파일 |
|------|------|------|
| `/` | 랜딩 페이지 | `LandingPage.jsx` |
| `/auth` | 로그인 / 회원가입 | `Auth.jsx` |
| `/legal` | 이용약관 / 개인정보처리방침 | `LegalPage.jsx` |
| — | 카카오 OAuth 콜백 | `KakaoCallback.jsx` |
| — | 네이버 OAuth 콜백 | `NaverCallback.jsx` |

### 강사 메뉴 (로그인 필요)

| 메뉴 | 파일 |
|------|------|
| 🏠 대시보드 | `Dashboard.jsx` |
| ✅ 출석부 | `Attendance.jsx` |
| 📚 수업등록 및 관리 | `Classes.jsx` + `ClassCalendar.jsx` |
| 👥 학생등록 및 관리 | `Students.jsx` |
| 🎲 인원확정 및 추첨 | `StudentConfirm.jsx` |
| 📊 출석 리포트 | `Reports.jsx` |
| 🗂️ 방과후 서류 | `Templates.jsx` |
| 🖨️ 출석부 출력 | `PrintSetup.jsx` |
| 📲 출결 서비스 관리 | `ParentInvite.jsx` + `ParentServiceManage.jsx` |
| 🎒 교구준비 및 관리 | `Supplies.jsx` |
| 💬 안내 문구 관리 | `MessageGuide.jsx` |
| 👤 내 정보 | `Profile.jsx` |
| 💰 수익관리 | `Revenue.jsx` |
| 🎓 연수관리 | `Training.jsx` |
| 🏆 자격증관리 | `Certificates.jsx` |
| 📋 학력 및 이력관리 | `Career.jsx` |
| 🏅 수상경력 | `Awards.jsx` |
| 📝 제안서·자기소개서 | `Proposals.jsx` |
| 📢 공고관리 | `Jobs.jsx` |

### 관리자 전용 (level 10)

| 메뉴 | 파일 |
|------|------|
| ⚙️ 관리자 | `Admin.jsx` |
| 🔧 서비스 설정 | `AdminSettings.jsx` |
| 📢 광고 관리 | `Adsense.jsx` |
| 📝 블로그 관리 | `BlogAdmin.jsx` |

### 포털

| 포털 | 파일 |
|------|------|
| 학부모 로그인 | `ParentLogin.jsx` |
| 학교 담당자 | `SchoolAuth.jsx` + `SchoolAdminApp.jsx` + `SchoolAdminManage.jsx` |
| 업체 | `VendorAuth.jsx` + `VendorApp.jsx` + `VendorManage.jsx` |

---

## 개발 시작

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

---

## 환경 변수

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_여기에입력
SUPABASE_SERVICE_ROLE_KEY=sb_secret_여기에입력
```

Supabase Dashboard → **Settings → API Keys** 에서 확인.

> ⚠️ `.env` 파일은 GitHub에 올리지 마세요. (`.gitignore` 포함)

---

## 백엔드 설정

전체 설정은 [BACKEND_SETUP.md](./BACKEND_SETUP.md) 참고.

배포되는 Edge Functions:

| Function | 역할 |
|----------|------|
| `db-api` | 통합 DB CRUD |
| `send-email` | 이메일 발송 (Resend) |
| `send-sms` | SMS/알림톡 발송 (Solapi) |
| `naver-oauth` | 네이버 로그인 |

---

## 데이터 동작 방식

앱 시작 시 두 단계로 초기화됩니다.

```
1) loadCacheFromIDB()  — IndexedDB에서 즉시 로드 → 화면 빠르게 표시
2) initFromSupabase()  — Supabase에서 변경분 로드 → 캐시에 머지
   - 최초 접속: 전체 로드
   - 재접속:    마지막 동기화(asa_last_sync_at) 이후 변경된 것만 증분 로드

쓰기 (insert / update / delete)
  → 인메모리 캐시 즉시 반영 + IndexedDB 즉시 기록
  → Supabase에 동기식 저장 (실패 시 최대 3회 재시도)
  → 삭제는 _deleted: true 소프트딜리트
  → 모든 레코드에 updated_at 자동 기록
```

---

## 권한 구조

레벨 1~10으로 관리하며, 관리자(level 10)가 Settings에서 메뉴별 최소레벨을 변경할 수 있습니다.

| 레벨 | 기본 이름 | 비고 |
|------|----------|------|
| 1 | 미인증 선생님 | |
| 2 | 인증 선생님 | |
| 3~9 | 레벨3~9 | 관리자가 이름 변경 가능 |
| 10 | 관리자 | 모든 기능 접근 |

---

## 디자인 시스템

### 색상

| 용도 | 색상 |
|------|------|
| Primary | `#f97316` |
| Primary Hover | `#ea6c0a` |
| Success | `#16a34a` |
| Danger | `#ef4444` |
| Warning | `#f59e0b` |
| Info | `#3b82f6` |
| Sidebar BG | `#18181b` |
| Page BG | `#f4f5f7` |

### 출석 상태

| key | 라벨 | 색상 | 이모지 |
|-----|------|------|--------|
| `pending` | 미처리 | `#9ca3af` | — |
| `present` | 출석 | `#16a34a` | ✅ |
| `absent` | 결석 | `#ef4444` | ❌ |
| `late` | 지각 | `#f59e0b` | 🕐 |
| `early` | 조퇴 | `#8b5cf6` | 🔜 |

### 학생 상태

| key | 라벨 |
|-----|------|
| `applied` | 신청 |
| `waiting` | 대기 |
| `selected` | 추첨완료 |
| `confirmed` | 최종확정 |
| `cancelled` | 취소 |
| `transfer_out` | 전학 |
| `transfer_in` | 전입 |
| `extra_applied` | 추가신청 |

---

## 프로젝트 구조

```
src/
├── components/
│   ├── Atoms.jsx           # 공통 UI (Modal, Toast, ConfirmDialog 등)
│   ├── Sidebar.jsx         # 사이드바 내비게이션
│   ├── SaveStatusBar.jsx   # 저장 상태 바
│   └── AdSlot.jsx          # 광고 슬롯
├── constants/
│   ├── config.js           # 상수 (상태값, 색상, 요일 등)
│   └── permissions.js      # 레벨별 권한 정의
├── hooks/
│   ├── useToast.js
│   └── useConfirm.js
├── lib/
│   ├── db.js               # DB 레이어 (인메모리 캐시 + IndexedDB + Supabase)
│   ├── supabase.js         # Supabase 클라이언트
│   ├── crypto.js
│   ├── utils.js
│   └── webpush.js
└── pages/                  # 페이지 컴포넌트 40개
```

---

## 개발 규칙

| # | 규칙 |
|---|------|
| 1 | `alert()` / `confirm()` 사용 금지 → `toastError()` / `success()` / `useConfirm()` 사용 |
| 2 | 삭제 버튼은 텍스트 `삭제` 표기 (`×`는 모달 닫기 전용) |
| 3 | 날짜 정렬 오름차순 기본 (`a.localeCompare(b)`) |
| 4 | 학생 정렬: 학년 → 반 → 번호 → 이름, 숫자 필드는 `parseInt` 비교 |
| 5 | 물리 삭제 금지 — `_deleted: true` 소프트딜리트만 사용 |
| 6 | `.env` / API 키 GitHub 업로드 금지 |
| 7 | 모바일 + PC 반응형 필수 |
| 8 | 파일 1개 수정 → 빌드 확인 → 이상 없으면 다음 파일 |

---

*방과후 출석부 — 현장 강사가 실제로 쓰는 출결 관리 플랫폼*
