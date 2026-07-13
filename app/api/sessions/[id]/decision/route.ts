import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInterviewerSession, updateInterviewDecision } from "@/lib/store";
import { acceptsJson, isSameOrigin } from "@/lib/server/request-security";

const schema = z.object({
  key: z.string().min(20).max(100),
  outcome: z.enum(["strong-yes", "yes", "mixed", "no", "strong-no"]),
  note: z.string().trim().min(1).max(10_000),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req) || !acceptsJson(req)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an outcome and add a decision note" }, { status: 400 });
  const { id } = await params;
  const session = await getInterviewerSession(id, parsed.data.key);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "completed") return NextResponse.json({ error: "The interview must be completed first" }, { status: 409 });
  const { key, ...input } = parsed.data;
  const decision = await updateInterviewDecision(id, key, input);
  return decision ? NextResponse.json({ decision }) : NextResponse.json({ error: "Unable to save decision" }, { status: 500 });
}
