"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Bot, Check, ChevronDown, ChevronRight, Circle, Clock3, Copy, FileCode2, FileText, Lightbulb, MessageSquare, PanelRight, Save, Sparkles, X } from "lucide-react";
import type { InterviewerSession } from "@/app/report/[id]/page";
import type { InterviewDecision, InterviewerRubricDecision, ResolvedFinding, RubricEvidence, RubricState, SessionEvent } from "@/lib/types";
import { diffLines } from "@/lib/diff";
import { PrDiff } from "./PrDiff";

type ReportTab = "live" | "rubric" | "timeline" | "final";

export function ReportView({ session, reportKey, events }: { session: InterviewerSession; reportKey: string; events: SessionEvent[] }) {
  const [tab, setTab] = useState<ReportTab>("live");
  const [activeFile, setActiveFile] = useState(session.files[0]?.path ?? "");
  const [note, setNote] = useState(session.interviewerNote?.body ?? "");
  const [noteStatus, setNoteStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [railOpen, setRailOpen] = useState(false);
  const [decisionOverrides, setDecisionOverrides] = useState<Record<string, InterviewerRubricDecision>>({});
  const file = (session.fixFiles ?? session.files).find((item) => item.path === activeFile) ?? session.files[0];
  const evidence = useMemo(() => session.liveAssessment?.evidence ?? [], [session.liveAssessment?.evidence]);
  const decisions = useMemo(() => {
    const items = new Map((session.interviewerDecisions ?? []).map((item) => [item.findingId, item]));
    Object.values(decisionOverrides).forEach((item) => items.set(item.findingId, item));
    return [...items.values()];
  }, [decisionOverrides, session.interviewerDecisions]);
  const markers = useMemo(() => session.findings.filter((finding) => finding.file === file.path).map((finding) => {
    const state = effectiveState(finding.id, evidence, decisions);
    return { line: finding.line, tone: state === "caught" ? "#2da44e" : state === "developing" || state === "partial" ? "#bf8700" : "#cf222e", label: `${finding.title}: ${state}` };
  }), [decisions, evidence, file.path, session.findings]);

  async function saveNote(value: string) {
    setNoteStatus("saving");
    try {
      const res = await fetch(`/api/sessions/${session.id}/note`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: reportKey, body: value }) });
      if (!res.ok) throw new Error();
      setNoteStatus("saved");
    } catch {
      setNoteStatus("error");
    }
  }

  async function saveRubricDecision(input: Omit<InterviewerRubricDecision, "updatedAt">) {
    const res = await fetch(`/api/sessions/${session.id}/rubric-decision`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: reportKey, ...input }) });
    if (!res.ok) return false;
    const data = await res.json();
    setDecisionOverrides((current) => ({ ...current, [input.findingId]: data.decision }));
    return true;
  }

  function openFinding(finding: ResolvedFinding) {
    setActiveFile(finding.file);
    setTab("live");
  }

  return <main className="live-app">
    <header className="live-top"><Link className="brand" href="/"><span>IV</span>Inter-View</Link><div className="live-title"><strong>{session.candidateName}</strong><span>{session.challenge.title}</span></div><div className="live-presence" role="status"><span className="live-dot" aria-hidden="true" />Candidate {session.status === "review" ? "reviewing" : session.status === "fixing" ? "implementing" : "submitted"}<b>{session.status === "completed" ? "Complete" : "Live"}</b></div></header>
    <nav className="live-tabs" aria-label="Interview report"><TabButton active={tab === "live"} onClick={() => setTab("live")} icon={<Activity />} label="Live review" /><TabButton active={tab === "rubric"} onClick={() => setTab("rubric")} icon={<Sparkles />} label="Rubric" /><TabButton active={tab === "timeline"} onClick={() => setTab("timeline")} icon={<Clock3 />} label="Timeline" /><TabButton active={tab === "final"} onClick={() => setTab("final")} icon={<FileText />} label="Decision" /><span>Session #{session.id.slice(0, 8)}</span><button aria-label="Toggle interviewer guide" className="rail-toggle" onClick={() => setRailOpen(!railOpen)}><PanelRight /></button></nav>
    <div className="sr-only" aria-live="polite">{session.liveAssessment?.summary ?? "Waiting for candidate evidence"}</div>
    {tab === "live" ? <div className="live-layout"><aside className="live-files"><h3>Files changed <b>{session.files.length}</b></h3><div className="tree-root"><ChevronRight />src</div>{session.files.map((item) => { const count = session.comments.filter((comment) => comment.file === item.path).length; return <button className={item.path === file.path ? "active" : ""} key={item.path} onClick={() => setActiveFile(item.path)}><FileCode2 /><span>{item.path}</span>{count ? <b>{count}</b> : null}</button>; })}<section className="candidate-card"><h4>Candidate activity</h4><div><span className="avatar">{session.candidateName.slice(0, 2).toUpperCase()}</span><p><strong>{session.candidateName}</strong><small><i aria-hidden="true" /> {session.status === "completed" ? "Submitted" : "Session active"}</small></p></div><dl><dt>Comments</dt><dd>{session.comments.length}</dd><dt>Revisions</dt><dd>{session.revision}</dd><dt>Checks</dt><dd>{session.checkRuns.length}</dd></dl></section></aside>
      <section className="live-canvas"><div className="live-filebar"><div><span className="status-badge">M</span><strong>{file.path}</strong></div><span>Candidate activity updates live</span></div><PrDiff file={file} comments={session.comments} markers={markers} /></section>
      <AssessmentRail session={session} evidence={evidence} decisions={decisions} note={note} noteStatus={noteStatus} setNote={(value) => { setNote(value); setNoteStatus("dirty"); }} saveNote={() => void saveNote(note)} open={railOpen} onOpenFinding={openFinding} onDecision={saveRubricDecision} /></div>
      : tab === "rubric" ? <Rubric session={session} evidence={evidence} decisions={decisions} onOpenFinding={openFinding} />
      : tab === "timeline" ? <Timeline events={events} session={session} onOpenFinding={(filePath) => { setActiveFile(filePath); setTab("live"); }} />
      : <Final session={session} reportKey={reportKey} decisions={decisions} />}
  </main>;
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={onClick}>{icon}{label}</button>;
}

