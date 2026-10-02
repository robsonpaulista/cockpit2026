/**
 * Lideranças do CSV `liderancas-engaja.csv` (fonte Arena).
 * IDs estáveis a partir do slug do link de afiliação.
 * Telefone e e-mail ficam só em `public.leaders` (este arquivo vai para o bundle do client).
 */

import type { ArenaLeader } from '@/lib/arena/types'

export type EngajaLeaderRow = ArenaLeader & {
  instagram: string
  afiliacaoUrl: string | null
  lideradosCount: number
}

export const ENGAJA_LEADERS: EngajaLeaderRow[] = [
  { id: 'engaja-9zqavn6s', name: 'Parangole', city: 'Teresina', instagram: 'negao_parangole', afiliacaoUrl: 'https://engaja2026.com/cadastro/9zqavn6s', lideradosCount: 0 },
  { id: 'engaja-xr9xsh4d', name: 'Thatiana Venancio', city: 'Teresina', instagram: 'thatianarvenancio', afiliacaoUrl: 'https://engaja2026.com/cadastro/xr9xsh4d', lideradosCount: 43 },
  { id: 'engaja-ephi5eq6', name: 'Alessya Xavier', city: 'Teresina', instagram: 'alessyaxavier', afiliacaoUrl: 'https://engaja2026.com/cadastro/ephi5eq6', lideradosCount: 7 },
  { id: 'engaja-yuwx8fg7', name: 'Ferreirinha', city: 'Teresina', instagram: 'ferreirarego', afiliacaoUrl: 'https://engaja2026.com/cadastro/yuwx8fg7', lideradosCount: 4 },
  { id: 'engaja-38zs3puv', name: 'Jadyel Alencar', city: 'Teresina', instagram: 'jadyelalencar', afiliacaoUrl: 'https://engaja2026.com/cadastro/38zs3puv', lideradosCount: 23 },
  { id: 'engaja-6uc37fqv', name: 'Gustavo', city: 'Piracuruca', instagram: 'perfil15', afiliacaoUrl: 'https://engaja2026.com/cadastro/6uc37fqv', lideradosCount: 0 },
  { id: 'engaja-w6c9uac3', name: 'Paula Coelho', city: 'Bela Vista do Piauí', instagram: 'pefil33', afiliacaoUrl: 'https://engaja2026.com/cadastro/w6c9uac3', lideradosCount: 0 },
  { id: 'engaja-fc5syzzw', name: 'Valdiomar Vereador', city: 'Cocal', instagram: 'valdiomar2irmaos', afiliacaoUrl: 'https://engaja2026.com/cadastro/fc5syzzw', lideradosCount: 0 },
  { id: 'engaja-st7i83zu', name: 'Helio Junior Vereador', city: 'Altos', instagram: 'helioinacioadv', afiliacaoUrl: 'https://engaja2026.com/cadastro/st7i83zu', lideradosCount: 0 },
  { id: 'engaja-hywufas9', name: 'Renata Moura', city: 'Porto', instagram: 'perfil16', afiliacaoUrl: 'https://engaja2026.com/cadastro/hywufas9', lideradosCount: 0 },
  { id: 'engaja-jyyexwe7', name: 'Leonardo Simeao Vereador', city: "Pau D'Arco do Piauí", instagram: 'leonardosimeao._', afiliacaoUrl: 'https://engaja2026.com/cadastro/jyyexwe7', lideradosCount: 0 },
  { id: 'engaja-x5svbxgi', name: 'Socio do Delta', city: 'Ilha Grande', instagram: 'socio_do_delta', afiliacaoUrl: 'https://engaja2026.com/cadastro/x5svbxgi', lideradosCount: 0 },
  { id: 'engaja-r7pgzizd', name: 'Osama Vereador', city: 'Coivaras', instagram: 'osamadobarnabe', afiliacaoUrl: 'https://engaja2026.com/cadastro/r7pgzizd', lideradosCount: 0 },
  { id: 'engaja-kxkr87nc', name: 'Thomaz', city: 'Regeneração', instagram: 'thomazferreiraneto82', afiliacaoUrl: 'https://engaja2026.com/cadastro/kxkr87nc', lideradosCount: 0 },
  { id: 'engaja-2dx7zs9a', name: 'Veredor Bigode', city: 'Parnaíba', instagram: 'vereadorfranciscobigode', afiliacaoUrl: 'https://engaja2026.com/cadastro/2dx7zs9a', lideradosCount: 4 },
  { id: 'engaja-k4xfgv5h', name: 'Wellington Sena', city: 'Campo Maior', instagram: 'wellingtonsenacm', afiliacaoUrl: 'https://engaja2026.com/cadastro/k4xfgv5h', lideradosCount: 4 },
  { id: 'engaja-cem6r9cu', name: 'Michele Maroca', city: 'Campo Maior', instagram: 'michellemaroca', afiliacaoUrl: 'https://engaja2026.com/cadastro/cem6r9cu', lideradosCount: 3 },
  { id: 'engaja-2ttrayup', name: 'Hilderlene Brito', city: 'Campo Maior', instagram: 'hilderlene_brito', afiliacaoUrl: 'https://engaja2026.com/cadastro/2ttrayup', lideradosCount: 10 },
  { id: 'engaja-hg9gcxw5', name: 'Ze Filho de Caxingo', city: 'Parnaíba', instagram: 'vereadorzefilhocaxingo', afiliacaoUrl: 'https://engaja2026.com/cadastro/hg9gcxw5', lideradosCount: 4 },
  { id: 'engaja-2wma6kac', name: 'Rennan do Renatinho', city: 'Parnaíba', instagram: 'perfil2', afiliacaoUrl: 'https://engaja2026.com/cadastro/2wma6kac', lideradosCount: 6 },
  { id: 'engaja-cjumrvnc', name: 'Netinho', city: 'Parnaíba', instagram: 'netinho_phb', afiliacaoUrl: 'https://engaja2026.com/cadastro/cjumrvnc', lideradosCount: 5 },
  { id: 'engaja-fjrzuydp', name: 'Neta da Kolping', city: 'Parnaíba', instagram: 'vereadora_netadakolping', afiliacaoUrl: 'https://engaja2026.com/cadastro/fjrzuydp', lideradosCount: 4 },
  { id: 'engaja-59wa6a5v', name: 'Geissyane Mikaele', city: 'Parnaíba', instagram: 'geicianemickaelen', afiliacaoUrl: 'https://engaja2026.com/cadastro/59wa6a5v', lideradosCount: 4 },
  { id: 'engaja-p3ud9ni2', name: 'Gabinete THE', city: 'Teresina', instagram: '_cvinicius7', afiliacaoUrl: 'https://engaja2026.com/cadastro/p3ud9ni2', lideradosCount: 9 },
]

export function engajaLeadersAsArena(): ArenaLeader[] {
  return ENGAJA_LEADERS.map(({ id, name, city }) => ({ id, name, city }))
}
