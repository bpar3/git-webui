#!/usr/bin/env python3
"""Generate GitPar's icon set from one vector definition.

The mark is a commit node resting exactly on a horizontal datum bar,
with its lane descending below - work sitting level with the standard,
which is what "par" names. The app already speaks this way: a branch is
ahead of, behind, or level with its upstream.

The bar is drawn quieter than the node on purpose. The standard is
context; the commit is the subject.

Everything is drawn on a 64-unit grid and supersampled, so adding a size
is another entry in SIZES rather than a redrawn asset.

    python3 tools/make-icons.py
"""

import os
import sys

from PIL import Image, ImageDraw

GRID = 64.0
SUPERSAMPLE = 8

INK = (0x16, 0x20, 0x2B, 255)      # tile
BAR = (0x9F, 0xB6, 0xCC, 255)      # the datum - cool and quiet, it is context
LANE = (0xFD, 0x8C, 0x25, 255)     # the app's first graph lane colour

BAR_Y = 27.0
BAR_X0, BAR_X1 = 7.0, 57.0
BAR_WIDTH = 5.0

LANE_X = 32.0
LANE_BOTTOM = 52.0
LANE_WIDTH = 4.5
NODE_RADIUS = 6.5

TILE_RADIUS = 14.0

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def render(size, tile=True):
    """Draw the mark at `size` px, supersampled then reduced."""
    px = size * SUPERSAMPLE
    scale = px / GRID
    image = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if tile:
        draw.rounded_rectangle(
            [0, 0, px - 1, px - 1], radius=TILE_RADIUS * scale, fill=INK)

    # The datum bar, with round caps.
    bar_half = (BAR_WIDTH * scale) / 2.0
    draw.rounded_rectangle(
        [BAR_X0 * scale, BAR_Y * scale - bar_half,
         BAR_X1 * scale, BAR_Y * scale + bar_half],
        radius=bar_half, fill=BAR)

    # The lane, descending from the node.
    lane_half = (LANE_WIDTH * scale) / 2.0
    draw.rounded_rectangle(
        [LANE_X * scale - lane_half, BAR_Y * scale,
         LANE_X * scale + lane_half, LANE_BOTTOM * scale],
        radius=lane_half, fill=LANE)

    # The commit, level with the bar.
    r = NODE_RADIUS * scale
    draw.ellipse([LANE_X * scale - r, BAR_Y * scale - r,
                  LANE_X * scale + r, BAR_Y * scale + r], fill=LANE)

    return image.resize((size, size), Image.LANCZOS)


SIZES = {
    "packaging/tauri/src-tauri/icons/32x32.png": 32,
    "packaging/tauri/src-tauri/icons/128x128.png": 128,
    "packaging/tauri/src-tauri/icons/128x128@2x.png": 256,
    "src/share/gitpar/web/img/gitpar-icon.png": 128,
}


def main():
    for rel, size in SIZES.items():
        path = os.path.join(REPO_ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        render(size).save(path)
        print("wrote %s (%dpx)" % (rel, size))

    ico = os.path.join(REPO_ROOT, "packaging/tauri/src-tauri/icons/icon.ico")
    render(256).save(ico, sizes=[(16, 16), (32, 32), (48, 48),
                                 (64, 64), (128, 128), (256, 256)])
    print("wrote packaging/tauri/src-tauri/icons/icon.ico")

    icns = os.path.join(REPO_ROOT, "packaging/tauri/src-tauri/icons/icon.icns")
    try:
        render(1024).save(icns)
        print("wrote packaging/tauri/src-tauri/icons/icon.icns")
    except Exception as error:
        # Pillow's ICNS writer isn't available everywhere; only the macOS
        # bundle needs it.
        print("skipped icon.icns (%s)" % error, file=sys.stderr)


if __name__ == "__main__":
    main()