function AssessmentRail({ session, evidence, decisions, note, noteStatus, setNote, saveNote, open, onOpenFinding, onDecision }: { session: InterviewerSession; evidence: RubricEvidence[]; decisions: InterviewerRubricDecision[]; note: string; noteStatus: string; setNote: (value: string) => void; saveNote: () => void; open: boolean; onOpenFinding: (finding: ResolvedFinding) => void; onDecision: (input: Omit<InterviewerRubricDecision, "updatedAt">) => Promise<boolean> }) {
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [adjustedStates, setAdjustedStates] = useState<Record<string, RubricState>>({});
  const confirmed = decisions.filter((item) => item.verdict !== "insufficient").length;
  return <aside className={`assessment-rail ${open ? "drawer-open" : ""}`}><header><div><Bot /><span><strong>Interviewer guide</strong><small>AI evidence · requires your judgment</small></span></div><b>Private</b></header><div className="preliminary"><Sparkles />Advisory only — confirm evidence yourself</div><p className="assessment-summary">{session.liveAssessment?.summary ?? "Waiting for the candidate’s first review signal…"}</p><div className="coverage-label"><span>{confirmed} of {session.findings.length} reviewed by interviewer</span></div><div className="coverage-bar"><span style={{ width: `${session.findings.length ? confirmed / session.findings.length * 100 : 0}%` }} /></div><div className="assessment-list">{session.findings.map((finding) => {
    const item = evidence.find((entry) => entry.findingId === finding.id);
    const decision = decisions.find((entry) => entry.findingId === finding.id);
    const state = effectiveState(finding.id, evidence, decisions);
    const expanded = expandedFindingId === finding.id;
    const guideId = `finding-guide-${finding.id}`;
    const variant = session.challenge.variants[session.language];
    const sourceFile = variant?.files.find((entry) => entry.path === finding.file);
    const referenceFile = variant?.referenceFiles.find((entry) => entry.path === finding.file);
    const example = sourceFile && referenceFile ? referenceSnippet(sourceFile.headContent, referenceFile.headContent, finding.line) : undefined;
    const citedComments = session.comments.filter((comment) => item?.commentIds.includes(comment.id));
    return <article key={finding.id} className={`state-${state} ${expanded ? "expanded" : ""}`}>
      <button className="assessment-item-toggle" type="button" aria-expanded={expanded} aria-controls={guideId} onClick={() => setExpandedFindingId(expanded ? null : finding.id)}><span className="assessment-state-icon">{decision?.verdict === "insufficient" ? <X /> : decision ? <Check /> : <Circle />}</span><span className="assessment-item-title"><strong>{finding.title}</strong><small>{decision ? decisionLabel(decision) : item?.note ?? "No evidence yet."}</small></span><span className="assessment-item-status"><em>{decision ? "reviewed" : state.replace("-", " ")}</em><ChevronDown /></span></button>
      {expanded ? <FindingGuide finding={finding} id={guideId} example={example} evidence={item} citedComments={citedComments} onOpenFinding={onOpenFinding} /> : null}
      {expanded ? <div className="judgment-controls"><p>Your judgment</p><div><button type="button" className={decision?.verdict === "confirmed" ? "selected" : ""} onClick={() => void onDecision({ findingId: finding.id, verdict: "confirmed", adjustedState: item?.state ?? "not-discussed", note: "Evidence confirmed by interviewer." })}><Check />Confirm</button><button type="button" className={decision?.verdict === "insufficient" ? "selected" : ""} onClick={() => void onDecision({ findingId: finding.id, verdict: "insufficient", note: "Not enough evidence to make this judgment." })}><X />Not enough evidence</button></div><label><span>Adjust assessment</span><select value={adjustedStates[finding.id] ?? state} onChange={(event) => setAdjustedStates((current) => ({ ...current, [finding.id]: event.target.value as RubricState }))}>{["not-discussed", "developing", "caught", "partial", "contradicted"].map((value) => <option key={value} value={value}>{value.replace("-", " ")}</option>)}</select><button type="button" onClick={() => void onDecision({ findingId: finding.id, verdict: "adjusted", adjustedState: adjustedStates[finding.id] ?? state, note: "Assessment adjusted by interviewer." })}>Save adjustment</button></label></div> : null}
      <footer><code>{finding.file}:{finding.line}</code><span>{item?.confidence ?? "low"} AI confidence</span></footer>
    </article>;
  })}</div><label className="private-note"><span>Private interviewer notes <small>{noteStatus === "saving" ? "Saving…" : noteStatus === "saved" ? "Saved" : noteStatus === "error" ? "Save failed" : noteStatus === "dirty" ? "Unsaved changes" : "Never sent to AI"}</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} onBlur={saveNote} placeholder="Capture follow-up questions or observations…" /><button type="button" onClick={saveNote} disabled={noteStatus === "saving" || noteStatus === "idle" || noteStatus === "saved"}><Save />Save notes</button></label></aside>;
}

