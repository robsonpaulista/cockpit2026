import { DashboardHomeWelcome } from '@/components/dashboard-home-welcome'

export default function Home() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center">
      <DashboardHomeWelcome variant="hero" />
    </div>
  )
}
