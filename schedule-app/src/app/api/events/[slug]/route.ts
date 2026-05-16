import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: "slugが指定されていません" }, { status: 400 });
  }

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("id, slug, name, memo, slot_minutes, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 });
  }
  if (!ev) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  const [{ data: slots, error: slotsErr }, { data: participants, error: pErr }] =
    await Promise.all([
      supabase
        .from("time_slots")
        .select("id, event_id, start_at, end_at, created_at")
        .eq("event_id", ev.id)
        .order("start_at", { ascending: true }),
      supabase
        .from("participants")
        .select("id, event_id, name, created_at")
        .eq("event_id", ev.id)
        .order("created_at", { ascending: true }),
    ]);

  if (slotsErr) return NextResponse.json({ error: slotsErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const participantIds = (participants ?? []).map((p) => p.id);
  let responses: {
    id: string;
    participant_id: string;
    time_slot_id: string;
    status: "ok" | "ng";
  }[] = [];

  if (participantIds.length > 0) {
    const { data: resp, error: rErr } = await supabase
      .from("responses")
      .select("id, participant_id, time_slot_id, status")
      .in("participant_id", participantIds);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    responses = (resp ?? []) as typeof responses;
  }

  return NextResponse.json({
    event: ev,
    slots: slots ?? [],
    participants: participants ?? [],
    responses,
  });
}
