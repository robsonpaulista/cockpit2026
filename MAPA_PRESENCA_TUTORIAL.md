# 🗺️ Como Usar o Mapa de Presença - Passo a Passo Visual

## 🎯 Objetivo
Visualizar geograficamente onde você tem **presença territorial** dos seus 224 municípios do Piauí.

---

## 📍 Locais onde Encontrar o Mapa

### Local 1: Botão na Barra de Ações
```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  [🔗 Mapa Mental]  [🗺️ Mapa de Presença]  [⚙️]      │
│                    ↑ Clique aqui!                     │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Local 2: Seção "Cobertura Territorial"
```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  Cobertura Territorial      [Mostrar Mapa ▼]        │
│                             ↑ Ou aqui!              │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ [Mapa Leaflet com 224 marcadores]              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 🎮 Interações do Mapa

### 1️⃣ ZOOM

#### 🖱️ Com Mouse (Desktop)
```
    Scroll para cima    → Zoom IN  (aproximar)
    Scroll para baixo   → Zoom OUT (afastar)
    
    Atalho: Clique duplo na cidade → Zoom automático
```

#### 👆 Com Toque (Mobile/Tablet)
```
    Dois dedos unidos   → Zoom OUT (afastar)
    Dois dedos separados → Zoom IN (aproximar)
```

### 2️⃣ NAVEGAÇÃO

#### 🖱️ Com Mouse
```
    Arraste o mapa    → Mover para explorar
    Segure e arraste  → Suave e responsivo
```

#### 👆 Com Toque
```
    Um dedo: Arraste  → Mover mapa
    Mantém movimento  → Inércia contínua
```

### 3️⃣ INFORMAÇÕES

```
┌─────────────────────────────────┐
│ Clique em um marcador:          │
│                                 │
│  🟡 Marcador Dourado            │
│      ↓ CLIQUE                   │
│      ┌──────────────────┐       │
│      │ TERESINA         │       │
│      │ ✓ Presença Ativa │       │
│      └──────────────────┘       │
│                                 │
│  ⚪ Marcador Cinza              │
│      ↓ CLIQUE                   │
│      ┌──────────────────┐       │
│      │ COCAL            │       │
│      │ Sem presença     │       │
│      └──────────────────┘       │
└─────────────────────────────────┘
```

---

## 📊 Entender as Cores

### 🟡 Marcadores DOURADO (#C6A15B)

```
O que significa:
  ✅ Tem presença registrada
  ✅ Tem pelo menos 1 liderança cadastrada
  ✅ Alvo sendo trabalhado

Tamanho: Maior (raio 6px)
Opacidade: 80%
Borda: Mais escura (#A67C41)

Exemplo: Teresina, Parnaíba, Picos
```

### ⚪ Marcadores CINZA (#E5DED4)

```
O que significa:
  ❌ Sem presença registrada
  ❌ Nenhuma liderança cadastrada
  ❌ Oportunidade de expansão

Tamanho: Menor (raio 4px)
Opacidade: 50%
Borda: Mais clara (#D4D0C8)

Exemplo: Cocal, Aroazes, Jatobá do Piauí
```

---

## 📈 Interpretar as Estatísticas

### Grid de Stats (3 Cards)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│ ┌────────────┬────────────┬────────────┐            │
│ │            │            │            │            │
│ │  ATIVAS    │ COBERTURA  │ SEM AÇÃO   │            │
│ │                                       │            │
│ │    24      │    11%     │    200     │            │
│ │  cidades   │            │  cidades   │            │
│ │            │            │            │            │
│ └────────────┴────────────┴────────────┘            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Interpretação

| Card | Fórmula | Significado |
|------|---------|------------|
| **ATIVAS** | Cidades com ≥1 liderança | Seu "alcance" atual |
| **COBERTURA** | (Ativas / 224) × 100 | Percentual explorado |
| **SEM AÇÃO** | 224 - Ativas | Oportunidades futuras |

### Exemplos Práticos

```
Cenário 1: COMEÇANDO
├─ Ativas: 3
├─ Cobertura: 1,3%
└─ Sem Ação: 221 ← Grande oportunidade!

Cenário 2: EM CRESCIMENTO
├─ Ativas: 50
├─ Cobertura: 22,3%
└─ Sem Ação: 174 ← Bom progresso!

Cenário 3: CONSOLIDADO
├─ Ativas: 150
├─ Cobertura: 67%
└─ Sem Ação: 74 ← Foco em críticos
```

