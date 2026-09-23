// 날짜는 모두 KST 기준 "YYYY-MM-DD" 문자열로 다룬다. (Vercel 서버는 UTC)
const DAY_MS = 86_400_000;

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayKST(now: Date = new Date()): string {
  return kstFormatter.format(now);
}

export function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toDate(value).toISOString().startsWith(value);
}

// "YYYY-MM-DD" ↔ Prisma @db.Date 값 (UTC 자정)
export function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

export function fromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return fromDate(new Date(toDate(ymd).getTime() + days * DAY_MS));
}

export function diffDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

// 월=1 … 일=7
export function isoWeekday(ymd: string): number {
  const d = toDate(ymd).getUTCDay();
  return d === 0 ? 7 : d;
}

export function isWeekend(ymd: string): boolean {
  return isoWeekday(ymd) >= 6;
}

export function weekStart(ymd: string): string {
  return addDays(ymd, 1 - isoWeekday(ymd));
}

export function weekEnd(ymd: string): string {
  return addDays(weekStart(ymd), 6);
}

export function minYmd(a: string, b: string): string {
  return a < b ? a : b;
}

export function maxYmd(a: string, b: string): string {
  return a > b ? a : b;
}

// D-day 표시: 시험일까지 남은 일수 (당일 0, 지나면 음수)
export function dDay(examDate: string, today: string = todayKST()): number {
  return diffDays(today, examDate);
}
