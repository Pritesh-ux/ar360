import type { NextConfig } from "next";

const ONE_YEAR_SECONDS = 31536000;

function assetProxyEnabled() {
  const mode = String(process.env.ASSET_PROXY_ENFORCE || "auto").toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  // auto: customer assets are served from storage/Customers via /api/assets
  return true;
}

/** Extra connect-src hosts (comma-separated), e.g. CDN or analytics. */
function cspConnectExtra() {
  return String(process.env.CSP_CONNECT_SRC_EXTRA || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

function buildContentSecurityPolicy() {
  const connectExtra = cspConnectExtra();
  return [
    "default-src 'self'",
    // unsafe-inline/eval still required by Next.js + model-viewer/Three workers.
    // Do NOT allow arbitrary https: script hosts.
    // checkout.js loads risk-detection from cdn.razorpay.com — must be allowlisted.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://checkout.razorpay.com https://api.razorpay.com https://cdn.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Remote product images / posters may be https:; lower XSS impact than script-src.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    [
      "connect-src 'self' blob: data:",
      "https://api.razorpay.com",
      "https://lumberjack.razorpay.com",
      "https://checkout.razorpay.com",
      "https://cdn.razorpay.com",
      "https://www.gstatic.com",
      "wss:",
      connectExtra,
    ]
      .filter(Boolean)
      .join(" "),
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep pdfkit outside the Next bundle so Helvetica.afm resolves from node_modules
  // (bundling breaks __dirname → .next/.../vendor-chunks/data/Helvetica.afm).
  // sharp ships platform-specific binaries; keep it external and install it on
  // the target machine instead of shipping the build host's native build.
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js", "sharp", "geoip-lite"],
  outputFileTracingIncludes: {
    "/api/billing/invoices/*/download": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/master-admin/billing/invoices/*/download": ["./node_modules/pdfkit/js/data/**/*"],
    // Offline IP→city DB used by Live Visitors / web analytics tracking APIs.
    "/api/web-analytics/*": ["./node_modules/geoip-lite/data/**/*"],
    "/api/web-analytics/session/end": ["./node_modules/geoip-lite/data/**/*"],
  },
  outputFileTracingExcludes: {
    "*": [
      "**/.git/**/*",
      "**/.github/**/*",
      "**/.next/cache/**/*",
      "**/node_modules/{webpack,typescript,tsx,postcss,tailwindcss,eslint,rimraf}/**/*",
      "**/node_modules/sharp/**/*",
      "**/node_modules/@img/**/*",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
    // Middleware/proxy clones request bodies (default 10MB). Large GLB uploads need more.
    proxyClientMaxBodySize: "2gb",
    optimizePackageImports: ["lucide-react"],
    // Avoid Windows/XAMPP EPERM failures from Next's dev MCP log file.
    mcpServer: false,
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  async rewrites() {
    // Next caches the public/ file listing at boot, so admin uploads written after
    // startup 404 until a restart. Serve /uploads/* from disk on every request.
    const uploadsRewrite = {
      source: "/uploads/:path*",
      destination: "/api/website/media/:path*",
    };

    if (!assetProxyEnabled()) {
      return { beforeFiles: [uploadsRewrite], afterFiles: [], fallback: [] };
    }

    return {
      beforeFiles: [uploadsRewrite],
      afterFiles: [
        {
          source: "/Storage/Customers/:path*",
          destination: "/api/assets/Storage/Customers/:path*",
        },
      ],
      fallback: [],
    };
  },

  async headers() {
    const globalHeaders = {
      source: "/:path*",
      headers: securityHeaders,
    };

    return [
      globalHeaders,
      {
        source: "/Storage/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: assetProxyEnabled()
              ? "private, max-age=3600"
              : `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          },
        ],
      },
      {
        source: "/api/assets/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "private, max-age=3600" },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          },
        ],
      },
      {
        source: "/hdr/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