function FindingGuide({ finding, id, example, evidence, citedComments, onOpenFinding }: { finding: ResolvedFinding; id: string; example?: { code: string; startLine: number }; evidence?: RubricEvidence; citedComments: InterviewerSession["comments"]; onOpenFinding: (finding: ResolvedFinding) => void }) {
  const fallbackPrompt: Record<ResolvedFinding["category"], string> = { security: "Which input or trust boundary does this rely on?", performance: "How does this behave as volume grows?", testing: "What makes this test unreliable?", accessibility: "How would assistive technology experience this?", design: "How does this behave across failures or retries?", bug: "Can you trace a case that produces the wrong result?", style: "What would make this safer for a caller?" };
  const prompts = finding.interviewerPrompts?.length ? finding.interviewerPrompts : [fallbackPrompt[finding.category], "What test would fail before this was fixed?"];
  return <section className="finding-guide" id={id} aria-label={`Interviewer guide for ${finding.title}`}><div className="finding-guide-label"><Lightbulb />What good looks like</div><p>{finding.description}</p>{citedComments.length ? <div className="evidence-quotes"><strong>Evidence cited by AI</strong>{citedComments.map((comment) => <blockquote key={comment.id}><code>{comment.file}:{comment.line}</code><p>{comment.body}</p></blockquote>)}</div> : <p className="no-evidence">No candidate comment is cited for this finding.</p>}<div className="finding-guide-label">Follow-up prompts</div><ul>{prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>{example ? <details className="example-fix"><summary>Show reference approach</summary><div><span>Example fix</span><code>{finding.file}</code></div><pre><code>{example.code}</code></pre><small>Reference implementation · lines {example.startLine}–{example.startLine + example.code.split("\n").length - 1}</small></details> : null}<button type="button" onClick={() => onOpenFinding(finding)}><FileCode2 />Open {finding.file}:{finding.line}</button><small className="ai-evidence-note">AI state: {evidence?.state ?? "not discussed"}; confidence: {evidence?.confidence ?? "low"}</small></section>;
}

function Rubric({ session, evidence, decisions, onOpenFinding }: { session: InterviewerSession; evidence: RubricEvidence[]; decisions: InterviewerRubricDecision[]; onOpenFinding: (finding: ResolvedFinding) => void }) {
  return <section className="report-panel"><h1>Rubric judgments</h1><p>AI organizes evidence. Your confirmations and adjustments are the interview record.</p><div className="rubric-summary"><strong>{decisions.length}/{session.findings.length}</strong><span>areas reviewed by interviewer</span></div><div className="rubric-grid">{session.findings.map((finding) => { const item = evidence.find((entry) => entry.findingId === finding.id); const decision = decisions.find((entry) => entry.findingId === finding.id); return <article key={finding.id}><header><span className={`severity ${finding.severity}`}>{finding.severity}</span><em className={decision ? "human-reviewed" : ""}>{decision ? decisionLabel(decision) : `AI: ${item?.state ?? "not discussed"}`}</em></header><h3>{finding.title}</h3><p>{finding.description}</p><code>{finding.file}:{finding.line}</code><small>{item?.note ?? "No evidence yet."}</small><button type="button" onClick={() => onOpenFinding(finding)}>Open evidence</button></article>; })}</div></section>;
}

function Timeline({ events, session, onOpenFinding }: { events: SessionEvent[]; session: InterviewerSession; onOpenFinding: (file: string) => void }) {
  const [filter, setFilter] = useState<"all" | SessionEvent["actor"]>("all");
  const fallback: SessionEvent[] = [{ id: 0, sessionId: session.id, type: "session.created", actor: "system", payload: { candidateName: session.candidateName }, createdAt: session.createdAt }];
  const items = (events.length ? events : fallback).filter((item) => filter === "all" || item.actor === filter);
  return <section className="report-panel"><h1>Session timeline</h1><p>A readable record of candidate work, checks, and interviewer judgments.</p><div className="timeline-filters" aria-label="Filter timeline">{(["all", "candidate", "system", "ai", "interviewer"] as const).map((value) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "ai" ? "AI" : capitalize(value)}</button>)}</div><div className="timeline">{[...items].reverse().map((item) => { const display = describeEvent(item, session); return <article key={item.id}><span className={`actor-${item.actor}`} aria-hidden="true" /><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{display.title}</strong><p>{display.detail}</p>{display.file ? <button type="button" onClick={() => onOpenFinding(display.file!)}>Open {display.file}</button> : null}</div></article>; })}{items.length === 0 ? <p className="timeline-empty">No {filter} activity yet.</p> : null}</div></section>;
}

