-- Remove o seed de exemplo da Fila de decisões / alertas.
-- Execute no SQL Editor do Supabase (uma vez).

DELETE FROM war_room_decisoes
WHERE titulo IN (
  'Aprovar nova peça – Rádio',
  'Responder à pesquisa crítica',
  'Definir agenda – Zona Sul',
  'Revisar plano de mídia',
  'Atualizar materiais – Propostas',
  'Alinhar discurso – debate regional',
  'Confirmar equipe de campo – TD Cocais',
  'Publicar corte de vídeo – Instagram',
  'Validar roteiro – rádio interior',
  'Revisar briefing de lideranças',
  'Checar estoque de santinhos',
  'Atualizar mapa de presença'
);
