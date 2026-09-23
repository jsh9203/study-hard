// 공부 인증 기록 수정 / 삭제 (삭제 시 Blob 사진도 함께 삭제)
import { BlobNotFoundError, del } from "@vercel/blob";
import { fromDate, isYmd, toDate, todayKST } from "@/lib/date";
import { fail, ok, parseId, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { SERVICE_START } from "@/lib/rules";

const MAX_DURATION = 86_400;
const MAX_MEMO = 200;

type LogRow = {
  id: number;
  userId: number;
  studyDate: Date;
  durationSec: number;
  photoUrl: string;
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

type PatchBody = { studyDate: unknown; durationSec: unknown; memo: unknown };

export async function PATCH(request: Request, ctx: RouteContext<"/api/logs/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return fail("잘못된 기록 ID입니다");
  const existing = await prisma.studyLog.findUnique({ where: { id } });
  if (!existing) return fail("기록을 찾을 수 없습니다", 404);

  const body = await readJson<PatchBody>(request);
  const data: { studyDate?: Date; durationSec?: number; memo?: string | null } = {};

  if (body.studyDate !== undefined) {
    const { studyDate } = body;
    if (!isYmd(studyDate)) return fail("공부 날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)");
    if (studyDate < SERVICE_START) return fail(`공부 날짜는 ${SERVICE_START} 이후여야 합니다`);
    if (studyDate > todayKST()) return fail("미래 날짜는 선택할 수 없습니다");
    data.studyDate = toDate(studyDate);
  }
  if (body.durationSec !== undefined) {
    const { durationSec } = body;
    if (typeof durationSec !== "number" || !Number.isInteger(durationSec) || durationSec < 1 || durationSec > MAX_DURATION) {
      return fail("공부 시간은 1초 ~ 24시간 사이여야 합니다");
    }
    data.durationSec = durationSec;
  }
  if (body.memo !== undefined) {
    const { memo } = body;
    if (memo !== null && typeof memo !== "string") return fail("메모 형식이 올바르지 않습니다");
    const memoText = typeof memo === "string" ? memo.trim() : "";
    if (memoText.length > MAX_MEMO) return fail(`메모는 ${MAX_MEMO}자 이하로 입력하세요`);
    data.memo = memoText || null;
  }

  const log = await prisma.studyLog.update({
    where: { id },
    data,
    include: { user: { select: { name: true } } },
  });
  return ok({ log: serializeLog(log) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/logs/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return fail("잘못된 기록 ID입니다");
  const log = await prisma.studyLog.findUnique({ where: { id } });
  if (!log) return fail("기록을 찾을 수 없습니다", 404);

  try {
    await del(log.photoUrl);
  } catch (e) {
    if (e instanceof BlobNotFoundError) {
      console.warn(`[logs/${id}] blob not found, skip:`, log.photoUrl);
    } else {
      console.error(`[logs/${id}] blob delete failed:`, e);
      return fail("사진 삭제에 실패했습니다. 잠시 후 다시 시도하세요", 502);
    }
  }

  await prisma.studyLog.delete({ where: { id } });
  return ok({ ok: true });
}
