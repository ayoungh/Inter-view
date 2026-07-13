import type {
  CheckDefinition,
  Difficulty,
  FindingCategory,
  FindingSeverity,
  Language,
} from "../types";
import { defineChallenge } from "./helpers";

interface ScenarioFinding {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  severity: FindingSeverity;
  anchor: string;
  interviewerPrompts?: string[];
}

interface ScenarioLanguage {
  language: Language;
  path: string;
  flawed: string;
  fixed: string;
  failureMarker: string;
  successMarker: string;
}

interface Scenario {
  id: string;
  difficulty: Difficulty;
  title: string;
  summary: string;
  prTitle: string;
  description: string;
  instructions: string;
  repository: string;
  estimatedMinutes?: number;
  competencies?: string[];
  findings: ScenarioFinding[];
  languages: ScenarioLanguage[];
}

function nodeVisibleTest(path: string, failureMarker: string): string {
  return `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('implementation removes the known regression', () => {
  const source = readFileSync(${JSON.stringify(path)}, 'utf8');
  assert.equal(source.includes(${JSON.stringify(failureMarker)}), false);
});
`;
}

function nodeHiddenTest(path: string, successMarker: string): string {
  return `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('implementation contains the required production safeguard', () => {
  const source = readFileSync(${JSON.stringify(path)}, 'utf8');
  assert.equal(source.includes(${JSON.stringify(successMarker)}), true);
});
`;
}

function pythonVisibleTest(path: string, failureMarker: string): string {
  return `from pathlib import Path
import unittest

class ReviewTests(unittest.TestCase):
    def test_known_regression_is_removed(self):
        source = Path(${JSON.stringify(path)}).read_text()
        self.assertNotIn(${JSON.stringify(failureMarker)}, source)
`;
}

function pythonHiddenTest(path: string, successMarker: string): string {
  return `from pathlib import Path
import unittest

class HiddenReviewTests(unittest.TestCase):
    def test_required_safeguard_exists(self):
        source = Path(${JSON.stringify(path)}).read_text()
        self.assertIn(${JSON.stringify(successMarker)}, source)
`;
}

function checksFor(language: ScenarioLanguage): CheckDefinition[] {
  const python = language.language === "python";
  return [
    {
      id: "visible-regression",
      name: "Visible regression suite",
      category: "correctness",
      visibility: "visible",
      command: python
        ? "python -m unittest discover -s tests"
        : "node --test tests",
      files: [],
    },
    {
      id: "hidden-production-safeguard",
      name: "Hidden production safeguards",
      category: "edge cases",
      visibility: "hidden",
      command: python
        ? "python -m unittest discover -s hidden-tests"
        : "node --test hidden-tests",
      files: [
        {
          path: python
            ? "hidden-tests/test_safeguards.py"
            : "hidden-tests/safeguards.test.mjs",
          content: python
            ? pythonHiddenTest(language.path, language.successMarker)
            : nodeHiddenTest(language.path, language.successMarker),
        },
      ],
    },
  ];
}

function scenario(source: Scenario) {
  return defineChallenge({
    id: source.id,
    version: 1,
    difficulty: source.difficulty,
    estimatedMinutes: source.estimatedMinutes,
    competencies: source.competencies,
    title: source.title,
    summary: source.summary,
    prTitle: source.prTitle,
    prDescription: source.description,
    fixInstructions: source.instructions,
    metadata: {
      repository: source.repository,
      headBranch: `feature/${source.id}`,
      prNumber: 200 + source.id.length,
    },
    findings: source.findings.map((finding) => ({ id: finding.id, title: finding.title, description: finding.description, category: finding.category, severity: finding.severity, interviewerPrompts: finding.interviewerPrompts ?? [] })),
    variants: Object.fromEntries(
      source.languages.map((language) => {
        const python = language.language === "python";
        const testPath = python
          ? "tests/test_review.py"
          : "tests/review.test.mjs";
        const visibleTest = python
          ? pythonVisibleTest(language.path, language.failureMarker)
          : nodeVisibleTest(language.path, language.failureMarker);
        return [
          language.language,
          {
            language: language.language,
            files: [
              {
                path: language.path,
                baseContent: `// Existing ${source.title} module before this PR.\n`,
                content: language.flawed,
                referenceContent: language.fixed,
              },
              {
                path: testPath,
                baseContent: "",
                content: visibleTest,
                referenceContent: visibleTest,
              },
              {
                path: "README.md",
                baseContent: "# Service\n",
                content: `# ${source.title}\n\n${source.description}\n`,
                referenceContent: `# ${source.title}\n\n${source.description}\n`,
              },
            ],
            anchors: Object.fromEntries(
              source.findings.map((finding) => [
                finding.id,
                { file: language.path, anchor: finding.anchor },
              ]),
            ),
            checks: checksFor(language),
          },
        ];
      }),
    ),
  });
}

