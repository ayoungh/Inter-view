import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  Challenge,
  ChallengeFile,
  ChallengeVariant,
  FixEvaluation,
  GradingResult,
  ResolvedFinding,
  Session,
} from "./types";

const MODEL = process.env.INTERVIEW_GRADER_MODEL ?? "anthropic/claude-sonnet-5";

function numberLines(content: string): string {
  return content
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4)} | ${line}`)
    .join("\n");
}

function renderFiles(files: ChallengeFile[]): string {
  return files
    .map((f) => `### ${f.path}\n\`\`\`\n${numberLines(f.content)}\n\`\`\``)
    .join("\n\n");
}

function renderFindings(findings: ResolvedFinding[]): string {
  return findings
    .map(
      (f) =>
        `- id: ${f.id} | ${f.severity} ${f.category} | ${f.file}:${f.line}\n  ${f.title}\n  ${f.description}`,
    )
    .join("\n");
}

const gradingSchema = z.object({
  matches: z
    .array(
      z.object({
        findingId: z.string().describe("id of the expected finding"),
        quality: z
          .enum(["full", "partial", "missed"])
          .describe(
            "full = candidate clearly identified the problem; partial = touched the right line or symptom without nailing the root cause; missed = no relevant comment",
          ),
        matchedCommentIds: z
          .array(z.string())
          .describe("ids of candidate comments that address this finding"),
        note: z
          .string()
          .describe("one sentence for the interviewer explaining the judgement"),
      }),
    )
    .describe("one entry per expected finding, in the order given"),
  extraComments: z
    .array(
      z.object({
        commentId: z.string(),
        assessment: z.enum(["valid-insight", "neutral", "incorrect"]),
        note: z.string(),
      }),
    )
    .describe(
      "candidate comments that did NOT match any expected finding, each assessed on its own merits",
    ),
  score: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "overall review score 0-100, weighting critical findings heaviest",
    ),
  summary: z
    .string()
    .describe("2-3 sentence overall assessment written for the interviewer"),
  strengths: z.array(z.string()).describe("short bullet points"),
  gaps: z.array(z.string()).describe("short bullet points"),
});

export async function gradeReview(
  session: Session,
  challenge: Challenge,
  variant: ChallengeVariant,
  findings: ResolvedFinding[],
): Promise<GradingResult> {
  const comments =
    session.comments
      .map((c) => `- id: ${c.id} | ${c.file}:${c.line}\n  ${c.body}`)
      .join("\n") || "(no line comments)";

  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: gradingSchema }),
    prompt: `You are grading a code-review exercise from a live technical interview.

The candidate was shown a pull request ("${challenge.prTitle}") containing deliberately flawed code and asked to review it like a normal PR, leaving comments on specific lines.

## The code under review
${renderFiles(variant.files)}

## Expected findings (planted defects)
${renderFindings(findings)}

## Candidate's line comments
${comments}

## Candidate's overall review note
${session.overallNote || "(none)"}

Grade the review:
- For every expected finding, decide whether the candidate caught it (full/partial/missed) and which comment ids support that. A comment can match on substance even if it is on a nearby line; a comment merely near the right line without the right reasoning is at best "partial". Consider the overall note too — a finding raised only there still counts, with matchedCommentIds left empty.
- Assess leftover comments that matched nothing: genuine extra insight, neutral/nitpick, or incorrect.
- Score 0-100: critical findings matter most, majors next, minors least; reward valid extra insights slightly, penalise confidently-wrong comments slightly.`,
  });

  return output as GradingResult;
}

const fixSchema = z.object({
  findings: z.array(
    z.object({
      findingId: z.string(),
      status: z.enum(["fixed", "partially-fixed", "not-fixed"]),
      note: z.string().describe("one sentence explaining the judgement"),
    }),
  ),
  regressions: z
    .array(z.string())
    .describe("new problems the candidate introduced, if any"),
  score: z.number().min(0).max(100),
  summary: z.string().describe("2-3 sentence assessment for the interviewer"),
});

export async function evaluateFix(
  session: Session,
  challenge: Challenge,
  variant: ChallengeVariant,
  findings: ResolvedFinding[],
): Promise<FixEvaluation> {
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: fixSchema }),
    prompt: `You are grading the "fix the code" phase of a live technical interview.

The candidate reviewed a deliberately flawed pull request and was then asked to fix it.

Instructions given to the candidate:
${challenge.fixInstructions}

## Original (flawed) code
${renderFiles(variant.files)}

## Known defects that should be fixed
${renderFindings(findings)}

## Candidate's revised code
${renderFiles(session.fixFiles ?? [])}

For each known defect, judge whether the revised code fixes it (fixed / partially-fixed / not-fixed) with a one-sentence note. List any regressions or new bugs the revision introduces. Score 0-100 weighting critical defects heaviest and penalising regressions.`,
  });

  return output as FixEvaluation;
}
