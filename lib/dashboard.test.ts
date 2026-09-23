import { describe, expect, it } from "vitest";
import { buildDashboard, type DashboardMemberInput } from "./dashboard";
import type { GoalRecord } from "./goal";

const goal: GoalRecord = {
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

function member(goals: GoalRecord[], daily: Record<string, number> = {}, id = 1): DashboardMemberInput {
  return { id, name: `멤버${id}`, color: null, goals, daily: new Map(Object.entries(daily)) };
}

describe("buildDashboard", () => {
  it("이번 주 7일(월~일)과 주 범위", () => {
    const d = buildDashboard([member([goal])], "2026-09-23");
    expect(d).toMatchObject({ weekStart: "2026-09-21", weekEnd: "2026-09-27" });
    expect(d.members[0].thisWeek.days.map((x) => x.date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("수요일 시작 첫 주 목표 = 3, 시작 전 날은 인증 수에서 제외", () => {
    const wed = { ...goal, startDate: "2026-09-23" };
    const d = buildDashboard([member([wed], { "2026-09-21": 7200, "2026-09-23": 3600 })], "2026-09-23");
    const w = d.members[0].thisWeek;
    expect(w).toMatchObject({ target: 3, mode: "goal", certifiedCount: 1 });
    expect(w.days[0]).toMatchObject({ certified: true, inWindow: false });
    expect(d.members[0].pendingPenalty).toBe(2000);
  });

  it("목표 없음 → target null, 주 전체 인증일 집계, 벌금 0", () => {
    const d = buildDashboard([member([], { "2026-09-21": 3600, "2026-09-22": 4000 })], "2026-09-23");
    const m = d.members[0];
    expect(m.goal).toBeNull();
    expect(m.thisWeek).toMatchObject({ target: null, mode: "noGoal", certifiedCount: 2 });
    expect(m.penalty).toEqual({ current: 0, unsettled: 0, total: 0 });
  });

  it("다음 주 시작 목표 → 시작 전 (target 0)", () => {
    const later = { ...goal, startDate: "2026-09-28", examDate: "2026-11-01" };
    const d = buildDashboard([member([later])], "2026-09-23");
    expect(d.members[0].thisWeek).toMatchObject({ target: 0, mode: "beforeStart" });
    expect(d.members[0].pendingPenalty).toBe(0);
  });

  it("1시간 미만인 날은 인증 아님, 공부시간은 합산", () => {
    const d = buildDashboard([member([goal], { "2026-09-21": 3599, "2026-09-22": 3600 })], "2026-09-23");
    const m = d.members[0];
    expect(m.thisWeek.days[0]).toMatchObject({ seconds: 3599, certified: false });
    expect(m.thisWeek).toMatchObject({ certifiedCount: 1, studySec: 7199 });
    expect(m).toMatchObject({ totalStudySec: 7199, totalCertifiedDays: 1 });
  });

  it("미정산 FAILED 목표 벌금 포함, 정산/면제분 제외", () => {
    const failed = { ...goal, id: 2, status: "FAILED" as const, finalPenalty: 7000 };
    const settled = { ...failed, id: 3, finalPenalty: 5000, settledAt: "2026-09-22T00:00:00.000Z" };
    const achieved = { ...failed, id: 4, status: "ACHIEVED" as const, penaltyWaived: true };
    const d = buildDashboard([member([failed, settled, achieved])], "2026-09-23");
    expect(d.members[0].penalty).toEqual({ current: 0, unsettled: 7000, total: 7000 });
    expect(d.totals).toMatchObject({ penalty: 7000, unsettled: 7000, memberCount: 1 });
  });

  it("D-day 지남 → 결과 대기, 확정 벌금 유지, 이번 주 목표 없음", () => {
    const short = { ...goal, startDate: "2026-09-21", examDate: "2026-09-25" };
    const d = buildDashboard([member([short])], "2026-10-01");
    const m = d.members[0];
    expect(m.goal).toMatchObject({ phase: "WAITING_RESULT", dDay: -6 });
    expect(m.thisWeek).toMatchObject({ target: null, mode: "afterDDay" });
    expect(m.penalty.current).toBe(5000);
  });

  it("그룹 합계", () => {
    const d = buildDashboard(
      [member([goal], { "2026-09-21": 3600 }, 1), member([], { "2026-09-22": 1800, "2026-09-14": 9999 }, 2)],
      "2026-09-23",
    );
    expect(d.totals).toMatchObject({ studySecThisWeek: 5400, memberCount: 2, penalty: 0 });
  });
});
