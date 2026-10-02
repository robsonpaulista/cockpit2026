import { CockpitXHub } from '@/components/preview-home/cockpit-x-hub'

/** Home autenticada — hub Cockpit X (sem sidebar). */
export default function Home() {
  return (
    <div className="relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-black">
      <CockpitXHub />
    </div>
  )
}
