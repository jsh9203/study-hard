import { isYmd, toDate, todayKST } from "@/lib/date";
import { summarizeGoal, validateGoalDates } from "@/lib/goal";
import { fail, ok, parseId, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { loadDailySeconds, serializeGoal } from "@/lib/queries";

async function findUser(ctx: RouteContext<"/api/users/[id]/goals">) {
  const id = parseId((await ctx.params).id);
  if (!id) return null;
  return prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
}

export async function GET(_request: Request, ctx: RouteContext<"/api/users/[id]/goals">) {
  const user = await findUser(ctx);
  if (!user) return fail("멤버를 찾을 수 없습니다", 404);

  const goals = await prisma.goal.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const daily = (await loadDailySeconds([user.id])).get(user.id)!;
  const today = todayKST();
  return ok({ goals: goals.map((g) => summarizeGoal(serializeGoal(g), daily, today)) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/users/[id]/goals">) {
  const user = await findUser(ctx);
  if (!user) return fail("멤버를 찾을 수 없습니다", 404);

  const body = await readJson<{
    examName: string;
    target: string;
    startDate: string;
    examDate: string;
    resultDate: string | null;
  }>(request);
  const examName = typeof body.examName === "string" ? body.examName.trim() : "";
  const target = typeof body.target === "string" ? body.target.trim() : "";
  if (!examName || examName.length > 50) return fail("시험명은 1~50자로 입력하세요");
  if (!target || target.length > 50) return fail("목표는 1~50자로 입력하세요");

  const dateError = validateGoalDates(body.startDate, body.examDate);
  if (dateError) return fail(dateError);
  const startDate = body.startDate as string;
  const examDate = body.examDate as string;

  const resultDate = body.resultDate ? body.resultDate : null;
  if (resultDate !== null) {
    if (!isYmd(resultDate)) return fail("결과 발표일 형식이 올바르지 않습니다 (YYYY-MM-DD)");
    if (resultDate < examDate) return fail("결과 발표일은 시험일 이후여야 합니다");
  }

  const active = await prisma.goal.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true } });
  if (active) return fail("이미 진행 중인 목표가 있습니다", 409);

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      examName,
      target,
      startDate: toDate(startDate),
      examDate: toDate(examDate),
      resultDate: resultDate ? toDate(resultDate) : null,
    },
  });
  const daily = (await loadDailySeconds([user.id])).get(user.id)!;
  return ok({ goal: summarizeGoal(serializeGoal(goal), daily, todayKST()) }, { status: 201 });
}
