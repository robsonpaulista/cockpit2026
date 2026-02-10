'use client'

import { useState } from 'react'
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ObrasImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function ObrasImportModal({ onClose, onSuccess }: ObrasImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          selectedFile.name.endsWith('.xlsx')) {
        setFile(selectedFile)
        setError(null)
      } else {
        setError('Por favor, selecione um arquivo Excel (.xlsx)')
        setFile(null)
      }
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Ler arquivo Excel usando arrayBuffer para melhor compatibilidade
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const data = e.target?.result
          if (!data) {
            setError('Erro ao ler dados do arquivo')
            setLoading(false)
            return
          }

          // Tentar ler como arrayBuffer primeiro, depois como binary
          let workbook
          try {
            if (data instanceof ArrayBuffer) {
              workbook = XLSX.read(data, { type: 'array', cellDates: true })
            } else {
              workbook = XLSX.read(data, { type: 'binary', cellDates: true })
            }
          } catch (parseError: any) {
            console.error('Erro ao parsear Excel:', parseError)
            setError(`Erro ao processar arquivo Excel: ${parseError.message || 'Formato inválido'}`)
            setLoading(false)
            return
          }
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            setError('O arquivo Excel não contém planilhas')
            setLoading(false)
            return
          }
          
          // Pegar primeira planilha
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          
          if (!worksheet) {
            setError('Erro ao acessar planilha do arquivo')
            setLoading(false)
            return
          }

          // Tentar detectar a linha de cabeçalho procurando por palavras-chave conhecidas
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
          let headerRow = 0
          const headerKeywords = ['municipio', 'município', 'obra', 'orgão', 'orgao', 'sei', 'status']
          
          // Procurar nas primeiras 5 linhas pela linha que contenha palavras-chave de cabeçalho
          for (let row = 0; row <= Math.min(range.e.r, 5); row++) {
            let matchCount = 0
            for (let col = 0; col <= Math.min(range.e.c, 15); col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
              const cell = worksheet[cellAddress]
              if (cell && cell.v) {
                const cellValue = String(cell.v).toLowerCase().trim()
                if (headerKeywords.some(keyword => cellValue.includes(keyword))) {
                  matchCount++
                }
              }
            }
            // Se encontrou pelo menos 2 palavras-chave, provavelmente é a linha de cabeçalho
            if (matchCount >= 2) {
              headerRow = row
              break
            }
          }

          console.log(`Linha de cabeçalho detectada: ${headerRow + 1}`)

          // Converter para JSON usando a linha de cabeçalho detectada
          let jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            defval: null,
            raw: false,
            header: headerRow, // Usar a linha detectada como cabeçalho
          })

          // Se os dados têm colunas __EMPTY, tentar usar a primeira linha como cabeçalho
          const firstRow = jsonData[0] as Record<string, unknown> | undefined
          if (jsonData.length > 0 && firstRow && typeof firstRow === 'object' && Object.keys(firstRow).some(key => key.startsWith('__EMPTY'))) {
            console.log('Detectado __EMPTY, tentando usar primeira linha como cabeçalho')
            jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              defval: null,
              raw: false,
              header: 1, // Forçar primeira linha como cabeçalho
            })
          }
          
          if (!jsonData || jsonData.length === 0) {
            setError('O arquivo Excel está vazio ou não contém dados válidos')
            setLoading(false)
            return
          }

          console.log('Dados lidos do Excel:', jsonData.slice(0, 2)) // Debug: mostrar primeiras 2 linhas
          const row0 = (jsonData[0] ?? {}) as Record<string, unknown>
          console.log('Colunas detectadas:', Object.keys(row0))
          
          // Verificar se os dados têm colunas válidas (não apenas __EMPTY)
          if (jsonData.length > 0) {
            const firstRowKeys = Object.keys(row0)
            const hasValidColumns = firstRowKeys.some(key => 
              !key.startsWith('__EMPTY') && 
              key.trim() !== '' &&
              row0[key] !== null && 
              row0[key] !== undefined
            )
            
            if (!hasValidColumns) {
              setError('Não foi possível identificar os cabeçalhos das colunas. Verifique se a primeira linha contém os nomes das colunas (Município, Obra, Órgão, etc.)')
              setLoading(false)
              return
            }
          }

          // Enviar para API
          const response = await fetch('/api/obras/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obras: jsonData }),
          })

          const result = await response.json()

          if (response.ok) {
            setSuccess(true)
            setImportedCount(result.imported || jsonData.length)
            setTimeout(() => {
              onSuccess()
              onClose()
            }, 1500)
          } else {
            const errorMsg = result.error || 'Erro ao importar obras'
            const details = result.details ? `\nDetalhes: ${result.details}` : ''
            setError(`${errorMsg}${details}`)
          }
        } catch (err: any) {
          console.error('Erro ao processar:', err)
          setError(err.message || 'Erro ao processar arquivo Excel')
        } finally {
          setLoading(false)
        }
      }

      reader.onerror = (error) => {
        console.error('Erro no FileReader:', error)
        setError('Erro ao ler arquivo. Verifique se o arquivo não está corrompido.')
        setLoading(false)
      }

      reader.onabort = () => {
        setError('Leitura do arquivo foi cancelada')
        setLoading(false)
      }

      // Tentar ler como arrayBuffer primeiro (mais confiável)
      reader.readAsArrayBuffer(file)
    } catch (err: any) {
      console.error('Erro geral:', err)
      setError(err.message || 'Erro ao importar arquivo')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent-gold" />
            Importar Obras do Excel
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
              {importedCount} obra(s) importada(s) com sucesso.
            </p>
            <button
              onClick={() => {
                onSuccess()
                onClose()
              }}
              className="px-6 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
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
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <div className="bg-background rounded-lg p-4 mb-6">
              <p className="text-xs text-secondary mb-2">
                <strong>Formato esperado do Excel:</strong>
              </p>
              <ul className="text-xs text-secondary space-y-1 list-disc list-inside">
                <li>Colunas: Município, Obra, Órgão, SEI, SEI MEDIÇÃO, Status, PUBLICAÇÃO DA OS, Solicitação Medição, Data Medição, Status Medição, Valor Total</li>
                <li>Primeira linha deve conter os cabeçalhos das colunas</li>
                <li>Arquivo deve estar no formato .xlsx</li>
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="flex-1 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar
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
