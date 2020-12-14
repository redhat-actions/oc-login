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
    // ghCore.setCommandEcho(true);
    await Auth.login();

    const namespace = ghCore.getInput(Inputs.NAMESPACE);
    if (namespace) {
        await KubeConfig.setCurrentContextNamespace(namespace);
    }

    if (ghCore.getInput(Inputs.SKIP_KUBECONFIG) == "true") {
        ghCore.info(`"${Inputs.SKIP_KUBECONFIG}" is set; skipping generating kubeconfig`);
    }
    else {
        ghCore.info(`Exporting Kubeconfig`);
        const revealClusterName: boolean = ghCore.getInput(Inputs.REVEAL_CLUSTER_NAME) == "true";
        await KubeConfig.exportKubeConfig(revealClusterName);
    }
}

run()
.then(() => {
    ghCore.info("Success.");
})
.catch(ghCore.setFailed);
