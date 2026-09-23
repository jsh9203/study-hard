// 목표 상태/벌금 요약 (순수 함수 — DB 접근 없음)
import { dDay, diffDays, isWeekend, isYmd } from "./date";
import { goalPenalty, goalWeeks, type DailySeconds, type WeekResult } from "./penalty";
import { SERVICE_START } from "./rules";

export type GoalStatus = "ACTIVE" | "ACHIEVED" | "FAILED" | "CANCELLED";

// 화면 표시용 상태: ACTIVE 이면서 D-day 가 지났으면 결과 대기
export type GoalPhase = "IN_PROGRESS" | "WAITING_RESULT" | "ACHIEVED" | "FAILED" | "CANCELLED";

export interface GoalRecord {
  id: number;
  userId: number;
  examName: string;
  target: string;
  startDate: string; // YYYY-MM-DD
  examDate: string;
  resultDate: string | null;
  status: GoalStatus;
  finalPenalty: number | null;
  penaltyWaived: boolean;
  closedAt: string | null; // ISO
  settledAt: string | null; // ISO
}

export interface GoalSummary extends GoalRecord {
  phase: GoalPhase;
  dDay: number; // examDate - today (당일 0)
  penalty: number; // ACTIVE: 실시간 계산 / 종료: 스냅샷 (면제면 0)
  unsettled: boolean; // FAILED 이면서 정산 전
  weeks: WeekResult[]; // ACTIVE 일 때만 채움
}

export function goalPhase(goal: Pick<GoalRecord, "status" | "examDate">, today: string): GoalPhase {
  if (goal.status !== "ACTIVE") return goal.status;
  return today > goal.examDate ? "WAITING_RESULT" : "IN_PROGRESS";
}

export function summarizeGoal(goal: GoalRecord, daily: DailySeconds, today: string): GoalSummary {
  const active = goal.status === "ACTIVE";
  const weeks = active ? goalWeeks(goal, daily, today) : [];
  const penalty = active
    ? weeks.reduce((sum, w) => sum + w.penalty, 0)
    : goal.penaltyWaived
      ? 0
      : (goal.finalPenalty ?? 0);
  return {
    ...goal,
    phase: goalPhase(goal, today),
    dDay: dDay(goal.examDate, today),
    penalty,
    unsettled: goal.status === "FAILED" && !goal.settledAt,
    weeks,
  };
}

// 결과 체크 시 저장할 값
// - ACHIEVED: 자동 정산(면제)  - FAILED: 미정산  - CANCELLED: 잘못 만든 목표 취소, 벌금 없음
export function closeGoalFields(
  goal: Pick<GoalRecord, "startDate" | "examDate">,
  status: Exclude<GoalStatus, "ACTIVE">,
  daily: DailySeconds,
  today: string,
  now: Date = new Date(),
) {
  return {
    status,
    finalPenalty: goalPenalty(goal, daily, today),
    penaltyWaived: status !== "FAILED",
    closedAt: now,
    settledAt: status === "FAILED" ? null : now,
  };
}

// 결과 체크(달성/미달성)는 D-day 다음 날부터. 취소는 언제든.
export function canClose(goal: Pick<GoalRecord, "status" | "examDate">, status: GoalStatus, today: string): string | null {
  if (goal.status !== "ACTIVE") return "이미 종료된 목표입니다";
  if (status === "ACTIVE") return "종료 상태를 선택하세요";
  if ((status === "ACHIEVED" || status === "FAILED") && today <= goal.examDate) {
    return "결과 체크는 시험일(D-day) 다음 날부터 가능합니다";
  }
  return null;
}

// 목표 날짜 검증. 문제가 있으면 에러 메시지, 없으면 null
export function validateGoalDates(startDate: unknown, examDate: unknown): string | null {
  if (!isYmd(startDate) || !isYmd(examDate)) return "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)";
  if (startDate < SERVICE_START) return `목표 시작일은 ${SERVICE_START} 이후여야 합니다`;
  if (isWeekend(startDate)) return "목표 시작일은 평일(월~금)만 선택할 수 있습니다";
  if (diffDays(startDate, examDate) < 0) return "시험일은 시작일 이후여야 합니다";
  return null;
}
