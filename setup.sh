#!/bin/bash
# ============================================
# 방과후 출석부 — 백엔드 자동 설정
# Mac / Linux 용  |  사용법: bash setup.sh
# ============================================

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo ""
echo "📋 방과후 출석부 — 백엔드 자동 설정"
echo "======================================"

# .env 확인
if [ ! -f ".env" ]; then
  echo -e "${RED}❌ .env 파일이 없습니다.${NC}"
  echo "cp .env.example .env 후 값을 채워주세요."
  exit 1
fi
source .env

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo -e "${RED}❌ VITE_SUPABASE_URL 이 비어있습니다.${NC}"; exit 1
fi

# Project ref 추출
PROJECT_REF=$(echo $VITE_SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co.*||')
echo -e "${GREEN}✅ 프로젝트: $PROJECT_REF${NC}"

# Supabase CLI 설치
if ! command -v supabase &> /dev/null; then
  echo -e "${YELLOW}📦 Supabase CLI 설치 중...${NC}"
  npm install -g supabase
fi
echo -e "${GREEN}✅ Supabase CLI 준비됨${NC}"

# 로그인 + 연결
echo ""
echo -e "${YELLOW}🔐 Supabase 로그인 (브라우저가 열립니다)...${NC}"
supabase login
supabase link --project-ref $PROJECT_REF
echo -e "${GREEN}✅ 프로젝트 연결 완료${NC}"

# Service Role Key만 등록 (나머지는 관리자 페이지)
echo ""
echo -e "${YELLOW}🔑 Service Role Key 등록 중...${NC}"
if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
  echo -e "${GREEN}  ✅ SUPABASE_SERVICE_ROLE_KEY 등록완료${NC}"
else
  echo -e "${RED}  ❌ .env에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요${NC}"
fi
echo -e "${YELLOW}  ℹ️  이메일/SMS/소셜 키는 관리자 페이지에서 입력하세요${NC}"

# Edge Functions 배포
echo ""
echo -e "${YELLOW}🚀 Edge Functions 배포 중 (4개)...${NC}"
supabase functions deploy db-api     && echo -e "${GREEN}  ✅ db-api${NC}"
supabase functions deploy send-email && echo -e "${GREEN}  ✅ send-email${NC}"
supabase functions deploy send-sms   && echo -e "${GREEN}  ✅ send-sms${NC}"
supabase functions deploy naver-oauth && echo -e "${GREEN}  ✅ naver-oauth${NC}"

echo ""
echo "======================================"
echo -e "${GREEN}🎉 백엔드 설정 완료!${NC}"
echo ""
echo "다음 단계:"
echo "  1. npm run dev        → 로컬 테스트"
echo "  2. GitHub push        → Vercel 자동 배포"
echo "  3. 관리자 로그인      → 서비스 설정"
echo "     → 이메일/SMS/소셜 키 입력"
echo "======================================"
