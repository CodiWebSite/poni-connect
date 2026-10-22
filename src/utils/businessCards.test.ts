import { describe, expect, it } from 'vitest';
import { getCardFaceFields, getCardFaceLang, getCardName, getCardQrSource, isInstituteCardQr, type CardData } from './businessCards';

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
  it('permite modificarea independentă a funcției și departamentului în engleză', () => {
    const modified = { ...data, positionEn: 'Senior Researcher', departmentEn: 'Polymer Laboratory' };
    expect(getCardFaceFields(modified, 'front').position).toBe('Cercetător');
    expect(getCardFaceFields(modified, 'back').position).toBe('Senior Researcher');
    expect(getCardFaceFields(modified, 'front').department).toBe('Laborator');
    expect(getCardFaceFields(modified, 'back').department).toBe('Polymer Laboratory');
  });
  it('folosește imaginea QR încărcată în locul codului generat', () => {
    expect(getCardQrSource({ ...data, qrImage: 'data:image/png;base64,abc' })).toEqual({ kind: 'image', value: 'data:image/png;base64,abc' });
  });
  it('revine la linkul ales după eliminarea imaginii QR', () => {
    expect(getCardQrSource(data)).toEqual({ kind: 'link', value: 'https://example.org/research' });
  });
  it('folosește icmpp.ro implicit și nu profilul personal', () => {
    expect(getCardQrSource({ ...data, qrUrl: ' ' })).toEqual({ kind: 'link', value: 'https://www.icmpp.ro' });
    expect(isInstituteCardQr({ ...data, qrUrl: '' })).toBe(true);
  });
  it('identifică linkul explicit către site-ul institutului', () => {
    expect(isInstituteCardQr({ ...data, qrUrl: 'https://icmpp.ro/' })).toBe(true);
    expect(isInstituteCardQr({ ...data, qrUrl: 'https://www.icmpp.ro' })).toBe(true);
    expect(isInstituteCardQr({ ...data, qrUrl: 'https://icmpp.ro.example.org' })).toBe(false);
  });
  it('tratează linkurile și imaginile proprii ca QR personal', () => {
    expect(isInstituteCardQr(data)).toBe(false);
    expect(isInstituteCardQr({ ...data, qrUrl: data.profileUrl })).toBe(false);
    expect(isInstituteCardQr({ ...data, qrUrl: '', qrImage: 'data:image/png;base64,abc' })).toBe(false);
  });
  it('folosește datele RO când traducerile opționale nu sunt completate', () => {
    const fields = getCardFaceFields({ ...data, positionEn: '', departmentEn: '' }, 'back');
    expect(fields.position).toBe('Cercetător');
    expect(fields.department).toBe('Laborator');
  });
});