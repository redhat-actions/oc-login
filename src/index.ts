
import * as ghCore from "@actions/core";
import Auth from "./auth";
import { Inputs, Outputs } from './inputs-outputs';
import KubeConfig from "./kubeconfig";

async function main() {
    const openshiftUrl = ghCore.getInput(Inputs.OS_SERVER_URL);

    if (openshiftUrl) {
        ghCore.debug("Found Openshift URL");
    }
    else {
        throw new Error(`OpenShift URL not provided. "${Inputs.OS_SERVER_URL}" is a required input.`);
    }

    await Auth.login(openshiftUrl, Auth.getAuthInputs());

    const kubeconfig = await KubeConfig.getKubeConfig();
    ghCore.setOutput(Outputs.KUBECONFIG, kubeconfig);
    ghCore.info(`Saved output "${Outputs.KUBECONFIG}"`);
}

main()
.then(() => {
    // success
    ghCore.info("Success.");
}).catch((err) => {
    ghCore.setFailed(err.message || err);
    process.exit(1);
});
