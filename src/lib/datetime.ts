// 候補日 + 開始/終了時刻 + 時間枠 から time_slot を作るユーティリティ

export type SlotMinutes = 15 | 30 | 60;

export type GeneratedSlot = {
  start_at: string; // ISO
  end_at: string; // ISO
};

// "2026-05-20" + "09:00" を ローカルタイムで Date にする
function toLocalDate(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const [hh, mm] = timeStr.split(":").map((v) => parseInt(v, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/**
 * 指定された候補日リスト・開始/終了時刻・時間枠から候補スロットを生成する
 * 例: dates=[2026-05-20, 2026-05-21], 09:00〜11:00, 30分
 *   → 2026-05-20 09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00
 *     2026-05-21 09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00
 */
export function generateSlots(
  dates: string[],
  startTime: string,
  endTime: string,
  slotMinutes: SlotMinutes
): GeneratedSlot[] {
  const out: GeneratedSlot[] = [];
  for (const d of dates) {
    const dayStart = toLocalDate(d, startTime).getTime();
    const dayEnd = toLocalDate(d, endTime).getTime();
    if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) {
      continue;
    }
    const stepMs = slotMinutes * 60 * 1000;
    for (let t = dayStart; t + stepMs <= dayEnd; t += stepMs) {
      out.push({
        start_at: new Date(t).toISOString(),
        end_at: new Date(t + stepMs).toISOString(),
      });
    }
  }
  return out;
}

const WEEK_JP = ["日", "月", "火", "水", "木", "金", "土"];

// 曜日モード用の参照日（2000-01-03 = 月曜日）
export const WEEKDAY_REFERENCE_DATES: Record<number, string> = {
  1: "2000-01-03", // 月
  2: "2000-01-04", // 火
  3: "2000-01-05", // 水
  4: "2000-01-06", // 木
  5: "2000-01-07", // 金
  6: "2000-01-08", // 土
  0: "2000-01-09", // 日
};

export function isWeekdayMode(startIso: string): boolean {
  const d = new Date(startIso);
  const y = d.getFullYear();
  return y === 2000;
}

export function formatWeekdayHeader(startIso: string): string {
  const d = new Date(startIso);
  return `${WEEK_JP[d.getDay()]}曜日`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function formatSlotLabel(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const datePart = `${s.getFullYear()}/${pad(s.getMonth() + 1)}/${pad(s.getDate())}(${WEEK_JP[s.getDay()]})`;
  const timePart = `${pad(s.getHours())}:${pad(s.getMinutes())}〜${pad(e.getHours())}:${pad(e.getMinutes())}`;
  return `${datePart} ${timePart}`;
}

export function formatDateHeader(startIso: string): string {
  const s = new Date(startIso);
  return `${s.getFullYear()}/${pad(s.getMonth() + 1)}/${pad(s.getDate())} (${WEEK_JP[s.getDay()]})`;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return `${pad(s.getHours())}:${pad(s.getMinutes())}〜${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

export function dateKey(startIso: string): string {
  const s = new Date(startIso);
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
}
