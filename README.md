# oc-login

[![CI checks](https://github.com/redhat-actions/oc-login/workflows/CI%20checks/badge.svg)](https://github.com/redhat-actions/oc-login/actions?query=workflow%3A%22CI+checks%22)
[![oc login workflow](https://github.com/redhat-actions/oc-login/workflows/oc-login%20Example/badge.svg)](https://github.com/redhat-actions/oc-login/actions?query=workflow%3A%22oc-login+Example%22)
[![Multiplatform Workflow](https://github.com/redhat-actions/oc-login/workflows/Multiplatform%20Workflow/badge.svg)](https://github.com/redhat-actions/oc-login/actions?query=workflow%3A%22Multiplatform+Workflow%22)
[![Link checker](https://github.com/redhat-actions/oc-login/workflows/Link%20checker/badge.svg)](https://github.com/redhat-actions/oc-login/actions?query=workflow%3A%22Link+checker%22)

[![tag badge](https://img.shields.io/github/v/tag/redhat-actions/oc-login)](https://github.com/redhat-actions/oc-login/tags)
[![license badge](https://img.shields.io/github/license/redhat-actions/oc-login)](./LICENSE)
[![size badge](https://img.shields.io/github/size/redhat-actions/oc-login/dist/index.js)](./dist)

`oc-login` is a GitHub Action to log into an OpenShift cluster, and preserve that Kubernetes context for the remainder of the job.

See the [OpenShift Documentation](https://docs.openshift.com/enterprise/3.0/dev_guide/authentication.html) for an explanation of a log in using `oc`, which this action wraps.

<a id="getting-started"></a>

## Getting Started with the Action (or, [see example](#example-workflow-step))

1. `oc` must be installed on the GitHub Action runner you specify.

    - The [Ubuntu Environments](https://github.com/actions/virtual-environments#available-environments) come with `oc` installed.
    - If you want a different version of `oc`, or if you are using the Mac or Windows environments, use the [`openshift-tools-installer`](https://github.com/redhat-actions/openshift-tools-installer) action to install `oc` before running this action.
      - See the [multiplatform example](./.github/workflows/multiplatform.yml)

2. Find your OpenShift Server URL.
    - If you have already performed an `oc login` locally, run `oc whoami --show-server`.
    - Otherwise, in the Web Console, click your profile name, then **Copy Login Commmand**. The `--server` option contains the OpenShift server URL.
    - At this time, the cluster must be available on the internet, so the Action runner can access it.

3. Decide how you are going to log into the OpenShift server from the action.
    - The recommended approach is to [create a functional Service Account and use its token](https://github.com/redhat-actions/oc-login/wiki/Using-a-Service-Account-for-GitHub-Actions).
      - The primary advantage of Service Accounts is that by default, their tokens do not expire.
    - You can also use a personal token.
      - If you have already logged in locally, use `oc whoami --show-token`.
      - Otherwise, you can retrieve your token from the Web Console, using the same steps as in Step 2.
      - Personal tokens generally expire after 12 or 24 hours, depending on how your cluster is configured.
    - You can also use your personal credentials (username and password).
    - If both token and credentials are provided, the credentials take precedence and the token is ignored.

4. Determine how you are going to manage SSL/TLS certificate verification. If your cluster uses self-signed certificates (which is the default), the GitHub runner will not recognize the certificate and will not allow you to issue HTTPS requests.
    - The easiest way to get around this is to set the `insecure_skip_tls_verify` input to `true`.
    - You can also obtain the self-signed certificate data (from a `.crt` file) and use the `certificate_authority_data` input.
<!-- markdown-link-check-disable -->
5. Store the Server URL and any credentials (passwords, tokens, or certificates) in GitHub Secrets.
    - [Refer to the GitHub documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets).
    - You can name them anything you like. See below for an example.
<!-- markdown-link-check-enable -->
6. Create your workflow.

## Example Workflow Step
- Refer to [`action.yml`](./action.yml) for the full list of inputs.
- See the [example workflow](./.github/workflows/example.yml).
- See the [multiplatform workflow](./.github/workflows/multiplatform.yml) for an example which installs `oc` and `kubectl` into the runner first.

```yaml
steps:
  - name: Authenticate and set context
    uses: redhat-actions/oc-login@v1
    env:
      # These can be stored in secrets, if desired.
      OPENSHIFT_USER: my-username
      OPENSHIFT_NAMESPACE: my-namespace

    with:
      # URL to your OpenShift cluster.
      # Refer to Step 2.
      openshift_server_url: ${{ secrets.OPENSHIFT_SERVER }}

      # Authentication Token. Can use username and password instead.
      # Refer to Step 3.
      openshift_token: ${{ secrets.OPENSHIFT_TOKEN }}

      # Credentials, if desired instead of token.
      # Username and password override token if they are set.
      openshift_username: ${{ env.OPENSHIFT_USER }}
      openshift_password: ${{ secrets.OPENSHIFT_PASSWORD }}

      # Disables SSL cert checking. Use this if you don't have the certificate authority data.
      insecure_skip_tls_verify: true
      # This method is more secure, if the certificate from Step 4 is available.
      certificate_authority_data: ${{ secrets.CA_DATA }}

      # Optional - this sets your Kubernetes context's current namespace after logging in.
      namespace: ${{ env.OPENSHIFT_NAMESPACE }}
```

### Other Optional Inputs
By default, the cluster name is masked, since it can be used to derive the server URL. Set `reveal_cluster_name` to `true` to skip masking the cluster name if you wish it to be visible in the workflow logs.

## Result
If the `oc-login` step succeeds:
- The Kubernetes config generated by `oc` will be saved into a file
- The `KUBECONFIG` environment variable will be set to that file
- The rest of the job will have access to the Kubernetes context, so you can run any `oc` or `kubectl` commands you like.

Note that if you start another `job`, the new job will use a new container, and you will have to run this action again.
Since the kubeconfig contains secrets, it should not be uploaded in an artifact, and cannot set as an output from this action.

## Runner OS Support
See the [multiplatform workflow](./.github/workflows/multiplatform.yml). All 3 runner operating systems are supported.

See the note in [Step 1](#getting-started) regarding installing `oc` into the non-Ubuntu runners.

## Contributing
Anyone can contribute to this project.

This project uses a pre-commit hook to ensure consistency between the source code and distribution, as well as between the source code and `action.yml`. This is verified by the `CI Checks` workflow.

After cloning this repository, install the hooks by running:

```sh
cd oc-login/
cp -r scripts/git-hooks/ .git/hooks/
```

Then run `npm ci` to install dependencies, and you should be ready to develop.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
