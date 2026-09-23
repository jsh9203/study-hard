"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_TAGLINE, markSplashShown } from "@/app/components/Splash";

const MAX_LEN = 8;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"] as const;

// 로그인 후 돌아갈 경로 (외부 URL 로 튀지 않도록 내부 경로만 허용)
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [phase, setPhase] = useState<"intro" | "pin">("intro");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 인트로 1200ms 후 로고 축소 + 키패드 등장
  useEffect(() => {
    const t = setTimeout(() => setPhase("pin"), 1200);
    return () => clearTimeout(t);
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (!value || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: value }),
        });
        if (res.ok) {
          // 인트로를 방금 봤으므로 홈 스플래시는 건너뛴다
          markSplashShown();
          window.location.replace(nextPath());
          return;
        }
        setError(true);
        setPin("");
        setTimeout(() => setError(false), 600);
      } catch {
        setError(true);
        setTimeout(() => setError(false), 600);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting],
  );

  const press = useCallback(
    (key: string) => {
      if (phase !== "pin" || submitting) return;
      if (key === "del") setPin((p) => p.slice(0, -1));
      else if (key === "ok") submit(pin);
      else setPin((p) => (p.length < MAX_LEN ? p + key : p));
    },
    [phase, submitting, pin, submit],
  );

  // 물리 키보드 입력
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const isPin = phase === "pin";
  const dots = Math.max(4, pin.length);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Study Hard 로고"
        className={`rounded-full object-cover shadow-xl transition-all duration-700 ${isPin ? "h-24 w-24" : "h-64 w-64 sm:h-96 sm:w-96"}`}
      />
      <h1 className="mt-5 text-2xl font-bold text-gray-900">Study Hard</h1>
      <p className="mt-1.5 text-sm text-gray-400">{isPin ? "그룹 비밀번호를 입력하세요" : APP_TAGLINE}</p>

      <div
        className={`flex w-full max-w-xs flex-col items-center transition-all duration-700 ${
          isPin ? "mt-8 translate-y-0 opacity-100" : "pointer-events-none h-0 translate-y-4 overflow-hidden opacity-0"
        }`}
      >
        {/* 입력 표시 */}
        <div className={`flex h-4 items-center gap-3 ${error ? "animate-shake" : ""}`}>
          {Array.from({ length: dots }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-colors ${
                error ? "bg-red-400" : i < pin.length ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className={`mt-3 h-4 text-xs text-red-500 transition-opacity ${error ? "opacity-100" : "opacity-0"}`}>
          비밀번호가 맞지 않아요
        </p>

        {/* 키패드 */}
        <div className="mt-5 grid w-full grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={submitting}
              aria-label={k === "del" ? "지우기" : k === "ok" ? "확인" : k}
              className={`h-16 rounded-2xl text-2xl font-semibold transition-colors active:scale-95 disabled:opacity-60 ${
                k === "ok"
                  ? "bg-indigo-600 text-base text-white hover:bg-indigo-700 active:bg-indigo-800"
                  : k === "del"
                    ? "bg-white text-xl text-gray-400 hover:bg-gray-50 active:bg-gray-100"
                    : "bg-gray-50 text-gray-800 hover:bg-gray-100 active:bg-gray-200"
              }`}
            >
              {k === "del" ? "⌫" : k === "ok" ? (submitting ? "···" : "확인") : k}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
