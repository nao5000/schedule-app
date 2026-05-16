import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSlug } from "@/lib/slug";
import { generateSlots, SlotMinutes } from "@/lib/datetime";

export const runtime = "nodejs";

type CreateEventBody = {
  name: string;
  memo?: string;
  dates: string[]; // ["2026-05-20", ...]
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  slotMinutes: SlotMinutes;
};

export async function POST(req: NextRequest) {
  let body: CreateEventBody;
  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "ミーティング名は必須です" }, { status: 400 });
  }
  if (!Array.isArray(body.dates) || body.dates.length === 0) {
    return NextResponse.json({ error: "候補日を1つ以上選んでください" }, { status: 400 });
  }
  if (!body.startTime || !body.endTime) {
    return NextResponse.json({ error: "開始時刻と終了時刻を指定してください" }, { status: 400 });
  }
  if (![15, 30, 60].includes(body.slotMinutes)) {
    return NextResponse.json({ error: "時間枠は15/30/60分のいずれかを指定してください" }, { status: 400 });
  }

  const slots = generateSlots(body.dates, body.startTime, body.endTime, body.slotMinutes);
  if (slots.length === 0) {
    return NextResponse.json(
      { error: "候補時間が生成できませんでした。開始/終了時刻と時間枠を確認してください" },
      { status: 400 }
    );
  }

  // 衝突しにくいslugを生成（最大5回リトライ）
  let slug = "";
  let inserted = false;
  let lastErr: unknown = null;
  let eventId: string | null = null;

  for (let i = 0; i < 5; i++) {
    slug = generateSlug(10);
    const { data, error } = await supabase
      .from("events")
      .insert({
        slug,
        name: body.name.trim(),
        memo: body.memo?.trim() || null,
        slot_minutes: body.slotMinutes,
      })
      .select("id, slug")
      .single();
    if (!error && data) {
      eventId = data.id;
      inserted = true;
      break;
    }
    lastErr = error;
  }

  if (!inserted || !eventId) {
    return NextResponse.json(
      { error: "イベントの作成に失敗しました", detail: String(lastErr) },
      { status: 500 }
    );
  }

  const slotRows = slots.map((s) => ({
    event_id: eventId!,
    start_at: s.start_at,
    end_at: s.end_at,
  }));

  const { error: slotErr } = await supabase.from("time_slots").insert(slotRows);
  if (slotErr) {
    // 失敗したらevent側を削除（後始末）
    await supabase.from("events").delete().eq("id", eventId);
    return NextResponse.json(
      { error: "候補時間の作成に失敗しました", detail: slotErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ slug });
}
