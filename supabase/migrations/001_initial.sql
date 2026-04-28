-- ============================================
-- 방과후 출석부 — Supabase 스키마 (완전판)
-- Supabase Dashboard → SQL Editor 에서 실행
-- ============================================

-- UUID 확장
create extension if not exists "uuid-ossp";

-- ─── users (회원)
create table if not exists users (
  id            text primary key,
  name          text not null,
  email         text unique not null,
  pw            text,
  phone         text default '',
  role          text default 'teacher',
  level         int  default 1,
  verified      boolean default false,
  verify_img    text,
  permission_overrides jsonb default '{}',
  provider      text default 'email',
  provider_id   text,
  avatar        text,
  branch_id     text,
  created_at    timestamptz default now()
);

-- ─── classes (수업)
create table if not exists classes (
  id              text primary key,
  teacher_id      text references users(id) on delete cascade,
  organization    text not null,
  class_name      text not null,
  section         text default '',
  term_type       text default 'semester',
  days            jsonb default '[]',
  repeat_type     text default 'every',
  time            text default '',
  start_date      text not null,
  end_date        text not null,
  cancelled_dates jsonb default '[]',
  description     text default '',
  promotion_imgs  jsonb default '[]',
  template_file   jsonb,
  created_at      timestamptz default now()
);

-- ─── students (학생)
create table if not exists students (
  id              text primary key,
  teacher_id      text references users(id) on delete cascade,
  school          text default '',
  grade           text default '',
  class_num       text default '',
  number          text default '',
  name            text not null,
  parent_phone    text default '',
  student_phone   text default '',
  class_ids       jsonb default '[]',
  status          text default 'applied',
  status_history  jsonb default '[]',
  memo            text default '',
  created_at      timestamptz default now()
);

-- ─── attendance (출석)
create table if not exists attendance (
  id              text primary key,
  class_id        text references classes(id) on delete cascade,
  student_id      text references students(id) on delete cascade,
  date            text not null,
  session         int  default 0,
  status          text default 'pending',
  absent_reason   text default '',
  home_return     text default '',
  note            text default '',
  marked_at       timestamptz default now(),
  unique(class_id, student_id, date)
);

-- ─── notes (메모)
create table if not exists notes (
  id          text primary key,
  teacher_id  text references users(id) on delete cascade,
  date        text not null,
  content     text not null,
  created_at  timestamptz default now()
);

-- ─── ad_slots (광고 슬롯)
create table if not exists ad_slots (
  id       text primary key,
  name     text not null,
  position text not null,
  active   boolean default false,
  code     text default '',
  w        text default '100%',
  h        int  default 90
);

