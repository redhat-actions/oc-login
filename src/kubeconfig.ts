/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import * as ghCore from "@actions/core";
import * as jsYaml from "js-yaml";
import Oc from "./oc";

type KubeConfigUser = Readonly<{
    "client-certificate-data"?: string;
    "client-key-data"?: string;
    token?: string;
}>

type KubeConfig = Readonly<{
    apiVersion: string;
    clusters: [{
        cluster: {
            server: string;
        }
        name: string;
    }];
    contexts: [{
        context: {
            cluster: string;
            namespace?: string;
            user: string;
        };
        name: string;
    }];
    "current-context"?: string;
    kind: string;
    // preferences: {}
    users: [{
        name: string;
        user: KubeConfigUser;
    }]
}>

namespace KubeConfig {

    const KUBECONFIG_FILENAME = "oc-kubeconfig.yaml";
    const KUBECONFIG_ENVVAR = "KUBECONFIG";

    /**
     * Write out the current kubeconfig to a new file and export the `KUBECONFIG` env var to point to that file.
     * This allows other steps in the job to reuse the kubeconfig.
     *
     * @param namespace Set the current context's namespace to this, if set.
     */
    export async function exportKubeConfig(): Promise<string> {

        // TODO make this path configurable through env or input.
        const kubeConfigPath = path.resolve(process.cwd(), KUBECONFIG_FILENAME);

        const kubeConfigRaw = await getKubeConfig();

        let kubeConfig = jsYaml.safeLoad(kubeConfigRaw) as KubeConfig | undefined;
        if (kubeConfig == null) {
            throw new Error(`Could not load Kubeconfig as yaml`);
        }
        kubeConfig = kubeConfig as KubeConfig;

        kubeConfig.users.forEach((user) => {
            const secretKeys: (keyof KubeConfigUser)[] = [ "client-certificate-data", "client-key-data", "token" ];
            secretKeys.forEach((key) => {
                const value = user.user[key]
                if (value) {
                    ghCore.info(`Masking ${key}`);
                    ghCore.setSecret(value);
                }
            })
        });

        ghCore.info(`Writing out Kubeconfig to ${kubeConfigPath}`);
        await promisify(fs.writeFile)(kubeConfigPath, kubeConfigRaw);

        ghCore.startGroup("Kubeconfig contents");
        ghCore.info(kubeConfigRaw);
        ghCore.endGroup();

        ghCore.info(`Exporting ${KUBECONFIG_ENVVAR}=${kubeConfigPath}`)
        ghCore.exportVariable(KUBECONFIG_ENVVAR, kubeConfigPath);

        return kubeConfigPath;
    }

    /**
     * @returns the current context's kubeconfig as a string.
     */
    async function getKubeConfig(): Promise<string> {
        const ocOptions = Oc.getOptions({ flatten: "", minify: "true" });

        // This must be executed silently since the secrets are not yet known to the action, and have not yet been masked.
        const execResult = await Oc.exec([ Oc.Commands.Config, Oc.Commands.View, ...ocOptions ], { silent: true, failOnStdErr: true });
        return execResult.out;
    }

    export async function setCurrentContextNamespace(namespace: string): Promise<void> {
        ghCore.info(`Set current context's namespace to "${namespace}"`);
        const ocOptions = Oc.getOptions({ current: "", namespace });

        await Oc.exec([ Oc.Commands.Config, Oc.Commands.Set_Context, ...ocOptions ], { failOnStdErr: true });
    }
}

export default KubeConfig;
