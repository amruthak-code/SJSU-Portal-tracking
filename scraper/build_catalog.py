#!/usr/bin/env python3
"""
Build the live course catalog for Smart Search and POST it to the web app's
internal API, which stores it in Supabase.

Scrapes the SJSU PUBLIC class search for a subject (default CS), capturing every
section's code, title, days/time, instructor, and live Open/Full/Waitlist status.

Env vars:
    APP_URL       base URL of the web app (e.g. http://localhost:3000 or the Vercel URL)
    CRON_SECRET   shared secret sent as the x-cron-secret header
    TERM          optional, defaults to "Fall 2026"

Usage:
    cd scraper && source .venv/bin/activate
    APP_URL=http://localhost:3000 CRON_SECRET=... python build_catalog.py CS
"""

import json
import os
import sys
import urllib.request
from playwright.sync_api import sync_playwright

SEARCH_URL = (
    "https://cmsweb.cms.sjsu.edu/psp/CSJPRDF/EMPLOYEE/CSJPRD/c/"
    "COMMUNITY_ACCESS.CLASS_SEARCH.GBL?pslnkid=SJ_CLASS_SRCH_LNK"
)
FRAME = "#ptifrmtgtframe"
CAREERS = ["Graduate", "Undergraduate"]
ALT_TO_STATUS = {"Open": "Open", "Closed": "Full", "Wait List": "Waitlist"}

PARSE_JS = """
() => {
  const out = [];
  let code = '', title = '';
  const nodes = document.querySelectorAll(
    "div[id^='win0divSSR_CLSRSLT_WRK_GROUPBOX2GP$'], span[id^='MTG_CLASS_NBR$span$']"
  );
  nodes.forEach(node => {
    if (node.id.indexOf('GROUPBOX2GP') !== -1) {
      const firstLine = (node.textContent || '').trim().split('\\n')[0].trim();
      const m = firstLine.match(/^([A-Z]{1,4}\\s?\\d+\\w?)\\s*[-\\u2013]\\s*(.+)$/);
      code = m ? m[1].replace(/\\s+/g, ' ') : firstLine;
      title = m ? m[2].trim() : '';
    } else {
      const idx = node.id.split('$').pop();
      const g = id => { const e = document.getElementById(id); return e ? (e.textContent || '').trim() : ''; };
      let row = node;
      for (let i = 0; i < 10 && row; i++) { if (row.tagName === 'TR') break; row = row.parentElement; }
      let alt = '';
      if (row) { const im = row.querySelector("img[alt='Open'],img[alt='Closed'],img[alt='Wait List']"); if (im) alt = im.alt; }
      out.push({
        classNumber: node.textContent.trim(),
        code, title,
        section: g('MTG_CLASSNAME$' + idx).split('\\n')[0].trim(),
        daysTime: g('MTG_DAYTIME$' + idx),
        instructor: g('MTG_INSTR$' + idx),
        statusAlt: alt,
      });
    }
  });
  return out;
}
"""


def select_term(page, fr, term):
    """Wait until the term dropdown's options have populated, then select.
    PeopleSoft loads the options after the frame renders, so polling is more
    reliable than a single select_option call."""
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


def scrape(page, term, subject, career):
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
        print(f"  [warn] parse failed for {subject}/{career}: {e}")
        return []


def post_catalog(term, courses):
    app_url = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.environ.get("CRON_SECRET", "")
    payload = json.dumps({"term": term, "courses": courses}).encode()
    req = urllib.request.Request(
        f"{app_url}/api/internal/catalog",
        data=payload,
        headers={"Content-Type": "application/json", "x-cron-secret": secret},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode()
    print(f"  POST /api/internal/catalog -> {body}")


def main():
    subject = (sys.argv[1] if len(sys.argv) > 1 else "CS").upper()
    term = os.environ.get("TERM", "Fall 2026")

    print(f"Building catalog for {subject} — {term} ...")
    by_class = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for career in CAREERS:
            print(f"- scraping {subject} ({career})")
            for s in scrape(page, term, subject, career):
                cn = s["classNumber"]
                if not cn:
                    continue
                s["status"] = ALT_TO_STATUS.get(s.pop("statusAlt", ""), "Unknown")
                s["career"] = career
                by_class[cn] = s
        browser.close()

    courses = sorted(by_class.values(), key=lambda c: (c["code"], c["classNumber"]))
    open_n = sum(1 for c in courses if c["status"] == "Open")
    print(f"Scraped {len(courses)} sections ({open_n} open). Posting to app...")
    post_catalog(term, courses)


if __name__ == "__main__":
    main()
