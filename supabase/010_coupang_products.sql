-- 방과후 출석부: 쿠팡상품(카테고리 탭 + 상품 카탈로그) — trader(EasyTrade) 프로젝트 기능 이식
-- coupang_links / coupang_widgets(광고 자동노출용 배너)와는 별개로,
-- 블로그 글 등에 수동으로 붙여넣어 쓸 쿠팡 상품을 카테고리(탭)별로 등록해두는 목록입니다.
-- Supabase SQL Editor에서 그대로 실행하세요.
--
-- 참고: 기존 coupang_links / coupang_widgets 테이블은 이 프로젝트에서 RLS를 켜지 않은 채로
-- (anon 키로 직접 읽고 쓰는) 운영 중이라, 동일한 방식으로 맞춰서 RLS를 켜지 않았습니다.

create table if not exists coupang_product_categories (
  id text primary key,
  label text not null,
  concept text default '',
  created_at timestamptz not null default now()
);

create table if not exists coupang_products (
  id text primary key,
  label text default '',
  url text default '',
  banner_html text default '',
  banner_html_blog text default '',
  category_id text references coupang_product_categories(id) on delete set null,
  enabled boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 실행 후 아래 SELECT로 두 테이블이 정상 생성됐는지 확인하세요.
-- select * from coupang_product_categories;
-- select * from coupang_products;
