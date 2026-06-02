-- ============================================================
-- 000_complete_schema.sql
-- 전체 스키마 완전판 — snake_case 통일
-- 기존 001, 002, 003 대체
-- 
-- 실행 방법:
-- Supabase Dashboard → SQL Editor → 전체 복사 붙여넣기 → Run
-- ============================================================

-- UUID 확장
create extension if not exists "uuid-ossp";

-- ============================================================
-- PART 1. 헬퍼 함수 (RLS 정책에서 사용)
-- ============================================================

create or replace function get_my_user_id()
returns text language sql security definer stable as $$
  select id from users where auth_id = auth.uid() limit 1;
$$;

create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from users where auth_id = auth.uid() and level >= 10
  );
$$;

-- ============================================================
-- PART 2. 기존 테이블 컬럼명 snake_case 로 변경 (데이터 보존)
-- ============================================================

-- ─── revenueFees
alter table if exists "revenueFees" rename column "teacherId" to teacher_id;
alter table if exists "revenueFees" rename column "classId"   to class_id;
alter table if exists "revenueFees" rename column "feeType"   to fee_type;
alter table if exists "revenueFees" rename column "createdAt" to created_at;
alter table if exists "revenueFees" rename column "updatedAt" to updated_at;

-- ─── revenuePayments
alter table if exists "revenuePayments" rename column "teacherId" to teacher_id;
alter table if exists "revenuePayments" rename column "classId"   to class_id;
alter table if exists "revenuePayments" rename column "termNo"    to term_no;
alter table if exists "revenuePayments" rename column "createdAt" to created_at;
alter table if exists "revenuePayments" rename column "updatedAt" to updated_at;

-- ─── trainings
alter table if exists trainings rename column "teacherId"     to teacher_id;
alter table if exists trainings rename column "providerUrl"   to provider_url;
alter table if exists trainings rename column "completionNum" to completion_num;
alter table if exists trainings rename column "completedAt"   to completed_at;
alter table if exists trainings rename column "fileUrl"       to file_url;
alter table if exists trainings rename column "fileName"      to file_name;
alter table if exists trainings rename column "fileType"      to file_type;
alter table if exists trainings rename column "createdAt"     to created_at;
alter table if exists trainings rename column "updatedAt"     to updated_at;

-- ─── careers
alter table if exists careers rename column "teacherId"        to teacher_id;
alter table if exists careers rename column "orgName"          to org_name;
alter table if exists careers rename column "jobType"          to job_type;
alter table if exists careers rename column "schoolType"       to school_type;
alter table if exists careers rename column "customSchoolType" to custom_school_type;
alter table if exists careers rename column "startDate"        to start_date;
alter table if exists careers rename column "endDate"          to end_date;
alter table if exists careers rename column "isCurrent"        to is_current;
alter table if exists careers rename column "isOneDay"         to is_one_day;
alter table if exists careers rename column "fileUrl"          to file_url;
alter table if exists careers rename column "fileName"         to file_name;
alter table if exists careers rename column "fileType"         to file_type;
alter table if exists careers rename column "sortOrder"        to sort_order;
alter table if exists careers rename column "createdAt"        to created_at;
alter table if exists careers rename column "updatedAt"        to updated_at;

-- ─── educations
alter table if exists educations rename column "teacherId"      to teacher_id;
alter table if exists educations rename column "schoolName"     to school_name;
alter table if exists educations rename column "eduType"        to edu_type;
alter table if exists educations rename column "admissionDate"  to admission_date;
alter table if exists educations rename column "graduationDate" to graduation_date;
alter table if exists educations rename column "fileUrl"        to file_url;
alter table if exists educations rename column "fileName"       to file_name;
alter table if exists educations rename column "fileType"       to file_type;
alter table if exists educations rename column "createdAt"      to created_at;
alter table if exists educations rename column "updatedAt"      to updated_at;

