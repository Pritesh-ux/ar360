#!/usr/bin/env python3
"""Normalize analytics_events.product_uid and rebuild analytics_daily on the live DB."""
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
    root = Path("/var/www/ar360/deploy")
    env = load_env(root / ".env")
    host = env.get("DB_HOST") or env.get("MYSQL_HOST") or "127.0.0.1"
    port = env.get("DB_PORT") or env.get("MYSQL_PORT") or "3306"
    user = env.get("DB_USER") or env.get("MYSQL_USER")
    password = env.get("DB_PASSWORD") or env.get("MYSQL_PASSWORD") or ""
    db = env.get("DB_NAME") or env.get("MYSQL_DATABASE")
    if not user or not db:
        raise SystemExit(f"Missing DB credentials (user={user!r} db={db!r})")

    base = ["mysql", f"-h{host}", f"-P{port}", f"-u{user}", f"-p{password}", db, "-N", "-e"]

    def run(sql: str, label: str, optional: bool = False) -> None:
        print(f"[backfill] {label}")
        result = subprocess.run(base + [sql], capture_output=True, text=True)
        if result.returncode != 0:
            err = (result.stderr or "")[-800:]
            if optional:
                print(f"  skipped: {err}")
                return
            print(err)
            raise SystemExit(result.returncode)
        out = (result.stdout or "").strip()
        if out:
            print(out[:1000])

    run(
        "UPDATE analytics_events e INNER JOIN products p ON p.public_id = e.product_uid "
        "SET e.product_uid = p.id WHERE e.product_uid <> p.id;",
        "public_id -> id",
    )
    run(
        "UPDATE analytics_events e INNER JOIN products p ON p.viewer_slug = e.product_uid "
        "SET e.product_uid = p.id WHERE e.product_uid <> p.id;",
        "viewer_slug -> id",
    )
    run(
        "UPDATE analytics_sessions s INNER JOIN products p ON p.public_id = s.product_uid "
        "SET s.product_uid = p.id WHERE s.product_uid <> p.id;",
        "sessions public_id",
    )
    run(
        "UPDATE analytics_sessions s INNER JOIN products p ON p.viewer_slug = s.product_uid "
        "SET s.product_uid = p.id WHERE s.product_uid <> p.id;",
        "sessions slug",
    )
    run('UPDATE analytics_events SET event = "qr_scan" WHERE event = "download_qr";', "rename download_qr")
    run('UPDATE analytics_events SET event = "open_embed" WHERE event = "embed_open";', "rename embed_open")
    run("DELETE FROM analytics_daily;", "clear analytics_daily")
    run(
        """INSERT INTO analytics_daily
        (customer_uid, product_uid, date, views, unique_visitors, ar_launches,
         screenshots, shares, copy_links, qr_scans, avg_duration)
        SELECT e.customer_uid, e.product_uid, DATE(e.created_at),
               SUM(e.event = "viewer_open"), COUNT(DISTINCT e.ip_hash),
               SUM(e.event = "ar_launch_success"), SUM(e.event = "screenshot"),
               SUM(e.event IN ("share_native", "share_view")), SUM(e.event = "copy_link"),
               SUM(e.event IN ("qr_scan", "download_qr")), 0
        FROM analytics_events e
        GROUP BY e.customer_uid, e.product_uid, DATE(e.created_at);""",
        "rebuild analytics_daily",
    )
    run(
        """UPDATE analytics_daily d
        INNER JOIN (
          SELECT customer_uid, product_uid, DATE(created_at) AS date,
                 SUM(event IN ("open_embed","embed_open")) AS embed_views
          FROM analytics_events
          GROUP BY customer_uid, product_uid, DATE(created_at)
        ) s ON s.customer_uid = d.customer_uid
           AND s.product_uid = d.product_uid
           AND s.date = d.date
        SET d.embed_views = s.embed_views;""",
        "embed_views projection",
        optional=True,
    )
    run(
        "SELECT event, COUNT(*) c FROM analytics_events GROUP BY event ORDER BY c DESC LIMIT 12;",
        "event counts",
    )
    print("BACKFILL_OK")


if __name__ == "__main__":
    main()
