export const SLOT_COUNT = 24;
const pad = (n) => String(n).padStart(2, '0');
export const slotLabel = (h) => `${pad(h)}.00–${pad((h + 1) % 24)}.00`;
export const SLOTS = Array.from({ length: SLOT_COUNT }, (_, h) => ({ slot: h + 1, hour: h, label: slotLabel(h) }));

// Ambil jam (0-23) dari "11:47" / "11:47:03" / "11.47". Tidak melalui objek Date => tidak ada geseran zona waktu.
export function parseHour(timeStr) {
  const m = /^\s*(\d{1,2})[:.](\d{2})/.exec(String(timeStr ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}
// Normalisasi tanggal ke YYYY-MM-DD dari "2026-10-13" atau "13/10/2026".
export function normalizeDate(v) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : null;
}
// Tanggal & jam "sekarang" di Asia/Jakarta
export function nowInJakarta(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
