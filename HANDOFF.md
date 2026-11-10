# Works_Shafi: project handoff

A complete briefing for continuing this project in a fresh session (another Claude account, or any collaborator). Current as of 4 November 2026. Read this first, then `GUIDE.md` for the user-facing instructions.

## 1. What this is

- **Owner:** Shafiul Islam (goes by Shafi; GitHub `ShafiArch`), architectural and computational designer. Advanced Grasshopper user.
- **Repository:** https://github.com/ShafiArch/works_shafi (public, branch `main`). Formerly named `Portfolio_Architecture`; renamed by the owner on 4 Nov 2026. Old links to `/Portfolio_Architecture/` no longer work.
- **Live site:** https://shafiarch.github.io/works_shafi/ (GitHub Pages, deployed from the root of `main`).
- **Tools (not linked from the site):**
  - Site manager: https://shafiarch.github.io/works_shafi/manage.html
  - Layout editor: https://shafiarch.github.io/works_shafi/layout.html
  - Cover animation editor: https://shafiarch.github.io/works_shafi/covers.html
  - Book effect editor: https://shafiarch.github.io/works_shafi/book.html
- **Sister project:** https://github.com/ShafiArch/Grasshopper, live at https://shafiarch.github.io/Grasshopper/ (a library of 38 .gh definitions with animated line-drawing cards; it has its own `HANDOFF.md`). Its top bar "Portfolio" link points to `https://shafiarch.github.io/works_shafi/`. This site's visual language (Archivo, trace paper, ink lines, one orange live element) comes from it.
- **Purpose:** a personal architecture portfolio. The front page is a bookshelf carousel: every work is a book spine; the active book turns to show a cover with a small animated line drawing. Each project has its own page built from content blocks.

No build step, no framework, no package manager. Plain HTML, CSS and JavaScript.

## 2. Starting a new session

Paste something like this into the new chat:

> Read HANDOFF.md and GUIDE.md in https://github.com/ShafiArch/works_shafi, then help me with: ...

**Publishing by the owner.** The tools publish straight to GitHub with a fine-grained token stored in the owner's browser (section 7), so the owner no longer uploads zips. Claude sessions still push with git as below.

