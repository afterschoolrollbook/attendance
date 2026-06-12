-- 007_remove_public_service_role_policies.sql
-- 목적: "service role full access" 라는 이름으로 생성되었으나 실제로는
--       roles={public}, qual=true, with_check=true 로 설정되어 있어
--       익명 사용자를 포함한 모든 사용자가 ALL(SELECT/INSERT/UPDATE/DELETE)을
--       무조건 허용받는 정책을 제거.
--
-- 참고: Supabase의 service_role API 키는 기본적으로 RLS를 우회(bypassrls)하므로,
--       service_role을 위한 별도 정책은 원래 필요하지 않음.
--
-- 대상 테이블: settings(완료), teacher_parent_links, points, branches
--   - teacher_parent_links: 기존 "teacher_parent_links_all" 정책이 이미 있어 단순 삭제만 진행
--   - points, branches: 대체 정책이 없으므로 다른 테이블과 동일한 패턴으로 신규 추가

-- ── teacher_parent_links: 기존 teacher_parent_links_all (teacher_id = get_my_user_id() or is_admin()) 정책 유지
drop policy if exists "service role full access" on teacher_parent_links;

-- ── points: 본인 포인트 내역만 조회/관리, 관리자는 전체 (revenue_fees 등과 동일 패턴)
drop policy if exists "service role full access" on points;
alter table if exists points enable row level security;
drop policy if exists "points_all" on points;
create policy "points_all" on points for all
  using (teacher_id = get_my_user_id() or is_admin());

-- ── branches: 지사 목록은 로그인 사용자 모두 조회 가능(읽기 전용 참조 데이터), 관리는 관리자만
--   (school_subjects, school_info 등 참조 데이터 테이블과 동일 패턴)
drop policy if exists "service role full access" on branches;
alter table if exists branches enable row level security;
drop policy if exists "branches_select" on branches;
create policy "branches_select" on branches for select using (auth.uid() is not null);
drop policy if exists "branches_write" on branches;
create policy "branches_write" on branches for all using (is_admin());