-- ─── attendance_templates (출석부 양식)
create table if not exists attendance_templates (
  id            text primary key,
  teacher_id    text references users(id) on delete cascade,
  school        text not null,
  template_name text not null,
  file_type     text default 'xlsx',
  file_data     text,
  field_map     jsonb default '{}',
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ─── settings (서비스 설정)
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- ─── verify_codes (인증번호 임시 저장)
create table if not exists verify_codes (
  id         uuid primary key default uuid_generate_v4(),
  target     text not null,
  code       text not null,
  purpose    text default 'signup',
  used       boolean default false,
  expires_at timestamptz default (now() + interval '10 minutes'),
  created_at timestamptz default now()
);

-- ─── branches (지사)
create table if not exists branches (
  id         text primary key,
  name       text not null,
  active     boolean default true,
  created_at timestamptz default now()
);

-- ─── parent_members (학부모 회원)
create table if not exists parent_members (
  id          text primary key,
  phone       text not null,
  name        text default '',
  app_joined  boolean default false,
  memo        text default '',
  created_at  timestamptz default now()
);

-- ─── teacher_parent_links (선생님-학부모 연결)
create table if not exists teacher_parent_links (
  id               text primary key,
  teacher_id       text references users(id) on delete cascade,
  parent_member_id text references parent_members(id) on delete cascade,
  student_id       text,
  class_id         text,
  status           text default 'active',
  started_at       text,
  ended_at         text,
  end_reason       text,
  created_at       timestamptz default now()
);

-- ─── points (포인트)
create table if not exists points (
  id               text primary key,
  teacher_id       text references users(id) on delete cascade,
  type             text not null,
  amount           int  default 0,
  source           text default '',
  parent_member_id text,
  order_id         text,
  memo             text default '',
  expires_at       text,
  created_at       timestamptz default now()
);

-- ════════════════════════════════════════════
-- camelCase 테이블 (컬럼명도 camelCase)
-- Edge Function CAMEL_TABLES 목록과 동일
-- ════════════════════════════════════════════

-- ─── revenueFees (수업료 설정)
create table if not exists "revenueFees" (
  id          text primary key,
  "teacherId" text,
  "classId"   text,
  "feeType"   text default 'monthly',
  amount      int  default 0,
  "updatedAt" text,
  "createdAt" text
);

-- ─── revenuePayments (수납 내역)
create table if not exists "revenuePayments" (
  id          text primary key,
  "teacherId" text,
  "classId"   text,
  "termNo"    int,
  date        text,
  amount      int  default 0,
  memo        text default '',
  reason      text default '',
  "createdAt" text
);

-- ─── trainings (연수)
create table if not exists trainings (
  id              text primary key,
  "teacherId"     text,
  year            text,
  title           text not null,
  provider        text default '',
  "providerUrl"   text default '',
  "completionNum" text default '',
  "completedAt"   text default '',
  hours           int  default 0,
  memo            text default '',
  "fileUrl"       text,
  "fileName"      text,
  "fileType"      text,
  "createdAt"     text
);

-- ─── careers (경력)
create table if not exists careers (
  id                 text primary key,
  "teacherId"        text,
  "orgName"          text default '',
  "jobType"          text default '방과후 강사',
  "schoolType"       text default '초등',
  "customSchoolType" text default '',
  role               text default '',
  subject            text default '',
  "startDate"        text default '',
  "endDate"          text default '',
  "isCurrent"        boolean default false,
  "isOneDay"         boolean default false,
  description        text default '',
  "fileUrl"          text,
  "fileName"         text,
  "fileType"         text,
  "sortOrder"        int  default 0,
  "createdAt"        text
);

-- ─── educations (학력)
create table if not exists educations (
  id               text primary key,
  "teacherId"      text,
  "schoolName"     text default '',
  "eduType"        text default '대학교',
  major            text default '',
  "admissionDate"  text default '',
  "graduationDate" text default '',
  status           text default '졸업',
  memo             text default '',
  "fileUrl"        text,
  "fileName"       text,
  "fileType"       text,
  "createdAt"      text
);

-- ─── certificates (자격증)
create table if not exists certificates (
  id               text primary key,
  "teacherId"      text,
  name             text not null,
  issuer           text default '',
  "certType"       text default '국가자격증',
  grade            text default '',
  "certNumber"     text default '',
  "privateRegNum"  text default '',
  "issuedAt"       text default '',
  "expiresAt"      text default '',
  "noExpiry"       boolean default false,
  memo             text default '',
  "fileUrl"        text,
  "fileName"       text,
  "fileType"       text,
  "sortOrder"      int  default 0,
  "createdAt"      text
);

-- ─── jobSubs (채용공고 구독)
create table if not exists "jobSubs" (
  id             text primary key,
  "teacherId"    text,
  sido           text default '',
  office         text default '',
  school         text default '',
  subject        text default '',
  "notifySms"    boolean default false,
  "notifyKakao"  boolean default false,
  "notifyEmail"  boolean default true,
  "createdAt"    text
);

-- ════════════════════════════════════════════
-- 교구 관련 테이블 (camelCase)
-- ════════════════════════════════════════════

-- ─── supplySubjects (교구 과목)
create table if not exists "supplySubjects" (
  id          text primary key,
  "teacherId" text,
  name        text not null,
  "sortOrder" int  default 0,
  "createdAt" text
);

-- ─── supplyVendors (교구 업체)
create table if not exists "supplyVendors" (
  id            text primary key,
  "teacherId"   text,
  subject       text default '',
  name          text not null,
  "managerName" text default '',
  contact       text default '',
  memo          text default '',
  "createdAt"   text
);

-- ─── supplyItems (학생별 교구 배정)
create table if not exists "supplyItems" (
  id          text primary key,
  "teacherId" text,
  "classId"   text,
  "studentId" text,
  subject     text default '',
  name        text default '',
  "productId" text,
  stage       text default '',
  "updatedAt" text,
  "createdAt" text
);

-- ─── supplyPlans (교구 자료/지도안)
create table if not exists "supplyPlans" (
  id          text primary key,
  "teacherId" text,
  subject     text default '',
  type        text default '',
  "fileType"  text default '',
  title       text default '',
  school      text,
  "vendorId"  text,
  "productId" text,
  stage       text,
  "fileUrl"   text,
  "fileName"  text,
  "createdAt" text
);

-- ─── supplyPromos (홍보물)
create table if not exists "supplyPromos" (
  id          text primary key,
  "teacherId" text,
  subject     text default '',
  type        text default '',
  "fileType"  text default '',
  title       text default '',
  school      text,
  "vendorId"  text,
  "productId" text,
  stage       text,
  "fileUrl"   text,
  "fileName"  text,
  "createdAt" text
);

-- ─── supplyProducts (로봇 교구)
create table if not exists "supplyProducts" (
  id                  text primary key,
  "teacherId"         text,
  "vendorId"          text,
  subject             text default '',
  name                text not null,
  "maxStage"          int  default 10,
  "sessionsPerStage"  int  default 12,
  "alertSession"      int  default 10,
  "createdAt"         text
);

-- ─── supplyProductPlans (차시별 지도안)
create table if not exists "supplyProductPlans" (
  id          text primary key,
  "teacherId" text,
  "productId" text,
  stage       int  default 1,
  "sessionNo" int  default 1,
  title       text default '',
  memo        text default '',
  "createdAt" text
);

-- ─── supplyStudentProgress (학생 진도)
create table if not exists "supplyStudentProgress" (
  id           text primary key,
  "teacherId"  text,
  "studentId"  text,
  "classId"    text,
  "productId"  text,
  "curStage"   int  default 1,
  "curSession" int  default 1,
  "updatedAt"  text,
  "createdAt"  text
);

-- ─── supplyProgressLogs (진도 로그)
create table if not exists "supplyProgressLogs" (
  id          text primary key,
  "teacherId" text,
  "studentId" text,
  "classId"   text,
  "productId" text,
  "createdAt" text
);

-- ─── supplySessionChecks (차시 체크)
create table if not exists "supplySessionChecks" (
  id          text primary key,
  "teacherId" text,
  "studentId" text,
  "classId"   text,
  "productId" text,
  stage       int  default 1,
  "sessionNo" int  default 1,
  "checkedAt" text,
  "createdAt" text
);

-- ════════════════════════════════════════════
-- RLS (Row Level Security) 활성화
-- ════════════════════════════════════════════
alter table users                    enable row level security;
alter table classes                  enable row level security;
alter table students                 enable row level security;
alter table attendance               enable row level security;
alter table notes                    enable row level security;
alter table attendance_templates     enable row level security;
alter table branches                 enable row level security;
alter table parent_members           enable row level security;
alter table teacher_parent_links     enable row level security;
alter table points                   enable row level security;
alter table "revenueFees"            enable row level security;
alter table "revenuePayments"        enable row level security;
alter table trainings                enable row level security;
alter table careers                  enable row level security;
alter table educations               enable row level security;
alter table certificates             enable row level security;
alter table "jobSubs"                enable row level security;
alter table "supplySubjects"         enable row level security;
alter table "supplyVendors"          enable row level security;
alter table "supplyItems"            enable row level security;
alter table "supplyPlans"            enable row level security;
alter table "supplyPromos"           enable row level security;
alter table "supplyProducts"         enable row level security;
alter table "supplyProductPlans"     enable row level security;
alter table "supplyStudentProgress"  enable row level security;
alter table "supplyProgressLogs"     enable row level security;
alter table "supplySessionChecks"    enable row level security;

-- ════════════════════════════════════════════
-- 초기 데이터
-- ════════════════════════════════════════════
-- ⚠️ 초기 테스트 계정 제거 (평문 비밀번호 보안 이슈)
-- 배포 후 앱에서 직접 회원가입 → Supabase Dashboard에서 role=admin, level=5 로 수동 변경하세요.

insert into ad_slots (id, name, position, active, w, h) values
  ('dashboard_top',  '대시보드 상단',  'dashboard_top',  false, '100%', 90),
  ('student_mid',    '학생관리 상단',  'student_mid',    false, '100%', 90),
  ('sidebar_bottom', '사이드바 하단',  'sidebar_bottom', false, '224',  120),
  ('report_bottom',  '리포트 하단',    'report_bottom',  false, '100%', 90)
on conflict (id) do nothing;

-- ════════════════════════════════════════════
-- 인덱스
-- ════════════════════════════════════════════
create index if not exists idx_classes_teacher     on classes(teacher_id);
create index if not exists idx_students_teacher    on students(teacher_id);
create index if not exists idx_attendance_class    on attendance(class_id);
create index if not exists idx_attendance_date     on attendance(date);
create index if not exists idx_notes_teacher_date  on notes(teacher_id, date);
create index if not exists idx_verify_target       on verify_codes(target, purpose);
create index if not exists idx_tpl_links_teacher   on teacher_parent_links(teacher_id);
create index if not exists idx_points_teacher      on points(teacher_id);

-- ─── awards (수상)
create table if not exists awards (
  id              text primary key,
  "teacherId"     text,
  year            text,
  "contestName"   text default '',
  title           text not null,
  "awardType"     text default '표창',
  division        text default '',
  host            text default '',
  "awardedAt"     text default '',
  memo            text default '',
  "fileUrl"       text,
  "fileName"      text,
  "fileType"      text,
  "updatedAt"     text,
  "createdAt"     text
);
alter table awards enable row level security;

-- ─── 누락 컬럼 보완 (updatedAt 전체, supplyProductPlans 파일 컬럼)
alter table "supplyProductPlans"    add column if not exists "fileName"  text;
alter table "supplyProductPlans"    add column if not exists "fileUrl"   text;
alter table "supplyProductPlans"    add column if not exists "fileType"  text;
alter table "supplyProductPlans"    add column if not exists "updatedAt" text;
alter table "supplySubjects"        add column if not exists "updatedAt" text;
alter table "supplyVendors"         add column if not exists "updatedAt" text;
alter table "supplyItems"           add column if not exists "updatedAt" text;
alter table "supplyPlans"           add column if not exists "updatedAt" text;
alter table "supplyPromos"          add column if not exists "updatedAt" text;
alter table "supplyProducts"        add column if not exists "updatedAt" text;
alter table "supplyProgressLogs"    add column if not exists "updatedAt" text;
alter table "supplySessionChecks"   add column if not exists "updatedAt" text;
alter table "supplyStudentProgress" add column if not exists "updatedAt" text;
alter table "revenueFees"           add column if not exists "updatedAt" text;
alter table "revenuePayments"       add column if not exists "updatedAt" text;
alter table trainings               add column if not exists "updatedAt" text;
alter table careers                 add column if not exists "updatedAt" text;
alter table educations              add column if not exists "updatedAt" text;
alter table certificates            add column if not exists "updatedAt" text;
alter table "jobSubs"               add column if not exists "updatedAt" text;

-- ════════════════════════════════════════════
-- Supabase Auth 연동
-- ════════════════════════════════════════════

-- users 테이블에 auth_id 컬럼 추가 (Supabase Auth UUID 연동)
alter table users add column if not exists auth_id uuid references auth.users(id) on delete cascade;
create unique index if not exists idx_users_auth_id on users(auth_id);

-- ════════════════════════════════════════════
-- RLS 정책
-- ════════════════════════════════════════════

-- ── 헬퍼 함수: auth_id로 users.id 조회
create or replace function get_my_user_id()
returns text language sql security definer stable as $$
  select id from users where auth_id = auth.uid() limit 1;
$$;

-- ── 헬퍼 함수: 현재 유저가 admin(level=5)인지 확인
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from users where auth_id = auth.uid() and level = 5
  );
