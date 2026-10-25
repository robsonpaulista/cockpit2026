import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type RowInput } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatarVotos2026, type ResultadoSecao2026Meta } from "@/lib/resultado-secao-2026";
import {
  COR,
  MARGEM,
  desenharCabecalho,
  desenharFaixaSuperior,
  numerarPaginas,
  slugEscopo,
} from "./pdf-base-2026";

export type CelulaQuadroExport2026 =
  | { tipo: "vazio" }
  | { tipo: "oculta" }
  | { tipo: "voto"; nome: string; partido: string; situacao: string; votos: number; destaque: boolean };

export type LinhaQuadroExport2026 = {
  nivel: "estado" | "territorio" | "municipio";
  nome: string;
  territorio: string;
  detalhe: string;
  /** Eleitorado da linha; null quando o município não está na base. */
  eleitores: number | null;
  /** Soma dos votos nominais de todos os candidatos do cargo. */
  votantes: number | null;
  foco: { posicao: number; votos: number; pctEleitorado: number | null; pctVotacao: number | null } | null;
  celulas: CelulaQuadroExport2026[];
  outros: number;
  total: number;
};

export type OpcoesQuadroExport2026 = {
  meta: ResultadoSecao2026Meta;
  fonteDados: string;
  cargo: string;
  agrupamento: "cidade" | "territorio";
  situacao: string;
  busca: string;
  foco: string;
  colocacoes: string[];
  linhas: LinhaQuadroExport2026[];
};

const FUNDO_ESTADO: [number, number, number] = [251, 250, 243];
const FUNDO_TERRITORIO: [number, number, number] = [250, 250, 247];

function titulo(o: OpcoesQuadroExport2026): string {
  return `Quadro por ${o.agrupamento === "territorio" ? "território" : "município"}`;
}

function descricao(o: OpcoesQuadroExport2026): string {
  const partes = [
    o.cargo,
    `Situação: ${o.situacao}`,
    `${o.colocacoes.length} colocações`,
    o.foco ? `Candidato: ${o.foco}` : "",
    o.busca ? `Busca: ${o.busca}` : "",
  ];
  return partes.filter(Boolean).join(" · ");
}

function nomeArquivo(o: OpcoesQuadroExport2026, ext: "pdf" | "xlsx"): string {
  const dia = new Date().toISOString().slice(0, 10);
  const base = slugEscopo(`${titulo(o)} ${o.cargo} ${o.situacao}`) || "quadro-municipios-2026";
  return `${base}-${dia}.${ext}`;
}

function textoCelula(c: CelulaQuadroExport2026): string {
  if (c.tipo === "oculta") return "";
  if (c.tipo === "vazio") return "—";
  const partido = c.partido ? ` (${c.partido})` : "";
  const situacao = c.situacao ? `${c.situacao} · ` : "";
  return `${c.nome}${partido}\n${situacao}${formatarVotos2026(c.votos)}`;
}

function textoPct(pct: number | null, rotulo: string): string {
  if (pct == null) return "";
  return `\n${pct.toFixed(1).replace(".", ",")}% ${rotulo}`;
}

function textoFoco(foco: LinhaQuadroExport2026["foco"]): string {
  if (!foco) return "";
  const pcts = `${textoPct(foco.pctEleitorado, "do eleitorado")}${textoPct(foco.pctVotacao, "da votação")}`;
  if (foco.posicao <= 0) return `sem votos${pcts}`;
  return `${foco.posicao}º\n${formatarVotos2026(foco.votos)}${pcts}`;
}

function textoBaseCidade(l: LinhaQuadroExport2026): string {
  if (l.nivel !== "municipio") return "";
  const eleitores = l.eleitores == null ? "—" : formatarVotos2026(l.eleitores);
  const votantes = l.votantes == null ? "—" : formatarVotos2026(l.votantes);
  return `\n${eleitores} eleitores · ${votantes} votantes`;
}

function nomeLinha(l: LinhaQuadroExport2026, agrupado: boolean): string {
  const nome = l.nome.toUpperCase();
  const base = textoBaseCidade(l);
  if (l.nivel === "territorio" && l.detalhe) return `${nome}  ·  ${l.detalhe}`;
  if (l.nivel === "municipio" && agrupado) return `    ${nome}${base}`;
  return `${nome}${base}`;
}

