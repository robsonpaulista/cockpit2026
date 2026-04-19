# 📋 PLANO DE IMPLEMENTAÇÃO MÓDULO A MÓDULO

## 🎯 Objetivo
Implementar módulo a módulo as integrações, funcionalidades e necessidades do Cockpit 2026.

---

## 📊 Ordem de Prioridade (Roadmap)

### FASE 1 - Fundação (MVP Core)
1. **Autenticação & Permissões** 🔐
2. **Banco de Dados & Configuração** 💾
3. **Visão Geral (Dashboard)** - Dados Reais 📊

### FASE 2 - Módulos Operacionais
4. **Fases da Campanha** 📅
5. **Campo & Agenda** 🗺️
6. **Território & Base (CRM)** 👥

### FASE 3 - Comunicação
7. **Banco de Narrativas** 📝
8. **Conteúdo & Redes Sociais** 📱
9. **WhatsApp & Comunidades** 💬

### FASE 4 - Inteligência & Monitoramento
10. **Notícias, Crises & Radar** 📰
11. **Pesquisa & Relato de Rua** 📈

### FASE 5 - Operação & Compliance
12. **Mobilização & Voluntários** ✊
13. **Operação & Equipe** ⚙️
14. **Jurídico & Compliance** ⚖️
15. **Relatórios** 📄

---

## 🔧 MÓDULO 1: AUTENTICAÇÃO & PERMISSÕES

### Necessidades
- ✅ Sistema de login/logout
- ✅ Perfis de acesso (Candidato, Coordenação, Comunicação, etc.)
- ✅ Controle de permissões por módulo
- ✅ Refresh token
- ✅ Middleware de autenticação

### Tecnologias
- NextAuth.js ou Clerk
- JWT tokens
- Cookies seguros

### Banco de Dados
```sql
users (id, email, name, role, created_at)
sessions (id, user_id, token, expires_at)
permissions (id, role, module, access_level)
```

### Status: 🔴 Não iniciado

---

## 💾 MÓDULO 2: BANCO DE DADOS & CONFIGURAÇÃO

### Necessidades
- ✅ Escolher DB (PostgreSQL, MongoDB, Supabase)
- ✅ ORM/Query Builder (Prisma, Drizzle)
- ✅ Schema inicial
- ✅ Migrations
- ✅ Seeds para desenvolvimento

### Opções de Banco
1. **Supabase** (Recomendado para MVP rápido)
   - PostgreSQL gerenciado
   - Auth integrado
   - Storage para mídias
   - Real-time subscriptions

2. **PostgreSQL + Prisma**
   - Mais controle
   - Self-hosted ou cloud

3. **MongoDB**
   - Flexível para documentos
   - Menos estruturado

### Schema Principal (visão geral)
```typescript
// Usuários e autenticação
User, Session, Permission

// Campanha
Campaign, CampaignPhase

// Campo
Agenda, Visita, Demanda, Promessa

// Base
Leadership, Territory, City, SupportScore

// Conteúdo
Content, Narrative, Post, Campaign

// Monitoramento
News, Alert, Crisis, Adversary

// Operação
Task, Team, SLA

// Jurídico
LegalDocument, Approval, Restriction
```

### Status: 🔴 Não iniciado

---

## 📊 MÓDULO 3: VISÃO GERAL (Dashboard) - Dados Reais

### Necessidades Atuais (Mock)
- ✅ KPIs: IFE, Presença, Base, Engajamento, Sentimento, Risco
- ✅ Gráficos de tendência
- ✅ Alertas críticos
- ✅ Ações recomendadas

### Necessidades Reais
- 🔴 Calcular IFE em tempo real (agregar dados de múltiplos módulos)
- 🔴 Buscar alertas do banco
- 🔴 Agregar métricas de todos os módulos
- 🔴 Cache para performance

### Integrações Necessárias
- Dados de Campo → Presença Territorial
- Dados de Base → Capilaridade
- Dados de Redes → Engajamento Útil
- Dados de Notícias → Sentimento Público
- Dados de Alertas → Risco de Crise

### APIs Internas
```typescript
GET /api/dashboard/kpis
GET /api/dashboard/trends
GET /api/dashboard/alerts
GET /api/dashboard/actions
```

### Status: 🟡 Estrutura criada, precisa integração

---

## 📅 MÓDULO 4: FASES DA CAMPANHA

### Necessidades
- ✅ CRUD de fases
- ✅ Ativar/desativar fase
- ✅ Configurações por fase (indicadores, restrições, automações)
- ✅ Validação de datas
- ✅ Notificações ao mudar fase

