module.exports=[193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},677652,(e,t,r)=>{t.exports=e.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},792509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},504446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},688947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},500874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},406461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},951615,(e,t,r)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},605365,(e,t,r)=>{t.exports=e.x("process",()=>require("process"))},755004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},137464,(e,t,r)=>{t.exports=e.x("timers",()=>require("timers"))},99348,(e,t,r)=>{t.exports=e.x("string_decoder",()=>require("string_decoder"))},232074,e=>{"use strict";var t=e.i(843793);async function r(e,r,i){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:s=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,r]);0===Number(s)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${r.replace(/`/g,"``")}\` ${i}`)}async function i(e,r,i){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:s=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);0===Number(s)&&await (0,t.query)(i)}async function a(e,r){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:a=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);Number(a)>0&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${r.replace(/`/g,"``")}\``)}async function s(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS customer_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      notification_uid VARCHAR(80) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome') NOT NULL DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      body VARCHAR(512) NOT NULL DEFAULT '',
      href VARCHAR(512) NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_customer_notifications_uid (notification_uid),
      INDEX idx_customer_notifications_customer_read (customer_uid, is_read),
      INDEX idx_customer_notifications_user_read (user_id, is_read),
      INDEX idx_customer_notifications_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);let[s]=await (0,t.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!s||s.COLUMN_TYPE.includes("'welcome'")&&s.COLUMN_TYPE.includes("'bandwidth'")||await (0,t.query)(`ALTER TABLE customer_notifications
       MODIFY COLUMN category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome')
       NOT NULL DEFAULT 'system'`),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      theme VARCHAR(32) NOT NULL DEFAULT 'light',
      default_product_view ENUM('grid','list') NOT NULL DEFAULT 'grid',
      items_per_page INT UNSIGNED NOT NULL DEFAULT 12,
      date_format VARCHAR(32) NOT NULL DEFAULT 'dmy',
      language VARCHAR(16) NOT NULL DEFAULT 'en',
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
      email_notification_preferences_json JSON NULL,
      dashboard_preferences_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_preferences_user (user_id),
      INDEX idx_user_preferences_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS share_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      share_uid VARCHAR(80) NOT NULL,
      public_id VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      product_id VARCHAR(160) NOT NULL,
      link_type ENUM('public','qr','embed','email') NOT NULL DEFAULT 'public',
      slug VARCHAR(120) NULL,
      token VARCHAR(64) NOT NULL,
      destination_url TEXT NOT NULL,
      status ENUM('active','expired','archived','disabled') NOT NULL DEFAULT 'active',
      expires_at DATETIME NULL,
      password_hash VARCHAR(255) NULL,
      allowed_domains_json JSON NULL,
      viewer_config_json JSON NULL,
      view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      qr_scan_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_share_links_uid (share_uid),
      UNIQUE KEY uq_share_links_public (public_id),
      UNIQUE KEY uq_share_links_token (token),
      INDEX idx_share_links_customer_status (customer_uid, status),
      INDEX idx_share_links_product (product_id),
      INDEX idx_share_links_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS share_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      share_link_id BIGINT UNSIGNED NOT NULL,
      share_uid VARCHAR(80) NOT NULL DEFAULT '',
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      product_id VARCHAR(160) NOT NULL DEFAULT '',
      event_type VARCHAR(40) NOT NULL,
      anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
      referrer VARCHAR(255) NOT NULL DEFAULT '',
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      duration_seconds INT UNSIGNED NULL,
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_share_events_share_created (share_link_id, created_at),
      INDEX idx_share_events_customer_created (customer_uid, created_at),
      INDEX idx_share_events_product_created (product_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS qr_scan_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      qr_code_id BIGINT UNSIGNED NOT NULL,
      qr_uid VARCHAR(64) NOT NULL DEFAULT '',
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      product_id VARCHAR(160) NOT NULL DEFAULT '',
      anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      source VARCHAR(40) NOT NULL DEFAULT 'qr',
      referrer VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_qr_scan_events_qr_created (qr_code_id, created_at),
      INDEX idx_qr_scan_events_customer_created (customer_uid, created_at),
      INDEX idx_qr_scan_events_session_qr (anonymous_session_id, qr_code_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      payment_method_uid VARCHAR(80) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      provider_customer_id VARCHAR(191) NULL,
      provider_payment_method_id VARCHAR(191) NOT NULL,
      brand VARCHAR(32) NOT NULL DEFAULT '',
      last_four VARCHAR(4) NOT NULL DEFAULT '',
      exp_month TINYINT UNSIGNED NULL,
      exp_year SMALLINT UNSIGNED NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      status ENUM('active','expired','removed') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_payment_methods_uid (payment_method_uid),
      INDEX idx_payment_methods_customer_default (customer_uid, is_default),
      INDEX idx_payment_methods_provider_ref (provider, provider_payment_method_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await r("products","tags","JSON NULL"),await r("products","deleted_at","DATETIME NULL"),await r("products","archived_at","DATETIME NULL"),await r("products","processing_error","VARCHAR(512) NULL"),await r("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await r("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await r("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await r("product_qr_codes","expires_at","DATETIME NULL"),await r("product_qr_codes","deleted_at","DATETIME NULL"),await r("product_qr_codes","style_json","JSON NULL"),await (0,t.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await a("product_qr_codes","uq_product_qr_product"),await i("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await i("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await i("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await i("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await i("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await r("product_qr_codes","qr_code","VARCHAR(16) NULL"),await r("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("product_qr_codes","last_scan_at","DATETIME NULL"),await r("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("share_links","link_name","VARCHAR(160) NULL"),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS qr_code_sequence (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      next_val INT UNSIGNED NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)("INSERT IGNORE INTO qr_code_sequence (id, next_val) VALUES (1, 1)"),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS product_embed_configs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      product_id VARCHAR(160) NOT NULL,
      public_id VARCHAR(180) NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      allowed_domains_json JSON NULL,
      view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
      last_view_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_embed_product (product_id),
      INDEX idx_embed_customer (customer_uid),
      INDEX idx_embed_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS embed_view_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      embed_config_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      product_id VARCHAR(160) NOT NULL,
      anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
      referrer_domain VARCHAR(255) NOT NULL DEFAULT '',
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      duration_seconds INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_embed_events_config (embed_config_id, created_at),
      INDEX idx_embed_events_customer (customer_uid, created_at),
      INDEX idx_embed_events_product (product_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await i("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,s])},853663,e=>{"use strict";var t=e.i(254799);let r=["facebook","twitter","instagram","tiktok","linkedin","pinterest","youtube","snapchat","reddit","whatsapp"];function i(e){return e.toISOString().slice(0,10)}e.s(["buildDateRange",0,function(e,t){let r=new Date,a=t??i(r);return{fromDate:e??i(new Date(r.getTime()-25056e5)),toDate:a}},"classifyReferrer",0,function(e,t){if(!e||""===e){try{let e=new URL(t),r=e.searchParams.get("utm_source");if(r)return r.toLowerCase();let i=e.searchParams.get("ref");if("qr"===i)return"qr"}catch{}return"direct"}try{let t=new URL(e).hostname.toLowerCase();if(r.some(e=>t.includes(e)))return"social";if(t.includes("google")||t.includes("bing")||t.includes("yahoo"))return"search";return t}catch{return"direct"}},"extractIp",0,function(e){let t=e.headers.get("x-forwarded-for");return t?t.split(",")[0].trim():e.headers.get("x-real-ip")??"unknown"},"hashIp",0,function(e){return(0,t.createHash)("sha256").update(e+(process.env.AUTH_SECRET??"ar360")).digest("hex").slice(0,32)},"parseBrowser",0,function(e){return/SamsungBrowser/i.test(e)?"Samsung Internet":/Edg\//i.test(e)?"Edge":/OPR\/|Opera/i.test(e)?"Opera":/Firefox/i.test(e)?"Firefox":/Chrome/i.test(e)&&!/Chromium/i.test(e)?"Chrome":/Safari/i.test(e)?"Safari":"unknown"},"parseDevice",0,function(e){let t=e.toLowerCase();return/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(t)?"tablet":/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(t)?"mobile":/windows|macintosh|linux|cros/i.test(t)?"desktop":"unknown"},"parseOS",0,function(e){return/iPhone|iPad|iPod/i.test(e)?"iOS":/Android/i.test(e)?"Android":/Windows/i.test(e)?"Windows":/Macintosh|Mac OS X/i.test(e)?"macOS":/CrOS/i.test(e)?"ChromeOS":/Linux/i.test(e)?"Linux":"unknown"}])},240548,e=>{"use strict";var t=e.i(843793),r=e.i(232074),i=e.i(853663);async function a(e){await (0,t.ensureProductSchema)(),await (0,r.ensureUserPanelSchema)(),(await (0,t.query)("SELECT id FROM product_embed_configs WHERE product_id = ? AND customer_uid = ? LIMIT 1",[e.productId,e.customerUid])).length?await (0,t.query)("UPDATE product_embed_configs SET public_id = ?, status = 'active', updated_at = NOW() WHERE product_id = ?",[e.publicId,e.productId]):await (0,t.query)(`INSERT INTO product_embed_configs (customer_uid, user_id, product_id, public_id, status)
       VALUES (?, ?, ?, ?, 'active')`,[e.customerUid,e.userId,e.productId,e.publicId])}async function s(e){await (0,r.ensureUserPanelSchema)();let i=[e.customerUid,e.userId],a="e.customer_uid = ? AND (e.user_id = ? OR e.user_id IS NULL) AND LOWER(p.status) IN ('published','active')";return e.q?.trim()&&(a+=" AND p.title LIKE ?",i.push(`%${e.q.trim()}%`)),e.productId?.trim()&&(a+=" AND e.product_id = ?",i.push(e.productId.trim())),(await (0,t.query)(`SELECT e.*, p.title, p.poster, p.thumbnail_url
     FROM product_embed_configs e
     INNER JOIN products p ON p.id = e.product_id
     WHERE ${a}
     ORDER BY e.updated_at DESC`,i)).map(t=>{var r;let i,a,s,o=t.public_id||t.product_id,d=(r=e.origin,i=`${r}/embed/${encodeURIComponent(o)}`,a=`<iframe src="${i}" title="AR360 3D Viewer" width="100%" height="480" style="border:0;border-radius:16px;" allow="xr-spatial-tracking; gyroscope; accelerometer; magnetometer; camera; fullscreen"></iframe>`,s=`export function ProductEmbed() {
  return (
    <iframe
      src="${i}"
      title="AR360 3D Viewer"
      width="100%"
      height={480}
      style={{ border: 0, borderRadius: 16 }}
      allow="xr-spatial-tracking; gyroscope; accelerometer; magnetometer; camera; fullscreen"
    />
  );
}`,{embedUrl:i,htmlSnippet:a,reactSnippet:s,nextSnippet:`import ProductEmbed from "@/components/ProductEmbed";

// components/ProductEmbed.tsx — paste the React snippet above

export default function Page() {
  return <ProductEmbed />;
}`}),n=[];try{n=t.allowed_domains_json?JSON.parse(t.allowed_domains_json):[]}catch{n=[]}return{id:t.id,productId:t.product_id,publicId:o,status:t.status,allowedDomains:n,viewCount:Number(t.view_count||0),uniqueVisitors:Number(t.unique_visitors||0),lastViewAt:t.last_view_at,title:t.title,poster:t.poster??t.thumbnail_url??"",...d}})}async function o(e){if(!(await (0,t.query)("SELECT id FROM product_embed_configs WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL) LIMIT 1",[e.embedId,e.customerUid,e.userId])).length)return{error:"Embed config not found."};let r=[],i=[];return(e.status&&(r.push("status = ?"),i.push(e.status)),e.allowedDomains&&(r.push("allowed_domains_json = ?"),i.push(JSON.stringify(e.allowedDomains))),r.length)?(await (0,t.query)(`UPDATE product_embed_configs SET ${r.join(", ")}, updated_at = NOW() WHERE id = ?`,[...i,e.embedId]),{success:!0}):{error:"No changes."}}async function d(e){let r=e.request.headers.get("user-agent")??"",a=(0,i.parseDevice)(r),s=(0,i.parseBrowser)(r),o=e.request.headers.get("x-vercel-ip-country")??e.request.headers.get("cf-ipcountry")??"",d=(await (0,t.query)("SELECT id, customer_uid, view_count FROM product_embed_configs WHERE product_id = ? AND status = 'active' LIMIT 1",[e.productId]))[0];if(!d)return;let n=0===(await (0,t.query)("SELECT id FROM embed_view_events WHERE embed_config_id = ? AND anonymous_session_id = ? LIMIT 1",[d.id,e.sessionId])).length;await (0,t.query)("UPDATE product_embed_configs SET view_count = view_count + 1, unique_visitors = unique_visitors + ?, last_view_at = NOW() WHERE id = ?",[+!!n,d.id]),await (0,t.query)(`INSERT INTO embed_view_events (embed_config_id, customer_uid, product_id, anonymous_session_id, referrer_domain, device, browser, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[d.id,d.customer_uid,e.productId,e.sessionId,e.referrerDomain||"",a,s,o])}e.s(["ensureEmbedConfig",0,a,"listCustomerEmbeds",0,s,"trackEmbedView",0,d,"updateEmbedConfig",0,o])},153067,e=>{"use strict";var t=e.i(747909),r=e.i(174017),i=e.i(996250),a=e.i(759756),s=e.i(561916),o=e.i(174677),d=e.i(869741),n=e.i(316795),u=e.i(487718),c=e.i(995169),_=e.i(47587),N=e.i(666012),E=e.i(570101),T=e.i(626937),L=e.i(10372),A=e.i(193695);e.i(52474);var p=e.i(600220),l=e.i(89171),U=e.i(240548);async function R(e){let t=await e.json().catch(()=>({})),r=String(t.productId||"").trim(),i=String(t.sessionId||`embed-${Date.now()}`).trim(),a=String(t.referrerDomain||"").trim();return r?(await (0,U.trackEmbedView)({productId:r,sessionId:i,request:e,referrerDomain:a}),l.NextResponse.json({success:!0})):l.NextResponse.json({error:"productId required"},{status:400})}e.s(["POST",0,R,"dynamic",0,"force-dynamic","runtime",0,"nodejs"],375159);var m=e.i(375159);let I=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/embed/track/route",pathname:"/api/embed/track",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/embed/track/route.ts",nextConfigOutput:"standalone",userland:m,...{}}),{workAsyncStorage:D,workUnitAsyncStorage:O,serverHooks:C}=I;async function f(e,t,i){i.requestMeta&&(0,a.setRequestMeta)(e,i.requestMeta),I.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let l="/api/embed/track/route";l=l.replace(/\/index$/,"")||"/";let U=await I.prepare(e,t,{srcPage:l,multiZoneDraftMode:!1});if(!U)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:R,deploymentId:m,params:D,nextConfig:O,parsedUrl:C,isDraftMode:f,prerenderManifest:h,routerServerContext:S,isOnDemandRevalidate:w,revalidateOnlyGenerated:b,resolvedPathname:x,clientReferenceManifest:q,serverActionsManifest:v}=U,M=(0,d.normalizeAppPath)(l),g=!!(h.dynamicRoutes[M]||h.routes[x]),y=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,C,!1):t.end("This page could not be found"),null);if(g&&!f){let e=!!h.routes[x],t=h.dynamicRoutes[M];if(t&&!1===t.fallback&&!e){if(O.adapterPath)return await y();throw new A.NoFallbackError}}let F=null;!g||I.isDev||f||(F="/index"===(F=x)?"/":F);let H=!0===I.isDev||!g,P=g&&!H;v&&q&&(0,o.setManifestsSingleton)({page:l,clientReferenceManifest:q,serverActionsManifest:v});let V=e.method||"GET",k=(0,s.getTracer)(),B=k.getActiveScopeSpan(),G=!!(null==S?void 0:S.isWrappedByNextServer),X=!!(0,a.getRequestMeta)(e,"minimalMode"),j=(0,a.getRequestMeta)(e,"incrementalCache")||await I.getIncrementalCache(e,O,h,X);null==j||j.resetRequestCache(),globalThis.__incrementalCache=j;let Y={params:D,previewProps:h.preview,renderOpts:{experimental:{authInterrupts:!!O.experimental.authInterrupts},cacheComponents:!!O.cacheComponents,supportsDynamicResponse:H,incrementalCache:j,cacheLifeProfiles:O.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,i,a)=>I.onRequestError(e,t,i,a,S)},sharedContext:{buildId:R,deploymentId:m}},K=new n.NodeNextRequest(e),W=new n.NodeNextResponse(t),$=u.NextRequestAdapter.fromNodeNextRequest(K,(0,u.signalFromNodeResponse)(t));try{let a,o=async e=>I.handle($,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=k.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=r.get("next.route");if(i){let t=`${V} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",i),a.updateName(t))}else e.updateName(`${V} ${l}`)}),d=async a=>{var s,d;let n=async({previousCacheEntry:r})=>{try{if(!X&&w&&b&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await o(a);e.fetchMetrics=Y.renderOpts.fetchMetrics;let d=Y.renderOpts.pendingWaitUntil;d&&i.waitUntil&&(i.waitUntil(d),d=void 0);let n=Y.renderOpts.collectedTags;if(!g)return await (0,N.sendResponse)(K,W,s,Y.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,E.toNodeOutgoingHttpHeaders)(s.headers);n&&(t[L.NEXT_CACHE_TAGS_HEADER]=n),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=L.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,i=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=L.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:p.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:i}}}}catch(t){throw(null==r?void 0:r.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:l,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:w})},!1,S),t}},u=await I.handleResponse({req:e,nextConfig:O,cacheKey:F,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:h,isRoutePPREnabled:!1,isOnDemandRevalidate:w,revalidateOnlyGenerated:b,responseGenerator:n,waitUntil:i.waitUntil,isMinimalMode:X});if(!g)return null;if((null==u||null==(s=u.value)?void 0:s.kind)!==p.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(d=u.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});X||t.setHeader("x-nextjs-cache",w?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),f&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,E.fromNodeOutgoingHttpHeaders)(u.value.headers);return X&&g||c.delete(L.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,T.getCacheControlHeader)(u.cacheControl)),await (0,N.sendResponse)(K,W,new Response(u.value.body,{headers:c,status:u.value.status||200})),null};G&&B?await d(B):(a=k.getActiveScopeSpan(),await k.withPropagatedContext(e.headers,()=>k.trace(c.BaseServerSpan.handleRequest,{spanName:`${V} ${l}`,kind:s.SpanKind.SERVER,attributes:{"http.method":V,"http.target":e.url}},d),void 0,!G))}catch(t){if(t instanceof A.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:M,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:w})},!1,S),g)throw t;return await (0,N.sendResponse)(K,W,new Response(null,{status:500})),null}}e.s(["handler",0,f,"patchFetch",0,function(){return(0,i.patchFetch)({workAsyncStorage:D,workUnitAsyncStorage:O})},"routeModule",0,I,"serverHooks",0,C,"workAsyncStorage",0,D,"workUnitAsyncStorage",0,O],153067)},778359,e=>{e.v(e=>Promise.resolve().then(()=>e(232074)))},578878,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_account_schema_ts_1j3_dqb._.js"].map(t=>e.l(t))).then(()=>t(540312)))},573857,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_enterprise_schema_ts_1jy6kif._.js"].map(t=>e.l(t))).then(()=>t(16006)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0pfe6t7._.js.map