-- ============================================================
-- 004_parent_app_rpc.sql  (2026-06-12 보안 수정)
--
-- 변경 내역:
--   get_parent_dashboard — PIN 검증을 RPC 내부에서 강제
--     · p_pin 파라미터 추가 (DEFAULT NULL, 하위 호환)
--     · pin_hash 설정된 회원: p_pin 일치해야만 데이터 반환
--     · pin_hash 미설정 회원: p_pin=NULL 허용 (초대 직후 PIN 등록 전)
--     · 불일치·미제공 시 빈 데이터 반환 (오류 메시지 없음 — timing attack 방지)
--
-- 배경:
--   2026-06-12 RLS 강화(students/classes/attendance/users 등을
--   "teacher_id = 본인" 또는 관리자만 조회 가능하도록 제한) 이후,
--   로그인 세션이 없는 "학부모"는 해당 테이블을 전혀 읽을 수 없게 됨.
--   그 결과 /parent-login (재로그인)과 /parent-invite (최초 가입)
--   화면이 데이터를 불러오지 못하거나 가입 자체가 실패함.
--
-- 해결:
--   parent_members.phone(전화번호) 기준으로만 동작하는
--   security definer 함수를 만들어 RLS를 우회하되,
--   함수 내부에서 "그 전화번호 본인 데이터만" 반환/수정하도록 제한.
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 전체 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) parent_login_lookup
--    /parent-login 1단계: 전화번호로 가입 여부 + PIN 설정 여부 확인
-- ────────────────────────────────────────────────────────────
create or replace function parent_login_lookup(p_phone text)
returns table(member_id text, has_pin boolean)
language plpgsql security definer as $$
begin
  return query
    select pm.id, (pm.pin_hash is not null)
      from parent_members pm
     where regexp_replace(pm.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
       and pm.app_joined = true
       and pm.withdrawn_at is null
     limit 1;
end; $$;


-- ────────────────────────────────────────────────────────────
-- 2) get_parent_dashboard  ★ 보안 수정 (2026-06-12)
--    /parent-login 2단계 통과 후(또는 가입 직후) 대시보드 데이터 일괄 조회
--    반환: { students:[...], classes:[...], teachers:[...], attendance:[...] }
--    (컬럼은 DB 그대로 snake_case — 프론트에서 toCamel 적용)
--
--    PIN 검증 로직:
--      p_pin 있음  → pgcrypto crypt() 로 pin_hash 와 비교, 일치할 때만 통과
--      p_pin NULL  → pin_hash 미설정 회원(초대 직후 PIN 등록 전)만 통과
--                    pin_hash 가 이미 설정된 회원이 p_pin=NULL 로 호출하면 빈 데이터 반환
--      불일치      → 빈 데이터 반환 (오류 없음 — timing attack 방지)
-- ────────────────────────────────────────────────────────────
create or replace function get_parent_dashboard(p_phone text, p_pin text default null)
returns jsonb
language plpgsql security definer as $$
declare
  v_phone       text := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_member      parent_members%rowtype;
  v_students    jsonb;
  v_student_ids text[];
  v_class_ids   text[];
  v_classes     jsonb;
  v_teacher_ids text[];
  v_teachers    jsonb;
  v_attendance  jsonb;
  v_empty       jsonb := jsonb_build_object(
                   'students',   '[]'::jsonb,
                   'classes',    '[]'::jsonb,
                   'teachers',   '[]'::jsonb,
                   'attendance', '[]'::jsonb);
