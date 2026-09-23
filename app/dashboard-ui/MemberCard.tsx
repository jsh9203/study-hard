import Link from "next/link";
import type { DashboardMember } from "@/lib/dashboard";
import { formatDDay, formatDuration, formatWon } from "@/lib/format";

export function Avatar({ name, color, size = "md" }: { name: string; color: string | null; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-6 w-6 text-xs" : "h-10 w-10 text-base";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${cls}`}
      style={{ backgroundColor: color || "#4f46e5" }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

function GoalBadge({ goal }: { goal: DashboardMember["goal"] }) {
  if (!goal) {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">목표 없음</span>;
  }
  if (goal.phase === "WAITING_RESULT") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">결과 대기</span>;
  }
  return (
    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
      {formatDDay(goal.dDay)}
    </span>
  );
}

function WeekLabel({ week }: { week: DashboardMember["thisWeek"] }) {
  switch (week.mode) {
    case "goal":
      return (
        <>
          <span className="text-lg font-bold text-gray-900">{week.certifiedCount}</span>
          <span className="text-gray-400">/{week.target}</span>
        </>
      );
    case "beforeStart":
      return <span className="text-sm font-medium text-gray-400">시작 전</span>;
    case "afterDDay":
      return (
        <>
          <span className="text-lg font-bold text-gray-900">{week.certifiedCount}</span>
          <span className="text-xs text-gray-400"> 일 (벌금 없음)</span>
        </>
      );
    default:
      return (
        <>
          <span className="text-lg font-bold text-gray-900">{week.certifiedCount}</span>
          <span className="text-gray-400">/5</span>
        </>
      );
  }
}

export default function MemberCard({ member, today }: { member: DashboardMember; today: string }) {
  const { goal, thisWeek, penalty } = member;
  return (
    <Link
      href={`/users/${member.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-indigo-300"
    >
      <div className="flex items-center gap-3">
        <Avatar name={member.name} color={member.color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{member.name}</span>
            <GoalBadge goal={goal} />
          </div>
          {goal && <p className="truncate text-xs text-gray-500">{goal.examName}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg leading-none">
            <WeekLabel week={thisWeek} />
          </p>
          <p className="mt-1 text-[11px] text-gray-400">이번 주 인증</p>
        </div>
      </div>

      <div className="mt-3 flex gap-1" aria-hidden>
        {thisWeek.days.map((d) => (
          <span
            key={d.date}
            className={`h-1.5 flex-1 rounded-full ${
              d.certified && d.inWindow
                ? "bg-emerald-500"
                : d.certified
                  ? "bg-emerald-200"
                  : d.date === today
                    ? "bg-indigo-200"
                    : "bg-gray-100"
            }`}
          />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-gray-400">이번 주</dt>
          <dd className="text-sm font-semibold text-gray-800">{formatDuration(thisWeek.studySec)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-400">누적 공부</dt>
          <dd className="text-sm font-semibold text-gray-800">{formatDuration(member.totalStudySec)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-400">누적 인증</dt>
          <dd className="text-sm font-semibold text-gray-800">{member.totalCertifiedDays}일</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">벌금</span>
        <div className="flex flex-wrap items-center gap-2">
          {penalty.unsettled > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
              미정산 {formatWon(penalty.unsettled)}
            </span>
          )}
          {member.pendingPenalty > 0 && (
            <span className="text-xs text-gray-400">이번 주 예상 +{formatWon(member.pendingPenalty)}</span>
          )}
          <span className={`font-bold ${penalty.total > 0 ? "text-red-500" : "text-gray-400"}`}>
            {formatWon(penalty.total)}
          </span>
        </div>
      </div>
    </Link>
  );
}
