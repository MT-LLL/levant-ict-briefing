#!/usr/bin/env python3
"""
每周五发送最新一期双周简报邮件。

自动从 legacy/ 目录识别最新期 wN-N.html，通过 GitHub Raw 拉取内容发送。
 Secrets: SMTP_USER / SMTP_PASS / MAIL_TO
"""

import os
import re
import smtplib
import urllib.request
from email.header import Header
from email.mime.text import MIMEText
from pathlib import Path

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


filename = latest_issue()
url = f"https://raw.githubusercontent.com/MT-LLL/levant-ict-briefing/main/legacy/{filename}"
print(f"发送最新一期：{filename}")
html = urllib.request.urlopen(url).read().decode("utf-8")

msg = MIMEText(html, "html", "utf-8")
msg["Subject"] = Header(f"Levant ICT 双周简报 · {filename.replace('.html', '').upper()}", "utf-8")
msg["From"] = os.environ["SMTP_USER"]
msg["To"] = os.environ["MAIL_TO"]

with smtplib.SMTP_SSL("smtp.qq.com", 465) as s:
    s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    s.sendmail(msg["From"], [msg["To"]], msg.as_string())
print("发送成功")
