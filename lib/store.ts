import { randomBytes } from "crypto";
import type { Session } from "./types";

/**
 * In-memory session store, kept on globalThis so it survives HMR in dev.
 *
 * NOTE: this is fine for local demos and short-lived interviews on a single
 * warm instance, but on Vercel state is per-instance and non-durable. Swap
 * this module for Redis/Postgres (Vercel Marketplace) before real use — the
 * rest of the app only talks to the functions below.
 */
const g = globalThis as unknown as { __interviewSessions?: Map<string, Session> };
const sessions: Map<string, Session> = (g.__interviewSessions ??= new Map());

export function newId(bytes = 6): string {
  return randomBytes(bytes).toString("base64url");
}

export function createSession(
  input: Pick<Session, "challengeId" | "language" | "candidateName">,
): Session {
  const session: Session = {
    id: newId(),
    interviewerKey: newId(9),
    createdAt: Date.now(),
    status: "review",
    comments: [],
    overallNote: "",
    gradingStatus: "none",
    fixStatus: "none",
    ...input,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function listSessions(): Session[] {
  return Array.from(sessions.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function updateSession(
  id: string,
  patch: Partial<Session>,
): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  Object.assign(session, patch);
  return session;
}
