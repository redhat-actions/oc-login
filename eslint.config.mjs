import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "node_modules/",
            "dist/",
            "out/",
            "lib/",
        ],
    },
    js.configs.recommended,
    {
        files: ["src/**/*.ts"],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // The codebase uses TypeScript namespaces extensively
            "@typescript-eslint/no-namespace": "off",
        },
    },
    {
        files: ["__tests__/**/*.ts"],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.test.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-namespace": "off",
        },
    },
);
