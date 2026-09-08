#!/usr/bin/env python3
"""
采集原始素材：Google News RSS + Telegram 公开频道。

数据源与参数见 config/collection.json；Telegram 频道列表取自 config/sources.json。
输出：
  data/raw/{date}.json        采集到的条目
  data/raw/health-{date}.json 各信源采集健康度

设计上单个信源失败不阻断整体流程，失败信息写入健康度报告。
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from urllib.parse import quote

import feedparser
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
TIMEOUT = 30


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def google_news_rss(query, days, max_items):
    """Google News RSS 检索，返回标准化条目。"""
    url = f"https://news.google.com/rss/search?q={quote(query + f' when:{days}d')}&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(url)
    items = []
    for entry in feed.entries[:max_items]:
        published = None
        if getattr(entry, "published_parsed", None):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
        source = ""
        if getattr(entry, "source", None) and getattr(entry.source, "title", None):
            source = entry.source.title
        items.append({
            "platform": "News",
            "source": source or "Google News",
            "title": unescape(entry.title or "").strip(),
            "text": "",
            "url": entry.link or "",
            "date": published,
        })
    return items


def telegram_channel(handle, days):
    """抓取 Telegram 公开频道 t.me/s/{handle} 最近消息。"""
    url = f"https://t.me/s/{handle}"
    resp = requests.get(url, headers=UA, timeout=TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    items = []
    for msg in soup.select("div.tgme_widget_message"):
        time_tag = msg.select_one("time")
        if not time_tag or not time_tag.get("datetime"):
            continue
        dt = datetime.fromisoformat(time_tag["datetime"].replace("Z", "+00:00"))
        if dt < cutoff:
            continue
        text_el = msg.select_one(".tgme_widget_message_text")
        text = text_el.get_text("\n", strip=True) if text_el else ""
        if not text:
            continue
        post_id = msg.get("data-post", "")
        items.append({
            "platform": "Telegram",
            "source": f"@{handle}",
            "title": text.split("\n")[0][:120],
            "text": text[:2000],
            "url": f"https://t.me/{post_id}" if post_id else url,
            "date": dt.isoformat(),
        })
    return items


def dedupe(items):
    seen, out = set(), []
    for it in items:
        key = re.sub(r"\W+", "", (it.get("title") or "").lower())[:80]
        if key and key not in seen:
            seen.add(key)
            out.append(it)
    return out


def main():
    cfg = load_json(ROOT / "config" / "collection.json")
    sources = load_json(ROOT / "config" / "sources.json")
    days = cfg.get("days", 14)
    max_items = cfg.get("max_items_per_query", 20)

    all_items, health = [], []

    # 1) Google News RSS
    for q in cfg.get("news_queries", []):
        label = f"news:{q['country']}:{q['q'][:40]}"
        try:
            items = google_news_rss(q["q"], days, max_items)
            for it in items:
                it["country"] = q["country"]
            all_items.extend(items)
            health.append({"source": label, "status": "ok", "count": len(items)})
            print(f"[ok] {label} -> {len(items)} 条")
        except Exception as e:  # noqa: BLE001
            health.append({"source": label, "status": "error", "error": str(e)})
            print(f"[fail] {label}: {e}", file=sys.stderr)
        time.sleep(1)

    # 2) Telegram 公开频道
    if cfg.get("telegram", {}).get("enabled", True):
        handles = [s["handle"] for s in sources if s.get("platform") == "Telegram"]
        country_of = {s["handle"]: s.get("country", "") for s in sources if s.get("platform") == "Telegram"}
        cc = {"伊拉克": "iq", "约旦": "jo", "黎巴嫩": "lb"}
        for handle in handles:
            label = f"telegram:@{handle}"
            try:
                items = telegram_channel(handle, days)
                for it in items:
                    it["country"] = cc.get(country_of.get(handle, ""), "")
                all_items.extend(items)
                health.append({"source": label, "status": "ok", "count": len(items)})
                print(f"[ok] {label} -> {len(items)} 条")
            except Exception as e:  # noqa: BLE001
                health.append({"source": label, "status": "error", "error": str(e)})
                print(f"[fail] {label}: {e}", file=sys.stderr)
            time.sleep(1)

    all_items = dedupe(all_items)
    all_items.sort(key=lambda x: x.get("date") or "", reverse=True)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    raw_path = RAW_DIR / f"{today}.json"
    health_path = RAW_DIR / f"health-{today}.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump({"collectedAt": datetime.now(timezone.utc).isoformat(), "days": days, "items": all_items}, f, ensure_ascii=False, indent=1)
    with open(health_path, "w", encoding="utf-8") as f:
        json.dump(health, f, ensure_ascii=False, indent=1)

    ok = sum(1 for h in health if h["status"] == "ok")
    print(f"\n采集完成：{len(all_items)} 条（去重后），信源 {ok}/{len(health)} 正常")
    print(f"输出：{raw_path.relative_to(ROOT)} / {health_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
