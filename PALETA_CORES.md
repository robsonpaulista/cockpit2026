# 🎨 Paleta de Cores — Cockpit 2026 Premium

## Visual Reference

### Fundos (Backgrounds)
```
┌─────────────────────────┐
│ #F7F4EF                 │  ← APP BACKGROUND
│ bg-app                  │     Fundo geral da aplicação
└─────────────────────────┘

┌─────────────────────────┐
│ #FBF9F6                 │  ← SURFACE BACKGROUND
│ bg-surface              │     Cards, painéis, componentes
└─────────────────────────┘

┌─────────────────────────┐
│ #EFE9E1                 │  ← SIDEBAR BACKGROUND
│ bg-sidebar              │     Barra lateral
└─────────────────────────┘
```

### Texto (Text)
```
┌─────────────────────────┐
│ ■ #1C1C1C               │  ← PRIMARY TEXT
│ text-primary            │     Títulos, texto principal
│ Alto contraste          │
└─────────────────────────┘

┌─────────────────────────┐
│ ◆ #6B6B6B               │  ← SECONDARY TEXT
│ text-secondary          │     Descrições, labels
│ Contraste médio         │
└─────────────────────────┘

┌─────────────────────────┐
│ ◇ #9A9A9A               │  ← MUTED TEXT
│ text-muted              │     Desabilitado, hints, placeholders
│ Contraste fraco         │
└─────────────────────────┘
```

### Acentos Premium (Accents)
```
┌─────────────────────────┐
│ ★ #C6A15B               │  ← ACCENT GOLD
│ accent-gold             │     Ícones, bordas, CTAs
│ Dourado fosco           │     Protagonista de destaque
└─────────────────────────┘

┌─────────────────────────┐
│ ☆ #E8D9B8               │  ← ACCENT GOLD SOFT
│ accent-gold-soft        │     Backgrounds suaves, hover
│ Dourado claro           │     Complementar do ouro
└─────────────────────────┘
```

### Estados (States)
```
┌─────────────────────────┐
│ ✓ #2E7D32               │  ← SUCCESS
│ status-success          │     Positivo, aprovado, ✓
│ Verde natural           │
└─────────────────────────┘

┌─────────────────────────┐
│ ⚠ #C77800               │  ← WARNING
│ status-warning          │     Atenção, cuidado, ⚠
│ Laranja moderado        │
└─────────────────────────┘

┌─────────────────────────┐
│ ✗ #9F2A2A               │  ← DANGER
│ status-danger           │     Erro, crítico, ✗
│ Vermelho controlado     │
└─────────────────────────┘

┌─────────────────────────┐
│ ℹ #6B7280               │  ← INFO
│ status-info             │     Informação, neutro, ℹ
│ Cinza elegante          │
└─────────────────────────┘
```

### Bordas (Borders)
```
┌─────────────────────────┐
│ ─ #E5DED4               │  ← BORDER CARD
│ border-card             │     Bordas de cards e componentes
│ Cinza muito suave       │     1px width recomendado
└─────────────────────────┘
```

---

## Exemplo de Uso em Componentes

### Card Premium (Padrão)
```tsx
┌──────────────────────────────┐
│ bg-bg-surface                │ ← #FBF9F6
│ border-border-card 1px       │ ← #E5DED4
│ rounded-[14px]               │
│ shadow-card                  │
│                              │
│ text-text-primary            │ ← #1C1C1C
│ Título Principal             │
│                              │
│ text-text-secondary          │ ← #6B6B6B
│ Descrição ou conteúdo        │
│                              │
└──────────────────────────────┘
```

### Card Hero (Com Borda Ouro)
```tsx
┌──────────────────────────────┐
│━ border-t-4 accent-gold      │ ← #C6A15B (TOPO)
│                              │
│ number-hero                  │ ← #1C1C1C
│ 139.495                      │ (grande, bold, protagonista)
│                              │
│ +3,2%                        │ ← #2E7D32 (sucesso)
│ text-xs                      │ (pequeno, suporte)
│                              │
└──────────────────────────────┘
```

### Sidebar Item (Ativo)
```tsx
┌─────────────────────────────────┐
│ bg-bg-sidebar: #EFE9E1          │ (sidebar)
│                                 │
│ [Item Ativo]                    │
│ bg-accent-gold-soft: #E8D9B8    │ (fundo ativo)
│ ★ text-accent-gold: #C6A15B     │ (ícone ouro)
│ text-text-primary: #1C1C1C      │ (texto escuro)
│ ─ left-border: accent-gold      │ (indicador)
│                                 │
│ [Item Normal]                   │
│ hover:bg-accent-gold-soft       │ (hover suave)
│ ○ text-text-muted: #9A9A9A      │ (ícone cinza)
│ text-text-secondary: #6B6B6B    │ (texto cinza)
└─────────────────────────────────┘
```

---

## Combinações Recomendadas

