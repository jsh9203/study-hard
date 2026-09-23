"use client";

import { useState } from "react";
import { isWeekend, isYmd, todayKST } from "@/lib/date";
import type { GoalSummary } from "@/lib/goal";
import { SERVICE_START } from "@/lib/rules";

export interface GoalInput {
  examName: string;
  target: string;
  startDate: string;
  examDate: string;
  resultDate: string | null;
}

function defaultStartDate(): string {
  const today = todayKST();
  return today < SERVICE_START ? SERVICE_START : today;
}

// 폼 입력값 검증 (API 에서도 다시 검증함)
function validate(v: GoalInput): { startDate?: string; examDate?: string; resultDate?: string } {
  const errors: { startDate?: string; examDate?: string; resultDate?: string } = {};
  if (!isYmd(v.startDate)) errors.startDate = "시작일을 선택하세요";
  else if (v.startDate < SERVICE_START) errors.startDate = `시작일은 ${SERVICE_START} 이후여야 합니다`;
  else if (isWeekend(v.startDate)) errors.startDate = "토·일요일은 시작일로 선택할 수 없습니다 (평일만 가능)";

  if (!isYmd(v.examDate)) errors.examDate = "시험일을 선택하세요";
  else if (isYmd(v.startDate) && v.examDate < v.startDate) errors.examDate = "시험일은 시작일 이후여야 합니다";

  if (v.resultDate) {
    if (!isYmd(v.resultDate)) errors.resultDate = "날짜 형식이 올바르지 않습니다";
    else if (isYmd(v.examDate) && v.resultDate < v.examDate) errors.resultDate = "결과 발표일은 시험일 이후여야 합니다";
  }
  return errors;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default function GoalForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: GoalSummary;
  submitLabel: string;
  onSubmit: (input: GoalInput) => Promise<string | null>; // 에러 메시지 반환
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<GoalInput>({
    examName: initial?.examName ?? "",
    target: initial?.target ?? "",
    startDate: initial?.startDate ?? defaultStartDate(),
    examDate: initial?.examDate ?? "",
    resultDate: initial?.resultDate ?? null,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const errors = validate(values);
  const valid = values.examName.trim() !== "" && values.target.trim() !== "" && Object.keys(errors).length === 0;

  function set<K extends keyof GoalInput>(key: K, value: GoalInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    const message = await onSubmit({
      ...values,
      examName: values.examName.trim(),
      target: values.target.trim(),
      resultDate: values.resultDate || null,
    });
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">시험명</span>
        <input
          value={values.examName}
          onChange={(e) => set("examName", e.target.value)}
          maxLength={50}
          placeholder="예: 정보처리기사 필기"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">목표</span>
        <input
          value={values.target}
          onChange={(e) => set("target", e.target.value)}
          maxLength={50}
          placeholder="예: 합격, 900점 이상"
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0">
          <span className="mb-1 block text-sm font-medium text-gray-700">시작일 (평일)</span>
          <input
            type="date"
            value={values.startDate}
            min={SERVICE_START}
            onChange={(e) => set("startDate", e.target.value)}
            className={`${inputClass} ${errors.startDate ? "border-red-400" : ""}`}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-sm font-medium text-gray-700">시험일 (D-day)</span>
          <input
            type="date"
            value={values.examDate}
            min={values.startDate || SERVICE_START}
            onChange={(e) => set("examDate", e.target.value)}
            className={`${inputClass} ${values.examDate && errors.examDate ? "border-red-400" : ""}`}
          />
        </label>
      </div>
      {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
      {values.examDate && errors.examDate && <p className="text-xs text-red-500">{errors.examDate}</p>}
      <p className="text-xs text-gray-500">첫 주 목표: 월5·화4·수3·목2·금1회 (둘째 주부터 주 5회)</p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          결과 발표일 <span className="font-normal text-gray-400">(선택)</span>
        </span>
        <input
          type="date"
          value={values.resultDate ?? ""}
          min={values.examDate || undefined}
          onChange={(e) => set("resultDate", e.target.value || null)}
          className={`${inputClass} ${errors.resultDate ? "border-red-400" : ""}`}
        />
      </label>
      {errors.resultDate && <p className="text-xs text-red-500">{errors.resultDate}</p>}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
          >
            취소
          </button>
        )}
        <button
          disabled={!valid || saving}
          className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "저장 중…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
