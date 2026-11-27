# QA report: CodeKaizen Exams

**Date:** 2026-11-27 · **Commit under test:** `efd1dca` (local) = `origin/master` = the Vercel production deploy

**Environments**
- **Local:** production build (`next build` + `next start -p 3300`) against the Neon **dev** branch with seeded demo data.
- **Deployed:** https://code-kaizen-taupe.vercel.app against the Neon **production** branch. Production migrations are 4/4, applied before the push.

**What "Pass" means.** A row says **Pass** only if the check was run in this session and its output was seen.
- **Not run** means not executed, and the row says why.
- On the deployed site, the assistant ran **anonymous** checks only (no sign-in on production). The signed-in checks for the deployed site are listed in section F for a person to run.

## Summary
| Suite | Where | Result |
| --- | --- | --- |
| Vitest unit + integration (services against the dev DB) | local | **174 / 174 passed** |
| Playwright (e2e journeys, security, offline, axe light + dark, responsive, keyboard) | local production build | **68 / 68 passed** (5.9 min) |
| API QA script `scripts/qa-api.ts` (permissions, validation, idempotency, duplicates, answer keys, headers) | local production build | **34 / 34 passed** (second run, see note C-1) |
| Anonymous smoke + headers + timings | deployed | **all passed** (section F) |
| Lighthouse | n/a | **Not run** (not installed; installing it is a download that needs approval). Load timings were measured with Playwright Chrome instead, and axe covers accessibility. |

---

## A · Core requirements: permissions (API QA script, local)

| Area | Test | Expected | Actual | Pass/Fail | Fix |
| --- | --- | --- | --- | --- | --- |
| A Auth | Login as each seeded role | 200 ×6 | 200,200,200,200,200,200 | Pass | |
| A Permissions | Anonymous GET /api/users | 401 | 401 | Pass | |
| A Permissions | Anonymous GET /api/auth/me | 401 | 401 | Pass | |
| A Permissions | Anonymous GET /admin page | redirect to /login | 307 → /login?next=%2Fadmin | Pass | |
| A Permissions | Candidate GET /api/users (admin only) | 403 | 403 | Pass | |
| A Permissions | Examiner GET /api/users (admin only) | 403 | 403 | Pass | |
| A Permissions | Admin GET /api/users; no password hashes | 200, no passwordHash | 200, hash field present: false | Pass | |
| A Permissions | Candidate POST /api/import/questions | 403 | 403 | Pass | |
| A Permissions | Candidate GET examiner exam report PDF | 403 | 403 | Pass | |
| A Permissions | Other examiner GET exam report (not owner) | 403 or 404 | 404 | Pass | |
| A Permissions | Owner examiner GET exam report | 200 application/pdf | 200 application/pdf | Pass | |
| A Permissions | Candidate GET own published result PDF | 200 application/pdf | 200 application/pdf | Pass | |
| A Permissions | Candidate GET another candidate's result PDF | 404 | 404 | Pass | |
| A Permissions | Candidate opens /examiner page | redirect away (no examiner UI) | 307 → /candidate | Pass | |
| A Permissions | Non-enrolled candidate starts an exam | 403 or 404 | 404 | Pass | |
| A Auth | Restricted account, correct password | 403 ACCOUNT_RESTRICTED | 403 ACCOUNT_RESTRICTED | Pass | |
| C Validation | Login with empty body | 422 VALIDATION_ERROR (field details) | 422 | Pass | |
| C Validation | Login with malformed JSON | 400 | 400 | Pass | |
| C Security | Wrong password vs unknown email (no enumeration) | both 401, same message | 401/401, same=true | Pass | |
| C Validation | Import with invalid format / empty content | 422 | 422 | Pass | |
| C Validation | Attempt id that is not a UUID | 422 | 422 | Pass | |
| E Exam | Candidate starts or resumes Practice Paper | 201 or 200 with attempt id | 201 id ok | Pass | |
| C Security | Attempt payload has no answer keys | no correctAnswer / accepted | "correctAnswer" key:false · "accepted" key:false | Pass | |
| C Timing | Deadline = start + 20 min (server) | 1,200,000 ms | 1200000 ms | Pass | |
| C Timing | Server returns serverNow for clock sync | present, within 60 s of local | 7 ms | Pass | |
| A Permissions | Candidate reads another candidate's attempt | 404 | 404 | Pass | |
| C Idempotency | Out-of-order save (older revision after newer) | newer answer kept | 200/200, stored=a rev=12 | Pass | |
| C Validation | Save answers with invalid payload | 422 | 422 | Pass | |
| C Duplicates | 3 concurrent submits of one attempt | all 200, 1 result row, SUBMITTED or GRADED | 200,200,200 · rows=1 · GRADED · already=2 | Pass | |
| C Integrity | Save after submission | 409 (rejected) | 409 | Pass | |
| B Verify | Public verify of a valid code | 200 valid, no name/email/score | 200 · name:false email:false score:false | Pass | |
| B Verify | Public verify of an unknown code | 404 invalid | 404 | Pass | |
| C Security | Security headers on /login | XFO DENY, nosniff, referrer policy, CSP frame-ancestors | XFO=DENY · nosniff=nosniff · referrer=strict-origin-when-cross-origin · CSP=set | Pass | |
| C Security | Session cookie flags | HttpOnly + SameSite | Path=/; Expires=Fri, 27 Nov 2026 20:55:24 GMT; Max-Age=28800; Secure; HttpOnly; SameSite=lax; Priority=high | Pass | |

