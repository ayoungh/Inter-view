import type { NextRequest } from "next/server";

export const INTERVIEWER_AUTH_COOKIE = "interview_interviewer_auth";

export function getInterviewerPassword(): string | null {
  return process.env.INTERVIEWER_PASSWORD ?? null;
}

export function createInterviewerSessionValue(): string | null {
  return getInterviewerPassword();
}

export function isValidInterviewerPassword(password: string): boolean {
  const expected = getInterviewerPassword();
  if (!expected) return false;
  return password === expected;
}

export function isInterviewerRequest(req: NextRequest): boolean {
  const expected = createInterviewerSessionValue();
  if (!expected) return false;
  return req.cookies.get(INTERVIEWER_AUTH_COOKIE)?.value === expected;
}
