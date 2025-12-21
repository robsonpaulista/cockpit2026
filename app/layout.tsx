import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'

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
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto lg:ml-64 mt-16 lg:mt-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

