import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const GET = unavailable;
export const POST = unavailable;
