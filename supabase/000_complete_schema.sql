-- ============================================================
-- 000_complete_schema.sql
-- 실제 DB 상태 기반 — snake_case 완전 통일
-- 작성 근거: Supabase 실제 테이블/컬럼 현황 CSV (2026-06-02) 확인
--
-- 실행 방법: Supabase SQL Editor에 전체 붙여넣기 후 Run
-- 재실행 안전: 모든 작업이 존재 여부 체크 후 실행됨
-- ============================================================

-- ============================================================
-- 헬퍼: 컬럼이 존재할 때만 RENAME 실행하는 함수
-- ============================================================
create or replace function _rename_col_if_exists(
  p_table text, p_old text, p_new text
) returns void language plpgsql as $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name  = p_table
      and column_name = p_old
  ) then
    execute format('alter table %I rename column %I to %I', p_table, p_old, p_new);
  end if;
end;
$$;

-- ============================================================
-- STEP 1: 테이블 이름이 camelCase → snake_case RENAME
--         (snake_case 동명 테이블이 없는 경우만)
-- ============================================================

-- supplyGiven → supply_given  (snake 테이블 없음, 데이터 있음)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyGiven')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='supply_given')
  then
    alter table "supplyGiven" rename to supply_given;
  end if;
end $$;

-- teacherProfiles → teacher_profiles  (snake 테이블 없음, 데이터 있음)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='teacherProfiles')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='teacher_profiles')
  then
    alter table "teacherProfiles" rename to teacher_profiles;
  end if;
end $$;

-- hqVendors → hq_vendors
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendors')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendors')
  then alter table "hqVendors" rename to hq_vendors; end if;
end $$;

-- hqVendorSubjects → hq_vendor_subjects
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorSubjects')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_subjects')
  then alter table "hqVendorSubjects" rename to hq_vendor_subjects; end if;
end $$;

-- hqVendorProducts → hq_vendor_products
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorProducts')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_products')
  then alter table "hqVendorProducts" rename to hq_vendor_products; end if;
end $$;

-- hqVendorStages → hq_vendor_stages
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorStages')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_stages')
  then alter table "hqVendorStages" rename to hq_vendor_stages; end if;
end $$;

-- hqVendorContents → hq_vendor_contents
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorContents')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_contents')
  then alter table "hqVendorContents" rename to hq_vendor_contents; end if;
end $$;

-- hqVendorQuarters → hq_vendor_quarters
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorQuarters')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_quarters')
  then alter table "hqVendorQuarters" rename to hq_vendor_quarters; end if;
end $$;

-- hqVendorSessions → hq_vendor_sessions
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorSessions')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_sessions')
  then alter table "hqVendorSessions" rename to hq_vendor_sessions; end if;
end $$;

-- hqVendorFiles → hq_vendor_files
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorFiles')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_files')
  then alter table "hqVendorFiles" rename to hq_vendor_files; end if;
end $$;

-- hqVendorPrices → hq_vendor_prices
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorPrices')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_prices')
  then alter table "hqVendorPrices" rename to hq_vendor_prices; end if;
end $$;

-- hqVendorUsers → hq_vendor_users
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='hqVendorUsers')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='hq_vendor_users')
  then alter table "hqVendorUsers" rename to hq_vendor_users; end if;
end $$;

-- schoolAdmins → school_admins
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolAdmins')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_admins')
  then alter table "schoolAdmins" rename to school_admins; end if;
end $$;

-- schoolAdminAccounts → school_admin_accounts
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolAdminAccounts')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_admin_accounts')
  then alter table "schoolAdminAccounts" rename to school_admin_accounts; end if;
end $$;

-- schoolAdminTeachers → school_admin_teachers
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolAdminTeachers')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_admin_teachers')
  then alter table "schoolAdminTeachers" rename to school_admin_teachers; end if;
end $$;

-- schoolSubjects → school_subjects
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolSubjects')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_subjects')
  then alter table "schoolSubjects" rename to school_subjects; end if;
end $$;

-- schoolTeacherInvites → school_teacher_invites
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolTeacherInvites')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_teacher_invites')
  then alter table "schoolTeacherInvites" rename to school_teacher_invites; end if;
end $$;

-- schoolNotices → school_notices
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolNotices')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_notices')
  then alter table "schoolNotices" rename to school_notices; end if;
end $$;

-- schoolNoticeSubmits → school_notice_submits
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolNoticeSubmits')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_notice_submits')
  then alter table "schoolNoticeSubmits" rename to school_notice_submits; end if;
end $$;

-- schoolCalendar → school_calendar
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolCalendar')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_calendar')
  then alter table "schoolCalendar" rename to school_calendar; end if;
end $$;

-- schoolInfo → school_info
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='schoolInfo')
  and not exists (select 1 from pg_tables where schemaname='public' and tablename='school_info')
  then alter table "schoolInfo" rename to school_info; end if;
end $$;

-- ============================================================
-- STEP 2: 병합 INSERT (양쪽에 데이터 있는 것)
-- ============================================================

-- ── messageGuides → message_guides
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='messageGuides') then
    -- 기존 RLS 정책 전체 drop
    execute (
      select string_agg(format('drop policy %I on message_guides', policyname), '; ')
      from pg_policies
      where schemaname = 'public' and tablename = 'message_guides'
    );
    -- FK 제약 drop
    alter table message_guides drop constraint if exists message_guides_teacher_id_fkey;
    alter table message_guides alter column id type text;
    alter table message_guides alter column teacher_id type text;
    alter table message_guides add column if not exists updated_at timestamptz default now();
    alter table message_guides add column if not exists _deleted boolean default false;
    insert into message_guides (id, teacher_id, category, title, content, created_at, updated_at, _deleted)
    select id, "teacherId", category, title, content, "createdAt"::timestamptz, "updatedAt"::timestamptz, coalesce("_deleted", false)
    from "messageGuides"
    on conflict (id) do nothing;
    drop table "messageGuides";
  end if;
end $$;

