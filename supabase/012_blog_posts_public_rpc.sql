-- 방과후 출석부 blog_posts: SEO/백링크 필드(title_score, seo_score, title_score_detail,
-- seo_score_detail, naver_summary, instagram_cards)가 비로그인 방문자에게도 그대로
-- 노출되던 문제 수정.
--
-- 원인: blog_posts의 SELECT RLS 정책(blog_posts_select)이 role public에 qual=true라
-- 로그인 여부와 무관하게 모든 컬럼을 완전히 열어둠. 프론트에서 UI만 숨겼을 뿐 실제
-- Supabase REST 응답(네트워크 탭)에는 관리자 전용 필드가 그대로 실려 있었음.
--
-- 조치: RLS 자체를 컬럼 단위로 제한할 수는 없으므로(Postgres RLS는 행 단위), 이 6개
-- 필드만 is_admin()이 아니면 null로 지워서 반환하는 SECURITY DEFINER 함수를 새로 만들고,
-- 공개 블로그 읽기 화면(Blog.jsx)은 blog_posts 테이블을 직접 select하는 대신 이 함수만
-- 쓰도록 교체했다(코드 변경분은 src/pages/Blog.jsx 참고). 관리자 화면(BlogAdmin/BlogWrite)은
-- 기존처럼 테이블을 직접 사용 — 로그인 세션의 is_admin() 여부와 무관하게 원본 데이터가
-- 필요하기 때문.

create or replace function public.get_blog_posts_public()
returns setof blog_posts
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r blog_posts%rowtype;
begin
  for r in select * from blog_posts loop
    if not is_admin() then
      r.title_score := null;
      r.seo_score := null;
      r.title_score_detail := null;
      r.seo_score_detail := null;
      r.naver_summary := null;
      r.instagram_cards := null;
    end if;
    return next r;
  end loop;
  return;
end;
$$;

grant execute on function public.get_blog_posts_public() to anon, authenticated;
