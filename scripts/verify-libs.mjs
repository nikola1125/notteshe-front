// Post-patch verification for _libs/*.mjs files.
// Runs after patch-libs.mjs and fails the build if known runtime issues remain.
// This catches regressions when Nitro/Rollup changes its bundling behaviour.
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const libsDir = join(process.cwd(), ".output", "server", "_libs");

if (!existsSync(libsDir)) {
  console.log("[verify-libs] No _libs/ directory — skipping.");
  process.exit(0);
}

const ESBUILD_HELPERS = [
  "__exportAll", "__export", "__toESM", "__toCommonJS",
  "__getOwnPropNames", "__commonJS", "__commonJSMin", "__esm", "__esmMin",
];

const files = readdirSync(libsDir).filter((f) => f.endsWith(".mjs"));
let failures = 0;

for (const file of files) {
  const content = readFileSync(join(libsDir, file), "utf8");
  const lines = content.split("\n");

  for (const helper of ESBUILD_HELPERS) {
    // Check 1: no helper should still be imported from _ssr/ with an alias
    const circularImport = lines.find((l) =>
      l.includes("_ssr/") && new RegExp(`\\bas\\s+${helper}\\b`).test(l)
    );
    if (circularImport) {
      console.error(
        `[verify-libs] FAIL ${file}: still imports "${helper}" from _ssr/ (circular dep):\n  ${circularImport.trim()}`
      );
      failures++;
    }

    // Check 2: if the helper is used, its var declaration must appear before first use
    const firstCall = lines.findIndex(
      (l) => new RegExp(`\\b${helper}\\s*\\(`).test(l) && !l.trimStart().startsWith("var ")
    );
    const firstDef = lines.findIndex((l) =>
      new RegExp(`^var ${helper}\\s*=`).test(l.trimStart())
    );
    if (firstCall !== -1 && firstDef !== -1 && firstDef > firstCall) {
      console.error(
        `[verify-libs] FAIL ${file}: "${helper}" called at line ${firstCall + 1} but defined at line ${firstDef + 1}`
      );
      failures++;
    }

    // Check 3: no const/let declaration of a helper (must be var for hoisting)
    const badDecl = lines.find((l) =>
      new RegExp(`\\b(?:const|let)\\s+${helper}\\s*=`).test(l)
    );
    if (badDecl) {
      console.error(
        `[verify-libs] FAIL ${file}: "${helper}" declared with const/let (must be var):\n  ${badDecl.trim()}`
      );
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n[verify-libs] ${failures} issue(s) found — build aborted. Re-run patch-libs.mjs or check bundler output.`);
  process.exit(1);
}

console.log(`[verify-libs] OK — ${files.length} files verified, no issues found.`);
