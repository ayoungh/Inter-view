"use client";

import { useState } from "react";
import { LANGUAGE_LABELS, type Language } from "@/lib/types";

interface ChallengeSummary {
  id: string;
  title: string;
  summary: string;
  languages: Language[];
  findingCount: number;
  difficulty: "mid" | "senior";
}

interface CreatedLinks {
  candidateUrl: string;
  reportUrl: string;
}

export function CreateSessionForm({
  challenges,
}: {
  challenges: ChallengeSummary[];
}) {
  const [challengeId, setChallengeId] = useState(challenges[0]?.id ?? "");
  const [language, setLanguage] = useState<Language>(
    challenges[0]?.languages[0] ?? "javascript",
  );
  const [candidateName, setCandidateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useState<CreatedLinks | null>(null);
  const [copied, setCopied] = useState("");

  const selected = challenges.find((c) => c.id === challengeId);

  function pickChallenge(c: ChallengeSummary) {
    setChallengeId(c.id);
    if (!c.languages.includes(language)) setLanguage(c.languages[0]);
    setLinks(null);
  }

  async function create() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, language, candidateName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create session");
      setLinks({
        candidateUrl: data.candidateUrl,
        reportUrl: data.reportUrl,
      });
      window.dispatchEvent(new Event("sessions-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-lg font-semibold">New interview</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {challenges.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pickChallenge(c)}
            className={`rounded-lg border p-4 text-left transition ${
              c.id === challengeId
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{c.title}</span>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {c.difficulty} · {c.findingCount} rubric areas
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {c.summary}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
          >
            {(selected?.languages ?? []).map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Candidate name (optional)</span>
          <input
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="Ada Lovelace"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>

        <button
          type="button"
          onClick={create}
          disabled={creating || !selected}
          className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create interview link"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {links && (
        <div className="mt-5 space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            Session created — send the candidate link, keep the report link for
            yourself.
          </p>
          {(
            [
              ["Candidate link", links.candidateUrl],
              ["Report link (private)", links.reportUrl],
            ] as const
          ).map(([label, url]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-neutral-600 dark:text-neutral-400">
                {label}
              </span>
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs dark:bg-neutral-800">
                {url}
              </code>
              <button
                type="button"
                onClick={() => copy(label, url)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
              >
                {copied === label ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