$$;

-- ── users
create policy "users_select" on users for select using (auth_id = auth.uid() or is_admin());
create policy "users_insert" on users for insert with check (auth_id = auth.uid());
create policy "users_update" on users for update using (auth_id = auth.uid() or is_admin());

-- ── classes (teacher_id = 본인)
create policy "classes_all" on classes for all using (teacher_id = get_my_user_id() or is_admin());

-- ── students (teacher_id = 본인)
create policy "students_all" on students for all using (teacher_id = get_my_user_id() or is_admin());

-- ── attendance (class_id → classes.teacher_id = 본인)
create policy "attendance_all" on attendance for all using (
  exists (select 1 from classes where classes.id = attendance.class_id and classes.teacher_id = get_my_user_id())
  or is_admin()
);

-- ── notes (teacher_id = 본인)
create policy "notes_all" on notes for all using (teacher_id = get_my_user_id() or is_admin());

-- ── attendance_templates (공개 읽기, 본인 쓰기)
create policy "templates_select" on attendance_templates for select using (true);
create policy "templates_write"  on attendance_templates for all using (teacher_id = get_my_user_id() or is_admin());

-- ── branches (admin 전용)
create policy "branches_all" on branches for all using (is_admin());

-- ── parent_members (teacher_id = 본인)
create policy "parent_members_all" on parent_members for all using (teacher_id = get_my_user_id() or is_admin());