The table has a **Fix** column: blank means nothing was needed.

**Note C-1.** The first run reported 33/34. The failing check expected the attempt status `SUBMITTED` after three concurrent submits. The app reported `GRADED`, which is correct: attempts with nothing left to mark by hand go straight to `GRADED`. That expectation in the script was fixed and the script was re-run: 34/34.
The same first run also showed the word "accepted" in the candidate payload. It comes from a question's wording ("…abbreviation accepted"). The answer-key **field** `"accepted":` is absent, and the script now checks the field explicitly.

## A · Core requirements: journeys and authorisation (Playwright + Vitest, local)
| Requirement area | Test (file › name) | Expected | Actual | Pass/Fail | Fix |
| --- | --- | --- | --- | --- | --- |
| Auth | `auth.spec` › wrong password shows a generic error | generic error, stays on login | as expected | Pass | |
| Auth | `auth.spec` › each role lands on its area and cannot open others (×3) | redirect | as expected | Pass | |
| Auth | `auth.spec` › signed-out users sent to login with return path; logout ends session | as described | as expected | Pass | |
| Admin | `admin.spec` › create user → assign role → deactivate → activity | full journey | as expected | Pass | |
| Admin | `restriction.spec` › restricting a signed-in candidate locks them out immediately; login shows restriction message | modal + redirect + message | as expected | Pass | |
| Admin | `restriction.spec` › admin cannot restrict themselves | no control offered | as expected | Pass | |
| Admin | integration › last active administrator can be neither restricted nor demoted | 409 | as expected | Pass | |
| Admin | integration › restriction and role change invalidate sessions (`session_version`) | old token refused | as expected | Pass | |
| Examiner | `exam-lifecycle.spec` › create, compose, enrol, publish | full journey | as expected | Pass | |
| Examiner | `exam-lifecycle.spec` › monitor, grade written answer, publish | full journey | as expected | Pass | |
| Examiner | integration › other examiners cannot sandbox someone else's exam | 404 | as expected | Pass | |
| Candidate | integration › unenrolled 404, draft 403, not yet open 403, blocked 403, staff cannot sit | as listed | as expected | Pass | |
| Exam UI | `exam-lifecycle.spec` › candidate answers, flags, refreshes, submits | answers survive refresh | as expected | Pass | |
| Exam UI | `restriction.spec` › Save & exit keeps attempt open; dashboard shows Resume with server time left | as described | as expected | Pass | |
| Grading | integration › auto-marks, penalties, partial credit, essay pending | exact totals | as expected | Pass | |
| Grading | integration › marks outside 0..max rejected; other examiners rejected | 4xx | as expected | Pass | |
| Results | integration › publish only graded results, unique codes, grades locked | as described | as expected | Pass | |
| Results | integration › blocks publish while essays pending; override allowed; withdrawal revokes codes | as described | as expected | Pass | |
| Results | `exam-lifecycle.spec` › candidate sees published result, PDF with QR, verification valid → revoked | as described | as expected | Pass | |
| Monitoring | integration › connectivity indicators escalate; reload records ATTEMPT_RESUMED | as described | as expected | Pass | |
| Analytics | integration › question analytics from two real attempts, skipped essay counted | real counts | as expected | Pass | |
| Isolation | `api-security.spec` › IDOR: candidates and unrelated examiners cannot read a candidate's records | 404 | as expected | Pass | |
| Isolation | `api-security.spec` › no privilege escalation via the role API | 403 | as expected | Pass | |

