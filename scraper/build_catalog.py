#!/usr/bin/env python3
"""
Build a live course catalog for the Smart Search tab.

Scrapes the SJSU PUBLIC class search for a subject (default CS), capturing every
section's code, title, days/time, instructor, and live Open/Full/Waitlist status,
and writes it to ../catalog.json.

This is ON-DEMAND (run it when you want fresh data) — the web app's Smart Search
reads catalog.json and hands it to Gemini, so recommendations reflect the real,
current schedule including which sections are actually open.

Usage:
    cd scraper
    source .venv/bin/activate
    python build_catalog.py            # defaults to subject CS, term from courses.json
    python build_catalog.py CS         # explicit subject
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
COURSES_FILE = ROOT / "courses.json"
CATALOG_FILE = ROOT / "catalog.json"

SEARCH_URL = (
    "https://cmsweb.cms.sjsu.edu/psp/CSJPRDF/EMPLOYEE/CSJPRD/c/"
    "COMMUNITY_ACCESS.CLASS_SEARCH.GBL?pslnkid=SJ_CLASS_SRCH_LNK"
)
FRAME = "#ptifrmtgtframe"
CAREERS = ["Graduate", "Undergraduate"]
ALT_TO_STATUS = {"Open": "Open", "Closed": "Full", "Wait List": "Waitlist"}

# Extract every section. The course-title group boxes and the section rows are
# SIBLINGS, so walk them in document order, tracking the current course title.
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


def scrape(page, term, subject, career):
    page.goto(SEARCH_URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2000)
    fr = page.frame_locator(FRAME)
    fr.locator("select[id^='CLASS_SRCH_WRK2_STRM']").first.select_option(label=term)
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


def main():
    subject = (sys.argv[1] if len(sys.argv) > 1 else "CS").upper()
    term = "Fall 2026"
    try:
        term = json.loads(COURSES_FILE.read_text()).get("term", term)
    except Exception:
        pass

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
                by_class[cn] = s  # dedupe by class number
        browser.close()

    courses = sorted(by_class.values(), key=lambda c: (c["code"], c["classNumber"]))
    catalog = {
        "term": term,
        "subject": subject,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "courses": courses,
    }
    CATALOG_FILE.write_text(json.dumps(catalog, indent=2))
    open_n = sum(1 for c in courses if c["status"] == "Open")
    print(f"Wrote {CATALOG_FILE} — {len(courses)} sections ({open_n} open).")


if __name__ == "__main__":
    main()
