#!/usr/bin/env python3
"""
SJSU course seat tracker — scraper.

Reads ../courses.json, checks each tracked class number against SJSU's PUBLIC
PeopleSoft class search (no login, no MFA), writes results to ../status_log.json,
and emails a Gmail alert when any tracked class has OPEN seats.

How it works (calibrated against the live "View Schedule of Classes" page):
  The public guest page searches by Subject + (Graduate/Undergraduate). It does
  NOT have a class-number field. So for each subject we're tracking, we run a
  search with "Show Open Classes Only" UNCHECKED, then read every section's
  status icon (alt = "Open" / "Closed" / "Wait List") and match our class
  numbers. The subject is taken from each course's `subject` field, or parsed
  from the start of its `label` (e.g. "CS 249 ..." -> "CS").

Run locally:
    cd scraper
    pip install -r requirements.txt
    playwright install chromium
    python check_seats.py

Environment variables (see ../.env.example):
    GMAIL_USER, GMAIL_APP_PASSWORD   -- Gmail SMTP for alerts
    ALERT_TO                         -- recipient (defaults to GMAIL_USER)
"""

import json
import os
import re
import smtplib
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
COURSES_FILE = ROOT / "courses.json"
STATUS_FILE = ROOT / "status_log.json"
DEBUG_DIR = Path(__file__).resolve().parent / "debug"

# ── SJSU public class search (COMMUNITY_ACCESS = guest, no login) ─────────────
SEARCH_URL = (
    "https://cmsweb.cms.sjsu.edu/psp/CSJPRDF/EMPLOYEE/CSJPRD/c/"
    "COMMUNITY_ACCESS.CLASS_SEARCH.GBL?pslnkid=SJ_CLASS_SRCH_LNK"
)
CONTENT_FRAME = "#ptifrmtgtframe"  # the search form/results live in this iframe

# Careers to search per subject (covers both grad and undergrad sections).
CAREERS = ["Graduate", "Undergraduate"]

# Map the page's status icon alt-text to our normalized status.
ALT_TO_STATUS = {"Open": "Open", "Closed": "Full", "Wait List": "Waitlist"}