## B · Secondary features
| # | Feature | Test | Expected | Actual | Pass/Fail | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Network-aware UI | `offline-recovery.spec` › offline: keep answering, pending sync, reconnect → saved and recorded | pill + pending + recovery | as expected | Pass | |
| 2 | PDF reports | QA script: owner exam PDF 200, candidate own PDF 200, others 403/404; integration › real PDF generated | as listed | as expected | Pass | |
| 3 | Sandbox | integration › preview attempts never create results and are excluded from monitoring | excluded | as expected | Pass | |
| 4 | Bulk import | `import.spec` ×3: fixed CSV 100 imported; JSON reported as duplicates; broken file shows row/field/reason and imports valid rows | as listed | as expected | Pass | |
| 4 | Bulk import | integration › one invalid row → nothing written; dry run writes nothing; candidates cannot import | as listed | as expected | Pass | |
| 5 | Question analytics | integration (see A) | real data | as expected | Pass | |
| 6 | Verifiable reports | QA script: valid code 200 without name, email or score; unknown code 404; e2e valid → revoked | as listed | as expected | Pass | |
| 7 | Workspace preferences | axe + responsive suites cover `/candidate/preferences`; saved via `PUT /api/preferences` | persisted | page passes; persistence exercised in the workspace | Pass | |
| 8 | Scratchpad | integration › scratchpad stored separately and never changes answers | separate | as expected | Pass | |

## C · Technical
| Test | Expected | Actual | Pass/Fail | Fix |
| --- | --- | --- | --- | --- |
| Server-authoritative timing: deadline = start + duration | 1,200,000 ms for 20 min | 1,200,000 ms | Pass | |
| Late starter gets only the remaining window (integration) | capped deadline | as expected | Pass | |
| Resuming does not change the deadline (integration) | unchanged | as expected | Pass | |
| Answers after the deadline rejected, attempt auto-finalised once (integration) | 409 + AUTO_SUBMITTED | as expected | Pass | |
| No answer keys in candidate payloads (QA script + integration) | absent | absent | Pass | |
| Duplicates: 3 concurrent submits → 1 result row | 1 row | 1 row, 2 × `alreadySubmitted` | Pass | |
| Parallel start requests create exactly one attempt (integration) | 1 attempt | 1 | Pass | |
| Out-of-order saves: highest revision wins | newer kept | newer kept | Pass | |
| Validation: schema errors | **422** with field details | 422 | Pass | The API uses 422 for schema errors and 400 for malformed JSON; both are client errors with details. |
| Malformed / injection payloads never cause a 500 (`api-security.spec`) | 4xx | 4xx | Pass | |
| XSS: markup renders as text (`api-security.spec`) | not executed | as expected | Pass | |
| Forged / tampered / missing cookies refused (`api-security.spec`) | 401 | as expected | Pass | |
| Session cookie flags | HttpOnly, Secure, SameSite=Lax | as expected | Pass | |
| Security headers | XFO, nosniff, referrer, CSP frame-ancestors | present locally **and on the deployed site** | Pass | **Fixed in Phase 6:** headers were absent on the deployment. Added in `next.config.ts` (`efd1dca`). |
| Secrets in git history | none | only `.env.example` placeholders (`USER:…@ep-xxxx`) | Pass | |
| No paid / external APIs | none | PDF and QR are generated in-process; the only external service is Neon Postgres | Pass | |
| Database from a clean branch | migrations apply to an empty DB | **Not run** in this session (would create a new Neon branch). The same 4 migrations applied cleanly to production today (2 → 4). | Not run | |
| Failure handling: DB down | 503-style error, no stack trace | **Not run** (would need the DB taken offline) | Not run | |

