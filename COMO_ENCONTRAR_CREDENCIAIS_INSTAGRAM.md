# Como Encontrar as Credenciais do Instagram

## 📍 Onde Procurar

As credenciais do Instagram no outro projeto estão armazenadas em **variáveis de ambiente**. Aqui estão os locais onde você pode encontrá-las:

### 1. **Arquivo `.env.local` (Local)**
   - **Localização**: `C:\Users\robso\OneDrive\Documentos\Coorporativo\Cursor\mutirao_catarata\.env.local`
   - **Variáveis a procurar**:
     ```env
     INSTAGRAM_TOKEN=EAAH...
     INSTAGRAM_BUSINESS_ID=123456789
     ```
   - ⚠️ **Nota**: Este arquivo pode estar oculto ou não estar no repositório por questões de segurança.

### 2. **Variáveis de Ambiente do Sistema (Windows)**
   - Abra o PowerShell como Administrador
   - Execute:
     ```powershell
     $env:INSTAGRAM_TOKEN
     $env:INSTAGRAM_BUSINESS_ID
     ```

### 3. **Painel da Vercel (Se estiver em produção)**
   - Acesse: https://vercel.com
   - Vá em **Settings** > **Environment Variables**
   - Procure por:
     - `INSTAGRAM_TOKEN`
     - `INSTAGRAM_BUSINESS_ID`

### 4. **No Código (Temporário - para referência)**
   - Arquivo: `src/lib/instagramApi.ts` (linhas 180-183)
   - Arquivo: `src/app/api/instagram/route.ts` (linhas 5-8)
   - ⚠️ **Atenção**: No código geralmente há valores placeholder, não os valores reais.

### 5. **No Navegador (LocalStorage)**
   - Abra o DevTools (F12) no outro projeto
   - Vá na aba **Application** > **Local Storage**
   - Procure por:
     - `instagramToken`
     - `instagramBusinessAccountId`
   - ⚠️ **Nota**: No outro projeto, as credenciais são do servidor, mas pode haver cache no localStorage.

## 🔍 Como Verificar se Encontrou

As credenciais devem ter este formato:

- **INSTAGRAM_TOKEN**: Começa com `EAAH...` e é uma string longa
- **INSTAGRAM_BUSINESS_ID**: É um número (ex: `123456789`)

## 📋 Passos para Copiar

1. **Encontre as credenciais** em um dos locais acima
2. **Copie os valores** (sem aspas)
3. **No projeto atual**, acesse `/dashboard/conteudo`
4. **Clique em "Conectar Instagram"**
5. **Cole as credenciais** nos campos:
   - Access Token: `EAAH...`
   - Business Account ID: `123456789`
6. **Clique em "Validar Credenciais"** para testar
7. **Salve a configuração**

## 🆘 Se Não Encontrar

Se não conseguir encontrar as credenciais:

1. **Verifique se o outro projeto está rodando** e acesse a página do Instagram Analytics
2. **Abra o DevTools** (F12) > Network
3. **Recarregue a página** e procure por requisições para `/api/instagram`
4. **Veja os headers** da requisição (pode conter informações úteis)
5. **Ou gere novas credenciais** seguindo o guia em `INSTAGRAM_SETUP.md`

## 📝 Alternativa: Gerar Novas Credenciais

Se preferir gerar novas credenciais:

1. Acesse: https://developers.facebook.com/tools/explorer/
2. Selecione sua aplicação
3. Adicione permissões: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`
4. Gere um token de longa duração
5. Obtenha o Business Account ID em: https://business.facebook.com/














