# Integração com Google Sheets - Território & Base

## Como Conectar sua Planilha (Com Service Account)

### Passo 1: Criar Service Account no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Vá para **IAM & Admin** > **Service Accounts**
4. Clique em **"Create Service Account"**
5. Preencha:
   - **Nome**: Ex: "Cockpit 2026 Sheets"
   - **Descrição**: "Acesso às planilhas do Território & Base"
6. Clique em **"Create and Continue"**
7. Pule a etapa de permissões (Role) e clique em **"Done"**

### Passo 2: Criar e Baixar Credenciais JSON

1. Na lista de Service Accounts, clique no email do Service Account criado
2. Vá para a aba **"Keys"**
3. Clique em **"Add Key"** > **"Create new key"**
4. Selecione **JSON** e clique em **"Create"**
5. O arquivo JSON será baixado automaticamente
6. **IMPORTANTE**: Guarde este arquivo com segurança (não compartilhe)

### Passo 3: Compartilhar Planilha com Service Account

1. Abra sua planilha no Google Sheets
2. Clique em **"Compartilhar"** (botão no canto superior direito)
3. Cole o **email do Service Account** (formato: `nome@projeto.iam.gserviceaccount.com`)
4. Selecione **"Visualizador"** (apenas leitura)
5. Clique em **"Enviar"**
6. **NÃO** marque "Notificar pessoas"

### Passo 4: Configurar no Sistema

1. Acesse a página **"Território & Base"**
2. Clique no botão **"Conectar Planilha"** ou **"Configurar Planilha"**
3. Cole a URL completa da planilha ou apenas o ID
4. Informe o nome da aba (ex: "Sheet1", "Dados", etc.)
5. (Opcional) Especifique um intervalo (ex: "A1:Z100")
6. Informe o **email do Service Account**
7. Abra o arquivo JSON baixado e **cole todo o conteúdo** no campo de credenciais
8. Clique em **"Testar Conexão"** para verificar
9. Clique em **"Salvar Configuração"**

### Segurança

- ✅ As credenciais são armazenadas **apenas no seu navegador** (localStorage)
- ✅ As credenciais **nunca são enviadas para o servidor** (processadas no cliente)
- ✅ Use Service Account com permissões mínimas (apenas leitura)
- ✅ Compartilhe apenas as planilhas necessárias com o Service Account

### Passo 3: Estrutura Recomendada da Planilha

A primeira linha deve conter os cabeçalhos das colunas. Exemplo:

| Nome | Cidade | Score | Status | Telefone | Email |
|------|--------|-------|--------|----------|-------|
| João Silva | São Paulo | 85 | Ativo | (11) 99999-9999 | joao@email.com |
| Maria Santos | Campinas | 78 | Ativo | (19) 88888-8888 | maria@email.com |

### Colunas Recomendadas

O sistema detecta automaticamente colunas comuns:
- **Nome**: colunas com "nome", "name", "lider", "pessoa"
- **Cidade**: colunas com "cidade", "city", "município"
- **Score**: colunas com "score", "pontuação", "nota"
- **Status**: colunas com "status", "ativo", "situação"

### Funcionalidades

- ✅ **Atualização Manual**: Botão "Atualizar" para buscar dados mais recentes
- ✅ **KPIs Automáticos**: Calcula automaticamente:
  - Lideranças Ativas
  - Total de Registros
  - Cidades Únicas
- ✅ **Exibição Flexível**: Mostra todas as colunas da planilha
- ✅ **Configuração Persistente**: Salva a configuração no navegador

### Limitações

- É necessário criar um Service Account no Google Cloud Console
- A planilha precisa ser compartilhada com o email do Service Account
- Dados são buscados em tempo real (não há cache)
- As credenciais são armazenadas localmente no navegador

### Solução de Problemas

**Erro: "Acesso negado" ou "403"**
- Verifique se a planilha foi compartilhada com o email do Service Account
- Verifique se o email do Service Account está correto
- Certifique-se de que o Service Account tem permissão de "Visualizador"

**Erro: "Planilha não encontrada" ou "404"**
- Verifique se o ID da planilha está correto
- Certifique-se de que copiou o ID completo
- Verifique se a planilha existe e está acessível

**Erro: "Credenciais JSON inválidas"**
- Verifique se copiou o conteúdo completo do arquivo JSON
- Certifique-se de que o JSON está válido (sem quebras de linha extras)
- Tente copiar e colar novamente o conteúdo do arquivo

**Erro: "Service Account não encontrado"**
- Verifique se o email do Service Account está correto
- Certifique-se de que o Service Account foi criado corretamente no Google Cloud Console

**Dados não aparecem**
- Verifique se a primeira linha contém cabeçalhos
- Verifique se há dados nas linhas abaixo dos cabeçalhos
- Tente especificar um intervalo (ex: "A1:Z100")

