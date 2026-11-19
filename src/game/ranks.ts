import { Faction } from './types';

export type TacticalOrderId = 'assault' | 'eliminate' | 'cover' | 'move' | 'follow';

export interface RankDefinition {
  level: number; // 1..7
  title: string;
  abbr: string;
  xpThreshold: number;
}

export interface TacticalOrderSpec {
  id: TacticalOrderId;
  label: string;
  shortLabel: string;
  hotkey: string;
}

export const TACTICAL_ORDERS: TacticalOrderSpec[] = [
  { id: 'assault', label: 'ASSAUT TACTIQUE', shortLabel: 'ASSAUT', hotkey: 'F1' },
  { id: 'eliminate', label: 'ÉLIMINATION CIBLE', shortLabel: 'ÉLIMINER', hotkey: 'F2' },
  { id: 'cover', label: 'À COUVERT (SACS)', shortLabel: 'COUVERT', hotkey: 'F3' },
  { id: 'move', label: 'DÉPLACEMENT', shortLabel: 'DÉPLAC.', hotkey: 'F4' },
];

export const ARMY_RANKS: RankDefinition[] = [
  { level: 1, title: 'Soldat', abbr: 'Sdt.', xpThreshold: 0 },
  { level: 2, title: 'Caporal', abbr: 'Cpl.', xpThreshold: 50 },
  { level: 3, title: 'Sergent', abbr: 'Sgt.', xpThreshold: 120 },
  { level: 4, title: 'Adjudant', abbr: 'Adj.', xpThreshold: 220 },
  { level: 5, title: 'Lieutenant', abbr: 'Lt.', xpThreshold: 340 },
  { level: 6, title: 'Capitaine', abbr: 'Cpt.', xpThreshold: 490 },
  { level: 7, title: 'Commandant', abbr: 'Cmdt.', xpThreshold: 680 },
];

export const REBEL_RANKS: RankDefinition[] = [
  { level: 1, title: 'Combattant', abbr: 'Comb.', xpThreshold: 0 },
  { level: 2, title: "Chef d'Équipe", abbr: 'Chf.', xpThreshold: 50 },
  { level: 3, title: 'Sous-Commandant', abbr: 'S-Cmdt.', xpThreshold: 120 },
  { level: 4, title: 'Commandant', abbr: 'Cmdt.', xpThreshold: 220 },
  { level: 5, title: 'Colonel de Brousse', abbr: 'Col.', xpThreshold: 340 },
  { level: 6, title: 'Général de Secteur', abbr: 'Gén.', xpThreshold: 490 },
  { level: 7, title: 'Maréchal du Maquis', abbr: 'Mar.', xpThreshold: 680 },
];

export function getRankDef(faction: Faction, level: number): RankDefinition {
  const list = faction === 'army' ? ARMY_RANKS : REBEL_RANKS;
  const idx = Math.max(0, Math.min(list.length - 1, level - 1));
  return list[idx];
}

export function getRankFromXp(faction: Faction, xp: number): RankDefinition {
  const list = faction === 'army' ? ARMY_RANKS : REBEL_RANKS;
  let current = list[0];
  for (let i = 0; i < list.length; i++) {
    if (xp >= list[i].xpThreshold) {
      current = list[i];
    }
  }
  return current;
}

export function getNextRankThreshold(faction: Faction, level: number): number | null {
  const list = faction === 'army' ? ARMY_RANKS : REBEL_RANKS;
  if (level >= list.length) return null;
  return list[level].xpThreshold;
}

export interface CommandVoiceSet {
  issue: string[];
  ack: string[];
}

