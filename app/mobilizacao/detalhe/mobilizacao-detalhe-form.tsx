'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

type LeaderContext = {
  leader: {
    id: string
    nome: string
    cidade: string | null
  }
}

function formatWhatsappDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function MobilizacaoDetalheForm() {
  const searchParams = useSearchParams()
  const leaderId = useMemo(() => {
    const raw =
      searchParams.get('leader_id') ??
      searchParams.get('leaderId') ??
      searchParams.get('lider_id') ??
      searchParams.get('id') ??
      ''
    return raw.trim()
  }, [searchParams])

  const [contexto, setContexto] = useState<LeaderContext | null>(null)
  const [carregandoContexto, setCarregandoContexto] = useState(true)
  const [erroContexto, setErroContexto] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [lgpdAceite, setLgpdAceite] = useState<boolean>(false)

  const [enviando, setEnviando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    const carregarContexto = async () => {
      setMensagemErro(null)
      setMensagemSucesso(null)
      if (!leaderId) {
        setErroContexto(
          'Link de captação sem identificação da liderança. Use o link completo do QR (ex.: /mobilizacao/detalhe?leader_id=UUID_DA_LIDERANCA).'
        )
        setContexto(null)
        setCarregandoContexto(false)
        return
      }

      setCarregandoContexto(true)
      setErroContexto(null)
      try {
        const res = await fetch(`/api/mobilizacao/leads?leader_id=${encodeURIComponent(leaderId)}`)
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string
          leader?: { id: string; nome: string; cidade: string | null }
          coordinator?: { id: string; nome: string; regiao: string | null } | null
        }
        if (cancelado) return
        if (!res.ok || !payload.leader) {
          setErroContexto(payload.error ?? 'Não foi possível validar este link de captação.')
          setContexto(null)
          return
        }
        setContexto({
          leader: payload.leader,
        })
      } catch {
        if (!cancelado) {
          setErroContexto('Falha de conexão ao validar o link de captação.')
          setContexto(null)
        }
      } finally {
        if (!cancelado) setCarregandoContexto(false)
      }
    }

    void carregarContexto()
    return () => {
      cancelado = true
    }
  }, [leaderId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMensagemErro(null)
    setMensagemSucesso(null)

    if (!contexto?.leader?.id) {
      setMensagemErro('Link de liderança inválido. Solicite um novo QR.')
      return
    }

    const nomeLimpo = nome.trim()
    const whatsappLimpo = whatsapp.replace(/\D/g, '')
    if (nomeLimpo.length < 2) {
      setMensagemErro('Informe seu nome completo.')
      return
    }
    if (whatsappLimpo.length < 10) {
      setMensagemErro('Informe um WhatsApp válido com DDD.')
      return
    }

    const instagramLimpo = instagram.trim().replace(/^@+/, '').replace(/\s+/g, '')
    if (!instagramLimpo) {
      setMensagemErro('Informe seu Instagram (nome de usuário).')
      return
    }

    if (!lgpdAceite) {
      setMensagemErro('É necessário aceitar o tratamento dos dados pessoais conforme a LGPD.')
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/mobilizacao/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeLimpo,
          whatsapp: whatsappLimpo,
          instagram: instagram.trim(),
          leader_id: contexto.leader.id,
          origem: 'qr',
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        lead?: { id: string }
      }
      if (!res.ok) {
        setMensagemErro(payload.error ?? 'Não foi possível concluir seu cadastro.')
        return
      }

      setNome('')
      setWhatsapp('')
      setInstagram('')
      setLgpdAceite(false)
      setMensagemSucesso('Cadastro enviado com sucesso. Obrigado por somar com a nossa mobilização!')
    } catch {
      setMensagemErro('Erro de conexão. Tente novamente em instantes.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6 sm:py-10">
      <div className="w-full max-w-xl rounded-2xl border border-card bg-surface p-5 shadow-sm sm:p-6">
        <header className="mb-5 border-b border-card pb-4">
          <div
            className="mb-5 flex w-full min-w-0 flex-col items-center justify-center gap-5 sm:mb-6 sm:flex-row sm:items-end sm:justify-center sm:gap-8"
            aria-label="Identidade visual"
          >
            <div className="relative h-14 w-full max-w-[min(100%,280px)] shrink-0 sm:h-[4.5rem]">
              <Image
                src="/logomarca.png"
                alt="Logomarca"
                fill
                className="object-contain object-center"
                sizes="(max-width: 640px) 100vw, 280px"
                priority
              />
            </div>
            <div className="relative h-[min(42svh,260px)] w-full max-w-[min(72vw,220px)] shrink-0 sm:h-56 sm:max-w-[240px]">
              <Image
                src="/personagem.png"
                alt=""
                fill
                className="object-contain object-bottom"
                sizes="(max-width: 640px) 72vw, 240px"
                priority
                aria-hidden
              />
            </div>
          </div>
          <h1 className="text-center text-xl font-semibold text-text-primary">Cadastro de Mobilização</h1>
          <p className="mt-1 text-center text-sm text-text-secondary">
            Preencha seus dados para entrar na base de mobilização.
          </p>
          {contexto ? (
            <p className="mt-3 text-center text-xs text-text-muted">
              Liderança: <span className="font-medium text-text-secondary">{contexto.leader.nome}</span>
            </p>
          ) : null}
        </header>

        {carregandoContexto ? (
          <p className="text-sm text-text-secondary">Validando link de captação...</p>
        ) : erroContexto ? (
          <p className="rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {erroContexto}
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="nome" className="mb-1 block text-sm font-medium text-text-secondary">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
                className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="Digite seu nome completo"
              />
            </div>

            <div>
              <label htmlFor="whatsapp" className="mb-1 block text-sm font-medium text-text-secondary">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsappDigits(e.target.value))}
                required
                autoComplete="tel"
                className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="(86) 99999-9999"
              />
            </div>

            <div>
              <label htmlFor="instagram" className="mb-1 block text-sm font-medium text-text-secondary">
                Instagram
              </label>
              <input
                id="instagram"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                required
                autoComplete="off"
                className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="@usuario ou usuario"
              />
            </div>

            <div className="rounded-lg border border-card/80 bg-background/50 p-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-card text-accent-gold focus:ring-accent-gold-soft"
                  checked={lgpdAceite}
                  onChange={(e) => setLgpdAceite(e.target.checked)}
                  required
                />
                <span>
                  Declaro que li e autorizo o tratamento dos meus dados pessoais para fins de cadastro e contato pela
                  mobilização, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), inclusive
                  comunicações por WhatsApp e redes sociais quando indicadas neste formulário.
                </span>
              </label>
            </div>

            {mensagemErro ? (
              <p className="rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
                {mensagemErro}
              </p>
            ) : null}

            {mensagemSucesso ? (
              <p className="rounded-lg border border-status-success/40 bg-status-success/10 px-3 py-2 text-sm text-status-success">
                {mensagemSucesso}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent-gold px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {enviando ? 'Enviando...' : 'Enviar cadastro'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
