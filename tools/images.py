#!/usr/bin/env python3
"""
Image helper for the portfolio.

  Export PSD, TIF, PNG or JPG files to web-ready WebP:
    python tools/images.py web  path/to/folder_or_file  [--out projects/my-project] [--max 4000] [--quality 82]

  Make a book cover (portrait crop) for the front-page shelf:
    python tools/images.py cover projects/my-project/01.webp  [--focus 0.5 0.5] [--zoom 1.0] [--ratio 0.74]

Needs:  pip install pillow psd-tools
(psd-tools is only used for .psd files; Pillow alone handles the rest.)
"""
import argparse
import re
import sys
from pathlib import Path

from PIL import Image

EXTS = {".psd", ".psb", ".tif", ".tiff", ".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def open_any(path: Path) -> Image.Image:
    if path.suffix.lower() in (".psd", ".psb"):
        try:
            from psd_tools import PSDImage
            return PSDImage.open(path).composite()
        except ImportError:
            # Pillow can read the flattened preview that Photoshop saves
            # when "Maximize PSD compatibility" is on.
            return Image.open(path)
    return Image.open(path)


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return s or "image"


def to_rgb(im: Image.Image) -> Image.Image:
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def cmd_web(a):
    src = Path(a.src)
    files = [src] if src.is_file() else sorted(p for p in src.iterdir() if p.suffix.lower() in EXTS)
    out = Path(a.out) if a.out else (src.parent if src.is_file() else src)
    out.mkdir(parents=True, exist_ok=True)
    for f in files:
        im = to_rgb(open_any(f))
        im.thumbnail((a.max, a.max), Image.LANCZOS)
        dest = out / (slug(f.stem) + ".webp")
        if dest.resolve() == f.resolve():
            dest = out / (slug(f.stem) + "-web.webp")
        im.save(dest, "WEBP", quality=a.quality, method=6)
        print(f"{f.name}  ->  {dest}  ({im.width}x{im.height}, {dest.stat().st_size // 1024} KB)")


def cmd_cover(a):
    src = Path(a.src)
    im = to_rgb(open_any(src))
    W, H = im.size
    # largest crop of the requested ratio, shrunk by zoom, centred on focus
    ch = min(H, W / a.ratio) / a.zoom
    cw = ch * a.ratio
    cx, cy = a.focus[0] * W, a.focus[1] * H
    x0 = min(max(cx - cw / 2, 0), W - cw)
    y0 = min(max(cy - ch / 2, 0), H - ch)
    crop = im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))
    crop = crop.resize((a.width, round(a.width / a.ratio)), Image.LANCZOS)
    dest = Path(a.out) if a.out else src.parent / "cover.webp"
    crop.save(dest, "WEBP", quality=84, method=6)
    print(f"cover -> {dest}  ({crop.width}x{crop.height}, {dest.stat().st_size // 1024} KB)")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    w = sub.add_parser("web", help="export images to WebP")
    w.add_argument("src")
    w.add_argument("--out")
    w.add_argument("--max", type=int, default=4000, help="longest edge in px")
    w.add_argument("--quality", type=int, default=82)
    w.set_defaults(fn=cmd_web)

    c = sub.add_parser("cover", help="make a portrait cover crop")
    c.add_argument("src")
    c.add_argument("--out")
    c.add_argument("--focus", type=float, nargs=2, default=[0.5, 0.5], metavar=("X", "Y"),
                   help="centre of the crop, 0 to 1 across and down")
    c.add_argument("--zoom", type=float, default=1.0, help="1 = largest crop, 2 = twice as close")
    c.add_argument("--ratio", type=float, default=0.74, help="width / height of the cover")
    c.add_argument("--width", type=int, default=900)
    c.set_defaults(fn=cmd_cover)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
