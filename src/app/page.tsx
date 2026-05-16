"use client";

import { useState } from "react";
import type { SlotMinutes } from "@/lib/datetime";

type Candidate = { date: string; startTime: string; endTime: string };

const DEFAULT_CANDIDATE: Candidate = { date: "", startTime: "10:00", endTime: "17:00" };

export default function HomePage() {
  const [name, setName] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([{ ...DEFAULT_CANDIDATE }]);
  const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  function updateCandidate(i: number, field: keyof Candidate, value: string) {
    setCandidates((cur) => cur.map((c, j) => j === i ? { ...c, [field]: value } : c));
  }
  function addCandidate() {
    setCandidates((cur) => [...cur, { ...DEFAULT_CANDIDATE }]);
  }
  function removeCandidate(i: number) {
    setCandidates((cur) => cur.length <= 1 ? cur : cur.filter((_, j) => j !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("イベント名を入力してください"); return; }
    const valid = candidates.filter((c) => c.date.trim() && c.startTime && c.endTime && c.startTime < c.endTime);
    if (!valid.length) { setError("候補日時を正しく入力してください（開始 < 終了）"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), candidates: valid, slotMinutes }),
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
        <input
          readOnly value={createdUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 mb-4"
        />
        <div className="flex gap-3">
          <a href={createdUrl} className="text-sm text-blue-600 underline">ページを開く</a>
          <button type="button"
            onClick={() => { setCreatedUrl(null); setName(""); setCandidates([{ ...DEFAULT_CANDIDATE }]); }}
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

        <div>
          <label className="block text-sm font-medium mb-2">候補日時</label>
          <div className="space-y-3">
            {candidates.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                  <input type="date" value={c.date} onChange={(e) => updateCandidate(i, "date", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  <button type="button" onClick={() => removeCandidate(i)} disabled={candidates.length <= 1}
                    className="text-xs text-gray-400 disabled:opacity-30 hover:text-red-500">削除</button>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <input type="time" value={c.startTime} onChange={(e) => updateCandidate(i, "startTime", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  <span className="text-gray-400 text-sm">〜</span>
                  <input type="time" value={c.endTime} onChange={(e) => updateCandidate(i, "endTime", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addCandidate} className="mt-2 text-sm text-blue-600 underline">
            候補日時を追加
          </button>
        </div>

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
