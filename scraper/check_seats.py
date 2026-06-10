#!/usr/bin/env python3
"""
SJSU course seat tracker — scraper (database edition).

Flow:
  1. GET tracked courses (all users) from the web app's internal API.
  2. Scrape the SJSU PUBLIC class search per (term, subject).
  3. Compute each course's status; email the owning user when a course
     transitions INTO Open (compared to its previous stored status).
  4. POST updated statuses back to the internal API (stored in Supabase).

Env vars:
    APP_URL                base URL of the web app (http://localhost:3000 or Vercel URL)
    CRON_SECRET            shared secret sent as x-cron-secret
    GMAIL_USER, GMAIL_APP_PASSWORD   Gmail SMTP for alerts
"""

import json
import os
import re
import smtplib
import sys
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage

from playwright.sync_api import sync_playwright

SEARCH_URL = (
    "https://cmsweb.cms.sjsu.edu/psp/CSJPRDF/EMPLOYEE/CSJPRD/c/"
    "COMMUNITY_ACCESS.CLASS_SEARCH.GBL?pslnkid=SJ_CLASS_SRCH_LNK"
)
FRAME = "#ptifrmtgtframe"
CAREERS = ["Graduate", "Undergraduate"]
ALT_TO_STATUS = {"Open": "Open", "Closed": "Full", "Wait List": "Waitlist"}

APP_URL = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
CRON_SECRET = os.environ.get("CRON_SECRET", "")

# class number -> status alt text, via each section row's status icon.
PARSE_JS = """
() => {
  const m = {};
  document.querySelectorAll("span[id^='MTG_CLASS_NBR$span$']").forEach(sp => {
    const num = (sp.textContent || '').trim();
    let row = sp;
    for (let i = 0; i < 10 && row; i++) { if (row.tagName === 'TR') break; row = row.parentElement; }
    let alt = '';
    if (row) { const im = row.querySelector("img[alt='Open'],img[alt='Closed'],img[alt='Wait List']"); if (im) alt = im.alt; }
    if (num) m[num] = alt;
  });
  return m;
}
"""


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def api_get(path):
    req = urllib.request.Request(f"{APP_URL}{path}", headers={"x-cron-secret": CRON_SECRET})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def api_post(path, body):
    req = urllib.request.Request(
        f"{APP_URL}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-cron-secret": CRON_SECRET},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def select_term(page, fr, term):
    """Poll until the term dropdown's options populate, then select it."""
    sel = fr.locator("select[id^='CLASS_SRCH_WRK2_STRM']").first
    sel.wait_for(state="attached", timeout=30000)
    opts = []
    for _ in range(30):
        try:
            opts = sel.evaluate("el => Array.from(el.options).map(o => o.text.trim())")
        except Exception:
            opts = []
        if term in opts:
            sel.select_option(label=term)
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"term '{term}' not in options after waiting: {opts}")


def search(page, term, subject, career):
    page.goto(SEARCH_URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2500)
    fr = page.frame_locator(FRAME)
    select_term(page, fr, term)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    fr.locator("#SSR_CLSRCH_WRK_SUBJECT\\$0").fill(subject)
    fr.locator("select[id^='SSR_CLSRCH_WRK_ACAD_CAREER']").select_option(label=career)
    cb = fr.locator("#SSR_CLSRCH_WRK_SSR_OPEN_ONLY\\$3")
    try:
        if cb.is_checked():
            cb.uncheck()
    except Exception:
        pass
    fr.locator("#CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH").click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    try:
        return page.frame_locator(FRAME).locator("body").evaluate(PARSE_JS)
    except Exception as e:
        print(f"  [warn] parse failed {subject}/{career}: {e}")
        return {}


def subject_of(course):
    if course.get("subject"):
        return str(course["subject"]).strip().upper()
    m = re.match(r"\s*([A-Za-z]{2,4})", course.get("label", "") or "")
    return m.group(1).upper() if m else ""


def send_email(to, open_courses):
    user = os.environ.get("GMAIL_USER")
    pw = os.environ.get("GMAIL_APP_PASSWORD")
    if not user or not pw or not to:
        print(f"  [email] missing creds or recipient — skipping ({to})")
        return
    lines = [f"- {c['label']} (class {c['classNumber']}): OPEN" for c in open_courses]
    body = (
        "Good news! Seats just opened in courses you're tracking:\n\n"
        + "\n".join(lines)
        + "\n\nEnroll fast: https://one.sjsu.edu/task/all/enroll\n\n— SJSU Course Seat Tracker"
    )
    msg = EmailMessage()
    msg["Subject"] = "🎓 Seat available: " + ", ".join(c["classNumber"] for c in open_courses)
    msg["From"] = user
    msg["To"] = to
    msg.set_content(body)
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(user, pw)
            s.send_message(msg)
        print(f"  [email] sent to {to}")
    except Exception as e:
        print(f"  [email] failed for {to}: {e}")


def main():
    data = api_get("/api/internal/tracked")
    courses = data.get("courses", [])
    if not courses:
        print("No tracked courses.")
        return
    print(f"Checking {len(courses)} tracked course(s)...")

    # Group searches by (term, subject) to minimize scrapes.
    groups = {}
    for c in courses:
        subj = subject_of(c)
        if not subj:
            print(f"  [skip] no subject for {c.get('label')!r}")
            continue
        groups.setdefault((c.get("term", "Fall 2026"), subj), []).append(c)

    found = {}  # (term, subject) -> {classNumber: statusAlt}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for (term, subj) in groups:
            print(f"- searching {subj} / {term}")
            m = {}
            for career in CAREERS:
                m.update(search(page, term, subj, career))
            found[(term, subj)] = m
        browser.close()

    updates = []
    open_by_email = {}  # email -> [ {classNumber, label} ]
    for c in courses:
        subj = subject_of(c)
        m = found.get((c.get("term", "Fall 2026"), subj), {})
        alt = m.get(str(c["classNumber"]), "")
        new_status = ALT_TO_STATUS.get(alt, "Unknown")
        updates.append({"id": c["id"], "status": new_status, "seats": None, "checkedAt": now_iso()})
        print(f"    {c.get('label')} (class {c['classNumber']}) -> {new_status}")
        # Alert only on a transition INTO Open.
        if new_status == "Open" and c.get("status") != "Open" and c.get("email"):
            open_by_email.setdefault(c["email"], []).append(
                {"classNumber": c["classNumber"], "label": c.get("label", c["classNumber"])}
            )

    api_post("/api/internal/status", {"updates": updates})
    print(f"Posted {len(updates)} status update(s).")

    if open_by_email:
        for to, items in open_by_email.items():
            print(f"{len(items)} newly OPEN for {to} — emailing.")
            send_email(to, items)
    else:
        print("No newly-open seats this run.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
