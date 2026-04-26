/**
 * Renderização PNG 1080x1080 com Satori + Resvg (Node / API routes).
 */

import React from 'react'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const W = 1080
const H = 1080

let fontRegular: ArrayBuffer | null = null
let fontBold: ArrayBuffer | null = null

async function loadFonts(): Promise<void> {
  if (fontRegular && fontBold) return
  const [r, b] = await Promise.all([
    fetch(
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff'
    ).then((res) => res.arrayBuffer()),
    fetch(
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff'
    ).then((res) => res.arrayBuffer()),
  ])
  fontRegular = r
  fontBold = b
}

const palette: Record<string, { bg: string; accent: string; sub: string }> = {
  obra_impacto: { bg: '#0f172a', accent: '#f8fafc', sub: '#94a3b8' },
  prestacao_contas: { bg: '#14532d', accent: '#ecfdf5', sub: '#bbf7d0' },
  cidade_beneficiada: { bg: '#1e3a5f', accent: '#fff7ed', sub: '#fed7aa' },
  agenda_chegada: { bg: '#312e81', accent: '#eef2ff', sub: '#c7d2fe' },
  frase_local: { bg: '#422006', accent: '#fffbeb', sub: '#fde68a' },
}

function CardLayout(input: {
  template: string
  titulo: string | null
  texto_arte: string | null
  cidade: string | null
  subtitulo?: string | null
  imagemFundo?: string | null
}): React.ReactElement {
  const tpl = input.template in palette ? input.template : 'obra_impacto'
  const { bg, accent, sub } = palette[tpl]

  const titulo = input.titulo?.trim() || 'Conteúdo'
  const texto = input.texto_arte?.trim() || ''
  const cidade = input.cidade?.trim() || ''
  const extra = input.subtitulo?.trim()
  const imagemFundo = input.imagemFundo?.trim() || null

  return (
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        position: 'relative',
        backgroundColor: bg,
        fontFamily: 'Inter',
      }}
    >
      {imagemFundo ? (
        <img
          src={imagemFundo}
          style={{
            position: 'absolute',
            width: W,
            height: H,
            objectFit: 'cover',
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          width: W,
          height: H,
          background: imagemFundo
            ? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.15) 100%)'
            : 'linear-gradient(135deg, #1a2744 0%, #0f1a35 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 90,
          left: 80,
          right: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <p
          style={{
            fontSize: 32,
            color: '#F5A623',
            fontWeight: 700,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {titulo}
        </p>
        <p
          style={{
            fontSize: 58,
            color: accent,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {texto}
        </p>
        {extra ? (
          <p
            style={{
              fontSize: 26,
              color: 'rgba(255,255,255,0.7)',
              margin: 0,
            }}
          >
            {extra}
          </p>
        ) : null}
        <p
          style={{
            fontSize: 26,
            color: sub,
            margin: 0,
          }}
        >
          {cidade}
        </p>
      </div>
    </div>
  )
}

export async function renderCardPng(input: {
  template: string
  titulo: string | null
  texto_arte: string | null
  cidade: string | null
  subtitulo?: string | null
  imagemFundo?: string | null
}): Promise<Buffer> {
  await loadFonts()

  const element = <CardLayout {...input} />

  const svg = await satori(element, {
    width: W,
    height: H,
    fonts: [
      {
        name: 'Inter',
        data: fontRegular!,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Inter',
        data: fontBold!,
        weight: 700,
        style: 'normal',
      },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: W,
    },
  })
  const png = resvg.render().asPng()
  return Buffer.from(png)
}
