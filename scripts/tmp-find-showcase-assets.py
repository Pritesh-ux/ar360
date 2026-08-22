#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess

MISSING = [
    "a6b1e263b608b80b1f4ccb29a192c790.jpg",
    "56b0e1dc600d5e7b146610f39e5d9b92.jpg",
    "888ad92b8c853be8c0c6dd0ccd8dd01f.jpg",
    "48714474563d13a83200ade7dafc167f.jpg",
    "6562a6b05375e3139b236052bb984961.jpg",
    "a994b988aa411538f04a0edb6288de79.jpg",
    "1e6b32ddc417aaade515bcd3ecc34603.jpg",
    "d40d2f39e7ab0fcce34912af33453215.jpg",
]

roots = [Path("/var/www/ar360"), Path("/tmp"), Path("/root")]
found = {}
for name in MISSING:
    hits = []
    for root in roots:
        if not root.exists():
            continue
        for p in root.rglob(name):
            hits.append(str(p))
            if len(hits) >= 3:
                break
        if hits:
            break
    found[name] = hits
    print(f"{name}: {hits[:3] or 'NOT FOUND'}")

# List any jpg/png under uploads/assets across old deploys
print("--- all upload assets across deploys ---")
for p in Path("/var/www/ar360").glob("**/public/uploads/assets/*"):
    if p.is_file():
        print(p)
