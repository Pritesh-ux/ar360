import type { NextConfig } from "next";

const ONE_YEAR_SECONDS = 31536000;

function assetProxyEnabled() {
  const mode = String(process.env.ASSET_PROXY_ENFORCE || "auto").toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  // auto: customer assets are served from storage/Customers via /api/assets
  return true;
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' blob: data: https: wss:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep pdfkit outside the Next bundle so Helvetica.afm resolves from node_modules
  // (bundling breaks __dirname → .next/.../vendor-chunks/data/Helvetica.afm).
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js"],
  outputFileTracingIncludes: {
    "/api/billing/invoices/*/download": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/master-admin/billing/invoices/*/download": ["./node_modules/pdfkit/js/data/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
    optimizePackageImports: ["lucide-react"],
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  async rewrites() {
    if (!assetProxyEnabled()) return [];

    return [
      {
        source: "/Storage/Customers/:path*",
        destination: "/api/assets/Storage/Customers/:path*",
      },
    ];
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
      {
        source: "/uploads/:path*",
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
