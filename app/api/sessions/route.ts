import { NextRequest, NextResponse } from "next/server";
import { isInterviewerRequest } from "@/lib/auth";
import { challenges, getChallenge, getVariant } from "@/lib/challenges";
import { createSession, listSessions } from "@/lib/store";
import type { Language } from "@/lib/types";

export async function POST(req: NextRequest) {
  if (!isInterviewerRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const challengeId = body?.challengeId as string | undefined;
  const language = body?.language as Language | undefined;
  const candidateName = ((body?.candidateName as string) ?? "").trim();

  const challenge = challengeId ? getChallenge(challengeId) : undefined;
  if (!challenge || !language || !getVariant(challenge, language)) {
    return NextResponse.json(
      { error: "Unknown challenge or unsupported language" },
      { status: 400 },
    );
  }

  const session = createSession({
    challengeId: challenge.id,
    language,
    candidateName: candidateName || "Candidate",
  });

  return NextResponse.json({
    id: session.id,
    interviewerKey: session.interviewerKey,
  });
}

export async function GET(req: NextRequest) {
  if (!isInterviewerRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = listSessions().map((s) => {
    const challenge = getChallenge(s.challengeId);
    return {
      id: s.id,
      interviewerKey: s.interviewerKey,
      challengeId: s.challengeId,
      challengeTitle: challenge?.title ?? s.challengeId,
      language: s.language,
      candidateName: s.candidateName,
      createdAt: s.createdAt,
      status: s.status,
      commentCount: s.comments.length,
      gradingStatus: s.gradingStatus,
      fixStatus: s.fixStatus,
      score: s.grading?.score ?? null,
    };
  });
  return NextResponse.json({ sessions, challenges: challenges.map((c) => c.id) });
}
