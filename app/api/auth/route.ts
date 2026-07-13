import { NextRequest, NextResponse } from "next/server";
import {
  createInterviewerSessionValue,
  INTERVIEWER_AUTH_COOKIE,
  isValidInterviewerPassword,
} from "@/lib/auth";
import { acceptsJson, isSameOrigin } from "@/lib/server/request-security";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req) || !acceptsJson(req)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const password = (body?.password as string | undefined) ?? "";
  const sessionValue = createInterviewerSessionValue();

  if (!sessionValue) {
    return NextResponse.json(
      { error: "INTERVIEWER_PASSWORD is not configured." },
      { status: 503 },
    );
  }

  if (!isValidInterviewerPassword(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(INTERVIEWER_AUTH_COOKIE, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INTERVIEWER_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
