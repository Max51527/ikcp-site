"""
Génère l'image Open Graph IKCP avec la montgolfière bleu-blanc-rouge.
Format : 1200×630 PNG, optimisé pour LinkedIn / WhatsApp / iMessage / Twitter.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), "..", "icons", "og-image.png")

# ─── Palette IKCP ───
BG_TOP    = (252, 247, 235)   # crème
BG_BOTTOM = (235, 220, 192)   # beige sable
SUN       = (255, 200, 110)
GOLD      = (184, 149, 110)
INK       = (31, 26, 22)
SUB       = (109, 92, 74)
BLEU      = (35, 76, 158)
BLANC     = (251, 247, 240)
ROUGE     = (200, 38, 51)
NACELLE   = (122, 84, 56)
NACELLE_D = (88, 60, 38)
CABLE     = (60, 50, 42)


def gradient_bg():
    """Gradient vertical crème → beige."""
    img = Image.new("RGB", (W, H), BG_TOP)
    px = img.load()
    for y in range(H):
        t = y / H
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    return img


def soft_circle(size, color, alpha_max=200, blur=40):
    """Cercle flou pour halos / nuages."""
    s = size * 3
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([s // 4, s // 4, 3 * s // 4, 3 * s // 4],
              fill=color + (alpha_max,))
    return layer.filter(ImageFilter.GaussianBlur(blur)).resize(
        (size, size), Image.Resampling.LANCZOS)


def draw_balloon(target, cx, cy, r=160):
    """Dessine la montgolfière bleu-blanc-rouge centrée en (cx,cy)."""
    # ─── Ombre douce sous le ballon ───
    shadow = Image.new("RGBA", (r * 4, r * 4), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([r, 3 * r - r // 3, 3 * r, 3 * r + r // 3],
               fill=(31, 26, 22, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    target.paste(shadow, (cx - 2 * r, cy - r), shadow)

    # ─── Ballon : 3 panneaux drapeau français ───
    # On dessine le ballon comme un cercle qu'on découpe en 3 bandes verticales
    balloon = Image.new("RGBA", (r * 2 + 8, int(r * 2.2) + 8), (0, 0, 0, 0))
    bd = ImageDraw.Draw(balloon)
    # Cercle bleu (panneau gauche)
    bd.pieslice([4, 4, 2 * r + 4, int(r * 2.2) + 4],
                start=120, end=240, fill=BLEU)
    # Cercle blanc central (légèrement plus haut, ovale)
    bd.ellipse([int(r * 0.55), 4, int(r * 1.45), int(r * 2.2) + 4],
               fill=BLANC)
    # Trois rectangles verticaux pour panneaux
    panel_w = (2 * r) // 3
    bd.rectangle([4, 4, 4 + panel_w, int(r * 2.2) + 4], fill=BLEU)
    bd.rectangle([4 + panel_w, 4, 4 + 2 * panel_w, int(r * 2.2) + 4],
                 fill=BLANC)
    bd.rectangle([4 + 2 * panel_w, 4, 4 + 2 * r, int(r * 2.2) + 4],
                 fill=ROUGE)

    # Mask en forme d'ovale (ballon)
    mask = Image.new("L", (r * 2 + 8, int(r * 2.2) + 8), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([4, 4, 2 * r + 4, int(r * 2.2) + 4], fill=255)
    balloon.putalpha(mask)

    # Reflet brillant
    glare = Image.new("RGBA", balloon.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glare)
    gd.ellipse([int(r * 0.35), int(r * 0.25),
                int(r * 0.85), int(r * 0.85)],
               fill=(255, 255, 255, 70))
    glare = glare.filter(ImageFilter.GaussianBlur(18))
    balloon = Image.alpha_composite(balloon, glare)

    # Bordure dorée fine
    bdr = Image.new("RGBA", balloon.size, (0, 0, 0, 0))
    bdr_d = ImageDraw.Draw(bdr)
    bdr_d.ellipse([4, 4, 2 * r + 4, int(r * 2.2) + 4],
                  outline=(160, 130, 90, 120), width=3)
    balloon = Image.alpha_composite(balloon, bdr)

    target.paste(balloon, (cx - r - 4, cy - int(r * 1.1) - 4), balloon)

    # ─── Câbles entre ballon et nacelle ───
    drw = ImageDraw.Draw(target)
    nx, ny = cx, cy + int(r * 1.4)
    nw, nh = int(r * 0.7), int(r * 0.4)
    bx_left = cx - int(r * 0.6)
    bx_right = cx + int(r * 0.6)
    by = cy + int(r * 1.05)
    drw.line([(bx_left, by), (nx - nw // 2 + 6, ny + 4)],
             fill=CABLE, width=3)
    drw.line([(bx_right, by), (nx + nw // 2 - 6, ny + 4)],
             fill=CABLE, width=3)
    drw.line([(cx - r // 4, by), (nx - nw // 4, ny + 4)],
             fill=CABLE, width=2)
    drw.line([(cx + r // 4, by), (nx + nw // 4, ny + 4)],
             fill=CABLE, width=2)

    # ─── Brûleur (petit cercle or sous le ballon) ───
    drw.ellipse([cx - 14, cy + int(r * 1.0) - 4,
                 cx + 14, cy + int(r * 1.0) + 24],
                fill=(212, 175, 130), outline=GOLD, width=2)

    # ─── Nacelle (panier osier) ───
    drw.rounded_rectangle([nx - nw // 2, ny, nx + nw // 2, ny + nh],
                          radius=10, fill=NACELLE, outline=NACELLE_D, width=3)
    # Tressage horizontal (lignes osier)
    for i in range(1, 4):
        y_line = ny + (nh * i) // 4
        drw.line([(nx - nw // 2 + 6, y_line), (nx + nw // 2 - 6, y_line)],
                 fill=NACELLE_D, width=1)


def load_font(size, bold=False, italic=False):
    candidates = []
    if italic and bold:
        candidates += ["seguibli.ttf", "georgiabi.ttf", "ariblki.ttf"]
    elif italic:
        candidates += ["seguili.ttf", "georgiai.ttf", "ariali.ttf"]
    elif bold:
        candidates += ["seguibl.ttf", "georgiab.ttf", "arialbd.ttf",
                       "segoeuib.ttf"]
    else:
        candidates += ["segoeui.ttf", "georgia.ttf", "arial.ttf"]
    for f in candidates:
        for base in ["C:/Windows/Fonts/", "/Library/Fonts/",
                     "/usr/share/fonts/truetype/dejavu/"]:
            path = os.path.join(base, f)
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    pass
    # Fallback Pillow default
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()


def main():
    img = gradient_bg().convert("RGBA")

    # Halo soleil
    halo = soft_circle(420, SUN, alpha_max=140, blur=70)
    img.alpha_composite(halo, (W - 480, 60))

    # Petits nuages cosmétiques
    cl1 = soft_circle(180, (255, 255, 255), alpha_max=160, blur=24)
    img.alpha_composite(cl1, (40, 360))
    cl2 = soft_circle(260, (255, 255, 255), alpha_max=120, blur=32)
    img.alpha_composite(cl2, (W // 2 - 130, 40))

    # Montgolfière (côté droit, légèrement plus à droite pour libérer le texte)
    draw_balloon(img, cx=W - 220, cy=H // 2 - 30, r=155)

    # Texte (côté gauche)
    drw = ImageDraw.Draw(img)
    f_kicker = load_font(18, bold=True)
    f_title = load_font(72, bold=True)
    f_title_it = load_font(72, bold=True, italic=True)
    f_sub = load_font(24)
    f_foot = load_font(16, bold=True)

    # Kicker doré
    drw.text((70, 130), "IKCP — CABINET PATRIMONIAL INDÉPENDANT",
             fill=GOLD, font=f_kicker)

    # Titre noir
    drw.text((70, 170), "Protéger ce que vous", fill=INK, font=f_title)
    drw.text((70, 250), "êtes", fill=INK, font=f_title)

    # Italique doré shimmer
    drw.text((180, 330), "en train de bâtir.",
             fill=GOLD, font=f_title_it)

    # Sous-titre
    drw.text((70, 430),
             "Conseil patrimonial — juridique · fiscal · financier",
             fill=SUB, font=f_sub)

    # Footer (mentions trust)
    drw.text((70, H - 60),
             "10 ANS  ·  100% INDÉPENDANT  ·  ORIAS 23001568",
             fill=GOLD, font=f_foot)

    # Save (RGB pour compatibilité OG)
    final = Image.new("RGB", img.size, BG_TOP)
    final.paste(img, mask=img.split()[3])
    final.save(OUT, "PNG", optimize=True, quality=92)
    print("OK :", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
