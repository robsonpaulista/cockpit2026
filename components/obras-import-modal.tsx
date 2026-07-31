'use client'

import { useState } from 'react'
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface ObrasImportModalProps {
  onClose: () => void
  onSuccess: (tipoAba: string) => void
}

const ABAS_PROTEGIDAS = new Set(['pavimentação', 'obras diversas'])
const HEADER_KEYWORDS = ['municipio', 'município', 'obra', 'orgão', 'orgao', 'sei', 'status']

function sugerirNomeAba(fileName: string): string {
  return fileName
    .replace(/\.xlsx$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function nomeAbaRecap(sheetName: string): string {
  const trimmed = sheetName.trim()
  if (/^recap\s+/i.test(trimmed)) return trimmed.replace(/\s+/g, ' ')
  return `Recap ${trimmed}`.replace(/\s+/g, ' ')
}

function hasValidColumns(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false
  const row0 = rows[0] ?? {}
  return Object.keys(row0).some(
    (key) =>
      !key.startsWith('__EMPTY') &&
      key.trim() !== '' &&
      row0[key] !== null &&
      row0[key] !== undefined,
  )
}

function sheetToJsonRows(worksheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  let headerRow = 0

  for (let row = 0; row <= Math.min(range.e.r, 5); row++) {
    let matchCount = 0
    for (let col = 0; col <= Math.min(range.e.c, 15); col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = worksheet[cellAddress]
      if (cell && cell.v) {
        const cellValue = String(cell.v).toLowerCase().trim()
        if (HEADER_KEYWORDS.some((keyword) => cellValue.includes(keyword))) {
          matchCount++
        }
      }
    }
    if (matchCount >= 2) {
      headerRow = row
      break
    }
  }

  // Sem `header` numérico: a 1ª linha útil vira nome das colunas.
  // (header: 1 gera A/B/C e quebra o mapeamento; __EMPTY residual é ok.)
  let jsonData = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
    range: headerRow,
  }) as Record<string, unknown>[]

  if (!hasValidColumns(jsonData)) {
    jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false,
    }) as Record<string, unknown>[]
  }

  return jsonData
}

