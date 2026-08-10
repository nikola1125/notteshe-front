// Post-build patch for _libs/*.mjs files in Nitro's Cloudflare Workers output.
//
// Two classes of bugs are fixed here:
//
// 1. const/let esbuild helpers → var
//    esbuild emits helpers like __exportAll as const/let at the top of each _libs file.
//    When those helpers are called before their declaration (temporal dead zone), the
//    Worker crashes with "not a function". Changing to var enables hoisting.
//
// 2. Duplicate-name conflict between local var helpers and import aliases
//    Rollup/Nitro bundles the schema into a shared _ssr/ chunk and then imports
//    helpers from it back into each _libs file with the SAME names as the local vars:
//      var __toESM = ...          ← line 4
//      import { O as __toESM }    ← line 6  ← CONFLICT (ESM SyntaxError)
//    ECMAScript forbids a VarDeclaredName and a LexicallyDeclaredName (import binding)
//    with the same identifier in the same module scope. CF Workers (V8) enforces this
//    strictly, causing outcome=canceled with cpuTime=0.
//    Fix: remove the conflicting import specifiers; the local var provides the same impl.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const ESBUILD_HELPERS = [
  "__exportAll",
  "__export",
  "__toESM",
  "__toCommonJS",
  "__getOwnPropNames",
  "__commonJS",
  "__esm",
];

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

  // --- Fix 1: replace const/let helper declarations with var ---
  for (const helper of ESBUILD_HELPERS) {
    content = content
      .replace(new RegExp(`\\bconst (${helper})\\s*=`, "g"), "var $1 =")
      .replace(new RegExp(`\\blet (${helper})\\s*=`, "g"), "var $1 =");
  }

  // --- Fix 2: remove import specifiers that alias to the same name as a local var ---
  // Process each import statement line by line.
  content = content.replace(
    /^import \{([^}]+)\} from "([^"]+)";$/gm,
    (line, specifiers, src) => {
      const parts = specifiers.split(",").map((s) => s.trim()).filter(Boolean);

      const kept = parts.filter((spec) => {
        // Parse "originalName as localName" or just "name"
        const match = spec.match(/^(\S+)\s+as\s+(\S+)$/);
        const localName = match ? match[2] : spec;

        // Only drop this specifier if the file ALSO declares the same name as var
        // (i.e. the local var is a valid replacement for the import)
        const hasLocalVar = new RegExp(`\\bvar ${localName}\\s*=`).test(content);
        return !hasLocalVar;
      });

      if (kept.length === parts.length) return line; // nothing to drop
      if (kept.length === 0) return ""; // whole import is redundant — drop it
      return `import { ${kept.join(", ")} } from "${src}";`;
    }
  );

  // Clean up any blank lines left by dropped imports (replace 2+ consecutive newlines with 1)
  content = content.replace(/\n{3,}/g, "\n\n");

  if (content !== original) {
    writeFileSync(filePath, content);
    console.log(`[patch-libs] Patched ${file}`);
    patched++;
  }
}

console.log(
  `[patch-libs] Done — ${patched} file(s) patched out of ${files.length} in _libs/`
);