begin
  -- 1) 회원 조회
  select * into v_member
    from parent_members pm
   where regexp_replace(pm.phone, '[^0-9]', '', 'g') = v_phone
     and pm.app_joined = true and pm.withdrawn_at is null
   limit 1;

  if not found then
    return v_empty;
  end if;

  -- 2) PIN 검증
  --    pin_hash 설정된 회원: p_pin 이 반드시 있어야 하고 일치해야 함
  --    pin_hash 미설정 회원: p_pin=NULL 허용 (초대 직후 PIN 등록 전 상태)
  if v_member.pin_hash is not null then
    if p_pin is null or v_member.pin_hash <> crypt(p_pin, v_member.pin_hash) then
      return v_empty;
    end if;
  end if;

  -- 3) 이 전화번호로 등록된 학생들 (화면에 필요한 컬럼만 반환)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'grade', s.grade,
           'class_num', s.class_num, 'class_ids', s.class_ids
         )), '[]'::jsonb),
         coalesce(array_agg(s.id), '{}')
    into v_students, v_student_ids
    from students s
   where regexp_replace(coalesce(s.parent_phone, ''), '[^0-9]', '', 'g') = v_phone
     and coalesce(s._deleted, false) = false;

  -- 4) 그 학생들이 속한 수업 id 목록
  select coalesce(array_agg(distinct e), '{}')
    into v_class_ids
    from students s, jsonb_array_elements_text(coalesce(s.class_ids, '[]'::jsonb)) e
   where regexp_replace(coalesce(s.parent_phone, ''), '[^0-9]', '', 'g') = v_phone
     and coalesce(s._deleted, false) = false;

  -- 5) 수업 정보 (화면에 필요한 컬럼만 반환)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'class_name', c.class_name, 'section', c.section, 'sections', c.sections,
           'days', c.days, 'time', c.time, 'time_end', c.time_end,
           'organization', c.organization, 'class_location', c.class_location, 'description', c.description,
           'start_date', c.start_date, 'end_date', c.end_date, 'cancelled_dates', c.cancelled_dates,
           'teacher_id', c.teacher_id
         )), '[]'::jsonb)
    into v_classes
    from classes c
   where c.id = any(v_class_ids);

  -- 6) 담당 선생님 최소 정보
  select coalesce(array_agg(distinct teacher_id), '{}')
    into v_teacher_ids
    from classes
   where id = any(v_class_ids) and teacher_id is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'name', u.name, 'nickname', u.nickname, 'phone', u.phone
         )), '[]'::jsonb)
    into v_teachers
    from users u
   where u.id = any(v_teacher_ids);

  -- 7) 출석 기록 (필요한 컬럼만 반환)
  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', a.student_id, 'class_id', a.class_id, 'status', a.status,
           'date', a.date, 'marked_at', a.marked_at,
           'absent_reason', a.absent_reason, 'home_return', a.home_return, 'note', a.note
         ) order by coalesce(a.marked_at, a.date) desc), '[]'::jsonb)
    into v_attendance
    from attendance a
   where a.student_id = any(v_student_ids)
     and a.status is not null and a.status <> 'pending';

  return jsonb_build_object(
    'students',   v_students,
    'classes',    v_classes,
    'teachers',   v_teachers,
    'attendance', v_attendance
  );
end; $$;


-- ────────────────────────────────────────────────────────────
-- 3) get_invite_info
--    /parent-invite 최초 진입 시: 선생님 정보 + 전화번호로 매칭되는 학생 목록
-- ────────────────────────────────────────────────────────────
create or replace function get_invite_info(p_teacher_id text, p_phone text)
returns jsonb
language plpgsql security definer as $$
declare
  v_phone   text := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_teacher jsonb;
  v_students jsonb;
begin
  select jsonb_build_object('id', u.id, 'name', u.name, 'nickname', u.nickname, 'phone', u.phone)
    into v_teacher
    from users u where u.id = p_teacher_id;
  if v_teacher is null then
    return jsonb_build_object('error', 'teacher_not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'grade', s.grade,
           'class_num', s.class_num, 'class_ids', s.class_ids
         )), '[]'::jsonb) into v_students
    from students s
   where s.teacher_id = p_teacher_id
     and regexp_replace(coalesce(s.parent_phone, ''), '[^0-9]', '', 'g') = v_phone
     and coalesce(s._deleted, false) = false;

  return jsonb_build_object('teacher', v_teacher, 'students', v_students);
end; $$;


-- ────────────────────────────────────────────────────────────
-- 4) parent_join
--    /parent-invite 약관동의 → 가입 처리 (parent_members upsert +
--    students.parent_joined=true + teacher_parent_links 생성)
--    p_member: { marketingAgree, studentName, grade, schoolName,
--                 subjectName, teacherName, teacherPhone } 형태의 jsonb
--    (camelCase 키 그대로 받아서 내부에서 snake_case 컬럼에 매핑)
-- ────────────────────────────────────────────────────────────
create or replace function parent_join(p_phone text, p_teacher_id text, p_member jsonb)
returns jsonb
language plpgsql security definer as $$
declare
  v_phone text := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_member_id text;
  v_result jsonb;
  v_student record;
  v_school_name text;
  v_subject_name text;
