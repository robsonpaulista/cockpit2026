export const ARQUIVOS_TAB_FOTOS_DRIVE = 'fotos-drive' as const
export const ARQUIVOS_TAB_CADASTRO_PESSOAS = 'cadastro-pessoas' as const

export type ArquivosTab = typeof ARQUIVOS_TAB_FOTOS_DRIVE | typeof ARQUIVOS_TAB_CADASTRO_PESSOAS

export const ARQUIVOS_TABS: ArquivosTab[] = [ARQUIVOS_TAB_FOTOS_DRIVE, ARQUIVOS_TAB_CADASTRO_PESSOAS]

export function arquivosHubHref(tab: ArquivosTab = ARQUIVOS_TAB_FOTOS_DRIVE): string {
  return `/dashboard/arquivos?tab=${tab}`
}

export function parseArquivosTab(value: string | null): ArquivosTab {
  if (value === ARQUIVOS_TAB_CADASTRO_PESSOAS) return ARQUIVOS_TAB_CADASTRO_PESSOAS
  if (value === ARQUIVOS_TAB_FOTOS_DRIVE) return ARQUIVOS_TAB_FOTOS_DRIVE
  return ARQUIVOS_TAB_FOTOS_DRIVE
}
