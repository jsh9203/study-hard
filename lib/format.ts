// 표시용 포맷 (클라이언트/서버 공용)
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function formatHms(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatDDay(days: number): string {
  if (days === 0) return "D-Day";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "2026-09-23" → "9/23(수)"
export function formatShortDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  const wd = WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
  return `${m}/${d}(${wd})`;
}
