"use client";

import type { InterviewerSession } from "@/app/report/[id]/page";
import type { FindingSeverity, ReviewComment } from "@/lib/types";
import { AnnotatedCode, FixDiff } from "@/components/ReportCode";

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  major: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  minor: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

const QUALITY_STYLES = {
  full: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
} as const;

const QUALITY_LABELS = { full: "✓ Caught", partial: "◐ Partial", missed: "✗ Missed" } as const;

export function ReportView({ session }: { session: InterviewerSession }) {
  const { grading, findings = [], comments } = session;
  const commentById = new Map(comments.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      {/* Grading status / score */}
      {session.status === "review" ? (
        <Card>
          <p className="text-sm text-neutral-500">
            The candidate hasn&apos;t submitted their review yet. This page
            refreshes automatically.
          </p>
        </Card>
      ) : session.gradingStatus === "pending" ? (
        <Card>
          <p className="animate-pulse text-sm text-neutral-500">
            🤖 AI is grading the review… this page refreshes automatically.
          </p>
        </Card>
      ) : session.gradingStatus === "error" ? (
        <Card>
          <p className="text-sm text-red-600">
            Grading failed: {session.gradingError}. Check that
            AI_GATEWAY_API_KEY is configured.
          </p>
        </Card>
      ) : grading ? (
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold">{grading.score}</p>
              <p className="text-xs uppercase tracking-wide text-neutral-500">/ 100</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed">{grading.summary}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <BulletList title="Strengths" items={grading.strengths} tone="emerald" />
                <BulletList title="Gaps" items={grading.gaps} tone="red" />
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Reviewed code with inline annotations */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">Reviewed code</h2>
        <p className="mb-3 text-sm text-neutral-500">
          The candidate&apos;s comments shown on the lines they were left on.
          Dots in the gutter mark where the planted findings live
          (<span className="mx-1 inline-block h-2 w-2 rounded-full bg-red-500" /> critical
          <span className="mx-1 ml-3 inline-block h-2 w-2 rounded-full bg-amber-500" /> major
          <span className="mx-1 ml-3 inline-block h-2 w-2 rounded-full bg-neutral-400" /> minor).
        </p>
        <AnnotatedCode
          files={session.files}
          comments={comments}
          findings={findings}
          grading={grading}
        />
      </section>

      {/* Expected findings coverage */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Expected findings{" "}
          <span className="text-sm font-normal text-neutral-500">
            (what we planted in the code)
          </span>
        </h2>
        <div className="space-y-3">
          {findings.map((finding) => {
            const match = grading?.matches.find((m) => m.findingId === finding.id);
            return (
              <Card key={finding.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {match && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${QUALITY_STYLES[match.quality]}`}
                    >
                      {QUALITY_LABELS[match.quality]}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[finding.severity]}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {finding.category}
                  </span>
                  <code className="text-xs text-neutral-500">
                    {finding.file}:{finding.line}
                  </code>
                </div>
                <h3 className="mt-2 font-medium">{finding.title}</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {finding.description}
                </p>
                {match && (
                  <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                    <p className="text-sm italic text-neutral-600 dark:text-neutral-400">
                      🤖 {match.note}
                    </p>
                    {match.matchedCommentIds.map((cid) => {
                      const c = commentById.get(cid);
                      return c ? <CommentQuote key={cid} comment={c} /> : null;
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Extra comments */}
      {grading && grading.extraComments.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Other comments{" "}
            <span className="text-sm font-normal text-neutral-500">
              (didn&apos;t match a planted finding)
            </span>
          </h2>
          <div className="space-y-3">
            {grading.extraComments.map((extra) => {
              const c = commentById.get(extra.commentId);
              return (
                <Card key={extra.commentId}>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      extra.assessment === "valid-insight"
                        ? QUALITY_STYLES.full
                        : extra.assessment === "incorrect"
                          ? QUALITY_STYLES.missed
                          : QUALITY_STYLES.partial
                    }`}
                  >
                    {extra.assessment}
                  </span>
                  {c && <CommentQuote comment={c} />}
                  <p className="mt-2 text-sm italic text-neutral-600 dark:text-neutral-400">
                    🤖 {extra.note}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Overall note */}
      {session.overallNote && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Candidate&apos;s summary note</h2>
          <Card>
            <p className="whitespace-pre-wrap text-sm">{session.overallNote}</p>
          </Card>
        </section>
      )}

      {/* Fix phase */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Part 2 — fix the code</h2>
        {session.status !== "completed" ? (
          <Card>
            <p className="text-sm text-neutral-500">
              {session.status === "fixing"
                ? "The candidate is working on their fix."
                : "Not started yet."}
            </p>
          </Card>
        ) : session.fixStatus === "pending" ? (
          <Card>
            <p className="animate-pulse text-sm text-neutral-500">
              🤖 AI is evaluating the fix…
            </p>
          </Card>
        ) : session.fixStatus === "error" ? (
          <Card>
            <p className="text-sm text-red-600">Fix evaluation failed: {session.fixError}</p>
          </Card>
        ) : session.fixEvaluation ? (
          <div className="space-y-3">
            <Card>
              <div className="flex items-center gap-4">
                <p className="text-3xl font-bold">{session.fixEvaluation.score}</p>
                <p className="text-sm">{session.fixEvaluation.summary}</p>
              </div>
              {session.fixEvaluation.regressions.length > 0 && (
                <div className="mt-3">
                  <BulletList
                    title="Regressions introduced"
                    items={session.fixEvaluation.regressions}
                    tone="red"
                  />
                </div>
              )}
            </Card>
            {session.fixEvaluation.findings.map((f) => {
              const finding = findings.find((x) => x.id === f.findingId);
              return (
                <Card key={f.findingId}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        f.status === "fixed"
                          ? QUALITY_STYLES.full
                          : f.status === "partially-fixed"
                            ? QUALITY_STYLES.partial
                            : QUALITY_STYLES.missed
                      }`}
                    >
                      {f.status}
                    </span>
                    <span className="font-medium">{finding?.title ?? f.findingId}</span>
                  </div>
                  <p className="mt-2 text-sm italic text-neutral-600 dark:text-neutral-400">
                    🤖 {f.note}
                  </p>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Fix diff — shown as soon as a fix is submitted, even while evaluation runs */}
      {session.fixFiles && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Submitted fix</h2>
          <p className="mb-3 text-sm text-neutral-500">
            The candidate&apos;s changes against the original PR.
          </p>
          <FixDiff original={session.files} fixed={session.fixFiles} />
        </section>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </div>
  );
}

function CommentQuote({ comment }: { comment: ReviewComment }) {
  return (
    <blockquote className="mt-2 rounded-md border-l-4 border-indigo-300 bg-neutral-50 px-3 py-2 text-sm dark:border-indigo-700 dark:bg-neutral-950">
      <code className="text-xs text-neutral-500">
        {comment.file}:{comment.line}
      </code>
      <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
    </blockquote>
  );
}

function BulletList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "red";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          tone === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {title}
      </p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-neutral-700 dark:text-neutral-300">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
