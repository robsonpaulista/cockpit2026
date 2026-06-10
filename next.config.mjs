/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mantém páginas compiladas por mais tempo no dev — reduz 404 ao navegar entre rotas.
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  experimental: {
    /** Resvg usa addon nativo; não empacotar no webpack (API routes / Node). */
    serverComponentsExternalPackages: ['@supabase/supabase-js', '@supabase/ssr', '@resvg/resvg-js'],
  },
  async headers() {
    return [
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Content-Type', value: 'application/javascript; charset=utf-8' }],
      },
      {
        source: '/((?!_next|favicon.ico|icons|sw\\.js|sw-pesquisador\\.js|manifest\\.webmanifest).*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // microphone=() bloqueia Web Speech / getUserMedia mesmo com permissão do SO e do site
            value: 'camera=(), geolocation=(), microphone=(self)',
          },
        ],
      },
    ]
  },
}

export default nextConfig




