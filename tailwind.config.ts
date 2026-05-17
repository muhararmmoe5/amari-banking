import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm-dark layered surfaces (less blue, more depth)
        bg: {
          0: '#0a0a0c',
          1: '#111114',
          2: '#16161a',
          3: '#1c1c21',
          4: '#232328',
        },
        line: 'rgba(255,255,255,0.055)',
        'line-strong': 'rgba(255,255,255,0.10)',
        'line-2': 'rgba(255,255,255,0.16)',
        ink: {
          DEFAULT: '#f0eee9',
          dim: '#b0afa6',
          mute: '#6f6e68',
          ghost: '#44443f',
        },
        // Warm editorial entity palette
        entity: {
          bytes: '#c9a87a',      // warm gold
          rocket: '#6b8aa8',     // slate-blue
          delicious: '#c98a7a',  // terracotta
          amari: '#b18ac9',      // orchid
          'bytes-rest': '#7a8c6b', // sage
          personal: '#c9b8a8',   // warm cream
          multi: '#c9a87a',      // share with bytes
          unknown: '#6f6e68',
        },
        // Primary accent (same hex as bytes — the flagship)
        accent: {
          DEFAULT: '#c9a87a',
          dim: '#88724a',
        },
        // Functional money colors (desaturated for the warm palette)
        income: '#7fb892',
        expense: '#d18876',
        warn: '#f2b96d',
        crit: '#d18876',
        flag: {
          critBg: 'rgba(209,136,118,0.10)',
          critText: '#d18876',
          highBg: 'rgba(242,185,109,0.10)',
          highText: '#f2b96d',
          medBg: 'rgba(252,211,77,0.08)',
          medText: '#eab308',
          okBg: 'rgba(127,184,146,0.10)',
          okText: '#7fb892',
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
