-- ============================================================
-- 003_security_fixes.sql  (v4 — 컬럼명 전수 검증 완료)
-- CAMEL_TABLES → camelCase 컬럼명 ("teacherId")
-- 그 외 테이블   → snake_case 컬럼명 (teacher_id)
-- 재실행 안전: DROP IF EXISTS 포함
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. is_admin() — level 5 → 10
-- ════════════════════════════════════════════════════════════
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from users where auth_id = auth.uid() and level >= 10
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 2. verify_codes  (snake_case 테이블 — target 컬럼)
-- ════════════════════════════════════════════════════════════
alter table verify_codes enable row level security;

drop policy if exists "verify_codes_insert"     on verify_codes;
drop policy if exists "verify_codes_select_own" on verify_codes;
drop policy if exists "verify_codes_update_own" on verify_codes;

create policy "verify_codes_insert"     on verify_codes for insert with check (true);
create policy "verify_codes_select_own" on verify_codes for select
  using (target = (select email from users where auth_id = auth.uid() limit 1));
create policy "verify_codes_update_own" on verify_codes for update
  using (target = (select email from users where auth_id = auth.uid() limit 1));

-- ════════════════════════════════════════════════════════════
-- 3. ad_slots  (snake_case)
-- ════════════════════════════════════════════════════════════
alter table ad_slots enable row level security;

drop policy if exists "ad_slots_select" on ad_slots;
drop policy if exists "ad_slots_write"  on ad_slots;

create policy "ad_slots_select" on ad_slots for select using (true);
create policy "ad_slots_write"  on ad_slots for all    using (is_admin());

-- ════════════════════════════════════════════════════════════
-- 4. settings  (snake_case)
-- ════════════════════════════════════════════════════════════
alter table settings enable row level security;

drop policy if exists "settings_select" on settings;
drop policy if exists "settings_write"  on settings;

create policy "settings_select" on settings for select using (auth.uid() is not null);
create policy "settings_write"  on settings for all    using (is_admin());

-- ════════════════════════════════════════════════════════════
-- 5. teacher_service_configs  (snake_case → teacher_id)
-- ════════════════════════════════════════════════════════════
alter table teacher_service_configs enable row level security;

drop policy if exists "teacher_service_configs_all" on teacher_service_configs;

