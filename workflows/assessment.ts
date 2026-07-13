import { applyLiveWorkflowResult, applyWorkflowResult, getSessionInternal } from "@/lib/store";
import { evaluateFix, gradeLiveEvidence, gradeReview } from "@/lib/grading";
import { getVariant, resolveFindings } from "@/lib/challenges";

export async function finalAssessmentWorkflow(sessionId: string, basedOnRevision: number, kind: "review" | "fix") {
  "use workflow";
  return finalAssessmentStep(sessionId, basedOnRevision, kind);
}

export async function liveAssessmentWorkflow(sessionId: string, basedOnRevision: number, basedOnEventId: number) {
  "use workflow";
  return liveAssessmentStep(sessionId, basedOnRevision, basedOnEventId);
}

async function liveAssessmentStep(sessionId: string, basedOnRevision: number, basedOnEventId: number) {
  "use step";
  const session = await getSessionInternal(sessionId);
  if (!session || session.revision !== basedOnRevision || (session.liveAssessment?.basedOnEventId ?? 0) > basedOnEventId) return { ignored: "stale" as const };
  const findings = resolveFindings(session.challenge, session.language);
  const assessment = await gradeLiveEvidence(session, findings);
  return { applied: await applyLiveWorkflowResult(sessionId, basedOnRevision, basedOnEventId, assessment) };
}

async function finalAssessmentStep(sessionId: string, basedOnRevision: number, kind: "review" | "fix") {
  "use step";
  const session = await getSessionInternal(sessionId);
  if (!session || session.revision !== basedOnRevision) return { ignored: "stale" as const };
  const variant = getVariant(session.challenge, session.language); if (!variant) throw new Error("Invalid snapshotted challenge variant");
  const findings = resolveFindings(session.challenge, session.language);
  const applied = kind === "review"
    ? await applyWorkflowResult(sessionId, basedOnRevision, { kind, value: await gradeReview(session, session.challenge, variant, findings) })
    : await applyWorkflowResult(sessionId, basedOnRevision, { kind, value: await evaluateFix(session, session.challenge, variant, findings) });
  return { applied };
}
