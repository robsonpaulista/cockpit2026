#!/usr/bin/env python3
"""Gera PDF de documentação técnica de apresentação — Cockpit 2026."""

from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Cockpit-2026-Documentacao-Tecnica.pdf"

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# Azul institucional do Cockpit
PRIMARY = (30, 78, 216)
DARK = (15, 23, 42)
MUTED = (100, 116, 139)
LINE = (229, 231, 235)
SOFT = (234, 241, 255)


class DocPDF(FPDF):
    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("ArialDoc", "B", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "Cockpit 2026 — Documentação Técnica", align="L")
        self.ln(4)
        self.set_draw_color(*LINE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("ArialDoc", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, f"{self.page_no()}", align="C")


def section_title(pdf: DocPDF, text: str) -> None:
    pdf.ln(2)
    pdf.set_font("ArialDoc", "B", 13)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*PRIMARY)
    pdf.set_line_width(0.4)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.l_margin + 40, y)
    pdf.ln(4)


def body(pdf: DocPDF, text: str) -> None:
    pdf.set_font("ArialDoc", "", 10)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(0, 5.2, text)
    pdf.ln(2)


def bullet(pdf: DocPDF, title: str, desc: str) -> None:
    pdf.set_font("ArialDoc", "B", 10)
    pdf.set_text_color(*DARK)
    pdf.cell(4, 5.2, "•")
    pdf.cell(0, 5.2, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(pdf.l_margin + 4)
    pdf.set_font("ArialDoc", "", 9.5)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(0, 4.8, desc)
    pdf.ln(1.5)


def subhead(pdf: DocPDF, text: str) -> None:
    pdf.ln(1)
    pdf.set_font("ArialDoc", "B", 10.5)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)


