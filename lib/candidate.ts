import { getVariant } from "./challenges";
import type { ChallengeFile, CheckRun, Language, ReviewComment, Session, SessionStatus } from "./types";

export interface CandidateSession {
  status: SessionStatus; language: Language; candidateName: string;
  challenge: { id: string; title: string; summary: string; prTitle: string; prDescription: string; fixInstructions: string; metadata: Session["challenge"]["metadata"] };
  files: ChallengeFile[]; comments: ReviewComment[]; overallNote: string;
  fixFiles: ChallengeFile[] | null; revision: number; checkRuns: CheckRun[];
}

/** Explicit allow-list: findings, anchors, hidden checks, reference fixes, AI and notes never cross this boundary. */
export function toCandidateSession(session: Session): CandidateSession {
  const variant = getVariant(session.challenge, session.language);
  if (!variant) throw new Error("Session challenge snapshot is invalid");
  return {
    status: session.status, language: session.language, candidateName: session.candidateName,
    challenge: { id: session.challenge.id, title: session.challenge.title, summary: session.challenge.summary, prTitle: session.challenge.prTitle, prDescription: session.challenge.prDescription, fixInstructions: session.challenge.fixInstructions, metadata: session.challenge.metadata },
    files: variant.files.map(({ path, status, baseContent, headContent, previousPath }) => ({ path, status, baseContent, headContent, previousPath })),
    comments: session.comments, overallNote: session.overallNote, fixFiles: session.fixFiles ?? null,
    revision: session.revision, checkRuns: session.checkRuns.map((run) => ({ ...run, results: run.results.map((result) => result.visibility === "hidden" ? { ...result, output: result.status === "passed" ? "Hidden acceptance checks passed." : `Hidden ${result.category} checks failed.` } : result) })),
  };
}
