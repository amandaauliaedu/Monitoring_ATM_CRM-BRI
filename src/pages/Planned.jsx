import PageShell from '../components/PageShell.jsx';
export default function Planned({ title, notes }) {
  return (
    <PageShell title={title}>
      <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-sm">
        <p className="font-semibold text-navy">Halaman ini belum dibangun.</p>
        <p className="mt-1 text-mute">{notes}</p>
      </div>
    </PageShell>
  );
}
