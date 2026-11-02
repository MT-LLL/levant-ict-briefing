#!/usr/bin/env python3
"""每周五群发最新一期双周简报：原版截图预览 + 点击跳转在线 HTML + HTML 附件。"""

import os
import re
import smtplib
import time
import urllib.request
from email.header import Header
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEND_INTERVAL = 3
PREVIEW_PATH = ROOT / "data" / "briefing-preview.png"


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
        raise SystemExit("MAIL_TO 为空：请在 Secrets 中配置收件人")
    return recipients


def build_email_html(issue, online_url, has_preview):
    preview = ""
    if has_preview:
        preview = f"""
        <a href="{online_url}" target="_blank" style="display:block;text-decoration:none;">
          <img src="cid:briefing-preview" alt="双周简报原版预览"
               style="display:block;width:100%;max-width:960px;height:auto;border:1px solid #e5e7eb;border-radius:8px;" />
        </a>"""
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,'Microsoft YaHei',sans-serif;">
  <div style="max-width:980px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0b315b;color:#ffffff;padding:24px;border-radius:10px 10px 0 0;">
      <div style="font-size:22px;font-weight:bold;">黎凡特地区 ICT 双周简报</div>
      <div style="font-size:14px;margin-top:8px;color:#dbeafe;">{issue} · 伊拉克代表处 李辉 00621351 · MSSD AI团队</div>
    </div>
    <div style="background:#ffffff;padding:20px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 16px;">
        点击下方预览图，即可在浏览器中打开<strong>与网站完全一致、可交互的原版简报</strong>。
        邮件附件也包含原版 HTML，可下载后离线打开。
      </p>
      <p style="text-align:center;margin:0 0 18px;">
        <a href="{online_url}" target="_blank"
           style="display:inline-block;background:#185FA5;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:7px;font-size:15px;font-weight:bold;">
          打开可交互原版简报 →
        </a>
      </p>
      {preview}
      <p style="font-size:12px;color:#6b7280;line-height:1.7;margin:16px 0 0;">
        如果未显示图片，可直接点击上方按钮；国家切换和栏目展开请在浏览器中使用。
      </p>
    </div>
  </div>
</body></html>"""


def main():
    filename = latest_issue()
    issue = filename.replace(".html", "").upper()
    raw_url = f"https://raw.githubusercontent.com/MT-LLL/levant-ict-briefing/main/legacy/{filename}"
    online_url = f"https://mt-lll.github.io/levant-ict-briefing/archive/{filename}"
    print(f"本期简报：{filename}")
    with urllib.request.urlopen(raw_url, timeout=60) as resp:
        source_html = resp.read().decode("utf-8")

    has_preview = PREVIEW_PATH.exists() and PREVIEW_PATH.stat().st_size > 0
    print("截图预览：", "已生成" if has_preview else "未找到，将仅发送链接和附件")
    email_html = build_email_html(issue, online_url, has_preview)

    sender = os.environ["SMTP_USER"]
    recipients = parse_recipients()
    print(f"收件人：{len(recipients)} 人")
    failed = []
    with smtplib.SMTP_SSL("smtp.qq.com", 465) as s:
        s.login(sender, os.environ["SMTP_PASS"])
        for i, addr in enumerate(recipients, 1):
            msg = MIMEMultipart("mixed")
            msg["Subject"] = Header(f"Levant ICT 双周简报 · {issue}", "utf-8")
            msg["From"] = sender
            msg["To"] = addr

            related = MIMEMultipart("related")
            related.attach(MIMEText(email_html, "html", "utf-8"))
            if has_preview:
                with open(PREVIEW_PATH, "rb") as f:
                    image = MIMEImage(f.read(), _subtype="png")
                image.add_header("Content-ID", "<briefing-preview>")
                image.add_header("Content-Disposition", "inline", filename="briefing-preview.png")
                related.attach(image)
            msg.attach(related)

            attachment = MIMEApplication(source_html.encode("utf-8"), _subtype="html")
            attachment.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(attachment)
            try:
                s.sendmail(sender, [addr], msg.as_string())
                print(f"[{i}/{len(recipients)}] ✓ {addr}")
            except Exception as e:
                failed.append((addr, str(e)))
                print(f"[{i}/{len(recipients)}] ✗ {addr}: {e}")
            if i < len(recipients):
                time.sleep(SEND_INTERVAL)

    print(f"\n发送完成：成功 {len(recipients) - len(failed)}，失败 {len(failed)}")
    if failed:
        for addr, err in failed:
            print(f"  失败：{addr} — {err}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
