# Extrair último andamento SEI (andamento/Aberto)

O site do SEI (Governo do Piauí) exibe o **último status** do processo na tabela **Histórico de Andamentos**, na linha com classe `andamentoAberto`. Este documento descreve como obter esses dados para todas as obras com link do SEI preenchido.

## Opção 1: Atualização automática (na tela Obras)

1. Na página **Obras**, clique em **Atualizar andamentos SEI**.
2. O sistema tenta acessar cada link SEI (um por vez, com intervalo de alguns segundos para evitar bloqueio).
3. Se o site do governo bloquear (403, captcha, etc.), use a **Opção 2**.

## Opção 2: Extração manual (web scraping no navegador)

Quando o acesso automático for bloqueado, faça a extração direto no navegador:

### Passo a passo

1. **Abra o link do SEI** da obra no navegador (o mesmo link que está cadastrado na coluna SEI).
2. Na página do processo, abra a aba que mostra o **Histórico de Andamentos** (ex.: "Autuação" ou a aba onde aparece a tabela "Lista de Andamentos").
3. Pressione **F12** para abrir as Ferramentas do Desenvolvedor e vá na aba **Console**.
4. **Cole o script abaixo** no Console e pressione **Enter**.

```javascript
(function() {
  var tbl = document.getElementById('tblHistorico');
  if (!tbl) { console.log('Tabela tblHistorico não encontrada. Abra a aba com Histórico de Andamentos.'); return; }
  var row = tbl.querySelector('tr.andamentoAberto');
  if (!row) { console.log('Linha andamentoAberto não encontrada.'); return; }
  var tds = row.querySelectorAll('td');
  var data = tds[0] ? tds[0].innerText.trim() : '';
  var descricao = Array.from(tds).slice(1).map(function(t) { return t.innerText.trim(); }).filter(Boolean).join(' | ');
  var out = { data: data, descricao: descricao || 'Andamento aberto' };
  console.log(JSON.stringify(out));
  if (typeof copy === 'function') copy(JSON.stringify(out));
  return out;
})();
```

5. O resultado será exibido no Console (e copiado para a área de transferência, se o navegador tiver a função `copy`). Exemplo:
   ```json
   {"data":"28/01/2026 11:57","descricao":"Processo remetido pela unidade | IDEPI-PI/GAB"}
   ```
6. **Repita os passos 1–5** para cada obra que tem link do SEI.
7. Na tela **Obras**, clique em **Importar andamentos (manual)**.
8. Monte um array JSON com um objeto por obra, no formato:
   ```json
   [
     { "obraId": "uuid-da-obra-1", "sei_ultimo_andamento": "Processo remetido pela unidade", "sei_ultimo_andamento_data": "2026-01-28T14:57:00.000Z" },
     { "obraId": "uuid-da-obra-2", "sei_ultimo_andamento": "Outro andamento", "sei_ultimo_andamento_data": "2026-01-27T10:00:00.000Z" }
   ]
   ```
   - `obraId`: ID da obra no Cockpit (pode ser copiado na própria tela ao abrir o modal de importação).
   - `sei_ultimo_andamento`: texto da descrição (ex.: "Processo remetido pela unidade").
   - `sei_ultimo_andamento_data`: data/hora em formato ISO (ex.: `2026-01-28T14:57:00.000Z`) ou no formato exibido no SEI (`DD/MM/YYYY HH:mm`).

9. Cole o array no campo de texto do modal e clique em **Importar**.

## Estrutura da página SEI (referência)

- **Tabela:** `id="tblHistorico"`, `summary="Histórico de Andamentos"`.
- **Linha do último status:** `<tr class="andamentoAberto" data-atividade="...">`.
- **Células:** primeira `td` = data/hora; demais = unidade e descrição do andamento.

Se o governo alterar a estrutura do HTML, o script e a API de extração automática podem precisar de ajuste.
