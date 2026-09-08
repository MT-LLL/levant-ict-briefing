import os
import smtplib
import urllib.request
from email.header import Header
from email.mime.text import MIMEText

URL = "https://raw.githubusercontent.com/MT-LLL/levant-ict-briefing/main/w35-36.html"
html = urllib.request.urlopen(URL).read().decode("utf-8")

msg = MIMEText(html, "html", "utf-8")
msg["Subject"] = Header("Levant ICT 周报", "utf-8")
msg["From"] = os.environ["SMTP_USER"]
msg["To"] = os.environ["MAIL_TO"]

with smtplib.SMTP_SSL("smtp.qq.com", 465) as s:
    s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    s.sendmail(msg["From"], [msg["To"]], msg.as_string())
print("发送成功")
