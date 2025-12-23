# 🧪 Como Testar a Página de Notícias

## ✅ O que foi implementado:

1. **Página conectada às APIs reais**
2. **Botão "Coletar do Google Alerts"** com modal
3. **Filtros** por sentimento e risco
4. **KPIs dinâmicos** (menções 24h, crises abertas, etc.)
5. **Temas em Alta** calculados automaticamente
6. **Radar de Adversários** (quando houver dados)

---

## 🚀 Como Testar:

### Passo 1: Iniciar o servidor

```bash
npm run dev
```

### Passo 2: Acessar a página

1. Faça login no sistema
2. Acesse: `http://localhost:3000/dashboard/noticias`

### Passo 3: Coletar notícias do Google Alerts

1. **Clique no botão "Coletar do Google Alerts"**
2. **Cole a URL do feed RSS** do Google Alerts
   - Exemplo: `https://www.google.com/alerts/feeds/1234567890/12345678901234567890`
3. **Clique em "Coletar Notícias"**
4. Aguarde o processamento (pode levar alguns segundos)

### Passo 4: Verificar resultados

- ✅ Notícias aparecerão na lista
- ✅ KPIs serão atualizados automaticamente
- ✅ Temas em Alta serão calculados
- ✅ Notícias de alto risco gerarão alertas

---

## 📋 Checklist de Teste:

- [ ] Página carrega sem erros
- [ ] KPIs aparecem (mesmo que com valores zero)
- [ ] Botão "Coletar do Google Alerts" abre o modal
- [ ] Modal permite colar URL do RSS
- [ ] Coleta funciona com URL válida
- [ ] Notícias aparecem na lista após coleta
- [ ] Filtros funcionam (sentimento, risco)
- [ ] Temas em Alta aparecem (se houver notícias)
- [ ] Links das notícias abrem em nova aba

---

## 🔍 O que verificar:

### Se não houver notícias:
- Mensagem: "Nenhuma notícia coletada ainda"
- Botão para coletar visível

### Após coletar:
- Notícias aparecem com:
  - Título (clicável se tiver URL)
  - Fonte
  - Data
  - Badges de sentimento (Positivo/Negativo/Neutro)
  - Badges de risco (Alto/Médio/Baixo)
  - Badge de tema (se detectado)

### KPIs:
- **Menções 24h**: Contador de notícias coletadas nas últimas 24h
- **Risco Alto Aberto**: Número de crises de alto risco abertas
- **Tempo de Resposta**: Média de tempo para resolver crises
- **Share of Voice**: Percentual de presença (simplificado)

---

## ⚠️ Troubleshooting:

### Erro: "Erro ao coletar notícias"
- Verifique se a URL do RSS está correta
- Verifique se o feed RSS do Google Alerts está ativo
- Verifique o console do navegador para mais detalhes

### Erro: "Não autenticado"
- Faça login novamente
- Verifique se a sessão não expirou

### Notícias não aparecem:
- Verifique se a coleta foi bem-sucedida (mensagem de sucesso)
- Verifique se há notícias no feed RSS do Google Alerts
- Verifique se as notícias não são duplicadas (sistema evita duplicatas)

### KPIs zerados:
- Normal se ainda não houver dados
- Colete algumas notícias primeiro
- Aguarde alguns minutos para métricas se atualizarem

---

## 🎯 Próximos Passos:

1. **Testar coleta manual** com URL do Google Alerts
2. **Verificar classificação automática** (sentimento, risco, tema)
3. **Configurar coleta automática** (cron job) se desejar
4. **Cadastrar adversários** para o Radar
5. **Criar crises** manualmente se necessário

---

## 💡 Dica:

Para testar rapidamente sem Google Alerts, você pode criar notícias manualmente via API:

```bash
POST /api/noticias
{
  "title": "Teste de notícia",
  "source": "Teste",
  "sentiment": "negative",
  "risk_level": "high",
  "theme": "Saúde"
}
```

Ou usar a interface quando implementarmos o CRUD completo de notícias.




