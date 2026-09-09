#!/usr/bin/env python3
"""
每周五群发最新一期双周简报邮件。

自动从 legacy/ 目录识别最新期 wN-N.html，通过 GitHub Raw 拉取内容，
逐个收件人单独发送（互不可见他人地址），带发送间隔与失败汇总。

Secrets:
  SMTP_USER  发件邮箱（QQ 邮箱）
  SMTP_PASS  邮箱 SMTP 授权码
  MAIL_TO    收件人列表，多个地址用英文逗号分隔，例如：
             zhangsan@example.com, lisi@example.com
"""

import os
import re
import smtplib
import time
import urllib.request
from email.header import Header
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEND_INTERVAL = 3  # 每封间隔秒数，避免触发 SMTP 限流


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


def parse_recipients():
    raw = os.environ.get("MAIL_TO", "")
    recipients = [addr.strip() for addr in re.split(r"[,;\n]", raw) if addr.strip()]
    if not recipients:
        raise SystemExit("MAIL_TO 为空：请在 Secrets 中配置收件人，多个地址用逗号分隔")
    return recipients


def main():
    filename = latest_issue()
    url = f"https://raw.githubusercontent.com/MT-LLL/levant-ict-briefing/main/legacy/{filename}"
    print(f"本期简报：{filename}（{url}）")
    html = urllib.request.urlopen(url).read().decode("utf-8")

    sender = os.environ["SMTP_USER"]
    recipients = parse_recipients()
    issue = filename.replace(".html", "").upper()
    print(f"收件人：{len(recipients)} 人")

    failed = []
    with smtplib.SMTP_SSL("smtp.qq.com", 465) as s:
        s.login(sender, os.environ["SMTP_PASS"])
        for i, addr in enumerate(recipients, 1):
            msg = MIMEText(html, "html", "utf-8")
            msg["Subject"] = Header(f"Levant ICT 双周简报 · {issue}", "utf-8")
            msg["From"] = sender
            msg["To"] = addr  # 逐个发送，收件人互不可见
            try:
                s.sendmail(sender, [addr], msg.as_string())
                print(f"[{i}/{len(recipients)}] ✓ {addr}")
            except Exception as e:  # noqa: BLE001
                failed.append((addr, str(e)))
                print(f"[{i}/{len(recipients)}] ✗ {addr}: {e}")
            if i < len(recipients):
                time.sleep(SEND_INTERVAL)

    print(f"\n发送完成：成功 {len(recipients) - len(failed)}，失败 {len(failed)}")
    if failed:
        for addr, err in failed:
            print(f"  失败：{addr} — {err}")
        raise SystemExit(1)  # 有失败则让 workflow 标红，便于发现


if __name__ == "__main__":
    main()
