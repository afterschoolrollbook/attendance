# 방과후 출석부

> 방과후 강사를 위한 출결·학생·수업 관리 플랫폼

- **서비스**: [www.afterschoolrollbook.kr](https://www.afterschoolrollbook.kr/)
- **블로그**: [www.afterschoolrollbook.kr/blog](https://www.afterschoolrollbook.kr/blog)
- **GitHub**: [afterschoolrollbook/attendance](https://github.com/afterschoolrollbook/attendance)
- **Supabase 프로젝트**: afterschool-attendance

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| 오프라인 캐시 | IndexedDB (`asa_cache`) |
| 알림 | Resend (이메일) + Solapi (SMS/알림톡) + Web Push |
| 소셜 로그인 | Google / 카카오 / 네이버 |
| 배포 | Vercel |
| PWA | Service Worker + Web App Manifest |

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

## 배포 체크리스트

새 Supabase 프로젝트 생성 또는 재배포 시 반드시 확인:

- [ ] `supabase/000_complete_schema.sql` 실행 (RLS + PIN 함수 전부 포함)
- [ ] Supabase Secrets에 `ALLOWED_ORIGIN` = `https://your-domain.vercel.app` 설정
- [ ] Supabase Secrets에 `SVC_ROLE_KEY` 설정
- [ ] Edge Functions 전체 배포 (`setup.bat` 또는 `bash setup.sh`)
- [ ] 관리자 계정으로 로그인 후 서비스 설정에서 Resend·Solapi·VAPID 키 등록

---

## Edge Functions

| Function | 역할 |
|----------|------|
| `db-api` | 통합 DB CRUD (teacher_id 기반 데이터 격리) |
| `send-email` | 이메일 발송 (Resend) — Bearer 인증 필수 |
| `send-sms` | SMS/알림톡 발송 (Solapi) — Bearer 인증 필수 |
| `send-push` | 학부모 웹 푸시 발송 (Web Push API) |
| `kakao-oauth` | 카카오 로그인 |
| `naver-oauth` | 네이버 로그인 |
| `reset-user-password` | 관리자 전용 사용자 비밀번호 초기화 |
| `generate-vapid` | VAPID 키 생성 (푸시 알림 초기 설정) |

---

## PWA

홈 화면에 설치 가능한 앱으로 동작합니다.

- `public/manifest.json` — 앱 이름·아이콘·시작 URL·숏컷(출석부 바로가기) 정의
- `public/sw.js` — 서비스 워커. 푸시 알림 수신 처리. 빌드 시 `vite.config.js`의 `injectSwVersion` 플러그인이 `// @version {timestamp}` 자동 삽입해 캐시 갱신 유도
- `src/lib/webpush.js` — VAPID 키 기반 푸시 구독 등록(`subscribePush`) + 구독 확인(`getExistingSubscription`)
- VAPID 공개키는 관리자 설정 → `settings.push.vapidPublicKey`에 저장

---

## 화면 목록

### 공개 화면

| 경로 | 화면 | 파일 |
|------|------|------|
| `/` | 랜딩 페이지 | `LandingPage.jsx` |
| `/auth` | 로그인 / 회원가입 | `Auth.jsx` |
| `/legal` | 이용약관 / 개인정보처리방침 | `LegalPage.jsx` |
| `/blog`, `/docs` | 블로그 | `Blog.jsx` |
| `/parent-login` | 학부모 로그인 | `ParentLogin.jsx` |
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
| 🏢 업체 관리 | `VendorManage.jsx` |
| 🏫 학교 담당자 관리 | `SchoolAdminManage.jsx` |

### 포털

| 포털 | 파일 |
|------|------|
| 학부모 초대·출결 조회 | `ParentInvite.jsx` |
| 학부모 로그인 | `ParentLogin.jsx` |
| 학교 담당자 | `SchoolAuth.jsx` + `SchoolAdminApp.jsx` + `SchoolAdminManage.jsx` |
| 학교 연간 수업 달력 | `SchoolCalendar.jsx` |
| 학교 공지 팝업 | `SchoolNoticePopup.jsx` |
| 납품 업체 | `VendorAuth.jsx` + `VendorApp.jsx` + `VendorManage.jsx` |

---

## 주요 기능 상세

### 수업 관리

수업은 하나의 `classes` 레코드에 여러 반을 `sections` 배열로 관리합니다.

```js
{
  id: 'mnu9soqql8nm2',
  className: '융합발명과학',
  organization: '판교초',
  sections: [
    { section: 'A', time: '13:00', timeEnd: '14:00' },
    { section: 'B', time: '14:00', timeEnd: '15:00' },
  ]
}
```

수업 반복 타입: `every`(매주) / `biweekly`(2주마다) / `monthly_first~fourth`(월 N번째 요일)  
취소일(`cancelledDates`)·보강일(`makeupDates`)·복수 학기(`periods`) 지원.

> ⚠️ `classes`는 OrphanSync 대상 제외 — 수동 등록한 수업만 DB에 존재해야 함.

### 출석 체크

| key | 라벨 | 색상 | 이모지 |
|-----|------|------|--------|
| `pending` | 미처리 | `#9ca3af` | — |
| `present` | 출석 | `#16a34a` | ✅ |
| `absent` | 결석 | `#ef4444` | ❌ |
| `late` | 지각 | `#f59e0b` | 🕐 |
| `early` | 조퇴 | `#8b5cf6` | 🔜 |

출석 체크 시 학부모 웹 푸시 자동 발송. `Attendance.jsx`에서 SMS 발송도 지원.

### 안내 문구 관리

카테고리별 SMS/카카오 문구 템플릿 관리. 변수 치환 지원: `{학교명}` `{선생님닉네임}` `{학생이름}` `{날짜}` `{수업명}`.

### 학부모 포털

- 강사가 초대 링크(토큰) 발송 → 학부모 전화번호 확인 → PIN 4자리 설정
- 이후 로그인: 전화번호 + PIN (5회 실패 시 30초 잠금)
- 자녀 출결 조회 + 수업 달력 확인
- 탈퇴: `withdraw_parent()` RPC (security definer)

### 학교 담당자 포털

- 공지·업무 생성 및 강사별 제출 현황 확인
- 담당 강사 학생 현황 조회
- 연간 수업 달력 (분기·학기·텀·회차 구조)

### 납품 업체 포털

- 과목·교구·단계·차시 등록
- 교구 목록 엑셀 다운로드/업로드
- 강사(`Supplies.jsx`)에서 학생별 진도·교구 지급 현황 관리

### 블로그 / 커뮤니티

| 게시판 | key | 설명 |
|--------|-----|------|
| 📝 블로그 | `blog` | 출석 관리·업무 팁 카테고리별 글 |
| ⭐ 사용자 후기 | `review` | 서비스 사용 후기 |
| ❓ 질문 | `qna` | 이용 문의 및 Q&A |
| 🔐 비밀게시판 | `secret` | 관리자 전용 비공개 |

게시판별 접근·읽기·쓰기 최소 레벨은 관리자가 서비스 설정에서 변경 가능 (`boardPermissions`).  
마크다운 렌더링, DOMPurify XSS 방어 적용.

### 구인공고

NEIS API 연동, 지역·교육청·학교·과목 필터로 공고 구독. SMS·카카오·이메일 알림 선택 가능.  
NEIS API 키: 관리자 설정 → `settings.regionMap.neisApiKey`.

### 수익관리

달력 뷰 / 텀 크로스체크 / 수강료 등록 3개 탭. 수강료 미설정 수업 표시, 학생별 입금 현황 추적.

### 접속 기간 만료

관리자가 강사별 `accessExpiredAt` 설정 시:
- 만료 7일 전부터 이메일 경고 자동 발송 (하루 1회)
- 만료 시 안내 메시지 후 자동 로그아웃

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

**OrphanSync 대상**: `students`만. classes는 수동 등록, attendance는 정상 저장이므로 제외.

**syncUpdate**: update 후 반영 행이 0개면 DB에 없는 것으로 판단 → 로컬 캐시에서 전체 레코드를 꺼내 insert 전환. pending 큐 재시도 시 데이터 유실 방지.

---

## 권한 구조

레벨 1~10으로 관리. 관리자(level 10)가 메뉴별 최소 레벨을 Settings에서 변경 가능.

| 레벨 | 기본 이름 | 비고 |
|------|----------|------|
| 1 | 미인증 선생님 | 가입 직후 기본값 |
| 2 | 인증 선생님 | 관리자 승인 후 부여 |
| 3~9 | 레벨3~9 | 관리자가 이름/권한 직접 설정 |
| 10 | 관리자 | 모든 기능 접근 |

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

### students 테이블 주의사항

boolean 컬럼 (`parent_joined`, `moved_to_manage`, `_deleted`, `auto_end_exception`)은 반드시 `true/false`만 허용. 빈 문자열·null 전송 시 PostgreSQL 에러 발생 → `db-api`의 `sanitize()`가 자동 변환.

`home_return`은 귀가방법 문자열 (`'도보'`, `'학원-버스'` 등) — DB 컬럼 타입 `text`.

`student_careers` — jsonb 배열로 수강 이력(연도·텀·수업) 관리. camelCase 변환 제외 대상(`KEEP_SNAKE_FIELDS`).

---

## Supabase SQL 쿼리 패턴

### ✅ 특정 반 학생 조회 (올바른 방법)

`class_ids`는 jsonb 배열이므로 반드시 `@>` 연산자 사용.

```sql
SELECT s.id, s.name, s.grade, s.class_num, s.section, s.status
FROM students s
WHERE s.class_ids @> jsonb_build_array('class_id'::text)
AND s.section = 'B'
ORDER BY s.grade, s.class_num, s.number;
```

### ❌ 잘못된 방법 (사용 금지)

```sql
-- LIKE는 id 부분 매칭 오류 가능
WHERE s.class_ids::text LIKE '%' || c.id || '%'
```

---

## 보안 설정

### Row Level Security (RLS) — 완료

`000_complete_schema.sql`에 포함. 신규 프로젝트 시 schema 실행만 하면 자동 적용.

| 테이블 | 정책 |
|--------|------|
| `users` | 본인(`auth_id = auth.uid()`) 또는 관리자 |
| `students` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `classes` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `attendance` | `class_id → classes.teacher_id` 조인으로 소유권 확인 |
| `notes` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `parent_members` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `teacher_parent_links` | `teacher_id = get_my_user_id()` 또는 관리자 |
| `settings` | 로그인 사용자 읽기, 쓰기는 관리자만 |
| `school_notices` | 본인(`admin_id`) 또는 관리자 |

헬퍼 함수: `get_my_user_id()` (`auth.uid()` → `users.id`), `is_admin()` (`level >= 10`).

### 학부모 PIN 인증 — 완료

| DB 함수 | 역할 |
|---------|------|
| `set_parent_pin(phone, pin)` | PIN을 bcrypt(`pgcrypto crypt()`)로 해시 저장 |
| `verify_parent_pin(phone, pin)` | PIN 검증 후 `parent_members` 행 반환 |
| `withdraw_parent(phone)` | 탈퇴 처리 (security definer) |
| `check_parent_joined(phone)` | 가입 여부 확인 |

`parent_members.pin_hash` 컬럼 추가됨. 프론트에서 5회 실패 시 30초 잠금.

### 기타 보안 조치 — 완료

- 비밀번호: 8자 이상 + 영문 + 숫자 + 특수문자 조합 필수
- Supabase Auth 세션: `sessionStorage` (탭 닫으면 자동 로그아웃)
- API 키(Resend·Solapi): `settings` 테이블 저장, localStorage 동기화 제외
- `AdSlot.jsx`: Blob 실패 시 `dangerouslySetInnerHTML` 폴백 없이 `null` 반환
- CSP 헤더: `vercel.json`에서 `script-src` · `connect-src` · `frame-src` 화이트리스트
- CORS: 모든 Edge Function이 `ALLOWED_ORIGIN` Secret으로 도메인 제한

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

## 디자인 시스템

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

---

## 프로젝트 구조

```
src/
├── components/
│   ├── Atoms.jsx           # 공통 UI (Modal, Toast, ConfirmDialog 등)
│   ├── Sidebar.jsx         # 사이드바 내비게이션
│   ├── SaveStatusBar.jsx   # 저장 상태 바
│   └── AdSlot.jsx          # 광고 슬롯 렌더러 (iframe sandbox)
├── constants/
│   ├── config.js           # 상수 (상태값, 색상, 요일 등)
│   └── permissions.js      # 레벨별 권한 정의
├── hooks/
│   ├── useToast.js
│   └── useConfirm.js
├── lib/
│   ├── db.js               # DB 레이어 (인메모리 캐시 + IndexedDB + Supabase)
│   ├── supabase.js         # Supabase 클라이언트 (sessionStorage 세션)
│   ├── crypto.js           # PBKDF2 비밀번호 해싱
│   ├── utils.js            # 날짜·회차 계산·포맷 유틸
│   └── webpush.js          # 웹 푸시 구독 관리
└── pages/                  # 페이지 컴포넌트 43개
supabase/
├── 000_complete_schema.sql # 전체 DB 스키마 + RLS + PIN 함수
└── functions/              # Edge Functions 8개
public/
├── manifest.json           # PWA 매니페스트
└── sw.js                   # 서비스 워커 (푸시 수신)
```

---

*방과후 출석부 — 현장 강사가 실제로 쓰는 출결 관리 플랫폼*
