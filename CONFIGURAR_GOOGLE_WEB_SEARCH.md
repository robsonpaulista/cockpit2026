# Busca web no Radar de Notícias (Google Programmable Search)

Guia para ativar a **coleta automatizada** na busca do Google.com (sites, Instagram indexado, etc.), em paralelo ao RSS do Google Notícias.

O cockpit **não** coloca uma caixa de busca na página. O backend chama a API e grava os resultados no Supabase quando você clica **Atualizar** na aba **Notícias** do monitoramento.

---

## Visão geral

| Canal | O que é | Variável / requisito |
|--------|---------|----------------------|
| Google Notícias (RSS) | Matérias de veículos | Já funciona sem CSE |
| Busca web (API) | google.com + Instagram indexado | `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ID` |

---

## Passo 1 — Migration no Supabase

Execute no SQL Editor do Supabase:

```sql
-- Arquivo: database/add-google-news-web-search-columns.sql
```

Isso adiciona `collect_channel` e `platform` em `google_news_mentions`.

---

## Passo 2 — Ativar a Custom Search API (Google Cloud)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione o projeto do Cockpit (ou crie um)
3. Menu **APIs e serviços** → **Biblioteca**
4. Pesquise **Custom Search API**
5. Clique em **Ativar** / **Enable**

### Criar a API Key

1. **APIs e serviços** → **Credenciais**
2. **Criar credenciais** → **Chave de API**
3. Copie a chave (recomendado: restrinja a chave só à **Custom Search API**)
4. Guarde para o Passo 5

---

## Passo 3 — Criar o mecanismo de pesquisa (Programmable Search)

1. Acesse [Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all)
2. Clique em **Adicionar** / **Add**
3. Preencha:
   - **Nome do mecanismo de pesquisa:** ex. `buscas indexadas`
   - **Selecione sites ou páginas para pesquisar:** a tela pede sites, mas isso é só o cadastro inicial. Digite **qualquer URL** para passar, por exemplo:
     ```
     instagram.com/*
     ```
   - Clique em **Adicionar** ao lado do campo
4. **Pesquisa de imagens:** opcional (pode deixar desligado)
5. **SafeSearch:** opcional
6. Clique em **Criar**

> A URL inicial **não** limita a busca para sempre. O importante é o próximo passo.

---

## Passo 4 — Ativar “Pesquisar em toda a web” (obrigatório)

Sem isso, a API só busca nos sites que você listou na criação.

1. Na lista de mecanismos, abra o que você criou (`buscas indexadas`)
2. Menu lateral **Configuração** (ou **Setup**)
3. Aba **Básico** / **Basic**
4. Ative **Pesquisar em toda a web** / **Search the entire web**
5. Clique em **Atualizar** / **Save**

### Onde copiar o ID do mecanismo (cx)

Na mesma área de configuração, copie o **ID do mecanismo de pesquisa** / **Search engine ID** (formato parecido com `a1b2c3d4e5f6g7h8i`).

Esse valor vai em `GOOGLE_CSE_ID`.

---

## Passo 5 — Variáveis de ambiente

### Local (`.env.local`)

```env
GOOGLE_CSE_API_KEY=sua_chave_da_custom_search_api
GOOGLE_CSE_ID=seu_search_engine_id
```

Alternativas aceitas pelo código:

- `GOOGLE_API_KEY` no lugar de `GOOGLE_CSE_API_KEY`
- `GOOGLE_PROGRAMMABLE_SEARCH_CX` no lugar de `GOOGLE_CSE_ID`

### Vercel (produção)

1. Projeto → **Settings** → **Environment Variables**
2. Adicione as duas variáveis acima
3. **Redeploy** após salvar

---

## Passo 6 — Testar

### 6.1 Verificar se a API reconhece a configuração

Com o servidor rodando, abra no navegador ou via curl:

```
GET /api/google-news/collect
```

Resposta esperada:

```json
{
  "providers": ["google-news-rss", "google-web-search"],
  "webSearchEnabled": true,
  ...
}
```

Se `webSearchEnabled` for `false`, revise as variáveis de ambiente e reinicie o servidor.

### 6.2 Rodar a coleta

1. Abra **Radar Eleitoral** → aba **Notícias**
2. Clique em **Atualizar**
3. A mensagem deve incluir something like: `X na busca web (sites, Instagram…)`

### 6.3 Conferir no painel

Ao expandir um candidato, cada menção mostra:

- **Plataforma:** Site, Instagram, Facebook…
- **Canal:** Google Notícias ou Busca Google

---

## O que o cockpit busca automaticamente

Para cada candidato ativo, na **busca web**:

1. **Busca geral** — termos do candidato (ex.: `pacto pelos animais piaui`, ou vários termos com `OR` para Instagram Causa Animal)
2. **Busca Instagram** — `site:instagram.com (...)` com os mesmos termos

Isso complementa o RSS do Google Notícias, que foca em matérias de portais.

---

## Limites e custos

- Plano gratuito da Custom Search API: **100 consultas/dia**
- Cada candidato usa **2 consultas web** por coleta (geral + Instagram)
- Exemplo: 10 candidatos × 2 = **20 consultas** por clique em Atualizar
- RSS do Google Notícias **não** consome cota da Custom Search API

---

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| Banner “Busca web desativada” | Env vars ausentes | Passo 5 + redeploy |
| `403` / API key invalid | API não ativada ou chave errada | Passo 2 |
| Poucos resultados Instagram | Conteúdo não indexado pelo Google | Normal para posts privados; busca web só pega o que o Google indexa |
| Só sites da lista inicial | “Pesquisar em toda a web” desligado | Passo 4 |
| Erro coluna `collect_channel` | Migration não rodou | Passo 1 |
| `429` / quota exceeded | Limite diário (100) | Reduzir frequência de coleta ou ampliar cota no Google Cloud |

---

## Referência rápida de arquivos no projeto

| Arquivo | Função |
|---------|--------|
| `lib/google-web-search.ts` | Chamada à Custom Search API |
| `lib/google-news-collect.ts` | Coleta RSS + web |
| `lib/google-news-platform.ts` | Detecta Site / Instagram / etc. pela URL |
| `database/add-google-news-web-search-columns.sql` | Colunas no Supabase |
