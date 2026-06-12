-- 006_settings_secret_lockdown.sql
-- 목적: settings 테이블의 시크릿(이메일/문자 API 키, 네이버 클라이언트 시크릿,
--       NEIS API 키)이 일반 로그인 사용자(level < 10)에게 노출되는 문제 수정
--
-- 변경 사항
-- 1) social.naverClientSecret  → 새 행 social_secret      = { naverClientSecret }
-- 2) regionMap.neisApiKey      → 새 행 regionMap_secret    = { neisApiKey }
-- 3) settings_select 정책을 "관리자(is_admin) 또는 비민감 key" 만 허용하도록 변경
--    (email, solapi, social_secret, regionMap_secret 는 관리자만 select 가능)

-- ── 1) 네이버 클라이언트 시크릿 분리
insert into settings (key, value, updated_at)
select 'social_secret',
       jsonb_build_object('naverClientSecret', value->'naverClientSecret'),
       now()
from settings
where key = 'social'
  and value ? 'naverClientSecret'
  and (value->>'naverClientSecret') is not null
  and (value->>'naverClientSecret') <> ''
on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;

update settings
set value = (value - 'naverClientSecret'),
    updated_at = now()
where key = 'social'
  and value ? 'naverClientSecret';

-- ── 2) NEIS API 키 분리
insert into settings (key, value, updated_at)
select 'regionMap_secret',
       jsonb_build_object('neisApiKey', value->'neisApiKey'),
       now()
from settings
where key = 'regionMap'
  and value ? 'neisApiKey'
  and (value->>'neisApiKey') is not null
  and (value->>'neisApiKey') <> ''
on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;

update settings
set value = (value - 'neisApiKey'),
    updated_at = now()
where key = 'regionMap'
  and value ? 'neisApiKey';

-- ── 3) settings_select 정책 강화
drop policy if exists "settings_select" on settings;
create policy "settings_select" on settings for select using (
  is_admin()
  or key not in ('email', 'solapi', 'social_secret', 'regionMap_secret')
);
