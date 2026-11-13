/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are forbidden across workspace packages and apps.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "utils-and-config-no-apps-or-factory",
      severity: "error",
      comment:
        "@cmp/utils and @cmp/config are foundational packages and must not import from apps/* or @cmp/factory.",
      from: {
        path: "^packages/(utils|config)/",
      },
      to: {
        path: "^(apps/|packages/factory/)",
      },
    },
    {
      name: "factory-no-apps",
      severity: "error",
      comment: "packages/factory must not import from apps/*.",
      from: {
        path: "^packages/factory/",
      },
      to: {
        path: "^apps/",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules"],
    },
    exclude: {
      path: ["dist/", "node_modules/"],
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
