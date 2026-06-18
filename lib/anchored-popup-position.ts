export type PopupAnchor = {
  x: number
  y: number
}

export function computeAnchoredPopupPosition(
  anchor: PopupAnchor,
  panelWidth: number,
  panelHeight: number,
  viewport = typeof window !== 'undefined'
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: 1280, height: 800 }
): { left: number; top: number } {
  const margin = 12
  const gap = 10

  let left = anchor.x + gap
  let top = anchor.y + gap

  if (left + panelWidth > viewport.width - margin) {
    left = anchor.x - panelWidth - gap
  }

  if (top + panelHeight > viewport.height - margin) {
    top = anchor.y - panelHeight - gap
  }

  if (top < margin) {
    top = margin
  }

  if (left < margin) {
    left = margin
  }

  if (left + panelWidth > viewport.width - margin) {
    left = viewport.width - panelWidth - margin
  }

  if (top + panelHeight > viewport.height - margin) {
    top = viewport.height - panelHeight - margin
  }

  return { left, top }
}
