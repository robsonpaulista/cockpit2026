import { createWriteStream } from 'fs'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

/** Pacotes oficiais de fotos do DivulgaCand (PI), dados abertos do TSE. O arquivo é `FPI{sequencial}_div.jpg`. */
const FONTES = {
  '2024': {
    url: 'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2024/fotos/foto_cand2024_PI_div.zip',
    zip: 'foto_cand2024_PI_div.zip',
  },
  '2026': {
    url: 'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_PI_div.zip',
    zip: 'foto_cand2026_PI_div.zip',
  },
} as const

export type AnoFotoCandidato = keyof typeof FONTES

const CACHE = path.join(process.cwd(), '.cache')
const baixando = new Map<AnoFotoCandidato, Promise<string>>()

export function sqFotoCandidatoValido(sq: string): boolean {
  return /^\d{10,14}$/.test(sq)
}

export function anoFotoCandidato(ano: string): AnoFotoCandidato | null {
  return ano === '2024' || ano === '2026' ? ano : null
}

function arquivoExtraido(ano: AnoFotoCandidato, sq: string): string {
  return path.join(CACHE, `fotos-cand-${ano}`, `FPI${sq}_div.jpg`)
}

async function baixarZip(ano: AnoFotoCandidato, destino: string): Promise<string> {
  await fs.mkdir(CACHE, { recursive: true })
  const parcial = `${destino}.parcial`
  const resposta = await fetch(FONTES[ano].url)
  if (!resposta.ok || !resposta.body) throw new Error('Não foi possível baixar as fotos do TSE')
  await pipeline(
    Readable.fromWeb(resposta.body as unknown as import('stream/web').ReadableStream),
    createWriteStream(parcial),
  )
  await fs.rename(parcial, destino)
  return destino
}

async function zipCompleto(destino: string): Promise<boolean> {
  try {
    const stat = await fs.stat(destino)
    if (stat.size < 22) return false
    const arquivo = await fs.open(destino, 'r')
    try {
      const fim = Buffer.alloc(22)
      await arquivo.read(fim, 0, 22, stat.size - 22)
      return fim.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    } finally {
      await arquivo.close()
    }
  } catch {
    return false
  }
}

async function caminhoZip(ano: AnoFotoCandidato): Promise<string> {
  const destino = path.join(CACHE, FONTES[ano].zip)
  if (await zipCompleto(destino)) return destino
  const emCurso = baixando.get(ano)
  if (emCurso) return emCurso
  const tarefa = baixarZip(ano, destino).finally(() => {
    baixando.delete(ano)
  })
  baixando.set(ano, tarefa)
  return tarefa
}

function extrairUm(zip: string, nome: string): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-p', zip, nome])
    const pedacos: Buffer[] = []
    let tamanho = 0
    proc.stdout.on('data', (chunk: Buffer) => {
      tamanho += chunk.length
      if (tamanho > 2_000_000) {
        proc.kill()
        resolve(null)
        return
      }
      pedacos.push(chunk)
    })
    proc.on('error', reject)
    proc.on('close', () => {
      const foto = Buffer.concat(pedacos)
      resolve(foto.length >= 2 && foto[0] === 0xff && foto[1] === 0xd8 ? foto : null)
    })
  })
}

/** JPEG do DivulgaCand para o ano e o sequencial do candidato, ou null se não houver foto. */
export async function lerFotoCandidato(ano: AnoFotoCandidato, sq: string): Promise<Buffer | null> {
  if (!sqFotoCandidatoValido(sq)) return null
  try {
    return await fs.readFile(arquivoExtraido(ano, sq))
  } catch {
    /* extrai só esta foto do pacote */
  }
  const zip = await caminhoZip(ano)
  const foto = await extrairUm(zip, `FPI${sq}_div.jpg`)
  if (!foto) return null
  const destino = arquivoExtraido(ano, sq)
  await fs.mkdir(path.dirname(destino), { recursive: true })
  await fs.writeFile(destino, foto).catch(() => undefined)
  return foto
}

export const sqFotoCandidato2026Valido = sqFotoCandidatoValido

export function lerFotoCandidato2026(sq: string): Promise<Buffer | null> {
  return lerFotoCandidato('2026', sq)
}
