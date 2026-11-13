# Works_Shafi: site guide

Plain HTML, CSS and JavaScript on GitHub Pages. No build step, no framework, no package manager. Every change is an edit to a text file followed by a commit.

## 1. Where things live

| Path | What it is |
|---|---|
| `manage.html` | The site manager: add, edit, order and remove works, edit the top bar and settings, then download the changed files. Not linked from the site. |
| `content/site.json` | Name, top bar links, `works` (everything, in work list order), `carousel` (the books on the shelf, in shelf order), autoplay speed, footer text. |
| `projects/<folder>/project.json` | One project: title, subtitle, year, category, cover, facts, introduction and the content blocks. |
| `projects/<folder>/*.webp` | That project's images (and videos, if any). |
| `projects/_template/project.json` | A copy-ready example that uses every block type. It is not on the shelf. |
| `themes/themes.js` | Which theme is live, and the list of themes. |
| `themes/*.css` | One file per theme: colors, typefaces, spine tones. |
| `assets/site.css` | Layout and motion only. It reads the theme tokens and never sets a color itself. |
| `assets/core.js`, `assets/shelf.js`, `assets/project.js` | Loading, the bookshelf carousel, the project page. |
| `assets/covers.js` | The drawn book covers: small line animations, one per project, plus general ones for new entries. |
| `assets/manage.js`, `assets/manage.css` | The site manager. |
| `layout.html`, `assets/layout.js`, `assets/layout.css` | The layout editor for project pages. Not linked from the site. |
| `covers.html`, `assets/covers-editor.js`, `assets/covers-editor.css` | The cover animation editor. Not linked from the site. |
| `book.html`, `assets/book-editor.js` | The book effect editor. Not linked from the site. |
| `assets/zip.js` | Builds the download zips for the tools. |
| `assets/github.js` | Publishing from the tools straight to GitHub. |
| `tools/health.mjs`, `.github/workflows/health.yml` | The site health check. |
| `tools/images.py` | Exports PSD, TIF, PNG or JPG to WebP, and makes book covers. |
| `_archive/` | The old portfolio cover and blank filler pages, kept out of the site. |
| `.nojekyll` | Tells GitHub Pages to serve files as they are. Keep it. |

## 2. Publishing and the health check

### Publish straight from the tools

Every tool (site manager, layout editor, cover animation, book effect) has a **Publish** button that commits your changes to GitHub in one step; the site updates about a minute later. Connect once per browser:

1. Press **Connect GitHub** at the top of any tool and follow the steps it shows: on GitHub, create a *fine-grained personal access token* with access to **only this repository** and the permission **Contents: Read and write**.
2. Paste the token. The tools in this browser are now connected (the button shows *GitHub: connected*).

How it keeps things safe:

* Each tool changes only its own part. In `content/site.json` the site manager owns the works, shelf order, top bar and settings; the cover tool owns `covers`; the book tool owns `book`. Publishing reads the current file from GitHub and replaces only that part, so tools never undo each other.
* If that part was changed on GitHub since you opened the tool (for example from another computer), the Publish window says so, and publishes only if you tick *Replace them with my version*.
* When connected, tools read straight from GitHub, so they never start from a published copy that has not caught up.
* Removing a project in the site manager can also delete its folder in the same commit (a tick box on the Review page).
* The token stays in that browser only. Do not connect on a shared computer. *GitHub: connected*, then *Disconnect*, removes it. When the token expires, make a new one the same way.

*Download zip* still works in every tool, for uploading by hand.

### The health check

