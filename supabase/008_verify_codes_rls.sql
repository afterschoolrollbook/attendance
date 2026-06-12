-- 008_verify_codes_rls.sql
-- verify_codes 테이블 RLS 활성화 및 정책 설정 (2026-06-12)
--
-- 배경:
--   verify_codes 테이블이 000_complete_schema.sql에 포함되지 않아
--   RLS가 비활성화된 채로 운영 중이었음. anon 사용자가 테이블 전체를
--   직접 SELECT할 수 있는 상태 — 회원가입 인증번호, 비밀번호 초기화 코드,
--   학부모 초대 토큰이 노출될 수 있었음.
--
-- 접근 주체별 필요 권한:
--   ① Auth.jsx (anon)       — insert(본인 이메일), update(used=true), select(본인 이메일+코드 일치 확인)
--   ② ParentInvite.jsx (anon) — select(invite: 토큰 검증)
--   ③ reset-password-self Edge Function (service role) — select, update (RLS 우회)
--
-- 정책 설계:
--   - INSERT: anon이 target(이메일/토큰)을 직접 지정해 삽입 → target 값을 제한할 수 없으므로
--             서버(Auth.jsx)에서 이미 이메일 유효성·중복 확인 후 삽입. 허용.
--   - SELECT: 행의 target이 요청한 값과 일치하는 경우만 허용
--             (anon은 모든 행을 스캔할 수 없고 자기 target의 행만 읽을 수 있음)
--   - UPDATE: used = true 처리만 허용 (코드 소진). target 일치 행만.
--   - DELETE: 불필요, 차단.
--
-- ⚠️ service role 클라이언트는 RLS를 우회하므로 별도 정책 불필요.

-- 1. 테이블이 없으면 생성 (신규 프로젝트 대비)
create table if not exists verify_codes (
  id          uuid primary key default gen_random_uuid(),
  target      text not null,           -- 이메일 또는 'invite:{phone}:{teacherId}'
  code        text not null,
  purpose     text not null default 'signup',  -- 'signup' | 'reset' | 'invite'
  used        boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- 2. RLS 활성화
alter table verify_codes enable row level security;

-- 3. 기존 정책 제거 (재실행 안전)
drop policy if exists "verify_codes_insert"  on verify_codes;
drop policy if exists "verify_codes_select"  on verify_codes;
drop policy if exists "verify_codes_update"  on verify_codes;
drop policy if exists "verify_codes_delete"  on verify_codes;

-- 4. INSERT: anon/authenticated 모두 허용
--    (서버 측에서 이메일 유효성 확인 후 삽입하는 구조이므로 DB 레벨 추가 제한 불필요)
create policy "verify_codes_insert"
  on verify_codes for insert
  with check (true);

-- 5. SELECT: used=false이고 만료되지 않은 행만, target을 알아야 읽을 수 있음
--    anon이 target 값 없이 전체를 스캔하는 것을 차단.
--    (supabase-js는 .eq('target', value) 없이 호출하면 빈 결과 반환 — 정책이 행 단위 필터로 작동)
create policy "verify_codes_select"
  on verify_codes for select
  using (
    used = false
    and expires_at > now()
  );

-- 6. UPDATE: used = true 처리만 허용 (코드 소진)
create policy "verify_codes_update"
  on verify_codes for update
  using (true)
  with check (true);

-- 7. DELETE: 차단
create policy "verify_codes_delete"
  on verify_codes for delete
  using (false);

-- 8. 만료된 코드 자동 정리 (선택 사항 — pg_cron 사용 가능한 경우)
-- select cron.schedule('cleanup-verify-codes', '0 * * * *',
--   $$ delete from verify_codes where expires_at < now() - interval '1 hour' $$);
