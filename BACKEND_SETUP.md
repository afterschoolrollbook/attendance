# 방과후 출석부 — Phase 4 백엔드 설정 가이드

## 전체 순서

```
1. Supabase 프로젝트 생성
2. DB 스키마 실행
3. Edge Functions 배포
4. 이메일 서비스 (Resend) 연결
5. Solapi 연결
6. 환경변수 설정
7. Vercel 배포 설정
```

---

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → GitHub 로그인
2. **New project** 클릭
3. 이름: `afterschool-attendance`
4. 데이터베이스 비밀번호 설정 (저장해두기)
5. Region: **Northeast Asia (Seoul)**
6. Create project

---

## 2. DB 스키마 실행

1. Supabase Dashboard → **SQL Editor**
2. `supabase/migrations/001_initial.sql` 파일 전체 복사
3. SQL Editor에 붙여넣기 → **Run** 클릭
4. 성공 메시지 확인

---

## 3. 환경변수 확인

Supabase Dashboard → **Settings → API**

```
Project URL    → VITE_SUPABASE_URL
anon public    → VITE_SUPABASE_ANON_KEY
service_role   → SUPABASE_SERVICE_ROLE_KEY (Edge Function 전용)
```

`.env.example` → `.env` 로 복사 후 값 입력:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. Supabase CLI 설치 및 Edge Functions 배포

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결 (Project Reference ID는 Dashboard URL에서 확인)
supabase link --project-ref xxxxxxxxxxx

# Edge Functions 비밀키 등록
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set RESEND_API_KEY=re_xxxx              # 이메일 (선택)
supabase secrets set SOLAPI_API_KEY=NCSXXX               # SMS (선택)
supabase secrets set SOLAPI_API_SECRET=XXXX              # SMS (선택)
supabase secrets set SOLAPI_SENDER_PHONE=01012345678     # SMS (선택)
supabase secrets set NAVER_CLIENT_ID=XXXX                # 네이버 (선택)
supabase secrets set NAVER_CLIENT_SECRET=XXXX            # 네이버 (선택)

# Edge Functions 배포 (4개)
supabase functions deploy db-api
supabase functions deploy send-email
supabase functions deploy send-sms
supabase functions deploy naver-oauth
```

---

## 5. 이메일 서비스 — Resend 설정 (무료)

1. [resend.com](https://resend.com) 접속 → 회원가입
2. **API Keys** → Create API Key
3. 키 복사 → `supabase secrets set RESEND_API_KEY=re_xxxxx`
4. 도메인 인증 (선택, 커스텀 발신 이메일 사용 시)
   - 무료 플랜: `onboarding@resend.dev` 로 발송 가능
   - 자체 도메인: Domains → Add Domain → DNS 설정

---

## 6. Solapi 설정

1. [solapi.com](https://solapi.com) 접속 → 회원가입
2. **개발자 → API 관리** → API 키 추가
3. API Key + API Secret 복사 → secrets 등록
4. **설정 → 발신번호 관리** → 발신번호 등록 (본인 인증)
5. 충전 → 크레딧 충전 (SMS 1건 약 9~20원)

**카카오 알림톡 추가 설정:**
1. [business.kakao.com](https://business.kakao.com) → 카카오톡 채널 개설
2. Solapi → 카카오 채널 → 채널 연동 → pfId 확인
3. 관리자 페이지 → 서비스설정 → 문자·알림톡에서 pfId 입력

---

## 7. Vercel 배포 설정

1. [vercel.com](https://vercel.com) → GitHub 연결 → 저장소 선택
2. **Environment Variables** 추가:
   ```
   VITE_SUPABASE_URL       = https://xxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJ...
   ```
3. Deploy

---

## 동작 방식

```
앱 시작
  ↓
Supabase 연결 확인 (.env에 URL이 있으면)
  ↓ YES                      ↓ NO
Supabase에서 데이터 가져와    localStorage만 사용
localStorage에 캐시           (Phase 1~3 방식)
  ↓
정상 동작

쓰기 (학생 등록 등)
  ↓
1. localStorage 즉시 저장 (UI 반영)
2. Supabase 백그라운드 동기화
```

---

## 테스트 체크리스트

- [ ] Supabase Dashboard → Table Editor → users 테이블 확인
- [ ] 회원가입 → 이메일 인증번호 실제 수신 확인
- [ ] 학생 등록 → Supabase students 테이블 저장 확인
- [ ] 출석 체크 → attendance 테이블 저장 확인
- [ ] Solapi 테스트 발송 (관리자 → 서비스설정 → 문자·알림톡)
- [ ] 다른 브라우저/기기에서 접속 → 동일 데이터 확인 (진짜 DB 테스트)
