import { addDays, diffDays, isoWeekday, maxYmd, minYmd, weekEnd, weekStart } from "./date";
import { CERTIFY_SECONDS, PENALTY_AMOUNT, WEEKLY_TARGET } from "./rules";

export type DailySeconds = Map<string, number>; // "YYYY-MM-DD" → 그날 공부 초 합계

export interface GoalWindow {
  startDate: string; // 평일
  examDate: string; // D-day (이날까지 벌금 발생)
}

export interface WeekResult {
  weekStart: string;
  rangeStart: string; // 목표 기간과 겹치는 구간
  rangeEnd: string;
  target: number;
  certified: number; // 구간 내 인증일수
  finalized: boolean; // 구간이 끝나 벌금 확정
  penalty: number; // 확정 전이면 0
}

export function isCertified(seconds: number | undefined): boolean {
  return (seconds ?? 0) >= CERTIFY_SECONDS;
}

// 주별 목표 횟수
// - 첫 주: 시작 요일~금요일 평일 수 (월5 화4 수3 목2 금1)
// - D-day 주: min(5, 구간 시작~D-day 일수)
export function weekTarget(goal: GoalWindow, ws: string): number {
  let target = WEEKLY_TARGET;
  if (ws === weekStart(goal.startDate)) {
    target = Math.max(0, 6 - isoWeekday(goal.startDate));
  }
  if (ws === weekStart(goal.examDate)) {
    const from = maxYmd(ws, goal.startDate);
    target = Math.min(target, diffDays(from, goal.examDate) + 1);
  }
  return Math.max(0, target);
}

// 목표 기간의 주차별 벌금. 오늘이 속한 주까지만 계산한다.
export function goalWeeks(goal: GoalWindow, daily: DailySeconds, today: string): WeekResult[] {
  const weeks: WeekResult[] = [];
  if (goal.examDate < goal.startDate) return weeks;

  const lastWeek = weekStart(minYmd(goal.examDate, today));
  for (let ws = weekStart(goal.startDate); ws <= lastWeek; ws = addDays(ws, 7)) {
    const rangeStart = maxYmd(ws, goal.startDate);
    const rangeEnd = minYmd(weekEnd(ws), goal.examDate);
    if (rangeStart > today) break;

    let certified = 0;
    for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
      if (isCertified(daily.get(d))) certified++;
    }
    const target = weekTarget(goal, ws);
    const finalized = today > rangeEnd;
    const penalty = finalized ? Math.max(0, target - certified) * PENALTY_AMOUNT : 0;
    weeks.push({ weekStart: ws, rangeStart, rangeEnd, target, certified, finalized, penalty });
  }
  return weeks;
}

export function goalPenalty(goal: GoalWindow, daily: DailySeconds, today: string): number {
  return goalWeeks(goal, daily, today).reduce((sum, w) => sum + w.penalty, 0);
}