-- ── messageCategories → message_categories
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='messageCategories') then
    -- 기존 RLS 정책 전체 drop
    execute (
      select string_agg(format('drop policy %I on message_categories', policyname), '; ')
      from pg_policies
      where schemaname = 'public' and tablename = 'message_categories'
    );
    -- FK 제약 drop
    alter table message_categories drop constraint if exists message_categories_teacher_id_fkey;
    alter table message_categories alter column id type text;
    alter table message_categories alter column teacher_id type text;
    alter table message_categories add column if not exists updated_at timestamptz default now();
    alter table message_categories add column if not exists _deleted boolean default false;
    insert into message_categories (id, teacher_id, name, created_at, updated_at, _deleted)
    select id, "teacherId", name, "createdAt"::timestamptz, "updatedAt"::timestamptz, coalesce("_deleted", false)
    from "messageCategories"
    on conflict (id) do nothing;
    drop table "messageCategories";
  end if;
end $$;

-- ── supplySubjects → supply_subjects
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplySubjects') then
    insert into supply_subjects (id, teacher_id, name, sort_order, created_at, updated_at)
    select id, "teacherId", name, "sortOrder", "createdAt"::timestamptz, "updatedAt"::timestamptz
    from "supplySubjects"
    on conflict (id) do nothing;
    drop table "supplySubjects";
  end if;
end $$;

-- ── supplyVendors → supply_vendors
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyVendors') then
    insert into supply_vendors (id, teacher_id, subject, name, manager_name, contact, memo, created_at, updated_at)
    select id, "teacherId", subject, name, "managerName", contact, memo, "createdAt"::timestamptz, "updatedAt"::timestamptz
    from "supplyVendors"
    on conflict (id) do nothing;
    drop table "supplyVendors";
  end if;
end $$;

-- ── supplyProducts → supply_products  (supply_plans FK 참조 대상이므로 먼저 실행)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyProducts') then
    insert into supply_products (id, teacher_id, vendor_id, subject, name, max_stage, sessions_per_stage, alert_session, created_at, updated_at)
    select id, "teacherId", "vendorId", subject, name, "maxStage", "sessionsPerStage", "alertSession", "createdAt"::timestamptz, "updatedAt"::timestamptz
    from "supplyProducts"
    on conflict (id) do nothing;
    drop table "supplyProducts";
  end if;
end $$;

-- ── supplyPlans → supply_plans  (supply_products 이후 실행)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyPlans') then
    insert into supply_plans (id, teacher_id, subject, type, file_type, title, school, vendor_id, product_id, stage, file_url, file_name, created_at, updated_at)
    select id, "teacherId", subject, type, "fileType", title, school, "vendorId", "productId", nullif(stage,'')::integer, "fileUrl", "fileName", "createdAt"::timestamptz, "updatedAt"::timestamptz
    from "supplyPlans"
    on conflict (id) do nothing;
    drop table "supplyPlans";
  end if;
end $$;

-- ── supplyProductPlans → supply_product_plans
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyProductPlans') then
    insert into supply_product_plans (id, teacher_id, product_id, stage, session_no, title, memo, file_name, file_url, created_at, updated_at)
    select id, "teacherId", "productId", stage, "sessionNo", title, memo, "fileName", "fileUrl", "createdAt"::timestamptz, "updatedAt"::timestamptz
    from "supplyProductPlans"
    on conflict (id) do nothing;
    drop table "supplyProductPlans";
  end if;
end $$;

-- ── supplyItems → supply_items
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyItems') then
    alter table supply_items add column if not exists product_id text;
    alter table supply_items add column if not exists remote_no  text default '';
    alter table supply_items add column if not exists _deleted   boolean default false;
    insert into supply_items (id, teacher_id, class_id, student_id, subject, name, product_id, stage, remote_no, created_at, updated_at, _deleted)
    select id, "teacherId", "classId", "studentId", subject, name, "productId", stage, "remoteNo", "createdAt"::timestamptz, "updatedAt"::timestamptz, coalesce("_deleted",false)
    from "supplyItems"
    on conflict (id) do nothing;
    drop table "supplyItems";
  end if;
end $$;

-- ── supplyParts → supply_parts
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyParts') then
    alter table supply_parts add column if not exists _deleted boolean default false;
    insert into supply_parts (id, teacher_id, product_id, stage, name, created_at, _deleted)
    select p.id, sp.teacher_id, p."productId", p.stage, p.name, p."createdAt"::timestamptz, coalesce(p."_deleted",false)
    from "supplyParts" p
    left join supply_products sp on sp.id = p."productId"
    on conflict (id) do nothing;
    drop table "supplyParts";
  end if;
end $$;

-- ── supplyStudentProgress → supply_student_progress
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyStudentProgress') then
    alter table supply_student_progress add column if not exists _deleted         boolean default false;
    alter table supply_student_progress add column if not exists next_product_id  text;
    alter table supply_student_progress add column if not exists next_stage       int;
    insert into supply_student_progress (id, teacher_id, student_id, class_id, product_id, cur_stage, cur_session, updated_at, created_at, "supplyReady", "supplyDelivered", "transferSchool", "transferStudent", "transferSupply", next_product_id, next_stage, _deleted)
    select id, "teacherId", "studentId", "classId", "productId", "curStage", "curSession", "updatedAt"::timestamptz, "createdAt"::timestamptz, "supplyReady", "supplyDelivered", "transferSchool", "transferStudent", "transferSupply", "nextProductId", "nextStage", coalesce("_deleted",false)
    from "supplyStudentProgress"
    on conflict (id) do nothing;
    drop table "supplyStudentProgress";
  end if;
end $$;

-- ── supplySessionChecks → supply_session_checks
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplySessionChecks') then
    alter table supply_session_checks add column if not exists _deleted boolean default false;
    insert into supply_session_checks (id, teacher_id, student_id, class_id, product_id, stage, session_no, checked_at, created_at, updated_at, _deleted)
    select distinct on ("studentId", "classId", "productId", stage, "sessionNo")
      id, "teacherId", "studentId", "classId", "productId", stage, "sessionNo", "checkedAt", "createdAt"::timestamptz, "updatedAt"::timestamptz, coalesce("_deleted",false)
    from "supplySessionChecks"
    order by "studentId", "classId", "productId", stage, "sessionNo", "createdAt" desc
    on conflict (student_id, class_id, product_id, stage, session_no) do update
      set id = excluded.id,
          checked_at = excluded.checked_at,
          updated_at = excluded.updated_at,
          _deleted = excluded._deleted;
    drop table "supplySessionChecks";
  end if;
end $$;

