/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

/**
 * Inputs to this action as defined in action.yml
 */
export enum Inputs {
    OS_SERVER_URL = "openshift_url",
    OS_TOKEN = "openshift_token",
    OS_USERNAME = "openshift_username",
    OS_PASSWORD = "openshift_password",
    SKIP_TLS_VERIFY = "insecure_skip_tls_verify",
    SKIP_KUBECONFIG = "skip_kubeconfig",
    NAMESPACE = "namespace",
}


/**
 * Outputs to this action as defined in action.yml
 */
export enum Outputs {
    // KUBECONFIG = "kubeconfig"
}
