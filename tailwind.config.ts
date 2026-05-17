import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Layered dark surfaces — slightly warmer + more depth steps
        bg: {
          0: '#0A0A0C',   // app background (deepest)
          1: '#111114',   // raised surface
          2: '#17171B',   // card / hovered surface
          3: '#1E1E24',   // input / pressed
          4: '#26262E',   // emphasised hover
        },
        line: 'rgba(255,255,255,0.06)',
        'line-strong': 'rgba(255,255,255,0.10)',
        ink: {
          DEFAULT: '#F4F3EC',
          dim: '#B8B7AE',
          mute: '#74746E',
          ghost: '#4A4A47',
        },
        entity: {
          bytes: '#C8F060',
          rocket: '#60C8F0',
          delicious: '#F0A060',
          amari: '#C060F0',
          personal: '#E8D8FF',
          multi: '#F0F060',
          unknown: '#888888',
        },
        income: '#34D17F',
        expense: '#F87171',
        warn: '#F0A060',
        crit: '#F87171',
        flag: {
          critBg: 'rgba(248,113,113,0.10)',
          critText: '#F87171',
          highBg: 'rgba(240,160,96,0.10)',
          highText: '#FBBF24',
          medBg: 'rgba(245,245,90,0.08)',
          medText: '#EAB308',
          okBg: 'rgba(52,209,127,0.10)',
          okText: '#4ADE80',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'DM Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['DM Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
      },
      boxShadow: {
        // Layered elevation
        'elev-1': '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.3)',
        'elev-2': '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 12px rgba(0,0,0,0.35)',
        'elev-3': '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px rgba(0,0,0,0.45)',
        'glow-bytes': '0 0 0 1px rgba(200,240,96,0.4), 0 0 24px rgba(200,240,96,0.15)',
        'glow-income': '0 0 0 1px rgba(52,209,127,0.4), 0 0 24px rgba(52,209,127,0.15)',
        soft: '0 8px 30px rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        'glass-card': 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 50%)',
        'bytes-gradient': 'linear-gradient(135deg, #C8F060 0%, #8FD030 100%)',
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.22, 1, 0.36, 1)',
        'shimmer': 'shimmer 2s linear infinite',
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
      },
    },
  },
  plugins: [],
};

export default config;
