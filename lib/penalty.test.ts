import { describe, expect, it } from "vitest";
import { dDay, isoWeekday, todayKST, weekStart } from "./date";
import { goalPenalty, goalWeeks, weekTarget } from "./penalty";

const H = 3600;
const days = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("date", () => {
  it("KST 기준 오늘 (UTC 15:00 = KST 다음날 0시)", () => {
    expect(todayKST(new Date("2026-09-22T14:59:59Z"))).toBe("2026-09-22");
    expect(todayKST(new Date("2026-09-22T15:00:00Z"))).toBe("2026-09-23");
  });
  it("요일/주 시작", () => {
    expect(isoWeekday("2026-09-21")).toBe(1);
    expect(isoWeekday("2026-09-27")).toBe(7);
    expect(weekStart("2026-09-27")).toBe("2026-09-21");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });
  it("D-day", () => {
    expect(dDay("2026-10-01", "2026-09-23")).toBe(8);
    expect(dDay("2026-09-23", "2026-09-23")).toBe(0);
  });
});

describe("weekTarget", () => {
  const exam = "2026-12-31";
  it.each([
    ["2026-09-21", 5],
    ["2026-09-22", 4],
    ["2026-09-23", 3],
    ["2026-09-24", 2],
    ["2026-09-25", 1],
  ])("첫 주 시작 %s → %i회", (start, expected) => {
    expect(weekTarget({ startDate: start, examDate: exam }, weekStart(start))).toBe(expected);
  });
  it("둘째 주부터 5회", () => {
    expect(weekTarget({ startDate: "2026-09-25", examDate: exam }, "2026-09-28")).toBe(5);
  });
  it.each([
    ["2026-10-05", 1], // 월
    ["2026-10-07", 3], // 수
    ["2026-10-10", 5], // 토
    ["2026-10-11", 5], // 일
  ])("D-day %s 주 → %i회", (examDate, expected) => {
    expect(weekTarget({ startDate: "2026-09-21", examDate }, "2026-10-05")).toBe(expected);
  });
  it("첫 주와 D-day 주가 같으면 작은 값", () => {
    expect(weekTarget({ startDate: "2026-09-22", examDate: "2026-09-24" }, "2026-09-21")).toBe(3);
  });
});

describe("goalWeeks", () => {
  const goal = { startDate: "2026-09-21", examDate: "2026-10-07" };

  it("진행 중인 주는 벌금 미확정", () => {
    const weeks = goalWeeks(goal, days({ "2026-09-21": H }), "2026-09-23");
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ certified: 1, target: 5, finalized: false, penalty: 0 });
  });

  it("주 종료 후 미달분 × 1000원, 1시간 미만은 불인정, 주말도 인정", () => {
    const daily = days({
      "2026-09-21": H,
      "2026-09-22": H - 1,
      "2026-09-26": 2 * H, // 토
    });
    const weeks = goalWeeks(goal, daily, "2026-09-28");
    expect(weeks[0]).toMatchObject({ certified: 2, finalized: true, penalty: 3000 });
    expect(weeks[1]).toMatchObject({ finalized: false, penalty: 0 });
  });

  it("D-day 이후 벌금 없음, D-day 지나면 마지막 주 확정", () => {
    // 9/21주 0회(5000) + 9/28주 0회(5000) + 10/5~10/7 목표 3회 0회(3000)
    expect(goalPenalty(goal, days({}), "2026-10-08")).toBe(13000);
    expect(goalPenalty(goal, days({}), "2026-12-01")).toBe(13000);
    expect(goalPenalty(goal, days({}), "2026-10-07")).toBe(10000);
  });

  it("D-day 이후 기록은 인증일로 세지 않음", () => {
    const daily = days({ "2026-10-05": H, "2026-10-06": H, "2026-10-07": H, "2026-10-08": H });
    const last = goalWeeks(goal, daily, "2026-10-12").at(-1)!;
    expect(last).toMatchObject({ rangeEnd: "2026-10-07", target: 3, certified: 3, penalty: 0 });
  });

  it("시작 전이면 빈 결과", () => {
    expect(goalWeeks({ startDate: "2026-10-05", examDate: "2026-11-01" }, days({}), "2026-09-23")).toEqual([]);
  });
});
