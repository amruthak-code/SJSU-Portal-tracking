# 🎓 SJSU Course Seat Tracker

A full-stack tool to (1) get emailed the moment a seat opens in courses you're
tracking, (2) find courses in plain English, and (3) audit your MS CS degree —
powered by Claude.

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
                                                   │  3 tabs + Claude API   │
                                                   └────────────────────────┘
```

This is the **hybrid** setup: the scraper runs always-on in the cloud (GitHub
Actions) for 24/7 email alerts; the web UI runs locally when you want it.

---

## Part 1 — Scraper (Python + Playwright)

**Files:** `scraper/check_seats.py`, `scraper/requirements.txt`,
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

> **⚠ Selector calibration (one-time).** PeopleSoft's class search is a
> JavaScript/postback app whose element IDs vary by campus/term. The selectors in
> `SELECTORS` (top of `check_seats.py`) are a best-effort starting point — I
> couldn't test them against live MySJSU from the build environment. If a course
> comes back as **Unknown**, the script saves a screenshot + HTML to
> `scraper/debug/`. Open those, find the real element IDs (term dropdown, "Class
> Nbr" field, Search button, status icon), and update `SELECTORS` once. Everything
> else (alerts, logging, scheduling, commit-back) works as-is.

### Run it in the cloud (GitHub Actions)

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions** → add:
   - `GMAIL_USER` — your Gmail address
   - `GMAIL_APP_PASSWORD` — a [Google App Password](https://myaccount.google.com/apppasswords) (needs 2FA)
   - `ALERT_TO` *(optional)* — where alerts go (defaults to `GMAIL_USER`)
3. The workflow runs every 5 min and commits `status_log.json` back to the repo.
   Trigger a test run from the **Actions** tab → *Track SJSU course seats* → *Run workflow*.

---

## Part 2 — Web app (Next.js + TypeScript + Tailwind)

**Files:** everything under `web/`

Three tabs:

1. **📋 Course Tracker** — add/remove class numbers (writes `courses.json`),
   shows the latest status from `status_log.json`.
2. **🔍 Smart Search** — natural-language course finder; calls Claude with a
   hardcoded sample of SJSU CS courses (`web/lib/sampleCourses.ts`).
3. **🎓 Degree Audit** — paste completed courses; Claude matches them against the
   hardcoded **MS CS** requirements (`web/lib/msCsRequirements.ts`).

### Run it

```bash
cd web
npm install
cp .env.local.example .env.local   # then paste your ANTHROPIC_API_KEY
npm run dev
# open http://localhost:3000
```

The Claude calls happen **server-side** in `web/app/api/{search,audit}/route.ts`,
so `ANTHROPIC_API_KEY` never reaches the browser. The app uses the official
`@anthropic-ai/sdk` with model `claude-opus-4-8` and structured (JSON-schema) outputs.

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
| `ANTHROPIC_API_KEY`   | web app   | Claude (Smart Search + Degree Audit)      |

> The original spec listed `SJSU_USER` / `SJSU_PASS` for portal login. We use the
> **public** class search instead, so those are **not needed** — no credentials,
> no Duo MFA, no lockout risk.

---

## Customizing

- **Track different courses:** edit `courses.json` (or use the Tracker tab).
- **Change the term:** set `term` in `courses.json` (e.g. `"Spring 2027"`).
- **Add courses to Smart Search:** extend `web/lib/sampleCourses.ts`.
- **Fix degree requirements for your catalog year:** edit `web/lib/msCsRequirements.ts`.

## Notes & limitations

- The sample course list and degree requirements are illustrative — **verify
  against the official SJSU catalog/schedule before enrolling.** The Degree Audit
  is an unofficial estimate, not academic advising.
- GitHub's cron is best-effort; runs may be delayed under load.
