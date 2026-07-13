"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_LABELS, type JobStatus, type Language, type SessionStatus } from "@/lib/types";

interface SessionRow {
  id: string;
  reportUrl: string;
  challengeTitle: string;
  language: Language;
  candidateName: string;
  createdAt: number;
  status: SessionStatus;
  commentCount: number;
  gradingStatus: JobStatus;
  fixStatus: JobStatus;
  score: number | null;
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  review: "Reviewing",
  fixing: "Fixing code",
  completed: "Completed",
};

export function SessionList() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setSessions(data.sessions);
      } catch {
        // transient; next poll will retry
      }
    }

    const handleSessionsChanged = () => {
      void load();
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);
    window.addEventListener("sessions-changed", handleSessionsChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("sessions-changed", handleSessionsChanged);
    };
  }, []);

  if (!sessions) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>;
  }
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        No durable sessions yet — create one above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Challenge</th>
            <th className="px-4 py-3">Language</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Comments</th>
            <th className="px-4 py-3">AI score</th>
            <th className="px-4 py-3">Links</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="border-t border-neutral-200 dark:border-neutral-700"
            >
              <td className="px-4 py-3 font-medium">{s.candidateName}</td>
              <td className="px-4 py-3">{s.challengeTitle}</td>
              <td className="px-4 py-3">{LANGUAGE_LABELS[s.language]}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === "completed"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : s.status === "fixing"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  }`}
                >
                  {STATUS_LABELS[s.status]}
                </span>
              </td>
              <td className="px-4 py-3">{s.commentCount}</td>
              <td className="px-4 py-3">
                {s.gradingStatus === "pending"
                  ? "Grading…"
                  : s.gradingStatus === "error"
                    ? "Error"
                    : s.score !== null
                      ? `${s.score}/100`
                      : "—"}
              </td>
              <td className="px-4 py-3">
                <a
                  href={s.reportUrl}
                  className="text-indigo-600 hover:underline"
                >
                  live review
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
