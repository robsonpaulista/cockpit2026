"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ChevronRight, FileText } from "lucide-react";
import {
  TseCarregando,
  TseErro,
  TseSegmentado,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseLinkAcaoClass,
} from "@/components/tse/tse-ui";
import type { MalhaMapaPIPayload } from "@/lib/geo-malha-pi";
import {
  formatarPct2026,
  formatarVotos2026,
  totaisPorCandidato2026,
  vencedoresPorMunicipio2026,
  type ResultadoSecao2026Payload,
  type VencedorMunicipio2026,
} from "@/lib/resultado-secao-2026";
import { fetchMalhaMunicipiosPI } from "@/lib/services/malha-pi";
import { fetchCorridaFederal2022x2026 } from "@/lib/services/corrida-territorial";
import {
  conquistasPorVencedor2026,
  montarCorridaTerritorial,
  type CorridaTerritorial,
} from "@/lib/corrida-territorial";
import type { ConquistaTerritorioPdf, PodioTerritorioPdf } from "./territorio-pdf-2026";
import { CorridaTerritorial2026 } from "./corrida-territorial-2026";
import { QuadroMunicipios2026 } from "./quadro-municipios-2026";
import {
  FILTROS_SITUACAO_2026,
  filtrarVencedoresPorSituacao2026,
  rotuloSituacao2026,
  type FiltroSituacao2026,
} from "@/lib/resultado-situacao-2026";
import { SeloSituacao2026 } from "./selo-situacao-2026";
import { CORES_PARTIDOS, abreviarCargo, corTerritorio, nomeProprio } from "./tse-ui";

type ModoCor = "candidato" | "partido";
type Ponto = [number, number];
type Anel = Ponto[];

type Forma = { chave: string; nome: string; d: string };

type Grupo = {
  chave: string;
  rotulo: string;
  detalhe: string;
  situacao: string;
  cor: string;
  municipios: number;
  votos: number;
  votosEstado: number;
};

const LARGURA = 1000;
const LARGURA_DICA = 260;

const MODOS: { id: ModoCor; label: string }[] = [
  { id: "candidato", label: "Candidato" },
  { id: "partido", label: "Partido" },
];

const chaveMunicipio = (nome: string): string =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const ehPonto = (v: unknown): v is Ponto =>
  Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number";

const aneis = (v: unknown): Anel[] =>
  Array.isArray(v)
    ? v.filter((anel): anel is Anel => Array.isArray(anel) && anel.every(ehPonto))
    : [];

function poligonos(geometria: unknown): Anel[][] {
  if (!geometria || typeof geometria !== "object") return [];
  const { type, coordinates } = geometria as { type?: unknown; coordinates?: unknown };
  if (type === "Polygon") return [aneis(coordinates)];
  if (type === "MultiPolygon" && Array.isArray(coordinates)) return coordinates.map(aneis);
  return [];
}

/** Projeção equirretangular com correção de latitude — suficiente para um estado. */
function projetar(malha: MalhaMapaPIPayload): { formas: Forma[]; altura: number } {
  const geometrias = malha.municipios.features.map((f) => ({
    nome: f.properties.nm_mun ?? "",
    poligonos: poligonos(f.geometry),
  }));
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const g of geometrias)
    for (const p of g.poligonos)
      for (const anel of p)
        for (const [lon, lat] of anel) {
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const escala = LARGURA / ((maxLon - minLon) * kx);
  const x = (lon: number) => ((lon - minLon) * kx * escala).toFixed(1);
  const y = (lat: number) => ((maxLat - lat) * escala).toFixed(1);
  const formas = geometrias.map((g) => ({
    chave: chaveMunicipio(g.nome),
    nome: g.nome,
    d: g.poligonos
      .flatMap((p) => p.map((anel) => `M${anel.map(([lon, lat]) => `${x(lon)},${y(lat)}`).join("L")}Z`))
      .join(""),
  }));
  return { formas, altura: Math.ceil((maxLat - minLat) * escala) };
}

const COR_SEM_PARTIDO = "#9CA3AF";