const LINGALA_ORDERS: Record<TacticalOrderId, CommandVoiceSet> = {
  assault: {
    issue: [
      'Bana mboka, kende liboso ! Boma banguna !',
      'Bo pumbwa ! Tokende na assaut sikoyo !',
      'Allez les lions du Kivu ! Foncez en formation d’assaut !',
    ],
    ack: [
      'Ya solo Chef ! Nazo kende liboso !',
      'Nayoki Chef ! Tozo beta bango !',
      'Eh Papa ! Tika ngai na lakisa bango assaut ya Kivu !',
    ],
  },
  eliminate: {
    issue: [
      'Moko kaka ! Boma monguna wana tii akufa !',
      'Tireur moko abeta cible wana sikoyo ! Tika ye te !',
      'Un seul homme sur la cible marquée ! Neutralisez-le jusqu’au bout !',
    ],
    ack: [
      'Nayoki Chef ! Ngai moko nazo silisa ye !',
      'Cible verrouillée Chef ! Ako bika te lelo !',
      'Tika na ngai mokonzi, nazo lala ye te tii akweya !',
    ],
  },
  cover: {
    issue: [
      'Bo kima na sima ya ba sacs ya zelo ! Ko bima te !',
      'À couvert ! Bo bama na sima ya protection !',
      'Planquez-vous derrière les sacs de sable et tenez la ligne !',
    ],
    ack: [
      'Esimbi Chef ! Toza na sima ya ba sacs !',
      'Nayoki ! Position couverte makasi !',
      'Chef, naza na nse ya sacs de sable, moto akomona ngai te !',
    ],
  },
  move: {
    issue: [
      'Bo bouger kuna na point ya sika ! Vanda na couverture !',
      'Déplacement tactique ! Bo kota na position kuna !',
      'En mouvement par bonds vers la zone indiquée !',
    ],
    ack: [
      'Nayoki Chef ! Nazo kende na position kuna !',
      'Tozo tambola malembe na couverture mokonzi !',
      'Reçu Chef ! Changement de secteur en cours !',
    ],
  },
  follow: {
    issue: [
      'Bo ya na sima na ngai ! Bo landa ngai !',
      'Batela ngai, tozo tambola elongo !',
      'Restez collés à mon escouade ! Regroupement immédiat !',
    ],
    ack: [
      'Nayoki Chef ! Toza na sima na yo !',
      'Nazo landa yo sikoyo mokonzi !',
      'Sawa Chef, toza na sima lokola garde rapprochée !',
    ],
  },
};

const SWAHILI_ORDERS: Record<TacticalOrderId, CommandVoiceSet> = {
  assault: {
    issue: [
      'Askari wote, songa mbele ! Shambulia sasa !',
      'Twende mbele haraka ! Piga adui kule !',
      'Simba wa Kivu ! Vunja ngome yao sasa hivi !',
    ],
    ack: [
      'Ndiyo Mkuu ! Tunasonga mbele sasa !',
      'Sawa Afande ! Tunashambulia !',
      'Twende Afande ! Tunakwenda mbele kwa kasi !',
    ],
  },
  eliminate: {
    issue: [
      'Askari mmoja tu ! Mpige adui yule mpaka afe !',
      'Lenga adui huyo peke yako ! Usimwache apumue !',
      'Mmoja ashambulie shabaha ile mpaka ianguke !',
    ],
    ack: [
      'Ndiyo Mkuu ! Mimi peke yangu namaliza huyo !',
      'Shabaha imefungwa Afande ! Hatoki hai !',
      'Sawa Mkuu, namfuata kwa risasi mpaka aanguke !',
    ],
  },
  cover: {
    issue: [
      'Jificheni nyuma ya mifuko ya mchanga ! Kaa chini !',
      'Chukua kinga nyuma ya vizuizi sasa hivi !',
      'Piga magoti nyuma ya mifuko ya mchanga ! Linda mstari !',
    ],
    ack: [
      'Sawa Mkuu ! Tumefichwa nyuma ya mifuko !',
      'Ndiyo Afande, niko salama nyuma ya kinga !',
      'Tumebana chini ya mifuko ya mchanga Afande !',
    ],
  },
  move: {
    issue: [
      'Sogeeni haraka kwenda eneo lile ! Tafuta kinga huko !',
      'Badilisha nafasi kwa mpangilio ! Songa kule !',
      'Nenda kwenye alama ile kwa tahadhari !',
    ],
    ack: [
      'Sawa Mkuu ! Tunasogea kwenye eneo lile !',
      'Ndiyo Afande, tunabadilisha nafasi sasa !',
      'Tuko njiani kwenda nafasi mpya Mkuu !',
    ],
  },
  follow: {
    issue: [
      'Nifuateni nyote ! Kaa karibu nami !',
      'Njoo nyuma yangu ! Linda njia !',
      'Shikamana nami askari ! Kusanyikeni hapa !',
    ],
    ack: [
      'Sawa Mkuu ! Tunakufuata nyuma !',
      'Ndiyo Afande, niko karibu nawe !',
      'Tuko nyuma yako Mkuu, kama kivuli chako !',
    ],
  },
};

export function pickOrderVoice(
  faction: Faction,
  order: TacticalOrderId,
  phase: 'issue' | 'ack',
  style?: 'vigorous' | 'funny'
): string {
  const bank = faction === 'army' ? LINGALA_ORDERS : SWAHILI_ORDERS;
  const list = bank[order][phase];
  if (style === 'funny' && list.length >= 3) {
    return list[2];
  }
  if (style === 'vigorous' && list.length >= 2) {
    return list[Math.floor(Math.random() * 2)];
  }
  return list[Math.floor(Math.random() * list.length)];
}

export function pickSeniorRefusalVoice(faction: Faction): string {
  if (faction === 'army') {
    return 'Ngai mokonzi ya grade ya likolo awa ! Ko pesa ngai ordre te !';
  }
  return 'Mimi ni mkuu wa cheo cha juu hapa ! Fuata amri yangu !';
}
