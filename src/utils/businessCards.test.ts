import { describe, expect, it } from 'vitest';
import { getCardFaceFields, getCardFaceLang, getCardName, getCardQrSource, type CardData } from './businessCards';

const data: CardData = {
  displayName: 'NUME PRENUME', titlePrefix: 'Dr.', position: 'Cercetător',
  positionEn: 'Researcher', department: 'Laborator', departmentEn: 'Laboratory',
  phone: '', email: 'test@example.org', profileUrl: 'https://example.org/profile',
  qrUrl: 'https://example.org/research', lang: 'ro-en',
};

describe('personalizarea cărților de vizită', () => {
  it('păstrează titulatura liberă înaintea numelui', () => {
    expect(getCardName(data)).toBe('Dr. NUME PRENUME');
    expect(getCardName({ ...data, titlePrefix: 'Acad.' })).toBe('Acad. NUME PRENUME');
  });
  it('permite lipsa titulaturii fără spații suplimentare', () => {
    expect(getCardName({ ...data, titlePrefix: ' ' })).toBe('NUME PRENUME');
  });
  it('nu reintroduce departamentul omis nici pe verso în engleză', () => {
    expect(getCardFaceFields({ ...data, department: '' }, 'front').department).toBe('');
    expect(getCardFaceFields({ ...data, department: '' }, 'back').department).toBe('');
  });
  it('selectează română pe față și engleză pe verso în modul combinat', () => {
    expect(getCardFaceLang('ro-en', 'front')).toBe('ro');
    expect(getCardFaceLang('ro-en', 'back')).toBe('en');
    expect(getCardFaceFields(data, 'front').position).toBe('Cercetător');
    expect(getCardFaceFields(data, 'back').position).toBe('Researcher');
  });
  it('păstrează modurile integral română și integral engleză', () => {
    expect(getCardFaceLang('ro', 'back')).toBe('ro');
    expect(getCardFaceLang('en', 'front')).toBe('en');
  });
  it('folosește imaginea QR încărcată în locul codului generat', () => {
    expect(getCardQrSource({ ...data, qrImage: 'data:image/png;base64,abc' })).toEqual({ kind: 'image', value: 'data:image/png;base64,abc' });
  });
  it('revine la linkul ales sau la profil după eliminarea imaginii QR', () => {
    expect(getCardQrSource(data)).toEqual({ kind: 'link', value: 'https://example.org/research' });
    expect(getCardQrSource({ ...data, qrUrl: ' ' })).toEqual({ kind: 'link', value: data.profileUrl });
  });
});