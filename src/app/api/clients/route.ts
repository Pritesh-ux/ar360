import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasClientAddon } from "@/lib/billing/addons";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    // Backend Gating
    const active = await hasClientAddon(customerUid);
    if (!active) {
      return NextResponse.json({ error: "Client Management module is not active. Please upgrade." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim().toLowerCase();
    const status = String(searchParams.get("status") || "active").trim();

    let sql = "SELECT * FROM clients WHERE customer_uid = ?";
    const params: any[] = [customerUid];

    if (status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    if (q) {
      sql += " AND (LOWER(name) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(email) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY created_at DESC";

    const rows = await query(sql, params);
    return NextResponse.json({ success: true, clients: rows });
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json({ error: "Failed to fetch clients." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    // Backend Gating
    const active = await hasClientAddon(customerUid);
    if (!active) {
      return NextResponse.json({ error: "Client Management module is not active. Please upgrade." }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim() || null;
    const phone = String(body.phone || "").trim() || null;
    const companyName = String(body.companyName || "").trim() || null;
    const tags = body.tags ? JSON.stringify(body.tags) : null;

    if (!name) {
      return NextResponse.json({ error: "Client Name is required." }, { status: 400 });
    }

    const clientUid = `cli_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

    await query(
      `INSERT INTO clients (client_uid, customer_uid, name, email, phone, company_name, tags, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [clientUid, customerUid, name, email, phone, companyName, tags]
    );

    return NextResponse.json({ success: true, clientUid });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json({ error: "Failed to create client." }, { status: 500 });
  }
}
