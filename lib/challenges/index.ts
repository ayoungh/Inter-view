import type {
  Challenge,
  ChallengeVariant,
  Language,
  ResolvedFinding,
} from "../types";
import { lruCache } from "./lru-cache";
import { usersApi } from "./users-api";
import { rateLimiter } from "./rate-limiter";
import { paymentWebhook } from "./payment-webhook";
import {
  csvImport,
  flakyTests,
  orderTransfer,
  queueWorker,
  reactSearch,
  tenantDocuments,
} from "./expanded";

export const challenges: Challenge[] = [
  lruCache,
  usersApi,
  rateLimiter,
  paymentWebhook,
  reactSearch,
  orderTransfer,
  queueWorker,
  tenantDocuments,
  csvImport,
  flakyTests,
];

export function getChallenge(id: string): Challenge | undefined {
  return challenges.find((c) => c.id === id);
}

export function getVariant(
  challenge: Challenge,
  language: Language,
): ChallengeVariant | undefined {
  return challenge.variants[language];
}

/**
 * Resolve each finding's anchor substring to a 1-indexed line number in the
 * variant's files, so we never hand-maintain line numbers in challenge data.
 */
export function resolveFindings(
  challenge: Challenge,
  language: Language,
): ResolvedFinding[] {
  const variant = getVariant(challenge, language);
  if (!variant) return [];

  return challenge.findings.map((finding) => {
    const anchor = variant.anchors[finding.id];
    let line = 1;
    if (anchor) {
      const file = variant.files.find((f) => f.path === anchor.file);
      if (file) {
        const idx = file.headContent.indexOf(anchor.anchor);
        if (idx >= 0) {
          line = file.headContent.slice(0, idx).split("\n").length;
        }
      }
    }
    return { ...finding, file: anchor?.file ?? variant.files[0].path, line };
  });
}
