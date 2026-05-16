import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Body = { name: string; answers: Record<string, "ok" | "ng" | null> };

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!body.name?.trim()) return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });

  const { data: ev, error: evErr } = await supabase
    .from("events").select("id").eq("slug", params.slug).maybeSingle();
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (!ev) return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });

  const name = body.name.trim();
  let participantId: string;
  const { data: existing } = await supabase
    .from("participants").select("id").eq("event_id", ev.id).eq("name", name).maybeSingle();
  if (existing) {
    participantId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("participants").insert({ event_id: ev.id, name }).select("id").single();
    if (error || !created) return NextResponse.json({ error: error?.message ?? "参加者の作成に失敗しました" }, { status: 500 });
    participantId = created.id;
  }

  const { data: slotRows } = await supabase.from("time_slots").select("id").eq("event_id", ev.id);
  const validIds = new Set((slotRows ?? []).map((r) => r.id));

  const toUpsert: { participant_id: string; time_slot_id: string; status: "ok" | "ng" }[] = [];
  const toDelete: string[] = [];
  for (const [slotId, status] of Object.entries(body.answers)) {
    if (!validIds.has(slotId)) continue;
    if (status === "ok" || status === "ng") toUpsert.push({ participant_id: participantId, time_slot_id: slotId, status });
    else toDelete.push(slotId);
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("responses").upsert(toUpsert, { onConflict: "participant_id,time_slot_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from("responses").delete()
      .eq("participant_id", participantId).in("time_slot_id", toDelete);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
