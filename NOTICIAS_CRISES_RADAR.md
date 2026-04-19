# 📰 NOTÍCIAS, CRISES & RADAR DE ADVERSÁRIOS - Documentação

## ✅ Schema do Banco de Dados Implementado

### Tabelas Criadas:

1. **`news`** - Inbox de notícias
   - Armazena notícias coletadas de diversas fontes
   - Classificação automática: sentimento, risco, tema
   - Link com crises quando detectado

2. **`crises`** - Gestão de crises
   - Rastreamento de crises detectadas
   - Severidade e status
   - Tempo de resposta
   - Link com narrativas sugeridas

3. **`adversaries`** - Radar de adversários
   - Cadastro de adversários (candidatos, partidos, mídia, influenciadores)
   - Temas que abordam
   - Score de presença (Share of Voice)

4. **`adversary_attacks`** - Registro de ataques
   - Histórico de ataques/menções de adversários
   - Tipos: direto, indireto, falsa afirmação, omissão

5. **`news_alerts`** - Sistema de alertas
   - Alertas enviados para usuários
   - Tipos: risco alto, crise detectada, ataque de adversário, sentimento negativo

---

## 📋 Próximos Passos

### 1. APIs Backend (CRUD)
- [ ] GET /api/noticias - Listar notícias com filtros
- [ ] POST /api/noticias - Criar/importar notícia manualmente
- [ ] PUT /api/noticias/:id - Atualizar notícia (classificação manual)
- [ ] DELETE /api/noticias/:id - Deletar notícia
- [ ] GET /api/noticias/crises - Listar crises
- [ ] POST /api/noticias/crises - Criar crise manualmente
- [ ] PUT /api/noticias/crises/:id - Atualizar status de crise
- [ ] GET /api/noticias/adversarios - Listar adversários
- [ ] POST /api/noticias/adversarios - Cadastrar adversário
- [ ] GET /api/noticias/adversarios/:id/attacks - Histórico de ataques

### 2. Funcionalidades Especiais
- [ ] POST /api/noticias/process - Processar notícias não processadas (NLP)
- [ ] GET /api/noticias/share-of-voice - Calcular Share of Voice
- [ ] POST /api/noticias/:id/respond - Associar resposta/narrativa a notícia
- [ ] GET /api/noticias/timeline - Timeline de crises

### 3. UI/UX
- [ ] Filtros avançados (sentimento, risco, tema, data)
- [ ] Timeline visual de crises
- [ ] Dashboard de adversários
- [ ] Sistema de alertas em tempo real
- [ ] Integração com Banco de Narrativas

### 4. Integrações Externas (Futuro)
- [ ] Google Alerts (RSS)
- [ ] NewsAPI
- [ ] Talkwalker API
- [ ] Análise de sentimento (OpenAI/Google NLP)
- [ ] Monitoramento de redes sociais




