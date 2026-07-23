import { describe, it, expect, vi, beforeEach } from "vitest";

// Track calls to Oc.exec
const mockOcExec = vi.fn().mockResolvedValue({ exitCode: 0, output: "", error: "" });

// Mock @actions/core
const mockGetInput = vi.fn();
const mockGetIDToken = vi.fn();
vi.mock("@actions/core", () => ({
    getInput: (...args: unknown[]) => mockGetInput(...args),
    getIDToken: (...args: unknown[]) => mockGetIDToken(...args),
    info: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
    setSecret: vi.fn(),
    exportVariable: vi.fn(),
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

// Mock fs for writeOutCA
vi.mock("fs", () => ({
    promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn(),
        unlink: vi.fn(),
        chmod: vi.fn(),
    },
}));

import Auth from "../src/auth.js";
import { Inputs } from "../src/generated/inputs-outputs.js";

/**
 * Helper to configure mock getInput return values.
 * Accepts a partial map of input name -> value; unmapped inputs return "".
 */
function setInputs(inputs: Partial<Record<string, string>>): void {
    mockGetInput.mockImplementation((name: string) => {
        return inputs[name] ?? "";
    });
}

describe("Auth.login", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should login with token and server URL", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_TOKEN]: "sha256~abc123",
        });

        await Auth.login();

        // Should call oc login with --token and --server
        expect(mockOcExec).toHaveBeenCalledWith([
            "login",
            "--token=sha256~abc123",
            "--server=https://api.example.com:6443",
        ]);

        // Should call oc whoami afterwards
        expect(mockOcExec).toHaveBeenCalledWith(["whoami"]);
        expect(mockOcExec).toHaveBeenCalledTimes(2);
    });

    it("should login with username and password", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_USERNAME]: "admin",
            [Inputs.OPENSHIFT_PASSWORD]: "s3cret",
        });

        await Auth.login();

        expect(mockOcExec).toHaveBeenCalledWith([
            "login",
            "--username=admin",
            "--password=s3cret",
            "--server=https://api.example.com:6443",
        ]);
    });

    it("should prefer credentials over token when both are provided", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_USERNAME]: "admin",
            [Inputs.OPENSHIFT_PASSWORD]: "s3cret",
            [Inputs.OPENSHIFT_TOKEN]: "sha256~abc123",
        });

        await Auth.login();

        // Should use credentials, not token
        const loginCall = mockOcExec.mock.calls[0][0] as string[];
        expect(loginCall).toContain("--username=admin");
        expect(loginCall).toContain("--password=s3cret");
        expect(loginCall).not.toContain("--token=sha256~abc123");
    });

    it("should login without server URL when not provided (#24)", async () => {
        setInputs({
            [Inputs.OPENSHIFT_TOKEN]: "sha256~abc123",
        });

        await Auth.login();

        const loginCall = mockOcExec.mock.calls[0][0] as string[];
        expect(loginCall).toContain("--token=sha256~abc123");
        // Should NOT include --server flag
        expect(loginCall.some((arg: string) => arg.startsWith("--server="))).toBe(false);
    });

    it("should add --insecure-skip-tls-verify when requested", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_TOKEN]: "sha256~abc123",
            [Inputs.INSECURE_SKIP_TLS_VERIFY]: "true",
        });

        await Auth.login();

        const loginCall = mockOcExec.mock.calls[0][0] as string[];
        expect(loginCall).toContain("--insecure-skip-tls-verify");
    });

    it("should write CA file and add --certificate-authority when CA data is provided", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_TOKEN]: "sha256~abc123",
            [Inputs.CERTIFICATE_AUTHORITY_DATA]: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
        });

        const fs = await import("fs");

        await Auth.login();

        // Should have written the CA file
        expect(fs.promises.writeFile).toHaveBeenCalled();
        const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
        expect(String(writeCall[0])).toContain("openshift-ca.crt");
        expect(writeCall[1]).toBe("-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----");

        // Should include --certificate-authority in login args
        const loginCall = mockOcExec.mock.calls[0][0] as string[];
        expect(loginCall.some((arg: string) => arg.startsWith("--certificate-authority="))).toBe(true);
    });

    it("should throw when neither token nor credentials are provided", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
        });

        await expect(Auth.login()).rejects.toThrow("Failed to login");
    });

    it("should throw when only username is provided without password", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_USERNAME]: "admin",
        });

        await expect(Auth.login()).rejects.toThrow("Failed to login");
    });

    it("should throw when only password is provided without username", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OPENSHIFT_PASSWORD]: "s3cret",
        });

        await expect(Auth.login()).rejects.toThrow("Failed to login");
    });
});

