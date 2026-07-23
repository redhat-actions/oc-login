import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @actions/core
vi.mock("@actions/core", () => ({
    saveState: vi.fn(),
}));

describe("state helper", () => {
    beforeEach(() => {
        vi.resetModules();
        // Clear state env vars
        delete process.env.STATE_isPost;
        delete process.env.STATE_logout;
        delete process.env.STATE_kubeconfigPath;
    });

    it("should detect main step when STATE_isPost is not set", async () => {
        const state = await import("../src/state.js");
        expect(state.isPost).toBe(false);
    });

    it("should detect post step when STATE_isPost is set", async () => {
        process.env.STATE_isPost = "true";
        const state = await import("../src/state.js");
        expect(state.isPost).toBe(true);
    });

    it("should read logout state (true)", async () => {
        process.env.STATE_logout = "true";
        const state = await import("../src/state.js");
        expect(state.logout).toBe(true);
    });

    it("should read logout state (false)", async () => {
        process.env.STATE_logout = "false";
        const state = await import("../src/state.js");
        expect(state.logout).toBe(false);
    });

    it("should default logout to false when STATE_logout is not set", async () => {
        const state = await import("../src/state.js");
        expect(state.logout).toBe(false);
    });

    it("should read kubeconfigPath from state", async () => {
        process.env.STATE_kubeconfigPath = "/home/runner/work/kubeconfig.yaml";
        const state = await import("../src/state.js");
        expect(state.kubeconfigPath).toBe("/home/runner/work/kubeconfig.yaml");
    });

    it("should default kubeconfigPath to empty string", async () => {
        const state = await import("../src/state.js");
        expect(state.kubeconfigPath).toBe("");
    });

    it("should call saveState for setLogout", async () => {
        const core = await import("@actions/core");
        const state = await import("../src/state.js");
        state.setLogout("true");
        expect(core.saveState).toHaveBeenCalledWith("logout", "true");
    });

    it("should call saveState for setKubeconfigPath", async () => {
        const core = await import("@actions/core");
        const state = await import("../src/state.js");
        state.setKubeconfigPath("/tmp/kubeconfig.yaml");
        expect(core.saveState).toHaveBeenCalledWith("kubeconfigPath", "/tmp/kubeconfig.yaml");
    });
});
