import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllData } from '../services/googleSheetsService.js';
import { APP_CONFIG } from '../config/appConfig.js';

export function useSheetData() {
  const [s, setS] = useState({ responses: [], master: [], tl: [], skipped: 0, rowsRead: 0, loading: true, error: null, lastUpdated: null });
  const ctl = useRef(null);
  const load = useCallback(async () => {
    ctl.current?.abort(); ctl.current = new AbortController();
    try {
      const r = await getAllData(ctl.current.signal);
      if (!r.stale) setS({ responses: r.responses, master: r.master, tl: r.tl, skipped: r.skipped, rowsRead: r.rowsRead, loading: false, error: null, lastUpdated: new Date() });
    } catch (e) { if (e.name !== 'AbortError') setS((p) => ({ ...p, loading: false, error: e.message })); }
  }, []);
  useEffect(() => {
    load(); const t = setInterval(load, APP_CONFIG.pollIntervalMs);
    return () => { clearInterval(t); ctl.current?.abort(); };
  }, [load]);
  const addTL = useCallback((rec) => setS((p) => ({ ...p, tl: [...p.tl.filter((t) => t.key !== rec.key), rec] })), []);
  return { ...s, refresh: load, addTL };
}
