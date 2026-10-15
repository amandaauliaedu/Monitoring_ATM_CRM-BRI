import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Building2, AlertTriangle, ShieldAlert, Download, ArrowUpRight, Copyright } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Kpi, ErrorBox } from '../components/ui.jsx';
import { machineKey, STATUS } from '../utils/monitoringUtils.js';

export default function Home({ data, onDownload }) {
  const { responses, master, loading, error, refresh } = data;
  const prob = responses.filter((r) => r.status === STATUS.PROBLEM);
  const boTotal = new Set(master.map((m) => m.bo)).size;
  const lokasiTotal = new Set(master.map((m) => `${m.bo}|${m.lokasi}`)).size;
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto max-w-6xl px-4">
      <section className="grid min-h-[62vh] items-center gap-8 py-10 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-primary"><Copyright size={12} />Operation, Service, and E-Channel (OSE)</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight text-navy sm:text-6xl">BRI REGION 12<br /><span className="inline-block border-b-2 border-primary pb-2 text-primary">SURABAYA</span></h1>
          <p className="mt-5 max-w-md text-mute">Monitoring ATM &amp; CRM Onsite: kondisi mesin per Branch Office dan Unit Kerja selama 24 jam.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/live-response" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-primary-hover">Lihat Live Response <ArrowUpRight size={14} /></Link>
            <button onClick={onDownload} className="flex items-center gap-2 rounded-lg border border-line bg-white/90 px-4 py-2.5 text-sm hover:bg-primary-light"><Download size={14} />Unduh Data Excel</button>
            <Link to="/data-analyst" className="rounded-lg border border-line bg-white/90 px-4 py-2.5 text-sm hover:bg-primary-light">Buka Data Analyst</Link>
          </div>
        </div>
        <div className="justify-self-center"><div className="rounded-[2.8rem] shadow-[0_30px_70px_rgba(8,87,195,0.28)]"><Logo size={300} /></div></div>
      </section>
      <ErrorBox error={error} onRetry={refresh} />
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Ringkasan cepat</p>
      <h2 className="mb-3 text-2xl font-bold text-navy">Status Monitoring Terkini</h2>
      {loading ? <p className="text-mute">Memuat data…</p> : (
        <div className="grid gap-3 pb-10 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total response" value={responses.length} icon={ClipboardList} hint="semua data" />
          <Kpi label="BO aktif (sudah melapor)" value={new Set(responses.map((r) => r.bo)).size} suffix={`/ ${boTotal}`} icon={Building2} />
          <Kpi label="Mesin bermasalah" value={new Set(prob.map(machineKey)).size} icon={AlertTriangle} tone="text-bad" hint={`${prob.length} laporan gangguan`} />
          <Kpi label="Lokasi terdampak" value={new Set(prob.map((r) => `${r.bo}|${r.lokasi}`)).size} suffix={`/ ${lokasiTotal}`} icon={ShieldAlert} />
        </div>)}
    </motion.main>
  );
}
