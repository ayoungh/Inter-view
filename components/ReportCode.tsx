"use client";

import { useMemo, useState } from "react";
import type {
  ChallengeFile,
  FindingSeverity,
  GradingResult,
  ResolvedFinding,
  ReviewComment,
} from "@/lib/types";
import { diffLines } from "@/lib/diff";

const SEVERITY_DOT: Record<FindingSeverity, string> = {
  critical: "bg-red-500",
  major: "bg-amber-500",
  minor: "bg-neutral-400",
};

const QUALITY_BADGE = {
  full: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
} as const;

const QUALITY_LABEL = { full: "caught", partial: "partial", missed: "missed" } as const;

function FileTabs({
  paths,
  active,
  onSelect,
  counts,
}: {
  paths: string[];
  active: string;
  onSelect: (path: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {paths.map((path) => (
        <button
          key={path}
          type="button"
          onClick={() => onSelect(path)}
          className={`rounded-t-lg border border-b-0 px-4 py-2 font-mono text-xs ${
            path === active
              ? "border-neutral-200 bg-white font-semibold dark:border-neutral-800 dark:bg-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          {path}
          {counts && counts[path] ? (
            <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {counts[path]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/**
 * The reviewed code with the candidate's comments and the planted findings
 * rendered inline on the lines they belong to.
 */
export function AnnotatedCode({
  files,
  comments,
  findings,
  grading,
}: {
  files: ChallengeFile[];
  comments: ReviewComment[];
  findings: ResolvedFinding[];
  grading: GradingResult | null | undefined;
}) {
  const [activeFile, setActiveFile] = useState(files[0]?.path ?? "");
  const file = files.find((f) => f.path === activeFile) ?? files[0];
  const lines = useMemo(() => file.content.split("\n"), [file.content]);

  const counts = Object.fromEntries(
    files.map((f) => [f.path, comments.filter((c) => c.file === f.path).length]),
  );

  return (
    <div>
      <FileTabs
        paths={files.map((f) => f.path)}
        active={file.path}
        onSelect={setActiveFile}
        counts={counts}
      />
      <div className="overflow-x-auto rounded-b-xl rounded-tr-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full border-collapse font-mono text-[13px] leading-6">
          <tbody>
            {lines.map((text, i) => {
              const line = i + 1;
              const lineComments = comments.filter(
                (c) => c.file === file.path && c.line === line,
              );
              const lineFindings = findings.filter(
                (f) => f.file === file.path && f.line === line,
              );
              const hasAnnotations =
                lineComments.length > 0 || lineFindings.length > 0;
              return (
                <ReportLine
                  key={line}
                  line={line}
                  text={text}
                  comments={lineComments}
                  findings={lineFindings}
                  grading={grading}
                  hasAnnotations={hasAnnotations}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportLine({
  line,
  text,
  comments,
  findings,
  grading,
  hasAnnotations,
}: {
  line: number;
  text: string;
  comments: ReviewComment[];
  findings: ResolvedFinding[];
  grading: GradingResult | null | undefined;
  hasAnnotations: boolean;
}) {
  return (
    <>
      <tr>
        <td className="w-12 min-w-12 select-none border-r border-neutral-200 px-2 text-right text-neutral-400 dark:border-neutral-800">
          {line}
        </td>
        <td className="w-6 select-none text-center">
          {findings.length > 0 && (
            <span
              title={findings.map((f) => f.title).join("; ")}
              className={`inline-block h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[findings[0].severity]}`}
            />
          )}
        </td>
        <td
          className={`whitespace-pre px-3 ${
            hasAnnotations ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
          }`}
        >
          {text || " "}
        </td>
      </tr>
      {hasAnnotations && (
        <tr>
          <td
            colSpan={3}
            className="border-y border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/60"
          >
            <div className="max-w-3xl space-y-2 font-sans">
              {findings.map((finding) => {
                const match = grading?.matches.find(
                  (m) => m.findingId === finding.id,
                );
                return (
                  <div
                    key={finding.id}
                    className="rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Planted finding
                      </span>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[finding.severity]}`}
                      />
                      <span className="text-xs text-neutral-500">
                        {finding.severity} {finding.category}
                      </span>
                      {match && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${QUALITY_BADGE[match.quality]}`}
                        >
                          {QUALITY_LABEL[match.quality]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium">{finding.title}</p>
                  </div>
                );
              })}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border-l-4 border-indigo-400 bg-white p-3 text-sm shadow-sm dark:bg-neutral-900"
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    Candidate comment
                  </p>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Unified diff of the candidate's fix against the original files. */
export function FixDiff({
  original,
  fixed,
}: {
  original: ChallengeFile[];
  fixed: ChallengeFile[];
}) {
  const [activeFile, setActiveFile] = useState(original[0]?.path ?? "");
  const before = original.find((f) => f.path === activeFile) ?? original[0];
  const after = fixed.find((f) => f.path === before.path);

  const diff = useMemo(
    () => diffLines(before.content, after?.content ?? ""),
    [before.content, after],
  );
  const changed = diff.filter((d) => d.type !== "same").length;

  return (
    <div>
      <FileTabs
        paths={original.map((f) => f.path)}
        active={before.path}
        onSelect={setActiveFile}
      />
      <div className="overflow-x-auto rounded-b-xl rounded-tr-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {changed === 0 ? (
          <p className="p-4 text-sm text-neutral-500">
            No changes were made to this file.
          </p>
        ) : (
          <table className="w-full border-collapse font-mono text-[13px] leading-6">
            <tbody>
              {diff.map((d, i) => (
                <tr key={i}>
                  <td className="w-10 min-w-10 select-none border-r border-neutral-200 px-2 text-right text-neutral-400 dark:border-neutral-800">
                    {d.oldLine ?? ""}
                  </td>
                  <td className="w-10 min-w-10 select-none border-r border-neutral-200 px-2 text-right text-neutral-400 dark:border-neutral-800">
                    {d.newLine ?? ""}
                  </td>
                  <td
                    className={`w-6 select-none text-center ${
                      d.type === "add"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
                        : d.type === "del"
                          ? "bg-red-50 text-red-600 dark:bg-red-950/30"
                          : ""
                    }`}
                  >
                    {d.type === "add" ? "+" : d.type === "del" ? "-" : ""}
                  </td>
                  <td
                    className={`whitespace-pre px-3 ${
                      d.type === "add"
                        ? "bg-emerald-50 dark:bg-emerald-950/30"
                        : d.type === "del"
                          ? "bg-red-50 text-neutral-500 line-through decoration-red-300 dark:bg-red-950/30"
                          : ""
                    }`}
                  >
                    {d.text || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
