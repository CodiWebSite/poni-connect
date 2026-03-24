import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const UPTIME_KUMA_URL = 'http://193.138.98.149:33001/status/icmpp';

export default function UptimeMonitorPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          Monitoring — Uptime Kuma
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg overflow-hidden border border-border">
          <iframe
            src={UPTIME_KUMA_URL}
            className="w-full border-0"
            style={{ height: '75vh', minHeight: 500 }}
            title="Uptime Kuma Status"
            loading="lazy"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Pagina de status publică Uptime Kuma •{' '}
          <a href={UPTIME_KUMA_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Deschide în tab nou
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
