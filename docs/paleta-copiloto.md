# Paleta oficial — Cockpit 2026 (padrão Copiloto)

Fonte canônica no código: [`app/design-tokens-copiloto.css`](../app/design-tokens-copiloto.css).

A paleta institucional do **War Room → Acionar Copiloto** é o padrão visual de **toda** a aplicação. Telas, sidebars, accents e temas derivados devem alinhar a estes tokens. Não criar novos “laranjas de marca” (`#f04b23`, `#e0a030`, etc.).

## Core

| Nome | Hex | Token CSS | Uso |
|------|-----|-----------|-----|
| Petróleo | `#022B3A` | `--palette-petrol` | Texto forte, sidebar escura |
| Azul institucional | `#005B8F` | `--palette-inst` | Links, primário de UI, dados |
| Accent coral | `#F04B23` | `--palette-accent` | CTA / alerta pontual (não inundar) |
| Fundo | `#F5F6F8` | `--palette-bg` | Canvas da página |
| Card | `#FFFFFF` | `--palette-card` | Superfícies |
| Auxiliar | `#6B7280` | `--palette-aux` | Texto secundário / muted |

## Neutros de apoio

| Hex | Token | Uso |
|-----|-------|-----|
| `#E6EAF0` | `--palette-chart-bg` | Tracks, fundos suaves |
| `#CDD5DF` | `--palette-neutral-bar` | Bordas fortes |
| `#E5E7EB` | `--palette-divider` | Divisores |
| `#DDEAF3` | `--palette-inst-soft` | Tint azul |
| `#FFF0B8` / `#F5C542` | soft / strong yellow | Aviso |
| `#D64545` | `--palette-reject` | Erro / crítico |

## Logomarca

Na sidebar escura (e no padrão Copiloto):

| Parte | Cor |
|-------|-----|
| **COCKPIT** | Branco `#FFFFFF` |
| **2026** | Accent coral `#F04B23` |

Não usar `#f04b23` (laranja legado) no wordmark.

## Regras de uso

1. **Accent coral com parcimônia** — botão primário crítico, badge de alerta, estado ativo pontual. Preferir azul institucional para ações recorrentes (Atualizar, filtros, toggles).
2. **Sidebar** — fundo `--palette-petrol` (`#022B3A`). Header e corpo da sidebar **mesma cor**.
3. **Página clara** — fundo `--palette-bg`, cards `--palette-card`, texto `--palette-petrol` / `--palette-aux`.
4. **Hardcodes** — proibido novo `#f04b23` / `#c43d1c` / `#e0a030` como marca. Usar `var(--palette-*)` ou `var(--brand-accent)`.
5. **Temas** (`data-theme`) — remapear accents e fundos para a paleta Copiloto; não reintroduzir ouro/âmbar legado.

## Aliases de compatibilidade

Já expostos no arquivo de tokens:

- `--wr-*` (War Room / IPT)
- `--brand-accent`, `--cockpit-gold`, `--mon-brand*`

War Room Copiloto e IPT devem **consumir** estes tokens, não redefinir hex divergentes.
