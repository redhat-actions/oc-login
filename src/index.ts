/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as fs from "fs";
import * as ghCore from "@actions/core";
import Auth from "./auth.js";
import { Inputs } from "./generated/inputs-outputs.js";
import KubeConfig from "./kubeconfig.js";
import Oc from "./oc.js";
import * as state from "./state.js";
import * as utils from "./utils.js";

async function run(): Promise<void> {
    ghCore.debug(`Runner OS is ${utils.getOS()}`);
    ghCore.debug(`Node version is ${process.version}`);

    const logoutInput = ghCore.getInput(Inputs.LOGOUT) || "true";
    state.setLogout(logoutInput);

    await Auth.login();

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

    const kubeconfigPath = await KubeConfig.writeOutKubeConfig();
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
