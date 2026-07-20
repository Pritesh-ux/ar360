import type { Metadata } from "next";
import { Outfit, Instrument_Sans } from "next/font/google";
import "./globals.css";

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
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/brand/favicon.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-portal-theme="lime" suppressHydrationWarning className={`${authDisplay.variable} ${authBody.variable}`}>
      <body
        className="font-[family-name:var(--font-auth-body)] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
