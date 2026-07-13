import { NextRequest, NextResponse } from "next/server";
import { getInterviewerSession } from "@/lib/store";
import { getVariant, resolveFindings } from "@/lib/challenges";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const key = req.nextUrl.searchParams.get("key") ?? "";
  const session = await getInterviewerSession(id, key); if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const variant = getVariant(session.challenge, session.language); if (!variant) return NextResponse.json({ error: "Invalid snapshot" }, { status: 500 });
  return NextResponse.json({ ...session, files: variant.files, findings: resolveFindings(session.challenge, session.language) }, { headers: { "Cache-Control": "no-store" } });
}
