// Post-build patch for _libs/*.mjs files in Nitro's Cloudflare Workers output.
//
// ROOT CAUSE: The bundler code-splits drizzle-orm into _libs/drizzle-orm.mjs and
// the app schema into _ssr/schema-*.mjs. These two files import each other:
//
//   _libs/drizzle-orm.mjs  → import { D as __exportAll } from "../_ssr/schema-*.mjs"
//   _ssr/schema-*.mjs      → import { pgTable, text, ... }  from "../_libs/drizzle-orm.mjs"
//
// ESM circular dependencies cause the imported `__exportAll` to be `undefined` when
// drizzle-orm.mjs reaches its call site, producing:
//   TypeError: __exportAll is not a function at _libs/drizzle-orm.mjs:5618
//
// The same pattern affects other _libs files that import __toESM, __commonJSMin, etc.
// from the schema chunk.
//
// FIX STRATEGY (applied in order):
//
//  1. const/let → var  (normalise; makes helpers extractable in step 3)
//
//  2. Inline known helpers imported from _ssr/schema chunks
//     Any `import { X as __helper }` from a _ssr/ file is replaced with a self-contained
//     var declaration. This breaks the circular dependency entirely.
//
//  3. Hoist all esbuild/rolldown helper var lines to line 1
//     Even if a file defines __exportAll locally, it may appear after the call site.
//     var hoists the *declaration* (undefined) but not the value. Moving the line to
//     the top ensures the value is assigned before any call.
//
//  4. Drop import specifiers that duplicate a local var (ESM SyntaxError)
//     Having both `var x = …` and `import { y as x }` in module scope is a SyntaxError
//     in strict ESM (V8/CF Workers). Remove the redundant import specifier.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

// Known esbuild/rolldown CJS-interop helper names.
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

// Self-contained implementations for helpers that may be imported from schema chunks.
// These replace the circular import so the helper is always available from line 1.
// __exportAll uses the rolldown one-argument convention (returns object) because that's
// how rolldown-generated _libs files call it.
const HELPER_IMPLS = {
  __exportAll:
    'var __exportAll = (all, no_symbols) => { let target = {}; for (var name in all) Object.defineProperty(target, name, { get: all[name], enumerable: true }); if (!no_symbols) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" }); return target; };',
  __toESM:
    "var __toESM = (mod, isNodeMode, target) => (target = mod != null ? Object.create(Object.getPrototypeOf(mod)) : {}, Object.defineProperties(target, { ...(!isNodeMode && mod && mod.__esModule ? {} : { default: { value: mod, enumerable: true, configurable: true, writable: true } }), ...Object.getOwnPropertyDescriptors(mod) }));",
  __commonJSMin:
    "var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);",
  __esmMin:
    "var __esmMin = (fn, res, err) => () => { if (err) throw err[0]; try { return fn && (res = fn(fn = 0)), res; } catch (e) { throw err = [e], e; } };",
  __commonJS:
    "var __commonJS = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);",
  __toCommonJS:
    'var __toCommonJS = (mod) => (Object.defineProperty(mod, "__esModule", { value: true }), mod);',
};

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

  // ── Step 2: inline helpers imported from _ssr/schema chunks ─────────────────
  // Replace `import { D as __exportAll } from "../_ssr/..."` with inline var defs.
  // This breaks the circular dependency drizzle-orm ↔ schema.
  content = content.replace(
    /^import \{([^}]+)\} from "(\.\.[/\\]_ssr[/\\][^"]+)";[ \t]*$/gm,
    (line, specifiers, src) => {
      const parts = specifiers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const inlineDefs = [];
      const kept = parts.filter((spec) => {
        const m = spec.match(/^(\S+)\s+as\s+(\S+)$/);
        const localName = m ? m[2] : spec;
        if (HELPER_IMPLS[localName]) {
          inlineDefs.push(HELPER_IMPLS[localName]);
          return false; // swap import for inline def
        }
        return true; // keep non-helper imports
      });
      const importLine =
        kept.length === 0 ? "" : `import { ${kept.join(", ")} } from "${src}";`;
      return [...inlineDefs, importLine].filter(Boolean).join("\n");
    }
  );

  // ── Step 3: hoist helper var declarations to line 1 ─────────────────────────
  // Matches single-line `var __helper = <impl>;` patterns.
  const HELPER_NAMES_RE = ESBUILD_HELPERS.join("|");
  const HELPER_LINE_RE = new RegExp(
    `^(var (?:${HELPER_NAMES_RE}) = [^\n]+;)[ \\t]*$`,
    "gm"
  );

  const hoisted = [];
  content = content.replace(HELPER_LINE_RE, (line) => {
    hoisted.push(line.trimEnd());
    return "";
  });

  if (hoisted.length > 0) {
    // Deduplicate: keep first occurrence of each helper name.
    const seen = new Set();
    const unique = hoisted.filter((line) => {
      const m = line.match(/^var (__\w+)\s*=/);
      if (!m || seen.has(m[1])) return false;
      seen.add(m[1]);
      return true;
    });
    content = unique.join("\n") + "\n" + content;
  }

  // ── Step 4: drop import aliases that duplicate a local var ──────────────────
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
        return !new RegExp(`\\bvar ${localName}\\s*=`).test(content);
      });
      if (kept.length === parts.length) return line;
      if (kept.length === 0) return "";
      return `import { ${kept.join(", ")} } from "${src}";`;
    }
  );

  // Clean up blank lines left by removals.
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
