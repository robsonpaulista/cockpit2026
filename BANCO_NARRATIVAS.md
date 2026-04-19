# 📝 BANCO DE NARRATIVAS - Documentação

## 🎯 Finalidade

O **Banco de Narrativas** é um módulo estratégico do Cockpit 2026 que serve como **biblioteca centralizada de mensagens, argumentos e provas** para garantir **coerência comunicacional** e evitar improviso durante a campanha eleitoral.

### Objetivos Principais:

1. **Garantir Coerência**
   - Centraliza todas as narrativas oficiais da campanha
   - Evita mensagens contraditórias entre diferentes interlocutores
   - Mantém alinhamento com a estratégia comunicacional

2. **Evitar Improviso**
   - Fornece respostas prontas e testadas para temas comuns
   - Reduz erros de comunicação em situações de pressão
   - Acelera tempo de resposta em entrevistas, debates e redes sociais

3. **Suporte Decisório**
   - Oferece argumentos embasados para cada tema
   - Anexa provas (dados, fotos, entregas) que fundamentam as narrativas
   - Rastreia performance e eficácia de cada narrativa

4. **Otimização Contínua**
   - Monitora uso e performance de cada narrativa
   - Permite ajustes baseados em dados reais
   - Versionamento para evoluir mensagens ao longo da campanha

---

## 📊 Estrutura do Banco de Dados

### Tabela: `narratives`

Armazena as narrativas principais com seus elementos:

