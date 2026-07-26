import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import * as path from "path";

const DIST_INDEX = path.resolve(__dirname, "..", "dist", "index.js");

describe("bundle loadability", () => {
    it("should load without MODULE_NOT_FOUND errors", () => {
        // Use Node's --check flag to syntax-check the bundle, then
        // attempt a real require() in a subprocess. The action's top-level
        // code will fail because it's not running inside GitHub Actions,
        // but MODULE_NOT_FOUND is a distinct, earlier failure that would
        // indicate a bundling problem.
        const result = (() => {
            try {
                execFileSync(process.execPath, [
                    "-e",
                    `try { require(${JSON.stringify(DIST_INDEX)}); } catch (e) { if (e.code === "MODULE_NOT_FOUND") { process.stderr.write(e.message); process.exit(99); } }`,
                ], { timeout: 10_000, encoding: "utf-8" });
                return { exitCode: 0, stderr: "" };
            }
            catch (err: unknown) {
                const e = err as { status?: number; stderr?: string };
                return { exitCode: e.status ?? 1, stderr: e.stderr ?? "" };
            }
        })();

        expect(
            result.exitCode,
            `Bundle failed to load with MODULE_NOT_FOUND: ${result.stderr}`,
        ).not.toBe(99);
    });
});
