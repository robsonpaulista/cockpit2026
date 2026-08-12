import { DashboardHomeWelcome } from '@/components/dashboard-home-welcome'

export default function Home() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <DashboardHomeWelcome variant="hero" />
    </div>
  )
}
