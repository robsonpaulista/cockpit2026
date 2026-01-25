# 🎨 Design System — Cockpit 2026 Premium

## Visão Geral

**Cockpit 2026** é um dashboard SaaS premium para gestão estratégica de campanha eleitoral. O design transmite sofisticação, autoridade e confiança através de um tema elegante em tons bege/off-white com acentos em dourado fosco.

---

## 🎯 Princípios de Design

### Filosofia
- **Sério, moderno, clean e elegante** — Nunca casual, gamer ou chamativo
- **Foco em dados** — Números são protagonistas, texto é suporte
- **Discreção e poder** — "Uma sala de comando estratégica"
- **Alto valor percebido** — Sistema que "sabe o que está fazendo"

### Regras Fundamentais
✅ **Permitido:**
- Tons quentes (bege, off-white, ouro fosco)
- Linhas e bordas sutis
- Tipografia limpa e hierarquizada
- Sombras suaves
- Transições suaves (200-300ms)

❌ **Proibido:**
- Cores saturadas ou vibrantes
- Gradientes chamativos
- Emojis (exceto em mensagens de usuário)
- Animações contínuas (pulse, bounce, glow)
- Fundos muito escuros

---

## 🎨 Paleta Oficial

### Fundos
| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-app` | `#F7F4EF` | Fundo geral da aplicação |
| `--bg-surface` | `#FBF9F6` | Cards, painéis, superfícies |
| `--bg-sidebar` | `#EFE9E1` | Barra lateral |

### Texto
| Token | Valor | Uso |
|-------|-------|-----|
| `--text-primary` | `#1C1C1C` | Texto principal, títulos |
| `--text-secondary` | `#6B6B6B` | Texto secundário, labels |
| `--text-muted` | `#9A9A9A` | Texto desabilitado, hints |

### Acentos Premium
| Token | Valor | Uso |
|-------|-------|-----|
| `--accent-gold` | `#C6A15B` | Ícones, bordas, CTA |
| `--accent-gold-soft` | `#E8D9B8` | Backgrounds suaves |

### Estados
| Token | Valor | Uso |
|-------|-------|-----|
| `--success` | `#2E7D32` | Sucesso, positivo |
| `--warning` | `#C77800` | Aviso, atenção |
| `--danger` | `#9F2A2A` | Erro, crítico |
| `--info` | `#6B7280` | Informação, neutro |

### Bordas
| Token | Valor | Uso |
|-------|-------|-----|
| `--border-card` | `#E5DED4` | Bordas de cards e componentes |

---

## 📦 Componentes Core

### Card Padrão
```tsx
className="bg-bg-surface border border-border-card rounded-[14px] p-5 
           shadow-card hover:shadow-card-hover transition-all duration-200 
           hover:-translate-y-0.5"
```

### Card Hero (Com Borda Ouro)
```tsx
className="... border-t-4 border-t-accent-gold"
```

**Propósito:** Destaca KPIs principais com borda superior em dourado fosco.

### Números (Protagonistas)
```tsx
className="text-4xl font-black text-text-primary"  // Hero
className="text-3xl font-bold text-text-primary"   // Large
className="text-2xl font-bold text-text-primary"   // Medium
```

**Regra:** Números sempre maiores, mais negros e mais destacados que texto.

