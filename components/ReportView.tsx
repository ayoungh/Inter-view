"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, Check, ChevronDown, ChevronRight, Circle, Clock3, FileCode2, FileText, Lightbulb, MessageSquare, PanelRight, Sparkles } from "lucide-react";
import type { InterviewerSession } from "@/app/report/[id]/page";
import type { ResolvedFinding, RubricEvidence, SessionEvent } from "@/lib/types";
import { diffLines } from "@/lib/diff";
import { PrDiff } from "./PrDiff";

export function ReportView({ session, reportKey, events }: { session: InterviewerSession; reportKey: string; events: SessionEvent[] }) {
  const [tab, setTab] = useState<"live"|"rubric"|"timeline"|"final">("live"); const [activeFile, setActiveFile] = useState(session.files[0]?.path ?? ""); const [note, setNote] = useState(session.interviewerNote?.body ?? ""); const [railOpen, setRailOpen] = useState(false);
  const file = (session.fixFiles ?? session.files).find((item) => item.path === activeFile) ?? session.files[0]; const evidence = useMemo(() => session.liveAssessment?.evidence ?? [], [session.liveAssessment?.evidence]);
  useEffect(() => { const timer = setTimeout(() => { if (note === (session.interviewerNote?.body ?? "")) return; void fetch(`/api/sessions/${session.id}/note`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: reportKey, body: note }) }); }, 900); return () => clearTimeout(timer); }, [note,reportKey,session.id,session.interviewerNote?.body]);
  const markers = useMemo(() => session.findings.filter((finding) => finding.file === file.path).map((finding) => { const state = evidence.find((item) => item.findingId === finding.id)?.state ?? "not-discussed"; return { line: finding.line, tone: state === "caught" ? "#2da44e" : state === "developing" || state === "partial" ? "#bf8700" : "#cf222e", label: `${finding.title}: ${state}` }; }), [session.findings,evidence,file.path]);
  return <main className="live-app"><header className="live-top"><a className="brand"><span>IV</span>Inter-View</a><div className="live-title"><strong>{session.candidateName}</strong><span>{session.challenge.title}</span></div><div className="live-presence"><span className="live-dot"/>Candidate {session.status === "review" ? "reviewing" : session.status === "fixing" ? "editing" : "submitted"}<b>Live</b></div></header>
    <nav className="live-tabs"><button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}><Activity/>Live review</button><button className={tab === "rubric" ? "active" : ""} onClick={() => setTab("rubric")}><Sparkles/>Rubric</button><button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}><Clock3/>Timeline</button><button className={tab === "final" ? "active" : ""} onClick={() => setTab("final")}><FileText/>Final report</button><span>Session #{session.id.slice(0,8)}</span><button aria-label="Toggle AI assessment" className="rail-toggle" onClick={() => setRailOpen(!railOpen)}><PanelRight/></button></nav>
    {tab === "live" ? <div className="live-layout"><aside className="live-files"><h3>Files changed <b>{session.files.length}</b></h3><div className="tree-root"><ChevronRight/>src</div>{session.files.map((item) => { const count = session.comments.filter((comment) => comment.file === item.path).length; return <button className={item.path === file.path ? "active" : ""} key={item.path} onClick={() => setActiveFile(item.path)}><FileCode2/><span>{item.path}</span>{count ? <b>{count}</b> : null}</button>; })}<section className="candidate-card"><h4>Candidate activity</h4><div><span className="avatar">{session.candidateName.slice(0,2).toUpperCase()}</span><p><strong>{session.candidateName}</strong><small><i/> Active now</small></p></div><dl><dt>Comments</dt><dd>{session.comments.length}</dd><dt>Revisions</dt><dd>{session.revision}</dd><dt>Checks</dt><dd>{session.checkRuns.length}</dd></dl></section></aside>
      <section className="live-canvas"><div className="live-filebar"><div><span className="status-badge">M</span><strong>{file.path}</strong></div><span>Watching candidate activity in real time</span></div><PrDiff file={file} comments={session.comments} markers={markers}/></section>
      <AssessmentRail session={session} evidence={evidence} note={note} setNote={setNote} open={railOpen} onOpenFinding={(finding) => { setActiveFile(finding.file); setTab("live"); }}/></div> : tab === "rubric" ? <Rubric session={session} evidence={evidence}/> : tab === "timeline" ? <Timeline events={events} session={session}/> : <Final session={session}/>}
  </main>;
}

