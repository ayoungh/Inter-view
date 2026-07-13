import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitReview } from "@/lib/store";
import { queueFinalAssessment } from "@/lib/server/jobs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) { const parsed = z.object({ overallNote: z.string().max(10_000).default("") }).safeParse(await req.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: "Invalid review" }, { status: 400 }); const session = await submitReview((await params).token, parsed.data.overallNote); if (session) await queueFinalAssessment(session.id, session.revision, "review").catch(() => undefined); return session ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Review cannot be submitted" }, { status: 409 }); }
