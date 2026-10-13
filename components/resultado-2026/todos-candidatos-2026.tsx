"use client";

import { ChevronRight } from "lucide-react";
import { TseBarraValor, TsePill, TseRank, tseTabela } from "@/components/tse/tse-ui";
import {
  formatarPct2026,
  formatarVotos2026,
  type ColocadoMunicipio2026,
  type ResultadoSecao2026Candidato,
} from "@/lib/resultado-secao-2026";
import { nomeProprio } from "./tse-ui";

export type LinhaCandidatoTodos2026 = ColocadoMunicipio2026 & { posicao: number };

export type LinhaMunicipioTodos2026 = {
  codigo: string;
  nome: string;
  posicao: number;
  totalCargo: number;
  lider: ColocadoMunicipio2026 | null;
};

const rotuloCandidato = (c: ResultadoSecao2026Candidato | undefined): string =>
  c ? `${nomeProprio(c.nome)}${c.partido ? ` (${c.partido})` : ""}` : "—";

/** Ranking de todos os candidatos do cargo no município escolhido. */
export function CandidatosTodosTabela({
  linhas,
  candidatos,
  destaqueIdx,
  onSelect,
}: {
  linhas: LinhaCandidatoTodos2026[];
  candidatos: ResultadoSecao2026Candidato[];
  destaqueIdx: number;
  onSelect: (idx: number) => void;
}) {
  const maxVotos = linhas.reduce((m, l) => Math.max(m, l.votos), 0);
  return (
    <div className={`mt-3 ${tseTabela.container}`}>
      <table className={tseTabela.table}>
        <thead className={tseTabela.thead}>
          <tr>
            <th className="w-14 px-3 py-2.5 text-center">Pos.</th>
            <th className="px-3 py-2.5">Candidato</th>
            <th className="px-3 py-2.5">Partido</th>
            <th className="w-[220px] px-3 py-2.5 text-right">Votos</th>
            <th className="px-3 py-2.5 text-right">% no município</th>
            <th className="w-10 px-2 py-2.5" aria-label="Abrir" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const c = candidatos[l.idx];
            return (
              <tr
                key={l.idx}
                onClick={() => onSelect(l.idx)}
                title="Ver locais de votação deste candidato no município"
                className={`${tseTabela.trClicavel} ${l.idx === destaqueIdx ? "bg-[var(--tse-yellow-soft)]" : ""}`}
              >
                <td className="px-3 py-2 text-center">
                  <TseRank posicao={l.posicao} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-bold uppercase">{c?.nome ?? "—"}</div>
                  <div className="text-[12px] text-[var(--tse-muted)]">{c?.numero}</div>
                </td>
                <td className="px-3 py-2 text-[var(--tse-muted)]">{c?.partido ?? "—"}</td>
                <td className="px-3 py-2">
                  <TseBarraValor valor={l.votos} max={maxVotos} formatado={formatarVotos2026(l.votos)} />
                </td>
                <td className="px-3 py-2 text-right">
                  <TsePill>{formatarPct2026(l.pct)}</TsePill>
                </td>
                <td className="px-2 py-2 text-[var(--tse-muted)] group-hover:text-[var(--tse-olive)]">
                  <ChevronRight className="h-4 w-4" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Municípios com o total do cargo e o mais votado; clicar abre o ranking completo da cidade. */
export function MunicipiosTodosTabela({
  linhas,
  candidatos,
  onSelect,
}: {
  linhas: LinhaMunicipioTodos2026[];
  candidatos: ResultadoSecao2026Candidato[];
  onSelect: (codigo: string) => void;
}) {
  const maxVotos = linhas.reduce((m, l) => Math.max(m, l.totalCargo), 0);
  return (
    <div className={`mt-3 ${tseTabela.container}`}>
      <table className={tseTabela.table}>
        <thead className={tseTabela.thead}>
          <tr>
            <th className="w-14 px-3 py-2.5 text-center">Pos.</th>
            <th className="px-3 py-2.5">Município</th>
            <th className="w-[220px] px-3 py-2.5 text-right">Votos do cargo</th>
            <th className="px-3 py-2.5">Mais votado</th>
            <th className="px-3 py-2.5 text-right">Votos do 1º</th>
            <th className="w-10 px-2 py-2.5" aria-label="Abrir" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => (
            <tr
              key={m.codigo}
              onClick={() => onSelect(m.codigo)}
              title="Ver todos os candidatos votados neste município"
              className={tseTabela.trClicavel}
            >
              <td className="px-3 py-2 text-center">
                <TseRank posicao={m.posicao} />
              </td>
              <td className="px-3 py-2 font-bold uppercase">{m.nome}</td>
              <td className="px-3 py-2">
                <TseBarraValor valor={m.totalCargo} max={maxVotos} formatado={formatarVotos2026(m.totalCargo)} />
              </td>
              <td className="px-3 py-2">{m.lider ? rotuloCandidato(candidatos[m.lider.idx]) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {m.lider ? (
                  <>
                    {formatarVotos2026(m.lider.votos)}{" "}
                    <span className="text-[var(--tse-muted)]">({formatarPct2026(m.lider.pct)})</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-2 py-2 text-[var(--tse-muted)] group-hover:text-[var(--tse-olive)]">
                <ChevronRight className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