After every commit, and every Monday morning, GitHub runs a check of the whole site (the *Site health check* in the repository's **Actions** tab; *Run workflow* runs it by hand). It looks for:

* JSON files the site cannot read; works or shelf entries pointing at missing folders; images referenced but not uploaded; unknown block types or cover drawings; pages loading different script versions.
* Dead links in the top bar, website entries and project pages (checked weekly; some sites refuse automated checks and are only noted).
* Images heavier than 1.5 MB, the repository size against the 1 GB limit, and long dashes in text.

When it finds errors (or, on the weekly run, warnings) it opens an issue labelled **site-health**, and GitHub emails you. Fix the problem, and the next clear check closes the issue by itself. Run it on your computer with `node tools/health.mjs` (add `--offline` to skip the links).

## 3. The site manager (the easy way)

Open **https://shafiarch.github.io/works_shafi/manage.html**. It reads the published site, lets you change it, and gives you the changed files to upload. Nothing is sent anywhere; work in progress stays in your browser until you download or discard it.

* **Works:** every entry in work list order. Drag rows or use the arrows. Each row has a placement: *Book and work list*, *Work list only*, or *Hidden*. Edit opens the editor; Remove asks once more before removing.
* **Add a work:** choose the type first, and the form changes to suit it.
  * *Project*: a folder in this repository. Folder name, title, description, category, year, facts, introduction, images (converted to WebP and resized in the browser; export PSD files to JPG or PNG first) and the page content blocks.
  * *Website*: a web address, opened in a new tab or inside the site.
  * *Repository*: a GitHub address; *Fill details from GitHub* reads the name, description and year.
  * *Project from another site*: the address of a folder with a project.json on another GitHub Pages site.
  * Every type has the book settings: spine text, spine colour, cover (line drawing, image with crop, or title only), cover title and cover description, with a live preview.
* **Buttons under a project title:** in a project's editor, *Buttons under the title* takes one per line, `Label | https://address` (the first is filled). Target2Plan uses it for *Open the web app*.
* **Front page:** one click between the two home page layouts, **Bookshelf** and **Contents cards** (numbered cards with a light grey block and a line drawing, on a faint grid). Both keep their settings. Below the switch you edit the cards: title, drawing, up to three lines under the title, and what the card opens: tick one work to open it directly, several to open a page of their own cards (`index.html?group=<card id>`), or fill a web address. A card with nothing to open and no lines shows *In preparation*. Publish to make a change live. To look at the other layout without changing anything, add `?front=shelf` or `?front=contents` to the address.
* **Shelf order:** the books on the carousel, separate from the work list order. Take books off or put them back.
* **Top bar:** add, remove and reorder links. Web addresses open in a new tab; *Add the Work list link* adds the link that opens the list.
* **Site settings:** name, tagline, footer text, autoplay speed, the Work list button.
* **Review and publish:** checks for problems, lists the changed files, then **Publish to GitHub** (see section 2) or **Download changes (.zip)** to upload by hand.

**To publish:** press **Publish to GitHub**. By hand instead: download the zip, unzip, then on GitHub open the repository, *Add file*, *Upload files*, drag the unzipped `content` and `projects` folders in, *Commit changes*, and press *Discard changes* in the manager to clear the draft. Removing a project takes it off the site; Publish can delete its folder too, otherwise delete it on GitHub by hand.

Images added in the manager live only in that browser tab until you download, so download before closing it.

## 4. The layout editor

Open **https://shafiarch.github.io/works_shafi/layout.html** (or press *Layout* beside a project in the site manager). Pick a project at the top; the right side shows the real project page, and the size buttons show it as Desktop, Laptop, Half screen, Tablet landscape and portrait, and Phone landscape and portrait. Click anything in the preview, or in the list on the left, to select it.

* **Header:** title left or centred; facts beside the introduction or below it in columns; introduction Very small, Small, Medium, Large or Very large, aligned left, centre, right or justified. Edit the title, description, category, year, introduction and facts.
* **Blocks:** drag to reorder, add new blocks after the selected one, duplicate, hide or delete. Edit each block's text, captions and image files.
* **Layout of a block,** all from fixed choices so a page cannot break:
  * *Width*: Full, Wide, Two thirds, Half, Third (12, 10, 8, 6 or 4 of 12 columns).
  * *Row*: start a new row, or sit beside the block before when the widths fit (for example Half and Half, or Two thirds and Third). If they do not fit, the block starts a new row and the editor says so.
  * *Position in the row*: left, centre or right, for rows narrower than full.
  * *Vertical alignment* within a row, and *Space above*: none, small, normal or large.
  * *Images*: original shape, or cropped to 16:9, 3:2, 4:3, square or portrait, with the part to keep in view. A click on the page still opens the whole image.
  * *Text*: heading beside or above the text; size Very small, Small, Medium, Large or Very large; paragraphs aligned left, centre, right or justified (justified falls back to left in narrow columns and on phones).
* **What adapts by itself:** on half screens and tablets, Third becomes Half and anything wider becomes Full; on phones every block is full width and stacked; a heading sits beside its text only when the block is wide enough. These rules are in `assets/site.css`, so content can never override them.
* **Undo and redo** with the arrows or Ctrl+Z / Ctrl+Shift+Z. *Revert project* goes back to the published version. Changes are kept in this browser until you download.
* **Publish** commits the changed project files to GitHub. **Download zip** gives `projects/<folder>/project.json` for each changed project to upload by hand (Add file, Upload files) and commit.

In `project.json` the layout is stored as a `layout` object on each block, for example `"layout": { "width": "half", "beside": true, "ratio": "4/3" }`, and page options as `"layout": { "header": "center", "facts": "below" }` at the top level.

## 5. The cover animation editor

Open **https://shafiarch.github.io/works_shafi/covers.html**. It shows every book cover on the shelf, animating as on the site, plus a large view of the selected one. The theme buttons at the top let you check each theme.

* **All books** (the first item on the left) sets the default for every cover.
* **One book:** click its cover or its name. Changing a value gives that book its own setting (marked *own*); the arrow beside a value returns it to the default; *Use the defaults* clears all of that book's own settings.
* **Drawing:** *Size* (40 to 200 percent of the normal drawing box), *Move left or right* and *Move up or down* (in percent of the cover width; the cover clips anything pushed past its edge), *Speed* (0 holds a still frame, 100 is normal, up to 300).
* **Lines (ink)** and **Accent (orange)**, each on its own: *Thickness* (20 to 400 percent) and *Opacity* (0 is invisible, 100 is solid).
* Because the cover always keeps the same proportions, these settings look the same at every screen size.
* Undo and redo, *Revert all*, **Publish** (changes only the `covers` part of `content/site.json` on GitHub), and *Download zip* to upload by hand. When uploading by hand, the zip replaces the whole `site.json`, so upload any unsaved site manager changes first.

In `content/site.json` the settings look like `"covers": { "default": { "ink": { "weight": 1.2 } }, "books": { "lego-city": { "size": 1.3, "y": -10, "accent": { "opacity": 0.6 } } } }`.

## 6. The book effect editor

Open **https://shafiarch.github.io/works_shafi/book.html**. The right side is the real front page; click books in it to see them turn, and use the Desktop, Laptop, Tablet and Phone buttons and the theme buttons to check each case.

* **Book effect** (the master slider): 0 is a flat block, like a card; 65 is the look the site was designed with; 100 is a full book with a rounded spine. Presets: Block, Soft, Book, Full book. It moves every surface setting together.
* **Opening:** *Turn of the open book* (90 shows the cover flat; lower shows more spine) and *Perspective* (0 flat, 100 deep).
* **Surface:** *Spine edge fillet*, *Rounded spine*, *Cover crease*, *Floor shadow*, *Corner rounding*.
* **Proportion and motion:** *Spine width*, *Cover width* (as a percent of its height), *Space between books*, *Lift on hover*, *Turning time*.
* Each value has an arrow that returns it to the designed value. Undo and redo, *Revert*, **Publish** (changes only the `book` part of `content/site.json` on GitHub), and *Download zip* to upload by hand. When uploading by hand, the zip replaces the whole `site.json`, so upload unsaved changes from other tools first.

In `content/site.json` the settings look like `"book": { "angle": 50, "depth": 100, "curve": 70, "lift": 12, "radius": 3 }`; values left out use the designed defaults.

## 7. Add a project by hand

1. Make a folder in `projects/`, lowercase with hyphens, for example `projects/seattle-library/`.
2. Put the images in it (see section 6 for exporting from Photoshop). Simple names are easiest: `01.webp`, `02.webp`.
3. Copy `projects/_template/project.json` into the folder and edit it. Delete any blocks you do not need.
4. Make a cover: `python tools/images.py cover projects/seattle-library/01.webp --focus 0.5 0.5`
5. Add one line to the `works` list in `content/site.json`, where you want it in the work list, and add the folder name to the `carousel` list where you want the book on the shelf:
   `{ "project": "seattle-library" },`

## 8. Remove, hide or reorder

* **Reorder:** the order of `works` in `content/site.json` is the work list order (and the previous / next links on project pages). The order of `carousel` is the shelf order.
* **Work list only:** leave the entry out of `carousel`.
* **Hide for now:** add `"hidden": true` to the line, for example `{ "project": "ida-interior", "hidden": true }`. The folder stays, the book disappears.
* **Remove for good:** delete the line, then delete the folder if you no longer want the files.
* A line that points to a missing folder is skipped quietly, so the site never breaks.

## 9. Change what is inside a project

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
| `art` | The drawn, animated cover (it sits bottom left above the description; its size is `--cover-art-w` in `assets/site.css`): `lego`, `flyover`, `healing`, `homestead`, `interior` or `graph`. It takes priority over `cover`. New drawings go in `assets/covers.js` (the `ART` list), in the same line style as the Grasshopper cards. |
| `cover` | Image shown when the book opens if there is no `art`. Leave both empty for a typographic cover. |
| `tone` | Spine color from the theme: `light`, `mid`, `dark`, `accent`, or `auto`. The shelf currently uses only the neutral three. |
| `spine` | Shorter text for the spine, if the title is long. |
| `spineColor`, `spineInk` | A fixed spine color for this one book (any CSS color), overriding the theme. |
| `coverText`, `coverNote` | Text for a typographic cover. |

## 10. Put another website or repository on the shelf

An entry in `works` does not have to be a project folder. Give it an `id` (used in `carousel`) and a `type` (`website` or `repository`):

```json
{
  "id": "grasshopper-collection",
  "type": "website",
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

## 11. Images from Photoshop

The web wants WebP or JPG, not PSD. Either export from Photoshop (File, Export, Export As, WebP or JPG, about 3000 to 4000 px on the long edge), or let the tool do it:

```
pip install pillow psd-tools
python tools/images.py web  path/to/psd_folder  --out projects/seattle-library
python tools/images.py cover projects/seattle-library/01.webp --focus 0.6 0.5 --zoom 1.3
```

* `web` converts every PSD, TIF, PNG or JPG in a folder to WebP (4000 px long edge, quality 82). Keep the PSDs out of the repository; GitHub warns above 50 MB per file.
* `cover` crops a portrait cover. `--focus X Y` is the point to centre on (0 to 1 across and down), `--zoom` moves closer. It writes `cover.webp` next to the image.
* Clicking any image on a project page opens it full screen; clicking again shows it at full resolution, so presentation boards stay readable.

## 12. Themes

Each theme is one file in `themes/`. They define the same tokens (`--bg`, `--ink`, `--ink-2`, `--rule`, `--accent`, the typefaces, and `--tone-*-bg` / `--tone-*-ink` for the four spine tones). All three use Archivo throughout. Included:

* `trace` (the default): the Grasshopper collection look; trace paper, black ink, burnt orange accent, and it follows the visitor's dark mode.
* `night`: the bookshelf reference look; black room, grey and charcoal spines.
* `clay`: warm paper and earth tones.

**The switch:** the Trace / Night / Clay buttons in the header change the theme on the spot, and each visitor's choice is remembered in their browser. Adding `?theme=night` to an address opens that page in a given theme.

**Change the default:** edit `DEFAULT` in `themes/themes.js`.

**Add or remove a theme:** copy a theme file, rename it (for example `themes/ink.css`), change the values, and add it to `THEMES` in `themes/themes.js`; the header switch lists whatever is there, in that order. Deleting a line from `THEMES` removes that button.

Shelf proportions are in `assets/site.css` at the top: `--book-h` (height), `--spine-ratio`, `--cover-ratio`, `--open-angle`. A theme can override any of them in its own `:root`.

## 13. Publish and preview

* **Publish:** in the repository, Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`. The site appears at https://shafiarch.github.io/works_shafi/ a minute or two after each commit.
* **Cache rule:** the pages load the scripts and styles with `?v=17`. When you change a `.js` or `.css` file, raise that number in both `index.html` and `project.html` so visitors get the new file. JSON content is never cached, so content edits need nothing extra.
* **Local preview:** the pages read JSON, which browsers block from a file opened directly. In the repository folder run `python -m http.server 8000` and open http://localhost:8000.
* **Front page settings** in `content/site.json`: `shelfTitle` (read aloud by screen readers; not shown), `autoplaySeconds` (0 turns autoplay off), `showIndex` (the Work list button under the shelf), `nav`, `about`, `footer`.

## 14. Writing

No em dashes or en dashes anywhere; use commas, semicolons, parentheses or periods.
