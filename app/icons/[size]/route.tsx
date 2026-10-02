import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const ALLOWED = new Set([32, 180, 192, 512])

export async function GET(
  _request: Request,
  { params }: { params: { size: string } }
) {
  const n = parseInt(params.size, 10)
  if (!ALLOWED.has(n)) {
    return new Response('Not Found', { status: 404 })
  }

  /** Favicon pequeno: X âmbar. Ícones grandes: marca X com leve glow. */
  const fontSize = Math.round(n * (n <= 32 ? 0.62 : n <= 192 ? 0.52 : 0.48))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(165deg, #1a1c20 0%, #0a0a0c 48%, #050506 100%)',
          color: '#e8a825',
          fontSize,
          fontWeight: 700,
          fontFamily: "ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
          letterSpacing: n <= 32 ? '-0.06em' : '-0.04em',
          borderRadius: Math.round(n * 0.18),
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            textShadow:
              n >= 180
                ? '0 0 24px rgba(232,168,37,0.35)'
                : '0 0 8px rgba(232,168,37,0.25)',
          }}
        >
          X
        </div>
      </div>
    ),
    { width: n, height: n }
  )
}
