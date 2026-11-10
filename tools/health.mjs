#!/usr/bin/env node
/* Site health check. Runs on GitHub (.github/workflows/health.yml) after every
   commit and every Monday; also runs locally:  node tools/health.mjs [--offline]

   Errors (the site is or will be broken): unreadable JSON, works, shelf or
   contents card entries pointing at nothing, missing images, unknown block types or cover
   drawings, pages loading different script versions, repository near its size limit.
   Warnings (worth fixing): dead external links, heavy images, long dashes.

   Writes a Markdown report (--report file), and on GitHub sets the output
   "status" to ok, warnings or errors. Exit code 1 when there are errors. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const OFFLINE = args.includes("--offline");
const REPORT = args.includes("--report") ? args[args.indexOf("--report") + 1] : null;

const errors = [], warnings = [], notes = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")); }
  catch (e) { errors.push(`\`${p}\` is not valid JSON (${e.message.split("\n")[0]}). The site cannot read it.`); return null; }
}
function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    if (n === ".git" || n === "node_modules") continue;
    const p = path.join(dir, n), s = fs.statSync(p);
    if (s.isDirectory()) walk(p, out); else out.push({ path: rel(p), size: s.size });
  }
  return out;
}
const isURL = (s) => /^https?:\/\//i.test(s || "");
const slugOK = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);

/* ---------- what the code knows ---------- */
const coversJs = fs.readFileSync(path.join(ROOT, "assets/covers.js"), "utf8");
const ART = new Set([...coversJs.matchAll(/ART\.(\w+)\s*=/g)].map((m) => m[1]));
const BLOCKS = new Set(["image", "gallery", "text", "quote", "video", "embed", "links", "spacer"]);

