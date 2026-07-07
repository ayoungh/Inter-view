import type {
  ChallengeFile,
  Language,
  ReviewComment,
  SessionStatus,
} from "./types";

/** Shape returned by GET /api/sessions/:id for the candidate (no findings/grading). */
export interface CandidateSession {
  id: string;
  status: SessionStatus;
  language: Language;
  candidateName: string;
  challenge: {
    id: string;
    title: string;
    prTitle: string;
    prDescription: string;
    fixInstructions: string;
  };
  files: ChallengeFile[];
  comments: ReviewComment[];
  overallNote: string;
  fixFiles: ChallengeFile[] | null;
}