-- ── supplyProgressLogs → supply_progress_logs
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyProgressLogs') then
    alter table supply_progress_logs add column if not exists file_name  text;
    alter table supply_progress_logs add column if not exists file_url   text;
    alter table supply_progress_logs add column if not exists file_type  text;
    alter table supply_progress_logs add column if not exists updated_at timestamptz;
    alter table supply_progress_logs add column if not exists _deleted   boolean default false;
    insert into supply_progress_logs (id, teacher_id, student_id, class_id, product_id, file_name, file_url, file_type, created_at, updated_at, _deleted)
    select id, "teacherId", "studentId", "classId", "productId", "fileName", "fileUrl", "fileType", "createdAt"::timestamptz, "updatedAt"::timestamptz, coalesce("_deleted",false)
    from "supplyProgressLogs"
    on conflict (id) do nothing;
    drop table "supplyProgressLogs";
  end if;
end $$;

-- ── supplyPromos → supply_promos
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='supplyPromos') then
    alter table supply_promos add column if not exists type       text default '';
    alter table supply_promos add column if not exists school     text;
    alter table supply_promos add column if not exists vendor_id  text;
    alter table supply_promos add column if not exists product_id text;
    alter table supply_promos add column if not exists stage      integer;
    alter table supply_promos add column if not exists _deleted   boolean default false;
    insert into supply_promos (id, teacher_id, subject, type, file_type, title, school, vendor_id, product_id, stage, file_url, file_name, created_at, updated_at, _deleted)
    select id, "teacherId", subject, type, "fileType", title, school, "vendorId", "productId", nullif(stage,'')::integer, "fileUrl", "fileName", "createdAt"::timestamptz, "updatedAt"::timestamptz, coalesce("_deleted",false)
    from "supplyPromos"
    on conflict (id) do nothing;
    drop table "supplyPromos";
  end if;
end $$;

-- ── revenueFees → revenue_fees
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='revenueFees') then
    insert into revenue_fees (id, teacher_id, class_id, fee_type, amount, updated_at, created_at)
    select id, "teacherId", "classId", "feeType", amount, "updatedAt", "createdAt"
    from "revenueFees"
    on conflict (id) do nothing;
    drop table "revenueFees";
  end if;
end $$;

-- ── revenuePayments → revenue_payments
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='revenuePayments') then
    insert into revenue_payments (id, teacher_id, class_id, term_no, date, amount, memo, created_at, updated_at)
    select id, "teacherId", "classId", "termNo", date, amount, memo, "createdAt", "updatedAt"
    from "revenuePayments"
    on conflict (id) do nothing;
    drop table "revenuePayments";
  end if;
end $$;

-- ── jobSubs → job_subs
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='jobSubs') then
    alter table job_subs add column if not exists sido         text default '';
    alter table job_subs add column if not exists office       text default '';
    alter table job_subs add column if not exists school       text default '';
    alter table job_subs add column if not exists notify_sms   boolean default false;
    alter table job_subs add column if not exists notify_kakao boolean default false;
    alter table job_subs add column if not exists notify_email boolean default true;
    alter table job_subs add column if not exists _deleted     boolean default false;
    insert into job_subs (id, teacher_id, sido, office, school, subject, notify_sms, notify_kakao, notify_email, active, created_at, updated_at, _deleted)
    select id, "teacherId", sido, office, school, subject, "notifySms", "notifyKakao", "notifyEmail", active, "createdAt", "updatedAt", coalesce("_deleted",false)
    from "jobSubs"
    on conflict (id) do nothing;
    drop table "jobSubs";
  end if;
end $$;

-- ── vendorAccounts → vendor_accounts
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='vendorAccounts') then
    insert into vendor_accounts (id, vendor_id, email, pw, name, created_at)
    select distinct on (email) id, "vendorId", email, coalesce(pw, password), name, "createdAt"
    from "vendorAccounts"
    order by email, "createdAt" desc
    on conflict (email) do nothing;
    drop table "vendorAccounts";
  end if;
end $$;

-- ============================================================
-- STEP 3: 테이블명은 snake인데 컬럼이 camelCase인 것들 — 컬럼 RENAME
-- ============================================================

-- ── teacher_profiles (STEP 1에서 테이블명만 rename됨, 컬럼도 처리)
select _rename_col_if_exists('teacher_profiles', 'teacherId',   'teacher_id');
select _rename_col_if_exists('teacher_profiles', 'createdAt',   'created_at');
select _rename_col_if_exists('teacher_profiles', 'updatedAt',   'updated_at');

-- ── supply_given (STEP 1에서 테이블명만 rename됨, 컬럼도 처리)
select _rename_col_if_exists('supply_given', 'teacherId',  'teacher_id');
select _rename_col_if_exists('supply_given', 'studentId',  'student_id');
select _rename_col_if_exists('supply_given', 'classId',    'class_id');
select _rename_col_if_exists('supply_given', 'productId',  'product_id');
select _rename_col_if_exists('supply_given', 'vendorId',   'vendor_id');
select _rename_col_if_exists('supply_given', 'createdAt',  'created_at');
select _rename_col_if_exists('supply_given', 'updatedAt',  'updated_at');

-- ── notes (teacherId, createdAt)
select _rename_col_if_exists('notes', 'teacherId', 'teacher_id');
select _rename_col_if_exists('notes', 'createdAt', 'created_at');

-- ── careers (전체 camelCase)
select _rename_col_if_exists('careers', 'teacherId',         'teacher_id');
select _rename_col_if_exists('careers', 'orgName',           'org_name');
select _rename_col_if_exists('careers', 'jobType',           'job_type');
select _rename_col_if_exists('careers', 'schoolType',        'school_type');
select _rename_col_if_exists('careers', 'customSchoolType',  'custom_school_type');
select _rename_col_if_exists('careers', 'startDate',         'start_date');
select _rename_col_if_exists('careers', 'endDate',           'end_date');
select _rename_col_if_exists('careers', 'isCurrent',         'is_current');
select _rename_col_if_exists('careers', 'isOneDay',          'is_one_day');
select _rename_col_if_exists('careers', 'fileUrl',           'file_url');
select _rename_col_if_exists('careers', 'fileName',          'file_name');
select _rename_col_if_exists('careers', 'fileType',          'file_type');
select _rename_col_if_exists('careers', 'updatedAt',         'updated_at');
select _rename_col_if_exists('careers', 'createdAt',         'created_at');

