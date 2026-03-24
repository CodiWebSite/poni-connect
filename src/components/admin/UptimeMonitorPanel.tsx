import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UPTIME_KUMA_URL = 'http://193.138.98.149:33001/status/icmpp';

export default function UptimeMonitorPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Monitoring — Uptime Kuma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-12 space-y-4">
          <Activity className="w-16 h-16 mx-auto text-muted-foreground/40" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Pagina de status nu poate fi încărcată inline deoarece serverul Uptime Kuma folosește HTTP.
            </p>
            <p className="text-xs text-muted-foreground">
              Browserul blochează conținutul HTTP pe o pagină HTTPS (mixed content).
            </p>
          </div>
          <Button asChild>
            <a href={UPTIME_KUMA_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Deschide Uptime Kuma
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
