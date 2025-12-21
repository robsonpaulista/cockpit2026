'use client'

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-surface rounded-lg mb-4"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-surface rounded-2xl"></div>
        ))}
      </div>
    </div>
  )
}

