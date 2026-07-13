import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateRubricDecision } from "@/lib/store";
import { acceptsJson, isSameOrigin } from "@/lib/server/request-security";

const schema = z.object({
  key: z.string().min(20).max(100),
  findingId: z.string().min(1).max(120),
  verdict: z.enum(["confirmed", "adjusted", "insufficient"]),
  adjustedState: z.enum(["not-discussed", "developing", "caught", "partial", "contradicted"]).optional(),
  note: z.string().max(2_000).default(""),
}).refine((value) => value.verdict !== "adjusted" || value.adjustedState, {
  message: "Adjusted decisions require a rubric state",
  path: ["adjustedState"],
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req) || !acceptsJson(req)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid rubric decision" }, { status: 400 });
  const { key, ...input } = parsed.data;
  const decision = await updateRubricDecision((await params).id, key, input);
  return decision ? NextResponse.json({ decision }) : NextResponse.json({ error: "Session or finding not found" }, { status: 404 });
}
