/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/

import { Writable } from "stream";

/**
 * Use this when the desired behaviour is to print the command line (the first line), but not the output.
 * The output is captured into 'outContents'.
 * This allows us to hide output from the user but still use it programmatically.
 */
export default class CmdOutputHider extends Writable {
    private hasEchoedCmdLine = false;

    constructor(
        private readonly outStream: Writable,
        private outContents: string,
    ) {
        super();
    }

    public write(chunk: Buffer): boolean {
        if (!this.hasEchoedCmdLine) {
            this.outStream.write(chunk);
            if ((chunk.toString() as string).includes("\n")) {
                this.hasEchoedCmdLine = true;
                this.outStream.write(`*** Suppressing command output\n`);
            }
        }
        else {
            // the cmd line is left out of the contents, but everything else is captured here.
            this.outContents += chunk.toString();
        }

        return false;
    }

    public getContents(): string {
        return this.outContents;
    }
}
