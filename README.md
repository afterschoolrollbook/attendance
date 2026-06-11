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
| 블로그 / 설명서 | `Blog.jsx` |

### 관리자 전용 (level 10)

| 메뉴 | 파일 |
|------|------|
| ⚙️ 관리자 | `Admin.jsx` |
| 🔧 서비스 설정 | `AdminSettings.jsx` |
| 📢 광고 관리 | `Adsense.jsx` |
| 📝 블로그 관리 | `BlogAdmin.jsx` |
| 🏢 업체 관리 | `VendorManage.jsx` |
| 🏫 학교 담당자 관리 | `SchoolAdminManage.jsx` |

### 포털

| 포털 | 파일 |
|------|------|
| 학부모 초대 | `ParentInvite.jsx` |
| 학부모 로그인 | `ParentLogin.jsx` |
| 학교 담당자 | `SchoolAuth.jsx` + `SchoolAdminApp.jsx` + `SchoolAdminManage.jsx` |
| 학교 공지 팝업 | `SchoolNoticePopup.jsx` |
| 납품 업체 | `VendorAuth.jsx` + `VendorApp.jsx` + `VendorManage.jsx` |

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
  → 실패 시 IndexedDB 대기열(asa_pending_ops)에 저장 → 30초마다 자동 재시도 / 온라인 복구 시 즉시 재시도
  → 앱 시작 시 로컬에만 있고 Supabase에 없는 students 레코드 자동 복구 (OrphanSync)
  → 삭제는 _deleted: true 소프트딜리트
  → 모든 레코드에 updated_at 자동 기록
```

### OrphanSync 대상 테이블
- `students` 만 대상 (classes는 수동 등록한 것만 DB에 있어야 하므로 제외)
- attendance는 원래부터 정상 저장되므로 제외

---

## 권한 구조

레벨 1~10으로 관리하며, 관리자(level 10)가 Settings에서 메뉴별 최소레벨을 변경할 수 있습니다.

| 레벨 | 기본 이름 | 비고 |
|------|----------|------|
| 1 | 미인증 선생님 | 가입 직후 기본값 |
| 2 | 인증 선생님 | 관리자 승인 후 부여 |
| 3~9 | 레벨3~9 | 관리자가 이름/권한 직접 설정 |
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
│   └── AdSlot.jsx          # 광고 슬롯 렌더러
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

## DB 테이블 구조

| 영역 | 테이블 |
|------|--------|
| 사용자·권한 | `users`, `branches` |
| 수업·학생 | `classes`, `students`, `attendance`, `lesson_memos` |
| 출석부 서류 | `attendance_templates`, `documents`, `custom_categories` |
| 수익 관리 | `revenue_fees`, `revenue_payments` |
| 강사 이력 | `trainings`, `careers`, `educations`, `certificates`, `awards` |
| 구인 공고 | `job_subs` |
| 교구·진도 | `supply_subjects`, `supply_vendors`, `supply_items`, `supply_plans`, `supply_products`, `supply_product_plans`, `supply_student_progress`, `supply_session_checks`, `supply_given`, `supply_parts`, `supply_school_prices` |
| 메시지 | `message_guides`, `message_categories`, `teacher_profiles` |
| 학부모 포털 | `parent_members`, `teacher_parent_links`, `teacher_service_configs` |
| 학교 담당자 포털 | `school_admins`, `school_admin_accounts`, `school_admin_teachers`, `school_subjects`, `school_teacher_invites`, `school_notices`, `school_notice_submits`, `school_calendar`, `school_info` |
| 업체 포털 | `hq_vendors`, `hq_vendor_subjects`, `hq_vendor_products`, `hq_vendor_stages`, `hq_vendor_contents`, `hq_vendor_quarters`, `hq_vendor_sessions`, `hq_vendor_files`, `hq_vendor_prices`, `hq_vendor_users`, `vendor_accounts` |
| 시스템 | `settings`, `ad_slots`, `blog_posts`, `points` |

### students 테이블 boolean 컬럼

> ⚠️ 아래 컬럼은 반드시 `true/false`만 허용. 빈 문자열·null 전송 시 PostgreSQL 에러 발생.

| 컬럼 | 설명 |
|------|------|
| `parent_joined` | 학부모 앱 가입 여부 |
| `moved_to_manage` | 학생관리 탭 이동 여부 |
| `_deleted` | 소프트딜리트 |
| `auto_end_exception` | 자동종료 예외 여부 |

> `home_return`은 귀가방법 문자열 (`'도보'`, `'학원-버스'` 등) — DB 컬럼 타입 `text`

---

## 수업(classes) 데이터 구조

수업은 하나의 `classes` 레코드에 여러 반을 `sections` 배열로 관리합니다.

```js
// classes 레코드 예시
{
  id: 'mnu9soqql8nm2',
  className: '융합발명과학',
  organization: '판교초',
  section: 'A',        // 단일 반일 때 사용 (구방식)
  sections: [          // 다중 반일 때 사용 (신방식)
    { section: 'A', time: '13:00', timeEnd: '14:00' },
    { section: 'B', time: '14:00', timeEnd: '15:00' },
  ]
}
```

드롭다운 렌더링 규칙:
- `sections` 배열에 반이 2개 이상 → 반별로 분리해서 옵션 생성
- `sections` 배열이 1개 이하 → `section` 필드 사용

> ⚠️ classes는 OrphanSync 대상에서 제외. 수동 등록한 수업만 DB에 존재해야 함.

---

## Supabase SQL 쿼리 패턴

### ✅ 특정 반 학생 조회 (올바른 방법)

`class_ids`는 jsonb 배열이므로 반드시 `@>` 연산자 사용.

```sql
-- 특정 수업의 특정 반 학생 조회
SELECT s.id, s.name, s.grade, s.class_num, s.section, s.status
FROM students s
WHERE s.class_ids @> jsonb_build_array('class_id'::text)
AND s.section = 'B'
ORDER BY s.grade, s.class_num, s.number;
```

### ❌ 잘못된 방법 (사용 금지)

```sql
-- LIKE는 id 부분 매칭 오류 가능 → 사용 금지
WHERE s.class_ids::text LIKE '%' || c.id || '%'
```

### 수업별 반 인원 확인

```sql
SELECT c.id, c.class_name, c.section, c.sections, COUNT(s.id) as student_count
FROM classes c
LEFT JOIN students s ON s.class_ids @> jsonb_build_array(c.id::text)
WHERE c.organization = '판교초'
GROUP BY c.id, c.class_name, c.section, c.sections
ORDER BY c.class_name, c.section;
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
| 9 | UI 수정 시 스크린샷을 먼저 기준으로 삼고 코드를 맞출 것 |
| 10 | 유사한 화면이 있으면 해당 코드를 참고해서 동일하게 구현할 것 |

