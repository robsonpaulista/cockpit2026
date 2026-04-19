/** Tipos compartilhados entre a API da malha e o mapa (cliente). */

export interface MalhaFeatureProperties {
  codarea: string
  centroide?: [number, number]
  nm_mun?: string
  td?: string | null
}

export interface MalhaFeature {
  type: string
  properties: MalhaFeatureProperties
  geometry: unknown
}

export interface MalhaCollection {
  type: string
  features: MalhaFeature[]
}

export interface MalhaMapaPIPayload {
  municipios: MalhaCollection
  contornoUf: MalhaCollection | null
}
