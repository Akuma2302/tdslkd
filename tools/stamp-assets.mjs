// Netlify build step (netlify.toml → [build] command): adds ?v=<commit> to every local CSS / JS file an HTML page
// loads, e.g. href="/assets/css/style.css" → href="/assets/css/style.css?v=4a4c36d".
// Each deploy then has new URLs, so no phone or browser keeps using an old copy of the styles or scripts
// (iOS Safari sometimes did). It only changes the copy Netlify publishes; the files in git stay as they are.
// Run locally with:  node tools/stamp-assets.mjs --dry   (prints what it would change)
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../frontend/", import.meta.url));
const DRY = process.argv.includes("--dry");
const ver = (process.env.COMMIT_REF || "").slice(0, 7) || Date.now().toString(36);

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await htmlFiles(p));
    else if (extname(e.name) === ".html") out.push(p);
  }
  return out;
}

// href="/x.css" or src="/x.js" (site-absolute, not "//cdn…", no query yet)
const REF = /((?:href|src)=")(\/(?!\/)[^"?#]+\.(?:css|js))(")/g;

let files = 0, refs = 0;
for (const f of await htmlFiles(ROOT)) {
  const html = await readFile(f, "utf8");
  let n = 0;
  const next = html.replace(REF, (m, a, path, b) => { n++; return a + path + "?v=" + ver + b; });
  if (!n) continue;
  files++; refs += n;
  if (!DRY) await writeFile(f, next);
}
console.log(`stamp-assets: v=${ver} · ${refs} references in ${files} HTML files${DRY ? " (dry run)" : ""}`);
