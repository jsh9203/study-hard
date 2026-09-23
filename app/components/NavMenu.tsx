"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/upload", label: "인증", icon: "📸" },
  { href: "/users", label: "멤버", icon: "👥" },
];

const TAB = "flex w-full flex-col items-center py-2 text-xs";

// 모바일 하단 고정 탭바
export default function NavMenu() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  // 이 기기의 로그인(1년 유지) 해제 → 다시 PIN 입력
  // 전체 새로고침 + replace: 클라이언트 캐시와 뒤로 가기로 잠긴 화면이 보이지 않게
  async function lock() {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    window.location.replace("/login");
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link href={item.href} className={`${TAB} ${active ? "font-semibold text-indigo-600" : "text-gray-500"}`}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="mt-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button type="button" onClick={lock} className={`${TAB} text-gray-400 hover:text-gray-700`}>
            <span className="text-lg leading-none">🔒</span>
            <span className="mt-1">잠금</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
