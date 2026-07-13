import { describe, expect, it } from "vitest";
import { createToken, hashToken, sealToken, tokenMatches, unsealToken } from "@/lib/server/tokens";
process.env.SESSION_SECRET = "unit-test-session-secret-with-enough-entropy";
describe("capability tokens", () => { it("stores hashes and can seal report capabilities", () => { const token = createToken(); expect(hashToken(token)).not.toContain(token); expect(tokenMatches(token, hashToken(token))).toBe(true); expect(tokenMatches(`${token}x`, hashToken(token))).toBe(false); const sealed = sealToken(token); expect(sealed).not.toContain(token); expect(unsealToken(sealed)).toBe(token); }); });
