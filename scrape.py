#!/usr/bin/env python3
"""Fetch the electricity balance and append it to data.json.

The upstream site sits behind an Alibaba Cloud WAF. Direct requests work from
some networks but GitHub-hosted runners can receive HTTP 405. This script:

* keeps HTTPS only (no insecure/failing HTTP downgrade),
* uses browser-like headers,
* optionally routes through an HTTP(S) proxy via SCRAPE_PROXY_URL,
* on GitHub Actions prefers curl_cffi's browser TLS fingerprint and falls back
  to requests,
* never writes data.json unless a valid balance was parsed.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from curl_cffi import requests as curl_requests
except ImportError:  # Optional: requests remains the supported fallback.
    curl_requests = None

PAY_URL = "https://www.wap.cnyiot.com/nat/pay.aspx?mid=19500698774"
DATA_FILE = Path(__file__).resolve().parent / "data.json"
CHINA_TZ = timezone(timedelta(hours=8))
REQUEST_TIMEOUT = (5, 25)
MAX_BALANCE = 1e12
PROXY_URL = os.environ.get("SCRAPE_PROXY_URL", "").strip()
IS_GITHUB_ACTION = os.environ.get("GITHUB_ACTIONS") == "true"

BALANCE_PATTERN = re.compile(
    r"<span[^>]*>\s*剩余金额\s*[:：]?\s*</span>\s*"
    r"<label[^>]*>\s*(-?\s*[0-9][0-9,]*(?:\.[0-9]+)?)\s*</label>",
    re.IGNORECASE | re.DOTALL,
)

# Tolerates minor markup changes while still anchoring on the amount field,
# never the similarly formatted "剩余电量" field.
BALANCE_FALLBACK_PATTERN = re.compile(
    r"剩余金额[\s\S]{0,500}?(-?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://www.wap.cnyiot.com/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
}


class FetchError(RuntimeError):
    """Raised when an upstream transport does not return the payment page."""


def request_proxies() -> dict[str, str] | None:
    if not PROXY_URL:
        return None
    return {"http": PROXY_URL, "https": PROXY_URL}


def build_session() -> requests.Session:
    session = requests.Session()
    # Use only the explicitly configured proxy, not ambient CI/local env vars.
    session.trust_env = False
    proxies = request_proxies()
    if proxies:
        session.proxies.update(proxies)

    retry = Retry(
        total=2,
        connect=2,
        read=2,
        backoff_factor=1.2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(BROWSER_HEADERS)
    return session


def response_excerpt(response: requests.Response | object) -> str:
    try:
        text = getattr(response, "text", "") or ""
    except Exception:
        return ""
    return re.sub(r"\s+", " ", text[:240]).strip()


def require_pay_page(text: str, transport: str) -> str:
    if "剩余金额" not in text:
        raise FetchError(
            f"{transport} returned HTTP 200 but no 剩余金额 marker "
            "(likely a WAF/challenge page)"
        )
    return text


def fetch_with_requests(session: requests.Session) -> str:
    try:
        response = session.get(PAY_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.RequestException as exc:
        raise FetchError(f"requests network error: {exc}") from exc

    if response.status_code != 200:
        raise FetchError(
            f"requests HTTP {response.status_code}: {response_excerpt(response)}"
        )

    response.encoding = response.apparent_encoding or "utf-8"
    return require_pay_page(response.text, "requests")


def fetch_with_curl() -> str:
    if curl_requests is None:
        raise FetchError("curl_cffi is not installed")

    kwargs = {
        "headers": BROWSER_HEADERS,
        "impersonate": "chrome",
        "timeout": 25,
        "allow_redirects": True,
    }
    proxies = request_proxies()
    if proxies:
        kwargs["proxies"] = proxies

    try:
        response = curl_requests.get(PAY_URL, **kwargs)
    except Exception as exc:
        raise FetchError(f"curl_cffi network error: {exc}") from exc

    if response.status_code != 200:
        raise FetchError(
            f"curl_cffi HTTP {response.status_code}: {response_excerpt(response)}"
        )

    try:
        text = response.content.decode("utf-8")
    except UnicodeDecodeError:
        text = response.text
    return require_pay_page(text, "curl_cffi")


def fetch_page(session: requests.Session) -> str:
    """Use one browser-like request on Actions to avoid extending WAF blocks.

    A second request from the same runner IP does not help with an HTTP 405 and
    can prolong the WAF's temporary rate limit. Local runs keep a requests-first
    fallback because they are not subject to the same shared-egress behavior.
    """
    if IS_GITHUB_ACTION:
        transports = (
            [("curl_cffi", fetch_with_curl)]
            if curl_requests is not None
            else [("requests", lambda: fetch_with_requests(session))]
        )
    else:
        transports = [("requests", lambda: fetch_with_requests(session))]
        if curl_requests is not None:
            transports.append(("curl_cffi", fetch_with_curl))

    errors = []
    for index, (name, transport) in enumerate(transports):
        try:
            page_html = transport()
            if index:
                print(f"[scrape] fallback transport succeeded: {name}")
            return page_html
        except FetchError as exc:
            errors.append(f"{name}: {exc}")
            print(f"[scrape] {name} failed: {exc}", file=sys.stderr)
            if index < len(transports) - 1:
                time.sleep(2.5)

    raise FetchError(" | ".join(errors))


def parse_balance(page_html: str) -> float:
    match = BALANCE_PATTERN.search(page_html) or BALANCE_FALLBACK_PATTERN.search(page_html)
    if not match:
        print(f"[debug] page head: {page_html[:200]}", file=sys.stderr)
        raise ValueError("could not find the 剩余金额 field in the page")

    raw_value = match.group(1).replace(",", "").replace(" ", "")
    try:
        balance = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"remaining amount is not numeric: {match.group(1)!r}") from exc

    if balance != balance or abs(balance) > MAX_BALANCE:
        raise ValueError(f"remaining amount is out of range: {balance!r}")
    return round(balance, 2)


def load_history() -> list[dict]:
    if not DATA_FILE.exists():
        return []

    try:
        history = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"data.json is not readable JSON: {exc}") from exc

    if not isinstance(history, list):
        raise ValueError("data.json must contain a JSON array")

    for index, entry in enumerate(history):
        if not isinstance(entry, dict):
            raise ValueError(f"data.json entry {index} is not an object")
        if not isinstance(entry.get("time"), str) or not isinstance(entry.get("balance"), (int, float)):
            raise ValueError(f"data.json entry {index} has an invalid shape")

    return history


def save_history(history: list[dict]) -> None:
    """Atomically replace data.json so a partial write cannot corrupt the site."""
    history.sort(key=lambda entry: entry["time"])
    serialized = json.dumps(history, ensure_ascii=False, indent=2) + "\n"
    temp_file = DATA_FILE.with_name(f"{DATA_FILE.name}.tmp")
    temp_file.write_text(serialized, encoding="utf-8")
    temp_file.replace(DATA_FILE)


def main() -> int:
    try:
        timestamp = datetime.now(CHINA_TZ).strftime("%Y-%m-%d %H:%M")
        with build_session() as session:
            page_html = fetch_page(session)
        balance = parse_balance(page_html)
        history = load_history()

        record = {"time": timestamp, "balance": balance}
        existing_index = next(
            (index for index, entry in enumerate(history) if entry["time"] == timestamp),
            None,
        )

        if existing_index is not None:
            if history[existing_index] == record:
                print(f"[scrape] {timestamp} already recorded ({balance:.2f}); no change")
                return 0
            history[existing_index] = record
            action = "updated"
        else:
            history.append(record)
            action = "appended"

        save_history(history)
        print(f"[scrape] {action} {timestamp} balance={balance:.2f}; total records={len(history)}")
        return 0
    except Exception as exc:
        print(f"[scrape] failed: {exc}", file=sys.stderr)
        if "405" in str(exc) or "403" in str(exc) or "challenge" in str(exc).lower():
            print(
                "[scrape] This is an upstream WAF/egress rejection, not a balance-format error. "
                "Do not rerun repeatedly: it can extend the temporary block. "
                "Configure SCRAPE_PROXY_URL with a China-based HTTP(S) proxy or use a "
                "self-hosted runner on a network where the payment page opens normally.",
                file=sys.stderr,
            )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
