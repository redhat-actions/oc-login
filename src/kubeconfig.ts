import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import * as ghCore from "@actions/core";
import Oc from "./oc";

namespace KubeConfig {

    export async function exportKubeConfig(): Promise<void> {
        const kubeConfigPath = path.resolve(process.cwd(), "oc-kubeconfig.yaml");

        const kubeConfig = await getKubeConfig();

        ghCore.info(`Writing out kubeconfig to ${kubeConfigPath}`);
        await promisify(fs.writeFile)(kubeConfigPath, kubeConfig);

        ghCore.exportVariable("KUBECONFIG", kubeConfigPath);

        // return kubeConfigPath;
    }

    /**
     * @returns the current context's kubeconfig as a string.
     */
    async function getKubeConfig(): Promise<string> {
        const ocOptions = Oc.getOptions({ flatten: "", minify: "true" });

        const execResult = await Oc.exec([ Oc.Commands.Config, Oc.Commands.View, ...ocOptions ], { silent: true, failOnStdErr: true });

        if (execResult.exitCode !== 0) {
            // the command and err are already present in the action output
            const error = `oc failed with exit code ${execResult.exitCode}`;
            throw new Error(error)
        }
        return execResult.out;
    }
}

export default KubeConfig;
