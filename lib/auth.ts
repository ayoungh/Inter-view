import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const INTERVIEWER_AUTH_COOKIE = "interview_interviewer_auth";

export function getInterviewerPassword(): string | null {
  return process.env.INTERVIEWER_PASSWORD ?? null;
}

export function createInterviewerSessionValue(): string | null {
  const password = getInterviewerPassword();
  return password ? createHmac("sha256", password).update("inter-view:interviewer-session:v2").digest("base64url") : null;
}

export function isValidInterviewerPassword(password: string): boolean {
  const expected = getInterviewerPassword();
  if (!expected) return false;
  const actualBytes = Buffer.from(password);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function isInterviewerRequest(req: NextRequest): boolean {
  const expected = createInterviewerSessionValue();
  if (!expected) return false;
  const actual = req.cookies.get(INTERVIEWER_AUTH_COOKIE)?.value ?? "";
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
