"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { LANGUAGE_LABELS, type InterviewOutcome, type JobStatus, type Language, type SessionStatus } from "@/lib/types";

interface SessionRow {
  id: string;
  reportUrl: string;
  candidateUrl: string | null;
  challengeTitle: string;
  language: Language;
  candidateName: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  commentCount: number;
  gradingStatus: JobStatus;
  fixStatus: JobStatus;
  score: number | null;
  evidenceCaught: number;
  evidenceTotal: number;
  decisionOutcome: InterviewOutcome | null;
}

const STATUS_LABELS: Record<SessionStatus, string> = { review: "Reviewing", fixing: "Implementing", completed: "Completed" };

export function SessionList() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) throw new Error("Could not load interviews");
        const data = await res.json();
        if (!cancelled) { setSessions(data.sessions); setError(""); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load interviews");
      }
    }
    const handleSessionsChanged = () => void load();
    void load();
    const interval = setInterval(() => void load(), 5_000);
    window.addEventListener("sessions-changed", handleSessionsChanged);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("sessions-changed", handleSessionsChanged); };
  }, []);

  async function copyCandidate(session: SessionRow) {
    if (!session.candidateUrl) return;
    try {
      await navigator.clipboard.writeText(session.candidateUrl);
      setCopiedId(session.id);
      setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setError("Clipboard access failed. Open the session to retrieve the link.");
    }
  }

  if (!sessions && !error) return <p className="text-sm text-neutral-500" role="status">Loading interviews…</p>;
  if (error && !sessions) return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>;
  if (!sessions?.length) return <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">No interviews yet — create one above.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700"><p className="text-sm text-neutral-500">Sorted by recent activity</p>{error ? <span className="text-sm text-amber-600" role="status">Refresh delayed</span> : null}</div>
      <table className="w-full min-w-[940px] text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950"><tr><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Challenge</th><th className="px-4 py-3">Phase</th><th className="px-4 py-3">Last activity</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{sessions.map((session) => <tr key={session.id} className="border-t border-neutral-200 align-middle dark:border-neutral-700">
          <td className="px-4 py-3"><strong className="block font-medium">{session.candidateName}</strong><span className="text-xs text-neutral-500">{LANGUAGE_LABELS[session.language]}</span></td>
          <td className="max-w-[220px] px-4 py-3"><span className="line-clamp-2">{session.challengeTitle}</span></td>
          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(session.status)}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{STATUS_LABELS[session.status]}</span></td>
          <td className="px-4 py-3"><span className="block">{relativeTime(session.updatedAt)}</span><span className="text-xs text-neutral-500">Started {relativeTime(session.createdAt)}</span></td>
          <td className="px-4 py-3"><strong>{session.evidenceCaught}/{session.evidenceTotal}</strong><span className="ml-1 text-xs text-neutral-500">areas</span><div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"><span className="block h-full bg-indigo-500" style={{ width: `${session.evidenceTotal ? session.evidenceCaught / session.evidenceTotal * 100 : 0}%` }} /></div></td>
          <td className="px-4 py-3">{assessmentLabel(session)}</td>
          <td className="px-4 py-3"><div className="flex justify-end gap-2">{session.candidateUrl ? <button type="button" onClick={() => copyCandidate(session)} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-neutral-600 dark:hover:bg-neutral-800">{copiedId === session.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === session.id ? "Copied" : "Candidate link"}</button> : null}<a href={session.reportUrl} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">{session.status === "completed" ? "Review decision" : "Open live room"}<ExternalLink className="h-3.5 w-3.5" /></a></div></td>
        </tr>)}</tbody>
      </table>
      <p className="sr-only" aria-live="polite">{copiedId ? "Candidate link copied" : ""}</p>
    </div>
  );
}

function statusClass(status: SessionStatus) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "fixing") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
}

function relativeTime(value: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function assessmentLabel(session: SessionRow) {
  if (session.decisionOutcome) return <span className="font-medium capitalize">{session.decisionOutcome.replace("-", " ")}</span>;
  if (session.gradingStatus === "error" || session.fixStatus === "error") return <span className="text-red-600">Assessment error</span>;
  if (session.gradingStatus === "pending" || session.fixStatus === "pending") return <span className="text-amber-700">Assessment pending</span>;
  if (session.score !== null) return <span>{session.score}/100 review</span>;
  return <span className="text-neutral-500">No final score</span>;
}
