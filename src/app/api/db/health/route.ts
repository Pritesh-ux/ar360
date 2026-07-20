import { NextResponse } from "next/server";
import { ensureAppSchema, query } from "@/lib/db";

export async function GET() {
  try {
    await ensureAppSchema();
    const rows = await query<{ ok: number }>("SELECT 1 AS ok");

    return NextResponse.json({
      ok: rows[0]?.ok === 1,
      database: process.env.MYSQL_DATABASE || "arstudio",
      message: "MySQL connected and schema is ready.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        ok: false,
        database: process.env.MYSQL_DATABASE || "arstudio",
        message,
      },
      { status: 500 },
    );
  }
}
