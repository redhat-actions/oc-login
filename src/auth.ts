/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/
import * as path from "path";
import * as fs from "fs";
import * as ghCore from "@actions/core";

import { Inputs } from "./generated/inputs-outputs.js";
import Oc from "./oc.js";

namespace Auth {
    type OSAuthInfo = Readonly<{
        serverURL?: string;
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
     * Server URL is optional -- if omitted, oc login will use the current kubeconfig context.
     */
    function getAuthInputs(): OSAuthInfo {
        const serverURL = ghCore.getInput(Inputs.OPENSHIFT_SERVER_URL);

        if (serverURL) {
            ghCore.debug("Found OpenShift Server URL");
        }
        else {
            ghCore.debug("No OpenShift Server URL provided; oc login will use existing kubeconfig context");
        }

        const caData = ghCore.getInput(Inputs.CERTIFICATE_AUTHORITY_DATA);
        const skipTlsVerify = ghCore.getInput(Inputs.INSECURE_SKIP_TLS_VERIFY) === "true";

        const authInfo: OSAuthInfo = {
            serverURL: serverURL || undefined,
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
        await fs.promises.writeFile(caOutFile, caData);

        return caOutFile;
    }

    /**
     * Authenticate using GitHub's OIDC token and configure kubeconfig directly.
     *
     * This bypasses `oc login`'s OAuth flow and instead writes kubeconfig entries
     * using `oc config` commands. The Kubernetes API server must be configured to
     * accept GitHub OIDC tokens (with GitHub as an OIDC provider).
     */
    export async function oidcLogin(): Promise<void> {
        const serverURL = ghCore.getInput(Inputs.OPENSHIFT_SERVER_URL);
        if (!serverURL) {
            throw new Error("openshift_server_url is required when use_oidc is enabled.");
        }

        const audience = ghCore.getInput(Inputs.OIDC_AUDIENCE) || serverURL;
        ghCore.info(`Requesting GitHub OIDC token with audience: ${audience}`);

        const oidcToken = await ghCore.getIDToken(audience);
        ghCore.setSecret(oidcToken);
        ghCore.info("Successfully obtained GitHub OIDC token");

        const clusterName = "oidc-cluster";
        const userName = "oidc-user";
        const contextName = "oidc-context";

        const caData = ghCore.getInput(Inputs.CERTIFICATE_AUTHORITY_DATA);
        const skipTlsVerify = ghCore.getInput(Inputs.INSECURE_SKIP_TLS_VERIFY) === "true";

        // Set up the cluster entry
        const clusterArgs = [
            Oc.Commands.Config, Oc.Commands.SetCluster, clusterName,
            `--server=${serverURL}`,
        ];
        if (skipTlsVerify) {
            clusterArgs.push("--insecure-skip-tls-verify=true");
        }
        if (caData) {
            const caPath = await writeOutCA(caData);
            clusterArgs.push(`--certificate-authority=${caPath}`);
        }
        await Oc.exec(clusterArgs);

        // Set up the user entry with the OIDC token
        await Oc.exec([
            Oc.Commands.Config, Oc.Commands.SetCredentials, userName,
            `--token=${oidcToken}`,
        ]);

        // Set up the context
        await Oc.exec([
            Oc.Commands.Config, Oc.Commands.SetContext, contextName,
            `--cluster=${clusterName}`,
            `--user=${userName}`,
        ]);

        // Use the context
        await Oc.exec([
            Oc.Commands.Config, Oc.Commands.UseContext, contextName,
        ]);

        await Oc.exec([ Oc.Commands.Whoami ]);
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

        if (authInputs.serverURL) {
            authOptions[Oc.Flags.ServerURL] = authInputs.serverURL;
        }

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
