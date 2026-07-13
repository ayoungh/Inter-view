import { describe, expect, it } from "vitest";
import { parseCursor, serializeEvent } from "@/lib/sse";
describe("SSE cursor replay", () => { it("uses the newest reconnect cursor and emits valid frames", () => { expect(parseCursor("12", "9")).toBe(12); expect(parseCursor("bad", "7")).toBe(7); expect(serializeEvent(13,"comment.added",{id:"c1"})).toBe('id: 13\nevent: comment.added\ndata: {"id":"c1"}\n\n'); }); });
