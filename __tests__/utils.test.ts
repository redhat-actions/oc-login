import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @actions/core before importing the module under test
vi.mock("@actions/core", () => ({
    warning: vi.fn(),
}));

describe("getOS", () => {
    beforeEach(() => {
        // Reset the module cache so each test gets a fresh `currentOS`
        vi.resetModules();
    });

    it("should return 'linux' on linux platform", async () => {
        vi.stubGlobal("process", { ...process, platform: "linux" });
        const { getOS } = await import("../src/utils.js");
        expect(getOS()).toBe("linux");
    });

    it("should return 'windows' on win32 platform", async () => {
        vi.stubGlobal("process", { ...process, platform: "win32" });
        const { getOS } = await import("../src/utils.js");
        expect(getOS()).toBe("windows");
    });

    it("should return 'macos' on darwin platform", async () => {
        vi.stubGlobal("process", { ...process, platform: "darwin" });
        const { getOS } = await import("../src/utils.js");
        expect(getOS()).toBe("macos");
    });

    it("should default to 'linux' for unrecognized platforms", async () => {
        vi.stubGlobal("process", { ...process, platform: "freebsd" });
        const { getOS } = await import("../src/utils.js");
        expect(getOS()).toBe("linux");
    });

    it("should cache the OS after first call", async () => {
        vi.stubGlobal("process", { ...process, platform: "darwin" });
        const { getOS } = await import("../src/utils.js");
        expect(getOS()).toBe("macos");

        // Change platform after first call -- should still return cached value
        vi.stubGlobal("process", { ...process, platform: "linux" });
        expect(getOS()).toBe("macos");
    });
});
