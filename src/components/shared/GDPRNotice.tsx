import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GDPRNoticeProps {
  context?: 'auth' | 'profile' | 'medical' | 'hr';
  className?: string;
}

const contextMessages: Record<string, string> = {
  auth: 'Prin autentificare, datele dvs. sunt prelucrate conform GDPR pentru gestionarea accesului la platforma ICMPP.',
  profile: 'Datele personale afișate sunt prelucrate conform GDPR. Puteți solicita rectificarea sau ștergerea lor.',
  medical: 'Datele medicale sunt stric confidențiale și accesibile doar personalului medical autorizat, conform GDPR Art. 9.',
  hr: 'Datele angajaților sunt prelucrate în baza contractului de muncă și a obligațiilor legale, conform GDPR.',
};

export const GDPRNotice = ({ context = 'auth', className = '' }: GDPRNoticeProps) => {
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground ${className}`}>
      <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
      <p>
        {contextMessages[context]}{' '}
        <Link to="/privacy" className="text-primary hover:underline font-medium">
          Politica de confidențialitate
        </Link>
      </p>
    </div>
  );
};
