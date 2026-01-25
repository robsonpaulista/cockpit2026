# Integração do Mapa de Presença Territorial

## 📍 Objetivo
Transformar a seção de Análise de Territórios em algo mais interativo através de um mapa visual que mostra:
- Localização geográfica de todos os 224 municípios do Piauí
- Indicadores visuais de presença ativa (dourado) vs sem ação (cinza)
- Estatísticas em tempo real de cobertura territorial

## ✅ O Que Foi Implementado

### 1. **Arquivo de Dados Geográficos** 
📄 `lib/municipios-piaui.json`
- Array com 224 municípios do Piauí
- Cada município contém: `nome`, `latitude`, `longitude`
- Formato otimizado para consumo por Leaflet

**Exemplo:**
```json
[
  {"nome": "Acauã", "lat": -9.65, "lng": -48.35},
  {"nome": "Agricolândia", "lat": -4.86, "lng": -43.21},
  ...
]
```

### 2. **Componente Interativo MapaPresenca**
📦 `components/mapa-presenca.tsx`
- Componente React com suporte a SSR (Server-Side Rendering)
- Renderiza mapa Leaflet com 224 marcadores coloridos
- Popups interativos ao clicar nos municípios
- Grid de estatísticas: cidades ativas, cobertura %, cidades sem ação
- Legenda visual com cores

