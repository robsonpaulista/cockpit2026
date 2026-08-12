import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'
import { HOME_SCENE_CAR, HOME_SCENE_PETROL } from '@/lib/rest-screen-chrome'

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
  /** ice = sidebar glass (preto + amarelo); amber = coral legado */
  tone?: 'amber' | 'ice'
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
  tone = 'amber',
}: UserAvatarPatchProps) {
  const initials = resolveUserInitials(name, email)
  const label = name?.trim() || email || 'Usuário'
  const isIce = tone === 'ice'

  return (
    <div
      className={cn(
        'user-avatar-patch flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
        SIZE_CLASS[size],
        isIce ? 'text-[#2b2d31]' : 'text-white',
        className
      )}
      style={{
        backgroundColor: isIce ? HOME_SCENE_CAR : SIDEBAR_BRAND_AMBER,
        color: isIce ? HOME_SCENE_PETROL : undefined,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  )
}
