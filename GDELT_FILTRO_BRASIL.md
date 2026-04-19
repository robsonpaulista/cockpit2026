# ✅ GDELT: Termos Corretos e Filtro por Brasil

## ✅ Status Atual

### 1. **Termos Corretos** ✅
O GDELT **já está usando os termos corretos**:
- Usa o campo `name` dos feeds configurados
- Busca com os mesmos termos do Google Alerts
- Implementado na API `/api/noticias/collect/all-sources`

### 2. **Filtro por Brasil** ✅ (Recém Implementado)
Agora o GDELT também **filtra por Brasil**:
- Usa o parâmetro `sourcecountry=BR` na API do GDELT
- Retorna apenas notícias de fontes brasileiras
- Aplicado na coleta unificada (`/api/noticias/collect/all-sources`)

---

## 🔍 Como Funciona

### API do GDELT - Parâmetro `sourcecountry`

O GDELT suporta filtrar por país usando o parâmetro `sourcecountry`:
- **Valor**: Código FIPS de 2 caracteres (ex: `BR`) ou nome do país (ex: `brazil`)
- **Uso**: `sourcecountry=BR` ou `sourcecountry=brazil`

### Implementação

Agora, quando você usa a API unificada (`/api/noticias/collect/all-sources`), o GDELT:
1. ✅ Usa os termos dos feeds (campo `name`)
2. ✅ Filtra por Brasil (`sourcecountry=BR`)
3. ✅ Retorna apenas notícias de fontes brasileiras

---

## 📊 Comparação

### Antes (Sem Filtro)
- Termos corretos ✅
- Sem filtro por país ❌
- Resultados de todo o mundo 🌍

### Agora (Com Filtro)
- Termos corretos ✅
- Filtro por Brasil ✅
- Resultados apenas do Brasil 🇧🇷

---

## 🔧 APIs Afetadas

### ✅ Atualizado
- `/api/noticias/collect/all-sources` - **Agora filtra por Brasil**

### ⚠️ Não Atualizado (Ainda sem filtro)
- `/api/noticias/collect/gdelt` - Coleta manual (sem filtro por padrão)
- `/api/noticias/collect/gdelt/schedule` - Coleta agendada (sem filtro por padrão)

**Nota**: As APIs individuais ainda não têm o filtro, mas podem ser atualizadas se necessário.

---

## 🧪 Como Testar

Execute a coleta unificada:

```javascript
fetch('/api/noticias/collect/all-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    include_gdelt: true,
    include_media_cloud: false,
    maxRecords: 10,
    hours: 24,
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resultado:', data)
    console.log('📊 Por fonte:', data.results)
  })
```

Agora o GDELT retornará apenas notícias de fontes brasileiras! 🇧🇷

---

## 📝 Notas

- O filtro `sourcecountry=BR` filtra por **país da fonte**, não por idioma
- Ainda podem aparecer notícias em outros idiomas (mas de fontes brasileiras)
- Se quiser filtrar por idioma também, seria necessário adicionar o parâmetro `sourcelang` (futuro)
- Media Cloud usa "collections" (diferente do GDELT)

---

## ✅ Resumo

- ✅ **Termos corretos**: Sim, usando campo `name` dos feeds
- ✅ **Filtro por Brasil**: Sim, agora implementado com `sourcecountry=BR`
- ✅ **Funcionando**: Coleta unificada agora filtra por Brasil
