import { todayKST } from "@/lib/date";
import { summarizeGoal } from "@/lib/goal";
import { fail, ok, parseId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { loadDailySeconds, serializeGoal } from "@/lib/queries";

export async function POST(_request: Request, ctx: RouteContext<"/api/goals/[id]/settle">) {
  const id = parseId((await ctx.params).id);
  if (!id) return fail("잘못된 목표 ID입니다");

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return fail("목표를 찾을 수 없습니다", 404);
  if (goal.status !== "FAILED") return fail("미달성 목표만 정산할 수 있습니다", 409);
  if (goal.settledAt) return fail("이미 정산된 목표입니다", 409);

  const updated = await prisma.goal.update({ where: { id }, data: { settledAt: new Date() } });
  const daily = (await loadDailySeconds([updated.userId])).get(updated.userId)!;
  return ok({ goal: summarizeGoal(serializeGoal(updated), daily, todayKST()) });
}
