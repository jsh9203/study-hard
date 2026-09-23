import { describe, expect, it } from "vitest";
import { canClose, closeGoalFields, summarizeGoal, validateGoalDates, type GoalRecord } from "./goal";

const base: GoalRecord = {
  id: 1,
  userId: 1,
  examName: "정보처리기사",
  target: "합격",
  startDate: "2026-09-21",
  examDate: "2026-10-07",
  resultDate: null,
  status: "ACTIVE",
  finalPenalty: null,
  penaltyWaived: false,
  closedAt: null,
  settledAt: null,
};
const none = new Map<string, number>();

describe("summarizeGoal", () => {
  it("진행 중 / 결과 대기 구분", () => {
    expect(summarizeGoal(base, none, "2026-10-07").phase).toBe("IN_PROGRESS");
    expect(summarizeGoal(base, none, "2026-10-08").phase).toBe("WAITING_RESULT");
  });
  it("진행 중이면 실시간 벌금, 종료면 스냅샷", () => {
    expect(summarizeGoal(base, none, "2026-10-08").penalty).toBe(13000);
    const failed = { ...base, status: "FAILED" as const, finalPenalty: 7000 };
    expect(summarizeGoal(failed, none, "2026-12-01")).toMatchObject({ penalty: 7000, unsettled: true });
    const waived = { ...base, status: "ACHIEVED" as const, finalPenalty: 7000, penaltyWaived: true };
    expect(summarizeGoal(waived, none, "2026-12-01")).toMatchObject({ penalty: 0, unsettled: false });
  });
});

describe("closeGoalFields / canClose", () => {
  it("달성 → 자동 정산, 미달성 → 미정산", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(closeGoalFields(base, "ACHIEVED", none, "2026-10-10", now)).toMatchObject({
      finalPenalty: 13000,
      penaltyWaived: true,
      settledAt: now,
    });
    expect(closeGoalFields(base, "FAILED", none, "2026-10-10", now)).toMatchObject({
      finalPenalty: 13000,
      penaltyWaived: false,
      settledAt: null,
    });
  });
  it("결과 체크는 D-day 다음 날부터, 취소는 언제든", () => {
    expect(canClose(base, "ACHIEVED", "2026-10-07")).not.toBeNull();
    expect(canClose(base, "ACHIEVED", "2026-10-08")).toBeNull();
    expect(canClose(base, "CANCELLED", "2026-09-23")).toBeNull();
    expect(canClose({ ...base, status: "FAILED" }, "CANCELLED", "2026-10-08")).not.toBeNull();
  });
});

describe("validateGoalDates", () => {
  it.each([
    ["2026-09-21", "2026-10-07", null],
    ["2026-09-26", "2026-10-07", "평일"],
    ["2026-09-14", "2026-10-07", "이후여야"],
    ["2026-09-23", "2026-09-22", "시작일 이후"],
    ["2026-9-23", "2026-10-07", "형식"],
    ["2026-02-30", "2026-10-07", "형식"],
    ["2026-13-01", "2026-10-07", "형식"],
  ])("%s ~ %s", (start, exam, expected) => {
    const result = validateGoalDates(start, exam);
    if (expected === null) expect(result).toBeNull();
    else expect(result).toContain(expected);
  });
});
