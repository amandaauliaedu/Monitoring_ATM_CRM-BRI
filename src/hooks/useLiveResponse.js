import { useCallback, useEffect, useRef, useState } from 'react';
import { getLiveResponses } from '../services/googleSheetsService.js';
import { APP_CONFIG } from '../config/appConfig.js';

export function useLiveResponse() {
  const [state, setState] = useState({ data: [], loading: true, error: null, lastUpdated: null });
  const ctl = useRef(null);
  const load = useCallback(async () => {
    ctl.current?.abort(); ctl.current = new AbortController();
    try {
      const r = await getLiveResponses(ctl.current.signal);
      if (!r.stale) setState({ data: r.data, loading: false, error: null, lastUpdated: new Date() });
    } catch (e) { if (e.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: e.message })); }
  }, []);
  useEffect(() => {
    load(); const t = setInterval(load, APP_CONFIG.pollIntervalMs);
    return () => { clearInterval(t); ctl.current?.abort(); };
  }, [load]);
  return { ...state, refresh: load };
}