---

## 🔍 Usando com Filtros

### Como Funciona

```
┌─ Você aplica filtros ────────────────┐
│  Ex: Mostrar só lideranças "Prefeito"│
│                                       │
│      [Filtro Cargo: "Prefeito" ✓]   │
│                                       │
└──────────────────┬───────────────────┘
                   │
                   ▼ (mapa se atualiza automaticamente)
                   
┌─────────────────────────────────────┐
│ Mapa recalcula:                      │
│ • Cidades com Prefeitos ativos      │
│ • % cobertura apenas com Prefeitos  │
│ • Apenas esses marcadores destacados│
└─────────────────────────────────────┘
```

### Exemplo Prático

#### Sem Filtro
```
Ativas: 24  |  Cobertura: 11%  |  Sem Ação: 200
[🟡🟡🟡...⚪⚪⚪ 200 cinzas...]
```

#### Com Filtro: Cargo = "Vereador"
```
Ativas: 18  |  Cobertura: 8%   |  Sem Ação: 206
[🟡🟡🟡⚪⚪⚪...⚪⚪⚪ 206 cinzas...]
Menos cidades, mas são onde você tem Vereadores!
```

---

## 🎨 Legenda Visual

Localizada no rodapé do mapa:

```
┌─────────────────────────────────────┐
│                                     │
│  ◯ Presença Ativa    ◯ Sem Ação   │
│     (Dourado)           (Cinza)    │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 Casos de Uso

### Caso 1: Verificar Cobertura Regional

```
1. Abra o mapa
2. Zoom OUT (scroll para baixo)
3. Veja toda a distribuição
4. Identifique "vazios" geográficos
5. Planeje expansão para cluster cinza
```

### Caso 2: Explorar Uma Cidade Específica

```
1. Clique em "Mostrar Mapa"
2. Filtre por Cidade: "Teresina"
3. Zoom IN (scroll para cima)
4. Veja todas as lideranças daquela cidade
5. Clique no marcador para popup detalhado
```

### Caso 3: Analisar por Cargo

```
1. Aplique filtro: Cargo = "Presidente"
2. Observe mapa se atualizar
3. Veja onde tem presidentes (dourado)
4. Identifique gaps (cinza) por cargo
5. Use para planejamento estratégico
```

### Caso 4: Monitorar Crescimento

```
Semanal:
├─ Segunda: Mapa mostra 20 cidades
├─ Quarta: Mapa mostra 22 cidades (+2!)
├─ Sexta: Mapa mostra 25 cidades (+3!)
└─ Resultado: Tendência de crescimento visible!
```

---

## 💡 Dicas Profissionais

### ✅ Boas Práticas

```
✓ Zoom progressivo
  - Comece com zoom OUT para visão geral
  - Depois zoom IN para detalhe

✓ Use filtros com propósito
  - Cargo: Entenda distribuição por papel
  - Cidade: Analise profundidade em áreas

✓ Compare períodos
  - Salve screenshots do mapa
  - Monitore evolução semana a semana

✓ Clique em todos os marcadores
  - Descubra padrões
  - Encontre outliers
```

### ❌ Armadilhas Comuns

```
✗ Não dar zoom OUT (perder contexto geral)
✗ Ignorar marcadores cinzas (oportunidades!)
✗ Aplicar muitos filtros (fica muito vazio)
✗ Não atualizar dados no Google Sheets
```

---

## 🔧 Troubleshooting

### Problema: "Mapa não aparece"

```
Solução 1: Clique em "Mostrar Mapa" após KPIs
Solução 2: Clique no botão "Mapa de Presença" azul
Solução 3: Recarregue a página (F5)
Solução 4: Confirme que tem dados no Google Sheets
```

### Problema: "Marcadores todos iguais (tudo cinza)"

```
Possível causa: Nenhum município foi preenchido
Solução: Adicione cidades no Google Sheets

