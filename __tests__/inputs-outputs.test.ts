import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as jsYaml from "js-yaml";
import { Inputs } from "../src/generated/inputs-outputs.js";

interface ActionYml {
    inputs?: Record<string, { description: string; required?: boolean; default?: string }>;
    outputs?: Record<string, { description: string }>;
}

describe("inputs-outputs enum matches action.yml", () => {
    const actionYmlPath = path.resolve(__dirname, "..", "action.yml");
    const actionYml = jsYaml.load(fs.readFileSync(actionYmlPath, "utf-8")) as ActionYml;
    const actionInputNames = Object.keys(actionYml.inputs || {});

    it("should have an enum entry for every action.yml input", () => {
        const enumValues = Object.values(Inputs);

        for (const inputName of actionInputNames) {
            expect(
                enumValues,
                `Missing enum entry for action.yml input "${inputName}"`,
            ).toContain(inputName);
        }
    });

    it("should not have enum entries for inputs that don't exist in action.yml", () => {
        const enumValues = Object.values(Inputs);

        for (const enumValue of enumValues) {
            expect(
                actionInputNames,
                `Enum entry "${enumValue}" has no matching action.yml input`,
            ).toContain(enumValue);
        }
    });

    it("should have the correct number of inputs", () => {
        const enumValues = Object.values(Inputs);
        expect(enumValues).toHaveLength(actionInputNames.length);
    });
});
