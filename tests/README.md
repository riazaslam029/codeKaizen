# Code Kaizen — automated tests

All suites are real, executable code. Nothing here runs against production: every suite that touches
the database refuses to start unless `NEON_BRANCH` (from `.env.local`) is a non-production branch.

| Suite | Tool | What it exercises | Command |
| --- | --- | --- | --- |
| **Unit** | Vitest | Pure logic: scoring (single, multi all-or-nothing/partial, short, essay), server-side deadline maths, exam lifecycle phases, session tokens (sign/verify/tamper/expiry/alg=none), bcrypt, every Zod schema, CSV parser, import row validation, analytics, verification codes, name masking, answer-key stripping | `npm test` (= `npm run test:unit`) |
| **Integration** | Vitest + Neon **dev** branch | Real services against the real database: auth, user admin, role rules, exam lifecycle & ownership, paper composition, enrolment, eligibility windows, attempt start/resume, **parallel starts**, **out-of-order/concurrent saves**, frozen snapshots, deadline rejection & auto-finalisation, **concurrent submits**, incidents, sandbox isolation, auto + manual grading, publication & locking, report access matrix, PDF bytes, verification privacy, analytics, announcements, imports (all-or-nothing, duplicates) | `npm run test:integration` |
| **E2E** | Playwright (installed Chrome) | Full browser journeys on a production build: login UX, role routing, logout, admin user management, examiner create → compose → enrol → publish, candidate answer → mark for review → **refresh recovery** → submit, examiner monitor → grade → publish, candidate result/PDF/verification; **offline drill** (network emulation: answer offline → pending indicator → reconnect → saved; failed syncs + refresh → outbox recovered and replayed; incidents recorded) | `npm run test:e2e` |
| **Security** | Playwright API | Cookie flags, user enumeration, injection payloads, forged/tampered/alg=none tokens, role escalation, IDOR, 401/403/404/422 behaviour, staff-only APIs, verification privacy, stored-XSS rendering | part of `npm run test:e2e` |
| **UI** | Playwright + axe-core | WCAG 2.1 AA (no serious/critical violations) and zero console errors on 15 pages; no horizontal overflow at 375 / 768 / 1366 px; mobile drawer vs desktop sidebar; keyboard focus | part of `npm run test:e2e` |
| **Coverage** | v8 | `src/lib/**` and `src/services/**` (unit + integration) | `npm run test:coverage` → `coverage/index.html` |

## Setup

1. `.env.local` must point at the **dev** branch: `neon env pull --branch dev -s postgres`, plus `AUTH_SECRET`.
   Check with `npm run db:status` → `"branch": "dev"`.
2. Google Chrome must be installed (Playwright uses `channel: "chrome"`; no browser download needed).
3. `npm run test:e2e` builds the app and starts it on port 3200 automatically (`reuseExistingServer` is on).
   To test an already-running server: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.

## Test data

- Integration tests create users `it-<run>-…@it.test`, questions and exams `IT-…`, and delete exactly those afterwards
  (`tests/helpers/world.ts`).
- Browser tests create users `e2e-<run>-…@e2e.test` (password `E2e-Test-Pass-1`) and questions in global setup and remove
  them in global teardown (`tests/e2e/fixtures.ts`). Set `E2E_KEEP_DATA=1` to keep them for debugging.
- The seeded demo accounts are not used or modified by any suite.

## Not automated (manual checklist covers these)

- Scratchpad freehand drawing gestures (persistence is covered; drawing is manual).
- PDF visual layout (bytes, headers and access are covered).
- Load testing (not run: the shared Neon dev branch is not load-test infrastructure).
