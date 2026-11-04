# works_shafi: site guide

Plain HTML, CSS and JavaScript on GitHub Pages. No build step, no framework, no package manager. Every change is an edit to a text file followed by a commit.

## 1. Where things live

| Path | What it is |
|---|---|
| `content/site.json` | Name, navigation, the shelf (which books appear and in what order), shelf title, autoplay speed, footer text. |
| `projects/<folder>/project.json` | One project: title, subtitle, year, category, cover, facts, introduction and the content blocks. |
| `projects/<folder>/*.webp` | That project's images (and videos, if any). |
| `projects/_template/project.json` | A copy-ready example that uses every block type. It is not on the shelf. |
| `themes/themes.js` | Which theme is live, and the list of themes. |
| `themes/*.css` | One file per theme: colors, typefaces, spine tones. |
| `assets/site.css` | Layout and motion only. It reads the theme tokens and never sets a color itself. |
| `assets/core.js`, `assets/shelf.js`, `assets/project.js` | Loading, the bookshelf carousel, the project page. |
| `tools/images.py` | Exports PSD, TIF, PNG or JPG to WebP, and makes book covers. |
| `_archive/` | The old portfolio cover and blank filler pages, kept out of the site. |
| `.nojekyll` | Tells GitHub Pages to serve files as they are. Keep it. |

## 2. Add a project

1. Make a folder in `projects/`, lowercase with hyphens, for example `projects/seattle-library/`.
2. Put the images in it (see section 6 for exporting from Photoshop). Simple names are easiest: `01.webp`, `02.webp`.
3. Copy `projects/_template/project.json` into the folder and edit it. Delete any blocks you do not need.
4. Make a cover: `python tools/images.py cover projects/seattle-library/01.webp --focus 0.5 0.5`
5. Add one line to the `shelf` list in `content/site.json`, where you want the book to sit:
   `{ "project": "seattle-library" },`

## 3. Remove, hide or reorder

* **Reorder:** move the lines in the `shelf` list of `content/site.json`. The shelf, the index and the previous / next links all follow that order.
* **Hide for now:** add `"hidden": true` to the line, for example `{ "project": "ida-interior", "hidden": true }`. The folder stays, the book disappears.
* **Remove for good:** delete the line, then delete the folder if you no longer want the files.
* A line that points to a missing folder is skipped quietly, so the site never breaks.

## 4. Change what is inside a project

Everything below the introduction is the `blocks` list in that project's `project.json`, drawn top to bottom. Add, delete or move blocks freely. Any block can take `"hidden": true`.

| Block | Fields |
|---|---|
| `image` | `src`, optional `caption`, `alt`, `width` (`full`, `wide`, `text`) |
| `gallery` | `items` (list of `{ src, caption }` or plain file names), `columns` (1 to 4), optional `caption` |
| `text` | optional `heading`, `body` |
| `quote` | `text`, optional `by` |
| `video` | `src` (an mp4 in the folder) with optional `poster` and `autoplay`; or `youtube` / `vimeo` with the video id |
| `embed` | `url` of any web page, optional `ratio` such as `"16 / 9"`, `caption` |
| `links` | optional `heading`, `items` (list of `{ label, url }`) |
| `spacer` | no fields; adds extra space |

Writing in `intro` and `body`: a blank line (`\n\n` in the JSON) starts a new paragraph, `**bold**`, `*italic*`, `[label](https://address)`.

`meta` is the list of facts beside the introduction, as pairs: `["Site", "Makoko, Lagos"]`. Add or remove pairs as you like; an empty value is skipped.

The `shelf` part of `project.json` controls the book:

| Field | Meaning |
|---|---|
| `cover` | Image shown when the book opens. Leave empty for a typographic cover. |
| `tone` | Spine color from the theme: `light`, `mid`, `dark`, `accent`, or `auto`. |
| `spine` | Shorter text for the spine, if the title is long. |
| `spineColor`, `spineInk` | A fixed spine color for this one book (any CSS color), overriding the theme. |
| `coverText`, `coverNote` | Text for a typographic cover. |

