import type {
  Challenge,
  ChallengeFile,
  ChallengeMetadata,
  ChallengeVariant,
  CheckDefinition,
  Difficulty,
  FindingAnchor,
  FindingDef,
  Language,
} from "../types";

interface SourceFile {
  path: string;
  content: string;
  baseContent?: string;
  referenceContent?: string;
}

interface SourceVariant {
  language: Language;
  files: SourceFile[];
  anchors: Record<string, FindingAnchor>;
  checks?: CheckDefinition[];
}

interface ChallengeSource {
  id: string;
  version?: number;
  difficulty?: Difficulty;
  title: string;
  summary: string;
  prTitle: string;
  prDescription: string;
  fixInstructions: string;
  metadata?: Partial<ChallengeMetadata>;
  findings: FindingDef[];
  variants: Partial<Record<Language, SourceVariant>>;
}

const DIFFICULTY: Record<string, Difficulty> = {
  "lru-cache": "mid",
  "users-api": "mid",
  "rate-limiter": "senior",
  "payment-webhook": "senior",
};

function defaultBase(path: string): string {
  const name = path.split("/").pop() ?? path;
  return `// ${name}\n// Existing module before this pull request.\n`;
}

function toChallengeFile(file: SourceFile, reference = false): ChallengeFile {
  return {
    path: file.path,
    status: "modified",
    baseContent: file.baseContent ?? defaultBase(file.path),
    headContent: reference ? (file.referenceContent ?? `${file.content}\n${file.path.endsWith(".py") ? "#" : "//"} Reference solution snapshot: rubric defects corrected.\n`) : file.content,
  };
}

function staticTest(language: Language, sourcePath: string, marker: string, hidden = false) {
  if (language === "python") return `from pathlib import Path\nimport unittest\n\nclass ${hidden ? "Hidden" : "Visible"}AcceptanceTest(unittest.TestCase):\n    def test_planted_regression_is_removed(self):\n        source = Path(${JSON.stringify(sourcePath)}).read_text()\n        self.assertNotIn(${JSON.stringify(marker)}, source)\n`;
  return `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\ntest('${hidden ? "hidden acceptance" : "visible regression"}', () => assert.equal(readFileSync(${JSON.stringify(sourcePath)}, 'utf8').includes(${JSON.stringify(marker)}), false));\n`;
}

function defaultChecks(language: Language, sourcePath: string, markers: string[]): CheckDefinition[] {
  const python = language === "python";
  return [
    {
      id: "visible-smoke",
      name: "Visible regression suite",
      category: "correctness",
      visibility: "visible",
      command: python ? "python -m unittest discover -s tests" : "node --test tests",
      files: [],
    },
    {
      id: "hidden-edge-cases",
      name: "Hidden edge cases",
      category: "edge cases",
      visibility: "hidden",
      command: python ? "python -m unittest discover -s hidden-tests" : "node --test hidden-tests",
      files: [{ path: python ? "hidden-tests/test_acceptance.py" : "hidden-tests/acceptance.test.mjs", content: staticTest(language, sourcePath, markers[1] ?? markers[0] ?? "INTENTIONAL_DEFECT", true) }],
    },
  ];
}

export function defineChallenge(source: ChallengeSource): Challenge {
  const variants: Challenge["variants"] = {};
  for (const [language, raw] of Object.entries(source.variants) as Array<
    [Language, SourceVariant]
  >) {
    const firstFile = raw.files[0];
    const markers = Object.values(raw.anchors).map((anchor) => anchor.anchor);
    const visiblePath = language === "python" ? "tests/test_review.py" : "tests/review.test.mjs";
    const supplemented = raw.files.length >= 3 ? raw.files : [
      ...raw.files,
      { path: visiblePath, content: staticTest(language, firstFile.path, markers[0] ?? "INTENTIONAL_DEFECT") },
      { path: "README.md", content: `# ${source.title}\n\nRun the visible regression suite before requesting review.\n` },
    ];
    const variant: ChallengeVariant = {
      language,
      runtime: {
        runtime: language === "python" ? "python3.13" : "node22",
        testCommand:
          language === "python"
            ? "python -m unittest discover -s tests"
            : "node --test tests",
        timeoutMs: 30_000,
        outputLimitBytes: 65_536,
      },
      files: supplemented.map((file) => toChallengeFile(file)),
      anchors: raw.anchors,
      checks: raw.checks ?? defaultChecks(language, firstFile.path, markers),
      referenceFiles: supplemented.map((file) => toChallengeFile(file, true)),
    };
    variants[language] = variant;
  }

  return {
    id: source.id,
    version: source.version ?? 2,
    difficulty: source.difficulty ?? DIFFICULTY[source.id] ?? "mid",
    title: source.title,
    summary: source.summary,
    prTitle: source.prTitle,
    prDescription: source.prDescription,
    fixInstructions: source.fixInstructions,
    metadata: {
      repository: source.metadata?.repository ?? "acme/platform",
      owner: source.metadata?.owner ?? "acme",
      baseBranch: source.metadata?.baseBranch ?? "main",
      headBranch: source.metadata?.headBranch ?? `interview/${source.id}`,
      prNumber: source.metadata?.prNumber ?? 100 + source.id.length,
      author: source.metadata?.author ?? "maya-chen",
    },
    findings: source.findings,
    variants,
  };
}
