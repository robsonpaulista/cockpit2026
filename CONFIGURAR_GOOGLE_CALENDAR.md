# 📅 Configuração do Google Calendar

## Como Conectar seu Google Calendar

### Passo 1: Criar Service Account no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Vá para **IAM & Admin** > **Service Accounts**
4. Clique em **"Create Service Account"**
5. Preencha:
   - **Nome**: Ex: "Cockpit 2026 Calendar"
   - **Descrição**: "Acesso ao Google Calendar"
6. Clique em **"Create and Continue"**
7. Pule a etapa de permissões (Role) e clique em **"Done"**

### Passo 2: Criar e Baixar Credenciais JSON

1. Na lista de Service Accounts, clique no email do Service Account criado
2. Vá para a aba **"Keys"**
3. Clique em **"Add Key"** > **"Create new key"**
4. Selecione **JSON** e clique em **"Create"**
5. O arquivo JSON será baixado automaticamente
6. **IMPORTANTE**: Guarde este arquivo com segurança (não compartilhe)

### Passo 3: Habilitar Google Calendar API

1. No Google Cloud Console, vá para **APIs & Services** > **Library**
2. Procure por **"Google Calendar API"**
3. Clique em **"Enable"** para habilitar a API

### Passo 4: Compartilhar Calendário com Service Account

1. Abra o [Google Calendar](https://calendar.google.com/)
2. No lado esquerdo, encontre o calendário que deseja compartilhar
3. Clique nos **três pontos** ao lado do nome do calendário
4. Selecione **"Configurações e compartilhamento"**
5. Role até a seção **"Compartilhar com pessoas específicas"**
6. Clique em **"Adicionar pessoas"**
7. Cole o **email do Service Account** (formato: `nome@projeto.iam.gserviceaccount.com`)
8. Selecione o nível de permissão:
   - **"Ver todos os detalhes do evento"** (recomendado para leitura completa)
   - Ou **"Ver apenas disponibilidade (ocultar detalhes)"** (se preferir privacidade)
9. Clique em **"Enviar"**
10. **NÃO** marque "Notificar pessoas"

### Passo 5: Obter o ID do Calendário

O ID do calendário pode ser:

- **"primary"** - Para o calendário principal da conta
- **Email do calendário** - Ex: `seu-email@gmail.com`
- **ID do calendário compartilhado** - Pode ser encontrado nas configurações do calendário

**Como encontrar o ID:**
1. No Google Calendar, vá em **Configurações** > **Configurações do calendário**
2. Role até o calendário desejado
3. O ID aparece no campo **"ID do calendário"** ou **"Integrar calendário"**

### Passo 6: Configurar no Sistema

1. Acesse a página **"Agenda"** no dashboard
2. Clique no botão **"Configurar"** ou **"Reconfigurar"**
3. Preencha os campos:
   - **ID do Calendário**: Use "primary" ou o email/ID do calendário
   - **Email do Service Account**: O email da Service Account criada
   - **Credenciais JSON**: Cole todo o conteúdo do arquivo JSON baixado
4. Clique em **"Testar Conexão"** para verificar
5. Se o teste for bem-sucedido, clique em **"Salvar Configuração"**

## 🔒 Segurança

- ✅ As credenciais são armazenadas **apenas no seu navegador** (localStorage)
- ✅ As credenciais **nunca são enviadas para o servidor** (processadas no cliente)
- ✅ Use Service Account com permissões mínimas (apenas leitura)
- ✅ Não compartilhe o arquivo JSON de credenciais

## 📋 Variáveis de Ambiente (Opcional)

Se preferir configurar no servidor (Vercel), você pode usar:

```
GOOGLE_SERVICE_ACCOUNT_CALENDAR_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SERVICE_ACCOUNT_CALENDAR_EMAIL=calendar@projeto.iam.gserviceaccount.com
```

**Nota**: Se configurar via variáveis de ambiente, não será necessário preencher as credenciais no modal de configuração.

## ❓ Problemas Comuns

### Erro 403: Acesso Negado
- Verifique se o calendário foi compartilhado com o email do Service Account
- Verifique se o nível de permissão está correto

### Erro 404: Calendário Não Encontrado
- Verifique se o ID do calendário está correto
- Use "primary" para o calendário principal

### Erro: API não habilitada
- Certifique-se de que a Google Calendar API está habilitada no Google Cloud Console

## 🎯 Próximos Passos

Após configurar, você poderá:
- Visualizar eventos futuros do seu calendário
- Ver detalhes de eventos (título, descrição, local, participantes)
- Filtrar eventos por data
- Expandir a visualização em tela cheia
