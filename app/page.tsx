import { challenges } from "@/lib/challenges";
import type { Language } from "@/lib/types";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { SessionList } from "@/components/SessionList";

// Auth for this page is enforced by proxy.ts (redirects to /login).
export default function Home() {
  const challengeSummaries = challenges.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    languages: Object.keys(c.variants) as Language[],
    findingCount: c.findings.length,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    competencies: c.competencies,
  }));

  return (
    <main className="console-page mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Inter-View
          <span className="ml-3 align-middle rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            interviewer console
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Create a durable curated PR, send the capability link, and watch
          comments, code revisions, checks, and preliminary AI evidence live.
        </p>
      </header>

      <CreateSessionForm challenges={challengeSummaries} />

        <h2 className="mt-12 mb-4 text-lg font-semibold dark:text-neutral-100">Sessions</h2>
      <SessionList />
    </main>
  );
}
