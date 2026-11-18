import { CombatModeId } from './types';

export interface CombatModeSpec {
  id: CombatModeId;
  name: string;
  shortName: string;
  description: string;
  maxTickets: number;
  scoreLimit: number;
  matchDurationSec: number;
  respawnDelay: number;
  damageMultiplier: number;
  captureSpeedMult: number;
  maxSoldiersPerSide: number;
  enemyRadarRange: number;
  usesSectors: boolean;
  objectiveLabel: string;
}

export const COMBAT_MODES: CombatModeSpec[] = [
  {
    id: 'conquest',
    name: 'Conquête Totale',
    shortName: 'CONQUÊTE',
    description: 'Contrôlez 5 secteurs stratégiques sur l’ensemble des 24 zones de la vallée.',
    maxTickets: 160,
    scoreLimit: 160,
    matchDurationSec: 600,
    respawnDelay: 3.5,
    damageMultiplier: 1.0,
    captureSpeedMult: 1.0,
    maxSoldiersPerSide: 7,
    enemyRadarRange: 32,
    usesSectors: true,
    objectiveLabel: 'Capture de 5 Secteurs',
  },
  {
    id: 'domination',
    name: 'Domination Éclair',
    shortName: 'DOMINATION',
    description: 'Combats nerveux autour des 3 passages centraux de la rivière avec capture rapide.',
    maxTickets: 120,
    scoreLimit: 120,
    matchDurationSec: 420,
    respawnDelay: 2.5,
    damageMultiplier: 1.05,
    captureSpeedMult: 1.75,
    maxSoldiersPerSide: 6,
    enemyRadarRange: 32,
    usesSectors: true,
    objectiveLabel: 'Contrôle des 3 Ponts & Gués',
  },
  {
    id: 'tdm',
    name: 'Match à Mort en Équipe',
    shortName: 'MME · 45 ÉLIM.',
    description: 'Affrontement pur sans secteurs : la première faction à 45 éliminations remporte la manche.',
    maxTickets: 45,
    scoreLimit: 45,
    matchDurationSec: 360,
    respawnDelay: 2.2,
    damageMultiplier: 1.1,
    captureSpeedMult: 0,
    maxSoldiersPerSide: 7,
    enemyRadarRange: 32,
    usesSectors: false,
    objectiveLabel: 'Objectif : 45 Éliminations',
  },
  {
    id: 'assault',
    name: 'Assaut Sectoriel',
    shortName: 'ASSAUT',
    description: 'Percée progressive du Sud vers le Nord à travers la rivière et les lignes fortifiées.',
    maxTickets: 140,
    scoreLimit: 140,
    matchDurationSec: 540,
    respawnDelay: 3.2,
    damageMultiplier: 1.0,
    captureSpeedMult: 1.25,
    maxSoldiersPerSide: 7,
    enemyRadarRange: 32,
    usesSectors: true,
    objectiveLabel: 'Percée Front Sud → Nord',
  },
  {
    id: 'cqc',
    name: 'Escarmouche CQC',
    shortName: 'CQC RAPIDE',
    description: 'Combat rapproché intense au cœur du Marché, des Ruines et du Pont Central.',
    maxTickets: 90,
    scoreLimit: 90,
    matchDurationSec: 300,
    respawnDelay: 1.8,
    damageMultiplier: 1.15,
    captureSpeedMult: 1.5,
    maxSoldiersPerSide: 6,
    enemyRadarRange: 28,
    usesSectors: true,
    objectiveLabel: 'Combat Rapproché Central',
  },
  {
    id: 'sniper',
    name: "Opération Tireur d'Élite",
    shortName: 'RÉALISTE · ELITE',
    description: 'Dégâts réalistes (+60%), portée étendue et détection radar ennemie réduite à 18m.',
    maxTickets: 100,
    scoreLimit: 100,
    matchDurationSec: 480,
    respawnDelay: 4.0,
    damageMultiplier: 1.6,
    captureSpeedMult: 0.9,
    maxSoldiersPerSide: 6,
    enemyRadarRange: 18,
    usesSectors: true,
    objectiveLabel: 'Précision & Réalisme Tactique',
  },
];

export function getCombatModeSpec(id: CombatModeId): CombatModeSpec {
  return COMBAT_MODES.find((m) => m.id === id) || COMBAT_MODES[0];
}
