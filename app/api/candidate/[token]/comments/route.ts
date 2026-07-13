import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addComment, changeComment } from "@/lib/store";
import { acceptsJson } from "@/lib/server/request-security";

const commentSchema = z.object({ file: z.string().max(240), line: z.number().int().positive(), endLine: z.number().int().positive().optional(), body: z.string().trim().min(1).max(5000) });
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!acceptsJson(req)) return NextResponse.json({ error: "JSON required" }, { status: 415 });
  const parsed = commentSchema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  const comment = await addComment((await params).token, parsed.data); return comment ? NextResponse.json({ comment }, { status: 201 }) : NextResponse.json({ error: "Comment cannot be added" }, { status: 409 });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const parsed = z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(5000), endLine: z.number().int().positive().optional() }).safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  const comment = await changeComment((await params).token, parsed.data.id, parsed.data); return comment ? NextResponse.json({ comment }) : NextResponse.json({ error: "Comment not found" }, { status: 404 });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const id = req.nextUrl.searchParams.get("id"); if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  const result = await changeComment((await params).token, id); return result === undefined ? NextResponse.json({ error: "Comment not found" }, { status: 404 }) : NextResponse.json({ ok: true });
}
