// 메인 대시보드 집계 (순수 함수 — DB 접근 없음)
import { addDays, weekEnd, weekStart } from "./date";
import { summarizeGoal, type GoalPhase, type GoalRecord } from "./goal";
import { isCertified, weekTarget, type DailySeconds } from "./penalty";
import { PENALTY_AMOUNT } from "./rules";

export interface DashboardMemberInput {
  id: number;
  name: string;
  color: string | null;
  goals: GoalRecord[];
  daily: DailySeconds;
}

export interface DashboardGoal {
  id: number;
  examName: string;
  target: string;
  examDate: string;
  dDay: number;
  phase: GoalPhase;
}

export interface DashboardDay {
  date: string;
  seconds: number;
  certified: boolean;
  inWindow: boolean; // 목표 기간(벌금 창) 안의 날인지 — 목표 없으면 true
}

// goal: 이번 주가 목표 기간과 겹침 / beforeStart: 이번 주가 시작일 이전 (target 0)
// afterDDay: D-day 가 지난 주 (벌금 없음, target null) / noGoal: 진행 중 목표 없음 (target null)
export type WeekMode = "goal" | "beforeStart" | "afterDDay" | "noGoal";

export interface DashboardWeek {
  weekStart: string;
  days: DashboardDay[]; // 월~일 7개
  certifiedCount: number;
  target: number | null;
  mode: WeekMode;
  studySec: number;
}

export interface DashboardMember {
  id: number;
  name: string;
  color: string | null;
  goal: DashboardGoal | null;
  thisWeek: DashboardWeek;
  totalStudySec: number;
  totalCertifiedDays: number;
  penalty: { current: number; unsettled: number; total: number };
  pendingPenalty: number; // 이번 주가 지금 끝난다면 추가될 벌금 (미확정, "예상")
}

export interface DashboardTotals {
  penalty: number;
  unsettled: number;
  studySecThisWeek: number;
  memberCount: number;
}

export interface Dashboard {
  today: string;
  weekStart: string;
  weekEnd: string;
  members: DashboardMember[];
  totals: DashboardTotals;
}

function buildMember(member: DashboardMemberInput, today: string): DashboardMember {
  const ws = weekStart(today);
  const we = weekEnd(today);
  const active = member.goals.find((g) => g.status === "ACTIVE") ?? null;
  const activeSummary = active ? summarizeGoal(active, member.daily, today) : null;

  let mode: WeekMode = "noGoal";
  if (active) {
    if (we < active.startDate) mode = "beforeStart";
    else if (ws > active.examDate) mode = "afterDDay";
    else mode = "goal";
  }

  const days: DashboardDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i);
    const seconds = member.daily.get(date) ?? 0;
    const inWindow = !active || (date >= active.startDate && date <= active.examDate);
    days.push({ date, seconds, certified: isCertified(seconds), inWindow });
  }
  const counted = mode === "goal" ? days.filter((d) => d.inWindow) : days;
  const certifiedCount = counted.filter((d) => d.certified).length;
  const target = mode === "goal" ? weekTarget(active!, ws) : mode === "beforeStart" ? 0 : null;
  const studySec = days.reduce((sum, d) => sum + d.seconds, 0);

  let totalStudySec = 0;
  let totalCertifiedDays = 0;
  for (const seconds of member.daily.values()) {
    totalStudySec += seconds;
    if (isCertified(seconds)) totalCertifiedDays++;
  }

  const current = activeSummary?.penalty ?? 0;
  const unsettled = member.goals
    .filter((g) => g.status === "FAILED")
    .map((g) => summarizeGoal(g, member.daily, today))
    .filter((s) => s.unsettled)
    .reduce((sum, s) => sum + s.penalty, 0);

  return {
    id: member.id,
    name: member.name,
    color: member.color,
    goal: activeSummary
      ? {
          id: activeSummary.id,
          examName: activeSummary.examName,
          target: activeSummary.target,
          examDate: activeSummary.examDate,
          dDay: activeSummary.dDay,
          phase: activeSummary.phase,
        }
      : null,
    thisWeek: { weekStart: ws, days, certifiedCount, target, mode, studySec },
    totalStudySec,
    totalCertifiedDays,
    penalty: { current, unsettled, total: current + unsettled },
    pendingPenalty: mode === "goal" && target !== null ? Math.max(0, target - certifiedCount) * PENALTY_AMOUNT : 0,
  };
}

export function buildDashboard(members: DashboardMemberInput[], today: string): Dashboard {
  const built = members.map((m) => buildMember(m, today));
  return {
    today,
    weekStart: weekStart(today),
    weekEnd: weekEnd(today),
    members: built,
    totals: {
      penalty: built.reduce((sum, m) => sum + m.penalty.total, 0),
      unsettled: built.reduce((sum, m) => sum + m.penalty.unsettled, 0),
      studySecThisWeek: built.reduce((sum, m) => sum + m.thisWeek.studySec, 0),
      memberCount: built.length,
    },
  };
}
