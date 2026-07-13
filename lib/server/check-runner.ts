import "server-only";

import { randomUUID } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { getVariant } from "../challenges";
import type { ChallengeFile, CheckResult, CheckRun, Session } from "../types";

function safePath(path: string) {
  return path.length > 0 && !path.startsWith("/") && !path.split("/").includes("..") && !path.includes("\0");
}

export async function runChecks(session: Session, files: ChallengeFile[]): Promise<CheckRun> {
  const variant = getVariant(session.challenge, session.language);
  if (!variant) throw new Error("Unsupported challenge runtime");
  const now = Date.now();
  const run: CheckRun = { id: randomUUID(), revision: session.revision, status: "running", results: [], createdAt: now };
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;
  try {
    sandbox = await Sandbox.create({ runtime: variant.runtime.runtime, timeout: Math.min(30_000, variant.runtime.timeoutMs), networkPolicy: "deny-all", env: {} });
    const candidateFiles = files.map((file) => ({ path: `/vercel/sandbox/${file.path}`, content: file.savedContent ?? file.headContent }));
    if (candidateFiles.some((file) => !safePath(file.path.slice("/vercel/sandbox/".length)))) throw new Error("Unsafe challenge file path");
    await sandbox.writeFiles(candidateFiles);
    for (const check of variant.checks) {
      if (check.files.some((file) => !safePath(file.path))) throw new Error("Unsafe check file path");
      if (check.files.length) await sandbox.writeFiles(check.files.map((file) => ({ path: `/vercel/sandbox/${file.path}`, content: file.content })));
      const started = Date.now();
      const python = variant.runtime.runtime === "python3.13";
      const directory = check.visibility === "hidden" ? "hidden-tests" : "tests";
      let result: CheckResult;
      try {
        const command = await sandbox.runCommand(python ? "python" : "node", python ? ["-m", "unittest", "discover", "-s", directory] : ["--test", directory], { timeoutMs: Math.min(30_000, variant.runtime.timeoutMs) });
        const output = (await command.output("both")).slice(0, variant.runtime.outputLimitBytes);
        result = { checkId: check.id, name: check.name, category: check.category, visibility: check.visibility, status: command.exitCode === 0 ? "passed" : "failed", output, durationMs: command.durationMs ?? Date.now() - started };
      } catch (error) {
        result = { checkId: check.id, name: check.name, category: check.category, visibility: check.visibility, status: "error", output: String(error).slice(0, variant.runtime.outputLimitBytes), durationMs: Date.now() - started };
      }
      run.results.push(result);
    }
    run.status = run.results.every((result) => result.status === "passed") ? "passed" : run.results.some((result) => result.status === "error") ? "error" : "failed";
  } catch (error) {
    run.status = "error";
    run.results = [{ checkId: "sandbox", name: "Sandbox availability", category: "infrastructure", visibility: "visible", status: "error", output: `${error instanceof Error ? error.message : String(error)}. Configure VERCEL_OIDC_TOKEN for local sandbox runs.`, durationMs: Date.now() - now }];
  } finally {
    await sandbox?.stop().catch(() => undefined);
    run.completedAt = Date.now();
  }
  return run;
}
