import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SLOTS } from '../utils/dateUtils.js';

const LABEL = { bermasalah: ['Bermasalah', 'bg-bad-bg text-bad'], normal: ['Normal', 'bg-ok-bg text-ok'], verifikasi: ['Perlu verifikasi', 'bg-warn-bg text-warn'], belum: ['Belum diinput', 'bg-idle-bg text-mute'] };

function Details({ r }) {
  const rows = [['Tanggal monitoring', r.date], ['Periode jam', SLOTS[r.hour].label], ['Timestamp kirim', r.timestamp || '—'],
    ['Branch Office', r.bo], ['Lokasi', `${r.lokasi} (${r.ukerType || '—'})`],
    ['Mesin', `${r.machineType} • TID ${r.tid}`], ['Vendor', r.vendor || '—'], ['Status', (LABEL[r.status] || LABEL.belum)[0]],
    ['Keterangan problem', r.problems.join(', ') || '—'], ['Detail kendala', r.detail && r.detail !== '-' ? r.detail : '—'], ['Petugas', r.reporter || '—']];
  return (
    <dl className="space-y-3 rounded-lg border border-line p-3 text-sm">
      {rows.map(([k, v]) => <div key={k}><dt className="text-mute">{k}</dt><dd className="break-words font-medium text-ink">{v}</dd></div>)}
      {r.photo && <div><dt className="text-mute">Foto mesin</dt><dd><a className="font-medium text-primary underline" href={r.photo} target="_blank" rel="noreferrer">Buka foto</a></dd></div>}
    </dl>
  );
}
function Shell({ open, onClose, title, status, children }) {
  const [txt, cls] = LABEL[status] || LABEL.belum;
  return (
    <AnimatePresence>
      {open && (<>
        <motion.div className="fixed inset-0 z-40 bg-navy/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.aside role="dialog" aria-label={title} className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-surface p-5 shadow-xl"
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.22 }}>
          <div className="flex items-start justify-between"><h2 className="text-lg font-bold text-navy">{title}</h2>
            <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 hover:bg-primary-light"><X size={18} /></button></div>
          <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>
          <div className="mt-4 space-y-3 text-sm">{children}</div>
        </motion.aside>
      </>)}
    </AnimatePresence>
  );
}
export default function ReportPanel({ report, onClose }) {
  return <Shell open={!!report} onClose={onClose} title="Detail laporan" status={report?.status}>{report && <Details r={report} />}</Shell>;
}
// Panel satu slot jam pada dashboard monitoring: menampilkan semua laporan dalam slot itu.
export function SlotPanel({ slot, onClose }) {
  return (
    <Shell open={!!slot} onClose={onClose} title={slot ? `${slot.machine.type} ${slot.machine.tid} • ${SLOTS[slot.cell.hour].label}` : ''} status={slot?.cell.status}>
      {slot && (<>
        <p className="text-mute">{slot.date} • {slot.lokasi}</p>
        {slot.cell.reports.length === 0 && <p>{slot.cell.status === 'belum' ? 'Laporan monitoring untuk slot ini belum tersedia.' : ''}</p>}
        {slot.cell.inferred && <p className="rounded-lg bg-primary-light p-3">Dianggap normal karena tidak ada laporan gangguan (pengaturan <code>emptyAsNormal</code>). Tidak ada laporan nyata untuk slot ini.</p>}
        {slot.cell.reports.map((r) => <Details key={r.id} r={r} />)}
      </>)}
    </Shell>
  );
}
