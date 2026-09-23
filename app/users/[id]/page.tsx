"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PageShell from "@/app/components/PageShell";
import { todayKST } from "@/lib/date";
import { formatDDay, formatShortDate, formatWon } from "@/lib/format";
import type { GoalSummary } from "@/lib/goal";
import GoalForm, { type GoalInput } from "./GoalForm";

interface User {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
}

const card = "rounded-2xl border border-gray-200 bg-white p-4";

async function errorOf(res: Response, fallback: string): Promise<string> {
  return (await res.json().catch(() => ({}))).error ?? fallback;
}

// JSON 요청 → 실패 시 에러 메시지, 성공 시 null
async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) return "네트워크 오류";
  return res.ok ? null : errorOf(res, "요청에 실패했습니다");
}

interface Detail {
  user?: User;
  goals?: GoalSummary[];
  error?: string;
}

async function fetchDetail(id: string): Promise<Detail> {
  const res = await fetch(`/api/users/${id}`, { cache: "no-store" }).catch(() => null);
  if (!res) return { error: "네트워크 오류" };
  if (!res.ok) return { error: await errorOf(res, "멤버 정보를 불러오지 못했습니다") };
  return res.json();
}

function period(goal: GoalSummary) {
  return `${formatShortDate(goal.startDate)} ~ ${formatShortDate(goal.examDate)}`;
}

