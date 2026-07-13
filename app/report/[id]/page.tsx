"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { ChallengeFile, Session, SessionEvent, ResolvedFinding } from "@/lib/types";
import { ReportView } from "@/components/ReportView";

export interface InterviewerSession extends Session { files: ChallengeFile[]; findings: ResolvedFinding[] }
export default function ReportPage() { return <Suspense fallback={<p className="p-10 text-sm text-neutral-500">Loading live review…</p>}><Report/></Suspense>; }
function Report() {
  const { id } = useParams<{ id: string }>(); const key = useSearchParams().get("key") ?? ""; const [session, setSession] = useState<InterviewerSession | null>(null); const [events, setEvents] = useState<SessionEvent[]>([]); const [error, setError] = useState(""); const cursor = useRef(0);
  const load = useCallback(async () => { const res = await fetch(`/api/sessions/${id}?key=${encodeURIComponent(key)}`, { cache: "no-store" }); if (!res.ok) { setError(res.status === 404 ? "This report link is invalid or has expired." : "Failed to load the interview."); return; } setSession(await res.json()); setError(""); }, [id,key]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    let source: EventSource | null = null; let fallback: ReturnType<typeof setInterval> | null = null; let stopped = false;
    function connect() { if (stopped) return; source = new EventSource(`/api/sessions/${id}/events?key=${encodeURIComponent(key)}&cursor=${cursor.current}`); const types = ["session.created","comment.added","comment.updated","comment.deleted","review.submitted","revision.saved","check.completed","assessment.updated","fix.submitted","note.updated","rubric.decision.updated","interview.decision.updated"]; types.forEach((type) => source?.addEventListener(type, (message) => { const item = JSON.parse((message as MessageEvent).data) as SessionEvent; cursor.current = Math.max(cursor.current, item.id); setEvents((items) => [...items.filter((e) => e.id !== item.id), item].slice(-200)); void load(); })); source.addEventListener("rotate", () => { source?.close(); setTimeout(connect, 200); }); source.onerror = () => { source?.close(); if (!fallback) fallback = setInterval(() => void load(), 4_000); setTimeout(connect, 3_000); }; }
    connect(); return () => { stopped = true; source?.close(); if (fallback) clearInterval(fallback); };
  }, [id,key,load]);
  if (error) return <main className="empty-tab"><h1>Can&apos;t open live review</h1><p>{error}</p></main>;
  if (!session) return <p className="p-10 text-sm text-neutral-500">Connecting to live session…</p>;
  return <ReportView session={session} reportKey={key} events={events}/>;
}
