"use client";

import { useMemo, useState } from "react";
import { ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import {
  TseBusca,
  TseCard,
  TseSegmentado,
  TseThOrdenavel,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseLinkAcaoClass,
  tseTabela,
} from "@/components/tse/tse-ui";
import { cn } from "@/lib/utils";
import {
  formatarVotos2026,
  quadroMunicipios2026,
  type LinhaQuadroMunicipio2026,
  type ResultadoSecao2026Payload,
} from "@/lib/resultado-secao-2026";
import { getEleitoradoByCity } from "@/lib/eleitores";
import { getTerritorioDesenvolvimentoPI } from "@/lib/piaui-territorio-desenvolvimento";
import { quadroPorTerritorio2026, type TerritorioQuadro2026 } from "@/lib/resultado-territorios-2026";
import type { CelulaQuadroExport2026, LinhaQuadroExport2026 } from "./quadro-municipios-export-2026";
import {
  FILTROS_SITUACAO_2026,
  filtrarQuadroPorSituacao2026,
  rotuloSituacao2026,
  type FiltroSituacao2026,
} from "@/lib/resultado-situacao-2026";
import { SeloSituacao2026 } from "./selo-situacao-2026";
import { abreviarNomeCandidato, nomeProprio, normalizarTexto, siglaCargo } from "./tse-ui";

type QtdColunas = "5" | "10" | "15" | "20";
type ColQuadro = "municipio" | "foco" | "total" | "outros" | `pos${number}`;
type Agrupamento = "cidade" | "territorio";

const QTD_COLUNAS: { id: QtdColunas; label: string }[] = [
  { id: "5", label: "5" },
  { id: "10", label: "10" },
  { id: "15", label: "15" },
  { id: "20", label: "20" },
];

const AGRUPAMENTOS: { id: Agrupamento; label: string }[] = [
  { id: "cidade", label: "Cidade" },
  { id: "territorio", label: "Território › Cidade" },
];

const celulaNumero = "whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums";
const colunaFixa = "sticky left-0 z-[1]";

const somaTop = (votos: number[], posicoes: number[], n: number): number =>
  posicoes.slice(0, n).reduce((soma, p) => soma + votos[p], 0);

function pctDe(votos: number, base: number | null): number | null {
  if (base == null || base <= 0) return null;
  return (votos / base) * 100;
}

function formatarPct(pct: number): string {
  return `${pct.toFixed(1).replace(".", ",")}%`;
}

function somarEleitorado(codigos: string[], porCodigo: ReadonlyMap<string, number>): number | null {
  let soma = 0;
  let achou = false;
  for (const codigo of codigos) {
    const n = porCodigo.get(codigo);
    if (n == null) continue;
    soma += n;
    achou = true;
  }
  return achou ? soma : null;
}

export function QuadroMunicipios2026({
  payload,
  cargo,
  situacao,
  onSituacao,
  onAbrirMunicipio,
}: {
  payload: ResultadoSecao2026Payload;
  cargo: string;
  situacao: FiltroSituacao2026;
  onSituacao: (id: FiltroSituacao2026) => void;
  onAbrirMunicipio: (codigo: string, candidatoIdx: number) => void;
}) {
  const [qtd, setQtd] = useState<QtdColunas>("10");
  const [busca, setBusca] = useState<string>("");
  const [sortCol, setSortCol] = useState<ColQuadro>("total");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  /** Índice (em `payload.candidatos`) do candidato em foco; vazio = destacar referência e parceiros. */
  const [foco, setFoco] = useState<string>("");
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("cidade");
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [exportando, setExportando] = useState<"pdf" | "xlsx" | null>(null);

  const quadroCheio = useMemo(() => quadroMunicipios2026(payload, cargo), [payload, cargo]);
  const quadro = useMemo(
    () => filtrarQuadroPorSituacao2026(quadroCheio, (idx) => payload.candidatos[idx]?.situacao, situacao),
    [quadroCheio, payload, situacao],
  );
  const territorios = useMemo<TerritorioQuadro2026[]>(() => quadroPorTerritorio2026(quadro), [quadro]);
  const eleitoradoPorCodigo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of quadro.linhas) {
      const n = getEleitoradoByCity(l.nome);
      if (n != null && n > 0) mapa.set(l.codigo, n);
    }
    return mapa;
  }, [quadro.linhas]);
  const eleitoradoEstado = useMemo(
    () => somarEleitorado(quadro.linhas.map((l) => l.codigo), eleitoradoPorCodigo),
    [quadro.linhas, eleitoradoPorCodigo],
  );
  const totalNominalPorCodigo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of quadroCheio.linhas) mapa.set(l.codigo, l.total);
    return mapa;
  }, [quadroCheio.linhas]);
  const totalNominalEstado = useMemo(
    () => quadroCheio.totais.reduce((soma, votos) => soma + votos, 0),
    [quadroCheio.totais],
  );
  const porTerritorio = agrupamento === "territorio";
  const focoPos = foco ? quadro.indices.indexOf(Number(foco)) : -1;
  const focoAtivo = focoPos >= 0;
  const focoCandidato = focoAtivo ? payload.candidatos[quadro.indices[focoPos]] : undefined;
  const n = Number(qtd);
  const posicoes = useMemo<number[]>(() => Array.from({ length: n }, (_, k) => k), [n]);
  const rankingEstado = useMemo<number[]>(
    () => quadro.indices.flatMap((_, p) => (quadro.totais[p] > 0 ? [p] : [])),
    [quadro],
  );

  const colEfetiva: ColQuadro =
    (sortCol.startsWith("pos") && Number(sortCol.slice(3)) >= n) || (sortCol === "foco" && !focoAtivo)
      ? "total"
      : sortCol;

  const termo = normalizarTexto(busca.trim());

  const { linhas, grupos } = useMemo(() => {
    const valor = (l: LinhaQuadroMunicipio2026): number => {
      if (colEfetiva === "total") return l.total;
      if (colEfetiva === "foco") return l.votos[focoPos] ?? 0;
      if (colEfetiva === "outros") return l.total - somaTop(l.votos, l.ranking, n);
      const p = l.ranking[Number(colEfetiva.slice(3))];
      return p == null ? 0 : l.votos[p];
    };
    const porNome = (a: LinhaQuadroMunicipio2026, b: LinhaQuadroMunicipio2026) =>
      a.nome.localeCompare(b.nome, "pt-BR");
    const comparar = (a: LinhaQuadroMunicipio2026, b: LinhaQuadroMunicipio2026) => {
      const cmp = colEfetiva === "municipio" ? porNome(a, b) : valor(a) - valor(b) || porNome(a, b);
      return sortAsc ? cmp : -cmp;
    };
    const casa = (nome: string) => !termo || normalizarTexto(nome).includes(termo);
    return {
      linhas: quadro.linhas.filter((l) => casa(l.nome)).sort(comparar),
      grupos: territorios
        .map((t) => ({
          ...t,
          cidades: (casa(t.linha.nome) ? t.cidades : t.cidades.filter((c) => casa(c.nome))).slice().sort(comparar),
        }))
        .filter((t) => t.cidades.length > 0)
        .sort((a, b) => comparar(a.linha, b.linha)),
    };
  }, [quadro, territorios, termo, colEfetiva, sortAsc, n, focoPos]);

  const alternarTerritorio = (td: string) => {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(td)) novo.delete(td);
      else novo.add(td);
      return novo;
    });
  };
  const todosAbertos = territorios.every((t) => abertos.has(t.linha.codigo));
  const alternarTodos = () => {
    setAbertos(todosAbertos ? new Set<string>() : new Set(territorios.map((t) => t.linha.codigo)));
  };

  const escolherFoco = (valor: string) => {
    setFoco(valor);
    setSortCol(valor ? "foco" : "total");
    setSortAsc(false);
  };

  const ordenar = (col: ColQuadro) => {
    if (col === colEfetiva) {
      setSortAsc((v) => !v);
    } else {
      setSortCol(col);
      setSortAsc(col === "municipio");
    }
  };

  const sigla = siglaCargo(cargo);
  const totalEstado = quadro.totais.reduce((a, b) => a + b, 0);
  const filtroSituacao = FILTROS_SITUACAO_2026.find((f) => f.id === situacao) ?? FILTROS_SITUACAO_2026[0];
  const recorte = situacao === "todas" ? "" : ` · o total soma só os ${filtroSituacao.label.toLowerCase()}`;

  const th = (col: ColQuadro, rotulo: string, className?: string) => (
    <TseThOrdenavel
      key={col}
      col={col}
      sortCol={colEfetiva}
      sortAsc={sortAsc}
      onSort={ordenar}
      alinhar={col === "total" || col === "outros" ? "right" : "left"}
      className={cn("whitespace-nowrap", className)}
    >
      {rotulo}
    </TseThOrdenavel>
  );

  const percentuaisFoco = (votosCandidato: number, eleitorado: number | null, totalNominal: number) => {
    const sobreEleitorado = pctDe(votosCandidato, eleitorado);
    const sobreVotacao = pctDe(votosCandidato, totalNominal);
    return (
      <>
        {sobreEleitorado != null && eleitorado != null ? (
          <div
            className="text-[11px] font-bold tabular-nums text-[var(--tse-olive)]"
            title={`${formatarPct(sobreEleitorado)} da votação sobre o eleitorado (${formatarVotos2026(eleitorado)} eleitores)`}
          >
            {formatarPct(sobreEleitorado)} do eleitorado
          </div>
        ) : null}
        {sobreVotacao != null ? (
          <div
            className="text-[11px] font-bold tabular-nums"
            title={`${formatarPct(sobreVotacao)} dos ${formatarVotos2026(totalNominal)} votos nominais`}
          >
            {formatarPct(sobreVotacao)} da votação
          </div>
        ) : null}
      </>
    );
  };

  const celulaColocado = (votos: number[], ranking: number[], k: number, key: string) => {
    const p = ranking[k];
    if (p == null) {
      return (
        <td key={key} className={cn(celulaNumero, "text-[var(--tse-muted)]")}>
          —
        </td>
      );
    }
    if (focoAtivo && p !== focoPos) return <td key={key} className="px-2.5 py-1.5" />;
    const c = payload.candidatos[quadro.indices[p]];
    const destaque = focoAtivo || Boolean(c?.comparativo);
    const votosCelula = votos[p] ?? 0;
    return (
      <td
        key={key}
        title={
          c
            ? `${nomeProprio(c.nome)} · ${rotuloSituacao2026(c.situacao) || "situação não informada"} · ${formatarVotos2026(votosCelula)} votos`
            : undefined
        }
        className={cn(
          "whitespace-nowrap px-2.5 py-1.5 leading-tight",
          destaque && (focoAtivo ? "bg-[var(--tse-yellow-strong)]" : "bg-[var(--tse-yellow-soft)]"),
        )}
      >
        <div className={cn("flex items-center gap-1 text-[12px]", destaque ? "font-black" : "font-semibold")}>
          {abreviarNomeCandidato(c?.nome ?? "")}
          <SeloSituacao2026 situacao={c?.situacao} />
        </div>
        <div className="text-[11px] tabular-nums text-[var(--tse-muted)]">{formatarVotos2026(votosCelula)}</div>
      </td>
    );
  };

  const celulaOutros = (outros: number) => (
    <td className={cn(celulaNumero, "font-semibold")}>{formatarVotos2026(outros)}</td>
  );

  const celulaFoco = (votos: number[], ranking: number[], eleitorado: number | null, totalNominal: number) => {
    const posicao = ranking.indexOf(focoPos);
    const votosFoco = posicao < 0 ? 0 : (votos[focoPos] ?? 0);
    return (
      <td className="whitespace-nowrap border-x border-[#EEEEEE] bg-[#FFFDF2] px-2.5 py-1.5 leading-tight">
        {posicao < 0 ? (
          <div className="text-[var(--tse-muted)]">sem votos</div>
        ) : (
          <>
            <div className="text-[12px] font-black">{posicao + 1}º</div>
            <div className="text-[11px] tabular-nums text-[var(--tse-muted)]">{formatarVotos2026(votosFoco)}</div>
          </>
        )}
        {percentuaisFoco(votosFoco, eleitorado, totalNominal)}
      </td>
    );
  };

  const linhaMunicipio = (l: LinhaQuadroMunicipio2026, recuo = false) => {
    const primeiro = focoAtivo && l.votos[focoPos] > 0 ? focoPos : l.ranking[0];
    const eleitorado = eleitoradoPorCodigo.get(l.codigo) ?? null;
    const totalNominal = totalNominalPorCodigo.get(l.codigo) ?? l.total;
    return (
      <tr key={l.codigo} className={cn(tseTabela.tr, "hover:bg-[#FAFAF7]")}>
        <td className={cn(tseTabela.td, colunaFixa, "bg-white font-semibold uppercase", recuo && "pl-9")}>
          {primeiro == null ? (
            l.nome
          ) : (
            <button
              type="button"
              onClick={() => onAbrirMunicipio(l.codigo, quadro.indices[primeiro])}
              className="text-left uppercase hover:text-[var(--tse-olive)] hover:underline"
              title="Ver locais e seções"
            >
              {l.nome}
            </button>
          )}
          <div className="mt-0.5 text-[10px] font-semibold normal-case leading-tight text-[var(--tse-muted)]">
            <div className="tabular-nums">{eleitorado != null ? formatarVotos2026(eleitorado) : "—"} eleitores</div>
            <div className="tabular-nums" title="Soma dos votos nominais de todos os candidatos">
              {formatarVotos2026(totalNominal)} votantes
            </div>
          </div>
        </td>
        {focoAtivo ? celulaFoco(l.votos, l.ranking, eleitorado, totalNominal) : null}
        {posicoes.map((k) => celulaColocado(l.votos, l.ranking, k, `${l.codigo}-${k}`))}
        {celulaOutros(l.total - somaTop(l.votos, l.ranking, n))}
        <td className={cn(celulaNumero, "font-bold")}>{formatarVotos2026(l.total)}</td>
      </tr>
    );
  };

  const linhaTerritorio = ({ linha: t, cidades }: TerritorioQuadro2026) => {
    const aberto = Boolean(termo) || abertos.has(t.codigo);
    const eleitorado = somarEleitorado(
      cidades.map((c) => c.codigo),
      eleitoradoPorCodigo,
    );
    const totalNominal = cidades.reduce((soma, c) => soma + (totalNominalPorCodigo.get(c.codigo) ?? 0), 0);
    return (
      <tr key={`td-${t.codigo}`} className={cn(tseTabela.tr, "bg-[#FAFAF7]")}>
        <td className={cn(tseTabela.td, colunaFixa, "bg-[#FAFAF7]")}>
          <button
            type="button"
            onClick={() => alternarTerritorio(t.codigo)}
            aria-expanded={aberto}
            className="flex items-center gap-1.5 text-left font-black uppercase hover:text-[var(--tse-olive)]"
          >
            <ChevronRight
              className={cn("h-4 w-4 shrink-0 text-[var(--tse-yellow)] transition-transform", aberto && "rotate-90")}
            />
            <span className="whitespace-nowrap">{t.nome}</span>
            <span className="whitespace-nowrap text-[11px] font-semibold normal-case text-[var(--tse-muted)]">
              {cidades.length} {cidades.length === 1 ? "cidade" : "cidades"}
            </span>
          </button>
        </td>
        {focoAtivo ? celulaFoco(t.votos, t.ranking, eleitorado, totalNominal) : null}
        {posicoes.map((k) => celulaColocado(t.votos, t.ranking, k, `td-${t.codigo}-${k}`))}
        {celulaOutros(t.total - somaTop(t.votos, t.ranking, n))}
        <td className={cn(celulaNumero, "font-black")}>{formatarVotos2026(t.total)}</td>
      </tr>
    );
  };

  const vazio = porTerritorio ? grupos.length === 0 : linhas.length === 0;

  const celulaExport = (votos: number[], ranking: number[], k: number): CelulaQuadroExport2026 => {
    const p = ranking[k];
    if (p == null) return { tipo: "vazio" };
    if (focoAtivo && p !== focoPos) return { tipo: "oculta" };
    const c = payload.candidatos[quadro.indices[p]];
    return {
      tipo: "voto",
      nome: nomeProprio(c?.nome ?? ""),
      partido: c?.partido ?? "",
      situacao: rotuloSituacao2026(c?.situacao),
      votos: votos[p] ?? 0,
      destaque: focoAtivo || Boolean(c?.comparativo),
    };
  };

  const linhaExport = (
    nivel: LinhaQuadroExport2026["nivel"],
    nome: string,
    territorio: string,
    detalhe: string,
    votos: number[],
    ranking: number[],
    total: number,
    eleitorado: number | null,
    totalNominal: number,
  ): LinhaQuadroExport2026 => {
    const posicaoFoco = ranking.indexOf(focoPos);
    const votosFoco = posicaoFoco < 0 ? 0 : (votos[focoPos] ?? 0);
    return {
      nivel,
      nome,
      territorio,
      detalhe,
      eleitores: nivel === "municipio" ? eleitorado : null,
      votantes: nivel === "municipio" ? totalNominal : null,
      foco: !focoAtivo
        ? null
        : {
            posicao: posicaoFoco < 0 ? 0 : posicaoFoco + 1,
            votos: votosFoco,
            pctEleitorado: pctDe(votosFoco, eleitorado),
            pctVotacao: pctDe(votosFoco, totalNominal),
          },
      celulas: posicoes.map((k) => celulaExport(votos, ranking, k)),
      outros: total - somaTop(votos, ranking, n),
      total,
    };
  };

  const exportarQuadro = async (formato: "pdf" | "xlsx") => {
    setExportando(formato);
    try {
      const { exportarQuadroPdf2026, exportarQuadroXlsx2026 } = await import("./quadro-municipios-export-2026");
      const doEstado = linhaExport(
        "estado",
        "Piauí",
        "",
        "",
        quadro.totais,
        rankingEstado,
        totalEstado,
        eleitoradoEstado,
        totalNominalEstado,
      );
      const demais: LinhaQuadroExport2026[] = porTerritorio
        ? grupos.flatMap((g) => [
            linhaExport(
              "territorio",
              g.linha.nome,
              g.linha.nome,
              `${g.cidades.length} cidades`,
              g.linha.votos,
              g.linha.ranking,
              g.linha.total,
              somarEleitorado(
                g.cidades.map((c) => c.codigo),
                eleitoradoPorCodigo,
              ),
              g.cidades.reduce((soma, c) => soma + (totalNominalPorCodigo.get(c.codigo) ?? 0), 0),
            ),
            ...g.cidades.map((c) =>
              linhaExport(
                "municipio",
                c.nome,
                g.linha.nome,
                "",
                c.votos,
                c.ranking,
                c.total,
                eleitoradoPorCodigo.get(c.codigo) ?? null,
                totalNominalPorCodigo.get(c.codigo) ?? c.total,
              ),
            ),
          ])
        : linhas.map((l) =>
            linhaExport(
              "municipio",
              l.nome,
              getTerritorioDesenvolvimentoPI(l.nome) ?? "",
              "",
              l.votos,
              l.ranking,
              l.total,
              eleitoradoPorCodigo.get(l.codigo) ?? null,
              totalNominalPorCodigo.get(l.codigo) ?? l.total,
            ),
          );
      const opcoes = {
        meta: payload.meta,
        fonteDados: payload.candidatos[0]?.fonte ?? "",
        cargo,
        agrupamento,
        situacao: filtroSituacao.label,
        busca,
        foco: focoCandidato ? nomeProprio(focoCandidato.nome) : "",
        colocacoes: posicoes.map((k) => `${sigla} ${k + 1}`),
        linhas: [doEstado, ...demais],
      };
      if (formato === "pdf") exportarQuadroPdf2026(opcoes);
      else exportarQuadroXlsx2026(opcoes);
    } finally {
      setExportando(null);
    }
  };

  return (
    <TseCard
      titulo={`Quadro por ${porTerritorio ? "território" : "município"} · ${cargo}`}
      subtitulo={
        focoCandidato
          ? `${sigla} 1 é o mais votado da cidade · só ${nomeProprio(focoCandidato.nome)} aparece, na posição em que ficou em cada município · percentuais sobre o eleitorado e sobre os votos nominais de todos os candidatos · E eleito, S suplente, N não eleito${recorte}`
          : `${sigla} 1 é o mais votado da cidade, ${sigla} 2 o segundo e assim por diante · destaque para a referência e os parceiros · E eleito, S suplente, N não eleito${recorte}`
      }
      acao={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Situação
            <TseSegmentado opcoes={FILTROS_SITUACAO_2026} valor={situacao} onChange={onSituacao} />
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Agrupar
            <TseSegmentado opcoes={AGRUPAMENTOS} valor={agrupamento} onChange={setAgrupamento} />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Candidato
            <select
              value={focoAtivo ? foco : ""}
              onChange={(e) => escolherFoco(e.target.value)}
              className="h-8 max-w-[280px] rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] text-[var(--tse-text)] outline-none focus:border-[var(--tse-yellow)]"
            >
              <option value="">Todos</option>
              {rankingEstado.map((p, k) => {
                const c = payload.candidatos[quadro.indices[p]];
                const situacao = rotuloSituacao2026(c?.situacao);
                return (
                  <option key={quadro.indices[p]} value={String(quadro.indices[p])}>
                    {k + 1}º · {nomeProprio(c?.nome ?? "")}
                    {situacao ? ` · ${situacao}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Colocações
            <TseSegmentado opcoes={QTD_COLUNAS} valor={qtd} onChange={setQtd} />
          </div>
          <TseBusca
            value={busca}
            onChange={setBusca}
            placeholder={porTerritorio ? "Buscar território ou município" : "Buscar município"}
            className="w-48"
          />
          <button
            type="button"
            onClick={() => void exportarQuadro("pdf")}
            disabled={vazio || exportando != null}
            className={tseBotaoCinzaClass}
          >
            <FileText className={tseBotaoIconeClass} />
            {exportando === "pdf" ? "Gerando…" : "PDF"}
          </button>
          <button
            type="button"
            onClick={() => void exportarQuadro("xlsx")}
            disabled={vazio || exportando != null}
            className={tseBotaoCinzaClass}
          >
            <FileSpreadsheet className={tseBotaoIconeClass} />
            {exportando === "xlsx" ? "Gerando…" : "XLS"}
          </button>
        </div>
      }
    >
      {porTerritorio ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
          <span>12 Territórios de Desenvolvimento do Piauí · clique no território para ver as cidades</span>
          {termo ? null : (
            <button type="button" onClick={alternarTodos} className={tseLinkAcaoClass}>
              {todosAbertos ? "Recolher todos" : "Expandir todos"}
            </button>
          )}
        </div>
      ) : null}
      <div className={cn(tseTabela.container, "mt-3 max-h-[70vh] overflow-auto shadow-none ring-1 ring-[#EEEEEE]")}>
        <table className={tseTabela.table}>
          <thead className={cn(tseTabela.thead, "sticky top-0 z-[2]")}>
            <tr>
              {th(
                "municipio",
                porTerritorio ? "Território / Município" : "Município",
                cn(colunaFixa, "bg-[var(--tse-bar)]"),
              )}
              {focoCandidato ? th("foco", abreviarNomeCandidato(focoCandidato.nome), "bg-[var(--tse-yellow-soft)]") : null}
              {posicoes.map((k) => th(`pos${k}`, `${sigla} ${k + 1}`))}
              {th("outros", "Outros")}
              {th("total", "Total")}
            </tr>
          </thead>
          <tbody>
            <tr className={cn(tseTabela.tr, "bg-[#FBFAF3]")}>
              <td className={cn(tseTabela.td, colunaFixa, "bg-[#FBFAF3] font-black uppercase")}>Piauí</td>
              {focoAtivo ? celulaFoco(quadro.totais, rankingEstado, eleitoradoEstado, totalNominalEstado) : null}
              {posicoes.map((k) => celulaColocado(quadro.totais, rankingEstado, k, `estado-${k}`))}
              {celulaOutros(totalEstado - somaTop(quadro.totais, rankingEstado, n))}
              <td className={cn(celulaNumero, "font-black")}>{formatarVotos2026(totalEstado)}</td>
            </tr>
            {porTerritorio
              ? grupos.flatMap((g) => [
                  linhaTerritorio(g),
                  ...(termo || abertos.has(g.linha.codigo) ? g.cidades.map((c) => linhaMunicipio(c, true)) : []),
                ])
              : linhas.map((l) => linhaMunicipio(l))}
          </tbody>
        </table>
      </div>
      {termo && vazio ? (
        <div className="mt-3 text-center text-[13px] text-[var(--tse-muted)]">Nenhum município encontrado.</div>
      ) : null}
    </TseCard>
  );
}
