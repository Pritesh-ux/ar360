from pathlib import Path
from PIL import Image

root = Path(r"C:\xampp\htdocs\ar360\public\brand")
svg = (root / "ar360-wordmark.svg").read_text(encoding="utf-8")
svg = svg.replace("<svg ", '<svg fill="#ffffff" ', 1)
svg = svg.replace("stroke: #000", "stroke: #fff")
svg = svg.replace('stroke="#000"', 'stroke="#fff"')
(root / "ar360-wordmark-white.svg").write_text(svg, encoding="utf-8")
print("wrote white svg")
