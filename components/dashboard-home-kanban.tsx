'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  AtSign,
  BarChart2,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  History,
  Image,
  LayoutDashboard,
  MapPin,
  MapPinned,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Radar,
  Scale,
  ScrollText,
  Search,
  Settings,
  Shield,
  Target,
  Users,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_KANBAN_CARD_HINTS,
} from '@/lib/sidebar-menu-sections'
import { groupDashboardKanbanSections, getKanbanSectionAccent } from '@/lib/dashboard-kanban-groups'
import type { MenuItem } from '@/types'
import { useVisibleKanbanItems } from '@/hooks/use-visible-sidebar-items'
import { useNavigationLoading } from '@/contexts/navigation-loading-context'
import { useJarvisVisibility } from '@/contexts/jarvis-visibility-context'
import { usePermissions } from '@/hooks/use-permissions'
import { COCKPIT_MENU_LABEL } from '@/lib/sidebar-cockpit-labels'
import { AppBrandTitle } from '@/components/app-brand-title'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Activity,
  Bot,
  Target,
  Calendar,
  MapPin,
  MapPinned,
  ClipboardList,
  BarChart3,
  Vote,
  History,
  MessageSquare,
  Newspaper,
  Users,
  AtSign,
  Settings,
  MessageCircle,
  Radar,
  Scale,
  FileSpreadsheet,
  Building2,
  ScrollText,
  Search,
  Shield,
  BarChart2,
  Image,
  FileText,
}

function resolveIcon(name: string): LucideIcon {
  return iconMap[name] ?? LayoutDashboard
}

function cardLabel(id: string, fallback: string): string {
  return COCKPIT_MENU_LABEL[id] ?? fallback
}

function KanbanSectionHeader({ sectionId, label }: { sectionId: string; label: string }) {
  const accent = getKanbanSectionAccent(sectionId)

  return (
    <div
      className={cn(
        'mb-3 flex min-h-[3.75rem] shrink-0 items-center rounded-xl border backdrop-blur-sm sm:min-h-[4rem] lg:mb-4 lg:min-h-[4.25rem]',
        'px-4 py-3.5 sm:px-5 sm:py-4 lg:px-5 lg:py-[1.125rem]',
        accent.shell
      )}
    >
      <div className="flex w-full items-center">
        <h2
          className={cn(
            'font-jarvis-mono text-xs font-semibold uppercase tracking-[0.2em] sm:text-[0.8125rem] lg:text-sm',
            accent.title
          )}
        >
          {label}
        </h2>
      </div>
    </div>
  )
}

