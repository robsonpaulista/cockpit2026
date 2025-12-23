# Integração com API do IBGE - Municípios do Piauí

## ✅ Implementação Completa

### 📋 O que foi feito:

1. **Serviço IBGE** (`lib/services/ibge.ts`)
   - Função `fetchMunicipiosPiaui()` que busca todos os 224 municípios do Piauí
   - Usa a API oficial do IBGE: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios`
   - Cache de 24 horas para otimizar performance

2. **API de Cidades** (`app/api/campo/cities/route.ts`)
   - Busca primeiro no banco de dados
   - Se não houver dados, busca do IBGE e sincroniza automaticamente
   - Retorna todos os 224 municípios do Piauí ordenados por nome

3. **Endpoint de Sincronização** (`app/api/campo/cities/sync/route.ts`)
   - Endpoint POST para sincronizar municípios do IBGE manualmente
   - Insere/atualiza no banco com `upsert`
   - Retorna contagem de municípios sincronizados

4. **Schema do Banco** (`database/schema.sql`)
   - Atualizado para aceitar IDs do IBGE (formato: `ibge-{codigo}`)
   - Campo `id` agora é `TEXT` ao invés de apenas UUID
   - Adicionado campo `microrregiao`
   - Constraint UNIQUE em `(name, state)`

5. **Componente de Modal** (`components/agenda-modal.tsx`)
   - Campo de busca para filtrar municípios
   - Loading state enquanto carrega
   - Exibe contador de municípios encontrados
   - Auto-sincronização se não houver dados no banco

### 🚀 Como usar:

#### Opção 1: Automático (Recomendado)
Ao abrir o modal "Nova Agenda", o sistema:
1. Busca municípios do banco
2. Se não houver, busca do IBGE automaticamente
3. Sincroniza no banco para próximas vezes

#### Opção 2: Sincronização Manual
Execute no Supabase SQL Editor ou via endpoint:

```sql
-- Executar o script completo
\i database/seed-cities-ibge.sql
```

Ou via API:
```bash
POST /api/campo/cities/sync
```

### 📊 Dados Incluídos:
- **224 municípios** do Piauí
- Código IBGE completo
- Nome do município
- Estado (PI)
- Mesorregião
- Microrregião

### 🔧 Estrutura de Dados:

```typescript
interface City {
  id: string              // 'ibge-2201000' ou UUID
  name: string            // 'Teresina'
  state: string           // 'PI'
  macro_region: string    // 'Centro-Norte Piauiense'
  microrregiao?: string   // 'Teresina'
  priority: number        // 0-10 (para ordenação)
}
```

### 📝 Notas Técnicas:
- API do IBGE é pública e gratuita
- Cache de 24 horas para reduzir requisições
- IDs do IBGE usam prefixo `ibge-` para evitar conflitos
- Dropdown com busca para facilitar seleção entre 224 municípios
- Ordenação alfabética automática

### 🔄 Atualização Futura:
Para atualizar os dados periodicamente, execute:
```bash
POST /api/campo/cities/sync
```

Ou adicione um cron job que execute essa sincronização periodicamente.




