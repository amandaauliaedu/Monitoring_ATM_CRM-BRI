import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import PageShell from '../components/PageShell.jsx';
import { Card, Kpi, Empty, ErrorBox, field } from '../components/ui.jsx';
import { analyze, filterRange, byVendor } from '../utils/analyticsUtils.js';
import { exportAnalytics } from '../services/exportService.js';

const COLORS = ['#0857C3', '#DC2626', '#D97706', '#16A34A', '#94A3B8', '#043D8A'];
const ax = { fontSize: 11, fill: '#64748B' };
function Chart({ title, data, children, height = 240 }) {
  return <Card title={title}>{data.length === 0 || data.every((d) => !d.value) ? <Empty /> : <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>}</Card>;
}
const HBar = ({ title, data }) => (
  <Chart title={title} data={data} height={Math.max(180, Math.min(data.length, 8) * 34)}>
    <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 8 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={ax} /><YAxis type="category" dataKey="name" width={140} tick={ax} /><Tooltip /><Bar dataKey="value" name="Laporan" fill="#0857C3" radius={[0, 4, 4, 0]} /></BarChart>
  </Chart>
);

export default function DataAnalyst({ data }) {
  const { responses, master, loading, error, refresh } = data;
  const [f, setF] = useState({ start: '', end: '', bo: '', type: '' });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const rows = useMemo(() => filterRange(responses, f), [responses, f]);
  const a = useMemo(() => analyze(rows), [rows]);
  const bos = useMemo(() => [...new Set([...master, ...responses].map((m) => m.bo))].sort((x, y) => x.localeCompare(y, 'id', { numeric: true })), [master, responses]);
  const vendors = useMemo(() => byVendor(rows), [rows]);
  const navigate = useNavigate();
  const [vsel, setVsel] = useState(null); // { name, kind: 'CRM' | 'ATM' | 'ALL' }
  const vpick = (name, kind) => setVsel(vsel && vsel.name === name && vsel.kind === kind ? null : { name, kind });
  const vlist = vsel ? vendors.find((v) => v.name === vsel.name)?.items[vsel.kind] ?? [] : [];
  // Klik TID -> Monitoring Dashboard pada tanggal, BO, lokasi, dan slot jam laporan problem mesin tsb.
  const goTid = ({ target: r }) => navigate(`/monitoring?${new URLSearchParams({ date: r.date, bo: r.bo, lokasi: r.lokasi, tid: r.tid, hour: String(r.hour) })}`);
  const peakHour = [...a.byHour].sort((x, y) => y.value - x.value)[0];
  const insights = a.problemReports < 3 ? [] : [
    a.byBO[0] && `BO dengan laporan gangguan terbanyak: ${a.byBO[0].name} (${a.byBO[0].value} laporan).`,
    a.byLokasi[0] && `Lokasi terbanyak: ${a.byLokasi[0].name} (${a.byLokasi[0].value} laporan).`,
    peakHour?.value && `Jam dengan gangguan terbanyak: ${peakHour.name}.00 (${peakHour.value} laporan).`,
    a.byProblem[0] && `Jenis kendala terbanyak: ${a.byProblem[0].name} (${a.byProblem[0].value} kemunculan).`,
    a.byType[0] && `Jenis mesin dengan laporan terbanyak: ${a.byType[0].name} (${a.byType[0].value} laporan).`
  ].filter(Boolean);
  const [msg, setMsg] = useState(null);
  const doExport = () => { try { exportAnalytics(a, rows); setMsg({ ok: true, t: 'Excel analitik berhasil diunduh.' }); } catch (e) { setMsg({ ok: false, t: `Ekspor gagal: ${e.message}` }); } };

  return (
    <PageShell title="Data Analyst" subtitle="Analisis laporan gangguan sesuai filter. Jumlah laporan, mesin unik, dan slot dihitung terpisah.">
      <ErrorBox error={error} onRetry={refresh} />
      <Card className="mb-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input type="date" className={field} value={f.start} onChange={(e) => set({ start: e.target.value })} aria-label="Tanggal mulai" />
        <input type="date" className={field} value={f.end} onChange={(e) => set({ end: e.target.value })} aria-label="Tanggal selesai" />
        <select className={field} value={f.bo} onChange={(e) => set({ bo: e.target.value })} aria-label="BO"><option value="">Semua BO</option>{bos.map((n) => <option key={n}>{n}</option>)}</select>
        <select className={field} value={f.type} onChange={(e) => set({ type: e.target.value })} aria-label="Jenis mesin"><option value="">ATM &amp; CRM</option><option>ATM</option><option>CRM</option></select>
        <button onClick={doExport} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"><Download size={14} />Export Excel</button>
      </div>{msg && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`}>{msg.t}</p>}</Card>
      {loading ? <p className="text-mute">Memuat data…</p> : (<>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total laporan" value={a.total} /><Kpi label="Mesin unik dilaporkan" value={a.uniqueMachines} />
          <Kpi label="Mesin pernah bermasalah" value={a.problemReports} tone="text-bad" hint={`berdasarkan jumlah laporan • ${a.problemMachines} mesin unik`} /><Kpi label="Laporan normal" value={a.normalReports} tone="text-ok" />
        </div>
        <Card title="Key Insights" className="mb-4">{insights.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{insights.map((t) => <li key={t}>{t}</li>)}</ul> : <Empty>Data belum cukup untuk membuat insight (minimal 3 laporan gangguan).</Empty>}
          <p className="mt-2 text-xs text-mute">Insight hanya meringkas hitungan dari data terfilter, bukan menyimpulkan penyebab kerusakan.</p></Card>
        <Card title="Mesin Bermasalah per Vendor" className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {vendors.map((v) => (
              <div key={v.name} className="rounded-xl border border-line bg-white p-3">
                <p className="mb-2 font-semibold text-navy">{v.name}</p>
                <dl className="space-y-1 text-sm">
                  {[['CRM', 'CRM Bermasalah', v.crm, ''], ['ATM', 'ATM Bermasalah', v.atm, ''], ['ALL', 'Total Mesin Bermasalah', v.total, 'border-t border-line pt-1 font-medium']].map(([kind, label, n, extra]) => (
                    <button key={kind} type="button" disabled={!n} onClick={() => vpick(v.name, kind)} aria-pressed={vsel?.name === v.name && vsel?.kind === kind} title={n ? 'Klik untuk melihat TID' : ''}
                      className={`flex w-full justify-between rounded px-1 text-left enabled:hover:bg-primary-light/60 ${extra} ${vsel?.name === v.name && vsel?.kind === kind ? 'bg-primary-light' : ''}`}>
                      <span className={extra ? '' : 'text-mute'}>{label}</span><span className={`font-bold ${kind === 'ALL' ? (n ? 'text-bad' : 'text-ok') : ''}`}>{n}</span>
                    </button>))}
                </dl>
              </div>))}
          </div>
          {vsel && (
            <div className="mt-3 rounded-xl border border-line">
              <div className="flex items-center justify-between px-3 py-2"><p className="text-sm font-semibold text-navy">{vsel.name} • {vsel.kind === 'ALL' ? 'Semua mesin' : vsel.kind} bermasalah: {vlist.length} TID</p><button onClick={() => setVsel(null)} className="text-xs text-mute underline">Tutup</button></div>
              <div className="max-h-[40vh] overflow-auto"><table className="w-full text-sm">
                <thead className="sticky top-0 bg-white"><tr>{['TID', 'Mesin', 'Branch Office', 'Lokasi', 'Laporan Problem'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-1.5 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-navy">{h}</th>)}</tr></thead>
                <tbody>{vlist.map((it) => (
                  <tr key={it.tid} className="border-t border-line/70">
                    <td className="px-3 py-1.5"><button type="button" onClick={() => goTid(it)} title="Buka di Monitoring Dashboard" className="font-semibold text-primary underline">{it.tid}</button></td>
                    <td className="px-3 py-1.5">{it.type || '—'}</td><td className="px-3 py-1.5">{it.bo}</td><td className="px-3 py-1.5">{it.lokasi}</td><td className="px-3 py-1.5">{it.count}</td>
                  </tr>))}</tbody></table></div>
            </div>)}
          <p className="mt-2 text-xs text-mute">Dihitung per mesin unik (TID) yang pernah dilaporkan Problem pada data terfilter.</p>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Chart title="Tren laporan gangguan harian" data={a.byDay}><LineChart data={a.byDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={ax} /><YAxis allowDecimals={false} tick={ax} /><Tooltip /><Line dataKey="value" name="Laporan" stroke="#0857C3" strokeWidth={2} dot /></LineChart></Chart>
          <Chart title="ATM vs CRM" data={a.byType}><PieChart><Pie data={a.byType} dataKey="value" nameKey="name" outerRadius={85} label>{a.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></Chart>
          <Chart title="Laporan gangguan per jam" data={a.byHour}><BarChart data={a.byHour}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={ax} label={{ value: 'Jam mulai slot', position: 'insideBottom', offset: -2, fontSize: 11 }} /><YAxis allowDecimals={false} tick={ax} /><Tooltip /><Bar dataKey="value" name="Laporan" fill="#0857C3" radius={[4, 4, 0, 0]} /></BarChart></Chart>
          <HBar title="Gangguan per Branch Office" data={a.byBO} /><HBar title="Gangguan per Lokasi" data={a.byLokasi} />
          <HBar title="Distribusi jenis kendala" data={a.byProblem} />
        </div></>)}
    </PageShell>
  );
}
