import type { Metadata, Viewport } from "next";
import { Outfit, Instrument_Sans } from "next/font/google";
import "./globals.css";
import CsrfFetchInterceptor from "@/components/auth/CsrfFetchInterceptor";

const authDisplay = Outfit({
  subsets: ["latin"],
  variable: "--font-auth-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const authBody = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-auth-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AR360",
  description: "Premium 3D / AR product experience",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/favicon-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141517",
};

import DynamicDesignSystem from "@/components/landing/DynamicDesignSystem";
import WebPresenceTracker from "@/components/analytics/WebPresenceTracker";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-portal-theme="lime" suppressHydrationWarning className={`${authDisplay.variable} ${authBody.variable}`}>
      <head>
        <DynamicDesignSystem />
      </head>
      <body
        className="font-[family-name:var(--font-auth-body)] antialiased"
        suppressHydrationWarning
      >
        <CsrfFetchInterceptor />
        <WebPresenceTracker />
        {children}
      </body>
    </html>
  );
}
