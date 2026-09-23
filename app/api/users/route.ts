import { fromDate } from "@/lib/date";
import { fail, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6"];
const HEX = /^#[0-9a-fA-F]{6}$/;

const userSelect = { id: true, name: true, color: true, createdAt: true } as const;

export async function GET() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      ...userSelect,
      goals: { where: { status: "ACTIVE" }, select: { id: true, examName: true, examDate: true }, take: 1 },
    },
  });
  // activeGoal: 진행 중(ACTIVE) 목표 — 없으면 공부 인증 불가
  return ok({
    users: users.map(({ goals, ...u }) => ({
      ...u,
      activeGoal: goals[0] ? { ...goals[0], examDate: fromDate(goals[0].examDate) } : null,
    })),
  });
}

export async function POST(request: Request) {
  const body = await readJson<{ name: string; color: string }>(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 20) return fail("이름은 1~20자로 입력하세요");

  let color: string;
  if (body.color !== undefined && body.color !== null && body.color !== "") {
    if (typeof body.color !== "string" || !HEX.test(body.color)) return fail("색상 형식이 올바르지 않습니다 (#RRGGBB)");
    color = body.color;
  } else {
    const count = await prisma.user.count();
    color = PALETTE[count % PALETTE.length];
  }

  const user = await prisma.user.create({ data: { name, color }, select: userSelect });
  return ok({ user: { ...user, activeGoal: null } }, { status: 201 });
}