describe("Auth.oidcLogin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should request OIDC token and configure kubeconfig", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
        });
        mockGetIDToken.mockResolvedValue("eyJhbGciOiJSUzI1NiJ9.fake-jwt-token");

        const core = await import("@actions/core");

        await Auth.oidcLogin();

        // Should request OIDC token with server URL as audience
        expect(mockGetIDToken).toHaveBeenCalledWith("https://api.example.com:6443");

        // Should mask the token
        expect(core.setSecret).toHaveBeenCalledWith("eyJhbGciOiJSUzI1NiJ9.fake-jwt-token");

        // Should call: oc config set-cluster, set-credentials, set-context, use-context, whoami
        expect(mockOcExec).toHaveBeenCalledTimes(5);

        // set-cluster
        const setClusterCall = mockOcExec.mock.calls[0][0] as string[];
        expect(setClusterCall).toEqual([
            "config", "set-cluster", "oidc-cluster",
            "--server=https://api.example.com:6443",
        ]);

        // set-credentials with token
        const setCredentialsCall = mockOcExec.mock.calls[1][0] as string[];
        expect(setCredentialsCall).toEqual([
            "config", "set-credentials", "oidc-user",
            "--token=eyJhbGciOiJSUzI1NiJ9.fake-jwt-token",
        ]);

        // set-context
        const setContextCall = mockOcExec.mock.calls[2][0] as string[];
        expect(setContextCall).toEqual([
            "config", "set-context", "oidc-context",
            "--cluster=oidc-cluster",
            "--user=oidc-user",
        ]);

        // use-context
        const useContextCall = mockOcExec.mock.calls[3][0] as string[];
        expect(useContextCall).toEqual([
            "config", "use-context", "oidc-context",
        ]);

        // whoami
        expect(mockOcExec.mock.calls[4][0]).toEqual(["whoami"]);
    });

    it("should use custom audience when oidc_audience is provided", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.OIDC_AUDIENCE]: "api://my-cluster",
        });
        mockGetIDToken.mockResolvedValue("fake-token");

        await Auth.oidcLogin();

        expect(mockGetIDToken).toHaveBeenCalledWith("api://my-cluster");
    });

    it("should throw when server URL is not provided", async () => {
        setInputs({});

        await expect(Auth.oidcLogin()).rejects.toThrow(
            "openshift_server_url is required when use_oidc is enabled",
        );

        expect(mockGetIDToken).not.toHaveBeenCalled();
    });

    it("should add --insecure-skip-tls-verify to set-cluster when requested", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.INSECURE_SKIP_TLS_VERIFY]: "true",
        });
        mockGetIDToken.mockResolvedValue("fake-token");

        await Auth.oidcLogin();

        const setClusterCall = mockOcExec.mock.calls[0][0] as string[];
        expect(setClusterCall).toContain("--insecure-skip-tls-verify=true");
    });

    it("should add --certificate-authority to set-cluster when CA data is provided", async () => {
        setInputs({
            [Inputs.OPENSHIFT_SERVER_URL]: "https://api.example.com:6443",
            [Inputs.CERTIFICATE_AUTHORITY_DATA]: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
        });
        mockGetIDToken.mockResolvedValue("fake-token");

        await Auth.oidcLogin();

        const setClusterCall = mockOcExec.mock.calls[0][0] as string[];
        expect(setClusterCall.some((arg: string) => arg.startsWith("--certificate-authority="))).toBe(true);
    });
});
