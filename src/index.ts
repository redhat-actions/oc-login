
import * as ghCore from "@actions/core";
import Auth from "./auth";
import { Inputs, Outputs } from './inputs-outputs';
import KubeConfig from "./kubeconfig";

async function run() {
    const openshiftUrl = ghCore.getInput(Inputs.OS_SERVER_URL, { required: true });

    if (openshiftUrl) {
        ghCore.debug("Found Openshift URL");
    }
    else {
        throw new Error(`OpenShift URL not provided. "${Inputs.OS_SERVER_URL}" is a required input.`);
    }

    await Auth.login(openshiftUrl, Auth.getAuthInputs());

    if (ghCore.getInput(Inputs.SKIP_KUBECONFIG) == "true") {
        ghCore.info(`"${Inputs.SKIP_KUBECONFIG}" is set; skipping generating kubeconfig`);
    }
    else {
        const kubeConfigPath = await KubeConfig.exportKubeConfig();
        ghCore.setOutput(Outputs.KUBECONFIG, kubeConfigPath);
    }
}

run()
.then(() => {
    // success
    ghCore.info("Success.");
})
.catch(ghCore.setFailed);
