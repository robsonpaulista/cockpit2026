/**
 * Stack tipográfico institucional da aplicação.
 * IBM Plex Sans (principal) + Inter (fallback premium via next/font).
 */
export const APP_FONT_STACK_CSS =
  "var(--font-sans), var(--font-sans-fallback), 'IBM Plex Sans', 'Inter', sans-serif"

/** Classes Tailwind — preferir `font-sans` quando possível. */
export const APP_FONT_BODY_CLASS = 'font-sans'
