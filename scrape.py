#!/usr/bin/env python3
"""Fetch the electricity balance and append it to data.json.

The browser never talks to the utility website directly. This script runs in
GitHub Actions twice per hour (at minute 5) and commits the generated JSON so
the static site can load it with a single same-origin request.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

PAY_URL = "http://www.wap.cnyiot.com/nat/pay.aspx?mid=19500698774"
DATA_FILE = Path(__file__).resolve().parent / "data.json"
CHINA_TZ = timezone(timedelta(hours=8))
REQUEST_TIMEOUT = (5, 25)
MAX_BALANCE = 1e12

# <span>剩余金额:</span><label style="...">84.64</label>
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

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def build_session() -> requests.Session:
    """A short-lived session with safe retries for transient upstream errors."""
    session = requests.Session()
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
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Cache-Control": "no-cache",
        }
    )
    return session


def fetch_page(session: requests.Session) -> str:
    response = session.get(PAY_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    response.encoding = "utf-8"
    if not response.text.strip():
        raise ValueError("upstream page was empty")
    return response.text


def parse_balance(page_html: str) -> float:
    match = BALANCE_PATTERN.search(page_html) or BALANCE_FALLBACK_PATTERN.search(page_html)
    if not match:
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
    except Exception as exc:  # requests errors, HTTP errors, parsing and JSON errors
        print(f"[scrape] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
