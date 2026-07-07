"use client";

import { useState } from "react";
import type { CandidateSession } from "@/lib/candidate";

interface Props {
  session: CandidateSession;
  onPhaseChange: () => void;
}

export function FixWorkspace({ session, onPhaseChange }: Props) {
  const initial = session.fixFiles ?? session.files;
  const [contents, setContents] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((f) => [f.path, f.content])),
  );
  const [activeFile, setActiveFile] = useState(session.files[0]?.path ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const paths = session.files.map((f) => f.path);

  async function submitFix() {
    if (
      !window.confirm(
        "Submit your fixed code? This ends the exercise — you won't be able to edit afterwards.",
      )
    )
      return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${session.id}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: paths.map((path) => ({ path, content: contents[path] ?? "" })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit");
      }
      onPhaseChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Part 2 of 2
          </span>
          <span>Review submitted ✓</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold">Now fix the code</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {session.challenge.fixInstructions}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {paths.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => setActiveFile(path)}
            className={`rounded-t-lg border border-b-0 px-4 py-2 font-mono text-xs ${
              path === activeFile
                ? "border-neutral-200 bg-white font-semibold dark:border-neutral-800 dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {path}
          </button>
        ))}
      </div>

      <textarea
        value={contents[activeFile] ?? ""}
        onChange={(e) =>
          setContents((prev) => ({ ...prev, [activeFile]: e.target.value }))
        }
        spellCheck={false}
        rows={Math.max(24, (contents[activeFile] ?? "").split("\n").length + 2)}
        className="w-full resize-y rounded-b-xl rounded-tr-xl border border-neutral-200 bg-white p-4 font-mono text-[13px] leading-6 focus:outline-indigo-500 dark:border-neutral-800 dark:bg-neutral-900"
      />

      <div className="mt-4 flex items-center justify-end gap-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={submitFix}
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit fixed code"}
        </button>
      </div>
    </main>
  );
}