function Final({ session, reportKey, decisions }: { session: InterviewerSession; reportKey: string; decisions: InterviewerRubricDecision[] }) {
  const [outcome, setOutcome] = useState<InterviewDecision["outcome"] | "">(session.interviewDecision?.outcome ?? "");
  const [decisionNote, setDecisionNote] = useState(session.interviewDecision?.note ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);
  if (session.status !== "completed") return <section className="report-panel"><h1>Decision workspace</h1><div className="report-wait"><MessageSquare /><h2>Interview still in progress</h2><p>The decision workspace unlocks after the candidate submits the implementation.</p><dl><div><dt>Review comments</dt><dd>{session.comments.length}</dd></div><div><dt>Implementation revisions</dt><dd>{session.revision}</dd></div><div><dt>Checks run</dt><dd>{session.checkRuns.length}</dd></div><div><dt>Rubric judgments</dt><dd>{decisions.length}/{session.findings.length}</dd></div></dl></div></section>;

  const summary = debriefSummary(session, decisions, outcome || undefined, decisionNote);
  async function saveDecision() {
    if (!outcome || !decisionNote.trim()) return;
    setStatus("saving");
    const res = await fetch(`/api/sessions/${session.id}/decision`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: reportKey, outcome, note: decisionNote }) });
    setStatus(res.ok ? "saved" : "error");
  }
  async function copySummary() {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setStatus("error"); }
  }
  return <section className="report-panel decision-workspace"><div className="decision-heading"><div><h1>Decision workspace</h1><p>Review the evidence, then record your own outcome.</p></div><button type="button" onClick={copySummary}><Copy />{copied ? "Copied" : "Copy debrief"}</button></div><div className="score-grid"><article><span>Review assessment</span><strong>{session.grading?.score ?? "Pending"}</strong><p>{session.grading?.summary ?? "Final review assessment is still processing."}</p></article><article><span>Implementation assessment</span><strong>{session.fixEvaluation?.score ?? "Pending"}</strong><p>{session.fixEvaluation?.summary ?? "Implementation assessment is still processing."}</p></article></div><div className="decision-columns"><div><section className="decision-section"><h2>Evidence summary</h2><div className="strength-gap-grid"><div><h3>Strengths</h3><ul>{(session.grading?.strengths ?? []).map((item) => <li key={item}>{item}</li>)}{!session.grading?.strengths?.length ? <li>Assessment pending</li> : null}</ul></div><div><h3>Gaps</h3><ul>{[...(session.grading?.gaps ?? []), ...(session.fixEvaluation?.regressions ?? [])].map((item) => <li key={item}>{item}</li>)}{!session.grading?.gaps?.length && !session.fixEvaluation?.regressions?.length ? <li>Assessment pending</li> : null}</ul></div></div></section><section className="decision-section"><h2>Confirmed rubric outcomes</h2><div className="decision-rubric">{session.findings.map((finding) => { const decision = decisions.find((item) => item.findingId === finding.id); return <div key={finding.id}><span>{decision ? <Check /> : <Circle />}</span><p><strong>{finding.title}</strong><small>{decision ? decisionLabel(decision) : "Not reviewed by interviewer"}</small></p></div>; })}</div></section><section className="decision-section"><h2>Checks</h2>{session.checkRuns.length ? session.checkRuns.map((run) => <div className="check-summary" key={run.id}><strong>Revision {run.revision}</strong><span className={`check-${run.status}`}>{capitalize(run.status)}</span><small>{run.results.length} results</small></div>) : <p className="muted-copy">No checks were recorded.</p>}</section></div><aside className="decision-form"><h2>Your decision</h2><p>AI does not choose this outcome.</p><label><span>Outcome</span><select value={outcome} onChange={(event) => { setOutcome(event.target.value as InterviewDecision["outcome"]); setStatus("idle"); }}><option value="">Choose an outcome</option><option value="strong-yes">Strong yes</option><option value="yes">Yes</option><option value="mixed">Mixed</option><option value="no">No</option><option value="strong-no">Strong no</option></select></label><label><span>Decision note</span><textarea value={decisionNote} onChange={(event) => { setDecisionNote(event.target.value); setStatus("idle"); }} placeholder="Summarize the evidence behind your decision…" /></label><button type="button" disabled={!outcome || !decisionNote.trim() || status === "saving"} onClick={() => void saveDecision()}><Save />{status === "saving" ? "Saving…" : "Save decision"}</button><p className={`decision-save-status status-${status}`} role="status">{status === "saved" ? "Decision saved" : status === "error" ? "Decision could not be saved" : session.interviewDecision ? `Saved ${new Date(session.interviewDecision.updatedAt).toLocaleString()}` : "Required to complete the interviewer record"}</p><section><h3>Private notes</h3><p>{session.interviewerNote?.body || "No private notes recorded."}</p></section></aside></div></section>;
}

