import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getChallenge, getVariant, resolveFindings } from "@/lib/challenges";
import { evaluateFix } from "@/lib/grading";
import { getSession, updateSession } from "@/lib/store";
import type { ChallengeFile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 300;

/** Candidate submits their fixed code: locks the session, kicks off AI evaluation. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "fixing") {
    return NextResponse.json(
      { error: "Session is not in the fix phase" },
      { status: 409 },
    );
  }

  const challenge = getChallenge(session.challengeId);
  const variant = challenge && getVariant(challenge, session.language);
  if (!challenge || !variant) {
    return NextResponse.json({ error: "Challenge missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const files = body?.files as ChallengeFile[] | undefined;
  const validPaths = new Set(variant.files.map((f) => f.path));
  const ok =
    Array.isArray(files) &&
    files.length === variant.files.length &&
    files.every(
      (f) =>
        validPaths.has(f?.path) &&
        typeof f?.content === "string" &&
        f.content.length <= 100_000,
    );
  if (!ok) {
    return NextResponse.json({ error: "Invalid files payload" }, { status: 400 });
  }

  updateSession(id, {
    fixFiles: files,
    status: "completed",
    fixSubmittedAt: Date.now(),
    fixStatus: "pending",
    fixError: undefined,
  });

  after(async () => {
    try {
      const fixEvaluation = await evaluateFix(
        session,
        challenge,
        variant,
        resolveFindings(challenge, session.language),
      );
      updateSession(id, { fixEvaluation, fixStatus: "done" });
    } catch (err) {
      updateSession(id, {
        fixStatus: "error",
        fixError: err instanceof Error ? err.message : "Evaluation failed",
      });
    }
  });

  return NextResponse.json({ ok: true, status: "completed" });
}
