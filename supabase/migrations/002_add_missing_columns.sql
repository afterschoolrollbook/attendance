-- ============================================================
-- 002_add_missing_columns.sql
-- students, classes 테이블 누락 컬럼 추가
-- Supabase SQL Editor에서 실행 (IF NOT EXISTS → 중복 실행 안전)
-- ============================================================

-- ─── students 누락 컬럼 ──────────────────────────────────────
alter table students add column if not exists apply_order text        default '';
alter table students add column if not exists remark      text        default '';
alter table students add column if not exists updated_at  timestamptz default now();

-- ─── classes 누락 컬럼 ───────────────────────────────────────
alter table classes  add column if not exists time_end       text        default '';
alter table classes  add column if not exists term_count     integer     default 4;
alter table classes  add column if not exists term_sizes     jsonb       default '[4,4,4,4]';
alter table classes  add column if not exists total_sessions integer     default null;
alter table classes  add column if not exists makeup_dates   jsonb       default '[]';
alter table classes  add column if not exists updated_at     timestamptz default now();

-- ─── updated_at 자동 갱신 트리거 ─────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at
  before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_classes_updated_at on classes;
create trigger trg_classes_updated_at
  before update on classes
  for each row execute function set_updated_at();

-- ─── supplyGiven (교구 지급 기록) ────────────────────────────
create table if not exists "supplyGiven" (
  id            text primary key,
  teacher_id    text references users(id) on delete cascade,
  student_id    text,
  student_name  text default '',
  class_id      text,
  class_name    text default '',
  school_name   text default '',
  product_id    text default '',
  product_name  text default '',
  item_name     text default '',
  given_at      text default '',
  _deleted      boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
