// 여러 화면이 공유하는 DB 조회 + 직렬화
import type { Goal } from "@/app/generated/prisma/client";
import { fromDate, toDate } from "./date";
import type { GoalRecord } from "./goal";
import type { DailySeconds } from "./penalty";
import { prisma } from "./prisma";

export function serializeGoal(goal: Goal): GoalRecord {
  return {
    id: goal.id,
    userId: goal.userId,
    examName: goal.examName,
    target: goal.target,
    startDate: fromDate(goal.startDate),
    examDate: fromDate(goal.examDate),
    resultDate: goal.resultDate ? fromDate(goal.resultDate) : null,
    status: goal.status,
    finalPenalty: goal.finalPenalty,
    penaltyWaived: goal.penaltyWaived,
    closedAt: goal.closedAt?.toISOString() ?? null,
    settledAt: goal.settledAt?.toISOString() ?? null,
  };
}

// userId → (날짜 → 그날 공부 초 합계)
export async function loadDailySeconds(userIds: number[], from?: string): Promise<Map<number, DailySeconds>> {
  const rows = await prisma.studyLog.groupBy({
    by: ["userId", "studyDate"],
    where: { userId: { in: userIds }, ...(from ? { studyDate: { gte: toDate(from) } } : {}) },
    _sum: { durationSec: true },
  });
  const result = new Map<number, DailySeconds>(userIds.map((id) => [id, new Map()]));
  for (const row of rows) {
    result.get(row.userId)!.set(fromDate(row.studyDate), row._sum.durationSec ?? 0);
  }
  return result;
}
