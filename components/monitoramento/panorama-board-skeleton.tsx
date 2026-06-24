'use client'

import { premiumSkeletonBlockClass } from '@/lib/premium-ui-motion'
import { cn } from '@/lib/utils'

export function PanoramaBoardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4', className)} aria-busy aria-label="Carregando panorama">
      <div className="space-y-3">
        <div className={cn(premiumSkeletonBlockClass, 'h-4 w-48')} />
        <div className={cn(premiumSkeletonBlockClass, 'h-3 w-72')} />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.55)] bg-bg-surface p-3"
            >
              <div className={cn(premiumSkeletonBlockClass, 'mb-3 h-8 w-8 rounded-lg')} />
              <div className={cn(premiumSkeletonBlockClass, 'mb-2 h-4 w-full')} />
              <div className={cn(premiumSkeletonBlockClass, 'h-3 w-2/3')} />
              <div className={cn(premiumSkeletonBlockClass, 'mt-4 h-3 w-full')} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-[rgb(var(--color-border-tertiary)/0.55)] bg-bg-surface p-4"
          >
            <div className="mb-4 flex gap-3">
              <div className={cn(premiumSkeletonBlockClass, 'h-9 w-9 rounded-lg')} />
              <div className="flex-1 space-y-2">
                <div className={cn(premiumSkeletonBlockClass, 'h-4 w-40')} />
                <div className={cn(premiumSkeletonBlockClass, 'h-3 w-56')} />
              </div>
            </div>
            <div className={cn(premiumSkeletonBlockClass, 'mt-auto h-[280px] w-full rounded-lg')} />
          </div>
        ))}
      </div>
    </div>
  )
}
