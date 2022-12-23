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
}>;

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
}>;

namespace KubeConfig {

    const KUBECONFIG_FILENAME = "kubeconfig.yaml";
    const KUBECONFIG_ENVVAR = "KUBECONFIG";

    export async function maskSecrets(revealClusterName: boolean): Promise<void> {
        const kubeConfigRaw = await getKubeConfig();

        let kubeConfigYml = jsYaml.load(kubeConfigRaw) as KubeConfig | undefined;
        if (kubeConfigYml == null) {
            throw new Error(`Could not load Kubeconfig as yaml`);
        }
        kubeConfigYml = kubeConfigYml as KubeConfig;

        if (!revealClusterName) {
            kubeConfigYml.contexts.forEach((context) => {
                const clusterName = context.context.cluster;
                if (clusterName) {
                    ghCore.debug(`Masking cluster name`);
                    ghCore.setSecret(clusterName);
                }
            });
        }

        kubeConfigYml.users.forEach((user) => {
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
    export async function writeOutKubeConfig(): Promise<string> {
        const kubeConfigContents = await getKubeConfig();

        // TODO make this path configurable through env or input.
        let kubeConfigDir;
        const ghWorkspace = process.env.GITHUB_WORKSPACE;
        if (ghWorkspace) {
            kubeConfigDir = ghWorkspace;
        }
        else {
            kubeConfigDir = process.cwd();
        }

        const kubeConfigPath = path.resolve(kubeConfigDir, KUBECONFIG_FILENAME);

        ghCore.info(`Writing out Kubeconfig to ${kubeConfigPath}`);
        await promisify(fs.writeFile)(kubeConfigPath, kubeConfigContents);
        await promisify(fs.chmod)(kubeConfigPath, "600");

        ghCore.startGroup("Kubeconfig contents");
        ghCore.info(kubeConfigContents);
        ghCore.endGroup();

        ghCore.info(`Exporting ${KUBECONFIG_ENVVAR}=${kubeConfigPath}`);
        ghCore.exportVariable(KUBECONFIG_ENVVAR, kubeConfigPath);

        return kubeConfigPath;
    }

    export async function setCurrentContextNamespace(namespace: string): Promise<void> {
        const currentContext = (await Oc.exec([ Oc.Commands.Config, Oc.Commands.CurrentContext ])).output.trim();

        ghCore.info(`Set current context's namespace to "${namespace}"`);

        const nsOption = Oc.getOptions({ namespace });

        await Oc.exec([ Oc.Commands.Config, Oc.Commands.SetContext, currentContext, ...nsOption ]);
    }

    /**
     * @returns the contents of the kubeconfig file as a string.
     */
    async function getKubeConfig(): Promise<string> {
        const ocOptions = Oc.getOptions({ flatten: "" });

        const execResult = await Oc.exec(
            [ Oc.Commands.Config, Oc.Commands.View, ...ocOptions ],
            { hideOutput: true /* Changing this breaks windows - See note about hideOutput in oc.exec */ }
        );
        return execResult.output;
    }
}

export default KubeConfig;
