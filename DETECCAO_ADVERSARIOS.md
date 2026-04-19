# 🎯 Detecção Automática de Adversários via Google Alerts

## 📋 Visão Geral

O sistema agora detecta automaticamente menções de adversários cadastrados nas notícias coletadas do Google Alerts, criando registros de ataques e atualizando o Share of Voice (presença) de cada adversário.

## 🔍 Como Funciona

### 1. **Detecção Automática**

Quando uma notícia é coletada do Google Alerts, o sistema:

1. **Busca todos os adversários cadastrados** no banco de dados
2. **Analisa o título e conteúdo** da notícia procurando menções
3. **Detecta o tipo de ataque** baseado em palavras-chave:
   - **Direto**: Menções explícitas com palavras de ataque (acusou, criticou, atacou, etc.)
   - **Indireto**: Menção do adversário sem palavras de ataque claro
   - **Falsa Afirmação**: Menções com palavras como "falso", "mentira", "fake news"
   - **Omissão**: Menções com palavras como "ignorou", "não mencionou", "omitiu"

### 2. **Criação de Registros**

Para cada adversário detectado, o sistema cria um registro em `adversary_attacks` com:
- ID do adversário
- ID da notícia
- Tipo de ataque detectado
- Data/hora da detecção

### 3. **Cálculo de Share of Voice**

O sistema calcula automaticamente o percentual de presença de cada adversário:
```
Share of Voice = (Menções do Adversário / Total de Menções) × 100
```

Este valor é atualizado automaticamente no campo `presence_score` da tabela `adversaries`.

## 🚀 Onde Funciona

A detecção automática está integrada em **todos os pontos de coleta**:

1. **Coleta Manual** (`/api/noticias/collect/google-alerts`)
   - Quando você clica em "Coletar do Google Alerts" no modal

2. **Coleta dos Meus Feeds** (`/api/noticias/collect/my-feeds`)
   - Quando você clica em "Coletar dos Meus Feeds"

3. **Coleta Agendada** (`/api/noticias/collect/schedule`)
   - Quando o cron job executa automaticamente

## 📊 Visualização na Interface

### Radar de Adversários

Na página de Notícias, a seção "Radar de Adversários" mostra:

- **Nome do adversário**
- **Tipo** (Candidato, Partido, Mídia, etc.)
- **Share of Voice** (percentual de presença)
- **Temas** que aborda
- **Contador de menções** dos últimos 7 dias
  - Total de menções
  - Quantas são diretas
  - Quantas são indiretas

### Exemplo de Exibição

```
┌─────────────────────────────────────┐
│ Candidato X                         │
│ [Candidato] [45% presença]          │
│                                     │
│ [Saúde] [Educação] [Infraestrutura] │
│                                     │
│ ⚠️ 12 menção(ões) nos últimos 7 dias│
│    • 5 direto(s) • 7 indireto(s)    │
└─────────────────────────────────────┘
```

## 🔧 Configuração

### 1. Cadastrar Adversários

1. Acesse a página de **Notícias**
2. Role até **"Radar de Adversários"**
3. Clique em **"Gerenciar"**
4. Adicione adversários com:
   - Nome completo (importante para detecção precisa)
   - Tipo
   - Temas que aborda
   - Share of Voice inicial (opcional, será calculado automaticamente)

### 2. Configurar Feeds RSS

1. Clique em **"Gerenciar Feeds RSS"**
2. Adicione feeds do Google Alerts que monitoram:
   - Nome do candidato
   - Nome de adversários
   - Temas relevantes
   - Palavras-chave da campanha

### 3. Coletar Notícias

- **Manual**: Clique em "Coletar do Google Alerts" ou "Coletar dos Meus Feeds"
- **Automático**: Configure um cron job para executar `/api/noticias/collect/schedule`

## 🎯 Tipos de Detecção

### Detecção por Nome

O sistema busca:
- **Nome completo** do adversário
- **Variações** (primeiro nome + sobrenome)
- **Mínimo 2 partes** do nome para considerar menção

### Análise de Contexto

O sistema analisa **100 caracteres antes e depois** do nome mencionado para determinar o tipo de ataque:

**Ataque Direto:**
- Palavras: acusou, criticou, atacou, denunciou, condenou, contra, versus, opõe

**Falsa Afirmação:**
- Palavras: falso, mentira, fake, notícia falsa, desinformação, alega sem provas

**Omissão:**
- Palavras: ignorou, não mencionou, esqueceu, omitiu, não falou sobre

**Ataque Indireto:**
- Menção do nome sem palavras de ataque claro

## 📈 Métricas e Relatórios

### Share of Voice

Atualizado automaticamente a cada coleta:
- Calcula percentual de presença baseado em todas as menções
- Considera todos os adversários cadastrados
- Atualiza em tempo real

### Histórico de Ataques

Cada registro de ataque contém:
- Data/hora da detecção
- Tipo de ataque
- Link para a notícia original
- Sentimento da notícia
- Nível de risco

## 🔐 Segurança

- Detecção acontece apenas para adversários cadastrados pelo usuário
- Registros de ataques são privados por usuário (RLS)
- Share of Voice é calculado apenas com dados do próprio usuário

## 🚨 Alertas

Quando uma notícia de **alto risco** menciona um adversário, o sistema:
1. Cria um registro de ataque
2. Cria um alerta de alto risco
3. Atualiza o Share of Voice

## 💡 Dicas

1. **Use nomes completos** ao cadastrar adversários para melhor detecção
2. **Configure feeds específicos** para cada adversário no Google Alerts
3. **Revise periodicamente** os tipos de ataque detectados para ajustar palavras-chave
4. **Monitore o Share of Voice** para entender a presença de cada adversário nas notícias

## 🔄 Próximos Passos

- [ ] Dashboard de análise de adversários
- [ ] Gráficos de evolução do Share of Voice
- [ ] Alertas por email quando adversário é mencionado
- [ ] Análise de sentimento específica para menções de adversários
- [ ] Exportação de relatórios de ataques




