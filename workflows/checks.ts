import { addCheckRunInternal, getSessionInternal } from "@/lib/store";
import { runChecks } from "@/lib/server/check-runner";

export async function checkRunWorkflow(sessionId: string, basedOnRevision: number) {
  "use workflow";
  return checkRunStep(sessionId, basedOnRevision);
}

async function checkRunStep(sessionId: string, basedOnRevision: number) {
  "use step";
  const session = await getSessionInternal(sessionId);
  if (!session || session.status !== "fixing" || session.revision !== basedOnRevision) return { ignored: "stale" as const };
  const files = session.fixFiles ?? session.latestRevision?.files;
  if (!files) return { ignored: "no-revision" as const };
  const run = await runChecks(session, files);
  return await addCheckRunInternal(sessionId, basedOnRevision, run) ? { run } : { ignored: "stale" as const };
}
