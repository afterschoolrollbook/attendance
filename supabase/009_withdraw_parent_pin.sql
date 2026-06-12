-- 009_withdraw_parent_pin.sql
-- withdraw_parent RPC에 PIN 검증 추가 (2026-06-12)
--
-- 문제: 전화번호만 알면 anon이 RPC를 직접 호출해 강제 탈퇴시킬 수 있었음
--
-- 수정: p_pin 파라미터 추가, pin_hash 설정된 회원은 PIN 일치 시에만 탈퇴 처리
--       pin_hash가 NULL(초대 직후 미설정)이면 PIN 없이 허용 — 기존 동작 유지
--
-- verify_parent_pin과 동일한 패턴 사용 (pgcrypto crypt)

create or replace function withdraw_parent(p_phone text, p_pin text default null)
returns boolean language plpgsql security definer as $$
declare
  v_member_id  text;
  v_pin_hash   text;
  v_count      int;
begin
  -- pin_hash 조회
  select pin_hash into v_pin_hash
    from parent_members
   where regexp_replace(phone, '[^0-9]', '', 'g') = p_phone
     and app_joined = true and withdrawn_at is null
   limit 1;

  -- pin_hash 설정된 회원: PIN 검증
  if v_pin_hash is not null then
    if p_pin is null or v_pin_hash != crypt(p_pin, v_pin_hash) then
      return false;  -- PIN 불일치 or 미전달 → 탈퇴 거부 (오류 메시지 없음, timing attack 방지)
    end if;
  end if;

  -- 탈퇴 처리
  update parent_members
     set app_joined = false, withdrawn_at = now(),
         withdraw_reason = 'parent_request', updated_at = now()
   where regexp_replace(phone, '[^0-9]', '', 'g') = p_phone
     and app_joined = true and withdrawn_at is null
  returning id into v_member_id;

  get diagnostics v_count = row_count;

  if v_member_id is not null then
    update teacher_parent_links
       set status = 'ended', ended_at = now(),
           end_reason = 'parent_withdraw', updated_at = now()
     where parent_member_id = v_member_id and status = 'active';
  end if;

  return v_count > 0;
end; $$;
