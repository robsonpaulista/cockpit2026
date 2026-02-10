import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Fundos (dinâmicos via CSS variables)
        'bg-app': 'rgb(var(--bg-app) / <alpha-value>)',
        'bg-surface': 'rgb(var(--bg-surface) / <alpha-value>)',
        'bg-sidebar': 'rgb(var(--bg-sidebar) / <alpha-value>)',
        
        // Texto (definido como objeto para usar text-text-primary)
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          strong: 'rgb(var(--text-primary) / <alpha-value>)',
        },
        
        // Acentos (dinâmicos - dourado no Premium, laranja no Agentes)
        'accent-gold': 'rgb(var(--accent-gold) / <alpha-value>)',
        'accent-gold-soft': 'rgb(var(--accent-gold-soft) / <alpha-value>)',
        'accent-gold-dark': 'rgb(var(--accent-gold-dark) / <alpha-value>)',
        
        // Estados (dinâmicos via CSS variables)
        status: {
          success: 'rgb(var(--success) / <alpha-value>)',
          warning: 'rgb(var(--warning) / <alpha-value>)',
          danger: 'rgb(var(--danger) / <alpha-value>)',
          error: 'rgb(var(--danger) / <alpha-value>)',
          info: 'rgb(var(--info) / <alpha-value>)',
        },
        
        // Bordas
        'border-card': 'rgb(var(--border-card) / <alpha-value>)',
        
        // Legado (para compatibilidade)
        primary: {
          DEFAULT: 'rgb(var(--accent-gold) / <alpha-value>)',
          dark: 'rgb(var(--accent-gold-dark) / <alpha-value>)',
          soft: 'rgb(var(--accent-gold-soft) / <alpha-value>)',
        },
        background: 'rgb(var(--bg-app) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        border: 'rgb(var(--border-card) / <alpha-value>)',
        beige: {
          DEFAULT: 'rgb(var(--bg-app) / <alpha-value>)',
          dark: 'rgb(var(--bg-sidebar) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
      },
      boxShadow: {
        'card': '0 6px 18px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
export default config
