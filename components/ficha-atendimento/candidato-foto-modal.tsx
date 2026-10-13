'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Printer, Save, Trash2 } from 'lucide-react'
import {
  TseErro,
  TseModal,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import {
  URL_DIVULGACAND_HOME,
  pareceUrlImagem,
  type CandidatoFotoDivulgacand,
  type CargoFotoCandidato,
} from '@/lib/candidatos-foto-divulgacand'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { excluirFotoCandidato, salvarFotoCandidato } from '@/lib/services/ficha-atendimento-client'

export function FichaCandidatoFotoModal({
  municipio,
  cargo,
  candidato,
  fotoExistente,
  onClose,
  onSaved,
  onImprimirFicha,
}: {
  municipio: string
  cargo: CargoFotoCandidato
  candidato: ResultadoEleicao
  fotoExistente: CandidatoFotoDivulgacand | null
  onClose: () => void
  onSaved: () => void
  onImprimirFicha?: () => void
}) {
  const [urlImagem, setUrlImagem] = useState<string>(fotoExistente?.url_imagem ?? '')
  const [urlDivulgacand, setUrlDivulgacand] = useState<string>(fotoExistente?.url_divulgacand ?? '')
  const [saving, setSaving] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [previewErro, setPreviewErro] = useState<boolean>(false)

  const cargoLabel = cargo === 'prefeito' ? 'Prefeito 2024' : 'Vereador 2024'

  const salvar = async () => {
    const url = urlImagem.trim()
    if (!url) {
      setError('Informe a URL da imagem.')
      return
    }
    if (!pareceUrlImagem(url)) {
      setError('URL da imagem inválida. Use o link direto da foto no DivulgaCand.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await salvarFotoCandidato({
        municipio,
        cargo,
        numero_urna: candidato.numeroUrna,
        nome_urna: candidato.nomeUrnaCandidato,
        url_imagem: url,
        url_divulgacand: urlDivulgacand.trim() || null,
      })
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remover = async () => {
    if (!fotoExistente?.id) {
      setUrlImagem('')
      setUrlDivulgacand('')
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await excluirFotoCandidato(fotoExistente.id)
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <TseModal
      id="foto-candidato-titulo"
      titulo="Foto DivulgaCand"
      subtitulo={`${cargoLabel} · ${candidato.nomeUrnaCandidato}${candidato.numeroUrna ? ` (${candidato.numeroUrna})` : ''}`}
      onClose={onClose}
      largura="max-w-md"
      rodape={
        <>
          <div className="flex flex-wrap gap-2">
            {onImprimirFicha ? (
              <button
                type="button"
                onClick={onImprimirFicha}
                className={tseBotaoCinzaClass}
                title="Abrir ficha resumo e imprimir"
              >
                <Printer className={tseBotaoIconeClass} />
                Imprimir ficha
              </button>
            ) : null}
            {fotoExistente?.id ? (
              <button
                type="button"
                onClick={() => void remover()}
                disabled={deleting || saving}
                className={cn(tseBotaoCinzaClass, 'text-red-700')}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remover
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={saving || deleting}
              className={tseBotaoPrimarioClass}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        </>
      }
    >
      {error ? <TseErro>{error}</TseErro> : null}

      <section className={cn(tseCardClass, 'space-y-4')}>
        <p className="text-[12px] leading-relaxed text-[var(--tse-muted)]">
          No{' '}
          <a
            href={URL_DIVULGACAND_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-bold text-[var(--tse-olive)] hover:underline"
          >
            DivulgaCand
            <ExternalLink className="h-3 w-3" />
          </a>
          , abra a ficha do candidato, clique com o botão direito na foto e copie o endereço da imagem.
        </p>

        {urlImagem.trim() && !previewErro ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlImagem.trim()}
              alt={candidato.nomeUrnaCandidato}
              className="h-28 w-28 rounded-full border-2 border-[var(--tse-yellow)] object-cover"
              onError={() => setPreviewErro(true)}
            />
          </div>
        ) : null}

        {previewErro && urlImagem.trim() ? (
          <p className="text-center text-[12px] text-[var(--tse-gold-text)]">
            Não foi possível carregar a pré-visualização. A URL ainda pode funcionar após salvar.
          </p>
        ) : null}

        <label className="block">
          <span className={tseRotuloCampoClass}>URL da imagem *</span>
          <input
            type="url"
            value={urlImagem}
            onChange={(e) => {
              setUrlImagem(e.target.value)
              setPreviewErro(false)
            }}
            placeholder="https://..."
            className={tseCampoClass}
          />
        </label>

        <label className="block">
          <span className={tseRotuloCampoClass}>Link da ficha no DivulgaCand (opcional)</span>
          <input
            type="url"
            value={urlDivulgacand}
            onChange={(e) => setUrlDivulgacand(e.target.value)}
            placeholder="https://divulgacandcontas.tse.jus.br/..."
            className={tseCampoClass}
          />
        </label>
      </section>
    </TseModal>
  )
}
