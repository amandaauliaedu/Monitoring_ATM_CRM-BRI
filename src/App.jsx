import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import LiveResponse from './pages/LiveResponse.jsx';
import MonitoringDashboard from './pages/MonitoringDashboard.jsx';
import DataAnalyst from './pages/DataAnalyst.jsx';
import { useSheetData } from './hooks/useSheetData.js';
import { exportLiveResponses } from './services/exportService.js';

export default function App() {
  const data = useSheetData();
  const loc = useLocation();
  const live = { data: data.responses, master: data.master, loading: data.loading, error: data.error, refresh: data.refresh, skipped: data.skipped, rowsRead: data.rowsRead };
  const download = () => { try { exportLiveResponses(data.responses); } catch (e) { alert(`Ekspor gagal: ${e.message}`); } };
  return (
    <>
      <Navbar connected={!data.error && !data.loading} onDownload={download} />
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Home data={data} onDownload={download} />} />
          <Route path="/live-response" element={<LiveResponse live={live} />} />
          <Route path="/monitoring" element={<MonitoringDashboard data={data} />} />
          <Route path="/data-analyst" element={<DataAnalyst data={data} />} />
          <Route path="*" element={<Home data={data} onDownload={download} />} />
        </Routes>
      </AnimatePresence>
      <footer className="mx-auto max-w-6xl px-4 pb-6 pt-2 text-center text-xs text-mute">© 2026 Amanda Aulia | PT. Bank Rakyat Indonesia (Persero) Tbk</footer>
    </>
  );
}
