# Biblioteca de Comunicação (Cockpit ↔ Canva)

O Canva é só o **repositório visual**.  
A inteligência (quando usar, objetivo, slots, versão ativa) fica no **Cockpit**.

## Pastas no Canva = por objetivo

```text
📁 Prestação de Contas
📁 Obras
📁 Agenda
📁 Bandeiras
📁 Institucional
📁 Mobilização
```

Não organize por Story/Feed. Organize pelo **objetivo**.

Exemplo dentro de **Obras**:

```text
Cockpit | OBRA_IMPACTO | V1 | Feed
Cockpit | OBRA_IMPACTO | V1 | Story
Cockpit | OBRA_IMPACTO | V1 | Reels
Cockpit | OBRA_IMPACTO | V1 | WhatsApp
Cockpit | OBRA_IMPACTO | V2 | Feed   ← teste A/B
```

## Convenção de nome

```text
Cockpit | CATEGORIA | VERSAO | Formato
```

O Cockpit pede a **categoria** (`OBRA_IMPACTO`).  
A **versão ativa** é a marcada `padrao=true` no catálogo (`TPL001`…).

## Catálogo (código TPL)

| Código | Categoria | Versão | Formato | Canva |
|--------|-----------|--------|---------|-------|
| TPL001 | OBRA_IMPACTO | V1 | Feed | URL |
| TPL002 | OBRA_IMPACTO | V1 | Story | URL |
| TPL003 | OBRA_IMPACTO | V1 | Reels | URL |
| TPL004 | CIDADE_BENEFICIADA | V1 | Feed | URL |
| … | … | … | … | … |

SQL: `database/create-comunicacao-biblioteca.sql`

## Slots (sempre disponíveis; vazios ok)

cidade, titulo, subtitulo, descricao, numero, metragem, rua, data, parceiro, logo, foto_principal, foto_secundaria, cta, qr_code, hashtag, assinatura, legenda

## Categorias (linguagem oficial)

| Código | Pasta Canva | Uso |
|--------|-------------|-----|
| OBRA_IMPACTO | Obras | Obra entregue / impacto |
| CIDADE_BENEFICIADA | Obras | Cidade contemplada |
| PRESTACAO_CONTAS | Prestação de Contas | Resultado institucional |
| AGENDA_CHEGADA | Agenda | Aviso de visita |
| FRASE_LOCAL | Mobilização | Story humanizado |
| ANTES_DEPOIS | Obras | Comparativo |
| AGRADECIMENTO | Agenda | Pós-evento |
| DADO_ESTATISTICO | Institucional | KPI |
| PESQUISA | Institucional | Pesquisa |
| HOSPITAL_AMOR / ECA_DIGITAL / CAUSA_ANIMAL | Bandeiras | Bandeiras |

## O que fazer agora no Canva

1. Criar as **6 pastas** por objetivo.  
2. Em **Obras** / **Agenda** / **Mobilização**, criar os designs V1 com os nomes `Cockpit | …`.  
3. Rodar o SQL da biblioteca no Supabase.  
4. Colar as URLs dos designs em `comunicacao_templates.canva_design_url`.  
5. No Claude: `listar_templates_canva` → `obter_brief_producao` → duplicar TPL → `registrar_arte_gerada`.

## Tools MCP

- `listar_templates_canva` — biblioteca completa  
- `obter_brief_producao` — resolve TPL + slots + pasta  
- `registrar_arte_gerada` — fecha no Cockpit  