export function exportarQuadroPdf2026(o: OpcoesQuadroExport2026): void {
  const n = o.colocacoes.length;
  const formato = n > 10 ? "a3" : "a4";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: formato, compress: true });
  const fonte = n > 14 ? 5.5 : n > 8 ? 6.5 : 8;
  const comFoco = o.linhas.some((l) => l.foco != null);
  const agrupado = o.agrupamento === "territorio";
  const y = desenharCabecalho(doc, {
    titulo: titulo(o),
    descricao: descricao(o),
    fonteDados: o.fonteDados,
    meta: o.meta,
  });

  const head: RowInput = [
    { content: agrupado ? "Território / Município" : "Município" },
    ...(comFoco ? [{ content: o.foco || "Candidato" }] : []),
    ...o.colocacoes.map((rotulo) => ({ content: rotulo })),
    { content: "Outros", styles: { halign: "right" as const } },
    { content: "Total", styles: { halign: "right" as const } },
  ];

  const body: RowInput[] = o.linhas.map((l) => {
    const fundo = l.nivel === "estado" ? FUNDO_ESTADO : l.nivel === "territorio" ? FUNDO_TERRITORIO : COR.branco;
    const negrito = l.nivel !== "municipio";
    const base = { fillColor: fundo, fontStyle: negrito ? ("bold" as const) : ("normal" as const) };
    const celulas: CellDef[] = [
      { content: nomeLinha(l, agrupado), styles: base },
      ...(comFoco
        ? [{ content: textoFoco(l.foco), styles: { ...base, halign: "right" as const, fillColor: COR.yellowSoft } }]
        : []),
      ...l.celulas.map((c): CellDef => ({
        content: textoCelula(c),
        styles: {
          ...base,
          fillColor: c.tipo === "voto" && c.destaque ? COR.yellowSoft : fundo,
          textColor: c.tipo === "vazio" ? COR.muted : COR.text,
        },
      })),
      { content: formatarVotos2026(l.outros), styles: { ...base, halign: "right" } },
      { content: formatarVotos2026(l.total), styles: { ...base, halign: "right" } },
    ];
    return celulas;
  });

  autoTable(doc, {
    startY: y,
    margin: { top: 12, left: MARGEM, right: MARGEM, bottom: 10 },
    head: [head],
    body,
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: fonte,
      cellPadding: 1,
      textColor: COR.text,
      lineColor: COR.trilho,
      lineWidth: 0.1,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COR.bar,
      textColor: COR.muted,
      fontStyle: "bold",
      fontSize: Math.max(5.5, fonte - 0.5),
    },
    columnStyles: {
      0: { cellWidth: agrupado ? 42 : 36 },
    },
    didDrawPage: () => desenharFaixaSuperior(doc, o.fonteDados, o.meta),
  });

  numerarPaginas(doc, `${titulo(o)} · ${o.cargo}`);
  doc.save(nomeArquivo(o, "pdf"));
}

function valoresCelula(c: CelulaQuadroExport2026): [string, string, string, number | ""] {
  if (c.tipo !== "voto") return ["", "", "", ""];
  return [c.nome, c.partido, c.situacao, c.votos];
}

export function exportarQuadroXlsx2026(o: OpcoesQuadroExport2026): void {
  const comFoco = o.linhas.some((l) => l.foco != null);
  const cabecalho = [
    "Nível",
    "Território",
    "Município",
    "Eleitores",
    "Votantes",
    ...(comFoco ? ["Posição do candidato", "Votos do candidato", "% do eleitorado", "% da votação"] : []),
    ...o.colocacoes.flatMap((rotulo) => [rotulo, `Partido ${rotulo}`, `Situação ${rotulo}`, `Votos ${rotulo}`]),
    "Outros",
    "Total",
  ];
  const nivelRotulo = (nivel: LinhaQuadroExport2026["nivel"]): string =>
    nivel === "estado" ? "Estado" : nivel === "territorio" ? "Território" : "Município";

  const dados = o.linhas.map((l) => [
    nivelRotulo(l.nivel),
    l.nivel === "territorio" ? `${l.nome}${l.detalhe ? ` (${l.detalhe})` : ""}` : l.territorio,
    l.nivel === "territorio" ? "" : l.nome,
    l.nivel === "municipio" ? (l.eleitores ?? "") : "",
    l.nivel === "municipio" ? (l.votantes ?? "") : "",
    ...(comFoco
      ? [
          l.foco && l.foco.posicao > 0 ? l.foco.posicao : "",
          l.foco && l.foco.posicao > 0 ? l.foco.votos : "",
          l.foco?.pctEleitorado == null ? "" : Math.round(l.foco.pctEleitorado * 10) / 10,
          l.foco?.pctVotacao == null ? "" : Math.round(l.foco.pctVotacao * 10) / 10,
        ]
      : []),
    ...l.celulas.flatMap((c) => valoresCelula(c)),
    l.outros,
    l.total,
  ]);

  const planilha = XLSX.utils.aoa_to_sheet([
    [titulo(o)],
    [descricao(o)],
    [`Gerado em ${new Date().toLocaleString("pt-BR")}`],
    [],
    cabecalho,
    ...dados,
  ]);
  planilha["!cols"] = cabecalho.map((rotulo, i) => ({ wch: i < 3 ? 28 : Math.max(14, rotulo.length + 2) }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Quadro");
  XLSX.writeFile(livro, nomeArquivo(o, "xlsx"));
}
