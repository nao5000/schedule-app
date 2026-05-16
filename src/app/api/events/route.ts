import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSlug } from "@/lib/slug";
import { generateSlots, SlotMinutes } from "@/lib/datetime";

export const runtime = "nodejs";

type Candidate = { date: string; startTime: string; endTime: string };

type Body = {
  name: string;
  candidates: Candidate[];
  slotMinutes: SlotMinutes;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "イベント名を入力してください" }, { status: 400 });
  const candidates = (body.candidates ?? []).filter(
    (c) => c.date?.trim() && c.startTime && c.endTime && c.startTime < c.endTime
  );
  if (!candidates.length) return NextResponse.json({ error: "候補日時を1つ以上入力してください" }, { status: 400 });
  if (![15, 30, 60].includes(body.slotMinutes))
    return NextResponse.json({ error: "時間枠は15/30/60分を指定してください" }, { status: 400 });

  // 日付ごとに個別の時間帯でスロット生成
  const slots = candidates.flatMap((c) =>
    generateSlots([c.date.trim()], c.startTime, c.endTime, body.slotMinutes)
  );
  if (!slots.length) return NextResponse.json({ error: "候補時間が生成できませんでした" }, { status: 400 });

  let eventId: string | null = null;
  let slug = "";
  for (let i = 0; i < 5; i++) {
    slug = generateSlug(10);
    const { data, error } = await supabase
      .from("events")
      .insert({ slug, name: body.name.trim(), slot_minutes: body.slotMinutes })
      .select("id").single();
    if (!error && data) { eventId = data.id; break; }
  }
  if (!eventId) return NextResponse.json({ error: "イベントの作成に失敗しました" }, { status: 500 });

  const { error: slotErr } = await supabase.from("time_slots").insert(
    slots.map((s) => ({ event_id: eventId!, start_at: s.start_at, end_at: s.end_at }))
  );
  if (slotErr) {
    await supabase.from("events").delete().eq("id", eventId);
    return NextResponse.json({ error: "候補時間の保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ slug });
}
