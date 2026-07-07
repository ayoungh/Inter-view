import { NextRequest, NextResponse } from "next/server";
import { getChallenge, getVariant } from "@/lib/challenges";
import { getSession, newId } from "@/lib/store";
import type { ReviewComment } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "review") {
    return NextResponse.json(
      { error: "The review phase is over" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const file = body?.file as string | undefined;
  const line = Number(body?.line);
  const text = ((body?.body as string) ?? "").trim();

  const challenge = getChallenge(session.challengeId);
  const variant = challenge && getVariant(challenge, session.language);
  const targetFile = variant?.files.find((f) => f.path === file);
  const lineCount = targetFile ? targetFile.content.split("\n").length : 0;

  if (!targetFile || !text || !Number.isInteger(line) || line < 1 || line > lineCount) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Comment too long" }, { status: 400 });
  }

  const comment: ReviewComment = {
    id: newId(),
    file: targetFile.path,
    line,
    body: text,
    createdAt: Date.now(),
  };
  session.comments.push(comment);

  return NextResponse.json({ comment });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "review") {
    return NextResponse.json(
      { error: "The review phase is over" },
      { status: 409 },
    );
  }

  const commentId = req.nextUrl.searchParams.get("commentId");
  const before = session.comments.length;
  session.comments = session.comments.filter((c) => c.id !== commentId);
  if (session.comments.length === before) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
