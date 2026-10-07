'use client'

import { useEffect, type ReactNode } from 'react'
import { TseModal, tseBotaoPrimarioClass } from '@/components/tse/tse-ui'

type PlanoAmostragemComoFuncionaModalProps = {
  open: boolean
  onClose: () => void
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-[14px] font-bold">{titulo}</h3>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-[var(--tse-muted)]">{children}</div>
    </section>
  )
}

export function PlanoAmostragemComoFuncionaModal({ open, onClose }: PlanoAmostragemComoFuncionaModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <TseModal
      id="como-funciona-titulo"
      titulo="Como funciona o plano?"
      subtitulo="Por que cada área recebe X entrevistas — lógica do gerador"
      onClose={onClose}
      largura="max-w-2xl"
      rodape={
        <button type="button" onClick={onClose} className={`${tseBotaoPrimarioClass} ml-auto`}>
          Entendi
        </button>
      }
    >
      <p className="rounded-xl bg-white p-4 text-[13px] leading-relaxed text-[var(--tse-muted)] shadow-sm">
        A lógica é sempre a mesma: <strong className="font-bold text-[var(--tse-text)]">primeiro o total (N), depois repartir proporcionalmente</strong>, como fatiar um bolo em que pedaços maiores correspondem a mais moradores ou mais eleitores.
      </p>

      <Secao titulo="1. O que você define">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-[var(--tse-text)]">Município</strong> — universo da pesquisa.
          </li>
          <li>
            <strong className="font-bold text-[var(--tse-text)]">N (400 a 2000, de 100 em 100)</strong> — quantas entrevistas face a face.
          </li>
          <li>
            <strong className="font-bold text-[var(--tse-text)]">Tipo</strong> — muda quem pesa no mapa:
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
          <strong className="font-bold text-[var(--tse-text)]">Pesquisa eleitoral</strong> — usa bairros e povoados do TSE. Os 6 bairros urbanos com mais eleitores viram blocos nomeados; os menores agrupam em &quot;Demais bairros&quot;. No rural, povoados com mais eleitores viram blocos próprios.
        </p>
        <p>
          <strong className="font-bold text-[var(--tse-text)]">Opinião pública</strong> — usa setores censitários do IBGE (microáreas do Censo). Setor com mais moradores pesa mais — mesma lógica proporcional.
        </p>
        <p className="rounded-lg bg-[var(--tse-bar)] px-3 py-2 text-[12px]">
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

      <p className="rounded-xl bg-[var(--tse-yellow-soft)] p-4 text-[13px] leading-relaxed">
        Em resumo: cada número existe para a amostra parecer com o município — na divisão cidade/interior, nos recortes mais povoados, no perfil demográfico e no tamanho da equipe — e as fichas traduzem isso em endereços onde o entrevistador deve começar.
      </p>
    </TseModal>
  )
}
