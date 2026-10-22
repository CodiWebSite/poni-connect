import { QRCodeCanvas } from 'qrcode.react';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import { getCardFaceFields, getCardQrSource, type CardData, type CardFaceLang } from '@/utils/businessCards';

export type { CardData, CardLang } from '@/utils/businessCards';
export const CARD_W = 85;
export const CARD_H = 55;
export const CARD_PREVIEW_W = 420;
export const CARD_PREVIEW_H = CARD_PREVIEW_W * CARD_H / CARD_W;
export type VariantId = 'classic' | 'modern' | 'minimal' | 'bold';

export const VARIANTS: { id: VariantId; label: string; description: string }[] = [
  { id: 'classic', label: 'Clasic', description: 'Logo și linii instituționale' },
  { id: 'modern', label: 'Modern', description: 'Accent lateral albastru' },
  { id: 'minimal', label: 'Minimalist', description: 'Curat, spațiu generos' },
  { id: 'bold', label: 'Îndrăzneț', description: 'Fundal întunecat' },
];

const TEXTS = {
  ro: {
    institute1: 'Institutul de Chimie',
    institute2: 'Macromoleculară "Petru Poni" Iași',
    academy: 'Academia Română',
    address1: 'Aleea Grigore Ghica Vodă, 41A',
    address2: '700487, Iași, România',
    phone: 'Telefon',
    profile: 'Profil profesional',
    scan: 'Scanează codul QR',
  },
  en: {
    institute1: '"Petru Poni" Institute of',
    institute2: 'Macromolecular Chemistry Iași',
    academy: 'Romanian Academy',
    address1: '41A Grigore Ghica Vodă Alley',
    address2: '700487, Iași, Romania',
    phone: 'Phone',
    profile: 'Professional profile',
    scan: 'Scan the QR code',
  },
} as const;

function Institute({ lang }: { lang: CardFaceLang }) {
  const txt = TEXTS[lang];
  return (
    <header className="business-card-institute">
      <img src="/logo-icmpp.png" alt="ICMPP" crossOrigin="anonymous" />
      <div>
        <p>{txt.institute1}</p>
        <p>{txt.institute2}</p>
        <small>{txt.academy}</small>
      </div>
    </header>
  );
}

function PersonalQR({ data, size }: { data: CardData; size: number }) {
  const source = getCardQrSource(data);
  return (
    <div className="business-card-qr" style={{ width: size, height: size }}>
      {source.kind === 'image'
        ? <img src={source.value} alt="Cod QR personalizat" />
        : <QRCodeCanvas value={source.value} size={size} level="M" marginSize={2} />}
    </div>
  );
}

function ContactFace({ data, variant, face }: { data: CardData; variant: VariantId; face: 'front' | 'back' }) {
  const fields = getCardFaceFields(data, face);
  const txt = TEXTS[fields.lang];
  return (
    <div className={`business-card business-card-${variant}`} lang={fields.lang}>
      <Institute lang={fields.lang} />
      <section className="business-card-identity">
        <h2>{fields.name}</h2>
        {fields.position && <p className="business-card-position">{fields.position}</p>}
        {fields.department && <p className="business-card-department">{fields.department}</p>}
      </section>
      <footer className="business-card-contact">
        <div>
          <p>{txt.address1}</p>
          <p>{txt.address2}</p>
          {data.phone && <p className="business-card-contact-detail">{txt.phone}: {data.phone}</p>}
          <p className="business-card-contact-detail">E-mail: {data.email}</p>
        </div>
        {face === 'back'
          ? <PersonalQR data={data} size={64} />
          : variant !== 'minimal' && <div className="business-card-site-qr">
              <QRCodeCanvas value="https://www.icmpp.ro" size={46} level="M" marginSize={2} />
              <small>icmpp.ro</small>
            </div>}
      </footer>
    </div>
  );
}

function ProfileBack({ data, variant }: { data: CardData; variant: VariantId }) {
  // Română–Engleză: fața în română, verso-ul cu profilul profesional în engleză.
  const fields = getCardFaceFields(data, 'back');
  const txt = TEXTS[fields.lang];
  const isCustom = Boolean(data.qrImage || data.qrUrl.trim());
  return (
    <div className={`business-card business-card-${variant} business-card-profile-back`} lang={fields.lang}>
      <Institute lang={fields.lang} />
      <PersonalQR data={data} size={96} />
      <h2>{fields.name}</h2>
      <p className="business-card-scan-label">{isCustom ? txt.scan : txt.profile}</p>
    </div>
  );
}

const FRONT_MAP = Object.fromEntries(VARIANTS.map(({ id }) => [id,
  ({ data }: { data: CardData }) => <ContactFace data={data} variant={id} face="front" />,
])) as Record<VariantId, React.FC<{ data: CardData }>>;
const BACK_MAP = Object.fromEntries(VARIANTS.map(({ id }) => [id,
  ({ data }: { data: CardData }) => <ProfileBack data={data} variant={id} />,
])) as Record<VariantId, React.FC<{ data: CardData }>>;

export function getFrontComponent(variant: VariantId) { return FRONT_MAP[variant]; }
export function getBackComponent(variant: VariantId) { return BACK_MAP[variant]; }