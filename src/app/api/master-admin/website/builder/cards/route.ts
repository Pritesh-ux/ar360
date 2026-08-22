import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const sectionUid = new URL(req.url).searchParams.get("section_uid");
    const cards = sectionUid
      ? await query<any>(
          "SELECT * FROM website_cards WHERE section_uid = ? ORDER BY sort_order ASC, id ASC",
          [sectionUid],
        )
      : await query<any>("SELECT * FROM website_cards ORDER BY section_uid ASC, sort_order ASC, id ASC");
    return NextResponse.json({ success: true, cards });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json();
    const { action, card_uid, section_uid, title, description, image_path, glb_path, button_label, button_link, features, sort_order, visibility } = body;

    if (action === "delete") {
      if (!card_uid) {
        return NextResponse.json({ error: "Card UID required for delete." }, { status: 400 });
      }
      await query("DELETE FROM website_cards WHERE card_uid = ?", [card_uid]);
      await logAdminAudit(admin, "website.card.delete", "website_card", card_uid);
      return NextResponse.json({ success: true, message: "Card deleted successfully." });
    }

    if (card_uid) {
      await query(
        `UPDATE website_cards SET 
          section_uid = ?, 
          title = ?, 
          description = ?, 
          image_path = ?, 
          glb_path = ?, 
          button_label = ?, 
          button_link = ?, 
          features = ?, 
          sort_order = ?, 
          visibility = ? 
        WHERE card_uid = ?`,
        [section_uid, title, description, image_path || null, glb_path || null, button_label || null, button_link || null, features ? JSON.stringify(features) : null, Number(sort_order || 0), visibility ? 1 : 0, card_uid]
      );
    } else {
      const newUid = `wcard_${crypto.randomBytes(16).toString("hex")}`;
      await query(
        "INSERT INTO website_cards (card_uid, section_uid, title, description, image_path, glb_path, button_label, button_link, features, sort_order, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newUid, section_uid, title, description, image_path || null, glb_path || null, button_label || null, button_link || null, features ? JSON.stringify(features) : null, Number(sort_order || 0), visibility ? 1 : 0]
      );
    }

    await logAdminAudit(admin, "website.card.save", "website_card", card_uid || section_uid || null, { action });
    return NextResponse.json({ success: true, message: "Card saved successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
