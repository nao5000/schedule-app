"use client";

import { useMemo, useState } from "react";
import type { SlotMinutes } from "@/lib/datetime";

type CreateResponse = { slug?: string; error?: string };

export default function HomePage() {
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [datesInput, setDatesInput] = useState<string[]>([""]);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const validDates = useMemo(
    () => datesInput.map((d) => d.trim()).filter((d) => d.length > 0),
    [datesInput]
  );

  function updateDate(i: number, v: string) {
    setDatesInput((cur) => cur.map((d, idx) => (idx === i ? v : d)));
  }

  function addDate() {
    setDatesInput((cur) => [...cur, ""]);
  }

  function removeDate(i: number) {
    setDatesInput((cur) => (cur.length <= 1 ? cur : cur.filter((_, idx) => idx !== i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedUrl(null);
    setCopied(false);

    if (!name.trim()) {
      setError("ミーティング名を入力してください");
      return;
    }
    if (validDates.length === 0) {
      setError("候補日を1つ以上入力してください");
      return;
    }
    if (!startTime || !endTime || startTime >= endTime) {
      setError("開始時刻は終了時刻より前にしてください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          memo: memo.trim(),
          dates: validDates,
          startTime,
          endTime,
          slotMinutes,
        }),
      });
      const data = (await res.json()) as CreateResponse;
      if (!res.ok || !data.slug) {
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      const url = `${window.location.origin}/e/${data.slug}`;
      setCreatedUrl(url);
    } catch (err) {
      setError(`通信エラー: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("コピーに失敗しました。手動でコピーしてください。");
    }
  }

  return (
    <main>
      <h1 className="text-2xl font-bold mb-1">日程調整を作成</h1>
      <p className="text-sm text-gray-600 mb-6">
        候補日時を入力すると共有URLが発行されます。参加者はURLから名前を入れて OK / NG を回答します。
      </p>

      {createdUrl ? (
        <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-lg font-semibold mb-2">共有URLが発行されました</h2>
          <p className="text-sm text-gray-600 mb-3">
            このURLを参加者に共有してください。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={createdUrl}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={copyUrl}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium active:bg-blue-700"
            >
              {copied ? "コピーしました" : "URLをコピー"}
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href={createdUrl}
              className="text-sm text-blue-600 underline"
            >
              共有ページを開く
            </a>
            <button
              type="button"
              onClick={() => {
                setCreatedUrl(null);
                setName("");
                setMemo("");
                setDatesInput([""]);
              }}
              className="text-sm text-gray-600 underline"
            >
              新しく作成する
            </button>
          </div>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white shadow-sm border border-gray-200 p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">ミーティング名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 4月キックオフMTG"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">メモ（任意）</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="場所、目的、URLなど"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">候補日</label>
          <div className="space-y-2">
            {datesInput.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="date"
                  value={d}
                  onChange={(e) => updateDate(i, e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base"
                />
                <button
                  type="button"
                  onClick={() => removeDate(i)}
                  disabled={datesInput.length <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-40"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addDate}
            className="mt-2 text-sm text-blue-600 underline"
          >
            候補日を追加
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">開始時刻</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">終了時刻</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">時間枠</label>
          <div className="flex gap-2">
            {([15, 30, 60] as SlotMinutes[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSlotMinutes(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  slotMinutes === m
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                {m}分
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 text-base active:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "作成中..." : "日程調整を作成する"}
        </button>
      </form>
    </main>
  );
}
