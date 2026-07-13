import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveRevision } from "@/lib/store";
const fileSchema = z.object({ path: z.string().max(240), status: z.enum(["added", "modified", "deleted", "renamed"]), baseContent: z.string().max(200_000), headContent: z.string().max(200_000), savedContent: z.string().max(200_000).optional(), previousPath: z.string().max(240).optional() });
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) { const parsed = z.object({ files: z.array(fileSchema).min(1).max(20) }).safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid revision" }, { status: 400 }); const revision = await saveRevision((await params).token, parsed.data.files); return revision ? NextResponse.json({ revision }) : NextResponse.json({ error: "Revision cannot be saved" }, { status: 409 }); }
