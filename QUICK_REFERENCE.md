# ⚡ Quick Reference — Cockpit 2026 Premium Theme

## 5 Minutos para Entender

### As Cores (Memorize)
```
Bege:     #F7F4EF (app background)
Off-white: #FBF9F6 (cards)
Ouro:     #C6A15B (ícones, destaque)
Preto:    #1C1C1C (texto)
Cinza:    #6B6B6B (texto secundário)
```

### As Regras de Ouro (Golden Rules)
1. **Números > Texto** — Sempre maiores
2. **Ouro em Ícones** — Sempre dourado
3. **Cards com borda 14px** — `rounded-[14px]`
4. **Sem gradientes chamativos** — Apenas suaves
5. **Transições 200ms** — `transition-all duration-200 ease-out`

### Classes Que Todo Dev Usa
```tsx
// Cards
className="card-premium"         // Card padrão
className="card-hero"            // Card com borda ouro

// Texto
className="number-hero"          // Números grandes
className="text-premium"         // Texto secundário
className="icon-gold"            // Ícones em ouro

// Interações
className="hover:-translate-y-0.5 shadow-card-hover"
className="focus:ring-2 focus:ring-accent-gold"
```

---

## Componentes: Antes vs Depois

### Card
**Antes:**
```tsx
<div className="bg-surface border border-border rounded-2xl p-4">
```

**Depois:**
```tsx
<div className="card-premium">
```

### KPI
**Antes:**
```tsx
<p className="text-3xl font-bold text-text-strong text-primary">
  {value}
</p>
```

**Depois:**
```tsx
<p className="number-hero text-accent-gold">
  {value}
</p>
```

### Button
**Antes:**
```tsx
className="bg-primary hover:bg-primary-dark text-white"
```

**Depois:**
```tsx
className="bg-accent-gold hover:bg-accent-gold text-white"
```

### Sidebar
**Antes:**
```tsx
bg-surface border-border text-primary
```

**Depois:**
```tsx
bg-bg-sidebar border-border-card text-accent-gold
```

---

## Paleta Rápida (Copy-Paste)

### CSS Variables
```css
--bg-app: #F7F4EF;
--bg-surface: #FBF9F6;
--bg-sidebar: #EFE9E1;
--text-primary: #1C1C1C;
--text-secondary: #6B6B6B;
--text-muted: #9A9A9A;
--accent-gold: #C6A15B;
--accent-gold-soft: #E8D9B8;
--success: #2E7D32;
--warning: #C77800;
--danger: #9F2A2A;
--info: #6B7280;
--border-card: #E5DED4;
```

### Tailwind
```ts
colors: {
  'bg-app': '#F7F4EF',
  'bg-surface': '#FBF9F6',
  'bg-sidebar': '#EFE9E1',
  'text-primary': '#1C1C1C',
  'text-secondary': '#6B6B6B',
  'text-muted': '#9A9A9A',
  'accent-gold': '#C6A15B',
  'accent-gold-soft': '#E8D9B8',
  'status-success': '#2E7D32',
  'status-warning': '#C77800',
  'status-danger': '#9F2A2A',
  'status-info': '#6B7280',
  'border-card': '#E5DED4',
}
```

---

## Receitas (Snippets)

### Card com Título e Número
```tsx
<div className="card-premium">
  <p className="text-sm text-text-secondary mb-2">Título</p>
  <p className="number-hero">1.234</p>
  <p className="text-xs text-text-muted mt-1">Descrição</p>
</div>
```

### Button Premium
```tsx
<button className="px-4 py-2 bg-accent-gold text-white rounded-[12px] 
                   hover:bg-accent-gold font-semibold transition-all duration-200
                   disabled:opacity-50">
  Clique aqui
</button>
```

### Sidebar Item
```tsx
<Link href="/page" className={cn(
  'flex items-center gap-3 px-3 py-2.5 rounded-[10px]',
  'hover:bg-accent-gold-soft transition-all duration-200',
  isActive && 'bg-accent-gold-soft text-text-primary'
)}>
  <Icon className="text-accent-gold" />
  <span>{label}</span>
</Link>
```

### Alert Card
```tsx
<div className="p-4 rounded-[14px] border border-status-danger/50 
                bg-status-danger/5">
  <p className="font-semibold text-status-danger">Aviso</p>
  <p className="text-sm text-text-secondary mt-1">Mensagem</p>
</div>
```

### Tabela com Tema
```tsx
<table className="w-full">
  <thead className="bg-accent-gold-soft border-b-2 border-accent-gold">
    <tr>
      <th className="text-left p-3 font-semibold">Coluna</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-border-card hover:bg-bg-surface">
      <td className="p-3">Dados</td>
    </tr>
  </tbody>
</table>
```

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Cor não aparece | Clear `.next`, restart server |
| Input com cor errada | Use `border-border-card focus:ring-accent-gold` |
| Card muito grande | Use `rounded-[14px] p-5` |
| Ícone não fica dourado | `className="text-accent-gold"` |
| Hover não funciona | Verify `transition-all duration-200` está presente |
| Sombra muito forte | Use `shadow-card` não `shadow-lg` |
| Texto muito claro | Use `text-text-primary` não `text-text-muted` |

---

## Checklist Rápido

Antes de fazer commit:
- [ ] Nenhuma cor `#1E4ED8` (azul antigo)
- [ ] Ícones `text-accent-gold`
- [ ] Cards `card-premium`
- [ ] Hover com `transition-all duration-200`
- [ ] Números com `number-hero`
- [ ] Mobile testado

---

## Arquivos Importantes

| Arquivo | O quê |
|---------|-------|
| `app/globals.css` | Design tokens (CSS vars) |
| `app/theme.css` | Estilos avançados |
| `tailwind.config.ts` | Cores Tailwind |
| `DESIGN_SYSTEM.md` | Documentação completa |
| `PALETA_CORES.md` | Visual reference |

---

## Atalhos Úteis

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild Tailwind
npm run build

# Dev mode
npm run dev

# View coverage
npm run lint
```

---

## Exemplos Reais

### Antes (Azul)
```tsx
<div className="bg-surface border border-border rounded-xl p-4">
  <h3 className="text-primary font-semibold">139.495</h3>
  <p className="text-sm text-text-muted">Votos esperados</p>
</div>
```

### Depois (Premium)
```tsx
<div className="card-hero">
  <h3 className="number-hero">139.495</h3>
  <p className="text-sm text-text-secondary">Votos esperados</p>
</div>
```

---

## Links de Referência

- 📖 Design System Completo: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- 🎨 Paleta Visual: [PALETA_CORES.md](./PALETA_CORES.md)
- 🚀 Implementação: [IMPLEMENTACAO_TEMA.md](./IMPLEMENTACAO_TEMA.md)
- ⚙️ Tailwind Config: [tailwind.config.ts](./tailwind.config.ts)

---

**Cockpit 2026 Premium Theme**  
Versão 1.0 | 22 jan 2026

> "Uma sala de comando estratégica, discreta e poderosa."
