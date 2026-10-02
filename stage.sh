#!/bin/bash
# Rebuilds _deploy/ — the folder Netlify publishes.
#
# Copies only production files. Excluded on purpose:
#   _shots/            screenshot captures + capture helper pages
#   _original-backup/  the pre-redesign originals
#   assets/*.py        image tooling (contains absolute local paths)
#   unused images      anything in assets/ the page doesn't reference
#   .claude/           editor config
#
# Usage:  bash stage.sh
set -e
cd "$(dirname "$0")"

rm -rf _deploy
mkdir -p _deploy/assets

cp index.html style.css script.js theme-init.js site.webmanifest robots.txt sitemap.xml _deploy/
cp assets/*.png assets/*.ico _deploy/assets/

# Cache busting: CSS/JS keep fixed names, so stamp each reference in the HTML
# with a content hash. _headers can then cache them for a year, and a deploy
# still reaches returning visitors on their next page load.
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -c1-10; }
for f in style.css script.js theme-init.js; do
  v=$(sha "$f")
  sed "s|\"${f//./\\.}\"|\"$f?v=$v\"|" _deploy/index.html > _deploy/index.tmp
  mv _deploy/index.tmp _deploy/index.html
  if ! grep -qF "\"$f?v=$v\"" _deploy/index.html; then
    echo "ERROR: index.html has no \"$f\" reference to version — a year-long cache would go stale"
    exit 1
  fi
done

# Publish only the images the site actually references (HTML comments don't
# count). Spares and placeholders — the admin sign-in capture, the "REPLACE ME"
# phone shot — stay in the repo until a page uses them.
refs=$(perl -0777 -pe 's/<!--.*?-->//gs' index.html; cat site.webmanifest)
for f in _deploy/assets/*; do
  case "$refs" in
    *"assets/$(basename "$f")"*) ;;
    *) rm -f "$f" ;;
  esac
done

cp _headers _deploy/_headers

echo "Staged $(find _deploy -type f | wc -l) files ($(du -sh _deploy | cut -f1))"
if grep -rIl 'C:\\Users\|C:/Users' _deploy/ >/dev/null 2>&1; then
  echo "WARNING: a staged file contains a local absolute path"
  exit 1
fi
echo "OK — no local paths leaked."
