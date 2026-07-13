# Inter-View

A durable, live pull-request interview environment. Candidates review a curated PR, leave GitHub-style draft comments, submit one review, edit the proposed code in Monaco, and run visible plus hidden checks. Interviewers watch comments, revisions, checks, preliminary AI rubric coverage, and a private timeline in real time.

## Architecture

- **Durable sessions:** Neon Postgres, an append-only indexed event log, Drizzle schema, and checked-in SQL migrations.
- **Capabilities:** candidate URLs contain a random capability token; interviewer reports use a separate report token and the shared interviewer sign-in. Only hashes are stored. The report token is separately encrypted so authenticated interviewers can reopen sessions.
- **Live updates:** authenticated SSE polls event IDs in cursor order, emits 15-second heartbeats, rotates before the function lifetime, and reconnects with `Last-Event-ID`. The UI falls back to snapshot polling if SSE is unavailable.
- **Assessment:** immediate preliminary rubric evidence has no numeric score. Retryable final AI assessment runs with Vercel Workflow and rejects stale session revisions.
- **Execution:** all candidate checks run in a Vercel Sandbox microVM with network denied, no application environment variables, a 30-second limit, 64 KB output cap, and guaranteed shutdown.
- **Privacy:** candidate DTOs are allow-listed. Rubric findings, anchors, hidden test source, reference fixes, AI analysis, and interviewer notes never enter candidate responses.

## Curated PR library

Ten versioned mid/senior exercises cover LRU correctness, API security, distributed rate limiting, webhook reliability, React search races and accessibility, transactional order transfer, queue idempotency, multi-tenant authorization, streaming CSV imports, and flaky asynchronous tests. Each session snapshots its entire challenge version so later library changes cannot alter a live or historical interview.

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

For UI-only local work without Neon, set `INTERVIEW_DEMO_MODE=1`. Production fails closed if `DATABASE_URL` is absent. Use `vercel link && vercel env pull .env.local` to obtain local Workflow/Sandbox credentials.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Database integration tests should run against an isolated Neon branch via `DATABASE_URL`; never point destructive test fixtures at production.