create policy "teacher_service_configs_all" on teacher_service_configs for all
  using (teacher_id = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 6. teacherProfiles  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table "teacherProfiles" enable row level security;

drop policy if exists "teacherProfiles_all" on "teacherProfiles";

create policy "teacherProfiles_all" on "teacherProfiles" for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 7. documents  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table documents enable row level security;

drop policy if exists "documents_all" on documents;

create policy "documents_all" on documents for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 8. lesson_memos  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table lesson_memos enable row level security;

drop policy if exists "lesson_memos_all" on lesson_memos;

create policy "lesson_memos_all" on lesson_memos for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 9. custom_categories  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table custom_categories enable row level security;

drop policy if exists "custom_categories_all" on custom_categories;

create policy "custom_categories_all" on custom_categories for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 10. messageGuides  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table "messageGuides" enable row level security;

drop policy if exists "messageGuides_all" on "messageGuides";

create policy "messageGuides_all" on "messageGuides" for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 11. messageCategories  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table "messageCategories" enable row level security;

drop policy if exists "messageCategories_all" on "messageCategories";

create policy "messageCategories_all" on "messageCategories" for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 12. supplyGiven  (camelCase → "teacherId")
-- ════════════════════════════════════════════════════════════
alter table "supplyGiven" enable row level security;

drop policy if exists "supplyGiven_all" on "supplyGiven";

create policy "supplyGiven_all" on "supplyGiven" for all
  using ("teacherId" = get_my_user_id() or is_admin());

-- ════════════════════════════════════════════════════════════
-- 13. supplyParts  (camelCase — 관리자 전용)
-- ════════════════════════════════════════════════════════════
alter table "supplyParts" enable row level security;

drop policy if exists "supplyParts_all" on "supplyParts";

create policy "supplyParts_all" on "supplyParts" for all
  using (is_admin());

-- ════════════════════════════════════════════════════════════
-- 14. blog_posts  (snake_case — 공개 읽기, 관리자 쓰기)
-- ════════════════════════════════════════════════════════════
alter table blog_posts enable row level security;

drop policy if exists "blog_posts_select" on blog_posts;
drop policy if exists "blog_posts_write"  on blog_posts;

create policy "blog_posts_select" on blog_posts for select using (true);
create policy "blog_posts_write"  on blog_posts for all    using (is_admin());

-- ════════════════════════════════════════════════════════════
-- 15. school 관련 테이블 (모두 camelCase)
-- ════════════════════════════════════════════════════════════

alter table "schoolAdmins" enable row level security;
drop policy if exists "schoolAdmins_all" on "schoolAdmins";
create policy "schoolAdmins_all" on "schoolAdmins" for all
  using (id = get_my_user_id() or is_admin());

alter table "schoolAdminAccounts" enable row level security;
drop policy if exists "schoolAdminAccounts_own"   on "schoolAdminAccounts";
drop policy if exists "schoolAdminAccounts_write" on "schoolAdminAccounts";
create policy "schoolAdminAccounts_own" on "schoolAdminAccounts" for select
  using ("adminId" = get_my_user_id() or is_admin());
create policy "schoolAdminAccounts_write" on "schoolAdminAccounts" for all
  using ("adminId" = get_my_user_id() or is_admin());

alter table "schoolAdminTeachers" enable row level security;
drop policy if exists "schoolAdminTeachers_all" on "schoolAdminTeachers";
create policy "schoolAdminTeachers_all" on "schoolAdminTeachers" for all
  using ("adminId" = get_my_user_id() or "teacherId" = get_my_user_id() or is_admin());

alter table "schoolSubjects" enable row level security;
drop policy if exists "schoolSubjects_select" on "schoolSubjects";
drop policy if exists "schoolSubjects_write"  on "schoolSubjects";
create policy "schoolSubjects_select" on "schoolSubjects" for select using (true);
create policy "schoolSubjects_write"  on "schoolSubjects" for all    using (is_admin());

alter table "schoolTeacherInvites" enable row level security;
drop policy if exists "schoolTeacherInvites_all" on "schoolTeacherInvites";
create policy "schoolTeacherInvites_all" on "schoolTeacherInvites" for all
  using ("teacherId" = get_my_user_id() or "adminId" = get_my_user_id() or is_admin());

alter table "schoolNotices" enable row level security;
drop policy if exists "schoolNotices_select" on "schoolNotices";
drop policy if exists "schoolNotices_write"  on "schoolNotices";
create policy "schoolNotices_select" on "schoolNotices" for select using (true);
create policy "schoolNotices_write"  on "schoolNotices" for all
  using ("adminId" = get_my_user_id() or is_admin());

alter table "schoolNoticeSubmits" enable row level security;
drop policy if exists "schoolNoticeSubmits_all" on "schoolNoticeSubmits";
create policy "schoolNoticeSubmits_all" on "schoolNoticeSubmits" for all
  using ("teacherId" = get_my_user_id() or "adminId" = get_my_user_id() or is_admin());

alter table "schoolCalendar" enable row level security;
drop policy if exists "schoolCalendar_select" on "schoolCalendar";
drop policy if exists "schoolCalendar_write"  on "schoolCalendar";
create policy "schoolCalendar_select" on "schoolCalendar" for select using (true);
create policy "schoolCalendar_write"  on "schoolCalendar" for all
  using ("adminId" = get_my_user_id() or is_admin());

alter table "schoolInfo" enable row level security;
drop policy if exists "schoolInfo_select" on "schoolInfo";
drop policy if exists "schoolInfo_write"  on "schoolInfo";
create policy "schoolInfo_select" on "schoolInfo" for select using (true);
create policy "schoolInfo_write"  on "schoolInfo" for all   using (is_admin());

-- ════════════════════════════════════════════════════════════
-- 16. vendorAccounts  (camelCase — anon 직접 접근 차단)
-- ════════════════════════════════════════════════════════════
alter table "vendorAccounts" enable row level security;

drop policy if exists "vendorAccounts_deny_direct" on "vendorAccounts";
drop policy if exists "vendorAccounts_deny_write"  on "vendorAccounts";

create policy "vendorAccounts_deny_direct" on "vendorAccounts" for select using (false);
create policy "vendorAccounts_deny_write"  on "vendorAccounts" for all    using (false);

-- ════════════════════════════════════════════════════════════
-- 17. hqVendor 관련 테이블 — anon 직접 접근 차단
-- ════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tables text[] := ARRAY[
    'hqVendors', 'hqVendorSubjects', 'hqVendorProducts',
    'hqVendorStages', 'hqVendorContents', 'hqVendorQuarters',
    'hqVendorSessions', 'hqVendorFiles', 'hqVendorPrices', 'hqVendorUsers'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_deny_direct', t);
    execute format('create policy %I on %I for all using (false)', t || '_deny_direct', t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════
-- 18. Storage — teacher-files 버킷 RLS
-- ════════════════════════════════════════════════════════════
drop policy if exists "teacher_files_own_upload" on storage.objects;
drop policy if exists "teacher_files_own_read"   on storage.objects;
drop policy if exists "teacher_files_own_delete" on storage.objects;
drop policy if exists "teacher_files_admin"      on storage.objects;

create policy "teacher_files_own_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'teacher-files'
    and (storage.foldername(name))[1] = 'training'
    and (storage.foldername(name))[2] = (
      select id from users where auth_id = auth.uid() limit 1
    )
  );

create policy "teacher_files_own_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'teacher-files'
    and (storage.foldername(name))[2] = (
      select id from users where auth_id = auth.uid() limit 1
    )
  );

create policy "teacher_files_own_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'teacher-files'
    and (storage.foldername(name))[2] = (
      select id from users where auth_id = auth.uid() limit 1
    )
  );

create policy "teacher_files_admin"
  on storage.objects for all to authenticated
  using (bucket_id = 'teacher-files' and is_admin());
