/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghCore from "@actions/core";
import * as ghExec from "@actions/exec";
import * as path from "path";
import CmdOutputHider from "./cmdOutputHider";

import * as util from "./utils";

const EXECUTABLE = util.getOS() === "windows" ? "oc.exe" : "oc";

type CommandResult = {
    exitCode: number
    output: string
    error: string
};

namespace Oc {
    /**
     * oc commands.
     */
    export enum Commands {
        Login = "login",
        Config = "config",
        View = "view",
        SetContext = "set-context",
        CurrentContext = "current-context",
        Whoami = "whoami",
    }

    /**
     * oc flags. Create an Options object with these, and then pass it to getOptions.
     */
    export enum Flags {
        ServerURL = "server",
        Token = "token",
        Username = "username",
        Password = "password",
        SkipTLSVerify = "insecure-skip-tls-verify",
        CertificateAuthority = "certificate-authority",

        Flatten = "flatten",
        Minify = "minify",

        Namespace = "namespace",
        Current = "current",
    }

    export type Options = { [key in Flags]?: string };

    /**
     * This formats an Options object into a string[] which is suitable to be passed to `exec`.
     *
     * Flags are prefixed with `--`, and suffixed with `=${value}`, unless the value is the empty string.
     *
     * For example, `{ flatten: "", minify: "true" }` is formatted into `[ "--flatten", "--minify=true" ]`.
     */
    export function getOptions(options: Options): string[] {
        return Object.entries<string | undefined>(options).reduce((argsBuilder: string[], entry) => {
            const [ key, value ] = entry;

            if (value == null) {
                return argsBuilder;
            }

            let arg = "--" + key;
            if (value !== "") {
                arg += `=${value}`;
            }
            argsBuilder.push(arg);

            return argsBuilder;
        }, []);
    }

    export async function exec(
        args: string[],
        execOptions: ghExec.ExecOptions & { group?: boolean, hideOutput?: boolean } = {},
    ): Promise<CommandResult> {
        // ghCore.info(`${EXECUTABLE} ${args.join(" ")}`)

        let stdout = "";
        let stderr = "";

        const finalExecOptions = { ...execOptions };
        finalExecOptions.ignoreReturnCode = true;     // the return code is processed below

        if (execOptions.hideOutput) {
            // There is some bug here, only on Windows, where if the wrapped stream is NOT used,
            // the output is not correctly captured into the execResult.
            // so, if you have to use the contents of stdout, do not set hideOutput.
            const wrappedOutStream = execOptions.outStream || process.stdout;
            finalExecOptions.outStream = new CmdOutputHider(wrappedOutStream, stdout);
        }

        finalExecOptions.listeners = {
            stdout: (chunk): void => {
                stdout += chunk.toString();
            },
            stderr: (chunk): void => {
                stderr += chunk.toString();
            },
        };

        if (execOptions.group) {
            const groupName = [ EXECUTABLE, ...args ].join(" ");
            ghCore.startGroup(groupName);
        }

        try {
            const exitCode = await ghExec.exec(EXECUTABLE, args, finalExecOptions);

            if (execOptions.ignoreReturnCode !== true && exitCode !== 0) {
                // Throwing the stderr as part of the Error makes the stderr
                // show up in the action outline, which saves some clicking when debugging.
                let error = `${path.basename(EXECUTABLE)} exited with code ${exitCode}`;
                if (stderr) {
                    error += `\n${stderr}`;
                }
                throw new Error(error);
            }

            return {
                exitCode, output: stdout, error: stderr,
            };
        }
        finally {
            if (execOptions.group) {
                ghCore.endGroup();
            }
        }
    }
}

export default Oc;
