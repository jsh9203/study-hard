import Link from "next/link";
import { connection } from "next/server";
import PageShell from "@/app/components/PageShell";
import Splash from "@/app/components/Splash";
import { loadDashboard } from "@/app/dashboard-ui/load";
import MemberCard from "@/app/dashboard-ui/MemberCard";
import WeekTable from "@/app/dashboard-ui/WeekTable";
import { formatDuration, formatShortDate, formatWon } from "@/lib/format";

function Stat({ label, value, className = "text-gray-900" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`mt-1 truncate text-base font-bold ${className}`}>{value}</p>
    </div>
  );
}

export default async function Home() {
  await connection(); // 요청마다 오늘(KST) 기준으로 새로 계산
  const data = await loadDashboard();
  const { members, totals } = data;

  return (
    <Splash>
      <PageShell
        title={
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm" />
            Study Hard
          </>
        }
        action={
          <Link
            href="/upload"
            className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            📸 인증하기
          </Link>
        }
      >
        <section className="grid grid-cols-3 gap-2">
          <Stat label="총 누적 벌금" value={formatWon(totals.penalty)} className="text-red-500" />
          <Stat label="이번 주 공부" value={formatDuration(totals.studySecThisWeek)} />
          <Stat label="멤버" value={`${totals.memberCount}명`} />
        </section>

        {members.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-gray-600">아직 등록된 멤버가 없어요.</p>
            <Link href="/users" className="mt-3 inline-block font-semibold text-indigo-600">
              멤버 추가하러 가기 →
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">멤버</h2>
              <ul className="space-y-3">
                {members.map((m) => (
                  <li key={m.id}>
                    <MemberCard member={m} today={data.today} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-700">이번 주 현황</h2>
                <span className="text-xs text-gray-400">
                  {formatShortDate(data.weekStart)} ~ {formatShortDate(data.weekEnd)}
                </span>
              </div>
              <WeekTable members={members} today={data.today} />
              <p className="mt-2 text-[11px] text-gray-400">하루 합계 1시간 이상이면 인증(✓)</p>
            </section>
          </>
        )}
      </PageShell>
    </Splash>
  );
}
