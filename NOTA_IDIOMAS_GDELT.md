# 🌍 Nota: GDELT e Idiomas

## ⚠️ Comportamento Esperado

O **GDELT** retornar resultados em **outros idiomas** é **comportamento normal e esperado**.

### Por quê?

1. **Base de Dados Global**
   - GDELT monitora milhões de fontes em **todo o mundo**
   - Não filtra automaticamente por idioma
   - Busca em todas as fontes indexadas

2. **Cobertura Internacional**
   - Quando você busca "Brasil", o GDELT encontra notícias:
     - Do Brasil (português)
     - De outros países sobre o Brasil (inglês, espanhol, etc.)
     - De fontes internacionais

3. **Não é um Bug**
   - Isso é uma **característica** do GDELT
   - Complementa o Google Alerts (que é mais direcionado)
   - Traz cobertura internacional que outras fontes não têm

---

## 🔍 Exemplo Real

Quando você busca **"Brasil"** no GDELT:
- ✅ Pode trazer notícias em português (do Brasil)
- ✅ Pode trazer notícias em inglês (de fontes internacionais sobre o Brasil)
- ✅ Pode trazer notícias em espanhol (de fontes latino-americanas)
- ✅ Pode trazer notícias em outros idiomas

**Exemplos de títulos que podem aparecer:**
- "Brazil Economy Grows" (inglês - fonte internacional)
- "Economia brasileira cresce" (português - fonte brasileira)
- "Economía brasileña crece" (espanhol - fonte latino-americana)

---

## 🎯 Como Filtar por Idioma (Futuro)

A API do GDELT suporta filtros, mas não foram implementados ainda. 

**Possíveis melhorias futuras:**
1. Adicionar parâmetro `language` na busca
2. Filtrar resultados por idioma no processamento
3. Adicionar campo `language` na tabela `news`
4. Permitir filtrar por idioma na interface

---

## 💡 Vantagens de Ter Múltiplos Idiomas

### ✅ **Cobertura Internacional**
- Ver como o Brasil é visto no exterior
- Acompanhar cobertura internacional
- Identificar narrativas globais

### ✅ **Fontes Diversas**
- Fontes que o Google Alerts pode não capturar
- Cobertura de eventos internacionais
- Perspectivas diferentes

### ✅ **Complementa Google Alerts**
- Google Alerts: mais focado (geralmente português)
- GDELT: mais amplo (múltiplos idiomas)
- Juntos: cobertura completa

---

## 📊 Comparação de Fontes

| Fonte | Idioma | Cobertura | Foco |
|-------|--------|-----------|------|
| **Google Alerts** | Principalmente português | Direcionado | Brasileiro |
| **GDELT** | Todos os idiomas | Global | Internacional + Nacional |
| **Media Cloud** | Configurável | Acadêmico | Análise qualitativa |

---

## 🔧 O que Fazer Agora

### Opção 1: **Aceitar Múltiplos Idiomas** (Recomendado)
- Vantagem: cobertura completa
- Útil para análise internacional
- Complementa outras fontes

### Opção 2: **Filtrar Manualmente**
- Classificar notícias por idioma
- Usar campo `notes` para marcar idioma
- Filtrar na interface (futuro)

### Opção 3: **Usar Apenas Google Alerts para Português**
- Google Alerts já filtra bem por idioma
- GDELT para cobertura internacional
- Media Cloud para análise qualitativa

---

## 📝 Notas

- **É normal** receber notícias em outros idiomas do GDELT
- Isso **não é um erro** - é uma característica
- Pode ser útil para análise internacional
- Para foco apenas em português, use Google Alerts
- Para cobertura completa, use múltiplas fontes

---

## ✅ Resumo

- ✅ GDELT retornar múltiplos idiomas é **normal**
- ✅ Isso **complementa** o Google Alerts
- ✅ Pode ser **útil** para análise internacional
- ✅ Para filtrar por idioma, use Google Alerts ou filtre manualmente
- ✅ Futuro: implementar filtro por idioma no GDELT
