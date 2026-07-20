# Custom Domain SSL (ops)

AR360 does **not** mint TLS certificates inside the Node/Next.js app.

## Customer DNS

1. **TXT** `_arverify.<customer-domain>` = verification token shown in Settings → Domains  
2. **CNAME** `<customer-domain>` → `AR360_DOMAIN_TARGET` (default `domains.ar360.app`)

After TXT matches, the app marks the domain `verified` and `ssl_status = pending`. When HTTPS requests arrive on that host, middleware may set `ssl_status = active`.

## Edge / reverse proxy

Terminate HTTPS on nginx, Caddy, Cloudflare, or another edge in front of the app:

- Accept `Host: ar.customer.com` (and optional `X-Forwarded-Proto: https`)
- Proxy to the AR360 origin (same app that serves `NEXT_PUBLIC_APP_URL`)
- Issue/renew certificates on the edge (Let’s Encrypt, Cloudflare Universal SSL, ACM, etc.)

Example nginx sketch:

```nginx
server {
  server_name ar.customer.com;
  listen 443 ssl http2;
  # ssl_certificate / ssl_certificate_key managed by certbot or your CDN

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;
  }
}
```

## App env

| Variable | Purpose |
|----------|---------|
| `AR360_DOMAIN_TARGET` | CNAME target shown to customers (e.g. `domains.ar360.app`) |
| `NEXT_PUBLIC_APP_URL` | Platform origin fallback for share/QR/viewer URLs |
| `AR360_INTERNAL_KEY` | Shared secret for `/api/internal/custom-domain` (middleware Host lookup) |

## Plan gate

`billing_plans.allow_custom_domain` (Business/Enterprise by default) is separate from Custom Branding (`custom_branding` / white-label viewer look).
