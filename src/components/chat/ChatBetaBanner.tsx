import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ChatBetaBanner = () => (
  <Alert className="border-warning/30 bg-warning/10 mb-4">
    <AlertTriangle className="h-4 w-4 text-warning" />
    <AlertDescription className="text-sm">
      <strong>Modul Beta v0.9</strong> — Mesageria internă este în faza de testare. 
      Dacă întâmpinați probleme, contactați echipa IT prin butonul din sidebar.
    </AlertDescription>
  </Alert>
);

export default ChatBetaBanner;
