# 15-minute demo script

**Setup (before judges arrive)**
- Run `npm run db:seed` on the demo database. It is idempotent and keeps `WSEC-FINAL` 3 days in the future.
- Open two browser windows: **A**, a normal window for the candidate, and **B**, a private window for staff.
- Have Chrome DevTools ready in A (Network tab → throttling dropdown → *Offline*).
- Close other tabs, zoom the browser to 100%, and choose light or dark theme from the top bar.

Each section below lists a time box, the steps, and **What to say**.

---

### 0:00–1:30 · The problem (login page)
- Open `/login`. Point at the copy: exams that survive Wi-Fi drops, refreshes and crashes.
- Type the restricted candidate `ravi.kumar@codekaizen.test` with the **correct** password. The login shows *“Your account has been restricted by an administrator…”*.
- A wrong password gives the generic error.

**What to say:** “We check the password first, so the restriction message never reveals which accounts exist.”

### 1:30–4:00 · Candidate: dashboard and the 5.3 workspace (window A)
1. Quick-fill **Candidate** (Lena) and sign in.
   - Dashboard: the countdown to `WSEC-FINAL`, the performance trend (two published exams) and the *Account active* badge.
2. Start or resume **Web Security — Practice Paper**.
   - Answer 2 questions. Each one shows **Saved to server**.
   - Press `?` for the shortcuts, then use `N`, `2` and `F`.
3. **DevTools → Offline.**
   - The pill turns *Offline* and the banner appears.
   - Answer 2 more. The navigator shows a cloud marker and the question shows *Saved on this device, will sync*.
   - The timer keeps counting down.
4. **Back online.** The pill goes *Reconnecting* → *Online* and the markers clear.
5. **Refresh the page (F5).** The dialog says *“Attempt restored — no time was added.”* Every answer is still there.
6. Open the **history icon** (connection and recovery log). It lists the lost connection, the reconnection and the restore, as recorded by the server.

**What to say:**
- “The deadline lives in the database. The browser clock only displays it.”
- “Every save carries a revision, so a retry can never overwrite a newer answer.”

### 4:00–5:00 · Submit safety
- Click **Review & submit**. The summary shows answered, unanswered and flagged questions.
- Submit, then try again with a double-click. Only one submission is recorded.
- Alternatively, *Save & exit* shows the dashboard's “In progress · about N min left on the server clock”.

### 5:00–8:00 · Examiner (window B)
1. Sign in as **Examiner** (Daniel Reyes). Show the overview stat cards and press **Ctrl+K** to jump to *Monitoring*.
2. Open **Monitoring → Web Security — Mid-term**.
   - *Connectivity & technical events*: connection lost and reconnected (104 s), workspace reloaded, sync failed 3 times, auto-submitted at the deadline.
   - *Integrity indicators*: empty, with **“Indicators are not evidence of misconduct.”**
3. Open **Results → Secure Sessions Quiz**. The publish checklist says *3 attempts still have written answers to grade*.
   - **Publish** is blocked unless you tick the audited override.
   - Open **Grading**, grade one essay, and come back. The counter drops.
4. Open **Results → Mid-term** (published): publisher, date, and the **Exam report (PDF)**.
5. Open **Analytics → Mid-term**: skip rate, most common wrong answers, and difficulty against accuracy, all from real attempts.

### 8:00–9:30 · Question bank and bulk import
- In **Question bank → Import**, drop `sample-data/web_exam_100_questions_fixed.csv`.
  - The dry-run preview shows 100 valid rows.
  - Import it. If the rows already exist, it reports **duplicates skipped** instead of creating new rows.
- Drop `sample-data/original_web_exam_100_questions.csv`. The error table lists *row / field / reason* (`type 'single'` → expected `MCQ_SINGLE`), and nothing is imported.

### 9:30–11:00 · Candidate results and verification (window A)
- **Results → Mid-term**: score gauge, per-topic chart, question review (correct, partial, incorrect, skipped) and time spent.
- **Download PDF.** Scan the QR code or open `/verify/<code>`. The page shows **Valid** with the exam title and issue date, and no name or marks.
- Back in window B, **unpublish** the exam. Refresh the verify page: it now says **Revoked**. Re-publish afterwards.

### 11:00–13:00 · Admin: immediate restriction (window B, then A)
1. Sign out of B and sign in as **Admin**. Show the 14-day activity area chart and *Platform activity*.
2. Before restricting, have Lena start or resume an attempt in A.
3. **Users** → Lena → **Restrict** → confirm.
   - Within seconds, window A shows the restriction modal and returns to login. Her attempt is **kept** and its timer keeps running.
4. **Restore** access. Lena signs in and resumes. Her timeline shows *Access restricted* and *Access restored*.
5. Point out that the admin cannot restrict themselves or the last admin.

### 13:00–14:00 · Quality
- Toggle **dark mode**. Resize to mobile width (375 px): the drawer navigation works and there is no horizontal scroll.
- Mention the test suites:
  - Vitest: 174 unit and integration tests.
  - Playwright: e2e journeys, offline recovery, restriction and import.
  - axe accessibility checks: WCAG AA in light and dark.

### 14:00–15:00 · Wrap-up and questions
**Architecture in one sentence:** “Next.js server components and route handlers call service classes. Drizzle talks to Neon Postgres. Every request re-checks the role, active flag and session version in the database.”

---

## Fallbacks
| If… | Do |
| --- | --- |
| Venue Wi-Fi is bad | Run locally with `npm run dev` against the Neon dev branch; everything above works on localhost |
| Practice Paper attempts are used up (3) | Sign in as another seeded candidate (`omar.haddad@…`) |
| DevTools offline toggle is awkward | Turn off the laptop's Wi-Fi; the outcome is the same |
| The restriction modal takes a while | The poll runs every 45 s; focusing the window or clicking anything triggers it at once |
