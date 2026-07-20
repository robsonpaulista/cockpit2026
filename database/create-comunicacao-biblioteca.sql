  -- Biblioteca de Comunicação (catálogo oficial Cockpit ↔ Canva)
  -- O Cockpit conhece códigos TPL*; o Canva é só repositório visual.

  CREATE TABLE IF NOT EXISTS comunicacao_categorias (
    codigo TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    pasta_canva TEXT NOT NULL,
    objetivo TEXT,
    quando_usar TEXT,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS comunicacao_templates (
    codigo TEXT PRIMARY KEY,
    categoria TEXT NOT NULL REFERENCES comunicacao_categorias(codigo) ON DELETE RESTRICT,
    versao TEXT NOT NULL DEFAULT 'V1',
    formato TEXT NOT NULL,
    nome_canva TEXT NOT NULL,
    canva_design_url TEXT,
    canva_brand_template_id TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    padrao BOOLEAN NOT NULL DEFAULT false,
    slots TEXT[] NOT NULL DEFAULT ARRAY[
      'cidade','titulo','subtitulo','descricao','numero','metragem','rua','data',
      'parceiro','logo','foto_principal','foto_secundaria','cta','qr_code','hashtag','assinatura'
    ],
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (categoria, versao, formato)
  );

  CREATE INDEX IF NOT EXISTS idx_comunicacao_templates_categoria
    ON comunicacao_templates (categoria, ativo, padrao);

  CREATE INDEX IF NOT EXISTS idx_comunicacao_templates_formato
    ON comunicacao_templates (formato) WHERE ativo = true;

  COMMENT ON TABLE comunicacao_categorias IS
    'Tipos de comunicação (linguagem oficial). Pastas no Canva seguem pasta_canva.';
  COMMENT ON TABLE comunicacao_templates IS
    'Versões/layouts por categoria+formato. Cockpit resolve TPL*; Canva só guarda o visual.';
  COMMENT ON COLUMN comunicacao_templates.padrao IS
    'Se true, é a versão ativa usada quando o Cockpit pede só a categoria.';

  -- ----- Seed categorias -----
  INSERT INTO comunicacao_categorias (codigo, nome, pasta_canva, objetivo, quando_usar, descricao) VALUES
    ('OBRA_IMPACTO', 'Obra impacto', 'Obras', 'Prestação de contas; impulsionamento', 'Obra concluída ou em destaque', 'Divulgação de obra entregue / impacto'),
    ('CIDADE_BENEFICIADA', 'Cidade beneficiada', 'Obras', 'Prestação de contas; mobilização', 'Cidade contemplada por entrega', 'Cidade contemplada'),
    ('PRESTACAO_CONTAS', 'Prestação de contas', 'Prestação de Contas', 'Prestação de contas', 'Resultado do mandato / entrega', 'Resultado institucional'),
    ('AGENDA_CHEGADA', 'Agenda chegada', 'Agenda', 'Agenda; mobilização', 'Antes/durante visita', 'Aviso de agenda / presença'),
    ('FRASE_LOCAL', 'Frase local', 'Mobilização', 'Mobilização; pós-visita', 'Story humanizado', 'Frase emocional local'),
    ('ANTES_DEPOIS', 'Antes e depois', 'Obras', 'Prestação de contas', 'Comparativo visual', 'Comparativo'),
    ('AGRADECIMENTO', 'Agradecimento', 'Agenda', 'Pós-evento', 'Após visita/evento', 'Pós-evento'),
    ('DADO_ESTATISTICO', 'Dado estatístico', 'Institucional', 'Institucional; pesquisa', 'KPI / indicador', 'KPI/Indicadores'),
    ('PESQUISA', 'Pesquisa', 'Institucional', 'Pesquisa eleitoral', 'Divulgação de pesquisa', 'Pesquisa eleitoral'),
    ('HOSPITAL_AMOR', 'Hospital do Amor', 'Bandeiras', 'Bandeira', 'Campanha bandeira', 'Bandeira Hospital do Amor'),
    ('ECA_DIGITAL', 'ECA Digital', 'Bandeiras', 'Bandeira', 'Campanha bandeira', 'Bandeira ECA Digital'),
    ('CAUSA_ANIMAL', 'Causa animal', 'Bandeiras', 'Bandeira', 'Campanha bandeira', 'Bandeira causa animal')
  ON CONFLICT (codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    pasta_canva = EXCLUDED.pasta_canva,
    objetivo = EXCLUDED.objetivo,
    quando_usar = EXCLUDED.quando_usar,
    descricao = EXCLUDED.descricao;

  -- ----- Seed templates V1 (ativos) — URLs Canva vazias até cadastrar -----
  INSERT INTO comunicacao_templates (codigo, categoria, versao, formato, nome_canva, padrao, ativo) VALUES
    ('TPL001', 'OBRA_IMPACTO', 'V1', 'feed', 'Cockpit | OBRA_IMPACTO | V1 | Feed', true, true),
    ('TPL002', 'OBRA_IMPACTO', 'V1', 'story', 'Cockpit | OBRA_IMPACTO | V1 | Story', true, true),
    ('TPL003', 'OBRA_IMPACTO', 'V1', 'reels', 'Cockpit | OBRA_IMPACTO | V1 | Reels', true, true),
    ('TPL004', 'CIDADE_BENEFICIADA', 'V1', 'feed', 'Cockpit | CIDADE_BENEFICIADA | V1 | Feed', true, true),
    ('TPL005', 'CIDADE_BENEFICIADA', 'V1', 'story', 'Cockpit | CIDADE_BENEFICIADA | V1 | Story', true, true),
    ('TPL006', 'CIDADE_BENEFICIADA', 'V1', 'reels', 'Cockpit | CIDADE_BENEFICIADA | V1 | Reels', true, true),
    ('TPL007', 'AGENDA_CHEGADA', 'V1', 'feed', 'Cockpit | AGENDA_CHEGADA | V1 | Feed', true, true),
    ('TPL008', 'AGENDA_CHEGADA', 'V1', 'story', 'Cockpit | AGENDA_CHEGADA | V1 | Story', true, true),
    ('TPL009', 'PRESTACAO_CONTAS', 'V1', 'feed', 'Cockpit | PRESTACAO_CONTAS | V1 | Feed', true, true),
    ('TPL010', 'PRESTACAO_CONTAS', 'V1', 'story', 'Cockpit | PRESTACAO_CONTAS | V1 | Story', true, true),
    ('TPL011', 'FRASE_LOCAL', 'V1', 'story', 'Cockpit | FRASE_LOCAL | V1 | Story', true, true),
    ('TPL012', 'FRASE_LOCAL', 'V1', 'feed', 'Cockpit | FRASE_LOCAL | V1 | Feed', true, true)
  ON CONFLICT (codigo) DO UPDATE SET
    nome_canva = EXCLUDED.nome_canva,
    padrao = EXCLUDED.padrao,
    ativo = EXCLUDED.ativo,
    updated_at = now();
