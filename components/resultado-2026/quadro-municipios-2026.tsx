"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  TseBusca,
  TseCard,
  TseSegmentado,
  TseThOrdenavel,
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
import { quadroPorTerritorio2026, type TerritorioQuadro2026 } from "@/lib/resultado-territorios-2026";
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

export function QuadroMunicipios2026({
  payload,
  cargo,
  onAbrirMunicipio,
}: {
  payload: ResultadoSecao2026Payload;
  cargo: string;
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

  const quadro = useMemo(() => quadroMunicipios2026(payload, cargo), [payload, cargo]);
  const territorios = useMemo<TerritorioQuadro2026[]>(() => quadroPorTerritorio2026(quadro), [quadro]);
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
    return (
      <td
        key={key}
        title={c ? `${nomeProprio(c.nome)} · ${formatarVotos2026(votos[p])} votos` : undefined}
        className={cn(
          "whitespace-nowrap px-2.5 py-1.5 leading-tight",
          destaque && (focoAtivo ? "bg-[var(--tse-yellow-strong)]" : "bg-[var(--tse-yellow-soft)]"),
        )}
      >
        <div className={cn("text-[12px]", destaque ? "font-black" : "font-semibold")}>
          {abreviarNomeCandidato(c?.nome ?? "")}
        </div>
        <div className="text-[11px] tabular-nums text-[var(--tse-muted)]">{formatarVotos2026(votos[p])}</div>
      </td>
    );
  };

  const celulaOutros = (outros: number) => (
    <td className={cn(celulaNumero, "font-semibold")}>{formatarVotos2026(outros)}</td>
  );

  const celulaFoco = (votos: number[], ranking: number[]) => {
    const posicao = ranking.indexOf(focoPos);
    return (
      <td className="whitespace-nowrap border-x border-[#EEEEEE] bg-[#FFFDF2] px-2.5 py-1.5 leading-tight">
        {posicao < 0 ? (
          <div className="text-[var(--tse-muted)]">sem votos</div>
        ) : (
          <>
            <div className="text-[12px] font-black">{posicao + 1}º</div>
            <div className="text-[11px] tabular-nums text-[var(--tse-muted)]">{formatarVotos2026(votos[focoPos])}</div>
          </>
        )}
      </td>
    );
  };

  const linhaMunicipio = (l: LinhaQuadroMunicipio2026, recuo = false) => {
    const primeiro = focoAtivo && l.votos[focoPos] > 0 ? focoPos : l.ranking[0];
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
        </td>
        {focoAtivo ? celulaFoco(l.votos, l.ranking) : null}
        {posicoes.map((k) => celulaColocado(l.votos, l.ranking, k, `${l.codigo}-${k}`))}
        {celulaOutros(l.total - somaTop(l.votos, l.ranking, n))}
        <td className={cn(celulaNumero, "font-bold")}>{formatarVotos2026(l.total)}</td>
      </tr>
    );
  };

  const linhaTerritorio = ({ linha: t, cidades }: TerritorioQuadro2026) => {
    const aberto = Boolean(termo) || abertos.has(t.codigo);
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
        {focoAtivo ? celulaFoco(t.votos, t.ranking) : null}
        {posicoes.map((k) => celulaColocado(t.votos, t.ranking, k, `td-${t.codigo}-${k}`))}
        {celulaOutros(t.total - somaTop(t.votos, t.ranking, n))}
        <td className={cn(celulaNumero, "font-black")}>{formatarVotos2026(t.total)}</td>
      </tr>
    );
  };

  const vazio = porTerritorio ? grupos.length === 0 : linhas.length === 0;

  return (
    <TseCard
      titulo={`Quadro por ${porTerritorio ? "território" : "município"} · ${cargo}`}
      subtitulo={
        focoCandidato
          ? `${sigla} 1 é o mais votado da cidade · só ${nomeProprio(focoCandidato.nome)} aparece, na posição em que ficou em cada município`
          : `${sigla} 1 é o mais votado da cidade, ${sigla} 2 o segundo e assim por diante · destaque para a referência e os parceiros`
      }
      acao={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Agrupar
            <TseSegmentado opcoes={AGRUPAMENTOS} valor={agrupamento} onChange={setAgrupamento} />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Candidato
            <select
              value={focoAtivo ? foco : ""}
              onChange={(e) => escolherFoco(e.target.value)}
              className="h-8 max-w-[220px] rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] text-[var(--tse-text)] outline-none focus:border-[var(--tse-yellow)]"
            >
              <option value="">Todos</option>
              {rankingEstado.map((p, k) => {
                const c = payload.candidatos[quadro.indices[p]];
                return (
                  <option key={quadro.indices[p]} value={String(quadro.indices[p])}>
                    {k + 1}º · {nomeProprio(c?.nome ?? "")}
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
              {focoAtivo ? celulaFoco(quadro.totais, rankingEstado) : null}
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