begin
  -- 매칭되는 첫 학생의 첫 수업에서 학교명/과목명 조회 (클라이언트가 보내지 않아도 채워짐)
  select c.organization, c.class_name
    into v_school_name, v_subject_name
    from students s
    join classes c on c.id = (s.class_ids->>0)
   where s.teacher_id = p_teacher_id
     and regexp_replace(coalesce(s.parent_phone, ''), '[^0-9]', '', 'g') = v_phone
     and coalesce(s._deleted, false) = false
   order by s.created_at
   limit 1;

  select id into v_member_id
    from parent_members
   where regexp_replace(phone, '[^0-9]', '', 'g') = v_phone
     and teacher_id = p_teacher_id
   limit 1;

  if v_member_id is null then
    v_member_id := 'pm_' || replace(gen_random_uuid()::text, '-', '');
    insert into parent_members (
      id, phone, name, memo, app_joined, teacher_id,
      marketing_agree, invited_by_teacher,
      student_name, grade, school_name, subject_name, teacher_name, teacher_phone,
      joined_at, created_at, updated_at
    ) values (
      v_member_id, v_phone, '', '', true, p_teacher_id,
      coalesce((p_member->>'marketingAgree')::boolean, false), p_teacher_id,
      coalesce(p_member->>'studentName',''), coalesce(p_member->>'grade',''),
      coalesce(nullif(p_member->>'schoolName',''), v_school_name, ''),
      coalesce(nullif(p_member->>'subjectName',''), v_subject_name, ''),
      coalesce(p_member->>'teacherName',''), coalesce(p_member->>'teacherPhone',''),
      now(), now(), now()
    );
  else
    update parent_members set
      app_joined = true,
      withdrawn_at = null,
      withdraw_reason = null,
      marketing_agree = coalesce((p_member->>'marketingAgree')::boolean, marketing_agree),
      student_name = coalesce(nullif(p_member->>'studentName',''), student_name),
      grade        = coalesce(nullif(p_member->>'grade',''), grade),
      school_name  = coalesce(nullif(p_member->>'schoolName',''), v_school_name, school_name),
      subject_name = coalesce(nullif(p_member->>'subjectName',''), v_subject_name, subject_name),
      teacher_name = coalesce(nullif(p_member->>'teacherName',''), teacher_name),
      teacher_phone= coalesce(nullif(p_member->>'teacherPhone',''), teacher_phone),
      joined_at = coalesce(joined_at, now()),
      updated_at = now()
    where id = v_member_id;
  end if;

  -- 매칭되는 학생들: parent_joined 표시 + 선생님-학부모 연결 생성
  for v_student in
    select s.id, s.class_ids
      from students s
     where s.teacher_id = p_teacher_id
       and regexp_replace(coalesce(s.parent_phone, ''), '[^0-9]', '', 'g') = v_phone
       and coalesce(s._deleted, false) = false
  loop
    update students
       set parent_joined = true,
           parent_invite_sent_at = coalesce(parent_invite_sent_at, now()),
           updated_at = now()
     where id = v_student.id;

    if not exists (
      select 1 from teacher_parent_links
       where teacher_id = p_teacher_id
         and parent_member_id = v_member_id
         and student_id = v_student.id
         and status = 'active'
    ) then
      insert into teacher_parent_links (
        id, teacher_id, parent_member_id, student_id, class_id,
        status, started_at, ended_at, end_reason, created_at, updated_at
      ) values (
        'tpl_' || replace(gen_random_uuid()::text, '-', ''),
        p_teacher_id, v_member_id, v_student.id,
        coalesce(v_student.class_ids->>0, ''),
        'active', now(), null, null, now(), now()
      );
    end if;
  end loop;

  select to_jsonb(pm) into v_result from parent_members pm where pm.id = v_member_id;
  return v_result;
end; $$;


-- ────────────────────────────────────────────────────────────
-- 5) parent_save_push_subscription
--    학부모 PWA 푸시 구독 정보 저장
-- ────────────────────────────────────────────────────────────
create or replace function parent_save_push_subscription(p_phone text, p_teacher_id text, p_subscription jsonb)
returns boolean
language plpgsql security definer as $$
declare v_count int;
begin
  update parent_members
     set push_subscription = p_subscription, updated_at = now()
   where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
     and teacher_id = p_teacher_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;