function KanbanCard({
  item,
  onNavigate,
  jarvisActive = false,
  onOpenJarvis,
}: {
  item: MenuItem & { children?: MenuItem[] }
  onNavigate: () => void
  jarvisActive?: boolean
  onOpenJarvis?: () => void
}) {
  const Icon = resolveIcon(item.icon)
  const hint = DASHBOARD_KANBAN_CARD_HINTS[item.id]
  const hasChildren = Boolean(item.children?.length)
  const isJarvisLauncher = item.id === 'jarvis-assistant'

  const cardShellClass = cn(
    'group flex h-[7.25rem] flex-col rounded-xl border sm:h-[7.5rem] lg:h-[8rem] lg:rounded-2xl',
    'bg-[rgba(2,11,20,0.72)] backdrop-blur-sm transition-all duration-200 ease-out',
    'hover:-translate-y-0.5 hover:bg-[rgba(2,18,32,0.92)]',
    'hover:shadow-[0_12px_32px_rgba(0,0,0,0.38),0_0_0_1px_rgba(0,212,255,0.1)]',
    'active:translate-y-0 active:shadow-[0_6px_18px_rgba(0,0,0,0.28)]',
    jarvisActive
      ? 'border-[rgba(0,212,255,0.42)] bg-[rgba(2,18,32,0.92)] shadow-[0_0_0_1px_rgba(0,212,255,0.14)]'
      : 'border-[rgba(0,212,255,0.1)] hover:border-[rgba(0,212,255,0.3)]'
  )

  const cardBody = (
    <div className="flex min-h-0 items-start gap-3">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          'border border-[rgba(0,212,255,0.15)] bg-[rgba(0,212,255,0.06)]',
          'text-[#00D4FF] transition-all duration-200',
          'group-hover:border-[rgba(0,212,255,0.38)] group-hover:bg-[rgba(0,212,255,0.14)] group-hover:shadow-[0_0_16px_rgba(0,212,255,0.12)]',
          'lg:h-11 lg:w-11 xl:h-12 xl:w-12'
        )}
      >
        <Icon className="h-4 w-4 lg:h-[1.125rem] lg:w-[1.125rem] xl:h-5 xl:w-5" strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-jarvis-display text-[0.9375rem] font-semibold leading-snug tracking-wide text-white transition-colors duration-200 group-hover:text-white sm:text-base lg:text-[1.0625rem] xl:text-lg">
          {cardLabel(item.id, item.label)}
        </h3>
        <div className="mt-1.5 min-h-[2.5rem]">
          {hint ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-[rgba(148,163,184,0.88)] transition-colors duration-200 group-hover:text-[rgba(186,198,214,0.95)] sm:text-[0.8125rem] lg:text-sm lg:leading-relaxed">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <article className={cardShellClass}>
      {isJarvisLauncher ? (
        <button
          type="button"
          onClick={onOpenJarvis}
          className={cn(
            'flex h-full min-h-0 w-full flex-col justify-center gap-2 p-3.5 text-left sm:gap-2.5 sm:p-4 lg:p-5',
            'no-underline hover:no-underline',
            'text-inherit visited:text-inherit',
            'outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[rgba(0,212,255,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020b14]'
          )}
        >
          {cardBody}
        </button>
      ) : (
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex h-full min-h-0 flex-col justify-center gap-2 p-3.5 sm:gap-2.5 sm:p-4 lg:p-5',
            'no-underline hover:no-underline',
            'text-inherit visited:text-inherit',
            'outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[rgba(0,212,255,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020b14]'
          )}
        >
          {cardBody}
        </Link>
      )}

      {hasChildren ? (
        <ul className="border-t border-[rgba(0,212,255,0.08)] px-2 py-2 lg:px-2.5 lg:py-2.5">
          {item.children!.map((child) => (
            <li key={child.id}>
              <Link
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center rounded-lg px-2.5 py-1.5 text-xs text-[rgba(203,213,225,0.9)]',
                  'no-underline hover:no-underline visited:text-[rgba(203,213,225,0.9)]',
                  'transition-colors hover:bg-[rgba(0,212,255,0.08)] hover:text-[#00D4FF]',
                  'lg:px-3 lg:py-2 lg:text-[0.8125rem] xl:text-sm'
                )}
              >
                {cardLabel(child.id, child.label)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

export function DashboardHomeKanban() {
  const pathname = usePathname()
  const router = useRouter()
  const { items, loading } = useVisibleKanbanItems()
  const { isAdmin } = usePermissions()
  const { visible: jarvisVisible, toggleJarvis } = useJarvisVisibility()
  const { setNavigating } = useNavigationLoading()
  const sections = groupDashboardKanbanSections(items, { includeJarvis: isAdmin })

  const onNavigate = () => {
    if (pathname !== '/dashboard') setNavigating(true)
  }

  const onOpenJarvis = () => {
    const nextVisible = !jarvisVisible
    toggleJarvis()
    if (nextVisible && pathname !== '/dashboard') {
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8 xl:pb-7">
        <AppBrandTitle
          isCockpit={false}
          lightOnGradient
          className="mb-2 block text-[1.16rem] sm:mb-3 sm:text-[1.25rem] lg:text-[1.35rem] xl:text-[1.45rem]"
        />
        <h1 className="font-jarvis-display text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-[1.75rem] xl:text-3xl 2xl:text-[2rem]">
          O que vamos acompanhar hoje?
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-1 sm:px-6 sm:pt-1 lg:px-8 xl:overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-[rgba(148,163,184,0.7)]">
            Carregando módulos…
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 pb-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-4 2xl:gap-5">
            {sections.map((section) => (
              <section
                key={section.id}
                className="flex h-full min-h-0 flex-col"
              >
                <KanbanSectionHeader sectionId={section.id} label={section.label} />
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5 scrollbar-hide lg:gap-3.5">
                  {section.items.map((item) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      onNavigate={onNavigate}
                      jarvisActive={item.id === 'jarvis-assistant' && jarvisVisible}
                      onOpenJarvis={item.id === 'jarvis-assistant' ? onOpenJarvis : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
