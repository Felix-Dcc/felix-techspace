/* ============================================================================
   Theme bootstrap — loaded synchronously in <head> so it runs before first
   paint (no flash of the wrong theme). Resolves: saved preference → OS
   preference → dark.

   Its own file rather than inline so the CSP can forbid inline script. Keep
   it out of script.js, which is deferred and would run too late.
   ========================================================================== */

(function () {
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    root.setAttribute('data-theme', theme);
  } catch (e) { /* private mode — fall through to the dark default */ }
  // Marks that scripting is alive. Scroll-reveal only hides content while
  // this class is present. script.js adds .reveal-ready once it has taken
  // over; if it never does (failed to load, or threw first), drop the
  // class so the page falls back to plain, visible content.
  root.classList.add('js');
  setTimeout(function () {
    if (!root.classList.contains('reveal-ready')) root.classList.remove('js');
  }, 3000);
})();