function AssessmentRail({ session, evidence, note, setNote, open, onOpenFinding }: { session: InterviewerSession; evidence: RubricEvidence[]; note: string; setNote: (value:string)=>void; open:boolean; onOpenFinding: (finding: ResolvedFinding) => void }) {
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  return <aside className={`assessment-rail ${open ? "drawer-open" : ""}`}><header><div><Bot/><span><strong>AI assessment</strong><small>Updated live · preliminary</small></span></div><b>Private</b></header><div className="preliminary"><Sparkles/>Preliminary until review is submitted</div><p className="assessment-summary">{session.liveAssessment?.summary ?? "Waiting for the candidate’s first review signal…"}</p><div className="coverage-bar"><span style={{width:`${evidence.length ? evidence.filter((e) => e.state === "caught").length / evidence.length * 100 : 0}%`}}/></div><div className="assessment-list">{session.findings.map((finding) => {
    const item = evidence.find((entry) => entry.findingId === finding.id);
    const state = item?.state ?? "not-discussed";
    const expanded = expandedFindingId === finding.id;
    const guideId = `finding-guide-${finding.id}`;
    const variant = session.challenge.variants[session.language];
    const sourceFile = variant?.files.find((file) => file.path === finding.file);
    const referenceFile = variant?.referenceFiles.find((file) => file.path === finding.file);
    const example = sourceFile && referenceFile ? referenceSnippet(sourceFile.headContent, referenceFile.headContent, finding.line) : undefined;
    return <article key={finding.id} className={`state-${state} ${expanded ? "expanded" : ""}`}>
      <button className="assessment-item-toggle" type="button" aria-expanded={expanded} aria-controls={guideId} onClick={() => setExpandedFindingId(expanded ? null : finding.id)}>
        <span className="assessment-state-icon">{state === "caught" ? <Check/> : <Circle/>}</span>
        <span className="assessment-item-title"><strong>{finding.title}</strong><small>{item?.note ?? "No evidence yet."}</small></span>
        <span className="assessment-item-status"><em>{state.replace("-"," ")}</em><ChevronDown/></span>
      </button>
      {expanded ? <FindingGuide finding={finding} id={guideId} example={example} onOpenFinding={onOpenFinding}/> : null}
      <footer><code>{finding.file}:{finding.line}</code><span>{item?.confidence ?? "low"} confidence</span></footer>
    </article>;
  })}</div><label className="private-note"><span>Private interviewer notes <small>Autosaved · never sent to AI</small></span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Capture follow-up questions or observations…"/></label></aside>;
}

function FindingGuide({ finding, id, example, onOpenFinding }: { finding: ResolvedFinding; id: string; example?: { code: string; startLine: number }; onOpenFinding: (finding: ResolvedFinding) => void }) {
  const categoryPrompt: Record<ResolvedFinding["category"], string> = {
    security: "Which input or trust boundary does this code rely on?",
    performance: "How does this behave as traffic or data volume grows?",
    testing: "What makes this test unreliable or too weak to protect the behavior?",
    accessibility: "How would someone using assistive technology experience this?",
    design: "How will this design behave across instances, retries, or failures?",
    bug: "Can you trace an example where the current behavior produces the wrong result?",
    style: "What information would a caller need to use this safely?",
  };

  return <section className="finding-guide" id={id} aria-label={`Interviewer guide for ${finding.title}`}>
    <div className="finding-guide-label"><Lightbulb/>Expected answer</div>
    <p>{finding.description}</p>
    {example ? <div className="example-fix"><div><span>Example fix</span><code>{finding.file}</code></div><pre><code>{example.code}</code></pre><small>Reference implementation · lines {example.startLine}–{example.startLine + example.code.split("\n").length - 1}</small></div> : null}
    <div className="finding-guide-label">Guide without giving it away</div>
    <ul><li>{categoryPrompt[finding.category]}</li><li>What test would fail before this was fixed?</li></ul>
    <button type="button" onClick={() => onOpenFinding(finding)}><FileCode2/>Open {finding.file}:{finding.line}</button>
  </section>;
}

