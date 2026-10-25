import fs from 'fs/promises'
import path from 'path'
import { inflateRawSync } from 'zlib'

/** Pacotes oficiais de fotos do DivulgaCand (PI). Cada foto é `FPI{sequencial}_div.jpg` dentro do ZIP. */
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

type EntradaZip = {
  metodo: number
  comprimido: number
  offsetLocal: number
}

type LeitorZip = {
  faixa: (inicio: number, fim: number) => Promise<Buffer>
}

const CACHE = path.join(process.cwd(), '.cache')
const indices = new Map<string, Promise<Map<string, EntradaZip>>>()

export function sqFotoCandidatoValido(sq: string): boolean {
  return /^\d{10,14}$/.test(sq)
}

export function anoFotoCandidato(ano: string): AnoFotoCandidato | null {
  return ano === '2024' || ano === '2026' ? ano : null
}

function arquivoExtraido(ano: AnoFotoCandidato, sq: string): string {
  return path.join(CACHE, `fotos-cand-${ano}`, `FPI${sq}_div.jpg`)
}

async function zipLocalCompleto(destino: string): Promise<boolean> {
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

function leitorArquivo(caminho: string): LeitorZip {
  return {
    faixa: async (inicio, fim) => {
      const arquivo = await fs.open(caminho, 'r')
      try {
        const buf = Buffer.alloc(fim - inicio + 1)
        await arquivo.read(buf, 0, buf.length, inicio)
        return buf
      } finally {
        await arquivo.close()
      }
    },
  }
}

function leitorHttp(url: string): LeitorZip {
  return {
    faixa: async (inicio, fim) => {
      const resposta = await fetch(url, {
        headers: { Range: `bytes=${inicio}-${fim}` },
        cache: 'no-store',
      })
      if (resposta.status !== 206 && resposta.status !== 200) {
        throw new Error(`Falha ao ler foto do TSE (${resposta.status})`)
      }
      return Buffer.from(await resposta.arrayBuffer())
    },
  }
}

function lerIndice(chave: string, leitor: LeitorZip, tamanho: number): Promise<Map<string, EntradaZip>> {
  const emCurso = indices.get(chave)
  if (emCurso) return emCurso
  const tarefa = montarIndice(leitor, tamanho).catch((erro: unknown) => {
    indices.delete(chave)
    throw erro
  })
  indices.set(chave, tarefa)
  return tarefa
}

async function montarIndice(leitor: LeitorZip, tamanho: number): Promise<Map<string, EntradaZip>> {
  const caudaInicio = Math.max(0, tamanho - 65557)
  const cauda = await leitor.faixa(caudaInicio, tamanho - 1)
  const assinatura = Buffer.from([0x50, 0x4b, 0x05, 0x06])
  const eocd = cauda.lastIndexOf(assinatura)
  if (eocd < 0) throw new Error('Pacote de fotos do TSE sem diretório')
  const cdTamanho = cauda.readUInt32LE(eocd + 12)
  const cdOffset = cauda.readUInt32LE(eocd + 16)
  if (cdTamanho === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('Pacote de fotos do TSE em formato não suportado')
  }
  const cd = await leitor.faixa(cdOffset, cdOffset + cdTamanho - 1)
  const mapa = new Map<string, EntradaZip>()
  let p = 0
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const metodo = cd.readUInt16LE(p + 10)
    const comprimido = cd.readUInt32LE(p + 20)
    const nomeLen = cd.readUInt16LE(p + 28)
    const extraLen = cd.readUInt16LE(p + 30)
    const comentarioLen = cd.readUInt16LE(p + 32)
    const offsetLocal = cd.readUInt32LE(p + 42)
    const nome = cd.subarray(p + 46, p + 46 + nomeLen).toString('utf8')
    const base = nome.split('/').pop() ?? nome
    if (base.endsWith('_div.jpg')) mapa.set(base, { metodo, comprimido, offsetLocal })
    p += 46 + nomeLen + extraLen + comentarioLen
  }
  return mapa
}

async function lerJpeg(leitor: LeitorZip, entrada: EntradaZip): Promise<Buffer | null> {
  const prefixo = await leitor.faixa(entrada.offsetLocal, entrada.offsetLocal + 29)
  if (prefixo.readUInt32LE(0) !== 0x04034b50) return null
  const nomeLen = prefixo.readUInt16LE(26)
  const extraLen = prefixo.readUInt16LE(28)
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen
  if (entrada.comprimido <= 0) return null
  const dados = await leitor.faixa(inicio, inicio + entrada.comprimido - 1)
  const foto = entrada.metodo === 0 ? dados : entrada.metodo === 8 ? inflateRawSync(dados) : null
  if (!foto || foto.length < 2 || foto[0] !== 0xff || foto[1] !== 0xd8) return null
  return foto
}

async function tamanhoDoPacote(url: string): Promise<number> {
  const cabeca = await fetch(url, { method: 'HEAD', cache: 'no-store' })
  const peloCabecalho = Number(cabeca.headers.get('content-length'))
  if (cabeca.ok && Number.isFinite(peloCabecalho) && peloCabecalho >= 22) return peloCabecalho
  const cauda = await fetch(url, { headers: { Range: 'bytes=-22' }, cache: 'no-store' })
  const total = Number((cauda.headers.get('content-range') ?? '').split('/')[1])
  if (!Number.isFinite(total) || total < 22) throw new Error('Não foi possível consultar as fotos do TSE')
  return total
}

async function lerDoPacote(ano: AnoFotoCandidato, nome: string): Promise<Buffer | null> {
  const local = path.join(CACHE, FONTES[ano].zip)
  if (await zipLocalCompleto(local)) {
    const stat = await fs.stat(local)
    const indice = await lerIndice(local, leitorArquivo(local), stat.size)
    const entrada = indice.get(nome)
    return entrada ? lerJpeg(leitorArquivo(local), entrada) : null
  }

  const url = FONTES[ano].url
  const indice = await lerIndice(url, leitorHttp(url), await tamanhoDoPacote(url))
  const entrada = indice.get(nome)
  return entrada ? lerJpeg(leitorHttp(url), entrada) : null
}

/** JPEG do DivulgaCand para o ano e o sequencial do candidato, ou null se não houver foto. */
export async function lerFotoCandidato(ano: AnoFotoCandidato, sq: string): Promise<Buffer | null> {
  if (!sqFotoCandidatoValido(sq)) return null
  try {
    return await fs.readFile(arquivoExtraido(ano, sq))
  } catch {
    /* segue para o pacote do TSE */
  }
  return lerDoPacote(ano, `FPI${sq}_div.jpg`)
}

export const sqFotoCandidato2026Valido = sqFotoCandidatoValido

export function lerFotoCandidato2026(sq: string): Promise<Buffer | null> {
  return lerFotoCandidato('2026', sq)
}
