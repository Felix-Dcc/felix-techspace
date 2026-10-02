# felix-techspace

Personal portfolio for **Felix Osei-Poku**, backend software engineer.

Live: **https://felix-techspace.netlify.app**

Hand-built with vanilla HTML, CSS and JavaScript — no framework, no bundler, no
build step. Three source files, zero runtime dependencies, one network call
(the GitHub API, for the projects grid).

---

## Implementation notes

**Theme without a flash.** A synchronous script in `<head>` resolves saved
preference → OS preference → dark, and stamps `data-theme` on the root element
before first paint. Every colour is a CSS custom property, so a theme flip
cannot leave a component behind.

**Content is visible if JavaScript fails.** Scroll-reveal sets `opacity: 0`,
which would blank the page if the observer never fired — so the hidden state is
scoped to `html.js` (set by that same head script). If `script.js` hasn't
claimed the page within 3 seconds (it failed to load, or threw first), the head
script drops `html.js` again. Each module in `script.js` also runs in its own
`try`, so one failure can't take the others down. A JS failure degrades to a
plain, readable page.

**GitHub projects grid.** Fetches repositories at runtime, filters forks and
archived repos, and renders them with a 6-hour `localStorage` cache — the
anonymous API allows 60 requests/hour per IP. Every interpolated field goes
through an HTML escaper, and every URL through an http(s) allowlist.

**One scroll listener.** Progress bar and back-to-top share a single passive,
rAF-gated handler. Sticky navigation and active-link highlighting use
`IntersectionObserver` instead of scroll math.

**Accessibility.** Single `h1`, no heading-level skips, labelled landmarks and
sections, skip link, visible focus rings, and every text pair verified at WCAG
AA contrast in both themes — including a dedicated token pair for solid buttons,
where hover darkens rather than lightens to preserve the ratio.

**Motion.** All animation sits behind `prefers-reduced-motion`. There are also
`forced-colors` and print stylesheets.

---

## Structure

```
index.html          markup + head-level theme bootstrap
style.css           design tokens and 17 numbered sections
script.js           9 modules: theme, nav, scroll, reveal, counters,
                    magnetic, projects, contact, misc
_headers            CSP, HSTS and cache policy (copied into the publish dir)
netlify.toml        build config
stage.sh            builds _deploy/ — the folder Netlify publishes
assets/
  _generate_assets.py   favicons, web manifest icons, social card
  _prepare_shots.py     crops/resizes raw captures to mockup dimensions
sitemap.xml  robots.txt  site.webmanifest
```

## Local development

Any static server works:

```bash
python -m http.server 4173
```

## Deployment

Netlify builds from `main`. `stage.sh` copies only production files into
`_deploy/`, deliberately excluding the image tooling (which embeds absolute
local paths), screenshot captures and backups. It fails the build rather than
publishing a file containing a local path.

```bash
bash stage.sh
```

## Regenerating images

```bash
python assets/_generate_assets.py   # favicons, manifest icons, OG card
python assets/_prepare_shots.py     # project screenshots at mockup sizes
```

Update the `SRC_*` paths at the top of `_prepare_shots.py` first.
