#!/bin/bash
# Rebuilds _deploy/ — the folder Netlify publishes.
#
# Copies only production files. Excluded on purpose:
#   _shots/            screenshot captures + capture helper pages
#   _original-backup/  the pre-redesign originals
#   assets/*.py        image tooling (contains absolute local paths)
#   .claude/           editor config
#
# Usage:  bash stage.sh
set -e
cd "$(dirname "$0")"

rm -rf _deploy
mkdir -p _deploy/assets

cp index.html style.css script.js theme-init.js site.webmanifest robots.txt sitemap.xml _deploy/
cp assets/*.png assets/*.ico _deploy/assets/

# Unreferenced placeholder — don't publish a "REPLACE ME" image.
rm -f _deploy/assets/laundromart-mobile-2.png

cp _headers _deploy/_headers

echo "Staged $(find _deploy -type f | wc -l) files ($(du -sh _deploy | cut -f1))"
if grep -rIl 'C:\\Users\|C:/Users' _deploy/ >/dev/null 2>&1; then
  echo "WARNING: a staged file contains a local absolute path"
  exit 1
fi
echo "OK — no local paths leaked."
