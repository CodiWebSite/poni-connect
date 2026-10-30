export type CardFaceLang = 'ro' | 'en';
export type CardLang = 'ro' | 'en' | 'ro-en';
export type CardFace = 'front' | 'back';

export const CARD_LANG_OPTIONS: { value: CardLang; label: string }[] = [
  { value: 'ro-en', label: 'Față română · Verso engleză' },
  { value: 'ro', label: 'Doar română' },
  { value: 'en', label: 'Doar engleză' },
];

/** Single-language cards print one face only; the bilingual card prints front and back. */
export function getCardFaces(lang: CardLang): CardFace[] {
  return lang === 'ro-en' ? ['front', 'back'] : ['front'];
}
export const INSTITUTE_CARD_URL = 'https://www.icmpp.ro';

export interface CardData {
  displayName: string;
  titlePrefix?: string;
  position: string;
  positionEn?: string;
  department: string;
  departmentEn?: string;
  phone: string;
  email: string;
  profileUrl: string;
  qrUrl: string;
  qrImage?: string;
  lang: CardLang;
}

export function getCardFaceLang(lang: CardLang, face: 'front' | 'back'): CardFaceLang {
  if (lang !== 'ro-en') return lang;
  return face === 'front' ? 'ro' : 'en';
}

export function getCardName(data: Pick<CardData, 'displayName' | 'titlePrefix'>): string {
  return [data.titlePrefix?.trim(), data.displayName.trim()].filter(Boolean).join(' ');
}

export function getCardFaceFields(data: CardData, face: 'front' | 'back') {
  const lang = getCardFaceLang(data.lang, face);
  return {
    lang,
    name: getCardName(data),
    position: lang === 'en' ? data.positionEn?.trim() || data.position.trim() : data.position.trim(),
    // A translated department must never restore a department explicitly removed by its owner.
    department: !data.department.trim() ? '' : lang === 'en'
      ? data.departmentEn?.trim() || data.department.trim() : data.department.trim(),
  };
}

export function getCardQrSource(data: Pick<CardData, 'qrImage' | 'qrUrl' | 'profileUrl'>) {
  return data.qrImage
    ? { kind: 'image' as const, value: data.qrImage }
    : { kind: 'link' as const, value: data.qrUrl.trim() || INSTITUTE_CARD_URL };
}

export function isInstituteCardQr(data: Pick<CardData, 'qrImage' | 'qrUrl' | 'profileUrl'>): boolean {
  const source = getCardQrSource(data);
  if (source.kind === 'image') return false;
  try {
    const url = new URL(source.value);
    return ['https:', 'http:'].includes(url.protocol)
      && ['icmpp.ro', 'www.icmpp.ro'].includes(url.hostname)
      && url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}