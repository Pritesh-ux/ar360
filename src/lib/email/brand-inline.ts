import fs from "fs";
import path from "path";
import { AR360_EMAIL_LOGO_CID, emailWordmarkPublicPath } from "@/lib/brand/ar360-logo";

type Tone = "light" | "dark";

export type InlineEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
  contentDisposition: "inline";
};

function resolvePublicFile(relPublicPath: string): string | null {
  const cleaned = relPublicPath.replace(/^\//, "");
  const candidates = [
    path.join(process.cwd(), "public", cleaned),
    path.join(process.cwd(), cleaned),
    path.join(process.cwd(), ".next", "standalone", "public", cleaned),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** Load the AR360 email wordmark for CID embedding. */
export function loadAr360EmailLogoAttachment(tone: Tone = "dark"): InlineEmailAttachment | null {
  const file = resolvePublicFile(emailWordmarkPublicPath(tone));
  if (!file) return null;
  try {
    return {
      filename: path.basename(file),
      content: fs.readFileSync(file),
      contentType: "image/png",
      cid: AR360_EMAIL_LOGO_CID,
      contentDisposition: "inline",
    };
  } catch {
    return null;
  }
}

export function htmlNeedsAr360EmailLogo(html?: string | null) {
  if (!html) return false;
  return html.includes(`cid:${AR360_EMAIL_LOGO_CID}`);
}
