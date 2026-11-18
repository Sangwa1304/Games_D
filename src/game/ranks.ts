import { Faction } from './types';

export type TacticalOrderId = 'assault' | 'follow' | 'hold' | 'suppress';

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
  { id: 'assault', label: 'AVANCER / ASSAUT', shortLabel: 'ASSAUT', hotkey: 'F1' },
  { id: 'follow', label: 'SUIVRE / ESCORTE', shortLabel: 'SUIVRE', hotkey: 'F2' },
  { id: 'hold', label: 'TENIR POSITION', shortLabel: 'TENIR', hotkey: 'F3' },
  { id: 'suppress', label: 'TIR DE SUPPRESSION', shortLabel: 'SUPPR.', hotkey: 'F4' },
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
      'Allez les lions du Kivu ! Foncez sans regarder derrière !',
    ],
    ack: [
      'Ya solo Chef ! Nazo kende liboso !',
      'Nayoki Chef ! Tozo beta bango !',
      'Eh Papa ! Tika ngai na lakisa bango danse ya Kivu !',
    ],
  },
  follow: {
    issue: [
      'Bo ya na sima na ngai ! Bo landa ngai !',
      'Batela ngai, tozo tambola elongo !',
      'Restez collés à moi comme le fufu et le pondu ! En route !',
    ],
    ack: [
      'Nayoki Chef ! Toza na sima na yo !',
      'Nazo landa yo sikoyo mokonzi !',
      'Sawa Chef, toza na sima lokola garde du corps ya Kinshasa !',
    ],
  },
  hold: {
    issue: [
      'Telema wana ! Simba position makasi !',
      'Ko ningana te ! Bo batela secteur oyo !',
      'Ancrez vos bottes ici ! Pas un rebelle ne passe !',
    ],
    ack: [
      'Esimbi Chef ! Nazo simba position !',
      'Nayoki ! Moto moko akoleka awa te !',
      'Chef, même le vent akoleka awa te sans ticket !',
    ],
  },
  suppress: {
    issue: [
      'Beta masasi makasi wana ! Tika bango te !',
      'Fungola moto kuna ! Bo pekisa banguna !',
      'Envoyez la sauce ! Faites danser leurs casques !',
    ],
    ack: [
      'Nazo beta bango masasi Chef !',
      'Moto ezo pumbwa kuna mokonzi !',
      'Wapi ! Chargeur ezo chauffer lokola mbabula Chef !',
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
      'Twende Afande ! Leo watajua sisi ni nani hapa Goma !',
    ],
  },
  follow: {
    issue: [
      'Nifuateni nyote ! Kaa karibu nami !',
      'Njoo nyuma yangu ! Linda njia !',
      'Shikamana nami askari ! Hakuna kupoteana msituni !',
    ],
    ack: [
      'Sawa Mkuu ! Tunakufuata nyuma !',
      'Ndiyo Afande, niko karibu nawe !',
      'Tuko nyuma yako Mkuu, kama kivuli chako !',
    ],
  },
  hold: {
    issue: [
      'Simama hapo ! Shika mstari imara !',
      'Msisonge ! Linda eneo hili sasa !',
      'Piga magoti nyuma ya mawe ! Msiache hata sentimita !',
    ],
    ack: [
      'Sawa Mkuu ! Tunashika nafasi hii !',
      'Ndiyo Afande, hakuna atakayepita !',
      'Hapa tumekaa imara kama mlima Nyiragongo Mkuu !',
    ],
  },
  suppress: {
    issue: [
      'Piga moto mfululizo kule ! Wafunge chini !',
      'Risasi zote kule ! Usiwape nafasi !',
      'Fungua moto mkali ! Wasilale usingizi kule !',
    ],
    ack: [
      'Tunapiga moto mfululizo Mkuu !',
      'Sawa Afande, risasi zinamiminika !',
      'Moto unawaka Afande, hata ndege hawawezi kupita !',
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
