import type { PoliticalActorType } from '@/lib/youtube-radar-types'

export const ACTOR_TYPE_OPTIONS: { value: PoliticalActorType; label: string }[] = [
  { value: 'own_candidate', label: 'Candidato próprio' },
  { value: 'competitor', label: 'Concorrente' },
  { value: 'ally', label: 'Aliado' },
  { value: 'other', label: 'Outro' },
]

export function labelActorType(type: PoliticalActorType): string {
  return ACTOR_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}
