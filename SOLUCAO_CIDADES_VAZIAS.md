# Solução: Tabela Cities Vazia

## Problema
A tabela `cities` está vazia (SELECT COUNT(*) retornou 0), então quando você seleciona uma cidade no dropdown e tenta salvar, a validação não encontra a cidade no banco.

## Solução Imediata

### Opção 1: Sincronizar via API (Recomendado)

Execute no terminal ou via Postman/Insomnia:

```bash
POST http://localhost:3000/api/campo/cities/sync
```

Ou acesse diretamente no navegador (se estiver rodando localmente):
- Abra o DevTools (F12)
- Vá para Console
- Execute:
```javascript
fetch('/api/campo/cities/sync', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
```

### Opção 2: Sincronizar via SQL

Execute no Supabase SQL Editor:

```sql
-- Verificar se há cidades
SELECT COUNT(*) FROM cities;

-- Se retornar 0, execute a sincronização via API ou use o endpoint
```

## O que foi implementado

1. **Sincronização automática no modal**: Quando o modal abre e não há cidades, ele tenta sincronizar automaticamente
2. **Sincronização automática na API**: Quando você tenta salvar uma pesquisa e a tabela está vazia, a API sincroniza automaticamente antes de validar
3. **Validação melhorada**: Tenta encontrar a cidade com diferentes formatos de ID

## Próximos passos

1. Execute a sincronização manual (Opção 1 acima)
2. Verifique se as cidades foram inseridas: `SELECT COUNT(*) FROM cities;` (deve retornar 224)
3. Tente salvar uma pesquisa novamente

Após sincronizar, o problema deve ser resolvido!



