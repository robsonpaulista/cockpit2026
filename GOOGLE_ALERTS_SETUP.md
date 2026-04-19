# 📰 Integração Google Alerts - Guia de Configuração

## ✅ Implementação Completa

### O que foi criado:

1. **Serviço de Processamento RSS** (`lib/services/google-alerts.ts`)
   - Função `fetchGoogleAlerts()` para buscar e processar feeds RSS
   - Análise automática de sentimento (simplificada)
   - Análise automática de risco
   - Extração automática de tema

2. **API de Coleta Manual** (`/api/noticias/collect/google-alerts`)
   - POST para coletar notícias de um feed RSS específico
   - Classificação automática opcional
   - Detecção de duplicatas
   - Criação automática de alertas para alto risco

3. **API de Coleta Agendada** (`/api/noticias/collect/schedule`)
   - POST para coletar de múltiplos feeds configurados
   - Protegida por secret token
   - Ideal para cron jobs

---

## 🔧 Como Configurar

### Passo 1: Criar Alertas no Google Alerts

1. Acesse [Google Alerts](https://www.google.com/alerts)
2. Faça login com sua conta Google
3. Crie um alerta para cada termo/pessoa que deseja monitorar:
   - Exemplo: "Nome do Candidato"
   - Exemplo: "Nome do Candidato + Piauí"
   - Exemplo: "Nome do Candidato + eleições"
4. Configure a entrega como **"Feed RSS"**
5. Copie a URL do feed RSS

### Passo 2: Configurar no Sistema

#### Opção A: Coleta Manual (via API)

```bash
POST /api/noticias/collect/google-alerts
Content-Type: application/json

{
  "rss_url": "https://www.google.com/alerts/feeds/1234567890/12345678901234567890",
  "auto_classify": true
}
```

#### Opção B: Coleta Automática (Cron Job)

1. Configure variáveis de ambiente:

```env
# .env.local
GOOGLE_ALERTS_RSS_URLS=https://www.google.com/alerts/feeds/123/abc,https://www.google.com/alerts/feeds/456/def
CRON_SECRET=seu-secret-token-aqui
```

2. Configure um cron job (exemplo com Vercel Cron):

```json
// vercel.json
{
  "crons": [{
    "path": "/api/noticias/collect/schedule",
    "schedule": "0 */6 * * *"
  }]
}
```

Ou use GitHub Actions, AWS EventBridge, etc.

3. Chame a API com o secret:

```bash
POST /api/noticias/collect/schedule
Authorization: Bearer seu-secret-token-aqui
```

---

## 📊 Funcionalidades

### Classificação Automática

O sistema classifica automaticamente cada notícia:

- **Sentimento**: positive | negative | neutral
  - Baseado em palavras-chave (pode ser melhorado com NLP)
  
- **Risco**: low | medium | high
  - Alto risco: palavras como "crise", "escândalo", "acusação"
  - Médio risco: "polêmica", "controvérsia", "crítica"
  
- **Tema**: Saúde, Educação, Infraestrutura, Segurança, etc.
  - Extraído automaticamente do conteúdo

### Detecção de Duplicatas

- Verifica URLs antes de inserir
- Evita notícias duplicadas
- Mantém histórico completo

### Alertas Automáticos

- Notícias de alto risco geram alertas automaticamente
- Alertas são enviados para usuários configurados

---

## 🔄 Fluxo de Trabalho

1. **Google Alerts** → Detecta nova notícia
2. **Feed RSS** → Atualiza com nova notícia
3. **Cron Job** → Chama API de coleta (a cada 6 horas, por exemplo)
4. **API** → Busca feed RSS, processa notícias
5. **Classificação** → Analisa sentimento, risco, tema
6. **Banco de Dados** → Insere notícias (evitando duplicatas)
7. **Alertas** → Cria alertas para alto risco
8. **UI** → Mostra notícias na interface

---

## 🚀 Melhorias Futuras

- [ ] Integração com OpenAI/Google NLP para análise de sentimento mais precisa
- [ ] Detecção de adversários mencionados automaticamente
- [ ] Criação automática de crises quando detectado padrão de alto risco
- [ ] Sugestão automática de narrativas baseada no tema
- [ ] Dashboard de monitoramento de feeds
- [ ] Configuração de feeds via UI (não apenas env vars)

---

## 📝 Notas Técnicas

- A análise de sentimento atual é **simplificada** (baseada em palavras-chave)
- Para produção, recomenda-se usar serviços de NLP profissionais
- O feed RSS do Google Alerts pode ter rate limits
- Recomenda-se coletar a cada 4-6 horas para evitar sobrecarga
- URLs de feeds RSS do Google Alerts são únicas e não expiram

---

## 🔐 Segurança

- API de coleta agendada protegida por secret token
- URLs de feeds RSS devem ser mantidas em segredo
- Considerar autenticação adicional para endpoints de coleta manual




