'use client'

import { useEffect } from 'react'
import { MapPin } from 'lucide-react'
import {
  TseFilterBar,
  TsePage,
  TseSelectGrande,
  TseTabs,
  tseLinkAcaoClass,
  type TseAba,
} from '@/components/tse/tse-ui'
import {
  MUNICIPIOS_PI_ORDENADOS,
  useTerritorioMunicipio,
} from '@/components/territorio-campo/territorio-municipio-context'
import {
  TERRITORIO_CAMPO_TAB_BASE,
  TERRITORIO_CAMPO_TAB_DEMANDAS,
  TERRITORIO_CAMPO_TAB_LIDERANCAS,
  TERRITORIO_CAMPO_TAB_VISITAS,
  type TerritorioCampoTab,
} from '@/lib/territorio-campo-route'
import { useAllowedHubTabs } from '@/hooks/use-allowed-hub-tabs'
import '@/app/dashboard/war-room/war-room-fonts.css'
import '@/app/dashboard/war-room/war-room-clean.css'
import '@/app/dashboard/shared/territorio-cx-chrome.css'

const TABS: readonly TseAba<TerritorioCampoTab>[] = [
  { id: TERRITORIO_CAMPO_TAB_BASE, label: 'Base' },
  { id: TERRITORIO_CAMPO_TAB_VISITAS, label: 'Visitas' },
  { id: TERRITORIO_CAMPO_TAB_LIDERANCAS, label: 'Lideranças' },
  { id: TERRITORIO_CAMPO_TAB_DEMANDAS, label: 'Demandas' },
]

interface TerritorioCampoShellProps {
  activeTab: TerritorioCampoTab
  onTabChange: (tab: TerritorioCampoTab) => void
  children: React.ReactNode
}

export function TerritorioCampoShell({ activeTab, onTabChange, children }: TerritorioCampoShellProps) {
  const visibleTabs = useAllowedHubTabs('territorio', TABS, activeTab, onTabChange)
  const { municipio, setMunicipio } = useTerritorioMunicipio()

  // Abas ainda não migradas para o padrão TSE dependem do tema Cockpit X (seletores em body[data-*]).
  useEffect(() => {
    document.body.setAttribute('data-war-room-clean', '')
    document.body.setAttribute('data-wr-copiloto', '')
    document.body.setAttribute('data-territorio-cx', '')
    return () => {
      document.body.removeAttribute('data-wr-copiloto')
      document.body.removeAttribute('data-territorio-cx')
    }
  }, [])

  return (
    <TsePage>
      <TseFilterBar>
        <TseSelectGrande
          icone={MapPin}
          rotulo="Município"
          value={municipio ?? ''}
          onChange={(e) => setMunicipio(e.target.value || null)}
        >
          <option value="">Piauí</option>
          {MUNICIPIOS_PI_ORDENADOS.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </TseSelectGrande>
        {municipio ? (
          <button type="button" onClick={() => setMunicipio(null)} className={tseLinkAcaoClass}>
            Ver Piauí inteiro
          </button>
        ) : null}
      </TseFilterBar>

      <TseTabs className="mt-5" abas={visibleTabs} ativa={activeTab} onChange={onTabChange} />

      <div className="mt-5">{children}</div>
    </TsePage>
  )
}

export type { TerritorioCampoTab }
