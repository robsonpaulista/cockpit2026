"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, FileText, MapPin, Plus, User, X } from "lucide-react";
import {
  TseBarraRotulo,
  TseBarraValor,
  TseBusca,
  TseCarregando,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseErro,
  TseFilterBar,
  TseMenu,
  TseMenuItem,
  TsePage,
  TsePill,
  TsePillSelect,
  TsePillValor,
  TseRank,
  TseSelectGrande,
  TseTabs,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
  tseTabela,
} from "@/components/tse/tse-ui";
import {
  detalharSecoes2026,
  filtrarSecoes2026,
  formatarPct2026,
  formatarSecao2026,
  formatarVotos2026,
  formatarZona2026,
  resumirLocais2026,
  resumirMunicipios2026,
  resumoGeral2026,
  secoesDoCandidato2026,
  secoesParaCsv2026,
  type LocalResumo2026,
  type MunicipioResumo2026,
  type ResultadoSecao2026Payload,
  type SecaoDetalhe2026,
} from "@/lib/resultado-secao-2026";
import { fetchResultadoSecao2026 } from "@/lib/services/resultado-secao-2026";
import { ComparativoLocais2026 } from "./comparativo-locais-2026";
import { ComparativoSecoes2026 } from "./comparativo-secoes-2026";
import type { ModoPdfResultado } from "./resultado-pdf-2026";
import {
  CANDIDATO_CORES,
  abreviarCargo,
  baixarCsv,
  corCandidato,
  nomeProprio,
  normalizarTexto as normalizar,
} from "./tse-ui";

type Visao =
  | "municipios"
  | "locais"
  | "secoes"
  | "comparativo"
  | "comparativo-secao";
type Ordem = "votos" | "alfabetica";

const PAGE_SIZE = 30;

/** Referência padrão dos comparativos (Deputado Federal); os demais marcados são parceiros de dobradinha. */
function indiceGeral(candidatos: ResultadoSecao2026Payload["candidatos"]): number {
  const i = candidatos.findIndex((c) => c.comparativo && /federal/i.test(c.cargo));
  return i >= 0 ? i : 0;
}

const ehDobradinha = (candidatos: ResultadoSecao2026Payload["candidatos"], i: number): boolean =>
  i !== indiceGeral(candidatos) && Boolean(candidatos[i]?.comparativo);

/** Os gráficos dos comparativos têm uma cor por candidato (referência + parceiros). */
const MAX_PARCEIROS = CANDIDATO_CORES.length - 1;

const VISOES: { id: Visao; label: string }[] = [
  { id: "municipios", label: "Municípios" },
  { id: "locais", label: "Locais de votação" },
  { id: "secoes", label: "Seções" },
  { id: "comparativo", label: "Comparativo por local" },
  { id: "comparativo-secao", label: "Comparativo por seção" },
];

const ehComparativo = (v: Visao): boolean =>
  v === "comparativo" || v === "comparativo-secao";

