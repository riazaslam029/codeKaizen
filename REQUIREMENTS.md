# Requirement checklist

**Status key:**
- **Done**: implemented and verified by an automated test or a manual run (named in the Evidence column).
- **Partial**: works, with a stated gap.
- **Missing**: not built.

**Where the list comes from:** the competition brief's core areas (A–G below) and secondary features (1–8), plus the 5.3 innovation. The brief's own numbering (3.1–3.8 for core, 4.1–4.8 for secondary) maps onto these groups in order. QA_REPORT.md (Phase 6) re-tests each one locally and against the deployed URL.

Last verified: 2026-11-27. Results: 174 Vitest tests, and 68 Playwright tests split into e2e, UI/a11y and offline suites. All pass on the dev branch.

## Core

### A · Authentication & roles
| Requirement | Status | Evidence |
| --- | --- | --- |
| Login / logout, hashed passwords (bcrypt), HTTP-only JWT cookie | Done | `tests/e2e/auth.spec.ts`, unit tests for token/password |
| Three roles enforced on the server (pages, APIs, actions) | Done | security suite: 401/403/404 checks for each role |
| Session invalidation on restrict / role change / password reset (`session_version`) | Done | `restriction.spec.ts`, integration tests |
| Restricted message only after a correct password | Done | `restriction.spec.ts`; curl `ACCOUNT_RESTRICTED` |

### B · Admin
| Requirement | Status | Evidence |
| --- | --- | --- |
| Create / edit users, assign roles | Done | `admin.spec.ts` |
| Restrict / restore with confirm, badge, audit; cannot restrict self or the last admin | Partial | Restrict, restore and self-restriction are tested end-to-end. The last-admin rule is enforced in the service (`assertNotLastAdmin`) but **no automated test covers it**, because the dev branch has more than one admin. |
| Roles & permissions matrix | Done | `/admin/roles` |
| Platform activity (audit log) and dashboard from real data | Done | `/admin`, `/admin/activity` |

### C · Examiner: exams & question bank
| Requirement | Status | Evidence |
| --- | --- | --- |
| Create / edit exams, settings (window, duration, attempts, pass mark) | Done | `exam-lifecycle.spec.ts` |
| Lifecycle: draft → publish → ongoing → completed → archive / delete draft | Done | exam service + UI |
| Questions: single-answer MCQ, multi-select (all-or-nothing / partial), true/false, short answer, essay with marking scheme | Done | unit `scoring` tests |
| Edit questions; **delete is soft (archive)**, so past attempts keep their snapshot | Done | by design |
| Subject / topic / difficulty, reusable bank, assign to exams | Done | question bank UI |
| Shuffle questions and options per candidate | Done | attempt start (frozen snapshot) |
| Enrolment management (single + bulk) | Done | candidates page, import |
| Sandbox preview excluded from results and statistics | Done | integration test |
| Announcements | Done | exam page panel; shown in workspace and notifications |
| Live monitoring with progress and last-seen | Done | `/examiner/monitoring/[id]` |
| Incident review | Partial | Incidents are listed, split into technical vs integrity, and shown per attempt. There is **no "mark reviewed" action** (the `reviewed_at` column exists but nothing sets it). |
| Ownership: an examiner cannot touch another examiner's exams | Done | security suite (404) |

### D · Candidate dashboard
| Requirement | Status | Evidence |
| --- | --- | --- |
| Available / upcoming / completed, instructions, eligibility, windows | Done | `exam-lifecycle.spec.ts` |
| Only own enrolments, attempts and results | Done | security suite |
| Published results and history; preferences | Done | results pages, `/candidate/preferences` |

### E · Examination interface
| Requirement | Status | Evidence |
| --- | --- | --- |
| Start, navigate, previous / next, answer all question types | Done | `exam-lifecycle.spec.ts` |
| Answered / unanswered / flagged indicators, marks, timer | Done | workspace |
| Autosave + save-status indicator | Done | `offline-recovery.spec.ts` |
| Refresh and reconnection recovery | Done | `offline-recovery.spec.ts` |
| Review screen, manual submit, auto-submit at expiry | Done | e2e + integration (`finalizeExpired`) |
| Duplicate-submission prevention | Done | integration (conditional update) |
| Server-authoritative time; late answers rejected; frozen question set | Done | integration tests |

### F · Grading & results
| Requirement | Status | Evidence |
| --- | --- | --- |
| Auto-grading (single, multi per rule, T/F, short answer, negative marks) | Done | unit `scoring` |
| Manual essay grading with max-marks validation | Done | grading UI, Zod validation |
| Grading status, publish checklist, override, unpublish, publisher + date | Done | `exam-lifecycle.spec.ts`, integration |
| Candidate sees only own **published** results | Done | security suite |
| Results cannot be modified after publication without unpublishing | Done | service guard |

### G · Monitoring & analytics
| Requirement | Status | Evidence |
| --- | --- | --- |
| Active attempts, progress, exam status | Done | monitoring page |
| Incident logging | Done | incidents table, workspace events API |
| Question analytics: skipped, commonly wrong, observed difficulty | Done | `/examiner/analytics/[id]`, unit `analytics` |
| Charts from real data only, each with a text alternative | Done | Recharts + figcaptions |

## Secondary
| # | Feature | Status | Notes |
| --- | --- | --- | --- |
| 1 | Network-aware interface | Done | Online / Unstable / Reconnecting / Offline pill, per-answer save state, retry countdown |
| 2 | PDF reports (real data, authorised) | Done | candidate result PDF and examiner exam PDF; 403/404 for others |
| 3 | Examination sandbox | Done | excluded from results, analytics and notifications |
| 4 | Bulk import (CSV/JSON, questions + candidates) | Done | dry run, row/field errors, duplicate detection, import only valid rows (opt-in) |
| 5 | Question analytics | Done | real attempt data |
| 6 | Verifiable reports (QR + `/verify`) | Done | valid / invalid / revoked; no name or marks exposed |
| 7 | Customisable workspace | Done | font size, layout, navigator, light / dark / high contrast, saved to the DB |
| 8 | Digital scratchpad | Done | saved per attempt, separate from answers |

## 5.3 Failure-resilient examinations
| Requirement | Status | Evidence |
| --- | --- | --- |
| Server-authoritative timer | Done | `expiresAt` in DB; client synced to `serverNow` |
| Persistent autosave + local outbox | Done | `offline-recovery.spec.ts` |
| Recovery after refresh (no extra time, "Attempt restored" screen) | Done | e2e + manual |
| Recovery after connection loss | Done | Playwright offline emulation |
| Clear sync status | Done | pill, per-answer state, navigator markers |
| Incident logging (connectivity separate from integrity) | Done | monitoring split |
| Idempotent saves and submit | Done | revisions; conditional finalise |
| Automatic finalisation after the deadline | Done | `finalizeExpired`, integration |
| No duplicate attempts / inconsistent results | Done | partial unique index |

## Known gaps (also in QA_REPORT.md)
- Incident "mark as reviewed" action is not built (see C).
- `disputes` table exists with no UI: candidates cannot raise a dispute in the app.
- Production database needs migrations `0002` and `0003` applied before the current code is deployed.
- No count-up animation on stat numbers; tables have search, filters and pagination but no column sorting.