-- ── teacher_parent_links (teacher_id = 본인)
create policy "teacher_parent_links_all" on teacher_parent_links for all using (teacher_id = get_my_user_id() or is_admin());

-- ── points (teacher_id = 본인)
create policy "points_all" on points for all using (teacher_id = get_my_user_id() or is_admin());

-- ── revenueFees (teacherId = 본인)
create policy "revenueFees_all" on "revenueFees" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── revenuePayments (teacherId = 본인)
create policy "revenuePayments_all" on "revenuePayments" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── trainings (teacherId = 본인)
create policy "trainings_all" on trainings for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── careers (teacherId = 본인)
create policy "careers_all" on careers for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── educations (teacherId = 본인)
create policy "educations_all" on educations for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── certificates (teacherId = 본인)
create policy "certificates_all" on certificates for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── awards (teacherId = 본인)
create policy "awards_all" on awards for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── jobSubs (teacherId = 본인)
create policy "jobSubs_all" on "jobSubs" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplySubjects (teacherId = 본인)
create policy "supplySubjects_all" on "supplySubjects" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyVendors (teacherId = 본인)
create policy "supplyVendors_all" on "supplyVendors" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyItems (teacherId = 본인)
create policy "supplyItems_all" on "supplyItems" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyPlans (teacherId = 본인)
create policy "supplyPlans_all" on "supplyPlans" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyPromos (teacherId = 본인)
create policy "supplyPromos_all" on "supplyPromos" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyProducts (teacherId = 본인)
create policy "supplyProducts_all" on "supplyProducts" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyProductPlans (teacherId = 본인)
create policy "supplyProductPlans_all" on "supplyProductPlans" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyStudentProgress (teacherId = 본인)
create policy "supplyStudentProgress_all" on "supplyStudentProgress" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplyProgressLogs (teacherId = 본인)
create policy "supplyProgressLogs_all" on "supplyProgressLogs" for all using ("teacherId" = get_my_user_id() or is_admin());

-- ── supplySessionChecks (teacherId = 본인)
create policy "supplySessionChecks_all" on "supplySessionChecks" for all using ("teacherId" = get_my_user_id() or is_admin());
