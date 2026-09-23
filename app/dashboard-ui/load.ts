// 대시보드 데이터 로딩 (서버 전용: DB 조회 → buildDashboard)
import { buildDashboard, type Dashboard } from "@/lib/dashboard";
import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { loadDailySeconds, serializeGoal } from "@/lib/queries";

export async function loadDashboard(today: string = todayKST()): Promise<Dashboard> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
    include: { goals: { orderBy: { startDate: "asc" } } },
  });
  const daily = await loadDailySeconds(users.map((u) => u.id));
  return buildDashboard(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color,
      goals: u.goals.map(serializeGoal),
      daily: daily.get(u.id) ?? new Map(),
    })),
    today,
  );
}