---

*방과후 출석부 — 현장 강사가 실제로 쓰는 출결 관리 플랫폼*

---

## 구현 특이사항

코드를 처음 보는 사람이 놓치기 쉬운 설계 결정들을 정리합니다.

### 비밀번호 해싱 — PBKDF2 + 솔트

`src/lib/crypto.js`에서 Web Crypto API로 PBKDF2(반복 100,000회, SHA-256, 랜덤 16바이트 솔트) 적용.
저장 형식: `pbkdf2:{saltHex}:{hashHex}`. 레거시 SHA-256(64자 hex) fallback은 검증만 가능하고 신규 생성은 불가.

### 오프라인 → 온라인 자동 복구 (pending 큐)

쓰기 실패 시 `IndexedDB(asa_pending_ops)`에 적재 → 30초마다 자동 재시도 + 온라인 복귀 시 즉시 재시도.
앱 재시작 시 로컬에만 있고 Supabase에 없는 `students` 레코드를 자동 insert하는 OrphanSync도 포함.

### syncUpdate — row 없으면 insert 자동 전환

`syncUpdate()`는 update 후 반영된 행이 0개면 DB에 해당 row가 없는 것으로 판단, 로컬 캐시에서 전체 레코드를 꺼내 insert로 전환.
pending 큐에서 재시도할 때 이미 삭제된 row를 업데이트하려다 유실되는 상황을 방지.

### boolean 컬럼 sanitize

`db-api` Edge Function의 `sanitize()`가 `students` 테이블의 `parent_joined`, `moved_to_manage` 컬럼에 빈 문자열·null이 들어오면 자동으로 `false`로 변환. 프론트에서 잘못된 값을 보내도 PostgreSQL boolean 에러가 발생하지 않음.

### CSP 헤더 (vercel.json)

`vercel.json`에 `Content-Security-Policy` 헤더를 직접 설정. `script-src`, `connect-src`, `frame-src`를 허용 도메인 화이트리스트로 제한. 별도 서버 없이 Vercel 엣지에서 XSS 기본 차단.

