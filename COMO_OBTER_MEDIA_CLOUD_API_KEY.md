# 🔑 Como Obter API Key do Media Cloud

## 📋 Passo a Passo

### 1. **Acessar o Site do Media Cloud**
- URL: https://www.mediacloud.org/
- Ou diretamente: https://www.mediacloud.org/register

### 2. **Criar Conta**
1. Clique em **"Register"** ou **"Sign Up"**
2. Preencha o formulário:
   - Email
   - Nome
   - Senha
   - Organização (opcional, mas recomendado)
   - Finalidade de uso (opcional)

### 3. **Verificar Email**
- Verifique sua caixa de entrada
- Clique no link de verificação enviado por email

### 4. **Fazer Login**
- Acesse: https://www.mediacloud.org/login
- Entre com email e senha

### 5. **Obter API Key**
1. Após login, vá para: **"Settings"** ou **"API Keys"** (geralmente no menu do usuário)
2. Ou acesse diretamente: https://www.mediacloud.org/settings/keys
3. Clique em **"Generate New API Key"** ou **"Create API Key"**
4. Copie a API key gerada

### 6. **Armazenar com Segurança**
- ⚠️ **Importante**: A API key não pode ser recuperada depois
- Salve em local seguro
- Não compartilhe publicamente

---

## 🔧 Como Usar a API Key

### Opção 1: **Coleta Manual (via API)**
Envie a API key no corpo da requisição:

```javascript
// Coleta manual do Media Cloud
fetch('/api/noticias/collect/media-cloud', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: 'SUA_API_KEY_AQUI',
    query: 'Jadyel Alencar',
    days: 7,
    limit: 50,
  })
})
  .then(res => res.json())
  .then(data => console.log('Resultado:', data))
```

### Opção 2: **Coleta Unificada (all-sources)**
Inclua a API key quando usar a API unificada:

```javascript
// Coleta de todas as fontes (incluindo Media Cloud)
fetch('/api/noticias/collect/all-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    include_gdelt: true,
    include_media_cloud: true,  // ✅ Ativar Media Cloud
    media_cloud_api_key: 'SUA_API_KEY_AQUI',  // 🔑 Sua API key
    maxRecords: 50,
    hours: 24,
    days: 7,
  })
})
  .then(res => res.json())
  .then(data => console.log('Resultado:', data))
```

---

## 📝 Notas Importantes

### ✅ **Media Cloud é Gratuito**
- Não requer pagamento
- Requer apenas registro e API key
- Limites de uso podem existir (consulte documentação)

### 🔒 **Segurança**
- **Nunca** commite a API key no código
- **Nunca** compartilhe a API key publicamente
- Use variáveis de ambiente em produção (futuro: implementar)

### 📊 **Uso Recomendado**
- Media Cloud é ideal para análise **semanal ou quinzenal**
- Não é uma ferramenta de alerta rápido
- Foco em análise qualitativa e narrativas

### 🌍 **Idiomas**
- Media Cloud suporta múltiplos idiomas
- Você pode filtrar por idioma na query (futuro: implementar filtros)

---

## 🔄 Limitações Atuais do Sistema

⚠️ **Nota**: Atualmente, a API key precisa ser enviada em cada requisição. 

**Melhorias Futuras Sugeridas:**
1. Armazenar API key no banco de dados (tabela `user_settings`)
2. Ou usar variável de ambiente para API key global
3. Ou criar interface para configurar no perfil do usuário

---

## 🆘 Problemas Comuns

### ❌ "API key inválida"
- Verifique se copiou a API key completa
- Verifique se não há espaços extras
- Verifique se a conta está ativa

### ❌ "Limite de requisições excedido"
- Aguarde alguns minutos
- Verifique os limites da sua conta
- Considere reduzir frequência de requisições

### ❌ "Conta não verificada"
- Verifique seu email
- Complete o processo de verificação

---

## 📚 Referências

- **Site Oficial**: https://www.mediacloud.org/
- **Documentação da API**: https://www.mediacloud.org/documentation/search-api-guide
- **Registro**: https://www.mediacloud.org/register
- **Login**: https://www.mediacloud.org/login

---

## ✅ Checklist

- [ ] Criar conta no Media Cloud
- [ ] Verificar email
- [ ] Fazer login
- [ ] Gerar API key
- [ ] Copiar e salvar API key com segurança
- [ ] Testar API key com requisição de teste
- [ ] Configurar uso regular (se necessário)