-- ── trainings (전체 camelCase + filetype 중복 주의)
select _rename_col_if_exists('trainings', 'teacherId',      'teacher_id');
select _rename_col_if_exists('trainings', 'providerUrl',    'provider_url');
select _rename_col_if_exists('trainings', 'completionNum',  'completion_num');
select _rename_col_if_exists('trainings', 'completedAt',    'completed_at');
select _rename_col_if_exists('trainings', 'fileUrl',        'file_url');
select _rename_col_if_exists('trainings', 'fileName',       'file_name');
select _rename_col_if_exists('trainings', 'fileType',       'file_type');
-- filetype (소문자) 컬럼이 있으면 file_type과 중복 → 제거
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='trainings' and column_name='filetype')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='trainings' and column_name='file_type')
  then alter table trainings drop column filetype cascade; end if;
end $$;
select _rename_col_if_exists('trainings', 'updatedAt', 'updated_at');
select _rename_col_if_exists('trainings', 'createdAt', 'created_at');

-- ── certificates (전체 camelCase)
select _rename_col_if_exists('certificates', 'teacherId',      'teacher_id');
select _rename_col_if_exists('certificates', 'certType',       'cert_type');
select _rename_col_if_exists('certificates', 'certNumber',     'cert_number');
select _rename_col_if_exists('certificates', 'privateRegNum',  'private_reg_num');
select _rename_col_if_exists('certificates', 'issuedAt',       'issued_at');
select _rename_col_if_exists('certificates', 'expiresAt',      'expires_at');
select _rename_col_if_exists('certificates', 'noExpiry',       'no_expiry');
select _rename_col_if_exists('certificates', 'fileUrl',        'file_url');
select _rename_col_if_exists('certificates', 'fileName',       'file_name');
select _rename_col_if_exists('certificates', 'fileType',       'file_type');
select _rename_col_if_exists('certificates', 'updatedAt',      'updated_at');
select _rename_col_if_exists('certificates', 'createdAt',      'created_at');

-- ── awards (contest_name, award_type 이미 snake. updatedAt/createdAt 남음)
select _rename_col_if_exists('awards', 'awardedAt',  'awarded_at');

-- ── educations (대부분 snake이나 updatedAt 남음)
select _rename_col_if_exists('educations', 'updatedAt', 'updated_at');

-- ── blog_posts (coverImage, publishedAt, createdAt, updatedAt)
select _rename_col_if_exists('blog_posts', 'coverImage',  'cover_image');
select _rename_col_if_exists('blog_posts', 'publishedAt', 'published_at');
select _rename_col_if_exists('blog_posts', 'createdAt',   'created_at');
select _rename_col_if_exists('blog_posts', 'updatedAt',   'updated_at');

-- ── lesson_memos (teacherId, classId, createdAt, updatedAt)
select _rename_col_if_exists('lesson_memos', 'teacherId', 'teacher_id');
select _rename_col_if_exists('lesson_memos', 'classId',   'class_id');
select _rename_col_if_exists('lesson_memos', 'createdAt', 'created_at');
select _rename_col_if_exists('lesson_memos', 'updatedAt', 'updated_at');

-- ── documents (teacherId, fileName, fileType, fileData, createdAt, updatedAt)
select _rename_col_if_exists('documents', 'teacherId', 'teacher_id');
select _rename_col_if_exists('documents', 'fileName',  'file_name');
select _rename_col_if_exists('documents', 'fileType',  'file_type');
select _rename_col_if_exists('documents', 'fileData',  'file_data');
select _rename_col_if_exists('documents', 'createdAt', 'created_at');
select _rename_col_if_exists('documents', 'updatedAt', 'updated_at');

-- ── custom_categories: 이미 snake/camel 양쪽 컬럼 공존
-- teacherId → teacher_id (이미 teacher_id 있으면 건너뜀)
do $$ begin
  -- teacherId가 있고 teacher_id도 있으면 teacherId 컬럼 DROP
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='teacherId')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='teacher_id')
  then alter table custom_categories drop column "teacherId" cascade; end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='sortOrder')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='sort_order')
  then alter table custom_categories drop column "sortOrder" cascade; end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='createdAt')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='created_at')
  then alter table custom_categories drop column "createdAt" cascade; end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='updatedAt')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='custom_categories' and column_name='updated_at')
  then alter table custom_categories drop column "updatedAt" cascade; end if;
end $$;
-- 나머지 단독 camelCase는 rename
select _rename_col_if_exists('custom_categories', 'teacherId', 'teacher_id');
select _rename_col_if_exists('custom_categories', 'sortOrder', 'sort_order');
select _rename_col_if_exists('custom_categories', 'createdAt', 'created_at');
select _rename_col_if_exists('custom_categories', 'updatedAt', 'updated_at');

-- ── students: parentJoined, updatedAt 등 camel 혼재
select _rename_col_if_exists('students', 'parentJoined', 'parent_joined_camel'); -- 이미 parent_joined 있으므로 임시명
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name='parent_joined_camel')
  then alter table students drop column parent_joined_camel cascade; end if;
end $$;
select _rename_col_if_exists('students', 'updatedAt', 'updated_at_camel');
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name='updated_at_camel')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name='updated_at')
  then alter table students drop column updated_at_camel cascade; end if;
end $$;

-- ── jobSubs 병합은 STEP 2에서 이미 처리됨 (중복 제거)

-- ============================================================
-- STEP 4: hq 테이블 컬럼 RENAME (테이블명은 STEP 1에서 처리됨)
-- ============================================================

-- hq_vendors
select _rename_col_if_exists('hq_vendors', 'kakaoId',      'kakao_id');
select _rename_col_if_exists('hq_vendors', 'kakaoChannel', 'kakao_channel');
select _rename_col_if_exists('hq_vendors', 'managerName',  'manager_name');
select _rename_col_if_exists('hq_vendors', 'invitedAt',    'invited_at');
select _rename_col_if_exists('hq_vendors', 'invitedEmail', 'invited_email');
select _rename_col_if_exists('hq_vendors', 'createdAt',    'created_at');
select _rename_col_if_exists('hq_vendors', 'updatedAt',    'updated_at');

-- hq_vendor_subjects
select _rename_col_if_exists('hq_vendor_subjects', 'vendorId',    'vendor_id');
select _rename_col_if_exists('hq_vendor_subjects', 'subjectType', 'subject_type');
select _rename_col_if_exists('hq_vendor_subjects', 'createdAt',   'created_at');
select _rename_col_if_exists('hq_vendor_subjects', 'updatedAt',   'updated_at');

