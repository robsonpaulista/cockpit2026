import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { RegisterPwa } from '@/components/register-pwa'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

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
                var a = localStorage.getItem('cockpit-appearance');
                var ap = a === 'dark' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-appearance', ap);
                document.documentElement.style.colorScheme = ap;
              } catch(e) {
                document.documentElement.setAttribute('data-theme', 'republicanos');
                document.documentElement.setAttribute('data-appearance', 'light');
                document.documentElement.style.colorScheme = 'light';
              }
            `,
          }}
        />
      </head>
      <body className={`${ibmPlexSans.className} ${ibmPlexSans.variable}`}>
        <RegisterPwa />
        {children}
      </body>
    </html>
  )
}

