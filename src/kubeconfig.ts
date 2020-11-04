/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import * as ghCore from "@actions/core";
import Oc from "./oc";

namespace KubeConfig {

    const KUBECONFIG_FILENAME = "oc-kubeconfig.yaml";
    const KUBECONFIG_ENVVAR = "KUBECONFIG";

    /**
     * Write out the current kubeconfig to a new file and export the `KUBECONFIG` env var to point to that file.
     * This allows other steps in the job to reuse the kubeconfig.
     *
     * @param namespace Set the current context's namespace to this, if set.
     */
    export async function exportKubeConfig(): Promise<void> {

        // TODO make this path configurable through env or input.
        const kubeConfigPath = path.resolve(process.cwd(), KUBECONFIG_FILENAME);

        const kubeConfig = await getKubeConfig();

        ghCore.info(`Writing out kubeconfig to ${kubeConfigPath}`);
        await promisify(fs.writeFile)(kubeConfigPath, kubeConfig);

        ghCore.info(`Exporting ${KUBECONFIG_ENVVAR}=${kubeConfigPath}`)
        ghCore.exportVariable(KUBECONFIG_ENVVAR, kubeConfigPath);

        // return kubeConfigPath;
    }

    /**
     * @returns the current context's kubeconfig as a string.
     */
    async function getKubeConfig(): Promise<string> {
        const ocOptions = Oc.getOptions({ flatten: "", minify: "true" });

        const execResult = await Oc.exec([ Oc.Commands.Config, Oc.Commands.View, ...ocOptions ], { failOnStdErr: true });
        return execResult.out;
    }

    export async function setCurrentContextNamespace(namespace: string): Promise<void> {
        ghCore.info(`Set current context's namespace to "${namespace}"`);
        const ocOptions = Oc.getOptions({ current: "", namespace });

        await Oc.exec([ Oc.Commands.Config, Oc.Commands.Set_Context, ...ocOptions ], { failOnStdErr: true });
    }
}

export default KubeConfig;
