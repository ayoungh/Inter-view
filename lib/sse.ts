export function serializeEvent(id: number, type: string, payload: unknown) { return `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; }
export function parseCursor(header: string | null, query: string | null) { const h = Number(header ?? 0); const q = Number(query ?? 0); return Math.max(Number.isFinite(h) ? h : 0, Number.isFinite(q) ? q : 0); }
