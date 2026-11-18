import { Faction } from './types';

export type CommsCategory =
  | 'grenade'
  | 'contact'
  | 'underFire'
  | 'advance'
  | 'reload'
  | 'allyDown'
  | 'dive'
  | 'slide'
  | 'smoke'
  | 'heal'
  | 'chat';

export type VoiceStyle = 'vigorous' | 'funny';

export type VoiceProfileId =
  | 'mokonzi'
  | 'tonnerre'
  | 'simba'
  | 'sapologie'
  | 'fufu'
  | 'boma';

export interface VoiceProfileSpec {
  id: VoiceProfileId;
  label: string;
  regionLabel: string;
  style: VoiceStyle;
  preferredLangs: string[];
  pitch: number;
  rate: number;
  urgentRateMult: number;
  formantFreq: number;
}

export const MALE_VOICE_PROFILES: Record<VoiceProfileId, VoiceProfileSpec> = {
  mokonzi: {
    id: 'mokonzi',
    label: 'Cmdt. Mokonzi',
    regionLabel: 'Kinshasa · Vigoureux',
    style: 'vigorous',
    preferredLangs: ['fr-CD', 'fr-CG', 'fr-FR', 'fr'],
    pitch: 0.66,
    rate: 0.96,
    urgentRateMult: 1.12,
    formantFreq: 112,
  },
  tonnerre: {
    id: 'tonnerre',
    label: 'Sgt. Tonnerre',
    regionLabel: 'Nord-Kivu · Vigoureux',
    style: 'vigorous',
    preferredLangs: ['fr-CD', 'fr-FR', 'sw-KE', 'fr'],
    pitch: 0.74,
    rate: 1.1,
    urgentRateMult: 1.16,
    formantFreq: 128,
  },
  simba: {
    id: 'simba',
    label: 'Cpt. Simba',
    regionLabel: 'Katanga · Vigoureux',
    style: 'vigorous',
    preferredLangs: ['sw-KE', 'sw-TZ', 'fr-CD', 'fr-FR'],
    pitch: 0.7,
    rate: 1.03,
    urgentRateMult: 1.14,
    formantFreq: 118,
  },
  sapologie: {
    id: 'sapologie',
    label: 'Cpl. Sapologie',
    regionLabel: 'Kinshasa · Drôle',
    style: 'funny',
    preferredLangs: ['fr-CD', 'fr-FR', 'fr-BE', 'fr'],
    pitch: 0.89,
    rate: 1.14,
    urgentRateMult: 1.15,
    formantFreq: 158,
  },
  fufu: {
    id: 'fufu',
    label: 'Sdt. Fufu-Power',
    regionLabel: 'Kasaï · Drôle',
    style: 'funny',
    preferredLangs: ['fr-CD', 'fr-FR', 'fr'],
    pitch: 0.83,
    rate: 1.06,
    urgentRateMult: 1.14,
    formantFreq: 146,
  },
  boma: {
    id: 'boma',
    label: 'Écl. Boma-Rire',
    regionLabel: 'Goma · Drôle',
    style: 'funny',
    preferredLangs: ['sw-KE', 'fr-CD', 'fr-FR', 'fr'],
    pitch: 0.92,
    rate: 1.16,
    urgentRateMult: 1.15,
    formantFreq: 164,
  },
};

export const VOICE_PROFILE_ORDER: VoiceProfileId[] = [
  'mokonzi',
  'sapologie',
  'tonnerre',
  'fufu',
  'simba',
  'boma',
];

export function pickRandomMaleVoiceProfile(
  faction: Faction,
  styleFilter?: VoiceStyle
): VoiceProfileSpec {
  const pool = VOICE_PROFILE_ORDER.filter((id) => {
    const spec = MALE_VOICE_PROFILES[id];
    if (styleFilter && spec.style !== styleFilter) return false;
    return true;
  });
  // Slight regional weighting while keeping both funny & vigorous available to each side
  if (!styleFilter && Math.random() < 0.55) {
    const preferred: VoiceProfileId[] =
      faction === 'army'
        ? ['mokonzi', 'sapologie', 'tonnerre', 'fufu']
        : ['simba', 'boma', 'tonnerre', 'fufu'];
    const id = preferred[Math.floor(Math.random() * preferred.length)];
    return MALE_VOICE_PROFILES[id];
  }
  const id = pool[Math.floor(Math.random() * pool.length)];
  return MALE_VOICE_PROFILES[id];
}

