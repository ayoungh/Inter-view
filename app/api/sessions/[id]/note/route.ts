import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateNote } from "@/lib/store";
import { acceptsJson, isSameOrigin } from "@/lib/server/request-security";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { if (!isSameOrigin(req) || !acceptsJson(req)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); const parsed = z.object({ body: z.string().max(20_000), key: z.string().min(20).max(100) }).safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid note" }, { status: 400 }); const note = await updateNote((await params).id, parsed.data.key, parsed.data.body); return note ? NextResponse.json({ note }) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
