/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghCore from "@actions/core";
import Auth from "./auth";
import { Inputs } from './generated/inputs-outputs';
import KubeConfig from "./kubeconfig";
import * as utils from "./utils";

async function run() {
    ghCore.debug(`Runner OS is ${utils.getOS()}`);
    ghCore.debug(`Node version is ${process.version}`);

    await KubeConfig.setKubeConfigPath();

    await Auth.login();

    const revealClusterName: boolean = ghCore.getInput(Inputs.REVEAL_CLUSTER_NAME) == "true";
    ghCore.debug(`Reveal cluster name ? ${revealClusterName}`);
    await KubeConfig.maskSecrets(revealClusterName);

    const namespace = ghCore.getInput(Inputs.NAMESPACE);
    if (namespace) {
        await KubeConfig.setCurrentContextNamespace(namespace);
    }
    else {
        ghCore.info(`No namespace provided`);
    }

    await KubeConfig.exportKubeConfig();
}

run()
.then(() => {
    ghCore.info("Success.");
})
.catch(ghCore.setFailed);
