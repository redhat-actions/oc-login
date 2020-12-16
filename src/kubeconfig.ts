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

    const KUBECONFIG_DIR = ".kube";
    const KUBECONFIG_ENVVAR = "KUBECONFIG";

    let kubeConfigPath: string | undefined;
    let hasMaskedSecrets = false;

    export async function setKubeConfigPath(): Promise<string> {
        ghCore.debug(`Setting up kubeconfig path`);

        // The kubeconfig is created under cwd/.kube/
        // We do not use ~/.kube because that directory is not mounted into Docker actions, and this one is.
        const kubeConfigDir = path.join(process.cwd(), KUBECONFIG_DIR);
        await promisify(fs.mkdir)(kubeConfigDir, { recursive: true });

        kubeConfigPath = path.join(kubeConfigDir, "config.yml");

        ghCore.info(`Exporting ${KUBECONFIG_ENVVAR}=${kubeConfigPath}`);
        ghCore.exportVariable(KUBECONFIG_ENVVAR, kubeConfigPath);
        return kubeConfigPath;
    }

    export async function maskSecrets(revealClusterName: boolean): Promise<void> {
        ghCore.debug(`Masking secrets`);
        const kubeConfigRaw = await getKubeConfig();

        let kubeConfig = jsYaml.safeLoad(kubeConfigRaw) as KubeConfig | undefined;
        if (kubeConfig == null) {
            throw new Error(`Could not load Kubeconfig as yaml`);
        }
        kubeConfig = kubeConfig as KubeConfig;

        if (!revealClusterName) {
            kubeConfig.contexts.forEach((context) => {
                const clusterName = context.context?.cluster;
                if (clusterName) {
                    ghCore.debug(`Masking cluster name`);
                    ghCore.setSecret(clusterName);
                }
            });
        }

        kubeConfig.users.forEach((user) => {
            const secretKeys: (keyof KubeConfigUser)[] = [ "client-certificate-data", "client-key-data", "token" ];
            secretKeys.forEach((key) => {
                const value = user.user[key];
                if (value) {
                    ghCore.debug(`Masking ${key}`);
                    ghCore.setSecret(value);
                }
            });
        });

        hasMaskedSecrets = true;
        ghCore.debug(`Finished masking secrets`);
    }

    export async function setCurrentContextNamespace(namespace: string): Promise<void> {
        ghCore.debug(`Set current context's namespace to "${namespace}"`);
        const ocOptions = Oc.getOptions({ current: "", namespace });

        await Oc.exec([ Oc.Commands.Config, Oc.Commands.Set_Context, ...ocOptions ]);
    }

    /**
     * Write out the current kubeconfig to a new file and export the `KUBECONFIG` env var to point to that file.
     * This allows other steps in the job to reuse the kubeconfig.
     */
    export async function exportKubeConfig(): Promise<string> {
        if (!kubeConfigPath) {
            throw new Error(`kubeconfig path is not set - cannot export kubeconfig.`);
        }

        const kubeConfigRaw = await getKubeConfig();

        ghCore.info(`Writing out Kubeconfig to ${kubeConfigPath}`);
        await promisify(fs.writeFile)(kubeConfigPath, kubeConfigRaw);
        await promisify(fs.chmod)(kubeConfigPath, '600');

        // ghCore.startGroup("Kubeconfig contents");
        // ghCore.info(kubeConfigRaw);
        // ghCore.endGroup();
        return kubeConfigPath;
    }

    /**
     * @returns the current context's kubeconfig as a string.
     */
    async function getKubeConfig(): Promise<string> {
        const ocOptions = Oc.getOptions({ flatten: "" });

        const hideOutput = !hasMaskedSecrets;
        const execResult = await Oc.exec([ Oc.Commands.Config, Oc.Commands.View, ...ocOptions ], { hideOutput });
        return execResult.out;
    }
}

export default KubeConfig;
