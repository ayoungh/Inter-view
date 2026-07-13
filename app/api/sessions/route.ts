import { NextRequest, NextResponse } from "next/server";
import { isInterviewerRequest } from "@/lib/auth";
import { challenges, getChallenge, getVariant } from "@/lib/challenges";
import { createSession, listSessions } from "@/lib/store";
import { acceptsJson, isSameOrigin } from "@/lib/server/request-security";
import type { Language } from "@/lib/types";
import { z } from "zod";

const createSchema = z.object({ challengeId: z.string().max(80), language: z.enum(["javascript", "typescript", "python"]), candidateName: z.string().trim().min(2).max(100) });

export async function POST(req: NextRequest) {
  if (!isInterviewerRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSameOrigin(req) || !acceptsJson(req)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session details" }, { status: 400 });
  const { challengeId, language } = parsed.data;
  const candidateName = parsed.data.candidateName;

  const challenge = challengeId ? getChallenge(challengeId) : undefined;
  if (!challenge || !language || !getVariant(challenge, language)) {
    return NextResponse.json(
      { error: "Unknown challenge or unsupported language" },
      { status: 400 },
    );
  }

  const created = await createSession({ challenge, language: language as Language, candidateName });
  const origin = req.nextUrl.origin;

  return NextResponse.json({
    id: created.session.id,
    candidateUrl: `${origin}/review/${created.candidateToken}`,
    reportUrl: `${origin}/report/${created.session.id}?key=${created.reportToken}`,
  });
}

export async function GET(req: NextRequest) {
  if (!isInterviewerRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = (await listSessions()).map(({ session: s, candidateToken, reportToken }) => {
    const challenge = s.challenge;
    return {
      id: s.id,
      reportUrl: `${req.nextUrl.origin}/report/${s.id}?key=${reportToken}`,
      candidateUrl: candidateToken ? `${req.nextUrl.origin}/review/${candidateToken}` : null,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      difficulty: challenge.difficulty,
      language: s.language,
      candidateName: s.candidateName,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt ?? s.createdAt,
      status: s.status,
      commentCount: s.comments.length,
      gradingStatus: s.gradingStatus,
      fixStatus: s.fixStatus,
      score: s.grading?.score ?? null,
      evidenceCaught: s.liveAssessment?.evidence.filter((item) => item.state === "caught").length ?? 0,
      evidenceTotal: challenge.findings.length,
      decisionOutcome: s.interviewDecision?.outcome ?? null,
    };
  });
  return NextResponse.json({ sessions: items, challenges: challenges.map((c) => c.id) });
}
