import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const globalEntry = resolve(root, "src/styles/index.css");
const featureStyles = [
  ["admin", "src/features/admin/AdminView.tsx"],
  ["expert", "src/features/expert/ExpertView.tsx"],
  ["brand", "src/features/brand/BrandView.tsx"],
];

const globalCss = await readFile(globalEntry, "utf8");
const failures = [];

for (const [feature, viewPath] of featureStyles) {
  const styleImport = `../../styles/${feature}.css`;
  if (globalCss.includes(`${feature}.css`)) {
    failures.push(`${feature}.css must remain feature-scoped and must not be imported by src/styles/index.css`);
  }

  const viewSource = await readFile(resolve(root, viewPath), "utf8");
  if (!viewSource.includes(styleImport)) {
    failures.push(`${viewPath} must import ${styleImport}`);
  }
}

if (failures.length > 0) {
  console.error("Style architecture check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Style architecture check passed: role styles are loaded with their lazy feature views.");