function effectiveState(findingId: string, evidence: RubricEvidence[], decisions: InterviewerRubricDecision[]) {
  const decision = decisions.find((item) => item.findingId === findingId);
  if (decision?.verdict === "insufficient") return "not-discussed" satisfies RubricState;
  if (decision?.adjustedState) return decision.adjustedState;
  return evidence.find((item) => item.findingId === findingId)?.state ?? "not-discussed";
}

function decisionLabel(decision: InterviewerRubricDecision) {
  if (decision.verdict === "insufficient") return "Not enough evidence";
  if (decision.verdict === "adjusted") return `Adjusted to ${decision.adjustedState?.replace("-", " ")}`;
  return "Evidence confirmed";
}

function describeEvent(event: SessionEvent, session: InterviewerSession): { title: string; detail: string; file?: string } {
  const payload = event.payload as Record<string, unknown>;
  const comment = payload.comment as { file?: string; line?: number } | undefined;
  const labels: Partial<Record<SessionEvent["type"], { title: string; detail: string }>> = {
    "session.created": { title: "Interview created", detail: `${session.challenge.title} prepared for ${session.candidateName}.` },
    "review.submitted": { title: `${session.candidateName} submitted the review`, detail: `${payload.commentCount ?? session.comments.length} comments moved to implementation.` },
    "revision.saved": { title: `${session.candidateName} saved implementation changes`, detail: `Revision ${payload.revision ?? session.revision} is ready to inspect.` },
    "check.completed": { title: `Checks ${String(payload.status ?? "completed")}`, detail: "Sandbox results were added to the interview record." },
    "assessment.updated": { title: "Evidence guide updated", detail: "AI reorganized the latest signals; interviewer confirmation is still required." },
    "fix.submitted": { title: `${session.candidateName} submitted the implementation`, detail: "The final decision workspace is now available." },
    "note.updated": { title: "Private notes saved", detail: "Interviewer-only notes were updated." },
    "rubric.decision.updated": { title: "Rubric judgment recorded", detail: `${String(payload.verdict ?? "Decision")} for ${String(payload.findingId ?? "a rubric area")}.` },
    "interview.decision.updated": { title: "Final outcome recorded", detail: `Interviewer selected ${String(payload.outcome ?? "an outcome").replace("-", " ")}.` },
  };
  if (event.type === "comment.added" || event.type === "comment.updated") return { title: event.type === "comment.added" ? `${session.candidateName} added a review comment` : `${session.candidateName} updated a review comment`, detail: comment?.file ? `${comment.file}:${comment.line ?? ""}` : "Candidate review evidence changed.", file: comment?.file };
  if (event.type === "comment.deleted") return { title: `${session.candidateName} removed a draft comment`, detail: "The live evidence guide was refreshed." };
  return labels[event.type] ?? { title: capitalize(event.type.replaceAll(".", " ")), detail: `${capitalize(event.actor)} activity` };
}

