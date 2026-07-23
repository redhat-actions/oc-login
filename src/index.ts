/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as path from "path";
import * as fs from "fs";
import * as ghCore from "@actions/core";
import Auth from "./auth.js";
import { Inputs } from "./generated/inputs-outputs.js";
import KubeConfig from "./kubeconfig.js";
import Oc from "./oc.js";
import * as state from "./state.js";
import * as utils from "./utils.js";

/**
 * Determine the kubeconfig path before login so that `oc login` writes directly
 * to a workspace-specific file instead of the shared `~/.kube/config`.
 * This prevents race conditions on self-hosted runners where concurrent jobs
 * share the same home directory.
 */
function setKubeconfigEnv(): string {
    const dir = process.env.GITHUB_WORKSPACE || process.cwd();
    const kubeconfigPath = path.resolve(dir, "kubeconfig.yaml");

    ghCore.info(`Setting KUBECONFIG=${kubeconfigPath} before login to avoid race conditions`);
    process.env.KUBECONFIG = kubeconfigPath;
    ghCore.exportVariable("KUBECONFIG", kubeconfigPath);

    return kubeconfigPath;
}

async function run(): Promise<void> {
    ghCore.debug(`Runner OS is ${utils.getOS()}`);
    ghCore.debug(`Node version is ${process.version}`);

    const logoutInput = ghCore.getInput(Inputs.LOGOUT) || "true";
    state.setLogout(logoutInput);

    // Set KUBECONFIG before login to prevent concurrent jobs from clobbering
    // each other's ~/.kube/config on self-hosted runners (#41)
    const kubeconfigPath = setKubeconfigEnv();

    const useOidc = ghCore.getInput(Inputs.USE_OIDC) === "true";

    if (useOidc) {
        ghCore.info("OIDC authentication enabled");
        await Auth.oidcLogin();
    }
    else {
        await Auth.login();
    }

    const revealClusterName: boolean = ghCore.getInput(Inputs.REVEAL_CLUSTER_NAME) === "true";
    ghCore.debug(`Reveal cluster name ? ${revealClusterName}`);
    await KubeConfig.maskSecrets(revealClusterName);

    const namespace = ghCore.getInput(Inputs.NAMESPACE);
    if (namespace) {
        await KubeConfig.setCurrentContextNamespace(namespace);
    }
    else {
        ghCore.info(`No namespace provided`);
    }

    // Write out the final kubeconfig (merging oc login's changes) and persist the path
    await KubeConfig.writeOutKubeConfig();
    state.setKubeconfigPath(kubeconfigPath);
}

async function postRun(): Promise<void> {
    if (!state.logout) {
        ghCore.info("Logout is disabled, skipping post-run cleanup.");
        return;
    }

    ghCore.info("Running post-action cleanup...");

    try {
        await Oc.exec([ Oc.Commands.Logout ]);
        ghCore.info("Successfully logged out of OpenShift.");
    }
    catch (err) {
        ghCore.warning(`oc logout failed: ${err}`);
    }

    if (state.kubeconfigPath) {
        try {
            await fs.promises.unlink(state.kubeconfigPath);
            ghCore.info(`Removed kubeconfig file: ${state.kubeconfigPath}`);
        }
        catch (err) {
            ghCore.warning(`Failed to remove kubeconfig: ${err}`);
        }
    }
}

if (!state.isPost) {
    run()
        .then(() => {
            ghCore.info("Success.");
        })
        .catch(ghCore.setFailed);
}
else {
    postRun().catch(ghCore.setFailed);
}