export interface CommsLine {
  id: number;
  speaker: string;
  faction: Faction;
  language: 'Lingala' | 'Swahili';
  voiceStyle?: VoiceStyle;
  voiceLabel?: string;
  text: string;
  translation: string;
  category: CommsCategory;
  timestamp: number;
}

const VIGOROUS_LINGALA: Record<CommsCategory, Array<{ text: string; translation: string }>> = {
  grenade: [
    { text: 'Keba na bombe ! Boma nzoto na mabele sikoyo !', translation: 'Attention grenade ! Plongez au sol maintenant !' },
    { text: 'Grenade liboso ! Tika position, lala chini !', translation: 'Grenade devant ! Quittez la position, à terre !' },
  ],
  dive: [
    { text: 'Nazo lala na mabele ! Pesa nga couverture !', translation: 'Je plonge au sol ! Couvrez-moi !' },
    { text: 'Masasi makasi ! Plaquez-vous na mabele !', translation: 'Feu intense ! Plaquez-vous au sol !' },
  ],
  slide: [
    { text: 'Nazo glisser na ngambo ! Tiya moto !', translation: 'Je glisse sur le flanc ! Ouvrez le feu !' },
    { text: 'Glissade tactique ! Biso toza ba lions ya Kivu !', translation: 'Glissade tactique ! Nous sommes les lions du Kivu !' },
  ],
  smoke: [
    { text: 'Fumigène eza na nzela ! Bo katisa terrain sikoyo !', translation: 'Fumigène déployé ! Traversez la zone maintenant !' },
    { text: 'Rideau ya milinga ! Avancez makasi na kati ya fumée !', translation: 'Écran de fumée ! Avancez vite sous le couvert !' },
  ],
  heal: [
    { text: 'Simba makasi moninga ! Nazo kanga yo bande sikoyo !', translation: 'Tiens bon camarade ! Je pose le bandage maintenant !' },
    { text: 'Tala mpota te, soldat ya Congo akufaka pamba te !', translation: 'Ne lâche rien, un soldat congolais ne tombe pas si vite !' },
  ],
  contact: [
    { text: 'Banguna ba za liboso ! Beta masasi makasi !', translation: 'Ennemi devant ! Feu nourri !' },
    { text: 'Tala bango na ngambo ya mayi ! Bo bimisa moto !', translation: 'Ils sont de l’autre côté de la rivière ! Envoyez le feu !' },
    { text: 'Contact ! Bana mboka, boma bango nyonso !', translation: 'Contact ! Soldats, neutralisez-les tous !' },
  ],
  underFire: [
    { text: 'Simba position ! Ata masasi ezo beta, ko kima te !', translation: 'Tenez la position ! Même sous les balles, ne reculez pas !' },
    { text: 'Tika na sima ya saki ! Répondez na makasi !', translation: 'Derrière les sacs ! Ripostez avec force !' },
  ],
  advance: [
    { text: 'Mpiko bana mboka ! Tokatisa pont sikoyo !', translation: 'Courage soldats ! Traversons le pont maintenant !' },
    { text: 'En avant ! Lelo secteur oyo ezali ya biso !', translation: 'En avant ! Aujourd’hui ce secteur est à nous !' },
  ],
  reload: [
    { text: 'Nazo changer chargeur ! Simba bango makasi !', translation: 'Je recharge ! Retenez-les !' },
    { text: 'Chargeur esili ! Moto ya couverture !', translation: 'Chargeur vide ! Feu de couverture !' },
  ],
  allyDown: [
    { text: 'Moninga akufi ! Tokozongisa bango nkanda lelo !', translation: 'Un camarade est tombé ! On va leur faire payer !' },
    { text: 'Bapusi ndeko na biso ! Avancez nyonso !', translation: 'Ils ont touché notre frère ! Avancez tous !' },
  ],
  chat: [
    { text: 'Mayi ya Kivu eza makasi, kasi volonté na biso eleki !', translation: 'Le courant du Kivu est fort, mais notre volonté est plus grande !' },
    { text: 'Surveillez ba zamba wana, banguna ba bombanaka kuna.', translation: 'Surveillez ces bois, l’ennemi s’y cache.' },
  ],
};

