/**
 * Compat: redireciona para a Biblioteca de Comunicação.
 * @deprecated use @/lib/comunicacao/*
 */
export {
  CANVA_REGRA_BIBLIOTECA as CANVA_REGRA_TEMPLATE,
  COMUNICACAO_SLOTS as CANVA_CAMPOS_EDITAVEIS,
} from '@/lib/comunicacao/types'

export { catalogoBibliotecaComunicacao as listCanvaTemplateMasters } from '@/lib/comunicacao/catalogo'
export { resolverTemplateComunicacao as resolveCanvaMaster } from '@/lib/comunicacao/catalogo'