export function ResultadoSecao2026Panel() {
  const [payload, setPayload] = useState<ResultadoSecao2026Payload | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [zona, setZona] = useState<number | null>(null);
  const [visao, setVisao] = useState<Visao>("municipios");
  const [ordem, setOrdem] = useState<Ordem>("votos");
  const [busca, setBusca] = useState<string>("");
  const [limite, setLimite] = useState<number>(PAGE_SIZE);
  const [localSel, setLocalSel] = useState<number | null>(null);
  const [candidatoIdx, setCandidatoIdx] = useState<number>(0);
  const [referenciaIdx, setReferenciaIdx] = useState<number>(0);
  const [parceiros, setParceiros] = useState<number[]>([]);
  const [cargoParceiro, setCargoParceiro] = useState<string>("");
  const [gerandoPdf, setGerandoPdf] = useState<ModoPdfResultado | null>(null);

  useEffect(() => {
    let ativo = true;
    fetchResultadoSecao2026()
      .then((data) => {
        if (!ativo) return;
        setPayload(data);
        const geral = indiceGeral(data.candidatos);
        setCandidatoIdx(geral);
        setReferenciaIdx(geral);
        const primeiroParceiro = data.candidatos.findIndex((_, i) => ehDobradinha(data.candidatos, i));
        setParceiros(primeiroParceiro >= 0 ? [primeiroParceiro] : []);
        setCargoParceiro(data.candidatos[primeiroParceiro]?.cargo ?? data.candidatos[geral]?.cargo ?? "");
      })
      .catch((e: unknown) => {
        if (ativo)
          setError(
            e instanceof Error ? e.message : "Erro ao carregar resultado",
          );
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const municipiosOrdenados = useMemo(
    () =>
      [...(payload?.municipios ?? [])].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    [payload],
  );

  const zonasMunicipio = useMemo(() => {
    if (!payload || !municipio) return [];
    return [
      ...new Set(
        payload.secoes.filter((s) => s.m === municipio).map((s) => s.z),
      ),
    ].sort((a, b) => a - b);
  }, [payload, municipio]);

  const secoesEscopoMulti = useMemo(
    () =>
      payload ? filtrarSecoes2026(payload.secoes, { municipio, zona }) : [],
    [payload, municipio, zona],
  );

  const secoesEscopo = useMemo(
    () => secoesDoCandidato2026(secoesEscopoMulti, candidatoIdx),
    [secoesEscopoMulti, candidatoIdx],
  );

  const geral = useMemo(
    () => (payload ? resumoGeral2026(payload, secoesEscopo) : null),
    [payload, secoesEscopo],
  );

  const municipiosResumo = useMemo(
    () => (payload ? resumirMunicipios2026(payload, secoesEscopo) : []),
    [payload, secoesEscopo],
  );

  const rankMunicipio = useMemo(() => {
    const ordenados = [...municipiosResumo].sort((a, b) => b.votos - a.votos);
    return new Map(ordenados.map((m, i) => [m.codigo, i + 1]));
  }, [municipiosResumo]);

  const maxVotosMunicipio = useMemo(
    () => municipiosResumo.reduce((m, x) => Math.max(m, x.votos), 0),
    [municipiosResumo],
  );

  const locaisResumo = useMemo(
    () => (payload ? resumirLocais2026(payload, secoesEscopo) : []),
    [payload, secoesEscopo],
  );

  const secoesDetalhe = useMemo(() => {
    if (!payload) return [];
    const base =
      localSel != null
        ? secoesEscopo.filter((s) => s.l === localSel)
        : secoesEscopo;
    return detalharSecoes2026(payload, base);
  }, [payload, secoesEscopo, localSel]);

  const termo = normalizar(busca.trim());

  const municipiosVisiveis = useMemo(() => {
    const lista = termo
      ? municipiosResumo.filter((m) => normalizar(m.nome).includes(termo))
      : municipiosResumo;
    return [...lista].sort((a, b) =>
      ordem === "votos"
        ? b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR")
        : a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [municipiosResumo, termo, ordem]);

  const locaisVisiveis = useMemo(() => {
    const lista = termo
      ? locaisResumo.filter((l) =>
          normalizar(
            `${l.local?.nome ?? ""} ${l.local?.bairro ?? ""} ${l.local?.endereco ?? ""} ${l.municipioNome}`,
          ).includes(termo),
        )
      : locaisResumo;
    const nome = (l: LocalResumo2026) => l.local?.nome ?? "";
    return [...lista].sort((a, b) =>
      ordem === "votos"
        ? b.votos - a.votos || nome(a).localeCompare(nome(b), "pt-BR")
        : nome(a).localeCompare(nome(b), "pt-BR"),
    );
  }, [locaisResumo, termo, ordem]);

  const secoesVisiveis = useMemo(() => {
    const lista = termo
      ? secoesDetalhe.filter((s) =>
          normalizar(
            `${formatarSecao2026(s.s)} ${s.local?.nome ?? ""} ${s.local?.bairro ?? ""} ${s.municipioNome}`,
          ).includes(termo),
        )
      : secoesDetalhe;
    return [...lista].sort((a, b) =>
      ordem === "votos"
        ? b.v - a.v || a.z - b.z || a.s - b.s
        : a.municipioNome.localeCompare(b.municipioNome, "pt-BR") ||
          a.z - b.z ||
          a.s - b.s,
    );
  }, [secoesDetalhe, termo, ordem]);

  const comparar = useMemo<number[]>(
    () => (parceiros.length ? [referenciaIdx, ...parceiros] : []),
    [referenciaIdx, parceiros],
  );

  const maxVotosSecao = useMemo(
    () => secoesVisiveis.reduce((m, s) => Math.max(m, s.v), 0),
    [secoesVisiveis],
  );

  const totalVisao =
    visao === "municipios"
      ? municipiosVisiveis.length
      : visao === "locais"
        ? locaisVisiveis.length
        : secoesVisiveis.length;

  const nomeMunicipioSel = municipio
    ? (payload?.municipios.find((m) => m.codigo === municipio)?.nome ?? null)
    : null;
  const localSelInfo =
    localSel != null
      ? (payload?.locais.find((l) => l.id === localSel) ?? null)
      : null;

  const trocarMunicipio = (codigo: string | null) => {
    setMunicipio(codigo);
    setZona(null);
    setLocalSel(null);
    setLimite(PAGE_SIZE);
    if (codigo && visao === "municipios") setVisao("locais");
  };

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    setLimite(PAGE_SIZE);
    if (v !== "secoes") setLocalSel(null);
  };

  const trocarCandidato = (i: number) => {
    setCandidatoIdx(i);
    setLimite(PAGE_SIZE);
  };

  const trocarReferencia = (i: number) => {
    setReferenciaIdx(i);
    setParceiros((prev) => prev.filter((p) => p !== i));
  };

  const adicionarParceiro = (i: number) => {
    if (i === referenciaIdx) return;
    setParceiros((prev) =>
      prev.includes(i) || prev.length >= MAX_PARCEIROS ? prev : [...prev, i],
    );
  };

  const removerParceiro = (i: number) => {
    setParceiros((prev) => prev.filter((p) => p !== i));
  };

  const abrirSecoesDoLocal = (l: LocalResumo2026) => {
    setLocalSel(l.localId);
    setVisao("secoes");
    setLimite(PAGE_SIZE);
    setBusca("");
  };

  const exportar = () => {
    if (!payload) return;
    const escopo = nomeMunicipioSel
      ? normalizar(nomeMunicipioSel).replace(/\s+/g, "-")
      : "piaui";
    const id = payload.candidatos[candidatoIdx]?.id ?? "candidato";
    baixarCsv(
      `${id}-2026-secoes-${escopo}.csv`,
      secoesParaCsv2026(secoesVisiveis),
    );
  };

  if (loading) {
    return (
      <TsePage>
        <TseCarregando texto="Carregando resultado por seção…" />
      </TsePage>
    );
  }

  if (error || !payload || !geral || !payload.candidatos[candidatoIdx]) {
    return (
      <TsePage>
        <TseErro>{error ?? "Sem dados de resultado por seção."}</TseErro>
      </TsePage>
    );
  }

  const { meta } = payload;
  const candidato = payload.candidatos[candidatoIdx];
  const emComparativo = ehComparativo(visao);
  const referencia = payload.candidatos[referenciaIdx] ?? payload.candidatos[0];
  const cargos = [...new Set(payload.candidatos.map((c) => c.cargo))];
  const candidatosDe = (cargo: string) =>
    payload.candidatos
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.cargo === cargo)
      .sort((a, b) => a.c.nome.localeCompare(b.c.nome, "pt-BR"));
  const primeiroDoCargo = (cargo: string) => payload.candidatos.findIndex((c) => c.cargo === cargo);
  const candidatosDoCargo = candidatosDe(candidato.cargo);
  const trocarCargo = (cargo: string) => {
    if (cargo === candidato.cargo) return;
    const i = primeiroDoCargo(cargo);
    if (i >= 0) trocarCandidato(i);
  };
  const trocarCargoReferencia = (cargo: string) => {
    if (cargo === referencia.cargo) return;
    const i = primeiroDoCargo(cargo);
    if (i >= 0) trocarReferencia(i);
  };
  const parceirosDisponiveis = candidatosDe(cargoParceiro || referencia.cargo).filter(
    ({ i }) => i !== referenciaIdx && !parceiros.includes(i),
  );
  const sugestoesDobradinha = payload.candidatos
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => ehDobradinha(payload.candidatos, i) && i !== referenciaIdx && !parceiros.includes(i));
  const podeAdicionar = parceiros.length < MAX_PARCEIROS;
  const pctSecoesComVoto = geral.secoes
    ? (geral.secoesComVoto / geral.secoes) * 100
    : 0;
  const pctDoCandidato = candidato.totalVotos
    ? (geral.votos / candidato.totalVotos) * 100
    : 0;
  const escopoLabel = nomeMunicipioSel
    ? `${nomeProprio(nomeMunicipioSel)}${zona != null ? ` · Zona ${formatarZona2026(zona)}` : ""}`
    : "Piauí";

  const linhasPdf = (modoPdf: ModoPdfResultado) => (modoPdf === "completo" ? Infinity : limite);

  const exportarPdf = async (modoPdf: ModoPdfResultado) => {
    setGerandoPdf(modoPdf);
    try {
      const { exportarResultadoPdf2026 } = await import("./resultado-pdf-2026");
      const base = {
        meta,
        candidato,
        geral,
        escopoLabel,
        legendaVotos: nomeMunicipioSel
          ? `· ${formatarPct2026(pctDoCandidato)} do total do candidato`
          : "no estado",
        ordemLabel: ordem === "votos" ? "mais votados" : "ordem alfabética",
        busca: busca.trim(),
        modo: modoPdf,
      };
      const n = linhasPdf(modoPdf);
      if (visao === "municipios") {
        exportarResultadoPdf2026({
          ...base,
          visao,
          linhas: municipiosVisiveis.slice(0, n),
          rank: rankMunicipio,
        });
      } else if (visao === "locais") {
        exportarResultadoPdf2026({
          ...base,
          visao,
          linhas: locaisVisiveis.slice(0, n),
          mostrarMunicipio: !municipio,
        });
      } else if (visao === "secoes") {
        exportarResultadoPdf2026({
          ...base,
          visao,
          linhas: secoesVisiveis.slice(0, n),
          mostrarMunicipio: !municipio,
          localLabel: localSelInfo?.nome ?? null,
        });
      }
    } finally {
      setGerandoPdf(null);
    }
  };

  return (
    <TsePage>
        <TseFilterBar>
          <TseSelectGrande
            icone={MapPin}
            rotulo="Município"
            value={municipio ?? ""}
            onChange={(e) => trocarMunicipio(e.target.value || null)}
          >
            <option value="">Piauí</option>
            {municipiosOrdenados.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {nomeProprio(m.nome)}
              </option>
            ))}
          </TseSelectGrande>

          {zonasMunicipio.length > 1 && (
            <TsePillSelect
              rotulo="Zona"
              value={zona ?? ""}
              onChange={(e) => {
                setZona(e.target.value ? Number(e.target.value) : null);
                setLocalSel(null);
                setLimite(PAGE_SIZE);
              }}
            >
              <option value="">Todas</option>
              {zonasMunicipio.map((z) => (
                <option key={z} value={z}>
                  {formatarZona2026(z)}
                </option>
              ))}
            </TsePillSelect>
          )}

          {emComparativo ? (
            <>
              <TsePillSelect
                rotulo="Cargo"
                value={referencia.cargo}
                onChange={(e) => trocarCargoReferencia(e.target.value)}
              >
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo}>
                    {cargo}
                  </option>
                ))}
              </TsePillSelect>

              <TseSelectGrande
                icone={User}
                rotulo="Referência"
                value={referenciaIdx}
                onChange={(e) => trocarReferencia(Number(e.target.value))}
              >
                {candidatosDe(referencia.cargo).map(({ c, i }) => (
                  <option key={c.id} value={i}>
                    {nomeProprio(c.nome)}
                  </option>
                ))}
              </TseSelectGrande>
            </>
          ) : (
            <>
              <TsePillSelect
                rotulo="Cargo"
                value={candidato.cargo}
                onChange={(e) => trocarCargo(e.target.value)}
              >
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo}>
                    {cargo}
                  </option>
                ))}
              </TsePillSelect>

              <TseSelectGrande
                icone={User}
                rotulo="Candidato"
                value={candidatoIdx}
                onChange={(e) => trocarCandidato(Number(e.target.value))}
              >
                {candidatosDoCargo.map(({ c, i }) => (
                  <option key={c.id} value={i}>
                    {nomeProprio(c.nome)}
                  </option>
                ))}
              </TseSelectGrande>
            </>
          )}

          <TsePillValor rotulo="Turno">{meta.turno}º</TsePillValor>
        </TseFilterBar>

        {emComparativo ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[14px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: corCandidato(0), borderColor: corCandidato(0) }}
              title="Referência dos comparativos"
            >
              {referencia.nome}
              <span className="text-[11px] font-semibold normal-case opacity-80">
                {abreviarCargo(referencia.cargo)}
              </span>
              <span className="rounded bg-white/25 px-1.5 py-px text-[10px] font-black">REF.</span>
            </span>
            <span className="text-[18px] font-black text-[var(--tse-muted)]" aria-hidden>
              +
            </span>
            {parceiros.map((i, n) => {
              const c = payload.candidatos[i];
              if (!c) return null;
              const cor = corCandidato(n + 1);
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-2 rounded-md border py-2 pl-4 pr-2 text-[14px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: cor, borderColor: cor }}
                >
                  {c.nome}
                  <span className="text-[11px] font-semibold normal-case opacity-80">
                    {abreviarCargo(c.cargo)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerParceiro(i)}
                    aria-label={`Remover ${nomeProprio(c.nome)}`}
                    className="rounded p-0.5 hover:bg-white/25"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}

            {podeAdicionar ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={cargoParceiro || referencia.cargo}
                  onChange={(e) => setCargoParceiro(e.target.value)}
                  className={tseControleClass}
                  aria-label="Cargo do parceiro"
                >
                  {cargos.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) adicionarParceiro(Number(e.target.value));
                  }}
                  className={tseControleClass}
                  aria-label="Adicionar parceiro"
                >
                  <option value="">Adicionar candidato…</option>
                  {parceirosDisponiveis.map(({ c, i }) => (
                    <option key={c.id} value={i}>
                      {nomeProprio(c.nome)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[12px] text-[var(--tse-muted)]">
                Máximo de {MAX_PARCEIROS} parceiros
              </span>
            )}

            {podeAdicionar && sugestoesDobradinha.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="text-[var(--tse-muted)]">Dobradinha:</span>
                {sugestoesDobradinha.map(({ c, i }) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => adicionarParceiro(i)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#CFCFCF] bg-white px-2.5 py-0.5 font-semibold hover:border-[var(--tse-olive)]"
                  >
                    <Plus className="h-3 w-3" />
                    {nomeProprio(c.nome)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <TseTabs className="mt-5" abas={VISOES} ativa={visao} onChange={trocarVisao} />

        {emComparativo ? (
          <div className="mt-5">
            {comparar.length >= 2 && visao === "comparativo-secao" ? (
              <ComparativoSecoes2026
                key={comparar.join("-")}
                payload={payload}
                secoes={secoesEscopoMulti}
                indices={comparar}
                escopoLabel={escopoLabel}
              />
            ) : comparar.length >= 2 ? (
              <ComparativoLocais2026
                key={comparar.join("-")}
                payload={payload}
                secoes={secoesEscopoMulti}
                indices={comparar}
                escopoLabel={escopoLabel}
                onSelecionarMunicipio={(codigo) => {
                  setMunicipio(codigo);
                  setZona(null);
                  setLocalSel(null);
                }}
              />
            ) : (
              <TseVazio>
                Adicione ao menos um candidato para cruzar com{" "}
                {nomeProprio(referencia.nome)}.
              </TseVazio>
            )}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
            <aside className="space-y-4">
              <section className={tseCardClass}>
                <h2 className="text-xl font-bold">Dados Gerais</h2>
                <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">
                  Última atualização {candidato.fonte.split("·").pop()?.trim()}{" "}
                  (Horário local)
                </p>
                <TseDados>
                  <TseDado
                    rotulo="Municípios com voto"
                    valor={formatarVotos2026(geral.municipiosComVoto)}
                    sufixo={`/ ${formatarVotos2026(geral.municipios)}`}
                  />
                  <TseDado rotulo="Locais de votação" valor={formatarVotos2026(geral.locais)} />
                  <TseDado rotulo="Total de seções" valor={formatarVotos2026(geral.secoes)} />
                  <TseDado rotulo="Seções com voto" valor={formatarVotos2026(geral.secoesComVoto)} />
                </TseDados>
                <TseBarraRotulo pct={pctSecoesComVoto} rotulo={formatarPct2026(pctSecoesComVoto)} />
              </section>

              <section className={tseCardClass}>
                <h2 className="text-[15px] font-bold">Votação</h2>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--tse-zero)]">
                  <div
                    className="bg-[var(--tse-green)]"
                    style={{ width: `${pctSecoesComVoto}%` }}
                  />
                </div>
                <p className="mt-1 text-[12px] font-bold">
                  {formatarVotos2026(geral.votos)} votos
                </p>
                <ul className="mt-3 space-y-2 text-[13px]">
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 bg-[var(--tse-green)]" /> Seções
                      com voto
                    </span>
                    <strong>{formatarVotos2026(geral.secoesComVoto)}</strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 bg-[var(--tse-zero)]" /> Seções
                      sem voto
                    </span>
                    <strong>{formatarVotos2026(geral.secoesSemVoto)}</strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 bg-[var(--tse-yellow)]" /> Média
                      por seção
                    </span>
                    <strong>
                      {geral.mediaSecao.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}
                    </strong>
                  </li>
                </ul>
                {geral.maiorSecao && (
                  <div className="mt-4 rounded-lg bg-[var(--tse-bar)] p-3 text-[12px]">
                    <p className="font-bold">Seção mais votada</p>
                    <p className="mt-1">
                      {nomeProprio(geral.maiorSecao.municipioNome)} · Zona{" "}
                      {formatarZona2026(geral.maiorSecao.z)} · Seção{" "}
                      {formatarSecao2026(geral.maiorSecao.s)}
                    </p>
                    {geral.maiorSecao.local && (
                      <p className="text-[var(--tse-muted)]">
                        {geral.maiorSecao.local.nome}
                      </p>
                    )}
                    <p className="mt-1 text-[14px] font-bold">
                      {formatarVotos2026(geral.maiorSecao.v)} votos
                    </p>
                  </div>
                )}
              </section>
            </aside>

            <main className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value as Ordem)}
                  className={tseControleClass}
                >
                  <option value="votos">Ordenar: mais votados</option>
                  <option value="alfabetica">Ordem alfabética</option>
                </select>
                <div className="flex items-center gap-2">
                  <TseBusca
                    value={busca}
                    onChange={(v) => {
                      setBusca(v);
                      setLimite(PAGE_SIZE);
                    }}
                    placeholder={
                      visao === "municipios"
                        ? "Buscar município"
                        : visao === "locais"
                          ? "Buscar local ou bairro"
                          : "Buscar seção, local ou bairro"
                    }
                  />
                  <button type="button" onClick={exportar} className={tseBotaoCinzaClass}>
                    <Download className={tseBotaoIconeClass} />
                    Exportar seções
                  </button>
                  <TseMenu
                    icone={FileText}
                    rotulo="Exportar PDF"
                    ocupado={gerandoPdf != null}
                    rotuloOcupado="Gerando PDF…"
                  >
                    {(fechar) => (
                      <>
                        <TseMenuItem
                          titulo="Como está na tela"
                          descricao={`Card do candidato e as ${formatarVotos2026(Math.min(limite, totalVisao))} linhas carregadas`}
                          onClick={() => {
                            fechar();
                            void exportarPdf("tela");
                          }}
                        />
                        <TseMenuItem
                          titulo="Lista completa"
                          descricao={`${formatarVotos2026(totalVisao)} linhas${totalVisao > 4000 ? " (arquivo grande, pode demorar)" : ""}`}
                          onClick={() => {
                            fechar();
                            void exportarPdf("completo");
                          }}
                        />
                      </>
                    )}
                  </TseMenu>
                </div>
              </div>

              <section className="mt-4 flex flex-wrap items-center gap-5 rounded-xl bg-white px-5 py-4 shadow-sm">
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-bold uppercase">
                      {candidato.nome}
                    </p>
                    <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                      {escopoLabel}
                    </span>
                  </div>
                  <p className="text-[15px] text-[var(--tse-muted)]">
                    {candidato.cargo} – {candidato.numero}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black">
                    {formatarVotos2026(geral.votos)}
                  </p>
                  <p className="text-[13px] text-[var(--tse-muted)]">
                    votos
                    {nomeMunicipioSel
                      ? ` · ${formatarPct2026(pctDoCandidato)} do total do candidato`
                      : " no estado"}
                  </p>
                </div>
              </section>

              {visao === "secoes" && localSelInfo && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-[var(--tse-muted)]">Local:</span>
                  <button
                    type="button"
                    onClick={() => setLocalSel(null)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tse-gold)] bg-white px-3 py-1 font-semibold"
                  >
                    {localSelInfo.nome}
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <p className="mt-4 text-[12px] text-[var(--tse-muted)]">
                {formatarVotos2026(totalVisao)}{" "}
                {visao === "municipios"
                  ? "municípios"
                  : visao === "locais"
                    ? "locais de votação"
                    : "seções"}
                {termo ? " encontrados" : ""}
              </p>

              {visao === "municipios" && (
                <MunicipiosTabela
                  linhas={municipiosVisiveis.slice(0, limite)}
                  rank={rankMunicipio}
                  maxVotos={maxVotosMunicipio}
                  onSelect={(codigo) => trocarMunicipio(codigo)}
                />
              )}

              {visao === "locais" && (
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 min-[1600px]:grid-cols-3 min-[1900px]:grid-cols-4">
                  {locaisVisiveis.slice(0, limite).map((l) => (
                    <LocalCard
                      key={`${l.localId ?? "x"}-${l.municipioCodigo}-${l.zona}`}
                      local={l}
                      mostrarMunicipio={!municipio}
                      onVerSecoes={() => abrirSecoesDoLocal(l)}
                    />
                  ))}
                </div>
              )}

              {visao === "secoes" && (
                <SecoesTabela
                  linhas={secoesVisiveis.slice(0, limite)}
                  maxVotos={maxVotosSecao}
                  mostrarMunicipio={!municipio}
                />
              )}

              <TseCarregarMais
                restantes={totalVisao - limite}
                onClick={() => setLimite((n) => n + PAGE_SIZE)}
              />
            </main>
          </div>
        )}
    </TsePage>
  );
}