-- ─── certificates
alter table if exists certificates rename column "teacherId"     to teacher_id;
alter table if exists certificates rename column "certType"      to cert_type;
alter table if exists certificates rename column "certNumber"    to cert_number;
alter table if exists certificates rename column "privateRegNum" to private_reg_num;
alter table if exists certificates rename column "issuedAt"      to issued_at;
alter table if exists certificates rename column "expiresAt"     to expires_at;
alter table if exists certificates rename column "noExpiry"      to no_expiry;
alter table if exists certificates rename column "fileUrl"       to file_url;
alter table if exists certificates rename column "fileName"      to file_name;
alter table if exists certificates rename column "fileType"      to file_type;
alter table if exists certificates rename column "sortOrder"     to sort_order;
alter table if exists certificates rename column "createdAt"     to created_at;
alter table if exists certificates rename column "updatedAt"     to updated_at;

-- ─── awards
alter table if exists awards rename column "teacherId"   to teacher_id;
alter table if exists awards rename column "contestName" to contest_name;
alter table if exists awards rename column "awardType"   to award_type;
alter table if exists awards rename column "awardedAt"   to awarded_at;
alter table if exists awards rename column "fileUrl"     to file_url;
alter table if exists awards rename column "fileName"    to file_name;
alter table if exists awards rename column "fileType"    to file_type;
alter table if exists awards rename column "createdAt"   to created_at;
alter table if exists awards rename column "updatedAt"   to updated_at;

-- ─── jobSubs
alter table if exists "jobSubs" rename column "teacherId"    to teacher_id;
alter table if exists "jobSubs" rename column "notifySms"    to notify_sms;
alter table if exists "jobSubs" rename column "notifyKakao"  to notify_kakao;
alter table if exists "jobSubs" rename column "notifyEmail"  to notify_email;
alter table if exists "jobSubs" rename column "createdAt"    to created_at;
alter table if exists "jobSubs" rename column "updatedAt"    to updated_at;

-- ─── supplySubjects
alter table if exists "supplySubjects" rename column "teacherId"  to teacher_id;
alter table if exists "supplySubjects" rename column "sortOrder"  to sort_order;
alter table if exists "supplySubjects" rename column "createdAt"  to created_at;
alter table if exists "supplySubjects" rename column "updatedAt"  to updated_at;

-- ─── supplyVendors
alter table if exists "supplyVendors" rename column "teacherId"   to teacher_id;
alter table if exists "supplyVendors" rename column "managerName" to manager_name;
alter table if exists "supplyVendors" rename column "createdAt"   to created_at;
alter table if exists "supplyVendors" rename column "updatedAt"   to updated_at;

-- ─── supplyItems
alter table if exists "supplyItems" rename column "teacherId"  to teacher_id;
alter table if exists "supplyItems" rename column "classId"    to class_id;
alter table if exists "supplyItems" rename column "studentId"  to student_id;
alter table if exists "supplyItems" rename column "productId"  to product_id;
alter table if exists "supplyItems" rename column "createdAt"  to created_at;
alter table if exists "supplyItems" rename column "updatedAt"  to updated_at;

-- ─── supplyPlans
alter table if exists "supplyPlans" rename column "teacherId"  to teacher_id;
alter table if exists "supplyPlans" rename column "fileType"   to file_type;
alter table if exists "supplyPlans" rename column "vendorId"   to vendor_id;
alter table if exists "supplyPlans" rename column "productId"  to product_id;
alter table if exists "supplyPlans" rename column "fileUrl"    to file_url;
alter table if exists "supplyPlans" rename column "fileName"   to file_name;
alter table if exists "supplyPlans" rename column "createdAt"  to created_at;
alter table if exists "supplyPlans" rename column "updatedAt"  to updated_at;

-- ─── supplyPromos
alter table if exists "supplyPromos" rename column "teacherId"  to teacher_id;
alter table if exists "supplyPromos" rename column "fileType"   to file_type;
alter table if exists "supplyPromos" rename column "vendorId"   to vendor_id;
alter table if exists "supplyPromos" rename column "productId"  to product_id;
alter table if exists "supplyPromos" rename column "fileUrl"    to file_url;
alter table if exists "supplyPromos" rename column "fileName"   to file_name;
alter table if exists "supplyPromos" rename column "createdAt"  to created_at;
alter table if exists "supplyPromos" rename column "updatedAt"  to updated_at;

