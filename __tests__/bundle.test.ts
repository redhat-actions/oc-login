import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const DIST_INDEX = path.resolve(__dirname, "..", "dist", "index.js");

describe("bundle integrity", () => {
    const content = fs.readFileSync(DIST_INDEX, "utf-8");

    it("should not contain webpackMissingModule stubs", () => {
        expect(content).not.toContain("webpackMissingModule");
    });

    it("should not contain 'Cannot find module' error strings", () => {
        const matches = content.match(/Cannot find module '[^']+'/g) || [];
        expect(
            matches,
            `Bundle contains unresolved modules: ${matches.join(", ")}`,
        ).toHaveLength(0);
    });

    it("should be non-trivially sized", () => {
        const stats = fs.statSync(DIST_INDEX);
        expect(stats.size).toBeGreaterThan(1024);
    });
});
