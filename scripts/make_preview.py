#!/usr/bin/env python3
"""在浏览器中展开原版简报全部内容，生成完整长页面截图。"""

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
        page.evaluate("""() => {
          document.querySelectorAll('.country-panel').forEach(p => p.style.display = 'block');
          document.querySelectorAll('.ch-body').forEach(b => b.style.display = 'block');
          document.querySelectorAll('details').forEach(d => d.open = true);
          document.querySelectorAll('.nav').forEach(n => n.remove());
          document.getElementById('retroModal')?.remove();
          const names = {'tab-iq':'🇮🇶 伊拉克', 'tab-jo':'🇯🇴 约旦', 'tab-lb':'🇱🇧 黎巴嫩'};
          for (const [id, name] of Object.entries(names)) {
            const panel = document.getElementById(id);
            if (panel) {
              const h = document.createElement('h2');
              h.textContent = name;
              h.style.cssText = 'font-size:22px;color:#0b315b;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #0b315b;';
              panel.prepend(h);
            }
          }
          window.scrollTo(0, 0);
        }""")
        page.screenshot(path=str(target), full_page=True, animations="disabled")
        browser.close()
    print(f"完整页面截图：{target}（{target.stat().st_size} 字节）")


if __name__ == "__main__":
    main()
