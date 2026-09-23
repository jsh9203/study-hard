import { todayKST } from "@/lib/date";
import { summarizeGoal } from "@/lib/goal";
import { fail, ok, parseId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { loadDailySeconds, serializeGoal } from "@/lib/queries";

export async function GET(_request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return fail("잘못된 멤버 ID입니다");

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, color: true, createdAt: true },
  });
  if (!user) return fail("멤버를 찾을 수 없습니다", 404);

  const goals = await prisma.goal.findMany({ where: { userId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const daily = (await loadDailySeconds([id])).get(id)!;
  const today = todayKST();
  return ok({ user, goals: goals.map((g) => summarizeGoal(serializeGoal(g), daily, today)) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return fail("잘못된 멤버 ID입니다");

  const { count } = await prisma.user.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) return fail("멤버를 찾을 수 없습니다", 404);
  return ok({ ok: true });
}