-- ─── supplyProducts
alter table if exists "supplyProducts" rename column "teacherId"        to teacher_id;
alter table if exists "supplyProducts" rename column "vendorId"         to vendor_id;
alter table if exists "supplyProducts" rename column "maxStage"         to max_stage;
alter table if exists "supplyProducts" rename column "sessionsPerStage" to sessions_per_stage;
alter table if exists "supplyProducts" rename column "alertSession"     to alert_session;
alter table if exists "supplyProducts" rename column "createdAt"        to created_at;
alter table if exists "supplyProducts" rename column "updatedAt"        to updated_at;

-- ─── supplyProductPlans
alter table if exists "supplyProductPlans" rename column "teacherId"  to teacher_id;
alter table if exists "supplyProductPlans" rename column "productId"  to product_id;
alter table if exists "supplyProductPlans" rename column "sessionNo"  to session_no;
alter table if exists "supplyProductPlans" rename column "fileName"   to file_name;
alter table if exists "supplyProductPlans" rename column "fileUrl"    to file_url;
alter table if exists "supplyProductPlans" rename column "fileType"   to file_type;
alter table if exists "supplyProductPlans" rename column "createdAt"  to created_at;
alter table if exists "supplyProductPlans" rename column "updatedAt"  to updated_at;

-- ─── supplyStudentProgress
alter table if exists "supplyStudentProgress" rename column "teacherId"  to teacher_id;
alter table if exists "supplyStudentProgress" rename column "studentId"  to student_id;
alter table if exists "supplyStudentProgress" rename column "classId"    to class_id;
alter table if exists "supplyStudentProgress" rename column "productId"  to product_id;
alter table if exists "supplyStudentProgress" rename column "curStage"   to cur_stage;
alter table if exists "supplyStudentProgress" rename column "curSession" to cur_session;
alter table if exists "supplyStudentProgress" rename column "createdAt"  to created_at;
alter table if exists "supplyStudentProgress" rename column "updatedAt"  to updated_at;

-- ─── supplyProgressLogs
alter table if exists "supplyProgressLogs" rename column "teacherId"  to teacher_id;
alter table if exists "supplyProgressLogs" rename column "studentId"  to student_id;
alter table if exists "supplyProgressLogs" rename column "classId"    to class_id;
alter table if exists "supplyProgressLogs" rename column "productId"  to product_id;
alter table if exists "supplyProgressLogs" rename column "createdAt"  to created_at;
alter table if exists "supplyProgressLogs" rename column "updatedAt"  to updated_at;

-- ─── supplySessionChecks
alter table if exists "supplySessionChecks" rename column "teacherId"  to teacher_id;
alter table if exists "supplySessionChecks" rename column "studentId"  to student_id;
alter table if exists "supplySessionChecks" rename column "classId"    to class_id;
alter table if exists "supplySessionChecks" rename column "productId"  to product_id;
alter table if exists "supplySessionChecks" rename column "sessionNo"  to session_no;
alter table if exists "supplySessionChecks" rename column "checkedAt"  to checked_at;
alter table if exists "supplySessionChecks" rename column "createdAt"  to created_at;
alter table if exists "supplySessionChecks" rename column "updatedAt"  to updated_at;

-- ─── supplyGiven
alter table if exists "supplyGiven" rename column "teacherId"    to teacher_id;
alter table if exists "supplyGiven" rename column "studentId"    to student_id;
alter table if exists "supplyGiven" rename column "studentName"  to student_name;
alter table if exists "supplyGiven" rename column "classId"      to class_id;
alter table if exists "supplyGiven" rename column "className"    to class_name;
alter table if exists "supplyGiven" rename column "schoolName"   to school_name;
alter table if exists "supplyGiven" rename column "productId"    to product_id;
alter table if exists "supplyGiven" rename column "productName"  to product_name;
alter table if exists "supplyGiven" rename column "itemName"     to item_name;
alter table if exists "supplyGiven" rename column "givenAt"      to given_at;
alter table if exists "supplyGiven" rename column "createdAt"    to created_at;
alter table if exists "supplyGiven" rename column "updatedAt"    to updated_at;

-- ============================================================
-- PART 3. 누락 테이블 신규 생성
-- ============================================================

