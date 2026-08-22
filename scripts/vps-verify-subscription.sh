#!/bin/bash
set -euo pipefail
echo "=== string checks ==="
if grep -R "Downgrade not allowed" /var/www/ar360/deploy/.next/static 2>/dev/null | head -1; then
  echo "FOUND: Downgrade not allowed"
else
  echo "MISSING: Downgrade not allowed"
fi
if grep -R "Billing assurance" /var/www/ar360/deploy/.next/static 2>/dev/null | head -1; then
  echo "FOUND_OLD: Billing assurance (bad)"
else
  echo "OK: Billing assurance not in static chunks"
fi
if grep -R "Recurring mandate" /var/www/ar360/deploy/.next/static 2>/dev/null | head -1; then
  echo "FOUND_OLD: Recurring mandate"
else
  echo "OK: Recurring mandate not in static chunks"
fi
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://ar360studio.com/login
pm2 status ar360-web | head -20
echo VERIFY_OK
