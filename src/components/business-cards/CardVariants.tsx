import { QRCodeCanvas } from 'qrcode.react';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import { getCardFaceFields, getCardQrSource, isInstituteCardQr, type CardData } from '@/utils/businessCards';

export type { CardData } from '@/utils/businessCards';
export const CARD_W = 85;
export const CARD_H = 55;
export const CARD_PREVIEW_W = 420;
export const CARD_PREVIEW_H = CARD_PREVIEW_W * CARD_H / CARD_W;

const TEXTS = {
  ro: {
    institute1: 'Institutul de Chimie',
    institute2: 'Macromoleculară "Petru Poni" Iași',
    academy: 'Academia Română',
    address1: 'Aleea Grigore Ghica Vodă, 41A',
    address2: '700487, Iași, România',
    phone: 'Telefon',
    profile: 'Profil profesional',
  },
  en: {
    institute1: '"Petru Poni" Institute of',
    institute2: 'Macromolecular Chemistry Iași',
    academy: 'Romanian Academy',
    address1: '41A Grigore Ghica Vodă Alley',
    address2: '700487, Iași, Romania',
    phone: 'Phone',
    profile: 'Professional profile',
  },
} as const;

export function BusinessCardFace({ data, face }: { data: CardData; face: 'front' | 'back' }) {
  const fields = getCardFaceFields(data, face);
  const txt = TEXTS[fields.lang];
  const qr = getCardQrSource(data);
  return (
    <div className="business-card business-card-minimal" lang={fields.lang}>
      <header className="business-card-institute">
        <img src="/logo-icmpp.png" alt="ICMPP" crossOrigin="anonymous" />
        <div>
          <p>{txt.institute1}</p>
          <p>{txt.institute2}</p>
          <small>{txt.academy}</small>
        </div>
      </header>
      <section className="business-card-identity">
        <h2>{fields.name}</h2>
        {fields.position && <p className="business-card-position">{fields.position}</p>}
        {fields.department && <p className="business-card-department">{fields.department}</p>}
      </section>
      <footer className="business-card-contact">
        <div className="business-card-address">
          <p>{txt.address1}</p>
          <p>{txt.address2}</p>
          {data.phone && <p className="business-card-contact-detail">{txt.phone}: {data.phone}</p>}
          <p className="business-card-contact-detail">E-mail: {data.email}</p>
        </div>
        <div className="business-card-site-qr">
          <div className="business-card-qr">
            {qr.kind === 'image'
              ? <img src={qr.value} alt="Cod QR personalizat" />
              : <QRCodeCanvas value={qr.value} size={58} level="M" marginSize={2} />}
          </div>
          <small>{isInstituteCardQr(data) ? 'icmpp.ro' : txt.profile}</small>
        </div>
      </footer>
    </div>
  );
}
