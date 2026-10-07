'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  tseBotaoContornoClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseRotuloCampoClass,
  TseModal,
} from '@/components/tse/tse-ui'
import { formatNewsMetaDate, newsItemDate, riskLabel, sentimentLabel } from '@/lib/noticias-page-utils'
import { classificarAlerta } from '@/lib/services/radar-eleitoral-client'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/types'

const SENTIMENTOS: NewsItem['sentiment'][] = ['positive', 'neutral', 'negative']
const RISCOS: NewsItem['risk_level'][] = ['high', 'medium', 'low']
const TEMAS = [
  'Saúde',
  'Educação',
  'Infraestrutura',
  'Segurança',
  'Economia',
  'Meio Ambiente',
  'Social',
  'Política',
  'Ambiente Familiar',
  'Cultura',
  'Esporte',
  'Tecnologia',
  'Agricultura',
  'Turismo',
  'Transporte',
  'Energia',
]
const OUTRO = 'Outro'

function Opcoes<T extends string>({
  valores,
  ativo,
  rotulo,
  onChange,
}: {
  valores: T[]
  ativo: T | ''
  rotulo: (v: T) => string
  onChange: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {valores.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={ativo === v}
          className={cn(
            'h-9 rounded-md text-[13px] font-semibold transition-colors',
            ativo === v
              ? 'bg-[var(--tse-yellow)] text-white'
              : 'bg-white text-[var(--tse-text)] shadow-sm hover:bg-[var(--tse-yellow-soft)]',
          )}
        >
          {rotulo(v)}
        </button>
      ))}
    </div>
  )
}

interface RadarClassificarModalProps {
  noticia: NewsItem
  onClose: () => void
  onSalvo: () => void
}

export function RadarClassificarModal({ noticia, onClose, onSalvo }: RadarClassificarModalProps) {
  const temaConhecido = !noticia.theme || TEMAS.includes(noticia.theme)
  const [sentimento, setSentimento] = useState<NewsItem['sentiment'] | ''>(noticia.sentiment ?? '')
  const [risco, setRisco] = useState<NewsItem['risk_level'] | ''>(noticia.risk_level ?? '')
  const [tema, setTema] = useState<string>(temaConhecido ? (noticia.theme ?? '') : OUTRO)
  const [temaLivre, setTemaLivre] = useState<string>(temaConhecido ? '' : (noticia.theme ?? ''))
  const [notas, setNotas] = useState<string>(noticia.notes ?? '')
  const [salvando, setSalvando] = useState<boolean>(false)
  const [erro, setErro] = useState<string>('')

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      const temaFinal = (tema === OUTRO ? temaLivre : tema).trim()
      await classificarAlerta(noticia.id, {
        sentiment: sentimento || null,
        risk_level: risco || null,
        theme: temaFinal || null,
        notes: notas.trim() || null,
      })
      onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar notícia.')
    } finally {
      setSalvando(false)
    }
  }

  const data = newsItemDate(noticia)

  return (
    <TseModal
      id="radar-classificar-titulo"
      titulo="Classificar notícia"
      subtitulo="A classificação manual marca a notícia como revisada"
      largura="max-w-2xl"
      onClose={onClose}
      rodape={
        <>
          <button type="button" onClick={onClose} className={tseBotaoContornoClass}>
            Cancelar
          </button>
          <button type="button" disabled={salvando} onClick={() => void salvar()} className={tseBotaoPrimarioClass}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar classificação
          </button>
        </>
      }
    >
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-[14px] font-bold leading-snug">{noticia.title}</p>
        <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
          {noticia.source} · {data ? formatNewsMetaDate(data) : 'sem data'}
        </p>
      </section>

      <div>
        <span className={tseRotuloCampoClass}>Sentimento</span>
        <Opcoes valores={SENTIMENTOS} ativo={sentimento} rotulo={sentimentLabel} onChange={setSentimento} />
      </div>

      <div>
        <span className={tseRotuloCampoClass}>Nível de risco</span>
        <Opcoes valores={RISCOS} ativo={risco} rotulo={riskLabel} onChange={setRisco} />
      </div>

      <label className="block">
        <span className={tseRotuloCampoClass}>Tema</span>
        <select value={tema} onChange={(e) => setTema(e.target.value)} className={tseCampoClass}>
          <option value="">Sem tema</option>
          {TEMAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={OUTRO}>Outro…</option>
        </select>
      </label>
      {tema === OUTRO ? (
        <input
          value={temaLivre}
          onChange={(e) => setTemaLivre(e.target.value)}
          placeholder="Digite o tema"
          className={tseCampoClass}
        />
      ) : null}

      <label className="block">
        <span className={tseRotuloCampoClass}>Notas (opcional)</span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Contexto, observações…"
          className={cn(tseCampoClass, 'h-auto resize-none py-2')}
        />
      </label>

      {erro ? <p className="text-[12px] text-red-700">{erro}</p> : null}
    </TseModal>
  )
}