const FUNNY_LINGALA: Record<CommsCategory, Array<{ text: string; translation: string }>> = {
  grenade: [
    { text: 'Maman eh ! Bombe ezo ya, ekobebisa sape na ngai !', translation: 'Oh maman ! Une grenade arrive, elle va abîmer ma sape !' },
    { text: 'Wapi ! Tika grenade wana, ezali likambo ya mabe !', translation: 'Ouh là ! Laissez cette grenade, c’est une mauvaise affaire !' },
  ],
  dive: [
    { text: 'Eh Papa ! Pantalon na ngai ya sika ekomi na potopoto !', translation: 'Eh Papa ! Mon pantalon neuf est plein de boue !' },
    { text: 'Nazo lala na mabele lokola mbisi na mayi !', translation: 'Je plonge au sol comme un poisson dans l’eau !' },
  ],
  slide: [
    { text: 'Tala glissade ya Kinshasa ! Ata terrain eza mabe, style ezali !', translation: 'Regarde la glissade de Kinshasa ! Même dans la boue, il y a du style !' },
    { text: 'Wouh ! Nazo glisser lokola mbonda ya fête !', translation: 'Wouh ! Je glisse comme sur un dancefloor de fête !' },
  ],
  smoke: [
    { text: 'Wapi ! Milinga ekomi lokola barbecue ya Matonge, tokende !', translation: 'Ouh là ! La fumée est épaisse comme un barbecue à Matonge, on traverse !' },
    { text: 'Banguna ba moni lisusu eloko te ! Bo leka na calme !', translation: 'Les ennemis ne voient plus rien ! Passez tranquillement !' },
  ],
  heal: [
    { text: 'Tika ko lela moninga, bande oyo eko pesa yo makasi ya fufu !', translation: 'Arrête de pleurer ami, ce bandage donne la force du fufu !' },
    { text: 'Zela moke ! Nazo réparer yo lokola pneu ya taxi-bus !', translation: 'Attends un peu ! Je te répare comme un pneu de taxi-bus !' },
  ],
  contact: [
    { text: 'Hé ba ndeko ! Tala bango kuna, ba zo luka makambu !', translation: 'Hé les gars ! Regardez-les là-bas, ils cherchent les problèmes !' },
    { text: 'Ah bon ? Bo tie mutu liboso ya canon ? Pesa bango cadeau !', translation: 'Ah bon ? Vous mettez la tête devant mon canon ? Offrez-leur un cadeau !' },
  ],
  underFire: [
    { text: 'Hé ! Bo beta te na ngambo oyo, na liaki pondu te lelo !', translation: 'Hé ! Ne tirez pas par ici, je n’ai même pas mangé mon pondu aujourd’hui !' },
    { text: 'Maman eh ! Masasi ezo leka lokola ba moustiques na butu !', translation: 'Maman eh ! Les balles passent comme des moustiques la nuit !' },
  ],
  advance: [
    { text: 'Kende liboso bana mboka ! Soki tolongi, ya solo tokolia ngulu !', translation: 'En avant les gars ! Si on gagne, c’est festin ce soir !' },
    { text: 'Biso tozo kende ! Ba oyo ba tikali na sima ba ko payer bière !', translation: 'On fonce ! Les derniers arrivés paient la tournée !' },
  ],
  reload: [
    { text: 'Zela ! Chargeur esili mbangu koleka mbongo ya fin du mois !', translation: 'Attends ! Mon chargeur s’est vidé plus vite que le salaire de fin de mois !' },
    { text: 'Pause moke ! Nazo tia masasi ya sika, bo kende nanu te !', translation: 'Petite pause ! Je mets des balles neuves, ne partez pas sans moi !' },
  ],
  allyDown: [
    { text: 'Oh ndeko na ngai akufi ! Nani akofuta tontine na ye sikoyo ?!', translation: 'Oh mon frère est tombé ! Qui va rembourser sa part maintenant ?!' },
    { text: 'Aïe ! Ba kweyisi moninga ! Bino ba en-face, bo ko futa yango !', translation: 'Aïe ! Ils ont touché mon pote ! Vous en face, vous allez payer !' },
  ],
  chat: [
    { text: 'Chef, soki mvula ezo beta boye, biso na parapluie te ?!', translation: 'Chef, s’il pleut comme ça, on n’a même pas droit au parapluie ?!' },
    { text: 'Nazo yoka nzala ya fufu na makayabu, kasi to simba nanu pont.', translation: 'J’ai faim de fufu et poisson salé, mais tenons d’abord le pont.' },
  ],
};

