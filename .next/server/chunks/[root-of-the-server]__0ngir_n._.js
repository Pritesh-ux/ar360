module.exports=[719901,(e,N,i)=>{N.exports=e.x("dns/promises",()=>require("dns/promises"))},16006,e=>{"use strict";var N=e.i(843793);async function i(){for(let[e,i]of[["viewer_tagline","VARCHAR(240) NULL"],["cta_label","VARCHAR(80) NULL"],["website_url","VARCHAR(500) NULL"],["loading_message","VARCHAR(120) NULL"],["button_style","VARCHAR(20) NOT NULL DEFAULT 'filled'"],["header_style","VARCHAR(20) NOT NULL DEFAULT 'glass'"],["viewer_font","VARCHAR(40) NOT NULL DEFAULT 'system'"],["favicon_url","TEXT NULL"],["show_product_title","TINYINT(1) NOT NULL DEFAULT 1"],["hide_interaction_hint","TINYINT(1) NOT NULL DEFAULT 0"]]){let[{total:T=0}={total:0}]=await (0,N.query)(`SELECT COUNT(*) AS total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspaces' AND COLUMN_NAME = ?`,[e]).catch(()=>[{total:0}]);0===Number(T)&&await (0,N.query)(`ALTER TABLE workspaces ADD COLUMN \`${e}\` ${i}`).catch(()=>void 0)}}async function T(){await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL,
      name VARCHAR(180) NOT NULL,
      slug VARCHAR(120) NOT NULL,
      logo_url TEXT NULL,
      brand_color VARCHAR(20) NULL DEFAULT '#B8FF3C',
      brand_name VARCHAR(180) NULL,
      accent_color VARCHAR(20) NULL,
      viewer_watermark BOOLEAN NOT NULL DEFAULT FALSE,
      remove_branding BOOLEAN NOT NULL DEFAULT FALSE,
      custom_viewer_theme VARCHAR(40) NULL DEFAULT 'default',
      viewer_tagline VARCHAR(240) NULL,
      cta_label VARCHAR(80) NULL,
      website_url VARCHAR(500) NULL,
      loading_message VARCHAR(120) NULL,
      button_style VARCHAR(20) NOT NULL DEFAULT 'filled',
      header_style VARCHAR(20) NOT NULL DEFAULT 'glass',
      viewer_font VARCHAR(40) NOT NULL DEFAULT 'system',
      favicon_url TEXT NULL,
      show_product_title TINYINT(1) NOT NULL DEFAULT 1,
      hide_interaction_hint TINYINT(1) NOT NULL DEFAULT 0,
      owner_user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      plan VARCHAR(80) NOT NULL DEFAULT 'starter',
      status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_workspaces_uid (workspace_uid),
      UNIQUE KEY uq_workspaces_slug (slug),
      INDEX idx_workspaces_owner (owner_user_id),
      INDEX idx_workspaces_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await i(),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('owner','admin','editor','viewer','billing') NOT NULL DEFAULT 'viewer',
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_wm_workspace_user (workspace_uid, user_id),
      INDEX idx_wm_workspace (workspace_uid),
      INDEX idx_wm_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL,
      invited_by_user_id BIGINT UNSIGNED NOT NULL,
      email VARCHAR(255) NOT NULL,
      role ENUM('admin','editor','viewer','billing') NOT NULL DEFAULT 'viewer',
      token VARCHAR(64) NOT NULL,
      status ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_wi_token (token),
      INDEX idx_wi_workspace (workspace_uid),
      INDEX idx_wi_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL DEFAULT '',
      customer_uid VARCHAR(40) NOT NULL DEFAULT '',
      user_id BIGINT UNSIGNED NULL,
      actor_name VARCHAR(160) NOT NULL DEFAULT '',
      actor_email VARCHAR(255) NOT NULL DEFAULT '',
      action VARCHAR(80) NOT NULL,
      resource_type VARCHAR(60) NOT NULL DEFAULT '',
      resource_id VARCHAR(160) NOT NULL DEFAULT '',
      resource_label VARCHAR(255) NOT NULL DEFAULT '',
      meta JSON NULL,
      ip_hash VARCHAR(64) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_al_workspace (workspace_uid),
      INDEX idx_al_customer (customer_uid),
      INDEX idx_al_user (user_id),
      INDEX idx_al_action (action),
      INDEX idx_al_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      key_uid VARCHAR(40) NOT NULL,
      workspace_uid VARCHAR(40) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      created_by_user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(120) NOT NULL,
      key_hash VARCHAR(128) NOT NULL,
      key_prefix VARCHAR(12) NOT NULL,
      scopes JSON NOT NULL,
      status ENUM('active','revoked') NOT NULL DEFAULT 'active',
      last_used_at DATETIME NULL,
      expires_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ak_uid (key_uid),
      UNIQUE KEY uq_ak_hash (key_hash),
      INDEX idx_ak_workspace (workspace_uid),
      INDEX idx_ak_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS api_key_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      key_uid VARCHAR(40) NOT NULL,
      workspace_uid VARCHAR(40) NOT NULL,
      endpoint VARCHAR(255) NOT NULL DEFAULT '',
      method VARCHAR(10) NOT NULL DEFAULT '',
      status_code SMALLINT UNSIGNED NOT NULL DEFAULT 200,
      ip_hash VARCHAR(64) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_akl_key (key_uid),
      INDEX idx_akl_workspace (workspace_uid),
      INDEX idx_akl_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      webhook_uid VARCHAR(40) NOT NULL,
      workspace_uid VARCHAR(40) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      name VARCHAR(120) NOT NULL,
      url TEXT NOT NULL,
      secret_hash VARCHAR(128) NOT NULL,
      events JSON NOT NULL,
      status ENUM('active','disabled') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_wh_uid (webhook_uid),
      INDEX idx_wh_workspace (workspace_uid),
      INDEX idx_wh_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      webhook_uid VARCHAR(40) NOT NULL,
      workspace_uid VARCHAR(40) NOT NULL,
      event VARCHAR(80) NOT NULL,
      payload JSON NOT NULL,
      status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
      response_status SMALLINT UNSIGNED NULL,
      response_body TEXT NULL,
      attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
      next_retry_at DATETIME NULL,
      delivered_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_wd_webhook (webhook_uid),
      INDEX idx_wd_workspace (workspace_uid),
      INDEX idx_wd_status (status),
      INDEX idx_wd_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS usage_counters (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      storage_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      bandwidth_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      product_count INT UNSIGNED NOT NULL DEFAULT 0,
      total_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
      total_ar_launches BIGINT UNSIGNED NOT NULL DEFAULT 0,
      total_asset_downloads BIGINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_uc_workspace (workspace_uid),
      INDEX idx_uc_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS usage_daily (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      date DATE NOT NULL,
      storage_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      bandwidth_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      views INT UNSIGNED NOT NULL DEFAULT 0,
      ar_launches INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ud_workspace_date (workspace_uid, date),
      INDEX idx_ud_customer (customer_uid),
      INDEX idx_ud_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS product_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_uid VARCHAR(160) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      workspace_uid VARCHAR(40) NOT NULL DEFAULT '',
      version_number INT UNSIGNED NOT NULL DEFAULT 1,
      created_by_user_id BIGINT UNSIGNED NULL,
      label VARCHAR(120) NOT NULL DEFAULT '',
      snapshot JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_pv_product (product_uid),
      INDEX idx_pv_customer (customer_uid),
      INDEX idx_pv_workspace (workspace_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS custom_domains (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      workspace_uid VARCHAR(40) NOT NULL,
      customer_uid VARCHAR(40) NOT NULL,
      domain VARCHAR(253) NOT NULL,
      verification_token VARCHAR(64) NOT NULL,
      status ENUM('pending','verified','failed') NOT NULL DEFAULT 'pending',
      ssl_status ENUM('none','pending','active') NOT NULL DEFAULT 'none',
      verified_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cd_domain (domain),
      INDEX idx_cd_workspace (workspace_uid),
      INDEX idx_cd_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)}e.s(["ensureEnterpriseSchema",0,T])},998811,e=>{"use strict";var N=e.i(254799),i=e.i(719901),T=e.i(843793),a=e.i(16006);async function t(e,N,i){let[{total:a=0}={total:0}]=await (0,T.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,N]);0===Number(a)&&await (0,T.query)(`ALTER TABLE \`${e}\` ADD COLUMN \`${N}\` ${i}`)}let E=null;async function L(){E||(E=(async()=>{await (0,a.ensureEnterpriseSchema)(),await t("custom_domains","is_primary","TINYINT(1) NOT NULL DEFAULT 0"),await t("custom_domains","last_check_at","DATETIME NULL"),await t("custom_domains","last_error","VARCHAR(500) NULL")})().catch(e=>{throw E=null,e})),await E}function r(){return String(process.env.AR360_DOMAIN_TARGET||process.env.NEXT_PUBLIC_DOMAIN_TARGET||"domains.ar360.app").toLowerCase().trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"")}function A(e){let N=e.domain;return{domain:N,txtHost:`_arverify.${N}`,txtValue:e.verification_token,cnameHost:N,cnameTarget:r(),sslNote:"Point the CNAME at the AR360 edge host. HTTPS/TLS is terminated on your reverse proxy or CDN — the app does not issue certificates."}}async function s(e){await L();let i=e.domain.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"");if(!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(i))throw Error("Invalid domain format.");let a=`arv_${(0,N.randomBytes)(16).toString("hex")}`,t=0===(await _(e.workspaceUid)).length;return await (0,T.query)(`INSERT INTO custom_domains (workspace_uid, customer_uid, domain, verification_token, status, ssl_status, is_primary)
     VALUES (?, ?, ?, ?, 'pending', 'none', ?)`,[e.workspaceUid,e.customerUid,i,a,+!!t]),(await (0,T.query)("SELECT * FROM custom_domains WHERE domain = ? LIMIT 1",[i]))[0]}async function _(e){return await L(),(0,T.query)("SELECT * FROM custom_domains WHERE workspace_uid = ? ORDER BY is_primary DESC, created_at DESC",[e])}async function o(e,N){await L();let i=(await (0,T.query)("SELECT * FROM custom_domains WHERE id = ? AND workspace_uid = ? LIMIT 1",[e,N]))[0];i&&(await (0,T.query)("DELETE FROM custom_domains WHERE id = ? AND workspace_uid = ?",[e,N]),i.is_primary&&await (0,T.query)(`UPDATE custom_domains SET is_primary = 1
        WHERE workspace_uid = ? AND status = 'verified'
        ORDER BY verified_at DESC LIMIT 1`,[N]).catch(()=>void 0))}async function d(e,N){await L();let i=(await (0,T.query)("SELECT * FROM custom_domains WHERE id = ? AND workspace_uid = ? LIMIT 1",[e,N]))[0];if(!i)return null;if("verified"!==i.status)throw Error("Only a verified domain can be set as primary.");return await (0,T.query)("UPDATE custom_domains SET is_primary = 0 WHERE workspace_uid = ?",[N]),await (0,T.query)("UPDATE custom_domains SET is_primary = 1 WHERE id = ? AND workspace_uid = ?",[e,N]),(await (0,T.query)("SELECT * FROM custom_domains WHERE id = ? LIMIT 1",[e]))[0]||null}async function u(e){try{return(await i.default.resolveTxt(e)).flat().map(e=>e.trim())}catch{return[]}}async function U(e){try{return(await i.default.resolveCname(e)).map(e=>e.toLowerCase().replace(/\.$/,""))}catch{return[]}}async function n(e,N){var i,a;await L();let t=(await (0,T.query)("SELECT * FROM custom_domains WHERE id = ? AND workspace_uid = ? LIMIT 1",[e,N]))[0];if(!t)return{verified:!1,error:"Domain not found."};let E=`_arverify.${t.domain}`,s=(i=await u(E),a=t.verification_token,i.some(e=>e.trim()===a)),_=r(),o=await U(t.domain),d=0===o.length||o.some(e=>e===_||e.endsWith(`.${_}`)),n=A(t);if(!s){let i=`TXT record missing or incorrect. Add TXT ${E} = ${t.verification_token}`;return await (0,T.query)(`UPDATE custom_domains
          SET status = 'failed', last_check_at = NOW(), last_error = ?
        WHERE id = ? AND workspace_uid = ?`,[i.slice(0,500),e,N]),{verified:!1,error:i,instructions:n,cnameOk:d}}let c=d?null:`TXT verified. CNAME does not yet resolve to ${_} (may be flattened by CDN). Ensure HTTPS proxy points here.`;await (0,T.query)(`UPDATE custom_domains
        SET status = 'verified', ssl_status = 'pending', verified_at = COALESCE(verified_at, NOW()),
            last_check_at = NOW(), last_error = ?
      WHERE id = ? AND workspace_uid = ?`,[c,e,N]);let R=await (0,T.query)("SELECT COUNT(*) AS total FROM custom_domains WHERE workspace_uid = ? AND is_primary = 1 AND status = 'verified'",[N]);return 0===Number(R[0]?.total||0)&&await (0,T.query)("UPDATE custom_domains SET is_primary = 1 WHERE id = ? AND workspace_uid = ?",[e,N]),{verified:!0,instructions:n,cnameOk:d,error:c||void 0}}async function c(e){await L();let N=e.toLowerCase().split(":")[0].trim();return(await (0,T.query)(`SELECT workspace_uid, customer_uid, domain FROM custom_domains
      WHERE domain = ? AND status = 'verified' LIMIT 1`,[N]))[0]??null}async function R(e){await L();let N=await (0,T.query)(`SELECT domain FROM custom_domains
      WHERE customer_uid = ? AND status = 'verified'
      ORDER BY is_primary DESC, verified_at DESC
      LIMIT 1`,[e]),i=N[0]?.domain;return i?`https://${i}`:null}async function I(e){let N=await R(e.customerUid).catch(()=>null);return N?N.replace(/\/$/,""):String(e.fallbackOrigin||"http://localhost:3000").replace(/\/$/,"")}e.s(["addDomain",0,s,"getDomainInstructions",0,A,"getWorkspaceByDomain",0,c,"listDomains",0,_,"markSslActiveFromHttpsHost",0,function(e){return(0,T.query)(`UPDATE custom_domains SET ssl_status = 'active', last_check_at = NOW()
      WHERE domain = ? AND status = 'verified' AND ssl_status <> 'active'`,[e.toLowerCase()]).catch(()=>void 0)},"removeDomain",0,o,"resolveBrandedOrigin",0,I,"setPrimaryDomain",0,d,"verifyDomain",0,n])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0ngir_n._.js.map