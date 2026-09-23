"use client";

import { useEffect, useState } from "react";

export const SPLASH_KEY = "splashShown";
export const APP_TAGLINE = "주 5회 1시간 공부 · 못 채우면 벌금";

function wasShown(): boolean {
  try {
    return !!sessionStorage.getItem(SPLASH_KEY);
  } catch {
    return false;
  }
}

export function markSplashShown() {
  try {
    sessionStorage.setItem(SPLASH_KEY, "1");
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 다음에 한 번 더 재생될 뿐
  }
}

// 인트로 스플래시: 브라우저 세션당 1회
// 0ms 크게 표시 → 1000ms 축소·페이드 시작 → 1800ms 제거
export default function Splash({ children }: { children: React.ReactNode }) {
  const [splashDone, setSplashDone] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    if (wasShown()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage 는 클라이언트에서만 읽을 수 있음
    setSplashDone(false);
    const t1 = setTimeout(() => setSplashFading(true), 1000);
    const t2 = setTimeout(() => {
      setSplashDone(true);
      markSplashShown();
    }, 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <>
      {!splashDone && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-1000 ${splashFading ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Study Hard 로고"
            className={`rounded-full object-cover shadow-xl transition-all duration-1000 ${splashFading ? "h-10 w-10" : "h-64 w-64 sm:h-96 sm:w-96"}`}
          />
          <h1
            className={`mt-5 text-2xl font-bold text-gray-900 transition-all duration-1000 ${splashFading ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
          >
            Study Hard
          </h1>
          <p
            className={`mt-1.5 text-sm text-gray-400 transition-all delay-75 duration-1000 ${splashFading ? "opacity-0" : "opacity-100"}`}
          >
            {APP_TAGLINE}
          </p>
        </div>
      )}
      <div className={`transition-opacity duration-700 ${splashFading || splashDone ? "opacity-100" : "opacity-0"}`}>
        {children}
      </div>
    </>
  );
}
