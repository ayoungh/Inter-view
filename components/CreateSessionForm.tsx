"use client";

import { useMemo, useState } from "react";
import { Check, Clock3, Copy, ExternalLink, Search } from "lucide-react";
import { LANGUAGE_LABELS, type Difficulty, type Language } from "@/lib/types";

interface ChallengeSummary {
  id: string;
  title: string;
  summary: string;
  languages: Language[];
  findingCount: number;
  difficulty: Difficulty;
  estimatedMinutes: number;
  competencies: string[];
}

interface CreatedLinks {
  candidateUrl: string;
  reportUrl: string;
}

export function CreateSessionForm({ challenges }: { challenges: ChallengeSummary[] }) {
  const [challengeId, setChallengeId] = useState(challenges[0]?.id ?? "");
  const [language, setLanguage] = useState<Language>(challenges[0]?.languages[0] ?? "javascript");
  const [candidateName, setCandidateName] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [competency, setCompetency] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useState<CreatedLinks | null>(null);
  const [copied, setCopied] = useState("");

  const competencies = useMemo(() => [...new Set(challenges.flatMap((item) => item.competencies))].sort(), [challenges]);
  const filtered = useMemo(() => challenges.filter((item) => {
    const matchesQuery = `${item.title} ${item.summary} ${item.competencies.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (difficulty === "all" || item.difficulty === difficulty) && (competency === "all" || item.competencies.includes(competency));
  }), [challenges, competency, difficulty, query]);
  const selected = challenges.find((item) => item.id === challengeId) ?? challenges[0];

  function pickChallenge(challenge: ChallengeSummary) {
    setChallengeId(challenge.id);
    if (!challenge.languages.includes(language)) setLanguage(challenge.languages[0]);
    setLinks(null);
  }

  async function create() {
    if (!candidateName.trim()) {
      setError("Add a candidate or session name so you can find this interview later.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, language, candidateName: candidateName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create session");
      setLinks({ candidateUrl: data.candidateUrl, reportUrl: data.reportUrl });
      window.dispatchEvent(new Event("sessions-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Clipboard access failed. Select and copy the link manually.");
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" aria-labelledby="new-interview-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="new-interview-title" className="text-lg font-semibold">New interview</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Choose what you want to assess, then create a named session.</p>
        </div>
        <span className="text-sm text-neutral-500">{filtered.length} challenge{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_170px]">
        <label className="relative block text-sm">
          <span className="sr-only">Search challenges</span>
          <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills or scenarios" className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 dark:border-neutral-600 dark:bg-neutral-800" />
        </label>
        <label className="text-sm">
          <span className="sr-only">Filter by level</span>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as "all" | Difficulty)} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800">
            <option value="all">All levels</option><option value="mid">Mid-level</option><option value="senior">Senior</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Filter by competency</span>
          <select value={competency} onChange={(event) => setCompetency(event.target.value)} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800">
            <option value="all">All competencies</option>
            {competencies.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid min-h-[360px] gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
        <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1" role="listbox" aria-label="Interview challenges">
          {filtered.map((challenge) => (
            <button key={challenge.id} type="button" role="option" aria-selected={challenge.id === challengeId} onClick={() => pickChallenge(challenge)} className={`w-full rounded-lg border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${challenge.id === challengeId ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700"}`}>
              <div className="flex items-start justify-between gap-3"><span className="font-medium">{challenge.title}</span><span className="shrink-0 text-xs text-neutral-500">{challenge.difficulty} · {challenge.estimatedMinutes} min</span></div>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{challenge.summary}</p>
            </button>
          ))}
          {filtered.length === 0 ? <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">No challenges match those filters.</p> : null}
        </div>

        {selected ? <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-950/50" aria-label="Selected challenge details">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Selected challenge</p>
          <h3 className="mt-2 text-xl font-semibold">{selected.title}</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{selected.summary}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-neutral-500">Level</dt><dd className="mt-1 font-medium capitalize">{selected.difficulty}</dd></div>
            <div><dt className="text-neutral-500">Timebox</dt><dd className="mt-1 flex items-center gap-1 font-medium"><Clock3 aria-hidden="true" className="h-4 w-4" />{selected.estimatedMinutes} minutes</dd></div>
            <div><dt className="text-neutral-500">Rubric</dt><dd className="mt-1 font-medium">{selected.findingCount} areas</dd></div>
            <div><dt className="text-neutral-500">Structure</dt><dd className="mt-1 font-medium">Review + implementation</dd></div>
          </dl>
          <div className="mt-5"><p className="text-sm font-medium">Competencies</p><div className="mt-2 flex flex-wrap gap-2">{selected.competencies.map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs text-neutral-600 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700">{labelize(item)}</span>)}</div></div>
        </aside> : null}
      </div>

      <div className="mt-5 grid items-end gap-4 border-t border-neutral-200 pt-5 sm:grid-cols-[220px_minmax(220px,1fr)_auto] dark:border-neutral-700">
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800">{(selected?.languages ?? []).map((item) => <option key={item} value={item}>{LANGUAGE_LABELS[item]}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Candidate or session name</span><input required value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="Jordan Lee" className="rounded-md border border-neutral-300 bg-white px-3 py-2 placeholder:text-neutral-400 dark:border-neutral-600 dark:bg-neutral-800" /></label>
        <button type="button" onClick={create} disabled={creating || !selected || !candidateName.trim()} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50">{creating ? "Creating…" : "Create interview"}</button>
      </div>

      <div aria-live="polite">{error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}{links ? <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40"><div><p className="font-medium text-emerald-800 dark:text-emerald-300">Interview ready</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Send the candidate link, then open the private live room.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => copy("candidate", links.candidateUrl)} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">{copied === "candidate" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === "candidate" ? "Copied" : "Copy candidate link"}</button><a href={links.reportUrl} className="inline-flex items-center gap-2 rounded-md border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"><ExternalLink className="h-4 w-4" />Open live room</a></div></div> : null}</div>
    </section>
  );
}

function labelize(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
