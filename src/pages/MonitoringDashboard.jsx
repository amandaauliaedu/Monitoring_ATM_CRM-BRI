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
import { VENDORS } from '../utils/analyticsUtils.js';
import { reportsByTid, unresolvedSince, minutesSince, formatDuration, clock } from '../utils/monitoringUtils.js';

const CELL = {
  bermasalah: ['bg-bad text-white', '✕', 'Problem'], sudah_tl: ['bg-tl text-white', '✓', 'Tindak Lanjut'], normal: ['bg-ok text-white', '✓', 'Normal'],
  verifikasi: ['bg-[#FFE98A] text-[#8A5A00]', '!', 'Perlu verifikasi'], belum: ['bg-[#FFE98A] text-[#8A5A00]', '!', 'Belum diinput']
};
// Legenda: hanya 4 keterangan (urutan sesuai permintaan). "Perlu verifikasi" memakai warna krem yang sama dengan Belum diinput.
// Kategori mesin pada KPI (per tanggal terpilih). Normal = ada slot normal dan tidak ada slot problem yang belum di-TL.
const CATS = [
  ['bermasalah', 'Mesin Problem', 'text-bad', (m) => m.problem > 0],
  ['normal', 'Mesin Normal', 'text-ok', (m) => m.normal > 0 && m.problem === 0],
  ['sudah_tl', 'Tindak Lanjut', 'text-tl', (m) => m.tl > 0]
];
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
  const [cat, setCat] = useState(null);
  const [vsel, setVsel] = useState(null); // { name, kind: 'CRM' | 'ATM' | 'ALL' } untuk kategori Problem / Tindak Lanjut
  const byTid = useMemo(() => reportsByTid(responses), [responses]);
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
  const goMachine = (b, l, m, hour) => {
    setOpen((o) => ({ ...o, [b]: true, [`${b}/${l}`]: true }));
    if (hour !== undefined) setSlot({ tid: m.tid, hour, date, lokasi: l });
  };
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
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Branch Office" value={view.length} /><Kpi label="Lokasi" value={view.reduce((n, b) => n + b.lokasis.length, 0)} />
          {CATS.map(([k, label, tone, test]) => (
            <button key={k} type="button" onClick={() => { setCat(cat === k ? null : k); setVsel(null); }} aria-pressed={cat === k} title={`Klik untuk melihat daftar ${label.toLowerCase()}`}
              className={`rounded-2xl text-left transition ${cat === k ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-primary/40'}`}>
              <Kpi label={label} value={all.filter(test).length} tone={tone} hint={`dari ${all.length} mesin • klik untuk detail`} />
            </button>))}
        </div>
        {cat && (() => {
          const [, label, tone, test] = CATS.find((c) => c[0] === cat);
          const showDur = cat === 'bermasalah';
          // Problem & Tindak Lanjut: tampilkan rekap per vendor dulu; daftar mesin muncul setelah angka vendor diklik.
          const isV = cat !== 'normal';
          const vk = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
          const word = cat === 'bermasalah' ? 'Bermasalah' : 'Tindak Lanjut';
          const base = view.flatMap((b) => b.lokasis.flatMap((l) => l.machines.filter(test)));
          const vNames = [...VENDORS];
          for (const m of base) { const v = String(m.vendor ?? '').trim().replace(/\s+/g, ' ') || 'Tanpa Vendor'; if (!vNames.some((n) => vk(n) === vk(v))) vNames.push(v); }
          const vOf = (m) => (String(m.vendor ?? '').trim() ? m.vendor : 'Tanpa Vendor');
          const vMatch = (m, s) => vk(vOf(m)) === vk(s.name) && (s.kind === 'ALL' || m.type === s.kind);
          const vCards = vNames.map((name) => ({ name, crm: base.filter((m) => vMatch(m, { name, kind: 'CRM' })).length, atm: base.filter((m) => vMatch(m, { name, kind: 'ATM' })).length, total: base.filter((m) => vMatch(m, { name, kind: 'ALL' })).length }));
          const showTable = !isV || !!vsel;
          // Durasi belum di-TL: dari laporan Problem pertama yang belum di-TL (lintas tanggal) sampai jam sekarang.
          const rows = view.flatMap((b) => b.lokasis.flatMap((l) => l.machines.filter((m) => test(m) && (!isV || !vsel || vMatch(m, vsel))).map((m) => {
            const st = showDur ? unresolvedSince(byTid.get(m.tid)) : null;
            return { b, l, m, st, dur: st ? minutesSince(st, now) : null };
          }))).sort((x, y) => (showDur ? (y.dur ?? -1) - (x.dur ?? -1) : 0));
          return (<>
            {isV && (
              <Card className="mb-4" title={cat === 'bermasalah' ? 'Mesin Bermasalah per Vendor' : 'Mesin Tindak Lanjut per Vendor'} right={<button onClick={() => { setCat(null); setVsel(null); }} className="text-xs text-mute underline">Tutup</button>}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {vCards.map((v) => (
                    <div key={v.name} className="rounded-xl border border-line bg-white p-3">
                      <p className="mb-2 font-semibold text-navy">{v.name}</p>
                      <dl className="space-y-1 text-sm">
                        {[['CRM', `CRM ${word}`, v.crm, ''], ['ATM', `ATM ${word}`, v.atm, ''], ['ALL', `Total Mesin ${word}`, v.total, 'border-t border-line pt-1 font-medium']].map(([kind, lbl, n, extra]) => {
                          const on = vsel?.name === v.name && vsel?.kind === kind;
                          return (
                            <button key={kind} type="button" disabled={!n} onClick={() => setVsel(on ? null : { name: v.name, kind })} aria-pressed={on} title={n ? 'Klik untuk melihat mesin' : ''}
                              className={`flex w-full justify-between rounded px-1 text-left enabled:hover:bg-primary-light/60 ${extra} ${on ? 'bg-primary-light' : ''}`}>
                              <span className={extra ? '' : 'text-mute'}>{lbl}</span><span className={`font-bold ${kind === 'ALL' ? (n ? tone : 'text-ok') : ''}`}>{n}</span>
                            </button>);
                        })}
                      </dl>
                    </div>))}
                </div>
              </Card>)}
            {showTable && <Card className="mb-4" title={vsel ? `${vsel.name} • ${vsel.kind === 'ALL' ? 'Semua mesin' : vsel.kind} ${word.toLowerCase()}: ${rows.length} mesin` : `${label}: ${rows.length} mesin`} right={<button onClick={() => (isV ? setVsel(null) : setCat(null))} className="text-xs text-mute underline">Tutup</button>}>
              {rows.length === 0 ? <Empty>Tidak ada mesin pada kategori ini.</Empty> : (
                <div className="max-h-[50vh] overflow-auto"><table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr>{['Branch Office', 'Lokasi', 'Mesin', 'TID', 'Vendor', 'Jam', ...(showDur ? ['Durasi Belum TL'] : [])].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-navy">{h}</th>)}</tr></thead>
                  <tbody>{rows.map(({ b, l, m, st, dur }) => {
                    const hrs = m.slots.filter((x) => x.status === cat).map((x) => x.hour);
                    return (
                      <tr key={m.key} tabIndex={0} onClick={() => goMachine(b.name, l.name, m, hrs[0])} onKeyDown={(e) => e.key === 'Enter' && goMachine(b.name, l.name, m, hrs[0])} className="cursor-pointer border-t border-line/70 hover:bg-primary-light/50">
                        <td className="px-3 py-2">{b.name}</td><td className="px-3 py-2">{l.name}</td><td className="px-3 py-2">{m.type || '—'}</td>
                        <td className={`px-3 py-2 font-semibold ${tone}`}>{m.tid}</td><td className="px-3 py-2">{m.vendor || '—'}</td>
                        <td className="px-3 py-2 text-xs">{hrs.map((h) => String(h).padStart(2, '0')).join(', ')}</td>
                        {showDur && <td className="whitespace-nowrap px-3 py-2">{st ? (<><span className="font-bold text-bad">{formatDuration(dur)}</span><span className="block text-[11px] text-mute">sejak {st.date} {clock(st)}</span></>) : <span className="text-xs text-mute">Sudah normal</span>}</td>}
                      </tr>);
                  })}</tbody></table></div>)}
            </Card>}
          </>);
        })()}
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
