@echo off
chcp 65001 > nul
echo.
echo 📋 방과후 출석부 — 백엔드 자동 설정 (Windows)
echo ================================================
echo.

:: .env 파일 확인
if not exist ".env" (
  echo ❌ .env 파일이 없습니다.
  echo.
  echo .env.example 을 복사해서 .env 를 만들고
  echo VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 채운 후 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

:: .env에서 값 읽기
for /f "tokens=1,2 delims==" %%a in (.env) do (
  if "%%a"=="VITE_SUPABASE_URL"          set SUPABASE_URL=%%b
  if "%%a"=="SUPABASE_SERVICE_ROLE_KEY"  set SERVICE_KEY=%%b
  if "%%a"=="RESEND_API_KEY"             set RESEND_KEY=%%b
  if "%%a"=="SOLAPI_API_KEY"             set SOLAPI_KEY=%%b
  if "%%a"=="SOLAPI_API_SECRET"          set SOLAPI_SECRET=%%b
  if "%%a"=="SOLAPI_SENDER_PHONE"        set SOLAPI_PHONE=%%b
)

:: Project ref 추출
set URL=%SUPABASE_URL%
set URL=%URL:https://=%
for /f "delims=." %%a in ("%URL%") do set PROJECT_REF=%%a
echo ✅ 프로젝트 감지: %PROJECT_REF%
echo.

:: Supabase CLI 설치 확인
where supabase >nul 2>nul
if %errorlevel% neq 0 (
  echo 📦 Supabase CLI 설치 중...
  npm install -g supabase
  echo ✅ Supabase CLI 설치 완료
) else (
  echo ✅ Supabase CLI 이미 설치됨
)

:: Supabase 로그인
echo.
echo 🔐 Supabase 로그인...
echo 브라우저가 열리면 로그인해주세요.
supabase login

:: 프로젝트 연결
echo.
echo 🔗 프로젝트 연결 중: %PROJECT_REF%
supabase link --project-ref %PROJECT_REF%
echo ✅ 프로젝트 연결 완료

:: Secrets 등록
echo.
echo 🔑 Secrets 등록 중...

if not "%SERVICE_KEY%"=="" (
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=%SERVICE_KEY%
  echo   ✅ SUPABASE_SERVICE_ROLE_KEY
)

if not "%RESEND_KEY%"=="" (
  supabase secrets set RESEND_API_KEY=%RESEND_KEY%
  echo   ✅ RESEND_API_KEY
) else (
  echo   ⚠️  RESEND_API_KEY 없음 ^(이메일 발송 비활성^)
)

if not "%SOLAPI_KEY%"=="" (
  supabase secrets set SOLAPI_API_KEY=%SOLAPI_KEY%
  supabase secrets set SOLAPI_API_SECRET=%SOLAPI_SECRET%
  supabase secrets set SOLAPI_SENDER_PHONE=%SOLAPI_PHONE%
  echo   ✅ SOLAPI 키
) else (
  echo   ⚠️  SOLAPI 키 없음 ^(SMS 비활성^)
)

:: Edge Functions 배포
echo.
echo 🚀 Edge Functions 배포 중...

supabase functions deploy db-api
echo   ✅ db-api 배포 완료

supabase functions deploy send-email
echo   ✅ send-email 배포 완료

supabase functions deploy send-sms
echo   ✅ send-sms 배포 완료

supabase functions deploy naver-oauth
echo   ✅ naver-oauth 배포 완료

:: 완료
echo.
echo ================================================
echo 🎉 백엔드 설정 완료!
echo.
echo 다음 단계:
echo   1. npm run dev   -^> 로컬 테스트
echo   2. GitHub push   -^> Vercel 자동 배포
echo ================================================
echo.
pause