-- hq_vendor_products
select _rename_col_if_exists('hq_vendor_products', 'vendorId',          'vendor_id');
select _rename_col_if_exists('hq_vendor_products', 'subjectId',         'subject_id');
select _rename_col_if_exists('hq_vendor_products', 'priceBranch',       'price_branch');
select _rename_col_if_exists('hq_vendor_products', 'priceSchool',       'price_school');
select _rename_col_if_exists('hq_vendor_products', 'priceTeacher',      'price_teacher');
select _rename_col_if_exists('hq_vendor_products', 'priceRetail',       'price_retail');
select _rename_col_if_exists('hq_vendor_products', 'stageCount',        'stage_count');
select _rename_col_if_exists('hq_vendor_products', 'sessionCount',      'session_count');
select _rename_col_if_exists('hq_vendor_products', 'alertSession',      'alert_session');
select _rename_col_if_exists('hq_vendor_products', 'sessionsPerStage',  'sessions_per_stage');
select _rename_col_if_exists('hq_vendor_products', 'createdAt',         'created_at');
select _rename_col_if_exists('hq_vendor_products', 'updatedAt',         'updated_at');

-- hq_vendor_stages
select _rename_col_if_exists('hq_vendor_stages', 'vendorId',   'vendor_id');
select _rename_col_if_exists('hq_vendor_stages', 'productId',  'product_id');
select _rename_col_if_exists('hq_vendor_stages', 'createdAt',  'created_at');
select _rename_col_if_exists('hq_vendor_stages', 'updatedAt',  'updated_at');

-- hq_vendor_contents
select _rename_col_if_exists('hq_vendor_contents', 'stageId',   'stage_id');
select _rename_col_if_exists('hq_vendor_contents', 'productId', 'product_id');
select _rename_col_if_exists('hq_vendor_contents', 'sessionNo', 'session_no');
select _rename_col_if_exists('hq_vendor_contents', 'createdAt', 'created_at');
select _rename_col_if_exists('hq_vendor_contents', 'updatedAt', 'updated_at');

-- hq_vendor_quarters
select _rename_col_if_exists('hq_vendor_quarters', 'vendorId',  'vendor_id');
select _rename_col_if_exists('hq_vendor_quarters', 'productId', 'product_id');
select _rename_col_if_exists('hq_vendor_quarters', 'createdAt', 'created_at');
select _rename_col_if_exists('hq_vendor_quarters', 'updatedAt', 'updated_at');

-- hq_vendor_sessions
select _rename_col_if_exists('hq_vendor_sessions', 'quarterId', 'quarter_id');
select _rename_col_if_exists('hq_vendor_sessions', 'productId', 'product_id');
select _rename_col_if_exists('hq_vendor_sessions', 'createdAt', 'created_at');
select _rename_col_if_exists('hq_vendor_sessions', 'updatedAt', 'updated_at');

-- hq_vendor_files
select _rename_col_if_exists('hq_vendor_files', 'productId',  'product_id');
select _rename_col_if_exists('hq_vendor_files', 'fileType',   'file_type');
select _rename_col_if_exists('hq_vendor_files', 'fileName',   'file_name');
select _rename_col_if_exists('hq_vendor_files', 'fileUrl',    'file_url');
select _rename_col_if_exists('hq_vendor_files', 'stageLabel', 'stage_label');
select _rename_col_if_exists('hq_vendor_files', 'createdAt',  'created_at');
select _rename_col_if_exists('hq_vendor_files', 'updatedAt',  'updated_at');

-- hq_vendor_prices
select _rename_col_if_exists('hq_vendor_prices', 'vendorId',      'vendor_id');
select _rename_col_if_exists('hq_vendor_prices', 'productId',     'product_id');
select _rename_col_if_exists('hq_vendor_prices', 'priceRetail',   'price_retail');
select _rename_col_if_exists('hq_vendor_prices', 'priceSchool',   'price_school');
select _rename_col_if_exists('hq_vendor_prices', 'priceTeacher',  'price_teacher');
select _rename_col_if_exists('hq_vendor_prices', 'priceBranch',   'price_branch');
select _rename_col_if_exists('hq_vendor_prices', 'createdAt',     'created_at');

-- hq_vendor_users
select _rename_col_if_exists('hq_vendor_users', 'vendorId',  'vendor_id');
select _rename_col_if_exists('hq_vendor_users', 'createdAt', 'created_at');
select _rename_col_if_exists('hq_vendor_users', 'updatedAt', 'updated_at');

-- ============================================================
-- STEP 5: school 테이블 컬럼 RENAME (STEP 1에서 테이블명 처리됨)
-- ============================================================

-- school_admins
select _rename_col_if_exists('school_admins', 'schoolName',   'school_name');
select _rename_col_if_exists('school_admins', 'adminName',    'admin_name');
select _rename_col_if_exists('school_admins', 'invitedAt',    'invited_at');
select _rename_col_if_exists('school_admins', 'invitedEmail', 'invited_email');
select _rename_col_if_exists('school_admins', 'createdAt',    'created_at');
select _rename_col_if_exists('school_admins', 'updatedAt',    'updated_at');

-- school_admin_accounts
select _rename_col_if_exists('school_admin_accounts', 'adminId',   'admin_id');
select _rename_col_if_exists('school_admin_accounts', 'createdAt', 'created_at');
select _rename_col_if_exists('school_admin_accounts', 'updatedAt', 'updated_at');

-- school_admin_teachers
select _rename_col_if_exists('school_admin_teachers', 'adminId',      'admin_id');
select _rename_col_if_exists('school_admin_teachers', 'teacherId',    'teacher_id');
select _rename_col_if_exists('school_admin_teachers', 'schoolName',   'school_name');
select _rename_col_if_exists('school_admin_teachers', 'teacherName',  'teacher_name');
select _rename_col_if_exists('school_admin_teachers', 'teacherPhone', 'teacher_phone');
select _rename_col_if_exists('school_admin_teachers', 'feeAccount',   'fee_account');
select _rename_col_if_exists('school_admin_teachers', 'vendorBiz',    'vendor_biz');
select _rename_col_if_exists('school_admin_teachers', 'vendorAccount','vendor_account');
select _rename_col_if_exists('school_admin_teachers', 'linkedAt',     'linked_at');
select _rename_col_if_exists('school_admin_teachers', 'startDate',    'start_date');
select _rename_col_if_exists('school_admin_teachers', 'endDate',      'end_date');
select _rename_col_if_exists('school_admin_teachers', 'createdAt',    'created_at');
select _rename_col_if_exists('school_admin_teachers', 'updatedAt',    'updated_at');

