import { NextRequest, NextResponse } from "next/server";
import { isInterviewerRequest } from "@/lib/auth";
import { getChallenge, getVariant, resolveFindings } from "@/lib/challenges";
import { getSession } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/:id            -> candidate payload (no findings/grading)
 * GET /api/sessions/:id?key=...    -> full interviewer payload
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const challenge = getChallenge(session.challengeId);
  const variant = challenge && getVariant(challenge, session.language);
  if (!challenge || !variant) {
    return NextResponse.json({ error: "Challenge missing" }, { status: 500 });
  }

  const key = req.nextUrl.searchParams.get("key");
  const hasReportKey = key === session.interviewerKey;
  const isInterviewer = hasReportKey && isInterviewerRequest(req);

  const base = {
    id: session.id,
    status: session.status,
    language: session.language,
    candidateName: session.candidateName,
    challenge: {
      id: challenge.id,
      title: challenge.title,
      prTitle: challenge.prTitle,
      prDescription: challenge.prDescription,
      fixInstructions: challenge.fixInstructions,
    },
    files: variant.files,
    comments: session.comments,
    overallNote: session.overallNote,
    fixFiles: session.fixFiles ?? null,
  };

  if (!hasReportKey) {
    return NextResponse.json(base);
  }

  if (!isInterviewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ...base,
    createdAt: session.createdAt,
    reviewSubmittedAt: session.reviewSubmittedAt ?? null,
    fixSubmittedAt: session.fixSubmittedAt ?? null,
    findings: resolveFindings(challenge, session.language),
    gradingStatus: session.gradingStatus,
    grading: session.grading ?? null,
    gradingError: session.gradingError ?? null,
    fixStatus: session.fixStatus,
    fixEvaluation: session.fixEvaluation ?? null,
    fixError: session.fixError ?? null,
  });
}
