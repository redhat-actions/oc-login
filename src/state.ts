/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as ghCore from "@actions/core";

/**
 * Tracks whether this is a post-action invocation and passes state between main and post steps.
 */

export const isPost = !!process.env.STATE_isPost;
export const logout = /true/i.test(process.env.STATE_logout || "");
export const kubeconfigPath = process.env.STATE_kubeconfigPath || "";

export function setLogout(value: string): void {
    ghCore.saveState("logout", value);
}

export function setKubeconfigPath(value: string): void {
    ghCore.saveState("kubeconfigPath", value);
}

// Mark that the main step has run, so subsequent invocations enter the post path.
if (!isPost) {
    ghCore.saveState("isPost", "true");
}
