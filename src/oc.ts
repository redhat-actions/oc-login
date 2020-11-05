/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghExec from "@actions/exec";
import * as util from "./utils";

const EXECUTABLE = util.getOS() === "windows" ? "oc.exe" : "oc";

namespace Oc {
    /**
     * oc commands.
     */
    export enum Commands {
        Login = "login",
        Config = "config",
        View = "view",
        Set_Context = "set-context",
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
            if (value != "") {
                arg += `=${value}`
            }
            argsBuilder.push(arg);

            return argsBuilder;
        }, []);
    }

    /**
     * Run 'oc' with the given arguments.
     *
     * @throws If the exitCode is not 0, unless execOptions.ignoreReturnCode is set.
     *
     * @param args Arguments and options to 'oc'. Use getOptions to convert an options mapping into a string[].
     * @param execOptions Options for how to run the exec.
     * @returns Exit code and the contents of stdout/stderr.
     */
    export async function exec(args: string[], execOptions: ghExec.ExecOptions = {}): Promise<{ exitCode: number, out: string, err: string }> {

        // ghCore.info(`${EXECUTABLE} ${args.join(" ")}`)

        let stdout = "";
        let stderr = "";
        const exitCode = await ghExec.exec(EXECUTABLE, args, {
            ...execOptions,
            ignoreReturnCode: true,     // the return code is processed below
            listeners: {
                stdline: (line) => {
                    stdout += line + "\n";
                },
                errline: (line) => {
                    stderr += line + "\n"
                }
            }
        });

        if (!execOptions.ignoreReturnCode && exitCode !== 0) {
            // Throwing the stderr as part of the Error makes the stderr show up in the action outline, which saves some clicking when debugging.
            let error = `oc exited with code ${exitCode}`;
            if (stderr) {
                error += `\n${stderr}`;
            }
            throw new Error(error)
        }

        return {
            exitCode, out: stdout, err: stderr
        };
    }

}

export default Oc;
