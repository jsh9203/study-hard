"use client";

import { useEffect, useState } from "react";
import { APP_TAGLINE, markSplashShown } from "@/app/components/Splash";

// 로그인 후 돌아갈 경로 (외부 URL 로 튀지 않도록 내부 경로만 허용)
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [phase, setPhase] = useState<"intro" | "form">("intro");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 인트로 1200ms 후 로고 축소 + 입력 폼 등장
  useEffect(() => {
    const t = setTimeout(() => setPhase("form"), 1200);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => ({})))?.error ?? "로그인에 실패했어요");
      setPassword("");
      return;
    }
    // 인트로를 방금 봤으므로 홈 스플래시는 건너뛴다
    markSplashShown();
    window.location.replace(nextPath());
  }

  const isForm = phase === "form";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Study Hard 로고"
        className={`rounded-full object-cover shadow-xl transition-all duration-700 ${isForm ? "h-24 w-24" : "h-64 w-64 sm:h-96 sm:w-96"}`}
      />
      <h1 className="mt-5 text-2xl font-bold text-gray-900">Study Hard</h1>
      <p className="mt-1.5 text-sm text-gray-400">{isForm ? "그룹 비밀번호를 입력하세요" : APP_TAGLINE}</p>

      <form
        onSubmit={submit}
        className={`flex w-full max-w-xs flex-col transition-all duration-700 ${
          isForm ? "mt-8 translate-y-0 opacity-100" : "pointer-events-none h-0 translate-y-4 overflow-hidden opacity-0"
        }`}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={isForm}
          tabIndex={isForm ? 0 : -1}
          className={`w-full rounded-xl border px-4 py-3 text-center outline-none focus:border-indigo-500 ${error ? "border-red-400" : "border-gray-300"}`}
          placeholder="비밀번호"
        />
        <p className={`mt-2 h-4 text-center text-xs text-red-500 ${error ? "opacity-100" : "opacity-0"}`}>{error}</p>
        <button
          disabled={loading || !password}
          tabIndex={isForm ? 0 : -1}
          className="mt-3 w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "확인 중…" : "입장"}
        </button>
      </form>
    </main>
  );
}
