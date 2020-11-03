

import * as ghCore from "@actions/core";
import * as ghExec from "@actions/exec"
import * as util from "./util";

const EXECUTABLE = util.getOS() === "windows" ? "oc.exe" : "oc";

export async function ocExec(args: string[]): Promise<{ exitCode: number, out: string, err: string }> {
    ghCore.info(`${EXECUTABLE} ${args.join(" ")}`)

    let out = "";
    let err = "";
    const exitCode = await ghExec.exec(EXECUTABLE, args, {
        listeners: {
            stdline: (line) => {
                out += line + "\n";
            },
            errline: (line) => {
                err += line + "\n"
            }
        }
    });

    return {
        exitCode, out, err
    };
}

export enum OcCommands {
    Login = "login",
    Config = "config",
    View = "view",
}

export enum OcFlags {
    Server = "server",
    Username = "username",
    Password = "password",
    Token = "token",
    SkipTLSVerify = "insecure-skip-tls-verify",

    Flatten = "flatten",
    Minify = "minify",
}

export type OcOptions = { [key in OcFlags]?: string };

export function getOptions(options: OcOptions): string[] {
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

export async function getKubeConfig(): Promise<string> {
    const options = getOptions({ flatten: "", minify: "true" });

    const execResult = await ocExec([ OcCommands.Config, OcCommands.View, ...options ]);

    if (execResult.exitCode !== 0) {
        const error = `oc returned exit code ${execResult.exitCode}`;
        throw new Error(error)
    }
    return execResult.out;
}
