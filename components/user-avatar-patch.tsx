import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'

export function resolveUserInitials(name?: string, email?: string): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email?.[0]?.toUpperCase() ?? 'U'
}

type UserAvatarPatchProps = {
  name?: string
  email?: string
  avatarUrl?: string | null
  size?: 'sm' | 'md'
  className?: string
}

const SIZE_CLASS = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
} as const

export function UserAvatarPatch({
  name,
  email,
  avatarUrl,
  size = 'md',
  className,
}: UserAvatarPatchProps) {
  const initials = resolveUserInitials(name, email)
  const label = name?.trim() || email || 'Usuário'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        SIZE_CLASS[size],
        className
      )}
      style={{ backgroundColor: SIDEBAR_BRAND_AMBER }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  )
}
