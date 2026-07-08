# Inter-View

PR-review-style live coding interviews, graded by AI in the background.

The interviewer picks a challenge and a language, sends the candidate a link, and
the candidate reviews a deliberately flawed pull request — leaving comments on
line numbers, GitHub style. When they submit, the AI Gateway grades the review
against the defects we planted in the code, and the interviewer watches the
results appear on a private report page. Part 2 asks the candidate to fix the
code, which is evaluated the same way.

## Flow

1. **Interviewer** signs in at `/login` (shared password), creates a session on
   `/` → gets a **candidate link** (`/review/:id`) and a private **report
   link** (`/report/:id?key=…`).
2. **Candidate** opens their link, reviews the PR, clicks line numbers to leave
   comments, then submits.
3. AI grading runs in the background (`after()` + AI Gateway) — the report page
   shows which planted findings were caught / partially caught / missed, plus an
   assessment of any extra comments, strengths, gaps and a 0–100 score.
4. The candidate is moved to **Part 2 — fix the code**: they edit the files and
   submit; the AI judges each planted defect as fixed / partially fixed / not
   fixed and flags regressions.

## Challenges

| Challenge | Languages | What it tests |
| --- | --- | --- |
| LRU cache implementation | JavaScript, TypeScript, Python | Data-structure correctness: recency updates, eviction order, capacity validation |
| Users REST API | JavaScript (Express), Python (FastAPI) | SQL injection, leaked password hashes, MD5, validation, unbounded pagination, fire-and-forget DELETE |
| API rate limiter | JavaScript, Python | Spoofable client id, memory leak, off-by-one, multi-instance design |
| Payment webhook handler | JavaScript, Python | Signature verification, idempotency, float money math, silent failure modes |

Challenges live in [`lib/challenges/`](lib/challenges). Each defines the PR
files per language plus the planted findings; a finding's line number is
resolved from a unique code snippet ("anchor") at load time, so nothing breaks
when the sample code changes. Adding a challenge = adding one file and
registering it in [`lib/challenges/index.ts`](lib/challenges/index.ts).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in AI_GATEWAY_API_KEY + INTERVIEWER_PASSWORD
npm run dev
```

Deploy with `vercel deploy` (or `vercel deploy --prod`) and set the same env
vars on the project.

## Known limitations (MVP)

- **Sessions are stored in memory** (`lib/store.ts`). Fine locally and for
  short interviews on a warm instance, but not durable on serverless — swap the
  store for Redis/Postgres from the Vercel Marketplace before real use. The
  rest of the app only talks to the store module's functions.
- Interviewer auth is a single shared password in an env var; the report link
  additionally requires the per-session key.
- The fix phase uses a plain textarea, not a full code editor.
