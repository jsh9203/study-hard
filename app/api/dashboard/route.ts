import { connection } from "next/server";
import { loadDashboard } from "@/app/dashboard-ui/load";
import { fail, ok } from "@/lib/http";

// GET /api/dashboard → { today, weekStart, weekEnd, members, totals }
export async function GET() {
  await connection();
  try {
    return ok(await loadDashboard());
  } catch (e) {
    console.error("[dashboard]", e);
    return fail("대시보드를 불러오지 못했습니다", 500);
  }
}
