import { NavLink } from 'react-router-dom';
import { Home, Radio, LayoutDashboard, BarChart3, Download, Wifi, WifiOff } from 'lucide-react';
import Logo from './Logo.jsx';

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/live-response', label: 'Live Response', icon: Radio },
  { to: '/monitoring', label: 'Monitoring Dashboard', icon: LayoutDashboard },
  { to: '/data-analyst', label: 'Data Analyst', icon: BarChart3 }
];
export default function Navbar({ connected, onDownload }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5"><Logo size={36} />
          <div className="leading-tight"><p className="text-sm font-bold text-navy">BRI Region 12 Surabaya</p><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-mute">Operation, Service, and E-Channel (OSE)</p></div></div>
        <nav className="flex flex-wrap gap-1 md:ml-4" aria-label="Navigasi utama">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white shadow' : 'text-mute hover:bg-primary-light'}`}><Icon size={15} />{label}</NavLink>))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className={`flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-widest ${connected ? 'text-ok' : 'text-mute'}`}>{connected ? <Wifi size={13} /> : <WifiOff size={13} />}{connected ? 'LIVE' : 'OFFLINE'}</span>
          <button onClick={onDownload} className="rounded-lg border border-line bg-white p-2 hover:bg-primary-light" aria-label="Unduh data Excel" title="Unduh seluruh data (Excel)"><Download size={15} /></button>
        </div>
      </div>
    </header>
  );
}
