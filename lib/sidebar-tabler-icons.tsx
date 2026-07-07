import {
  IconActivity,
  IconAt,
  IconBrandYoutube,
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconChartBar,
  IconChartLine,
  IconCheckbox,
  IconClipboardList,
  IconFileCertificate,
  IconFileSpreadsheet,
  IconFileText,
  IconFolderOpen,
  IconHistory,
  IconLayoutDashboard,
  IconMapPin,
  IconMessage,
  IconMessageCircle,
  IconNews,
  IconPhoto,
  IconRadar2,
  IconRosette,
  IconScale,
  IconScript,
  IconSearch,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconSpeakerphone,
  IconTarget,
  IconUserCog,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

/** Tamanho e peso únicos — sidebar e acesso rápido. */
export const SIDEBAR_ICON_SIZE = 17
export const SIDEBAR_ICON_STROKE = 1.6

export const sidebarTablerIconMap: Record<string, Icon> = {
  LayoutDashboard: IconLayoutDashboard,
  Calendar: IconCalendar,
  FileText: IconFileText,
  MessageSquare: IconMessage,
  Newspaper: IconNews,
  MapPin: IconMapPin,
  Users: IconUsers,
  MessageCircle: IconMessageCircle,
  BarChart3: IconChartBar,
  Settings: IconSettings,
  Scale: IconScale,
  Vote: IconCheckbox,
  Building2: IconBuilding,
  Shield: IconShield,
  Search: IconSearch,
  ScrollText: IconScript,
  Target: IconTarget,
  ClipboardList: IconClipboardList,
  History: IconHistory,
  MapPinned: IconMapPin,
  Image: IconPhoto,
  AtSign: IconAt,
  FileSpreadsheet: IconFileSpreadsheet,
  Activity: IconActivity,
  Youtube: IconBrandYoutube,
  Radar: IconRadar2,
  FolderOpen: IconFolderOpen,
}

/** Variantes Cockpit (não usadas hoje — sidebar Apify). */
export const sidebarCockpitTablerIconMap: Record<string, Icon> = {
  ...sidebarTablerIconMap,
  MapPin: IconMapPin,
  Users: IconUsersGroup,
  BarChart3: IconChartLine,
  MessageSquare: IconSpeakerphone,
  Newspaper: IconRadar2,
  Vote: IconRosette,
  Scale: IconBuildingBank,
  Settings: IconUserCog,
  Shield: IconShieldCheck,
  ClipboardList: IconFileCertificate,
}

export function resolveSidebarTablerIcon(iconName: string, cockpit: boolean): Icon {
  const map = cockpit ? sidebarCockpitTablerIconMap : sidebarTablerIconMap
  return map[iconName] ?? sidebarTablerIconMap[iconName] ?? IconLayoutDashboard
}

type SidebarTablerIconProps = {
  icon: Icon
  className?: string
  size?: number
  stroke?: number
}

/** Wrapper único — evita tamanho/stroke nativo variando por glyph. */
export function SidebarTablerIcon({
  icon: IconComponent,
  className,
  size = SIDEBAR_ICON_SIZE,
  stroke = SIDEBAR_ICON_STROKE,
}: SidebarTablerIconProps) {
  return (
    <IconComponent
      size={size}
      stroke={stroke}
      className={cn('cockpit-icon shrink-0', className)}
      aria-hidden
    />
  )
}
