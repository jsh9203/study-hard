import type { DashboardMember } from "@/lib/dashboard";
import { Avatar } from "./MemberCard";

const LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 멤버 열과 요일 열의 행 높이를 맞추기 위해 고정 높이 사용
const HEAD_H = "h-11";
const ROW_H = "h-12";

// 3600 → "1h", 5400 → "1.5h", 2400 → "40m"
function shortTime(sec: number): string {
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m`;
  return `${Math.round((sec / 3600) * 10) / 10}h`;
}

// 멤버 열은 고정, 요일 영역만 가로 스크롤
export default function WeekTable({ members, today }: { members: DashboardMember[]; today: string }) {
  const dates = members[0]?.thisWeek.days.map((d) => d.date) ?? [];
  return (
    <div className="flex text-sm">
      {/* 멤버 열: 모바일은 아바타 + 한글 세 글자 + 약간의 여백 */}
      <div className="w-[5.25rem] shrink-0 sm:w-32">
        <div className={`${HEAD_H} flex items-center text-xs font-medium text-gray-500`}>멤버</div>
        {members.map((m) => (
          <div key={m.id} className={`${ROW_H} flex items-center gap-1.5 border-t border-gray-100 pr-1.5`}>
            <Avatar name={m.name} color={m.color} size="sm" />
            <span className="min-w-0 truncate font-medium text-gray-800" title={m.name}>
              {m.name}
            </span>
          </div>
        ))}
      </div>

      {/* 요일 영역 */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[17.5rem] table-fixed border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              {dates.map((date, i) => (
                <th
                  key={date}
                  className={`${HEAD_H} text-xs font-medium ${
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
                {m.thisWeek.days.map((d) => (
                  <td
                    key={d.date}
                    className={`${ROW_H} border-t border-gray-100 px-0.5 ${d.date === today ? "bg-indigo-50" : ""} ${
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
    </div>
  );
}
