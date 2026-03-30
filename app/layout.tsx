import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { RegisterPwa } from '@/components/register-pwa'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0E74BC',
}

export const metadata: Metadata = {
  title: 'Cockpit 2026 - Sistema Operacional de Gestão de Campanha',
  description: 'Dashboard integrado de gestão de campanha eleitoral',
  applicationName: 'Cockpit 2026',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cockpit 2026',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/192', sizes: '192x192', type: 'image/png' },
      { url: '/icons/512', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/180', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Script inline para aplicar tema antes do React hidratar (evita flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('cockpit-theme');
                var valid = t === 'premium' || t === 'agentes' || t === 'republicanos' || t === 'cockpit';
                document.documentElement.setAttribute('data-theme', valid ? t : 'republicanos');
              } catch(e) {
                document.documentElement.setAttribute('data-theme', 'republicanos');
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <RegisterPwa />
        {children}
      </body>
    </html>
  )
}

