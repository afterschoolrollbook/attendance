-- ============================================================
-- 005_auth_lookup_rpc.sql
--
-- 배경:
--   로그인 페이지의 "아이디 찾기"(전화번호로 이메일 찾기)와
--   "비밀번호 초기화"(이메일 존재/제공자 확인)는 모두 Users.all()
--   (로컬 캐시)을 사용함. 비로그인 상태(/login 페이지)에서는
--   users 테이블 RLS("본인 행 또는 관리자")로 인해 캐시가 항상
--   비어있어 두 기능 모두 100% 실패함.
--
-- 해결:
--   필요한 정보만 최소한으로 반환하는 security definer 함수 추가.
--   - find_email_by_phone: 전화번호 1건당 마스킹 전 이메일 1개만 반환
--   - get_user_auth_info : 이메일 존재 여부 + 로그인 provider만 반환
--   (비밀번호, 기타 개인정보는 절대 반환하지 않음)
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 전체 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) find_email_by_phone — 아이디(이메일) 찾기
-- ────────────────────────────────────────────────────────────
create or replace function find_email_by_phone(p_phone text)
returns text
language plpgsql security definer as $$
declare
  v_email text;
begin
  select email into v_email
    from users
   where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
   order by created_at
   limit 1;
  return v_email;
end; $$;


-- ────────────────────────────────────────────────────────────
-- 2) get_user_auth_info — 비밀번호 초기화 전 이메일 존재/provider 확인
-- ────────────────────────────────────────────────────────────
create or replace function get_user_auth_info(p_email text)
returns table(found boolean, provider text)
language sql security definer as $$
  select
    exists(select 1 from users u where u.email = lower(p_email)) as found,
    (select u.provider from users u where u.email = lower(p_email) limit 1) as provider;
$$;
