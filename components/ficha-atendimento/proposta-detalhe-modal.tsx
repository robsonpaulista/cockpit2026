'use client'

import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  TseModal,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
} from '@/components/tse/tse-ui'
import { formatDateShort } from '@/lib/utils'
import type { PropostaFns } from '@/lib/fns-tetos-saldo'
import { URL_CONSULTA_FNS } from '@/lib/fns-proposta-normalize'
import { formatarMoedaFicha } from '@/lib/ficha-lideranca-resumo'

function DetalheLinha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-[13px]">
      <dt className="text-[var(--tse-muted)]">{rotulo}</dt>
      <dd className="min-w-0 break-words font-semibold">{children}</dd>
    </div>
  )
}

function BlocoJson({ titulo, dados }: { titulo: string; dados: unknown }) {
  return (
    <section className={tseCardClass}>
      <h3 className="text-[13px] font-bold">{titulo}</h3>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--tse-bar)] p-2 text-[11px]">
        {JSON.stringify(dados, null, 2)}
      </pre>
    </section>
  )
}

export function FichaAtendimentoPropostaDetalhe({
  proposta,
  origem,
  onClose,
}: {
  proposta: PropostaFns
  origem: 'FNS' | 'SUAS'
  onClose: () => void
}) {
  const fns = origem === 'FNS'
  return (
    <TseModal
      id="proposta-detalhe-titulo"
      titulo="Detalhes da proposta"
      subtitulo={proposta.nuProposta}
      onClose={onClose}
      largura="max-w-lg"
      rodape={
        <>
          {fns ? (
            <a
              href={proposta.urlConsultaFns ?? URL_CONSULTA_FNS}
              target="_blank"
              rel="noopener noreferrer"
              className={tseBotaoCinzaClass}
            >
              <ExternalLink className={tseBotaoIconeClass} />
              Abrir Consulta FNS
            </a>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
            Fechar
          </button>
        </>
      }
    >
      <section className={tseCardClass}>
        <dl className="divide-y divide-[#EEEEEE]">
          <DetalheLinha rotulo="Origem">{origem}</DetalheLinha>
          <DetalheLinha rotulo="Exercício">{proposta.exercicio ?? '—'}</DetalheLinha>
          <DetalheLinha rotulo="Município">{proposta.municipio}</DetalheLinha>
          <DetalheLinha rotulo="Tipo">{proposta.coTipoProposta || '—'}</DetalheLinha>
          <DetalheLinha rotulo="Recurso">{proposta.dsTipoRecurso || '—'}</DetalheLinha>
          <DetalheLinha rotulo="Situação">{proposta.dsSituacaoProposta || '—'}</DetalheLinha>
          {fns && proposta.nuProcesso && proposta.nuProcesso !== 'N/A' ? (
            <DetalheLinha rotulo="Processo">{proposta.nuProcesso}</DetalheLinha>
          ) : null}
          {proposta.nmPrograma ? <DetalheLinha rotulo="Programa">{proposta.nmPrograma}</DetalheLinha> : null}
          {proposta.acao ? <DetalheLinha rotulo="Ação">{proposta.acao}</DetalheLinha> : null}
          <DetalheLinha rotulo="Valor proposta">{formatarMoedaFicha(proposta.vlProposta)}</DetalheLinha>
          <DetalheLinha rotulo="A pagar">{formatarMoedaFicha(proposta.vlPagar)}</DetalheLinha>
          {fns && proposta.vlPago != null ? (
            <DetalheLinha rotulo="Pago">{formatarMoedaFicha(proposta.vlPago)}</DetalheLinha>
          ) : null}
          <DetalheLinha rotulo="Data">
            {proposta.dtCadastramento ? formatDateShort(proposta.dtCadastramento) : '—'}
          </DetalheLinha>
        </dl>
      </section>

      {fns && proposta.parlamentares?.length ? (
        <section className={tseCardClass}>
          <h3 className="text-[13px] font-bold">Parlamentares</h3>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[13px]">
            {proposta.parlamentares.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {fns && proposta.pagamentos?.length ? <BlocoJson titulo="Pagamentos" dados={proposta.pagamentos} /> : null}
      {fns && proposta.linhaPropostas?.length ? (
        <BlocoJson titulo="Linhas da proposta" dados={proposta.linhaPropostas} />
      ) : null}

      {fns ? (
        <p className="text-[11px] text-[var(--tse-muted)]">
          A API pública do FNS não expõe link direto por registro. Use o portal oficial para consultar com município e
          tipo de recurso.
        </p>
      ) : null}
    </TseModal>
  )
}
