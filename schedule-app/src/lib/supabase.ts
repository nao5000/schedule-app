import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。.env.local を確認してください。"
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: { persistSession: false },
});

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  memo: string | null;
  slot_minutes: number;
  created_at: string;
};

export type TimeSlotRow = {
  id: string;
  event_id: string;
  start_at: string;
  end_at: string;
  created_at: string;
};

export type ParticipantRow = {
  id: string;
  event_id: string;
  name: string;
  created_at: string;
};

export type ResponseStatus = "ok" | "ng";

export type ResponseRow = {
  id: string;
  participant_id: string;
  time_slot_id: string;
  status: ResponseStatus;
  updated_at: string;
};
