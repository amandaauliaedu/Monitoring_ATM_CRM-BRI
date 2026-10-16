import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import PageShell from '../components/PageShell.jsx';
import { SlotPanel } from '../components/ReportPanel.jsx';
import { Card, Kpi, Empty, ErrorBox, field } from '../components/ui.jsx';
import { buildTree } from '../utils/treeUtils.js';
import { submitFollowUp } from '../services/googleSheetsService.js';
import { APP_CONFIG, WRITE_URL_OK } from '../config/appConfig.js';
import { nowInJakarta, SLOTS } from '../utils/dateUtils.js';

const CELL = {
  bermasalah: ['bg-bad text-white', '✕', 'Problem'], sudah_tl: ['bg-tl text-white', '✓', 'Tindak Lanjut'], normal: ['bg-ok text-white', '✓', 'Normal'],
  verifikasi: ['bg-[#FFE98A] text-[#8A5A00]', '!', 'Perlu verifikasi'], belum: ['bg-[#FFE98A] text-[#8A5A00]', '!', 'Belum diinput']
};
// Legenda: hanya 4 keterangan (urutan sesuai permintaan). "Perlu verifikasi" memakai warna krem yang sama dengan Belum diinput.
const LEGEND = ['bermasalah', 'sudah_tl', 'normal', 'belum'];
const Collapse = ({ open, children }) => (
  <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">{children}</motion.div>}</AnimatePresence>
);
const Badge = ({ n, label }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${n ? 'bg-bad-bg text-bad' : 'bg-ok-bg text-ok'}`}>{n ? `${label} : ${n} Mesin` : 'Normal'}</span>;

function Machines({ machines, date, lokasi, now, onPick }) {
  return (
    <div className="overflow-x-auto px-4 pb-4">
      <div className="grid items-center gap-1 text-xs" style={{ gridTemplateColumns: '170px repeat(24, 30px)', width: 'max-content' }}>
        <span />{SLOTS.map((s) => <span key={s.hour} title={s.label} className="text-center text-mute">{String(s.hour).padStart(2, '0')}</span>)}
        {machines.map((m) => (<>
          <div key={m.key} className="sticky left-0 z-10 bg-surface pr-2"><p className="font-semibold">{m.type || '—'} {m.tid}</p><p className="text-mute">{m.vendor || 'vendor belum ada'} • {m.problem} slot problem</p></div>
          {m.slots.map((c) => {
            const [cls, ico, name] = CELL[c.status]; const future = date > now.date || (date === now.date && c.hour > now.hour);
            return <button key={`${m.key}${c.hour}`} onClick={() => onPick({ machine: m, cell: c, date, lokasi })} title={`${SLOTS[c.hour].label} • ${name}${c.reports.length ? ` • ${c.reports.length} laporan` : ''}`} aria-label={`${m.type} ${m.tid} ${SLOTS[c.hour].label} ${name}`} className={`h-7 w-[30px] rounded font-bold ${c.status === 'sudah_tl' ? 'text-[10px]' : 'text-xs'} ${cls} ${future ? 'opacity-40' : ''} hover:ring-2 hover:ring-primary`}>{ico}</button>;
          })}
        </>))}
      </div>
    </div>
  );
}

export default function MonitoringDashboard({ data }) {
  const { responses, master, applyTL, loading, error, refresh } = data;
  const now = nowInJakarta();
  const [date, setDate] = useState(now.date);
  const [bo, setBo] = useState(''); const [lokasi, setLokasi] = useState(''); const [q, setQ] = useState('');
  const [open, setOpen] = useState({}); const [slot, setSlot] = useState(null);
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  // Deep link dari Live Response: /monitoring?date=&bo=&lokasi=&tid=&hour= -> buka BO & lokasi terkait dan panel slot problem.
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    const tid = sp.get('tid'); const hour = Number(sp.get('hour')); const d = sp.get('date'); const b = sp.get('bo'); const l = sp.get('lokasi');
    if (!tid || !d || !b || !l || !Number.isInteger(hour)) return;
    setDate(d); setBo(b); setLokasi(l); setQ('');
    setOpen((o) => ({ ...o, [b]: true, [`${b}/${l}`]: true }));
    setSlot({ tid, hour, date: d, lokasi: l });
    setSp({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tree = useMemo(() => buildTree(master, responses, date, now), [master, responses, date, now.date, now.hour]);
  const slotObj = useMemo(() => {
    if (!slot) return null;
    for (const b of tree) for (const l of b.lokasis) { const m = l.machines.find((x) => x.tid === slot.tid); if (m) return { machine: m, cell: m.slots[slot.hour], date: slot.date, lokasi: slot.lokasi }; }
    return null;
  }, [slot, tree]);
  const writeIssue = !APP_CONFIG.writeApiUrl ? 'Penyimpanan TL belum dikonfigurasi (isi VITE_WRITE_API_URL).'
    : !WRITE_URL_OK ? 'VITE_WRITE_API_URL salah: harus URL Web App Apps Script (script.google.com/macros/s/.../exec), bukan link Google Drive.' : '';
  const onFollowUp = async (payload) => { const rec = await submitFollowUp(payload); applyTL(rec); refresh(); return rec; };
  const lokOpts = (tree.find((b) => b.name === bo)?.lokasis || []).map((l) => l.name);
  const view = useMemo(() => {
    const t = q.trim().toLowerCase();
    return tree.filter((b) => !bo || b.name === bo).map((b) => ({
      ...b, lokasis: b.lokasis.filter((l) => (!lokasi || l.name === lokasi) && (!t || `${b.name} ${l.name} ${l.machines.map((m) => m.tid).join(' ')}`.toLowerCase().includes(t)))
    })).filter((b) => b.lokasis.length);
  }, [tree, bo, lokasi, q]);
  const all = view.flatMap((b) => b.lokasis.flatMap((l) => l.machines));

  return (
    <PageShell title="Monitoring Dashboard" subtitle="Status tiap mesin per jam. Klik kotak jam untuk melihat laporannya.">
      <ErrorBox error={error} onRetry={refresh} />
      <Card className="mb-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input type="date" className={field} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tanggal" />
        <select className={field} value={bo} onChange={(e) => { setBo(e.target.value); setLokasi(''); }} aria-label="Branch Office"><option value="">Semua Branch Office</option>{tree.map((b) => <option key={b.name}>{b.name}</option>)}</select>
        <select className={field} value={lokasi} onChange={(e) => setLokasi(e.target.value)} disabled={!bo} aria-label="Lokasi"><option value="">{bo ? 'Semua Lokasi' : 'Pilih BO dulu'}</option>{lokOpts.map((l) => <option key={l}>{l}</option>)}</select>
        <input className={`${field} lg:col-span-2`} placeholder="Cari BO, lokasi, atau TID…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari" />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs"><span className="font-semibold text-navy">Keterangan</span>{LEGEND.map((k) => [k, CELL[k]]).map(([k, [cls, ico, name]]) => <span key={k} className="flex items-center gap-1.5"><span className={`grid h-5 w-5 place-items-center rounded font-bold ${cls}`}>{ico}</span>{name}</span>)}</div></Card>

      {loading ? <p className="text-mute">Memuat data…</p> : (<>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Branch Office" value={view.length} /><Kpi label="Lokasi" value={view.reduce((n, b) => n + b.lokasis.length, 0)} />
          <Kpi label="Mesin problem" value={all.filter((m) => m.problem > 0).length} hint={`dari ${all.length} mesin terdaftar`} tone="text-bad" />
          <Kpi label="Slot problem" value={all.reduce((n, m) => n + m.problem, 0)} hint={`${all.reduce((n, m) => n + m.reportsToday, 0)} laporan • ${all.reduce((n, m) => n + m.tl, 0)} slot sudah TL`} />
        </div>
        {view.length === 0 && <Empty>Tidak ada BO/lokasi yang cocok dengan filter.</Empty>}
        <div className="space-y-3">{view.map((b) => (
          <section key={b.name} className="rounded-xl border border-white/70 bg-white/75 shadow-sm backdrop-blur">
            <button onClick={() => toggle(b.name)} aria-expanded={!!open[b.name]} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
              <ChevronDown size={18} className={`transition-transform ${open[b.name] ? 'rotate-180' : ''}`} />
              <span className="font-semibold text-navy">{b.name}</span>
              <span className="text-xs text-mute">{b.lokasis.length} lokasi • {b.atm} ATM • {b.crm} CRM</span>
              <span className="ml-auto"><Badge n={b.problemMachines} label="Problem" /></span>
            </button>
            <Collapse open={open[b.name]}><div className="border-t border-line">{b.lokasis.map((l) => {
              const k = `${b.name}/${l.name}`;
              return (
                <div key={k} className="border-b border-line last:border-0">
                  <button onClick={() => toggle(k)} aria-expanded={!!open[k]} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 pl-10 text-left text-sm hover:bg-primary-light/40">
                    <ChevronDown size={16} className={`transition-transform ${open[k] ? 'rotate-180' : ''}`} />
                    <span className="font-medium">{l.name}</span><span className="text-xs text-mute">{l.type} • {l.machines.length} mesin</span>
                    <span className="ml-auto flex flex-wrap gap-2 text-xs">{l.machines.filter((m) => m.problem).map((m) => <span key={m.key} className="rounded bg-bad-bg px-1.5 py-0.5 text-bad">{m.type} {m.tid}</span>)}<Badge n={l.problemMachines} label="Problem" /></span>
                  </button>
                  <Collapse open={open[k]}><Machines machines={l.machines} date={date} lokasi={l.name} now={now} onPick={(p) => setSlot({ tid: p.machine.tid, hour: p.cell.hour, date: p.date, lokasi: p.lokasi })} /></Collapse>
                </div>);
            })}</div></Collapse>
          </section>))}</div></>)}
      <SlotPanel slot={slotObj} writeIssue={writeIssue} onFollowUp={onFollowUp} onClose={() => setSlot(null)} />
    </PageShell>
  );
}
