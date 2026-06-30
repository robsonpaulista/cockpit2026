'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'
import {
  brandAmberButtonClass,
  brandAmberCalloutClass,
  brandAmberIconClass,
} from '@/lib/sidebar-brand-styles'

type PlanoAmostragemComoFuncionaModalProps = {
  open: boolean
  onClose: () => void
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-secondary">{children}</div>
    </section>
  )
}

export function PlanoAmostragemComoFuncionaModal({
  open,
  onClose,
}: PlanoAmostragemComoFuncionaModalProps) {
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar explicação"
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="como-funciona-titulo"
        className="fixed left-1/2 top-1/2 z-[9999] flex max-h-[min(90vh,720px)] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-card bg-surface shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-card px-4 py-3 sm:px-5">
          <div className="flex items-start gap-2.5">
            <HelpCircle className={`mt-0.5 h-5 w-5 shrink-0 ${brandAmberIconClass}`} aria-hidden />
            <div>
              <h2 id="como-funciona-titulo" className="text-base font-semibold text-text-primary">
                Como funciona o plano?
              </h2>
              <p className="mt-0.5 text-xs text-secondary">
                Por que cada área recebe X entrevistas — lógica do gerador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary hover:bg-background hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 space-y-5">
          <p className="text-sm leading-relaxed text-secondary">
            A lógica é sempre a mesma: <strong className="font-medium text-text-primary">primeiro o total (N), depois repartir proporcionalmente</strong>, como fatiar um bolo em que pedaços maiores correspondem a mais moradores ou mais eleitores.
          </p>

          <Secao titulo="1. O que você define">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong className="font-medium text-text-primary">Município</strong> — universo da pesquisa.
              </li>
              <li>
                <strong className="font-medium text-text-primary">N (400, 500 ou 600)</strong> — quantas entrevistas face a face.
              </li>
              <li>
                <strong className="font-medium text-text-primary">Tipo</strong> — muda quem pesa no mapa:
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Opinião pública → quantas pessoas moram onde (IBGE).</li>
                  <li>Eleitoral → quantos eleitores votam onde (TSE).</li>
                </ul>
              </li>
            </ul>
            <p>Opinião reflete quem vive no município; eleitoral reflete quem vota.</p>
          </Secao>

          <Secao titulo="2. Primeiro corte: cidade vs. zona rural">
            <p>
              O N é dividido em urbano e rural na mesma proporção do município. Exemplo: N=500 com 80% urbano → ~400 na cidade e ~100 no rural.
            </p>
            <p>Assim a amostra espelha a cidade — não concentra tudo no centro nem ignora o interior.</p>
          </Secao>

          <Secao titulo="3. Segundo corte: blocos (bairros, povoados ou setores)">
            <p>Dentro de cada parte, quem tem mais gente (ou mais eleitores) recebe mais entrevistas.</p>
            <p>
              <strong className="font-medium text-text-primary">Pesquisa eleitoral</strong> — usa bairros e povoados do TSE. Os 6 bairros urbanos com mais eleitores viram blocos nomeados; os menores agrupam em &quot;Demais bairros&quot;. No rural, povoados com mais eleitores viram blocos próprios.
            </p>
            <p>
              <strong className="font-medium text-text-primary">Opinião pública</strong> — usa setores censitários do IBGE (microáreas do Censo). Setor com mais moradores pesa mais — mesma lógica proporcional.
            </p>
            <p className="rounded-lg border border-card bg-background/60 px-3 py-2 text-xs">
              Por que setor na opinião e bairro na eleitoral? Opinião = universo de residentes. Eleitoral = universo de votantes — recortes diferentes, propósitos diferentes.
            </p>
          </Secao>

          <Secao titulo="4. Cotas de sexo, idade e horário">
            <p>
              Valem para o município inteiro, não por bairro. Espelham o perfil demográfico local (Censo IBGE): proporção de homens/mulheres, faixas etárias e distribuição manhã/tarde/noite.
            </p>
            <p>O instituto controla essas metas no total da pesquisa, evitando amostra enviesada (só jovens, só manhã, etc.).</p>
          </Secao>

          <Secao titulo="5. Equipe de entrevistadores">
            <p>
              Você informa quantas pessoas irão a campo. As N entrevistas dividem-se entre elas de forma equilibrada; cada entrevistador recebe blocos territoriais na sequência do plano.
            </p>
            <p>Isso gera um roteiro realista para o tamanho da equipe do instituto — não um número genérico de entrevistadores.</p>
          </Secao>

          <Secao titulo="6. Fichas: do bloco ao endereço">
            <p>O bloco diz quantas entrevistas e em qual área. A ficha diz onde ir de fato:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Eleitoral → escola de votação, povoado, endereço e GPS (TSE).</li>
              <li>Opinião → setor censitário e ponto de partida sugerido (IBGE).</li>
              <li>Rural → nome do povoado quando o cadastro só diz &quot;Zona rural&quot;.</li>
            </ul>
          </Secao>

          <Secao titulo="7. O mapa">
            <p>
              Cores = blocos do plano. Pontos ou polígonos = locais TSE ou setores IBGE. Na eleitoral, a execução segue os locais TSE; na opinião, os setores IBGE.
            </p>
          </Secao>

          <Secao titulo="O que o plano não decide sozinho">
            <ul className="list-disc pl-4 space-y-1">
              <li>Quem abordar em cada porta (sorteio no local — regras no documento).</li>
              <li>Rotas de carro no rural (validar com prefeitura e lideranças).</li>
              <li>Substituir validação do instituto ou registro no TSE.</li>
            </ul>
          </Secao>

          <p className={brandAmberCalloutClass}>
            Em resumo: cada número existe para a amostra parecer com o município — na divisão cidade/interior, nos recortes mais povoados, no perfil demográfico e no tamanho da equipe — e as fichas traduzem isso em endereços onde o entrevistador deve começar.
          </p>
        </div>

        <div className="shrink-0 border-t border-card px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto ${brandAmberButtonClass}`}
          >
            Entendi
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
