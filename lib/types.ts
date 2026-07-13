export type Language = "javascript" | "typescript" | "python";

export const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: "JavaScript (Node.js)",
  typescript: "TypeScript (Node.js)",
  python: "Python",
};

export type Difficulty = "mid" | "senior";
export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface ChallengeFile {
  path: string;
  status: FileStatus;
  baseContent: string;
  headContent: string;
  savedContent?: string;
  previousPath?: string;
}

export type FindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "design"
  | "style"
  | "testing"
  | "accessibility";

export type FindingSeverity = "critical" | "major" | "minor";

export interface FindingDef {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  severity: FindingSeverity;
  interviewerPrompts?: string[];
}

export interface FindingAnchor {
  file: string;
  anchor: string;
}

export interface CheckDefinition {
  id: string;
  name: string;
  command: string;
  visibility: "visible" | "hidden";
  category: string;
  files: Array<{ path: string; content: string }>;
}

export interface ChallengeRuntime {
  runtime: "node22" | "python3.13";
  testCommand: string;
  timeoutMs: number;
  outputLimitBytes: number;
  snapshotId?: string;
}

export interface ChallengeMetadata {
  repository: string;
  owner: string;
  baseBranch: string;
  headBranch: string;
  prNumber: number;
  author: string;
}

export interface ChallengeVariant {
  language: Language;
  runtime: ChallengeRuntime;
  files: ChallengeFile[];
  anchors: Record<string, FindingAnchor>;
  checks: CheckDefinition[];
  referenceFiles: ChallengeFile[];
}

export interface Challenge {
  id: string;
  version: number;
  difficulty: Difficulty;
  estimatedMinutes: number;
  competencies: string[];
  title: string;
  summary: string;
  prTitle: string;
  prDescription: string;
  fixInstructions: string;
  metadata: ChallengeMetadata;
  findings: FindingDef[];
  variants: Partial<Record<Language, ChallengeVariant>>;
}

export interface ResolvedFinding extends FindingDef {
  file: string;
  line: number;
}

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  body: string;
  state: "draft" | "submitted";
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = "review" | "fixing" | "completed";
export type JobStatus = "none" | "pending" | "done" | "error";

export interface FindingMatch {
  findingId: string;
  quality: "full" | "partial" | "missed";
  matchedCommentIds: string[];
  note: string;
}

export interface ExtraCommentAssessment {
  commentId: string;
  assessment: "valid-insight" | "neutral" | "incorrect";
  note: string;
}

export interface GradingResult {
  matches: FindingMatch[];
  extraComments: ExtraCommentAssessment[];
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface FixFindingResult {
  findingId: string;
  status: "fixed" | "partially-fixed" | "not-fixed";
  note: string;
}

export interface FixEvaluation {
  findings: FixFindingResult[];
  regressions: string[];
  score: number;
  summary: string;
}

export type RubricState =
  | "not-discussed"
  | "developing"
  | "caught"
  | "partial"
  | "contradicted";

export type AssessmentConfidence = "low" | "medium" | "high";

export interface RubricEvidence {
  findingId: string;
  state: RubricState;
  confidence: AssessmentConfidence;
  commentIds: string[];
  revisionIds: string[];
  checkRunIds: string[];
  note: string;
}

export interface LiveAssessment {
  id: string;
  basedOnEventId: number;
  revision: number;
  status: JobStatus;
  evidence: RubricEvidence[];
  summary: string;
  createdAt: number;
}

export interface FileRevision {
  id: string;
  revision: number;
  files: ChallengeFile[];
  createdAt: number;
}

export interface CheckResult {
  checkId: string;
  name: string;
  category: string;
  visibility: "visible" | "hidden";
  status: "passed" | "failed" | "error";
  output: string;
  durationMs: number;
}

export interface CheckRun {
  id: string;
  revision: number;
  status: "pending" | "running" | "passed" | "failed" | "error";
  results: CheckResult[];
  createdAt: number;
  completedAt?: number;
}

export type SessionEventType =
  | "session.created"
  | "comment.added"
  | "comment.updated"
  | "comment.deleted"
  | "review.submitted"
  | "revision.saved"
  | "check.started"
  | "check.completed"
  | "assessment.updated"
  | "fix.submitted"
  | "note.updated"
  | "rubric.decision.updated"
  | "interview.decision.updated";

export interface SessionEvent {
  id: number;
  sessionId: string;
  type: SessionEventType;
  actor: "candidate" | "interviewer" | "system" | "ai";
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface InterviewerNote {
  body: string;
  updatedAt: number;
}

export type InterviewerDecisionVerdict = "confirmed" | "adjusted" | "insufficient";

export interface InterviewerRubricDecision {
  findingId: string;
  verdict: InterviewerDecisionVerdict;
  adjustedState?: RubricState;
  note: string;
  updatedAt: number;
}

export type InterviewOutcome = "strong-yes" | "yes" | "mixed" | "no" | "strong-no";

export interface InterviewDecision {
  outcome: InterviewOutcome;
  note: string;
  updatedAt: number;
}

export interface SessionSnapshot {
  id: string;
  challenge: Challenge;
  language: Language;
  candidateName: string;
  createdAt: number;
  updatedAt?: number;
  status: SessionStatus;
  comments: ReviewComment[];
  overallNote: string;
  reviewSubmittedAt?: number;
  gradingStatus: JobStatus;
  grading?: GradingResult;
  gradingError?: string;
  fixFiles?: ChallengeFile[];
  fixSubmittedAt?: number;
  fixStatus: JobStatus;
  fixEvaluation?: FixEvaluation;
  fixError?: string;
  revision: number;
  analysisCheckpointAt?: number;
  latestRevision?: FileRevision;
  checkRuns: CheckRun[];
  liveAssessment?: LiveAssessment;
  interviewerNote?: InterviewerNote;
  interviewerDecisions?: InterviewerRubricDecision[];
  interviewDecision?: InterviewDecision;
}

/** Server-side grading input. Access tokens are deliberately not part of it. */
export type Session = SessionSnapshot;