### 개인정보처리방침 (`LegalPage.jsx`)

`DEFAULT_PRIVACY`에 미성년자 개인정보 처리 근거(개인정보보호법 제15조 제1항 제4호), 학부모 전화번호·PIN 수집 항목, Solapi·Resend·Google·카카오 위탁 명시, 이용자 권리 조항 추가. 시행일 2026-06-12.
관리자 페이지 → 서비스 설정 → 개인정보처리방침에서 DB에 저장된 내용을 직접 수정해야 실제 화면에 반영됨 (DB 저장값이 DEFAULT보다 우선).

---

## 보안 설정 (Supabase 직접 적용 — 코드 외 설정)

> 아래 항목은 `000_complete_schema.sql` 하단에도 반영되어 있음.
> 신규 Supabase 프로젝트 생성 시 schema 실행만 하면 자동 적용됨.

### Row Level Security (RLS)

모든 핵심 테이블에 RLS 활성화 + 정책 적용 완료 (2026-06-12)

| 테이블 | 정책 |
|--------|------|
| `users` | 본인 행(`auth_id = auth.uid()`) 또는 관리자만 접근 |
| `students` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `classes` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `attendance` | `class_id → classes.teacher_id` 조인으로 본인 수업 출석만 접근 |
| `notes` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `parent_members` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `teacher_parent_links` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `settings` | **select: 관리자만**, insert/update/delete: 관리자만 |
| `school_notices` | **select: 본인(`admin_id`) 또는 관리자**, write: 동일 |

> `attendance`는 `teacher_id` 컬럼이 없으므로 `classes` 테이블 조인으로 소유권 확인.

### 헬퍼 함수

| 함수 | 역할 |
|------|------|
| `get_my_user_id()` | `auth.uid()` → `users.id` 변환 (security definer) |
| `is_admin()` | `users.level >= 10` 여부 반환 (security definer) |

### 학부모 PIN 인증

| 함수 | 역할 |
|------|------|
| `set_parent_pin(phone, pin)` | PIN을 `pgcrypto crypt(bcrypt)` 해시로 저장 |
| `verify_parent_pin(phone, pin)` | PIN 검증 후 `parent_members` 행 반환 |
| `withdraw_parent(phone)` | 학부모 탈퇴 처리 (RLS 우회용 security definer) |
| `check_parent_joined(phone)` | 가입 여부 확인 |

- `parent_members.pin_hash` 컬럼 추가 (nullable, bcrypt 해시 저장)
- 프론트(`ParentLogin.jsx`)에서 5회 실패 시 30초 잠금 처리

### CORS

- 모든 Edge Function(`db-api`, `send-email`, `send-sms`, `send-push`, `kakao-oauth`, `naver-oauth`, `reset-user-password`, `generate-vapid`)이 `ALLOWED_ORIGIN` 환경변수를 읽음
- **미설정 시 `*`(전체 허용)으로 열림** — 신규 배포 시 반드시 설정 필요
- Supabase Dashboard → Settings → Edge Functions → Secrets → `ALLOWED_ORIGIN` = `https://your-domain.vercel.app`

### 배포 체크리스트

새 Supabase 프로젝트 생성 또는 재배포 시 반드시 확인:

- [ ] `supabase/000_complete_schema.sql` 실행 (RLS + PIN 함수 포함)
- [ ] Supabase Secrets에 `ALLOWED_ORIGIN` 설정
- [ ] Supabase Secrets에 `SVC_ROLE_KEY` 설정
- [ ] 관리자 계정으로 로그인 후 서비스 설정에서 Resend·Solapi 키 등록
- [ ] Edge Functions 전체 배포 (`setup.bat` 또는 `bash setup.sh`)

### 기타

- `send-email` / `send-sms` Edge Function용 API 키(Resend, Solapi)는 `settings` 테이블에 저장되나, RLS로 관리자만 읽을 수 있음
- `db.js` 동기화 시 `email` / `solapi` 키는 `localStorage`에 저장하지 않음 (`EXCLUDE_KEYS`)
- Supabase Auth 세션: `sessionStorage` 사용 (탭 닫으면 자동 로그아웃)
- `send-sms` Edge Function: Bearer 토큰 인증 추가 (미인증 요청 401 차단) — URL 노출 시 무단 SMS 발송 방지
