import "server-only";
import { start } from "workflow/api";
import { finalAssessmentWorkflow, liveAssessmentWorkflow } from "@/workflows/assessment";
import { checkRunWorkflow } from "@/workflows/checks";

export async function queueFinalAssessment(sessionId: string, revision: number, kind: "review" | "fix") {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) return undefined;
  return start(finalAssessmentWorkflow, [sessionId, revision, kind]);
}

export async function queueCheckRun(sessionId: string, revision: number) {
  return start(checkRunWorkflow, [sessionId, revision]);
}

export async function queueLiveAssessment(sessionId: string, revision: number, basedOnEventId: number) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) return undefined;
  return start(liveAssessmentWorkflow, [sessionId, revision, basedOnEventId]);
}