### Banco de Dados
```sql
campaign_phases (
  id, name, start_date, end_date, 
  active, indicators, restrictions, 
  automations, created_at
)
```

### Funcionalidades
- Calendário de fases
- Impacto em outros módulos quando fase muda
- Histórico de mudanças

### Status: 🟡 Estrutura criada, precisa backend

---

## 🗺️ MÓDULO 5: CAMPO & AGENDA

### Necessidades
- ✅ CRUD de agendas
- ✅ Check-in de visita (GPS, fotos, vídeos)
- ✅ Kanban de demandas (Nova → Em andamento → Encaminhado → Resolvido)
- ✅ Gestão de promessas
- ✅ Upload de mídia (fotos/vídeos)
- ✅ Mapa de visitas

### Banco de Dados
```sql
agendas (
  id, date, city_id, type, status,
  description, candidate_id, created_at
)

visits (
  id, agenda_id, checkin_time, checkout_time,
  latitude, longitude, photos[], videos[]
)

demands (
  id, visit_id, title, description, status,
  theme, priority, sla_deadline, resolved_at
)

promises (
  id, visit_id, title, description, 
  status, deadline, fulfilled_at
)
```

### Integrações
- Google Maps API (geocoding, mapas)
- Storage de mídia (Supabase Storage ou S3)
- Google Calendar (sync opcional)

### APIs
```typescript
POST /api/campo/agendas
GET /api/campo/agendas
POST /api/campo/visits/checkin
POST /api/campo/demands
PUT /api/campo/demands/:id/status
POST /api/campo/promises
```

### Status: 🟡 Estrutura criada, precisa backend

---

## 👥 MÓDULO 6: TERRITÓRIO & BASE (CRM Político)

### Necessidades
- ✅ CRUD de lideranças
- ✅ Score de apoio (calculado dinamicamente)
- ✅ Histórico de contatos
- ✅ Mapa da base
- ✅ Filtros e busca
- ✅ Exportação de dados

### Banco de Dados
```sql
leaderships (
  id, name, city_id, role, organization,
  phone, email, support_score, status,
  notes, created_at
)

contacts (
  id, leadership_id, type, date,
  notes, user_id, created_at
)

territories (
  id, city, state, macro_region,
  priority, presence_count, base_count
)

support_history (
  id, leadership_id, score, date, notes
)
```

### Funcionalidades
- Cálculo automático de score (baseado em ações, engajamento)
- Filtros avançados
- Exportação CSV/Excel
- Integração com agenda (sugerir contato)

### APIs
```typescript
GET /api/territorio/leaderships
POST /api/territorio/leaderships
PUT /api/territorio/leaderships/:id/score
GET /api/territorio/cities/cold
POST /api/territorio/contacts
```

### Status: 🟡 Estrutura criada, precisa backend

---

## 📝 MÓDULO 7: BANCO DE NARRATIVAS

### Necessidades
- ✅ CRUD de narrativas
- ✅ Templates por tema/público
- ✅ Argumentos de defesa
- ✅ Anexar provas (dados, fotos, entregas)
- ✅ Analytics de uso
- ✅ Sugestão automática de narrativa

### Banco de Dados
```sql
narratives (
  id, theme, target_audience, key_message,
  arguments[], proofs[], tested_phrases[],
  usage_count, performance_score, created_at
)

narrative_usage (
  id, narrative_id, used_by, used_in,
  date, result
)

narrative_attacks (
  id, narrative_id, news_id, attack_type,
  detected_at
)
```

### Funcionalidades
- Busca por tema/público
- Sugestão automática baseada em tema emergente
- Tracking de performance
- Versionamento de narrativas

### APIs
```typescript
GET /api/narrativas
POST /api/narrativas
GET /api/narrativas/suggest?theme=saude
POST /api/narrativas/:id/use
GET /api/narrativas/:id/performance
```

### Status: 🟡 Estrutura criada, precisa backend

---

## 📱 MÓDULO 8: CONTEÚDO & REDES SOCIAIS

### Necessidades
- ✅ Calendário editorial
- ✅ Kanban de produção (Roteiro → Gravação → Edição → Aprovação → Publicado)
- ✅ Biblioteca de mídias
- ✅ Integração com APIs de redes sociais
- ✅ Métricas de performance
- ✅ A/B testing de copy
- ✅ Automação: marcar como "replicável"

### Banco de Dados
```sql
contents (
  id, title, type, platform, status,
  author_id, scheduled_at, published_at,
  media_urls[], copy, performance_data
)

content_production (
  id, content_id, stage, assigned_to,
  started_at, completed_at, notes
)

content_metrics (
  id, content_id, date, engagement,
  reach, clicks, conversions, retention
)

social_accounts (
  id, platform, account_name, access_token,
  refresh_token, expires_at
)
```