```sql
CREATE TABLE narratives (
  id UUID PRIMARY KEY,
  theme TEXT NOT NULL,                    -- Tema: "Saúde", "Educação", "Infraestrutura", etc.
  target_audience TEXT NOT NULL,          -- Público-alvo: "Famílias", "Jovens", "Empresários", etc.
  key_message TEXT NOT NULL,              -- Mensagem-chave principal
  arguments JSONB DEFAULT '[]',           -- Array de argumentos de defesa
  proofs JSONB DEFAULT '[]',              -- Array de provas (fotos, dados, links)
  tested_phrases JSONB DEFAULT '[]',      -- Frases testadas e validadas
  usage_count INTEGER DEFAULT 0,          -- Quantas vezes foi usada
  performance_score INTEGER DEFAULT 0,    -- Score de performance (0-100)
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Campos Explicados:**

- **`theme`**: Categoria temática da narrativa (Saúde, Educação, Segurança, Economia, etc.)
- **`target_audience`**: Público específico para quem a narrativa é direcionada
- **`key_message`**: A mensagem principal que deve ser transmitida
- **`arguments`**: Lista de argumentos estruturados que sustentam a narrativa
  - Exemplo: `["Ampliação de 50% nos postos de saúde", "Medicamentos gratuitos em todas as unidades"]`
- **`proofs`**: Evidências concretas que comprovam os argumentos
  - Exemplo: `[{"type": "photo", "url": "...", "description": "Posto inaugurado"}, {"type": "data", "source": "Secretaria de Saúde", "value": "50 novos postos"}]`
- **`tested_phrases`**: Frases pré-testadas e aprovadas para uso público
  - Exemplo: `["Garantimos acesso universal à saúde de qualidade", "Nossa prioridade é cuidar das pessoas"]`
- **`usage_count`**: Contador automático de quantas vezes a narrativa foi usada
- **`performance_score`**: Score calculado baseado em engajamento, aceitação, resultados

### Tabela: `narrative_usage`

Rastreia o uso de cada narrativa para analytics:

```sql
CREATE TABLE narrative_usage (
  id UUID PRIMARY KEY,
  narrative_id UUID REFERENCES narratives(id),
  used_by UUID REFERENCES profiles(id),    -- Quem usou
  used_in TEXT,                             -- Onde foi usada: "entrevista", "rede-social", "debate", etc.
  date DATE NOT NULL,                       -- Quando foi usada
  result TEXT,                              -- Resultado/feedback do uso
  created_at TIMESTAMPTZ
);
```

---

## 🔧 Funcionalidades Planejadas

### 1. **CRUD Completo de Narrativas**
   - Criar, editar, visualizar e deletar narrativas
   - Versionamento (manter histórico de versões)
   - Status (ativa, rascunho, arquivada)

### 2. **Busca e Filtros**
   - Buscar por tema
   - Filtrar por público-alvo
   - Buscar por palavra-chave na mensagem
   - Ordenar por performance ou uso

### 3. **Sugestão Automática**
   - Sistema sugere narrativas baseado em:
     - Tema emergente (detectado em notícias/crises)
     - Contexto da conversa/reunião
     - Perfil do público-alvo

### 4. **Analytics e Performance**
   - Dashboard de uso por narrativa
   - Gráficos de performance ao longo do tempo
   - Identificar narrativas mais eficazes
   - Detectar narrativas que precisam de ajuste

### 5. **Integração com Outros Módulos**
   - **Campo & Agenda**: Sugerir narrativas antes de visitas
   - **Notícias & Crises**: Alertar narrativa adequada para crise detectada
   - **Conteúdo & Redes Sociais**: Sugerir narrativas para posts
   - **WhatsApp**: Bot com acesso ao banco para respostas rápidas

### 6. **Gestão de Provas**
   - Upload de fotos, vídeos, documentos
   - Links para fontes de dados oficiais
   - Organização por categoria de prova
   - Validação de veracidade

---

## 💡 Exemplos de Uso

### Cenário 1: Preparação para Entrevista
**Situação**: Candidato tem entrevista sobre saúde pública amanhã.

**Uso do Banco**:
1. Buscar narrativas com tema "Saúde"
2. Selecionar narrativa para público "Imprensa"
3. Revisar argumentos e provas anexadas
4. Estudar frases testadas para usar durante a entrevista

### Cenário 2: Resposta Rápida em Redes Sociais
**Situação**: Críticas nas redes sobre educação aparecem.

**Uso do Banco**:
1. Sistema detecta tema "Educação" no radar de crises
2. Sugere automaticamente narrativa pré-definida
3. Equipe de comunicação usa narrativa sugerida
4. Sistema registra uso automaticamente

### Cenário 3: Visita a Município
**Situação**: Agenda de visita a cidade com foco em infraestrutura.

**Uso do Banco**:
1. Sistema associa narrativa de "Infraestrutura" à agenda
2. Sugere argumentos específicos para apresentar na visita
3. Fornece provas locais (obras, investimentos) para usar no discurso

---

## 📈 Métricas e KPIs

- **Narrativas mais usadas**: Identifica mensagens-chave da campanha
- **Performance média**: Avalia efetividade geral das narrativas
- **Cobertura temática**: Garante que todos os temas importantes têm narrativa
- **Taxa de uso vs. criação**: Indica se há narrativas não utilizadas
- **Evolução de performance**: Detecta se narrativas melhoram com o tempo

---

## 🔐 Permissões e Acesso

- **Candidato/Coordenação**: Acesso total (CRUD)
- **Comunicação**: Leitura + Uso + Registro de performance
- **Articulação**: Leitura + Uso (para reuniões e contatos)
- **Outros**: Apenas leitura

---

## 🚀 Status Atual

- ✅ **Schema do banco criado** (`narratives` e `narrative_usage`)
- ✅ **Interface básica criada** (página com listagem)
- 🟡 **Backend APIs**: A implementar
- 🟡 **Funcionalidades avançadas**: A implementar
- 🔴 **Integrações com outros módulos**: Pendente

---

## 📝 Próximos Passos

1. Implementar APIs completas (CRUD)
2. Criar modal de criação/edição de narrativas
3. Implementar sistema de upload de provas (Supabase Storage)
4. Desenvolver sistema de busca e filtros
5. Implementar analytics e dashboards de performance
6. Integrar com módulos de Campo, Notícias e Conteúdo