export const reactSearch = scenario({
  id: "react-search-race",
  difficulty: "mid",
  title: "React search results",
  summary:
    "A search UI with stale responses, missing cancellation, unstable list keys, and inaccessible status updates.",
  prTitle: "Add live customer search to the support console",
  description:
    "The search results update while an agent types. Review the async state handling, rendering, and accessibility before rollout.",
  instructions:
    "Prevent stale requests from winning, cancel obsolete work, use stable keys, and make loading/results status accessible.",
  repository: "acme/support-console",
  findings: [
    { id: "search-race", title: "Older responses can overwrite newer results", description: "Requests are not sequenced, so a slow old query can replace the latest results.", category: "bug", severity: "critical", anchor: "setResults(await response.json())" },
    { id: "search-cancel", title: "Obsolete requests are never cancelled", description: "Rapid typing wastes work and updates state after the query has changed.", category: "performance", severity: "major", anchor: "fetch(`/api/customers?q=${query}`)" },
    { id: "search-key", title: "Array indexes are used as keys", description: "Result identity becomes unstable when ranking changes.", category: "bug", severity: "major", anchor: "key={index}" },
    { id: "search-a11y", title: "Loading changes are not announced", description: "Assistive technology receives no live status for an updating result set.", category: "accessibility", severity: "minor", anchor: "<p>Loading…</p>" },
  ],
  languages: [{
    language: "typescript",
    path: "src/SearchResults.tsx",
    failureMarker: "setResults(await response.json())",
    successMarker: "aria-live=\"polite\"",
    flawed: `import { useEffect, useState } from "react";

export function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(\`/api/customers?q=\${query}\`)
      .then(async (response) => setResults(await response.json()))
      .finally(() => setLoading(false));
  }, [query]);

  if (loading) return <p>Loading…</p>;
  return <ul>{results.map((customer, index) => <li key={index}>{customer.name}</li>)}</ul>;
}
`,
    fixed: `import { useEffect, useState } from "react";

export function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(\`/api/customers?q=\${encodeURIComponent(query)}\`, { signal: controller.signal })
      .then((response) => response.json())
      .then(setResults)
      .catch((error) => { if (error.name !== "AbortError") throw error; })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);
  return <div aria-live="polite">{loading ? <p>Loading…</p> : <ul>{results.map((customer) => <li key={customer.id}>{customer.name}</li>)}</ul>}</div>;
}
`,
  }],
});

