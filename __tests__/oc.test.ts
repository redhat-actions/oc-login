import { describe, it, expect } from "vitest";
import Oc from "../src/oc.js";

describe("Oc.getOptions", () => {
    it("should convert options to CLI args with --key=value format", () => {
        const options: Oc.Options = {
            [Oc.Flags.ServerURL]: "https://api.example.com:6443",
            [Oc.Flags.Token]: "sha256~abc123",
        };

        const result = Oc.getOptions(options);

        expect(result).toContain("--server=https://api.example.com:6443");
        expect(result).toContain("--token=sha256~abc123");
        expect(result).toHaveLength(2);
    });

    it("should emit bare flags (no =value) when value is empty string", () => {
        const options: Oc.Options = {
            [Oc.Flags.Flatten]: "",
            [Oc.Flags.SkipTLSVerify]: "",
        };

        const result = Oc.getOptions(options);

        expect(result).toContain("--flatten");
        expect(result).toContain("--insecure-skip-tls-verify");
        // Should NOT have "=" in the args
        result.forEach((arg) => {
            expect(arg).not.toContain("=");
        });
    });

    it("should skip options with undefined values", () => {
        const options: Oc.Options = {
            [Oc.Flags.ServerURL]: "https://api.example.com:6443",
            [Oc.Flags.Token]: undefined,
            [Oc.Flags.Namespace]: "my-namespace",
        };

        const result = Oc.getOptions(options);

        expect(result).toEqual([
            "--server=https://api.example.com:6443",
            "--namespace=my-namespace",
        ]);
    });

    it("should return empty array for empty options", () => {
        const result = Oc.getOptions({});
        expect(result).toEqual([]);
    });

    it("should handle mixed empty-string and valued options", () => {
        const options: Oc.Options = {
            [Oc.Flags.ServerURL]: "https://api.example.com:6443",
            [Oc.Flags.SkipTLSVerify]: "",
            [Oc.Flags.Namespace]: "default",
        };

        const result = Oc.getOptions(options);

        expect(result).toHaveLength(3);
        expect(result).toContain("--server=https://api.example.com:6443");
        expect(result).toContain("--insecure-skip-tls-verify");
        expect(result).toContain("--namespace=default");
    });
});

describe("Oc.Commands", () => {
    it("should define all expected commands", () => {
        expect(Oc.Commands.Login).toBe("login");
        expect(Oc.Commands.Logout).toBe("logout");
        expect(Oc.Commands.Config).toBe("config");
        expect(Oc.Commands.View).toBe("view");
        expect(Oc.Commands.SetContext).toBe("set-context");
        expect(Oc.Commands.CurrentContext).toBe("current-context");
        expect(Oc.Commands.Whoami).toBe("whoami");
    });
});

describe("Oc.Flags", () => {
    it("should map flag names to their oc CLI equivalents", () => {
        expect(Oc.Flags.ServerURL).toBe("server");
        expect(Oc.Flags.Token).toBe("token");
        expect(Oc.Flags.Username).toBe("username");
        expect(Oc.Flags.Password).toBe("password");
        expect(Oc.Flags.SkipTLSVerify).toBe("insecure-skip-tls-verify");
        expect(Oc.Flags.CertificateAuthority).toBe("certificate-authority");
        expect(Oc.Flags.Namespace).toBe("namespace");
    });
});
