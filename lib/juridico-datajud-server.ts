import { parseNumeroCnj, resolveDatajudAlias } from '@/lib/juridico-cnj'
import { getConsultaPublicaInfo } from '@/lib/juridico-consulta-publica'
import {
  normalizeDatajudHit,
  type AndamentoPublicoResponse,
  type MovimentoPublico,
} from '@/lib/juridico-datajud'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br'

function getDatajudApiKey(): string | null {
  const key = process.env.DATAJUD_API_KEY?.trim()
  return key || null
}

type DatajudSearchResponse = {
  hits?: {
    hits?: Array<{ _source?: Record<string, unknown> }>
  }
}

export async function fetchAndamentoDatajud(
  processo: ProcessoDimensao
): Promise<AndamentoPublicoResponse> {
  const consulta = getConsultaPublicaInfo(processo)
  const base: AndamentoPublicoResponse = {
    ok: false,
    fonte: 'planilha',
    processo: processo.processo,
    consultaPublicaUrl: consulta.consultaPublicaUrl,
    classe: processo.acao,
    dataAjuizamento: processo.dataConsulta,
    dataHoraUltimaAtualizacao: null,
    ultimaMovimentacaoPlanilha: processo.ultimaMovimentacao,
    movimentos: [],
    movimentosPrazo: [],
    aviso: consulta.aviso,
  }

  const cnj = parseNumeroCnj(processo.processo)
  if (!cnj) {
    return {
      ...base,
      aviso:
        base.aviso ??
        'Sem número CNJ: andamento automático indisponível. Confira a última movimentação da planilha.',
    }
  }

  const alias = resolveDatajudAlias(cnj)
  if (!alias) {
    return {
      ...base,
      aviso:
        base.aviso ??
        'Tribunal não mapeado na API Datajud. Use o link de consulta pública, se disponível.',
    }
  }

  const apiKey = getDatajudApiKey()
  if (!apiKey) {
    return {
      ...base,
      aviso:
        'Configure DATAJUD_API_KEY no servidor (chave pública do CNJ: wiki Datajud). Exibindo apenas dados da planilha.',
    }
  }

  const url = `${DATAJUD_BASE}/api_publica_${alias}/_search`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `APIKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: 1,
        query: {
          match: {
            numeroProcesso: cnj.somenteDigitos,
          },
        },
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        ...base,
        aviso: `Datajud retornou ${res.status}. Tente a consulta pública do tribunal.`,
      }
    }

    const json = (await res.json()) as DatajudSearchResponse
    const source = json.hits?.hits?.[0]?._source
    if (!source) {
      return {
        ...base,
        aviso:
          'Processo não encontrado no Datajud (sigilo, ainda não sincronizado ou número divergente). Use a consulta pública do tribunal.',
      }
    }

    const norm = normalizeDatajudHit(source as Parameters<typeof normalizeDatajudHit>[0])
    const recentes = norm.movimentos.slice(0, 12)
    const movimentosPrazo = norm.movimentos.filter((m) => m.possivelPrazo).slice(0, 8)

    return {
      ok: true,
      fonte: 'datajud',
      processo: processo.processo,
      consultaPublicaUrl: consulta.consultaPublicaUrl,
      classe: norm.classe ?? processo.acao,
      dataAjuizamento: norm.dataAjuizamento,
      dataHoraUltimaAtualizacao: norm.dataHoraUltimaAtualizacao,
      ultimaMovimentacaoPlanilha: processo.ultimaMovimentacao,
      movimentos: recentes,
      movimentosPrazo,
      aviso: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return {
      ...base,
      aviso: `Falha ao consultar Datajud: ${msg}`,
    }
  }
}

export function pickUltimoMovimento(movimentos: MovimentoPublico[]): MovimentoPublico | null {
  return movimentos[0] ?? null
}
