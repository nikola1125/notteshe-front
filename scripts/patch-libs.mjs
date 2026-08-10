// Post-build patch: inject missing esbuild CJS helpers into _libs/*.mjs files.
// Nitro's Cloudflare Workers preset copies some packages to _libs/ as raw ESM,
// but those files reference helpers like __exportAll that esbuild normally provides
// in the bundled context. Without them the Worker crashes at startup.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const HELPERS = `
var __getOwnPropNames = Object.getOwnPropertyNames;
var __export = (target, all) => { for (var name in all) Object.defineProperty(target, name, { get: all[name], enumerable: true }); };
var __exportAll = (target, all) => { for (var name in all) Object.defineProperty(target, name, { get: all[name], enumerable: true }); };
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? Object.create(Object.getPrototypeOf(mod)) : {}, Object.defineProperties(target, { ...(!isNodeMode && mod && mod.__esModule ? {} : { default: { value: mod, enumerable: true, configurable: true, writable: true } }), ...Object.getOwnPropertyDescriptors(mod) }));
var __toCommonJS = (mod) => (Object.defineProperty(mod, "__esModule", { value: true }), mod);
`.trimStart();

const libsDir = join(process.cwd(), ".output", "_libs");

if (!existsSync(libsDir)) {
  console.log("[patch-libs] No _libs/ directory found — nothing to patch.");
  process.exit(0);
}

const files = readdirSync(libsDir).filter((f) => f.endsWith(".mjs"));
let patched = 0;

for (const file of files) {
  const filePath = join(libsDir, file);
  const content = readFileSync(filePath, "utf8");

  const needsPatch =
    (content.includes("__exportAll") || content.includes("__toESM") || content.includes("__toCommonJS")) &&
    !content.includes("var __exportAll =");

  if (needsPatch) {
    writeFileSync(filePath, HELPERS + content);
    console.log(`[patch-libs] Patched ${file}`);
    patched++;
  }
}

console.log(`[patch-libs] Done — ${patched} file(s) patched out of ${files.length} in _libs/`);
