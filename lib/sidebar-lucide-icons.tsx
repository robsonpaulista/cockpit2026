import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AtSign,
  BarChart3,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  History,
  Image,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  Radar,
  Scale,
  ScrollText,
  Search,
  Settings,
  Shield,
  Target,
  Users,
  Youtube,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** War Room sidebar — Lucide outline alinhado ao resto do Copiloto. */
export const WR_SIDEBAR_ICON_SIZE = 18
export const WR_SIDEBAR_ICON_STROKE = 1.5

export const sidebarLucideIconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Calendar,
  FileText,
  MessageSquare,
  Newspaper,
  MapPin,
  Users,
  MessageCircle,
  BarChart3,
  Settings,
  Scale,
  Vote: CheckSquare,
  Building2,
  Shield,
  Activity,
  Search,
  ScrollText,
  Target,
  ClipboardList,
  Database,
  History,
  MapPinned: MapPin,
  Image,
  AtSign,
  FileSpreadsheet,
  Youtube,
  Radar,
  FolderOpen,
  Package,
}

export function resolveSidebarLucideIcon(iconName: string): LucideIcon {
  return sidebarLucideIconMap[iconName] ?? LayoutDashboard
}

type SidebarLucideIconProps = {
  icon: LucideIcon
  className?: string
  size?: number
  strokeWidth?: number
}

export function SidebarLucideIcon({
  icon: Icon,
  className,
  size = WR_SIDEBAR_ICON_SIZE,
  strokeWidth = WR_SIDEBAR_ICON_STROKE,
}: SidebarLucideIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={cn('cockpit-icon shrink-0', className)}
      aria-hidden
    />
  )
}
