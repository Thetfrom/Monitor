export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        window: "readonly", document: "readonly", console: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
        setInterval: "readonly", clearInterval: "readonly",
        fetch: "readonly", Promise: "readonly", URL: "readonly",
        location: "readonly", history: "readonly", navigator: "readonly",
        localStorage: "readonly", sessionStorage: "readonly",
        $w: "readonly", wixWindow: "readonly", wixUsers: "readonly",
        wixData: "readonly", backend: "readonly"
      }
    },
    rules: {
      "no-undef": "warn",
      "no-unused-vars": "warn",
      "no-console": "off",
      "eqeqeq": "error",
      "no-eval": "error",
      "no-implied-eval": "error"
    }
  }
];
