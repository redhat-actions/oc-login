import Oc from "./oc";

namespace KubeConfig {
    /**
     * @returns the current context's kubeconfig.
     */
    export async function getKubeConfig(): Promise<string> {
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
