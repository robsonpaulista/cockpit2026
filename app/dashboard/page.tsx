import { Outfit } from 'next/font/google'
import { PreviewHomeScreen } from '@/components/preview-home/preview-home-screen'
import '@/app/dashboard/war-room/war-room-fonts.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-preview-home',
})

/** Home autenticada — mesma composição cinematográfica da prévia. */
export default function Home() {
  return (
    <div
      className={`relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden ${outfit.variable}`}
      style={{ fontFamily: 'var(--font-preview-home), Outfit, sans-serif' }}
    >
      <PreviewHomeScreen mode="dashboard" />
    </div>
  )
}
