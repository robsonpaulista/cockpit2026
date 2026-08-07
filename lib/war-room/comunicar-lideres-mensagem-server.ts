import { promises as fs } from 'fs'
import path from 'path'
import {
  COMUNICAR_LIDERES_TEMPLATE_DEFAULT,
  type ComunicarLideresMensagemFile,
} from '@/lib/war-room/comunicar-lideres-mensagem'

function dataFilePath(): string {
  return path.join(process.cwd(), 'data', 'comunicar-lideres-mensagem.json')
}

/** Leitura/gravação do JSON — só usar em rotas/server. */
export async function readComunicarLideresMensagem(): Promise<ComunicarLideresMensagemFile> {
  try {
    const raw = await fs.readFile(dataFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ComunicarLideresMensagemFile>
    const template =
      typeof parsed.template === 'string' && parsed.template.trim()
        ? parsed.template
        : COMUNICAR_LIDERES_TEMPLATE_DEFAULT
    return {
      template,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch {
    return {
      template: COMUNICAR_LIDERES_TEMPLATE_DEFAULT,
      updatedAt: null,
    }
  }
}

export async function writeComunicarLideresMensagem(
  template: string,
): Promise<ComunicarLideresMensagemFile> {
  const next: ComunicarLideresMensagemFile = {
    template: template.trim() || COMUNICAR_LIDERES_TEMPLATE_DEFAULT,
    updatedAt: new Date().toISOString(),
  }
  await fs.mkdir(path.dirname(dataFilePath()), { recursive: true })
  await fs.writeFile(dataFilePath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}
