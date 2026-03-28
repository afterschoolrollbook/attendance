-- ============================================
-- 방과후 출석부 — Supabase 스키마
-- Supabase Dashboard → SQL Editor 에서 실행
-- ============================================

-- UUID 확장
create extension if not exists "uuid-ossp";

-- ─── users (회원)
create table if not exists users (
  id            text primary key,
  name          text not null,
  email         text unique not null,
  pw            text,                      -- 소셜 로그인은 null
  phone         text default '',
  role          text default 'teacher',    -- 'admin' | 'teacher'
  level         int  default 1,            -- 1~5
  verified      boolean default false,
  verify_img    text,                      -- base64
  permission_overrides jsonb default '{}',
  provider      text default 'email',      -- 'email' | 'google' | 'kakao'
  provider_id   text,
  avatar        text,
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
  days            jsonb default '[]',       -- ["월","수"]
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
  class_num       text default '',         -- 학급반 (2반, 3반)
  number          text default '',
  name            text not null,
  parent_phone    text default '',
  student_phone   text default '',
  class_ids       jsonb default '[]',      -- [classId, ...]
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
  status          text default 'pending',  -- present|absent|late|early|pending
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
  date        text not null,               -- "2026-03-27" 또는 "2026-03-27_classId"
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
  file_data     text,                      -- base64
  field_map     jsonb default '{}',
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ─── settings (서비스 설정)
create table if not exists settings (
  key    text primary key,
  value  jsonb not null,
  updated_at timestamptz default now()
);

-- ─── verify_codes (인증번호 임시 저장)
create table if not exists verify_codes (
  id         uuid primary key default uuid_generate_v4(),
  target     text not null,               -- 이메일 또는 전화번호
  code       text not null,
  purpose    text default 'signup',       -- 'signup' | 'profile'
  used       boolean default false,
  expires_at timestamptz default (now() + interval '10 minutes'),
  created_at timestamptz default now()
);

-- ─── RLS (Row Level Security) 활성화
alter table users                  enable row level security;
alter table classes                enable row level security;
alter table students               enable row level security;
alter table attendance             enable row level security;
alter table notes                  enable row level security;
alter table attendance_templates   enable row level security;

-- ─── RLS 정책: 서비스 역할(service_role)은 모두 허용
-- (Edge Functions는 service_role key를 사용하므로 별도 정책 불필요)
-- 클라이언트(anon key)는 아무것도 못 함 → 모든 요청은 Edge Function 경유

-- ─── 초기 관리자 데이터
insert into users (id, name, email, pw, role, level, verified, created_at)
values ('admin1', '관리자', 'admin@test.com', 'admin1234', 'admin', 5, true, now())
on conflict (id) do nothing;

insert into users (id, name, email, pw, phone, role, level, verified, created_at)
values ('teacher1', '김선생', 'teacher@test.com', '1234', '010-1234-5678', 'teacher', 2, true, now())
on conflict (id) do nothing;

-- ─── 광고 슬롯 초기 데이터
insert into ad_slots (id, name, position, active, w, h) values
  ('dashboard_top',  '대시보드 상단',  'dashboard_top',  false, '100%', 90),
  ('student_mid',    '학생관리 상단',  'student_mid',    false, '100%', 90),
  ('sidebar_bottom', '사이드바 하단',  'sidebar_bottom', false, '224',  120),
  ('report_bottom',  '리포트 하단',    'report_bottom',  false, '100%', 90)
on conflict (id) do nothing;

-- ─── 인덱스
create index if not exists idx_classes_teacher    on classes(teacher_id);
create index if not exists idx_students_teacher   on students(teacher_id);
create index if not exists idx_attendance_class   on attendance(class_id);
create index if not exists idx_attendance_date    on attendance(date);
create index if not exists idx_notes_teacher_date on notes(teacher_id, date);
create index if not exists idx_verify_target      on verify_codes(target, purpose);