-- school_subjects
select _rename_col_if_exists('school_subjects', 'adminId',    'admin_id');
select _rename_col_if_exists('school_subjects', 'schoolName', 'school_name');
select _rename_col_if_exists('school_subjects', 'className',  'class_name');
select _rename_col_if_exists('school_subjects', 'startTime',  'start_time');
select _rename_col_if_exists('school_subjects', 'endTime',    'end_time');
select _rename_col_if_exists('school_subjects', 'teacherIds', 'teacher_ids');
select _rename_col_if_exists('school_subjects', 'promoFiles', 'promo_files');
select _rename_col_if_exists('school_subjects', 'createdAt',  'created_at');
select _rename_col_if_exists('school_subjects', 'updatedAt',  'updated_at');

-- school_teacher_invites
select _rename_col_if_exists('school_teacher_invites', 'adminId',      'admin_id');
select _rename_col_if_exists('school_teacher_invites', 'schoolName',   'school_name');
select _rename_col_if_exists('school_teacher_invites', 'adminName',    'admin_name');
select _rename_col_if_exists('school_teacher_invites', 'teacherEmail', 'teacher_email');
select _rename_col_if_exists('school_teacher_invites', 'teacherName',  'teacher_name');
select _rename_col_if_exists('school_teacher_invites', 'teacherId',    'teacher_id');
select _rename_col_if_exists('school_teacher_invites', 'noticeId',     'notice_id');
select _rename_col_if_exists('school_teacher_invites', 'sentAt',       'sent_at');
select _rename_col_if_exists('school_teacher_invites', 'acceptedAt',   'accepted_at');
select _rename_col_if_exists('school_teacher_invites', 'declinedAt',   'declined_at');
select _rename_col_if_exists('school_teacher_invites', 'createdAt',    'created_at');
select _rename_col_if_exists('school_teacher_invites', 'updatedAt',    'updated_at');

-- school_notices
select _rename_col_if_exists('school_notices', 'adminId',          'admin_id');
select _rename_col_if_exists('school_notices', 'schoolName',       'school_name');
select _rename_col_if_exists('school_notices', 'dueDate',          'due_date');
select _rename_col_if_exists('school_notices', 'attachUrl',        'attach_url');
select _rename_col_if_exists('school_notices', 'attachName',       'attach_name');
select _rename_col_if_exists('school_notices', 'targetTeacherIds', 'target_teacher_ids');
select _rename_col_if_exists('school_notices', 'startDate',        'start_date');
select _rename_col_if_exists('school_notices', 'endDate',          'end_date');
select _rename_col_if_exists('school_notices', 'taskStart',        'task_start');
select _rename_col_if_exists('school_notices', 'taskEnd',          'task_end');
select _rename_col_if_exists('school_notices', 'createdAt',        'created_at');
select _rename_col_if_exists('school_notices', 'updatedAt',        'updated_at');

-- school_notice_submits
select _rename_col_if_exists('school_notice_submits', 'noticeId',    'notice_id');
select _rename_col_if_exists('school_notice_submits', 'teacherId',   'teacher_id');
select _rename_col_if_exists('school_notice_submits', 'adminId',     'admin_id');
select _rename_col_if_exists('school_notice_submits', 'fileUrl',     'file_url');
select _rename_col_if_exists('school_notice_submits', 'fileName',    'file_name');
select _rename_col_if_exists('school_notice_submits', 'submittedAt', 'submitted_at');
select _rename_col_if_exists('school_notice_submits', 'repliedAt',   'replied_at');
select _rename_col_if_exists('school_notice_submits', 'confirmedAt', 'confirmed_at');
select _rename_col_if_exists('school_notice_submits', 'createdAt',   'created_at');
select _rename_col_if_exists('school_notice_submits', 'updatedAt',   'updated_at');

-- school_calendar
select _rename_col_if_exists('school_calendar', 'adminId',         'admin_id');
select _rename_col_if_exists('school_calendar', 'schoolName',      'school_name');
select _rename_col_if_exists('school_calendar', 'termType',        'term_type');
select _rename_col_if_exists('school_calendar', 'termCount',       'term_count');
select _rename_col_if_exists('school_calendar', 'termSizes',       'term_sizes');
select _rename_col_if_exists('school_calendar', 'repeatType',      'repeat_type');
select _rename_col_if_exists('school_calendar', 'startDate',       'start_date');
select _rename_col_if_exists('school_calendar', 'endDate',         'end_date');
select _rename_col_if_exists('school_calendar', 'cancelledDates',  'cancelled_dates');
select _rename_col_if_exists('school_calendar', 'makeupDates',     'makeup_dates');
select _rename_col_if_exists('school_calendar', 'applyStartAt',    'apply_start_at');
select _rename_col_if_exists('school_calendar', 'applyEndAt',      'apply_end_at');
select _rename_col_if_exists('school_calendar', 'totalSessions',   'total_sessions');
select _rename_col_if_exists('school_calendar', 'sem1End',         'sem1_end');
select _rename_col_if_exists('school_calendar', 'sumStart',        'sum_start');
select _rename_col_if_exists('school_calendar', 'sumEnd',          'sum_end');
select _rename_col_if_exists('school_calendar', 'sem2End',         'sem2_end');
select _rename_col_if_exists('school_calendar', 'winStart',        'win_start');
select _rename_col_if_exists('school_calendar', 'winEnd',          'win_end');
select _rename_col_if_exists('school_calendar', 'qEnds',           'q_ends');
select _rename_col_if_exists('school_calendar', 'termSessionMap',  'term_session_map');
select _rename_col_if_exists('school_calendar', 'defaultSessions', 'default_sessions');
select _rename_col_if_exists('school_calendar', 'regPeriods',      'reg_periods');
select _rename_col_if_exists('school_calendar', 'quarterTermCounts','quarter_term_counts');
select _rename_col_if_exists('school_calendar', 'createdAt',       'created_at');
select _rename_col_if_exists('school_calendar', 'updatedAt',       'updated_at');

