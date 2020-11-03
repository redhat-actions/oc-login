

import * as ghCore from "@actions/core";
import * as ghExec from "@actions/exec"
import * as util from "./util";

const EXECUTABLE = util.getOS() === "windows" ? "oc.exe" : "oc";

export async function ocExec(...args: string[]): Promise<number> {
    ghCore.info(`${EXECUTABLE} ${args.join(" ")}`)
    return await ghExec.exec(EXECUTABLE, args);
}

export enum OcCommands {
    Login = "login",
}

export enum OcFlags {
    Server = "server",
    Username = "username",
    Password = "password",
    Token = "token",
    SkipTLSVerify = "insecure-skip-tls-verify"
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
