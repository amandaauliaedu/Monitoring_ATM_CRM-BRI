import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import ReportPanel from '../components/ReportPanel.jsx';
import { Card, ErrorBox, Empty, field } from '../components/ui.jsx';
import { applyFilters, boOptions, lokasiOptions, EMPTY_FILTERS } from '../utils/filterUtils.js';
import { exportLiveResponses, LIVE_COLUMNS } from '../services/exportService.js';
import { STATUS } from '../utils/monitoringUtils.js';
import { RESPONSE_COLUMNS as C } from '../config/columnMapping.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n) => String(n).padStart(2, '0');
const clock = () => new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }).replace(/:/g, '.');
const th = 'whitespace-nowrap px-3 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-navy';

export default function LiveResponse({ live }) {
  const { data, master = [], loading, error, refresh, skipped, rowsRead } = live;
  const [f, setF] = useState(EMPTY_FILTERS);
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(clock());
  const navigate = useNavigate();
  useEffect(() => { const t = setInterval(() => setNow(clock()), 1000); return () => clearInterval(t); }, []);

  const set = (p) => { setF((x) => ({ ...x, ...p })); setPage(1); };
  const filtered = useMemo(() => applyFilters(data, f), [data, f]);
  const pool = useMemo(() => [...master, ...data], [master, data]);
  const bos = useMemo(() => boOptions(pool), [pool]);
  const lokasis = useMemo(() => lokasiOptions(pool, f.bo), [pool, f.bo]);
  const years = useMemo(() => [...new Set(data.map((r) => r.date.slice(0, 4)))].sort().reverse(), [data]);
  const types = useMemo(() => [...new Set(pool.map((r) => r.ukerType).filter(Boolean))].sort(), [pool]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const view = filtered.slice((cur - 1) * size, cur * size);
  const uk = (pred) => new Set(filtered.filter(pred).map((r) => `${r.bo}|${r.lokasi}`)).size;
  const typeKey = (r) => String(r.ukerType ?? '').trim().toUpperCase();
  const FIXED = ['KK', 'KCP', 'UNIT'];
  const otherTypes = [...new Set(filtered.map(typeKey).filter((t) => t && !FIXED.includes(t) && !/OFFS(IT|ID)E/.test(t)))].sort(); // jenis ATM Offsite tidak ditampilkan sebagai kotak
  const [kp, setKp] = useState(null);
  const chip = (id, label, value) => (
    <button key={id} type="button" onClick={() => setKp(kp === id ? null : id)} aria-pressed={kp === id} title="Klik untuk melihat detail"
      className={`flex items-baseline gap-2 rounded-lg border bg-white/80 px-3 py-1.5 shadow-sm transition hover:ring-2 hover:ring-primary/40 ${kp === id ? 'border-primary ring-2 ring-primary' : 'border-white/70'}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-mute">{label}</span><span className="text-lg font-bold leading-none text-navy">{value}</span>
    </button>);
  const typeKpi = (t, label = t) => chip(t, `Total ${label}`, uk((r) => typeKey(r) === t));
  const group = (keyFn, pick) => { const m = new Map(); for (const r of filtered) { const k = keyFn(r); if (!m.has(k)) m.set(k, { r, n: 0, prob: 0, ...pick(r) }); const x = m.get(k); x.n++; if (r.status === STATUS.PROBLEM) x.prob++; } return [...m.values()]; };
  const ukerRows = group((r) => `${r.bo}|${r.lokasi}`, () => ({}));
  const detail = (() => {
    if (!kp) return null;
    const uk2 = (rows) => ({ cols: ['Branch Office', 'Lokasi', 'Jenis Uker', 'Laporan', 'Problem'], rows: rows.map((x) => [x.r.bo, x.r.lokasi, x.r.ukerType || '—', x.n, x.prob]) });
    if (kp === 'resp') return { title: 'Total Response', cols: ['Tanggal', 'Jam', 'Branch Office', 'Lokasi', 'Mesin', 'TID', 'Status'], rows: filtered.map((r) => [r.date, r.raw[C.time] ?? '', r.bo, r.lokasi, r.machineType, r.tid, r.raw[C.status] ?? '']) };
    if (kp === 'uker') return { title: 'Total Uker', ...uk2(ukerRows) };
    if (kp === 'bo') return { title: 'Total BO', cols: ['Branch Office', 'Jumlah Uker', 'Laporan', 'Problem'], rows: group((r) => r.bo, () => ({})).map((x) => [x.r.bo, ukerRows.filter((u) => u.r.bo === x.r.bo).length, x.n, x.prob]) };
    return { title: `Total ${kp === 'UNIT' ? 'Unit' : kp}`, ...uk2(ukerRows.filter((x) => typeKey(x.r) === kp)) };
  })();
  // Problem yang belum di-TL -> kolom TL merah, klik membuka Monitoring Dashboard pada slot problem tsb.
  const needTL = (r) => r.status === STATUS.PROBLEM && !r.tlDone;
  const goDashboard = (r) => navigate(`/monitoring?${new URLSearchParams({ date: r.date, bo: r.bo, lokasi: r.lokasi, tid: r.tid, hour: String(r.hour) })}`);

  const download = () => {
    try { setToast({ ok: true, msg: `${exportLiveResponses(filtered)} baris berhasil diekspor.` }); }
    catch (e) { setToast({ ok: false, msg: `Ekspor gagal: ${e.message}` }); }
  };

  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto max-w-6xl px-4 py-6">
      <Card className="mb-5"><div className="flex flex-wrap items-center gap-2">
        <select className={field} value={f.day} onChange={(e) => set({ day: e.target.value })} aria-label="Tanggal"><option value="">Semua tgl</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={pad(i + 1)}>{i + 1}</option>)}</select>
        <select className={field} value={f.month} onChange={(e) => set({ month: e.target.value })} aria-label="Bulan"><option value="">Semua bulan</option>{MONTHS.map((m, i) => <option key={m} value={pad(i + 1)}>{m}</option>)}</select>
        <select className={field} value={f.year} onChange={(e) => set({ year: e.target.value })} aria-label="Tahun"><option value="">Semua tahun</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <select className={field} value={f.bo} onChange={(e) => set({ bo: e.target.value, lokasi: '' })} aria-label="Branch Office"><option value="">Semua Branch Office</option>{bos.map((b) => <option key={b}>{b}</option>)}</select>
        <select className={field} value={f.lokasi} onChange={(e) => set({ lokasi: e.target.value })} aria-label="Lokasi"><option value="">Semua Lokasi</option>{lokasis.map((l) => <option key={l}>{l}</option>)}</select>
        <select className={field} value={f.ukerType} onChange={(e) => set({ ukerType: e.target.value })} aria-label="Jenis Uker"><option value="">Semua Jenis Uker</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:bg-primary-light"><RefreshCw size={13} />Refresh</button>
        <span className={`ml-auto font-mono text-xs font-bold ${error ? 'text-mute' : 'text-ok'}`}>● {error ? 'OFFLINE' : 'LIVE'} • {now}</span>
      </div></Card>

      <h1 className="text-3xl font-bold text-navy">Live Response</h1>
      <p className="mb-4 mt-1 text-sm text-mute">Data monitoring ATM &amp; CRM langsung dari Google Sheets • {rowsRead ?? data.length} baris terbaca dari sheet{skipped ? ` • ${skipped} baris dilewati (tanggal/jam/TID tidak valid)` : ''}.</p>
      <ErrorBox error={error} onRetry={refresh} />
      <div className="mb-4 flex flex-wrap gap-2">
        {chip('resp', 'Total Response', filtered.length)}{chip('uker', 'Total Uker', uk(() => true))}{chip('bo', 'Total BO', new Set(filtered.map((r) => r.bo)).size)}
        {typeKpi('KCP')}{typeKpi('KK')}{otherTypes.map((t) => typeKpi(t))}{typeKpi('UNIT', 'Unit')}
      </div>
      {detail && (
        <Card className="mb-4" title={`${detail.title}: ${detail.rows.length}`} right={<button onClick={() => setKp(null)} className="text-xs text-mute underline">Tutup</button>}>
          {detail.rows.length === 0 ? <Empty>Tidak ada data.</Empty> : (
            <div className="max-h-[40vh] overflow-auto"><table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr>{detail.cols.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{detail.rows.map((row, i) => <tr key={i} className="border-t border-line/70">{row.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{v === '' ? '—' : v}</td>)}</tr>)}</tbody>
            </table></div>)}
        </Card>)}
      <Card className="mb-4"><div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold text-navy">Download Excel</p><p className="text-sm text-mute">Unduh {filtered.length} baris sesuai filter &amp; pencarian saat ini dalam format .xlsx</p></div>
        <button onClick={download} disabled={!filtered.length} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary-hover disabled:opacity-50"><Download size={14} />Unduh Excel</button>
      </div>{toast && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${toast.ok ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`}>{toast.msg}</p>}</Card>

      <input className={`${field} mb-3 w-full max-w-sm`} placeholder="Cari BO, lokasi, TID, vendor…" value={f.search} onChange={(e) => set({ search: e.target.value })} aria-label="Cari" />
      {loading && <p className="text-mute">Memuat data…</p>}
      {!loading && !error && filtered.length === 0 && <Card><Empty>{data.length ? 'Tidak ada data yang sesuai dengan filter.' : 'Belum ada laporan.'}</Empty></Card>}
      {filtered.length > 0 && (<>
        <Card className="!p-2"><div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr>{LIVE_COLUMNS.map(([h]) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{view.map((r) => (
              <tr key={r.id} tabIndex={0} onClick={() => setSel(r)} onKeyDown={(e) => e.key === 'Enter' && setSel(r)} className="cursor-pointer border-t border-line/70 align-top hover:bg-primary-light/50">
                {LIVE_COLUMNS.map(([h, key]) => {
                  const v = r.raw[key] ?? '';
                  if (h === 'Waktu TL' || h === 'Foto TL') {
                    if (needTL(r)) return (
                      <td key={h} className="p-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); goDashboard(r); }} title="Belum di-TL — klik untuk membuka Monitoring Dashboard"
                          className="block h-full w-full min-w-[110px] bg-bad px-3 py-2 text-left text-xs font-bold text-white hover:bg-red-700">Belum TL</button>
                      </td>);
                    if (h === 'Foto TL') return <td key={h} className="px-3 py-2">{v ? <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-medium text-primary underline">Buka foto</a> : '—'}</td>;
                  }
                  if (h === 'Foto Mesin') return <td key={h} className="px-3 py-2">{v ? <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-medium text-primary underline">Buka foto</a> : '—'}</td>;
                  const long = h === 'Keterangan Problem' || h === 'Detail Kendala Lainnya';
                  return <td key={h} className={`px-3 py-2 ${long ? 'min-w-[220px]' : 'whitespace-nowrap'}`}>{v || '—'}</td>;
                })}
              </tr>))}</tbody>
          </table></div></Card>
        <div className="mt-3 flex flex-wrap items-center gap-3 pb-8 text-sm text-mute">
          <span>{filtered.length} dari {data.length} baris</span>
          <label className="flex items-center gap-1">Baris <select className={field} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
          <div className="ml-auto flex items-center gap-2">
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-lg border border-line bg-white px-3 py-1 enabled:hover:bg-primary-light disabled:opacity-40">Sebelumnya</button>
            <span>{cur} / {pages}</span>
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-lg border border-line bg-white px-3 py-1 enabled:hover:bg-primary-light disabled:opacity-40">Berikutnya</button>
          </div>
        </div></>)}
      <ReportPanel report={sel} onClose={() => setSel(null)} />
    </motion.main>
  );
}
