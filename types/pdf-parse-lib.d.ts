declare module 'pdf-parse/lib/pdf-parse.js' {
  export default function pdfParse(
    dataBuffer: Buffer
  ): Promise<{
    text?: string
    numpages?: number
    numrender?: number
    info?: Record<string, unknown>
    metadata?: unknown
    version?: string
  }>
}
