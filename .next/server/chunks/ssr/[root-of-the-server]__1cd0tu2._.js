module.exports=[427699,(a,b,c)=>{b.exports=a.x("events",()=>require("events"))},677652,(a,b,c)=>{b.exports=a.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},504446,(a,b,c)=>{b.exports=a.x("net",()=>require("net"))},792509,(a,b,c)=>{b.exports=a.x("url",()=>require("url"))},688947,(a,b,c)=>{b.exports=a.x("stream",()=>require("stream"))},500874,(a,b,c)=>{b.exports=a.x("buffer",()=>require("buffer"))},406461,(a,b,c)=>{b.exports=a.x("zlib",()=>require("zlib"))},254799,(a,b,c)=>{b.exports=a.x("crypto",()=>require("crypto"))},951615,(a,b,c)=>{b.exports=a.x("node:buffer",()=>require("node:buffer"))},605365,(a,b,c)=>{b.exports=a.x("process",()=>require("process"))},755004,(a,b,c)=>{b.exports=a.x("tls",()=>require("tls"))},137464,(a,b,c)=>{b.exports=a.x("timers",()=>require("timers"))},99348,(a,b,c)=>{b.exports=a.x("string_decoder",()=>require("string_decoder"))},193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},950640,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"InvariantError",{enumerable:!0,get:function(){return d}});class d extends Error{constructor(a,b){super(`Invariant: ${a.endsWith(".")?a:a+"."} This is a bug in Next.js.`,b),this.name="InvariantError"}}},603885,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"normalizeLocalePath",{enumerable:!0,get:function(){return e}});let d=new WeakMap;function e(a,b){let c;if(!b)return{pathname:a};let e=d.get(b);e||(e=b.map(a=>a.toLowerCase()),d.set(b,e));let f=a.split("/",2);if(!f[1])return{pathname:a};let g=f[1].toLowerCase(),h=e.indexOf(g);return h<0?{pathname:a}:(c=b[h],{pathname:a=a.slice(c.length+1)||"/",detectedLocale:c})}},299870,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={ACTION_SUFFIX:function(){return q},APP_DIR_ALIAS:function(){return P},CACHE_ONE_YEAR_SECONDS:function(){return F},DOT_NEXT_ALIAS:function(){return N},ESLINT_DEFAULT_DIRS:function(){return ah},GSP_NO_RETURNED_VALUE:function(){return ab},GSSP_COMPONENT_MEMBER_ERROR:function(){return ae},GSSP_NO_RETURNED_VALUE:function(){return ac},HTML_CONTENT_TYPE_HEADER:function(){return g},INFINITE_CACHE:function(){return G},INSTRUMENTATION_HOOK_FILENAME:function(){return L},JSON_CONTENT_TYPE_HEADER:function(){return h},MATCHED_PATH_HEADER:function(){return k},MIDDLEWARE_FILENAME:function(){return H},MIDDLEWARE_LOCATION_REGEXP:function(){return I},NEXT_BODY_SUFFIX:function(){return t},NEXT_CACHE_IMPLICIT_TAG_ID:function(){return D},NEXT_CACHE_REVALIDATED_TAGS_HEADER:function(){return w},NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER:function(){return x},NEXT_CACHE_ROOT_PARAM_TAG_ID:function(){return E},NEXT_CACHE_SOFT_TAG_MAX_LENGTH:function(){return C},NEXT_CACHE_TAGS_HEADER:function(){return v},NEXT_CACHE_TAG_MAX_ITEMS:function(){return A},NEXT_CACHE_TAG_MAX_LENGTH:function(){return B},NEXT_DATA_SUFFIX:function(){return r},NEXT_INTERCEPTION_MARKER_PREFIX:function(){return j},NEXT_META_SUFFIX:function(){return s},NEXT_NAV_DEPLOYMENT_ID_HEADER:function(){return u},NEXT_QUERY_PARAM_PREFIX:function(){return i},NEXT_RESUME_HEADER:function(){return y},NEXT_RESUME_STATE_LENGTH_HEADER:function(){return z},NON_STANDARD_NODE_ENV:function(){return af},PAGES_DIR_ALIAS:function(){return M},PRERENDER_REVALIDATE_HEADER:function(){return l},PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER:function(){return m},PROXY_FILENAME:function(){return J},PROXY_LOCATION_REGEXP:function(){return K},PUBLIC_DIR_MIDDLEWARE_CONFLICT:function(){return X},ROOT_DIR_ALIAS:function(){return O},RSC_ACTION_CLIENT_WRAPPER_ALIAS:function(){return W},RSC_ACTION_ENCRYPTION_ALIAS:function(){return V},RSC_ACTION_PROXY_ALIAS:function(){return S},RSC_ACTION_VALIDATE_ALIAS:function(){return R},RSC_CACHE_WRAPPER_ALIAS:function(){return T},RSC_DYNAMIC_IMPORT_WRAPPER_ALIAS:function(){return U},RSC_MOD_REF_PROXY_ALIAS:function(){return Q},RSC_SEGMENTS_DIR_SUFFIX:function(){return n},RSC_SEGMENT_SUFFIX:function(){return o},RSC_SUFFIX:function(){return p},SERVER_PROPS_EXPORT_ERROR:function(){return aa},SERVER_PROPS_GET_INIT_PROPS_CONFLICT:function(){return Z},SERVER_PROPS_SSG_CONFLICT:function(){return $},SERVER_RUNTIME:function(){return ai},SSG_FALLBACK_EXPORT_ERROR:function(){return ag},SSG_GET_INITIAL_PROPS_CONFLICT:function(){return Y},STATIC_STATUS_PAGE_GET_INITIAL_PROPS_ERROR:function(){return _},TEXT_PLAIN_CONTENT_TYPE_HEADER:function(){return f},UNSTABLE_REVALIDATE_RENAME_ERROR:function(){return ad},WEBPACK_LAYERS:function(){return al},WEBPACK_RESOURCE_QUERIES:function(){return am},WEB_SOCKET_MAX_RECONNECTIONS:function(){return aj}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f="text/plain",g="text/html; charset=utf-8",h="application/json; charset=utf-8",i="nxtP",j="nxtI",k="x-matched-path",l="x-prerender-revalidate",m="x-prerender-revalidate-if-generated",n=".segments",o=".segment.rsc",p=".rsc",q=".action",r=".json",s=".meta",t=".body",u="x-nextjs-deployment-id",v="x-next-cache-tags",w="x-next-revalidated-tags",x="x-next-revalidate-tag-token",y="next-resume",z="x-next-resume-state-length",A=128,B=256,C=1024,D="_N_T_",E="_N_RP_",F=31536e3,G=0xfffffffe,H="middleware",I=`(?:src/)?${H}`,J="proxy",K=`(?:src/)?${J}`,L="instrumentation",M="private-next-pages",N="private-dot-next",O="private-next-root-dir",P="private-next-app-dir",Q="private-next-rsc-mod-ref-proxy",R="private-next-rsc-action-validate",S="private-next-rsc-server-reference",T="private-next-rsc-cache-wrapper",U="private-next-rsc-track-dynamic-import",V="private-next-rsc-action-encryption",W="private-next-rsc-action-client-wrapper",X="You can not have a '_next' folder inside of your public folder. This conflicts with the internal '/_next' route. https://nextjs.org/docs/messages/public-next-folder-conflict",Y="You can not use getInitialProps with getStaticProps. To use SSG, please remove your getInitialProps",Z="You can not use getInitialProps with getServerSideProps. Please remove getInitialProps.",$="You can not use getStaticProps or getStaticPaths with getServerSideProps. To use SSG, please remove getServerSideProps",_="can not have getInitialProps/getServerSideProps, https://nextjs.org/docs/messages/404-get-initial-props",aa="pages with `getServerSideProps` can not be exported. See more info here: https://nextjs.org/docs/messages/gssp-export",ab="Your `getStaticProps` function did not return an object. Did you forget to add a `return`?",ac="Your `getServerSideProps` function did not return an object. Did you forget to add a `return`?",ad="The `unstable_revalidate` property is available for general use.\nPlease use `revalidate` instead.",ae="can not be attached to a page's component and must be exported from the page. See more info here: https://nextjs.org/docs/messages/gssp-component-member",af='You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env',ag="Pages with `fallback` enabled in `getStaticPaths` can not be exported. See more info here: https://nextjs.org/docs/messages/ssg-fallback-true-export",ah=["app","pages","components","lib","src"],ai={edge:"edge",experimentalEdge:"experimental-edge",nodejs:"nodejs"},aj=12,ak={shared:"shared",reactServerComponents:"rsc",serverSideRendering:"ssr",actionBrowser:"action-browser",apiNode:"api-node",apiEdge:"api-edge",middleware:"middleware",instrument:"instrument",edgeAsset:"edge-asset",appPagesBrowser:"app-pages-browser",pagesDirBrowser:"pages-dir-browser",pagesDirEdge:"pages-dir-edge",pagesDirNode:"pages-dir-node"},al={...ak,GROUP:{builtinReact:[ak.reactServerComponents,ak.actionBrowser],serverOnly:[ak.reactServerComponents,ak.actionBrowser,ak.instrument,ak.middleware],neutralTarget:[ak.apiNode,ak.apiEdge],clientOnly:[ak.serverSideRendering,ak.appPagesBrowser],bundled:[ak.reactServerComponents,ak.actionBrowser,ak.serverSideRendering,ak.appPagesBrowser,ak.shared,ak.instrument,ak.middleware],appPages:[ak.reactServerComponents,ak.serverSideRendering,ak.appPagesBrowser,ak.actionBrowser]}},am={edgeSSREntry:"__next_edge_ssr_entry__",metadata:"__next_metadata__",metadataRoute:"__next_metadata_route__",metadataImageMeta:"__next_metadata_image_meta__"}},374993,(a,b,c)=>{"use strict";function d(a){return a.replace(/\/$/,"")||"/"}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"removeTrailingSlash",{enumerable:!0,get:function(){return d}})},392273,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={fromNodeOutgoingHttpHeaders:function(){return g},normalizeNextQueryParam:function(){return k},splitCookiesString:function(){return h},toNodeOutgoingHttpHeaders:function(){return i},validateURL:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(299870);function g(a){let b=new Headers;for(let[c,d]of Object.entries(a))for(let a of Array.isArray(d)?d:[d])void 0!==a&&("number"==typeof a&&(a=a.toString()),b.append(c,a));return b}function h(a){var b,c,d,e,f,g=[],h=0;function i(){for(;h<a.length&&/\s/.test(a.charAt(h));)h+=1;return h<a.length}for(;h<a.length;){for(b=h,f=!1;i();)if(","===(c=a.charAt(h))){for(d=h,h+=1,i(),e=h;h<a.length&&"="!==(c=a.charAt(h))&&";"!==c&&","!==c;)h+=1;h<a.length&&"="===a.charAt(h)?(f=!0,h=e,g.push(a.substring(b,d)),b=h):h=d+1}else h+=1;(!f||h>=a.length)&&g.push(a.substring(b,a.length))}return g}function i(a){let b={},c=[];if(a)for(let[d,e]of a.entries())"set-cookie"===d.toLowerCase()?(c.push(...h(e)),b[d]=1===c.length?c[0]:c):b[d]=e;return b}function j(a){try{return String(new URL(String(a)))}catch(b){throw Object.defineProperty(Error(`URL is malformed "${String(a)}". Please use only absolute URLs - https://nextjs.org/docs/messages/middleware-relative-urls`,{cause:b}),"__NEXT_ERROR_CODE",{value:"E61",enumerable:!1,configurable:!0})}}function k(a){for(let b of[f.NEXT_QUERY_PARAM_PREFIX,f.NEXT_INTERCEPTION_MARKER_PREFIX])if(a!==b&&a.startsWith(b))return a.substring(b.length);return null}},408309,a=>{"use strict";var b=a.i(761469);async function c(a,c,d){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;let[{total:f=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[a,c]);0===Number(f)&&await (0,b.query)(`ALTER TABLE \`${a.replace(/`/g,"``")}\` ADD COLUMN \`${c.replace(/`/g,"``")}\` ${d}`)}async function d(a,c,d){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;let[{total:f=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[a,c]);0===Number(f)&&await (0,b.query)(d)}async function e(a,c){let d=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===d||"1"===d||"false"!==d&&"0"!==d)return;let[{total:e=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[a,c]);Number(e)>0&&await (0,b.query)(`ALTER TABLE \`${a.replace(/`/g,"``")}\` DROP INDEX \`${c.replace(/`/g,"``")}\``)}async function f(){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;await (0,b.query)(`
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
  `);let[f]=await (0,b.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!f||f.COLUMN_TYPE.includes("'welcome'")&&f.COLUMN_TYPE.includes("'bandwidth'")||await (0,b.query)(`ALTER TABLE customer_notifications
       MODIFY COLUMN category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome')
       NOT NULL DEFAULT 'system'`),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await c("products","tags","JSON NULL"),await c("products","deleted_at","DATETIME NULL"),await c("products","archived_at","DATETIME NULL"),await c("products","processing_error","VARCHAR(512) NULL"),await c("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await c("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await c("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await c("product_qr_codes","expires_at","DATETIME NULL"),await c("product_qr_codes","deleted_at","DATETIME NULL"),await c("product_qr_codes","style_json","JSON NULL"),await (0,b.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await e("product_qr_codes","uq_product_qr_product"),await d("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await d("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await d("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await d("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await d("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await c("product_qr_codes","qr_code","VARCHAR(16) NULL"),await c("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await c("product_qr_codes","last_scan_at","DATETIME NULL"),await c("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await c("share_links","link_name","VARCHAR(160) NULL"),await (0,b.query)(`
    CREATE TABLE IF NOT EXISTS qr_code_sequence (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      next_val INT UNSIGNED NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,b.query)("INSERT IGNORE INTO qr_code_sequence (id, next_val) VALUES (1, 1)"),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await d("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}a.s(["ensureUserPanelSchema",0,f])},895710,a=>{"use strict";a.i(254799),a.s(["parseBrowser",0,function(a){return/SamsungBrowser/i.test(a)?"Samsung Internet":/Edg\//i.test(a)?"Edge":/OPR\/|Opera/i.test(a)?"Opera":/Firefox/i.test(a)?"Firefox":/Chrome/i.test(a)&&!/Chromium/i.test(a)?"Chrome":/Safari/i.test(a)?"Safari":"unknown"},"parseDevice",0,function(a){let b=a.toLowerCase();return/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(b)?"tablet":/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(b)?"mobile":/windows|macintosh|linux|cros/i.test(b)?"desktop":"unknown"}])},525333,a=>{a.v("/_next/static/media/icon.42008p6-7up3y.png"+(globalThis.NEXT_CLIENT_ASSET_SUFFIX||""))},821646,a=>{"use strict";let b={src:a.i(525333).default,width:32,height:32};a.s(["default",0,b])},110585,a=>{a.v("/_next/static/media/favicon.2vob68tjqpejf.ico"+(globalThis.NEXT_CLIENT_ASSET_SUFFIX||""))},68611,a=>{"use strict";let b={src:a.i(110585).default,width:256,height:256};a.s(["default",0,b])},737769,a=>{a.v("/_next/static/media/apple-icon.0ognl8g_4k1b9.png"+(globalThis.NEXT_CLIENT_ASSET_SUFFIX||""))},809361,a=>{"use strict";let b={src:a.i(737769).default,width:180,height:180};a.s(["default",0,b])},733231,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/src/components/features/viewer/EmbedViewerPage.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/components/features/viewer/EmbedViewerPage.tsx <module evaluation>","default")},785668,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/src/components/features/viewer/EmbedViewerPage.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/components/features/viewer/EmbedViewerPage.tsx","default")},248501,a=>{"use strict";a.i(733231);var b=a.i(785668);a.n(b)},623584,a=>{"use strict";var b=a.i(907997),c=a.i(800717),d=a.i(905246),e=a.i(248501),f=a.i(761469),g=a.i(408309);async function h(a){await (0,g.ensureUserPanelSchema)();let b=String(a||"").trim();if(!b)return[];let c=await (0,f.query)(`SELECT allowed_domains_json FROM product_embed_configs
      WHERE (product_id = ? OR public_id = ?) AND status = 'active'
      LIMIT 1`,[b,b]);if(!c[0])return[];try{let a=c[0].allowed_domains_json?JSON.parse(c[0].allowed_domains_json):[];return Array.isArray(a)?a.map(String):[]}catch{return[]}}async function i(a,b){var c=await h(a);if(!c.length)return!0;try{let a=b?new URL(b).hostname:"";if(!a)return!1;return c.some(b=>{let c=String(b||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"");return!!c&&(a===c||a.endsWith(`.${c}`))})}catch{return!1}}async function j({params:a}){let{id:f}=await a,g=await (0,d.headers)(),h=g.get("referer")||g.get("referrer")||"";return await i(f,h).catch(()=>!0)?(0,b.jsx)(c.Suspense,{fallback:(0,b.jsx)("main",{className:"grid h-screen w-screen place-items-center bg-white",children:(0,b.jsx)("div",{className:"h-12 w-12 animate-pulse rounded-2xl bg-slate-100"})}),children:(0,b.jsx)(e.default,{})}):(0,b.jsx)("main",{className:"grid h-screen w-screen place-items-center bg-white p-6 text-slate-950",children:(0,b.jsxs)("div",{className:"text-center",children:[(0,b.jsx)("h1",{className:"text-2xl font-black",children:"Embed blocked"}),(0,b.jsx)("p",{className:"mt-2 max-w-sm text-sm text-slate-500",children:"This site is not on the allowlist for this embed. Ask the product owner to add your domain."})]})})}a.i(895710),a.s(["default",0,j],623584)},138410,a=>{a.n(a.i(623584))},50300,a=>{a.v(a=>Promise.resolve().then(()=>a(408309)))},18167,a=>{a.v(b=>Promise.all(["server/chunks/ssr/src_lib_account_schema_ts_0cdk5--._.js"].map(b=>a.l(b))).then(()=>b(41768)))},467105,a=>{a.v(b=>Promise.all(["server/chunks/ssr/src_lib_enterprise_schema_ts_1m13o2y._.js"].map(b=>a.l(b))).then(()=>b(51652)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1cd0tu2._.js.map