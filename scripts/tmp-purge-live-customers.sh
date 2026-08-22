#!/usr/bin/env bash
# Live purge: keep only asodariyasdesign@gmail.com + lapo3500@gmail.com
set -euo pipefail

APP=/var/www/ar360/deploy
KEEP_EMAILS="'asodariyasdesign@gmail.com','lapo3500@gmail.com'"

get_env(){ grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//;"; }
DB_HOST=$(get_env MYSQL_HOST); DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=$(get_env MYSQL_PORT); DB_PORT=${DB_PORT:-3306}
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE); DB_NAME=${DB_NAME:-arstudio}
export MYSQL_PWD="$DB_PASS"
MQ(){ mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" "$@"; }
MQN(){ MQ -N -B "$@"; }

echo "=== KEEP ==="
MQ -e "SELECT customer_uid, email, contact_name FROM customers WHERE LOWER(email) IN ($KEEP_EMAILS);"

echo "=== PURGE TARGETS ==="
MQ -e "SELECT customer_uid, id, user_id, email, contact_name FROM customers WHERE LOWER(email) NOT IN ($KEEP_EMAILS);"

mapfile -t ROWS < <(MQN -e "SELECT CONCAT(customer_uid,'|',id,'|',COALESCE(user_id,0),'|',email) FROM customers WHERE LOWER(email) NOT IN ($KEEP_EMAILS);")
if [ "${#ROWS[@]}" -eq 0 ]; then
  echo "Nothing to purge."
  exit 0
fi

UIDS=(); IDS=(); USERS=()
for row in "${ROWS[@]}"; do
  IFS='|' read -r cuid cid uid email <<<"$row"
  echo "purge $email $cuid"
  UIDS+=("$cuid"); IDS+=("$cid")
  [ "$uid" != "0" ] && USERS+=("$uid")
done

uid_in=$(printf "'%s'," "${UIDS[@]}" | sed 's/,$//')
id_in=$(printf "%s," "${IDS[@]}" | sed 's/,$//')
user_in=$(printf "%s," "${USERS[@]}" | sed 's/,$//')

has_col(){
  local t="$1" c="$2"
  local n
  n=$(MQN -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$t' AND COLUMN_NAME='$c';")
  [ "${n:-0}" -gt 0 ]
}

del_uid(){
  local t="$1"
  if has_col "$t" customer_uid; then
    echo "DELETE $t WHERE customer_uid IN (...)"
    MQN -e "DELETE FROM \`$t\` WHERE customer_uid IN ($uid_in);" || echo "WARN $t"
  fi
}

del_id(){
  local t="$1"
  if has_col "$t" customer_id; then
    echo "DELETE $t WHERE customer_id IN (...)"
    MQN -e "DELETE FROM \`$t\` WHERE customer_id IN ($id_in);" || echo "WARN $t"
  fi
}

echo "=== Disabling FK checks ==="
MQN -e "SET FOREIGN_KEY_CHECKS=0;"

# Prefer product children before products
for t in \
  product_assets product_versions product_edit_log product_embed_configs product_qr_codes \
  embed_view_events qr_scan_events share_events share_links \
  analytics_events analytics_sessions analytics_daily \
  object_capture_events object_capture_images object_capture_jobs object_capture_usage \
  support_tickets \
  customer_subscriptions customer_sessions customer_notifications customer_email_deliveries \
  customer_onboarding customer_activity_logs \
  billing_checkout_sessions billing_orders billing_payments billing_invoices billing_profiles \
  billing_history billing_refunds billing_renewal_events billing_scheduled_changes \
  billing_notification_outbox billing_reconciliation_issues billing_audit_log \
  payment_methods payments coupon_redemptions \
  bandwidth_usage_events usage_counters usage_daily \
  api_keys webhooks workspaces clients custom_domains \
  account_deletion_requests data_export_requests email_action_tokens user_preferences \
  login_logs audit_logs; do
  del_uid "$t"
done

for t in enterprise_contracts enterprise_requests; do
  del_id "$t"
done

# Enterprise requests by email (fresh panel — only keep emails)
if has_col enterprise_requests business_email; then
  echo "Purge enterprise_requests not in keep emails"
  MQN -e "
    DELETE ep FROM enterprise_payments ep
      INNER JOIN enterprise_requests er ON er.id = ep.request_id
     WHERE LOWER(er.business_email) NOT IN ($KEEP_EMAILS);
  " || true
  MQN -e "
    DELETE eq FROM enterprise_quotes eq
      INNER JOIN enterprise_requests er ON er.id = eq.request_id
     WHERE LOWER(er.business_email) NOT IN ($KEEP_EMAILS);
  " || true
  MQN -e "
    DELETE en FROM enterprise_notes en
      INNER JOIN enterprise_requests er ON er.id = en.request_id
     WHERE LOWER(er.business_email) NOT IN ($KEEP_EMAILS);
  " || true
  MQN -e "
    DELETE ec FROM enterprise_contracts ec
      INNER JOIN enterprise_requests er ON er.id = ec.request_id
     WHERE LOWER(er.business_email) NOT IN ($KEEP_EMAILS);
  " || true
  MQN -e "DELETE FROM enterprise_requests WHERE LOWER(business_email) NOT IN ($KEEP_EMAILS);" || true
fi

echo "DELETE products for purged customers"
MQN -e "DELETE FROM products WHERE customer_uid IN ($uid_in);"

if [ -n "$user_in" ]; then
  echo "DELETE users $user_in"
  MQN -e "DELETE FROM users WHERE id IN ($user_in);" || true
fi

echo "DELETE customers"
MQN -e "DELETE FROM customers WHERE customer_uid IN ($uid_in);"

MQN -e "SET FOREIGN_KEY_CHECKS=1;"

# Disk cleanup
for cuid in "${UIDS[@]}"; do
  for p in \
    "$APP/storage/$cuid" \
    "$APP/storage/products/$cuid" \
    "$APP/public/uploads/$cuid" \
    "$APP/public/uploads/branding/$cuid"; do
    if [ -e "$p" ]; then
      echo "RM $p"
      rm -rf "$p"
    fi
  done
done

echo "=== REMAINING customers ==="
MQ -e "SELECT customer_uid, contact_name, email, plan_id, status FROM customers ORDER BY created_at;"
echo "=== REMAINING products ==="
MQ -e "SELECT customer_uid, COUNT(*) AS n FROM products GROUP BY customer_uid;"
echo "=== REMAINING enterprise_requests ==="
MQ -e "SELECT request_uid, business_email, company_name, status FROM enterprise_requests ORDER BY id;" 2>/dev/null || true
echo "=== REMAINING support_tickets ==="
MQ -e "SELECT COUNT(*) AS tickets FROM support_tickets;" 2>/dev/null || true
echo "DONE"
