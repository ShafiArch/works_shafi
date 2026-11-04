/* Theme switchboard.
   Colors, fonts and spine tones live in one CSS file per theme in this folder.
   The layout (assets/site.css) only reads the tokens, so a theme can be added,
   changed or removed without touching anything else.

   DEFAULT : the theme a first-time visitor sees.
   THEMES  : file name (without .css) and the label shown on the switch in the header,
             in the order the switch lists them.

   Visitors pick a theme with the switch in the header; the choice is remembered
   in their browser. ?theme=night in the address opens a page in that theme. */

window.SITE_THEMES = {
  DEFAULT: "trace",
  THEMES: {
    trace: "Trace",
    night: "Night",
    clay: "Clay"
  }
};

(function () {
  var T = window.SITE_THEMES, name = T.DEFAULT, stored = null;
  var asked = new URLSearchParams(location.search).get("theme");
  try { stored = localStorage.getItem("site-theme"); } catch (e) {}
  if (stored && T.THEMES[stored]) name = stored;
  if (asked && T.THEMES[asked]) name = asked;
  var base = document.currentScript.src.replace(/themes\.js.*$/, "");
  T.current = name;
  document.write('<link rel="stylesheet" id="theme-css" href="' + base + name + '.css">');
  document.documentElement.setAttribute("data-site-theme", name);

  /* Switch theme in place: load the new sheet, then drop the old one so the
     page never shows unstyled. Fires "site-theme" on window when done. */
  T.set = function (next) {
    if (!T.THEMES[next] || next === T.current) return;
    T.current = next;
    try { localStorage.setItem("site-theme", next); } catch (e) {}
    var old = document.getElementById("theme-css");
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + next + ".css";
    link.onload = link.onerror = function () {
      if (old && old.parentNode) old.parentNode.removeChild(old);
      link.id = "theme-css";
      document.documentElement.setAttribute("data-site-theme", next);
      window.dispatchEvent(new CustomEvent("site-theme", { detail: next }));
    };
    old.parentNode.insertBefore(link, old.nextSibling);
  };
})();
