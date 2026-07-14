import type { Metadata, Viewport } from 'next'
import { Inter, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { RegisterPwa } from '@/components/register-pwa'
import { DevChunkRecovery } from '@/components/dev-chunk-recovery'

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans-fallback',
  display: 'swap',
})

const appFontVariables = `${sourceSans3.variable} ${inter.variable}`

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
    <html lang="pt-BR" suppressHydrationWarning className={appFontVariables}>
      <head>
        {/* Script inline para aplicar tema antes do React hidratar (evita flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('cockpit-theme');
                if (t === 'cockpit' || t === 'premium') {
                  t = 'republicanos';
                  localStorage.setItem('cockpit-theme', 'republicanos');
                }
                var valid = t === 'agentes' || t === 'republicanos';
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
      <body className={`${sourceSans3.className} ${appFontVariables} font-sans antialiased`}>
        <RegisterPwa />
        <DevChunkRecovery />
        {children}
      </body>
    </html>
  )
}
