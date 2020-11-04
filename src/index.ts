/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghCore from "@actions/core";
import Auth from "./auth";
import { Inputs } from './inputs-outputs';
import KubeConfig from "./kubeconfig";

async function run() {
    await Auth.login(Auth.getAuthInputs());

    const namespace = ghCore.getInput(Inputs.NAMESPACE);
    if (namespace) {
        await KubeConfig.setCurrentContextNamespace(namespace);
    }

    if (ghCore.getInput(Inputs.SKIP_KUBECONFIG) == "true") {
        ghCore.info(`"${Inputs.SKIP_KUBECONFIG}" is set; skipping generating kubeconfig`);
    }
    else {
        await KubeConfig.exportKubeConfig();
    }
}

run()
.then(() => {
    ghCore.info("Success.");
})
.catch(ghCore.setFailed);
