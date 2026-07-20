module.exports=[193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},677652,(e,t,r)=>{t.exports=e.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},792509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},504446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},688947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},500874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},406461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},951615,(e,t,r)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},605365,(e,t,r)=>{t.exports=e.x("process",()=>require("process"))},755004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},137464,(e,t,r)=>{t.exports=e.x("timers",()=>require("timers"))},99348,(e,t,r)=>{t.exports=e.x("string_decoder",()=>require("string_decoder"))},522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},232074,e=>{"use strict";var t=e.i(843793);async function r(e,r,a){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:s=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,r]);0===Number(s)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${r.replace(/`/g,"``")}\` ${a}`)}async function a(e,r,a){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:s=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);0===Number(s)&&await (0,t.query)(a)}async function i(e,r){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:i=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);Number(i)>0&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${r.replace(/`/g,"``")}\``)}async function s(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,t.query)(`
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
  `),await r("products","tags","JSON NULL"),await r("products","deleted_at","DATETIME NULL"),await r("products","archived_at","DATETIME NULL"),await r("products","processing_error","VARCHAR(512) NULL"),await r("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await r("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await r("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await r("product_qr_codes","expires_at","DATETIME NULL"),await r("product_qr_codes","deleted_at","DATETIME NULL"),await r("product_qr_codes","style_json","JSON NULL"),await (0,t.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await i("product_qr_codes","uq_product_qr_product"),await a("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await a("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await a("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await a("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await a("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await r("product_qr_codes","qr_code","VARCHAR(16) NULL"),await r("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("product_qr_codes","last_scan_at","DATETIME NULL"),await r("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("share_links","link_name","VARCHAR(160) NULL"),await (0,t.query)(`
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
  `),await a("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,s])},449719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},924868,(e,t,r)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},729698,e=>{"use strict";var t=e.i(522734),r=e.i(814747);let a=r.default.resolve(process.cwd(),"storage","Customers"),i=r.default.resolve(process.cwd(),"public","Storage","Customers");function s(e){try{return t.default.readdirSync(e).length>0}catch{return!1}}e.s(["DEFAULT_STORAGE_ROOT",0,a,"LEGACY_STORAGE_ROOT",0,i,"STORAGE_PUBLIC_PREFIX",0,"/Storage/Customers","resolveStorageRoot",0,function(){let e=process.env.STORAGE_ROOT?.trim();return e?r.default.resolve(e):s(a)?a:s(i)?i:a}])},991308,e=>{"use strict";var t=e.i(747909),r=e.i(174017),a=e.i(996250),i=e.i(759756),s=e.i(561916),o=e.i(174677),d=e.i(869741),n=e.i(316795),N=e.i(487718),u=e.i(995169),_=e.i(47587),E=e.i(666012),T=e.i(570101),c=e.i(626937),L=e.i(10372),A=e.i(193695);e.i(52474);var U=e.i(600220),l=e.i(89171),p=e.i(232074),R=e.i(451457);async function I(e,t){let{publicId:r}=await t.params;await (0,p.ensureUserPanelSchema)();let a=await (0,R.getQrCodeByQrCode)(r);if(!a||"active"!==a.effectiveStatus)return l.NextResponse.redirect(new URL("/404",e.url));let i=new URL(`/qr/${encodeURIComponent(a.qrCode)}`,e.url);return l.NextResponse.redirect(i,301)}e.s(["GET",0,I,"dynamic",0,"force-dynamic","runtime",0,"nodejs"],301972);var D=e.i(301972);let O=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/q/[publicId]/route",pathname:"/q/[publicId]",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/q/[publicId]/route.ts",nextConfigOutput:"standalone",userland:D,...{}}),{workAsyncStorage:m,workUnitAsyncStorage:C,serverHooks:S}=O;async function x(e,t,a){a.requestMeta&&(0,i.setRequestMeta)(e,a.requestMeta),O.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let l="/q/[publicId]/route";l=l.replace(/\/index$/,"")||"/";let p=await O.prepare(e,t,{srcPage:l,multiZoneDraftMode:!1});if(!p)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:R,deploymentId:I,params:D,nextConfig:m,parsedUrl:C,isDraftMode:S,prerenderManifest:x,routerServerContext:f,isOnDemandRevalidate:q,revalidateOnlyGenerated:h,resolvedPathname:M,clientReferenceManifest:v,serverActionsManifest:w}=p,y=(0,d.normalizeAppPath)(l),F=!!(x.dynamicRoutes[y]||x.routes[M]),b=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,C,!1):t.end("This page could not be found"),null);if(F&&!S){let e=!!x.routes[M],t=x.dynamicRoutes[y];if(t&&!1===t.fallback&&!e){if(m.adapterPath)return await b();throw new A.NoFallbackError}}let H=null;!F||O.isDev||S||(H="/index"===(H=M)?"/":H);let g=!0===O.isDev||!F,G=F&&!g;w&&v&&(0,o.setManifestsSingleton)({page:l,clientReferenceManifest:v,serverActionsManifest:w});let P=e.method||"GET",B=(0,s.getTracer)(),V=B.getActiveScopeSpan(),k=!!(null==f?void 0:f.isWrappedByNextServer),X=!!(0,i.getRequestMeta)(e,"minimalMode"),Y=(0,i.getRequestMeta)(e,"incrementalCache")||await O.getIncrementalCache(e,m,x,X);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let K={params:D,previewProps:x.preview,renderOpts:{experimental:{authInterrupts:!!m.experimental.authInterrupts},cacheComponents:!!m.cacheComponents,supportsDynamicResponse:g,incrementalCache:Y,cacheLifeProfiles:m.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,i)=>O.onRequestError(e,t,a,i,f)},sharedContext:{buildId:R,deploymentId:I}},j=new n.NodeNextRequest(e),$=new n.NodeNextResponse(t),Q=N.NextRequestAdapter.fromNodeNextRequest(j,(0,N.signalFromNodeResponse)(t));try{let i,o=async e=>O.handle(Q,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=B.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${P} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),i&&i!==e&&(i.setAttribute("http.route",a),i.updateName(t))}else e.updateName(`${P} ${l}`)}),d=async i=>{var s,d;let n=async({previousCacheEntry:r})=>{try{if(!X&&q&&h&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await o(i);e.fetchMetrics=K.renderOpts.fetchMetrics;let d=K.renderOpts.pendingWaitUntil;d&&a.waitUntil&&(a.waitUntil(d),d=void 0);let n=K.renderOpts.collectedTags;if(!F)return await (0,E.sendResponse)(j,$,s,K.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,T.toNodeOutgoingHttpHeaders)(s.headers);n&&(t[L.NEXT_CACHE_TAGS_HEADER]=n),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=L.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,a=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=L.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:U.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await O.onRequestError(e,t,{routerKind:"App Router",routePath:l,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:G,isOnDemandRevalidate:q})},!1,f),t}},N=await O.handleResponse({req:e,nextConfig:m,cacheKey:H,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:q,revalidateOnlyGenerated:h,responseGenerator:n,waitUntil:a.waitUntil,isMinimalMode:X});if(!F)return null;if((null==N||null==(s=N.value)?void 0:s.kind)!==U.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==N||null==(d=N.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});X||t.setHeader("x-nextjs-cache",q?"REVALIDATED":N.isMiss?"MISS":N.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,T.fromNodeOutgoingHttpHeaders)(N.value.headers);return X&&F||u.delete(L.NEXT_CACHE_TAGS_HEADER),!N.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,c.getCacheControlHeader)(N.cacheControl)),await (0,E.sendResponse)(j,$,new Response(N.value.body,{headers:u,status:N.value.status||200})),null};k&&V?await d(V):(i=B.getActiveScopeSpan(),await B.withPropagatedContext(e.headers,()=>B.trace(u.BaseServerSpan.handleRequest,{spanName:`${P} ${l}`,kind:s.SpanKind.SERVER,attributes:{"http.method":P,"http.target":e.url}},d),void 0,!k))}catch(t){if(t instanceof A.NoFallbackError||await O.onRequestError(e,t,{routerKind:"App Router",routePath:y,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:G,isOnDemandRevalidate:q})},!1,f),F)throw t;return await (0,E.sendResponse)(j,$,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:C})},"routeModule",0,O,"serverHooks",0,S,"workAsyncStorage",0,m,"workUnitAsyncStorage",0,C],991308)},778359,e=>{e.v(e=>Promise.resolve().then(()=>e(232074)))},578878,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_account_schema_ts_1j3_dqb._.js"].map(t=>e.l(t))).then(()=>t(540312)))},573857,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_enterprise_schema_ts_1jy6kif._.js"].map(t=>e.l(t))).then(()=>t(16006)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0x7g9gd._.js.map