export const orderTransfer = scenario({
  id: "order-transfer",
  difficulty: "senior",
  title: "Order inventory transfer",
  summary: "A stock transfer that updates two records without a transaction, lock, or retry-safe boundary.",
  prTitle: "Move reserved stock between fulfilment centres",
  description: "The new endpoint transfers reserved inventory when an order is rerouted.",
  instructions: "Make the transfer atomic, lock rows consistently, reject insufficient stock, and make retries safe.",
  repository: "acme/fulfilment",
  findings: [
    { id: "transfer-no-tx", title: "Updates are not atomic", description: "A failure between statements loses inventory.", category: "bug", severity: "critical", anchor: "await db.decrement" },
    { id: "transfer-race", title: "Read-check-write race", description: "Concurrent transfers can both pass the stock check.", category: "bug", severity: "critical", anchor: "if (source.available < quantity)" },
    { id: "transfer-lock-order", title: "No consistent lock ordering", description: "Adding locks later without ordering can deadlock.", category: "design", severity: "major", anchor: "findWarehouse(sourceId)" },
    { id: "transfer-idempotency", title: "Retries duplicate the transfer", description: "There is no operation id or uniqueness boundary.", category: "bug", severity: "major", anchor: "export async function transfer" },
  ],
  languages: [
    { language: "typescript", path: "src/transfer.ts", failureMarker: "await db.decrement", successMarker: "db.transaction", flawed: `export async function transfer(db, sourceId, targetId, quantity) {
  const source = await db.findWarehouse(sourceId);
  if (source.available < quantity) throw new Error("insufficient stock");
  await db.decrement(sourceId, quantity);
  await db.increment(targetId, quantity);
}
`, fixed: `export async function transfer(db, operationId, sourceId, targetId, quantity) {
  return db.transaction(async (tx) => {
    if (await tx.hasOperation(operationId)) return;
    const [first, second] = [sourceId, targetId].sort();
    await tx.lockWarehouses(first, second);
    const source = await tx.findWarehouse(sourceId);
    if (source.available < quantity) throw new Error("insufficient stock");
    await tx.decrement(sourceId, quantity);
    await tx.increment(targetId, quantity);
    await tx.recordOperation(operationId);
  });
}
` },
    { language: "python", path: "app/transfer.py", failureMarker: "await db.decrement", successMarker: "db.transaction", flawed: `async def transfer(db, source_id, target_id, quantity):
    source = await db.find_warehouse(source_id)
    if source.available < quantity:
        raise ValueError("insufficient stock")
    await db.decrement(source_id, quantity)
    await db.increment(target_id, quantity)
`, fixed: `async def transfer(db, operation_id, source_id, target_id, quantity):
    async with db.transaction() as tx:
        if await tx.has_operation(operation_id):
            return
        first, second = sorted([source_id, target_id])
        await tx.lock_warehouses(first, second)
        source = await tx.find_warehouse(source_id)
        if source.available < quantity:
            raise ValueError("insufficient stock")
        await tx.decrement(source_id, quantity)
        await tx.increment(target_id, quantity)
        await tx.record_operation(operation_id)
` },
  ],
});

export const queueWorker = scenario({
  id: "queue-worker",
  difficulty: "senior",
  title: "Queue worker retries",
  summary: "A background worker acknowledges too early, retries permanent failures, and duplicates side effects.",
  prTitle: "Process shipment jobs in the background",
  description: "Shipment creation has moved to a queue worker to keep checkout fast.",
  instructions: "Acknowledge only after success, make side effects idempotent, distinguish retryable errors, and add bounded backoff.",
  repository: "acme/shipping",
  findings: [
    { id: "worker-early-ack", title: "Job acknowledged before work completes", description: "A crash loses the job permanently.", category: "bug", severity: "critical", anchor: "await job.ack()" },
    { id: "worker-duplicates", title: "Side effect is not idempotent", description: "Redelivery can create multiple shipments.", category: "bug", severity: "critical", anchor: "createShipment(job.orderId)" },
    { id: "worker-retry-all", title: "Permanent failures retry forever", description: "Validation failures should dead-letter rather than consume capacity.", category: "design", severity: "major", anchor: "await job.retry()" },
    { id: "worker-no-backoff", title: "Retries have no delay", description: "Immediate retries amplify downstream incidents.", category: "performance", severity: "major", anchor: "catch (error)" },
  ],
  languages: [
    { language: "typescript", path: "src/worker.ts", failureMarker: "await job.ack()", successMarker: "idempotencyKey", flawed: `export async function processJob(job, shipping) {
  await job.ack();
  try {
    await shipping.createShipment(job.orderId);
  } catch (error) {
    await job.retry();
  }
}
`, fixed: `export async function processJob(job, shipping) {
  try {
    await shipping.createShipment(job.orderId, { idempotencyKey: job.id });
    await job.ack();
  } catch (error) {
    if (error.permanent) return job.deadLetter(error.message);
    await job.retry({ backoffMs: Math.min(60_000, 1000 * 2 ** job.attempt) });
  }
}
` },
    { language: "python", path: "app/worker.py", failureMarker: "await job.ack()", successMarker: "idempotency_key", flawed: `async def process_job(job, shipping):
    await job.ack()
    try:
        await shipping.create_shipment(job.order_id)
    except Exception:
        await job.retry()
`, fixed: `async def process_job(job, shipping):
    try:
        await shipping.create_shipment(job.order_id, idempotency_key=job.id)
        await job.ack()
    except PermanentError as error:
        await job.dead_letter(str(error))
    except Exception:
        await job.retry(backoff_ms=min(60000, 1000 * (2 ** job.attempt)))
` },
  ],
});