def kv_row(pdf: DocPDF, key: str, value: str) -> None:
    x0 = pdf.l_margin
    w_key = 48
    w_val = pdf.w - pdf.r_margin - x0 - w_key
    y0 = pdf.get_y()
    pdf.set_xy(x0, y0)
    pdf.set_font("ArialDoc", "B", 9)
    pdf.set_text_color(*DARK)
    pdf.cell(w_key, 5, key)
    pdf.set_xy(x0 + w_key, y0)
    pdf.set_font("ArialDoc", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(w_val, 5, value)
    pdf.set_x(x0)


def build() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)

    pdf = DocPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("ArialDoc", "", FONT_REG)
    pdf.add_font("ArialDoc", "B", FONT_BOLD)
    pdf.set_margins(18, 16, 18)

    # --- Capa ---
    pdf.add_page()
    pdf.ln(36)
    pdf.set_fill_color(*SOFT)
    pdf.rect(18, 40, 174, 52, style="F")
    pdf.set_xy(18, 48)
    pdf.set_font("ArialDoc", "B", 11)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(174, 7, "DOCUMENTAÇÃO TÉCNICA", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("ArialDoc", "B", 26)
    pdf.set_text_color(*DARK)
    pdf.cell(174, 12, "Cockpit 2026", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("ArialDoc", "", 12)
    pdf.set_text_color(*MUTED)
    pdf.cell(
        174,
        8,
        "Sistema Operacional de Gestão de Campanha Eleitoral",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(28)
    pdf.set_font("ArialDoc", "", 10)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(
        0,
        5.5,
        "Material de referência para apresentação das funcionalidades do sistema: "
        "módulos, capacidades operacionais e integrações.",
    )
    pdf.ln(8)
    kv_row(pdf, "Versão do doc:", "1.0")
    kv_row(pdf, "Escopo:", "Visão funcional dos módulos principais")
    kv_row(pdf, "Público:", "Apresentação técnica / alinhamento de produto")

    # --- Visão geral ---
    pdf.add_page()
    section_title(pdf, "1. Visão geral")
    body(
        pdf,
        "O Cockpit 2026 é uma aplicação web que centraliza a operação de campanha "
        "eleitoral em um único painel: território e campo, comunicação digital, "
        "monitoramento de mídia, pesquisa eleitoral, mobilização, WhatsApp, "
        "jurídico e gestão institucional do mandato.",
    )
    body(
        pdf,
        "A arquitetura funcional organiza-se em cinco áreas de menu: Painel, "
        "Território, Operação, Institucional e Administração. O acesso é controlado "
        "por perfil (candidato, coordenação, comunicação, articulação, jurídico, BI).",
    )

    subhead(pdf, "Capacidades transversais")
    bullet(pdf, "IA Cockpit", "Assistente por voz e chat para briefing, consultas e navegação.")
    bullet(pdf, "Briefing operacional", "Consolidação de prioridades, visitas e territórios frios.")
    bullet(pdf, "Permissões", "Controle de usuários e histórico de uso da IA (Log System).")

    # --- Painel ---
    section_title(pdf, "2. Painel")
    bullet(
        pdf,
        "Visão Geral (/dashboard)",
        "Entrada do comando central; status do dia, alertas e shell do assistente.",
    )
    bullet(
        pdf,
        "Resumo Operacional (/dashboard/resumo-operacional)",
        "Briefing consolidado em janelas de 7, 14 ou 30 dias: visitas, cidades "
        "prioritárias e territórios frios. Suporta cópia/envio via WhatsApp.",
    )
    bullet(
        pdf,
        "Estratégia — Narrativas (/dashboard/narrativas)",
        "Biblioteca de mensagens oficiais, bandeiras, fases da campanha e "
        "diretrizes de posicionamento.",
    )

    # --- Território ---
    section_title(pdf, "3. Território e campo")
    bullet(
        pdf,
        "Território & Campo (/dashboard/territorio)",
        "CRM político territorial: lideranças, expectativa de votos, demandas, "
        "KPIs e registro de visitas com check-in.",
    )
    bullet(
        pdf,
        "Mapa Diagnóstico — IPT (/dashboard/territorio/ipt)",
        "Mapa operacional por município com missões (expectativa, campo, "
        "pesquisa, digital, obras).",
    )
    bullet(
        pdf,
        "Agenda (/dashboard/agenda)",
        "Compromissos com integração Google Calendar; registro de presença.",
    )
    bullet(
        pdf,
        "Ficha de Atendimento (/dashboard/ficha-atendimento)",
        "Tetos MAC/PAP (SUAS) e emendas por município.",
    )

    # --- Inteligência ---
    section_title(pdf, "4. Inteligência eleitoral")
    bullet(
        pdf,
        "Pesquisa & Relato (/dashboard/pesquisa)",
        "Cadastro de pesquisas, séries estimulada/espontânea, tendências e exportação.",
    )
    bullet(
        pdf,
        "Chapas Federal / Estadual",
        "Simulador de projeção de vagas e composição partidária.",
    )
    bullet(
        pdf,
        "Resumo Eleições",
        "Visão por cidade (expectativa, lideranças, pesquisas), votação por seção "
        "e histórico federal.",
    )
    bullet(
        pdf,
        "Gestão de Pesquisas + App Pesquisador",
        "Operação de coleta em campo e configuração da pesquisa.",
    )

    # --- Comunicação ---
    section_title(pdf, "5. Comunicação e conteúdo")
    bullet(
        pdf,
        "Redes Sociais — Instagram (/dashboard/conteudo/redes)",
        "Métricas de posts, engajamento, evolução de seguidores e performance por indicador.",
    )
    bullet(
        pdf,
        "Pipeline de conteúdo (/dashboard/conteudo)",
        "Fluxo obras → agenda → cards → referências → análise (cidade, território, tipo).",
    )
    bullet(
        pdf,
        "Fluxo Digital (/dashboard/fluxo-digital)",
        "Do planejamento da visita à produção de peças (stories/cards/reels) e aprovação.",
    )

    # --- Radar ---
    section_title(pdf, "6. Radar e monitoramento")
    bullet(
        pdf,
        "Monitoramento (/dashboard/noticias/monitoramento)",
        "Panorama de mídia: Google Alerts, News/Videos, Trends, YouTube, Instagram "
        "e Meta Ads Library.",
    )
    bullet(
        pdf,
        "Radar 224 (/dashboard/radar-224)",
        "Cobertura noticiosa municipal e catálogo de fontes.",
    )

    # --- Operação ---
    section_title(pdf, "7. Mobilização, WhatsApp e materiais")
    bullet(
        pdf,
        "Mobilização",
        "Captação de base, configuração de coordenadores e mapa digital Instagram "
        "por território.",
    )
    bullet(
        pdf,
        "WhatsApp (/dashboard/whatsapp)",
        "Contatos, fila de disparos e envio de briefings operacionais.",
    )
    bullet(
        pdf,
        "Gestão de Material (/dashboard/material-campanha)",
        "Estoque (panfletos, adesivos etc.), pedidos em fluxo Kanban e solicitações.",
    )
    bullet(
        pdf,
        "Operação & Equipe (/dashboard/operacao)",
        "Coordenadores e tarefas internas da campanha.",
    )

    # --- Institucional ---
    section_title(pdf, "8. Institucional e mandato")
    bullet(
        pdf,
        "Jurídico (/dashboard/juridico)",
        "Processos, prazos e acompanhamento.",
    )
    bullet(
        pdf,
        "Emendas / Obras / Proposições / SEI",
        "Emendas parlamentares; obras com andamento SEI; proposições na Câmara; "
        "consulta SEI.",
    )

    # --- Integrações ---
    # Evita quebra órfã: se sobrar pouco espaço, começa seção em nova página
    if pdf.get_y() > 220:
        pdf.add_page()
    section_title(pdf, "9. Integrações")
    body(
        pdf,
        "Fontes externas consumidas pelos módulos:",
    )
    for title, desc in [
        ("Instagram / Meta", "Métricas, posts, engajamento, Ads Library"),
        ("WhatsApp", "Disparos, contatos, briefings, pedidos de material"),
        ("Google Calendar", "Agenda e presença"),
        ("Google Sheets", "Base territorial (lideranças, expectativa)"),
        ("Google Alerts / News / Trends", "Radar de mídia e menções"),
        ("YouTube", "Radar de vídeos e menções"),
        ("SEI", "Andamento de obras e processos"),
        ("IBGE", "Dados demográficos e territoriais"),
        ("Canva", "Produção de artes no fluxo digital"),
        ("IA (LLM / voz)", "Assistente de briefing e análise"),
    ]:
        bullet(pdf, title, desc)

    # --- Estrutura ---
    if pdf.get_y() > 230:
        pdf.add_page()
    section_title(pdf, "10. Estrutura de navegação")
    body(pdf, "Menu principal agrupado por seção operacional:")
    for title, desc in [
        ("Painel", "Visão, Resumo, Estratégia, IA Cockpit"),
        ("Território", "Território & Campo, IPT, Agenda, Ficha, Pesquisas, Chapas, Eleições"),
        ("Operação", "Mobilização, WhatsApp, Fluxo Digital, Redes, Radar, Material"),
        ("Institucional", "Jurídico, Emendas, Obras, Proposições, SEI"),
        ("Administração", "Gestão de pesquisas, Usuários, Log System"),
    ]:
        bullet(pdf, title, desc)

    pdf.ln(6)
    pdf.set_font("ArialDoc", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        0,
        4.8,
        "Documento gerado a partir da estrutura funcional do produto (rotas de "
        "dashboard, módulos de menu e integrações ativas). Uso interno para "
        "apresentação técnica.",
    )

    pdf.output(str(OUT))
    return OUT


if __name__ == "__main__":
    path = build()
    print(path)
