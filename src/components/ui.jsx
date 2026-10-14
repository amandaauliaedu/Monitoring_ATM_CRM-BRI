const glass = 'rounded-2xl border border-white/70 bg-white/75 shadow-[0_8px_30px_rgba(8,87,195,0.08)] backdrop-blur';
export const Card = ({ title, children, className = '', right }) => (
  <section className={`${glass} p-4 ${className}`}>
    {(title || right) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold text-navy">{title}</h2>{right}</div>}
    {children}
  </section>
);
export const Kpi = ({ label, value, suffix, hint, icon: Icon, tone = 'text-navy' }) => (
  <div className={`${glass} p-5`}>
    <div className="flex items-start justify-between gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</p>
      {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon size={18} /></span>}
    </div>
    <p className={`mt-3 text-4xl font-bold ${tone}`}>{value}{suffix && <span className="ml-1.5 text-sm font-medium text-mute">{suffix}</span>}</p>
    {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
  </div>
);
export const Empty = ({ children = 'Tidak ada data.' }) => <p className="py-6 text-center text-sm text-mute">{children}</p>;
export const ErrorBox = ({ error, onRetry }) => error && (
  <div role="alert" className="mb-4 rounded-lg border border-bad bg-bad-bg p-4 text-sm">
    <p className="font-semibold text-bad">Data gagal dimuat</p><p className="mt-1">{error}</p>
    <button onClick={onRetry} className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-white hover:bg-primary-hover">Coba lagi</button>
  </div>
);
export const field = 'rounded-lg border border-line bg-white/90 px-2.5 py-1.5 text-sm';
