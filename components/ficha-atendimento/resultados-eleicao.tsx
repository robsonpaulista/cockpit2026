'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import {
  TseCard,
  TseCarregando,
  TseErro,
  TsePill,
  TseVazio,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import {
  agruparPartido2024,
  CANDIDATO_FEDERAL_DESTAQUE,
  filtrarDeputadoEstadual2022,
  filtrarDeputadoFederal2022,
  filtrarPrefeito2024,
  filtrarVereador2024,
  isSituacaoEleito,
  parseVotosEleicao,
  siglaSituacao,
  type PartidoResumoEleicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'
import {
  buildFotosMap,
  candidatoFotoLookupKey,
  type CandidatoFotoDivulgacand,
  type CargoFotoCandidato,
} from '@/lib/candidatos-foto-divulgacand'
import { fetchFotosCandidatos, fetchResultadosEleicaoCidade } from '@/lib/services/ficha-atendimento-client'
import { FichaCandidatoFotoModal } from './candidato-foto-modal'

const ITEMS_PER_PAGE = 10

const thClass = 'px-1.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]'
const tdClass = 'px-1.5 py-1.5'
/** Em telas menores os cinco quadros ficam estreitos; a coluna de partido sai para dar espaço ao nome. */
const colunaPartidoClass = 'hidden min-[1700px]:table-cell'

const paginated = <T,>(items: T[], page: number): T[] =>
  items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

function Paginacao({
  totalItems,
  currentPage,
  onPageChange,
}: {
  totalItems: number
  currentPage: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  if (totalPages <= 1) return null
  const botao =
    'flex h-7 w-7 items-center justify-center rounded-md bg-[#E8E8E8] text-[var(--tse-text)] hover:bg-[#DDDDDD] disabled:opacity-40'
  return (
    <div className="flex items-center justify-center gap-2 border-t border-[#EEEEEE] py-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={botao}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[12px] font-semibold tabular-nums text-[var(--tse-muted)]">
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={botao}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Tabela compacta de um cargo, com título e paginação. */
function Quadro({
  titulo,
  cabecalho,
  rodape,
  totalItems,
  page,
  onPageChange,
  children,
}: {
  titulo: string
  cabecalho: ReactNode
  rodape: ReactNode
  totalItems: number
  page: number
  onPageChange: (p: number) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-[#EEEEEE]">
      <h3 className="px-3 pb-2 pt-3 text-[13px] font-bold">{titulo}</h3>
      <table className="w-full table-fixed text-[12px]" data-tse-tabela>
        <thead className="bg-[var(--tse-bar)] text-left">{cabecalho}</thead>
        <tbody>{children}</tbody>
        <tfoot>
          <tr className="border-t border-[#DDDDDD] bg-[var(--tse-bar)] font-bold">{rodape}</tr>
        </tfoot>
      </table>
      <Paginacao totalItems={totalItems} currentPage={page} onPageChange={onPageChange} />
    </div>
  )
}

function TabelaCandidatos({
  titulo,
  itens,
  page,
  onPageChange,
  destaqueNome,
  colunaExtra,
  cargoFoto,
  onDuploCliqueCandidato,
  onVerFicha,
}: {
  titulo: string
  itens: ResultadoEleicao[]
  page: number
  onPageChange: (p: number) => void
  destaqueNome?: string
  colunaExtra?: 'situacao' | 'partido'
  cargoFoto?: CargoFotoCandidato
  onDuploCliqueCandidato?: (item: ResultadoEleicao, cargo: CargoFotoCandidato) => void
  onVerFicha?: (item: ResultadoEleicao, cargo: CargoFotoCandidato) => void
}) {
  const totalVotos = itens.reduce((acc, item) => acc + parseVotosEleicao(item.quantidadeVotosNominais), 0)
  const eleitosCount = colunaExtra === 'situacao' ? itens.filter((item) => isSituacaoEleito(item.situacao)).length : 0
  const comFicha = Boolean(cargoFoto && onVerFicha)
  const comFoto = Boolean(cargoFoto && onDuploCliqueCandidato)

  return (
    <Quadro
      titulo={titulo}
      totalItems={itens.length}
      page={page}
      onPageChange={onPageChange}
      cabecalho={
        <tr>
          <th className={thClass}>Candidato</th>
          {colunaExtra === 'partido' ? (
            <th className={cn(thClass, colunaPartidoClass, 'w-[4.25rem]')}>Partido</th>
          ) : null}
          <th className={cn(thClass, 'w-16 text-right')}>Votos</th>
          {colunaExtra === 'situacao' ? (
            <th className={cn(thClass, 'w-10 text-center')} title="Situação: E eleito · S suplente · N não eleito">
              Sit.
            </th>
          ) : null}
        </tr>
      }
      rodape={
        <>
          <td className={cn(tdClass, 'text-[11px] uppercase tracking-wide')}>Total</td>
          {colunaExtra === 'partido' ? <td className={cn(tdClass, colunaPartidoClass)} /> : null}
          <td className={cn(tdClass, 'text-right tabular-nums')}>{totalVotos.toLocaleString('pt-BR')}</td>
          {colunaExtra === 'situacao' ? (
            <td className={cn(tdClass, 'text-center tabular-nums')} title={`${eleitosCount} eleitos`}>
              {eleitosCount}
            </td>
          ) : null}
        </>
      }
    >
      {paginated(itens, page).map((item) => {
        const destaque =
          destaqueNome && item.nomeUrnaCandidato?.trim().toUpperCase() === destaqueNome.trim().toUpperCase()
        const situacao = siglaSituacao(item.situacao)
        const rotulo = `${item.nomeUrnaCandidato}${item.partido ? ` (${item.partido})` : ''}`
        return (
          <tr
            key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
            className={cn(
              tseTabela.tr,
              comFoto && 'hover:bg-[var(--tse-yellow-soft)]',
              destaque && 'bg-[var(--tse-yellow-soft)] font-bold',
            )}
            title={comFoto ? `${rotulo} · clique no nome: ficha · duplo clique: foto` : rotulo}
            onDoubleClick={() => {
              if (cargoFoto && onDuploCliqueCandidato) onDuploCliqueCandidato(item, cargoFoto)
            }}
          >
            <td className={cn(tdClass, 'min-w-0')}>
              {comFicha && cargoFoto && onVerFicha ? (
                <button
                  type="button"
                  onClick={() => onVerFicha(item, cargoFoto)}
                  className="block w-full truncate text-left font-semibold text-[var(--tse-olive)] hover:underline"
                >
                  {item.nomeUrnaCandidato}
                </button>
              ) : (
                <div className="truncate">{item.nomeUrnaCandidato}</div>
              )}
            </td>
            {colunaExtra === 'partido' ? (
              <td className={cn(tdClass, colunaPartidoClass, 'truncate text-[11px] text-[var(--tse-muted)]')}>
                {item.partido || '—'}
              </td>
            ) : null}
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {parseVotosEleicao(item.quantidadeVotosNominais).toLocaleString('pt-BR')}
            </td>
            {colunaExtra === 'situacao' ? (
              <td className={cn(tdClass, 'text-center')} title={item.situacao || undefined}>
                <TsePill tom={situacao.tom} className="px-1.5 text-[10px]">
                  {situacao.sigla}
                </TsePill>
              </td>
            ) : null}
          </tr>
        )
      })}
    </Quadro>
  )
}

function TabelaPartidos({
  itens,
  page,
  onPageChange,
}: {
  itens: PartidoResumoEleicao[]
  page: number
  onPageChange: (p: number) => void
}) {
  const totalVotos = itens.reduce((acc, item) => acc + item.votos, 0)
  const totalEleitos = itens.reduce((acc, item) => acc + item.eleitos, 0)
  return (
    <Quadro
      titulo="Votação por partido 2024"
      totalItems={itens.length}
      page={page}
      onPageChange={onPageChange}
      cabecalho={
        <tr>
          <th className={thClass}>Partido</th>
          <th className={cn(thClass, 'w-16 text-right')}>Votos</th>
          <th className={cn(thClass, 'w-11 text-right')} title="Eleitos">
            Eleit.
          </th>
        </tr>
      }
      rodape={
        <>
          <td className={cn(tdClass, 'text-[11px] uppercase tracking-wide')}>Total</td>
          <td className={cn(tdClass, 'text-right tabular-nums')}>{totalVotos.toLocaleString('pt-BR')}</td>
          <td className={cn(tdClass, 'text-right tabular-nums')}>{totalEleitos}</td>
        </>
      }
    >
      {paginated(itens, page).map((item) => (
        <tr key={item.partido} className={tseTabela.tr}>
          <td className={cn(tdClass, 'truncate font-semibold')} title={item.partido}>
            {item.partido}
          </td>
          <td className={cn(tdClass, 'text-right tabular-nums')}>{item.votos.toLocaleString('pt-BR')}</td>
          <td className={cn(tdClass, 'text-right tabular-nums')}>{item.eleitos}</td>
        </tr>
      ))}
    </Quadro>
  )
}

const PAGES_INICIAIS = {
  deputado_estadual: 1,
  deputado_federal: 1,
  prefeito_2024: 1,
  vereador_2024: 1,
  partido_2024: 1,
}

type Paginas = typeof PAGES_INICIAIS
type PageKey = keyof Paginas

export function FichaAtendimentoResultadosEleicao({
  municipio,
  onVerFicha,
  onImprimirFicha,
}: {
  municipio: string
  onVerFicha?: (item: ResultadoEleicao, cargo: CargoFotoCandidato) => void
  onImprimirFicha?: (item: ResultadoEleicao, cargo: CargoFotoCandidato) => void
}) {
  const [dados, setDados] = useState<ResultadoEleicao[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [cidadeApi, setCidadeApi] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<Paginas>(PAGES_INICIAIS)
  const [fotos, setFotos] = useState<CandidatoFotoDivulgacand[]>([])
  const [fotoModal, setFotoModal] = useState<{ candidato: ResultadoEleicao; cargo: CargoFotoCandidato } | null>(null)

  const fotosMap = useMemo(() => buildFotosMap(fotos), [fotos])

  const setPage = (key: PageKey, page: number) => setCurrentPage((prev) => ({ ...prev, [key]: page }))

  const carregarFotos = useCallback(async (nomeCidade: string) => {
    setFotos(nomeCidade.trim() ? await fetchFotosCandidatos(nomeCidade) : [])
  }, [])

  const carregar = useCallback(async (nomeCidade: string) => {
    const alvo = nomeCidade.trim()
    if (!alvo) {
      setDados([])
      setCidadeApi(null)
      setFotos([])
      return
    }
    setLoading(true)
    setError(null)
    setCurrentPage(PAGES_INICIAIS)
    try {
      const [eleicao, fotosCidade] = await Promise.all([
        fetchResultadosEleicaoCidade(alvo),
        fetchFotosCandidatos(alvo),
      ])
      setDados(eleicao.resultados)
      setCidadeApi(eleicao.cidade)
      setFotos(fotosCidade)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar eleições')
      setDados([])
      setCidadeApi(null)
      setFotos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar(municipio)
  }, [municipio, carregar])

  const deputadoEstadual = useMemo(() => filtrarDeputadoEstadual2022(dados), [dados])
  const deputadoFederal = useMemo(() => filtrarDeputadoFederal2022(dados), [dados])
  const prefeito = useMemo(() => filtrarPrefeito2024(dados), [dados])
  const vereador = useMemo(() => filtrarVereador2024(dados), [dados])
  const partidos = useMemo(() => agruparPartido2024(dados), [dados])

  const fotoExistenteModal = useMemo(() => {
    if (!fotoModal) return null
    return fotosMap[candidatoFotoLookupKey(fotoModal.cargo, fotoModal.candidato)] ?? null
  }, [fotoModal, fotosMap])

  const abrirFoto = (candidato: ResultadoEleicao, cargo: CargoFotoCandidato) => setFotoModal({ candidato, cargo })

  return (
    <TseCard
      titulo="Resultados eleitorais"
      subtitulo={
        <>
          {cidadeApi ? `Planilha de votação · ${cidadeApi}` : 'Mesma base do Resumo por cidade'}
          {onVerFicha ? ' · Prefeito e vereador: clique no nome para a ficha resumo, duplo clique na linha para a foto DivulgaCand' : ''}
        </>
      }
      acao={
        <Link
          href={`/dashboard/resumo-eleicoes${municipio ? `?cidade=${encodeURIComponent(municipio)}` : ''}`}
          className={cn(tseLinkAcaoClass, 'inline-flex shrink-0 items-center gap-1')}
        >
          Abrir no Resumo Eleições
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <div className="mt-4">
        {loading ? (
          <TseCarregando texto="Carregando resultados…" className="min-h-[12rem]" />
        ) : error ? (
          <TseErro>{error}</TseErro>
        ) : dados.length === 0 ? (
          <TseVazio>Nenhum resultado eleitoral encontrado para este município na planilha.</TseVazio>
        ) : (
          <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)]">
            <TabelaCandidatos
              titulo="Deputado Estadual 2022"
              itens={deputadoEstadual}
              page={currentPage.deputado_estadual}
              onPageChange={(p) => setPage('deputado_estadual', p)}
            />
            <TabelaCandidatos
              titulo="Deputado Federal 2022"
              itens={deputadoFederal}
              page={currentPage.deputado_federal}
              onPageChange={(p) => setPage('deputado_federal', p)}
              destaqueNome={CANDIDATO_FEDERAL_DESTAQUE}
            />
            <TabelaCandidatos
              titulo="Prefeito 2024"
              itens={prefeito}
              page={currentPage.prefeito_2024}
              onPageChange={(p) => setPage('prefeito_2024', p)}
              colunaExtra="partido"
              cargoFoto="prefeito"
              onDuploCliqueCandidato={abrirFoto}
              onVerFicha={onVerFicha}
            />
            <TabelaCandidatos
              titulo="Vereador 2024"
              itens={vereador}
              page={currentPage.vereador_2024}
              onPageChange={(p) => setPage('vereador_2024', p)}
              colunaExtra="situacao"
              cargoFoto="vereador"
              onDuploCliqueCandidato={abrirFoto}
              onVerFicha={onVerFicha}
            />
            <TabelaPartidos
              itens={partidos}
              page={currentPage.partido_2024}
              onPageChange={(p) => setPage('partido_2024', p)}
            />
          </div>
        )}
      </div>

      {fotoModal ? (
        <FichaCandidatoFotoModal
          municipio={municipio}
          cargo={fotoModal.cargo}
          candidato={fotoModal.candidato}
          fotoExistente={fotoExistenteModal}
          onClose={() => setFotoModal(null)}
          onSaved={() => void carregarFotos(municipio)}
          onImprimirFicha={
            onImprimirFicha
              ? () => {
                  onImprimirFicha(fotoModal.candidato, fotoModal.cargo)
                  setFotoModal(null)
                }
              : undefined
          }
        />
      ) : null}
    </TseCard>
  )
}