**Access.** For a Claude session to push, the Claude GitHub App must be installed on the ShafiArch account with access to `works_shafi` (https://github.com/apps/claude/installations/select_target) and GitHub must be connected in claude.ai settings. Without it, Claude can read the public repo but pushes fail with 403; the fallback is to hand the owner a zip of changed files to upload (Add file, Upload files, commit). Repository settings (rename, Pages settings, About box) cannot be changed from a Claude session even with push access; the owner does those on GitHub.

**Commits** in previous sessions used the identity `ShafiArch <ShafiArch@users.noreply.github.com>` and were pushed straight to `main` (the owner asked for direct deploys after the first pull request).

**Deploying.** Every push to `main` runs GitHub's "pages build and deployment" workflow (about 40 seconds). It has twice hung on the deploy step or sat queued for 10+ minutes. Fix: cancel the run, then push an empty commit (`git commit --allow-empty -m "Trigger Pages deploy"`). Check with `gh api repos/ShafiArch/works_shafi/actions/runs --jq '.workflow_runs[0] | "\(.head_sha[0:7]) \(.status) \(.conclusion)"'`.

**Cache rule (important).** All pages load scripts and styles with `?v=N` (currently `v=17`) in `index.html`, `project.html`, `manage.html`, `layout.html`, `covers.html` and `book.html`. Whenever any `.js` or `.css` changes, raise N in all six (and the number quoted in the Publish section of `GUIDE.md`). JSON content is fetched with `no-cache` and needs nothing.

**Testing locally.** `python3 -m http.server 8765` in the repo root (pages fetch JSON, so `file://` does not work). Previous sessions tested with Playwright (pre-installed in the Claude cloud workspace): screenshot the shelf, click through books, open the work list, check `document.documentElement.scrollWidth` equals the viewport width at 390 px (no sideways overflow), and drive the two tools end to end, including applying a downloaded zip to a copy of the repo. Google Fonts are blocked in that sandbox, so screenshots show fallback fonts.

## 3. File map

| Path | Role |
|---|---|
| `index.html` | Front page shell: header, shelf, work list, footer. |
| `project.html` | Project page shell. `?p=<folder>` a project; `?e=<id>` a website entry shown inside the site; `?p=..&preview=1` preview mode for the layout editor. |
| `manage.html` + `assets/manage.js`, `assets/manage.css` | Site manager (section 7). |
| `layout.html` + `assets/layout.js`, `assets/layout.css` | Layout editor (section 7). Uses `manage.css` for shared controls. |
| `covers.html` + `assets/covers-editor.js`, `assets/covers-editor.css` | Cover animation editor (section 7). Uses `manage.css` and `layout.css`. |
| `book.html` + `assets/book-editor.js` | Book effect editor (section 7). Styles from `manage.css`, `layout.css`, `covers-editor.css`. |
| `assets/core.js` | `window.Site`: JSON loading, entry resolution (`loadSite` returns `{works, books}`), markdown-lite (`md`, `inline`), header and footer, header theme switch, typographic cover, `coverStyle(site, id)` and `applyCoverBox(canvas, style)` for the cover animation settings, `BOOK` (book effect ranges and defaults), `bookValues(b)` and `applyBook(el, b)`. |
| `assets/shelf.js` | The bookshelf carousel, drawn covers, and the collapsible Work list. |
| `assets/covers.js` | `window.Covers`: canvas line-drawing engine and the cover drawings (`ART`). |
| `assets/project.js` | Project page: header, facts, 12 column block grid, block renderers, lightbox, preview mode. |
| `assets/site.css` | All layout and motion; reads theme tokens only, never sets colours. |
| `assets/github.js` | `window.GH`: token connect dialog, `read(path)` (GitHub when connected, else the site), atomic multi-file `commit`, the publish dialog with conflicts and deletions, the top bar status button. |
| `tools/health.mjs` + `.github/workflows/health.yml` | Site health check (section 7). |
| `assets/zip.js` | `window.Zip.make(entries)`: minimal stored zip writer used by both tools. |
| `themes/themes.js` | `window.SITE_THEMES`: default theme, theme list, `set()` to switch live. |
| `themes/trace.css`, `night.css`, `clay.css` | Theme tokens. |
| `content/site.json` | Site content: name, nav, works, carousel, settings. |
| `projects/<folder>/project.json` | One project; its images sit beside it (`01.webp` ...), plus `cover.webp` (a photo crop, kept as a fallback cover). |
| `projects/_template/project.json` | Example using every block type; not on the site. |
| `tools/images.py` | Python: `web` exports PSD/TIF/PNG/JPG to WebP; `cover` makes a portrait cover crop. |
| `_archive/` | Original portfolio cover page and three blank filler pages, kept out of the site. |
| `GUIDE.md` | The owner's manual. Keep it in step with any change. |
| `.nojekyll` | Keep it. |

Projects on the site: `lego-city`, `space-under-flyover`, `natural-healing`, `sundar-bari`, `ida-interior` (pages are A3 landscape boards, 4961 x 3508 WebP), plus one website entry, `grasshopper-collection`.

## 4. Data model

### content/site.json

```jsonc
{
  "name": "Shafiul Islam",
  "repo": "ShafiArch/works_shafi",
  "tagline": "...",
  "shelfTitle": "Selected Work",        // not shown; screen readers only
  "front": "contents",                  // home page layout: "shelf" (bookshelf) or "contents" (cards); ?front= previews the other
  "autoplaySeconds": 3.5,               // 0 = no autoplay
  "showIndex": true,                    // the Work list button
  "nav": [{ "label": "Work", "href": "index.html#index" }, { "label": "GitHub", "href": "https://..." }],
  "contents": { "title": "Contents", "cards": [
    { "id": "undergraduate", "title": "Undergraduate", "art": "lego", "lines": ["...", "..."], "works": ["lego-city", "..."], "url": "" }
  ] },                                  // one work opens it; several open index.html?group=<id>; url wins; nothing and no lines = In preparation
  "works": [ ...entries, in work list order... ],
  "carousel": [ ...entry ids, in shelf order... ],
  "about": "footer text, markdown-lite",
  "footer": "Shafiul Islam",
  "covers": {                           // cover animation editor; all optional
    "default": { "size": 1, "x": 0, "y": 0, "speed": 1, "ink": { "weight": 1, "opacity": 1 }, "accent": { "weight": 1, "opacity": 1 } },
    "books": { "<entry id>": { ...same keys, override the default... } }
  },
  "book": { "angle": 64, "depth": 95, "edge": 100, "curve": 0, "crease": 100, "shadow": 100, "lift": 8, "radius": 0, "spine": 100, "cover": 74, "gap": 4, "speed": 0.9 }   // book effect editor; these are the defaults, and only changed keys are saved
}
```

- An entry left out of `carousel` shows in the work list only. `"hidden": true` hides it everywhere. Without `carousel`, every entry is a book. Older files used `shelf` instead of `works`; still accepted.
- **Entry types and ids:** `{ "project": "lego-city" }` (id = folder); `{ "project": "https://.../folder/" }` (a project.json published elsewhere; id = the address); `{ "id", "type": "website" | "repository", "title", "subtitle", "category", "year", "url", "open": "tab" | "embed", "shelf": {...} }`. Fields on a project entry override the project.json (the site manager moves them into the project.json on save).
- **Previous/next** on project pages follow `works` order.
- **covers:** `size` scales the drawing box (0.4 to 2), `x` and `y` move it in percent of the cover width (x -45 to 45, y -60 to 20; the cover clips overflow), `speed` 0 to 4 (0 = still), per ink `weight` 0.2 to 4 and `opacity` 0 to 1. Size and offset are CSS variables on the canvas (`--art-size`, `--art-x`, `--art-y`); speed and inks go to `Covers.mount(canvas, art, i, style)` / `Covers.setStyle`. Time is accumulated per drawing, so a speed change never jumps.
- **book:** ranges in `Site.BOOK`. `applyBook(.shelf, book)` sets CSS variables on the shelf: `--open-angle`, `--persp-k` (30 minus 27.2 times depth/100, times the book height), `--edge`, `--curve`, `--crease`, `--shadow` (opacities), `--lift`, `--radius` (px), `--spine-k`, `--cover-ratio`, `--gap-k`, `--dur`. `.shelf` redefines `--spine-w`, `--cover-w` and `--shelf-gap` so those overrides take effect (custom properties resolve where they are defined). The phone spine ratio still applies, multiplied by `--spine-k`.

### projects/<folder>/project.json

```jsonc
{
  "title": "...", "subtitle": "...", "year": "2021", "category": "Competition",
  "shelf": { "art": "lego", "cover": "cover.webp", "tone": "light", "spine": "", "coverText": "", "coverNote": "", "spineColor": "", "spineInk": "" },
  "meta": [["Site", "Makoko, Lagos"], ["Team", "..."]],
  "intro": "Paragraphs separated by a blank line. **bold**, *italic*, [label](https://...)",
  "layout": { "header": "left|center", "facts": "side|below", "intro": "xsmall|small|normal|large|xlarge", "introAlign": "left|center|right|justify" },
  "blocks": [
    { "type": "image", "src": "01.webp", "caption": "", "alt": "", "layout": { ... } },
    { "type": "gallery", "columns": 2, "items": [{ "src": "", "caption": "" }], "caption": "" },
    { "type": "text", "heading": "", "body": "" },
    { "type": "quote", "text": "", "by": "" },
    { "type": "video", "src": "x.mp4" | "youtube": "id" | "vimeo": "id", "poster": "", "autoplay": false, "caption": "" },
    { "type": "embed", "url": "https://...", "ratio": "16 / 10", "caption": "" },
    { "type": "links", "heading": "", "items": [{ "label": "", "url": "" }] },
    { "type": "spacer" }
  ]
}
```

- **Shelf fields:** `art` (drawn cover, takes priority) > `cover` (image) > typographic cover. `tone`: `light | mid | dark | accent | auto`. `coverNote` defaults to `subtitle` on drawn covers.
- **Block `layout`** (all optional, fixed values only): `width` `full|wide|twothirds|half|third` (12/10/8/6/4 of 12 columns); `beside` true to sit next to the previous block when the spans fit in 12, otherwise it starts a new row; `align` `start|center|end` (the first block of a row positions the row); `valign` `start|center|end`; `space` `none|small|normal|large`; images and galleries: `ratio` `original|16/9|3/2|4/3|1/1|3/4` and `focus` `center|top|bottom|left|right`; text blocks: `text` `side|stacked`, `size` `xsmall|small|normal|large|xlarge`, `textAlign` `left|center|right|justify`. Any block may have `"hidden": true`. Legacy `width: "wide" | "text"` on media blocks maps to wide / twothirds.

## 5. How the front end works

- **Shelf (shelf.js + site.css).** Each book is an `<a class="book">` with a 3D `.book-3d` holding a spine face and a cover face (cover rotated 90 degrees on the spine's right edge). The active book rotates by `--open-angle` (64) about that hinge; JS computes the open width (`s*cos + c*sin`) and a shift, and translates the track so the active book is centred. Book size: `--book-h`, `--spine-ratio` (0.155), `--cover-ratio` (0.74). Spine titles shrink to fit. Autoplay with a progress line; pauses on hover; arrows, swipe, keyboard. The Work list is a collapsed button under the controls ("Work list 06"); `index.html#index` or the Work nav link opens it.
- **Contents front page (contents.js + site.css `.ct-*`).** Chosen by `site.front`; `shelf.js` asks `Contents.choose(site)` after loading and hands over (a `?group=` address always uses it). Seven columns on wide screens, four under 1180 px, two under 760 px. Each card: `.ct-block` (light grey, `--card-block` if a theme sets it, else 9% ink over the background), the number (top right on odd cards, bottom right on even), a `.ct-canvas` drawing in the page ink (all cards animate unless reduced motion), a bold right aligned title and italic lines. The page gets a 56 px drafting grid (`body.front-contents`). Cover animation settings by card id apply through `site.covers.books`.
- **Drawn covers (covers.js).** A small canvas engine copied in spirit from the Grasshopper `previews.js`: 3D points projected with an orbiting camera, ink lines plus items marked `c: "accent"` drawn in `--cover-accent`. Each drawing is sampled once (24 frames) to find its extent, then scaled to fit its box and anchored bottom left so motion never drifts. Only the open book animates. Drawings: `lego, flyover, healing, homestead, interior, graph` (made for the existing works) `web, repo, tower, plan` (general) and the thick wall axonometrics `target2plan, kybele, fabrication, simulation` (faces with `layer` draw first; `nrm` gives the shading). Add new ones to `ART` and to `ART_LABELS` in `manage.js`. Size knobs in site.css: `--cover-art-w` (0.46 of cover width) and `--cover-art-scale` (1).
- **Cover layout:** bold title top left (Archivo 700, `--cover-w * 0.13`); drawing box bottom left; footer row with the description (three lines max, small) bottom left and the orange `Category · Year` tag bottom right. No author name on drawn covers.
- **Project page (project.js).** Blocks are grouped into rows on a 12 column CSS grid inside `.p-blocks`, a size container. Responsive rules live only in site.css: under 1000 px container width, Third becomes Half and wider spans become Full; under 620 px everything is full width and stacked; a text block shows its heading beside the body only when its cell is over 640 px; justified text falls back to left in cells under 420 px and for the intro under 480 px. Clicking an image opens a lightbox; a second click shows full resolution.
- **Themes.** `themes/themes.js` writes the active theme's stylesheet before paint (default `trace`; the visitor's choice is kept in `localStorage` `site-theme`; `?theme=night` forces one). The header switch (Trace / Night / Clay) calls `SITE_THEMES.set()`, which swaps the stylesheet and fires a `site-theme` event (the shelf re-measures and covers re-read colours). Tokens: `--bg --ink --ink-2 --rule --accent`, fonts (`--font-body --font-display --title-font --font-spine` and their weight/stretch/case), `--tone-{light,mid,dark,accent}-{bg,ink}`, `--cover-bg --cover-ink --cover-accent`, `--floor-shadow`, `--spine-shade`. Trace follows the visitor's dark mode (graphite).

## 6. Design decisions (do not undo by accident)

These came from the owner's direct feedback, in roughly this order:

- **Writing:** never use em dashes or en dashes (organisation rule); use commas, semicolons, parentheses or periods. Applies to code comments, docs and site text. The tools warn about dashes and offer a fix.
- **Bookshelf carousel** modelled on a "Favorite books" reference video: spines in a row, one book turned open to show its cover.
- **One typeface, Archivo,** in every theme, everywhere (titles, spines, captions). The owner removed the serif headings ("the fonts of the carousel are perfect").
- **Trace is the default theme.** Its accent is burnt orange `#c4512f` (the owner disliked the earlier blueprint blue). **Night has no orange** at all (the owner asked to remove it); its accent is white and the cover tag grey. Clay keeps its brick accent.
- **No orange spine:** Lego City's spine is light; the shelf uses the neutral tones only.
- **Spine shading** is a flat face with a thin darker strip at each edge (a "small fillet"), not a rounded cylinder.
- **No "Selected Work" heading** above the shelf.
- **Work list** is a small collapsed button with small readable text, not a full index.
- **Covers:** small animated line drawings like the Grasshopper cards instead of full photographs; drawing roughly half size, bottom left, sitting directly on the description; description three lines max in small text; orange category and year bottom right; no author name.
- **Tools save nothing remotely:** both tools work in the browser and hand back a zip with repository paths; the owner uploads and commits. Drafts live in `localStorage` (`works-manager-draft-v1`, `works-layout-draft-v1`). Images added in the site manager live only in that tab until downloaded.
- **Layout safety:** layout options are fixed choices on a 12 column grid; screen-size behaviour is decided by CSS, never by content.

## 7. The tools

**Site manager (manage.js).** Loads `content/site.json` and every local project.json; tabs: Works (placement select per row: book and list / list only / hidden; drag or arrows; edit; remove with confirm), Shelf order (carousel ids), Top bar, Site settings, Download (checks, changed-file table, zip). The editor drawer changes with the type (project, website, repository with "Fill from GitHub" via the public API, remote project with a project.json check). Project images are converted to WebP in the browser (canvas, max edge 2400/3200/4000) and image covers are cropped at 900 x 1216 like `tools/images.py`. Existing folder images are listed with the GitHub contents API using `site.json` `repo`. Live cover preview uses the site's own CSS and `Covers`. Removing a published project leaves its folder; the Download tab lists folders to delete by hand.

**Layout editor (layout.js).** Loads local projects; the right pane is an iframe of `project.html?p=<folder>&preview=1` sized to a real device (Desktop 1440x900, Laptop 1280x800, Half screen 960x1000, Tablet landscape 1180x820, Tablet portrait 820x1180, Phone landscape 844x390, Phone 390x844) and scaled to fit. Messages (same origin only): editor to page `works-layout` (the draft project) and `works-layout-select` (highlight); page to editor `works-layout-ready` and `works-layout-pick` (a click on a block or the header). The side panel lists the header and blocks (drag to reorder, add after selection, duplicate, hide, delete) and an inspector with layout choices and text fields. Undo and redo keep up to 200 steps per project; typing in one field is one step. Download gives `projects/<folder>/project.json` for each changed project in a zip.

**Cover animation editor (covers-editor.js).** Loads `site.json` and the books on the shelf that have a drawing; shows every cover live (all animating) plus a large view of the selected one, with Trace / Night / Clay buttons. Left: *All books* (edits `covers.default`) and each book (edits `covers.books[id]`; a value set there is an override, the arrow removes it). Sliders with number boxes for size, left/right, up/down, speed, and thickness and opacity for each ink. Undo/redo, revert, download of `content/site.json` (only `covers` differs). Draft key `works-covers-draft-v1`. Because it rewrites the whole site.json from the published copy, unsaved site manager changes must be uploaded first.

**Book effect editor (book-editor.js).** The preview is `index.html?bookpreview=1` in a device-sized iframe; the editor posts `works-book` with the values and the shelf re-applies and re-measures (`works-book-ready` back). A master slider maps 0 to 100 onto the surface settings (65 reproduces the defaults exactly; 100 adds a rounded spine and corner rounding); proportions and speed are only set individually. Draft key `works-book-draft-v1`. Downloads `content/site.json` with only `book` changed (keys equal to the defaults are dropped).

**Publishing (github.js).** A fine-grained personal access token (Contents: read and write on the repository only) is kept in `localStorage` (`works-gh-token`, repository in `works-gh-repo`, default guessed from the Pages address or `site.json` `repo`). `GH.read` uses the contents API when connected, else fetches from the site; `Site.getJSON` routes through it on tool pages (`body.page-manage`). A publish is one commit: blobs, a tree on top of the current main, a commit, then `PATCH refs/heads/main` without force (a race fails cleanly). Each tool's `publishNow` builds the plan from fresh reads: the site manager writes `site.json` except `covers` and `book` (taken from GitHub), plus project files, new images, and deletions of removed project folders (via the recursive tree); the cover and book tools write only their key; the layout editor writes whole project.json files. A conflict is reported when the part a tool owns differs on GitHub from what the tool loaded; the dialog then needs an explicit tick to replace it. After success each tool takes the published content as its new baseline and clears its draft. Tested in previous sessions with Playwright against an in-memory mock of the GitHub API (`page.route('https://api.github.com/**')`).

**Health check (tools/health.mjs).** Node 20, no dependencies. Errors: invalid JSON, works entries without a folder or project.json, carousel ids not in works, top bar links missing a label or address, missing referenced files (cover, image, gallery, video, poster), unknown block types or cover drawings (drawing names are read from `ART.name =` in covers.js), different `?v=` numbers across the HTML pages, files over 50 MB, repository over 900 MB. Warnings: external links that fail (401, 403, 429 and 999 count as refused, only noted), images over 1.5 MB, repository over 700 MB, long dashes, hidden books still on the shelf. The workflow runs on push to main, Mondays 15:17 UTC and by hand; errors open or update an issue labelled `site-health` (warnings only on scheduled or manual runs), and a clear run closes it. The job fails on errors.

## 8. Open items

- Years are blank for Space Under Flyover, Natural Healing and Sundar Bari.
- The footer "about" text is a placeholder taken from the Grasshopper contributor line; the owner has not written a bio.
- The repository About box on GitHub has no description or website yet (owner's job).
- A custom domain was discussed but not set up.
- The IDA Interior drawing is the busiest of the covers; the owner accepted it but it could be simplified.
- New projects added through the site manager get a general drawing (`tower`, `plan`, `web`, `repo`); a bespoke drawing needs code in `covers.js`.

## 9. History in brief

1. Repo started as loose A3 portfolio pages (WebP) at the root. They were moved into `projects/<folder>/`, covers were cropped, and the site was built and merged in pull request #1.
2. Repo renamed to `works_shafi`; README, GUIDE and the Grasshopper site's Portfolio link updated.
3. Visual changes per section 6; drawn covers added and refined over several rounds.
4. Site manager added; `site.json` moved to `works` + `carousel`.
5. Layout editor and the 12 column project grid added; then five text sizes and four paragraph alignments.
6. Cover animation editor added (size, position, speed, and thickness and opacity per ink, as defaults plus per-book overrides). The owner then set per-book cover sizes and ink weights with it and uploaded them.
7. Book effect editor added (block to full book).
8. Publish to GitHub from every tool, and the weekly site health check. Next planned (owner's order): upload all projects and websites, then link previews and search visibility (static share pages per project), image budget, visit counts, self-hosted font, custom domain.
9. Second front page, the contents cards (after a contents page reference with maroon blocks, here light grey), switchable in one click in the site manager's Front page tab; seven cards: Target2Plan, Kybele, Fabrication, Grasshopper Workflows, Simulation Workflows, Undergraduate, Other Projects. Then thick wall axonometric drawings (solid faces, see covers.js `F`, `solid`, `wall`; faces are sorted back to front and filled with `--cover-paper`): `target2plan`, `kybele`, `fabrication`, `simulation`. Card links: Target2Plan website, Kybele on food4Rhino, Fabrication and Simulation to their flipbook pages (42 and 15). Other Projects shows In preparation.