Ou: Filtros muito restritivos
Solução: Limpe os filtros clicando "Limpar filtros"
```

### Problema: "Mapa está muito lento"

```
Causa: Muitos dados + zoom baixo
Solução 1: Aplique um filtro (reduz dados)
Solução 2: Dê zoom IN (menos marcadores visíveis)
Solução 3: Atualize a página
```

### Problema: "Popup não aparece ao clicar"

```
Solução 1: Clique mais precisamente no marcador
Solução 2: Certifique-se que o zoom permite clique
Solução 3: Tente em navegador diferente
```

---

## 📱 Diferenças por Dispositivo

### 🖥️ Desktop
- ✅ Melhor experiência
- ✅ Zoom mais preciso (mouse wheel)
- ✅ Arraste suave
- ✅ Popups completos

### 💻 Tablet
- ✅ Funciona bem
- ✅ Zoom com dois dedos
- ✅ Arraste com um dedo
- ✅ Popups comprimidos (mas legíveis)

### 📱 Celular
- ✅ Totalmente funcional
- ✅ Zoom com pinça de dois dedos
- ✅ Arraste com um dedo
- ✅ Popups adaptados para tela pequena

---

## 🎓 Exemplos de Análise

### Análise 1: Distribuição Geográfica

```
Pergunta: Minha presença está concentrada?

Ação:
1. Zoom OUT (ver tudo)
2. Observe padrão de dourados

Resultado possível:
├─ Concentrada no norte (Teresina)
│  └─ INSIGHT: Expandir para sul
│
└─ Bem distribuída
   └─ INSIGHT: Presença solid
```

### Análise 2: Intensidade Regional

```
Pergunta: Qual região está melhor atendida?

Ação:
1. Zoom IN em cada região
2. Conte marcadores dourados
3. Compare com outras regiões

Resultado:
├─ Litoral: 5 cidades
├─ Centro: 8 cidades ← MAIOR CONCENTRAÇÃO
├─ Sul: 2 cidades
└─ INSIGHT: Sul precisa de foco
```

### Análise 3: Tipo de Liderança

```
Pergunta: Onde tenho Prefeitos vs Vereadores?

Ação:
1. Aplique filtro: Cargo = "Prefeito"
2. Observe padrão (ver mapa resultante)
3. Troque para: Cargo = "Vereador"
4. Compare os dois mapas

Resultado:
├─ Prefeitos: Mais concentrados (esperado)
├─ Vereadores: Mais distribuídos
└─ INSIGHT: Estratégia diferente por cargo
```

---

## 📊 Relatório Rápido (Exemplo)

Baseado no mapa, você pode gerar insights assim:

```
RELATÓRIO TERRITORIAL - Semana 42

📊 Cobertura Atual
├─ Cidades Ativas: 24 de 224 (10.7%)
├─ Crescimento vs semana anterior: +2 cidades
└─ Projeção (ritmo linear): Será 100% em ~52 semanas

🗺️ Distribuição Geográfica
├─ Melhor coberta: Região Norte (8 cidades)
├─ Crítica: Região Sul (2 cidades)
└─ Recomendação: Intensificar sul

👥 Por Tipo de Liderança
├─ Prefeitos: 4 cidades
├─ Vereadores: 14 cidades
├─ Outros: 6 cidades
└─ Estratégia: Focar em vereadores (mais rápido)

🎯 Próximos Passos
└─ Explorar os 200 clusters cinzas no mapa
```

---

## 🆘 Suporte

Se algo não funcionar:

1. **Verifique os dados** → Google Sheets tem dados?
2. **Recarregue a página** → F5 ou Cmd+R
3. **Limpe os filtros** → Clique "Limpar filtros"
4. **Tente outro navegador** → Chrome, Firefox, Safari
5. **Contate suporte** → Leve o erro exato observado

---

## ✨ Recursos Relacionados

- 📖 [Guia Técnico Completo](MAPA_PRESENCA_INTEGRACAO.md)
- 🎨 [Sistema de Cores](DESIGN_SYSTEM.md)
- 📊 [Análise de Territórios](ANALISE_COMPLETA_PRODUCAO.md)
- 🗂️ [Documentação do Dashboard](DOCUMENTACAO_INDEX.md)

---

**Status**: ✅ Pronto para Uso
**Última atualização**: 2025
**Versão**: 1.0
