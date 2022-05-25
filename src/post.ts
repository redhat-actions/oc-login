/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghCore from "@actions/core";
import Auth from "./auth";
import KubeConfig from "./kubeconfig";

async function run(): Promise<void> {
    await Auth.logout();
    await KubeConfig.deleteKubeConfig();
}

run()
    .then(() => {
        ghCore.info("Logged out.");
    })
    .catch(ghCore.setFailed);