# JS that maps every section's class number -> status icon alt text.
PARSE_JS = """
() => {
  const m = {};
  document.querySelectorAll("span[id^='MTG_CLASS_NBR$span$']").forEach(sp => {
    const num = (sp.textContent || '').trim();
    let row = sp;
    for (let i = 0; i < 10 && row; i++) { if (row.tagName === 'TR') break; row = row.parentElement; }
    let alt = '';
    if (row) {
      const im = row.querySelector("img[alt='Open'],img[alt='Closed'],img[alt='Wait List']");
      if (im) alt = im.alt;
    }
    if (num) m[num] = alt;
  });
  return m;
}
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_courses():
    with open(COURSES_FILE) as f:
        return json.load(f)


def save_status(status: dict):
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2)
    print(f"Wrote {STATUS_FILE}")


def subject_of(course: dict) -> str:
    """Subject code for a tracked course: explicit field, or parsed from label."""
    if course.get("subject"):
        return str(course["subject"]).strip().upper()
    m = re.match(r"\s*([A-Za-z]{2,4})", course.get("label", ""))
    return m.group(1).upper() if m else ""


def dump_debug(frame, tag: str):
    DEBUG_DIR.mkdir(exist_ok=True)
    try:
        (DEBUG_DIR / f"{tag}.html").write_text(frame.content(), encoding="utf-8")
        print(f"  [debug] saved {DEBUG_DIR / tag}.html")
    except Exception as e:  # pragma: no cover
        print(f"  [debug] could not save debug html: {e}")


def get_content_frame(page):
    """Return the underlying Frame object for the PeopleSoft content iframe.

    Match by the iframe's name ('ptifrmtgtframe'), NOT by URL — the top-level
    page URL also contains 'COMMUNITY_ACCESS', so a URL match would wrongly
    return the outer shell (which has no results DOM)."""
    for f in page.frames:
        if (f.name or "") == "ptifrmtgtframe":
            return f
    return page.main_frame


def search_subject(page, term: str, subject: str, career: str) -> dict:
    """Run one Subject+Career search and return {classNumber: status_alt}."""
    page.goto(SEARCH_URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2000)
    fr = page.frame_locator(CONTENT_FRAME)

    # Term (option labels are exactly "Fall 2026" / "Spring 2026" / ...)
    fr.locator("select[id^='CLASS_SRCH_WRK2_STRM']").first.select_option(label=term)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # Subject + Career
    fr.locator("#SSR_CLSRCH_WRK_SUBJECT\\$0").fill(subject)
    fr.locator("select[id^='SSR_CLSRCH_WRK_ACAD_CAREER']").select_option(label=career)

    # Uncheck "Show Open Classes Only" so full/waitlisted sections also appear.
    cb = fr.locator("#SSR_CLSRCH_WRK_SSR_OPEN_ONLY\\$3")
    try:
        if cb.is_checked():
            cb.uncheck()
    except Exception:
        pass

    fr.locator("#CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH").click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Best-effort: expand a paginated result set if a "View All" link exists.
    try:
        view_all = fr.get_by_text(re.compile("View All", re.I)).first
        if view_all.is_visible(timeout=1500):
            view_all.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
    except Exception:
        pass

    try:
        # Parse via the iframe locator (proven reliable) rather than a Frame
        # object — PARSE_JS ignores the element arg and reads `document`.
        return page.frame_locator(CONTENT_FRAME).locator("body").evaluate(PARSE_JS)
    except Exception as e:
        print(f"  [warn] could not parse results for {subject}/{career}: {e}")
        dump_debug(get_content_frame(page), f"parsefail_{subject}_{career}")
        return {}


def send_email_alert(open_courses: list):
    user = os.environ.get("GMAIL_USER")
    pw = os.environ.get("GMAIL_APP_PASSWORD")
    to = os.environ.get("ALERT_TO") or user
    if not user or not pw:
        print("  [email] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping alert")
        return
    lines = [f"- {c['label']} (class {c['classNumber']}): OPEN" for c in open_courses]
    body = (
        "Good news! Seats just opened in the courses you're tracking:\n\n"
        + "\n".join(lines)
        + "\n\nEnroll fast: https://one.sjsu.edu/task/all/enroll\n"
        + "\n— SJSU Course Seat Tracker"
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
        print(f"  [email] alert sent to {to}")
    except Exception as e:
        print(f"  [email] failed: {e}")


def main():
    data = load_courses()
    term = data.get("term", "Fall 2026")
    courses = data.get("courses", [])
    if not courses:
        print("No courses tracked. Add some in courses.json or via the web app.")
        save_status({"lastRun": now_iso(), "results": {}})
        return

    # Previous statuses, so we only alert on a transition INTO Open (no spam).
    prev_status = {}
    try:
        with open(STATUS_FILE) as f:
            prev_status = {
                k: v.get("status") for k, v in json.load(f).get("results", {}).items()
            }
    except Exception:
        pass

    # Group by subject so we run as few searches as possible.
    subjects = {}
    for c in courses:
        subj = subject_of(c)
        if not subj:
            print(f"  [skip] cannot determine subject for {c.get('label')!r}")
            continue
        subjects.setdefault(subj, []).append(c)

    print(f"Checking {len(courses)} course(s) across {len(subjects)} subject(s) for {term}...")

    # classNumber -> status_alt, built from one search per (subject, career)
    found = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for subj in subjects:
            for career in CAREERS:
                print(f"- searching {subj} ({career})")
                try:
                    found.update(search_subject(page, term, subj, career))
                except PWTimeout:
                    print(f"    [timeout] {subj}/{career}")
                except Exception as e:
                    print(f"    [error] {subj}/{career}: {e}")
        browser.close()

    # Build results + collect open courses for alerting.
    results = {}
    open_now = []
    for c in courses:
        cn = str(c["classNumber"])
        alt = found.get(cn, "")
        status = ALT_TO_STATUS.get(alt, "Unknown")
        results[cn] = {
            "status": status,
            "seats": None,  # guest page hides exact seat counts
            "checkedAt": now_iso(),
            "label": c.get("label", cn),
            "term": term,
        }
        print(f"    {c.get('label', cn)} (class {cn}) -> {status}")
        # Alert only on a transition into Open (was not Open last run), so a
        # course that stays open doesn't email you every 5 minutes.
        if status == "Open" and prev_status.get(cn) != "Open":
            open_now.append({"classNumber": cn, "label": c.get("label", cn)})

    save_status({"lastRun": now_iso(), "results": results})

    if open_now:
        print(f"{len(open_now)} course(s) newly OPEN — sending alert.")
        send_email_alert(open_now)
    else:
        print("No newly-open seats this run.")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as e:
        print(f"Missing file: {e}", file=sys.stderr)
        sys.exit(1)
