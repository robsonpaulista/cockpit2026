"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  TseCarregando,
  TseErro,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseControleClass,
} from "@/components/tse/tse-ui";
import { useProgressoAnimado } from "@/hooks/use-progresso-animado";
import {
  chaveMunicipio,
  conquistasPorVencedor2026,
  montarCorridaTerritorial,
  type CandidatoCorridaMunicipio,
  type CorridaMunicipio,
  type CorridaTerritorial,
  type MunicipioCorrida,
} from "@/lib/corrida-territorial";
import { formatarPct2026, formatarVotos2026 } from "@/lib/resultado-secao-2026";
import { fetchCorridaFederal2022x2026, fetchCorridaFederalMunicipio } from "@/lib/services/corrida-territorial";
import { CORES_PARTIDOS, corTerritorio, nomeProprio } from "./tse-ui";

const DURACAO_MS = 9000;
const LINHA = 36;
const VISIVEIS = 14;
const MOVIMENTOS_VISIVEIS = 3;

type ItemCorrida = {
  chave: string;
  nome: string;
  partidoInicio: string;
  partidoFim: string;
  inicio: number;
  fim: number;
  cor: (momento: number) => string;
};

const suave = (t: number): number => t * t * (3 - 2 * t);

function itensCorrida(
  base: { chave: string; nome: string; partido: string; partido2022: string | null; inicio: number; fim: number }[],
): ItemCorrida[] {
  return base.map((b, i) => {
    const partidoInicio = b.partido2022 ?? b.partido;
    const fallback = corTerritorio(i);
    return {
      chave: b.chave,
      nome: b.nome,
      partidoInicio,
      partidoFim: b.partido,
      inicio: b.inicio,
      fim: b.fim,
      cor: (momento) => CORES_PARTIDOS[momento < 0.5 ? partidoInicio : b.partido] ?? fallback,
    };
  });
}

