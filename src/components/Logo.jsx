import { useState } from 'react';
// Taruh logo Anda di public/logo.png. Jika tidak ada, tampil penanda geometris sederhana.
export default function Logo({ size = 40 }) {
  const [ok, setOk] = useState(true);
  return ok
    ? <img src="/logo.png" alt="BRI Region 12 Surabaya" width={size} height={size} className="object-contain" onError={() => setOk(false)} />
    : <div style={{ width: size, height: size }} className="grid place-items-center rounded-lg bg-primary font-bold text-white" aria-hidden>R12</div>;
}
