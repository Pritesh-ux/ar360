from pathlib import Path
import re

env = {}
for line in Path("/var/www/ar360/deploy/.env").read_text(errors="ignore").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k] = v.strip().strip('"').strip("'")

try:
    import pymysql
except ImportError:
    import MySQLdb as pymysql  # type: ignore

conn = pymysql.connect(
    host=env.get("DB_HOST", "127.0.0.1"),
    port=int(env.get("DB_PORT") or 3306),
    user=env["DB_USER"],
    password=env.get("DB_PASSWORD") or env.get("DB_PASS", ""),
    database=env.get("DB_NAME", "arstudio"),
    connect_timeout=10,
)
cur = conn.cursor()
cur.execute(
    "SELECT setting_key, setting_value FROM website_settings "
    "WHERE setting_key LIKE 'free_trial_popup_%' ORDER BY setting_key"
)
rows = cur.fetchall()
print("rows", len(rows))
for k, v in rows:
    print(k, "=>", repr(v)[:160])
conn.close()
