import * as ghCore from "@actions/core";
import { Inputs } from './inputs-outputs';
import Oc from './oc';

namespace Auth {
    interface AuthInfo {
        credentials?: {
            username: string;
            password: string;
        },
        token?: string;
        skipTlsVerify: boolean;
    }

    export function getAuthInputs(): AuthInfo {
        const skipTlsVerify = ghCore.getInput(Inputs.SKIP_TLS_VERIFY) == "true";

        const openshiftToken = ghCore.getInput(Inputs.OS_TOKEN);
        if (openshiftToken) {
            ghCore.debug("Found Openshift Token");
            return {
                token: openshiftToken,
                skipTlsVerify,
            };
        }
        const openshiftUsername = ghCore.getInput(Inputs.OS_USERNAME);
        const openshiftPassword = ghCore.getInput(Inputs.OS_PASSWORD);
        if (openshiftUsername && openshiftPassword) {
            ghCore.debug("Found Openshift credentials");
            return {
                credentials: {
                    username: openshiftUsername,
                    password: openshiftPassword
                },
                skipTlsVerify
            };
        }
        throw new Error(`OpenShift URL not provided. "${Inputs.OS_SERVER_URL}" is a required input.`);
    }

    /**
     * Performs an 'oc login' into the given server, with the given access token or credentials.
     * Token is given precedence if both are present.
     */
    export async function login(serverURL: string, auth: AuthInfo): Promise<void> {
        let authOptions: Oc.Options;
        if (auth.token) {
            ghCore.info("Authenticating using token");
            authOptions = {
                token: auth.token
            }
        }
        else if (auth.credentials) {
            ghCore.info("Authenticating using credentials");

            authOptions = {
                username: auth.credentials?.username,
                password: auth.credentials?.password,
            }
        }
        else {
            throw new Error("Neither a token nor credentials was provided.");
        }

        if (auth.skipTlsVerify) {
            authOptions[Oc.Flags.SkipTLSVerify] = "";
        }

        const ocExecArgs = [ Oc.Commands.Login, ...Oc.getOptions({ [Oc.Flags.Server]: serverURL }), ...Oc.getOptions(authOptions) ];
        const exitCode = (await Oc.exec(ocExecArgs)).exitCode;
        if (exitCode != 0) {
            throw new Error(`Authentication failed with exit code ${exitCode}`);
        }
    }
}

export default Auth;
