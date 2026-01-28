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
        // Fundos Premium Bege
        'bg-app': '#F7F4EF',
        'bg-surface': '#FBF9F6',
        'bg-sidebar': '#EFE9E1',
        
        // Texto
        'text-primary': '#1C1C1C',
        'text-secondary': '#6B6B6B',
        'text-muted': '#9A9A9A',
        
        // Acentos Premium
        'accent-gold': '#C6A15B',
        'accent-gold-soft': '#E8D9B8',
        
        // Estados
        'status-success': '#2E7D32',
        'status-warning': '#C77800',
        'status-danger': '#9F2A2A',
        'status-info': '#6B7280',
        
        // Bordas
        'border-card': '#E5DED4',
        
        // Legado (para compatibilidade)
        primary: {
          DEFAULT: '#C6A15B',
          dark: '#A68347',
          soft: '#E8D9B8',
        },
        background: '#F7F4EF',
        surface: '#FBF9F6',
        text: {
          strong: '#1C1C1C',
          muted: '#6B6B6B',
        },
        border: '#E5DED4',
        beige: {
          DEFAULT: '#F7F4EF',
          dark: '#EFE9E1',
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




