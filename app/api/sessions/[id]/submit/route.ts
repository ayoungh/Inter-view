import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getChallenge, getVariant, resolveFindings } from "@/lib/challenges";
import { gradeReview } from "@/lib/grading";
import { getSession, updateSession } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 300;

/** Candidate submits their review: locks comments, kicks off AI grading, moves to the fix phase. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "review") {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const overallNote = ((body?.overallNote as string) ?? "").slice(0, 8000);

  updateSession(id, {
    overallNote,
    status: "fixing",
    reviewSubmittedAt: Date.now(),
    gradingStatus: "pending",
    gradingError: undefined,
  });

  // Grade in the background after the response is sent; the report page polls.
  after(async () => {
    const challenge = getChallenge(session.challengeId);
    const variant = challenge && getVariant(challenge, session.language);
    if (!challenge || !variant) {
      updateSession(id, { gradingStatus: "error", gradingError: "Challenge missing" });
      return;
    }
    try {
      const grading = await gradeReview(
        session,
        challenge,
        variant,
        resolveFindings(challenge, session.language),
      );
      updateSession(id, { grading, gradingStatus: "done" });
    } catch (err) {
      updateSession(id, {
        gradingStatus: "error",
        gradingError: err instanceof Error ? err.message : "Grading failed",
      });
    }
  });

  return NextResponse.json({ ok: true, status: "fixing" });
}