## D · 5.3 scripted demo steps (DEMO_SCRIPT.md §1:30–5:00)
| # | Step | Expected | Evidence | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Answer a question online | "Saved to server" | `exam-lifecycle.spec` (answers persisted); UI checked in the browser in Phase 4 | Pass |
| 2 | Go offline, keep answering | pill *Offline*, pending marker, banner | `offline-recovery.spec` › offline … pending sync | Pass |
| 3 | Timer keeps running while offline | deadline unchanged | same spec + integration › resuming does not change deadline | Pass |
| 4 | Reconnect | queued answers sync, `RECONNECTED` recorded | `offline-recovery.spec` › reconnect → saved and recorded | Pass |
| 5 | Refresh with unsynced answers | outbox recovered and replayed, deadline unchanged | `offline-recovery.spec` › failed syncs survive a refresh | Pass |
| 6 | "Attempt restored — no time was added" dialog | shown after reload | Built in Phase 4 (driven by server `resumed`); **no automated assertion on the dialog text** | Partial |
| 7 | Submit twice | one submission | QA script + integration | Pass |
| 8 | Examiner sees the events split from integrity indicators | two sections + disclaimer | Checked in the browser on seeded `WSEC-MID` (Phase 5); **no automated assertion** | Partial |

## E · UI/UX
| Test | Expected | Actual | Pass/Fail |
| --- | --- | --- | --- |
| axe WCAG 2.1 AA, 15 pages, **light** | no serious/critical | 0 | Pass |
| axe WCAG 2.1 AA, 15 pages, **dark** | no serious/critical | 0 | Pass |
| No horizontal overflow at 375 / 768 / 1366 | none | none | Pass |
| Mobile drawer vs desktop sidebar | correct per width | as expected | Pass |
| Keyboard: skip link first, form reachable, visible focus | as described | as expected | Pass |
| Zero browser console errors on audited pages | 0 | 0 | Pass |
| Lighthouse ≥ 90 | — | **Not run** (see summary) | Not run |
| Load timings, local production build: /login · /verify · 404 | fast | FCP 168 / 148 / 300 ms; 276–319 KB; 20–24 requests | Pass (informational) |
| Load timings, deployed: /login · /verify · 404 | fast | TTFB 290–479 ms; FCP 708 / 1532 / 1044 ms | Pass (informational) |
| Full keyboard-only exam run | manual | **Not run** as a full session; shortcuts and the help dialog exist | Not run |

## F · Submission
| Check | Expected | Actual | Pass/Fail |
| --- | --- | --- | --- |
| Git history | meaningful, incremental | 19 commits, imperative messages, one per phase or slice | Pass |
| Everything pushed | local = origin | `master` = `origin/master` = `efd1dca` | Pass |
| README: setup, URL, roles, features, 5.3, restriction | present | present; demo emails per role and the demo password (`12345678`) listed for judges | Pass |
| Deployed: `/login`, `/verify`, `/api/health` | 200, DB up | 200 · 200 · `{"status":"ok","database":"up"}` | Pass |
| Deployed: anonymous `/api/users`, `/api/auth/me`, `/api/notifications` | 401 | 401 · 401 · 401 | Pass |
| Deployed: `/admin`, `/examiner`, `/candidate` anonymous | 307 → /login?next=… | as expected | Pass |
| Deployed: unknown verify code | API 404 / page shows *Invalid* | 404 / 200 page | Pass |
| Deployed: wrong credentials | 401 generic | 401 `INVALID_CREDENTIALS` | Pass |
| Deployed: security headers | present | XFO DENY, CSP, nosniff, Referrer-Policy | Pass |
| Deployed: **signed-in** journeys (each role) | work on production data | **Not run by the assistant** (no sign-in on production). To do: sign in as admin, examiner and candidate; open each dashboard; generate one PDF. | Not run |
| DEMO_SCRIPT rehearsed | timed run-through | **Not run** (needs a person) | Not run |
| Last commit and deploy before the deadline | yes | deadline not known to the assistant; last commit and deploy 2026-11-27 | — |

---

