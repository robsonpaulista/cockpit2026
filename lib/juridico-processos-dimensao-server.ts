import fs from 'fs'
import path from 'path'
import { enrichProcessoConsulta } from '@/lib/juridico-consulta-publica'
import { enrichProcessoLinks } from '@/lib/juridico-links-consulta'
import {
  DIMENSAO_PARTY_LABEL,
  processoEnvolveDimensao,
  type ProcessosDimensaoDataset,
} from '@/lib/juridico-processos-dimensao'

let cached: ProcessosDimensaoDataset | null = null

export function loadProcessosDimensaoDataset(): ProcessosDimensaoDataset {
  if (cached) return cached
  const filePath = path.join(process.cwd(), 'data', 'processos-dimensao.json')
  if (!fs.existsSync(filePath)) {
    return {
      geradoEm: '',
      parteFiltro: DIMENSAO_PARTY_LABEL,
      total: 0,
      processos: [],
    }
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProcessosDimensaoDataset
  const processos = (raw.processos ?? [])
    .filter(processoEnvolveDimensao)
    .map((p) => enrichProcessoLinks(enrichProcessoConsulta(p)))
  cached = {
    ...raw,
    processos,
    total: processos.length,
  }
  return cached
}
