import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SLOTS } from '../utils/dateUtils.js';
import { reportKey } from '../utils/monitoringUtils.js';

const LABEL = { bermasalah: ['Problem', 'bg-bad-bg text-bad'], normal: ['Normal', 'bg-ok-bg text-ok'], verifikasi: ['Perlu verifikasi', 'bg-warn-bg text-warn'], belum: ['Belum diinput', 'bg-idle-bg text-mute'] };
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
// Tindak lanjut (TL) per laporan Problem. Jam TL diisi otomatis oleh server (WIB).
function FollowUp({ report, tl, enabled, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [petugas, setPetugas] = useState(''); const [pin, setPin] = useState(''); const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(''); const [clock, setClock] = useState(nowHM());
  useEffect(() => { if (!open) return undefined; const t = setInterval(() => setClock(nowHM()), 15000); return () => clearInterval(t); }, [open]);
  if (report.status !== 'bermasalah') return null;
  if (tl) return (
    <div className="rounded-lg border border-ok bg-ok-bg p-3 text-sm text-ok">
      <p className="font-semibold">Sudah di-TL</p>
      <p>{tl.tanggalTL} {tl.jamTL} WIB • oleh {tl.petugas}</p>
      {tl.foto && <a className="font-medium underline" href={tl.foto} target="_blank" rel="noreferrer">Buka foto TL</a>}
    </div>);
  if (!enabled) return <p className="rounded-lg bg-warn-bg p-3 text-xs text-warn">Penyimpanan TL belum dikonfigurasi (isi VITE_WRITE_API_URL).</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover">Sudah di-TL</button>;

  const pick = (e) => {
    const f = e.target.files?.[0]; setErr('');
    if (!f) { setFile(null); return; }
    if (!f.type.startsWith('image/')) { e.target.value = ''; setErr('File harus berupa gambar.'); return; }
    if (f.size > MAX_PHOTO) { e.target.value = ''; setErr('Ukuran foto maksimal 5 MB.'); return; }
    setFile(f);
  };
  const submit = async () => {
    setErr('');
    if (petugas.trim().length < 2) { setErr('Nama petugas TL wajib diisi.'); return; }
    if (!file) { setErr('Foto TL wajib diunggah.'); return; }
    setSaving(true);
    try { await onSubmit({ report, petugas: petugas.trim(), pin: pin.trim(), fileObj: await readFile(file) }); setOpen(false); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const inp = 'w-full rounded-lg border border-line px-2.5 py-1.5 text-sm';
  return (
    <div className="space-y-3 rounded-lg border border-primary bg-primary-light/50 p-3 text-sm">
      <p className="font-semibold text-navy">Tindak lanjut (TL)</p>
      <label className="block"><span className="text-mute">Nama petugas TL *</span><input className={inp} value={petugas} onChange={(e) => setPetugas(e.target.value)} maxLength={100} /></label>
      <label className="block"><span className="text-mute">Foto TL * (maks. 5 MB)</span><input type="file" accept="image/*" className={inp} onChange={pick} /></label>
      <p className="text-mute">Jam TL: <b className="text-ink">{clock} WIB</b> (otomatis, dicatat server saat disimpan)</p>
      <label className="block"><span className="text-mute">PIN TL (jika diwajibkan)</span><input type="password" className={inp} value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" /></label>
      {err && <p role="alert" className="rounded bg-bad-bg px-2 py-1 text-bad">{err}</p>}
      <div className="flex gap-2">
        <button disabled={saving} onClick={submit} className="flex-1 rounded-lg bg-primary px-3 py-2 font-semibold text-white hover:bg-primary-hover disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan TL'}</button>
        <button disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border border-line bg-white px-3 py-2 hover:bg-primary-light">Batal</button>
      </div>
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
// Panel satu slot jam pada dashboard: semua laporan di slot itu, plus form TL untuk laporan Problem.
export function SlotPanel({ slot, tlMap, writeEnabled, onFollowUp, onClose }) {
  return (
    <Shell open={!!slot} onClose={onClose} title={slot ? `${slot.machine.type} ${slot.machine.tid} • ${SLOTS[slot.cell.hour].label}` : ''} status={slot?.cell.status}>
      {slot && (<>
        <p className="text-mute">{slot.date} • {slot.lokasi}</p>
        {slot.cell.resolved && <p className="rounded-lg bg-ok-bg p-3 text-ok">Semua problem pada slot ini sudah di-TL, sehingga dihitung Normal. Laporan aslinya tetap tersimpan di bawah.</p>}
        {slot.cell.reports.length === 0 && slot.cell.status === 'belum' && <p>Laporan monitoring untuk slot ini belum tersedia.</p>}
        {slot.cell.inferred && <p className="rounded-lg bg-primary-light p-3">Dianggap normal karena tidak ada laporan (pengaturan <code>emptyAsNormal</code>). Tidak ada laporan nyata untuk slot ini.</p>}
        {slot.cell.reports.map((r) => (
          <div key={r.id} className="space-y-2">
            <Details r={r} />
            <FollowUp report={r} tl={tlMap.get(reportKey(r))} enabled={writeEnabled} onSubmit={onFollowUp} />
          </div>))}
      </>)}
    </Shell>
  );
}
