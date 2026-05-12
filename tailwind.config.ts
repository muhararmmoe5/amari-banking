import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#0C0C0E',
          1: '#141417',
          2: '#1C1C20',
          3: '#26262C',
        },
        line: 'rgba(255,255,255,0.07)',
        ink: {
          DEFAULT: '#F0EFE8',
          dim: '#A8A8A0',
          mute: '#6B6B66',
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
        income: '#22C55E',
        expense: '#EF4444',
        warn: '#F0A060',
        crit: '#EF4444',
        flag: {
          critBg: 'rgba(239,68,68,0.12)',
          critText: '#F87171',
          highBg: 'rgba(240,160,96,0.12)',
          highText: '#FBBF24',
          medBg: 'rgba(245,245,90,0.10)',
          medText: '#EAB308',
          okBg: 'rgba(34,197,94,0.12)',
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
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
