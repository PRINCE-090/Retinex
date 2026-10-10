/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#EDF1F6',
        surface: 'rgba(255, 255, 255, 0.55)',
        fg: '#0F172A',
        muted: '#64748B',
        border: 'rgba(255, 255, 255, 0.7)',
        // Single primary accent: confident indigo
        indigo: {
          DEFAULT: '#3B5BDB',
          hover: '#2F4BC4',
          light: 'rgba(59, 91, 219, 0.1)',
          border: 'rgba(59, 91, 219, 0.25)',
        },
        healthy: '#059669',
        mild: '#84CC16',
        moderate: '#D97706',
        severe: '#DC2626',
        proliferative: '#B91C1C',
        // Severity colors -- used ONLY on severity/grade indicators
        severity: {
          low: '#059669',
          moderate: '#D97706',
          high: '#DC2626',
        },
      },
      fontFamily: {
        heading: ['"Cabinet Grotesk"', '"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        panel: '12px',
        btn: '8px',
      },
      boxShadow: {
        glass: '0 4px 24px rgba(15, 23, 42, 0.06)',
        soft: '0 4px 24px rgba(15, 23, 42, 0.06)',
        card: '0 4px 24px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 4px 24px rgba(15, 23, 42, 0.06)',
        panel: '0 4px 24px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
