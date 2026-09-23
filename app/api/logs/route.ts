// 공부 인증 기록 조회 / 생성
import { fromDate, isYmd, toDate, todayKST } from "@/lib/date";
import { fail, ok, parseId, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { SERVICE_START } from "@/lib/rules";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_DURATION = 86_400;
const MAX_MEMO = 200;

type LogRow = {
  id: number;
  userId: number;
  studyDate: Date;
  durationSec: number;
  photoUrl: string | null;
  memo: string | null;
  createdAt: Date;
  user: { name: string };
};

function serializeLog(log: LogRow) {
  return {
    id: log.id,
    userId: log.userId,
    userName: log.user.name,
    studyDate: fromDate(log.studyDate),
    durationSec: log.durationSec,
    photoUrl: log.photoUrl,
    memo: log.memo,
    createdAt: log.createdAt.toISOString(),
  };
}

function isBlobUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const where: { userId?: number; studyDate?: { gte?: Date; lte?: Date } } = {};

  const userIdParam = params.get("userId");
  if (userIdParam) {
    const userId = parseId(userIdParam);
    if (!userId) return fail("userId가 올바르지 않습니다");
    where.userId = userId;
  }
  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    if (from && !isYmd(from)) return fail("from 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)");
    if (to && !isYmd(to)) return fail("to 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)");
    where.studyDate = { ...(from ? { gte: toDate(from) } : {}), ...(to ? { lte: toDate(to) } : {}) };
  }
  let limit = DEFAULT_LIMIT;
  const limitParam = params.get("limit");
  if (limitParam) {
    const n = Number(limitParam);
    if (!Number.isInteger(n) || n < 1) return fail("limit이 올바르지 않습니다");
    limit = Math.min(n, MAX_LIMIT);
  }

  const logs = await prisma.studyLog.findMany({
    where,
    orderBy: [{ studyDate: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { user: { select: { name: true } } },
  });
  return ok({ logs: logs.map(serializeLog) });
}

type CreateBody = {
  userId: unknown;
  studyDate: unknown;
  durationSec: unknown;
  photoUrl: unknown;
  photoPath: unknown;
  memo: unknown;
};

export async function POST(request: Request) {
  const body = await readJson<CreateBody>(request);

  const userId = typeof body.userId === "number" ? body.userId : parseId(String(body.userId ?? ""));
  if (!userId || !Number.isInteger(userId) || userId <= 0) return fail("멤버를 선택하세요");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return fail("존재하지 않는 멤버입니다", 404);
  const activeGoal = await prisma.goal.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } });
  if (!activeGoal) return fail("목표가 없는 멤버는 인증할 수 없습니다. 먼저 목표를 설정하세요", 409);

  const { studyDate, durationSec, photoUrl, photoPath, memo } = body;
  if (!isYmd(studyDate)) return fail("공부 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)");
  if (studyDate < SERVICE_START) return fail(`공부 날짜는 ${SERVICE_START} 이후여야 합니다`);
  if (studyDate > todayKST()) return fail("미래 날짜는 선택할 수 없습니다");

  if (typeof durationSec !== "number" || !Number.isInteger(durationSec) || durationSec < 1 || durationSec > MAX_DURATION) {
    return fail("공부 시간은 1초 ~ 24시간 사이여야 합니다");
  }
  // 사진은 선택 — 보낼 때는 URL·경로 둘 다 올바라야 함
  const hasPhoto = photoUrl != null || photoPath != null;
  if (hasPhoto) {
    if (!isBlobUrl(photoUrl)) return fail("사진 URL이 올바르지 않습니다");
    if (typeof photoPath !== "string" || !photoPath.startsWith("logs/")) return fail("사진 경로가 올바르지 않습니다");
  }
  if (memo != null && typeof memo !== "string") return fail("메모 형식이 올바르지 않습니다");
  const memoText = typeof memo === "string" ? memo.trim() : "";
  if (memoText.length > MAX_MEMO) return fail(`메모는 ${MAX_MEMO}자 이하로 입력하세요`);

  const log = await prisma.studyLog.create({
    data: {
      userId,
      studyDate: toDate(studyDate),
      durationSec,
      photoUrl: hasPhoto ? (photoUrl as string) : null,
      photoPath: hasPhoto ? (photoPath as string) : null,
      memo: memoText || null,
    },
    include: { user: { select: { name: true } } },
  });
  return ok({ log: serializeLog(log) }, { status: 201 });
}