### Sidebar
- **Fundo:** `--bg-sidebar` (#EFE9E1)
- **Item ativo:** `bg-accent-gold-soft` com `text-text-primary`
- **Ícones:** Sempre `--accent-gold`
- **Hover:** Leve escurecimento + `transition-all duration-200 ease-out`

---

## 🎯 Padrões de Uso

### Uso do Dourado
✅ **Permitido em:**
- Ícones
- Bordas (especialmente superiores em cards)
- Linhas divisórias
- Indicadores de status
- Títulos estratégicos
- CTAs (Call-to-Action)

❌ **Nunca use como:**
- Fundo principal
- Texto em corpo de parágrafo
- Plano de fundo de grandes áreas

### Hover States
```tsx
hover:shadow-card-hover 
hover:-translate-y-0.5 
transition-all duration-200 ease-out
```

**Comportamento:** Cards levemente elevam com sombra mais profunda.

### Focus States (Formulários)
```tsx
focus:outline-none 
focus:ring-2 focus:ring-accent-gold 
focus:border-transparent
```

---

## 🧭 Typografia

### Famílias
- **Principal:** `Inter` (com fallback para `system-ui, sans-serif`)
- **Alternativas:** IBM Plex Sans, SF Pro

### Pesos e Tamanhos

| Elemento | Tamanho | Peso | Uso |
|----------|---------|------|-----|
| H1 (Página) | 36px | 700 | Títulos principais |
| H2 (Seção) | 28px | 600 | Títulos de seção |
| H3 (Grupo) | 20px | 600 | Títulos de grupo |
| H4 (Card) | 16px | 600 | Títulos de card |
| Número Hero | 48px | 900 (black) | KPIs principais |
| Número Large | 32px | 800 | KPIs secundárias |
| Body | 14px | 400 | Texto comum |
| Body Bold | 14px | 600 | Ênfase |
| Caption | 12px | 500 | Labels, hints |
| Xsmall | 10px | 400 | Metadados |

---

## ✨ Efeitos e Animações

### Sombras
```css
/* Card Normal */
box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);

/* Card Hover */
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
```

### Transições
```css
/* Padrão */
transition: all 200ms ease-out;

/* Timing Functions Permitidas */
ease-out
cubic-bezier(0.22, 1, 0.36, 1) /* Premium, reservado */
```

### Animações Permitidas
✅ Fade in/out
✅ Slide smooth
✅ Scale suave (não bounce)
✅ Color transitions

❌ Pulse contínuo
❌ Bounce
❌ Glow
❌ Spin infinito (apenas em loaders específicos)

---

## 🤖 Copilot IA / Assistente Executivo

### Características
- **Visual:** Integrado ao sistema, sem parecer "chatbot casual"
- **Fundo:** `--bg-surface` com border `--border-card`
- **Header:** Gradiente sutil dourado com ícone
- **Mensagens do usuário:** Fundo em `--accent-gold`
- **Mensagens do assistente:** Fundo claro com border
- **CTAs:** Botões em ouro fosco, sem excesso

### Comportamento
- Aparece como **assistente executivo silencioso**
- Minimizável
- Mensagens claras e concisas
- Não toma espaço desnecessário
- Integração perfeita com o sistema

---

## 🧩 Componentes Específicos

### KPI Cards
- **Hero:** Borda superior em dourado + número muito grande
- **Regular:** Sem borda colorida + número grande
- **Indicador:** Seta ou percentual em verde/vermelho
- **Fonte:** "Fonte própria" em texto pequeno

### Alert Cards
- **Risco:** Borde vermelho, fundo vermelho suave
- **Atenção:** Borde laranja, fundo laranja suave
- **Oportunidade:** Borde verde, fundo verde suave
- **Badge:** Pequeno, com ícone e texto

### Action Cards
- **Alto:** Fundo vermelho suave
- **Médio:** Fundo laranja suave
- **Baixo:** Fundo dourado suave
- **Icon:** Sempre dourado

---

## 📐 Spacing

### Padrão 4px
```css
p-1 = 4px      /* Extra small */
p-2 = 8px      /* Small */
p-3 = 12px     /* Base */
p-4 = 16px     /* Medium */
p-5 = 20px     /* Large */
p-6 = 24px     /* XL */
```

### Aplicações
- **Cards:** `p-5` (20px)
- **Modal/Dialogs:** `p-6` (24px)
- **Buttons:** `px-4 py-2` (16px horizontal, 8px vertical)
- **Badges/Tags:** `px-2.5 py-1` (10px horizontal, 4px vertical)

---

## 🔢 Hierarquia de Dados

### Regra Ouro
**NÚMEROS = Protagonistas | TEXTO = Suporte**

### Exemplo Prático
```
┌─────────────────────┐
│ 139.495             │  ← Grande, bold, escuro (protagonista)
│ +3,2% vs ontem      │  ← Menor, verde (suporte)
│ Expectativa de voto │  ← Texto mínimo, muted (contexto)
└─────────────────────┘
```

### Aplicação
1. Número principal sempre maior
2. Indicador (variação) em cor de estado
3. Label descritivo em texto pequeno
4. Nunca sobrecarregar com texto

---

## 📏 Border Radius

| Tamanho | Uso |
|---------|-----|
| `14px` | Cards, componentes principais |
| `12px` | Botões, inputs, badges |
| `10px` | Sidebar items, small components |
| `8px` | Mini elementos |
| `full` | Avatares, círculos |

---

## 🎬 Estados de Componentes

### Normal
- Fundo: `--bg-surface`
- Border: `--border-card` 1px
- Shadow: `shadow-card`

### Hover
- Shadow: `shadow-card-hover` (mais profunda)
- Transform: `translateY(-2px)` (levemente elevado)
- Transition: `200ms ease-out`

### Active / Focus
- Ring: `ring-2 ring-accent-gold`
- Border color pode mudar
- Fundo pode ter variação sutil

### Disabled
- Opacity: `opacity-50`
- Cursor: `not-allowed`
- Sem hover effects

---

## 📝 Implementação

### CSS Variables
Todos os tokens estão disponíveis como variáveis CSS em `app/globals.css`:

```css
:root {
  --bg-app: #F7F4EF;
  --bg-surface: #FBF9F6;
  --accent-gold: #C6A15B;
  /* ... */
}
```

### Tailwind Config
Cores customizadas em `tailwind.config.ts`:

```ts
colors: {
  'bg-app': '#F7F4EF',
  'bg-surface': '#FBF9F6',
  'accent-gold': '#C6A15B',
  // ...
}
```

### Classe de Utilidade
```tsx
className="card-premium"        // Card padrão
className="card-hero"           // Card hero com borda ouro
className="number-hero"         // Número grande
className="icon-gold"           // Ícone dourado
className="text-premium"        // Texto secundário
className="transition-premium"  // Transição suave
```

---

## ✅ Checklist de Qualidade

Antes de fazer commit de novo componente:

- [ ] Cores apenas da paleta oficial
- [ ] Sem cores saturadas ou gradientes chamativos
- [ ] Border-radius 14px para cards
- [ ] Padding consistente (p-5 para cards)
- [ ] Shadow suave (`shadow-card`)
- [ ] Transição 200ms `ease-out`
- [ ] Números maiores que texto
- [ ] Dourado apenas em ícones/bordas/CTAs
- [ ] Nenhum emoji (exceto autorizado)
- [ ] Hover state implementado
- [ ] Focus state em inputs
- [ ] Responsivo em mobile
- [ ] Texto legível em contraste

---

## 🚀 Resultado Esperado

O sistema deve parecer:
- ✨ **Caro** — Design refinado, não genérico
- 🔒 **Confiável** — Cores e layout transmitem segurança
- 🎯 **Estratégico** — Dados são óbvios, fáceis de ler
- 👑 **De alto nível** — Digno de decisões importantes

O usuário deve sentir: **"Esse sistema sabe o que está fazendo."**

---

## 📞 Suporte

Para dúvidas sobre o design system:
1. Consulte esta documentação
2. Verifique componentes existentes como referência
3. Mantenha consistência com os princípios estabelecidos
4. Quando em dúvida, escolha a opção mais discreta

---

**Última atualização:** 22 de janeiro de 2026  
**Versão:** 1.0 Premium
