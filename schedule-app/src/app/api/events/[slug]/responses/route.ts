import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type SubmitBody = {
  name: string;
  // time_slot_id -> "ok" | "ng" | "none"
  answers: Record<string, "ok" | "ng" | "none">;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  }
  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "回答が不正です" }, { status: 400 });
  }

  // イベント取得
  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (!ev) return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });

  const name = body.name.trim();

  // 同名の参加者があれば取得、無ければ作成
  let participantId: string | null = null;
  {
    const { data: existing, error } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", ev.id)
      .eq("name", name)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (existing) {
      participantId = existing.id;
    } else {
      const { data: created, error: insErr } = await supabase
        .from("participants")
        .insert({ event_id: ev.id, name })
        .select("id")
        .single();
      if (insErr || !created) {
        return NextResponse.json(
          { error: insErr?.message ?? "参加者の作成に失敗しました" },
          { status: 500 }
        );
      }
      participantId = created.id;
    }
  }

  // このイベントの time_slot だけを許可（不正IDを弾く）
  const { data: slotRows, error: slotErr } = await supabase
    .from("time_slots")
    .select("id")
    .eq("event_id", ev.id);
  if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 });
  const validSlotIds = new Set((slotRows ?? []).map((r) => r.id));

  const toUpsert: { participant_id: string; time_slot_id: string; status: "ok" | "ng" }[] = [];
  const toDelete: string[] = [];

  for (const [slotId, status] of Object.entries(body.answers)) {
    if (!validSlotIds.has(slotId)) continue;
    if (status === "ok" || status === "ng") {
      toUpsert.push({ participant_id: participantId!, time_slot_id: slotId, status });
    } else {
      toDelete.push(slotId);
    }
  }

  if (toUpsert.length > 0) {
    const { error: upErr } = await supabase
      .from("responses")
      .upsert(toUpsert, { onConflict: "participant_id,time_slot_id" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("responses")
      .delete()
      .eq("participant_id", participantId!)
      .in("time_slot_id", toDelete);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, participant_id: participantId });
}