function conquistasParaPdf(
  corrida: CorridaTerritorial,
  corDoVencedor: (urna: string, partido: string) => string,
): ConquistaTerritorioPdf[] {
  const pessoas = new Map(corrida.participantes.map((p) => [p.chave, p]));
  return conquistasPorVencedor2026(corrida).map((g) => {
    const p = pessoas.get(g.chave);
    return {
      vencedor: nomeProprio(p?.nome ?? g.chave),
      detalhe: p?.partido ?? "",
      cor: p ? corDoVencedor(p.nome, p.partido) : COR_SEM_PARTIDO,
      mantidas: g.mantidas,
      origens: g.origens.map((o) => {
        const de = pessoas.get(o.de);
        const partido = de ? (de.partido2022 ?? de.partido) : "";
        return {
          de: nomeProprio(de?.nome ?? o.de),
          detalhe: partido,
          cor: CORES_PARTIDOS[partido] ?? COR_SEM_PARTIDO,
          cidades: o.cidades,
        };
      }),
    };
  });
}

export function Territorio2026({
  payload,
  cargo,
  onAbrirMunicipio,
}: {
  payload: ResultadoSecao2026Payload;
  cargo: string;
  onAbrirMunicipio: (codigo: string, candidatoIdx: number) => void;
}) {
  const [malha, setMalha] = useState<MalhaMapaPIPayload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoCor>("candidato");
  const [destaque, setDestaque] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [hover, setHover] = useState<{ chave: string; x: number; y: number } | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState<boolean>(false);
  const [municipioCorrida, setMunicipioCorrida] = useState<string>("");
  const [situacao, setSituacao] = useState<FiltroSituacao2026>("todas");
  const mapaRef = useRef<HTMLDivElement>(null);
  const corridaRef = useRef<HTMLDivElement>(null);
  const ehFederal = cargo === "Deputado Federal";

  useEffect(() => {
    let ativo = true;
    fetchMalhaMunicipiosPI()
      .then((m) => {
        if (ativo) setMalha(m);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar o mapa");
      });
    return () => {
      ativo = false;
    };
  }, []);

  const vencedores = useMemo(() => {
    const limite = situacao === "todas" ? 3 : payload.candidatos.length;
    return filtrarVencedoresPorSituacao2026(
      vencedoresPorMunicipio2026(payload, cargo, limite),
      (idx) => payload.candidatos[idx]?.situacao,
      situacao,
    );
  }, [payload, cargo, situacao]);
  const porMunicipio = useMemo(
    () => new Map(vencedores.map((v) => [chaveMunicipio(v.nome), v])),
    [vencedores],
  );

  const chaveVencedor = (v: VencedorMunicipio2026 | undefined): string | null => {
    const idx = v?.ranking[0]?.idx;
    if (idx == null) return null;
    return modo === "candidato" ? String(idx) : payload.candidatos[idx]?.partido || "Sem partido";
  };

  const totais = useMemo(() => totaisPorCandidato2026(payload), [payload]);

  const grupos = useMemo<Grupo[]>(() => {
    const acc = new Map<string, Omit<Grupo, "cor" | "votosEstado">>();
    for (const v of vencedores) {
      const w = v.ranking[0];
      if (!w) continue;
      const c = payload.candidatos[w.idx];
      const chave = modo === "candidato" ? String(w.idx) : c?.partido || "Sem partido";
      const situacao = modo === "candidato" ? rotuloSituacao2026(c?.situacao) : "";
      const g = acc.get(chave) ?? {
        chave,
        rotulo: modo === "candidato" ? nomeProprio(c?.nome ?? "") : chave,
        detalhe: modo === "candidato" ? [c?.partido ?? "", situacao].filter(Boolean).join(" · ") : "",
        situacao,
        municipios: 0,
        votos: 0,
      };
      g.municipios += 1;
      g.votos += w.votos;
      acc.set(chave, g);
    }
    const votosEstado = (chave: string): number =>
      modo === "candidato"
        ? (totais[Number(chave)] ?? 0)
        : payload.candidatos.reduce(
            (soma, c, i) =>
              c.cargo === cargo && (c.partido || "Sem partido") === chave ? soma + (totais[i] ?? 0) : soma,
            0,
          );
    return [...acc.values()]
      .map((g) => ({ ...g, votosEstado: votosEstado(g.chave) }))
      .sort((a, b) => b.votosEstado - a.votosEstado || b.municipios - a.municipios)
      .map((g, i) => ({
        ...g,
        cor: (modo === "partido" && CORES_PARTIDOS[g.chave]) || corTerritorio(i),
      }));
  }, [vencedores, payload, modo, totais, cargo]);

  const corPorChave = useMemo(() => new Map(grupos.map((g) => [g.chave, g.cor])), [grupos]);

  const mapa = useMemo(() => (malha ? projetar(malha) : null), [malha]);

  const trocarModo = (m: ModoCor) => {
    setModo(m);
    setDestaque(null);
  };
  const definirSituacao = (id: FiltroSituacao2026) => {
    setSituacao(id);
    setDestaque(null);
  };
  const textoMapa = FILTROS_SITUACAO_2026.find((f) => f.id === situacao)?.noMapa ?? FILTROS_SITUACAO_2026[0].noMapa;

  const montarPodio = (): PodioTerritorioPdf[] => {
    const podio = new Map<string, PodioTerritorioPdf>();
    for (const v of vencedores) {
      v.ranking.forEach((r, posicao) => {
        const c = payload.candidatos[r.idx];
        const chave = modo === "candidato" ? String(r.idx) : c?.partido || "Sem partido";
        const situacao = modo === "candidato" ? rotuloSituacao2026(c?.situacao) : "";
        const item = podio.get(chave) ?? {
          rotulo: modo === "candidato" ? nomeProprio(c?.nome ?? "") : chave,
          detalhe: modo === "candidato" ? [c?.partido ?? "", situacao].filter(Boolean).join(" · ") : "",
          cor: corPorChave.get(chave) ?? null,
          primeiros: 0,
          segundos: 0,
          terceiros: 0,
          votosEstado:
            modo === "candidato"
              ? (totais[r.idx] ?? 0)
              : payload.candidatos.reduce(
                  (soma, outro, i) =>
                    outro.cargo === cargo && (outro.partido || "Sem partido") === chave
                      ? soma + (totais[i] ?? 0)
                      : soma,
                  0,
                ),
        };
        if (posicao === 0) item.primeiros += 1;
        else if (posicao === 1) item.segundos += 1;
        else item.terceiros += 1;
        podio.set(chave, item);
      });
    }
    return [...podio.values()].sort(
      (a, b) =>
        b.primeiros - a.primeiros ||
        b.segundos - a.segundos ||
        b.terceiros - a.terceiros ||
        b.votosEstado - a.votosEstado,
    );
  };

  const exportarPdf = async () => {
    setGerandoPdf(true);
    try {
      const { exportarTerritorioPdf2026 } = await import("./territorio-pdf-2026");
      const corrida = ehFederal
        ? await fetchCorridaFederal2022x2026()
            .then(montarCorridaTerritorial)
            .catch(() => null)
        : null;
      const corDoVencedor = (urna: string, partido: string): string =>
        (modo === "candidato"
          ? grupos.find((g) => g.rotulo === nomeProprio(urna))?.cor
          : corPorChave.get(partido)) ??
        CORES_PARTIDOS[partido] ??
        COR_SEM_PARTIDO;
      exportarTerritorioPdf2026({
        conquistas: corrida ? conquistasParaPdf(corrida, corDoVencedor) : undefined,
        podio: montarPodio(),
        meta: payload.meta,
        fonteDados: payload.candidatos[0]?.fonte ?? "",
        cargo,
        modo,
        totalMunicipios: vencedores.length,
        grupos: grupos.map((g) => ({
          rotulo: g.rotulo,
          detalhe: g.detalhe,
          cor: g.cor,
          votosEstado: g.votosEstado,
          municipios: vencedores
            .filter((v) => chaveVencedor(v) === g.chave)
            .sort((a, b) => (b.ranking[0]?.votos ?? 0) - (a.ranking[0]?.votos ?? 0))
            .map((v) => {
              const [primeiro, segundo, terceiro] = v.ranking;
              const rotuloColocado = (idx: number | undefined) => {
                const c = idx == null ? undefined : payload.candidatos[idx];
                if (!c) return "";
                const situacao = rotuloSituacao2026(c.situacao);
                return `${nomeProprio(c.nome)} (${[c.partido ?? "", situacao].filter(Boolean).join(" · ")})`;
              };
              return {
                nome: v.nome,
                vencedor: nomeProprio(payload.candidatos[primeiro.idx]?.nome ?? ""),
                votos: primeiro.votos,
                pctMunicipio: primeiro.pct,
                pctTotal: g.votosEstado ? (primeiro.votos / g.votosEstado) * 100 : 0,
                segundo: rotuloColocado(segundo?.idx),
                votosSegundo: segundo?.votos ?? null,
                terceiro: rotuloColocado(terceiro?.idx),
                votosTerceiro: terceiro?.votos ?? null,
              };
            }),
        })),
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  const moverMouse = (e: ReactMouseEvent, chave: string) => {
    const caixa = mapaRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const x = e.clientX - caixa.left + 14;
    setHover({ chave, x: Math.min(x, Math.max(0, caixa.width - LARGURA_DICA)), y: e.clientY - caixa.top + 14 });
  };

  if (erro) return <TseErro>{erro}</TseErro>;
  if (!mapa) return <TseCarregando texto="Carregando mapa do Piauí…" />;

  const vencedorHover = hover ? porMunicipio.get(hover.chave) : undefined;
  const vencedorSel = selecionado ? porMunicipio.get(selecionado) : undefined;

  return (
    <div className="space-y-5">
      <QuadroMunicipios2026
        payload={payload}
        cargo={cargo}
        situacao={situacao}
        onSituacao={definirSituacao}
        onAbrirMunicipio={onAbrirMunicipio}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`${tseCardClass} relative`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">Domínio territorial · {cargo}</h2>
              <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
                {textoMapa} · passe o mouse para ver votos e fatia do vencedor
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
              Colorir por
              <TseSegmentado opcoes={MODOS} valor={modo} onChange={trocarModo} />
            </div>
          </div>

          <div ref={mapaRef} className="relative mt-3" onMouseLeave={() => setHover(null)}>
            <svg
              viewBox={`0 0 ${LARGURA} ${mapa.altura}`}
              className="mx-auto block h-[min(78vh,880px)] w-auto max-w-full"
              role="img"
              aria-label={`Mapa do Piauí: ${textoMapa.toLowerCase()} para ${cargo}`}
            >
              {mapa.formas.map((f) => {
                const v = porMunicipio.get(f.chave);
                const chave = chaveVencedor(v);
                const apagado = destaque != null && chave !== destaque;
                const cor = (chave && corPorChave.get(chave)) || "#EEEEEE";
                const sel = selecionado === f.chave;
                return (
                  <path
                    key={f.chave}
                    d={f.d}
                    fill={apagado ? "#EDEDED" : cor}
                    stroke={sel ? "#333333" : "#FFFFFF"}
                    strokeWidth={sel ? 2.5 : 0.8}
                    className="cursor-pointer transition-[fill] duration-200"
                    onMouseMove={(e) => moverMouse(e, f.chave)}
                    onClick={() => setSelecionado(sel ? null : f.chave)}
                  />
                );
              })}
            </svg>

            {hover && vencedorHover ? (
              <div
                className="pointer-events-none absolute z-10 rounded-lg bg-white p-3 text-[12px] shadow-lg ring-1 ring-black/5"
                style={{ left: hover.x, top: hover.y, width: LARGURA_DICA - 10 }}
              >
                <ResumoMunicipio payload={payload} vencedor={vencedorHover} compacto />
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className={tseCardClass}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13px] font-bold">
                {modo === "candidato" ? "Vencedores por votos no estado" : "Partidos vencedores por votos no estado"}
              </h3>
              <button
                type="button"
                onClick={exportarPdf}
                disabled={gerandoPdf || grupos.length === 0}
                className={`${tseBotaoCinzaClass} shrink-0`}
                title="Exportar a lista com os municípios de cada vencedor"
              >
                <FileText className={tseBotaoIconeClass} />
                {gerandoPdf ? "Gerando…" : "PDF"}
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
              {grupos.length} {modo === "candidato" ? "candidatos" : "partidos"} com ao menos um município · E eleito, S
              suplente, N não eleito · clique para destacar no mapa
            </p>
            <ul className="mt-3 max-h-[min(70vh,760px)] space-y-1 overflow-y-auto pr-1">
              {grupos.map((g) => (
                <ItemLegenda
                  key={g.chave}
                  grupo={g}
                  ativo={destaque === g.chave}
                  onClick={() => setDestaque((d) => (d === g.chave ? null : g.chave))}
                />
              ))}
            </ul>
          </section>

          <section className={tseCardClass}>
            {vencedorSel ? (
              <>
                <ResumoMunicipio payload={payload} vencedor={vencedorSel} />
                {vencedorSel.ranking[0] ? (
                  <button
                    type="button"
                    onClick={() => onAbrirMunicipio(vencedorSel.codigo, vencedorSel.ranking[0].idx)}
                    className={`${tseLinkAcaoClass} mt-3 inline-flex items-center gap-1`}
                  >
                    Ver locais e seções
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {ehFederal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMunicipioCorrida(vencedorSel.nome);
                      corridaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`${tseLinkAcaoClass} mt-1.5 flex items-center gap-1`}
                  >
                    Ver corrida 2022 → 2026 neste município
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </>
            ) : (
              <p className="text-[12px] text-[var(--tse-muted)]">
                Clique em um município no mapa para ver os três mais votados.
              </p>
            )}
          </section>
        </aside>
      </div>

      {ehFederal ? (
        <div ref={corridaRef} className="scroll-mt-4">
          <CorridaTerritorial2026 municipio={municipioCorrida} onTrocarMunicipio={setMunicipioCorrida} />
        </div>
      ) : null}
    </div>
  );
}

function ItemLegenda({ grupo, ativo, onClick }: { grupo: Grupo; ativo: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ativo}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--tse-yellow-soft)] ${
          ativo ? "bg-[var(--tse-yellow-soft)] font-bold" : ""
        }`}
      >
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: grupo.cor }} />
        <span className="min-w-0 flex-1 truncate">
          {grupo.rotulo}
          {grupo.detalhe ? <span className="ml-1 text-[var(--tse-muted)]">{grupo.detalhe}</span> : null}
        </span>
        <SeloSituacao2026 situacao={grupo.situacao} />
        <div className="shrink-0 text-right tabular-nums leading-tight">
          <div className="font-semibold">{formatarVotos2026(grupo.votosEstado)} votos</div>
          <div className="text-[10px] text-[var(--tse-muted)]">
            {grupo.municipios} {grupo.municipios === 1 ? "município" : "municípios"}
          </div>
        </div>
      </button>
    </li>
  );
}

function ResumoMunicipio({
  payload,
  vencedor,
  compacto = false,
}: {
  payload: ResultadoSecao2026Payload;
  vencedor: VencedorMunicipio2026;
  compacto?: boolean;
}) {
  const [primeiro, segundo] = vencedor.ranking;
  const margem = primeiro && segundo ? primeiro.votos - segundo.votos : null;
  return (
    <div>
      <p className="text-[13px] font-bold uppercase">{vencedor.nome}</p>
      <p className="text-[11px] text-[var(--tse-muted)]">
        {formatarVotos2026(vencedor.totalCargo)} votos nominais
        {margem != null ? ` · vantagem de ${formatarVotos2026(margem)}` : ""}
      </p>
      <ol className="mt-2 space-y-1.5">
        {vencedor.ranking.slice(0, compacto ? 2 : 3).map((c, i) => {
          const cand = payload.candidatos[c.idx];
          const situacao = rotuloSituacao2026(cand?.situacao);
          return (
            <li key={c.idx}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`flex min-w-0 items-center gap-1 ${i === 0 ? "font-bold" : ""}`}>
                  <span className="truncate">
                    {i + 1}º {nomeProprio(cand?.nome ?? "")}
                    <span className="ml-1 text-[11px] font-normal text-[var(--tse-muted)]">
                      {cand?.partido ?? abreviarCargo(cand?.cargo ?? "")}
                      {!compacto && situacao ? ` · ${situacao}` : ""}
                    </span>
                  </span>
                  <SeloSituacao2026 situacao={cand?.situacao} />
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatarVotos2026(c.votos)} · {formatarPct2026(c.pct)}
                </span>
              </div>
              {!compacto ? (
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--tse-zero)]">
                  <div
                    className="h-full bg-[var(--tse-green)]"
                    style={{ width: `${Math.min(100, c.pct)}%` }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
