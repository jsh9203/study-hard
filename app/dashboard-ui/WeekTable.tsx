import type { DashboardMember } from "@/lib/dashboard";
import { Avatar } from "./MemberCard";

const LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 3600 → "1h", 5400 → "1.5h", 2400 → "40m"
function shortTime(sec: number): string {
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m`;
  return `${Math.round((sec / 3600) * 10) / 10}h`;
}

export default function WeekTable({ members, today }: { members: DashboardMember[]; today: string }) {
  const dates = members[0]?.thisWeek.days.map((d) => d.date) ?? [];
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[480px] border-separate border-spacing-0 text-center text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white py-2 pr-2 text-left text-xs font-medium text-gray-500">멤버</th>
            {dates.map((date, i) => (
              <th
                key={date}
                className={`py-2 text-xs font-medium ${
                  date === today ? "rounded-t-lg bg-indigo-50 text-indigo-600" : i >= 5 ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {LABELS[i]}
                <span className="block text-[10px] font-normal">{Number(date.slice(8))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td className="sticky left-0 z-10 border-t border-gray-100 bg-white py-2 pr-2 text-left">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Avatar name={m.name} color={m.color} size="sm" />
                  <span className="text-sm font-medium text-gray-800">{m.name}</span>
                </span>
              </td>
              {m.thisWeek.days.map((d) => (
                <td
                  key={d.date}
                  className={`border-t border-gray-100 px-1 py-2 ${d.date === today ? "bg-indigo-50" : ""} ${
                    d.inWindow ? "" : "opacity-50"
                  }`}
                >
                  {d.certified ? (
                    <span className="flex flex-col items-center leading-tight">
                      <span className="font-bold text-emerald-500">✓</span>
                      <span className="text-[11px] text-emerald-600">{shortTime(d.seconds)}</span>
                    </span>
                  ) : d.seconds > 0 ? (
                    <span className="text-[11px] text-gray-400">{shortTime(d.seconds)}</span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