-- school_info
select _rename_col_if_exists('school_info', 'adminId',       'admin_id');
select _rename_col_if_exists('school_info', 'schoolName',    'school_name');
select _rename_col_if_exists('school_info', 'officePhone',   'office_phone');
select _rename_col_if_exists('school_info', 'afterPhone',    'after_phone');
select _rename_col_if_exists('school_info', 'addressDetail', 'address_detail');
select _rename_col_if_exists('school_info', 'createdAt',     'created_at');
select _rename_col_if_exists('school_info', 'updatedAt',     'updated_at');

-- ============================================================
-- STEP 6: 빈 snake_case 중복 테이블 DROP (camel쪽 데이터 이전 완료 후)
-- ============================================================

-- 아래는 camelCase에서 INSERT로 병합 완료됐으므로 안전하게 DROP
-- (message_guides, message_categories는 STEP 2에서 이미 처리)

-- ============================================================
-- STEP 7: supply_school_prices 생성 및 중복 updated_at 정리
-- ============================================================
create table if not exists supply_school_prices (
  id           text primary key default gen_random_uuid()::text,
  teacher_id   text,
  product_id   text,
  product_name text,
  school_name  text,
  price        integer default 0,
  memo         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  _deleted     boolean default false
);

select _rename_col_if_exists('supply_school_prices', 'updatedAt', 'updated_at_old');

do $$ begin
  if exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='supply_school_prices' and column_name='updated_at_old')
  then
    update supply_school_prices set updated_at = updated_at_old where updated_at is null and updated_at_old is not null;
    alter table supply_school_prices drop column updated_at_old cascade;
  end if;
end $$;

-- ============================================================
-- STEP 8: RLS 정책 업데이트 (이름이 바뀐 테이블들)
-- ============================================================

-- supply_given
alter table if exists supply_given enable row level security;
drop policy if exists "supply_given_all"     on supply_given;
drop policy if exists "supplyGiven_all"      on supply_given;
create policy "supply_given_all" on supply_given for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_school_prices
alter table if exists supply_school_prices enable row level security;
drop policy if exists "supply_school_prices_all"  on supply_school_prices;
drop policy if exists "supplySchoolPrices_all"    on supply_school_prices;
create policy "supply_school_prices_all" on supply_school_prices for all
  using (teacher_id = get_my_user_id() or is_admin());

-- teacher_profiles
alter table if exists teacher_profiles enable row level security;
drop policy if exists "teacher_profiles_all" on teacher_profiles;
drop policy if exists "teacherProfiles_all"  on teacher_profiles;
create policy "teacher_profiles_all" on teacher_profiles for all
  using (teacher_id = get_my_user_id() or is_admin());

-- message_guides (이미 있으나 확인)
alter table if exists message_guides enable row level security;
drop policy if exists "message_guides_all"  on message_guides;
drop policy if exists "messageGuides_all"   on message_guides;
create policy "message_guides_all" on message_guides for all
  using (teacher_id = get_my_user_id() or is_admin());

-- message_categories
alter table if exists message_categories enable row level security;
drop policy if exists "message_categories_all"  on message_categories;
drop policy if exists "messageCategories_all"   on message_categories;
create policy "message_categories_all" on message_categories for all
  using (teacher_id = get_my_user_id() or is_admin());

-- revenue_fees
alter table if exists revenue_fees enable row level security;
drop policy if exists "revenue_fees_all"   on revenue_fees;
drop policy if exists "revenueFees_all"    on revenue_fees;
create policy "revenue_fees_all" on revenue_fees for all
  using (teacher_id = get_my_user_id() or is_admin());

-- revenue_payments
alter table if exists revenue_payments enable row level security;
drop policy if exists "revenue_payments_all"  on revenue_payments;
drop policy if exists "revenuePayments_all"   on revenue_payments;
create policy "revenue_payments_all" on revenue_payments for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_subjects
alter table if exists supply_subjects enable row level security;
drop policy if exists "supply_subjects_all"  on supply_subjects;
drop policy if exists "supplySubjects_all"   on supply_subjects;
create policy "supply_subjects_all" on supply_subjects for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_vendors
alter table if exists supply_vendors enable row level security;
drop policy if exists "supply_vendors_all"  on supply_vendors;
drop policy if exists "supplyVendors_all"   on supply_vendors;
create policy "supply_vendors_all" on supply_vendors for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_plans
alter table if exists supply_plans enable row level security;
drop policy if exists "supply_plans_all"  on supply_plans;
drop policy if exists "supplyPlans_all"   on supply_plans;
create policy "supply_plans_all" on supply_plans for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_products
alter table if exists supply_products enable row level security;
drop policy if exists "supply_products_all"  on supply_products;
drop policy if exists "supplyProducts_all"   on supply_products;
create policy "supply_products_all" on supply_products for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_product_plans
alter table if exists supply_product_plans enable row level security;
drop policy if exists "supply_product_plans_all"  on supply_product_plans;
drop policy if exists "supplyProductPlans_all"    on supply_product_plans;
create policy "supply_product_plans_all" on supply_product_plans for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_items
alter table if exists supply_items enable row level security;
drop policy if exists "supply_items_all"  on supply_items;
drop policy if exists "supplyItems_all"   on supply_items;
create policy "supply_items_all" on supply_items for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_parts
alter table if exists supply_parts enable row level security;
drop policy if exists "supply_parts_all"  on supply_parts;
drop policy if exists "supplyParts_all"   on supply_parts;
create policy "supply_parts_all" on supply_parts for all
  using (is_admin());

-- supply_student_progress
alter table if exists supply_student_progress enable row level security;
drop policy if exists "supply_student_progress_all"  on supply_student_progress;
drop policy if exists "supplyStudentProgress_all"    on supply_student_progress;
create policy "supply_student_progress_all" on supply_student_progress for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_session_checks
alter table if exists supply_session_checks enable row level security;
drop policy if exists "supply_session_checks_all"  on supply_session_checks;
drop policy if exists "supplySessionChecks_all"    on supply_session_checks;
create policy "supply_session_checks_all" on supply_session_checks for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_progress_logs
alter table if exists supply_progress_logs enable row level security;
drop policy if exists "supply_progress_logs_all"  on supply_progress_logs;
drop policy if exists "supplyProgressLogs_all"    on supply_progress_logs;
create policy "supply_progress_logs_all" on supply_progress_logs for all
  using (teacher_id = get_my_user_id() or is_admin());

