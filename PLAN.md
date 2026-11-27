# CodeKaizen Exams — final delivery plan

Each phase ends with `typecheck + lint + build`, the relevant automated tests, and one commit, so the app is
stable after every phase. Production data is never modified; all testing uses the Neon `dev` branch.

## Phase 1 — Auth & account restriction (P0)
- **A. Login message**: password is verified first; only then a restricted account returns
  `403 ACCOUNT_RESTRICTED` ("Your account has been restricted by an administrator…"). Wrong password stays the
  generic 401, so restricted accounts cannot be discovered by guessing.
- **B. Immediate lock-out**: `users.session_version` column; restricting bumps it, so every existing session token
  becomes invalid on its next request (DAL compares token version with DB on every request). APIs return
  `403 ACCOUNT_RESTRICTED`; pages redirect through `/api/auth/signout?reason=restricted` (clears cookie).
  Client `SessionGuard`: global fetch interceptor + `/api/auth/me` poll (45 s + on focus) → blocking modal → login.
  In-progress attempts are preserved; saves are refused while restricted; `ACCESS_RESTRICTED` /
  `ACCESS_RESTORED` events go to the attempt timeline; the server timer keeps running (no time added).
  Audit entries name the admin. Users page: Active/Restricted badge, confirm dialog, toast; cannot restrict
  self or the last active admin.
- **C. Save & exit** in the workspace header (flush → confirm → dashboard showing "In progress · Resume · N min
  left"). Sign-out reachable from every role (profile menu; workspace exit dialog).

## Phase 2 — Results pipeline (P0)
- Root cause found: `/examiner/results/[id]` passed a function prop to a client component → render error →
  no publish button. Fix, then audit candidate results for similar failures.
- Grading status per attempt (Auto-graded / Needs manual grading / Graded) + per-attempt review.
- Publish: pre-publish checklist, confirm with count, backend-enforced block on pending grading (explicit
  override), Unpublish/Withdraw, badges with date + publisher, audit.
- Candidate results: own + published only; score gauge, per-topic breakdown, question review
  (correct/wrong/skipped), time spent; friendly "not published yet".
- Reports: candidate PDF with QR + verification ID; examiner exam-level PDF; `/verify` shows only exam title,
  issue date and Valid / Invalid / Revoked.
- Analytics: difficulty vs accuracy, most skipped, most common wrong option, distribution, pass/fail.
- Playwright E2E for the whole chain + the 5.3 offline/refresh scenario.

## Phase 3 — Datasets & import
- Fix `code_kaizen_web_exam_100_questions.csv` with a script that validates every row with the app's own
  `validateQuestionRows`; emit identical CSV + JSON into `/sample-data`; import once through the real UI.
- Import screen: template download, drag-and-drop, dry-run preview table, error table (row, field, reason),
  "Import N valid rows".

## Phase 4 — UI/UX
- `UI_AUDIT.md` from Playwright screenshots (3 roles × 1440/768/375) ranked P0/P1/P2, then fixes.
- Light/Dark/System theme (next-themes, no flash), dark tokens at WCAG AA.
- Shell: grouped collapsible sidebar with user card + logout, breadcrumbs, Ctrl+K command palette, theme toggle.
- StatCard sub-lines, themed charts (area activity chart, donut, per-question bars).
- Candidate: next-exam countdown, performance trend. Login: demo quick-fill (env-flagged), caps-lock hint.
- 5.3 visibility: Online/Unstable/Offline/Reconnecting pill, per-question pending marks, "Attempt restored —
  no time added" screen, disruption timeline; Monitoring splits connectivity events vs integrity indicators.
- Workspace keyboard shortcuts + "?" help, skip link, reduced-motion-aware motion.

## Phase 5 — Submission readiness
- Dev seed: varied attempts, published + unpublished results, disruptions, one restricted user.
- README (setup, URL, credentials, features, 5.3 section, restriction behaviour), `DEMO_SCRIPT.md` (15 min).

## Phase 6 — QA pass
- `QA_REPORT.md` mapped to judging sections A–F with real results; scorecard; judge Q&A; known limitations.
- Authenticated tests run on localhost (dev branch). On the deployed URL only unauthenticated checks are run by
  the assistant; signed-in checks there are listed for the owner to perform.