function HistoryBadge({ goal }: { goal: GoalSummary }) {
  const [label, cls] =
    goal.status === "ACHIEVED"
      ? ["달성 · 면제", "bg-emerald-50 text-emerald-600"]
      : goal.status === "FAILED"
        ? goal.unsettled
          ? ["미달성 · 미정산", "bg-red-50 text-red-500"]
          : ["미달성 · 정산완료", "bg-gray-100 text-gray-600"]
        : ["취소", "bg-gray-100 text-gray-400"];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function ActiveGoalCard({
  goal,
  busy,
  onEdit,
  onClose,
}: {
  goal: GoalSummary;
  busy: boolean;
  onEdit: () => void;
  onClose: (status: "ACHIEVED" | "FAILED" | "CANCELLED") => void;
}) {
  const waiting = goal.phase === "WAITING_RESULT";
  return (
    <section className={card}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
              {formatDDay(goal.dDay)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                waiting ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
              }`}
            >
              {waiting ? "결과 대기" : "진행 중"}
            </span>
          </div>
          <h2 className="truncate text-lg font-bold">{goal.examName}</h2>
          <p className="text-sm text-gray-600">🎯 {goal.target}</p>
          <p className="mt-1 text-xs text-gray-400">
            {period(goal)}
            {goal.resultDate && ` · 발표 ${formatShortDate(goal.resultDate)}`}
          </p>
        </div>
        <button onClick={onEdit} className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
          수정
        </button>
      </div>

      <div className="mb-3 flex items-baseline justify-between rounded-xl bg-gray-50 px-3 py-2">
        <span className="text-sm text-gray-600">현재 벌금</span>
        <span className={`text-lg font-bold ${goal.penalty > 0 ? "text-red-500" : "text-gray-800"}`}>
          {formatWon(goal.penalty)}
        </span>
      </div>

      {goal.weeks.length > 0 && (
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {goal.weeks.map((w, i) => (
            <li key={w.weekStart} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-gray-500">
                <span className="mr-1 text-xs text-gray-400">{i + 1}주</span>
                {formatShortDate(w.rangeStart)}~{formatShortDate(w.rangeEnd)}
              </span>
              <span className="flex items-center gap-3">
                <span className={w.certified >= w.target ? "text-emerald-500" : "text-gray-700"}>
                  {w.certified}/{w.target}
                </span>
                <span
                  className={`w-16 text-right ${
                    !w.finalized ? "text-gray-400" : w.penalty > 0 ? "text-red-500" : "text-emerald-500"
                  }`}
                >
                  {w.finalized ? formatWon(w.penalty) : "진행 중"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {waiting && (
        <div className="mb-2">
          <p className="mb-2 text-sm text-gray-600">시험 결과가 나왔나요?</p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => onClose("ACHIEVED")}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              🎉 달성
            </button>
            <button
              disabled={busy}
              onClick={() => onClose("FAILED")}
              className="flex-1 rounded-lg border border-red-300 py-2 text-sm font-medium text-red-500 disabled:opacity-50"
            >
              미달성
            </button>
          </div>
        </div>
      )}
      <div className="text-right">
        <button
          disabled={busy}
          onClick={() => onClose("CANCELLED")}
          className="text-xs text-gray-400 underline disabled:opacity-50"
        >
          목표 취소
        </button>
      </div>
    </section>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((result: Detail) => {
    if (result.user) {
      setUser(result.user);
      setGoals(result.goals ?? []);
    }
    setLoadError(result.error ?? "");
    setLoading(false);
  }, []);

  const load = useCallback(async () => apply(await fetchDetail(id)), [apply, id]);

  useEffect(() => {
    let cancelled = false;
    fetchDetail(id).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, id]);

  const active = goals.find((g) => g.status === "ACTIVE");
  const unsettled = goals.filter((g) => g.unsettled);
  const history = goals.filter((g) => g.status !== "ACTIVE");

  async function createGoal(input: GoalInput) {
    const error = await send(`/api/users/${id}/goals`, "POST", input);
    if (!error) await load();
    return error;
  }

  async function editGoal(input: GoalInput) {
    if (!active) return "진행 중인 목표가 없습니다";
    const error = await send(`/api/goals/${active.id}`, "PATCH", input);
    if (!error) {
      setEditing(false);
      await load();
    }
    return error;
  }

  async function closeGoal(status: "ACHIEVED" | "FAILED" | "CANCELLED") {
    if (!active) return;
    const message =
      status === "ACHIEVED"
        ? `🎉 '${active.examName}' 목표 달성으로 처리할까요?\n누적 벌금 ${formatWon(active.penalty)}은 면제(자동 정산)됩니다.`
        : status === "FAILED"
          ? `'${active.examName}' 목표를 미달성으로 처리할까요?\n벌금 ${formatWon(active.penalty)}이 미정산으로 남습니다.`
          : `⚠️ '${active.examName}' 목표를 취소할까요?\n잘못 만든 목표를 지울 때만 사용하세요.\n취소하면 벌금이 부과되지 않으며(0원) 되돌릴 수 없습니다.`;
    if (!confirm(message)) return;
    setBusy(true);
    setActionError("");
    const error = await send(`/api/goals/${active.id}`, "PATCH", { status });
    setBusy(false);
    if (error) setActionError(error);
    else {
      setEditing(false);
      await load();
    }
  }

  async function settle(goal: GoalSummary) {
    if (!confirm(`'${goal.examName}' 벌금 ${formatWon(goal.penalty)}을 정산 완료로 처리할까요?`)) return;
    setBusy(true);
    setActionError("");
    const error = await send(`/api/goals/${goal.id}/settle`, "POST");
    setBusy(false);
    if (error) setActionError(error);
    else await load();
  }

  if (loading) {
    return (
      <PageShell title="멤버 상세">
        <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell title="멤버 상세">
        <div className={`${card} text-center text-sm`}>
          <p className="mb-3 text-red-500">{loadError || "멤버를 찾을 수 없습니다"}</p>
          <Link href="/users" className="font-medium text-indigo-600">
            ← 멤버 목록으로
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={user.name}
      action={
        <Link href="/users" className="text-sm text-gray-500">
          ← 목록
        </Link>
      }
    >
      <div className="space-y-4">
        <p className="-mt-3 flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: user.color ?? "#6366f1" }} />
          가입 {formatShortDate(todayKST(new Date(user.createdAt)))}
        </p>

        {loadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{loadError}</div>
        )}
        {actionError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{actionError}</div>
        )}

        {unsettled.map((goal) => (
          <section key={goal.id} className={`${card} border-red-200`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-red-500">미정산 벌금</p>
                <p className="truncate text-sm text-gray-700">{goal.examName}</p>
                <p className="text-lg font-bold text-red-500">{formatWon(goal.penalty)}</p>
              </div>
              <button
                disabled={busy}
                onClick={() => settle(goal)}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                정산 완료
              </button>
            </div>
          </section>
        ))}

        {active && !editing && (
          <ActiveGoalCard goal={active} busy={busy} onEdit={() => setEditing(true)} onClose={closeGoal} />
        )}

        {active && editing && (
          <section className={card}>
            <h2 className="mb-3 font-bold">목표 수정</h2>
            <GoalForm initial={active} submitLabel="저장" onSubmit={editGoal} onCancel={() => setEditing(false)} />
          </section>
        )}

        {!active && (
          <section className={card}>
            <h2 className="mb-1 font-bold">새 목표 설정</h2>
            <p className="mb-3 text-xs text-gray-500">
              목표 기간(시작일~시험일) 동안 주 5회 1시간 이상 인증하지 못하면 1회당 1,000원 벌금이 쌓입니다.
            </p>
            <GoalForm submitLabel="목표 만들기" onSubmit={createGoal} />
          </section>
        )}

        {history.length > 0 && (
          <section className={card}>
            <h2 className="mb-2 font-bold">지난 목표</h2>
            <ul className="divide-y divide-gray-100">
              {history.map((goal) => (
                <li key={goal.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{goal.examName}</span>
                      <HistoryBadge goal={goal} />
                    </div>
                    <p className="text-xs text-gray-400">{period(goal)}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm ${
                      goal.penaltyWaived ? "text-gray-400 line-through" : goal.unsettled ? "text-red-500" : "text-gray-600"
                    }`}
                  >
                    {formatWon(goal.finalPenalty ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}