-- supply_promos
alter table if exists supply_promos enable row level security;
drop policy if exists "supply_promos_all"  on supply_promos;
drop policy if exists "supplyPromos_all"   on supply_promos;
create policy "supply_promos_all" on supply_promos for all
  using (teacher_id = get_my_user_id() or is_admin());

-- job_subs
alter table if exists job_subs enable row level security;
drop policy if exists "job_subs_all"  on job_subs;
drop policy if exists "jobSubs_all"   on job_subs;
create policy "job_subs_all" on job_subs for all
  using (teacher_id = get_my_user_id() or is_admin());

-- hq 테이블들
alter table if exists hq_vendors            enable row level security;
alter table if exists hq_vendor_subjects    enable row level security;
alter table if exists hq_vendor_products    enable row level security;
alter table if exists hq_vendor_stages      enable row level security;
alter table if exists hq_vendor_contents    enable row level security;
alter table if exists hq_vendor_quarters    enable row level security;
alter table if exists hq_vendor_sessions    enable row level security;
alter table if exists hq_vendor_files       enable row level security;
alter table if exists hq_vendor_prices      enable row level security;
alter table if exists hq_vendor_users       enable row level security;

do $$
declare t text;
  tables text[] := array['hq_vendors','hq_vendor_subjects','hq_vendor_products',
    'hq_vendor_stages','hq_vendor_contents','hq_vendor_quarters',
    'hq_vendor_sessions','hq_vendor_files','hq_vendor_prices','hq_vendor_users'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on %I', t||'_deny_direct', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('create policy %I on %I for all using (false)', t||'_deny_direct', t);
  end loop;
end $$;

-- vendor_accounts
alter table if exists vendor_accounts enable row level security;
drop policy if exists "vendor_accounts_deny_direct" on vendor_accounts;
drop policy if exists "vendorAccounts_deny_direct"  on vendor_accounts;
create policy "vendor_accounts_deny_direct" on vendor_accounts for all using (false);

-- school 테이블들
alter table if exists school_admins           enable row level security;
alter table if exists school_admin_accounts   enable row level security;
alter table if exists school_admin_teachers   enable row level security;
alter table if exists school_subjects         enable row level security;
alter table if exists school_teacher_invites  enable row level security;
alter table if exists school_notices          enable row level security;
alter table if exists school_notice_submits   enable row level security;
alter table if exists school_calendar         enable row level security;
alter table if exists school_info             enable row level security;

drop policy if exists "school_admins_all"         on school_admins;
drop policy if exists "schoolAdmins_all"          on school_admins;
create policy "school_admins_all" on school_admins for all using (is_admin());

drop policy if exists "school_admin_accounts_own"    on school_admin_accounts;
drop policy if exists "school_admin_accounts_write"  on school_admin_accounts;
drop policy if exists "schoolAdminAccounts_own"      on school_admin_accounts;
drop policy if exists "schoolAdminAccounts_write"    on school_admin_accounts;
create policy "school_admin_accounts_own"   on school_admin_accounts for select using (admin_id = get_my_user_id() or is_admin());
create policy "school_admin_accounts_write" on school_admin_accounts for all    using (admin_id = get_my_user_id() or is_admin());

drop policy if exists "school_admin_teachers_all"  on school_admin_teachers;
drop policy if exists "schoolAdminTeachers_all"    on school_admin_teachers;
create policy "school_admin_teachers_all" on school_admin_teachers for all
  using (admin_id = get_my_user_id() or teacher_id = get_my_user_id() or is_admin());

drop policy if exists "school_subjects_select"  on school_subjects;
drop policy if exists "school_subjects_write"   on school_subjects;
drop policy if exists "schoolSubjects_select"   on school_subjects;
drop policy if exists "schoolSubjects_write"    on school_subjects;
create policy "school_subjects_select" on school_subjects for select using (true);
create policy "school_subjects_write"  on school_subjects for all    using (is_admin());

drop policy if exists "school_teacher_invites_all"  on school_teacher_invites;
drop policy if exists "schoolTeacherInvites_all"    on school_teacher_invites;
create policy "school_teacher_invites_all" on school_teacher_invites for all
  using (teacher_id = get_my_user_id() or admin_id = get_my_user_id() or is_admin());

drop policy if exists "school_notices_select"  on school_notices;
drop policy if exists "school_notices_write"   on school_notices;
drop policy if exists "schoolNotices_select"   on school_notices;
drop policy if exists "schoolNotices_write"    on school_notices;
create policy "school_notices_select" on school_notices for select using (true);
create policy "school_notices_write"  on school_notices for all    using (admin_id = get_my_user_id() or is_admin());

drop policy if exists "school_notice_submits_all"  on school_notice_submits;
drop policy if exists "schoolNoticeSubmits_all"    on school_notice_submits;
create policy "school_notice_submits_all" on school_notice_submits for all
  using (teacher_id = get_my_user_id() or admin_id = get_my_user_id() or is_admin());

drop policy if exists "school_calendar_select"  on school_calendar;
drop policy if exists "school_calendar_write"   on school_calendar;
drop policy if exists "schoolCalendar_select"   on school_calendar;
drop policy if exists "schoolCalendar_write"    on school_calendar;
create policy "school_calendar_select" on school_calendar for select using (true);
create policy "school_calendar_write"  on school_calendar for all   using (admin_id = get_my_user_id() or is_admin());

drop policy if exists "school_info_select"  on school_info;
drop policy if exists "school_info_write"   on school_info;
drop policy if exists "schoolInfo_select"   on school_info;
drop policy if exists "schoolInfo_write"    on school_info;
create policy "school_info_select" on school_info for select using (true);
create policy "school_info_write"  on school_info for all   using (is_admin());

-- ============================================================
-- STEP 9: 헬퍼 함수 정리
-- ============================================================

drop function if exists _rename_col_if_exists(text, text, text);

-- ============================================================
-- 완료 확인용 쿼리 (실행 후 결과 확인)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public' AND table_type='BASE TABLE'
-- AND table_name ~ '[A-Z]'  -- camelCase 테이블이 남아있으면 여기 표시됨
-- ORDER BY table_name;

