import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cockpit 2026 - Sistema Operacional de Gestão de Campanha',
  description: 'Dashboard integrado de gestão de campanha eleitoral',
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
                document.documentElement.setAttribute('data-theme', t === 'premium' ? 'premium' : 'agentes');
              } catch(e) {
                document.documentElement.setAttribute('data-theme', 'agentes');
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}