export function CorridaTerritorial2026({
  municipio,
  onTrocarMunicipio,
}: {
  /** Vazio = Piauí inteiro (municípios vencidos); com nome = votos no município. */
  municipio: string;
  onTrocarMunicipio: (municipio: string) => void;
}) {
  const [dados, setDados] = useState<MunicipioCorrida[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [corridaMun, setCorridaMun] = useState<CorridaMunicipio | null>(null);
  const [erroMun, setErroMun] = useState<string | null>(null);
  const { progresso, tocando, tocar, pausar, irPara } = useProgressoAnimado(DURACAO_MS);
  const estadoPronto = dados != null;

  useEffect(() => {
    let ativo = true;
    fetchCorridaFederal2022x2026()
      .then((m) => {
        if (ativo) setDados(m);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar a corrida");
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const recomecar = () => {
      irPara(0);
      espera = setTimeout(tocar, 500);
    };
    setCorridaMun(null);
    setErroMun(null);
    if (!municipio) {
      if (estadoPronto) recomecar();
    } else {
      pausar();
      fetchCorridaFederalMunicipio(municipio)
        .then((c) => {
          if (!ativo) return;
          setCorridaMun(c);
          recomecar();
        })
        .catch((e: unknown) => {
          if (ativo) setErroMun(e instanceof Error ? e.message : "Erro ao carregar o município");
        });
    }
    return () => {
      ativo = false;
      if (espera) clearTimeout(espera);
    };
  }, [municipio, estadoPronto, irPara, tocar, pausar]);

  const corrida = useMemo(() => (dados ? montarCorridaTerritorial(dados) : null), [dados]);
  const opcoes = useMemo(
    () => [...(dados ?? [])].map((m) => m.municipio).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [dados],
  );

  const itensEstado = useMemo(
    () =>
      itensCorrida(
        (corrida?.participantes ?? []).map((p) => ({ ...p, inicio: p.cidades2022, fim: p.cidades2026 })),
      ),
    [corrida],
  );
  const itensMunicipio = useMemo(
    () =>
      itensCorrida(
        (corridaMun?.candidatos ?? []).map((c) => ({ ...c, inicio: c.votos2022, fim: c.votos2026 })),
      ),
    [corridaMun],
  );

  if (erro) return <TseErro>{erro}</TseErro>;
  if (!corrida) return <TseCarregando texto="Cruzando os vencedores de 2022 e 2026…" />;

  const valorSelect = opcoes.find((m) => chaveMunicipio(m) === chaveMunicipio(municipio)) ?? "";
  const noMunicipio = municipio !== "";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className={tseCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold">
              Corrida territorial · Deputado Federal 2022 → 2026
              {noMunicipio ? ` · ${nomeProprio(corridaMun?.municipio ?? municipio)}` : ""}
            </h2>
            <div className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
              {noMunicipio
                ? "Votos de cada candidato no município"
                : "Municípios vencidos por candidato"}{" "}
              · a mesma pessoa é reconhecida pelo nome civil nas duas eleições
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={valorSelect}
              onChange={(e) => onTrocarMunicipio(e.target.value)}
              className={`${tseControleClass} max-w-[200px]`}
              aria-label="Escopo da corrida"
            >
              <option value="">Piauí (municípios vencidos)</option>
              {opcoes.map((m) => (
                <option key={m} value={m}>
                  {nomeProprio(m)}
                </option>
              ))}
            </select>
            <button type="button" onClick={tocando ? pausar : tocar} className={tseBotaoCinzaClass}>
              {tocando ? <Pause className={tseBotaoIconeClass} /> : <Play className={tseBotaoIconeClass} />}
              {tocando ? "Pausar" : "Animar"}
            </button>
            <button
              type="button"
              onClick={() => {
                irPara(0);
                tocar();
              }}
              className={tseBotaoCinzaClass}
              title="Recomeçar"
              aria-label="Recomeçar"
            >
              <RotateCcw className={tseBotaoIconeClass} />
            </button>
          </div>
        </div>

        {noMunicipio && erroMun ? (
          <div className="mt-4">
            <TseErro>{erroMun}</TseErro>
          </div>
        ) : noMunicipio && !corridaMun ? (
          <div className="mt-4">
            <TseCarregando texto={`Carregando ${nomeProprio(municipio)}…`} />
          </div>
        ) : (
          <BarrasCorrida
            itens={noMunicipio ? itensMunicipio : itensEstado}
            progresso={progresso}
            formatar={noMunicipio ? formatarVotos2026 : (v) => String(Math.round(v))}
          />
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-[var(--tse-muted)]">
          2022
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progresso * 1000)}
            onChange={(e) => {
              pausar();
              irPara(Number(e.target.value) / 1000);
            }}
            className="flex-1 accent-[var(--tse-yellow)]"
            aria-label="Momento da corrida entre 2022 e 2026"
          />
          2026
        </div>
      </section>

      <aside className="space-y-4">
        {noMunicipio ? (
          corridaMun ? (
            <PainelMunicipio corrida={corridaMun} itens={itensMunicipio} />
          ) : null
        ) : (
          <PainelEstado corrida={corrida} itens={itensEstado} />
        )}
      </aside>
    </div>
  );
}

function BarrasCorrida({
  itens,
  progresso,
  formatar,
}: {
  itens: ItemCorrida[];
  progresso: number;
  formatar: (valor: number) => string;
}) {
  const t = suave(progresso);
  const atuais = itens
    .map((item) => ({ item, valor: item.inicio + (item.fim - item.inicio) * t }))
    .sort((a, b) => b.valor - a.valor || b.item.fim - a.item.fim);
  const posicao = new Map(atuais.map((a, i) => [a.item.chave, i]));
  const maximo = Math.max(1, atuais[0]?.valor ?? 1);

  return (
    <div className="relative mt-4" style={{ height: VISIVEIS * LINHA }}>
      <div
        className="pointer-events-none absolute bottom-1 right-2 select-none text-[72px] font-bold leading-none tabular-nums text-[var(--tse-zero)]"
        aria-live="polite"
      >
        {progresso < 0.5 ? 2022 : 2026}
      </div>
      {atuais.map(({ item, valor }) => {
        const rank = posicao.get(item.chave) ?? VISIVEIS;
        const lider = rank === 0 && valor > 0;
        const trocouPartido = progresso >= 0.5 && item.partidoInicio !== item.partidoFim;
        return (
          <div
            key={item.chave}
            className="absolute inset-x-0 flex items-center"
            style={{
              height: LINHA - 6,
              transform: `translateY(${Math.min(rank, VISIVEIS) * LINHA}px)`,
              opacity: rank < VISIVEIS ? 1 : 0,
              transition: "transform 450ms ease, opacity 300ms ease",
            }}
          >
            <div
              className={`w-[150px] shrink-0 truncate pr-3 text-right text-[12px] ${lider ? "font-bold" : "font-semibold"}`}
            >
              {nomeProprio(item.nome)}
            </div>
            <div className="flex min-w-0 flex-1 items-center">
              <div
                className="min-w-[3px] rounded-r-md"
                style={{
                  width: `${(valor / maximo) * 78}%`,
                  height: LINHA - 10,
                  backgroundColor: item.cor(progresso),
                  transition: "background-color 400ms ease",
                }}
              />
              <div className="ml-2 shrink-0 text-[13px] font-bold tabular-nums">{formatar(valor)}</div>
              <div className="ml-1.5 shrink-0 text-[10px] text-[var(--tse-muted)]">
                {progresso < 0.5 ? item.partidoInicio : item.partidoFim}
                {trocouPartido ? ` (era ${item.partidoInicio})` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PainelEstado({ corrida, itens }: { corrida: CorridaTerritorial; itens: ItemCorrida[] }) {
  const porChave = new Map(itens.map((i) => [i.chave, i]));
  const trocadas = corrida.fluxos.reduce((a, f) => a + f.cidades.length, 0);
  const conquistas = conquistasPorVencedor2026(corrida);
  return (
    <>
      <section className={tseCardClass}>
        <h3 className="text-[13px] font-bold">Troca de comando nos municípios</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[var(--tse-bg)] p-3">
            <div className="text-[22px] font-bold tabular-nums">{corrida.mantidas.length}</div>
            <div className="text-[11px] text-[var(--tse-muted)]">mantiveram o vencedor de 2022</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-yellow-soft)] p-3">
            <div className="text-[22px] font-bold tabular-nums">{trocadas}</div>
            <div className="text-[11px] text-[var(--tse-muted)]">mudaram de mãos</div>
          </div>
        </div>
      </section>

      <section className={tseCardClass}>
        <h3 className="text-[13px] font-bold">De quem cada vencedor de 2026 tomou cidades</h3>
        <div className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
          {conquistas.length} vencedores · {trocadas} cidades mudaram de mãos · clique numa linha para ver as cidades
        </div>
        <div className="mt-3 max-h-[min(70vh,640px)] space-y-3 overflow-y-auto pr-1">
          {conquistas.map((g) => {
            const vencedor = porChave.get(g.chave);
            return (
              <div key={g.chave} className="rounded-lg bg-[var(--tse-bg)] p-2.5">
                <div className="flex items-center gap-1.5 text-[13px]">
                  <div
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: vencedor?.cor(1) }}
                  />
                  <div className="min-w-0 flex-1 truncate font-bold">{nomeProprio(vencedor?.nome ?? g.chave)}</div>
                  <div className="shrink-0 font-bold tabular-nums">
                    {g.mantidas.length + g.tomadas} {g.mantidas.length + g.tomadas === 1 ? "cidade" : "cidades"}
                  </div>
                </div>
                <div className="mt-0.5 pl-[18px] text-[11px] text-[var(--tse-muted)]">
                  {g.tomadas} tomadas · {g.mantidas.length} mantidas de 2022
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {g.origens.map((o) => {
                    const de = porChave.get(o.de);
                    return (
                      <LinhaOrigem
                        key={o.de}
                        rotulo={`de ${nomeProprio(de?.nome ?? o.de)}`}
                        cor={de?.cor(0)}
                        cidades={o.cidades}
                      />
                    );
                  })}
                  {g.mantidas.length > 0 ? (
                    <LinhaOrigem rotulo="manteve de 2022" cor={vencedor?.cor(0)} cidades={g.mantidas} />
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function PainelMunicipio({ corrida, itens }: { corrida: CorridaMunicipio; itens: ItemCorrida[] }) {
  const porChave = new Map(itens.map((i) => [i.chave, i]));
  const lider = (campo: "votos2022" | "votos2026"): CandidatoCorridaMunicipio | undefined =>
    [...corrida.candidatos].sort((a, b) => b[campo] - a[campo]).find((c) => c[campo] > 0);
  const lider2022 = lider("votos2022");
  const lider2026 = lider("votos2026");
  const manteve = lider2022 != null && lider2022.chave === lider2026?.chave;
  const variacoes = corrida.candidatos
    .map((c) => ({ c, delta: c.votos2026 - c.votos2022 }))
    .sort((a, b) => b.delta - a.delta);
  const subidas = variacoes.filter((v) => v.delta > 0).slice(0, MOVIMENTOS_VISIVEIS);
  const quedas = variacoes
    .filter((v) => v.delta < 0)
    .reverse()
    .slice(0, MOVIMENTOS_VISIVEIS);

  return (
    <>
      <section className={tseCardClass}>
        <h3 className="text-[13px] font-bold">Liderança em {nomeProprio(corrida.municipio)}</h3>
        <div className="mt-3 space-y-2">
          <CartaoLider
            titulo="Líder em 2022"
            nome={lider2022?.nome}
            partido={lider2022 ? (lider2022.partido2022 ?? lider2022.partido) : ""}
            cor={lider2022 ? porChave.get(lider2022.chave)?.cor(0) : undefined}
            votos={lider2022?.votos2022 ?? 0}
            total={corrida.total2022}
          />
          <CartaoLider
            titulo="Líder em 2026"
            nome={lider2026?.nome}
            partido={lider2026?.partido ?? ""}
            cor={lider2026 ? porChave.get(lider2026.chave)?.cor(1) : undefined}
            votos={lider2026?.votos2026 ?? 0}
            total={corrida.total2026}
          />
        </div>
        <div
          className={`mt-3 rounded-md px-3 py-2 text-[12px] font-bold ${
            manteve ? "bg-[var(--tse-bg)]" : "bg-[var(--tse-yellow-soft)]"
          }`}
        >
          {manteve ? "Manteve o mesmo líder" : "Mudou de mãos"}
        </div>
      </section>

      <section className={tseCardClass}>
        <h3 className="text-[13px] font-bold">Quem mais ganhou e perdeu votos</h3>
        <ul className="mt-2 space-y-1 text-[12px]">
          {subidas.map(({ c, delta }) => (
            <LinhaMovimento key={c.chave} nome={c.nome} delta={delta} cor={porChave.get(c.chave)?.cor(1)} />
          ))}
          {quedas.map(({ c, delta }) => (
            <LinhaMovimento key={c.chave} nome={c.nome} delta={delta} cor={porChave.get(c.chave)?.cor(0)} />
          ))}
        </ul>
      </section>
    </>
  );
}

function LinhaOrigem({ rotulo, cor, cidades }: { rotulo: string; cor: string | undefined; cidades: string[] }) {
  return (
    <li>
      <details className="rounded-md px-1.5 py-1 hover:bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 pl-3 text-[12px]">
          <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
          <div className="min-w-0 flex-1 truncate">{rotulo}</div>
          <div className="shrink-0 font-semibold tabular-nums">{cidades.length}</div>
        </summary>
        <div className="mt-1 pl-7 text-[11px] leading-relaxed text-[var(--tse-muted)]">
          {cidades.map((c) => nomeProprio(c)).join(", ")}
        </div>
      </details>
    </li>
  );
}

function CartaoLider({
  titulo,
  nome,
  partido,
  cor,
  votos,
  total,
}: {
  titulo: string;
  nome: string | undefined;
  partido: string;
  cor: string | undefined;
  votos: number;
  total: number;
}) {
  return (
    <div className="rounded-lg bg-[var(--tse-bg)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{titulo}</div>
      {nome ? (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
            <div className="truncate text-[14px] font-bold">{nomeProprio(nome)}</div>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
            {partido} · {formatarVotos2026(votos)} votos · {formatarPct2026(total ? (votos / total) * 100 : 0, 1)}
          </div>
        </>
      ) : (
        <div className="mt-1 text-[12px] text-[var(--tse-muted)]">Sem dados</div>
      )}
    </div>
  );
}

function LinhaMovimento({ nome, delta, cor }: { nome: string; delta: number; cor: string | undefined }) {
  return (
    <li className="flex items-center gap-1.5">
      <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
      <div className="min-w-0 flex-1 truncate">{nomeProprio(nome)}</div>
      <div
        className={`shrink-0 font-bold tabular-nums ${delta > 0 ? "text-[var(--tse-olive)]" : "text-red-700"}`}
      >
        {delta > 0 ? "+" : "−"}
        {formatarVotos2026(Math.abs(delta))}
      </div>
    </li>
  );
}
