
import * as ghCore from "@actions/core";
import { OcOptions, ocExec, OcCommands, getOptions, OcFlags, getKubeConfig } from './ocExec';

interface Auth {
    credentials?: {
        username: string;
        password: string;
    },
    token?: string;
    skipTlsVerify: boolean;
}

async function auth(serverURL: string, auth: Auth): Promise<void> {
    let authOptions: OcOptions;
    if (auth.credentials) {
        ghCore.info("Authenticating using credentials");

        authOptions = {
            username: auth.credentials?.username,
            password: auth.credentials?.password,
        }
    }
    else if (auth.token) {
        ghCore.info("Authenticating using token");
        authOptions = {
            token: auth.token
        }
    }
    else {
        throw new Error("No auth provided");
    }

    if (auth.skipTlsVerify) {
        authOptions[OcFlags.SkipTLSVerify] = "";
    }

    const ocExecArgs = [ OcCommands.Login, ...getOptions({ [OcFlags.Server]: serverURL }), ...getOptions(authOptions) ];
    const exitCode = (await ocExec(ocExecArgs)).exitCode;
    if (exitCode != 0) {
        throw new Error(`Authentication failed with exit code ${exitCode}`);
    }
}

enum Inputs {
    OS_SERVER_URL = "openshift_url",
    OS_TOKEN = "openshift_token",
    OS_USERNAME = "openshift_username",
    OS_PASSWORD = "openshift_password",
    SKIP_TLS_VERIFY = "insecure_skip_tls_verify",
}

function getAuthInputs(): Auth {
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

async function main() {
    const openshiftUrl = ghCore.getInput(Inputs.OS_SERVER_URL);

    if (openshiftUrl) {
        ghCore.debug("Found Openshift URL");
    }
    else {
        throw new Error(`OpenShift URL not provided. "${Inputs.OS_SERVER_URL}" is a required input.`);
    }

    await auth(openshiftUrl, getAuthInputs());

    const kubeconfig = await getKubeConfig();
    ghCore.info("KUBECONFIG");
    ghCore.info(kubeconfig);
}

ghCore.setCommandEcho(true);

main().then(() => {
    // success
    ghCore.info("Success.");
}).catch((err) => {
    ghCore.setFailed(err.message || err);
    process.exit(1);
})