function debriefSummary(session: InterviewerSession, decisions: InterviewerRubricDecision[], outcome?: InterviewDecision["outcome"], note?: string) {
  const reviewed = session.findings.map((finding) => { const decision = decisions.find((item) => item.findingId === finding.id); return `- ${finding.title}: ${decision ? decisionLabel(decision) : "Not reviewed"}`; }).join("\n");
  return `${session.candidateName} — ${session.challenge.title}\nOutcome: ${outcome ? outcome.replace("-", " ") : "Not recorded"}\nReview: ${session.grading?.score ?? "Pending"}\nImplementation: ${session.fixEvaluation?.score ?? "Pending"}\n\nRubric\n${reviewed}\n\nDecision note\n${note?.trim() || "Not recorded"}`;
}

function referenceSnippet(headContent: string, referenceContent: string, findingLine: number) {
  const diff = diffLines(headContent, referenceContent); const anchorIndex = diff.findIndex((line) => line.oldLine === findingLine); if (anchorIndex < 0) return undefined;
  let targetIndex = anchorIndex;
  if (diff[targetIndex]?.type === "same") { for (let distance = 1; distance <= 8; distance++) { const before = diff[targetIndex - distance]; const after = diff[targetIndex + distance]; if (before && before.type !== "same") { targetIndex -= distance; break; } if (after && after.type !== "same") { targetIndex += distance; break; } } }
  let targetLine = diff[targetIndex]?.newLine; for (let distance = 1; !targetLine && distance < diff.length; distance++) targetLine = diff[targetIndex + distance]?.newLine ?? diff[targetIndex - distance]?.newLine;
  if (!targetLine) return undefined; const lines = referenceContent.split("\n"); const startLine = Math.max(1, targetLine - 4); const endLine = Math.min(lines.length, targetLine + 4); return { code: lines.slice(startLine - 1, endLine).join("\n"), startLine };
}

function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
