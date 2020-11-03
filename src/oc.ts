
import * as ghCore from "@actions/core";
import * as ghExec from "@actions/exec";
import * as util from "./util";

const EXECUTABLE = util.getOS() === "windows" ? "oc.exe" : "oc";

namespace Oc {
    export enum Commands {
        Login = "login",
        Config = "config",
        View = "view",
    }

    export enum Flags {
        Server = "server",
        Username = "username",
        Password = "password",
        Token = "token",
        SkipTLSVerify = "insecure-skip-tls-verify",

        Flatten = "flatten",
        Minify = "minify",
    }

    export type Options = { [key in Flags]?: string };

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

    export async function exec(args: string[], options: ghExec.ExecOptions= {}): Promise<{ exitCode: number, out: string, err: string }> {

        ghCore.info(`${EXECUTABLE} ${args.join(" ")}`)

        let out = "";
        let err = "";
        const exitCode = await ghExec.exec(EXECUTABLE, args, {
            ...options,
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

}

export default Oc;
