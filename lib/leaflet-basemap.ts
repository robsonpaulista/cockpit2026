/**
 * Basemap Leaflet compartilhado.
 *
 * CARTO passou a exigir API key nos tiles raster (watermark "API KEY REQUIRED").
 * Com `NEXT_PUBLIC_CARTO_API_KEY` usa CARTO; sem chave, cai no Esri Canvas (sem watermark).
 *
 * Chave gratuita: https://carto.com/basemaps/apikey/
 */

export type LeafletBasemapStyle = 'light' | 'dark' | 'dark_nolabels'

export type LeafletBasemapConfig = {
  url: string
  attribution: string
  maxZoom: number
  /** Só relevante para CARTO / OSM com `{s}`. */
  subdomains?: string
}

const CARTO_STYLE: Record<LeafletBasemapStyle, string> = {
  light: 'light_all',
  dark: 'dark_all',
  dark_nolabels: 'dark_nolabels',
}

/** Esri Canvas — visual próximo ao CARTO light/dark, sem API key. */
const ESRI_STYLE: Record<LeafletBasemapStyle, string> = {
  light: 'Canvas/World_Light_Gray_Base',
  dark: 'Canvas/World_Dark_Gray_Base',
  dark_nolabels: 'Canvas/World_Dark_Gray_Base',
}

function resolveCartoApiKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim() ||
    ''
  return key || null
}

export function getLeafletBasemap(style: LeafletBasemapStyle = 'light'): LeafletBasemapConfig {
  const key = resolveCartoApiKey()
  if (key) {
    const path = CARTO_STYLE[style]
    return {
      url: `https://{s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }
  }

  const service = ESRI_STYLE[style]
  return {
    url: `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS',
    maxZoom: 16,
  }
}

/** Opções prontas para `L.tileLayer(url, options)`. */
export function getLeafletBasemapLayerOptions(style: LeafletBasemapStyle = 'light'): {
  url: string
  options: {
    attribution: string
    maxZoom: number
    subdomains?: string
  }
} {
  const basemap = getLeafletBasemap(style)
  return {
    url: basemap.url,
    options: {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
      ...(basemap.subdomains ? { subdomains: basemap.subdomains } : {}),
    },
  }
}
