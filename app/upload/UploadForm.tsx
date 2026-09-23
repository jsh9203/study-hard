"use client";

import { upload } from "@vercel/blob/client";
import imageCompression from "browser-image-compression";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDuration, formatHms, formatShortDate } from "@/lib/format";
import { CERTIFY_SECONDS, SERVICE_START } from "@/lib/rules";

type User = { id: number; name: string; color: string | null; createdAt: string };
type Log = {
  id: number;
  userId: number;
  userName: string;
  studyDate: string;
  durationSec: number;
  photoUrl: string;
  memo: string | null;
  createdAt: string;
};
type Photo = { file: File; previewUrl: string; originalSize: number };
type Success = { userName: string; studyDate: string; totalSec: number };

const LAST_USER_KEY = "studyhard:lastUserId";
const MAX_MEMO = 200;
const MAX_SECONDS = 86_400;

function readLastUser(): number | null {
  try {
    const v = Number(window.localStorage.getItem(LAST_USER_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function saveLastUser(id: number) {
  try {
    window.localStorage.setItem(LAST_USER_KEY, String(id));
  } catch {
    // 저장 불가(사파리 개인정보 보호 모드 등) — 무시
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return data as T;
}

function toInt(value: string): number {
  return value === "" ? 0 : Number(value);
}

// Blob 토큰 발급 실패 시 원인 확인 (라이브러리 에러 메시지만으로는 원인을 알 수 없음)
async function diagnoseUpload(original: string): Promise<string> {
  try {
    const res = await fetch("/api/upload", { cache: "no-store" });
    if (res.status === 401) return "로그인이 만료되었습니다. 🔒 잠금 후 다시 로그인해 주세요.";
    const data = await res.json().catch(() => null);
    if (!data) return `업로드 서버 응답이 올바르지 않습니다 (HTTP ${res.status})`;
    if (!data.tokenConfigured) return "서버에 BLOB_READ_WRITE_TOKEN 이 설정되지 않았습니다 (Vercel 환경변수 확인 후 재배포)";
    return `사진 업로드 토큰 발급 실패: ${data.lastError ?? original}`;
  } catch {
    return original;
  }
}

export default function UploadForm({ today }: { today: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [usersError, setUsersError] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [studyDate, setStudyDate] = useState(today);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [memo, setMemo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Success | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const [recent, setRecent] = useState<{ key: string; logs: Log[]; error: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // 멤버 목록 + 마지막 선택 복원
  useEffect(() => {
    let cancelled = false;
    apiJson<{ users: User[] }>("/api/users")
      .then(({ users }) => {
        if (cancelled) return;
        setUsers(users);
        const last = readLastUser();
        if (last && users.some((u) => u.id === last)) setUserId(last);
        else if (users.length === 1) setUserId(users[0].id);
      })
      .catch((e: Error) => !cancelled && setUsersError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택 멤버의 최근 인증
  const recentKey = userId ? `${userId}:${reloadKey}` : null;
  useEffect(() => {
    if (!recentKey || !userId) return;
    let cancelled = false;
    apiJson<{ logs: Log[] }>(`/api/logs?userId=${userId}&limit=10`)
      .then(({ logs }) => !cancelled && setRecent({ key: recentKey, logs, error: "" }))
      .catch((e: Error) => !cancelled && setRecent({ key: recentKey, logs: [], error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [recentKey, userId]);

  // 언마운트 시 미리보기 URL 해제
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function replacePhoto(next: Photo | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next?.previewUrl ?? null;
    setPhoto(next);
  }

  function selectUser(id: number) {
    setUserId(id);
    setSuccess(null);
    saveLastUser(id);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setError("");
    setSuccess(null);
    if (!original.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있습니다");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await imageCompression(original, {
        maxWidthOrHeight: 1280,
        maxSizeMB: 0.4,
        fileType: "image/jpeg",
        initialQuality: 0.75,
        useWebWorker: true,
      });
      const file = new File([compressed], "photo.jpg", { type: "image/jpeg" });
      replacePhoto({ file, previewUrl: URL.createObjectURL(file), originalSize: original.size });
    } catch (err) {
      replacePhoto(null);
      setError(`사진 압축에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCompressing(false);
    }
  }

  const h = toInt(hours);
  const m = toInt(minutes);
  const s = toInt(seconds);
  const timeValid =
    Number.isInteger(h) && Number.isInteger(m) && Number.isInteger(s) && h >= 0 && m >= 0 && m < 60 && s >= 0 && s < 60;
  const totalSec = timeValid ? h * 3600 + m * 60 + s : 0;
  const certified = totalSec >= CERTIFY_SECONDS;
  const dateValid = studyDate >= SERVICE_START && studyDate <= today && /^\d{4}-\d{2}-\d{2}$/.test(studyDate);

  const selectedUser = users?.find((u) => u.id === userId) ?? null;
  const canSubmit =
    !!selectedUser && !!photo && !compressing && !submitting && dateValid && timeValid && totalSec > 0 && totalSec <= MAX_SECONDS;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    if (!selectedUser) return setError("멤버를 선택하세요");
    if (!photo) return setError("인증 사진을 선택하세요");
    if (!dateValid) return setError(`공부 날짜는 ${SERVICE_START} ~ 오늘 사이여야 합니다`);
    if (!timeValid) return setError("분·초는 0~59 사이 숫자로 입력하세요");
    if (totalSec <= 0) return setError("공부 시간을 입력하세요");
    if (totalSec > MAX_SECONDS) return setError("공부 시간은 24시간을 넘을 수 없습니다");

    setSubmitting(true);
    setProgress("사진 업로드 중… 0%");
    try {
      const blob = await upload(`logs/${selectedUser.id}/${studyDate}.jpg`, photo.file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "image/jpeg",
        onUploadProgress: ({ percentage }) => setProgress(`사진 업로드 중… ${Math.round(percentage)}%`),
      });

      setProgress("기록 저장 중…");
      await apiJson<{ log: Log }>("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          studyDate,
          durationSec: totalSec,
          photoUrl: blob.url,
          photoPath: blob.pathname,
          memo: memo.trim() || undefined,
        }),
      });

      // 그날 합계
      let dayTotal = totalSec;
      try {
        const { logs } = await apiJson<{ logs: Log[] }>(
          `/api/logs?userId=${selectedUser.id}&from=${studyDate}&to=${studyDate}&limit=200`,
        );
        dayTotal = logs.reduce((sum, l) => sum + l.durationSec, 0);
      } catch {
        // 합계 조회 실패 시 방금 입력한 시간만 표시
      }

      setSuccess({ userName: selectedUser.name, studyDate, totalSec: dayTotal });
      replacePhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setHours("");
      setMinutes("");
      setSeconds("");
      setMemo("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "업로드에 실패했습니다";
      setError(/client token/i.test(message) ? await diagnoseUpload(message) : message);
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  }

  async function onDelete(log: Log) {
    if (!confirm(`${formatShortDate(log.studyDate)} ${formatDuration(log.durationSec)} 기록을 삭제할까요?\n사진도 함께 삭제됩니다.`)) {
      return;
    }
    setDeletingId(log.id);
    try {
      await apiJson(`/api/logs/${log.id}`, { method: "DELETE" });
      setSuccess(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다");
    } finally {
      setDeletingId(null);
    }
  }

  const recentLoading = !!recentKey && recent?.key !== recentKey;
  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-indigo-500 disabled:bg-gray-50";

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4">
        {/* 1. 멤버 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">멤버</h2>
          {usersError ? (
            <p className="text-sm text-red-500">멤버 목록을 불러오지 못했습니다: {usersError}</p>
          ) : users === null ? (
            <p className="text-sm text-gray-400">불러오는 중…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500">
              등록된 멤버가 없습니다.{" "}
              <Link href="/users" className="text-indigo-600 underline">
                멤버 추가하기
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {users.map((u) => {
                const active = u.id === userId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => selectUser(u.id)}
                    disabled={submitting}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-indigo-400"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: u.color ?? "#9ca3af" }}
                    />
                    {u.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. 사진 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">인증 사진</h2>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${
              photo ? "border-indigo-300" : "border-gray-300"
            } bg-gray-50 text-gray-500`}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.previewUrl} alt="미리보기" className="max-h-80 w-full object-contain" />
            ) : (
              <span className="py-10 text-sm">{compressing ? "압축 중…" : "📷 탭해서 사진 촬영 / 선택"}</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              disabled={submitting || compressing}
              className="hidden"
            />
          </label>
          {photo && (
            <p className="mt-1.5 text-xs text-gray-500">
              {compressing ? "압축 중…" : `${formatBytes(photo.originalSize)} → ${formatBytes(photo.file.size)} (탭해서 다시 선택)`}
            </p>
          )}
        </section>

        {/* 3. 날짜 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">공부 날짜</h2>
          <input
            type="date"
            value={studyDate}
            min={SERVICE_START}
            max={today}
            onChange={(e) => setStudyDate(e.target.value)}
            disabled={submitting}
            className={inputCls}
          />
          {!dateValid && studyDate && (
            <p className="mt-1 text-xs text-red-500">
              {SERVICE_START} ~ {today} 사이 날짜만 선택할 수 있습니다
            </p>
          )}
        </section>

        {/* 4. 공부 시간 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">공부 시간</h2>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["시간", hours, setHours],
                ["분", minutes, setMinutes],
                ["초", seconds, setSeconds],
              ] as const
            ).map(([label, value, setValue]) => (
              <label key={label} className="relative block">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                  disabled={submitting}
                  aria-label={label}
                  className={`${inputCls} pr-10 text-right`}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-400">
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-gray-500">1시간 이상이면 인증일로 인정 (하루 합계 기준)</span>
            {totalSec > 0 && timeValid && (
              <span className={certified ? "font-semibold text-emerald-500" : "text-gray-500"}>
                {certified ? "✓ " : ""}
                {formatHms(totalSec)}
              </span>
            )}
          </div>
          {!timeValid && <p className="mt-1 text-xs text-red-500">분·초는 0~59 사이로 입력하세요</p>}
          {timeValid && totalSec > MAX_SECONDS && <p className="mt-1 text-xs text-red-500">24시간을 넘을 수 없습니다</p>}
        </section>

        {/* 5. 메모 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            메모 <span className="font-normal text-gray-400">(선택)</span>
          </h2>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO))}
            maxLength={MAX_MEMO}
            rows={2}
            placeholder="오늘 공부한 내용"
            disabled={submitting}
            className={`${inputCls} resize-none`}
          />
          <p className="text-right text-xs text-gray-400">
            {memo.length}/{MAX_MEMO}
          </p>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? progress || "업로드 중…" : "인증 업로드"}
        </button>
      </form>

      {success && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            success.totalSec >= CERTIFY_SECONDS
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-indigo-200 bg-indigo-50 text-indigo-700"
          }`}
        >
          <p className="font-semibold">✅ 업로드 완료!</p>
          <p className="mt-1">
            {success.userName} · {formatShortDate(success.studyDate)} 합계 {formatDuration(success.totalSec)} (
            {formatHms(success.totalSec)})
          </p>
          <p className="mt-1">
            {success.totalSec >= CERTIFY_SECONDS
              ? "✓ 인증일로 인정됩니다"
              : `인증까지 ${formatDuration(CERTIFY_SECONDS - success.totalSec)} 더 필요해요`}
          </p>
        </div>
      )}

      {/* 최근 인증 */}
      {selectedUser && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">{selectedUser.name}님의 최근 인증</h2>
          {recentLoading && !recent?.logs.length ? (
            <p className="text-sm text-gray-400">불러오는 중…</p>
          ) : recent?.error ? (
            <p className="text-sm text-red-500">{recent.error}</p>
          ) : !recent?.logs.length ? (
            <p className="text-sm text-gray-500">아직 인증 기록이 없습니다</p>
          ) : (
            <ul className={`divide-y divide-gray-100 ${recentLoading ? "opacity-60" : ""}`}>
              {recent.logs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 py-2.5">
                  <a href={log.photoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={log.photoUrl}
                      alt={`${log.studyDate} 인증 사진`}
                      loading="lazy"
                      className="h-14 w-14 rounded-lg bg-gray-100 object-cover"
                    />
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatShortDate(log.studyDate)}{" "}
                      <span className="text-gray-600">{formatDuration(log.durationSec)}</span>{" "}
                      <span className="text-xs text-gray-400">({formatHms(log.durationSec)})</span>
                    </p>
                    {log.memo && <p className="truncate text-xs text-gray-500">{log.memo}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(log)}
                    disabled={deletingId === log.id}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === log.id ? "삭제 중…" : "삭제"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
