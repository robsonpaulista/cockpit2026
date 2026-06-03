import {
  isSegundoGrau,
  parseNumeroCnj,
  resolveDatajudAlias,
  type CnjParsed,
} from '@/lib/juridico-cnj'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import {
  resolveOrgaoJulgadorParaConsulta,
  resolveTribunalConsulta,
} from '@/lib/juridico-tribunal-inferencia'

export type ConsultaPublicaInfo = {
  numeroFormatado: string | null
  numeroDatajud: string | null
  datajudAlias: string | null
  /** Link direto de consulta sem SSO nacional (quando existir) */
  consultaPublicaUrl: string | null
  /** Página do tribunal com opções de consulta */
  portalTribunalUrl: string | null
  sistema: string | null
  aviso: string | null
}

const AVISO_LOGIN_JUS =
  'Links antigos do PJe (*.pje.*.jus.br) passaram a pedir “acesso identificado” no jus.br. Use o portal indicado abaixo ou veja o andamento aqui (Datajud).'

function urlPorTribunal(
  tribunal: ReturnType<typeof resolveTribunalConsulta>,
  orgaoJulgador: string | null
): Pick<ConsultaPublicaInfo, 'consultaPublicaUrl' | 'portalTribunalUrl' | 'sistema'> {
  const grau2 = isSegundoGrau(orgaoJulgador)
  if (tribunal === 'TJPI') {
    if (grau2) {
      return {
        consultaPublicaUrl: 'https://www.tjpi.jus.br/e-tjpi/home/consulta',
        sistema: 'e-TJPI (2º grau)',
        portalTribunalUrl: 'https://www.tjpi.jus.br/portaltjpi/justoacesso/',
      }
    }
    return {
      consultaPublicaUrl: 'https://www.tjpi.jus.br/themisconsulta/',
      sistema: 'Themis Web (1º grau)',
      portalTribunalUrl: 'https://www.tjpi.jus.br/portaltjpi/justoacesso/',
    }
  }
  if (tribunal === 'TJMA') {
    return {
      consultaPublicaUrl:
        'https://projudi.tjma.jus.br/projudi/publico/buscas/ProcessosParte?publico=true',
      sistema: 'Projudi público (TJMA)',
      portalTribunalUrl: 'https://www.tjma.jus.br/hotsite/pje',
    }
  }
  if (tribunal === 'TRF1') {
    const host = grau2
      ? 'https://pje2g-consultapublica.trf1.jus.br'
      : 'https://pje1g-consultapublica.trf1.jus.br'
    return {
      consultaPublicaUrl: `${host}/consultapublica/ConsultaPublica/listView.seam`,
      sistema: grau2 ? 'PJe consulta pública TRF1 (2º grau)' : 'PJe consulta pública TRF1 (1º grau)',
      portalTribunalUrl: 'https://www.trf1.jus.br/trf1/processual/consulta-processual',
    }
  }
  if (tribunal === 'TRT22') {
    return {
      consultaPublicaUrl: 'https://pje.trt22.jus.br/consultaprocessual/home',
      sistema: 'Consulta processual TRT22',
      portalTribunalUrl: 'https://www.trt22.jus.br/servicos/consulta-de-processos',
    }
  }
  return { consultaPublicaUrl: null, portalTribunalUrl: null, sistema: null }
}

function buildInfoFromCnj(
  cnj: CnjParsed,
  orgaoJulgador: string | null,
  varaOrigem: string | null
): ConsultaPublicaInfo {
  const orgaoEfetivo = resolveOrgaoJulgadorParaConsulta(
    orgaoJulgador,
    varaOrigem,
    cnj.raw
  )
  const tribunal = resolveTribunalConsulta(cnj.raw, orgaoJulgador, varaOrigem)
  const urls = urlPorTribunal(tribunal, orgaoEfetivo)
  const alias = resolveDatajudAlias(cnj)

  return {
    numeroFormatado: cnj.raw,
    numeroDatajud: cnj.somenteDigitos,
    datajudAlias: alias,
    ...urls,
    aviso: urls.consultaPublicaUrl
      ? AVISO_LOGIN_JUS
      : alias
        ? 'Sem portal automático para este tribunal. Andamento disponível via Datajud (se configurado).'
        : 'Tribunal não suportado para link automático.',
  }
}

export function getConsultaPublicaInfo(
  processo: Pick<ProcessoDimensao, 'processo' | 'orgaoJulgador' | 'varaOrigem' | 'linkPje'>
): ConsultaPublicaInfo {
  const cnj = parseNumeroCnj(processo.processo)
  if (!cnj) {
    return {
      numeroFormatado: processo.processo || null,
      numeroDatajud: null,
      datajudAlias: null,
      consultaPublicaUrl: isLinkLegadoPlanilha(processo.linkPje) ? processo.linkPje : null,
      portalTribunalUrl: null,
      sistema: null,
      aviso:
        'Número fora do padrão CNJ (ex.: TCU). Use o site do órgão; andamento automático só via planilha/Datajud quando aplicável.',
    }
  }
  const info = buildInfoFromCnj(cnj, processo.orgaoJulgador, processo.varaOrigem ?? null)
  const linkPlanilha = processo.linkPje
  const usarPlanilha =
    linkPlanilha && !isPjeHostComSso(linkPlanilha) && isLinkLegadoPlanilha(linkPlanilha)

  return {
    ...info,
    consultaPublicaUrl: usarPlanilha ? linkPlanilha : info.consultaPublicaUrl,
  }
}

/** Evita reutilizar links da planilha que redirecionam ao login jus.br */
function isPjeHostComSso(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'corregedoria.pje.jus.br') return true
    if (/^pje\d*g\./.test(host) && host.endsWith('.jus.br')) return true
    if (host.startsWith('pje.') && host.endsWith('.jus.br') && !host.includes('consultapublica')) {
      if (host.includes('trf1.jus.br') && !host.includes('-consultapublica')) return true
      if (host.includes('tjpi.jus.br') || host.includes('tjma.jus.br')) return true
    }
  } catch {
    return false
  }
  return false
}

function isLinkLegadoPlanilha(url: string | null | undefined): url is string {
  if (!url?.trim()) return false
  return !isPjeHostComSso(url)
}

export function enrichProcessoConsulta<T extends ProcessoDimensao>(
  p: T
): T & { consultaPublicaUrl: string | null; portalTribunalUrl?: string | null } {
  const info = getConsultaPublicaInfo(p)
  return {
    ...p,
    linkPje: info.consultaPublicaUrl,
    consultaPublicaUrl: info.consultaPublicaUrl,
    portalTribunalUrl: info.portalTribunalUrl,
  }
}

export function getConsultaLinks(processo: ProcessoDimensao): {
  principal: string | null
  portal: string | null
  sistema: string | null
  aviso: string | null
} {
  const info = getConsultaPublicaInfo(processo)
  return {
    principal: processo.consultaPublicaUrl ?? info.consultaPublicaUrl,
    portal: processo.portalTribunalUrl ?? info.portalTribunalUrl,
    sistema: info.sistema,
    aviso: info.aviso,
  }
}
