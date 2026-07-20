# Gestão de Material de Campanha

Controle de estoque físico (panfletos, praguinhas, adesivos, bandeiras…) com entrada/saída, saldo e fila de solicitações (app + WhatsApp).

## Setup

1. Rode no Supabase: `database/create-material-campanha.sql`
2. Se a tabela já existia: `database/add-material-campanha-preco-compra.sql`
3. (Opcional) Liberar página para perfis em Usuários, chave `material-campanha`
4. Webhook WhatsApp: defina `MATERIAL_CAMPANHA_WEBHOOK_TOKEN` no ambiente

## Preço e valor por cidade

- Cada material tem **preço de compra** (`preco_compra`, R$/unidade).
- Nos pedidos, o preço é **congelado** no item (`preco_unitario`) na criação.
- Em cada saída/movimento, grava `preco_unitario` + `valor_total`.
- Com `municipio` no pedido + valor dos itens, dá para somar depois **quanto cada cidade recebeu**.
- Cada mudança de status grava log em `campanha_material_pedido_logs` (quem analisou, aprovou, separou, entregou…).

Migrations extras (se a base já existia):
- `database/add-material-campanha-preco-compra.sql`
- `database/add-material-campanha-pedido-logs.sql`

## UI

`/dashboard/material-campanha`

- Cards por produto + saldo e alerta de mínimo
- **Entrada** / ajuste manual (+ preço na entrada)
- **Saída automática** ao clicar **Entregar** no Kanban (só a partir de Separado)
- Histórico de movimentos
- Solicitações em andamento (fluxo: novo → análise → aprovado → separado → **entregue**)

## APIs

| Método | Rota | Uso |
|--------|------|-----|
| GET/POST | `/api/material-campanha/materiais` | Listar / criar |
| PATCH/DELETE | `/api/material-campanha/materiais/[id]` | Editar / desativar |
| GET/POST | `/api/material-campanha/movimentos` | Histórico / registrar |
| GET/POST | `/api/material-campanha/pedidos` | Pedidos |
| PATCH | `/api/material-campanha/pedidos/[id]` | Status |
| POST | `/api/material-campanha/webhooks/whatsapp` | Pedido via automação |

### Exemplo webhook

```http
POST /api/material-campanha/webhooks/whatsapp
Authorization: Bearer <MATERIAL_CAMPANHA_WEBHOOK_TOKEN>
Content-Type: application/json

{
  "solicitanteNome": "João",
  "solicitanteTelefone": "86999999999",
  "municipio": "Altos",
  "itens": [
    { "codigo": "PANF-01", "quantidade": 200 }
  ]
}
```
