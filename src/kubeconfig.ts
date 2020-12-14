/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
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

    export async function maskSecrets(revealClusterName: boolean): Promise<void> {
        const kubeConfigRaw = await getKubeConfig(true);

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
    }

    /**
     * Write out the current kubeconfig to a new file and export the `KUBECONFIG` env var to point to that file.
     * This allows other steps in the job to reuse the kubeconfig.
     */
    export async function exportKubeConfig(): Promise<string> {
        const kubeConfigRaw = await getKubeConfig(false);

        const kubeConfigDir = await mkKubeConfigDir(true);
        const kubeConfigPath = path.join(kubeConfigDir, "config");

        ghCore.info(`Writing out Kubeconfig to ${kubeConfigPath}`);
        await promisify(fs.writeFile)(kubeConfigPath, kubeConfigRaw);
        await promisify(fs.chmod)(kubeConfigPath, '600');

        // ghCore.startGroup("Kubeconfig contents");
        // ghCore.info(kubeConfigRaw);
        // ghCore.endGroup();

        ghCore.info(`Exporting ${KUBECONFIG_ENVVAR}=${kubeConfigPath}`);
        ghCore.exportVariable(KUBECONFIG_ENVVAR, kubeConfigPath);

        return kubeConfigPath;
    }

    async function mkKubeConfigDir(firstTry: boolean): Promise<string> {
        let kubeConfigDir: string;
        if (firstTry) {
            kubeConfigDir = path.join(os.homedir(), KUBECONFIG_DIR);
        }
        else {
            kubeConfigDir = path.join(process.cwd(), KUBECONFIG_DIR);
        }

        try {
            await promisify(fs.mkdir)(kubeConfigDir, { recursive: true });
        }
        catch (err) {
            if (err.code !== "EACCES") {
                ghCore.info(`No permissions to create ${kubeConfigDir}`);
                if (firstTry) {
                    return mkKubeConfigDir(false);
                }
                else {
                    throw err;
                }
            }
            else if (err.code === "EEXIST") {
                ghCore.info(`${kubeConfigDir} already exists`);
            }
            else {
                // Unexpected error - fail
                throw err;
            }
        }

        return kubeConfigDir;
    }

    /**
     * @returns the current context's kubeconfig as a string.
     */
    async function getKubeConfig(hideOutput: boolean): Promise<string> {
        const ocOptions = Oc.getOptions({ flatten: "", minify: "true" });

        const execResult = await Oc.exec([ Oc.Commands.Config, Oc.Commands.View, ...ocOptions ], { hideOutput });
        return execResult.out;
    }

    export async function setCurrentContextNamespace(namespace: string): Promise<void> {
        ghCore.info(`Set current context's namespace to "${namespace}"`);
        const ocOptions = Oc.getOptions({ current: "", namespace });

        await Oc.exec([ Oc.Commands.Config, Oc.Commands.Set_Context, ...ocOptions ]);
    }
}

export default KubeConfig;