function referenceSnippet(headContent: string, referenceContent: string, findingLine: number) {
  const diff = diffLines(headContent, referenceContent);
  const anchorIndex = diff.findIndex((line) => line.oldLine === findingLine);
  if (anchorIndex < 0) return undefined;

  let targetIndex = anchorIndex;
  if (diff[targetIndex]?.type === "same") {
    for (let distance = 1; distance <= 8; distance++) {
      const before = diff[targetIndex - distance];
      const after = diff[targetIndex + distance];
      if (before && before.type !== "same") { targetIndex -= distance; break; }
      if (after && after.type !== "same") { targetIndex += distance; break; }
    }
  }

  let targetLine = diff[targetIndex]?.newLine;
  for (let distance = 1; !targetLine && distance < diff.length; distance++) {
    targetLine = diff[targetIndex + distance]?.newLine ?? diff[targetIndex - distance]?.newLine;
  }
  if (!targetLine) return undefined;

  const lines = referenceContent.split("\n");
  const startLine = Math.max(1, targetLine - 4);
  const endLine = Math.min(lines.length, targetLine + 4);
  return { code: lines.slice(startLine - 1, endLine).join("\n"), startLine };
}
function Rubric({ session, evidence }: { session: InterviewerSession; evidence: RubricEvidence[] }) { return <section className="report-panel"><h1>Live rubric coverage</h1><p>No numeric score is shown until final grading. Evidence updates as comments, revisions, and checks arrive.</p><div className="rubric-grid">{session.findings.map((finding) => { const item = evidence.find((e) => e.findingId === finding.id); return <article key={finding.id}><header><span className={`severity ${finding.severity}`}>{finding.severity}</span><em>{item?.state ?? "not-discussed"}</em></header><h3>{finding.title}</h3><p>{finding.description}</p><code>{finding.file}:{finding.line}</code><small>{item?.note ?? "No evidence yet."}</small></article>; })}</div></section>; }
function Timeline({ events, session }: { events: SessionEvent[]; session: InterviewerSession }) { const fallback: SessionEvent[] = [{ id:0,sessionId:session.id,type:"session.created",actor:"system",payload:{},createdAt:session.createdAt }]; const items = events.length ? events : fallback; return <section className="report-panel"><h1>Session timeline</h1><div className="timeline">{[...items].reverse().map((event) => <article key={event.id}><span/><time>{new Date(event.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}</time><div><strong>{event.type.replace("."," ")}</strong><p>{event.actor} · event #{event.id}</p></div></article>)}</div></section>; }
function Final({ session }: { session: InterviewerSession }) { return <section className="report-panel"><h1>Final report</h1>{session.status !== "completed" ? <div className="report-wait"><MessageSquare/><h2>Interview still in progress</h2><p>The final report replaces the preliminary assessment after the candidate submits changes.</p></div> : <div className="final-grid"><article><span>Review</span><strong>{session.grading?.score ?? "Pending"}</strong><p>{session.grading?.summary ?? "Complete assessment queued."}</p></article><article><span>Implementation</span><strong>{session.fixEvaluation?.score ?? "Pending"}</strong><p>{session.fixEvaluation?.summary ?? "Sandbox results and final assessment queued."}</p></article></div>}</section>; }
