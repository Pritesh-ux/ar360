import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, query } from "@/lib/db";
import { verifyWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

function internalAccessOk(req: NextRequest): boolean {
  if (verifyWorkerRequest(req)) return true;

  const expected = process.env.AR360_INTERNAL_KEY;
  if (!expected) return false;

  const provided = req.headers.get("x-ar360-internal-key") || "";
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !internalAccessOk(req)) {
    return new NextResponse(null, { status: 404 });
  }

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