export const tenantDocuments = scenario({
  id: "tenant-documents",
  difficulty: "senior",
  title: "Multi-tenant document API",
  summary: "A document endpoint checks authentication but not tenant ownership and leaks storage URLs.",
  prTitle: "Add document download and sharing endpoints",
  description: "Teams can download documents and create short-lived share links.",
  instructions: "Enforce tenant ownership, keep storage locations private, constrain share links, and prevent enumeration.",
  repository: "acme/documents",
  findings: [
    { id: "docs-idor", title: "Missing tenant ownership check", description: "Any signed-in user can fetch another tenant's document by id.", category: "security", severity: "critical", anchor: "findById(documentId)" },
    { id: "docs-storage-leak", title: "Raw storage URL is returned", description: "Internal bucket details and durable access leak to clients.", category: "security", severity: "major", anchor: "storageUrl: document.storageUrl" },
    { id: "docs-share-expiry", title: "Share links never expire", description: "A leaked link remains valid indefinitely.", category: "security", severity: "major", anchor: "createShareToken(documentId)" },
    { id: "docs-enumeration", title: "Predictable ids reveal existence", description: "Different responses make cross-tenant enumeration easier.", category: "security", severity: "minor", anchor: "Document not found" },
  ],
  languages: [
    { language: "typescript", path: "src/documents.ts", failureMarker: "findById(documentId)", successMarker: "tenantId", flawed: `export async function getDocument(db, user, documentId) {
  const document = await db.documents.findById(documentId);
  if (!document) throw new Error("Document not found");
  return { ...document, storageUrl: document.storageUrl };
}

export async function shareDocument(db, documentId) {
  return db.createShareToken(documentId);
}
`, fixed: `export async function getDocument(db, user, documentId) {
  const document = await db.documents.findForTenant(documentId, user.tenantId);
  if (!document) throw new Error("Not found");
  return { id: document.id, name: document.name, downloadUrl: await db.signDownload(document.storageKey, 300) };
}

export async function shareDocument(db, user, documentId) {
  await db.documents.requireForTenant(documentId, user.tenantId);
  return db.createShareToken(documentId, { expiresInSeconds: 900 });
}
` },
    { language: "python", path: "app/documents.py", failureMarker: "find_by_id(document_id)", successMarker: "tenant_id", flawed: `async def get_document(db, user, document_id):
    document = await db.documents.find_by_id(document_id)
    if not document:
        raise ValueError("Document not found")
    return {**document, "storage_url": document.storage_url}

async def share_document(db, document_id):
    return await db.create_share_token(document_id)
`, fixed: `async def get_document(db, user, document_id):
    document = await db.documents.find_for_tenant(document_id, user.tenant_id)
    if not document:
        raise ValueError("Not found")
    return {"id": document.id, "name": document.name, "download_url": await db.sign_download(document.storage_key, 300)}

async def share_document(db, user, document_id):
    await db.documents.require_for_tenant(document_id, user.tenant_id)
    return await db.create_share_token(document_id, expires_in_seconds=900)
` },
  ],
});