## Scorecard estimate (self-assessed, not a judge's score)
| Category | Max | Estimate | Reasoning |
| --- | --- | --- | --- |
| Core functionality | 30 | **27** | Every core area works end-to-end and is tested. Incident "mark reviewed" and disputes UI are missing. |
| Secondary features | 15 | **14** | All 8 present with real data. Preferences persistence relies on page-level checks rather than a dedicated test. |
| Technical quality | 20 | **18** | Server time, revisioned saves, conditional finalise, partial unique index, 276 automated checks. Lighthouse not measured; clean-DB migration not re-run. |
| Innovation (5.3) | 15 | **14** | Outbox, revisions, resume detection and lazy finalisation, visible in the UI and to examiners. Restored-dialog and split-monitoring have no dedicated assertion. |
| UI/UX | 20 | **17** | Themed, accessible (axe light + dark), responsive, command palette. No count-up animation or column sorting; Lighthouse not run. |
| **Total** | **100** | **≈ 90** | |

## Judge Q&A cheat sheet
**What stops a candidate getting extra time?**
The deadline is `expires_at` in Postgres, fixed when the attempt starts and capped by the exam window. The browser only displays it, re-synced to `serverNow` on every response. Saves after the deadline (plus 3 s network grace) get a 409, and the attempt is finalised by the server.

**What if the candidate's Wi-Fi drops?**
Answers go into a localStorage outbox, with a revision number per question. When the connection returns, they flush with back-off. The server keeps an answer only if its revision is newer, so retries and out-of-order arrivals are safe. The examiner sees `NETWORK_LOSS` / `RECONNECTED` with the offline seconds.

**And if they refresh or the browser crashes?**
The outbox survives. The server sees a new client session id, records `ATTEMPT_RESUMED`, and the workspace says *"Attempt restored — no time was added."*

**How do you prevent double submission?**
`UPDATE attempts SET status … WHERE id = $1 AND status = 'IN_PROGRESS' RETURNING`. Only one request can win; the others return `alreadySubmitted: true` and are logged. A partial unique index also allows only one open attempt per candidate per exam.

**What if the examiner edits a question mid-exam?**
Each attempt has a frozen `question_snapshot` (questions, options, keys, marks, scoring rule). Grading always uses the snapshot.

**How do you know answer keys never reach the browser?**
`toCandidateQuestions()` is an explicit allow-list. Integration tests and the QA script assert that `correctAnswer` and `accepted` are absent from candidate payloads.

**How is authorisation enforced?**
`proxy.ts` only redirects. Every page, route handler and server action calls the DAL, which re-reads role, `is_active` and `session_version` from the database. Ownership checks return 404 rather than 403 for other people's records, so nothing reveals that they exist.

**How does restricting a user take effect immediately?**
Restricting bumps `session_version`, which makes every outstanding JWT stale. The next request gets a 403. The client interceptor, a 45 s poll and the window-focus check show the modal. The attempt is preserved and its timer keeps running.

**How is multi-select scored?**
Per question, configured as all-or-nothing or partial. Partial gives +marks/k for each correct pick and −marks/k for each wrong pick, floored at 0. Negative marking applies to wrong single-choice answers.

**How can someone verify a PDF?**
The QR code links to `/verify/<code>`. The code is random and unguessable, issued at publication. The page shows only valid / invalid / revoked, the exam title and issue date. Unpublishing revokes it.

**Why a modular monolith?**
It is one deployable on Vercel, while services stay separated (Attempt, Grading, Results, Import, Report, User). Neon HTTP plus `db.batch` gives atomic multi-statement writes without long-lived connections.

**Are incidents treated as cheating?**
No. Monitoring shows *Connectivity & technical events* separately from *Integrity indicators*, with "Indicators are not evidence of misconduct."

**What would you do next?**
An incident review workflow, candidate disputes, column sorting, and a Lighthouse budget in CI.

## Known limitations
1. **Incident review action missing:** incidents can be viewed, but nothing sets `reviewed_at`. The admin "Unreviewed indicators" count therefore only grows.
2. **Disputes:** the table exists, but there is no candidate or examiner UI.
3. **Offline scope:** the workspace keeps working offline once loaded, and answers queue locally. Starting an exam, submitting and loading new pages need a connection; submit stays disabled until the device is back online.
4. **Lazy finalisation:** an expired attempt is finalised when anyone next reads it (candidate, examiner page, or the `finalizeExpired` sweep on dashboards), not by a background job.
5. **Production demo data:** the seeded story exists on the dev branch only. Production has its original 7 accounts.
6. **Not measured:** Lighthouse scores; migrations on a brand-new empty branch; behaviour with the database offline.
7. **UI:** no count-up animation on stats; tables have search, filters and pagination but no column sorting.
