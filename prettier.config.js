// @ts-check
/** @type {import("prettier").Config} */
export default {
    semi: true,
    trailingComma: "all",
    singleQuote: false,
    printWidth: 120,
    endOfLine: "auto",
    tabWidth: 4,
    useTabs: false,
    overrides: [
        {
            files: "*.json",
            options: {
                parser: "json",
            },
        },
    ],
};
