/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import * as os from "os";

type OS = "linux" | "macos" | "windows";

let currentOS: OS;

export function getOS(): OS {
    if (currentOS == null) {
        const rawOS = process.platform;
        if (rawOS === "win32") {
            currentOS = "windows";
        }
        else if (rawOS === "darwin") {
            currentOS = "macos";
        }
        else if (rawOS !== "linux") {
            console.warn(`Unrecognized OS "${rawOS}"`);
        }
        currentOS = "linux";
    }

    return currentOS;
}

/**
 * @returns Path to a directory to write out any files that should be cleaned up when the action finishes.
 * Capturing this in a function allows this to be configured later if desired.
 */
export function getTmpDir(): string {
    return os.tmpdir();
}