/* ---------- site.json ---------- */
const site = readJSON("content/site.json");
const links = [];   // [url, where]
const projects = {};
if (site) {
  const works = site.works || site.shelf;
  if (!Array.isArray(works)) errors.push("`content/site.json` has no `works` list.");
  const ids = new Map();
  (works || []).forEach((e, i) => {
    const where = `works item ${i + 1}`;
    if (!e || typeof e !== "object") { errors.push(`${where} in \`content/site.json\` is empty.`); return; }
    const id = e.project || e.id || (e.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (ids.has(id)) errors.push(`Two works share the id \`${id}\` (items ${ids.get(id) + 1} and ${i + 1}).`);
    ids.set(id, i);
    if (e.project && !isURL(e.project)) {
      if (!slugOK(e.project)) errors.push(`Folder name \`${e.project}\` (${where}) should use lowercase letters, numbers and hyphens.`);
      if (!exists(`projects/${e.project}/project.json`)) errors.push(`\`${e.project}\` is in the works list but \`projects/${e.project}/project.json\` does not exist. Its book and page are missing from the site.`);
      else projects[e.project] = true;
    } else if (e.project) {
      links.push([e.project.replace(/\/?$/, "/") + "project.json", `the project from another site in ${where}`]);
    } else {
      if (!isURL(e.url)) errors.push(`\`${e.title || id}\` (${where}) has no web address starting with https://.`);
      else links.push([e.url, `\`${e.title || id}\``]);
      if (e.shelf && e.shelf.cover && !exists("content/" + e.shelf.cover)) errors.push(`Cover image \`content/${e.shelf.cover}\` for \`${e.title || id}\` is missing.`);
    }
    if (e.shelf && e.shelf.art && !ART.has(e.shelf.art)) errors.push(`\`${e.title || id}\` asks for the cover drawing \`${e.shelf.art}\`, which does not exist. Known drawings: ${[...ART].join(", ")}.`);
  });
  if (Array.isArray(site.carousel)) {
    site.carousel.forEach((id) => { if (!ids.has(id)) errors.push(`The shelf lists \`${id}\`, which is not in the works list. That book is skipped.`); });
    const hidden = (works || []).filter((e) => e && e.hidden).map((e) => e.project || e.id);
    site.carousel.filter((id) => hidden.includes(id)).forEach((id) => warnings.push(`\`${id}\` is on the shelf but hidden, so it does not show.`));
  }
  if (site.front && site.front !== "shelf" && site.front !== "contents") errors.push(`\`front\` in \`content/site.json\` is \`${site.front}\`; use \`shelf\` or \`contents\`.`);
  const cards = (site.contents && site.contents.cards) || [];
  if (site.front === "contents" && !cards.length) errors.push("The front page is set to contents, but there are no cards. Add them in the site manager, Front page.");
  const cardIds = new Set();
  cards.forEach((c, i) => {
    const where = `contents card ${i + 1} (\`${c.title || c.id}\`)`;
    if (!c.id) errors.push(`${where} has no id.`);
    else if (cardIds.has(c.id)) errors.push(`Two contents cards share the id \`${c.id}\`.`);
    cardIds.add(c.id);
    if (c.art && !ART.has(c.art)) errors.push(`${where} asks for the drawing \`${c.art}\`, which does not exist.`);
    (c.works || []).forEach((id) => { if (!ids.has(id)) errors.push(`${where} opens \`${id}\`, which is not in the works list.`); });
    if (c.url) { if (!isURL(c.url)) errors.push(`${where} has a web address that does not start with https://.`); else links.push([c.url, where]); }
  });
  (site.nav || []).forEach((n, i) => {
    if (!n.label || !n.href) errors.push(`Top bar link ${i + 1} needs both a label and an address.`);
    else if (isURL(n.href)) links.push([n.href, `the top bar link \`${n.label}\``]);
  });
  if (site.covers && site.covers.books) Object.keys(site.covers.books).forEach((id) => { if (!ids.has(id)) warnings.push(`Cover settings exist for \`${id}\`, which is not in the works list (harmless; remove them in the cover tool if it is gone for good).`); });
}

/* ---------- projects ---------- */
const projDirs = fs.existsSync(path.join(ROOT, "projects")) ? fs.readdirSync(path.join(ROOT, "projects")).filter((d) => fs.statSync(path.join(ROOT, "projects", d)).isDirectory()) : [];
for (const slug of projDirs) {
  if (slug.startsWith("_")) continue;
  const file = `projects/${slug}/project.json`;
  if (!exists(file)) { warnings.push(`Folder \`projects/${slug}/\` has no project.json.`); continue; }
  const p = readJSON(file);
  if (!p) continue;
  if (!projects[slug]) notes.push(`\`projects/${slug}/\` is not in the works list (not on the site). Delete it if it is not needed.`);
  if (!p.title) errors.push(`\`${file}\` has no title.`);
  const need = (src, what) => { if (src && !isURL(src) && !exists(`projects/${slug}/${src}`)) errors.push(`\`${p.title || slug}\`: ${what} \`${src}\` is not in \`projects/${slug}/\`.`); };
  if (p.shelf) { need(p.shelf.cover, "the cover image"); if (p.shelf.art && !ART.has(p.shelf.art)) errors.push(`\`${p.title || slug}\` asks for the cover drawing \`${p.shelf.art}\`, which does not exist.`); }
  (p.blocks || []).forEach((b, i) => {
    if (!b || !BLOCKS.has(b.type)) { errors.push(`\`${p.title || slug}\`: block ${i + 1} has the unknown type \`${b && b.type}\` and is skipped.`); return; }
    if (b.hidden) return;
    if (b.type === "image") { if (!b.src) warnings.push(`\`${p.title || slug}\`: image block ${i + 1} has no file.`); need(b.src, "the image"); }
    if (b.type === "gallery") (b.items || []).forEach((x) => need(typeof x === "string" ? x : x && x.src, "the gallery image"));
    if (b.type === "video") { need(b.src, "the video"); need(b.poster, "the video poster"); }
    if (b.type === "embed" && isURL(b.url)) links.push([b.url, `\`${p.title || slug}\`, embedded page`]);
    if (b.type === "links") (b.items || []).forEach((l) => { if (isURL(l.url)) links.push([l.url, `\`${p.title || slug}\`, links block`]); });
  });
}

/* ---------- files: sizes, dashes, versions ---------- */
const files = walk(ROOT);
const total = files.reduce((n, f) => n + f.size, 0);
const MB = (n) => (n / 1048576).toFixed(1) + " MB";
if (total > 900 * 1048576) errors.push(`The repository is ${MB(total)}. GitHub Pages stops at 1 GB; move originals out and keep web-size images only.`);
else if (total > 700 * 1048576) warnings.push(`The repository is ${MB(total)}, nearing the 1 GB GitHub Pages limit.`);
notes.push(`Repository size: ${MB(total)} of the 1 GB GitHub Pages limit.`);
files.filter((f) => /\.(webp|jpe?g|png|gif|avif)$/i.test(f.path) && !f.path.startsWith("_archive/") && f.size > 1.5 * 1048576)
  .forEach((f) => warnings.push(`\`${f.path}\` is ${MB(f.size)}. Web images load faster under about 1 MB (export at 2400 to 3000 px).`));
files.filter((f) => f.size > 50 * 1048576).forEach((f) => errors.push(`\`${f.path}\` is ${MB(f.size)}; GitHub refuses files over 100 MB and warns above 50 MB.`));

const dashFiles = files.filter((f) => /\.(json|md|html|js|css|mjs)$/i.test(f.path)).filter((f) => /[\u2013\u2014]/.test(fs.readFileSync(path.join(ROOT, f.path), "utf8")));
if (dashFiles.length) warnings.push(`Long dashes (en or em) appear in ${dashFiles.map((f) => "`" + f.path + "`").join(", ")}. The writing rule is commas, semicolons, parentheses or periods.`);

const pages = files.filter((f) => /^[^/]+\.html$/.test(f.path));
const versions = new Map();
pages.forEach((f) => { const v = new Set([...fs.readFileSync(path.join(ROOT, f.path), "utf8").matchAll(/\?v=(\d+)/g)].map((m) => m[1])); versions.set(f.path, [...v]); });
const allV = new Set([...versions.values()].flat());
if (allV.size > 1) errors.push(`Pages load different script versions (${[...versions].map(([p, v]) => `${p}: ${v.join("/")}`).join("; ")}). Raise \`?v=\` to the same number everywhere, or some visitors get old files.`);

/* ---------- external links ---------- */
async function check(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  const opts = { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "works-site-health-check" } };
  try {
    let r = await fetch(url, { ...opts, method: "HEAD" });
    if (r.status === 405 || r.status === 403 || r.status === 400) r = await fetch(url, { ...opts, method: "GET" });
    return r.status;
  } catch (e) { return e.name === "AbortError" ? "timeout" : e.cause?.code || e.message; }
  finally { clearTimeout(t); }
}
async function checkLinks() {
  const unique = [...new Map(links.map(([u, w]) => [u, w]))];
  if (OFFLINE) { notes.push(`${unique.length} external links not checked (offline).`); return; }
  const results = await Promise.all(unique.map(async ([u, w]) => [u, w, await check(u)]));
  // some sites refuse automated checks; those are not counted as broken
  const blocked = new Set([401, 403, 429, 999]);
  let ok = 0;
  results.forEach(([u, w, s]) => {
    if (typeof s === "number" && s < 400) ok++;
    else if (typeof s === "number" && blocked.has(s)) notes.push(`${u} (${w}) refused the automated check (${s}); open it by hand if in doubt.`);
    else warnings.push(`Link may be broken: ${u} (${w}) answered ${s}.`);
  });
  notes.push(`${ok} of ${unique.length} external links answered normally.`);
}

await checkLinks();

/* ---------- report ---------- */
const status = errors.length ? "errors" : warnings.length ? "warnings" : "ok";
const list = (xs) => xs.map((x) => `- ${x}`).join("\n");
const report = [
  `## Site health: ${status === "ok" ? "all clear" : status === "warnings" ? "warnings" : "problems found"}`,
  "",
  errors.length ? `### Errors (${errors.length})\nThese break part of the site.\n\n${list(errors)}\n` : "",
  warnings.length ? `### Warnings (${warnings.length})\n\n${list(warnings)}\n` : "",
  notes.length ? `### Notes\n\n${list(notes)}\n` : "",
  `_Checked ${files.length} files on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC._`
].filter(Boolean).join("\n");

console.log(report);
if (REPORT) fs.writeFileSync(REPORT, report + "\n");
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\n`);
process.exit(errors.length ? 1 : 0);
