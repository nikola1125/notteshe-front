// Post-build patch for _libs/*.mjs files in Nitro's Cloudflare Workers output.
//
// Three bugs are fixed here, in order:
//
// 1. const/let esbuild helpers → var
//    esbuild sometimes emits helpers as const/let. We need them as var for step 2.
//
// 2. Hoist helper var declarations to the top of the file
//    esbuild CJS helpers (var __exportAll, var __toESM, …) may appear AFTER the first
//    call site in the bundled output. `var` hoists the *declaration* but not the *value*
//    (arrow-function assignments are not hoisted). The call at line N therefore sees
//    `undefined`. Fix: extract every `var __helper = …;` line and move it to line 1.
//
// 3. Remove import aliases that duplicate a local var (ESM SyntaxError)
//    Rollup code-splits the schema into _ssr/ and then imports helpers back into _libs/
//    with the same names as the local vars, e.g.:
//      var __toESM = …         ← line 4
//      import { O as __toESM } ← line 6  ← SyntaxError: already declared
//    ECMAScript forbids a VarDeclaredName and a LexicallyDeclaredName with the same
//    identifier in one module scope. V8/CF Workers enforces this → outcome=canceled,
//    cpuTime=0. Fix: drop the import specifier; the local var is an identical impl.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

// All known esbuild CJS-interop helper names. Broader list catches variant names.
const ESBUILD_HELPERS = [
  "__exportAll",
  "__export",
  "__toESM",
  "__toCommonJS",
  "__getOwnPropNames",
  "__commonJS",
  "__commonJSMin",
  "__esm",
  "__esmMin",
  "__defProp",
  "__name",
  "__copyProps",
  "__spreadValues",
  "__spreadProps",
  "__objRest",
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

  // ── Step 1: normalise const/let helpers to var ──────────────────────────────
  for (const h of ESBUILD_HELPERS) {
    content = content
      .replace(new RegExp(`\\bconst (${h})\\s*=`, "g"), "var $1 =")
      .replace(new RegExp(`\\blet (${h})\\s*=`, "g"), "var $1 =");
  }

  // ── Step 2: hoist all esbuild helper var-lines to top ───────────────────────
  // Match any single-line  `var __name = <impl>;`  where __name is a known helper.
  // Using a broad pattern so we catch variant names like __defProp, __copyProps, etc.
  const HELPER_LINE_RE = new RegExp(
    `^(var (?:${ESBUILD_HELPERS.join("|")}) = [^\n]+;)[ \\t]*$`,
    "gm"
  );

  const hoisted = [];
  content = content.replace(HELPER_LINE_RE, (line) => {
    hoisted.push(line.trimEnd());
    return ""; // remove from original position
  });

  if (hoisted.length > 0) {
    // Deduplicate: keep only the first declaration of each helper name.
    const seen = new Set();
    const unique = hoisted.filter((line) => {
      const m = line.match(/^var (__\w+)\s*=/);
      if (!m || seen.has(m[1])) return false;
      seen.add(m[1]);
      return true;
    });
    // Prepend before everything else (imports are hoisted by the engine anyway).
    content = unique.join("\n") + "\n" + content;
  }

  // ── Step 3: drop import specifiers that alias to a local var name ────────────
  content = content.replace(
    /^import \{([^}]+)\} from "([^"]+)";[ \t]*$/gm,
    (line, specifiers, src) => {
      const parts = specifiers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const kept = parts.filter((spec) => {
        const m = spec.match(/^(\S+)\s+as\s+(\S+)$/);
        const localName = m ? m[2] : spec;
        // Drop this specifier only when the file already has a local var with the same name.
        return !new RegExp(`\\bvar ${localName}\\s*=`).test(content);
      });

      if (kept.length === parts.length) return line; // nothing changed
      if (kept.length === 0) return ""; // whole import is redundant
      return `import { ${kept.join(", ")} } from "${src}";`;
    }
  );

  // Clean up runs of blank lines left by removals.
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
