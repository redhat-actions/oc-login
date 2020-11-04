/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghExec from "@actions/exec";
import * as util from "./util";

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
        Username = "username",
        Password = "password",
        Token = "token",
        SkipTLSVerify = "insecure-skip-tls-verify",

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

        let out = "";
        let err = "";
        const exitCode = await ghExec.exec(EXECUTABLE, args, {
            ...execOptions,
            listeners: {
                stdline: (line) => {
                    out += line + "\n";
                },
                errline: (line) => {
                    err += line + "\n"
                }
            }
        });

        if (exitCode !== 0) {
            // the command and err are already present in the action output (unless execOptions.silent is set).
            const error = `Error: oc exited with code ${exitCode}`;
            throw new Error(error)
        }

        return {
            exitCode, out, err
        };
    }

}

export default Oc;
