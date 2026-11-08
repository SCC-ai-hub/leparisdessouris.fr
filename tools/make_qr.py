"""Generate QR codes: B/W rounded modules, center read-icon, corner stand number."""
from __future__ import annotations

import argparse
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer

ROOT = Path(__file__).resolve().parents[2]
ICON = ROOT / "_Elements" / "paper read text icon.png"
COLOR = (0, 0, 0)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("arialbd.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def paste_icon_in_circle(
    canvas: Image.Image,
    icon_path: Path,
    cx: int,
    cy: int,
    badge_r: int,
) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.ellipse(
        (cx - badge_r, cy - badge_r, cx + badge_r, cy + badge_r),
        fill=(255, 255, 255, 255),
        outline=COLOR + (255,),
        width=5,
    )

    icon = Image.open(icon_path).convert("RGBA")
    max_side = int(badge_r * 2 * 0.62)
    iw, ih = icon.size
    scale = min(max_side / iw, max_side / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    icon = icon.resize((nw, nh), Image.Resampling.LANCZOS)

    # Force fill to black, keep alpha (vectorized)
    r, g, b, a = icon.split()
    black = Image.new("L", icon.size, 0)
    icon = Image.merge("RGBA", (black, black, black, a))

    canvas.alpha_composite(icon, (cx - nw // 2, cy - nh // 2))


def make_qr(url: str, corner: str, out: Path) -> None:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=16,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(radius_ratio=0.55),
        color_mask=SolidFillColorMask(back_color=(255, 255, 255), front_color=COLOR),
    ).convert("RGBA")

    side_pad = 36
    corner_size = int(28 * 1.5)  # 1.5× previous corner digits
    bottom_extra = 72
    canvas = Image.new(
        "RGBA",
        (img.width + side_pad * 2, img.height + side_pad + bottom_extra),
        (255, 255, 255, 255),
    )
    canvas.paste(img, (side_pad, side_pad), img)

    cx = side_pad + img.width // 2
    cy = side_pad + img.height // 2
    badge_r = int(min(img.width, img.height) * 0.13)
    paste_icon_in_circle(canvas, ICON, cx, cy, badge_r)

    draw = ImageDraw.Draw(canvas)
    font = load_font(corner_size)
    bbox = draw.textbbox((0, 0), corner, font=font)
    tw = bbox[2] - bbox[0]
    x = side_pad + img.width - tw - 4
    y = side_pad + img.height + 12
    draw.text((x, y), corner, fill=COLOR + (255,), font=font)

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG")
    print(f"wrote {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Base Pages URL, no trailing slash")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "qr"))
    args = parser.parse_args()
    base = args.base.rstrip("/")
    out_dir = Path(args.out)
    for i in range(1, 41):
        num = f"{i:02d}"
        url = f"{base}/t/{num}/"
        make_qr(url, num, out_dir / f"{num}.png")


if __name__ == "__main__":
    main()
