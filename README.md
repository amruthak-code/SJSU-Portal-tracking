# 🎓 SJSU Course Seat Tracker

A full-stack tool to (1) get emailed the moment a seat opens in courses you're
tracking, (2) find courses in plain English, and (3) audit your MS CS degree —
the AI tabs are powered by Google Gemini (free tier).

It uses SJSU's **public** PeopleSoft class search (no login, no Duo MFA), so it
won't lock your account.

```
┌────────────────────────┐        commits         ┌──────────────────────┐
│  Python scraper         │  status_log.json  ───▶ │  Git repo (shared)    │
│  (GitHub Actions, 5min) │ ◀─── courses.json      │  courses.json         │
│  → emails on open seat  │                        │  status_log.json      │
└────────────────────────┘                        └──────────┬────────────┘
                                                              │ reads/writes
                                                   ┌──────────▼────────────┐
                                                   │  Next.js app (local)   │
                                                   │  3 tabs + Gemini API   │
                                                   └────────────────────────┘
```

This is the **hybrid** setup: the scraper runs always-on in the cloud (GitHub
Actions) for 24/7 email alerts; the web UI runs locally when you want it.

---

## Part 1 — Scraper (Python + Playwright)

**Files:** `scraper/check_seats.py` (seat tracker), `scraper/build_catalog.py`
(live catalog for Smart Search), `scraper/requirements.txt`,
`.github/workflows/track.yml`

It reads `courses.json`, checks each class number on the public class search,
writes `status_log.json`, and emails a Gmail alert when any tracked class is Open.

### Run it locally

```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# load env vars (Gmail) — see .env.example
export GMAIL_USER="you@gmail.com"
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
python check_seats.py
```

### How seat detection works (calibrated)

The public guest page ("View Schedule of Classes") searches by **Subject +
career**, not by class number. So for each subject you track, the scraper:

1. selects the term, fills the subject (taken from each course's `subject`
   field, or parsed from the start of its `label`, e.g. `"CS 249 ..."` → `CS`),
   and **unchecks "Show Open Classes Only"** so full/waitlisted sections appear;
2. reads every section's status icon (`Open` / `Closed` / `Wait List`) and matches
   your class numbers to it.

Statuses are normalized to **Open / Full / Waitlist** (the guest page hides exact
seat counts, so `seats` is `null`). You get an email **only when a course
transitions into Open** — a course that stays open won't email you every run.

> Tip: make sure each tracked course's `label` starts with its subject code
> (`CS …`, `MATH …`), or add an explicit `"subject": "CS"` field, so the scraper
> knows which subject to search.

### Run it in the cloud (GitHub Actions)

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions** → add:
   - `GMAIL_USER` — your Gmail address
   - `GMAIL_APP_PASSWORD` — a [Google App Password](https://myaccount.google.com/apppasswords) (needs 2FA)
   - `ALERT_TO` *(optional)* — where alerts go (defaults to `GMAIL_USER`)
3. The workflow is scheduled (offset every ~15 min) and commits `status_log.json`
   back to the repo. Trigger a test run any time from the **Actions** tab →
   *Track SJSU course seats* → *Run workflow*.

> **Scheduling caveat:** GitHub's `cron` is best-effort and can be delayed or
> skipped (worse on private repos / high-frequency schedules). Keep the repo
> **public** for more reliable scheduling, and don't edit the cron repeatedly —
> each change resets GitHub's ~15–60 min re-registration timer. For guaranteed
> timing, trigger the workflow from an external cron (e.g. cron-job.org calling
> the `workflow_dispatch` API). Manual runs always work regardless.

---

## Part 2 — Web app (Next.js + TypeScript + Tailwind)

**Files:** everything under `web/`

Three tabs:

1. **📋 Course Tracker** — add/remove class numbers (writes `courses.json`),
   shows the latest status from `status_log.json`.
2. **🔍 Smart Search** — natural-language course finder grounded in the **real,
   live SJSU CS schedule** (titles, times, instructors, Open/Full/Waitlist).
   It reads `catalog.json`, built on demand by `scraper/build_catalog.py` (or the
   "🔄 Refresh live courses" button in the tab). Falls back to a hardcoded sample
   (`web/lib/sampleCourses.ts`) if `catalog.json` is missing.
3. **🎓 Degree Audit** — paste completed courses; Gemini matches them against the
   hardcoded **MS CS** requirements (`web/lib/msCsRequirements.ts`).

### Run it

```bash
cd web
npm install
cp .env.local.example .env.local   # then paste your GEMINI_API_KEY
npm run dev
# open http://localhost:3000
```

The Gemini calls happen **server-side** in `web/app/api/{search,audit}/route.ts`,
so `GEMINI_API_KEY` never reaches the browser. The app uses the official
`@google/genai` SDK with model `gemini-2.5-flash-lite` (thinking disabled) and
JSON output. The "🔄 Refresh live courses" button calls
`web/app/api/refresh-catalog/route.ts`, which runs `scraper/build_catalog.py`
locally to rebuild `catalog.json` (works only when run on your machine, since it
needs Python + Playwright).

### How shared data works (hybrid)

`courses.json` and `status_log.json` live at the **repo root** and are committed
to git. The web app reads/writes the root `courses.json` directly; the cloud
scraper reads it on its schedule. After you add/remove courses locally, **commit
& push `courses.json`** so the GitHub Action tracks your latest list. The scraper
pushes `status_log.json` back, so pull to see fresh statuses in the UI.

---

## Environment variables

| Variable              | Used by   | Purpose                                   |
| --------------------- | --------- | ----------------------------------------- |
| `GMAIL_USER`          | scraper   | Gmail address for sending alerts          |
| `GMAIL_APP_PASSWORD`  | scraper   | Gmail App Password (not your login)       |
| `ALERT_TO`            | scraper   | Alert recipient (optional)                |
| `GEMINI_API_KEY`      | web app   | Gemini (Smart Search + Degree Audit)      |

> The original spec listed `SJSU_USER` / `SJSU_PASS` for portal login. We use the
> **public** class search instead, so those are **not needed** — no credentials,
> no Duo MFA, no lockout risk.

---

## Customizing

- **Track different courses:** edit `courses.json` (or use the Tracker tab).
- **Change the term:** set `term` in `courses.json` (e.g. `"Spring 2027"`).
- **Refresh Smart Search data:** click "🔄 Refresh live courses" in the tab, or
  run `cd scraper && python build_catalog.py` (defaults to subject CS).
- **Search a different subject:** `python build_catalog.py MATH` (rebuilds `catalog.json`).
- **Fix degree requirements for your catalog year:** edit `web/lib/msCsRequirements.ts`.

## Notes & limitations

- The sample course list and degree requirements are illustrative — **verify
  against the official SJSU catalog/schedule before enrolling.** The Degree Audit
  is an unofficial estimate, not academic advising.
- GitHub's cron is best-effort; runs may be delayed under load.
