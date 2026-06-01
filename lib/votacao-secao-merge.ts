import type {
  VotacaoSecaoAno,
  VotacaoSecaoItem,
  VotacaoSecaoResumo,
  VotacaoSecaoResultado,
} from '@/lib/votacao-secao'

/** Chave estável para alinhar a mesma urna entre anos (zona + seção + local). */
export function chaveAlinhamentoSecao(
  secao: Pick<VotacaoSecaoItem, 'nrZona' | 'nrSecao' | 'nrLocalVotacao'>,
): string {
  return `${secao.nrZona}:${secao.nrSecao}:${secao.nrLocalVotacao ?? 'n'}`
}

function preferirMetadadosSecao(
  base: VotacaoSecaoItem,
  outro: VotacaoSecaoItem,
): VotacaoSecaoItem {
  return {
    ...base,
    nmLocalVotacao: base.nmLocalVotacao?.trim() ? base.nmLocalVotacao : outro.nmLocalVotacao,
    dsEndereco: base.dsEndereco?.trim() ? base.dsEndereco : outro.dsEndereco,
    nmBairro: base.nmBairro?.trim() ? base.nmBairro : outro.nmBairro,
  }
}

function totalizarResultados(resultados: VotacaoSecaoResultado[]): number {
  return resultados.reduce((acc, r) => acc + r.qtVotos, 0)
}

export function mesclarVotacaoSecaoMultiAno(
  porAno: Array<{
    ano: VotacaoSecaoAno
    data: { resumo: VotacaoSecaoResumo; secoes: VotacaoSecaoItem[] } | null
  }>,
): { resumo: VotacaoSecaoResumo; secoes: VotacaoSecaoItem[] } | null {
  const validos = porAno.filter((p) => p.data != null && p.data.secoes.length > 0)
  if (validos.length === 0) return null

  const mapa = new Map<string, VotacaoSecaoItem>()

  for (const { ano, data } of validos) {
    for (const secao of data!.secoes) {
      const chave = chaveAlinhamentoSecao(secao)
      const resultadosComAno: VotacaoSecaoResultado[] = secao.resultados.map((r) => ({
        ...r,
        anoEleicao: ano,
      }))

      const existente = mapa.get(chave)
      if (!existente) {
        mapa.set(chave, {
          ...secao,
          localId: chave,
          resultados: resultadosComAno,
          totalVotos: totalizarResultados(resultadosComAno),
        })
        continue
      }

      const resultados = [...existente.resultados, ...resultadosComAno]
      mapa.set(chave, {
        ...preferirMetadadosSecao(existente, secao),
        resultados,
        totalVotos: totalizarResultados(resultados),
      })
    }
  }

  const secoes = [...mapa.values()].sort(
    (a, b) =>
      a.nrZona - b.nrZona ||
      a.nrSecao - b.nrSecao ||
      (a.nrLocalVotacao ?? 0) - (b.nrLocalVotacao ?? 0),
  )

  const anosEleicao = validos.map((v) => v.ano).sort((a, b) => b - a)
  const refResumo = validos[0].data!.resumo
  const cargosSet = new Set<string>()
  for (const s of secoes) {
    for (const r of s.resultados) {
      cargosSet.add(r.dsCargo)
    }
  }

  const totalVotos = secoes.reduce((acc, s) => acc + s.totalVotos, 0)

  return {
    resumo: {
      municipio: refResumo.municipio,
      anoEleicao: anosEleicao[0],
      anosEleicao,
      nrTurno: refResumo.nrTurno,
      totalSecoes: secoes.length,
      totalVotos,
      cargos: [...cargosSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    },
    secoes,
  }
}
