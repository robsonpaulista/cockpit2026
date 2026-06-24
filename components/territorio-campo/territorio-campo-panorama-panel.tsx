'use client'

import { PanoramaCampoDataSection } from '@/components/territorio-campo/panorama-campo-data-section'
import { PanoramaTerritorioTopRow } from '@/components/territorio-campo/panorama-territorio-top-row'

export function TerritorioCampoPanoramaPanel() {
  return (
    <div className="flex flex-col gap-4">
      <PanoramaTerritorioTopRow />
      <PanoramaCampoDataSection />
    </div>
  )
}