function MunicipiosTabela({
  linhas,
  rank,
  maxVotos,
  onSelect,
}: {
  linhas: MunicipioResumo2026[];
  rank: Map<string, number>;
  maxVotos: number;
  onSelect: (codigo: string) => void;
}) {
  return (
    <div className={`mt-3 ${tseTabela.container}`}>
      <table className={tseTabela.table}>
        <thead className={tseTabela.thead}>
          <tr>
            <th className="w-14 px-3 py-2.5 text-center">Pos.</th>
            <th className="px-3 py-2.5">Município</th>
            <th className="px-3 py-2.5">Zona</th>
            <th className="px-3 py-2.5 text-right">Locais</th>
            <th className="w-[220px] px-3 py-2.5 text-right">Votos</th>
            <th className="px-3 py-2.5 text-right">% do total</th>
            <th className="w-10 px-2 py-2.5" aria-label="Abrir" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => {
            const pos = rank.get(m.codigo) ?? 0;
            return (
              <tr
                key={m.codigo}
                onClick={() => onSelect(m.codigo)}
                className={tseTabela.trClicavel}
              >
                <td className="px-3 py-2 text-center">
                  <TseRank posicao={pos} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(m.codigo);
                    }}
                    className="text-left font-bold uppercase hover:underline"
                  >
                    {m.nome}
                  </button>
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--tse-muted)]">
                  {m.zonas.map(formatarZona2026).join(", ")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarVotos2026(m.locais)}
                </td>
                <td className="px-3 py-2">
                  <TseBarraValor valor={m.votos} max={maxVotos} formatado={formatarVotos2026(m.votos)} />
                </td>
                <td className="px-3 py-2 text-right">
                  <TsePill>{formatarPct2026(m.pctTotal)}</TsePill>
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

