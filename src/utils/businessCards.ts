export type CardFaceLang = 'ro' | 'en';
export type CardLang = CardFaceLang | 'ro-en';

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
  return lang === 'ro-en' ? (face === 'front' ? 'ro' : 'en') : lang;
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
    : { kind: 'link' as const, value: data.qrUrl.trim() || data.profileUrl };
}