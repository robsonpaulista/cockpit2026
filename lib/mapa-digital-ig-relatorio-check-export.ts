import * as XLSX from "xlsx";

import { jsPDF } from "jspdf";

import { applyPlugin, type UserOptions } from "jspdf-autotable";

import type {
  RelatorioMapaDigitalIgEscopo,
  RelatorioMapaDigitalIgTdPayload,
} from "@/lib/relatorio-mapa-digital-ig-td-types";

import { formatTempoMedioPublicacaoComentario } from "@/lib/format-tempo-medio-publicacao-comentario";

let jspdfAutotableApplied = false;

function ensureJspdfAutotable(): void {
  if (!jspdfAutotableApplied) {
    applyPlugin(jsPDF);

    jspdfAutotableApplied = true;
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>;

  lastAutoTable: false | { finalY: number };
};

function getLastTableFinalY(doc: InstanceType<typeof jsPDF>): number {
  const d = doc as JsPdfWithAutoTable;

  const lat = d.lastAutoTable;

  if (lat && typeof lat === "object" && typeof lat.finalY === "number") {
    return lat.finalY;
  }

  return 40;
}

function slugArquivoRecorte(s: string): string {
  return (
    s

      .normalize("NFD")

      .replace(/[\u0300-\u036f]/g, "")

      .replace(/[^a-zA-Z0-9]+/g, "-")

      .replace(/^-|-$/g, "")

      .slice(0, 48)

      .toLowerCase() || "recorte"
  );
}

export function nomeArquivoRelatorioIg(
  escopo: RelatorioMapaDigitalIgEscopo,
  territorioOuPi: string,
  ext: "xlsx" | "pdf",
): string {
  const d = new Date();

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  const h = String(d.getHours()).padStart(2, "0");

  const min = String(d.getMinutes()).padStart(2, "0");

  const slug =
    escopo === "pi" ? "pi-todos-tds" : slugArquivoRecorte(territorioOuPi);

  return `relatorio-check-ig-${slug}-${y}${m}${day}-${h}${min}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = filename;

  a.rel = "noopener";

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
}

export function exportRelatorioMapaDigitalIgParaXlsx(
  payload: RelatorioMapaDigitalIgTdPayload,
): Blob {
  const meta = [
    ["Recorte", payload.recorteDescricao],

    [
      "Escopo",
      payload.escopo === "pi" ? "PI inteiro (12 TDs)" : "Um território (TD)",
    ],

    ["Território (foco)", payload.territorio ?? "—"],

    ["Gerado em (ISO)", payload.geradoEm],

    ["Postagens processadas (conta)", payload.postagensProcessadas],
  ];

  const colTd = payload.escopo === "pi";

  const headResumo = [
    "#",

    ...(colTd ? (["TD"] as const) : []),

    "Município",

    "Mun.",

    "Líderes",

    "Liderados",

    "Comentários",

    "Perfis",

    "Tempo médio pub.→coment.",

    "% engajamento",

    "Classificação engajamento",
  ];

  const rowsResumo = payload.resumoPorMunicipio.map((r) => [
    r.rankIg,

    ...(colTd ? [r.territorioTd ?? ""] : []),

    r.municipio,

    1,

    r.lideres,

    r.liderados,

    r.comentarios,

    r.perfisUnicos,

    formatTempoMedioPublicacaoComentario(r.tempoMedioPostComentarioMs),

    r.pctEngajamento,

    r.classificacaoEngLabel,
  ]);

  const t = payload.totais;

  const tempoRodape =
    t.tempoPostComentarioN > 0
      ? Math.round(t.tempoPostComentarioSomaMs / t.tempoPostComentarioN)
      : null;

  rowsResumo.push([
    "",

    ...(colTd ? [""] : []),

    "Total",

    t.mun,

    t.lideres,

    t.liderados,

    t.com,

    t.perf,

    formatTempoMedioPublicacaoComentario(tempoRodape),

    "",

    "",
  ]);

  const headDet = [
    ...(colTd ? (["TD"] as const) : []),

    "Município",

    "Líder",

    "Telefone líder",

    "Liderado",

    "WhatsApp liderado",

    "Instagram liderado",

    "Status",

    "Comentários",

    "Perfis",

    "Tempo médio pub.→coment.",
  ];

  const rowsDet = payload.detalhes.map((d) => [
    ...(colTd ? [d.territorioTd ?? ""] : []),

    d.municipio,

    d.liderNome,

    d.liderTelefone,

    d.lideradoNome,

    d.lideradoWhatsapp,

    d.lideradoInstagram,

    d.lideradoStatus,

    d.comentarios,

    d.perfisUnicos,

    formatTempoMedioPublicacaoComentario(d.tempoMedioPostComentarioMs),
  ]);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Metadados");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([headResumo, ...rowsResumo]),
    "Resumo municípios",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([headDet, ...rowsDet]),
    "Líderes e liderados",
  );

  const buf = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function formatPctEng(v: number): string {
  return `${String(v).replace(".", ",")}%`;
}

function drawPageFooter(
  doc: InstanceType<typeof jsPDF>,
  pageNumber: number,
  margin: number,
): void {
  const pageW = doc.internal.pageSize.getWidth();

  const pageH = doc.internal.pageSize.getHeight();

  doc.setFontSize(7.5);

  doc.setFont("helvetica", "normal");

  doc.setTextColor(110, 118, 128);

  doc.text("Relatório confidencial — uso interno", margin, pageH - 6);

  doc.text(`Página ${String(pageNumber)}`, pageW - margin - 18, pageH - 6);

  doc.setTextColor(33, 37, 41);
}

export function exportRelatorioMapaDigitalIgParaPdf(
  payload: RelatorioMapaDigitalIgTdPayload,
): Blob {
  ensureJspdfAutotable();

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  }) as JsPdfWithAutoTable;

  const pageW = doc.internal.pageSize.getWidth();

  const margin = 12;

  const brand = [22, 63, 102] as [number, number, number];

  const t = payload.totais;

  const tempoMediaGeralMs =
    t.tempoPostComentarioN > 0
      ? Math.round(t.tempoPostComentarioSomaMs / t.tempoPostComentarioN)
      : null;

  const escopoLinha =
    payload.escopo === "pi"
      ? "Escopo: Piauí — todos os territórios de desenvolvimento (12 TDs)"
      : `Escopo: território — ${payload.territorio ?? "—"}`;

  /* Faixa superior */

  doc.setFillColor(brand[0], brand[1], brand[2]);

  doc.rect(0, 0, pageW, 22, "F");

  doc.setTextColor(255, 255, 255);

  doc.setFont("helvetica", "bold");

  doc.setFontSize(13);

  doc.text("Relatório executivo — Check Mapa Digital (Instagram)", margin, 11);

  doc.setFont("helvetica", "normal");

  doc.setFontSize(8.8);

  const subLinhas = doc.splitTextToSize(
    payload.recorteDescricao,
    pageW - margin * 2 - 4,
  );

  doc.text(subLinhas.slice(0, 2) as string[], margin, 18);

  doc.setTextColor(33, 37, 41);

  let y = 28;

  /* Bloco de contexto */

  doc.setFillColor(245, 247, 250);

  doc.rect(margin, y, pageW - margin * 2, 14, "F");

  doc.setDrawColor(220, 224, 230);

  doc.setLineWidth(0.2);

  doc.rect(margin, y, pageW - margin * 2, 14, "S");

  doc.setFontSize(8.2);

  doc.setTextColor(55, 65, 81);

  doc.text(
    `Gerado em: ${new Date(payload.geradoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })}`,
    margin + 2,
    y + 6,
  );

  doc.text(
    `Postagens processadas na conta: ${String(payload.postagensProcessadas)}`,
    margin + 2,
    y + 11,
  );

  doc.text(escopoLinha, margin + 118, y + 8.5);

  doc.setTextColor(33, 37, 41);

  y += 20;

  const tableMargins = { left: margin, right: margin, top: margin, bottom: 16 };

  /* KPIs consolidados */

  doc.autoTable({
    startY: y,

    head: [
      [
        "Municípios (linhas)",
        "Líderes",
        "Liderados",
        "Comentários",
        "Perfis únicos",
        "Tempo médio global pub.→coment.",
      ],
    ],

    body: [
      [
        String(t.mun),

        String(t.lideres),

        String(t.liderados),

        String(t.com),

        String(t.perf),

        formatTempoMedioPublicacaoComentario(tempoMediaGeralMs),
      ],
    ],

    theme: "grid",

    styles: {
      fontSize: 9.5,
      cellPadding: 2.4,
      valign: "middle",
      textColor: [33, 37, 41],
    },

    headStyles: {
      fillColor: [231, 236, 242],

      textColor: brand,

      fontStyle: "bold",

      halign: "center",

      lineColor: [200, 204, 212],

      lineWidth: 0.1,
    },

    bodyStyles: {
      fillColor: [255, 255, 255],

      fontStyle: "bold",

      halign: "center",

      lineColor: [200, 204, 212],
    },

    margin: tableMargins,
  });

  y = getLastTableFinalY(doc) + 10;

  /* Resumo por município */

  doc.setFont("helvetica", "bold");

  doc.setFontSize(11.5);

  doc.setTextColor(brand[0], brand[1], brand[2]);

  doc.text("1. Resumo por município", margin, y);

  y += 5;

  doc.setTextColor(33, 37, 41);

  const colTd = payload.escopo === "pi";

  const headResumo = colTd
    ? [
        [
          "TD",

          "#",

          "Município",

          "Líderes",

          "Liderados",

          "Coment.",

          "Perfis",

          "Tempo médio",

          "% engaj.",

          "Classificação",
        ],
      ]
    : [
        [
          "#",
          "Município",
          "Líderes",
          "Liderados",
          "Coment.",
          "Perfis",
          "Tempo médio",
          "% engaj.",
          "Classificação",
        ],
      ];

  const bodyResumo = payload.resumoPorMunicipio.map((r) =>
    colTd
      ? [
          r.territorioTd ?? "—",

          String(r.rankIg),

          r.municipio,

          String(r.lideres),

          String(r.liderados),

          String(r.comentarios),

          String(r.perfisUnicos),

          formatTempoMedioPublicacaoComentario(r.tempoMedioPostComentarioMs),

          formatPctEng(r.pctEngajamento),

          r.classificacaoEngLabel,
        ]
      : [
          String(r.rankIg),

          r.municipio,

          String(r.lideres),

          String(r.liderados),

          String(r.comentarios),

          String(r.perfisUnicos),

          formatTempoMedioPublicacaoComentario(r.tempoMedioPostComentarioMs),

          formatPctEng(r.pctEngajamento),

          r.classificacaoEngLabel,
        ],
  );

  const footResumo = colTd
    ? [
        [
          "",

          "",

          "Totais / médias",

          String(t.lideres),

          String(t.liderados),

          String(t.com),

          String(t.perf),

          formatTempoMedioPublicacaoComentario(tempoMediaGeralMs),

          "—",

          "",
        ],
      ]
    : [
        [
          "",

          "Totais / médias",

          String(t.lideres),

          String(t.liderados),

          String(t.com),

          String(t.perf),

          formatTempoMedioPublicacaoComentario(tempoMediaGeralMs),

          "—",

          "",
        ],
      ];

  const classifColIndex = colTd ? 9 : 8;

  doc.autoTable({
    startY: y,

    head: headResumo,

    body: bodyResumo,

    foot: footResumo,

    showFoot: "lastPage",

    theme: "striped",

    styles: {
      fontSize: 7.8,

      cellPadding: 1.6,

      valign: "middle",

      lineColor: [210, 214, 220],

      lineWidth: 0.1,

      overflow: "linebreak",
    },

    headStyles: {
      fillColor: brand,

      textColor: [255, 255, 255],

      fontStyle: "bold",

      halign: "center",
    },

    footStyles: {
      fillColor: [231, 236, 242],

      textColor: [33, 37, 41],

      fontStyle: "bold",
    },

    alternateRowStyles: { fillColor: [252, 253, 255] },

    columnStyles: colTd
      ? {
          0: { cellWidth: 32, halign: "left" },

          1: { cellWidth: 8, halign: "center" },

          2: { cellWidth: 38, halign: "left" },

          3: { halign: "right", cellWidth: 14 },

          4: { halign: "right", cellWidth: 16 },

          5: { halign: "right", cellWidth: 14 },

          6: { halign: "right", cellWidth: 12 },

          7: { halign: "center", cellWidth: 26 },

          8: { halign: "right", cellWidth: 16 },

          9: { halign: "left", cellWidth: 36 },
        }
      : {
          0: { cellWidth: 10, halign: "center" },

          1: { cellWidth: 44, halign: "left" },

          2: { halign: "right", cellWidth: 16 },

          3: { halign: "right", cellWidth: 18 },

          4: { halign: "right", cellWidth: 16 },

          5: { halign: "right", cellWidth: 14 },

          6: { halign: "center", cellWidth: 28 },

          7: { halign: "right", cellWidth: 18 },

          8: { halign: "left", cellWidth: 44 },
        },

    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === classifColIndex) {
        const txt = data.cell.text.join(" ");

        if (txt.includes("Alto")) {
          data.cell.styles.textColor = [21, 128, 61];
        } else if (txt.includes("Médio") || txt.includes("Medio")) {
          data.cell.styles.textColor = [180, 120, 0];
        } else if (txt.includes("Baixo")) {
          data.cell.styles.textColor = [180, 60, 45];
        }
      }
    },

    margin: tableMargins,
  });

  y = getLastTableFinalY(doc) + 10;

  /* Detalhe líderes / liderados */

  doc.setFont("helvetica", "bold");

  doc.setFontSize(11.5);

  doc.setTextColor(brand[0], brand[1], brand[2]);

  doc.text("2. Líderes e liderados (detalhamento)", margin, y);

  y += 5;

  doc.setTextColor(33, 37, 41);

  const headDet = colTd
    ? [
        [
          "TD",

          "Município",

          "Líder",

          "Tel. líder",

          "Liderado",

          "WhatsApp",

          "Instagram",

          "Status",

          "Com.",

          "Pf.",

          "Tempo médio",
        ],
      ]
    : [
        [
          "Município",
          "Líder",
          "Tel. líder",
          "Liderado",
          "WhatsApp",
          "Instagram",
          "Status",
          "Com.",
          "Pf.",
          "Tempo médio",
        ],
      ];

  const bodyDet = payload.detalhes.map((d) =>
    colTd
      ? [
          d.territorioTd ?? "—",

          d.municipio,

          d.liderNome,

          d.liderTelefone,

          d.lideradoNome || "—",

          d.lideradoWhatsapp,

          d.lideradoInstagram,

          d.lideradoStatus,

          String(d.comentarios),

          String(d.perfisUnicos),

          formatTempoMedioPublicacaoComentario(d.tempoMedioPostComentarioMs),
        ]
      : [
          d.municipio,

          d.liderNome,

          d.liderTelefone,

          d.lideradoNome || "—",

          d.lideradoWhatsapp,

          d.lideradoInstagram,

          d.lideradoStatus,

          String(d.comentarios),

          String(d.perfisUnicos),

          formatTempoMedioPublicacaoComentario(d.tempoMedioPostComentarioMs),
        ],
  );

  doc.autoTable({
    startY: y,

    head: headDet,

    body: bodyDet,

    showHead: "everyPage",

    theme: "grid",

    styles: {
      fontSize: 6.2,

      cellPadding: 1,

      valign: "middle",

      lineColor: [210, 214, 220],

      textColor: [33, 37, 41],

      overflow: "ellipsize",
    },

    headStyles: {
      fillColor: brand,

      textColor: [255, 255, 255],

      fontStyle: "bold",

      fontSize: 6.4,

      halign: "center",
    },

    columnStyles: colTd
      ? {
          0: { cellWidth: 22, halign: "left" },

          1: { cellWidth: 22, halign: "left" },

          2: { cellWidth: 22, halign: "left" },

          3: { cellWidth: 18, halign: "left" },

          4: { cellWidth: 22, halign: "left" },

          5: { cellWidth: 18, halign: "left" },

          6: { cellWidth: 22, halign: "left" },

          7: { cellWidth: 16, halign: "left" },

          8: { cellWidth: 9, halign: "right" },

          9: { cellWidth: 9, halign: "right" },

          10: { cellWidth: 20, halign: "center" },
        }
      : {
          0: { cellWidth: 26, halign: "left" },

          1: { cellWidth: 24, halign: "left" },

          2: { cellWidth: 20, halign: "left" },

          3: { cellWidth: 26, halign: "left" },

          4: { cellWidth: 20, halign: "left" },

          5: { cellWidth: 24, halign: "left" },

          6: { cellWidth: 18, halign: "left" },

          7: { cellWidth: 10, halign: "right" },

          8: { cellWidth: 10, halign: "right" },

          9: { cellWidth: 22, halign: "center" },
        },

    margin: tableMargins,
  });

  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);

    drawPageFooter(doc, i, margin);
  }

  return doc.output("blob");
}
