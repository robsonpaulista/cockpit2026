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
        // Azul Institucional
        primary: {
          DEFAULT: '#0B4FAE',
          '50': '#F5F9FF',
          '100': '#EAF2FF',
          '700': '#0A3F8C',
          '900': '#072E66',
        },
        
        // Neutros
        bg: '#F8FAFC',
        card: '#FFFFFF',
        text: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
        },
        border: '#E5E7EB',
        
        // Fundos (legado)
        'bg-app': '#F8FAFC',
        'bg-surface': '#FFFFFF',
        'bg-sidebar': '#072E66',
        
        // Texto (legado)
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        'text-muted': '#64748B',
        
        // Acentos (legado - usando azul)
        'accent-gold': '#0B4FAE',
        'accent-gold-soft': '#EAF2FF',
        
        // Estados
        'status-success': '#2E7D32',
        'status-warning': '#C77800',
        'status-danger': '#9F2A2A',
        'status-info': '#6B7280',
        
        // Bordas (legado)
        'border-card': '#E5E7EB',
        
        // Compatibilidade
        background: '#F8FAFC',
        surface: '#FFFFFF',
        beige: {
          DEFAULT: '#F8FAFC',
          dark: '#F1F5F9',
        },
        status: {
          success: '#2E7D32',
          warning: '#C77800',
          error: '#9F2A2A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
      },
      boxShadow: {
        'card': '0 8px 24px rgba(17, 24, 39, 0.06)',
        'card-hover': '0 12px 32px rgba(17, 24, 39, 0.10)',
      },
      borderRadius: {
        'card': '14px',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
export default config




