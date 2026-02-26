import MainLayout from '@/components/layout/MainLayout';
import { AlertTriangle } from 'lucide-react';

const Maintenance = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Platforma este în mentenanță</h1>
        <p className="text-muted-foreground">
          Se efectuează lucrări de întreținere. Vă rugăm să reveniți mai târziu.
        </p>
        <p className="text-sm text-muted-foreground">
          Dacă aveți nevoie urgentă, contactați departamentul IT.
        </p>
      </div>
    </div>
  );
};

export default Maintenance;
