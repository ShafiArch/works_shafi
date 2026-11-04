/* Theme switchboard.
   Colors, fonts and spine tones live in one CSS file per theme in this folder.
   The layout (assets/site.css) only reads the tokens, so a theme can be added,
   tested or swapped without touching anything else.

   DEFAULT  : the theme every visitor sees.
   THEMES   : file name (without .css) and a label for the preview panel.

   Preview any theme without deploying it:  add ?theme=trace to the address.
   That choice sticks in your browser; ?theme=default clears it.
   Add ?themes to the address to show a small theme picker. */

window.SITE_THEMES = {
  DEFAULT: "night",
  THEMES: {
    night: "Night shelf",
    trace: "Trace paper",
    clay: "Clay"
  }
};

(function () {
  var T = window.SITE_THEMES, name = T.DEFAULT, q = new URLSearchParams(location.search), stored = null;
  try { stored = localStorage.getItem("site-theme"); } catch (e) {}
  if (stored && T.THEMES[stored]) name = stored;
  var asked = q.get("theme");
  if (asked === "default") { try { localStorage.removeItem("site-theme"); } catch (e) {} name = T.DEFAULT; }
  else if (asked && T.THEMES[asked]) { name = asked; try { localStorage.setItem("site-theme", asked); } catch (e) {} }
  T.current = name;
  T.previewing = name !== T.DEFAULT;
  var base = document.currentScript.src.replace(/themes\.js.*$/, "");
  document.write('<link rel="stylesheet" id="theme-css" href="' + base + name + '.css">');
  document.documentElement.setAttribute("data-site-theme", name);
})();
