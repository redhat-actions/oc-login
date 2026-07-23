import { describe, it, expect, vi, beforeEach } from "vitest";

// Track calls to Oc.exec
const mockOcExec = vi.fn();

// Mock @actions/core
const mockSetSecret = vi.fn();
const mockExportVariable = vi.fn();
vi.mock("@actions/core", () => ({
    getInput: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
    setSecret: (...args: unknown[]) => mockSetSecret(...args),
    exportVariable: (...args: unknown[]) => mockExportVariable(...args),
    startGroup: vi.fn(),
    endGroup: vi.fn(),
    saveState: vi.fn(),
}));

// Mock the Oc module
vi.mock("../src/oc.js", () => {
    const Commands = {
        Login: "login",
        Logout: "logout",
        Config: "config",
        View: "view",
        SetCluster: "set-cluster",
        SetCredentials: "set-credentials",
        SetContext: "set-context",
        UseContext: "use-context",
        CurrentContext: "current-context",
        Whoami: "whoami",
    };

    const Flags = {
        ServerURL: "server",
        Token: "token",
        Username: "username",
        Password: "password",
        SkipTLSVerify: "insecure-skip-tls-verify",
        CertificateAuthority: "certificate-authority",
        Flatten: "flatten",
        Minify: "minify",
        Namespace: "namespace",
        Current: "current",
    };

    return {
        default: {
            Commands,
            Flags,
            exec: (...args: unknown[]) => mockOcExec(...args),
            getOptions: (options: Record<string, string | undefined>) => {
                return Object.entries(options).reduce((acc: string[], [key, value]) => {
                    if (value == null) return acc;
                    let arg = "--" + key;
                    if (value !== "") arg += `=${value}`;
                    acc.push(arg);
                    return acc;
                }, []);
            },
        },
    };
});

// Mock fs
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockChmod = vi.fn().mockResolvedValue(undefined);
vi.mock("fs", () => ({
    promises: {
        writeFile: (...args: unknown[]) => mockWriteFile(...args),
        readFile: vi.fn(),
        unlink: vi.fn(),
        chmod: (...args: unknown[]) => mockChmod(...args),
    },
}));

import KubeConfig from "../src/kubeconfig.js";

const sampleKubeconfig = `apiVersion: v1
clusters:
- cluster:
    server: https://api.example.com:6443
  name: api-example-com:6443
contexts:
- context:
    cluster: api-example-com:6443
    namespace: default
    user: admin/api-example-com:6443
  name: default/api-example-com:6443/admin
current-context: default/api-example-com:6443/admin
kind: Config
users:
- name: admin/api-example-com:6443
  user:
    token: sha256~secret-token-value
`;

describe("KubeConfig.maskSecrets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock oc config view to return our sample kubeconfig
        mockOcExec.mockResolvedValue({
            exitCode: 0,
            output: sampleKubeconfig,
            error: "",
        });
    });

    it("should mask user tokens", async () => {
        await KubeConfig.maskSecrets(false);

        expect(mockSetSecret).toHaveBeenCalledWith("sha256~secret-token-value");
    });

    it("should mask cluster name by default", async () => {
        await KubeConfig.maskSecrets(false);

        expect(mockSetSecret).toHaveBeenCalledWith("api-example-com:6443");
    });

    it("should not mask cluster name when revealClusterName is true", async () => {
        await KubeConfig.maskSecrets(true);

        // Token should still be masked
        expect(mockSetSecret).toHaveBeenCalledWith("sha256~secret-token-value");
        // Cluster name should NOT be masked
        expect(mockSetSecret).not.toHaveBeenCalledWith("api-example-com:6443");
    });

    it("should mask client-certificate-data and client-key-data when present", async () => {
        const kubeconfigWithCerts = `apiVersion: v1
clusters:
- cluster:
    server: https://api.example.com:6443
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-user
  name: test-context
kind: Config
users:
- name: test-user
  user:
    client-certificate-data: MIIC-cert-data
    client-key-data: MIIC-key-data
`;
        mockOcExec.mockResolvedValue({
            exitCode: 0,
            output: kubeconfigWithCerts,
            error: "",
        });

        await KubeConfig.maskSecrets(true);

        expect(mockSetSecret).toHaveBeenCalledWith("MIIC-cert-data");
        expect(mockSetSecret).toHaveBeenCalledWith("MIIC-key-data");
    });

    it("should throw when kubeconfig is empty", async () => {
        mockOcExec.mockResolvedValue({
            exitCode: 0,
            output: "",
            error: "",
        });

        await expect(KubeConfig.maskSecrets(false)).rejects.toThrow();
    });
});

