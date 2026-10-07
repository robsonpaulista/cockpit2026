# Paleta oficial — Cockpit 2026 (padrão Copiloto)

Fonte canônica no código: [`app/design-tokens-copiloto.css`](../app/design-tokens-copiloto.css).

A paleta institucional do **War Room → Acionar Copiloto** é o padrão visual de **toda** a aplicação. Telas, sidebars, accents e temas derivados devem alinhar a estes tokens. Não criar novos “laranjas de marca” (`#f04b23`, `#e0a030`, etc.).

## Core

| Nome | Hex | Token CSS | Uso |
|------|-----|-----------|-----|
| Petróleo | `#022B3A` | `--palette-petrol` | Texto forte |
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

## Sidebar e header — padrão TSE (amarelo)

A sidebar e o header seguem o portal de resultados do TSE (topo amarelo preenchido, corpo
branco). Código: [`app/sidebar-tse.css`](../app/sidebar-tse.css),
ancorado em `#cockpit-sidebar` / `#cockpit-topbar` (prevalece sobre os temas legados).

| Elemento | Hex | Variável |
|----------|-----|----------|
| Fundo do corpo | `#FFFFFF` | `--sb-bg` |
| Topo (zona da logo + header `#cockpit-topbar`), altura 52px | `#EBB402` | `--cockpit-top-bg` / `--cockpit-top-h` |
| Divisória do topo | `#D9A502` | `--cockpit-top-line` |
| Texto no topo | `#FFFFFF` | — |
| Barra do item ativo, avatar | `#EBB402` | `--sb-yellow` |
| Ícone do item ativo e no hover | `#B8960B` | `--sb-gold-text` |
| Fundo do item ativo | `#FFF8D6` | `--sb-active-bg` |
| Texto do item ativo | `#333333` | `--sb-active-text` |
| Hover (fundo) | `#F4F4F2` | `--sb-hover` |
| Texto | `#333333` | `--sb-text` |
| Texto secundário / ícones | `#717171` | `--sb-muted` |
| Divisores | `#E6E6E3` | `--sb-line` |

Item ativo é marcado no DOM por `aria-current="page"` (links) ou `data-active="true"`
(botão de submenu com filho ativo) — não por classes de cor.

## Logomarca (topo amarelo da sidebar e do header)

| Parte | Cor |
|-------|-----|
| **COCKPIT** | Branco `#FFFFFF` |
| **X** | Grafite `#333333` (`--cockpit-top-x`) |

O título do
header (`#cockpit-topbar`) usa a mesma fonte da logomarca: Michroma, peso 400, caixa alta, 15px.

## Páginas no padrão TSE (migração em andamento)

As telas estão sendo migradas para o visual do portal de resultados do TSE, já usado em
`/dashboard/resumo-eleicoes/resultado-2026`. Páginas migradas: Resultado 2026, Território (Base, Visitas, Lideranças, Demandas), Instagram Pessoal (`/dashboard/conteudo/redes`), Agenda (`/dashboard/agenda`), Radar Eleitoral (`/dashboard/noticias/monitoramento`, peças compartilhadas em `components/monitoramento/radar-ui.tsx`) e Atendimento (`/dashboard/resumo-eleicoes`, visão da cidade em tela única; quadros em `components/resumo-eleicoes/atendimento-quadros.tsx`) e Pesquisas (`/dashboard/pesquisa`: Tendência temporal, Pesquisas cadastradas e Gerar público; chamadas em `lib/services/pesquisa-client.ts`) e Emendas (`/dashboard/emendas`, também usado no Copiloto; formulário em `components/emendas/emenda-modal.tsx`). Modais usam `TseModal`, que é renderizado no `body` para escapar do `transform` do `PageTransition`.

- Tokens: `TSE_TOKENS` em `components/tse/tse-tokens.ts` (variáveis `--tse-*`), aplicados na raiz por `TsePage`.
- Componentes: `components/tse/tse-ui.tsx`. Inclui a casca da página, a barra de filtros, os selects (grande e pílula amarela), as abas, os cards ("Dados Gerais"), a tabela, a posição, as barras de votos, as pílulas de %, os botões cinza, os links de ação, o menu de exportação e os estados de carregando, vazio e erro.
- Cores: fundo `#F4F4F2`, cards brancos sem borda (`shadow-sm`), amarelo `#EBB402` / `#F1C300` em filtros, abas e posições, verde `#9EB737` para dados apurados, oliva `#6A8421` em links e ações, texto `#333333`, secundário `#717171`.
- Tabelas TSE levam `data-tse-tabela` para escapar das regras globais de tabela dos temas legados.

### Home pública (`/`, `/login`, `/preview-home`)

`components/home/cockpit-home.tsx` + `cockpit-home.css`. A tela é toda em amarelo `#EBB402` e a logomarca COCKPIT X (Michroma) surge com animação: as letras sobem por máscara, o X grafite gira até o lugar, e a linha de horizonte se desenha. Atrás dela há um mostrador girando devagar, uma grade suave e um brilho diagonal periódico. O botão Entrar abre um cartão branco de login na própria tela. A lógica do login está em `hooks/use-login-cockpit.ts` e em `lib/services/auth-client.ts`. Tudo respeita `prefers-reduced-motion`. A tela de descanso do dashboard continua em `components/preview-home/preview-home-screen.tsx`.

## Regras de uso

1. **Accent coral com parcimônia** — botão primário crítico, badge de alerta, estado ativo pontual. Preferir azul institucional para ações recorrentes (Atualizar, filtros, toggles).
2. **Sidebar** — padrão TSE amarelo (seção acima). Topo da sidebar e header das páginas em amarelo `#EBB402` com texto branco; corpo da sidebar branco. Ajustes de cor da sidebar vão em `app/sidebar-tse.css`, não em overrides por página.
3. **Página clara** — fundo `--palette-bg`, cards `--palette-card`, texto `--palette-petrol` / `--palette-aux`.
4. **Hardcodes** — proibido novo `#f04b23` / `#c43d1c` / `#e0a030` como marca. Usar `var(--palette-*)` ou `var(--brand-accent)`.
5. **Temas** (`data-theme`) — remapear accents e fundos para a paleta Copiloto; não reintroduzir ouro/âmbar legado.

## Aliases de compatibilidade

Já expostos no arquivo de tokens:

- `--wr-*` (War Room / IPT)
- `--brand-accent`, `--cockpit-gold`, `--mon-brand*`

War Room Copiloto e IPT devem **consumir** estes tokens, não redefinir hex divergentes.
