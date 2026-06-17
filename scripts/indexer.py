"""
Google Search Console 자동 색인 요청 스크립트
- 사이트맵에서 URL 자동 파싱
- Indexing API로 색인 요청 (신규/업데이트)
- 일일 할당량: 200건 자동 관리
"""

import os
import json
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
import urllib.request
import urllib.error

import google.auth
from google.oauth2 import service_account
from googleapiclient.discovery import build

# ── 설정 ──────────────────────────────────────────────
SITE_URL       = os.environ["SITE_URL"]          # e.g. "https://example.com/"
SITEMAP_URL    = os.environ["SITEMAP_URL"]        # e.g. "https://example.com/sitemap.xml"
SERVICE_ACCOUNT_JSON = os.environ["GCP_SERVICE_ACCOUNT_JSON"]  # GitHub Secret (JSON 문자열)

DAILY_QUOTA    = 190   # 안전 마진 포함 (API 한도 200)
REQUEST_DELAY  = 1.0   # 요청 간 딜레이 (초)
LOG_FILE       = "indexing_log.json"
# ──────────────────────────────────────────────────────


def get_credentials():
    info = json.loads(SERVICE_ACCOUNT_JSON)
    scopes = ["https://www.googleapis.com/auth/indexing"]
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)


def fetch_sitemap_urls(sitemap_url: str) -> list[str]:
    """사이트맵(및 사이트맵 인덱스)에서 URL 목록 추출"""
    urls = []
    try:
        with urllib.request.urlopen(sitemap_url, timeout=30) as resp:
            tree = ET.parse(resp)
    except Exception as e:
        print(f"[ERROR] 사이트맵 가져오기 실패: {e}")
        return urls

    root = tree.getroot()
    ns = root.tag.split("}")[0].lstrip("{") if "}" in root.tag else ""
    ns_prefix = f"{{{ns}}}" if ns else ""

    # 사이트맵 인덱스인 경우 → 하위 사이트맵 재귀 파싱
    if root.tag == f"{ns_prefix}sitemapindex":
        for sitemap in root.findall(f"{ns_prefix}sitemap"):
            loc = sitemap.find(f"{ns_prefix}loc")
            if loc is not None and loc.text:
                urls.extend(fetch_sitemap_urls(loc.text.strip()))
    else:
        for url in root.findall(f"{ns_prefix}url"):
            loc = url.find(f"{ns_prefix}loc")
            if loc is not None and loc.text:
                urls.append(loc.text.strip())

    return urls


def load_log() -> dict:
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            return json.load(f)
    return {}


def save_log(log: dict):
    with open(LOG_FILE, "w") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def request_indexing(service, url: str, url_type: str = "URL_UPDATED") -> bool:
    """단일 URL 색인 요청"""
    try:
        body = {"url": url, "type": url_type}
        service.urlNotifications().publish(body=body).execute()
        return True
    except Exception as e:
        print(f"  [FAIL] {url} → {e}")
        return False


def main():
    print(f"\n{'='*55}")
    print(f"  Search Console 색인 요청 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*55}")

    creds   = get_credentials()
    service = build("indexing", "v3", credentials=creds)
    log     = load_log()

    urls = fetch_sitemap_urls(SITEMAP_URL)
    print(f"\n✅ 사이트맵에서 {len(urls)}개 URL 발견")

    today_str   = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_count = log.get("_today_count", {}).get(today_str, 0)
    remaining   = DAILY_QUOTA - today_count

    if remaining <= 0:
        print(f"⚠️  오늘 할당량 소진 ({DAILY_QUOTA}건). 내일 다시 실행됩니다.")
        return

    print(f"📊 오늘 남은 할당량: {remaining}건\n")

    success = fail = skip = 0

    for url in urls:
        if today_count >= DAILY_QUOTA:
            print(f"\n⚠️  할당량 도달 ({DAILY_QUOTA}건). 나머지 {len(urls) - success - fail - skip}개는 내일 처리됩니다.")
            break

        last_requested = log.get(url, {}).get("last_requested")

        # 이미 오늘 요청한 URL은 스킵
        if last_requested and last_requested.startswith(today_str):
            skip += 1
            continue

        print(f"  → 요청 중: {url}")
        ok = request_indexing(service, url)

        if ok:
            log[url] = {
                "last_requested": datetime.now(timezone.utc).isoformat(),
                "status": "success"
            }
            success += 1
            today_count += 1
        else:
            log[url] = {**log.get(url, {}), "status": "fail"}
            fail += 1

        time.sleep(REQUEST_DELAY)

    # 오늘 카운트 업데이트
    if "_today_count" not in log:
        log["_today_count"] = {}
    log["_today_count"][today_str] = today_count

    save_log(log)

    print(f"\n{'─'*40}")
    print(f"  완료  ✅ 성공: {success}  ❌ 실패: {fail}  ⏭ 스킵: {skip}")
    print(f"{'─'*40}\n")


if __name__ == "__main__":
    main()
