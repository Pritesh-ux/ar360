from pathlib import Path
from PIL import Image

root = Path(r"C:\xampp\htdocs\ar360\public\brand")


def trim(path: Path, pad: int = 8) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 20:
                xs.append(x)
                ys.append(y)
    box = (
        max(0, min(xs) - pad),
        max(0, min(ys) - pad),
        min(w, max(xs) + pad + 1),
        min(h, max(ys) + pad + 1),
    )
    return im.crop(box)


im = trim(root / "ui-wordmark-dark.png")
im.save(root / "ui-wordmark-dark.png")
canvas = Image.new("RGBA", im.size, (28, 29, 34, 255))
canvas.alpha_composite(im)
canvas.convert("RGB").save(root / "preview-ui-wordmark-dark.png")
print("trimmed", im.size)

# white mark for dark UI
mark = Image.open(root / "ui-mark.png").convert("RGBA")
px = mark.load()
w, h = mark.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 10:
            continue
        if g > 180 and r > 140 and b < 120:
            continue
        if abs(r - g) < 30 and abs(g - b) < 30 and 120 <= r <= 230:
            continue
        if r < 90 and g < 90 and b < 90:
            px[x, y] = (255, 255, 255, a)
mark.save(root / "ui-mark-on-dark.png")
print("mark-on-dark ok")
