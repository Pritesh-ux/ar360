import base64
from pathlib import Path

png = Path(r"C:\xampp\htdocs\ar360\public\brand\ar360-wordmark-email.png").read_bytes()
b64 = base64.b64encode(png).decode("ascii")
out = Path(r"C:\xampp\htdocs\ar360\src\lib\email\templates\brand-logo-data-uri.ts")
out.write_text(
    f'export const AR360_WORDMARK_EMAIL_DATA_URI =\n  "data:image/png;base64,{b64}";\n',
    encoding="ascii",
)
print("wrote", out, "bytes", len(b64))
