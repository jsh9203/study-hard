"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PageShell from "@/app/components/PageShell";
import { todayKST } from "@/lib/date";
import { formatShortDate } from "@/lib/format";

interface User {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  return (await res.json().catch(() => ({}))).error ?? fallback;
}

async function fetchUsers(): Promise<{ users?: User[]; error?: string }> {
  const fallback = "멤버 목록을 불러오지 못했습니다";
  const res = await fetch("/api/users", { cache: "no-store" }).catch(() => null);
  if (!res) return { error: "네트워크 오류" };
  if (!res.ok) return { error: await errorOf(res, fallback) };
  return { users: (await res.json()).users };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const apply = useCallback((result: { users?: User[]; error?: string }) => {
    if (result.users) setUsers(result.users);
    setLoadError(result.error ?? "");
  }, []);

  const load = useCallback(async () => apply(await fetchUsers()), [apply]);

  useEffect(() => {
    let cancelled = false;
    fetchUsers().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setFormError(res ? await errorOf(res, "추가하지 못했습니다") : "네트워크 오류");
      return;
    }
    setName("");
    await load();
  }

  async function remove(user: User) {
    if (!confirm(`'${user.name}' 멤버를 삭제할까요?\n공부 기록과 사진은 보존되지만 목록에서 사라집니다.`)) return;
    setDeletingId(user.id);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" }).catch(() => null);
    setDeletingId(null);
    if (!res?.ok) {
      alert(res ? await errorOf(res, "삭제하지 못했습니다") : "네트워크 오류");
      return;
    }
    await load();
  }

  return (
    <PageShell title="👥 멤버">
      <form onSubmit={add} className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">새 멤버 추가</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="이름 (1~20자)"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            disabled={!name.trim() || saving}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "추가 중…" : "추가"}
          </button>
        </div>
        {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}
      </form>

      {loadError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {loadError}
          <button onClick={load} className="ml-2 font-medium underline">
            다시 시도
          </button>
        </div>
      )}

      {users === null && !loadError && <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>}

      {users?.length === 0 && (
        <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          아직 멤버가 없습니다. 위에서 추가하세요.
        </p>
      )}

      {users && users.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/users/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white"
                  style={{ backgroundColor: user.color ?? "#6366f1" }}
                >
                  {user.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block text-xs text-gray-400">
                    가입 {formatShortDate(todayKST(new Date(user.createdAt)))}
                  </span>
                </span>
                <span className="ml-auto text-gray-300">›</span>
              </Link>
              <button
                onClick={() => remove(user)}
                disabled={deletingId === user.id}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
