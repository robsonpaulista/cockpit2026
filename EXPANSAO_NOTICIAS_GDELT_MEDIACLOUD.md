# 📰 Expansão do Sistema de Notícias - GDELT e Media Cloud

## ✅ Implementação Completa

### O que foi implementado:

#### 1. **Atualização do Banco de Dados**
- Script de migração: `database/add-source-fields-to-news.sql`
- Novos campos adicionados à tabela `news`:
  - `source_type`: Tipo de fonte ('google_alerts', 'gdelt', 'media_cloud')
  - `publisher`: Domínio/publicador da notícia
  - `reviewed`: Indica se foi revisado/classificado manualmente
  - `notes`: Notas da classificação manual

#### 2. **Serviço GDELT** (`lib/services/gdelt.ts`)
- Função `fetchGDELT()`: Busca artigos do GDELT
- Função `fetchGDELTRecent()`: Busca artigos das últimas N horas
- Função `formatGDELTDateTime()`: Formata data/hora para o formato GDELT
- **Características:**
  - API gratuita (sem necessidade de API key)
  - Atualização a cada ~15 minutos
  - Milhões de fontes globais
  - Dados brutos (sem classificação automática)

#### 3. **Serviço Media Cloud** (`lib/services/media-cloud.ts`)
- Função `fetchMediaCloud()`: Busca histórias do Media Cloud
- Função `fetchMediaCloudRecent()`: Busca histórias dos últimos N dias
- Função `validateMediaCloudApiKey()`: Valida API key
- **Características:**
  - Requer API key (obter em: https://www.mediacloud.org/)
  - Projeto acadêmico (MIT/Harvard)
  - Focado em análise qualitativa
  - Dados brutos (sem classificação automática)

#### 4. **APIs de Coleta**
- **`/api/noticias/collect/gdelt`**: Coleta manual do GDELT
- **`/api/noticias/collect/media-cloud`**: Coleta manual do Media Cloud
- **`/api/noticias/collect/gdelt/schedule`**: Coleta agendada do GDELT (para cron jobs)

#### 5. **Atualização do Sistema de Classificação Manual**
- Modal de edição atualizado (`components/edit-news-modal.tsx`)
  - Campo `notes` para notas adicionais
  - Campo `reviewed` marcado automaticamente ao salvar
- API PUT atualizada (`app/api/noticias/[id]/route.ts`)
  - Aceita campos `reviewed` e `notes`
- Tipos TypeScript atualizados (`types/index.ts`)

---

## 🔧 Como Usar

### 1. Executar Migração do Banco de Dados

Execute o script SQL no Supabase SQL Editor:

```sql
-- Arquivo: database/add-source-fields-to-news.sql
```

Isso adicionará os novos campos necessários para suportar as novas fontes.

### 2. Coleta Manual - GDELT

```bash
POST /api/noticias/collect/gdelt
Content-Type: application/json

{
  "query": "Nome do Candidato",
  "maxRecords": 100,
  "hours": 24,  // Opcional: buscar últimas N horas
  "auto_classify": false  // GDELT não classifica automaticamente
}
```

**Parâmetros:**
- `query` (obrigatório): Termos de busca
- `maxRecords` (opcional): Número máximo de registros (padrão: 100, máximo: 250)
- `hours` (opcional): Buscar últimas N horas
- `startDateTime` (opcional): Data/hora de início (formato: YYYYMMDDHHMMSS)
- `endDateTime` (opcional): Data/hora de fim (formato: YYYYMMDDHHMMSS)

### 3. Coleta Manual - Media Cloud

```bash
POST /api/noticias/collect/media-cloud
Content-Type: application/json

{
  "api_key": "sua-api-key-aqui",
  "query": "Nome do Candidato",
  "days": 7,  // Opcional: buscar últimos N dias
  "limit": 100,
  "auto_classify": false  // Media Cloud não classifica automaticamente
}
```

**Parâmetros:**
- `api_key` (obrigatório): API key do Media Cloud
- `query` (obrigatório): Query de busca
- `collections_ids` (opcional): IDs das coleções (formato: "1,2,3")
- `days` (opcional): Buscar últimos N dias
- `start_date` (opcional): Data de início (formato: YYYY-MM-DD)
- `end_date` (opcional): Data de fim (formato: YYYY-MM-DD)
- `limit` (opcional): Limite de resultados (padrão: 100, máximo: 250)

**Obter API Key do Media Cloud:**
1. Acesse: https://www.mediacloud.org/
2. Crie uma conta ou faça login
3. Acesse a área de gerenciamento de API keys
4. Gere uma nova API key
5. Armazene de forma segura

### 4. Coleta Automática - GDELT (Cron Job)

Configure variável de ambiente:

```env
# .env.local
GDELT_QUERIES=Nome do Candidato,Nome do Candidato + Piauí,Nome do Candidato + eleições
CRON_SECRET=seu-secret-token-aqui
```

Configure cron job (exemplo com Vercel Cron):

```json
// vercel.json
{
  "crons": [{
    "path": "/api/noticias/collect/gdelt/schedule",
    "schedule": "*/30 * * * *"  // A cada 30 minutos
  }]
}
```

Ou via chamada HTTP:

```bash
POST /api/noticias/collect/gdelt/schedule
Authorization: Bearer seu-secret-token-aqui
```

---

## 📊 Fluxo de Trabalho

### 1. **Coleta Automática (GDELT)**
- Job agendado executa a cada 30 min ou 1h
- Busca por termos configurados em `GDELT_QUERIES`
- Armazena dados brutos (sem classificação)
- Marca `reviewed: false` e `processed: false`

### 2. **Coleta Manual (Media Cloud)**
- Executado sob demanda
- Requer API key do Media Cloud
- Armazena dados brutos (sem classificação)
- Ideal para análise semanal ou quinzenal

### 3. **Classificação Manual**
- Operador analisa notícias não revisadas
- Define: sentimento, risco, tema
- Adiciona notas (campo `notes`)
- Sistema marca `reviewed: true` automaticamente

---

## 🎯 Diferenciais das Fontes

### Google Alerts (Existente)
- **Foco**: Alertas direcionados
- **Velocidade**: Tempo real
- **Classificação**: Opcional (automática ou manual)
- **Uso**: Monitoramento contínuo

### GDELT (Novo)
- **Foco**: Cobertura ampla, volume
- **Velocidade**: A cada ~15 minutos
- **Classificação**: Manual (dados brutos)
- **Uso**: Capturar menções que não chegam via Alerts
- **Gratuito**: ✅

### Media Cloud (Novo)
- **Foco**: Análise qualitativa, narrativas
- **Velocidade**: Menos tempo real
- **Classificação**: Manual (dados brutos)
- **Uso**: Análise estratégica semanal/quinzenal
- **Gratuito**: ✅ (requer API key)

---

## 🔍 Filtros e Visualizações

As notícias de todas as fontes aparecem na mesma interface, mas podem ser filtradas por:

- **Fonte**: `source_type` (google_alerts, gdelt, media_cloud)
- **Status de Revisão**: `reviewed` (true/false)
- **Processamento**: `processed` (true/false)
- **Sentimento**: positive, negative, neutral
- **Risco**: low, medium, high
- **Tema**: Todos os temas disponíveis

---

## 📝 Notas Importantes

1. **GDELT não classifica automaticamente**: Dados são armazenados brutos para classificação manual posterior
2. **Media Cloud requer API key**: Obter em https://www.mediacloud.org/
3. **Classificação manual é o fluxo oficial**: Operador analisa e classifica cada item
4. **Todas as fontes complementam o Google Alerts**: Não substituem, expandem a cobertura
5. **Histórico auditável**: Todas as classificações manuais ficam registradas

---

## 🚀 Próximos Passos (Sugeridos)

1. Configurar variável `GDELT_QUERIES` com termos relevantes
2. Obter API key do Media Cloud (se necessário)
3. Configurar cron job para coleta automática do GDELT
4. Treinar operadores no fluxo de classificação manual
5. Criar dashboards específicos para análise de volume por fonte

---

## 📚 Referências

- **GDELT**: https://blog.gdeltproject.org/gdelt-2-0-api-debuts/
- **Media Cloud**: https://www.mediacloud.org/documentation/search-api-guide
- **Google Alerts**: https://www.google.com/alerts