const VIGOROUS_SWAHILI: Record<CommsCategory, Array<{ text: string; translation: string }>> = {
  grenade: [
    { text: 'Bomu ! Lala chini haraka askari !', translation: 'Grenade ! À terre tout de suite soldats !' },
    { text: 'Kimbia bomu iko hapa ! Jifiche sasa !', translation: 'Écartez-vous, grenade ici ! Mettez-vous à couvert !' },
  ],
  dive: [
    { text: 'Nalala chini ! Nisaidie kwa moto !', translation: 'Je plonge à terre ! Couvrez-moi !' },
    { text: 'Chini sasa ! Risasi zinapita juu !', translation: 'À terre maintenant ! Les balles fusent !' },
  ],
  slide: [
    { text: 'Nateleza mbele ! Piga adui sasa !', translation: 'Je glisse en avant ! Frappez l’ennemi !' },
    { text: 'Mwendo wa simba ! Shambulia upande huu !', translation: 'Mouvement du lion ! Attaquez sur ce flanc !' },
  ],
  smoke: [
    { text: 'Bomu la moshi ! Vuka eneo hili sasa hivi askari !', translation: 'Grenade fumigène ! Traversez la zone tout de suite soldats !' },
    { text: 'Moshi umetanda ! Songa mbele chini ya kifuniko !', translation: 'La fumée s’étend ! Avancez sous le couvert !' },
  ],
  heal: [
    { text: 'Tulia ndugu yangu ! Ninafunga jeraha sasa hivi !', translation: 'Tiens bon mon frère ! Je bande ta blessure tout de suite !' },
    { text: 'Simama imara rafiki, bado tunahitaji nguvu yako !', translation: 'Reste fort l’ami, on a encore besoin de ta force !' },
  ],
  contact: [
    { text: 'Adui mbele ! Piga risasi bila huruma !', translation: 'Ennemi devant ! Tirez sans pitié !' },
    { text: 'Wako mtoni kule ! Funga njia yote !', translation: 'Ils sont dans la rivière ! Bloquez tout passage !' },
  ],
  underFire: [
    { text: 'Shika mstari ! Mtu asirudi nyuma !', translation: 'Tenez la ligne ! Personne ne recule !' },
    { text: 'Moto mkali sana ! Jifiche nyuma ya mawe na upige !', translation: 'Feu intense ! Cachez-vous derrière les rochers et ripostez !' },
  ],
  advance: [
    { text: 'Nguvu za Kivu ! Songa mbele, shika daraja !', translation: 'Force du Kivu ! En avant, prenez le pont !' },
    { text: 'Twende mbele askari ! Leo ushindi ni wetu !', translation: 'En avant guerriers ! Aujourd’hui la victoire est nôtre !' },
  ],
  reload: [
    { text: 'Ninaongeza risasi ! Nifunike sekunde mbili !', translation: 'Je recharge ! Couvrez-moi deux secondes !' },
    { text: 'Risasi zimeisha ! Shika adui pale !', translation: 'Plus de munitions ! Fixez l’ennemi là-bas !' },
  ],
  allyDown: [
    { text: 'Mwenzetu ameanguka ! Ongeza moto juu yao !', translation: 'Notre camarade est tombé ! Redoublez le feu sur eux !' },
    { text: 'Wamempiga ndugu yetu ! Hakuna msamaha !', translation: 'Ils ont touché notre frère ! Pas de quartier !' },
  ],
  chat: [
    { text: 'Angalia msituni kule, milima ya Kivu ina macho.', translation: 'Surveille cette forêt, les collines du Kivu ont des yeux.' },
    { text: 'Shika bunduki yako vizuri, vita bado ni moto.', translation: 'Tiens bien ton arme, le combat reste chaud.' },
  ],
};

