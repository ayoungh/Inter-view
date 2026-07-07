"use client";

import { useMemo, useState } from "react";
import type { CandidateSession } from "@/lib/candidate";
import type { ReviewComment } from "@/lib/types";

interface Props {
  session: CandidateSession;
  onPhaseChange: () => void;
}

export function ReviewWorkspace({ session, onPhaseChange }: Props) {
  const [comments, setComments] = useState<ReviewComment[]>(session.comments);
  const [activeFile, setActiveFile] = useState(session.files[0]?.path ?? "");
  const [composer, setComposer] = useState<{ file: string; line: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [overallNote, setOverallNote] = useState(session.overallNote);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const file = session.files.find((f) => f.path === activeFile) ?? session.files[0];
  const lines = useMemo(() => file.content.split("\n"), [file.content]);

  const commentsByLine = useMemo(() => {
    const map = new Map<number, ReviewComment[]>();
    for (const c of comments) {
      if (c.file !== file.path) continue;
      const list = map.get(c.line) ?? [];
      list.push(c);
      map.set(c.line, list);
    }
    return map;
  }, [comments, file.path]);

  function commentCount(path: string) {
    return comments.filter((c) => c.file === path).length;
  }

  function openComposer(line: number) {
    setComposer({ file: file.path, line });
    setDraft("");
    setError("");
  }

  async function addComment() {
    if (!composer || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${session.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...composer, body: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add comment");
      setComments((prev) => [...prev, data.comment]);
      setComposer(null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await fetch(
      `/api/sessions/${session.id}/comments?commentId=${encodeURIComponent(commentId)}`,
      { method: "DELETE" },
    );
  }

  async function submitReview() {
    if (
      !window.confirm(
        "Submit your review? You won't be able to add or edit comments afterwards.",
      )
    )
      return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${session.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overallNote }),
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
      {/* PR header */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Open
          </span>
          <span>Pull request · {session.files.length} new file{session.files.length > 1 ? "s" : ""}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold">{session.challenge.prTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {session.challenge.prDescription}
        </p>
        <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
          💡 Click a line number to leave a comment on that line. Submit your
          review when you&apos;re done — there&apos;s a second part afterwards.
        </p>
      </div>

      {/* File tabs */}
      <div className="mb-0 flex flex-wrap gap-1">
        {session.files.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => {
              setActiveFile(f.path);
              setComposer(null);
            }}
            className={`rounded-t-lg border border-b-0 px-4 py-2 font-mono text-xs ${
              f.path === file.path
                ? "border-neutral-200 bg-white font-semibold dark:border-neutral-800 dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {f.path}
            {commentCount(f.path) > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {commentCount(f.path)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Code viewer */}
      <div className="overflow-x-auto rounded-b-xl rounded-tr-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full border-collapse font-mono text-[13px] leading-6">
          <tbody>
            {lines.map((text, i) => {
              const line = i + 1;
              const lineComments = commentsByLine.get(line) ?? [];
              const isComposing =
                composer?.file === file.path && composer.line === line;
              return (
                <FileLine
                  key={line}
                  line={line}
                  text={text}
                  comments={lineComments}
                  isComposing={isComposing}
                  draft={draft}
                  setDraft={setDraft}
                  busy={busy}
                  error={isComposing ? error : ""}
                  onOpen={() => openComposer(line)}
                  onCancel={() => setComposer(null)}
                  onSubmit={addComment}
                  onDelete={deleteComment}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Submit bar */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="block text-sm font-medium">
          Overall review summary (optional)
          <textarea
            value={overallNote}
            onChange={(e) => setOverallNote(e.target.value)}
            rows={3}
            placeholder="Anything that doesn't fit on a single line: overall approach, what you'd want changed before merging…"
            className="mt-2 w-full rounded-md border border-neutral-300 bg-white p-3 font-normal dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">
            {comments.length} line comment{comments.length === 1 ? "" : "s"} so far
          </p>
          <button
            type="button"
            onClick={submitReview}
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </div>
        {error && !composer && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}

function FileLine({
  line,
  text,
  comments,
  isComposing,
  draft,
  setDraft,
  busy,
  error,
  onOpen,
  onCancel,
  onSubmit,
  onDelete,
}: {
  line: number;
  text: string;
  comments: ReviewComment[];
  isComposing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  busy: boolean;
  error: string;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr className="group">
        <td
          onClick={onOpen}
          title="Add a comment on this line"
          className="w-12 min-w-12 cursor-pointer select-none border-r border-neutral-200 bg-emerald-50/60 px-2 text-right text-neutral-400 hover:bg-indigo-100 hover:text-indigo-700 dark:border-neutral-800 dark:bg-emerald-950/20 dark:hover:bg-indigo-950"
        >
          <span className="group-hover:hidden">{line}</span>
          <span className="hidden font-bold group-hover:inline">+</span>
        </td>
        <td className="w-6 select-none bg-emerald-50/60 text-center text-emerald-600 dark:bg-emerald-950/20">
          +
        </td>
        <td className="whitespace-pre bg-emerald-50/60 px-3 dark:bg-emerald-950/20">
          {text || " "}
        </td>
      </tr>
      {(comments.length > 0 || isComposing) && (
        <tr>
          <td colSpan={3} className="border-y border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/60">
            <div className="max-w-3xl space-y-2 font-sans">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="shrink-0 text-xs text-neutral-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {isComposing && (
                <div className="rounded-lg border border-indigo-300 bg-white p-3 dark:border-indigo-800 dark:bg-neutral-900">
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder={`Comment on line ${line}…`}
                    className="w-full rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
                    }}
                  />
                  {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onSubmit}
                      disabled={busy || !draft.trim()}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busy ? "Adding…" : "Add comment"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
