"use client";

import { useState } from "react";
import type { SlotMinutes } from "@/lib/datetime";
import { WEEKDAY_REFERENCE_DATES } from "@/lib/datetime";

type Mode = "date" | "weekday";
type DateCandidate = { date: string; startTime: string; endTime: string };
type WeekdayCandidate = { weekday: number; startTime: string; endTime: string };

const WEEKDAYS = [
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
  { label: "日", value: 0 },
];

const DEFAULT_TIME = { startTime: "10:00", endTime: "17:00" };

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("date");
  const [name, setName] = useState("");
  const [dateCandidates, setDateCandidates] = useState<DateCandidate[]>([{ date: "", ...DEFAULT_TIME }]);
  const [weekdayCandidates, setWeekdayCandidates] = useState<WeekdayCandidate[]>([{ weekday: 1, ...DEFAULT_TIME }]);
  const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  // 特定日モード
  function updateDate(i: number, field: keyof DateCandidate, v: string) {
    setDateCandidates((cur) => cur.map((c, j) => j === i ? { ...c, [field]: v } : c));
  }
  function addDateCandidate() { setDateCandidates((c) => [...c, { date: "", ...DEFAULT_TIME }]); }
  function removeDateCandidate(i: number) { setDateCandidates((c) => c.length <= 1 ? c : c.filter((_, j) => j !== i)); }

  // 曜日モード
  function updateWeekday(i: number, field: keyof WeekdayCandidate, v: string | number) {
    setWeekdayCandidates((cur) => cur.map((c, j) => j === i ? { ...c, [field]: v } : c));
  }
  function addWeekdayCandidate() { setWeekdayCandidates((c) => [...c, { weekday: 1, ...DEFAULT_TIME }]); }
  function removeWeekdayCandidate(i: number) { setWeekdayCandidates((c) => c.length <= 1 ? c : c.filter((_, j) => j !== i)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("イベント名を入力してください"); return; }

    let candidates: DateCandidate[];
    if (mode === "date") {
      candidates = dateCandidates.filter((c) => c.date.trim() && c.startTime && c.endTime && c.startTime < c.endTime);
      if (!candidates.length) { setError("候補日時を正しく入力してください"); return; }
    } else {
      candidates = weekdayCandidates
        .filter((c) => c.startTime && c.endTime && c.startTime < c.endTime)
        .map((c) => ({ date: WEEKDAY_REFERENCE_DATES[c.weekday], startTime: c.startTime, endTime: c.endTime }));
      if (!candidates.length) { setError("候補曜日・時間を正しく入力してください"); return; }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), candidates, slotMinutes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "作成に失敗しました"); return; }
      setCreatedUrl(`${window.location.origin}/e/${data.slug}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (createdUrl) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-4">作成しました</h1>
        <p className="text-sm text-gray-600 mb-3">このURLを参加者に共有してください。</p>
        <input readOnly value={createdUrl} onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 mb-4" />
        <div className="flex gap-3">
          <a href={createdUrl} className="text-sm text-blue-600 underline">ページを開く</a>
          <button type="button" onClick={() => { setCreatedUrl(null); setName(""); setDateCandidates([{ date: "", ...DEFAULT_TIME }]); setWeekdayCandidates([{ weekday: 1, ...DEFAULT_TIME }]); }}
            className="text-sm text-gray-600 underline">新しく作成する</button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">日程調整を作成</h1>
      <form onSubmit={submit} className="space-y-5">

        <div>
          <label className="block text-sm font-medium mb-1">イベント名</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="例: チームMTG"
            className="w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>

        {/* モード切替 */}
        <div>
          <label className="block text-sm font-medium mb-2">候補の種類</label>
          <div className="flex gap-2">
            {(["date", "weekday"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === m ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"
                }`}>
                {m === "date" ? "特定の日付" : "曜日で指定"}
              </button>
            ))}
          </div>
        </div>

        {/* 特定日モード */}
        {mode === "date" && (
          <div>
            <label className="block text-sm font-medium mb-2">候補日時</label>
            <div className="space-y-3">
              {dateCandidates.map((c, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                    <input type="date" value={c.date} onChange={(e) => updateDate(i, "date", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                    <button type="button" onClick={() => removeDateCandidate(i)} disabled={dateCandidates.length <= 1}
                      className="text-xs text-gray-400 disabled:opacity-30 hover:text-red-500">削除</button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <input type="time" value={c.startTime} onChange={(e) => updateDate(i, "startTime", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input type="time" value={c.endTime} onChange={(e) => updateDate(i, "endTime", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addDateCandidate} className="mt-2 text-sm text-blue-600 underline">
              候補日時を追加
            </button>
          </div>
        )}

        {/* 曜日モード */}
        {mode === "weekday" && (
          <div>
            <label className="block text-sm font-medium mb-2">候補曜日・時間</label>
            <div className="space-y-3">
              {weekdayCandidates.map((c, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                    <div className="flex gap-1 flex-wrap flex-1">
                      {WEEKDAYS.map((w) => (
                        <button key={w.value} type="button" onClick={() => updateWeekday(i, "weekday", w.value)}
                          className={`rounded px-2.5 py-1 text-sm font-medium border ${
                            c.weekday === w.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"
                          }`}>
                          {w.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => removeWeekdayCandidate(i)} disabled={weekdayCandidates.length <= 1}
                      className="text-xs text-gray-400 disabled:opacity-30 hover:text-red-500">削除</button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <input type="time" value={c.startTime} onChange={(e) => updateWeekday(i, "startTime", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input type="time" value={c.endTime} onChange={(e) => updateWeekday(i, "endTime", e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addWeekdayCandidate} className="mt-2 text-sm text-blue-600 underline">
              候補を追加
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">時間枠</label>
          <div className="flex gap-2">
            {([15, 30, 60] as SlotMinutes[]).map((m) => (
              <button key={m} type="button" onClick={() => setSlotMinutes(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  slotMinutes === m ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"
                }`}>
                {m}分
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 disabled:opacity-60">
          {loading ? "作成中..." : "作成する"}
        </button>
      </form>
    </main>
  );
}
