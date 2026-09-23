#!/bin/sh
# Re-exports every raster in public/ from the sources in this folder, using
# headless Chrome (already on any machine that runs the browser tests' target).
# Run from anywhere: sh apps/web/brand/export.sh
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/../public"
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}

shot() { # source width height output
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size="$2,$3" --screenshot="$4" "$1" >/dev/null 2>&1
}

# Home-screen icons are square and full-bleed: the OS applies its own mask, so
# the rounded corners of icon.svg are dropped for them.
square=$(mktemp -d)/icon-square.svg
sed 's/rx="112"/rx="0"/' "$here/icon.svg" > "$square"

mkdir -p "$out"
cp "$here/icon.svg" "$out/favicon.svg"
# JPEG, not PNG: the paper grain makes a PNG ~290 KB, and WhatsApp drops
# previews much over 300 KB. At quality 85 it is a fraction of that.
shot "file://$here/og-default.html" 1200 630 "$square.og.png"
sips -s format jpeg -s formatOptions 85 "$square.og.png" --out "$out/og-default.jpg" >/dev/null
# Headless Chrome will not open a window narrower than ~500px, so render once
# at 512 and scale down with sips (macOS).
shot "file://$square" 512 512 "$out/icon-512.png"
sips -Z 192 "$out/icon-512.png" --out "$out/icon-192.png" >/dev/null
sips -Z 180 "$out/icon-512.png" --out "$out/apple-touch-icon.png" >/dev/null
ls -l "$out"
