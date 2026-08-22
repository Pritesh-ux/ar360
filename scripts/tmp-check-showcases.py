#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess

APP = Path("/var/www/ar360/deploy")
env = {}
for line in (APP / ".env").read_text(errors="ignore").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip("\"'")

sql = (
    "SELECT showcase_uid, title, IFNULL(image_path,''), visibility, "
    "IF(deleted_at IS NULL,0,1) FROM website_showcases ORDER BY sort_order, id;"
)
r = subprocess.run(
    [
        "mysql",
        "-h",
        env.get("MYSQL_HOST", "127.0.0.1"),
        "-u",
        env["MYSQL_USER"],
        f"-p{env['MYSQL_PASSWORD']}",
        env.get("MYSQL_DATABASE", "arstudio"),
        "-N",
        "-B",
        "-e",
        sql,
    ],
    capture_output=True,
    text=True,
)
print("--- rows ---")
print(r.stdout)
err = "\n".join(x for x in r.stderr.splitlines() if "password" not in x.lower())
if err.strip():
    print("ERR:", err)

print("--- disk check ---")
for line in r.stdout.splitlines():
    parts = line.split("\t")
    if len(parts) < 3:
        continue
    uid, title, path = parts[0], parts[1], parts[2]
    if not path:
        print(f"EMPTY image_path | {uid} | {title}")
        continue
    if path.startswith("/uploads/") or path.startswith("/home/"):
        disk = APP / "public" / path.lstrip("/")
        print(f"{path} | exists={disk.is_file()} | {uid} | {title}")
    else:
        print(f"OTHER {path} | {uid} | {title}")
