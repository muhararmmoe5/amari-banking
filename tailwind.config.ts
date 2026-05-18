import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm-dark layered surfaces — per drawer spec, slightly warmer
        bg: {
          0: '#0f0e0d',
          1: '#161513',
          2: '#1d1b18',
          3: '#252320',
          4: '#2e2b27',
        },
        line: 'rgba(255,255,255,0.07)',
        'line-strong': 'rgba(255,255,255,0.12)',
        'line-2': 'rgba(255,255,255,0.20)',
        ink: {
          DEFAULT: '#f0ece4',
          dim: '#b8b0a4',
          mute: '#7a746c',
          ghost: '#4a4540',
        },
        // Warm editorial entity palette
        entity: {
          bytes: '#c9a87a',
          rocket: '#6b8aa8',
          delicious: '#c98a7a',
          amari: '#b18ac9',
          'bytes-rest': '#7a8c6b',
          personal: '#c9b8a8',
          multi: '#c9a87a',
          unknown: '#6f6e68',
        },
        accent: {
          DEFAULT: '#c9a87a',
          dim: '#88724a',
        },
        gold: '#c9a87a',
        // Functional / semantic — per drawer spec
        income: '#4ade80',
        expense: '#f87171',
        warn: '#fbbf24',
        info: '#60a5fa',
        purple: '#a78bfa',
        crit: '#f87171',
        flag: {
          critBg: 'rgba(248,113,113,0.10)',
          critText: '#f87171',
          highBg: 'rgba(251,191,36,0.10)',
          highText: '#fbbf24',
          medBg: 'rgba(252,211,77,0.08)',
          medText: '#eab308',
          okBg: 'rgba(74,222,128,0.10)',
          okText: '#4ade80',
        },
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SF Mono', 'monospace'],
        serif: ['Instrument Serif', 'Times New Roman', 'serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,.03) inset, 0 1px 2px rgba(0,0,0,.4)',
        pop: '0 1px 0 rgba(255,255,255,.06) inset, 0 24px 60px -20px rgba(0,0,0,.8)',
        'elev-1': '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.3)',
        'elev-2': '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 12px rgba(0,0,0,0.35)',
        'elev-3': '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px rgba(0,0,0,0.45)',
        'glow-bytes': '0 0 0 1px rgba(201,168,122,0.4), 0 0 24px rgba(201,168,122,0.15)',
        'glow-income': '0 0 0 1px rgba(127,184,146,0.4), 0 0 24px rgba(127,184,146,0.15)',
        soft: '0 8px 30px rgba(0,0,0,0.35)',
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.22, 1, 0.36, 1)',
        'shimmer': 'shimmer 2s linear infinite',
        'ring-fill': 'ring-fill 600ms cubic-bezier(.2,.7,.2,1) both',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.96)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ring-fill': {
          from: { strokeDashoffset: 'var(--ring-circumference, 1000)' },
          to: { strokeDashoffset: 'var(--ring-target, 0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
