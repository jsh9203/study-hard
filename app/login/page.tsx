"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "로그인 실패");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next?.startsWith("/") ? next : "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="mb-1 text-xl font-bold">📚 스터디 인증</h1>
        <p className="mb-5 text-sm text-gray-500">그룹 비밀번호를 입력하세요</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
          placeholder="비밀번호"
        />
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <button
          disabled={loading || !password}
          className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "확인 중…" : "입장"}
        </button>
      </form>
    </main>
  );
}
