-- =============================================================================
-- 업체(Vendor) 관련 RPC 함수 모음
-- hq_vendors / hq_vendor_* / vendor_accounts 테이블은
-- RLS가 for all using (false) 로 anon 직접 접근이 전면 차단되어 있습니다.
-- 아래 함수들은 모두 SECURITY DEFINER 로 선언되어 RLS 를 우회합니다.
-- Supabase SQL Editor 에 한 번 실행하면 됩니다.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 업체(hq_vendors) 단건 조회
-- ─────────────────────────────────────────────────────────────────────────────

-- 1-a. id 로 조회
CREATE OR REPLACE FUNCTION get_vendor_by_id(p_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v json;
BEGIN
  SELECT row_to_json(r) INTO v
  FROM (SELECT * FROM hq_vendors WHERE id = p_id LIMIT 1) r;
  RETURN v;
END;
$$;

-- 1-b. email 로 조회
CREATE OR REPLACE FUNCTION get_vendor_by_email(p_email text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v json;
BEGIN
  SELECT row_to_json(r) INTO v
  FROM (SELECT * FROM hq_vendors
        WHERE LOWER(email) = LOWER(p_email) LIMIT 1) r;
  RETURN v;
END;
$$;

-- 1-c. phone 으로 조회 (숫자만 비교)
CREATE OR REPLACE FUNCTION get_vendor_by_phone(p_phone text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v json;
BEGIN
  SELECT row_to_json(r) INTO v
  FROM (SELECT * FROM hq_vendors
        WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
            = REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g')
        LIMIT 1) r;
  RETURN v;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 업체 계정(vendor_accounts) 조회
-- ─────────────────────────────────────────────────────────────────────────────

-- 2-a. email 로 조회
CREATE OR REPLACE FUNCTION get_vendor_account_by_email(p_email text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v json;
BEGIN
  SELECT row_to_json(r) INTO v
  FROM (SELECT id, vendor_id, email, name, created_at
        FROM vendor_accounts
        WHERE LOWER(email) = LOWER(p_email) LIMIT 1) r;
  RETURN v;
END;
$$;

-- 2-b. vendor_id 로 조회
CREATE OR REPLACE FUNCTION get_vendor_account_by_vendor_id(p_vendor_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v json;
BEGIN
  SELECT row_to_json(r) INTO v
  FROM (SELECT id, vendor_id, email, name, created_at
        FROM vendor_accounts
        WHERE vendor_id = p_vendor_id LIMIT 1) r;
  RETURN v;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 업체 저장 (upsert) — 관리자 + 업체 앱 공용
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_hq_vendor(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  INSERT INTO hq_vendors (
    id, name, manager_name, phone, email, kakao_id, memo,
    status, invited_at, joined_at, created_at, updated_at
  )
  SELECT
    (p_data->>'id')::text,
    (p_data->>'name')::text,
    (p_data->>'manager_name')::text,
    (p_data->>'phone')::text,
    (p_data->>'email')::text,
    (p_data->>'kakao_id')::text,
    (p_data->>'memo')::text,
    COALESCE((p_data->>'status')::text, 'pending'),
    (p_data->>'invited_at')::timestamptz,
    (p_data->>'joined_at')::timestamptz,
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW()
  ON CONFLICT (id) DO UPDATE SET
    name          = EXCLUDED.name,
    manager_name  = EXCLUDED.manager_name,
    phone         = EXCLUDED.phone,
    email         = EXCLUDED.email,
    kakao_id      = EXCLUDED.kakao_id,
    memo          = EXCLUDED.memo,
    status        = EXCLUDED.status,
    invited_at    = EXCLUDED.invited_at,
    joined_at     = EXCLUDED.joined_at,
    updated_at    = NOW();

  SELECT row_to_json(r) INTO result
  FROM (SELECT * FROM hq_vendors WHERE id = (p_data->>'id')::text) r;
  RETURN result;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 업체 계정 저장 (upsert)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_vendor_account(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  INSERT INTO vendor_accounts (
    id, vendor_id, email, pw, name, created_at, updated_at
  )
  SELECT
    (p_data->>'id')::text,
    (p_data->>'vendor_id')::text,
    (p_data->>'email')::text,
    (p_data->>'pw')::text,
    (p_data->>'name')::text,
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW()
  ON CONFLICT (id) DO UPDATE SET
    pw         = EXCLUDED.pw,
    name       = EXCLUDED.name,
    updated_at = NOW();

  SELECT row_to_json(r) INTO result
  FROM (SELECT id, vendor_id, email, name, created_at
        FROM vendor_accounts WHERE id = (p_data->>'id')::text) r;
  RETURN result;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 업체 삭제 (soft delete 아닌 실제 삭제 — 관리자 전용)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_delete_hq_vendor(p_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM hq_vendors WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 관리자용 전체 목록 조회 (VendorManage.jsx)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_hq_vendors()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (SELECT * FROM hq_vendors ORDER BY created_at DESC) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_hq_vendor_subjects()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM hq_vendor_subjects r
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_hq_vendor_products()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM hq_vendor_products r
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 업체 앱용 vendorId 필터 조회 (VendorApp.jsx)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_vendor_subjects(p_vendor_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (SELECT * FROM hq_vendor_subjects
          WHERE vendor_id = p_vendor_id ORDER BY created_at) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_vendor_products(p_vendor_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (SELECT * FROM hq_vendor_products
          WHERE vendor_id = p_vendor_id ORDER BY created_at) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_vendor_contents(p_vendor_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (
      SELECT c.*
      FROM hq_vendor_contents c
      INNER JOIN hq_vendor_products p ON p.id = c.product_id
      WHERE p.vendor_id = p_vendor_id
      ORDER BY c.stage, c.session_no
    ) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_vendor_files(p_vendor_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (SELECT * FROM hq_vendor_files
          WHERE vendor_id = p_vendor_id ORDER BY created_at) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_vendor_prices(p_vendor_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (
      SELECT pr.*
      FROM hq_vendor_prices pr
      INNER JOIN hq_vendor_products p ON p.id = pr.product_id
      WHERE p.vendor_id = p_vendor_id
    ) r
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 업체 앱용 단건 upsert — subject / product / content / file / price
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_vendor_subject(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO hq_vendor_subjects (id, vendor_id, name, created_at, updated_at, _deleted)
  SELECT
    (p_data->>'id')::text,
    (p_data->>'vendor_id')::text,
    (p_data->>'name')::text,
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW(),
    COALESCE((p_data->>'_deleted')::boolean, false)
  ON CONFLICT (id) DO UPDATE SET
    name     = EXCLUDED.name,
    _deleted = EXCLUDED._deleted,
    updated_at = NOW();
  RETURN p_data;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_vendor_product(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO hq_vendor_products (
    id, vendor_id, subject_id, name, type, price, description,
    stage_count, sessions_per_stage, alert_session,
    created_at, updated_at, _deleted
  )
  SELECT
    (p_data->>'id')::text,
    (p_data->>'vendor_id')::text,
    (p_data->>'subject_id')::text,
    (p_data->>'name')::text,
    (p_data->>'type')::text,
    COALESCE((p_data->>'price')::numeric, 0),
    (p_data->>'description')::text,
    COALESCE((p_data->>'stage_count')::int, 10),
    COALESCE((p_data->>'sessions_per_stage')::int, 12),
    COALESCE((p_data->>'alert_session')::int, 3),
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW(),
    COALESCE((p_data->>'_deleted')::boolean, false)
  ON CONFLICT (id) DO UPDATE SET
    subject_id         = EXCLUDED.subject_id,
    name               = EXCLUDED.name,
    type               = EXCLUDED.type,
    price              = EXCLUDED.price,
    description        = EXCLUDED.description,
    stage_count        = EXCLUDED.stage_count,
    sessions_per_stage = EXCLUDED.sessions_per_stage,
    alert_session      = EXCLUDED.alert_session,
    _deleted           = EXCLUDED._deleted,
    updated_at         = NOW();
  RETURN p_data;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_vendor_content(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO hq_vendor_contents (
    id, stage_id, product_id, stage, session_no, title, supplies,
    created_at, updated_at, _deleted
  )
  SELECT
    (p_data->>'id')::text,
    (p_data->>'stage_id')::text,
    (p_data->>'product_id')::text,
    COALESCE((p_data->>'stage')::int, 1),
    COALESCE((p_data->>'session_no')::int, 1),
    (p_data->>'title')::text,
    (p_data->>'supplies')::text,
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW(),
    COALESCE((p_data->>'_deleted')::boolean, false)
  ON CONFLICT (id) DO UPDATE SET
    title      = EXCLUDED.title,
    supplies   = EXCLUDED.supplies,
    stage      = EXCLUDED.stage,
    session_no = EXCLUDED.session_no,
    _deleted   = EXCLUDED._deleted,
    updated_at = NOW();
  RETURN p_data;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_vendor_file(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO hq_vendor_files (
    id, vendor_id, product_id, file_type, title, stage,
    file_url, file_name, created_at, updated_at, _deleted
  )
  SELECT
    (p_data->>'id')::text,
    (p_data->>'vendor_id')::text,
    (p_data->>'product_id')::text,
    (p_data->>'file_type')::text,
    (p_data->>'title')::text,
    (p_data->>'stage')::text,
    (p_data->>'file_url')::text,
    (p_data->>'file_name')::text,
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW(),
    COALESCE((p_data->>'_deleted')::boolean, false)
  ON CONFLICT (id) DO UPDATE SET
    file_type  = EXCLUDED.file_type,
    title      = EXCLUDED.title,
    stage      = EXCLUDED.stage,
    file_url   = EXCLUDED.file_url,
    file_name  = EXCLUDED.file_name,
    _deleted   = EXCLUDED._deleted,
    updated_at = NOW();
  RETURN p_data;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_vendor_price(p_data json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO hq_vendor_prices (
    id, vendor_id, product_id, stage,
    price_retail, price_school, price_teacher, price_branch,
    created_at, updated_at
  )
  SELECT
    (p_data->>'id')::text,
    (p_data->>'vendor_id')::text,
    (p_data->>'product_id')::text,
    COALESCE((p_data->>'stage')::int, 1),
    COALESCE((p_data->>'price_retail')::numeric,  0),
    COALESCE((p_data->>'price_school')::numeric,  0),
    COALESCE((p_data->>'price_teacher')::numeric, 0),
    COALESCE((p_data->>'price_branch')::numeric,  0),
    COALESCE((p_data->>'created_at')::timestamptz, NOW()),
    NOW()
  ON CONFLICT (id) DO UPDATE SET
    price_retail  = EXCLUDED.price_retail,
    price_school  = EXCLUDED.price_school,
    price_teacher = EXCLUDED.price_teacher,
    price_branch  = EXCLUDED.price_branch,
    updated_at    = NOW();
  RETURN p_data;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. 업체 앱용 단건 soft delete — subject / product / content / file
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_vendor_subject(p_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE hq_vendor_subjects SET _deleted = true, updated_at = NOW() WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION delete_vendor_product(p_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE hq_vendor_products SET _deleted = true, updated_at = NOW() WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION delete_vendor_content(p_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE hq_vendor_contents SET _deleted = true, updated_at = NOW() WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION delete_vendor_file(p_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE hq_vendor_files SET _deleted = true, updated_at = NOW() WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;
