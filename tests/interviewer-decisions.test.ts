import { beforeAll, describe, expect, it } from "vitest";
import { challenges } from "@/lib/challenges";
import { createSession, getInterviewerSession, listSessions, submitFix, submitReview, updateInterviewDecision, updateRubricDecision } from "@/lib/store";

beforeAll(() => {
  process.env.SESSION_SECRET = "interviewer-decision-test-secret";
  process.env.INTERVIEW_DEMO_MODE = "1";
  delete process.env.DATABASE_URL;
});

describe("interviewer-owned decisions", () => {
  it("recovers candidate links for authenticated listings and persists human rubric judgments", async () => {
    const created = await createSession({ challenge: challenges[0], language: "javascript", candidateName: "Jordan" });
    const listed = (await listSessions()).find((item) => item.session.id === created.session.id);
    expect(listed?.candidateToken).toBe(created.candidateToken);
    expect(listed?.reportToken).toBe(created.reportToken);

    const findingId = challenges[0].findings[0].id;
    const decision = await updateRubricDecision(created.session.id, created.reportToken, {
      findingId,
      verdict: "confirmed",
      adjustedState: "caught",
      note: "Confirmed from the candidate explanation.",
    });
    expect(decision?.verdict).toBe("confirmed");
    expect((await getInterviewerSession(created.session.id, created.reportToken))?.interviewerDecisions?.[0].findingId).toBe(findingId);
  });

  it("rejects a final outcome until the interview is complete", async () => {
    const created = await createSession({ challenge: challenges[0], language: "javascript", candidateName: "Sam" });
    expect(await updateInterviewDecision(created.session.id, created.reportToken, { outcome: "yes", note: "Too early" })).toBeUndefined();
    await submitReview(created.candidateToken, "Review complete");
    await submitFix(created.candidateToken);
    const saved = await updateInterviewDecision(created.session.id, created.reportToken, { outcome: "yes", note: "Strong evidence across review and implementation." });
    expect(saved?.outcome).toBe("yes");
  });
});
