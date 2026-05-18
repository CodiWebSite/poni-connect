import IncidentReportForm from '@/components/security/IncidentReportForm';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Card, CardContent } from '@/components/ui/card';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { ShieldAlert } from 'lucide-react';

export default function ReportIncident() {
  const { enabled, loading } = useFeatureFlag('incident_reporting_enabled', true);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <main className="lg:ml-64 px-4 lg:px-8 py-8 max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-warning" />
            Raportează un incident
          </h1>
          <p className="text-muted-foreground mt-2">
            Phishing, cont compromis, dispozitiv pierdut — anunță echipa de securitate în câțiva pași.
          </p>
        </header>
        {loading ? null : !enabled ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Modulul de raportare este momentan dezactivat. Contactează Super Admin sau IT.
          </CardContent></Card>
        ) : (
          <IncidentReportForm />
        )}
      </main>
    </div>
  );
}
