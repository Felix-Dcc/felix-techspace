# -*- coding: utf-8 -*-
"""
Turns raw LaundroMart captures into the exact sizes the portfolio mockups want.

  desktop  1919x914  ->  1440x900   (admin console sign-in)
  mobile    589x1280 ->   540x1080  (admin dashboard on a phone)

Both sources have the wrong aspect ratio, and cropping to fit would cut real
content off both edges. Instead we strip OS/browser chrome, scale to the target
width, then extend the artwork vertically by extrapolating the edge gradient —
so the padding continues the design rather than showing as letterbox bars.

Re-run after replacing a source capture:  python assets/_prepare_shots.py
Requires: Pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

SRC_DESKTOP = r"C:\Users\user\Pictures\Screenshots\Screenshot 2026-08-01 102735.png"   # Analytics dashboard
SRC_LOGIN = r"C:\Users\user\Pictures\Screenshots\Screenshot 2026-08-01 095808.png"    # console sign-in (spare)
SRC_MOBILE = r"C:\Users\user\Downloads\Telegram Desktop\photo_2026-08-01_10-09-14.jpg"

# The sign-in capture had a real admin address typed in. A portfolio is a public
# page, so the visible username is swapped for a neutral one. Set to None to keep
# the original exactly as captured. (Only applies to the sign-in image.)
EMAIL_REPLACEMENT = "admin@laundromart.xyz"


def find_font(names, size):
    for d in (r"C:\Windows\Fonts", "/usr/share/fonts", "/Library/Fonts"):
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
    return ImageFont.load_default()


def extend_vertically(im, target_h):
    """Grow an image to target_h by continuing its top/bottom colour gradient.

    For each column we measure the colour trend over the outermost SAMPLE rows
    and extrapolate outwards. On a flat edge this degrades to plain edge
    replication; on a gradient it keeps the ramp going, so no seam appears.
    """
    W, H = im.size
    if H >= target_h:
        return im

    total = target_h - H
    pad_top = total // 2
    pad_bot = total - pad_top
    SAMPLE = 40

    src = im.convert("RGB")
    out = Image.new("RGB", (W, target_h))
    out.paste(src, (0, pad_top))
    sp = src.load()
    op = out.load()

    for x in range(W):
        # ── upward ──
        c0 = sp[x, 0]
        ck = sp[x, min(SAMPLE, H - 1)]
        step = [(c0[i] - ck[i]) / float(min(SAMPLE, H - 1)) for i in range(3)]
        for d in range(1, pad_top + 1):
            op[x, pad_top - d] = tuple(
                max(0, min(255, int(round(c0[i] + step[i] * d)))) for i in range(3)
            )
        # ── downward ──
        c1 = sp[x, H - 1]
        cj = sp[x, max(0, H - 1 - SAMPLE)]
        step = [(c1[i] - cj[i]) / float(min(SAMPLE, H - 1)) for i in range(3)]
        for d in range(1, pad_bot + 1):
            op[x, pad_top + H - 1 + d] = tuple(
                max(0, min(255, int(round(c1[i] + step[i] * d)))) for i in range(3)
            )

    return out


def fit_viewport(im, target_w, target_h):
    """Render the capture as if seen through a target_w x target_h viewport.

    Scales to match the target height, then takes the leftmost target_w. A wide
    desktop capture loses its right-hand column, which reads as a natural window
    edge — far better than letterboxing 24% of the frame, and it keeps the
    sidebar and primary content full-bleed. Falls back to padding if the source
    is too narrow.
    """
    W, H = im.size
    scale = target_h / float(H)
    new_w = int(round(W * scale))

    if new_w >= target_w:
        im = im.resize((new_w, target_h), Image.LANCZOS)
        return im.crop((0, 0, target_w, target_h))

    im = im.resize((target_w, int(round(H * target_w / float(W)))), Image.LANCZOS)
    return extend_vertically(im, target_h)


def pad_flat(im, target_h):
    """Grow to target_h using each edge's dominant colour.

    Used where the edge rows contain detail (chart axes, header controls) that a
    gradient extrapolation would smear into vertical streaks. The dominant colour
    of the outermost band is the app's flat background, so the padding reads as
    ordinary empty space.
    """
    W, H = im.size
    if H >= target_h:
        return im

    total = target_h - H
    pad_top = total // 2
    pad_bot = total - pad_top
    src = im.convert("RGB")

    def dominant(y0, y1):
        counts = {}
        for y in range(y0, y1):
            for x in range(0, W, 3):
                c = src.getpixel((x, y))
                counts[c] = counts.get(c, 0) + 1
        return max(counts.items(), key=lambda kv: kv[1])[0]

    out = Image.new("RGB", (W, target_h))
    d = ImageDraw.Draw(out)
    d.rectangle([0, 0, W, pad_top], fill=dominant(0, 12))
    d.rectangle([0, pad_top + H, W, target_h], fill=dominant(H - 12, H))
    out.paste(src, (0, pad_top))
    return out


# Chrome boundaries measured off the source capture by row-brightness profile:
#   y   0..82   iOS status bar   (light, avg ~248)
#   y  83..1150 page content     (dark,  avg ~26)
#   y 1151..    Safari toolbar   (lighter pill, avg 40-55)
# Hardcoded rather than detected: the charts contain light pixels that defeat a
# brightness heuristic, and these are fixed for this capture.
MOBILE_CROP_TOP = 83
MOBILE_CROP_BOTTOM = 1140   # stops just above the chart legend, which the
                            # floating Safari toolbar overlaps


def trim_browser_sliver(im, max_scan=30):
    """Drop the saturated teal browser-UI band along the very top of a capture."""
    W, H = im.size
    p = im.load()
    top = 0
    for y in range(0, max_scan):
        row = [p[x, y] for x in range(0, W, 40)]
        if sum(1 for c in row if c[1] > c[0] + 12 and c[1] > 60) > len(row) * 0.3:
            top = y + 1
    return im.crop((0, top, W, H)), top


def build_desktop():
    """Analytics dashboard — the primary browser mockup."""
    im, _ = trim_browser_sliver(Image.open(SRC_DESKTOP).convert("RGB"))
    im = fit_viewport(im, 1440, 900)
    im.save(os.path.join(HERE, "laundromart-desktop.png"), optimize=True)
    print("wrote laundromart-desktop.png", im.size)


def build_login():
    """Console sign-in — kept as a spare, not currently used on the page."""
    im, top = trim_browser_sliver(Image.open(SRC_LOGIN).convert("RGB"))
    W, H = im.size

    if EMAIL_REPLACEMENT:
        d = ImageDraw.Draw(im)
        # Inner field of the focused email input, measured from the capture.
        x0, y0, x1, y1 = 1252, 397 - top, 1688, 428 - top
        fill = im.getpixel((x1 - 12, (y0 + y1) // 2))     # sample the field's own tint
        d.rectangle([x0, y0, x1, y1], fill=fill)
        f = find_font(["segoeui.ttf", "calibri.ttf", "arial.ttf"], 19)
        d.text((x0 + 8, (y0 + y1) // 2 - 11), EMAIL_REPLACEMENT, font=f, fill=(31, 34, 41))
        d.line([(x0 + 3, y0 + 5), (x0 + 3, y1 - 5)], fill=(70, 74, 90), width=2)  # caret

    # The sign-in page is mostly empty space, so letterboxing it reads fine here:
    # extending the gradient keeps the split-panel design intact edge to edge.
    im = im.resize((1440, int(round(1440 * H / float(W)))), Image.LANCZOS)
    im = extend_vertically(im, 900)
    im.save(os.path.join(HERE, "laundromart-desktop-login.png"), optimize=True)
    print("wrote laundromart-desktop-login.png", im.size, "(spare)")


def build_mobile():
    im = Image.open(SRC_MOBILE).convert("RGB")
    W, H = im.size

    im = im.crop((0, MOBILE_CROP_TOP, W, MOBILE_CROP_BOTTOM))
    W, H = im.size
    print("  mobile cropped to", im.size,
          "(removed status bar %dpx, Safari toolbar %dpx)"
          % (MOBILE_CROP_TOP, 1280 - MOBILE_CROP_BOTTOM))

    im = im.resize((540, int(round(540 * H / float(W)))), Image.LANCZOS)
    im = pad_flat(im, 1080)
    out = os.path.join(HERE, "laundromart-mobile-1.png")
    im.save(out, optimize=True)
    print("wrote laundromart-mobile-1.png", im.size)


if __name__ == "__main__":
    build_desktop()
    build_login()
    build_mobile()