export const csvImport = scenario({
  id: "csv-import",
  difficulty: "mid",
  title: "Streaming CSV import",
  summary: "An importer buffers the entire upload, trusts headers, and writes rows one at a time without bounds.",
  prTitle: "Import customers from CSV",
  description: "Operators can upload customer exports containing up to one million rows.",
  instructions: "Stream and bound the upload, validate headers and rows, batch writes, and report partial failures safely.",
  repository: "acme/customer-data",
  findings: [
    { id: "csv-buffer", title: "Entire upload is buffered", description: "Large imports can exhaust function memory.", category: "performance", severity: "critical", anchor: "await file.text()" },
    { id: "csv-no-limit", title: "No size or row limit", description: "An attacker can submit an unbounded workload.", category: "security", severity: "major", anchor: "split(\"\\n\")" },
    { id: "csv-validation", title: "Headers and rows are trusted", description: "Malformed records reach the database unchecked.", category: "bug", severity: "major", anchor: "const [email, name]" },
    { id: "csv-n-plus-one", title: "Rows are inserted one at a time", description: "A million sequential writes will time out.", category: "performance", severity: "major", anchor: "await db.insertCustomer" },
  ],
  languages: [
    { language: "typescript", path: "src/import-customers.ts", failureMarker: "await file.text()", successMarker: "batchSize", flawed: `export async function importCustomers(file, db) {
  const text = await file.text();
  const rows = text.split("\\n");
  for (const row of rows.slice(1)) {
    const [email, name] = row.split(",");
    await db.insertCustomer({ email, name });
  }
}
`, fixed: `export async function importCustomers(file, db) {
  if (file.size > 50_000_000) throw new Error("file too large");
  const batchSize = 500;
  for await (const batch of parseValidatedCsv(file.stream(), { batchSize, maxRows: 1_000_000, headers: ["email", "name"] })) {
    await db.insertCustomers(batch);
  }
}
` },
    { language: "python", path: "app/import_customers.py", failureMarker: "await file.read()", successMarker: "batch_size", flawed: `async def import_customers(file, db):
    text = (await file.read()).decode()
    rows = text.split("\\n")
    for row in rows[1:]:
        email, name = row.split(",")
        await db.insert_customer({"email": email, "name": name})
`, fixed: `async def import_customers(file, db):
    batch_size = 500
    async for batch in parse_validated_csv(file, batch_size=batch_size, max_rows=1_000_000, headers=["email", "name"]):
        await db.insert_customers(batch)
` },
  ],
});

export const flakyTests = scenario({
  id: "flaky-tests",
  difficulty: "mid",
  title: "Flaky asynchronous tests",
  summary: "A test suite depends on wall-clock time, shared state, arbitrary sleeps, and weak assertions.",
  prTitle: "Add coverage for notification retries",
  description: "The new tests cover retry timing and duplicate notification prevention.",
  instructions: "Make the tests deterministic, isolated, behaviour-focused, and capable of catching duplicate sends.",
  repository: "acme/notifications",
  findings: [
    { id: "tests-sleep", title: "Arbitrary sleep makes the suite flaky", description: "Timing varies across CI machines.", category: "testing", severity: "critical", anchor: "setTimeout(resolve, 100)" },
    { id: "tests-shared", title: "Tests share mutable state", description: "Order-dependent state leaks between cases.", category: "testing", severity: "major", anchor: "const sent = []" },
    { id: "tests-weak", title: "Assertion cannot detect duplicates", description: "Checking that one send exists still passes after repeated sends.", category: "testing", severity: "major", anchor: "sent.length > 0" },
    { id: "tests-clock", title: "Wall-clock time is uncontrolled", description: "Retry boundaries can fail around slow or fast scheduling.", category: "testing", severity: "minor", anchor: "Date.now()" },
  ],
  languages: [
    { language: "typescript", path: "tests/notifications.test.ts", failureMarker: "setTimeout(resolve, 100)", successMarker: "fakeClock", flawed: `const sent = [];

test("retries a notification", async () => {
  const startedAt = Date.now();
  notifyWithRetry((message) => sent.push(message));
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(Date.now()).toBeGreaterThan(startedAt);
  expect(sent.length > 0).toBe(true);
});
`, fixed: `test("retries once without duplicating the send", async () => {
  const sent = [];
  const fakeClock = createFakeClock();
  const task = notifyWithRetry((message) => sent.push(message), fakeClock);
  await fakeClock.advanceBy(100);
  await task;
  expect(sent).toHaveLength(1);
});
` },
    { language: "python", path: "tests/test_notifications.py", failureMarker: "asyncio.sleep(0.1)", successMarker: "fake_clock", flawed: `sent = []

async def test_retries_notification():
    started_at = time.time()
    notify_with_retry(lambda message: sent.append(message))
    await asyncio.sleep(0.1)
    assert time.time() > started_at
    assert len(sent) > 0
`, fixed: `async def test_retries_once_without_duplicate():
    sent = []
    fake_clock = FakeClock()
    task = notify_with_retry(lambda message: sent.append(message), fake_clock)
    await fake_clock.advance(0.1)
    await task
    assert len(sent) == 1
` },
  ],
});
