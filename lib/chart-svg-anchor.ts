import type { PopupAnchor } from '@/lib/anchored-popup-position'

export function svgPointToViewport(svg: SVGSVGElement, x: number, y: number): PopupAnchor {
  const point = svg.createSVGPoint()
  point.x = x
  point.y = y
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x, y }

  const transformed = point.matrixTransform(matrix)
  return { x: transformed.x, y: transformed.y }
}

export function getChartPointAnchor(
  container: HTMLElement | null,
  cx: number,
  cy: number
): PopupAnchor | null {
  if (!container) return null
  const svg = container.querySelector('svg')
  if (!svg) return null
  return svgPointToViewport(svg, cx, cy)
}
