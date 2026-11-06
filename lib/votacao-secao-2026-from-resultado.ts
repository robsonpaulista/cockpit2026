import {
  carregarResultadoSecao2026,
  chaveMunicipioResultado2026,
} from '@/lib/services/resultado-secao-2026-store'
import type { ResultadoSecao2026Payload } from '@/lib/resultado-secao-2026'
import {
  normalizeMunicipioComparacao,
  type VotacaoSecaoItem,
  type VotacaoSecaoResumo,
  type VotacaoSecaoResultado,
} from '@/lib/votacao-secao'

const CD_CARGO: Record<string, number> = {
  'Deputado Federal': 6,
  'Deputado Estadual': 7,
}

function acharMunicipio(
  payload: ResultadoSecao2026Payload,
  municipioInput: string,
): { codigo: string; nome: string } | null {
  const alvo = normalizeMunicipioComparacao(municipioInput)
  if (!alvo) return null
  const porChave = payload.municipios.find(
    (m) => chaveMunicipioResultado2026(m.nome) === chaveMunicipioResultado2026(municipioInput),
  )
  if (porChave) return porChave
  return (
    payload.municipios.find((m) => normalizeMunicipioComparacao(m.nome) === alvo) ?? null
  )
}

/**
 * Monta votação por seção 2026 (Dep. Federal / Estadual) a partir de
 * `data/resultado-secao-2026.json`, no formato da API `votacao-secao`.
 */
export async function getVotacaoSecao2026PorMunicipio(
  municipioInput: string,
  params?: { cargo?: string | null },
): Promise<{ resumo: VotacaoSecaoResumo; secoes: VotacaoSecaoItem[] } | null> {
  let payload: ResultadoSecao2026Payload
  try {
    payload = await carregarResultadoSecao2026()
  } catch {
    return null
  }

  const mun = acharMunicipio(payload, municipioInput)
  if (!mun) return null

  const cargoFiltro = params?.cargo?.trim() || null
  const indices = payload.candidatos
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (cargoFiltro && cargoFiltro !== 'todos' && c.cargo !== cargoFiltro) return false
      return c.cargo === 'Deputado Federal' || c.cargo === 'Deputado Estadual'
    })

  if (indices.length === 0) return null

  const locaisPorId = new Map(payload.locais.map((l) => [l.id, l]))
  const secoesMun = payload.secoes.filter((s) => s.m === mun.codigo)
  if (secoesMun.length === 0) return null

  const cargosSet = new Set<string>()
  const secoes: VotacaoSecaoItem[] = secoesMun.map((s) => {
    const local = s.l != null ? locaisPorId.get(s.l) : undefined
    const resultados: VotacaoSecaoResultado[] = []
    for (const { c, i } of indices) {
      const qt = s.v[i] ?? 0
      if (qt <= 0) continue
      cargosSet.add(c.cargo)
      resultados.push({
        cdCargo: CD_CARGO[c.cargo] ?? 0,
        dsCargo: c.cargo,
        nrVotavel: Number.parseInt(c.numero, 10) || 0,
        nmVotavel: c.nome,
        sqCandidato: null,
        qtVotos: qt,
        anoEleicao: 2026,
      })
    }
    resultados.sort(
      (a, b) => b.qtVotos - a.qtVotos || a.nmVotavel.localeCompare(b.nmVotavel, 'pt-BR'),
    )
    const totalVotos = resultados.reduce((acc, r) => acc + r.qtVotos, 0)
    return {
      localId: `2026:${s.m}:${s.z}:${s.s}`,
      nrZona: s.z,
      nrSecao: s.s,
      // Id interno do JSON ≠ NR_LOCAL_VOTACAO do bweb; alinhamento usa zona+seção.
      nrLocalVotacao: null,
      nmLocalVotacao: local?.nome ?? null,
      dsEndereco: local?.endereco ?? null,
      nmBairro: local?.bairro ?? null,
      totalVotos,
      resultados,
    }
  })

  secoes.sort(
    (a, b) => a.nrZona - b.nrZona || a.nrSecao - b.nrSecao,
  )

  return {
    resumo: {
      municipio: mun.nome,
      anoEleicao: 2026,
      anosEleicao: [2026],
      nrTurno: 1,
      totalSecoes: secoes.length,
      totalVotos: secoes.reduce((acc, s) => acc + s.totalVotos, 0),
      cargos: [...cargosSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    },
    secoes,
  }
}

export async function listMunicipiosVotacaoSecao2026(): Promise<string[]> {
  try {
    const payload = await carregarResultadoSecao2026()
    return payload.municipios.map((m) => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  } catch {
    return []
  }
}
