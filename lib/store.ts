import "server-only";

import { randomUUID } from "node:crypto";
import { neon, type NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import { getVariant, resolveFindings } from "./challenges";
import type { Challenge, ChallengeFile, CheckRun, FileRevision, InterviewDecision, InterviewerRubricDecision, Language, LiveAssessment, ReviewComment, Session, SessionEvent, SessionEventType } from "./types";
import { createToken, hashToken, sealToken, tokenMatches, unsealToken } from "./server/tokens";

interface StoredSession { snapshot: Session; candidateTokenHash: string; candidateTokenCiphertext?: string; reportTokenHash: string; reportTokenCiphertext: string }
interface DemoState { sessions: Map<string, StoredSession>; events: SessionEvent[]; cursor: number }
const globalState = globalThis as typeof globalThis & { __interviewDemo?: DemoState };
const demo = (globalState.__interviewDemo ??= { sessions: new Map<string, StoredSession>(), events: [] as SessionEvent[], cursor: 0 });

function databaseEnabled() {
  if (process.env.DATABASE_URL) return true;
  if (process.env.NODE_ENV === "production" && process.env.INTERVIEW_DEMO_MODE !== "1") {
    throw new Error("DATABASE_URL is required in production");
  }
  return false;
}

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

function event(sessionId: string, type: SessionEventType, actor: SessionEvent["actor"], payload: Record<string, unknown>): SessionEvent {
  return { id: ++demo.cursor, sessionId, type, actor, payload, createdAt: Date.now() };
}

export interface CreatedSession { session: Session; candidateToken: string; reportToken: string }

export async function createSession(input: { challenge: Challenge; language: Language; candidateName: string }): Promise<CreatedSession> {
  const variant = getVariant(input.challenge, input.language);
  if (!variant) throw new Error("Unsupported challenge language");
  const id = randomUUID();
  const candidateToken = createToken(24);
  const reportToken = createToken(24);
  const now = Date.now();
  const snapshot: Session = {
    id,
    challenge: structuredClone(input.challenge),
    language: input.language,
    candidateName: input.candidateName,
    createdAt: now,
    updatedAt: now,
    status: "review",
    comments: [], overallNote: "", gradingStatus: "none", fixStatus: "none",
    revision: 0, checkRuns: [],
  };
  const stored: StoredSession = { snapshot, candidateTokenHash: hashToken(candidateToken), candidateTokenCiphertext: sealToken(candidateToken), reportTokenHash: hashToken(reportToken), reportTokenCiphertext: sealToken(reportToken) };
  if (!databaseEnabled()) {
    demo.sessions.set(id, stored);
    demo.events.push(event(id, "session.created", "system", { challengeId: input.challenge.id, language: input.language, candidateName: input.candidateName }));
    return { session: snapshot, candidateToken, reportToken };
  }
  const sql = db();
  const initialEvent = { challengeId: input.challenge.id, language: input.language, candidateName: input.candidateName };
  await sql.transaction((tx) => [
    tx`INSERT INTO sessions (id, candidate_token_hash, candidate_token_ciphertext, report_token_hash, report_token_ciphertext, challenge_id, challenge_version, language, candidate_name, status, revision, snapshot) VALUES (${id}, ${stored.candidateTokenHash}, ${stored.candidateTokenCiphertext}, ${stored.reportTokenHash}, ${stored.reportTokenCiphertext}, ${input.challenge.id}, ${input.challenge.version}, ${input.language}, ${input.candidateName}, 'review', 0, ${JSON.stringify(snapshot)}::jsonb)`,
    ...variant.files.map((file) => tx`INSERT INTO session_files (id, session_id, path, status, base_content, head_content, saved_content) VALUES (${randomUUID()}, ${id}, ${file.path}, ${file.status}, ${file.baseContent}, ${file.headContent}, ${file.savedContent ?? null})`),
    tx`INSERT INTO session_events (session_id, type, actor, payload) VALUES (${id}, 'session.created', 'system', ${JSON.stringify(initialEvent)}::jsonb)`,
  ]);
  return { session: snapshot, candidateToken, reportToken };
}

async function rowById(id: string): Promise<StoredSession | undefined> {
  if (!databaseEnabled()) return demo.sessions.get(id);
  const rows = await db()`SELECT snapshot, candidate_token_hash, candidate_token_ciphertext, report_token_hash, report_token_ciphertext FROM sessions WHERE id = ${id} LIMIT 1`;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? { snapshot: row.snapshot as Session, candidateTokenHash: String(row.candidate_token_hash), candidateTokenCiphertext: row.candidate_token_ciphertext ? String(row.candidate_token_ciphertext) : undefined, reportTokenHash: String(row.report_token_hash), reportTokenCiphertext: String(row.report_token_ciphertext) } : undefined;
}

export async function getCandidateSession(token: string) {
  const digest = hashToken(token);
  if (!databaseEnabled()) return [...demo.sessions.values()].find((item) => item.candidateTokenHash === digest)?.snapshot;
  const rows = await db()`SELECT snapshot FROM sessions WHERE candidate_token_hash = ${digest} LIMIT 1`;
  return rows[0]?.snapshot as Session | undefined;
}

export async function getInterviewerSession(id: string, reportToken: string) {
  const stored = await rowById(id);
  return stored && tokenMatches(reportToken, stored.reportTokenHash) ? stored.snapshot : undefined;
}

export async function getSessionInternal(id: string) { return (await rowById(id))?.snapshot; }

export async function applyWorkflowResult(id: string, basedOnRevision: number, result: { kind: "review"; value: Session["grading"] } | { kind: "fix"; value: Session["fixEvaluation"] }) {
  const stored = await rowById(id); if (!stored || stored.snapshot.revision !== basedOnRevision) return false;
  if (result.kind === "review") { stored.snapshot.grading = result.value; stored.snapshot.gradingStatus = "done"; }
  else { stored.snapshot.fixEvaluation = result.value; stored.snapshot.fixStatus = "done"; }
  await saveSnapshot(stored, "assessment.updated", "ai", { kind: result.kind, final: true, revision: basedOnRevision });
  return true;
}

export async function applyLiveWorkflowResult(id: string, basedOnRevision: number, basedOnEventId: number, value: Pick<LiveAssessment, "evidence" | "summary">) {
  const stored = await rowById(id);
  if (!stored || stored.snapshot.revision !== basedOnRevision || (stored.snapshot.liveAssessment?.basedOnEventId ?? 0) > basedOnEventId) return false;
  const assessment: LiveAssessment = { id: randomUUID(), basedOnEventId, revision: (stored.snapshot.liveAssessment?.revision ?? 0) + 1, status: "done", evidence: value.evidence, summary: value.summary, createdAt: Date.now() };
  stored.snapshot.liveAssessment = assessment;
  await saveSnapshot(stored, "assessment.updated", "ai", { assessment }, [(tx) => tx`INSERT INTO ai_assessments (id, session_id, based_on_event_id, revision, assessment, created_at) VALUES (${assessment.id}, ${id}, ${basedOnEventId}, ${assessment.revision}, ${JSON.stringify(assessment)}::jsonb, ${new Date(assessment.createdAt)})`]);
  return true;
}

export async function listSessions() {
  if (!databaseEnabled()) return [...demo.sessions.values()].sort((a, b) => b.snapshot.createdAt - a.snapshot.createdAt).map((item) => ({ session: item.snapshot, candidateToken: item.candidateTokenCiphertext ? unsealToken(item.candidateTokenCiphertext) : undefined, reportToken: unsealToken(item.reportTokenCiphertext) }));
  const rows = await db()`SELECT snapshot, candidate_token_ciphertext, report_token_ciphertext FROM sessions ORDER BY updated_at DESC LIMIT 100`;
  return rows.map((row) => ({ session: row.snapshot as Session, candidateToken: row.candidate_token_ciphertext ? unsealToken(String(row.candidate_token_ciphertext)) : undefined, reportToken: unsealToken(String(row.report_token_ciphertext)) }));
}

async function saveSnapshot(stored: StoredSession, type: SessionEventType, actor: SessionEvent["actor"], payload: Record<string, unknown>, extraQueries: ((tx: NeonQueryFunctionInTransaction<false, false>) => unknown)[] = []) {
  const snapshot = stored.snapshot;
  snapshot.updatedAt = Date.now();
  if (!databaseEnabled()) {
    demo.sessions.set(snapshot.id, stored);
    demo.events.push(event(snapshot.id, type, actor, payload));
    return demo.events.at(-1)!;
  }
  const sql = db();
  const results = await sql.transaction((tx) => [
    tx`UPDATE sessions SET snapshot = ${JSON.stringify(snapshot)}::jsonb, status = ${snapshot.status}, revision = ${snapshot.revision}, updated_at = now() WHERE id = ${snapshot.id}`,
    ...extraQueries.map((query) => query(tx) as never),
    tx`INSERT INTO session_events (session_id, type, actor, payload) VALUES (${snapshot.id}, ${type}, ${actor}, ${JSON.stringify(payload)}::jsonb) RETURNING id, created_at`,
  ]);
  const created = (results.at(-1) as Array<Record<string, unknown>>)[0];
  return { id: Number(created.id), sessionId: snapshot.id, type, actor, payload, createdAt: new Date(String(created.created_at)).getTime() } satisfies SessionEvent;
}

function validateAnchor(session: Session, file: string, line: number, endLine?: number) {
  const variant = getVariant(session.challenge, session.language);
  const target = variant?.files.find((item) => item.path === file);
  if (!target) return false;
  const count = target.headContent.split("\n").length;
  return line >= 1 && line <= count && (!endLine || (endLine >= line && endLine <= count));
}

export async function addComment(token: string, input: { file: string; line: number; endLine?: number; body: string }) {
  const session = await getCandidateSession(token);
  if (!session || session.status !== "review" || !validateAnchor(session, input.file, input.line, input.endLine)) return undefined;
  const stored = await rowById(session.id);
  if (!stored) return undefined;
  const now = Date.now();
  const comment: ReviewComment = { id: randomUUID(), ...input, body: input.body.trim(), state: "draft", createdAt: now, updatedAt: now };
  stored.snapshot.comments.push(comment);
  const createdEvent = await saveSnapshot(stored, "comment.added", "candidate", { comment }, [
    (tx) => tx`INSERT INTO review_comments (id, session_id, file, line, end_line, body, state, created_at, updated_at) VALUES (${comment.id}, ${session.id}, ${comment.file}, ${comment.line}, ${comment.endLine ?? null}, ${comment.body}, ${comment.state}, ${new Date(now)}, ${new Date(now)})`,
  ]);
  await updateLiveAssessment(stored, createdEvent.id);
  void import("./server/jobs").then(({ queueLiveAssessment }) => queueLiveAssessment(session.id, stored.snapshot.revision, createdEvent.id)).catch(() => undefined);
  return comment;
}

export async function changeComment(token: string, commentId: string, input?: { body: string; endLine?: number }) {
  const session = await getCandidateSession(token);
  if (!session || session.status !== "review") return undefined;
  const stored = await rowById(session.id); if (!stored) return undefined;
  const index = stored.snapshot.comments.findIndex((item) => item.id === commentId && item.state === "draft");
  if (index < 0) return undefined;
  const comment = stored.snapshot.comments[index];
  if (!input) {
    stored.snapshot.comments.splice(index, 1);
    const changed = await saveSnapshot(stored, "comment.deleted", "candidate", { commentId }, [(tx) => tx`DELETE FROM review_comments WHERE id = ${commentId} AND session_id = ${session.id}`]);
    await updateLiveAssessment(stored, changed.id);
    void import("./server/jobs").then(({ queueLiveAssessment }) => queueLiveAssessment(session.id, stored.snapshot.revision, changed.id)).catch(() => undefined);
    return null;
  }
  comment.body = input.body.trim(); comment.endLine = input.endLine; comment.updatedAt = Date.now();
  const changed = await saveSnapshot(stored, "comment.updated", "candidate", { comment }, [(tx) => tx`UPDATE review_comments SET body = ${comment.body}, end_line = ${comment.endLine ?? null}, updated_at = ${new Date(comment.updatedAt)} WHERE id = ${comment.id}`]);
  await updateLiveAssessment(stored, changed.id);
  void import("./server/jobs").then(({ queueLiveAssessment }) => queueLiveAssessment(session.id, stored.snapshot.revision, changed.id)).catch(() => undefined);
  return comment;
}

export async function submitReview(token: string, overallNote: string) {
  const session = await getCandidateSession(token); if (!session || session.status !== "review") return undefined;
  const stored = await rowById(session.id); if (!stored) return undefined;
  const now = Date.now();
  stored.snapshot.comments.forEach((comment) => { comment.state = "submitted"; });
  Object.assign(stored.snapshot, { status: "fixing" as const, overallNote: overallNote.trim(), reviewSubmittedAt: now, gradingStatus: "pending" as const });
  const submitted = await saveSnapshot(stored, "review.submitted", "candidate", { commentCount: stored.snapshot.comments.length });
  await updateLiveAssessment(stored, submitted.id);
  return stored.snapshot;
}

export async function saveRevision(token: string, files: ChallengeFile[]) {
  const session = await getCandidateSession(token); if (!session || session.status !== "fixing") return undefined;
  const variant = getVariant(session.challenge, session.language); if (!variant) return undefined;
  const allowed = new Set(variant.files.map((file) => file.path));
  if (files.length !== variant.files.length || files.some((file) => !allowed.has(file.path) || file.savedContent && file.savedContent.length > 200_000)) return undefined;
  const stored = await rowById(session.id); if (!stored) return undefined;
  const revision: FileRevision = { id: randomUUID(), revision: stored.snapshot.revision + 1, files, createdAt: Date.now() };
  const shouldAssess = revision.createdAt - (stored.snapshot.analysisCheckpointAt ?? 0) >= 30_000;
  stored.snapshot.revision = revision.revision; stored.snapshot.latestRevision = revision; stored.snapshot.fixFiles = files;
  if (shouldAssess) stored.snapshot.analysisCheckpointAt = revision.createdAt;
  const saved = await saveSnapshot(stored, "revision.saved", "candidate", { revisionId: revision.id, revision: revision.revision }, [
    (tx) => tx`INSERT INTO file_revisions (id, session_id, revision, files, created_at) VALUES (${revision.id}, ${session.id}, ${revision.revision}, ${JSON.stringify(files)}::jsonb, ${new Date(revision.createdAt)})`,
  ]);
  await updateLiveAssessment(stored, saved.id);
  if (shouldAssess) void import("./server/jobs").then(({ queueLiveAssessment }) => queueLiveAssessment(session.id, revision.revision, saved.id)).catch(() => undefined);
  return revision;
}

export async function addCheckRun(token: string, run: CheckRun) {
  const session = await getCandidateSession(token); if (!session || session.status !== "fixing") return undefined;
  const stored = await rowById(session.id); if (!stored) return undefined;
  stored.snapshot.checkRuns.unshift(run);
  await saveSnapshot(stored, "check.completed", "system", { checkRunId: run.id, status: run.status }, [(tx) => tx`INSERT INTO check_runs (id, session_id, revision, status, results, created_at, completed_at) VALUES (${run.id}, ${session.id}, ${run.revision}, ${run.status}, ${JSON.stringify(run.results)}::jsonb, ${new Date(run.createdAt)}, ${run.completedAt ? new Date(run.completedAt) : null})`]);
  return run;
}

export async function addCheckRunInternal(id: string, basedOnRevision: number, run: CheckRun) {
  const stored = await rowById(id); if (!stored || stored.snapshot.status !== "fixing" || stored.snapshot.revision !== basedOnRevision) return false;
  stored.snapshot.checkRuns.unshift(run);
  await saveSnapshot(stored, "check.completed", "system", { checkRunId: run.id, status: run.status }, [(tx) => tx`INSERT INTO check_runs (id, session_id, revision, status, results, created_at, completed_at) VALUES (${run.id}, ${id}, ${run.revision}, ${run.status}, ${JSON.stringify(run.results)}::jsonb, ${new Date(run.createdAt)}, ${run.completedAt ? new Date(run.completedAt) : null})`]);
  return true;
}

export async function submitFix(token: string) {
  const session = await getCandidateSession(token); if (!session || session.status !== "fixing") return undefined;
  const stored = await rowById(session.id); if (!stored) return undefined;
  stored.snapshot.status = "completed"; stored.snapshot.fixSubmittedAt = Date.now(); stored.snapshot.fixStatus = "pending";
  await saveSnapshot(stored, "fix.submitted", "candidate", { revision: stored.snapshot.revision });
  return stored.snapshot;
}

export async function updateNote(id: string, reportToken: string, body: string) {
  const session = await getInterviewerSession(id, reportToken); if (!session) return undefined;
  const stored = await rowById(id); if (!stored) return undefined;
  stored.snapshot.interviewerNote = { body: body.slice(0, 20_000), updatedAt: Date.now() };
  await saveSnapshot(stored, "note.updated", "interviewer", {}, [(tx) => tx`INSERT INTO interviewer_notes (session_id, body, updated_at) VALUES (${id}, ${stored.snapshot.interviewerNote!.body}, ${new Date(stored.snapshot.interviewerNote!.updatedAt)}) ON CONFLICT (session_id) DO UPDATE SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at`]);
  return stored.snapshot.interviewerNote;
}

export async function updateRubricDecision(id: string, reportToken: string, decision: Omit<InterviewerRubricDecision, "updatedAt">) {
  const session = await getInterviewerSession(id, reportToken); if (!session) return undefined;
  const stored = await rowById(id); if (!stored) return undefined;
  if (!resolveFindings(stored.snapshot.challenge, stored.snapshot.language).some((finding) => finding.id === decision.findingId)) return undefined;
  const item: InterviewerRubricDecision = { ...decision, note: decision.note.slice(0, 2_000), updatedAt: Date.now() };
  const decisions = stored.snapshot.interviewerDecisions ?? [];
  stored.snapshot.interviewerDecisions = [...decisions.filter((entry) => entry.findingId !== item.findingId), item];
  await saveSnapshot(stored, "rubric.decision.updated", "interviewer", { findingId: item.findingId, verdict: item.verdict, adjustedState: item.adjustedState });
  return item;
}

export async function updateInterviewDecision(id: string, reportToken: string, decision: Omit<InterviewDecision, "updatedAt">) {
  const session = await getInterviewerSession(id, reportToken); if (!session || session.status !== "completed") return undefined;
  const stored = await rowById(id); if (!stored) return undefined;
  const item: InterviewDecision = { ...decision, note: decision.note.slice(0, 10_000), updatedAt: Date.now() };
  stored.snapshot.interviewDecision = item;
  await saveSnapshot(stored, "interview.decision.updated", "interviewer", { outcome: item.outcome });
  return item;
}

async function updateLiveAssessment(stored: StoredSession, basedOnEventId: number) {
  const findings = resolveFindings(stored.snapshot.challenge, stored.snapshot.language);
  const latestRevision = stored.snapshot.latestRevision;
  const evidence = findings.map((finding) => {
    const comments = stored.snapshot.comments.filter((comment) => comment.file === finding.file && Math.abs(comment.line - finding.line) <= 4);
    const changed = latestRevision?.files.some((file) => file.path === finding.file && (file.savedContent ?? file.headContent) !== file.headContent) ?? false;
    return { findingId: finding.id, state: comments.length ? "caught" as const : changed ? "developing" as const : "not-discussed" as const, confidence: comments.length ? "high" as const : changed ? "low" as const : "low" as const, commentIds: comments.map((comment) => comment.id), revisionIds: changed && latestRevision ? [latestRevision.id] : [], checkRunIds: [], note: comments.length ? "Candidate review comment is anchored near this finding." : changed ? "Candidate edited the affected file; intent is still being assessed." : "No evidence yet." };
  });
  const assessment: LiveAssessment = { id: randomUUID(), basedOnEventId, revision: (stored.snapshot.liveAssessment?.revision ?? 0) + 1, status: "done", evidence, summary: `${evidence.filter((item) => item.state === "caught").length} of ${evidence.length} rubric areas currently have direct review evidence.`, createdAt: Date.now() };
  stored.snapshot.liveAssessment = assessment;
  await saveSnapshot(stored, "assessment.updated", "ai", { assessment }, [(tx) => tx`INSERT INTO ai_assessments (id, session_id, based_on_event_id, revision, assessment, created_at) VALUES (${assessment.id}, ${stored.snapshot.id}, ${basedOnEventId}, ${assessment.revision}, ${JSON.stringify(assessment)}::jsonb, ${new Date(assessment.createdAt)})`]);
}

export async function getEvents(id: string, reportToken: string, afterId: number) {
  if (!await getInterviewerSession(id, reportToken)) return undefined;
  if (!databaseEnabled()) return demo.events.filter((item) => item.sessionId === id && item.id > afterId).slice(0, 100);
  const rows = await db()`SELECT id, session_id, type, actor, payload, created_at FROM session_events WHERE session_id = ${id} AND id > ${afterId} ORDER BY id ASC LIMIT 100`;
  return rows.map((row) => ({ id: Number(row.id), sessionId: String(row.session_id), type: row.type, actor: row.actor, payload: row.payload, createdAt: new Date(String(row.created_at)).getTime() } as SessionEvent));
}