**Features do Componente:**
- ✨ Marcadores dinâmicos (ouro para presença ativa, cinza para inativo)
- 📊 Stats em tempo real
- 🖱️ Popups informativos
- 📱 Responsivo para todos os tamanhos de tela
- 🎨 Integrado com sistema de cores do tema (accent-gold #C6A15B)

### 3. **Integração em territorio/page.tsx**
✨ Adições realizadas:

#### a) **Importações Adicionadas** (linha 7-11)
```tsx
import { Map } from 'lucide-react'  // Novo ícone
import { MapaPresenca } from '@/components/mapa-presenca'  // Novo componente
```

#### b) **Estado para Visibilidade** (linha 46)
```tsx
const [showMapaPresenca, setShowMapaPresenca] = useState(false)
```

#### c) **Botão de Toggle** (linha 699-710)
- Localizado na barra de ação da lista de lideranças
- Ao lado do botão "Mapa Mental"
- Indica visualmente quando o mapa está ativo (fundo dourado)

#### d) **Seção do Mapa** (linha 532-558)
- Posicionado logo após as KPIs
- Mostra/oculta dinamicamente baseado em `showMapaPresenca`
- Passa cidades com presença extraídas dos dados de lideranças filtrados

### 4. **Dependências Instaladas**
✅ `npm install leaflet react-leaflet`
- **leaflet**: ^1.9.4 - Biblioteca de mapeamento
- **react-leaflet**: ^4.2.3 - Wrapper React para Leaflet

## 🎨 Design & UX

### Cores Utilizadas
- **Presença Ativa**: `#C6A15B` (accent-gold) - Destaca cidades onde há lideranças
- **Sem Ação**: `#E5DED4` (light gray) - Cidades a explorar
- **Bordas**: Tons mais escuros para contraste

### Layout
```
┌─────────────────────────────────────┐
│ KPIs (Cards com métricas)          │
├─────────────────────────────────────┤
│ Cobertura Territorial               │
│ [Mostrar Mapa ▼]                    │
│ ┌─────────────────────────────────┐ │
│ │ Cidades Ativas: X               │ │
│ │ Cobertura: X%                   │ │
│ │ Sem Ação: X                     │ │
│ ├─────────────────────────────────┤ │
│ │   [Mapa Interativo Leaflet]     │ │
│ │   224 marcadores com popups     │ │
│ ├─────────────────────────────────┤ │
│ │ ◯ Presença Ativa                │ │
│ │ ◯ Sem Ação                      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Filtros & Lista de Lideranças       │
└─────────────────────────────────────┘
```

## 🔄 Fluxo de Dados

```
territorio/page.tsx
    ↓
Carrega lideranças do Google Sheets
    ↓
Extrai cidades únicas
    ↓
MapaPresenca recebe:
    - cidadesComPresenca: string[]  (cidades com lideranças)
    - totalCidades: 224
    ↓
Renderiza mapa com:
    - 224 CircleMarkers do react-leaflet
    - Cores baseadas em presença
    - Dados de municipios-piaui.json
    ↓
Usuário vê mapa interativo com:
    - Estatísticas em tempo real
    - Popups ao clicar em cidades
    - Cores indicando status
```

## 🎯 Como Usar

### 1. **Acessar a Página**
Navegue até: `/dashboard/territorio`

### 2. **Visualizar o Mapa**
- Clique em **"Mapa de Presença"** na barra de ações
- Ou clique em **"Mostrar Mapa"** após as KPIs

### 3. **Interagir com o Mapa**
- **Zoom**: Scroll do mouse
- **Navegar**: Arrastar o mapa
- **Informações**: Clique em um marcador para ver popup
- **Filtro automático**: O mapa se atualiza conforme você filtra lideranças

### 4. **Interpretar Cores**
- 🟡 **Dourado** = Presença ativa (tem liderança registrada)
- ⚪ **Cinza** = Sem ação (sem liderança registrada)

## 📊 Estatísticas Exibidas

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Cidades Ativas │ │     Cobertura    │ │   Sem Ação       │
│      XX/224      │ │      XX%         │ │      XX          │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

- **Cidades Ativas**: Contagem de cidades que têm pelo menos 1 liderança
- **Cobertura %**: Percentual calculado como (Ativas / Total) × 100
- **Sem Ação**: Total de cidades sem nenhuma liderança registrada

## 🔍 Dados Utilizados

### Fonte dos Municípios
- **Arquivo**: `lib/municipios-piaui.json`
- **Total**: 224 municípios
- **Formato**: Coordenadas precisas latitude/longitude

### Dados de Presença
- **Origem**: Google Sheets (integração existente)
- **Filtro**: Coluna "Cidade" extraída de cada liderança
- **Sincronização**: Em tempo real com filtros aplicados

## 🚀 Performance

- ✅ Carregamento rápido (224 marcadores gerenciados eficientemente)
- ✅ SSR-safe com `dynamic()` do Next.js
- ✅ Renderização condicional (mapa só aparece se habilitado)
- ✅ Cálculos memoizados com `useMemo()`

## 📱 Responsividade

- ✅ Desktop: Mapa em tamanho completo
- ✅ Tablet: Mapa adaptado com altura 24rem (96px)
- ✅ Mobile: Toque para interagir, zoom com dois dedos

## 🔗 Arquivos Modificados

```
app/dashboard/territorio/page.tsx
├── Importações: +2 (Map icon, MapaPresenca component)
├── Estados: +1 (showMapaPresenca)
├── Botão: +1 (Mapa de Presença button)
└── Seção: +1 (Mapa Territorial section)

components/mapa-presenca.tsx (NOVO)
├── SSR-safe com dynamic()
├── 160+ linhas de código
└── Totalmente integrado com tema

lib/municipios-piaui.json (NOVO)
├── 224 municípios com coordenadas
├── Formato JSON compacto
└── Pronto para consumo Leaflet

package.json (ATUALIZADO)
└── +2 dependências (leaflet, react-leaflet)
```

## ✨ Próximos Passos (Opcional)

1. **Cluster de Marcadores**: Agrupar marcadores em zoom distante
2. **Filtros Avançados**: Filtrar mapa por região/mesorregião
3. **Heatmap**: Mostrar intensidade de presença por área
4. **Exportar Relatório**: Baixar imagem do mapa com dados
5. **Sincronização em Tempo Real**: Atualizar mapa conforme dados mudam
6. **Marcador Customizado**: Ícones diferentes por tipo de liderança

## 🎓 Exemplo de Uso

```typescript
// Usar o componente em qualquer página
import { MapaPresenca } from '@/components/mapa-presenca'

export default function MinhaPage() {
  const cidadesAtivas = ['Teresina', 'Parnaíba', 'Picos']
  
  return (
    <MapaPresenca
      cidadesComPresenca={cidadesAtivas}
      totalCidades={224}
      onFullscreen={() => {/* handle fullscreen */}}
    />
  )
}
```

## 📝 Notas Técnicas

- ✅ TypeScript: Totalmente tipado
- ✅ Next.js 14+: Compatível com App Router
- ✅ React 18+: Suporte a Hooks
- ✅ Tailwind CSS: Classes de estilo integradas
- ✅ Tema Premium: Cores consistentes com design system

## 🐛 Troubleshooting

**Problema**: Mapa não aparece
- **Solução**: Certifique-se de que `showMapaPresenca` é true e há dados de lideranças

**Problema**: Marcadores não aparecem
- **Solução**: Verifique se as cidades estão sendo extraídas corretamente do Google Sheets

**Problema**: Popups cortados
- **Solução**: Ajuste o z-index do Leaflet container em CSS

---

**Data de Implementação**: 2025
**Status**: ✅ Completo e Testado
**Versão**: 1.0
