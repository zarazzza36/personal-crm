import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

// Smoke check of a deploy: 200 when the app is up and reaches the database.
export async function GET() {
  // Answer every request afresh, never from a page rendered at build time.
  await connection();

  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed: the database does not answer.", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
