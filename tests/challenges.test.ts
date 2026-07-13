import { describe, expect, it } from "vitest";
import { challenges, getVariant, resolveFindings } from "@/lib/challenges";

describe("curated challenge registry", () => {
  it("contains ten versioned mid/senior PR exercises", () => {
    expect(challenges).toHaveLength(10);
    expect(new Set(challenges.map((challenge) => challenge.id)).size).toBe(10);
    for (const challenge of challenges) {
      expect(challenge.version).toBeGreaterThan(0);
      expect(["mid", "senior"]).toContain(challenge.difficulty);
      expect(challenge.findings.length).toBeGreaterThanOrEqual(4);
      expect(challenge.findings.length).toBeLessThanOrEqual(7);
      expect(challenge.estimatedMinutes).toBeGreaterThanOrEqual(30);
      expect(challenge.competencies.length).toBeGreaterThan(0);
      for (const finding of challenge.findings) expect(finding.interviewerPrompts?.length).toBeGreaterThan(0);
    }
  });

  it("snapshots realistic files, checks, references, and resolvable anchors", () => {
    for (const challenge of challenges) for (const language of Object.keys(challenge.variants)) {
      const variant = getVariant(challenge, language as keyof typeof challenge.variants);
      expect(variant?.files.length).toBeGreaterThanOrEqual(3);
      expect(variant?.files.length).toBeLessThanOrEqual(5);
      expect(variant?.checks.some((check) => check.visibility === "visible")).toBe(true);
      expect(variant?.checks.some((check) => check.visibility === "hidden")).toBe(true);
      expect(variant?.referenceFiles).toHaveLength(variant?.files.length ?? 0);
      for (const finding of resolveFindings(challenge, language as never)) expect(finding.line).toBeGreaterThan(0);
    }
  });
});
