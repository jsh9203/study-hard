"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/upload", label: "인증", icon: "📸" },
  { href: "/users", label: "멤버", icon: "👥" },
];

// 모바일 하단 고정 탭바
export default function NavMenu() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center py-2 text-xs ${active ? "font-semibold text-indigo-600" : "text-gray-500"}`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="mt-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
