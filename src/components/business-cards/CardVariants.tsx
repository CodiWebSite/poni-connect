import { QRCodeCanvas } from 'qrcode.react';

export const CARD_W = 85;
export const CARD_H = 55;

export interface CardData {
  displayName: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  profileUrl: string;
}

type VariantId = 'classic' | 'modern' | 'minimal' | 'bold';

export const VARIANTS: { id: VariantId; label: string; description: string }[] = [
  { id: 'classic', label: 'Clasic', description: 'Design tradițional cu logo și linii' },
  { id: 'modern', label: 'Modern', description: 'Gradient lateral cu accent albastru' },
  { id: 'minimal', label: 'Minimalist', description: 'Curat, spațiu generos' },
  { id: 'bold', label: 'Îndrăzneț', description: 'Fundal întunecat, impact vizual' },
];

/* ═══════ FRONT SIDES ═══════ */

function ClassicFront({ data }: { data: CardData }) {
  return (
    <div style={{ padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Arial, Helvetica, sans-serif', background: '#ffffff' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <img src="/logo-icmpp.png" alt="ICMPP" style={{ height: '40px', width: 'auto' }} crossOrigin="anonymous" />
          <div>
            <p style={{ fontSize: '11px', color: '#2B4C7E', fontWeight: 'bold', lineHeight: '1.3', margin: 0 }}>Institutul de Chimie</p>
            <p style={{ fontSize: '11px', color: '#2B4C7E', fontWeight: 'bold', lineHeight: '1.3', margin: 0 }}>Macromoleculară "Petru Poni" Iași</p>
          </div>
        </div>
        <div style={{ height: '2px', background: '#2B4C7E', marginBottom: '2px' }} />
        <div style={{ height: '1px', background: 'rgba(43,76,126,0.2)', marginBottom: '12px' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2B4C7E', textAlign: 'center', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>
          {data.displayName}
        </h2>
        {data.position && (
          <p style={{ fontSize: '11px', color: '#787850', fontStyle: 'italic', textAlign: 'center', margin: '0 0 2px 0' }}>{data.position}</p>
        )}
        {data.department && (
          <p style={{ fontSize: '10px', color: '#505050', textAlign: 'center', margin: 0 }}>{data.department}</p>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          {data.phone && <p style={{ fontSize: '10px', color: '#282828', margin: '0 0 2px 0' }}>Tel: {data.phone}</p>}
          <p style={{ fontSize: '10px', color: '#282828', margin: 0 }}>{data.email}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <QRCodeCanvas value="https://www.icmpp.ro" size={52} level="M" />
          <p style={{ fontSize: '7px', color: '#787878', marginTop: '2px' }}>icmpp.ro</p>
        </div>
      </div>
    </div>
  );
}

function ModernFront({ data }: { data: CardData }) {
  return (
    <div style={{ height: '100%', display: 'flex', fontFamily: 'Arial, Helvetica, sans-serif', background: '#ffffff' }}>
      {/* Left accent strip */}
      <div style={{ width: '8px', background: 'linear-gradient(180deg, #2B4C7E 0%, #1a365d 50%, #3b82f6 100%)', flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <img src="/logo-icmpp.png" alt="ICMPP" style={{ height: '32px', width: 'auto' }} crossOrigin="anonymous" />
            <p style={{ fontSize: '9px', color: '#2B4C7E', fontWeight: 'bold', lineHeight: '1.3', margin: 0 }}>ICMPP "Petru Poni" Iași</p>
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1a365d', margin: '0 0 4px 0' }}>
            {data.displayName}
          </h2>
          {data.position && (
            <p style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600', margin: '0 0 2px 0' }}>{data.position}</p>
          )}
          {data.department && (
            <p style={{ fontSize: '9px', color: '#64748b', margin: 0 }}>{data.department}</p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            {data.phone && <p style={{ fontSize: '9px', color: '#374151', margin: '0 0 2px 0' }}>📞 {data.phone}</p>}
            <p style={{ fontSize: '9px', color: '#374151', margin: 0 }}>✉ {data.email}</p>
          </div>
          <QRCodeCanvas value="https://www.icmpp.ro" size={44} level="M" />
        </div>
      </div>
    </div>
  );
}

function MinimalFront({ data }: { data: CardData }) {
  return (
    <div style={{ height: '100%', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: 'Arial, Helvetica, sans-serif', background: '#fafafa' }}>
      <img src="/logo-icmpp.png" alt="ICMPP" style={{ height: '28px', width: 'auto', marginBottom: '14px' }} crossOrigin="anonymous" />
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', letterSpacing: '1px', margin: '0 0 6px 0' }}>
        {data.displayName}
      </h2>
      <div style={{ width: '40px', height: '2px', background: '#2B4C7E', marginBottom: '8px' }} />
      {data.position && (
        <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0' }}>{data.position}</p>
      )}
      {data.department && (
        <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 10px 0' }}>{data.department}</p>
      )}
      <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: '#4b5563' }}>
        {data.phone && <span>{data.phone}</span>}
        <span>{data.email}</span>
      </div>
    </div>
  );
}

function BoldFront({ data }: { data: CardData }) {
  return (
    <div style={{ height: '100%', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Arial, Helvetica, sans-serif', background: '#0f172a' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <img src="/logo-icmpp.png" alt="ICMPP" style={{ height: '32px', width: 'auto', filter: 'brightness(0) invert(1)' }} crossOrigin="anonymous" />
          <p style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', margin: 0 }}>ICMPP "Petru Poni"</p>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 'bold', color: '#f8fafc', letterSpacing: '1px', margin: '0 0 4px 0' }}>
          {data.displayName}
        </h2>
        {data.position && (
          <p style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '600', margin: '0 0 2px 0' }}>{data.position}</p>
        )}
        {data.department && (
          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>{data.department}</p>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          {data.phone && <p style={{ fontSize: '9px', color: '#cbd5e1', margin: '0 0 2px 0' }}>{data.phone}</p>}
          <p style={{ fontSize: '9px', color: '#cbd5e1', margin: 0 }}>{data.email}</p>
        </div>
        <QRCodeCanvas value="https://www.icmpp.ro" size={46} level="M" bgColor="transparent" fgColor="#60a5fa" />
      </div>
    </div>
  );
}

/* ═══════ BACK SIDES ═══════ */

function ClassicBack({ data }: { data: CardData }) {
  return (
    <div style={{ padding: '12px 16px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, Helvetica, sans-serif', background: '#2B4C7E' }}>
      <QRCodeCanvas value={data.profileUrl} size={90} level="M" bgColor="transparent" fgColor="#ffffff" />
      <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#ffffff', marginTop: '8px', marginBottom: '6px' }}>Profil profesional</p>
      <div style={{ width: '70%', height: '1px', background: 'rgba(255,255,255,0.5)', marginBottom: '8px' }} />
      <p style={{ fontWeight: 'bold', fontSize: '12px', color: '#ffffff', letterSpacing: '1px', margin: '0 0 4px 0' }}>{data.displayName}</p>
      <p style={{ fontSize: '8px', color: 'rgba(180,200,230,0.8)', margin: 0 }}>Scanează pentru contact și profil</p>
    </div>
  );
}

function ModernBack({ data }: { data: CardData }) {
  return (
    <div style={{ height: '100%', display: 'flex', fontFamily: 'Arial, Helvetica, sans-serif', background: 'linear-gradient(135deg, #1a365d 0%, #2B4C7E 50%, #3b82f6 100%)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <QRCodeCanvas value={data.profileUrl} size={85} level="M" bgColor="transparent" fgColor="#ffffff" />
        <p style={{ fontWeight: 'bold', fontSize: '12px', color: '#ffffff', marginTop: '8px', marginBottom: '4px' }}>Profil profesional</p>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.5px', margin: 0 }}>{data.displayName}</p>
      </div>
    </div>
  );
}

function MinimalBack({ data }: { data: CardData }) {
  return (
    <div style={{ height: '100%', padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, Helvetica, sans-serif', background: '#f8fafc' }}>
      <QRCodeCanvas value={data.profileUrl} size={90} level="M" fgColor="#2B4C7E" />
      <p style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b', marginTop: '10px', marginBottom: '2px' }}>{data.displayName}</p>
      <p style={{ fontSize: '9px', color: '#94a3b8', margin: 0 }}>Scanează codul QR pentru profil</p>
    </div>
  );
}

function BoldBack({ data }: { data: CardData }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, Helvetica, sans-serif', background: '#0f172a' }}>
      <QRCodeCanvas value={data.profileUrl} size={95} level="M" bgColor="transparent" fgColor="#60a5fa" />
      <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#f8fafc', marginTop: '8px', letterSpacing: '1px', marginBottom: '4px' }}>{data.displayName}</p>
      <p style={{ fontSize: '8px', color: '#64748b', margin: 0 }}>PROFIL PROFESIONAL</p>
    </div>
  );
}

/* ═══════ EXPORTS ═══════ */

const FRONT_MAP: Record<VariantId, React.FC<{ data: CardData }>> = {
  classic: ClassicFront,
  modern: ModernFront,
  minimal: MinimalFront,
  bold: BoldFront,
};

const BACK_MAP: Record<VariantId, React.FC<{ data: CardData }>> = {
  classic: ClassicBack,
  modern: ModernBack,
  minimal: MinimalBack,
  bold: BoldBack,
};

const BG_MAP: Record<VariantId, { front: string; back: string }> = {
  classic: { front: '#ffffff', back: '#2B4C7E' },
  modern: { front: '#ffffff', back: '#1a365d' },
  minimal: { front: '#fafafa', back: '#f8fafc' },
  bold: { front: '#0f172a', back: '#0f172a' },
};

export function getFrontComponent(variant: VariantId) { return FRONT_MAP[variant]; }
export function getBackComponent(variant: VariantId) { return BACK_MAP[variant]; }
export function getBackgroundColors(variant: VariantId) { return BG_MAP[variant]; }
