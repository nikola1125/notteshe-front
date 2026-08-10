// Post-build patch: fix esbuild CJS helpers in _libs/*.mjs files.
// Nitro places packages in _libs/ as raw ESM. esbuild emits helpers like __exportAll
// as const/let, but they may be used before their declaration (TDZ crash on CF Workers).
// Fix: replace const/let with var so they hoist properly — no duplicate declarations.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const HOIST_HELPERS = [
  "__exportAll",
  "__export",
  "__toESM",
  "__toCommonJS",
  "__getOwnPropNames",
  "__commonJS",
  "__esm",
];

// Nitro outputs to .output/server/_libs/ for the cloudflare-module preset
const libsDir = join(process.cwd(), ".output", "server", "_libs");

if (!existsSync(libsDir)) {
  console.log("[patch-libs] No _libs/ directory found — nothing to patch.");
  process.exit(0);
}

const files = readdirSync(libsDir).filter((f) => f.endsWith(".mjs"));
let patched = 0;

for (const file of files) {
  const filePath = join(libsDir, file);
  const original = readFileSync(filePath, "utf8");
  let content = original;

  for (const helper of HOIST_HELPERS) {
    // Replace `const helper =` and `let helper =` with `var helper =`
    content = content
      .replace(new RegExp(`\\bconst (${helper})\\s*=`, "g"), "var $1 =")
      .replace(new RegExp(`\\blet (${helper})\\s*=`, "g"), "var $1 =");
  }

  if (content !== original) {
    writeFileSync(filePath, content);
    console.log(`[patch-libs] Patched ${file}`);
    patched++;
  }
}

console.log(`[patch-libs] Done — ${patched} file(s) patched out of ${files.length} in _libs/`);
