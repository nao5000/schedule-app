"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDateHeader, formatTimeRange, dateKey, isWeekdayMode, formatWeekdayHeader } from "@/lib/datetime";

type Slot = { id: string; start_at: string; end_at: string };
type Participant = { id: string; name: string };
type ResponseRow = { id: string; participant_id: string; time_slot_id: string; status: "ok" | "ng" };
type EventDetail = {
  event: { id: string; slug: string; name: string; slot_minutes: number };
  slots: Slot[];
  participants: Participant[];
  responses: ResponseRow[];
};

export default function EventPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const router = useRouter();

  const [data, setData] = useState<EventDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [answers, setAnswers] = useState<Record<string, "ok" | "ng" | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${slug}`, { cache: "no-store" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setLoadError(j.error ?? "取得に失敗しました"); return; }
      setData(await res.json());
    } catch (err) { setLoadError(String(err)); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  function loadMyAnswers(name: string) {
    if (!data) return;
    const me = data.participants.find((p) => p.name === name.trim());
    const init: Record<string, "ok" | "ng" | null> = {};
    for (const s of data.slots) init[s.id] = null;
    if (me) {
      for (const r of data.responses) {
        if (r.participant_id === me.id) init[r.time_slot_id] = r.status;
      }
    }
    setAnswers(init);
  }

  function toggle(slotId: string, value: "ok" | "ng") {
    setAnswers((cur) => ({ ...cur, [slotId]: cur[slotId] === value ? null : value }));
  }

  async function submit() {
    if (!slug) return;
    setSubmitErr(null); setSubmitMsg(null);
    if (!myName.trim()) { setSubmitErr("名前を入力してください"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${slug}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: myName.trim(), answers }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setSubmitErr(j.error ?? "保存に失敗しました"); return; }
      setSubmitMsg("回答を保存しました");
      await load();
    } catch (err) { setSubmitErr(String(err)); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!slug || !window.confirm("このイベントを削除しますか？")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${slug}`, { method: "DELETE" });
      if (res.ok) { router.push("/"); return; }
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "削除に失敗しました");
    } catch { alert("削除に失敗しました"); } finally { setDeleting(false); }
  }

  // 日付ごとにグルーピング
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Slot[]>();
    for (const s of data.slots) {
      const k = dateKey(s.start_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [data]);

  // slot_id → { participant_id → status }
  const responseMap = useMemo(() => {
    if (!data) return {} as Record<string, Record<string, "ok" | "ng">>;
    const m: Record<string, Record<string, "ok" | "ng">> = {};
    for (const r of data.responses) {
      if (!m[r.time_slot_id]) m[r.time_slot_id] = {};
      m[r.time_slot_id][r.participant_id] = r.status;
    }
    return m;
  }, [data]);

  if (loadError) return <main className="max-w-2xl mx-auto px-4 py-8"><p className="text-red-600">{loadError}</p></main>;
  if (!data) return <main className="max-w-2xl mx-auto px-4 py-8"><p className="text-gray-500">読み込み中...</p></main>;

  const { event, slots, participants } = data;
  const weekdayMode = slots.length > 0 && isWeekdayMode(slots[0].start_at);
  const headerLabel = (startAt: string) => weekdayMode ? formatWeekdayHeader(startAt) : formatDateHeader(startAt);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold mb-1">{event.name}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">参加者 {participants.length}人</span>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="text-red-500 underline text-xs disabled:opacity-50">
            {deleting ? "削除中..." : "イベントを削除"}
          </button>
        </div>
      </div>

      {/* 回答フォーム */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">回答する</h2>
        <div className="flex gap-2">
          <input type="text" value={myName} onChange={(e) => setMyName(e.target.value)}
            placeholder="お名前"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => loadMyAnswers(myName)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm">読込</button>
        </div>

        <div className="space-y-4">
          {grouped.map(([dKey, daySlots]) => (
            <div key={dKey}>
              <p className="text-sm font-semibold text-gray-700 mb-2">{headerLabel(daySlots[0].start_at)}</p>
              <div className="space-y-2">
                {daySlots.map((s) => {
                  const cur = answers[s.id] ?? null;
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-gray-800">{formatTimeRange(s.start_at, s.end_at)}</span>
                      <button type="button" onClick={() => toggle(s.id, "ok")}
                        className={`rounded-lg px-4 py-1.5 text-sm font-medium border ${cur === "ok" ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-300 text-gray-700"}`}>
                        OK
                      </button>
                      <button type="button" onClick={() => toggle(s.id, "ng")}
                        className={`rounded-lg px-4 py-1.5 text-sm font-medium border ${cur === "ng" ? "bg-red-600 border-red-600 text-white" : "border-gray-300 text-gray-700"}`}>
                        NG
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {submitErr && <p className="text-sm text-red-600">{submitErr}</p>}
        {submitMsg && <p className="text-sm text-emerald-700">{submitMsg}</p>}

        <button type="button" onClick={submit} disabled={submitting}
          className="w-full rounded-xl bg-blue-600 text-white font-semibold py-2.5 text-sm disabled:opacity-60">
          {submitting ? "保存中..." : "回答を保存する"}
        </button>
      </section>

      {/* 集計テーブル */}
      {participants.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold mb-3">集計</h2>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr>
                  <th className="text-left pr-4 py-1 text-gray-600 font-medium whitespace-nowrap">時間</th>
                  {participants.map((p) => (
                    <th key={p.id} className="px-2 py-1 text-gray-600 font-medium whitespace-nowrap">{p.name}</th>
                  ))}
                  <th className="px-2 py-1 text-gray-600 font-medium">OK</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([dKey, daySlots]) => (
                  <>
                    <tr key={`h-${dKey}`}>
                      <td colSpan={participants.length + 2}
                        className="pt-3 pb-1 text-xs font-semibold text-gray-500">
                        {headerLabel(daySlots[0].start_at)}
                      </td>
                    </tr>
                    {daySlots.map((s) => {
                      const row = responseMap[s.id] ?? {};
                      const okCount = participants.filter((p) => row[p.id] === "ok").length;
                      const allOk = participants.length > 0 && okCount === participants.length;
                      return (
                        <tr key={s.id} className={allOk ? "bg-emerald-50" : ""}>
                          <td className="pr-4 py-1.5 whitespace-nowrap">
                            {formatTimeRange(s.start_at, s.end_at)}
                            {allOk && <span className="ml-2 text-xs bg-emerald-600 text-white rounded px-1 py-0.5">全員OK</span>}
                          </td>
                          {participants.map((p) => {
                            const st = row[p.id];
                            return (
                              <td key={p.id} className="px-2 py-1.5 text-center">
                                {st === "ok" ? <span className="text-emerald-700 font-semibold">OK</span>
                                  : st === "ng" ? <span className="text-red-600">NG</span>
                                  : <span className="text-gray-400">-</span>}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center text-gray-700">{okCount}</td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