const FUNNY_SWAHILI: Record<CommsCategory, Array<{ text: string; translation: string }>> = {
  grenade: [
    { text: 'Mama yangu eh ! Bomu inakuja kama zawadi ya sumu !', translation: 'Oh là là ! Une grenade arrive comme un cadeau empoisonné !' },
    { text: 'Wapi ! Hiyo siyo mpira wa miguu, lala chini !', translation: 'Hé ! Ce n’est pas un ballon de foot, couchez-vous !' },
  ],
  dive: [
    { text: 'Ah ! Tope imeingia mpaka kwenye mfuko wa shati !', translation: 'Ah ! La boue est entrée jusque dans la poche de ma chemise !' },
    { text: 'Ninaruka chini kama chura wa Goma !', translation: 'Je plonge au sol comme une grenouille de Goma !' },
  ],
  slide: [
    { text: 'Cheki hii glissade ! Hata Cristiano hawezi hivi !', translation: 'Regarde cette glissade ! Même Cristiano ne fait pas mieux !' },
    { text: 'Nateleza kwenye tope na tabasamu usoni !', translation: 'Je glisse dans la boue avec le sourire aux lèvres !' },
  ],
  smoke: [
    { text: 'Moshi mwingi ! Adui hataona hata pua yake, kimbia !', translation: 'Nuage énorme ! L’ennemi ne verra même plus son propre nez, foncez !' },
    { text: 'Tumeweka ukungu wa bure ! Pita haraka kabla haujaisha !', translation: 'On a posé du brouillard gratuit ! Passez vite avant qu’il ne parte !' },
  ],
  heal: [
    { text: 'Usilie rafiki, dawa hii ni kali kuliko chai ya tangawizi !', translation: 'Ne pleure pas l’ami, ce soin est plus fort que le thé au gingembre !' },
    { text: 'Subiri kidogo, ninakuweka sawa haraka sana !', translation: 'Patiente un peu, je te remets à neuf en un éclair !' },
  ],
  contact: [
    { text: 'Ona wale jamaa ! Wanapiga risasi hewani kama wanafukuza ndege !', translation: 'Regarde ces gars ! Ils tirent en l’air comme s’ils chassaient les oiseaux !' },
    { text: 'Habari zenu maadui ? Msalimieni risasi yangu !', translation: 'Comment ça va les ennemis ? Dites bonjour à ma balle !' },
  ],
  underFire: [
    { text: 'Pole pole jamaa ! Mbona mnapiga kwa hasira namna hii ?!', translation: 'Doucement les gars ! Pourquoi vous tirez avec autant de colère ?!' },
    { text: 'Aiya ! Risasi zinanipita karibu na masikio !', translation: 'Aïe ! Les balles me sifflent juste aux oreilles !' },
  ],
  advance: [
    { text: 'Twende mbele ! Anayefika mwisho atapika ugali leo !', translation: 'En avant ! Le dernier arrivé prépare l’ugali ce soir !' },
    { text: 'Songa mbele, leo tunachukua daraja kabla ya chakula !', translation: 'Avancez, aujourd’hui on prend le pont avant le dîner !' },
  ],
  reload: [
    { text: 'Ngoja kidogo ! Bunduki yangu imechoka, inakunywa risasi mpya !', translation: 'Attendez un peu ! Mon fusil a soif, il boit un nouveau chargeur !' },
    { text: 'Eh ! Risasi zimekimbia wapi tena ? Ninaweka mpya !', translation: 'Hé ! Où sont encore passées mes balles ? J’en remets !' },
  ],
  allyDown: [
    { text: 'Oh hapana, rafiki yangu ! Nani ataniimbia njiani sasa ?!', translation: 'Oh non mon pote ! Qui va me chanter sur la route maintenant ?!' },
    { text: 'Wamemuangusha ndugu yetu ! Sasa wataona moto wa Kivu !', translation: 'Ils ont abattu notre frère ! Maintenant ils vont voir le feu du Kivu !' },
  ],
  chat: [
    { text: 'Mkubwa, mvua ikinyesha hivi nywele zangu zitakua kama msitu !', translation: 'Chef, s’il pleut autant mes bottes vont pousser comme la forêt !' },
    { text: 'Nikimaliza vita hii, nakunywa soda baridi tatu mfululizo !', translation: 'Quand je finis cette bataille, je bois trois sodas glacés d’affilée !' },
  ],
};

export function pickCommsPhrase(
  faction: Faction,
  category: CommsCategory,
  voiceProfileId?: VoiceProfileId
): { language: 'Lingala' | 'Swahili'; text: string; translation: string; style: VoiceStyle } {
  const profile = voiceProfileId ? MALE_VOICE_PROFILES[voiceProfileId] : undefined;
  const style: VoiceStyle = profile ? profile.style : Math.random() < 0.45 ? 'funny' : 'vigorous';

  const bank =
    faction === 'army'
      ? style === 'funny'
        ? FUNNY_LINGALA
        : VIGOROUS_LINGALA
      : style === 'funny'
      ? FUNNY_SWAHILI
      : VIGOROUS_SWAHILI;

  const list = bank[category] || bank.chat;
  const chosen = list[Math.floor(Math.random() * list.length)];
  return {
    language: faction === 'army' ? 'Lingala' : 'Swahili',
    text: chosen.text,
    translation: chosen.translation,
    style,
  };
}

