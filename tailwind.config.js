export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: {
      primary: { DEFAULT: 'var(--color-primary)', hover: 'var(--color-primary-hover)', active: 'var(--color-primary-active)', light: 'var(--color-primary-light)', soft: 'var(--color-primary-soft)' },
      navy: 'var(--color-dark-navy)', surface: 'var(--color-surface)', line: 'var(--color-border)',
      ink: 'var(--color-text-primary)', mute: 'var(--color-text-secondary)',
      ok: { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
      bad: { DEFAULT: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
      warn: { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
      tl: { DEFAULT: 'var(--color-tl)', bg: 'var(--color-tl-bg)' },
      idle: { DEFAULT: 'var(--color-neutral)', bg: 'var(--color-neutral-bg)' }
    },
    fontFamily: { sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'], mono: ['"Space Mono"', 'ui-monospace', 'monospace'] }
  } }
};
