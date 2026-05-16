"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  dateKey,
  formatDateHeader,
  formatTimeRange,
} from "@/lib/datetime";

type Slot = {
  id: string;
  event_id: string;
  start_at: string;
  end_at: string;
};

type Participant = {
  id: string;
  name: string;
};

type ResponseRow = {
  id: string;
  participant_id: string;
  time_slot_id: string;
  status: "ok" | "ng";
};

type EventDetail = {
  event: {
    id: string;
    slug: string;
    name: string;
    memo: string | null;
    slot_minutes: number;
  };
  slots: Slot[];
  participants: Participant[];
  responses: ResponseRow[];
};

type Answer = "ok" | "ng" | "none";

export default function EventPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [myName, setMyName] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${slug}`, { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(j.error ?? "イベントの取得に失敗しました");
        return;
      }
      const d = (await res.json()) as EventDetail;
      setData(d);
    } catch (err) {
      setLoadError(`通信エラー: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // 既存参加者の回答を自分の回答に取り込む
  function loadMyAnswers(name: string) {
    if (!data) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setAnswers({});
      return;
    }
    const me = data.participants.find((p) => p.name === trimmed);
    if (!me) {
      // 新規 → すべて未回答
      const init: Record<string, Answer> = {};
      for (const s of data.slots) init[s.id] = "none";
      setAnswers(init);
      return;
    }
    const init: Record<string, Answer> = {};
    for (const s of data.slots) init[s.id] = "none";
    for (const r of data.responses) {
      if (r.participant_id === me.id) {
        init[r.time_slot_id] = r.status;
      }
    }
    setAnswers(init);
  }

  function setAnswer(slotId: string, value: Answer) {
    setAnswers((cur) => ({ ...cur, [slotId]: value }));
  }

  async function submit() {
    if (!slug) return;
    setSubmitErr(null);
    setSubmitMsg(null);
    if (!myName.trim()) {
      setSubmitErr("名前を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${slug}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: myName.trim(), answers }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitErr(j.error ?? "保存に失敗しました");
        return;
      }
      setSubmitMsg("回答を保存しました");
      await load();
    } catch (err) {
      setSubmitErr(`通信エラー: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShareUrl() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }

  // スロットごとの集計
  const stats = useMemo(() => {
    if (!data) return [] as Array<{
      slot: Slot;
      ok: number;
      ng: number;
      none: number;
      okNames: string[];
      ngNames: string[];
      noneNames: string[];
      allOk: boolean;
    }>;
    const total = data.participants.length;
    const byParticipant: Record<string, Participant> = {};
    for (const p of data.participants) byParticipant[p.id] = p;

    return data.slots.map((slot) => {
      let ok = 0;
      let ng = 0;
      const okNames: string[] = [];
      const ngNames: string[] = [];
      const answeredIds = new Set<string>();
      for (const r of data.responses) {
        if (r.time_slot_id !== slot.id) continue;
        answeredIds.add(r.participant_id);
        if (r.status === "ok") {
          ok++;
          okNames.push(byParticipant[r.participant_id]?.name ?? "?");
        } else if (r.status === "ng") {
          ng++;
          ngNames.push(byParticipant[r.participant_id]?.name ?? "?");
        }
      }
      const noneNames = data.participants
        .filter((p) => !answeredIds.has(p.id))
        .map((p) => p.name);
      const none = noneNames.length;
      const allOk = total > 0 && ok === total;
      return { slot, ok, ng, none, okNames, ngNames, noneNames, allOk };
    });
  }, [data]);

  // おすすめ順
  const recommended = useMemo(() => {
    return [...stats].sort((a, b) => {
      if (b.ok !== a.ok) return b.ok - a.ok;
      if (a.ng !== b.ng) return a.ng - b.ng;
      return new Date(a.slot.start_at).getTime() - new Date(b.slot.start_at).getTime();
    });
  }, [stats]);

  // 日付ごとにグルーピング（表示用）
  const grouped = useMemo(() => {
    const map = new Map<string, typeof stats>();
    for (const s of stats) {
      const k = dateKey(s.slot.start_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [stats]);

  if (loading) {
    return <p className="text-sm text-gray-600">読み込み中...</p>;
  }
  if (loadError) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        {loadError}
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-gray-600">データがありません</p>;
  }

  const totalParticipants = data.participants.length;
  const topOk = recommended[0]?.ok ?? 0;
  const top3 = recommended.filter((r) => r.ok > 0).slice(0, 3);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1 break-words">{data.event.name}</h1>
        {data.event.memo ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{data.event.memo}</p>
        ) : null}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">参加者 {totalParticipants}人</span>
          <button
            type="button"
            onClick={copyShareUrl}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium"
          >
            {copied ? "URLコピー済" : "共有URLをコピー"}
          </button>
        </div>
      </header>

      {/* おすすめ候補 */}
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-4">
        <h2 className="text-base font-semibold mb-3">おすすめ候補</h2>
        {totalParticipants === 0 ? (
          <p className="text-sm text-gray-600">まだ回答がありません。下のフォームから回答してみましょう。</p>
        ) : top3.length === 0 ? (
          <p className="text-sm text-gray-600">OKの回答がまだありません。</p>
        ) : (
          <ol className="space-y-2">
            {top3.map((r, i) => (
              <li
                key={r.slot.id}
                className={`rounded-xl border px-3 py-2 ${
                  r.allOk
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">
                      {i + 1}位{" "}
                      {r.allOk ? (
                        <span className="ml-1 inline-block rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">
                          全員OK
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-800">
                      {formatDateHeader(r.slot.start_at)} {formatTimeRange(r.slot.start_at, r.slot.end_at)}
                    </div>
                  </div>
                  <div className="text-right text-xs leading-tight">
                    <div className="text-emerald-700 font-semibold">OK {r.ok}</div>
                    <div className="text-red-600">NG {r.ng}</div>
                    <div className="text-gray-500">未 {r.none}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 回答フォーム */}
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-4">
        <h2 className="text-base font-semibold mb-3">あなたの回答</h2>
        <label className="block text-sm font-medium mb-1">お名前</label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="例: 山田"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
          <button
            type="button"
            onClick={() => loadMyAnswers(myName)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
          >
            読込
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          同じ名前で再回答すると、前回の回答を編集できます。
        </p>

        <div className="space-y-4">
          {grouped.map(([dKey, rows]) => (
            <div key={dKey}>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatDateHeader(rows[0].slot.start_at)}
              </div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const cur = answers[r.slot.id] ?? "none";
                  return (
                    <div
                      key={r.slot.id}
                      className={`rounded-xl border px-3 py-2 ${
                        r.allOk ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm font-medium">
                          {formatTimeRange(r.slot.start_at, r.slot.end_at)}
                          {r.allOk ? (
                            <span className="ml-2 inline-block rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">
                              全員OK
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-600">
                          <span className="text-emerald-700 font-semibold">OK {r.ok}</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-600">NG {r.ng}</span>
                          <span className="mx-1">/</span>
                          <span className="text-gray-500">未 {r.none}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["ok", "ng", "none"] as Answer[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAnswer(r.slot.id, v)}
                            className={`rounded-lg border py-2 text-sm font-medium ${
                              cur === v
                                ? v === "ok"
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : v === "ng"
                                    ? "border-red-600 bg-red-600 text-white"
                                    : "border-gray-500 bg-gray-500 text-white"
                                : "border-gray-300 bg-white text-gray-700"
                            }`}
                          >
                            {v === "ok" ? "OK" : v === "ng" ? "NG" : "未回答"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {submitErr ? (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {submitErr}
          </div>
        ) : null}
        {submitMsg ? (
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {submitMsg}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-blue-600 text-white font-semibold py-3 text-base active:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "保存中..." : "回答を保存する"}
        </button>
      </section>

      {/* 集計（全件） */}
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-4">
        <h2 className="text-base font-semibold mb-3">回答一覧（OK人数順）</h2>
        {totalParticipants === 0 ? (
          <p className="text-sm text-gray-600">まだ回答がありません。</p>
        ) : (
          <ul className="space-y-2">
            {recommended.map((r) => (
              <li
                key={r.slot.id}
                className={`rounded-xl border p-3 ${
                  r.allOk
                    ? "border-emerald-400 bg-emerald-50"
                    : r.ok === topOk && topOk > 0
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {formatDateHeader(r.slot.start_at)}{" "}
                    {formatTimeRange(r.slot.start_at, r.slot.end_at)}
                    {r.allOk ? (
                      <span className="ml-2 inline-block rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">
                        全員OK
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-right leading-tight">
                    <div className="text-emerald-700 font-semibold">OK {r.ok}</div>
                    <div className="text-red-600">NG {r.ng}</div>
                    <div className="text-gray-500">未 {r.none}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                  {r.okNames.length > 0 ? (
                    <div>
                      <span className="font-semibold text-emerald-700">OK:</span>{" "}
                      {r.okNames.join(", ")}
                    </div>
                  ) : null}
                  {r.ngNames.length > 0 ? (
                    <div>
                      <span className="font-semibold text-red-600">NG:</span>{" "}
                      {r.ngNames.join(", ")}
                    </div>
                  ) : null}
                  {r.noneNames.length > 0 ? (
                    <div>
                      <span className="font-semibold text-gray-500">未:</span>{" "}
                      {r.noneNames.join(", ")}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
