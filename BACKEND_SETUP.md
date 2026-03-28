# 방과후 출석부 — 백엔드 설정 가이드

## 전체 순서

```
1. Supabase 프로젝트 생성
2. DB 스키마 실행
3. .env 파일 작성
4. setup.bat 실행 (Edge Functions 자동 배포)
5. Vercel 환경변수 추가
6. 관리자 페이지에서 API 키 등록
```

> ✅ Supabase CLI 설치 불필요 — setup.js가 자동으로 처리합니다

---

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → GitHub 로그인
2. **New project** 클릭
3. 이름: `afterschool-attendance`
4. 데이터베이스 비밀번호 설정 (저장해두기)
5. Region: **Northeast Asia (Seoul)**
6. Create project (1~2분 대기)

---

## 2. DB 스키마 실행

1. Supabase Dashboard → 왼쪽 메뉴 **>_ SQL Editor** 클릭
2. `supabase/migrations/001_initial.sql` 파일 전체 복사
3. SQL Editor에 붙여넣기 → **Run** 클릭
4. 하단에 `Success. No rows returned` 확인

---

## 3. API 키 확인 및 .env 파일 작성

Supabase Dashboard → **Settings → API Keys** 에서 확인

| .env 변수명 | Supabase 항목 |
|------------|--------------|
| `VITE_SUPABASE_URL` | Project URL (대시보드 상단에 표시) |
| `VITE_SUPABASE_ANON_KEY` | **Publishable key** (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret key** (`sb_secret_...`) |

**.env 파일 내용** (afterschool 폴더에 저장):
```
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_여기에입력
SUPABASE_SERVICE_ROLE_KEY=sb_secret_여기에입력
```

> ⚠️ `.env` 파일은 GitHub에 올리지 마세요. (`.gitignore`에 포함되어 있음)

---

## 4. Edge Functions 자동 배포 (setup.bat)

**Windows:**
```
setup.bat 더블클릭
```

**Mac/Linux:**
```bash
bash setup.sh
```

실행 시 진행 순서:
1. [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) 에서 Access Token 발급
   - Generate new token → 이름: `afterschool-setup` → Expires: `Never` → 생성
   - 토큰 복사
2. cmd 창에 토큰 **마우스 오른쪽 클릭**으로 붙여넣기 → 엔터
3. 자동으로 `SVC_ROLE_KEY` Secret 등록 + Edge Functions 4개 배포

배포되는 Functions:
- `db-api` — 통합 DB CRUD
- `send-email` — 이메일 발송 (Resend)
- `send-sms` — SMS/카카오 발송 (Solapi)
- `naver-oauth` — 네이버 로그인

---

## 5. Vercel 환경변수 추가

Vercel Dashboard → 프로젝트 → **Settings → Environment Variables**

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxxxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` (전체 값) |

추가 후 **Redeploy** 실행

---

## 6. 관리자 페이지에서 API 키 등록

배포된 사이트에서 `admin@test.com / admin1234` 로그인 후:  
**사이드바 → 🔧 서비스 설정**

### 📧 이메일 발송 탭 (Resend)
1. [resend.com](https://resend.com) 가입 → API Keys → Create API Key
2. 키 입력 → 활성화 ON → 저장
- 무료 플랜: 월 3,000건 무료
- 자체 도메인 없으면 `onboarding@resend.dev`로 발송

### 📱 문자·알림톡 탭 (Solapi)
1. [solapi.com](https://solapi.com) 가입 → 개발자 → API 관리 → API 키 추가
2. API Key + API Secret 입력
3. 발신번호 등록 (설정 → 발신번호 관리 → 본인 인증)
4. 활성화 ON → 저장
- SMS 1건 약 9~20원 (선불 충전)

### 🔑 소셜 로그인 탭
- **Google**: [console.cloud.google.com](https://console.cloud.google.com) → OAuth 2.0 클라이언트 ID
- **카카오**: [developers.kakao.com](https://developers.kakao.com) → JavaScript 키
- **네이버**: [developers.naver.com](https://developers.naver.com) → 클라이언트 ID + Secret
- 각각 키 입력 → 활성화 ON → 저장

> 모든 키는 Supabase `settings` 테이블에 저장되고  
> Edge Function이 DB에서 읽어서 사용합니다.  
> 키 변경 시 재배포 없이 즉시 적용됩니다.

---

## 동작 방식

```
앱 시작
  ↓
VITE_SUPABASE_URL 환경변수 확인
  ↓ 있음                    ↓ 없음
Supabase에서 데이터 가져와   localStorage만 사용
localStorage에 캐시           (오프라인 모드)

쓰기 (학생 등록, 출석 등)
  → localStorage 즉시 저장 (UI 즉시 반영)
  → Supabase 백그라운드 동기화 (실패해도 UI 영향 없음)
```

---

## 테스트 체크리스트

### 기본 연동
- [ ] Supabase Dashboard → Table Editor → `users` 테이블에 admin/teacher 데이터 확인
- [ ] 사이트 접속 → `admin@test.com / admin1234` 로그인 확인
- [ ] 다른 기기/브라우저에서 접속 → 동일 데이터 확인 (진짜 DB 테스트)

### 이메일 인증
- [ ] 회원가입 → 이메일 인증번호 실제 수신 확인 (Resend 설정 후)

### 데이터 동기화
- [ ] 수업 등록 → Supabase `classes` 테이블 저장 확인
- [ ] 학생 등록 → Supabase `students` 테이블 저장 확인
- [ ] 출석 체크 → Supabase `attendance` 테이블 저장 확인

### 메시지 발송
- [ ] 출석체크 → 학부모 메시지 → 문자 발송 테스트 (Solapi 설정 후)

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 로그인 후 데이터 없음 | Supabase 연결 안됨 | `.env` 키 확인, Vercel 환경변수 확인 |
| 이메일 인증번호 안 옴 | Resend 키 미등록 | 관리자 → 서비스설정 → 이메일 발송 |
| SMS 발송 안됨 | Solapi 키 미등록 | 관리자 → 서비스설정 → 문자·알림톡 |
| 소셜 로그인 안됨 | 소셜 키 미등록 | 관리자 → 서비스설정 → 소셜 로그인 |
| setup.bat 오류 | Node.js 없음 | [nodejs.org](https://nodejs.org) 에서 설치 |
