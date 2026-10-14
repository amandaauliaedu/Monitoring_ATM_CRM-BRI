export const EMPTY_FILTERS = { search: '', day: '', month: '', year: '', start: '', end: '', bo: '', lokasi: '', ukerType: '', type: '', status: '' };

const hay = (r) => [r.date, r.bo, r.lokasi, r.machineType, r.tid, r.vendor, r.reporter, r.detail, ...r.problems].join(' ').toLowerCase();

// Dipakai tabel, KPI, dan ekspor, jadi hasil Excel = hasil tabel.
export function applyFilters(rows, f) {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    const [y, m, d] = r.date.split('-');
    if (f.year && y !== f.year) return false;
    if (f.month && m !== f.month) return false;
    if (f.day && d !== f.day) return false;
    if (f.ukerType && r.ukerType !== f.ukerType) return false;
    if (f.start && r.date < f.start) return false;
    if (f.end && r.date > f.end) return false;
    if (f.bo && r.bo !== f.bo) return false;
    if (f.lokasi && r.lokasi !== f.lokasi) return false;
    if (f.type && r.machineType !== f.type) return false;
    if (f.status && r.status !== f.status) return false;
    return !q || hay(r).includes(q);
  });
}
const uniq = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
export const boOptions = (rows) => uniq(rows.map((r) => r.bo));
// Lokasi hanya yang berada di bawah BO terpilih
export const lokasiOptions = (rows, bo) => uniq(rows.filter((r) => !bo || r.bo === bo).map((r) => r.lokasi));
