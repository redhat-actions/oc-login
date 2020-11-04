/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/
import * as ghCore from "@actions/core";
import { Inputs } from './generated/inputs-outputs';
import Oc from './oc';

namespace Auth {
    interface OSAuthInfo {
        serverURL: string;
        credentials?: {
            username: string;
            password: string;
        },
        token?: string;
        skipTlsVerify: boolean;
    }

    /**
     * Get the token or credentials action inputs and return them in one object.
     */
    export function getAuthInputs(): OSAuthInfo {
        const serverURL = ghCore.getInput(Inputs.OPENSHIFT_SERVER_URL, { required: true });

        if (serverURL) {
            ghCore.debug("Found OpenShift Server URL");
        }

        const skipTlsVerify = ghCore.getInput(Inputs.INSECURE_SKIP_TLS_VERIFY) == "true";

        const authInfo: OSAuthInfo = {
            serverURL,
            skipTlsVerify,
        };

        const openshiftToken = ghCore.getInput(Inputs.OPENSHIFT_TOKEN);
        if (openshiftToken) {
            ghCore.debug("Found OpenShift Token");
            return {
                ...authInfo,
                token: openshiftToken,
            };
        }

        // no token - proceed to username/password
        const openshiftUsername = ghCore.getInput(Inputs.OPENSHIFT_USERNAME);
        const openshiftPassword = ghCore.getInput(Inputs.OPENSHIFT_PASSWORD);

        if (openshiftUsername && openshiftPassword) {
            ghCore.debug("Found OpenShift credentials");
            return {
                ...authInfo,
                credentials: {
                    username: openshiftUsername,
                    password: openshiftPassword
                },
            };
        }

        // neither token nor username/password are set
        throw new Error(`Failed to login: Required action inputs are missing. ` +
            `Either "${Inputs.OPENSHIFT_TOKEN}", or both "${Inputs.OPENSHIFT_USERNAME}" and "${Inputs.OPENSHIFT_PASSWORD}" must be set.`
        );
    }

    /**
     * Performs an 'oc login' into the given server, with the given access token or credentials.
     * Token is given precedence if both are present.
     */
    export async function login(auth: OSAuthInfo): Promise<void> {
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

        authOptions[Oc.Flags.ServerURL] = auth.serverURL;

        if (auth.skipTlsVerify) {
            authOptions[Oc.Flags.SkipTLSVerify] = "";
        }

        const ocExecArgs = [ Oc.Commands.Login, ...Oc.getOptions(authOptions) ];
        const exitCode = (await Oc.exec(ocExecArgs)).exitCode;
        if (exitCode != 0) {
            throw new Error(`Authentication failed with exit code ${exitCode}`);
        }
    }
}

export default Auth;
