export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "ui",
        "api",
        "auth",
        "brand",
        "ci",
        "cd",
        "database",
        "db",
        "docs",
        "deps",
        "groups",
        "loans",
        "nav",
        "ops",
        "party",
        "sveltekit",
      ],
    ],
  },
};