## 5. Put another website or repository on the shelf

A shelf line in `content/site.json` does not have to be a project folder:

```json
{
  "title": "Grasshopper Workflow Collection",
  "subtitle": "38 reusable Grasshopper definitions, open to download",
  "category": "Website",
  "url": "https://shafiarch.github.io/Grasshopper/",
  "open": "tab",
  "shelf": { "tone": "light", "spine": "Grasshopper Collection", "coverText": "Grasshopper Workflow Collection", "coverNote": "..." }
}
```

* `"open": "tab"` opens the site in a new tab. `"open": "embed"` shows it inside the portfolio with a header and a back link.
* For a cover image, put the file in `content/` and set `"cover": "grasshopper.webp"` inside `shelf`.
* **A project kept in another repository:** if that repository publishes a folder with a `project.json` on GitHub Pages, use its address as the project: `{ "project": "https://shafiarch.github.io/Another_Repo/my-project/" }`. Images are read from that folder, and it opens on the portfolio's own project page.

## 6. Images from Photoshop

The web wants WebP or JPG, not PSD. Either export from Photoshop (File, Export, Export As, WebP or JPG, about 3000 to 4000 px on the long edge), or let the tool do it:

```
pip install pillow psd-tools
python tools/images.py web  path/to/psd_folder  --out projects/seattle-library
python tools/images.py cover projects/seattle-library/01.webp --focus 0.6 0.5 --zoom 1.3
```

* `web` converts every PSD, TIF, PNG or JPG in a folder to WebP (4000 px long edge, quality 82). Keep the PSDs out of the repository; GitHub warns above 50 MB per file.
* `cover` crops a portrait cover. `--focus X Y` is the point to centre on (0 to 1 across and down), `--zoom` moves closer. It writes `cover.webp` next to the image.
* Clicking any image on a project page opens it full screen; clicking again shows it at full resolution, so presentation boards stay readable.

## 7. Themes

Each theme is one file in `themes/`. They define the same tokens (`--bg`, `--ink`, `--ink-2`, `--rule`, `--accent`, the typefaces, and `--tone-*-bg` / `--tone-*-ink` for the four spine tones). Included:

* `night`: the bookshelf reference look; black room, grey and charcoal spines, one burnt orange.
* `trace`: the Grasshopper collection look; trace paper, black ink, blueprint blue, and it follows the visitor's dark mode.
* `clay`: warm paper and brick tones with a serif.

**Preview without publishing:** add `?theme=trace` to any page address. A small panel appears in the corner to switch between themes; `Reset` returns to the live one. Add `?themes` to show that panel at any time. Previews only affect your own browser.

**Make a theme live:** change `DEFAULT` in `themes/themes.js`.

**Make a new theme:** copy a theme file, rename it (for example `themes/ink.css`), change the values, and add it to `THEMES` in `themes/themes.js`.

Shelf proportions are in `assets/site.css` at the top: `--book-h` (height), `--spine-ratio`, `--cover-ratio`, `--open-angle`. A theme can override any of them in its own `:root`.

## 8. Publish and preview

* **Publish:** in the repository, Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`. The site appears at https://shafiarch.github.io/works_shafi/ a minute or two after each commit.
* **Cache rule:** the pages load the scripts and styles with `?v=1`. When you change a `.js` or `.css` file, raise that number in both `index.html` and `project.html` so visitors get the new file. JSON content is never cached, so content edits need nothing extra.
* **Local preview:** the pages read JSON, which browsers block from a file opened directly. In the repository folder run `python -m http.server 8000` and open http://localhost:8000.
* **Front page settings** in `content/site.json`: `shelfTitle`, `autoplaySeconds` (0 turns autoplay off), `showIndex` (the list under the shelf), `nav`, `about`, `footer`.

## 9. Writing

No em dashes or en dashes anywhere; use commas, semicolons, parentheses or periods.
