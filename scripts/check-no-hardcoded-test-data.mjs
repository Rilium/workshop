import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync("Code.gs")) {
  console.error("Code.gs non deve esistere nella root: la fonte Apps Script e google-workspace/apps-script/Code.gs.");
  process.exit(1);
}

const allowedFiles = new Set([
  "config/local-test-settings.json",
  "scripts/check-no-hardcoded-test-data.mjs",
  "docs/PRODUCTION_READINESS_SHEET_DB.md",
]);

const checks = [
  {
    pattern: "testRecipients",
    message: "Non reintrodurre recipient di test nel codice: usa config/local-test-settings.json per i test locali e Settings/env per prod.",
  },
  {
    pattern: "rinaldi",
    message: "Dati personali/test non devono stare nel codice applicativo.",
  },
  {
    pattern: "rilio",
    message: "Dati personali/test non devono stare nel codice applicativo.",
  },
  {
    pattern: "jokey",
    message: "Dati personali/test non devono stare nel codice applicativo.",
  },
  {
    pattern: "@gmail.com",
    message: "Email personali non devono stare nel codice applicativo. Usa config locale, env o Sheet Settings.",
  },
];

const scanRoots = ["src", "google-workspace", "tests", "docs", "scripts", ".env.example", "README.md"];

function walk(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  if (!stat.isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) return [];
    return walk(`${path}/${entry.name}`);
  });
}

const failures = [];
const rgFiles = spawnSync("rg", ["--files", ...scanRoots.filter((path) => existsSync(path))], { encoding: "utf8" });
const files = rgFiles.status === 0
  ? rgFiles.stdout.split(/\r?\n/).filter(Boolean)
  : scanRoots.flatMap(walk);

for (const file of files) {
  if (allowedFiles.has(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const check of checks) {
    if (content.includes(check.pattern)) {
      failures.push(`${file}: contiene "${check.pattern}" - ${check.message}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS no hardcoded local/test recipients outside config/local-test-settings.json");
