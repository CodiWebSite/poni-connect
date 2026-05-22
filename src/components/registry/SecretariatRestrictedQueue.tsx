import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Check, Loader2, EyeOff, Paperclip } from "lucide-react";

interface Item {
  id: string;
  temp_code: string;
  entry_type: string;
  document_date: string | null;
  declared_registration_date: string;
  is_late: boolean;
  source_department_key: string;
  attachments_count: number;
  created_at: string;
}

export default function SecretariatRestrictedQueue({ onChange, canViewFull }: { onChange: () => void; canViewFull: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("secretariat_restricted_queue");
    if (error) toast.error(error.message);
    setItems((data as Item[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async () => {
    if (!confirming) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("approve_registry_request_restricted", { _request_id: confirming.id });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    const d = data as { series_key: string; year: number; official_number: number };
    toast.success(`Număr alocat: ${d.series_key}/${d.year}/${d.official_number}`);
    setConfirming(null);
    load(); onChange();
  };

  return (
    <div className="space-y-3">
      <Alert>
        <EyeOff className="h-4 w-4" />
        <AlertDescription>
          Secretariatul vede doar metadate minime (tip, departament sursă, dată declarată, număr atașamente). Conținutul este vizibil DOAR conducerii ({canViewFull ? "ai acces complet" : "tu nu"}).
        </AlertDescription>
      </Alert>

      {loading && <div className="text-sm text-muted-foreground p-4">Se încarcă…</div>}
      {!loading && !items.length && <Card><CardContent className="p-6 text-center text-muted-foreground">Nicio cerere strict-conducere în așteptare.</CardContent></Card>}

      {items.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex justify-between items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs">{r.temp_code}</span>
                <Badge variant="outline">{r.entry_type}</Badge>
                <Badge variant="outline">{r.source_department_key}</Badge>
                {r.is_late && <Badge variant="outline" className="text-orange-700 border-orange-300">Retroactiv</Badge>}
                {r.attachments_count > 0 && <Badge variant="secondary"><Paperclip className="w-3 h-3 mr-1" />{r.attachments_count}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Declarată: {format(new Date(r.declared_registration_date), "dd MMM yyyy", { locale: ro })} • Trimisă: {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: ro })}
              </div>
              <div className="text-xs italic text-muted-foreground mt-1">Conținut redactat — vizibil doar conducerii.</div>
            </div>
            <Button size="sm" onClick={() => setConfirming(r)}><Check className="w-4 h-4 mr-1" />Aprobă orb</Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmă aprobarea blind</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Vei aloca numărul oficial pentru {confirming?.temp_code} fără a vedea conținutul. Acțiunea este înregistrată în audit ca <code>redacted: true</code>.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>Anulează</Button>
            <Button onClick={approve} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Confirmă alocare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
