-- 013: 블로그 이미지 업로드용 공개 스토리지 버킷 + RLS 정책
-- Supabase 대시보드 SQL Editor에서 직접 실행하세요.

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

-- 누구나 읽기 가능(블로그 방문자가 이미지를 봐야 하므로)
create policy "blog-images public read"
on storage.objects for select
using (bucket_id = 'blog-images');

-- 로그인한 사용자만 업로드 가능
create policy "blog-images authenticated upload"
on storage.objects for insert
with check (bucket_id = 'blog-images' and auth.role() = 'authenticated');

-- 로그인한 사용자만 덮어쓰기(upsert) 가능
create policy "blog-images authenticated update"
on storage.objects for update
using (bucket_id = 'blog-images' and auth.role() = 'authenticated');
