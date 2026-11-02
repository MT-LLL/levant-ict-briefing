#!/usr/bin/env python3
"""截取原版简报的综述首页首屏，不做任何内容展开或修改。"""

import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def latest_issue():
    weeks = []
    for f in (ROOT / "legacy").glob("w*-*.html"):
        m = re.match(r"^w(\d+)-(\d+)\.html$", f.name)
        if m:
            weeks.append((int(m.group(1)), int(m.group(2)), f.name))
    if not weeks:
        raise SystemExit("legacy/ 中未找到任何简报")
    weeks.sort(reverse=True)
    return weeks[0][2]


def main():
    source = ROOT / "legacy" / latest_issue()
    target = ROOT / "data" / "briefing-preview.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1280, "height": 1000}, device_scale_factor=1)
        page.goto(source.resolve().as_uri(), wait_until="load")
        page.screenshot(path=str(target), full_page=False, animations="disabled")
        browser.close()
    print(f"综述首页首屏截图：{target}（{target.stat().st_size} 字节）")


if __name__ == "__main__":
    main()
