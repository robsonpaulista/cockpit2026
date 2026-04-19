import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const ALLOWED = new Set([180, 192, 512])

export async function GET(
  _request: Request,
  { params }: { params: { size: string } }
) {
  const n = parseInt(params.size, 10)
  if (!ALLOWED.has(n)) {
    return new Response('Not Found', { status: 404 })
  }

  const label = n >= 256 ? 'C26' : 'C'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0E74BC 0%, #062952 55%, #041a36 100%)',
          color: '#ffffff',
          fontSize: Math.round(n * (n <= 192 ? 0.32 : 0.28)),
          fontWeight: 700,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          letterSpacing: '-0.04em',
        }}
      >
        {label}
      </div>
    ),
    { width: n, height: n }
  )
}
