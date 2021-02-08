/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import * as ghCore from "@actions/core";

import { Inputs } from "./generated/inputs-outputs";
import Oc from "./oc";

namespace Auth {
    type OSAuthInfo = Readonly<{
        serverURL: string;
        credentials?: {
            username: string;
            password: string;
        },
        token?: string;
        certAuthorityData?: string;
        skipTlsVerify: boolean;
    }>;

    /**
     * Get the token or credentials action inputs and return them in one object.
     */
    function getAuthInputs(): OSAuthInfo {
        const serverURL = ghCore.getInput(Inputs.OPENSHIFT_SERVER_URL, { required: true });

        if (serverURL) {
            ghCore.debug("Found OpenShift Server URL");
        }

        const caData = ghCore.getInput(Inputs.CERTIFICATE_AUTHORITY_DATA);
        const skipTlsVerify = ghCore.getInput(Inputs.INSECURE_SKIP_TLS_VERIFY) === "true";

        const authInfo: OSAuthInfo = {
            serverURL,
            certAuthorityData: caData,
            skipTlsVerify,
        };

        const openshiftUsername = ghCore.getInput(Inputs.OPENSHIFT_USERNAME);
        const openshiftPassword = ghCore.getInput(Inputs.OPENSHIFT_PASSWORD);

        if (openshiftUsername && openshiftPassword) {
            ghCore.debug("Found OpenShift credentials");
            return {
                ...authInfo,
                credentials: {
                    username: openshiftUsername,
                    password: openshiftPassword,
                },
            };
        }

        // no credentials - proceed to token
        const openshiftToken = ghCore.getInput(Inputs.OPENSHIFT_TOKEN);
        if (openshiftToken) {
            ghCore.debug("Found OpenShift Token");
            return {
                ...authInfo,
                token: openshiftToken,
            };
        }

        // neither token nor username/password are set
        throw new Error(`Failed to login: Required action inputs are missing. `
            + `Either "${Inputs.OPENSHIFT_TOKEN}", or both "${Inputs.OPENSHIFT_USERNAME}" and `
            + `"${Inputs.OPENSHIFT_PASSWORD}" must be set.`);
    }

    const CA_FILE = "openshift-ca.crt";

    /**
     * Write out `caData` to a .crt file.
     * @returns The path to the .crt file.
     */
    async function writeOutCA(caData: string): Promise<string> {
        const caOutFile = path.join(process.cwd(), CA_FILE);

        ghCore.info(`Writing out certificate authority data to ${caOutFile}`);
        await promisify(fs.writeFile)(caOutFile, caData);

        return caOutFile;
    }

    /**
     * Performs an 'oc login' into the given server, with the access token or credentials provided in the action inputs.
     * Token is given precedence if both are present.
     *
     * @throws If the login returns non-zero.
     */
    export async function login(): Promise<void> {
        const authInputs = getAuthInputs();

        let authOptions: Oc.Options;

        if (authInputs.token) {
            ghCore.info("Authenticating using token");
            authOptions = {
                token: authInputs.token,
            };
        }
        else if (authInputs.credentials) {
            ghCore.info("Authenticating using credentials");

            authOptions = {
                username: authInputs.credentials.username,
                password: authInputs.credentials.password,
            };
        }
        else {
            throw new Error("Neither a token nor credentials was provided.");
        }

        authOptions[Oc.Flags.ServerURL] = authInputs.serverURL;

        if (authInputs.skipTlsVerify) {
            authOptions[Oc.Flags.SkipTLSVerify] = "";
        }

        if (authInputs.certAuthorityData) {
            const caPath = await writeOutCA(authInputs.certAuthorityData);
            authOptions[Oc.Flags.CertificateAuthority] = caPath;
        }

        const ocExecArgs = [ Oc.Commands.Login, ...Oc.getOptions(authOptions) ];
        await Oc.exec(ocExecArgs);

        await Oc.exec([ Oc.Commands.Whoami ]);
    }
}

export default Auth;
