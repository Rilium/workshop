import { build } from "esbuild";

const result = await build({
  entryPoints: ["tests/unit/client-architecture.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  write: false,
  sourcemap: "inline",
  define: {
    "import.meta.env.DEV": "false",
  },
});

const source = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
