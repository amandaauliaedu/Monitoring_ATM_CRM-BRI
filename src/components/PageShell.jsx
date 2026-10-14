import { motion } from 'framer-motion';
export default function PageShell({ title, subtitle, children }) {
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      {subtitle && <p className="text-mute mt-1 mb-5 max-w-prose">{subtitle}</p>}
      {children}
    </motion.main>
  );
}