### Integrações
- Instagram Graph API
- Facebook Graph API
- Twitter API v2
- YouTube Data API
- TikTok API (quando disponível)

### APIs
```typescript
POST /api/conteudo
GET /api/conteudo/production
PUT /api/conteudo/:id/stage
GET /api/conteudo/:id/metrics
POST /api/conteudo/:id/publish
GET /api/conteudo/replicables
```

### Status: 🟡 Estrutura criada, precisa backend + integrações

---

## 💬 MÓDULO 9: WHATSAPP & COMUNIDADES

### Necessidades
- ✅ Integração WhatsApp Business API
- ✅ Gestão de opt-in/opt-out
- ✅ Campanhas segmentadas
- ✅ Respostas automáticas
- ✅ Caixinha de dúvidas
- ✅ Métricas (CTR, respostas, conversões)

### Banco de Dados
```sql
whatsapp_contacts (
  id, phone, name, opt_in, opt_in_date,
  tags[], last_interaction, status
)

whatsapp_campaigns (
  id, name, segment, message, scheduled_at,
  sent_count, delivered_count, read_count,
  clicked_count, status
)

whatsapp_messages (
  id, contact_id, direction, content,
  status, sent_at, read_at
)

whatsapp_communities (
  id, name, description, members_count,
  created_at
)
```

### Integrações
- WhatsApp Business API (Meta)
- Twilio (alternativa)
- Evolution API (self-hosted)

### APIs
```typescript
POST /api/whatsapp/campaigns
GET /api/whatsapp/contacts
POST /api/whatsapp/opt-in
GET /api/whatsapp/metrics
POST /api/whatsapp/send
```

### Status: 🟡 Estrutura criada, precisa backend + integrações

---

## 📰 MÓDULO 10: NOTÍCIAS, CRISES & RADAR

### Necessidades
- ✅ Inbox de notícias (Google Alerts, Talkwalker)
- ✅ Classificação automática (tema, sentimento, risco)
- ✅ Linha do tempo de crises
- ✅ Radar de adversários
- ✅ Alerta automático em risco alto
- ✅ Share of Voice

### Banco de Dados
```sql
news (
  id, title, source, url, content,
  sentiment, risk_level, theme, actor,
  published_at, collected_at, processed
)

crises (
  id, news_id, title, severity, status,
  detected_at, resolved_at, response_time
)

adversaries (
  id, name, type, themes[], attacks[],
  presence_score, last_updated
)

news_alerts (
  id, news_id, user_id, type, sent_at
)
```

### Integrações
- Google Alerts (RSS)
- Talkwalker API
- NewsAPI
- Monitoramento de redes sociais
- NLP para análise de sentimento (OpenAI, Google NLP)

### APIs
```typescript
GET /api/noticias
POST /api/noticias/process
GET /api/noticias/crises
GET /api/noticias/adversaries
POST /api/noticias/:id/respond
GET /api/noticias/share-of-voice
```

### Status: 🟡 Estrutura criada, precisa backend + integrações

---

## 📈 MÓDULO 11: PESQUISA & RELATO DE RUA

### Necessidades
- ✅ Importação de pesquisas
- ✅ Séries históricas
- ✅ Relato qualitativo de rua
- ✅ Alertas de variação
- ✅ Visualizações (gráficos, mapas)

### Banco de Dados
```sql
polls (
  id, institute, date, sample_size,
  intent_vote, rejection, recall,
  methodology, file_url
)

poll_data (
  id, poll_id, candidate_id, intent,
  rejection, recall, region
)

street_reports (
  id, city_id, date, reporter_id,
  mood, recurring_phrases[], general_feeling,
  notes, created_at
)
```

### Funcionalidades
- Upload de PDF/Excel de pesquisas
- Extração automática de dados
- Gráficos de tendência
- Alertas quando houver queda significativa

### APIs
```typescript
POST /api/pesquisa/import
GET /api/pesquisa/trends
POST /api/pesquisa/street-reports
GET /api/pesquisa/alerts
```

### Status: 🟡 Estrutura criada, precisa backend

---

## ✊ MÓDULO 12: MOBILIZAÇÃO & VOLUNTÁRIOS

### Necessidades
- ✅ Cadastro de voluntários
- ✅ Tipos de apoio (rua, digital, eventos)
- ✅ Tarefas simples
- ✅ Métricas de ações
- ✅ Sugestão de convite para voluntariado

