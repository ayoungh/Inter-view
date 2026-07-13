import { NextResponse } from "next/server";
import { toCandidateSession } from "@/lib/candidate";
import { getCandidateSession } from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getCandidateSession(token);
  return session ? NextResponse.json(toCandidateSession(session), { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Session not found" }, { status: 404 });
}
