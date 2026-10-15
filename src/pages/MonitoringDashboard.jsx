import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import PageShell from '../components/PageShell.jsx';
import { SlotPanel } from '../components/ReportPanel.jsx';
import { Card, Kpi, Empty, ErrorBox, field } from '../components/ui.jsx';
import { buildTree } from '../utils/treeUtils.js';
import { submitFollowUp } from '../services/googleSheetsService.js';
import { APP_CONFIG } from '../config/appConfig.js';
import { nowInJakarta, SLOTS } from '../utils/dateUtils.js';

const CELL = {
  bermasalah: ['bg-bad text-white', '✕', 'Problem'], normal: ['bg-ok text-white', '✓', 'Normal / sudah TL'],
  verifikasi: ['bg-warn text-white', '!', 'Perlu verifikasi'], belum: ['border border-line bg-idle-bg text-idle', '·', 'Belum diinput']
};
const Collapse = ({ open, children }) => (
  <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">{children}</motion.div>}</AnimatePresence>
);
const Badge = ({ n, label }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${n ? 'bg-bad-bg text-bad' : 'bg-ok-bg text-ok'}`}>{n ? `${n} ${label}` : 'Aman'}</span>;

function Machines({ machines, date, lokasi, now, onPick }) {
  return (
    <div className="overflow-x-auto px-4 pb-4">
      <div className="grid items-center gap-1 text-xs" style={{ gridTemplateColumns: '170px repeat(24, 30px)', width: 'max-content' }}>
        <span />{SLOTS.map((s) => <span key={s.hour} title={s.label} className="text-center text-mute">{String(s.hour).padStart(2, '0')}</span>)}
        {machines.map((m) => (<>
          <div key={m.key} className="sticky left-0 z-10 bg-surface pr-2"><p className="font-semibold">{m.type || '—'} {m.tid}</p><p className="text-mute">{m.vendor || 'vendor belum ada'} • {m.problem} slot problem</p></div>
          {m.slots.map((c) => {
            const [cls, ico, name] = CELL[c.status]; const future = date > now.date || (date === now.date && c.hour > now.hour);
            return <button key={`${m.key}${c.hour}`} onClick={() => onPick({ machine: m, cell: c, date, lokasi })} title={`${SLOTS[c.hour].label} • ${c.resolved ? 'Normal (problem sudah di-TL)' : name}${c.reports.length ? ` • ${c.reports.length} laporan` : ''}`} aria-label={`${m.type} ${m.tid} ${SLOTS[c.hour].label} ${name}`} className={`h-7 w-[30px] rounded text-xs font-bold ${cls} ${future ? 'opacity-40' : ''} hover:ring-2 hover:ring-primary`}>{ico}</button>;
          })}
        </>))}
      </div>
    </div>
  );
}

export default function MonitoringDashboard({ data }) {
  const { responses, master, tl = [], addTL, loading, error, refresh } = data;
  const now = nowInJakarta();
  const [date, setDate] = useState(now.date);
  const [bo, setBo] = useState(''); const [lokasi, setLokasi] = useState(''); const [q, setQ] = useState('');
  const [open, setOpen] = useState({}); const [slot, setSlot] = useState(null);
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const tlMap = useMemo(() => new Map(tl.map((t) => [t.key, t])), [tl]);
  const tree = useMemo(() => buildTree(master, responses, date, now, undefined, new Set(tlMap.keys())), [master, responses, tlMap, date, now.date, now.hour]);
  const slotObj = useMemo(() => {
    if (!slot) return null;
    for (const b of tree) for (const l of b.lokasis) { const m = l.machines.find((x) => x.tid === slot.tid); if (m) return { machine: m, cell: m.slots[slot.hour], date: slot.date, lokasi: slot.lokasi }; }
    return null;
  }, [slot, tree]);
  const onFollowUp = async (payload) => { const rec = await submitFollowUp(payload); addTL(rec); refresh(); return rec; };
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
      <div className="mt-3 flex flex-wrap gap-3 text-xs">{Object.entries(CELL).map(([k, [cls, ico, name]]) => <span key={k} className="flex items-center gap-1.5"><span className={`grid h-5 w-5 place-items-center rounded font-bold ${cls}`}>{ico}</span>{name}</span>)}</div></Card>

      {loading ? <p className="text-mute">Memuat data…</p> : (<>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Branch Office" value={view.length} /><Kpi label="Lokasi" value={view.reduce((n, b) => n + b.lokasis.length, 0)} />
          <Kpi label="Mesin problem" value={all.filter((m) => m.problem > 0).length} hint={`dari ${all.length} mesin terdaftar`} tone="text-bad" />
          <Kpi label="Slot problem" value={all.reduce((n, m) => n + m.problem, 0)} hint={`${all.reduce((n, m) => n + m.reportsToday, 0)} laporan pada ${date}`} />
        </div>
        <p className="mb-3 text-xs text-mute">Daftar BO, lokasi, dan mesin dari sheet Database_Monitoring. Kotak abu-abu berarti belum ada laporan pada jam itu, bukan berarti normal.</p>
        {view.length === 0 && <Empty>Tidak ada BO/lokasi yang cocok dengan filter.</Empty>}
        <div className="space-y-3">{view.map((b) => (
          <section key={b.name} className="rounded-xl border border-white/70 bg-white/75 shadow-sm backdrop-blur">
            <button onClick={() => toggle(b.name)} aria-expanded={!!open[b.name]} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
              <ChevronDown size={18} className={`transition-transform ${open[b.name] ? 'rotate-180' : ''}`} />
              <span className="font-semibold text-navy">{b.name}</span>
              <span className="text-xs text-mute">{b.lokasis.length} lokasi • {b.atm} ATM • {b.crm} CRM</span>
              <span className="ml-auto"><Badge n={b.problemMachines} label="mesin problem" /></span>
            </button>
            <Collapse open={open[b.name]}><div className="border-t border-line">{b.lokasis.map((l) => {
              const k = `${b.name}/${l.name}`;
              return (
                <div key={k} className="border-b border-line last:border-0">
                  <button onClick={() => toggle(k)} aria-expanded={!!open[k]} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 pl-10 text-left text-sm hover:bg-primary-light/40">
                    <ChevronDown size={16} className={`transition-transform ${open[k] ? 'rotate-180' : ''}`} />
                    <span className="font-medium">{l.name}</span><span className="text-xs text-mute">{l.type} • {l.machines.length} mesin</span>
                    <span className="ml-auto flex flex-wrap gap-2 text-xs">{l.machines.filter((m) => m.problem).map((m) => <span key={m.key} className="rounded bg-bad-bg px-1.5 py-0.5 text-bad">{m.type} {m.tid}</span>)}<Badge n={l.problemMachines} label="problem" /></span>
                  </button>
                  <Collapse open={open[k]}><Machines machines={l.machines} date={date} lokasi={l.name} now={now} onPick={(p) => setSlot({ tid: p.machine.tid, hour: p.cell.hour, date: p.date, lokasi: p.lokasi })} /></Collapse>
                </div>);
            })}</div></Collapse>
          </section>))}</div></>)}
      <SlotPanel slot={slotObj} tlMap={tlMap} writeEnabled={!!APP_CONFIG.writeApiUrl} onFollowUp={onFollowUp} onClose={() => setSlot(null)} />
    </PageShell>
  );
}
