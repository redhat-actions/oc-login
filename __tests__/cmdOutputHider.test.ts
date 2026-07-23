import { describe, it, expect } from "vitest";
import { Writable } from "stream";
import CmdOutputHider from "../src/cmdOutputHider.js";

function createMockStream(): Writable & { chunks: string[] } {
    const chunks: string[] = [];
    const stream = new Writable({
        write(chunk: Buffer, _encoding: string, callback: () => void): void {
            chunks.push(chunk.toString());
            callback();
        },
    }) as Writable & { chunks: string[] };
    stream.chunks = chunks;
    return stream;
}

describe("CmdOutputHider", () => {
    it("should pass the first chunk (command line) through to the output stream", () => {
        const mockStream = createMockStream();
        const hider = new CmdOutputHider(mockStream, "");

        hider.write(Buffer.from("oc login --server=https://example.com"));

        expect(mockStream.chunks).toHaveLength(1);
        expect(mockStream.chunks[0]).toBe("oc login --server=https://example.com");
    });

    it("should suppress output after the first newline", () => {
        const mockStream = createMockStream();
        const hider = new CmdOutputHider(mockStream, "");

        hider.write(Buffer.from("oc config view\n"));
        hider.write(Buffer.from("apiVersion: v1\nclusters: []\n"));

        // First chunk + suppression message, but not the second chunk
        expect(mockStream.chunks).toHaveLength(2);
        expect(mockStream.chunks[0]).toBe("oc config view\n");
        expect(mockStream.chunks[1]).toBe("*** Suppressing command output\n");
    });

    it("should capture suppressed output in getContents()", () => {
        const mockStream = createMockStream();
        const hider = new CmdOutputHider(mockStream, "");

        hider.write(Buffer.from("oc config view\n"));
        hider.write(Buffer.from("apiVersion: v1\n"));
        hider.write(Buffer.from("clusters: []\n"));

        expect(hider.getContents()).toBe("apiVersion: v1\nclusters: []\n");
    });

    it("should pass multiple chunks through if no newline in command line", () => {
        const mockStream = createMockStream();
        const hider = new CmdOutputHider(mockStream, "");

        hider.write(Buffer.from("oc config "));
        hider.write(Buffer.from("view --flatten"));

        // Both chunks should be passed through since no newline yet
        expect(mockStream.chunks).toHaveLength(2);
        expect(mockStream.chunks[0]).toBe("oc config ");
        expect(mockStream.chunks[1]).toBe("view --flatten");
    });

    it("should return false from write()", () => {
        const mockStream = createMockStream();
        const hider = new CmdOutputHider(mockStream, "");

        expect(hider.write(Buffer.from("test"))).toBe(false);
    });
});
