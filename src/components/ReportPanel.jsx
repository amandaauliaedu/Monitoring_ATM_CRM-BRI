import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SLOTS } from '../utils/dateUtils.js';

const LABEL = { bermasalah: ['Problem', 'bg-bad-bg text-bad'], sudah_tl: ['Sudah TL', 'bg-tl-bg text-tl'], normal: ['Normal', 'bg-ok-bg text-ok'], verifikasi: ['Perlu verifikasi', 'bg-warn-bg text-warn'], belum: ['Belum diinput', 'bg-idle-bg text-mute'] };
const MAX_PHOTO = 5 * 1024 * 1024;
const nowHM = () => new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

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

function readFile(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = (e) => res({ name: f.name, mimeType: f.type, data: e.target.result }); r.onerror = () => rej(new Error('Foto gagal dibaca.')); r.readAsDataURL(f); });
}
// Tindak lanjut (TL) untuk laporan Problem: tanggal, jam, status sudah/belum, foto bukti. Jam TL diisi server (WIB).
function FollowUp({ report, issue, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(''); const [clock, setClock] = useState(nowHM());
  useEffect(() => { if (!open) return undefined; const t = setInterval(() => setClock(nowHM()), 15000); return () => clearInterval(t); }, [open]);
  if (report.status !== 'bermasalah') return null;

  const done = report.tlDone;
  const [tgl, jam] = done ? report.tlTime.split(' ') : [];
  const pick = (e) => {
    const f = e.target.files?.[0]; setErr('');
    if (!f) { setFile(null); return; }
    if (!f.type.startsWith('image/')) { e.target.value = ''; setErr('File harus berupa gambar.'); return; }
    if (f.size > MAX_PHOTO) { e.target.value = ''; setErr('Ukuran foto maksimal 5 MB.'); return; }
    setFile(f);
  };
  const submit = async () => {
    setErr('');
    if (!file) { setErr('Foto bukti TL wajib diunggah.'); return; }
    setSaving(true);
    try { await onSubmit({ report, fileObj: await readFile(file) }); setOpen(false); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const inp = 'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm';
  return (
    <div className={`space-y-3 rounded-lg border p-3 text-sm ${done ? 'border-tl bg-tl-bg' : 'border-line bg-white'}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-navy">Tindak lanjut (TL)</p>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${done ? 'bg-tl text-white' : 'bg-bad-bg text-bad'}`}>{done ? 'Sudah di-TL' : 'Belum di-TL'}</span>
      </div>
      <dl className="space-y-2">
        <div><dt className="text-mute">Tanggal TL</dt><dd className="font-medium">{done ? tgl : '—'}</dd></div>
        <div><dt className="text-mute">Jam TL</dt><dd className="font-medium">{done ? `${jam} WIB` : '—'}</dd></div>
        <div><dt className="text-mute">Foto bukti TL</dt><dd className="font-medium">{done && report.tlPhoto ? <a className="text-tl underline" href={report.tlPhoto} target="_blank" rel="noreferrer">Buka foto bukti TL</a> : '—'}</dd></div>
      </dl>
      {!done && issue && <p className="rounded bg-warn-bg p-2 text-xs text-warn">{issue}</p>}
      {!done && !issue && !open && <button onClick={() => setOpen(true)} className="w-full rounded-lg bg-primary px-3 py-2 font-semibold text-white hover:bg-primary-hover">Sudah di-TL</button>}
      {!done && !issue && open && (
        <div className="space-y-3 border-t border-line pt-3">
          <label className="block"><span className="text-mute">Foto bukti TL * (maks. 5 MB)</span><input type="file" accept="image/*" className={inp} onChange={pick} /></label>
          <p className="text-mute">Jam TL: <b className="text-ink">{clock} WIB</b> (otomatis, dicatat server saat disimpan)</p>
          {err && <p role="alert" className="rounded bg-bad-bg px-2 py-1 text-bad">{err}</p>}
          <div className="flex gap-2">
            <button disabled={saving} onClick={submit} className="flex-1 rounded-lg bg-primary px-3 py-2 font-semibold text-white hover:bg-primary-hover disabled:opacity-60">{saving ? 'Menyimpan…' : 'Done'}</button>
            <button disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border border-line bg-white px-3 py-2 hover:bg-primary-light">Batal</button>
          </div>
        </div>)}
    </div>
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
// Panel satu slot jam pada dashboard: semua laporan di slot itu, plus blok TL untuk laporan Problem.
export function SlotPanel({ slot, writeIssue, onFollowUp, onClose }) {
  return (
    <Shell open={!!slot} onClose={onClose} title={slot ? `${slot.machine.type} ${slot.machine.tid} • ${SLOTS[slot.cell.hour].label}` : ''} status={slot?.cell.status}>
      {slot && (<>
        <p className="text-mute">{slot.date} • {slot.lokasi}</p>
        {slot.cell.status === 'sudah_tl' && <p className="rounded-lg bg-tl-bg p-3 text-tl">Problem pada slot ini sudah di-TL (biru). Laporan aslinya tetap tersimpan di bawah.</p>}
        {slot.cell.reports.length === 0 && slot.cell.status === 'belum' && <p>Laporan monitoring untuk slot ini belum tersedia.</p>}
        {slot.cell.inferred && <p className="rounded-lg bg-primary-light p-3">Dianggap normal karena tidak ada laporan (pengaturan <code>emptyAsNormal</code>). Tidak ada laporan nyata untuk slot ini.</p>}
        {slot.cell.reports.map((r) => (
          <div key={r.id} className="space-y-2">
            <Details r={r} />
            <FollowUp report={r} issue={writeIssue} onSubmit={onFollowUp} />
          </div>))}
      </>)}
    </Shell>
  );
}
