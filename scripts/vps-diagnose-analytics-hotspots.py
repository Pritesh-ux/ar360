#!/usr/bin/env python3
import subprocess
from pathlib import Path


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        env[key] = value
    return env


def main() -> None:
    env = load_env(Path("/var/www/ar360/deploy/.env"))
    host = env.get("MYSQL_HOST") or env.get("DB_HOST") or "127.0.0.1"
    port = env.get("MYSQL_PORT") or env.get("DB_PORT") or "3306"
    user = env.get("MYSQL_USER") or env.get("DB_USER") or "root"
    password = env.get("MYSQL_PASSWORD") or env.get("DB_PASSWORD") or ""
    db = env.get("MYSQL_DATABASE") or env.get("DB_NAME")
    if not db:
        raise SystemExit("Missing MYSQL_DATABASE/DB_NAME")
    base = ["mysql", f"-h{host}", f"-P{port}", f"-u{user}", f"-p{password}", db, "-N", "-e"]

    def q(sql: str, label: str) -> None:
        print(f"=== {label} ===")
        r = subprocess.run(base + [sql], capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr[-500:])
        else:
            print((r.stdout or "").strip() or "(empty)")

    q(
        "SELECT id, public_id, title, "
        "CASE WHEN hotspots IS NULL THEN 'NULL' "
        "WHEN hotspots IN ('[]','null') THEN 'EMPTY' "
        "ELSE CONCAT('LEN=', CHAR_LENGTH(hotspots)) END AS hs, "
        "LEFT(hotspots, 160) "
        "FROM products WHERE title IN ('chf_34','02','MODEL02') "
        "OR public_id LIKE '%4MS4C%' LIMIT 10;",
        "products hotspots",
    )
    q(
        "SELECT e.event, COUNT(*) c FROM analytics_events e "
        "JOIN products p ON p.id=e.product_uid "
        "WHERE p.title IN ('chf_34','02','MODEL02') "
        "AND e.created_at >= DATE_SUB(NOW(), INTERVAL 35 DAY) "
        "GROUP BY e.event ORDER BY c DESC;",
        "events by type (joined)",
    )
    q(
        "SELECT COALESCE(p.title, e.product_uid) t, COUNT(*) c "
        "FROM analytics_events e "
        "LEFT JOIN products p ON p.id=e.product_uid "
        "WHERE e.event IN ('qr_scan','download_qr') "
        "AND e.created_at >= DATE_SUB(NOW(), INTERVAL 35 DAY) "
        "AND e.customer_uid=(SELECT customer_uid FROM products WHERE title='chf_34' LIMIT 1) "
        "GROUP BY t;",
        "qr_scan by product (incl orphans)",
    )
    q(
        "SELECT e.event, COUNT(*) c FROM analytics_events e "
        "JOIN products p ON p.id=e.product_uid AND p.title='02' "
        "WHERE e.event IN ('ar_button_click','ar_launch_success') "
        "AND e.created_at >= DATE_SUB(NOW(), INTERVAL 35 DAY) "
        "GROUP BY e.event;",
        "product 02 AR events",
    )


if __name__ == "__main__":
    main()