const FEMALE_VOICE_HINTS =
  /female|woman|femme|hortense|denise|julie|amelie|amélie|caroline|elsa|zira|hazel|catherine|victoria|samantha|audrey|alice|sara|marie|claire|virginie|celine|léa|lea|emma/i;
const MALE_VOICE_HINTS =
  /male|man|homme|paul|thomas|henri|remy|rémy|daniel|claude|nicolas|alain|georges|david|mark|guy|antoine|jean|mathieu|guillaume|bernard|jacques|yves|kofi|mamadou|seba|moussa|patrick|serge|eric/i;

export class SpeechCalloutSynthesizer {
  private lastSpokenAt = 0;
  private muted = false;
  private volume = 0.9;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private audioFallback?: (style: VoiceStyle, formantFreq: number, distance: number) => void;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices() || [];
        window.speechSynthesis.addEventListener?.('voiceschanged', () => {
          this.cachedVoices = window.speechSynthesis.getVoices() || [];
        });
      } catch {
        // Ignore
      }
    }
  }

  public setTimbreCallback(
    cb: (style: VoiceStyle, formantFreq: number, distance: number) => void
  ) {
    this.audioFallback = cb;
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (m && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume <= 0.01 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  private selectMaleVoice(profile: VoiceProfileSpec): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    if (this.cachedVoices.length === 0) {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices() || [];
      } catch {
        return null;
      }
    }
    if (this.cachedVoices.length === 0) return null;

    // Score voices to strictly favor French/African/Swahili MALE voices
    let best: SpeechSynthesisVoice | null = null;
    let bestScore = -999;

    const profileHash = profile.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    for (let i = 0; i < this.cachedVoices.length; i++) {
      const v = this.cachedVoices[i];
      const nameAndUri = `${v.name} ${v.voiceURI}`;
      let score = 0;

      if (FEMALE_VOICE_HINTS.test(nameAndUri)) score -= 80;
      if (MALE_VOICE_HINTS.test(nameAndUri)) score += 45;

      const langLow = v.lang.toLowerCase();
      for (let l = 0; l < profile.preferredLangs.length; l++) {
        const pref = profile.preferredLangs[l].toLowerCase();
        if (langLow === pref) {
          score += 65 - l * 10;
          break;
        } else if (langLow.startsWith(pref.slice(0, 2))) {
          score += 36 - l * 5;
          break;
        }
      }

      if (langLow.startsWith('fr')) score += 18;
      if (langLow.startsWith('sw')) score += 14;
      // Rotate among equally good male voices so different models use distinct voices when available
      score += ((i + profileHash) % 5) * 0.5;

      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }

    return best;
  }

  public speak(
    text: string,
    faction: Faction,
    urgent: boolean,
    distance: number,
    profileId?: VoiceProfileId
  ) {
    if (this.muted || this.volume <= 0.01 || distance > 72) return;
    const now = performance.now();
    const minInterval = urgent ? 1500 : 2900;
    if (now - this.lastSpokenAt < minInterval) return;

    const profile = profileId
      ? MALE_VOICE_PROFILES[profileId]
      : pickRandomMaleVoiceProfile(faction);

    // Trigger expressive African male radio-formant vocal signature on Web Audio voice bus
    this.audioFallback?.(profile.style, profile.formantFreq, distance);
    this.lastSpokenAt = now;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (urgent) {
        window.speechSynthesis.cancel();
      } else if (window.speechSynthesis.speaking) {
        return;
      }

      const utter = new SpeechSynthesisUtterance(text);
      const maleVoice = this.selectMaleVoice(profile);
      if (maleVoice) {
        utter.voice = maleVoice;
        utter.lang = maleVoice.lang;
      } else {
        utter.lang = faction === 'army' ? 'fr-CD' : 'sw-KE';
      }

      // Expressive male pitch & cadence variations per model (funny vs vigorous)
      const jitter = (Math.random() - 0.5) * 0.04;
      utter.pitch = Math.max(0.55, Math.min(0.98, profile.pitch + jitter));
      utter.rate = profile.rate * (urgent ? profile.urgentRateMult : 1.0);
      const distAtten = Math.max(0.24, Math.min(1.0, 1 - distance / 78));
      utter.volume = Math.max(0.06, Math.min(1.0, distAtten * this.volume));
      window.speechSynthesis.speak(utter);
    } catch {
      // Gracefully ignore browser TTS restrictions
    }
  }

  public dispose() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }
}
