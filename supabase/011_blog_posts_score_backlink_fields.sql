-- 방과후 출석부: blog_posts에 프레시시즌 최신 파이프라인과 동일한 컬럼 추가
-- (제목/SEO 점수 디테일 + 네이버 요약 + 인스타 카드뉴스 — 전부 관리자 전용, 방문자에게 노출 안 됨)
-- Supabase SQL Editor에서 그대로 실행하세요.

alter table blog_posts add column if not exists title_score integer;
alter table blog_posts add column if not exists seo_score integer;
alter table blog_posts add column if not exists title_score_detail jsonb;
alter table blog_posts add column if not exists seo_score_detail jsonb;
alter table blog_posts add column if not exists naver_summary text;
alter table blog_posts add column if not exists instagram_cards text;

-- 확인
-- select column_name, data_type from information_schema.columns where table_name = 'blog_posts' order by ordinal_position;
