import { build } from "vite";

await build({
  clearScreen: false,
  configFile: false,
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
