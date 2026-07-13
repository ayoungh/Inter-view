import { describe, expect, it } from "vitest";
import { diffLines } from "@/lib/diff";
describe("base/head diff", () => { it("retains both line coordinate systems", () => { const result = diffLines("one\ntwo\nthree", "one\nTWO\nthree\nfour"); expect(result.filter((line) => line.type === "add").map((line) => line.newLine)).toEqual([2,4]); expect(result.filter((line) => line.type === "del").map((line) => line.oldLine)).toEqual([2]); }); });
