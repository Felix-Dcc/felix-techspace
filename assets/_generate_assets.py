# -*- coding: utf-8 -*-
"""
Generates the favicon set, social share image, and screenshot placeholders.
Re-run after changing brand colours:  python assets/_generate_assets.py
Requires: Pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

ACCENT_A = (99, 102, 241)     # indigo  #6366f1
ACCENT_B = (139, 92, 246)     # violet  #8b5cf6
INK = (8, 9, 11)              # near-black
PAPER = (247, 248, 248)

FONT_DIRS = [r"C:\Windows\Fonts", "/usr/share/fonts", "/Library/Fonts"]
BOLD_CANDIDATES = ["segoeuib.ttf", "calibrib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
REG_CANDIDATES = ["segoeui.ttf", "calibri.ttf", "arial.ttf", "DejaVuSans.ttf"]
MONO_CANDIDATES = ["consola.ttf", "cour.ttf", "DejaVuSansMono.ttf"]


def find_font(candidates, size):
    for d in FONT_DIRS:
        for name in candidates:
            p = os.path.join(d, name)
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
    return ImageFont.load_default()


def linear_gradient(size, c1, c2, diagonal=True):
    """Vertical or 135deg linear gradient as an RGB image."""
    w, h = size
    base = Image.new("RGB", (w, h), c1)
    top = Image.new("RGB", (w, h), c2)
    mask = Image.new("L", (w, h))
    px = mask.load()
    for y in range(h):
        for x in range(w):
            t = ((x / max(w - 1, 1)) + (y / max(h - 1, 1))) / 2 if diagonal else y / max(h - 1, 1)
            px[x, y] = int(255 * t)
    base.paste(top, (0, 0), mask)
    return base


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def make_icon(px, pad_ratio=0.0):
    """Square app icon: gradient rounded tile + white F monogram."""
    ss = 4  # supersample for clean edges
    S = px * ss
    tile = linear_gradient((S, S), ACCENT_A, ACCENT_B)
    tile.putalpha(rounded_mask((S, S), int(S * 0.23)))

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    inset = int(S * pad_ratio)
    if inset:
        tile = tile.resize((S - inset * 2, S - inset * 2), Image.LANCZOS)
        canvas.paste(tile, (inset, inset), tile)
    else:
        canvas.paste(tile, (0, 0), tile)

    d = ImageDraw.Draw(canvas)
    font = find_font(BOLD_CANDIDATES, int(S * 0.62))
    glyph = "F"
    box = d.textbbox((0, 0), glyph, font=font)
    gw, gh = box[2] - box[0], box[3] - box[1]
    d.text((S / 2 - gw / 2 - box[0], S / 2 - gh / 2 - box[1] - S * 0.02),
           glyph, font=font, fill=(255, 255, 255, 255))
    return canvas.resize((px, px), Image.LANCZOS)


def make_og():
    """1200x630 social share card."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img, "RGBA")

    # soft accent glows
    glow = Image.new("RGB", (W, H), INK)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-180, 180, 520, 900], fill=(46, 47, 120))
    gd.ellipse([760, -240, 1460, 460], fill=(72, 42, 120))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(150)), 0.85)
    d = ImageDraw.Draw(img, "RGBA")

    icon = make_icon(96)
    img.paste(icon, (80, 74), icon)

    f_name = find_font(BOLD_CANDIDATES, 76)
    f_role = find_font(BOLD_CANDIDATES, 40)
    f_body = find_font(REG_CANDIDATES, 30)
    f_mono = find_font(MONO_CANDIDATES, 24)

    d.text((80, 214), "Felix Osei-Poku", font=f_name, fill=(255, 255, 255))
    d.text((80, 312), "Backend Software Engineer", font=f_role, fill=(150, 155, 255))
    d.text((80, 384),
           "Python · Django · FastAPI · PostgreSQL · Redis · Docker",
           font=f_body, fill=(170, 176, 190))
    d.text((80, 430),
           "APIs and services built to stay correct under load.",
           font=f_body, fill=(170, 176, 190))

    d.rounded_rectangle([80, 508, 468, 566], radius=29, outline=(99, 102, 241), width=2)
    d.text((108, 526), "felix-techspace.netlify.app", font=f_mono, fill=(200, 204, 255))
    return img


def make_placeholder(w, h, label, sub, phone=False):
    """Clearly-marked screenshot placeholder."""
    img = Image.new("RGB", (w, h), (14, 16, 19))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 0, w, h], fill=(14, 16, 19))

    # faint grid so it reads as a placeholder, not a broken image
    step = max(w // 22, 24)
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=(255, 255, 255, 12))
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=(255, 255, 255, 12))

    d.rounded_rectangle([1, 1, w - 2, h - 2], radius=18 if phone else 10,
                        outline=(99, 102, 241, 90), width=2)

    f_t = find_font(BOLD_CANDIDATES, max(int(h * 0.055), 17))
    f_s = find_font(REG_CANDIDATES, max(int(h * 0.036), 13))
    f_m = find_font(MONO_CANDIDATES, max(int(h * 0.030), 12))

    def centre(text, font, y, fill):
        box = d.textbbox((0, 0), text, font=font)
        d.text(((w - (box[2] - box[0])) / 2 - box[0], y), text, font=font, fill=fill)

    cy = h / 2
    centre("REPLACE ME", f_m, cy - h * 0.16, (120, 125, 235))
    centre(label, f_t, cy - h * 0.08, (240, 241, 245))
    centre(sub, f_s, cy + h * 0.02, (138, 143, 152))
    centre("%d x %d" % (w, h), f_m, cy + h * 0.12, (95, 100, 112))
    return img


if __name__ == "__main__":
    out = lambda n: os.path.join(HERE, n)

    # ── favicons ──
    for size, name in [(16, "favicon-16x16.png"), (32, "favicon-32x32.png"),
                       (192, "android-chrome-192x192.png"), (512, "android-chrome-512x512.png")]:
        make_icon(size).save(out(name)); print("wrote", name)

    # apple-touch-icon needs an opaque background (iOS ignores alpha)
    apple = Image.new("RGB", (180, 180), INK)
    ic = make_icon(180)
    apple.paste(ic, (0, 0), ic)
    apple.save(out("apple-touch-icon.png")); print("wrote apple-touch-icon.png")

    make_icon(64).save(out("favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print("wrote favicon.ico")

    make_og().save(out("og-image.png"), optimize=True); print("wrote og-image.png")

    # ── screenshot placeholders ──
    # NOTE: laundromart-desktop.png and laundromart-mobile-1.png are REAL
    # captures, produced by _prepare_shots.py. Do not generate placeholders over
    # them here. Only the still-empty second phone slot gets one.
    make_placeholder(540, 1080, "Second phone view",
                     "540x1080 — then uncomment the back phone in index.html",
                     phone=True).save(out("laundromart-mobile-2.png"))
    print("wrote remaining screenshot placeholder (mobile-2)")
