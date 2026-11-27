# CodeKaizen — Secure Examination Management System

TechnoVerse 5.0 Web-e-Thon. A modular-monolith Next.js application for authoring, delivering, monitoring, grading and publishing examinations, with three server-enforced roles: **Admin**, **Examiner**, **Candidate**.

**Primary innovation — failure-resilient examinations:** server-authoritative timing, revisioned idempotent autosave with an offline outbox, recovery after refresh/reconnect (no extra time), duplicate-submission protection, automatic finalisation at the server deadline, and a transparent incident trail for examiners.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript | One deployable on Vercel; server components keep data access on the server |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Lucide, Sonner, Recharts | Accessible primitives, consistent tokens, real-data charts |
| DB | Neon PostgreSQL + Drizzle ORM over `@neondatabase/serverless` (HTTP) | One HTTPS round-trip per query; `db.batch` = atomic transaction |
| Auth | bcryptjs + jose (HS256 JWT in HTTP-only cookie) | Role re-read from DB on every request |
| Reports | pdf-lib | Real PDF generation, no external service |
| Validation | Zod (shared by client and server) | |

## Architecture

```mermaid
flowchart LR
  B[Browser<br/>workspace + outbox] -->|cookie| P[proxy.ts<br/>optimistic redirect]
  P --> RSC[Server Components<br/>admin · examiner · candidate]
  P --> API[Route Handlers /api/*]
  RSC --> SA[Server Actions]
  RSC & API & SA --> DAL[lib/auth/dal<br/>session + DB role]
  DAL --> PERM[lib/permissions<br/>ownership rules]
  RSC & API & SA --> SVC[services/*<br/>Attempt · Grading · Results · Exam · Question · Import · Report]
  SVC --> ORM[Drizzle] -->|neon-http| DB[(Neon Postgres)]
```

```
src/app/(auth)/login · admin/* · examiner/* · candidate/* · attempt/[id] (workspace) · verify/* · api/*
src/services/  attempts · grading · results · exams · questions · import · reports · users · audit · preferences
src/lib/       auth (password, token, session, dal) · permissions · validations · scoring · csv · exam-phase
src/db/schema  enums · tables · relations · json types        drizzle/  SQL migrations
scripts/       migrate · seed (dev only) · smoke-test · e2e-exam-flow
```

### Database (14 tables)
`users`, `exams`, `questions`, `exam_questions`, `enrollments`, `attempts` (frozen `question_snapshot`, `is_sandbox`, `last_seen_at`, `client_session_id`), `answers` (`revision` for idempotent saves), `results` (`verification_code`), `announcements`, `incidents`, `disputes`, `user_preferences`, `scratchpads`, `audit_logs`.
UUID keys, timestamps, Postgres enums, CHECK constraints (window, marks, percentages), unique keys (case-insensitive email, exam code, exam+candidate, attempt+question, attempt number) and a **partial unique index allowing only one open attempt per candidate per exam**.

### Security decisions
- Every page, route handler and server action re-authorises via the DAL (DB role, `isActive`); `proxy.ts` only redirects.
- Ownership: examiners manage only their exams; candidates only their own attempts/results (others get **404**).
- Answer keys never leave the server: candidates receive `toCandidateQuestions()` (explicit allow-list).
- Admins cannot change their own role or deactivate themselves; deactivation ends live sessions immediately.
- Results are published only by an explicit examiner action; published grades are locked.
- Public verification shows only masked name, exam, outcome, percentage and date.

## Setup

```bash
npm install
neon env pull                  # writes DATABASE_URL + DATABASE_URL_UNPOOLED into .env.local
# add AUTH_SECRET and SEED_* passwords to .env.local (see .env.example)
npm run db:migrate
npm run db:seed                # dev only: 6 users, WSEC-101 (scheduled) + WSEC-PRACTICE (open 30 days)
npm run dev
```

| Role | Demo account (password = your `SEED_*` value) |
| --- | --- |
| Admin | admin@codekaizen.test |
| Examiner (owns both exams) | d.reyes@codekaizen.test |
| Examiner (no exams) | p.nair@codekaizen.test |
| Candidates | lena.fischer@ · omar.haddad@ · sofia.marin@codekaizen.test |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run typecheck` / `npm run lint` / `npm run build` | static checks and production build |
| `npm run db:generate` / `db:migrate` / `db:seed` | schema migrations and dev seed |
| `npm run test:smoke` | 29 auth/authorisation checks against a running server (`BASE_URL`) |
| `npm run test:e2e` | 47 end-to-end checks of the full exam lifecycle (creates and removes its own fixture) |

## Deployment (Vercel)
Set `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` and `AUTH_SECRET`. Run `npm run db:migrate` against the production branch. Never set `SEED_*` in production.