export function ObrasImportModal({ onClose, onSuccess }: ObrasImportModalProps) {
  const isCockpit = false
  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [tabName, setTabName] = useState('')
  const [importAllSheets, setImportAllSheets] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importedTab, setImportedTab] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (
      selectedFile.type !==
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      !selectedFile.name.endsWith('.xlsx')
    ) {
      setError('Por favor, selecione um arquivo Excel (.xlsx)')
      setFile(null)
      setSheetNames([])
      setSelectedSheet('')
      return
    }

    setFile(selectedFile)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!(data instanceof ArrayBuffer)) {
          setError('Erro ao ler arquivo')
          return
        }
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const names = workbook.SheetNames ?? []
        setSheetNames(names)
        setImportAllSheets(names.length > 1)
        const preferred =
          names.find((n) => n.trim() === '2026') ||
          names.find((n) => /2026/i.test(n)) ||
          names[0] ||
          ''
        setSelectedSheet(preferred)
        const base = sugerirNomeAba(selectedFile.name)
        const sugestao = preferred ? nomeAbaRecap(preferred) : base
        setTabName((prev) => prev.trim() || sugestao)
      } catch (err) {
        console.error(err)
        setError('Não foi possível ler as abas do Excel')
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  const importSheetRows = async (
    rows: Record<string, unknown>[],
    tipoAba: string,
  ): Promise<{ imported: number; tipo: string }> => {
    const response = await fetch('/api/obras/recap/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        obras: rows,
        tipo: tipoAba,
        replace: true,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const errorMsg = result.error || 'Erro ao importar obras'
      const details = result.details ? `\nDetalhes: ${result.details}` : ''
      throw new Error(`${errorMsg}${details}`)
    }
    return {
      imported: Number(result.imported) || rows.length,
      tipo: String(result.tipo || tipoAba),
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo')
      return
    }
    if (!importAllSheets && !selectedSheet) {
      setError('Selecione a aba da planilha (ex.: 2026)')
      return
    }

    if (!importAllSheets) {
      const tipoAba = tabName.trim().replace(/\s+/g, ' ')
      if (!tipoAba) {
        setError('Informe o nome da nova aba (ex.: Recap 2026)')
        return
      }
      if (ABAS_PROTEGIDAS.has(tipoAba.toLowerCase())) {
        setError(
          'Use outro nome de aba. Pavimentação e Obras diversas não são alteradas pela importação.',
        )
        return
      }
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          const data = e.target?.result
          if (!data) {
            setError('Erro ao ler dados do arquivo')
            setLoading(false)
            return
          }

          let workbook: XLSX.WorkBook
          try {
            if (data instanceof ArrayBuffer) {
              workbook = XLSX.read(data, { type: 'array', cellDates: true })
            } else {
              workbook = XLSX.read(data, { type: 'binary', cellDates: true })
            }
          } catch (parseError: unknown) {
            const message =
              parseError instanceof Error ? parseError.message : 'Formato inválido'
            setError(`Erro ao processar arquivo Excel: ${message}`)
            setLoading(false)
            return
          }

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            setError('O arquivo Excel não contém planilhas')
            setLoading(false)
            return
          }

          const sheetsToImport = importAllSheets
            ? workbook.SheetNames
            : [
                workbook.SheetNames.find((n) => n === selectedSheet) ||
                  workbook.SheetNames[0],
              ]

          let totalImported = 0
          const importedTabs: string[] = []

          for (const sheetName of sheetsToImport) {
            const worksheet = workbook.Sheets[sheetName]
            if (!worksheet) {
              throw new Error(`Erro ao acessar a aba "${sheetName}"`)
            }

            const jsonData = sheetToJsonRows(worksheet)
            if (!jsonData.length) {
              throw new Error(`A aba "${sheetName}" está vazia ou sem dados válidos`)
            }
            if (!hasValidColumns(jsonData)) {
              throw new Error(
                `Não foi possível identificar os cabeçalhos na aba "${sheetName}".`,
              )
            }

            const tipoAba = importAllSheets
              ? nomeAbaRecap(sheetName)
              : tabName.trim().replace(/\s+/g, ' ')

            if (ABAS_PROTEGIDAS.has(tipoAba.toLowerCase())) {
              throw new Error(
                `Aba destino "${tipoAba}" é protegida. Use outro nome.`,
              )
            }

            const result = await importSheetRows(jsonData, tipoAba)
            totalImported += result.imported
            importedTabs.push(result.tipo)
          }

          setSuccess(true)
          setImportedCount(totalImported)
          setImportedTab(importedTabs.join(', '))
          setTimeout(() => {
            onSuccess(importedTabs[importedTabs.length - 1] || '')
            onClose()
          }, 1500)
        } catch (err: unknown) {
          console.error('Erro ao processar:', err)
          setError(err instanceof Error ? err.message : 'Erro ao processar arquivo Excel')
        } finally {
          setLoading(false)
        }
      }

      reader.onerror = () => {
        setError('Erro ao ler arquivo. Verifique se o arquivo não está corrompido.')
        setLoading(false)
      }

      reader.onabort = () => {
        setError('Leitura do arquivo foi cancelada')
        setLoading(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (err: unknown) {
      console.error('Erro geral:', err)
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent-gold" />
            Importar para storage local
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Importação concluída!</h3>
            <p className="text-sm text-secondary mb-6">
              {importedCount} obra(s) importada(s) na(s) aba(s){' '}
              <strong className="text-text-primary">{importedTab}</strong>.
            </p>
            <button
              onClick={() => {
                onSuccess(importedTab.split(',')[0]?.trim() || importedTab)
                onClose()
              }}
              className={sidebarPrimaryCTAButtonClass(isCockpit, 'px-6')}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {sheetNames.length > 1 ? (
              <div className="mb-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importAllSheets}
                    onChange={(e) => setImportAllSheets(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-text-primary">
                    Importar todas as abas
                    <span className="block text-xs text-secondary mt-0.5">
                      Cria uma aba Recap por sheet (ex.: Recap 2025 e Recap 2026).
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {!importAllSheets ? (
              <>
                <div className="mb-4">
                  <label
                    className="block text-sm font-medium text-text-primary mb-2"
                    htmlFor="obra-import-tab"
                  >
                    Nome da nova aba
                  </label>
                  <input
                    id="obra-import-tab"
                    type="text"
                    value={tabName}
                    onChange={(e) => setTabName(e.target.value)}
                    placeholder="Ex.: Recap 2026"
                    className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                  />
                  <p className="mt-1.5 text-xs text-secondary">
                    A planilha cria/atualiza só esta aba. Pavimentação e Obras diversas não
                    são alteradas.
                  </p>
                </div>

                {sheetNames.length > 0 ? (
                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-text-primary mb-2"
                      htmlFor="obra-import-sheet"
                    >
                      Aba do Excel
                    </label>
                    <select
                      id="obra-import-sheet"
                      value={selectedSheet}
                      onChange={(e) => {
                        const next = e.target.value
                        setSelectedSheet(next)
                        setTabName((prev) => {
                          if (!prev.trim() || /^Recap\s+/i.test(prev)) {
                            return nomeAbaRecap(next)
                          }
                          return prev
                        })
                      }}
                      className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                    >
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : sheetNames.length > 0 ? (
              <div className="mb-4 rounded-lg border border-card bg-background px-3 py-2">
                <p className="text-xs text-secondary mb-1">Abas que serão importadas:</p>
                <p className="text-sm text-text-primary">
                  {sheetNames.map((n) => nomeAbaRecap(n)).join(' · ')}
                </p>
              </div>
            ) : null}

            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Selecione o arquivo Excel (.xlsx)
              </label>
              <div className="border-2 border-dashed border-card rounded-lg p-6 text-center hover:border-accent-gold transition-colors">
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-accent-gold" />
                  <span className="text-sm text-secondary">
                    {file ? file.name : 'Clique para selecionar arquivo'}
                  </span>
                </label>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-sm text-red-600 whitespace-pre-wrap">{error}</span>
              </div>
            )}

            <div className="bg-background rounded-lg p-4 mb-6">
              <p className="text-xs text-secondary mb-2">
                <strong>Formato esperado do Excel:</strong>
              </p>
              <ul className="text-xs text-secondary space-y-1 list-disc list-inside">
                <li>Colunas: Município, Obra, Órgão, SEI, Valor (ou Valor Total), Status…</li>
                <li>Primeira linha deve conter os cabeçalhos das colunas</li>
                <li>Arquivo deve estar no formato .xlsx</li>
                <li>Com “todas as abas”, cada sheet vira Recap 2025 / Recap 2026 etc.</li>
                <li>Salvo em arquivo local (data/obras-recap.json), sem Supabase</li>
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className={sidebarPrimaryCTAButtonClass(isCockpit, 'flex-1')}
              >
                {loading ? (
                  <>
                    <Loader2
                      className={cn(
                        'h-4 w-4 shrink-0 animate-spin',
                        isCockpit ? 'text-white' : 'text-accent-gold',
                      )}
                      aria-hidden
                    />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isCockpit ? 'text-white' : 'text-accent-gold',
                      )}
                      aria-hidden
                    />
                    {importAllSheets && sheetNames.length > 1
                      ? 'Importar todas as abas'
                      : 'Importar'}
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