### Banco de Dados
```sql
volunteers (
  id, name, phone, email, support_type,
  city_id, status, joined_at, actions_count
)

volunteer_actions (
  id, volunteer_id, type, description,
  completed_at, result
)

volunteer_tasks (
  id, title, description, type, priority,
  assigned_to, status, deadline
)
```

### Funcionalidades
- Cadastro simplificado
- Tarefas simples e mensuráveis
- Tracking de ações
- Alcance indireto (voluntários → eleitores)

### APIs
```typescript
POST /api/mobilizacao/volunteers
GET /api/mobilizacao/volunteers
POST /api/mobilizacao/tasks
GET /api/mobilizacao/metrics
POST /api/mobilizacao/invite
```

### Status: 🟡 Estrutura criada, precisa backend

---

## ⚙️ MÓDULO 13: OPERAÇÃO & EQUIPE

### Necessidades
- ✅ Kanban por área (Rua, Articulação, Jurídico, etc.)
- ✅ SLA por tipo de demanda
- ✅ Matriz RACI
- ✅ Gargalos e backlog
- ✅ Comunicação interna

### Banco de Dados
```sql
tasks (
  id, title, description, area, priority,
  assigned_to, status, sla_deadline,
  created_at, completed_at
)

teams (
  id, name, area, members[]
)

raci_matrix (
  id, task_type, responsible, accountable,
  consulted, informed
)

slas (
  id, task_type, area, hours, active
)
```

### Funcionalidades
- Kanban visual
- Alertas de SLA próximo do vencimento
- Dashboard de gargalos
- Matriz RACI configurável

### APIs
```typescript
GET /api/operacao/tasks
POST /api/operacao/tasks
PUT /api/operacao/tasks/:id/status
GET /api/operacao/slas
GET /api/operacao/bottlenecks
```

### Status: 🟡 Estrutura criada, precisa backend

---

## ⚖️ MÓDULO 14: JURÍDICO & COMPLIANCE

### Necessidades
- ✅ Checklist por fase
- ✅ Trilha de aprovação
- ✅ Registro de impulsionamento
- ✅ Modo Alerta Jurídico (bloqueia ações sensíveis)
- ✅ Pendências e alertas

### Banco de Dados
```sql
legal_documents (
  id, title, type, phase, status,
  content, approved_by, approved_at,
  submitted_at, legal_notes
)

legal_approvals (
  id, document_id, approver_id, status,
  comments, approved_at
)

legal_restrictions (
  id, phase, restriction_type, description,
  active, blocks_action[]
)

boost_registrations (
  id, content_id, platform, amount_spent,
  target_audience, dates, approved, legal_review
)
```

### Funcionalidades
- Workflow de aprovação
- Bloqueios automáticos conforme fase
- Registro de gastos publicitários
- Histórico de aprovações

### APIs
```typescript
POST /api/juridico/documents
GET /api/juridico/pending
POST /api/juridico/approve
POST /api/juridico/register-boost
GET /api/juridico/alerts
```

### Status: 🟡 Estrutura criada, precisa backend

---

## 📄 MÓDULO 15: RELATÓRIOS

### Necessidades
- ✅ Relatório diário (operacional)
- ✅ Relatório semanal (estratégico)
- ✅ Relatório mensal (tático)
- ✅ Exportação PDF
- ✅ Exportação Excel
- ✅ Agendamento automático

### Funcionalidades
- Templates de relatórios
- Agregação automática de dados
- Exportação formatada
- Envio automático por email

### APIs
```typescript
GET /api/relatorios/diario
GET /api/relatorios/semanal
GET /api/relatorios/mensal
POST /api/relatorios/export?type=pdf
POST /api/relatorios/schedule
```

### Status: 🟡 Estrutura criada, precisa backend

---

## 🔄 PRÓXIMOS PASSOS

### 1. Decisão Técnica: Banco de Dados
- [ ] Escolher entre Supabase, PostgreSQL, ou MongoDB
- [ ] Configurar ambiente de desenvolvimento
- [ ] Criar schema inicial

### 2. Começar FASE 1
- [ ] Implementar Autenticação
- [ ] Configurar Banco de Dados
- [ ] Criar APIs base
- [ ] Conectar Dashboard a dados reais

### 3. Priorizar Módulos
- Decidir qual módulo implementar primeiro baseado em:
  - Urgência do negócio
  - Dependências técnicas
  - Complexidade de integração

---

## 📝 Notas de Implementação

- Todas as APIs devem seguir padrão REST
- Usar TypeScript em todo o código
- Implementar validação de dados (Zod)
- Adicionar tratamento de erros
- Logs para debug e monitoramento
- Testes unitários e de integração (futuro)




