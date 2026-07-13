import { defineChallenge } from "./helpers";

const jsContent = `const requests = {};

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

function rateLimit(req, res, next) {
  const clientId = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (!requests[clientId]) {
    requests[clientId] = [];
  }

  const windowStart = now - WINDOW_MS;
  const recent = requests[clientId].filter((ts) => ts > windowStart);

  if (recent.length > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  requests[clientId].push(now);
  next();
}

module.exports = { rateLimit };
`;

const pyContent = `import time

requests_log = {}

WINDOW_SECONDS = 60
MAX_REQUESTS = 100


def rate_limit(client_ip, forwarded_for=None):
    """Return True if the request is allowed, False if it should be rejected."""
    client_id = forwarded_for or client_ip
    now = time.time()

    if client_id not in requests_log:
        requests_log[client_id] = []

    window_start = now - WINDOW_SECONDS
    recent = [ts for ts in requests_log[client_id] if ts > window_start]

    if len(recent) > MAX_REQUESTS:
        return False

    requests_log[client_id].append(now)
    return True
`;

export const rateLimiter = defineChallenge({
  id: "rate-limiter",
  title: "API rate-limiting middleware",
  summary:
    "A sliding-window rate limiter with a spoofable client identifier, an unbounded memory leak, an off-by-one on the limit and a design that breaks the moment you run two instances. Tests systems thinking beyond line-level bugs.",
  prTitle: "Add rate limiting to the public API",
  prDescription:
    "Adds a simple sliding-window rate limiter: max 100 requests per client per minute. " +
    "We plan to enable this on all public endpoints. " +
    "Please review as you would a normal PR — leave comments on any lines you have concerns about.",
  fixInstructions:
    "Now fix the limiter: make the client identification trustworthy, stop the memory from growing without bound, enforce the limit exactly, and give rejected clients useful feedback. Note (in a comment) how you would make this work across multiple server instances.",
  findings: [
    {
      id: "rl-spoofable-ip",
      title: "Client identity trusts a spoofable header",
      description:
        "x-forwarded-for is taken verbatim from the request, so any client can send a random value per request and bypass the limiter entirely (or frame another IP). Only trust the header when set by your own proxy, and parse the correct hop.",
      category: "security",
      severity: "critical",
    },
    {
      id: "rl-memory-leak",
      title: "Timestamps are filtered but never pruned — unbounded memory growth",
      description:
        "The filtered array is only used for counting; the stored array keeps every timestamp ever recorded, and client entries are never deleted. Memory grows forever with traffic and with unique client ids. Write the pruned list back and evict empty/idle clients.",
      category: "performance",
      severity: "major",
    },
    {
      id: "rl-single-instance",
      title: "In-process state breaks with multiple instances",
      description:
        "The counters live in module-level memory, so with N instances (or serverless) each client effectively gets N times the limit, and state vanishes on restart/deploy. A shared store (e.g. Redis) is needed for a real deployment.",
      category: "design",
      severity: "major",
    },
    {
      id: "rl-off-by-one",
      title: "Off-by-one: the limit allows one extra request",
      description:
        "The check uses a strict 'greater than' on the count of previous requests, so the 101st request in the window still passes. It should be >= (or count the current request).",
      category: "bug",
      severity: "minor",
    },
    {
      id: "rl-no-retry-after",
      title: "Rejected clients get no rate-limit feedback",
      description:
        "The 429 (or False) carries no Retry-After header or remaining-quota information, so well-behaved clients cannot back off correctly and will hammer the endpoint.",
      category: "style",
      severity: "minor",
    },
  ],
  variants: {
    javascript: {
      language: "javascript",
      files: [{ path: "middleware/rate-limit.js", content: jsContent }],
      anchors: {
        "rl-spoofable-ip": {
          file: "middleware/rate-limit.js",
          anchor: "req.headers['x-forwarded-for']",
        },
        "rl-memory-leak": {
          file: "middleware/rate-limit.js",
          anchor: ".filter((ts) => ts > windowStart);",
        },
        "rl-single-instance": {
          file: "middleware/rate-limit.js",
          anchor: "const requests = {};",
        },
        "rl-off-by-one": {
          file: "middleware/rate-limit.js",
          anchor: "recent.length > MAX_REQUESTS",
        },
        "rl-no-retry-after": {
          file: "middleware/rate-limit.js",
          anchor: "res.status(429).json",
        },
      },
    },
    python: {
      language: "python",
      files: [{ path: "middleware/rate_limit.py", content: pyContent }],
      anchors: {
        "rl-spoofable-ip": {
          file: "middleware/rate_limit.py",
          anchor: "forwarded_for or client_ip",
        },
        "rl-memory-leak": {
          file: "middleware/rate_limit.py",
          anchor: "recent = [ts for ts in",
        },
        "rl-single-instance": {
          file: "middleware/rate_limit.py",
          anchor: "requests_log = {}",
        },
        "rl-off-by-one": {
          file: "middleware/rate_limit.py",
          anchor: "len(recent) > MAX_REQUESTS",
        },
        "rl-no-retry-after": {
          file: "middleware/rate_limit.py",
          anchor: "return False",
        },
      },
    },
  },
});
