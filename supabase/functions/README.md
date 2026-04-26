# Edge Functions (opcional)

Neste repositório, a **geração de PNG** (Satori + Resvg) roda nas **API Routes do Next.js** em Vercel Hobby:

- `POST /api/conteudo/planejados/[id]/generate` — Groq + render + upload no bucket `rascunhos`.

Isso evita manter Deno/wasm do Resvg na Edge do Supabase e funciona no free tier sem custo extra.

Se no futuro quiser mover só a imagem para Supabase Edge Functions, use Satori + **@resvg/resvg-wasm** (carregar o `.wasm` via URL estável) em vez de `@resvg/resvg-js`, pois o binding nativo não roda no runtime Deno da Edge.
