export enum Inputs {
    OS_SERVER_URL = "openshift_url",
    OS_TOKEN = "openshift_token",
    OS_USERNAME = "openshift_username",
    OS_PASSWORD = "openshift_password",
    SKIP_TLS_VERIFY = "insecure_skip_tls_verify",
    SKIP_KUBECONFIG = "skip_kubeconfig"
}

export enum Outputs {
    KUBECONFIG = "kubeconfig"
}
