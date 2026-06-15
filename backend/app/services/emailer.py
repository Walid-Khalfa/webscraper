from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from html import escape


def smtp_is_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM_EMAIL"))


def build_jobs_email_html(
    agency_name: str,
    keyword: str,
    location: str,
    jobs: list[dict[str, str]],
) -> str:
    rows = []
    for job in jobs:
        title = escape(job.get("Title", "Untitled offer"))
        employer = escape(job.get("Employer", "Employer not listed"))
        job_location = escape(job.get("Location", "Location not listed"))
        occupation = escape(job.get("Occupation", ""))
        url = escape(job.get("URL", ""))
        link = f'<p><a href="{url}">Open offer</a></p>' if url else ""
        rows.append(
            f"""
            <article style="border:1px solid #d8d2c5;padding:16px;margin:0 0 14px;background:#fffaf0">
              <h2 style="font-size:18px;margin:0 0 8px">{title}</h2>
              <p style="margin:0 0 4px"><strong>{employer}</strong></p>
              <p style="margin:0 0 4px">{job_location}</p>
              <p style="margin:0;color:#536a73">{occupation}</p>
              {link}
            </article>
            """
        )

    if not rows:
        rows.append("<p>No matching offers were found for this digest.</p>")

    return f"""
    <!doctype html>
    <html>
      <body style="font-family:Arial,sans-serif;background:#f2efe8;color:#151515;padding:24px">
        <main style="max-width:720px;margin:0 auto">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#9d321d">
            German Job Offer Registry
          </p>
          <h1 style="font-size:28px;margin:0 0 10px">Daily job digest for {escape(agency_name)}</h1>
          <p style="margin:0 0 24px;color:#536a73">
            Search: <strong>{escape(keyword)}</strong> in <strong>{escape(location)}</strong>
          </p>
          {''.join(rows)}
        </main>
      </body>
    </html>
    """


def send_email(recipient: str, subject: str, html_body: str) -> dict[str, str | bool]:
    if not smtp_is_configured():
        return {"sent": False, "dry_run": True, "reason": "SMTP is not configured"}

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = os.environ["SMTP_FROM_EMAIL"]
    message["To"] = recipient
    message.set_content("Your email client does not support HTML messages.")
    message.add_alternative(html_body, subtype="html")

    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)

    return {"sent": True, "dry_run": False}