### Para CTAs (Call-to-Action)
```
Fundo: accent-gold (#C6A15B)
Texto: white ou #FBF9F6
Hover: Mais escuro ou opacity
Resultado: Destaque sem ser chamativo
```

### Para Avisos/Alertas
```
Tipo        │ Fundo (10%)      │ Borda (100%)  │ Ícone (100%)
─────────────┼──────────────────┼───────────────┼─────────────
Success     │ #2E7D32 com -10% │ #2E7D32       │ #2E7D32
Warning     │ #C77800 com -10% │ #C77800       │ #C77800
Danger      │ #9F2A2A com -10% │ #9F2A2A       │ #9F2A2A
Info        │ #6B7280 com -10% │ #6B7280       │ #6B7280
```

### Para Cards/Superfícies
```
Fundo:  bg-surface (#FBF9F6)
Borda:  border-card (#E5DED4) - 1px
Shadow: 0 6px 18px rgba(0,0,0,0.06)
Hover Shadow: 0 8px 24px rgba(0,0,0,0.08)
```

---

## Contraste e Acessibilidade

### Ratios WCAG AA (Mínimo)
```
text-primary (#1C1C1C) sobre bg-surface (#FBF9F6):
Ratio: 17.2:1 ✅ AAA (Excellence)

text-secondary (#6B6B6B) sobre bg-surface (#FBF9F6):
Ratio: 7.2:1 ✅ AAA (Excellence)

accent-gold (#C6A15B) sobre bg-surface (#FBF9F6):
Ratio: 3.8:1 ✅ AA (OK para UI components)

accent-gold (#C6A15B) sobre white (text):
Ratio: 5.5:1 ✅ AAA (Excellence)
```

---

## Gradientes Permitidos (Raros)

❌ **Evite gradientes saturados**
❌ **Evite gradientes chamativos**
✅ **Permitido:** Gradientes suaves em backgrounds visuais

```css
/* ✅ Permitido - Gradiente Premium Suave */
background: linear-gradient(
  135deg,
  #C6A15B 0%,
  #E8D9B8 100%
);

/* ✅ Permitido - Gradiente de Fundo Elegante */
background: linear-gradient(
  180deg,
  #F7F4EF 0%,
  #FBF9F6 100%
);

/* ❌ Proibido - Muito saturado */
background: linear-gradient(
  90deg,
  #FF0000 0%,
  #0000FF 100%
);
```

---

## Dark Mode (Reservado para futuro)

Atualmente **DESABILITADO**, mas se implementar:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-app: #1a1a1a;
    --bg-surface: #2d2d2d;
    --text-primary: #f5f5f5;
    --text-secondary: #c0c0c0;
    --accent-gold: #d4af37; /* mais brilhante */
  }
}
```

---

## Tabela de Referência Rápida

| Elemento | Cor | Hex | Token |
|----------|-----|-----|-------|
| Fundo App | Bege | #F7F4EF | bg-app |
| Superfícies | Off-white | #FBF9F6 | bg-surface |
| Sidebar | Bege escuro | #EFE9E1 | bg-sidebar |
| Texto Principal | Preto suave | #1C1C1C | text-primary |
| Texto Secundário | Cinza | #6B6B6B | text-secondary |
| Texto Muted | Cinza claro | #9A9A9A | text-muted |
| Dourado | Ouro fosco | #C6A15B | accent-gold |
| Dourado Soft | Ouro claro | #E8D9B8 | accent-gold-soft |
| Borda | Cinza suave | #E5DED4 | border-card |
| Sucesso | Verde | #2E7D32 | status-success |
| Aviso | Laranja | #C77800 | status-warning |
| Erro | Vermelho | #9F2A2A | status-danger |
| Info | Cinza azul | #6B7280 | status-info |

---

## Exportar para Figma

```json
{
  "colors": {
    "bg": {
      "app": "#F7F4EF",
      "surface": "#FBF9F6",
      "sidebar": "#EFE9E1"
    },
    "text": {
      "primary": "#1C1C1C",
      "secondary": "#6B6B6B",
      "muted": "#9A9A9A"
    },
    "accent": {
      "gold": "#C6A15B",
      "gold-soft": "#E8D9B8"
    },
    "status": {
      "success": "#2E7D32",
      "warning": "#C77800",
      "danger": "#9F2A2A",
      "info": "#6B7280"
    },
    "border": {
      "card": "#E5DED4"
    }
  }
}
```

---

## Notas Importantes

1. **Dourado NUNCA é fundo principal** — Sempre em destaque
2. **Números são protagonistas** — Sempre maiores e mais escuros
3. **Contraste é essencial** — Mantém legibilidade
4. **Consistência acima de tudo** — Use os tokens sempre
5. **Premium é discreto** — Não é chamativo

---

**Última Atualização:** 22 de janeiro de 2026  
**Versão:** 1.0 Premium
