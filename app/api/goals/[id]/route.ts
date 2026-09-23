import { isYmd, toDate, todayKST } from "@/lib/date";
import { canClose, closeGoalFields, summarizeGoal, validateGoalDates, type GoalStatus } from "@/lib/goal";
import { fail, ok, parseId, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { loadDailySeconds, serializeGoal } from "@/lib/queries";

type Body = {
  status: string;
  examName: string;
  target: string;
  startDate: string;
  examDate: string;
  resultDate: string | null;
};

const CLOSE_STATUSES = ["ACHIEVED", "FAILED", "CANCELLED"] as const;

function text(value: unknown, fallback: string): string | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 50 ? trimmed : null;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/goals/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return fail("잘못된 목표 ID입니다");

  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) return fail("목표를 찾을 수 없습니다", 404);
  const record = serializeGoal(existing);

  const body = await readJson<Body>(request);
  const today = todayKST();
  const daily = (await loadDailySeconds([record.userId])).get(record.userId)!;

  // 종료 모드: 결과 체크 / 취소
  if (body.status !== undefined) {
    const status = body.status as GoalStatus;
    if (!(CLOSE_STATUSES as readonly string[]).includes(status)) return fail("종료 상태를 선택하세요");
    const error = canClose(record, status, today);
    if (error) return fail(error, 409);

    const updated = await prisma.goal.update({
      where: { id },
      data: closeGoalFields(record, status as (typeof CLOSE_STATUSES)[number], daily, today),
    });
    return ok({ goal: summarizeGoal(serializeGoal(updated), daily, today) });
  }

  // 수정 모드: 진행 중 목표만
  if (record.status !== "ACTIVE") return fail("종료된 목표는 수정할 수 없습니다", 409);

  const examName = text(body.examName, record.examName);
  if (examName === null) return fail("시험명은 1~50자로 입력하세요");
  const target = text(body.target, record.target);
  if (target === null) return fail("목표는 1~50자로 입력하세요");

  const startDate = body.startDate ?? record.startDate;
  const examDate = body.examDate ?? record.examDate;
  const dateError = validateGoalDates(startDate, examDate);
  if (dateError) return fail(dateError);

  const resultDate = body.resultDate === undefined ? record.resultDate : body.resultDate || null;
  if (resultDate !== null) {
    if (!isYmd(resultDate)) return fail("결과 발표일 형식이 올바르지 않습니다 (YYYY-MM-DD)");
    if (resultDate < examDate) return fail("결과 발표일은 시험일 이후여야 합니다");
  }

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      examName,
      target,
      startDate: toDate(startDate),
      examDate: toDate(examDate),
      resultDate: resultDate ? toDate(resultDate) : null,
    },
  });
  return ok({ goal: summarizeGoal(serializeGoal(updated), daily, today) });
}
