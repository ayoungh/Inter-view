"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileCode2, GitCompareArrows, LoaderCircle, Play, Send } from "lucide-react";
import type { CandidateSession } from "@/lib/candidate";
import type { CheckRun } from "@/lib/types";
import { PrTop } from "./ReviewWorkspace";
import { PrDiff } from "./PrDiff";
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function FixWorkspace({ session, token, onPhaseChange }: { session: CandidateSession; token: string; onPhaseChange: () => void }) {
  const seed = session.fixFiles ?? session.files.map((file) => ({ ...file, savedContent: file.headContent }));
  const [files, setFiles] = useState(seed); const [active, setActive] = useState(seed[0]?.path ?? ""); const [view, setView] = useState<"edit"|"diff"|"checks">("edit"); const [busy, setBusy] = useState(false); const [runs, setRuns] = useState(session.checkRuns); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const latest = useRef(files);
  const file = files.find((item) => item.path === active) ?? files[0];
  const changed = useMemo(() => files.filter((item) => (item.savedContent ?? item.headContent) !== item.headContent).length, [files]);
  async function save(current = latest.current) { const res = await fetch(`/api/candidate/${token}/revision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: current }) }); return res.ok; }
  function edit(value: string | undefined) { const next = files.map((item) => item.path === file.path ? { ...item, savedContent: value ?? "" } : item); setFiles(next); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void save(next), 8_000); }
  useEffect(() => { latest.current = files; }, [files]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function checks() { setBusy(true); await save(); const res = await fetch(`/api/candidate/${token}/checks`, { method: "POST" }); const data = await res.json(); if (res.ok) { setRuns((items) => [data.run, ...items]); setView("checks"); } setBusy(false); }
  async function submit() { setBusy(true); await save(); const res = await fetch(`/api/candidate/${token}/fix`, { method: "POST" }); if (res.ok) onPhaseChange(); else setBusy(false); }
  return <main className="pr-app fix-app"><PrTop session={session} phase="Implementation"/><div className="fix-toolbar"><div><span className="open-pill amber">Part 2 of 2</span><h1>Implement your review</h1><p>{session.challenge.fixInstructions}</p></div><div className="toolbar-actions"><button onClick={checks} disabled={busy}><Play/>Run checks</button><button className="primary" onClick={submit} disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <Send/>}Submit changes</button></div></div>
    <nav className="edit-tabs"><button className={view === "edit" ? "active" : ""} onClick={() => setView("edit")}><FileCode2/>Edit</button><button className={view === "diff" ? "active" : ""} onClick={() => setView("diff")}><GitCompareArrows/>Working tree <b>{changed}</b></button><button className={view === "checks" ? "active" : ""} onClick={() => setView("checks")}><CheckCircle2/>Checks <b>{runs.length}</b></button></nav>
    <div className="editor-layout"><aside className="file-rail"><h3>Explorer</h3>{files.map((item) => <button className={item.path === file.path ? "active" : ""} key={item.path} onClick={() => setActive(item.path)}><FileCode2/><span>{item.path}</span>{(item.savedContent ?? item.headContent) !== item.headContent ? <i>M</i> : null}</button>)}</aside><section className="editor-main">
      {view === "edit" ? <><div className="editor-breadcrumb">{file.path}<span>{changed ? `${changed} modified` : "No changes"}</span></div><MonacoEditor height="calc(100vh - 250px)" language={session.language === "python" ? "python" : session.language} value={file.savedContent ?? file.headContent} onChange={edit} theme="vs" options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: "var(--font-geist-mono)", scrollBeyondLastLine: false, padding: { top: 14 }, automaticLayout: true }}/></> : view === "diff" ? <div className="diff-stack">{files.filter((item) => (item.savedContent ?? item.headContent) !== item.headContent).map((item) => <PrDiff key={item.path} file={{ ...item, baseContent: item.headContent }}/>)}</div> : <Checks runs={runs} busy={busy}/>}
    </section></div></main>;
}
function Checks({ runs, busy }: { runs: CheckRun[]; busy: boolean }) { return <div className="checks-view"><h2>Checks</h2>{busy ? <p><LoaderCircle className="spin"/>Running in an isolated sandbox…</p> : null}{runs.length === 0 ? <div className="checks-empty">Run checks when you are ready. Candidate code executes with network access denied.</div> : runs.map((run) => <article key={run.id}><header><CheckCircle2/><strong>Revision {run.revision}</strong><span className={`check-${run.status}`}>{run.status}</span><time>{run.completedAt && `${run.completedAt - run.createdAt} ms`}</time></header>{run.results.map((result) => <details key={result.checkId}><summary>{result.name}<span>{result.durationMs} ms · {result.status}</span></summary><pre>{result.output || (result.visibility === "hidden" ? `Hidden ${result.category} checks ${result.status}.` : "No output")}</pre></details>)}</article>)}</div>; }
