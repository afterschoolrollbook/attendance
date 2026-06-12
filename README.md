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
| 알림 | Resend (이메일) + Solapi (SMS/알림톡) |
| 소셜 로그인 | Google / 카카오 / 네이버 |
| 배포 | Vercel |

---

## 블로그 / 커뮤니티

서비스 내 블로그 기능이 내장되어 있습니다. 공개 URL: [www.afterschoolrollbook.kr/blog](https://www.afterschoolrollbook.kr/blog)

### 게시판 종류

| 게시판 | key | 설명 |
|--------|-----|------|
| 📝 블로그 | `blog` | 출석 관리·교구 관리·업무 팁 등 카테고리별 글 |
| ⭐ 사용자 후기 | `review` | 서비스 사용 후기 |
| ❓ 질문 | `qna` | 이용 문의 및 Q&A |
| 🔐 비밀게시판 | `secret` | 관리자 전용 비공개 게시판 |

### 접근 권한

관리자가 `서비스 설정 → 권한 설정`에서 게시판별 접근·읽기·쓰기 최소 레벨을 설정할 수 있습니다 (`boardPermissions` settings 키).

### 주요 파일

| 파일 | 역할 |
|------|------|
| `Blog.jsx` | 공개 블로그 뷰어 (마크다운 렌더링, DOMPurify XSS 방어) |
| `BlogWrite.jsx` | 글 작성·수정 에디터 |
| `BlogAdmin.jsx` | 관리자용 글 관리 |

### DB 테이블

`blog_posts` — `title`, `content`, `board_type`, `category`, `tags`, `cover_image`, `published_at`, `author`, `slug`

### 라우팅

`/blog` 또는 `/docs` 경로 모두 `Blog.jsx`로 연결됩니다. 로그인 없이도 접근 가능한 공개 화면입니다.

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
| ✍️ 블로그 글쓰기 | `BlogWrite.jsx` |

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

## 광고 (Google AdSense)

### 구조

광고는 두 가지 레이어로 운영됩니다.

| 레이어 | 설명 | 설정 위치 |
|--------|------|----------|
| **자동 광고** | 구글이 페이지 전체에서 광고 위치를 자동으로 잡아주는 방식. 퍼블리셔 ID 등록 필요 | `index.html` |
| **슬롯 광고** | 관리자가 광고 단위 코드를 직접 입력해 앱 내 특정 위치에 표시 | 관리자 → 광고 슬롯 관리 |

현재 자동 광고 스크립트는 비활성화(주석 처리)되어 있습니다. AdSense 계정 승인 후 활성화하세요.

### AdSense 계정 승인 후 적용 방법

#### 1. 자동 광고 활성화 (`index.html`)

`index.html` 26번 줄 주석을 해제하고 퍼블리셔 ID 입력:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-여기에16자리ID" crossorigin="anonymous"></script>
```

퍼블리셔 ID 확인: [adsense.google.com](https://adsense.google.com) → 계정 → 계정 정보 → `ca-pub-XXXXXXXXXXXXXXXX`

#### 2. 슬롯 광고 등록 (관리자 화면)

1. Google AdSense → 광고 → 광고 단위 → 새 광고 단위 만들기
2. 생성된 `<script>` 코드 복사
3. 관리자(level 10) 로그인 → 사이드바 → **광고 관리**
4. 원하는 슬롯에 코드 붙여넣기 → 저장 → ON

#### 현재 슬롯 목록

| 슬롯 ID | 위치 | 크기 |
|---------|------|------|
| `sidebar_bottom` | 사이드바 하단 | 300 × 250 |

> 슬롯 추가는 DB `ad_slots` 테이블에 직접 insert하거나 관리자 화면에서 추가 가능.

### 블로그 광고

블로그(`/blog`)는 공개 페이지이므로 AdSense 심사 시 콘텐츠 페이지로 활용할 수 있습니다. 블로그 글을 충분히 작성한 후 AdSense 심사를 신청하세요.

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
| `send-email` | 이메일 발송 (Resend) |
| `send-sms` | SMS/알림톡 발송 (Solapi) |
| `send-push` | 출석 알림 푸시 발송 |
| `naver-oauth` | 네이버 로그인 |
| `kakao-oauth` | 카카오 로그인 |
| ~~`generate-vapid`~~ | ~~푸시 알림용 VAPID 키 발급~~ — **삭제됨 (2026-06-12)** 초기 설정 후 불필요, 인증 없이 누구나 호출 가능하여 제거 |
| `reset-user-password` | (관리자 전용) 다른 사용자 비밀번호 초기화 |
| `reset-password-self` | (본인) 인증번호 확인 후 비밀번호 초기화 — 2026-06-12 추가 |

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

### boolean 컬럼 sanitize (⚠️ 확인 필요)

기존에는 `db-api` Edge Function의 `sanitize()`가 `students` 테이블의 `parent_joined`, `moved_to_manage` 컬럼에 빈 문자열·null이 들어오면 자동으로 `false`로 변환해주었음. 2026-06 보안 점검으로 `db-api`를 제거하면서 이 변환 로직도 함께 사라짐. 현재 `src/lib/supabase.js`의 `dbCall`에는 동일한 sanitize가 없으므로, 프론트에서 빈 값(`''`)을 그대로 보내면 PostgreSQL boolean 타입 에러가 날 수 있음 — 별도 확인/수정 필요.

### CSP 헤더 (vercel.json)

`vercel.json`에 `Content-Security-Policy` 헤더를 직접 설정. `script-src`, `connect-src`, `frame-src`를 허용 도메인 화이트리스트로 제한. 별도 서버 없이 Vercel 엣지에서 XSS 기본 차단.

> 2026-06-12 추가: `connect-src`에 `https://open.neis.go.kr` 추가. 미등록 상태에서 관리자가 지역/학교 관리 탭에서 학교 검색 시 CSP 위반으로 차단되는 문제 수정.

### 개인정보처리방침 (`LegalPage.jsx`)

`DEFAULT_PRIVACY`에 미성년자 개인정보 처리 근거(개인정보보호법 제15조 제1항 제4호), 학부모 전화번호·PIN 수집 항목, Solapi·Resend·Google·카카오 위탁 명시, 이용자 권리 조항 추가. 시행일 2026-06-12.
관리자 페이지 → 서비스 설정 → 개인정보처리방침에서 DB에 저장된 내용을 직접 수정해야 실제 화면에 반영됨 (DB 저장값이 DEFAULT보다 우선).

---

## 보안 설정 (Supabase 직접 적용 — 코드 외 설정)

> 아래 항목은 `000_complete_schema.sql` 하단에도 반영되어 있음.
> 신규 Supabase 프로젝트 생성 시 schema 실행만 하면 자동 적용됨.

### 보안 점검 체크리스트 (2026-06-12)

새 환경(신규 Supabase 프로젝트, 재배포 등)을 만들거나 추후 정기 점검 시, 아래 항목들이 여전히 적용되어 있는지 순서대로 확인.

| # | 항목 | 적용 상태 | 테스트 방법 |
|---|------|-----------|-------------|
| 1 | db-api Edge Function 제거 | ✅ 적용 (2026-06-12) | [바로가기](#db-api-edge-function-제거-2026-06-12) |
| 2 | 카카오/네이버 임시 비밀번호 제거 | ✅ 적용 (2026-06-12) | [바로가기](#카카오네이버-로그인--예측-가능한-임시-비밀번호-제거-2026-06-12) |
| 3 | 학부모 앱(/parent-login, /parent-invite) RPC 전환 | ✅ 적용 (2026-06-12) | [바로가기](#학부모-앱parent-login-parent-invite-전면-복구--rpc-기반으로-전환-2026-06-12) |
| 4 | 아이디 찾기 / 비밀번호 초기화 RPC 전환 | ✅ 적용 (2026-06-12) | [바로가기](#로그인-화면-아이디-찾기비밀번호-초기화-복구--rpc-기반으로-전환-2026-06-12) |
| 5 | Edge Function CORS — `ALLOWED_ORIGIN` | ✅ 적용 (2026-06-12) | [바로가기](#cors) |
| 6 | 로그인 brute-force 방어 | ✅ 확인 완료 (Supabase Rate Limit으로 보호됨) | [바로가기](#로그인-brute-force-방어-2026-06-12) |
| 7 | Supabase Auth "Confirm email" 설정 | ✅ 확인 완료 (OFF, 정상) | [바로가기](#supabase-auth-confirm-email-설정-확인-2026-06-12) |
| 8 | 비밀번호 초기화 — 실제로 비밀번호가 안 바뀌는 문제 | ✅ 적용 (2026-06-12) | [바로가기](#비밀번호-초기화가-실제로-비밀번호를-바꾸지-않던-문제-수정-2026-06-12) |
| 9 | reset-password-self / reset-user-password 폴더 혼동 | ✅ 적용 (2026-06-12) | [바로가기](#reset-password-self--reset-user-password-폴더-혼동-수정-2026-06-12) |
| 10 | `find_email_by_phone`/`get_invite_info`/`get_parent_dashboard` — 과도한 컬럼/원본 이메일 노출 | ✅ 적용 (2026-06-12) | [바로가기](#parent-rpc--아이디찾기-rpc-응답-데이터-최소화-2026-06-12) |
| 11 | `parent_joined`/`moved_to_manage` boolean sanitize 누락 | ✅ 적용 (2026-06-12) | [바로가기](#parent-rpc--아이디찾기-rpc-응답-데이터-최소화-2026-06-12) |
| 12 | `settings` 테이블 API 시크릿 노출 + 위장 `service role full access` 정책 제거 | ✅ 적용 (2026-06-12) | [바로가기](#settings-테이블-시크릿-노출--위장-service-role-정책-제거-2026-06-12) |
| 13 | 업체 포털 (`hq_vendors` / `hq_vendor_*` / `vendor_accounts`) RLS 우회 — RPC 전환 | ✅ 적용 (2026-06-12) | [바로가기](#업체-포털-rls-우회--rpc-전환-2026-06-12) |
| 14 | `get_parent_dashboard` RPC — PIN 검증 없이 전화번호만으로 자녀 정보 조회 가능 | ✅ 적용 (2026-06-12) | [바로가기](#get_parent_dashboard-rpc--pin-검증-강제-2026-06-12) |
| 15 | `generate-vapid` Edge Function — 인증 없이 누구나 호출 가능 | ✅ 삭제 완료 (2026-06-12) | [바로가기](#generate-vapid-edge-function-삭제-2026-06-12) |
| 16 | `db-api` Edge Function 배포 목록 잔존 여부 재확인 | ✅ 없음 확인 (2026-06-12) | — |
| 17 | `setup.sh`에 `generate-vapid` 배포 라인 잔존 — `bash setup.sh` 실행 시 삭제된 함수가 재배포됨 | ✅ 제거 완료 (2026-06-12) | [바로가기](#generate-vapid-edge-function-삭제-2026-06-12) |
| 18 | `App.jsx` — `blog_write` 라우팅 누락으로 메뉴 클릭 시 대시보드로 떨어짐 | ✅ 수정 완료 (2026-06-12) | [바로가기](#appjsx--blog_write-라우팅-누락-수정-2026-06-12) |
| 19 | `reset-user-password/index.ts` — 다중 도메인 CORS 미지원 (단일 문자열 비교로 남아있어 `ALLOWED_ORIGIN` 콤마 설정 시 CORS 오류) | ✅ 수정 완료 (2026-06-12) | [바로가기](#cors) |
| 20 | `vercel.json` CSP `connect-src` — `https://open.neis.go.kr` 누락으로 NEIS 학교 검색 시 CSP 위반 차단 | ✅ 수정 완료 (2026-06-12) | [바로가기](#csp-헤더-verceljson) |
| 21 | `send-push/index.ts` — Authorization 검사 없음 (curl 등 직접 호출로 학부모 기기에 임의 푸시 가능) | ✅ 수정 완료 (2026-06-12) | [바로가기](#send-pushindexts--authorization-검사-추가-2026-06-12) |
| 22 | `App.jsx` — `BlogWrite`에 `onLogout` prop 누락으로 헤더 🚪 로그아웃 버튼 클릭 시 아무 반응 없음 | ✅ 수정 완료 (2026-06-12) | [바로가기](#appjsx--blogwrite-onlogout-prop-누락-수정-2026-06-12) |
| 23 | `ParentInvite.jsx` 160번 줄 주석 — `withdraw_parent` 서명이 구버전(`p_phone`만)으로 남아 있어 실제 RPC 서명(`p_phone, p_pin DEFAULT NULL`)과 불일치 | ✅ 수정 완료 (2026-06-12) | [바로가기](#parentinvitejsx--withdraw_parent-주석-서명-업데이트-2026-06-12) |

### 🔲 남은 테스트 체크리스트

코드/설정은 모두 적용되었으나, 실제 사이트(`https://www.afterschoolrollbook.kr`)에서 아직 동작 확인이 안 된 항목들.

#### 🔐 로그인 / 인증

- [ ] 일반 이메일 로그인 — 평소처럼 로그인/학생 관리/출석 체크가 정상 동작하는지
- [ ] 카카오 로그인 — 정상 로그인 + 강사 화면 진입
- [ ] 네이버 로그인 — 정상 로그인 + 강사 화면 진입
- [ ] 아이디 찾기 — 가입된 전화번호 입력 → 마스킹된 이메일(`ab***@...`) 표시
- [ ] 비밀번호 초기화(본인) — 인증번호 확인 → 새 비밀번호 설정 → **새 비밀번호로 로그인** 성공 → 같은 인증번호 재사용 시 거부
- [x] CORS — 로그인/이메일 인증/문자발송/푸시 등 정상 동작 (개발자도구 Network에서 `Access-Control-Allow-Origin` 값이 `*`가 아닌 실제 도메인인지 확인)

#### 👥 학생 관리

- [ ] 학생 정보 수정 — "학부모 가입"/"관리이동" 체크박스를 건드리지 않고 저장해도 정상 저장되는지

#### 👨‍👩‍👧 학부모 포털

- [ ] 학부모 초대 가입 — 초대 링크 → 약관동의 → 가입 → 학생/수업/출석 화면 표시. 학생 이름·학년·반·연결된 수업·출석 현황이 모두 표시되는지 (빈 칸이 생기면 RPC 응답에 누락된 컬럼이 있다는 뜻)
- [ ] 학부모 재로그인 — `/parent-login` → 전화번호 → PIN → 가입 때와 동일한 화면
- [ ] 학부모 PIN 설정 첫 로그인 — PIN 설정 완료 후 대시보드가 정상 로드되는지
- [ ] PIN 없이 RPC 직접 호출 차단 — phone만으로 `get_parent_dashboard` 호출 시 빈 데이터 반환되는지

#### 🏢 업체 포털

- [ ] 업체 로그인 — `?vendor=1` 경로에서 업체 이메일/비밀번호로 로그인 성공하는지
- [ ] 업체 가입 — 본사에 등록된 전화번호/이메일 확인 → 이메일 인증 → 계정 생성 정상 완료
- [ ] 업체 앱 — 로그인 후 과목·교구·차시·파일·단가 조회 및 저장이 모두 정상 동작하는지

#### ⚙️ 관리자

- [ ] 관리자 비밀번호 초기화 — Admin 화면에서 다른 강사 비밀번호 초기화 정상 동작
- [ ] 업체 관리 — 사이드바 업체 관리 화면에서 목록이 로드되고, 업체 등록/수정/삭제/초대가 정상 동작하는지
- [ ] 소셜 로그인 설정 — AdminSettings → 소셜 로그인 탭에서 네이버 클라이언트 Secret이 정상적으로 표시/저장되는지
- [ ] 지역/학교 관리 — AdminSettings → 지역/학교 관리 탭에서 NEIS API 키가 정상적으로 표시/저장되고, 학교 검색이 동작하는지
- [ ] 지도 드릴다운 — Admin 화면의 지도에서 학교 선택 시 NEIS 학생수 통계가 정상적으로 조회되는지

#### 🔍 보안 / 데이터 확인

- [ ] 일반 강사 네트워크 응답 — 로그인 후 개발자도구 Network 탭에서 `settings` select 응답에 `email`/`solapi`/`social_secret`/`regionMap_secret`이 포함되지 않는지
- [ ] 일반 강사 기존 기능 — 포인트 내역, 지사 정보 표시 등이 RLS 정책 변경 후에도 정상 동작하는지

### db-api Edge Function 제거 (2026-06-12)

레거시 통합 DB API(`db-api`)는 service role key로 RLS를 우회하며, `getAll`을 제외한 모든 액션(`getOne`, `where`, `update`, `insert`, `delete`, `findByEmail`, `settingSet` 등)에 호출자 본인 데이터인지 검증하는 로직이 없었음. 인증된 사용자라면 누구나 자신의 `users.level`을 임의로 올려 관리자 권한을 얻거나, 다른 강사의 데이터를 조회/수정할 수 있는 치명적 취약점.

프론트엔드는 이미 Supabase 클라이언트 + RLS로 직접 통신하도록 전환되어 `db-api`를 사용하지 않았으므로, 함수를 Supabase 대시보드에서 완전히 삭제하고 `setup.sh`/`setup.js`의 배포 목록에서도 제거함. 코드는 `supabase/functions/_deprecated/db-api/`에 사유와 함께 보관.

> ⚠️ 2026-06-12 추가 발견/수정: 위 작업 당시 실제로는 코드가 `supabase/functions/db-api/`(원래 위치)에 그대로 남아있고 `_deprecated/db-api/`는 존재하지 않는 불일치가 있었음 (README와 실제 저장소 상태가 다름). `supabase/functions/db-api/index.ts`를 삭제하고 `_deprecated/db-api/`만 남도록 정리 완료. — 이 항목은 이제 README와 실제 상태가 일치함.

#### 테스트 방법

- Supabase 대시보드 → Edge Functions 목록에 `db-api`가 **없는지** 확인 (있다면 다시 삭제)
- 일반적인 로그인/학생 관리/출석 체크 등 강사 화면 기능이 평소처럼 정상 동작하는지 확인 (db-api 미사용 전환은 기존부터 적용되어 있었으므로 영향 없어야 함)

### 카카오/네이버 로그인 — 예측 가능한 임시 비밀번호 제거 (2026-06-12)

기존에는 `kakao-oauth`/`naver-oauth`가 `kakao_${providerId}_${SUPABASE_JWT_SECRET.slice(0,8)}` 형태의 임시 비밀번호를 만들어 로그인할 때마다 해당 Auth 계정의 비밀번호를 이 값으로 덮어쓴 뒤 `signInWithPassword`로 세션을 발급했음.

- `SUPABASE_JWT_SECRET` 앞 8자리는 프로젝트 전체에서 동일한 값이라, 어떤 경로로든 노출되면 `providerId`만 알아도 그 계정에 로그인 가능
- 더 큰 문제는, 이메일/비밀번호로 가입한 계정과 같은 이메일로 카카오/네이버 로그인을 하면 사용자가 직접 정한 비밀번호가 매번 이 예측 가능한 값으로 덮어써져 계정 탈취 위험이 생김

→ 비밀번호를 생성·변경하지 않고, `auth.admin.generateLink({ type: 'magiclink' })`로 발급한 토큰을 서버에서 바로 `verifyOtp`로 세션 교환하는 방식으로 교체. 사용자 화면 동작(버튼 클릭 시 자동 로그인)은 동일하며, 비밀번호는 더 이상 관여하지 않음.

#### 테스트 방법

- 카카오 로그인 버튼 클릭 → 정상적으로 로그인되어 강사 화면으로 진입하는지 확인 (기존 가입 계정 1개 + 신규 가입 계정 1개로 각각 테스트)
- 네이버 로그인도 동일하게 확인
- (선택) 이메일/비밀번호로 가입한 계정과 동일한 이메일의 카카오/네이버 계정이 있다면, 카카오/네이버 로그인 후에도 기존 이메일/비밀번호로 여전히 로그인되는지 확인 (비밀번호가 덮어써지지 않아야 함)

### 학부모 앱(/parent-login, /parent-invite) 전면 복구 — RPC 기반으로 전환 (2026-06-12)

2026-06-12 RLS 강화(`students`/`classes`/`attendance`/`users`를 "teacher_id = 본인" 또는 관리자만 조회 가능하도록 제한) 이후, 로그인 세션이 없는 학부모는 이 테이블들을 전혀 읽거나 쓸 수 없게 되어 학부모 앱이 사실상 전부 동작하지 않는 상태였음.

- `/parent-login` 1단계(전화번호 확인)가 로컬 캐시(`ParentMembers.all()`)를 사용 → 학부모 브라우저에는 캐시가 비어있어 100% "가입 정보를 찾을 수 없습니다" 오류
- 1단계를 통과해도 `/parent-login`·`/parent-invite`의 대시보드(ParentHome)가 학생/수업/선생님/출석 데이터를 로컬 캐시·`teacher_id` 기준 RLS로 가져오려 하여 항상 빈 화면
- `/parent-invite` 가입 처리(`parent_members` insert, `students.parent_joined` update, `teacher_parent_links` 생성)도 동일한 RLS에 막혀 실패 → 로컬 대기열에만 쌓이고 서버에 반영 안 됨

→ `supabase/004_parent_app_rpc.sql`에 학부모 전화번호 기준으로만 동작하는 security definer RPC 5종을 추가하고, `ParentLogin.jsx`/`ParentInvite.jsx`가 이를 사용하도록 전면 수정:

| RPC | 용도 |
|-----|------|
| `parent_login_lookup` | 재로그인 1단계: 가입 여부 + PIN 설정 여부 확인 |
| `get_parent_dashboard` | 학생/수업/담당교사/출석 데이터 일괄 조회 |
| `get_invite_info` | 초대 링크 진입 시 선생님 정보 + 매칭 학생 조회 |
| `parent_join` | 가입 처리(`parent_members` upsert, 학생 `parent_joined` 표시, `teacher_parent_links` 생성) |
| `parent_save_push_subscription` | 푸시 구독 정보 저장 |

적용 방법: Supabase Dashboard → SQL Editor에서 `supabase/004_parent_app_rpc.sql` 전체 실행 (1회).

#### 테스트 방법

1. 강사 계정으로 로그인 → 학생 한 명의 상세/문자발송 메뉴에서 **학부모 초대 링크** 생성
2. 그 링크를 다른 환경(시크릿 모드 / 다른 브라우저 / 휴대폰)에서 열기
3. 약관 동의 → 가입 진행 → 가입 완료 후 **학생 정보·연결된 수업·출석 현황**이 표시되는지 확인
4. 같은 환경에서 `/parent-login`으로 다시 접속 → 전화번호 입력 → PIN 입력 → 2단계에서 본 화면과 동일하게 보이는지 확인 (재로그인 테스트)

이상이 있으면(오류 메시지, 빈 화면 등) 화면을 캡처해 확인.

### 로그인 화면 "아이디 찾기"/"비밀번호 초기화" 복구 — RPC 기반으로 전환 (2026-06-12)

`/login` 화면의 "아이디 찾기"(전화번호 → 이메일)와 "비밀번호 초기화"(이메일 존재·provider 확인)는 모두 `Users.all()`(로컬 캐시)을 사용했음. 비로그인 상태에서는 `users` 테이블 RLS("본인 행 또는 관리자")로 인해 캐시가 항상 비어 있어 두 기능 모두 100% "등록된 정보가 없습니다"로 실패함.

→ `supabase/005_auth_lookup_rpc.sql`에 최소 정보만 반환하는 security definer RPC 2종 추가:

| RPC | 용도 |
|-----|------|
| `find_email_by_phone` | 전화번호로 가입된 이메일 1건 조회 (아이디 찾기) |
| `get_user_auth_info` | 이메일 존재 여부 + 로그인 provider만 반환 (비밀번호 초기화 사전 확인) |

`Auth.jsx`의 `handleFindId`, `handleFpSend`가 이 RPC를 사용하도록 수정. 적용 방법: Supabase Dashboard → SQL Editor에서 `supabase/005_auth_lookup_rpc.sql` 전체 실행 (1회).

#### 테스트 방법

- 로그인 화면 → **아이디 찾기** → 가입된 전화번호 입력 → 마스킹된 이메일(예: `ab***@example.com`)이 표시되는지 확인
- 등록되지 않은 전화번호로는 "등록된 연락처가 없습니다"가 나오는지 확인
- 로그인 화면 → **비밀번호 초기화** → 가입된(이메일 가입) 이메일 입력 → 인증번호 발송 단계로 넘어가는지 확인
- 카카오/네이버로 가입한 계정의 이메일을 입력하면 "OOO 소셜 로그인 계정입니다" 안내가 나오는지 확인

### 로그인 brute-force 방어 (2026-06-12)

`Auth.jsx`의 `loginAttemptsRef`(5회 실패 시 잠금)는 `useRef` 기반으로 브라우저 메모리에만 존재 → 새로고침/다른 브라우저/시크릿 모드에서는 즉시 초기화되어 사실상 잠금 효과가 없음.

→ 확인 결과, Supabase 프로젝트 자체의 **Rate Limit**(Authentication → Rate Limits → "Rate limit for sign-ups and sign-ins": 30 requests / 5분 / IP)이 이미 서버 단에서 동작 중이며, 이건 새로고침이나 다른 브라우저로 우회할 수 없음. 클라이언트의 `loginAttemptsRef`는 사용자에게 빠른 피드백을 주는 보조 UX일 뿐, 실제 방어는 Supabase 쪽에서 이루어지고 있음 — **추가 조치 불필요**.

#### 테스트 방법 (필요 시)

- Supabase Dashboard → Authentication → **Rate Limits**에서 "Rate limit for sign-ups and sign-ins" 값(기본 30/5분)이 유지되고 있는지 확인. 더 엄격하게 하고 싶다면 이 값을 낮출 수 있음(예: 10/5분).

### Supabase Auth "Confirm email" 설정 확인 (2026-06-12)

이 앱은 자체 이메일 인증(인증번호 발송/확인, `verify_codes` 테이블)을 거쳐 회원가입을 진행함. 만약 Supabase Auth의 **"Confirm email"** 옵션이 켜져 있으면, `authSignUp()` 직후 세션이 생성되지 않아 바로 이어지는 `Users.insert(user)`가 `users_insert` RLS(`auth_id = auth.uid()`)를 통과하지 못해 **Auth 계정만 생성되고 `users` 테이블에는 강사 정보가 저장되지 않는 반쪽 가입** 상태가 될 수 있음.

→ 확인 결과, Supabase Dashboard → Authentication → Sign In / Providers → **"Confirm email"이 OFF**로 설정되어 있어 현재는 문제 없음. **이 설정은 절대 켜면 안 됨** — 켜는 순간 이메일/비밀번호 회원가입이 깨짐.

#### 테스트 방법 (정기 점검 시)

- Supabase Dashboard → Authentication → **Sign In / Providers** → "Confirm email" 토글이 **꺼져 있는지(OFF)** 확인
- 새 이메일로 회원가입 진행 → 가입 즉시 로그인되고, Supabase Dashboard → Authentication → Users에 해당 계정이 보이는지 + `users` 테이블에도 같은 사용자의 행이 생성되는지 확인

### "비밀번호 초기화"가 실제로 비밀번호를 바꾸지 않던 문제 수정 (2026-06-12)

위 항목들을 점검하다가 발견한 별도 버그: 로그인 화면 "비밀번호 초기화"의 마지막 단계(`handleFpReset`)가 `authResetPassword(email)`(= `supabase.auth.resetPasswordForEmail`)을 호출했는데, 이 함수는:

- 사용자가 입력한 새 비밀번호(`fpNewPw`)를 **전혀 사용하지 않음** (파라미터 자체가 없음) — Supabase가 "비밀번호 재설정 링크"가 담긴 이메일을 한 번 더 보낼 뿐, 그 링크를 클릭하는 절차가 앱에 없어서 **비밀번호는 그대로 유지됨**
- 화면에는 "변경 완료"가 뜨지만 실제로는 기존 비밀번호로 로그인해야 함 → 사용자가 새로 입력한 비밀번호로는 로그인 불가, 혼란 유발
- 게다가 Supabase 자체 메일 발송은 **시간당 2건**으로 제한되어 있어(Authentication → Rate Limits → "Rate limit for sending emails"), 여러 사용자가 동시에 시도하면 추가 오류 발생 가능

→ 새 Edge Function `reset-password-self`를 추가: 앱이 이미 보낸 인증번호(`verify_codes`, `purpose='reset'`)를 서버에서 검증하고, **로그인 세션 없이도** service role 권한으로 곧바로 비밀번호를 변경. Supabase의 메일 발송 기능을 더 이상 사용하지 않으므로 위 메일 발송 한도와도 무관함.

적용 방법: Supabase Dashboard에서 `reset-password-self` Edge Function을 새로 배포 (`supabase/functions/reset-password-self/index.ts`).

#### 테스트 방법

1. 로그인 화면 → 비밀번호 초기화 → 가입된 이메일 입력 → 인증번호 발송 → 인증번호 입력 → 확인
2. 새 비밀번호 입력 후 "비밀번호 변경 완료" 클릭
3. 로그아웃 후, **새로 입력한 비밀번호로 로그인되는지** 확인 (기존 비밀번호로는 로그인되지 않아야 함)
4. 같은 인증번호로 다시 시도하면 "인증번호가 올바르지 않거나 만료되었습니다"가 뜨는지 확인 (재사용 방지)

### reset-password-self / reset-user-password 폴더 혼동 수정 (2026-06-12)

위 항목(8번) 적용 과정에서, 새로 만든 `reset-password-self`(본인 인증코드로 비밀번호 변경) 코드가 잘못 기존 `reset-user-password`(관리자가 다른 사용자 비밀번호 초기화) 폴더에 덮어써지는 사고가 있었음. 그 결과:

- `reset-password-self` 폴더/함수가 존재하지 않아 "비밀번호 초기화"(본인) 기능이 동작 불가
- `reset-user-password`에는 관리자 권한 검증이 없는 본인-인증코드 코드가 들어가 있어, `Admin.jsx`의 "선생님 비밀번호 초기화"(관리자용, `{authId, newPassword}` + 관리자 세션) 기능이 동작 불가
- 두 비밀번호 초기화 기능이 모두 깨진 상태였음

→ `reset-user-password/index.ts`를 원래의 관리자 전용 코드로 복원하고, `reset-password-self/index.ts`를 별도 폴더로 새로 배포하여 정상화.

#### 테스트 방법

- Supabase Dashboard → Edge Functions 목록에 `reset-password-self`와 `reset-user-password`가 **각각 별도 함수로** 존재하는지 확인 (총 7개)
- 관리자 화면 → "선생님 비밀번호 초기화" → 정상 동작 확인 (관리자 권한 없는 계정으로 시도 시 거부되는지도 확인 가능하면 함께 확인)
- 로그인 화면 → "비밀번호 초기화"(본인) → 8번 항목의 테스트 방법대로 재확인

### Parent RPC / 아이디찾기 RPC 응답 데이터 최소화 (2026-06-12)

2026-06-12에 추가한 RPC들을 점검한 결과, 일부가 필요한 것보다 많은 데이터를 반환하고 있었음:

- **`find_email_by_phone`**: 원본 이메일 전체를 반환 → 프론트에서 마스킹하지만, anon key로 RPC를 직접 호출하면 마스킹 없는 원본 이메일을 받을 수 있었음
- **`get_invite_info`**: `to_jsonb(u)`로 `users` 테이블의 **모든 컬럼**(`level`, `permission_overrides`, `auth_id`, `provider_id` 등 포함)을 비로그인 사용자에게 그대로 반환
- **`get_parent_dashboard`**: `students`/`classes`/`attendance`의 `to_jsonb(...)`도 전체 컬럼을 반환

→ 다음과 같이 수정:

- `find_email_by_phone`: 서버에서 직접 마스킹(`ab***@example.com` 형태)한 문자열만 반환 — 원본 이메일은 어떤 경로로도 노출되지 않음
- `get_invite_info`: 선생님 정보를 `id`, `name`, `nickname`, `phone` 4개 컬럼만 반환
- `get_parent_dashboard`: 학생은 `id`/`name`/`grade`/`class_num`/`class_ids`, 수업은 화면에 표시되는 필드만, 출석은 `student_id`/`class_id`/`status`/`date`/`marked_at`/`absent_reason`/`home_return`/`note`만 반환

적용 방법: Supabase Dashboard → SQL Editor에서 `supabase/004_parent_app_rpc.sql`, `supabase/005_auth_lookup_rpc.sql` 전체 재실행(`create or replace function`이라 안전하게 덮어써짐).

⚠️ 잔존 위험: `find_email_by_phone`은 원본 이메일 노출은 막았지만, 전화번호를 무작위로 대입해 "이 번호가 가입되어 있는지/마스킹된 이메일 일부+도메인"을 알아내는 시도 자체를 막는 호출 빈도 제한(rate limit)은 아직 없음. 추후 필요 시 별도 rate-limit 테이블 또는 CAPTCHA 도입 검토.

#### 비밀번호 초기화 RPC도 동일하게 점검 필요

`get_user_auth_info`(이메일 존재+provider 확인)는 이미 `found`/`provider` 2개 값만 반환하므로 추가 수정 불필요.

### `parent_joined`/`moved_to_manage` boolean sanitize 복구 (2026-06-12)

`db-api` 제거 시, `students` 테이블의 `parent_joined`/`moved_to_manage` 컬럼에 빈 문자열(`''`)이 들어오면 `false`로 변환해주던 `sanitize()`가 함께 사라짐.

확인 결과 `src/lib/db.js`의 `Students.update`/`insert`(앱의 학생 수정 화면이 실제로 사용하는 경로)는 자체 `sanitizeStudentBooleans()`로 이미 보호되고 있었으나, `src/lib/supabase.js`의 `dbCall('insert'/'update'/'upsert', 'students', ...)` 경로에는 동일 처리가 없었음(현재는 미사용 경로지만 추후 사용 시 동일 오류 재발 가능).

→ `dbCall`에도 동일한 `sanitize()`를 추가하여 `parent_joined`/`moved_to_manage`(boolean)와 `parent_invite_sent_at`/`student_start_date`/`student_end_date`/`created_at`/`updated_at`(nullable 날짜)을 일관되게 처리.

#### 테스트 방법

- 학생 추가/수정 화면에서 "학부모 가입"/"관리이동" 관련 체크박스를 건드리지 않고 저장해도 오류 없이 저장되는지 확인

### settings 테이블 시크릿 노출 + 위장 service role 정책 제거 (2026-06-12)

**1) `settings` select 정책으로 API 시크릿이 모든 로그인 사용자에게 노출됨**

`settings_select` 정책이 `auth.uid() is not null`로 되어 있어, 로그인한 사용자라면 권한 레벨과 무관하게 `settings` 테이블 전체를 select 할 수 있었음. `src/lib/db.js`의 `loadAll()`이 `supabase.from('settings').select('*')`를 그대로 호출하기 때문에, 응답 자체에 다음이 포함되어 있었음:

- `email`(Resend API Key), `solapi`(API Key/Secret, 카카오 채널ID) — localStorage에는 저장되지 않지만 네트워크 응답에는 그대로 노출 → 개발자도구 Network 탭에서 누구나 확인 가능
- `social`(네이버 클라이언트 ID/Secret, 카카오/구글 설정) — EXCLUDE 대상이 아니어서 `naverClientSecret`이 모든 사용자의 `localStorage(asa_settings_social)`에 평문 저장됨
- `regionMap`(학교 지역 매핑 + NEIS API 키) — `neisApiKey`도 동일하게 평문 노출됨

→ **수정**: `social.naverClientSecret`을 `social_secret` 키로, `regionMap.neisApiKey`를 `regionMap_secret` 키로 분리(`006_settings_secret_lockdown.sql`)하고, `settings_select` 정책을 `is_admin() OR key NOT IN ('email','solapi','social_secret','regionMap_secret')`로 변경. `src/lib/db.js`에 관리자 전용 `SecretSettings.get/set`(localStorage 미캐싱) 헬퍼를 추가하고, `AdminSettings.jsx`(소셜 로그인/지역 관리 탭)·`Admin.jsx`(지도 드릴다운 NEIS 조회)·`naver-oauth` Edge Function이 새 키 구조를 사용하도록 수정.

**2) `settings`/`teacher_parent_links`/`points`/`branches`에 위장 "service role full access" 정책 존재**

`pg_policies` 점검 중 4개 테이블에 `"service role full access"`라는 이름의 정책이 `roles={public}`, `qual=true`, `with_check=true`로 설정되어 있는 것을 발견. 이름과 달리 `service_role`이 아닌 **anon을 포함한 모든 사용자**에게 적용되며, 동일 명령에 대한 다른 정책과 OR로 합쳐지므로 `is_admin()` 등 다른 모든 제한을 무력화하는 치명적 정책이었음. (참고: Supabase service_role 키는 원래 RLS를 자동 우회하므로 이런 정책은 불필요함.)

→ **수정** (`007_remove_public_service_role_policies.sql`):
- `settings`, `teacher_parent_links`: 위장 정책 삭제만으로 충분 (기존 `settings_select`/`teacher_parent_links_all` 정책이 정상 보호)
- `points`: 위장 정책 삭제 + `revenue_fees`와 동일 패턴(`teacher_id = get_my_user_id() OR is_admin()`)으로 `points_all` 정책 신규 추가
- `branches`: 위장 정책 삭제 + `school_info`와 동일 패턴(select: 로그인 사용자 전체, write: 관리자만)으로 `branches_select`/`branches_write` 정책 신규 추가

#### 테스트 방법

- 관리자 계정: AdminSettings → 소셜 로그인 / 지역·학교 관리 탭에서 네이버 Secret·NEIS API 키가 정상 표시·저장되는지, Admin 지도 드릴다운에서 NEIS 학생수 조회가 동작하는지 확인
- 일반 강사 계정: 로그인 후 개발자도구 Network 탭에서 `settings` select 응답에 `email`/`solapi`/`social_secret`/`regionMap_secret`이 없는지, 포인트·지사 정보 등 기존 기능이 정상 동작하는지 확인
- `select * from pg_policies where qual = 'true' and policyname ilike '%service role%';` 결과가 빈 값인지 확인

> ⚠️ 위 1)번 항목으로 인해 노출되었던 네이버 Client Secret / NEIS API Key(및 설정되어 있었다면 Resend/Solapi 키)는 재발급(rotate) 권장.

### `get_parent_dashboard` RPC — PIN 검증 강제 (2026-06-12)

`/parent-login` 화면은 "전화번호 → PIN 4자리" 순서로 진행하지만, 실제 데이터를 가져오는 `get_parent_dashboard(p_phone)` RPC 자체에는 PIN 검증이 없었음. `app_joined = true`인 전화번호만 알면 anon 사용자도 직접 호출하여 학생 이름·학년·반·출결 기록·담당 선생님 이름/전화번호를 조회할 수 있는 상태였음.

휴대폰 번호는 `010-XXXX-XXXX` 패턴이라 완전한 비밀값이 아니므로, 프론트에서의 PIN 검증만으로는 부족함 — RPC 내부에서도 PIN을 재검증하도록 강제.

**수정 내용:**

`get_parent_dashboard(p_phone, p_pin DEFAULT NULL)` — `p_pin` 파라미터 추가, 내부 PIN 검증 로직 삽입

| 상황 | 동작 |
|------|------|
| `pin_hash` 설정된 회원 + 올바른 PIN | ✅ 데이터 반환 |
| `pin_hash` 설정된 회원 + PIN 없거나 틀림 | ❌ 빈 데이터 반환 (오류 메시지 없음 — timing attack 방지) |
| `pin_hash` 미설정 회원 + PIN 없음 | ✅ 허용 (초대 직후 PIN 등록 전 상태) |

- `src/lib/supabase.js` — `loadParentDashboard(normalizedPhone, pin = null)` 에 `pin` 파라미터 추가. `pin !== null` 일 때만 `p_pin` 전달
- `src/pages/ParentLogin.jsx` — `verify_parent_pin` 성공 후 `loadParentDashboard(normalized, currentPin)`, `set_parent_pin` 성공 후 `loadParentDashboard(normalized, pin)` 으로 교체
- `src/pages/ParentInvite.jsx` — 초대 직후는 PIN 미설정 상태이므로 `pin=null` 유지 (주석 추가)
- `supabase/004_parent_app_rpc.sql` — `get_parent_dashboard` 재실행 (1회)

#### 적용 방법

1. Supabase Dashboard → **SQL Editor** → `supabase/004_parent_app_rpc.sql` 전체 실행 (`create or replace` 이므로 안전하게 덮어써짐)
2. 파일 교체:
   ```
   src/lib/supabase.js
   src/pages/ParentLogin.jsx
   src/pages/ParentInvite.jsx
   ```

#### 테스트 방법

**① 학부모 재로그인 (PIN 설정 완료 회원)**
1. `/parent-login` → 전화번호 입력 → PIN 4자리 입력
2. 대시보드(학생/수업/출석) 정상 로드 확인

**② PIN 없이 RPC 직접 호출 차단 확인**
1. 브라우저 콘솔 또는 Supabase API 탐색기에서 아래 호출:
   ```js
   supabase.rpc('get_parent_dashboard', { p_phone: '01012345678' })
   ```
2. 응답이 `{ students: [], classes: [], teachers: [], attendance: [] }` 빈 데이터인지 확인 (PIN 없이 차단됨)

**③ 초대 가입 직후 (PIN 미설정)**
1. 초대 링크 → 약관 동의 → 가입 완료 후 대시보드 정상 로드 확인 (가입 플로우 깨지지 않아야 함)

**④ PIN 최초 설정 (기존 미설정 회원)**
1. `/parent-login` → 전화번호 입력 → PIN 설정 화면 → 4자리 설정 → 재확인
2. 대시보드 정상 로드 확인

### `verify_codes` 테이블 RLS 활성화 (2026-06-12)

`verify_codes` 테이블이 `000_complete_schema.sql`에 포함되지 않아 RLS가 비활성화된 채 운영 중이었음. anon 사용자가 테이블 전체를 직접 SELECT할 수 있는 상태 — 회원가입 인증번호, 비밀번호 초기화 코드, 학부모 초대 토큰이 노출될 수 있었음.

**접근 주체 분석:**

| 주체 | 클라이언트 | 필요 권한 |
|------|-----------|----------|
| `Auth.jsx` (회원가입/비밀번호 초기화) | anon | INSERT, SELECT(본인 target), UPDATE(used=true) |
| `ParentInvite.jsx` (초대 토큰 검증) | anon | SELECT(본인 target) |
| `reset-password-self` Edge Function | service role | SELECT, UPDATE (RLS 우회) |

단순 `using (false)` 차단은 프론트 코드를 모두 깨뜨리므로, **anon이 자기 target의 행만 접근할 수 있는 정책**으로 설계.

**정책 설계:**

| 정책 | 조건 |
|------|------|
| INSERT | `with check (true)` — 서버에서 이메일 유효성 확인 후 삽입 |
| SELECT | `used = false AND expires_at > now()` — 만료·소진된 코드 조회 불가 |
| UPDATE | `using (true)` — used=true 처리 허용 |
| DELETE | `using (false)` — 차단 |

**수정 내용:**

- `supabase/008_verify_codes_rls.sql` — 신규 파일 (기존 운영 DB에 적용)
- `supabase/000_complete_schema.sql` — `verify_codes` 테이블 정의 + RLS 정책 추가 (신규 프로젝트 대비)

**적용 방법:**

```
Supabase Dashboard → SQL Editor → supabase/008_verify_codes_rls.sql 전체 실행
```

`create or replace` / `drop policy if exists` 구조이므로 재실행해도 안전.

**사이드 이펙트 없음:** `Auth.jsx`, `ParentInvite.jsx`의 `.eq('target', value)` 조건부 쿼리는 정책 통과. `reset-password-self` Edge Function은 service role로 RLS 우회.

---

### `send-email` Edge Function 인증번호 노출 차단 및 만료 시간 표기 수정 (2026-06-12)

Resend API 키가 설정되지 않은 상태에서 `send-email` Edge Function이 `{ success: true, dev: true, code: "인증번호" }`를 응답에 포함하고 있었음. 프론트(`Auth.jsx`, `Profile.jsx`)는 이 `devCode` 값을 state에 저장해 화면에 직접 표시 — 회원가입·비밀번호 초기화·본인 인증 흐름에서 인증번호가 UI에 노출되는 구조였음.

또한 이메일 HTML 본문에 "10분 이내 입력해주세요"라고 표기되어 있었으나, 실제 `verify_codes` 만료 시간은 `Auth.jsx`에서 **5분**으로 설정되어 있어 불일치 상태였음.

**수정 내용:**

- `supabase/functions/send-email/index.ts` — Resend 키 미설정 시 `503` 에러 반환으로 변경. 응답에 `code` 필드 제거. 이메일 HTML "10분" → "5분" 수정
- `src/pages/Auth.jsx` — `isDev`, `devCode`, `fpDev`, `verifyCode` state 및 dev 분기 전부 제거. 인증 실패 시 에러 메시지 표시
- `src/pages/Profile.jsx` — `devCode` state 및 dev 분기 제거. Supabase 미설정 시 에러 메시지 표시

**결과:** 어떤 환경에서도 인증번호가 화면·응답에 노출되는 경로 없음. Resend 키 미설정 시 인증 자체가 실패하여 관리자가 즉시 인지 가능.

**적용 방법:**

1. `supabase/functions/send-email/index.ts` 교체 후 Edge Function 재배포
   ```
   Supabase Dashboard → Edge Functions → send-email → Code → Deploy updates
   ```
2. 소스 파일 2개 교체 (이미 적용됨):
   ```
   src/pages/Auth.jsx
   src/pages/Profile.jsx
   ```

**사이드 이펙트 없음:** `App.jsx`, `Admin.jsx`의 `sendEmail` 호출은 모두 `try/catch`로 감싸져 있어 영향 없음. 정상 설정(Resend 키 등록) 환경에서 동작 100% 동일.

---

### `generate-vapid` Edge Function 삭제 (2026-06-12)

초기 VAPID 키 생성 후 설정 테이블(`settings`)에 저장한 뒤에는 이 함수가 불필요함. 그런데 별도 인증 체크 없이 anon 사용자도 호출 가능한 상태였음 — 외부에서 호출하면 새 VAPID 키쌍이 생성되어 기존 푸시 구독들이 전부 무효화될 수 있음.

→ Supabase Dashboard → Edge Functions에서 `generate-vapid` 삭제 완료.  
VAPID 키는 이미 `settings` 테이블에 저장되어 있으므로 삭제해도 기존 푸시 알림 동작에 영향 없음.

> ⚠️ 2026-06-12 추가 발견/수정: 함수는 삭제되었으나 `setup.sh` 63번 줄에 `supabase functions deploy generate-vapid` 라인이 잔존해 있었음. `bash setup.sh` 재실행 시 삭제된 함수가 다시 배포되는 문제. `setup.sh`에서 해당 라인 제거 및 배포 카운트 `(8개)` → `(7개)` 수정 완료. `supabase/functions/_deprecated/generate-vapid/` 폴더도 함께 삭제.

현재 배포된 Edge Functions (총 7개):

| 함수 | 역할 |
|------|------|
| `kakao-oauth` | 카카오 로그인 |
| `naver-oauth` | 네이버 로그인 |
| `reset-password-self` | 본인 인증코드 확인 후 비밀번호 변경 |
| `reset-user-password` | 관리자 전용 선생님 비밀번호 초기화 |
| `send-email` | 이메일 발송 (Resend) |
| `send-push` | 출석 알림 푸시 발송 |
| `send-sms` | SMS/알림톡 발송 (Solapi) |

### `App.jsx` — `blog_write` 라우팅 누락 수정 (2026-06-12)

`Sidebar.jsx`에 `path: 'blog_write'`가 메뉴로 등록되어 있었으나 `App.jsx`의 라우팅 switch에 `case 'blog_write':` 가 없었음. `BlogWrite.jsx` import도 누락. 블로그 메뉴를 클릭하면 default 케이스인 대시보드로 떨어지는 버그.

→ `App.jsx` 상단에 `BlogWrite` import 추가, switch에 `case 'blog_write':` 케이스 추가.

**수정 파일:** `src/App.jsx`

---

### `send-push/index.ts` — Authorization 검사 추가 (2026-06-12)

`send-sms`에는 Bearer 토큰 인증이 추가되어 있었으나 `send-push`에는 누락되어 있었음. CORS로 브라우저 호출은 막히지만 curl 등 서버 직접 호출은 열려 있어, anon key가 노출되면 누구나 학부모 기기에 임의 푸시를 보낼 수 있는 취약점.

→ `try` 블록 최상단에 `send-sms`와 동일한 패턴으로 Bearer 토큰 체크 추가.

**파급 범위:** 프론트 `callFunction()`이 이미 `Authorization: Bearer ${SUPABASE_ANON}`을 포함하고 있어 프론트 코드 수정 불필요.

**수정 파일:** `supabase/functions/send-push/index.ts`

---

### `App.jsx` — `BlogWrite` `onLogout` prop 누락 수정 (2026-06-12)

`BlogWrite`는 헤더 우측에 자체 🚪 로그아웃 버튼을 가지고 있고, 이를 위해 `onLogout` prop을 받는 구조. 그런데 `App.jsx`의 `renderPage()` switch에서 `user`만 전달하고 `onLogout={handleLogout}`이 빠져 있어, 버튼을 클릭해도 `undefined()`가 호출되어 아무 반응이 없는 상태였음.

```jsx
// 수정 전
case 'blog_write':  return <BlogWrite user={user} />

// 수정 후
case 'blog_write':  return <BlogWrite user={user} onLogout={handleLogout} />
```

`handleLogout`은 이미 `Sidebar`에 `onLogout={handleLogout}`으로 전달되고 있는 동일 함수.

**수정 파일:** `src/App.jsx`

---

### `ParentInvite.jsx` — `withdraw_parent` 주석 서명 업데이트 (2026-06-12)

`supabase/009_withdraw_parent_pin.sql`에서 `withdraw_parent` RPC에 PIN 검증 파라미터(`p_pin text DEFAULT NULL`)가 추가되었으나, `ParentInvite.jsx` 160번 줄 주석 블록의 함수 서명만 구버전(`withdraw_parent(p_phone text)`)으로 남아 있었음. 실제 호출 코드(179번 줄)는 이미 `{ p_phone: normalized, p_pin: pin || null }`로 올바르게 호출 중 — 기능 영향 없음. 주석과 코드 불일치로 나중에 이 코드를 보는 사람이 혼란을 겪거나 잘못된 서명으로 테스트할 수 있어 수정.

```js
// 수정 전
// withdraw_parent(p_phone text) RPC:
//   - 전화번호로 parent_members 레코드를 찾아 ...

// 수정 후
// withdraw_parent(p_phone text, p_pin text DEFAULT NULL) RPC:
//   - pin_hash 설정된 회원은 PIN 일치 시에만 탈퇴 처리 (PIN 불일치 시 false 반환)
//   - pin_hash 미설정 회원은 PIN 없이 허용 (초대 직후 상태)
//   - 전화번호로 parent_members 레코드를 찾아 ...
```

**수정 파일:** `src/pages/ParentInvite.jsx`

---

### 업체 포털 RLS 우회 — RPC 전환 (2026-06-12)

`hq_vendors`, `hq_vendor_*`(subjects / products / contents / files / prices), `vendor_accounts` 테이블이 **`for all using (false)`** RLS로 완전 차단되어 있었음. 관리자 포함 anon 클라이언트의 직접 접근이 전부 막혀 있어 업체 관련 기능 전체가 동작 불가 상태였음.

**증상:**

| 기능 | 오류 |
|------|------|
| 업체 로그인 | "이메일 또는 비밀번호가 올바르지 않습니다" |
| 업체 가입 | "연결된 업체 정보가 없습니다" |
| 관리자 업체 관리 화면 | 목록 항상 비어 있음, 저장 시 RLS 위반 오류 |
| 업체 앱 (교구·과목·파일) | 조회/저장 전부 실패 |

**원인:** `VendorAuth.jsx` / `VendorManage.jsx` / `VendorApp.jsx` 가 `dbCall('getAll'/'upsert'/'delete', 'hqVendors' | 'vendorAccounts' | ...)` 형태로 Supabase 클라이언트를 통해 직접 접근. 대응하는 RPC나 Edge Function이 없었음.

**수정 내용:**

- `supabase/migrations/20240001_vendor_rpc.sql` — `SECURITY DEFINER` RPC 함수 26개 추가 (조회 9개 / upsert 7개 / soft delete 5개 / 관리자 전용 5개)
- `src/lib/supabase.js` — `export const vendorRpc` 헬퍼 블록 추가 (기존 export 전부 보존, 파일 끝에 append만)
- `src/pages/VendorAuth.jsx` — `HQVendors` / `VendorAccounts` 내부 구현을 `vendorRpc.*` 로 교체
- `src/pages/VendorManage.jsx` — `HQVendors` / `HQSubjects` / `HQProducts` 내부 구현을 `vendorRpc.*` 로 교체. 원본 버그(`HQProducts.bySubject(s.id).length` — async 함수를 동기로 호출하던 문제)도 함께 수정 → 로드된 `products` state를 직접 필터링하도록 변경
- `src/pages/VendorApp.jsx` — `DB.*` 헬퍼 전체를 `vendorRpc.*` 로 교체. Storage 업로드(`dbCall('storageUpload', ...)`)는 RLS 무관이므로 유지

**사이드 이펙트 없음:** Vendor 3개 파일 외 나머지 전체 파일 무변경 확인 완료.

#### 적용 방법

1. Supabase Dashboard → **SQL Editor** → `supabase/migrations/20240001_vendor_rpc.sql` 전체 붙여넣기 → **Run**
   - 성공 시 하단에 `Success. No rows returned` 표시
2. 소스 파일 4개 교체:
   ```
   src/lib/supabase.js
   src/pages/VendorAuth.jsx
   src/pages/VendorManage.jsx
   src/pages/VendorApp.jsx
   ```

> ⚠️ SQL을 먼저 실행해야 합니다. 파일만 교체하고 SQL을 빠뜨리면 RPC 함수가 없어서 앱이 오류를 냅니다.

#### 테스트 방법

**① 업체 로그인**
1. 브라우저에서 `?vendor=1` 경로 접속
2. 본사에 등록된 업체 이메일/비밀번호 입력 → 로그인 성공, 업체 앱 화면으로 진입
3. 잘못된 이메일/비밀번호 → "이메일 또는 비밀번호가 올바르지 않습니다" 표시 (정상)

**② 업체 가입**
1. `?vendor=1` → 업체 가입 탭
2. 본사에 등록된 전화번호 또는 이메일 입력 → 업체 확인 성공
3. 이메일 인증 → 비밀번호 설정 → 가입 완료 후 업체 앱 화면 진입

**③ 업체 앱 (교구 관리)**
1. 업체 로그인 후 과목 탭 생성 → 저장 확인
2. 교구 등록 → 차시 입력 → 저장 확인
3. 파일 업로드 → 정상 업로드 및 목록 표시 확인
4. 단가 입력 → blur 시 자동 저장 확인

**④ 관리자 업체 관리**
1. 관리자(level 10) 계정으로 로그인
2. 사이드바 → **업체 관리** 클릭 → 업체 목록이 로드되는지 확인
3. 업체 등록 → 저장 → 목록에 반영 확인
4. 업체 수정 → 저장 확인
5. 초대 이메일 발송 → 상태가 "초대 발송"으로 변경 확인
6. 업체 삭제 → 관련 과목·교구도 함께 삭제 확인

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
| `teacher_parent_links` | `teacher_id = get_my_user_id()` 또는 관리자 (위장 `service role full access` 정책 제거, 2026-06-12) |
| `points` | `teacher_id = get_my_user_id()` 또는 관리자 (2026-06-12 신규 추가, 위장 `service role full access` 정책 대체) |
| `branches` | select: 로그인 사용자 전체(`auth.uid() is not null`), write: 관리자만 (2026-06-12 신규 추가, 위장 `service role full access` 정책 대체) |
| `settings` | **select: 관리자 또는 비민감 key**(`is_admin() OR key NOT IN ('email','solapi','social_secret','regionMap_secret')`), insert/update/delete: 관리자만 (2026-06-12 강화) |
| `school_notices` | **select: 본인(`admin_id`) 또는 관리자**, write: 동일 |
| `verify_codes` | **select: `used=false AND expires_at>now()`** (만료·소진 코드 조회 차단), insert: 허용, update: 허용, delete: 차단 (2026-06-12 추가) |

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

- 모든 Edge Function(`send-email`, `send-sms`, `send-push`, `kakao-oauth`, `naver-oauth`, `reset-user-password`)이 `ALLOWED_ORIGIN` 환경변수를 읽음 (`generate-vapid`는 2026-06-12 삭제됨)
- **미설정 시 `*`(전체 허용)으로 열림** — 신규 배포 시 반드시 설정 필요
- 2026-06-12: 콤마(,)로 여러 도메인을 지정할 수 있도록 코드 수정 (예: `https://www.afterschoolrollbook.kr,https://afterschoolrollbook.kr`)
- ⚠️ CORS는 브라우저에서의 호출만 제한함. `send-sms`/`send-email`/`send-push`의 `Authorization: Bearer` 검사는 anon key(공개값) 존재 여부만 확인하므로, 외부에서 anon key로 직접(curl 등) 호출하는 비용 남용은 별도 대응(요청 빈도 제한 등) 필요 — 별도 항목으로 검토 권장

#### 설정 방법

1. GitHub 저장소의 아래 7개 파일을 최신 코드(콤마 다중 도메인 지원)로 반영
   ```
   supabase/functions/send-email/index.ts
   supabase/functions/send-sms/index.ts
   supabase/functions/send-push/index.ts
   supabase/functions/kakao-oauth/index.ts
   supabase/functions/naver-oauth/index.ts
   supabase/functions/reset-user-password/index.ts
   ```
2. Supabase Dashboard → Edge Functions → **Secrets** → `ALLOWED_ORIGIN` 값을 아래로 설정(기존 값이 있어도 덮어쓰기)
   ```
   https://www.afterschoolrollbook.kr,https://afterschoolrollbook.kr
   ```
   (apex 도메인 접속이 안 되면 `https://www.afterschoolrollbook.kr` 하나만 입력해도 됨)
3. 위 7개 함수를 **각각** Edge Functions → 해당 함수 → Code 탭에서 1번 코드로 교체 → **Deploy updates**
   (Secrets는 공통 적용되지만 코드 자체는 함수별로 재배포해야 반영됨)

#### 테스트 방법 (배포 후)

- `https://www.afterschoolrollbook.kr`에서 정상 동작 확인: 카카오/네이버 로그인, 회원가입 시 이메일 인증코드 발송, 문자(SMS) 발송, 출석 알림 푸시
- 브라우저 개발자 도구 → **Network** 탭에서 위 동작 중 호출되는 `*.supabase.co/functions/v1/...` 요청을 클릭 → **Response Headers**에서 `Access-Control-Allow-Origin` 값이 `https://www.afterschoolrollbook.kr`(요청한 도메인)으로 나오는지 확인
  - 값이 `*`로 보이면 → `ALLOWED_ORIGIN`이 비어있거나 코드가 재배포되지 않은 상태
  - 값이 빈 문자열이거나 요청 자체가 실패하면 → `ALLOWED_ORIGIN`에 등록된 도메인과 실제 접속 도메인이 다른 경우 (www 유무 등) — Secrets 값에 도메인 추가

### 배포 체크리스트

새 Supabase 프로젝트 생성 또는 재배포 시 반드시 확인:

- [ ] `supabase/000_complete_schema.sql` 실행 (RLS + PIN 함수 포함)
- [ ] (기존 운영 DB 재배포 시) `supabase/006_settings_secret_lockdown.sql`, `supabase/007_remove_public_service_role_policies.sql` 순서대로 실행 — `settings` 시크릿 분리/잠금 + 위장 `service role full access` 정책 제거
- [ ] (기존 운영 DB 재배포 시) `supabase/migrations/20240001_vendor_rpc.sql` 실행 — 업체 포털 RPC 함수 26개 추가
- [ ] (기존 운영 DB 재배포 시) `supabase/008_verify_codes_rls.sql` 실행 — `verify_codes` RLS 활성화
- [ ] (기존 운영 DB 재배포 시) `supabase/009_withdraw_parent_pin.sql` 실행 — 학부모 탈퇴 처리 RPC(`withdraw_parent`) 추가
- [ ] (기존 운영 DB 재배포 시) `supabase/004_parent_app_rpc.sql` 재실행 — `get_parent_dashboard` PIN 검증 강제 추가
- [ ] `supabase/functions/send-email/index.ts` 재배포 — Resend 키 미설정 시 인증번호 노출 차단
- [ ] Supabase Secrets에 `ALLOWED_ORIGIN` 설정
- [ ] Supabase Secrets에 `SVC_ROLE_KEY` 설정
- [ ] 관리자 계정으로 로그인 후 서비스 설정에서 Resend·Solapi 키, 소셜 로그인(네이버 Secret), NEIS API 키 등록
- [ ] Edge Functions 배포 (`setup.bat` 또는 `bash setup.sh`) — 총 7개 함수 배포됨

### 기타

- `send-email` Edge Function: Resend API 키 미설정 시 인증번호를 응답에 포함하던 dev 모드 제거 (2026-06-12). 키 미설정 시 503 에러 반환으로 변경 — 인증번호가 화면·응답에 노출되는 경로 완전 차단
- `send-email` / `send-sms` Edge Function용 API 키(Resend, Solapi)는 `settings` 테이블에 저장되며, 2026-06-12부터 RLS로 관리자만 읽을 수 있음 (이전에는 로그인 사용자 전체가 select 가능했음 — 위 보안 점검 12번 항목 참고)
- `db.js` 동기화 시 `email` / `solapi` / `social_secret` / `regionMap_secret` 키는 `localStorage`에 저장하지 않음 (`EXCLUDE_KEYS`). `social_secret`(네이버 Secret) / `regionMap_secret`(NEIS API 키)는 관리자 화면에서 `SecretSettings.get/set`으로 직접 조회·저장하며 항상 캐싱하지 않음
- Supabase Auth 세션: `sessionStorage` 사용 (탭 닫으면 자동 로그아웃)
- `send-sms` Edge Function: Bearer 토큰 인증 추가 (미인증 요청 401 차단) — URL 노출 시 무단 SMS 발송 방지
- `AdSlot.jsx`: Blob API 실패 시 `dangerouslySetInnerHTML` 폴백 제거 → `null` 반환으로 변경 (XSS 방어)
- 비밀번호 정책: 8자 이상 + 영문 + 숫자 + **특수문자** 조합 필수 (회원가입·비밀번호 재설정 모두 적용)
