import { Faction } from './types';

export type ZoneCategory = 'base' | 'crossing' | 'village' | 'industrial' | 'ruins' | 'outpost' | 'nature';

export interface CombatZoneDef {
  id: string;
  name: string;
  category: ZoneCategory;
  x: number;
  z: number;
  radius: number;
  defaultOwner: Faction | 'neutral';
  description: string;
}

export const KIVU_COMBAT_ZONES: CombatZoneDef[] = [
  // Rive Sud (Contrôle initial Armée / Sud)
  {
    id: 'z_qg_sud',
    name: 'QG Armée Sud',
    category: 'base',
    x: -10,
    z: 108,
    radius: 22,
    defaultOwner: 'army',
    description: 'Poste de commandement fortifié et antenne tactique',
  },
  {
    id: 'z_heliport',
    name: 'Héliport du Kivu',
    category: 'base',
    x: 44,
    z: 112,
    radius: 22,
    defaultOwner: 'army',
    description: 'Plateforme bétonnée d’évacuation et soutes à carburant',
  },
  {
    id: 'z_depot_carburant',
    name: 'Dépôt Carburant Sud',
    category: 'industrial',
    x: -74,
    z: 96,
    radius: 20,
    defaultOwner: 'army',
    description: 'Citernes industrielles et barils explosifs',
  },
  {
    id: 'z_ravin_ouest',
    name: 'Ravin Basaltique Ouest',
    category: 'nature',
    x: -120,
    z: 86,
    radius: 22,
    defaultOwner: 'army',
    description: 'Escarpements volcaniques et tranchées rocheuses',
  },
  {
    id: 'z_batterie_est',
    name: "Batterie d'Artillerie Est",
    category: 'outpost',
    x: 96,
    z: 94,
    radius: 21,
    defaultOwner: 'army',
    description: 'Alvéoles de tir protégées par sacs de sable',
  },
  {
    id: 'z_village_pecheurs',
    name: 'Village de Pêcheurs',
    category: 'village',
    x: -112,
    z: 48,
    radius: 23,
    defaultOwner: 'neutral',
    description: 'Cases en bois sur pilotis et toits en tôle ondulée',
  },
  {
    id: 'z_tranchees_so',
    name: 'Tranchées Sud-Ouest',
    category: 'outpost',
    x: -50,
    z: 48,
    radius: 19,
    defaultOwner: 'army',
    description: 'Réseau de tranchées en zigzag couvrant le flanc ouest',
  },
  {
    id: 'z_marche_sud',
    name: 'Marché du Carrefour',
    category: 'village',
    x: 12,
    z: 52,
    radius: 21,
    defaultOwner: 'army',
    description: 'Échoppes couvertes, caisses et barricades urbaines',
  },
  {
    id: 'z_plantation_the',
    name: 'Plantation de Thé',
    category: 'nature',
    x: 68,
    z: 66,
    radius: 22,
    defaultOwner: 'neutral',
    description: 'Terrasses cultivées et hangar de séchage',
  },
  {
    id: 'z_scierie',
    name: 'Scierie Forestière',
    category: 'industrial',
    x: 118,
    z: 42,
    radius: 21,
    defaultOwner: 'neutral',
    description: 'Piles de grumes, atelier et abris en bois brut',
  },

  // Ligne Fluviale (Passages & Îlots)
  {
    id: 'z_pont_ouest',
    name: 'Pont Suspendu Ouest',
    category: 'crossing',
    x: -76,
    z: 0,
    radius: 17,
    defaultOwner: 'neutral',
    description: 'Passerelle à câbles traversant le courant occidental',
  },
  {
    id: 'z_gue_ouest',
    name: 'Gué des Roseaux',
    category: 'crossing',
    x: -38,
    z: -1,
    radius: 17,
    defaultOwner: 'neutral',
    description: 'Passage peu profond bordé de hauts roseaux',
  },
  {
    id: 'z_pont_central',
    name: 'Pont Central en Bois',
    category: 'crossing',
    x: 0,
    z: 0,
    radius: 18,
    defaultOwner: 'neutral',
    description: 'Pont principal stratégique reliant les deux rives',
  },
  {
    id: 'z_ilot_central',
    name: 'Îlot Fluvial',
    category: 'nature',
    x: 22,
    z: 2,
    radius: 15,
    defaultOwner: 'neutral',
    description: 'Banc de sable fortifié au milieu des eaux',
  },
  {
    id: 'z_gue_est',
    name: 'Gué Rocheux Est',
    category: 'crossing',
    x: 38,
    z: 1,
    radius: 17,
    defaultOwner: 'neutral',
    description: 'Rochers volcaniques affleurants dans le fleuve',
  },
  {
    id: 'z_ponton_est',
    name: 'Ponton Tactique Est',
    category: 'crossing',
    x: 78,
    z: 0,
    radius: 17,
    defaultOwner: 'neutral',
    description: 'Ponton militaire métallique sur flotteurs',
  },
  {
    id: 'z_station_pompage',
    name: 'Station de Pompage',
    category: 'industrial',
    x: 118,
    z: -8,
    radius: 20,
    defaultOwner: 'neutral',
    description: 'Bâtiment technique et conduites hydrauliques',
  },

  // Rive Nord (Crête & Bastions Rebelles)
  {
    id: 'z_ruines_mission',
    name: 'Ruines de la Mission',
    category: 'ruins',
    x: -66,
    z: -54,
    radius: 22,
    defaultOwner: 'neutral',
    description: 'Anciens murs de brique effondrés et clocher en ruine',
  },
  {
    id: 'z_poste_douanier',
    name: 'Poste Douanier NO',
    category: 'outpost',
    x: -116,
    z: -68,
    radius: 21,
    defaultOwner: 'rebels',
    description: 'Barrage routier, guérite et blocs de béton',
  },
  {
    id: 'z_mirador_crete',
    name: 'Mirador de la Crête',
    category: 'outpost',
    x: 42,
    z: -48,
    radius: 20,
    defaultOwner: 'rebels',
    description: 'Poste d’observation surélevé dominant le fleuve',
  },
  {
    id: 'z_entrepot_munitions',
    name: 'Entrepôt de Munitions',
    category: 'industrial',
    x: -16,
    z: -74,
    radius: 21,
    defaultOwner: 'rebels',
    description: 'Hangar en tôle, caisses d’obus et dépôts',
  },
  {
    id: 'z_carriere_laterite',
    name: 'Carrière de Latérite',
    category: 'industrial',
    x: 80,
    z: -80,
    radius: 22,
    defaultOwner: 'rebels',
    description: 'Terrasses d’extraction rouge et gros rochers',
  },
  {
    id: 'z_camp_rebelle',
    name: 'Campement Rebelle Nord',
    category: 'base',
    x: 10,
    z: -108,
    radius: 23,
    defaultOwner: 'rebels',
    description: 'Quartier général forestier et feux de camp',
  },
  {
    id: 'z_relais_radio',
    name: 'Relais Radio Colline Nord',
    category: 'outpost',
    x: 118,
    z: -110,
    radius: 22,
    defaultOwner: 'rebels',
    description: 'Pylône de transmissions et abri générateur',
  },
];

export function findZoneAt(x: number, z: number): CombatZoneDef | null {
  let best: CombatZoneDef | null = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < KIVU_COMBAT_ZONES.length; i++) {
    const zDef = KIVU_COMBAT_ZONES[i];
    const dx = x - zDef.x;
    const dz = z - zDef.z;
    const dSq = dx * dx + dz * dz;
    if (dSq <= zDef.radius * zDef.radius && dSq < bestDistSq) {
      bestDistSq = dSq;
      best = zDef;
    }
  }
  return best;
}
