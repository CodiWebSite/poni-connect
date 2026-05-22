import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Search, Ban, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface Entry {
  id: string;
  series_key: string;
  year: number;
  official_number: number;
  registration_date: string;
  entry_type: string;
  confidentiality: string;
  source_department_key: string | null;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  status: string;
  is_demo: boolean;
  is_late: boolean;
}

export default function EntriesRegister() {
  const { isSuperAdmin, role } = useUserRole();
  const isSecretariat = role === "secretariat" || isSuperAdmin;
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cancelling, setCancelling] = useState<Entry | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("registry_entries")
      .select("id, series_key, year, official_number, registration_date, entry_type, confidentiality, source_department_key, sender, recipient, subject, status, is_demo, is_late")
      .order("year", { ascending: false })
      .order("official_number", { ascending: false })
      .limit(300);
    if (yearFilter !== "all") q = q.eq("year", parseInt(yearFilter));
    if (typeFilter !== "all") q = q.eq("entry_type", typeFilter as "intrare" | "iesire" | "intern");
    const { data } = await q;
    setItems((data as Entry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [yearFilter, typeFilter]);

  const filtered = items.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.subject?.toLowerCase().includes(s) ||
      e.sender?.toLowerCase().includes(s) ||
      e.recipient?.toLowerCase().includes(s) ||
      String(e.official_number).includes(s) ||
      e.source_department_key?.toLowerCase().includes(s)
    );
  });

  const doCancel = async () => {
    if (!cancelling || !reason.trim()) { toast.error("Motivul este obligatoriu."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("cancel_registry_entry", { _entry_id: cancelling.id, _reason: reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Înregistrare anulată. Numărul rămâne rezervat.");
    setCancelling(null); setReason("");
    load();
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Caută după subiect, expeditor, număr, departament…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toți anii</SelectItem>
              {[0, 1, 2, 3].map((d) => <SelectItem key={d} value={String(currentYear - d)}>{currentYear - d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate tipurile</SelectItem>
              <SelectItem value="intrare">Intrare</SelectItem>
              <SelectItem value="iesire">Ieșire</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && <div className="text-sm text-muted-foreground p-4">Se încarcă…</div>}
      {!loading && !filtered.length && <Card><CardContent className="p-6 text-center text-muted-foreground">Nicio înregistrare.</CardContent></Card>}

      <div className="space-y-1">
        {filtered.map((e) => (
          <Card key={e.id} className={e.status === "cancelled" ? "opacity-60" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="font-mono text-sm font-semibold min-w-[140px]">
                {e.series_key}/{e.year}/{e.official_number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">{e.entry_type}</Badge>
                  {e.is_demo && <Badge variant="outline" className="text-xs text-amber-700">DEMO</Badge>}
                  {e.status === "cancelled" && <Badge variant="destructive" className="text-xs">ANULAT</Badge>}
                  {e.is_late && <Badge variant="outline" className="text-xs text-orange-700">Retro</Badge>}
                  {e.confidentiality === "restricted_management" && <Badge variant="outline" className="text-xs">Strict conducere</Badge>}
                  <span className="text-xs text-muted-foreground">{format(new Date(e.registration_date), "dd MMM yyyy", { locale: ro })}</span>
                </div>
                <div className="text-sm truncate">{e.subject || <em className="text-muted-foreground">—</em>}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {e.sender && `De la: ${e.sender}`} {e.recipient && `• Către: ${e.recipient}`} {e.source_department_key && `• ${e.source_department_key}`}
                </div>
              </div>
              {isSecretariat && e.status === "active" && (
                <Button size="sm" variant="ghost" onClick={() => setCancelling(e)}>
                  <Ban className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anulează înregistrarea {cancelling?.series_key}/{cancelling?.year}/{cancelling?.official_number}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Numărul va rămâne rezervat și vizibil în registru cu status „anulat". Această acțiune este auditată.</p>
          <div>
            <Label>Motiv anulare *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>Renunță</Button>
            <Button variant="destructive" onClick={doCancel} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}Anulează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