create table if not exists lesson_memos (
  id         text primary key,
  teacher_id text,
  class_id   text,
  date       text default ,
  content    text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists teacher_service_configs (
  id           text primary key,
  teacher_id   text references users(id) on delete cascade,
  config_key   text default parent_service,
  config_value jsonb default {},
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  _deleted     boolean default false
);

create table if not exists "teacherProfiles" (
  id         text primary key,
  teacher_id text,
  name       text default ,
  nickname   text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists documents (
  id         text primary key,
  teacher_id text,
  category   text default ,
  title      text default ,
  year       text default ,
  file_name  text default ,
  file_type  text default ,
  file_data  text,
  days       jsonb default [],
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists custom_categories (
  id         text primary key,
  teacher_id text,
  name       text default ,
  type       text default ,
  sort_order int  default 0,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists "supplyParts" (
  id         text primary key,
  teacher_id text,
  product_id text,
  name       text default ,
  qty        int  default 0,
  memo       text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists "supplySchoolPrices" (
  id           text primary key,
  teacher_id   text,
  product_id   text,
  product_name text default ,
  school_name  text default ,
  price        int  default 0,
  memo         text default ,
  created_at   text,
  updated_at   text,
  _deleted     boolean default false
);

create table if not exists blog_posts (
  id           text primary key,
  type         text default blog,
  title        text not null,
  slug         text default ,
  summary      text default ,
  content      text default ,
  category     text default ,
  tags         jsonb default [],
  cover_image  text default ,
  author       text default ,
  status       text default draft,
  published_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  _deleted     boolean default false
);

create table if not exists "schoolAdmins" (
  id          text primary key,
  admin_name  text default ,
  school_name text default ,
  email       text default ,
  phone       text default ,
  role        text default admin,
  active      boolean default true,
  created_at  text,
  updated_at  text,
  _deleted    boolean default false
);

create table if not exists "schoolAdminAccounts" (
  id         text primary key,
  admin_id   text,
  email      text default ,
  pw         text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists "schoolAdminTeachers" (
  id           text primary key,
  admin_id     text,
  teacher_id   text,
  teacher_name text default ,
  email        text default ,
  active       boolean default true,
  created_at   text,
  updated_at   text,
  _deleted     boolean default false
);

create table if not exists "schoolSubjects" (
  id           text primary key,
  admin_id     text,
  year         text default ,
  school_name  text default ,
  name         text default ,
  subject      text default ,
  days         jsonb default [],
  times        jsonb default {},
  capacity     text default ,
  duration     text default ,
  teacher_ids  jsonb default [],
  location     text default ,
  promo_files  jsonb default [],
  active       boolean default true,
  created_at   text,
  updated_at   text,
  _deleted     boolean default false
);

create table if not exists "schoolTeacherInvites" (
  id           text primary key,
  admin_id     text,
  teacher_id   text,
  teacher_name text default ,
  email        text default ,
  status       text default pending,
  created_at   text,
  updated_at   text,
  _deleted     boolean default false
);

create table if not exists "schoolNotices" (
  id          text primary key,
  admin_id    text,
  type        text default notice,
  title       text default ,
  content     text default ,
  complete_on text default replied,
  start_date  text,
  end_date    text,
  due_date    text,
  attach_name text,
  attach_url  text,
  status      text default active,
  created_at  text,
  updated_at  text,
  _deleted    boolean default false
);

create table if not exists "schoolNoticeSubmits" (
  id          text primary key,
  notice_id   text,
  teacher_id  text,
  admin_id    text,
  status      text default pending,
  reply       text default ,
  replied_at  text,
  created_at  text,
  updated_at  text,
  _deleted    boolean default false
);

create table if not exists "schoolCalendar" (
  id          text primary key,
  admin_id    text,
  school_name text default ,
  title       text default ,
  type        text default event,
  date        text default ,
  start_date  text default ,
  end_date    text default ,
  content     text default ,
  color       text default ,
  created_at  text,
  updated_at  text,
  _deleted    boolean default false
);

create table if not exists "schoolInfo" (
  id             text primary key,
  admin_id       text,
  school_name    text default ,
  office_phone   text default ,
  after_phone    text default ,
  address        text default ,
  address_detail text default ,
  homepage       text default ,
  docs           jsonb default {},
  created_at     text,
  updated_at     text,
  _deleted       boolean default false
);

create table if not exists "messageGuides" (
  id         text primary key,
  teacher_id text,
  category   text default ,
  title      text default ,
  content    text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists "messageCategories" (
  id         text primary key,
  teacher_id text,
  name       text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists "hqVendors" (
  id           text primary key,
  name         text not null,
  manager_name text default ,
  phone        text default ,
  email        text default ,
  kakao_id     text default ,
  memo         text default ,
  status       text default pending,
  created_at   text,
  updated_at   text,
  _deleted     boolean default false
);

create table if not exists "hqVendorSubjects" (
  id         text primary key,
  vendor_id  text,
  name       text not null,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

create table if not exists "hqVendorProducts" (
  id          text primary key,
  vendor_id   text,
  subject_id  text,
  name        text not null,
  type        text default annual,
  price       int  default 0,
  description text default ,
  created_at  text,
  updated_at  text,
  _deleted    boolean default false
);

create table if not exists "vendorAccounts" (
  id         text primary key,
  vendor_id  text,
  email      text default ,
  pw         text default ,
  created_at text,
  updated_at text,
  _deleted   boolean default false
);

-- ============================================================
-- PART 4. RLS 활성화
-- ============================================================

alter table lesson_memos             enable row level security;
alter table teacher_service_configs  enable row level security;
alter table "teacherProfiles"        enable row level security;
alter table documents                enable row level security;
alter table custom_categories        enable row level security;
alter table "supplyParts"            enable row level security;
alter table "supplySchoolPrices"     enable row level security;
alter table blog_posts               enable row level security;
alter table "schoolAdmins"           enable row level security;
alter table "schoolAdminAccounts"    enable row level security;
alter table "schoolAdminTeachers"    enable row level security;
alter table "schoolSubjects"         enable row level security;
alter table "schoolTeacherInvites"   enable row level security;
alter table "schoolNotices"          enable row level security;
alter table "schoolNoticeSubmits"    enable row level security;
alter table "schoolCalendar"         enable row level security;
alter table "schoolInfo"             enable row level security;
alter table "messageGuides"          enable row level security;
alter table "messageCategories"      enable row level security;
alter table "hqVendors"              enable row level security;
alter table "hqVendorSubjects"       enable row level security;
alter table "hqVendorProducts"       enable row level security;
alter table "vendorAccounts"         enable row level security;

-- ============================================================
-- PART 5. RLS 정책 재설정 (컬럼명 변경됐으므로 전부 재설정)
-- ============================================================

-- 기존 정책 전부 제거
drop policy if exists "revenueFees_all"           on "revenueFees";
drop policy if exists "revenuePayments_all"        on "revenuePayments";
drop policy if exists "trainings_all"              on trainings;
drop policy if exists "careers_all"                on careers;
drop policy if exists "educations_all"             on educations;
drop policy if exists "certificates_all"           on certificates;
drop policy if exists "awards_all"                 on awards;
drop policy if exists "jobSubs_all"                on "jobSubs";
drop policy if exists "supplySubjects_all"         on "supplySubjects";
drop policy if exists "supplyVendors_all"          on "supplyVendors";
drop policy if exists "supplyItems_all"            on "supplyItems";
drop policy if exists "supplyPlans_all"            on "supplyPlans";
drop policy if exists "supplyPromos_all"           on "supplyPromos";
drop policy if exists "supplyProducts_all"         on "supplyProducts";
drop policy if exists "supplyProductPlans_all"     on "supplyProductPlans";
drop policy if exists "supplyStudentProgress_all"  on "supplyStudentProgress";
drop policy if exists "supplyProgressLogs_all"     on "supplyProgressLogs";
drop policy if exists "supplySessionChecks_all"    on "supplySessionChecks";
drop policy if exists "supplyGiven_all"            on "supplyGiven";

-- 새 정책 (snake_case teacher_id 기준)
create policy "revenueFees_all"           on "revenueFees"           for all using (teacher_id = get_my_user_id() or is_admin());
create policy "revenuePayments_all"       on "revenuePayments"       for all using (teacher_id = get_my_user_id() or is_admin());
create policy "trainings_all"             on trainings               for all using (teacher_id = get_my_user_id() or is_admin());
create policy "careers_all"              on careers                  for all using (teacher_id = get_my_user_id() or is_admin());
create policy "educations_all"           on educations               for all using (teacher_id = get_my_user_id() or is_admin());
create policy "certificates_all"         on certificates             for all using (teacher_id = get_my_user_id() or is_admin());
create policy "awards_all"               on awards                   for all using (teacher_id = get_my_user_id() or is_admin());
create policy "jobSubs_all"              on "jobSubs"                for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplySubjects_all"        on "supplySubjects"        for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyVendors_all"         on "supplyVendors"         for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyItems_all"           on "supplyItems"           for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyPlans_all"           on "supplyPlans"           for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyPromos_all"          on "supplyPromos"          for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyProducts_all"        on "supplyProducts"        for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyProductPlans_all"    on "supplyProductPlans"    for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyStudentProgress_all" on "supplyStudentProgress" for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyProgressLogs_all"    on "supplyProgressLogs"    for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplySessionChecks_all"   on "supplySessionChecks"   for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyGiven_all"           on "supplyGiven"           for all using (teacher_id = get_my_user_id() or is_admin());
create policy "lesson_memos_all"          on lesson_memos            for all using (teacher_id = get_my_user_id() or is_admin());
create policy "teacher_service_configs_all" on teacher_service_configs for all using (teacher_id = get_my_user_id() or is_admin());
create policy "teacherProfiles_all"       on "teacherProfiles"       for all using (teacher_id = get_my_user_id() or is_admin());
create policy "documents_all"             on documents               for all using (teacher_id = get_my_user_id() or is_admin());
create policy "custom_categories_all"     on custom_categories       for all using (teacher_id = get_my_user_id() or is_admin());
create policy "supplyParts_all"           on "supplyParts"           for all using (is_admin());
create policy "supplySchoolPrices_all"    on "supplySchoolPrices"    for all using (teacher_id = get_my_user_id() or is_admin());
create policy "blog_posts_select"         on blog_posts              for select using (true);
create policy "blog_posts_write"          on blog_posts              for all    using (is_admin());
create policy "messageGuides_all"         on "messageGuides"         for all using (teacher_id = get_my_user_id() or is_admin());
create policy "messageCategories_all"     on "messageCategories"     for all using (teacher_id = get_my_user_id() or is_admin());
create policy "schoolAdmins_all"          on "schoolAdmins"          for all using (id = get_my_user_id() or is_admin());
create policy "schoolAdminAccounts_all"   on "schoolAdminAccounts"   for all using (admin_id = get_my_user_id() or is_admin());
create policy "schoolAdminTeachers_all"   on "schoolAdminTeachers"   for all using (admin_id = get_my_user_id() or teacher_id = get_my_user_id() or is_admin());
create policy "schoolSubjects_select"     on "schoolSubjects"        for select using (true);
create policy "schoolSubjects_write"      on "schoolSubjects"        for all    using (is_admin());
create policy "schoolTeacherInvites_all"  on "schoolTeacherInvites"  for all using (teacher_id = get_my_user_id() or admin_id = get_my_user_id() or is_admin());
create policy "schoolNotices_select"      on "schoolNotices"         for select using (true);
create policy "schoolNotices_write"       on "schoolNotices"         for all    using (admin_id = get_my_user_id() or is_admin());
create policy "schoolNoticeSubmits_all"   on "schoolNoticeSubmits"   for all using (teacher_id = get_my_user_id() or admin_id = get_my_user_id() or is_admin());
create policy "schoolCalendar_select"     on "schoolCalendar"        for select using (true);
create policy "schoolCalendar_write"      on "schoolCalendar"        for all    using (admin_id = get_my_user_id() or is_admin());
create policy "schoolInfo_select"         on "schoolInfo"            for select using (true);
create policy "schoolInfo_write"          on "schoolInfo"            for all    using (is_admin());
create policy "hqVendors_deny"            on "hqVendors"             for all using (false);
create policy "hqVendorSubjects_deny"     on "hqVendorSubjects"      for all using (false);
create policy "hqVendorProducts_deny"     on "hqVendorProducts"      for all using (false);
create policy "vendorAccounts_deny"       on "vendorAccounts"        for all using (false);

-- ============================================================
-- 완료
-- 다음 단계: db.js 수정
-- ============================================================