function LocalCard({
  local,
  mostrarMunicipio,
  onVerSecoes,
}: {
  local: LocalResumo2026;
  mostrarMunicipio: boolean;
  onVerSecoes: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-[15px] font-bold uppercase leading-tight">
          {local.local?.nome ?? "Local não identificado"}
        </p>
        <span className="shrink-0 text-[15px]">
          {formatarVotos2026(local.votos)} votos
        </span>
      </div>
      {local.local && (
        <p className="mt-1 text-[12px] text-[var(--tse-muted)]">
          {local.local.endereco}
          {local.local.bairro ? ` · ${local.local.bairro}` : ""}
        </p>
      )}
      <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
        {mostrarMunicipio ? `${nomeProprio(local.municipioNome)} · ` : ""}Zona{" "}
        {formatarZona2026(local.zona)} · {local.secoes.length}{" "}
        {local.secoes.length === 1 ? "seção" : "seções"}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {local.secoes.map((s) => (
          <span
            key={`${s.z}-${s.s}`}
            className={`rounded border px-1.5 py-0.5 text-[11px] tabular-nums ${
              s.v > 0
                ? "border-[var(--tse-green)] bg-[#F3F7E6] text-[var(--tse-text)]"
                : "border-[var(--tse-zero)] bg-[var(--tse-bar)] text-[var(--tse-muted)]"
            }`}
          >
            {formatarSecao2026(s.s)} · <strong>{s.v}</strong>
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
          {formatarPct2026(local.pctEscopo)}
        </span>
        <button type="button" onClick={onVerSecoes} className={tseLinkAcaoClass}>
          Ver seções
        </button>
      </div>
    </article>
  );
}

function SecoesTabela({
  linhas,
  maxVotos,
  mostrarMunicipio,
}: {
  linhas: SecaoDetalhe2026[];
  maxVotos: number;
  mostrarMunicipio: boolean;
}) {
  return (
    <div className={`mt-3 ${tseTabela.container}`}>
      <table className={tseTabela.table}>
        <thead className={tseTabela.thead}>
          <tr>
            {mostrarMunicipio && <th className="px-3 py-2.5">Município</th>}
            <th className="px-3 py-2.5">Zona</th>
            <th className="px-3 py-2.5">Seção</th>
            <th className="px-3 py-2.5">Local de votação</th>
            <th className="px-3 py-2.5">Bairro</th>
            <th className="w-[200px] px-3 py-2.5 text-right">Votos</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((s) => (
            <tr
              key={`${s.m}-${s.z}-${s.s}`}
              className="border-t border-[#EEEEEE]"
            >
              {mostrarMunicipio && (
                <td className="px-3 py-2 font-semibold">
                  {nomeProprio(s.municipioNome)}
                </td>
              )}
              <td className="px-3 py-2 tabular-nums">
                {formatarZona2026(s.z)}
              </td>
              <td className="px-3 py-2 font-semibold tabular-nums">
                {formatarSecao2026(s.s)}
              </td>
              <td className="px-3 py-2">{s.local?.nome ?? "—"}</td>
              <td className="px-3 py-2 text-[var(--tse-muted)]">
                {s.local?.bairro ?? "—"}
              </td>
              <td className="px-3 py-2">
                <TseBarraValor
                  valor={s.v}
                  max={maxVotos}
                  formatado={formatarVotos2026(s.v)}
                  larguraNumero="w-10"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