describe("KubeConfig.writeOutKubeConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOcExec.mockResolvedValue({
            exitCode: 0,
            output: sampleKubeconfig,
            error: "",
        });
    });

    it("should write kubeconfig to GITHUB_WORKSPACE when available", async () => {
        const originalWorkspace = process.env.GITHUB_WORKSPACE;
        process.env.GITHUB_WORKSPACE = "/home/runner/work/my-repo/my-repo";

        try {
            const result = await KubeConfig.writeOutKubeConfig();

            expect(result).toContain("kubeconfig.yaml");
            expect(result).toContain("/home/runner/work/my-repo/my-repo");
            expect(mockWriteFile).toHaveBeenCalledWith(result, sampleKubeconfig);
            expect(mockChmod).toHaveBeenCalledWith(result, "600");
        }
        finally {
            if (originalWorkspace !== undefined) {
                process.env.GITHUB_WORKSPACE = originalWorkspace;
            }
            else {
                delete process.env.GITHUB_WORKSPACE;
            }
        }
    });

    it("should export KUBECONFIG environment variable", async () => {
        const originalWorkspace = process.env.GITHUB_WORKSPACE;
        process.env.GITHUB_WORKSPACE = "/tmp/workspace";

        try {
            const result = await KubeConfig.writeOutKubeConfig();

            expect(mockExportVariable).toHaveBeenCalledWith("KUBECONFIG", result);
        }
        finally {
            if (originalWorkspace !== undefined) {
                process.env.GITHUB_WORKSPACE = originalWorkspace;
            }
            else {
                delete process.env.GITHUB_WORKSPACE;
            }
        }
    });

    it("should set kubeconfig file permissions to 600", async () => {
        const originalWorkspace = process.env.GITHUB_WORKSPACE;
        process.env.GITHUB_WORKSPACE = "/tmp/workspace";

        try {
            const result = await KubeConfig.writeOutKubeConfig();

            expect(mockChmod).toHaveBeenCalledWith(result, "600");
        }
        finally {
            if (originalWorkspace !== undefined) {
                process.env.GITHUB_WORKSPACE = originalWorkspace;
            }
            else {
                delete process.env.GITHUB_WORKSPACE;
            }
        }
    });
});

describe("KubeConfig.setCurrentContextNamespace", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should get current context and set namespace on it", async () => {
        // First call: oc config current-context
        mockOcExec.mockResolvedValueOnce({
            exitCode: 0,
            output: "default/api-example-com:6443/admin\n",
            error: "",
        });
        // Second call: oc config set-context
        mockOcExec.mockResolvedValueOnce({
            exitCode: 0,
            output: "",
            error: "",
        });

        await KubeConfig.setCurrentContextNamespace("my-namespace");

        // First call should be getting current context
        expect(mockOcExec.mock.calls[0][0]).toEqual(["config", "current-context"]);

        // Second call should set the namespace on that context
        const setContextCall = mockOcExec.mock.calls[1][0] as string[];
        expect(setContextCall).toContain("config");
        expect(setContextCall).toContain("set-context");
        expect(setContextCall).toContain("default/api-example-com:6443/admin");
        expect(setContextCall).toContain("--namespace=my-namespace");
    });
});
