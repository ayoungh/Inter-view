"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type {
  ChallengeFile,
  FixEvaluation,
  GradingResult,
  JobStatus,
  Language,
  ResolvedFinding,
  ReviewComment,
  SessionStatus,
} from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/types";
import { ReportView } from "@/components/ReportView";

export interface InterviewerSession {
  id: string;
  status: SessionStatus;
  language: Language;
  candidateName: string;
  challenge: {
    id: string;
    title: string;
    prTitle: string;
    prDescription: string;
    fixInstructions: string;
  };
  files: ChallengeFile[];
  comments: ReviewComment[];
  overallNote: string;
  fixFiles: ChallengeFile[] | null;
  findings?: ResolvedFinding[];
  gradingStatus?: JobStatus;
  grading?: GradingResult | null;
  gradingError?: string | null;
  fixStatus?: JobStatus;
  fixEvaluation?: FixEvaluation | null;
  fixError?: string | null;
}

export default function ReportPage() {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-neutral-500">Loading…</p>}>
      <Report />
    </Suspense>
  );
}

function Report() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const key = searchParams.get("key") ?? "";
  const [session, setSession] = useState<InterviewerSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/sessions/${id}?key=${encodeURIComponent(key)}`);
      if (cancelled) return;

      if (!res.ok) {
        setError(
          res.status === 401
            ? "Sign in to view interviewer reports."
            : res.status === 404
              ? "Session not found."
              : "Failed to load session.",
        );
        return;
      }

      const data: InterviewerSession = await res.json();
      if (cancelled) return;

      if (data.findings === undefined) {
        setError("This report link is missing a valid interviewer key.");
        return;
      }

      setError("");
      setSession(data);
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, key]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Can&apos;t open report</h1>
        <p className="mt-2 text-sm text-neutral-500">{error}</p>
      </main>
    );
  }
  if (!session) {
    return <p className="p-10 text-sm text-neutral-500">Loading report…</p>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Interview report
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {session.candidateName} · {session.challenge.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {LANGUAGE_LABELS[session.language]} ·{" "}
          {session.status === "review"
            ? "candidate is still reviewing"
            : session.status === "fixing"
              ? "review submitted — candidate is fixing the code"
              : "completed"}{" "}
          · {session.comments.length} comment
          {session.comments.length === 1 ? "" : "s"}
        </p>
      </header>
      <ReportView session={session} />
    </main>
  );
}
