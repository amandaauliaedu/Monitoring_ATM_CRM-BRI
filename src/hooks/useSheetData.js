import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllData } from '../services/googleSheetsService.js';
import { APP_CONFIG } from '../config/appConfig.js';
import { reportKey } from '../utils/monitoringUtils.js';

export function useSheetData() {
  const [s, setS] = useState({ responses: [], master: [], skipped: 0, rowsRead: 0, loading: true, error: null, lastUpdated: null });
  const ctl = useRef(null);
  const load = useCallback(async () => {
    ctl.current?.abort(); ctl.current = new AbortController();
    try {
      const r = await getAllData(ctl.current.signal);
      if (!r.stale) setS({ responses: r.responses, master: r.master, skipped: r.skipped, rowsRead: r.rowsRead, loading: false, error: null, lastUpdated: new Date() });
    } catch (e) { if (e.name !== 'AbortError') setS((p) => ({ ...p, loading: false, error: e.message })); }
  }, []);
  useEffect(() => {
    load(); const t = setInterval(load, APP_CONFIG.pollIntervalMs);
    return () => { clearInterval(t); ctl.current?.abort(); };
  }, [load]);
  // Setelah TL tersimpan, tandai laporan langsung agar kotak berubah biru tanpa menunggu polling.
  const applyTL = useCallback((rec) => setS((p) => ({ ...p, responses: p.responses.map((r) => (reportKey(r) === rec.key ? { ...r, tlDone: true, tlTime: rec.tlTime, tlPhoto: rec.tlPhoto } : r)) })), []);
  return { ...s, refresh: load, applyTL };
}
