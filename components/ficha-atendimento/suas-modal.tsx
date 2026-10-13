'use client'

import type { ReactNode } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  TseModal,
  tseBotaoCinzaClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import type { EmendaSuasForm } from '@/lib/services/ficha-atendimento-client'

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={tseRotuloCampoClass}>{rotulo}</span>
      {children}
    </label>
  )
}

export function SuasModal({
  form,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  form: EmendaSuasForm
  saving: boolean
  onClose: () => void
  onChange: (f: EmendaSuasForm) => void
  onSave: () => void
}) {
  return (
    <TseModal
      id="suas-modal-titulo"
      titulo={form.id ? 'Editar lançamento SUAS' : 'Novo lançamento SUAS'}
      subtitulo={form.municipio}
      onClose={onClose}
      largura="max-w-md"
      rodape={
        <>
          <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
            Cancelar
          </button>
          <button type="button" onClick={onSave} disabled={saving} className={tseBotaoPrimarioClass}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </>
      }
    >
      <section className={cn(tseCardClass, 'space-y-3')}>
        <Campo rotulo="Tipo de proposta">
          <input
            value={form.tipo_proposta}
            onChange={(e) => onChange({ ...form, tipo_proposta: e.target.value })}
            className={tseCampoClass}
          />
        </Campo>
        <Campo rotulo="Tipo de recurso">
          <input
            value={form.tipo_recurso}
            onChange={(e) => onChange({ ...form, tipo_recurso: e.target.value })}
            className={tseCampoClass}
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Valor da proposta (R$)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.valor_proposta}
              onChange={(e) => onChange({ ...form, valor_proposta: parseFloat(e.target.value) || 0 })}
              className={cn(tseCampoClass, 'tabular-nums')}
            />
          </Campo>
          <Campo rotulo="Valor a pagar (R$)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.valor_pagar}
              onChange={(e) => onChange({ ...form, valor_pagar: parseFloat(e.target.value) || 0 })}
              className={cn(tseCampoClass, 'tabular-nums')}
            />
          </Campo>
        </div>
      </section>
    </TseModal>
  )
}
