import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const { data: ev, error: evErr } = await supabase
    .from("events").select("id, slug, name, slot_minutes").eq("slug", params.slug).maybeSingle();
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (!ev) return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });

  const [{ data: slots, error: sErr }, { data: participants, error: pErr }] = await Promise.all([
    supabase.from("time_slots").select("id, start_at, end_at").eq("event_id", ev.id).order("start_at"),
    supabase.from("participants").select("id, name").eq("event_id", ev.id).order("created_at"),
  ]);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const participantIds = (participants ?? []).map((p) => p.id);
  let responses: { id: string; participant_id: string; time_slot_id: string; status: "ok" | "ng" }[] = [];
  if (participantIds.length > 0) {
    const { data: resp, error: rErr } = await supabase
      .from("responses").select("id, participant_id, time_slot_id, status").in("participant_id", participantIds);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    responses = (resp ?? []) as typeof responses;
  }

  return NextResponse.json({ event: ev, slots: slots ?? [], participants: participants ?? [], responses });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const { data: ev, error: evErr } = await supabase
    .from("events").select("id").eq("slug", params.slug).maybeSingle();
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (!ev) return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });

  const { error } = await supabase.from("events").delete().eq("id", ev.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
