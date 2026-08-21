import { getDatabaseSummary } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "shopping-tool",
    database: await getDatabaseSummary(),
  });
}
