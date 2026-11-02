#!/usr/bin/env python3
"""
每周五群发最新一期双周简报邮件。

邮件正文使用“邮件适配版”：将原版 HTML 的 CSS 内联、删除脚本、展开全部国家/栏目/信源内容，
规避 QQ/Outlook/Gmail 等客户端过滤 <style>/<script> 导致的排版错乱。
同时附加原版 HTML 附件，下载后用浏览器打开即为完全一致的原版页面。

Secrets:
  SMTP_USER  发件邮箱（QQ 邮箱）
  SMTP_PASS  邮箱 SMTP 授权码
  MAIL_TO    收件人列表，多个地址用英文逗号分隔
"""

import os
import re
import smtplib
import time
import urllib.request
from email.header import Header
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from bs4 import BeautifulSoup

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


def _strip_at_rules(css):
    """删除 @media/@supports/@keyframes 等嵌套规则，仅保留普通 CSS 规则用于内联。"""
    out, i, n = [], 0, len(css)
    while i < n:
        if css.startswith(("@media", "@supports", "@keyframes"), i):
            j = css.find("{", i)
            if j < 0:
                break
            depth, k = 1, j + 1
            while k < n and depth:
                if css[k] == "{":
                    depth += 1
                elif css[k] == "}":
                    depth -= 1
                k += 1
            i = k
        else:
            out.append(css[i])
            i += 1
    return "".join(out)


def inline_css(soup):
    """把 <style> 中的普通规则内联到元素 style；伪类/伪元素规则在邮件中无意义，跳过。"""
    rules = []
    for st in soup.find_all("style"):
        css = _strip_at_rules(re.sub(r"/\*.*?\*/", "", st.get_text(), flags=re.S))
        rules.extend((sel.strip(), decl.strip()) for sel, decl in re.findall(r"([^{}]+)\{([^{}]*)\}", css))
        st.decompose()
    for selector, decl in rules:
        if ":" in selector:
            continue
        try:
            elements = soup.select(selector)
        except Exception:
            continue
        for el in elements:
            el["style"] = (el.get("style", "") + ";" + decl).strip(";")


def build_email_html(source_html):
    """将交互式简报转为邮箱可稳定展示的静态 HTML。"""
    soup = BeautifulSoup(source_html, "lxml")
    for tag in soup.find_all("script"):
        tag.decompose()
    modal = soup.find(id="retroModal")
    if modal:
        modal.decompose()
    for el in soup.select("[onclick]"):
        del el["onclick"]
    for nav in soup.select(".nav"):
        nav.decompose()

    # 邮件无法使用 Tab：三个国家全部展开，并插入明显标题
    for panel in soup.select(".country-panel"):
        panel["style"] = "display:block;"
        name = {"tab-iq": "🇮🇶 伊拉克", "tab-jo": "🇯🇴 约旦", "tab-lb": "🇱🇧 黎巴嫩"}.get(panel.get("id"), "")
        if name:
            h = soup.new_tag("h2")
            h["style"] = "font-size:20px;color:#0b315b;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #0b315b;"
            h.string = name
            panel.insert(0, h)
    # 邮件无法手风琴展开：栏目全部打开
    for body in soup.select(".ch-body"):
        body["style"] = "display:block;"
    # details 折叠在多数邮箱不可用：信源内容直接显示
    for d in soup.select("details.ni-detail"):
        body = d.select_one(".ni-detail-body")
        box = soup.new_tag("div")
        box["style"] = "margin-top:6px;padding:8px 10px;background:#f8fafc;border-left:3px solid #185FA5;color:#3e4a5c;line-height:1.7;font-size:12px;"
        box.string = "信源内容｜" + (body.get_text(" ", strip=True) if body else d.get_text(" ", strip=True))
        d.replace_with(box)
    inline_css(soup)
    return str(soup)


def main():
    filename = latest_issue()
    url = f"https://raw.githubusercontent.com/MT-LLL/levant-ict-briefing/main/legacy/{filename}"
    print(f"本期简报：{filename}（{url}）")
    with urllib.request.urlopen(url, timeout=60) as resp:
        source_html = resp.read().decode("utf-8")
    email_html = build_email_html(source_html)
    print(f"邮件适配完成：{len(source_html)} → {len(email_html)} 字符，CSS 已内联，交互内容已展开")

    sender = os.environ["SMTP_USER"]
    recipients = parse_recipients()
    issue = filename.replace(".html", "").upper()
    print(f"收件人：{len(recipients)} 人")

    failed = []
    with smtplib.SMTP_SSL("smtp.qq.com", 465) as s:
        s.login(sender, os.environ["SMTP_PASS"])
        for i, addr in enumerate(recipients, 1):
            msg = MIMEMultipart("mixed")
            msg["Subject"] = Header(f"Levant ICT 双周简报 · {issue}", "utf-8")
            msg["From"] = sender
            msg["To"] = addr  # 逐个发送，收件人互不可见
            msg.attach(MIMEText(email_html, "html", "utf-8"))
            attachment = MIMEApplication(source_html.encode("utf-8"), _subtype="html")
            attachment.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(attachment)
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
        raise SystemExit(1)


if __name__ == "__main__":
    main()
