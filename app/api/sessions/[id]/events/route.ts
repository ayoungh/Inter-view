import { NextRequest } from "next/server";
import { getEvents, getInterviewerSession } from "@/lib/store";
import { parseCursor, serializeEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
const encoder = new TextEncoder();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!await getInterviewerSession(id, key)) return new Response("Not found", { status: 404 });
  let cursor = parseCursor(req.headers.get("last-event-id"), req.nextUrl.searchParams.get("cursor"));
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now(); let heartbeat = Date.now();
      try {
        while (Date.now() - started < 50_000 && !req.signal.aborted) {
          const events = await getEvents(id, key, cursor); if (!events) break;
          for (const item of events) { controller.enqueue(encoder.encode(serializeEvent(item.id, item.type, item))); cursor = item.id; }
          if (Date.now() - heartbeat >= 15_000) { controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`)); heartbeat = Date.now(); }
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        controller.enqueue(encoder.encode(`event: rotate\ndata: {"cursor":${cursor}}\n\n`));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
