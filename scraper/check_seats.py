#!/usr/bin/env python3
"""
SJSU course seat tracker — scraper.

Reads ../courses.json, checks each tracked class number against SJSU's PUBLIC
PeopleSoft class search (no login, no MFA), writes results to ../status_log.json,
and emails a Gmail alert when any tracked class has open seats.

Designed to run from GitHub Actions every 5 minutes, but also runs locally:

    cd scraper
    pip install -r requirements.txt
    playwright install chromium
    python check_seats.py

Environment variables (see ../.env.example):
    GMAIL_USER, GMAIL_APP_PASSWORD   -- Gmail SMTP for alerts
    ALERT_TO                         -- recipient (defaults to GMAIL_USER)

────────────────────────────────────────────────────────────────────────────
IMPORTANT — SELECTOR CALIBRATION
PeopleSoft's public class search is a JavaScript/postback app whose element IDs
vary slightly between campuses and term layouts. The selectors in SELECTORS
below are a best-effort starting point. On the FIRST run, if a course comes back
as status "Unknown", the script dumps a screenshot + page HTML to scraper/debug/
so you can open it, find the real element IDs, and update SELECTORS once.
Everything else (alerting, logging, scheduling) works as-is.
────────────────────────────────────────────────────────────────────────────
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

# ── SJSU public class search ─────────────────────────────────────────────────
# COMMUNITY_ACCESS = guest/public class search (no login required).
SEARCH_URL = (
    "https://cmsweb.cms.sjsu.edu/psp/CSJPRDF/EMPLOYEE/CSJPRD/c/"
    "COMMUNITY_ACCESS.CLASS_SEARCH.GBL?pslnkid=SJ_CLASS_SRCH_LNK"
)

# PeopleSoft renders the search UI inside this iframe.
CONTENT_FRAME = "#ptifrmtgtframe"

# Selectors are matched by *prefix* where PeopleSoft appends row indices.
# Adjust these once after a calibration run if needed (see note at top of file).
SELECTORS = {
    # Term dropdown (e.g. "2026 Fall")
    "term_select": "select[id^='CLASS_SRCH_WRK2_STRM']",
    # "Class Nbr" search field (under Additional Search Criteria on some layouts)
    "class_nbr_input": "input[id^='SSR_CLSRCH_WRK_CATALOG_NBR'], input[id^='CLASS_SRCH_WRK2_CLASS_NBR'], input[id*='CLASS_NBR']",
    # Search button
    "search_button": "a[id*='CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH'], input[id*='CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH']",
    # Status cell/image in the results — PeopleSoft uses an icon with alt text
    # "Open" / "Closed" / "Wait List".
    "status_images": "img[alt='Open'], img[alt='Closed'], img[alt='Wait List'], img[alt='Waitlist']",
}

# Map the term name in courses.json into the dropdown option text we try to pick.
# We select by visible label substring, so "Fall 2026" -> matches "2026 Fall".


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_courses():
    with open(COURSES_FILE) as f:
        return json.load(f)


def save_status(status: dict):
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2)
    print(f"Wrote {STATUS_FILE}")


def dump_debug(page, tag: str):
    """Save a screenshot + HTML so selectors can be calibrated."""
    DEBUG_DIR.mkdir(exist_ok=True)
    try:
        page.screenshot(path=str(DEBUG_DIR / f"{tag}.png"), full_page=True)
        (DEBUG_DIR / f"{tag}.html").write_text(page.content(), encoding="utf-8")
        print(f"  [debug] saved {DEBUG_DIR / tag}.png / .html for calibration")
    except Exception as e:  # pragma: no cover
        print(f"  [debug] could not save debug artifacts: {e}")


def term_label_variants(term: str):
    """'Fall 2026' -> ['Fall 2026', '2026 Fall']."""
    parts = term.split()
    variants = [term]
    if len(parts) == 2:
        variants.append(f"{parts[1]} {parts[0]}")
    return variants


def get_frame(page):
    """Return the PeopleSoft content frame, or the page itself as fallback."""
    page.wait_for_selector(CONTENT_FRAME, timeout=30000)
    frame = page.frame_locator(CONTENT_FRAME)
    return frame


def check_course(page, term: str, class_number: str) -> dict:
    """
    Search a single class number and return:
        {"status": "Open"|"Full"|"Waitlist"|"Unknown", "seats": int|None}
    """
    result = {"status": "Unknown", "seats": None, "checkedAt": now_iso()}
    try:
        page.goto(SEARCH_URL, wait_until="networkidle", timeout=60000)
        frame = get_frame(page)

        # 1) Select the term, trying visible-label variants.
        try:
            term_sel = frame.locator(SELECTORS["term_select"]).first
            term_sel.wait_for(timeout=15000)
            picked = False
            for label in term_label_variants(term):
                try:
                    term_sel.select_option(label=re.compile(re.escape(label), re.I))
                    picked = True
                    break
                except Exception:
                    continue
            if not picked:
                # Fall back: pick the option whose text contains the year.
                year = next((p for p in term.split() if p.isdigit()), "")
                if year:
                    term_sel.select_option(label=re.compile(year))
            page.wait_for_timeout(1500)  # let PeopleSoft postback settle
        except Exception:
            pass  # some layouts remember the last term

        # 2) Enter the class number.
        nbr = frame.locator(SELECTORS["class_nbr_input"]).first
        nbr.wait_for(timeout=15000)
        nbr.fill(str(class_number))

        # 3) Click search.
        frame.locator(SELECTORS["search_button"]).first.click()
        page.wait_for_load_state("networkidle", timeout=60000)
        page.wait_for_timeout(2000)

        # 4) Read the status icon's alt text.
        status_imgs = frame.locator(SELECTORS["status_images"])
        count = status_imgs.count()
        if count == 0:
            dump_debug(page, f"unknown_{class_number}")
            return result

        alt = (status_imgs.first.get_attribute("alt") or "").strip().lower()
        if alt == "open":
            result["status"] = "Open"
        elif alt in ("wait list", "waitlist"):
            result["status"] = "Waitlist"
        elif alt == "closed":
            result["status"] = "Full"

        # 5) Best-effort seat count: look for "Open Seats: N" or "N of M" text.
        try:
            body_text = frame.locator("body").inner_text(timeout=5000)
            m = re.search(r"Open Seats[:\s]+(\d+)", body_text, re.I)
            if m:
                result["seats"] = int(m.group(1))
        except Exception:
            pass

    except PWTimeout:
        print(f"  [timeout] class {class_number}")
        dump_debug(page, f"timeout_{class_number}")
    except Exception as e:
        print(f"  [error] class {class_number}: {e}")
        dump_debug(page, f"error_{class_number}")
    return result


def send_email_alert(open_courses: list):
    user = os.environ.get("GMAIL_USER")
    pw = os.environ.get("GMAIL_APP_PASSWORD")
    to = os.environ.get("ALERT_TO") or user
    if not user or not pw:
        print("  [email] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping alert")
        return
    lines = [
        f"- {c['label']} (class {c['classNumber']}): {c['status']}"
        + (f", {c['seats']} seat(s) open" if c.get("seats") is not None else "")
        for c in open_courses
    ]
    body = (
        "Good news! Seats just opened in the courses you're tracking:\n\n"
        + "\n".join(lines)
        + "\n\nEnroll fast: https://one.sjsu.edu/task/all/enroll\n"
        + "\n— SJSU Course Seat Tracker"
    )
    msg = EmailMessage()
    msg["Subject"] = f"🎓 Seat available: {', '.join(c['classNumber'] for c in open_courses)}"
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

    print(f"Checking {len(courses)} course(s) for {term}...")
    results = {}
    open_now = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for c in courses:
            cn = str(c["classNumber"])
            label = c.get("label", cn)
            print(f"- {label} (class {cn})")
            r = check_course(page, term, cn)
            r["label"] = label
            r["term"] = term
            results[cn] = r
            print(f"    -> {r['status']}"
                  + (f" ({r['seats']} seats)" if r.get("seats") is not None else ""))
            if r["status"] in ("Open", "Waitlist") and r["status"] == "Open":
                open_now.append({"classNumber": cn, **r})
        browser.close()

    save_status({"lastRun": now_iso(), "results": results})

    if open_now:
        print(f"{len(open_now)} course(s) have open seats — sending alert.")
        send_email_alert(open_now)
    else:
        print("No open seats this run.")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as e:
        print(f"Missing file: {e}", file=sys.stderr)
        sys.exit(1)
