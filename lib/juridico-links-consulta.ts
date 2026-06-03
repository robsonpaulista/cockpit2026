import {
  buildComunicaCertidaoUrl,
  buildComunicaConsultaUrl,
  getComunicaInfoFromProcesso,
} from '@/lib/juridico-comunica'
import { getConsultaPublicaInfo } from '@/lib/juridico-consulta-publica'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'

export type ProcessoLinksConsulta = {
  djenConsultaUrl: string | null
  djenUltimaCertidaoUrl: string | null
  djenUltimaRotulo: string | null
  tribunalConsultaUrl: string | null
  tribunalRotulo: string | null
  /** CNJ formatado para colar no formulário do tribunal (PJe não aceita na URL) */
  tribunalNumeroFormatado: string | null
  portalTribunalUrl: string | null
}

export function buildProcessoLinksConsulta(
  processo: Pick<
    ProcessoDimensao,
    'processo' | 'orgaoJulgador' | 'varaOrigem' | 'linkPje' | 'consultaPublicaUrl' | 'portalTribunalUrl'
  >
): ProcessoLinksConsulta {
  const { sigla, numeroApi } = getComunicaInfoFromProcesso(processo.processo, processo.orgaoJulgador)
  const tribunal = getConsultaPublicaInfo(processo)
  const tribunalUrl = processo.consultaPublicaUrl ?? tribunal.consultaPublicaUrl

  return {
    djenConsultaUrl:
      sigla && numeroApi
        ? buildComunicaConsultaUrl({ numeroProcesso: numeroApi, siglaTribunal: sigla })
        : null,
    djenUltimaCertidaoUrl: null,
    djenUltimaRotulo: null,
    tribunalConsultaUrl: tribunalUrl,
    tribunalRotulo: tribunal.sistema ?? 'Tribunal',
    tribunalNumeroFormatado: tribunalUrl ? tribunal.numeroFormatado : null,
    portalTribunalUrl: processo.portalTribunalUrl ?? tribunal.portalTribunalUrl,
  }
}

export function mergeUltimaComunicacaoDjen(
  links: ProcessoLinksConsulta,
  hash: string | null | undefined,
  tipo: string | null | undefined,
  data: string | null | undefined
): ProcessoLinksConsulta {
  if (!hash) return links
  const rotulo = [tipo, data].filter(Boolean).join(' · ') || 'Última publicação DJEN'
  return {
    ...links,
    djenUltimaCertidaoUrl: buildComunicaCertidaoUrl(hash),
    djenUltimaRotulo: rotulo,
  }
}

export function enrichProcessoLinks<T extends ProcessoDimensao>(p: T): T & { linksConsulta: ProcessoLinksConsulta } {
  return { ...p, linksConsulta: buildProcessoLinksConsulta(p) }
}
