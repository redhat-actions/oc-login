# oc-login Changelog

## v2.0

### Breaking Changes
- **Node.js 24 runtime**: The action now runs on Node.js 24. GitHub runners must support `node24` actions.
- **KUBECONFIG set before login**: The action now sets `KUBECONFIG` to `$GITHUB_WORKSPACE/kubeconfig.yaml` before running `oc login`, so `oc` writes directly to an isolated file instead of `~/.kube/config`. This fixes race conditions on self-hosted runners but may affect workflows that depend on the previous behavior of writing to `~/.kube/config` first.
- **Post-step logout**: The action now logs out of OpenShift and removes the kubeconfig file at the end of the job by default. Set `logout: false` to preserve the previous behavior.

### Features
- **OIDC authentication** (#42): New `use_oidc` and `oidc_audience` inputs enable authentication using GitHub's OIDC tokens for workload identity federation. Requires the cluster's API server to be configured with GitHub as an OIDC provider.
- **Optional server URL** (#24): `openshift_server_url` is no longer required. When omitted, `oc login` uses the existing kubeconfig context on the runner.
- **Post-step logout** (#2): New `logout` input (default: `true`) controls whether the action logs out and cleans up the kubeconfig at the end of the job. Recommended for self-hosted runners.
- **Race condition fix** (#41): Concurrent jobs on self-hosted runners no longer clobber each other's kubeconfig by writing to a shared `~/.kube/config`.

### Dependencies
- Upgraded `@actions/core` to v3.0.1, `@actions/exec` to v3.0.0, `js-yaml` to v5.2.1
- Upgraded TypeScript to 6.x, ESLint to 10.x with flat config
- Upgraded `@vercel/ncc` to 0.44.x
- Bundle size reduced from 539kB to 86kB

### CI & Infrastructure
- Migrated all workflows to `ubuntu-24.04` with `actions/checkout@v7` and `actions/setup-node@v7`
- Added `permissions: contents: read` and concurrency groups to all workflows
- Added path filters to avoid unnecessary CI runs
- Replaced archived `gaurav-nelson/github-action-markdown-link-check` with `lycheeverse/lychee-action@v2`
- Removed dead workflows: CRDA vulnerability scan, OpenShift 3 tests, broken multiplatform and OpenShift cron jobs
- Added Dependabot configuration for npm and GitHub Actions dependencies
- Added `.github/CODEOWNERS`
- Enabled secret scanning and push protection

### Tests
- Added unit tests for auth and kubeconfig modules (29 -> 52 tests)
- Added `inputs-outputs.test.ts` to verify action.yml and TypeScript enum consistency

## v1.3
- Update action to run on Node20. https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20

## v1.2
- Update action to run on Node16. https://github.blog/changelog/2022-05-20-actions-can-now-run-in-a-node-js-16-runtime/

## v1.1
- Fix outputting cluster name even if cluster URL is a secret [44a205b](https://github.com/redhat-actions/oc-login/commit/44a205bfdb2855939f9aca5fd1ac86d33e8083f4) [693904d](https://github.com/redhat-actions/oc-login/commit/693904d88f5051924eb54000836f17191013927d)
- (Internal) Add ESLint [68f49e4b](https://github.com/redhat-actions/oc-login/commit/68f49e4bbabef567725fc41b73c3dec2d726a670)
- (Internal) Fix pull_request triggers [9d7ac97b](https://github.com/redhat-actions/oc-login/commit/9d7ac97b2abf83109ddf637a3be1fef8a197f4c6)

## v1.0
Initial marketplace release


## v0.1
Initial pre-release
