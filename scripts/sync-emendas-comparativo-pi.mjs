#!/usr/bin/env node
/**
 * Atualiza data/emendas-comparativo-pi.json a partir do CSV do Portal da Transparência.
 *
 * Uso: node scripts/sync-emendas-comparativo-pi.mjs
 *
 * Baixa o ZIP público (sem API key), filtra a bancada federal do PI (Câmara)
 * e grava o ranking agregado do mandato 2023–2026.
 */

import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'

const execFileAsync = promisify(execFile)

const ZIP_URL =
  'https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/emendas-parlamentares/EmendasParlamentares.zip'
const CAMARA_URL =
  'https://dadosabertos.camara.leg.br/api/v2/deputados?siglaUf=PI&ordem=ASC&ordenarPor=nome&itens=100'
const YEARS = ['2023', '2024', '2025', '2026']
const OUT = path.join(process.cwd(), 'data', 'emendas-comparativo-pi.json')

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function money(s) {
  if (!s) return 0
  return Number(String(s).replace(/\./g, '').replace(',', '.')) || 0
}

async function fetchDeputados() {
  const res = await fetch(CAMARA_URL)
  if (!res.ok) throw new Error(`Câmara API ${res.status}`)
  const json = await res.json()
  return (json.dados || []).map((d) => ({
    id: d.id,
    nome: d.nome,
    partido: d.siglaPartido,
    foto: d.urlFoto || `https://www.camara.leg.br/internet/deputado/bandep/${d.id}.jpg`,
  }))
}

function matchAutor(autor, keys) {
  const na = norm(autor)
  if (keys.has(na)) return keys.get(na)
  for (const [k, d] of keys) {
    const toks = k
      .replace(/\./g, '')
      .split(' ')
      .filter((t) => t.length > 2)
    if (toks.length && toks.every((t) => na.includes(t))) return d
  }
  return null
}

async function downloadZip(dest) {
  const res = await fetch(ZIP_URL)
  if (!res.ok || !res.body) throw new Error(`Download ZIP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function main() {
  console.log('1/4 Elenco Câmara PI…')
  const deputados = await fetchDeputados()
  const keys = new Map(deputados.map((d) => [norm(d.nome), d]))
  console.log(`   ${deputados.length} deputados`)

  const work = path.join(tmpdir(), `emendas-pi-${Date.now()}`)
  await mkdir(work, { recursive: true })
  const zipPath = path.join(work, 'EmendasParlamentares.zip')

  console.log('2/4 Baixando ZIP do Portal…')
  await downloadZip(zipPath)

  console.log('3/4 Extraindo CSV…')
  await execFileAsync('unzip', ['-o', zipPath, 'EmendasParlamentares.csv', '-d', work])
  const csvPath = path.join(work, 'EmendasParlamentares.csv')

  console.log('4/4 Agregando…')
  // Process via Python for robust latin-1 CSV (large file)
  const py = `
import csv, json, sys
from collections import defaultdict

deputados = json.loads(sys.argv[1])
years = json.loads(sys.argv[2])
csv_path = sys.argv[3]

def norm(s):
    import unicodedata, re
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\\s+', ' ', s).strip().upper()

def money(s):
    if not s: return 0.0
    return float(str(s).replace('.','').replace(',','.') or 0)

keys = {norm(d['nome']): d for d in deputados}

def match(autor):
    na = norm(autor)
    if na in keys: return keys[na]
    for k,d in keys.items():
        toks = [t for t in k.replace('.','').split() if len(t)>2]
        if toks and all(t in na for t in toks): return d
    return None

by = {d['id']: {
  **d,
  'valorEmpenhado':0,'valorLiquidado':0,'valorPago':0,'valorPix':0,'valorProjeto':0,'qtdEmendas':0,
  'porAno': {y:{'valorEmpenhado':0,'valorPago':0,'valorPix':0,'qtd':0} for y in years},
  'municipios': defaultdict(lambda: {'valorPago':0,'valorEmpenhado':0,'qtd':0}),
} for d in deputados}

with open(csv_path, encoding='latin-1', newline='') as f:
  for row in csv.DictReader(f, delimiter=';'):
    dep = match(row.get('Nome do Autor da Emenda',''))
    if not dep: continue
    ano = row.get('Ano da Emenda','')
    if ano not in years: continue
    a = by[dep['id']]
    emp = money(row.get('Valor Empenhado'))
    liq = money(row.get('Valor Liquidado'))
    pago = money(row.get('Valor Pago'))
    tipo = row.get('Tipo de Emenda','') or ''
    is_pix = 'Especiais' in tipo
    a['valorEmpenhado'] += emp; a['valorLiquidado'] += liq; a['valorPago'] += pago; a['qtdEmendas'] += 1
    if is_pix: a['valorPix'] += pago
    else: a['valorProjeto'] += pago
    ya = a['porAno'][ano]
    ya['valorEmpenhado'] += emp; ya['valorPago'] += pago; ya['qtd'] += 1
    if is_pix: ya['valorPix'] += pago
    mun = (row.get('Município') or '').strip()
    if mun and mun not in ('Múltiplo','Multiplo','Sem informação','Nacional'):
      m = a['municipios'][mun]
      m['valorPago'] += pago; m['valorEmpenhado'] += emp; m['qtd'] += 1

ranking = []
for a in by.values():
  munis = sorted([{'municipio':k,**v} for k,v in a['municipios'].items()], key=lambda x:-x['valorPago'])[:15]
  ranking.append({**{k:v for k,v in a.items() if k!='municipios'}, 'municipiosTop': munis})
ranking.sort(key=lambda x: -x['valorPago'])
for i,r in enumerate(ranking,1): r['rank']=i
qtd=sum(r['qtdEmendas'] for r in ranking)
pago=sum(r['valorPago'] for r in ranking)
from datetime import datetime, timezone
out={
  'geradoEm': datetime.now(timezone.utc).isoformat(),
  'fonte': 'Portal da Transparência · EmendasParlamentares.csv',
  'fonteUrl': 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares',
  'anos': years,
  'periodoLabel': 'Mandato 2023–2026',
  'uf': 'PI',
  'kpis': {
    'valorPago': pago,
    'valorEmpenhado': sum(r['valorEmpenhado'] for r in ranking),
    'valorPix': sum(r['valorPix'] for r in ranking),
    'valorProjeto': sum(r['valorProjeto'] for r in ranking),
    'qtdEmendas': qtd,
    'parlamentares': len(ranking),
    'valorMedio': (pago/qtd) if qtd else 0,
  },
  'ranking': ranking,
  'disclaimer': 'A cor e a posição medem magnitude do repasse, não avaliação política. Recorte: mandato federal 2023–2026.',
}
print(json.dumps(out, ensure_ascii=False))
`
  const { stdout } = await execFileAsync(
    'python3',
    ['-c', py, JSON.stringify(deputados), JSON.stringify(YEARS), csvPath],
    { maxBuffer: 32 * 1024 * 1024 },
  )
  const payload = JSON.parse(stdout)
  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`OK → ${OUT}`)
  console.log(
    'Top 3:',
    payload.ranking
      .slice(0, 3)
      .map((r) => `${r.nome} (${(r.valorPago / 1e6).toFixed(1)} mi)`)
      .join(' · '),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
