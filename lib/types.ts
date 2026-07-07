export type Language = "javascript" | "typescript" | "python";

export const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: "JavaScript (Node.js)",
  typescript: "TypeScript (Node.js)",
  python: "Python",
};

export interface ChallengeFile {
  path: string;
  content: string;
}

export type FindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "design"
  | "style";

export type FindingSeverity = "critical" | "major" | "minor";

/** A defect we planted in the code and expect the candidate to spot. */
export interface FindingDef {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  severity: FindingSeverity;
}

/** Where a finding lives inside a specific language variant. */
export interface FindingAnchor {
  file: string;
  /** Unique substring of the buggy line; resolved to a line number at load time. */
  anchor: string;
}

export interface ChallengeVariant {
  language: Language;
  files: ChallengeFile[];
  anchors: Record<string, FindingAnchor>;
}

export interface Challenge {
  id: string;
  title: string;
  summary: string;
  prTitle: string;
  prDescription: string;
  fixInstructions: string;
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
  body: string;
  createdAt: number;
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

export interface Session {
  id: string;
  interviewerKey: string;
  challengeId: string;
  language: Language;
  candidateName: string;
  createdAt: number;
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
}
