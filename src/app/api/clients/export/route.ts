import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasClientAddon } from "@/lib/billing/addons";

export const runtime = "nodejs";

type ClientRow = {
  client_uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  tags: string | null;
  created_at: string;
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.customerUid) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const active = await hasClientAddon(user.customerUid);
    if (!active) {
      return NextResponse.json({ error: "Client Management module is not active." }, { status: 403 });
    }

    const rows = await query<ClientRow>(
      `SELECT client_uid, name, email, phone, company_name, status, tags, created_at
         FROM clients
        WHERE customer_uid = ?
        ORDER BY created_at DESC`,
      [user.customerUid],
    );

    const header = ["client_uid", "name", "email", "phone", "company_name", "status", "tags", "created_at"];
    const lines = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((key) => {
            const raw = String((row as Record<string, string | null>)[key] ?? "");
            return `"${raw.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clients-export.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/clients/export error:", error);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
