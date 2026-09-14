import bbox from '@turf/bbox'
import bboxPolygon from '@turf/bbox-polygon'
import difference from '@turf/difference'
import { featureCollection } from '@turf/helpers'

/**
 * Polígono = retângulo amplo − contorno da UF, para cobrir vizinhos e oceano com cor sólida,
 * deixando só o interior do Piauí com o mapa-base (tiles) visível.
 */
export function buildOutsidePiauiMask(geoUf: GeoJSON.GeoJSON): GeoJSON.Feature | null {
  if (geoUf.type !== 'FeatureCollection') return null
  const fc = geoUf as GeoJSON.FeatureCollection
  const ufFeat = fc.features[0]
  if (!ufFeat?.geometry) return null
  try {
    const bb = bbox(ufFeat)
    const pad = 14
    const big = bboxPolygon([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad])
    const diffInput = featureCollection([big, ufFeat]) as GeoJSON.FeatureCollection<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >
    const mask = difference(diffInput)
    return mask ?? null
  } catch {
    return null
  }
}
